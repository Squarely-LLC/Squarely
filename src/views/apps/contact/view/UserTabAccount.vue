<script lang="ts" setup>
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useTodos } from "@/stores/todos";
import { computed, onMounted } from "vue";
import UserInvoiceTable from "./UserInvoiceTable.vue";

const props = defineProps<{ user: ContactProperties | null }>();

// Images
import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";
import avatar4 from "@images/avatars/avatar-4.png";
import avatar5 from "@images/avatars/avatar-5.png";
import avatar6 from "@images/avatars/avatar-6.png";
import avatar7 from "@images/avatars/avatar-7.png";
import avatar8 from "@images/avatars/avatar-8.png";
import figma from "@images/icons/project-icons/figma.png";
import html5 from "@images/icons/project-icons/html5.png";
import python from "@images/icons/project-icons/python.png";
import react from "@images/icons/project-icons/react.png";
import sketch from "@images/icons/project-icons/sketch.png";
import vue from "@images/icons/project-icons/vue.png";
import xamarin from "@images/icons/project-icons/xamarin.png";

// Project Table Header
const projectTableHeaders = [
  { title: "PROJECT", key: "project" },
  { title: "LEADER", key: "leader" },
  { title: "Team", key: "team" },
  { title: "PROGRESS", key: "progress" },
  { title: "Action", key: "Action", sortable: false },
];

const search = ref("");

const options = ref({ itemsPerPage: 5, page: 1 });

const projects = [
  {
    logo: react,
    name: "BGC eCommerce App",
    project: "React Project",
    leader: "Eileen",
    progress: 78,
    hours: "18:42",
    team: [avatar1, avatar8, avatar6],
    extraMembers: 3,
  },
  {
    logo: figma,
    name: "Falcon Logo Design",
    project: "Figma Project",
    leader: "Owen",
    progress: 25,
    hours: "20:42",
    team: [avatar5, avatar2],
  },
  {
    logo: vue,
    name: "Dashboard Design",
    project: "Vuejs Project",
    leader: "Keith",
    progress: 62,
    hours: "120:87",
    team: [avatar8, avatar2, avatar1],
  },
  {
    logo: xamarin,
    name: "Foodista mobile app",
    project: "Xamarin Project",
    leader: "Merline",
    progress: 8,
    hours: "120:87",
    team: [avatar3, avatar4, avatar7],
    extraMembers: 8,
  },
  {
    logo: python,
    name: "Dojo Email App",
    project: "Python Project",
    leader: "Harmonia",
    progress: 51,
    hours: "230:10",
    team: [avatar4, avatar3, avatar1],
    extraMembers: 5,
  },
  {
    logo: sketch,
    name: "Blockchain Website",
    project: "Sketch Project",
    leader: "Allyson",
    progress: 92,
    hours: "342:41",
    team: [avatar1, avatar8],
  },
  {
    logo: html5,
    name: "Hoffman Website",
    project: "HTML Project",
    leader: "Georgie",
    progress: 80,
    hours: "12:45",
    team: [avatar1, avatar8, avatar6],
  },
];

const moreList = [
  { title: "Download", value: "Download" },
  { title: "Delete", value: "Delete" },
  { title: "View", value: "View" },
];

// Todos / meetings store
const todosStore = useTodos();

onMounted(() => {
  // ensure store initialized — harmless if already initialized
  try {
    todosStore.init();
  } catch (e) {
    /* ignore */
  }
});

function timeAgo(iso?: string) {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = now - then; // positive => past, negative => future
    const absMins = Math.round(Math.abs(diff) / 60000);

    // Past dates
    if (diff >= 0) {
      if (absMins < 1) return "just now";
      if (absMins < 60) return `${absMins} min${absMins > 1 ? "s" : ""} ago`;
      const hours = Math.round(absMins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
      const days = Math.round(hours / 24);
      if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
      // for older items, show a short date
      return new Date(then).toLocaleDateString();
    }

    // Future dates
    if (absMins < 60) return `in ${absMins} min${absMins > 1 ? "s" : ""}`;
    const hours = Math.round(absMins / 60);
    if (hours < 24) return `in ${hours} hour${hours > 1 ? "s" : ""}`;
    const days = Math.round(hours / 24);
    if (days < 7) return `in ${days} day${days > 1 ? "s" : ""}`;
    return `on ${new Date(then).toLocaleDateString()}`;
  } catch {
    return iso;
  }
}

