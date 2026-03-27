<script lang="ts" setup>
import { formatSystemDate } from "@core/utils/formatters";
import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useTodos } from "@/stores/todos";
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
import { computed, onMounted, ref } from "vue";

const props = defineProps<{ user: EmployeeProperties | null }>();

// Project Table Header
const projectTableHeaders = [
  { title: "PROJECT", key: "project" },
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
      return formatSystemDate(then);
    }

    // Future dates
    if (absMins < 60) return `in ${absMins} min${absMins > 1 ? "s" : ""}`;
    const hours = Math.round(absMins / 60);
    if (hours < 24) return `in ${hours} hour${hours > 1 ? "s" : ""}`;
    const days = Math.round(hours / 24);
    if (days < 7) return `in ${days} day${days > 1 ? "s" : ""}`;
    return `on ${formatSystemDate(then)}`;
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

  // From employee requests: include requests for this employee
  if (props.user && Array.isArray(props.user.requests)) {
    for (const request of props.user.requests) {
      items.push({
        kind: "employee-request",
        title: request.type,
        body:
          (request as any).reason ||
          (request as any).notes ||
          (request as any).note ||
          "",
        date: request.createdAt,
        actor: null,
        meta: { employeeId: userId, requestId: request.id, request },
        requestType: request.type,
        requestStatus: request.status,
      });
    }
  }

  // show desired kinds and exclude future-dated activities
  const now = Date.now();
  const filtered = items
    .filter((it) =>
      [
        "todo",
        "todo-step",
        "meeting",
        "todo-message",
        "meeting-note",
        "employee-request",
      ].includes(it.kind)
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

// Event filter state and options (dropdown in the card header)
// default to empty (All) so all events are shown initially
const selectedEventFilter = ref<string | null>("");
const eventFilterOptions = [
  { title: "All", value: "" },
  { title: "Steps", value: "todo-step" },
  { title: "Meetings", value: "meeting" },
  { title: "Messages", value: "todo-message" },
  { title: "Requests", value: "employee-request" },
  { title: "Call", value: "Call" },
  { title: "Todo", value: "Todo" },
  { title: "Meeting", value: "Meeting" },
  { title: "Sentmail", value: "Sentmail" },
  { title: "Receipt", value: "Receipt" },
  { title: "Refund", value: "Refund" },
  { title: "Sales", value: "Sales" },
  { title: "Leadstatus", value: "Leadstatus" },
];

const filteredActivities = computed(() => {
  const list = activities.value || [];
  const sel = (selectedEventFilter.value || "").toString().trim();
  if (!sel) return list;

  const s = sel.toLowerCase();

  return list.filter((act: any) => {
    try {
      // direct kind match
      if (act.kind && act.kind.toString().toLowerCase() === s) return true;

      // map some common labels to kinds
      const kindMap: Record<string, string> = {
        todo: "todo",
        meeting: "meeting",
        comment: "todo-message",
        note: "meeting-note",
        step: "todo-step",
      };
      if (kindMap[s] && act.kind === kindMap[s]) return true;

      // fallback: match against title/body text
      const hay = ((act.title || "") + " " + (act.body || ""))
        .toString()
        .toLowerCase();
      if (hay.includes(s)) return true;

      return false;
    } catch {
      return false;
    }
  });
});

function labelColorName(kind: string) {
  return kind === "meeting" || kind === "meeting-note"
    ? "success"
    : kind === "todo"
    ? "warning"
    : kind === "todo-step"
    ? "secondary"
    : kind === "employee-request"
    ? "primary"
    : "info";
}

function labelTextForKind(kind: string) {
  if (kind === "todo") return "To-do";
  if (kind === "todo-step") return "Step";
  if (kind === "todo-message") return "Comment";
  if (kind === "meeting-note") return "Note";
  if (kind === "meeting") return "Meeting";
  if (kind === "employee-request") return "Request";
  return "";
}

function requestIcon(requestType: string) {
  switch (requestType) {
    case "Leave":
      return "tabler-beach";
    case "Addition":
      return "tabler-cash-plus";
    case "Deduction":
      return "tabler-cash-minus";
    case "Advance":
      return "tabler-credit-card";
    case "Time au Lieu":
      return "tabler-clock-hour-3";
    default:
      return "tabler-file-text";
  }
}

function requestStatusColor(status: string) {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "error";
    case "pending":
      return "warning";
    case "draft":
      return "secondary";
    default:
      return "info";
  }
}

