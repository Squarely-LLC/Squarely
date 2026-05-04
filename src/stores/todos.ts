import type { Meeting, Message, ToDo, ToDoAttachment } from "@/data/schema";
import { SeedMeetings, SeedTodos } from "@/data/seed-todos";
import { useContactsStore } from "@/stores/contacts";
import { defineStore } from "pinia";

const STORAGE_KEY_MEETINGS = "app.meetings.v2";
const STORAGE_KEY_MEETINGS_SEEDED = "app.meetings.seeded.v2";

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

const STORAGE_KEY = "app.todos.v2";

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

function toDateOnlyISOString(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
}

function computeEndAt(startAt: string, durationMin: number): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  d.setMinutes(d.getMinutes() + Number(durationMin || 0));
  return d.toISOString();
}

function normalizeMessage(message: any): Message {
  return {
    ...message,
    body: message?.body ?? "",
    createdAt: message?.createdAt ?? new Date().toISOString(),
    isRead: Boolean(message?.isRead),
    editedAt: message?.editedAt ?? null,
  };
}

function normalizeAttachment(attachment: any): ToDoAttachment | null {
  if (!attachment || typeof attachment !== "object") return null;
  if (attachment.type !== "file" && attachment.type !== "link") return null;
  return {
    type: attachment.type,
    name: attachment.name ?? "",
    url: attachment.url ?? null,
    fileKey: attachment.fileKey ?? null,
  };
}

function replaceDealCodeText(
  value: string | null | undefined,
  previousCode: string,
  nextCode: string,
) {
  if (!value || !previousCode || !nextCode || previousCode === nextCode)
    return value ?? "";

  return value.split(previousCode).join(nextCode);
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
    unreadMessages: (s) =>
      s.items.flatMap((todo) =>
        Array.isArray(todo.messages)
          ? todo.messages
              .filter((message) => !message?.isRead)
              .map((message) => ({
                todoId: todo.id,
                todoTitle: todo.title,
                message,
              }))
          : [],
      ),
    unreadMessageCount(): number {
      return this.unreadMessages.length;
    },
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
        copy.dueAt = toDateOnlyISOString(t.dueAt);
        copy.collaborators = Array.isArray(t.collaborators)
          ? t.collaborators.map((c: any) => resolveRef(c))
          : [];
        copy.steps = Array.isArray(t.steps)
          ? t.steps.map((s: any) => ({
              ...s,
              dueAt: toDateOnlyISOString(s.dueAt),
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
          ? t.messages.map((m: any) =>
              normalizeMessage({
                ...m,
                author: resolveRef(m.author),
              }),
            )
          : [];
        copy.attachment = normalizeAttachment(t.attachment);
        delete copy.priority;
        copy.steps = copy.steps.map((step: any) => {
          const next = { ...step };
          delete next.priority;
          return next;
        });
        copy.relatedTo = t.relatedTo ?? null;
        copy.goalId = t.goalId ?? null;
        copy.milestoneId = t.milestoneId ?? null;
        copy.afterWhen = t.afterWhen ?? null;
        copy.startTrigger = t.startTrigger ?? null;
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
        dueAt: toDateOnlyISOString(todo.dueAt),
        afterWhen: (todo as any).afterWhen ?? null,
        startTrigger: (todo as any).startTrigger ?? null,
        important: !!todo.important,
        status: (todo.status as ToDo["status"]) || "pending",
        steps: todo.steps || [],
        notes: todo.notes || "",
        activities: todo.activities || [],
        messages: (todo as any).messages || [],
        attachment: normalizeAttachment((todo as any).attachment),
        relatedTo: (todo as any).relatedTo || null,
        goalId: (todo as any).goalId ?? null,
        milestoneId: (todo as any).milestoneId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.items.push(newTodo);
      return newTodo;
    },
    updateTodo(id: number | string, patch: Partial<ToDo>) {
      const idx = this.items.findIndex((t) => String(t.id) === String(id));
      if (idx === -1) return;
      const nextPatch = { ...patch } as any;
      if ("dueAt" in nextPatch) nextPatch.dueAt = toDateOnlyISOString(nextPatch.dueAt);
      if (Array.isArray(nextPatch.steps)) {
        nextPatch.steps = nextPatch.steps.map((step: any) => {
          const nextStep = { ...step, dueAt: toDateOnlyISOString(step?.dueAt) };
          delete nextStep.priority;
          return nextStep;
        });
      }
      if (Array.isArray(nextPatch.messages))
        nextPatch.messages = nextPatch.messages.map((message: any) =>
          normalizeMessage(message),
        );
      if ("attachment" in nextPatch)
        nextPatch.attachment = normalizeAttachment(nextPatch.attachment);
      delete nextPatch.priority;
      const updated = {
        ...this.items[idx],
        ...nextPatch,
        updatedAt: new Date().toISOString(),
      };
      this.items.splice(idx, 1, updated);
      return updated;
    },
    removeTodo(id: number | string) {
      const idx = this.items.findIndex((t) => String(t.id) === String(id));
      if (idx !== -1) this.items.splice(idx, 1);
    },
    syncDealReferences(deals: Array<{ id: number | string; code?: string | null }>) {
      const codeById = new Map(
        deals
          .map((deal) => [String(deal.id), String(deal.code ?? "").trim()] as const)
          .filter(([, code]) => code.length),
      );

      const syncRelatedTo = (relatedTo: any) => {
        if (!relatedTo || relatedTo.type !== "deal") return relatedTo;

        const nextCode = codeById.get(String(relatedTo.id));
        if (!nextCode) return relatedTo;

        return {
          ...relatedTo,
          name: nextCode,
        };
      };

      this.items = this.items.map((todo) => {
        const previousCode = String(todo.relatedTo?.name ?? "").trim();
        const nextRelatedTo = syncRelatedTo(todo.relatedTo);
        const nextCode = String(nextRelatedTo?.name ?? "").trim();

        return {
          ...todo,
          relatedTo: nextRelatedTo,
          title: replaceDealCodeText(todo.title, previousCode, nextCode),
          notes: replaceDealCodeText(todo.notes, previousCode, nextCode),
          messages: Array.isArray(todo.messages)
            ? todo.messages.map((message) => ({
                ...message,
                body: replaceDealCodeText(message.body, previousCode, nextCode),
              }))
            : todo.messages,
        };
      });

      this.meetings = this.meetings.map((meeting) => {
        const previousCode = String(meeting.relatedTo?.name ?? "").trim();
        const nextRelatedTo = syncRelatedTo(meeting.relatedTo);
        const nextCode = String(nextRelatedTo?.name ?? "").trim();

        return {
          ...meeting,
          relatedTo: nextRelatedTo,
          subject: replaceDealCodeText(meeting.subject, previousCode, nextCode),
          note: replaceDealCodeText(meeting.note, previousCode, nextCode),
        };
      });
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
        relatedTo: (meeting as any).relatedTo || null,
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
          relatedTo:
            patch.relatedTo !== undefined
              ? (patch.relatedTo as any)
              : prev.relatedTo ?? null,
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
  },
});