// Normalize activities from todos + meetings for the timeline
const activities = computed(() => {
  const userId = props.user?.id ?? null;
  const items: Array<any> = [];

  if (!userId) return items;

  // From todos: include any todo where contact is collaborator
  // plus messages/activities authored by contact
  for (const todo of todosStore.items || []) {
    const isCollaborator = (todo.collaborators || []).some(
      (c: any) => String(c?.id) === String(userId)
    );

    if (isCollaborator) {
      items.push({
        kind: "todo",
        title: todo.title,
        body: todo.notes || "",
        date: todo.updatedAt || todo.createdAt,
        meta: { todoId: todo.id },
      });
    }

    // todo activities authored by the contact
    if (Array.isArray(todo.activities)) {
      for (const a of todo.activities) {
        if (String(a.author?.id) === String(userId)) {
          items.push({
            kind: "todo-activity",
            title: todo.title,
            body: a.body,
            date: a.createdAt,
            actor: a.author,
            meta: { todoId: todo.id, activityId: a.id },
          });
        }
      }
    }

    // todo messages authored by the contact
    if (Array.isArray(todo.messages)) {
      for (const m of todo.messages) {
        if (String((m.author as any)?.id) === String(userId)) {
          items.push({
            kind: "todo-message",
            title: todo.title,
            body: m.body,
            date: m.createdAt,
            actor: m.author,
            meta: { todoId: todo.id, messageId: m.id },
          });
        }
      }
    }

    // Steps: include steps where the contact is a collaborator as their own activity
    if (Array.isArray(todo.steps)) {
      for (const st of todo.steps) {
        const isStepCollaborator = (st.collaborators || []).some(
          (c: any) => String(c?.id) === String(userId)
        );

        if (isStepCollaborator) {
          items.push({
            kind: "todo-step",
            title: st.title || todo.title,
            body: st.notes || "",
            date:
              st.updatedAt || st.createdAt || todo.updatedAt || todo.createdAt,
            // show the contact as the actor so their avatar/name appears in the timeline
            actor: props.user,
            meta: { todoId: todo.id, stepId: st.id },
            parentTitle: todo.title,
          });
        }
      }
    }
  }

  // From meetings: linkedTo, requestedBy, notes authored by user
  for (const m of todosStore.meetings || []) {
    const linked = Array.isArray(m.linkedTo)
      ? m.linkedTo.some((l: any) => String(l?.id) === String(userId))
      : false;
    const requestedBy =
      m.requestedBy && String(m.requestedBy.id) === String(userId);

    if (linked || requestedBy) {
      items.push({
        kind: "meeting",
        title: m.subject,
        body: m.note || m.summary?.brief || "",
        date: m.startAt || m.createdAt,
        startAt: m.startAt,
        endAt:
          m.endAt ||
          (m.startAt
            ? new Date(
                new Date(m.startAt).getTime() + (m.duration || 0) * 60000
              ).toISOString()
            : undefined),
        duration: typeof m.duration === "number" ? m.duration : undefined,
        linkedTo: Array.isArray(m.linkedTo) ? m.linkedTo : [],
        meta: { meetingId: m.id },
      });
    }

    if (Array.isArray(m.notes)) {
      for (const note of m.notes) {
        if (note && typeof note === "object") {
          const anyNote: any = note;
          if (String(anyNote.author?.id) === String(userId)) {
            items.push({
              kind: "meeting-note",
              title: m.subject,
              body: anyNote.body,
              date: anyNote.createdAt,
              actor: anyNote.author,
              meta: { meetingId: m.id, noteId: anyNote.id },
            });
          }
        }
      }
    }
  }

  // show desired kinds and exclude future-dated activities
  const now = Date.now();
  const filtered = items
    .filter((it) =>
      ["todo", "todo-step", "meeting", "todo-message", "meeting-note"].includes(
        it.kind
      )
    )
    .filter((it) => {
      try {
        const ts = it.startAt
          ? new Date(it.startAt).getTime()
          : it.date
          ? new Date(it.date).getTime()
          : NaN;
        if (isNaN(ts)) return true; // keep if no timestamp
        return ts <= now;
      } catch {
        return true;
      }
    });

  // sort newest first
  filtered.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return filtered;
});