function requestDetails(
  act: any
): Array<{ label: string; value: string; icon?: string }> {
  const details: Array<{ label: string; value: string; icon?: string }> = [];
  const req = act.meta?.request || {};

  if (act.requestType === "Leave") {
    if (req.startDate)
      details.push({
        label: "Start",
        value: formatSystemDate(req.startDate),
        icon: "tabler-calendar",
      });
    if (req.returnDate)
      details.push({
        label: "Return",
        value: formatSystemDate(req.returnDate),
        icon: "tabler-calendar-check",
      });
    if (req.requestedDays)
      details.push({
        label: "Days",
        value: String(req.requestedDays),
        icon: "tabler-calendar-time",
      });
  } else if (
    act.requestType === "Addition" ||
    act.requestType === "Deduction"
  ) {
    if (req.amount)
      details.push({
        label: "Amount",
        value: `$${req.amount}`,
        icon: "tabler-currency-dollar",
      });
    if (req.date)
      details.push({
        label: "Date",
        value: formatSystemDate(req.date),
        icon: "tabler-calendar",
      });
  } else if (act.requestType === "Advance") {
    if (req.amount)
      details.push({
        label: "Amount",
        value: `$${req.amount}`,
        icon: "tabler-currency-dollar",
      });
    if (req.payBackInMonths)
      details.push({
        label: "Payback",
        value: `${req.payBackInMonths} months`,
        icon: "tabler-calendar-month",
      });
  } else if (act.requestType === "Time au Lieu") {
    if (req.numberOfDays)
      details.push({
        label: "Days",
        value: String(req.numberOfDays),
        icon: "tabler-calendar-time",
      });
    if (req.date)
      details.push({
        label: "Date",
        value: formatSystemDate(req.date),
        icon: "tabler-calendar",
      });
  }

  return details;
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

// Summary metrics for the current contact
const contactId = computed(() => props.user?.id ?? null);

const contactTodos = computed(() => {
  const id = contactId.value;
  if (!id) return [] as any[];
  return (todosStore.items || []).filter((t: any) =>
    Array.isArray(t.collaborators)
      ? t.collaborators.some((c: any) => String(c?.id) === String(id))
      : false
  );
});

const totalTodos = computed(() => contactTodos.value.length);

// Scheduled todos: dueAt in the future
const scheduledTodos = computed(() => {
  const now = Date.now();
  return contactTodos.value.filter((t: any) => {
    try {
      const ts = t?.dueAt ? new Date(t.dueAt).getTime() : NaN;
      return !Number.isNaN(ts) && ts > now && t.status !== "completed";
    } catch {
      return false;
    }
  }).length;
});

const pendingTodos = computed(
  () => contactTodos.value.filter((t: any) => t.status === "pending").length
);

// Average time for todos — measured as average (updatedAt - createdAt) in minutes
const averageTodoTimeMinutes = computed(() => {
  const list = contactTodos.value.filter(
    (t: any) => t?.createdAt && t?.updatedAt && t.createdAt !== t.updatedAt
  );
  if (!list.length) return 0;
  let sum = 0;
  for (const t of list) {
    try {
      const c = new Date(t.createdAt).getTime();
      const u = new Date(t.updatedAt).getTime();
      if (!Number.isNaN(c) && !Number.isNaN(u) && u >= c) {
        sum += (u - c) / 60000; // minutes
      }
    } catch {
      /* ignore */
    }
  }
  return Math.round(sum / list.length);
});

// Meetings linked to this contact
const contactMeetings = computed(() => {
  const id = contactId.value;
  if (!id) return [] as any[];
  return (todosStore.meetings || []).filter((m: any) => {
    const linked = Array.isArray(m.linkedTo)
      ? m.linkedTo.some((l: any) => String(l?.id) === String(id))
      : false;
    const requested = m.requestedBy && String(m.requestedBy?.id) === String(id);
    return linked || requested;
  });
});

// helper: format minutes to human (e.g., "1h 30m")
function formatMinutesHuman(mins?: number) {
  if (mins == null || numsIsNaN(mins)) return "0m";
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}

function numsIsNaN(n: any) {
  return typeof n !== "number" || Number.isNaN(n);
}

// Todos breakdown
const completedTodos = computed(
  () => contactTodos.value.filter((t: any) => t.status === "completed").length
);

// Meetings metrics
const averageMeetingDurationMinutes = computed(() => {
  const list = contactMeetings.value || [];
  if (!list.length) return 0;
  const nums: number[] = list
    .map((m: any) => (typeof m.duration === "number" ? m.duration : 0))
    .filter((d) => !Number.isNaN(d) && d > 0);
  if (!nums.length) return 0;
  const sum = nums.reduce((s, v) => s + v, 0);
  return Math.round(sum / nums.length);
});

const scheduledMeetings = computed(() => {
  const now = Date.now();
  return (contactMeetings.value || []).filter((m: any) => {
    try {
      const ts = m?.startAt ? new Date(m.startAt).getTime() : NaN;
      return !Number.isNaN(ts) && ts > now;
    } catch {
      return false;
    }
  }).length;
});

// Calls average sentiment (derived from meeting.summary.sentiment when present)
const sentimentMap: Record<string, number> = {
  very_poor: 1,
  poor: 2,
  acceptable: 3,
  good: 4,
  very_good: 5,
};

const callsAverageSentimentValue = computed(() => {
  const list = (contactMeetings.value || [])
    .map((m: any) => m?.summary?.sentiment)
    .filter(Boolean);
  if (!list.length) return 0;
  const nums = list
    .map((s: any) => sentimentMap[s] || 0)
    .filter((n: number) => n > 0);
  if (!nums.length) return 0;
  const avg = nums.reduce((s: number, v: number) => s + v, 0) / nums.length;
  return Math.round(avg * 10) / 10; // one decimal
});

function sentimentLabelFromValue(v: number) {
  if (v <= 0) return "—";
  if (v <= 1.5) return "Very poor";
  if (v <= 2.5) return "Poor";
  if (v <= 3.5) return "Acceptable";
  if (v <= 4.5) return "Good";
  return "Very good";
}

const totalMeetings = computed(() => (contactMeetings.value || []).length);

// Total calls: heuristic - meetings whose subject includes 'call' or that have a summary.sentiment
const totalCalls = computed(() => {
  const list = contactMeetings.value || [];
  return list.filter((m: any) => {
    try {
      const subj = (m.subject || "").toString().toLowerCase();
      if (subj.includes("call")) return true;
      if (m?.summary && m.summary?.sentiment) return true;
      return false;
    } catch {
      return false;
    }
  }).length;
});

// whether there are any timeline activities for this user
const hasAnyActivities = computed(() => (activities.value || []).length > 0);

// current selected filter's display title (falls back to raw value or 'All')
const currentFilterLabel = computed(() => {
  const v = (selectedEventFilter.value || "").toString();
  const found = eventFilterOptions.find((o: any) => String(o.value) === v);
  if (found) return found.title;
  return v || "All";
});
</script>

<template>
  <VRow>
    <VCol cols="12">
      <!-- 👉 User Activity timeline -->
      <VCard
        title="Contact Activity Timeline"
        :class="hasAnyActivities ? 'activity-card' : ''"
      >
        <template #append>
          <div>
            <AppSelect
              v-model="selectedEventFilter"
              :items="eventFilterOptions"
              item-title="title"
              item-value="value"
              placeholder="Filter"
              clearable
              :disabled="!hasAnyActivities"
              style="min-inline-size: 10rem"
            />
          </div>
        </template>
        <VCardText :class="hasAnyActivities ? 'activity-card__body' : ''">
          <template v-if="!hasAnyActivities">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No recent activity</div>
            </div>
          </template>

          <template v-else-if="filteredActivities.length === 0">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">
                No recent activity
                <span class="text-sm text-medium-emphasis"
                  >— {{ currentFilterLabel }}</span
                >
              </div>
            </div>
          </template>

          <template v-else>
            <VTimeline
              side="end"
              align="start"
              line-inset="8"
              truncate-line="start"
              density="compact"
            >
              <VTimelineItem
                v-for="(act, idx) in filteredActivities"
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
                    : act.kind === 'employee-request'
                    ? 'primary'
                    : 'info'
                "
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <VIcon
                      v-if="act.kind === 'employee-request'"
                      :icon="requestIcon(act.requestType)"
                      size="20"
                      class="me-2"
                    />
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
                          'employee-request',
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
                    <VChip
                      v-if="act.kind === 'employee-request'"
                      size="small"
                      class="timeline-chip"
                      :color="requestStatusColor(act.requestStatus)"
                      :text-color="`on-${requestStatusColor(
                        act.requestStatus
                      )}`"
                      density="compact"
                    >
                      {{ act.requestStatus }}
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

                <div v-else-if="act.kind === 'employee-request'" class="mt-2">
                  <div
                    v-if="requestDetails(act).length > 0"
                    class="d-flex gap-3 align-center flex-wrap"
                  >
                    <div
                      v-for="(detail, idx) in requestDetails(act)"
                      :key="idx"
                      class="text-sm text-medium-emphasis d-flex align-center gap-1"
                    >
                      <VIcon v-if="detail.icon" :icon="detail.icon" size="16" />
                      <span>{{ detail.label }}: {{ detail.value }}</span>
                    </div>
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
            </VTimeline>
          </template>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <!-- Statistics-style Summary card (Calls / Meetings / To-Dos) -->
      <VCard title="Summary" class="summary-card">
        <VCardText>
          <VRow>
            <VCol cols="12" md="4">
              <div class="d-flex align-center gap-4 mt-md-4 mt-0">
                <VAvatar color="warning" variant="tonal" rounded size="40">
                  <VIcon icon="tabler-list-check" />
                </VAvatar>

                <div class="d-flex flex-column">
                  <div class="d-flex align-baseline gap-2">
                    <div class="text-h6">{{ totalTodos }}</div>
                    <div class="text-sm text-medium-emphasis">To-Dos</div>
                  </div>
                  <div class="text-sm mt-1">Pending: {{ pendingTodos }}</div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" md="4">
              <div class="d-flex align-center gap-4 mt-md-4 mt-0">
                <VAvatar color="success" variant="tonal" rounded size="40">
                  <VIcon icon="tabler-calendar" />
                </VAvatar>

                <div class="d-flex flex-column">
                  <div class="d-flex align-baseline gap-2">
                    <div class="text-h6">{{ totalMeetings }}</div>
                    <div class="text-sm text-medium-emphasis">Meetings</div>
                  </div>
                  <div class="text-sm mt-1">
                    Avg time:
                    {{ formatMinutesHuman(averageMeetingDurationMinutes) }}
                  </div>
                </div>
              </div>
            </VCol>

            <VCol cols="12" md="4">
              <div class="d-flex align-center gap-4 mt-md-4 mt-0">
                <VAvatar color="primary" variant="tonal" rounded size="40">
                  <VIcon icon="tabler-phone" />
                </VAvatar>

                <div class="d-flex flex-column">
                  <div class="d-flex align-baseline gap-2">
                    <div class="text-h6">{{ totalCalls }}</div>
                    <div class="text-sm text-medium-emphasis">Calls</div>
                  </div>
                  <div class="text-sm mt-1">
                    Avg sentiment: {{ callsAverageSentimentValue }} ({{
                      sentimentLabelFromValue(callsAverageSentimentValue)
                    }})
                  </div>
                </div>
              </div>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style scoped>
.activity-card {
  display: flex;
  flex-direction: column;

  /* fixed height while remaining responsive on small screens */
  block-size: 39rem;
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
