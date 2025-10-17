import type { Meeting, ToDo } from "@/data/schema";
import { SeedMeetings, SeedTodos } from "@/data/seed-todos";
import { useContactsStore } from "@/stores/contacts";
import { defineStore } from "pinia";

const STORAGE_KEY_MEETINGS = "app.meetings.v1";
const STORAGE_KEY_MEETINGS_SEEDED = "app.meetings.seeded.v1";

function loadMeetingsFromStorage(): Meeting[] | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_MEETINGS) || "null");
  } catch {
    return null;
  }
}
function saveMeetingsToStorage(items: Meeting[]) {
  localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(items));
  localStorage.setItem(STORAGE_KEY_MEETINGS_SEEDED, "1");
}

const STORAGE_KEY = "app.todos.v1";

function loadFromStorage(): ToDo[] | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
function saveToStorage(items: ToDo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function computeEndAt(startAt: string, durationMin: number): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  d.setMinutes(d.getMinutes() + Number(durationMin || 0));
  return d.toISOString();
}

export const useTodos = defineStore("todos", {
  state: () => ({
    items: [] as ToDo[],
    meetings: [] as Meeting[],
    initialized: false,
  }),
  getters: {
    all: (s) => s.items,
    byId: (s) => (id: number | string) =>
      s.items.find((t) => String(t.id) === String(id)),
    byStatus: (s) => (status: ToDo["status"]) =>
      s.items.filter((t) => t.status === status),
    important: (s) => s.items.filter((t) => t.important),
    search: (s) => (q: string) => {
      const ql = q.trim().toLowerCase();
      if (!ql) return s.items;
      return s.items.filter(
        (t) =>
          t.title.toLowerCase().includes(ql) ||
          (t.notes || "").toLowerCase().includes(ql)
      );
    },
    meetingsAll: (s) => s.meetings,
    meetingById: (s) => (id: number | string) =>
      s.meetings.find((m) => String(m.id) === String(id)),
    searchMeetings: (s) => (q: string) => {
      const ql = q.trim().toLowerCase();
      if (!ql) return s.meetings;
      return s.meetings.filter(
        (m) =>
          m.subject.toLowerCase().includes(ql) ||
          (m.location || "").toLowerCase().includes(ql) ||
          (m.note || "").toLowerCase().includes(ql)
      );
    },
  },
  actions: {
    init() {
      // ensure contacts are seeded/initialized first so we can resolve collaborator refs
      try {
        const contactsStore = useContactsStore();
        contactsStore.init();
      } catch (error) {
        // swallow — if pinia isn't ready yet this will be retried later when UI initializes
        // console.warn('contacts store init failed during todos init:', error)
      }
      const seeded = localStorage.getItem(STORAGE_KEY_MEETINGS_SEEDED) === "1";
      const stored = loadMeetingsFromStorage();
      this.meetings =
        seeded && Array.isArray(stored) ? stored : [...SeedMeetings];
      localStorage.setItem(STORAGE_KEY_MEETINGS_SEEDED, "1");
      if (this.initialized) return;

      // todos: load and normalize collaborator references to use canonical contact refs
      const storedTodos = loadFromStorage();
      const rawTodos =
        storedTodos && Array.isArray(storedTodos)
          ? storedTodos
          : [...SeedTodos];

      // map collaborator/author refs to contact store entries when possible
      const contactsStore = useContactsStore();
      const resolveRef = (ref: any) => {
        if (!ref) return ref;
        const id = ref.id ?? ref;

        // Only match by id — seeded todos should reference contact IDs directly.
        const byId = contactsStore.byId(id);
        if (byId) {
          return {
            id: byId.id,
            name: byId.fullName,
            avatarUrl: byId.picture || undefined,
          };
        }

        // fallback: keep existing ContactRef-like object or create a minimal one
        if (typeof ref === "object" && ref.name) return ref;
        return { id, name: String(ref) };
      };

      const normalizeTodo = (t: any) => {
        const copy = { ...t } as any;
        copy.collaborators = Array.isArray(t.collaborators)
          ? t.collaborators.map((c: any) => resolveRef(c))
          : [];
        copy.steps = Array.isArray(t.steps)
          ? t.steps.map((s: any) => ({
              ...s,
              collaborators: Array.isArray(s.collaborators)
                ? s.collaborators.map((c: any) => resolveRef(c))
                : [],
            }))
          : [];
        copy.activities = Array.isArray(t.activities)
          ? t.activities.map((a: any) => ({
              ...a,
              author: resolveRef(a.author),
            }))
          : [];
        copy.messages = Array.isArray(t.messages)
          ? t.messages.map((m: any) => ({ ...m, author: resolveRef(m.author) }))
          : [];
        return copy as ToDo;
      };

      this.items = rawTodos.map(normalizeTodo);

      // meetings
      const storedMeetings = loadMeetingsFromStorage();
      this.meetings =
        Array.isArray(storedMeetings) && storedMeetings.length > 0
          ? storedMeetings
          : [...SeedMeetings];

      this.initialized = true;

      // persist both
      this.$subscribe(
        (_mutation, state) => {
          saveToStorage(state.items);
          saveMeetingsToStorage(state.meetings);
        },
        { detached: true }
      );

      if (typeof window !== "undefined") {
        void this.syncExistingTodosWithMockApi();
      }
    },

    addTodo(todo: Partial<ToDo>) {
      const now = new Date().toISOString();
      const maxExistingId = this.items.reduce<number>((max, item) => {
        const numericId = Number(item.id);
        return Number.isFinite(numericId) && numericId > max ? numericId : max;
      }, 0);
      const nextId = maxExistingId + 1;
      const newTodo: ToDo = {
        id: nextId,
        title: todo.title || "Untitled",
        collaborators: todo.collaborators || [],
        dueAt: todo.dueAt || now,
        priority: (todo.priority as ToDo["priority"]) || "normal",
        important: !!todo.important,
        status: (todo.status as ToDo["status"]) || "pending",
        steps: todo.steps || [],
        notes: todo.notes || "",
        activities: todo.activities || [],
        messages: (todo as any).messages || [],
        createdAt: now,
        updatedAt: now,
      };
      this.items.unshift(newTodo);
      if (typeof window !== "undefined") {
        void this.pushTodoToMockApi(newTodo);
      }
      return newTodo;
    },
    updateTodo(id: number | string, patch: Partial<ToDo>) {
      const idx = this.items.findIndex((t) => String(t.id) === String(id));
      if (idx === -1) return;
      const updated = {
        ...this.items[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      this.items.splice(idx, 1, updated);
      return updated;
    },
    removeTodo(id: number | string) {
      const idx = this.items.findIndex((t) => String(t.id) === String(id));
      if (idx !== -1) this.items.splice(idx, 1);
    },
    toggleImportant(id: number | string) {
      const todo = this.byId(id);
      if (todo) this.updateTodo(id, { important: !todo.important });
    },
    setStatus(id: number | string, status: ToDo["status"]) {
      this.updateTodo(id, { status });
    },
    addStep(id: number | string, step: any) {
      const todo = this.byId(id);
      if (!todo) return;
      const steps = [...(todo.steps || []), step];
      this.updateTodo(id, { steps });
    },
    // === Meetings actions ==================================================
    addMeeting(meeting: Partial<Meeting>) {
      const now = new Date().toISOString();
      const nextId = (this.meetings.at(-1)?.id as number | undefined)
        ? Number(this.meetings.at(-1)!.id) + 1
        : 1;

      const startAt = meeting.startAt || now;
      const duration =
        typeof meeting.duration === "number" ? meeting.duration : 30;

      const newMeeting: Meeting = {
        id: nextId,
        subject: meeting.subject || "Untitled meeting",
        startAt,
        duration,
        endAt: computeEndAt(startAt, duration),
        type: (meeting.type as Meeting["type"]) || "Sales",
        linkedTo: (meeting.linkedTo as any) || [],
        location: meeting.location || "",
        note: meeting.note || "",
        attachments: meeting.attachments || [],
        requestedBy: (meeting.requestedBy as any) || null,
        notes: Array.isArray((meeting as any).notes)
          ? (meeting as any).notes
          : [],
        summary: (meeting as any).summary,
        createdAt: now,
        updatedAt: now,
      };

      this.meetings.unshift(newMeeting);
      return newMeeting;
    },

    updateMeeting(id: number | string, patch: Partial<Meeting>) {
      const idx = this.meetings.findIndex((m) => String(m.id) === String(id));
      if (idx === -1) return;
      const prev = this.meetings[idx];
      const startAt = patch.startAt ?? prev.startAt;
      const duration =
        typeof patch.duration === "number" ? patch.duration : prev.duration;

      const next: Meeting = {
        ...prev,
        ...patch,
        endAt: computeEndAt(startAt, duration),
        updatedAt: new Date().toISOString(),
      };
      this.meetings.splice(idx, 1, next);
      return next;
    },

    removeMeeting(id: number | string) {
      const idx = this.meetings.findIndex((m) => String(m.id) === String(id));
      if (idx !== -1) this.meetings.splice(idx, 1);
    },
    // ======================================================================
    async pushTodoToMockApi(todo: ToDo) {
      try {
        await fetch("/api/apps/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(todo),
        });
      } catch (error) {
        console.warn("Failed to upsert todo to mock API:", error);
      }
    },

    async syncExistingTodosWithMockApi() {
      const todos = [...this.items];
      await Promise.all(
        todos.map(async (todo) => {
          try {
            const res = await fetch(`/api/apps/todos/${todo.id}`);
            if (res.status === 404) {
              await this.pushTodoToMockApi(todo);
            }
          } catch (error) {
            console.warn(
              `Failed to sync todo ${todo.id} with mock API:`,
              error
            );
          }
        })
      );
    },
  },
});