function labelColorName(kind: string) {
  return kind === "meeting" || kind === "meeting-note"
    ? "success"
    : kind === "todo"
    ? "warning"
    : kind === "todo-step"
    ? "secondary"
    : "info";
}

function labelTextForKind(kind: string) {
  if (kind === "todo") return "To-do";
  if (kind === "todo-step") return "Step";
  if (kind === "todo-message") return "Comment";
  if (kind === "meeting-note") return "Note";
  if (kind === "meeting") return "Meeting";
  return "";
}

function todoMessages(todoId: number | string) {
  try {
    const t: any = todosStore.byId(todoId);
    return Array.isArray(t?.messages) ? t.messages : [];
  } catch {
    return [];
  }
}

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDuration(mins?: number) {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function linkedExcludingCurrent(act: any) {
  const userId = props.user?.id ?? null;
  if (!act || !Array.isArray(act.linkedTo)) return [];
  return act.linkedTo.filter((l: any) => String(l?.id) !== String(userId));
}

function stepCollaborators(act: any) {
  const userId = props.user?.id ?? null;
  try {
    const todoId = act?.meta?.todoId;
    const stepId = act?.meta?.stepId;
    if (!todoId || !stepId) return [];
    const t: any = todosStore.byId(todoId);
    if (!t || !Array.isArray(t.steps)) return [];
    const step = t.steps.find((s: any) => String(s.id) === String(stepId));
    if (!step || !Array.isArray(step.collaborators)) return [];
    return step.collaborators.filter(
      (c: any) => String(c?.id) !== String(userId)
    );
  } catch {
    return [];
  }
}

function todoCollaborators(act: any) {
  const userId = props.user?.id ?? null;
  try {
    const todoId = act?.meta?.todoId;
    if (!todoId) return [];
    const t: any = todosStore.byId(todoId);
    if (!t || !Array.isArray(t.collaborators)) return [];
    return t.collaborators.filter((c: any) => String(c?.id) !== String(userId));
  } catch {
    return [];
  }
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <!-- 👉 User Activity timeline -->
      <VCard title="Contact Activity Timeline" class="activity-card">
        <VCardText class="activity-card__body">
          <VTimeline
            side="end"
            align="start"
            line-inset="8"
            truncate-line="start"
            density="compact"
          >
            <template v-if="activities.length === 0">
              <VTimelineItem size="x-small">
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <span class="app-timeline-title">No recent activity</span>
                </div>
              </VTimelineItem>
            </template>

            <template v-else>
              <VTimelineItem
                v-for="(act, idx) in activities"
                :key="
                  act.kind +
                  '-' +
                  (act.meta?.todoId || act.meta?.meetingId || idx)
                "
                :dot-color="
                  act.kind === 'meeting' || act.kind === 'meeting-note'
                    ? 'success'
                    : act.kind === 'todo'
                    ? 'warning'
                    : act.kind === 'todo-step'
                    ? 'secondary'
                    : 'info'
                "
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{ act.title }}</span>
                    <span
                      v-if="act.kind === 'todo-step'"
                      class="text-sm text-medium-emphasis ms-2"
                      >{{ act.parentTitle }}</span
                    >
                    <VChip
                      v-if="
                        [
                          'todo',
                          'todo-step',
                          'todo-message',
                          'meeting-note',
                          'meeting',
                        ].includes(act.kind)
                      "
                      size="small"
                      class="timeline-chip"
                      :color="labelColorName(act.kind)"
                      :text-color="`on-${labelColorName(act.kind)}`"
                      density="compact"
                    >
                      {{ labelTextForKind(act.kind) }}
                    </VChip>
                  </div>

                  <span class="app-timeline-meta">{{ timeAgo(act.date) }}</span>
                </div>

                <div class="app-timeline-text mt-1">{{ act.body }}</div>
                <div v-if="act.kind === 'meeting'" class="mt-2">
                  <div class="d-flex gap-3 align-center flex-wrap mb-2">
                    <div class="text-sm text-medium-emphasis">
                      <VIcon icon="tabler-stopwatch" />
                      {{ formatDuration(act.duration) }}
                    </div>
                  </div>

                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in linkedExcludingCurrent(act).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32">
                            <VImg :src="l.avatarUrl || avatar3" />
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="linkedExcludingCurrent(act).length > 4"
                      :size="32"
                      :color="
                        $vuetify.theme.current.dark ? '#373b50' : '#eeedf0'
                      "
                    >
                      +{{ linkedExcludingCurrent(act).length - 4 }}
                    </VAvatar>
                  </div>
                </div>

                <div v-else-if="act.kind === 'todo'" class="mt-2">
                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in todoCollaborators(act).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32">
                            <VImg :src="l.avatarUrl || avatar3" />
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="todoCollaborators(act).length > 4"
                      :size="32"
                      :color="
                        $vuetify.theme.current.dark ? '#373b50' : '#eeedf0'
                      "
                    >
                      +{{ todoCollaborators(act).length - 4 }}
                    </VAvatar>
                  </div>
                </div>

                <div v-if="act.kind === 'todo-step'" class="mt-2">
                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in stepCollaborators(act).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32">
                            <VImg :src="l.avatarUrl || avatar3" />
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="stepCollaborators(act).length > 4"
                      :size="32"
                      :color="
                        $vuetify.theme.current.dark ? '#373b50' : '#eeedf0'
                      "
                    >
                      +{{ stepCollaborators(act).length - 4 }}
                    </VAvatar>
                  </div>
                </div>

                <div
                  v-else-if="act.actor"
                  class="d-flex justify-space-between align-center flex-wrap"
                >
                  <div class="d-flex align-center mt-2">
                    <div class="d-flex flex-column"></div>
                  </div>
                </div>
              </VTimelineItem>
            </template>
          </VTimeline>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <UserInvoiceTable />
    </VCol>
  </VRow>
</template>

<style scoped>
.activity-card {
  display: flex;
  flex-direction: column;

  /* fixed height while remaining responsive on small screens */
  block-size: 420px;
}

.activity-card__body {
  /* allow the timeline to scroll inside the card */
  overflow: auto;

  /* ensure it grows to fill the card's remaining space */
  flex: 1 1 auto;
  padding-inline-end: 0.5rem; /* small padding to avoid scrollbar overlap */

  /* Firefox: thin + subtle color */
  scrollbar-color: rgba(0 0 0 / 12%) transparent;
  scrollbar-width: thin;
}

/* WebKit (Chrome, Edge, Safari) thin scrollbar */

.activity-card__body::-webkit-scrollbar {
  block-size: 10px;
  inline-size: 10px;
}

.activity-card__body::-webkit-scrollbar-track {
  background: transparent;
}

.activity-card__body::-webkit-scrollbar-thumb {
  border: 2px solid transparent; /* gives thumb breathing space */
  border-radius: 999px;
  background-clip: padding-box;
  background-color: rgba(0 0 0 / 12%);
}

.activity-card__body::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0 0 0 / 18%);
}

/* Ensure timeline items don't force the card to expand unexpectedly */
.activity-card__body .v-timeline {
  min-block-size: 0;
}

.todo-comments {
  padding-inline-start: 44px; /* align with avatar/timeline indentation */
}

.todo-comment .v-avatar {
  flex: 0 0 auto;
}

.todo-comment .text-sm {
  line-height: 1.15;
}

.timeline-chip {
  margin-inline-start: 8px;
}
</style>
