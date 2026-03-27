/* stylelint-disable @stylistic/declaration-block-trailing-semicolon */
<!-- src/pages/apps/calendar.vue -->
<script setup lang="ts">
import type { EventApi } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/vue3";
import { formatSystemDate, formatSystemDateTime } from "@core/utils/formatters";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useDisplay } from "vuetify";

import type { ToDo } from "@/data/schema";
import { useContactsStore } from "@/stores/contacts";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { useCalendarOptions } from "@/views/apps/calendar/useCalendar";
import { useCalendarStore } from "@/views/apps/calendar/useCalendarStore";
import AddMeetingDrawer, {
  type NewMeetingPayload,
} from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";

function fmtMinutes(total?: number) {
  if (!total || total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function meetingDurationFromEvent(e: any) {
  const dur = Number(e?.extendedProps?.duration);
  if (dur > 0) return fmtMinutes(dur);
  const start: Date | undefined = e?.start;
  const end: Date | undefined = e?.end;
  if (start && end) {
    const mins = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000)
    );
    return fmtMinutes(mins);
  }
  return "—";
}

const meetingEventKey = (e: any) => {
  if (!e?.title || !e?.start) return "";
  const iso = e.start?.toISOString?.() ?? new Date(e.start).toISOString();
  return `${e.title}__${iso}`;
};

const statusColor = (status?: string) => {
  const map = {
    pending: "grey",
    in_progress: "primary",
    for_review: "warning",
    completed: "success",
  } as const;
  const key = (status ?? "pending") as keyof typeof map;
  return map[key] ?? map.pending;
};

const priorityColor = (priority?: string) => {
  const map = {
    low: "secondary",
    normal: "primary",
    high: "error",
  } as const;
  const key = (priority ?? "normal") as keyof typeof map;
  return map[key] ?? map.normal;
};

/* ========================= IDs / Sources ========================= */
const MEETING_SOURCE_ID = "meetings-source";
let meetingSourceAdded = false;

/* ========================= Stores & Options ====================== */
const { calendarOptions } = useCalendarOptions();
const store = useCalendarStore();
const todos = useTodos();
const display = useDisplay();
todos.init();

// contacts for dropdowns
const contactsStore = useContactsStore();
contactsStore.init();
const contactsOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  }))
);

// legacy alias used in the template/components
const collaboratorsOptions = contactsOptions;

/* ========================= UI State ============================== */
const refCalendar = ref<any>(null);
const isLeftSidebarOpen = ref(true);

if (typeof window !== "undefined") {
  const sidebarMatchMedia = window.matchMedia("(max-width: 1279px)");
  if (sidebarMatchMedia.matches) isLeftSidebarOpen.value = false;
}
const isAddOpen = ref(false);
// 👉 New state for AddMeetingDrawer
const isAddMeetingOpen = ref(false);
const drawerInitialStart = ref<Date | string | undefined>(undefined);

const handleSidebarOpenRequest = () => {
  isLeftSidebarOpen.value = true;
};

let sidebarMediaQuery: MediaQueryList | undefined;
let sidebarMediaQueryListener:
  | ((event: MediaQueryListEvent) => void)
  | undefined;

/* ========================= Filters =============================== */
const checkAll = computed({
  get: () => store.selectedCalendars.length === store.availableCalendars.length,
  set: (val: boolean) => {
    store.selectedCalendars = val
      ? store.availableCalendars.map((c) => c.label)
      : [];
  },
});

/* ========================= API Helpers =========================== */
async function createTodoOnServer(todo: any) {
  const res = await fetch("/api/apps/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json();
}

/* ========================= Create To-Do =========================== */
type NewTodoPayload = Partial<{
  title: string;
  collaborators: any[];
  dueAt: string;
  priority: "low" | "normal" | "high";
  status: "pending" | "in_progress" | "for_review" | "completed";
  notes: string;
  important: boolean;
}>;

async function handleCreate(payload: NewTodoPayload) {
  const created = todos.addTodo({
    ...payload,
    status: (payload.status ?? "pending") as ToDo["status"],
  } as Partial<ToDo>);

  try {
    const saved = await createTodoOnServer({ ...created });
    if (saved?.id != null && saved.id !== created?.id) {
      todos.updateTodo(created!.id, { id: saved.id });
    }
  } catch (e) {
    console.error("POST /api/apps/todos failed:", e);
  }

  isAddOpen.value = false;

  if (!store.selectedCalendars.includes("To-Dos")) {
    store.selectedCalendars = [
      ...new Set([...store.selectedCalendars, "To-Dos"]),
    ];
  }

  const api = refCalendar.value?.getApi?.();
  api?.refetchEvents();

  if (payload.dueAt) {
    const d = new Date(payload.dueAt);
    if (!isNaN(d.getTime())) api?.gotoDate(d);
  }
  // show notification (snackbar) when a To-do is created from the calendar
  useNotificationsStore().push("To-do created", "success", 3000);
}

// Open drawer explicitly (e.g., "+ New Meeting" button)
const openAddMeeting = (when?: Date | string) => {
  drawerInitialStart.value = when ?? new Date();
  isAddMeetingOpen.value = true;
};

// Optional: open when clicking a day slot
const onDateClick = (arg: { date: Date }) => {
  openAddMeeting(arg.date);
};

// Handler called by AddMeetingDrawer on save
// Handler called by AddMeetingDrawer on save — persist to useTodos().meetings
// Handler called by AddMeetingDrawer on save — persist to useTodos().meetings
const onCreateMeeting = async (m: NewMeetingPayload) => {
  // start & end (end comes from start + durationMins)
  const startMs = new Date(m.start).getTime();
  const endMs =
    startMs + (Number(m.durationMins) || DEFAULT_MEETING_MINUTES) * 60000;
  const endISO = new Date(endMs).toISOString();

  // Map to your meeting shape used by `meetingEvents`
  const meeting = {
    id: m.id,
    subject: m.title?.trim() || "Untitled",
    startAt: m.start, // ISO
    endAt: endISO, // ISO (spans days if duration > 24h)
    duration: Number(m.durationMins) || DEFAULT_MEETING_MINUTES, // mins
    type: m.meetingType || "meeting",
    location: m.location || "",
    linkedTo: m.linkedTo || null, // ContactRef from your Linked to field
    requestedBy: undefined,
    note: m.notes || "",
  };

  // Save into To-Dos store (replace array to keep Pinia reactivity solid)
  const list = Array.isArray((todos as any).meetings)
    ? (todos as any).meetings
    : [];
  (todos as any).meetings = [...list, meeting];

  // Refresh calendar
  const api = refCalendar.value?.getApi?.();
  api?.refetchEvents?.();

  // show notification
  useNotificationsStore().push("Meeting created", "success", 3000);
};

/* ========================= Date Jump ============================= */
function jumpToDateFn(val: string) {
  const api = refCalendar.value?.getApi?.();
  if (api) api.gotoDate(val);
}

/* ========================= Drawers =============================== */
const isEditOpen = ref(false);
const selectedId = ref<number | string | null>(null);
const selectedTodo = computed(() =>
  selectedId.value != null ? todos.byId(selectedId.value) ?? null : null
);

/* ========================= Meetings function source ============== */
const meetingsVisible = computed(() => {
  const hasCalendars =
    Array.isArray(store.availableCalendars) &&
    store.availableCalendars.length > 0;
  const selected = Array.isArray(store.selectedCalendars)
    ? store.selectedCalendars
    : [];
  return !hasCalendars || selected.includes("Meetings");
});

const DEFAULT_MEETING_MINUTES = 60;

const meetingEvents = computed(() => {
  if (!meetingsVisible.value) return [];
  return (todos.meetings || []).map((m: any) => {
    const start = m.startAt;
    // prefer explicit endAt, else compute from duration (fallback 60 min)
    const end =
      (m as any).endAt ||
      new Date(
        new Date(m.startAt).getTime() +
          Number(m.duration || DEFAULT_MEETING_MINUTES) * 60000
      ).toISOString();

    return {
      id: `meeting-${m.id}`,
      title: m.subject,
      start,
      end,
      allDay: false,
      classNames: ["calendar-meeting"],
      editable: true, // draggable
      durationEditable: true, // resizable ✅ meetings only
      extendedProps: {
        type: "meeting",
        meetingId: m.id,
        meetingType: m.type,
        location: m.location,
        requestedBy: m.requestedBy,
        linkedTo: m.linkedTo,
        note: m.note,
        duration: m.duration,
        calendar: "Meetings",
      },
    };
  });
});

/* ========================= Click behavior ======================== */
// Meetings must NOT open EditToDoDrawer; To-Dos keep default behavior
const baseEventClick = calendarOptions.eventClick;
calendarOptions.eventClick = (arg: any) => {
  const isMeeting = arg?.event?.extendedProps?.type === "meeting";

  if (isMeeting) {
    arg?.jsEvent?.preventDefault?.();
    arg?.jsEvent?.stopPropagation?.();
    window.dispatchEvent(
      new CustomEvent("meeting:open", {
        detail: {
          id:
            arg.event.extendedProps?.meetingId ??
            arg.event.id?.toString()?.replace(/^meeting-/, ""),
        },
      })
    );
    return;
  }
  if (typeof baseEventClick === "function") baseEventClick(arg);
};

/* ========================= ClassNames (style meetings) =========== */
const baseEventClassNames = calendarOptions.eventClassNames;
calendarOptions.eventClassNames = (arg: any) => {
  const out: any[] = [];
  if (typeof baseEventClassNames === "function") {
    const b = baseEventClassNames(arg);
    if (Array.isArray(b)) out.push(...b);
    else if (b) out.push(b);
  }
  if (arg?.event?.extendedProps?.type === "meeting")
    out.push("calendar-meeting");
  return out;
};

/* ========================= Dedupe meetings ======================= */
/* If any meeting appears from a non-meeting source, drop it.
   NOTE: guard against transient states during drag (source may be null). */
// Dedupe at render time: drop any meeting not from our function source
const baseEventDidMount = calendarOptions.eventDidMount;
calendarOptions.eventDidMount = (info: any) => {
  if (typeof baseEventDidMount === "function") baseEventDidMount(info);
  // If it’s a meeting from any non-meeting source, drop it immediately
  if (
    info?.event?.extendedProps?.type === "meeting" &&
    info?.event?.source?.id !== MEETING_SOURCE_ID
  ) {
    info.event.remove();
  }
};

// After FullCalendar sets all events, strip duplicate meetings from other sources
const baseEventsSet = calendarOptions.eventsSet;
calendarOptions.eventsSet = (events: any[]) => {
  // keys of meetings coming from our function source
  const ours = new Set(
    events
      .filter(
        (e) =>
          e?.extendedProps?.type === "meeting" &&
          e?.source?.id === MEETING_SOURCE_ID
      )
      .map(meetingEventKey)
  );

  // remove any meeting with same key coming from other sources
  for (const e of events) {
    if (
      e?.extendedProps?.type === "meeting" &&
      e?.source?.id !== MEETING_SOURCE_ID &&
      ours.has(meetingEventKey(e))
    ) {
      e.remove();
    }
  }

  if (typeof baseEventsSet === "function") baseEventsSet(events);
};

const baseEventAdd = calendarOptions.eventAdd;
calendarOptions.eventAdd = (addInfo: any) => {
  const e = addInfo?.event;
  if (
    e?.extendedProps?.type === "meeting" &&
    e?.source?.id !== MEETING_SOURCE_ID
  ) {
    // if our source already has the same meeting key, remove this duplicate
    const api = refCalendar.value?.getApi?.();
    const all = api?.getEvents?.() ?? [];
    const hasOurs = all.some(
      (x: EventApi) =>
        x?.extendedProps?.type === "meeting" &&
        x?.source?.id === MEETING_SOURCE_ID &&
        meetingEventKey(x) === meetingEventKey(e)
    );
    if (hasOurs) e.remove();
  }

  if (typeof baseEventAdd === "function") baseEventAdd(addInfo);
};
/* ========================= Drag/Resize rules ===================== */
// Global defaults (we'll override per-event with eventDataTransform)
calendarOptions.editable = true;
calendarOptions.eventDurationEditable = true;

// Force per-event capabilities:
// - Meetings: draggable + resizable
// - To-Dos: draggable + NOT resizable
const baseEventDataTransform = calendarOptions.eventDataTransform;
calendarOptions.eventDataTransform = (raw: any) => {
  const e = baseEventDataTransform ? baseEventDataTransform(raw) : raw;

  // ensure object copy
  const out = { ...e };

  if (out.extendedProps?.type === "meeting") {
    out.editable = true;
    out.durationEditable = true;
  } else if (out.extendedProps?.type === "todo") {
    out.editable = true;
    out.durationEditable = false;
  }
  return out;
};

/* ========================= Persist moves/resizes ================= */
function patchMeeting(meetingId: string | number, patch: Record<string, any>) {
  const list = Array.isArray(todos.meetings) ? todos.meetings : [];
  const next = list.map((m) => (m.id === meetingId ? { ...m, ...patch } : m));
  (todos as any).meetings = next; // replace for Pinia reactivity
}

function patchTodo(todoId: string | number, patch: Record<string, any>) {
  todos.updateTodo(todoId as any, patch);
}

function persistEventChange(e: any) {
  if (!e) return;

  const startIso = e.start ? e.start.toISOString() : undefined;
  const endIso = e.end ? e.end.toISOString() : undefined;

  if (e.extendedProps?.type === "meeting") {
    const id =
      e.extendedProps.meetingId ?? e.id?.toString()?.replace(/^meeting-/, "");

    // If endIso is missing (dragged but not resized), keep duration (fallback to default)
    let nextEndIso = endIso;
    let nextDuration = e.extendedProps?.duration;

    if (!nextEndIso) {
      const minutes = Number(nextDuration || DEFAULT_MEETING_MINUTES);
      nextEndIso = startIso
        ? new Date(new Date(startIso).getTime() + minutes * 60000).toISOString()
        : undefined;
    } else {
      // If we have both start & end, recompute duration to stay coherent
      if (e.start && e.end) {
        nextDuration = Math.max(
          1,
          Math.round((e.end.getTime() - e.start.getTime()) / 60000)
        );
      }
    }

    patchMeeting(id, {
      startAt: startIso,
      endAt: nextEndIso,
      duration: nextDuration,
    });

    // Refetch only the meetings source
    const api = refCalendar.value?.getApi?.();
    const src = api?.getEventSourceById?.(MEETING_SOURCE_ID);
    if (src && typeof src.refetch === "function") src.refetch();
    else api?.refetchEvents?.();
  } else {
    // treat as To-Do (move only)
    const id =
      e.extendedProps?.todoId ?? e.id?.toString()?.replace(/^todo-/, "");

    if (id != null && startIso) {
      patchTodo(id, { dueAt: startIso });
      refCalendar.value?.getApi?.()?.refetchEvents?.();
    }
  }
}

// Handle all paths that can change timing
const baseEventChange = calendarOptions.eventChange;
calendarOptions.eventChange = (info: any) => {
  persistEventChange(info?.event);
  if (typeof baseEventChange === "function") baseEventChange(info);
};
const baseEventDrop = calendarOptions.eventDrop;
calendarOptions.eventDrop = (info: any) => {
  persistEventChange(info?.event);
  if (typeof baseEventDrop === "function") baseEventDrop(info);
};
const baseEventResize = calendarOptions.eventResize;
calendarOptions.eventResize = (info: any) => {
  persistEventChange(info?.event);
  if (typeof baseEventResize === "function") baseEventResize(info);
};

/* ========================= Mounted: add meeting source =========== */
onMounted(() => {
  // ensure "Meetings" exists in filters
  try {
    if (!store.availableCalendars?.some((c: any) => c.label === "Meetings")) {
      store.availableCalendars.push({
        label: "Meetings",
        color: "info",
      } as any);
    }
    if (!store.selectedCalendars?.includes("Meetings")) {
      store.selectedCalendars.push("Meetings");
    }
  } catch {
    /* ignore */
  }

  const api = refCalendar.value?.getApi?.();
  if (api) {
    // remove any stale instance of the source (prevents duplicates)
    const stale = api.getEventSourceById?.(MEETING_SOURCE_ID);
    if (stale) stale.remove();

    api.addEventSource({
      id: MEETING_SOURCE_ID,
      events: (_info: any, success: (evts: any[]) => void) => {
        success(meetingEvents.value);
      },
    });
    meetingSourceAdded = true;

    api.refetchEvents();

    // hand API to any consumers
    window.dispatchEvent(
      new CustomEvent("calendar:provide-api", { detail: api })
    );
  }
});

/* ========================= Watches =============================== */
watch(
  () => store.selectedCalendars.slice(),
  () => refCalendar.value?.getApi?.()?.refetchEvents(),
  { deep: true }
);

watch(
  () =>
    (todos.meetings || [])
      .map((m) => `${m.id}-${m.startAt}-${m.endAt}-${m.duration}`)
      .join("|"),
  () => refCalendar.value?.getApi?.()?.refetchEvents()
);

// guard: if HMR loses the source, re-add it
watch(
  () => refCalendar.value,
  () => {
    const api = refCalendar.value?.getApi?.();
    if (!api) return;
    const src = api.getEventSourceById?.(MEETING_SOURCE_ID);
    if (!src && !meetingSourceAdded) {
      api.addEventSource({
        id: MEETING_SOURCE_ID,
        events: (_: any, ok: (e: any[]) => void) => ok(meetingEvents.value),
      });
      meetingSourceAdded = true;
      api.refetchEvents();
    }
  }
);

// keep calendar in sync when filters or meetings change
watch(
  [() => store.selectedCalendars, () => todos.meetings],
  () => {
    const api = refCalendar.value?.getApi?.();
    api?.refetchEvents();
  },
  { deep: true }
);

/* ========================= Open To-Do edit drawer ================ */
function onOpenEdit(e: CustomEvent<{ id: number | string }>) {
  selectedId.value = e.detail.id;
  isEditOpen.value = true;
}
onMounted(() => {
  if (typeof window !== "undefined") {
    sidebarMediaQuery = window.matchMedia("(max-width: 1279px)");
    const applySidebarState = (matches: boolean) => {
      isLeftSidebarOpen.value = matches ? false : true;
    };
    applySidebarState(sidebarMediaQuery.matches);
    sidebarMediaQueryListener = (event: MediaQueryListEvent) =>
      applySidebarState(event.matches);
    sidebarMediaQuery.addEventListener("change", sidebarMediaQueryListener);
    window.addEventListener(
      "calendar:open-left-sidebar",
      handleSidebarOpenRequest as EventListener
    );
    window.addEventListener("todo:open-edit", onOpenEdit as EventListener);
  }
});
onUnmounted(() => {
  if (sidebarMediaQuery && sidebarMediaQueryListener) {
    sidebarMediaQuery.removeEventListener("change", sidebarMediaQueryListener);
  }
  if (typeof window !== "undefined") {
    window.removeEventListener(
      "calendar:open-left-sidebar",
      handleSidebarOpenRequest as EventListener
    );
    window.removeEventListener("todo:open-edit", onOpenEdit as EventListener);
  }
});

/* ========================= Drawer save handlers ================== */
function handleSave(payload: {
  id: number | string;
  title: string;
  collaborators: any[];
  dueAt: string;
  priority: "low" | "normal" | "high";
  status: "pending" | "in_progress" | "for_review";
  notes: string;
  important: boolean;
}) {
  todos.updateTodo(payload.id, { ...payload });
}
function handleSaveSteps(v: { id: number | string; steps: any[] }) {
  todos.updateTodo(v.id, { steps: v.steps });
}
function handleAddActivity(v: { id: number | string; body: string }) {
  const t = todos.byId(v.id);
  if (!t) return;
  const activities = [
    ...(t.activities || []),
    {
      id: Date.now(),
      author: t.collaborators?.[0],
      body: v.body,
      createdAt: new Date().toISOString(),
    },
  ];
  todos.updateTodo(v.id, { activities });
}
</script>

<template>
  <div>
    <VCard>
      <VLayout style="z-index: 0">
        <!-- 👉 Left: filters / date picker -->
        <VNavigationDrawer
          v-model="isLeftSidebarOpen"
          data-allow-mismatch
          width="292"
          absolute
          touchless
          location="start"
          class="calendar-add-event-drawer"
        >
          <div class="pa-5 pb-7">
            <div class="d-flex gap-1">
              <VBtn
                class="w-50"
                prepend-icon="tabler-plus"
                @click="isAddOpen = true"
              >
                To-Do
              </VBtn>
              <VBtn
                class="w-50"
                color="success"
                prepend-icon="tabler-plus"
                @click="openAddMeeting()"
              >
                Meeting
              </VBtn>
            </div>
          </div>

          <VDivider />

          <div class="d-flex align-center justify-center pa-2">
            <AppDateTimePicker
              id="calendar-date-picker"
              :model-value="new Date().toJSON().slice(0, 10)"
              :config="{ inline: true }"
              class="calendar-date-picker"
              @update:model-value="jumpToDateFn"
            />
          </div>

          <VDivider />

          <div class="pa-6">
            <h6 class="text-lg font-weight-medium mb-4">Event Filters</h6>

            <div class="d-flex flex-column calendars-checkbox">
              <VCheckbox
                id="check-all-events"
                v-model="checkAll"
                label="View all"
              />
              <template
                v-for="(calendar, index) in store.availableCalendars"
                :key="calendar.label"
              >
                <VCheckbox
                  :id="`${index}`"
                  v-model="store.selectedCalendars"
                  :value="calendar.label"
                  :color="calendar.color"
                  :label="calendar.label"
                />

                <!-- Subfilter only for To-Dos and only when To-Dos is selected -->
                <VSwitch
                  v-if="
                    calendar.label === 'To-Dos' &&
                    store.selectedCalendars?.includes('To-Dos')
                  "
                  v-model="store.todoImportantOnly"
                  density="compact"
                  inset
                  color="warning"
                  class="ms-8 mt-n2"
                  label="Only important"
                />
              </template>
            </div>
          </div>
        </VNavigationDrawer>

        <VMain>
          <VCard flat>
            <FullCalendar ref="refCalendar" :options="calendarOptions">
              <template #eventContent="{ event, timeText }">
                <VMenu
                  open-on-hover
                  location="top"
                  offset="8"
                  :close-on-content-click="false"
                >
                  <template #activator="{ props }">
                    <span
                      class="calendar-event-activator fc-event-title fc-styled"
                      v-bind="props"
                    >
                      <span
                        v-if="timeText"
                        class="calendar-event-time text-caption font-weight-medium"
                      >
                        {{ timeText }}
                      </span>
                      <span class="calendar-event-title">{{
                        event.title
                      }}</span>
                    </span>
                  </template>

                  <!-- MEETING POPOVER (title • note • duration with clock) -->
                  <VCard
                    v-if="event.extendedProps?.type === 'meeting'"
                    max-width="320"
                  >
                    <VList>
                      <VListItem class="mx-0">
                        <VListItemTitle
                          >{{ event.title || "Untitled" }}
                        </VListItemTitle>
                        <VListItemSubtitle>
                          <span class="text-xs" v-if="event.start">
                            •
                            {{
                              event.allDay
                                ? formatSystemDate(event.start)
                                : formatSystemDateTime(event.start)
                            }}
                          </span></VListItemSubtitle
                        >
                      </VListItem>
                    </VList>

                    <VCardText class="pt-0">
                      <div class="d-flex align-center mb-2">
                        <VIcon size="18" icon="tabler-clock" class="me-2" />
                        <span class="text-body-2">{{
                          meetingDurationFromEvent(event)
                        }}</span>
                      </div>

                      <div class="text-body-2">
                        {{
                          event.extendedProps?.note
                            ? event.extendedProps.note.length > 200
                              ? event.extendedProps.note.slice(0, 200) + "…"
                              : event.extendedProps.note
                            : "No notes."
                        }}
                      </div>

                      <!-- Linked-to / contacts (match To-Do popover avatar style) -->

                      <div
                        v-if="event.extendedProps?.collaborators?.length"
                        class="d-flex align-center gap-2 mt-3"
                      >
                        <div class="v-avatar-group">
                          <VAvatar
                            v-for="c in event.extendedProps.collaborators.slice(
                              0,
                              3
                            )"
                            :key="c.id"
                            :size="28"
                            color="primary"
                          >
                            <template v-if="c.avatarUrl">
                              <VImg :src="c.avatarUrl" />
                            </template>
                            <template v-else>
                              <span class="text-xxs font-weight-bold">
                                {{
                                  String(c.name || "?")
                                    .trim()
                                    .slice(0, 2)
                                    .toUpperCase()
                                }}
                              </span>
                            </template>
                            <VTooltip activator="parent" location="top">{{
                              c.name
                            }}</VTooltip>
                          </VAvatar>

                          <VAvatar
                            v-if="event.extendedProps.collaborators.length > 3"
                            :size="28"
                            color="secondary"
                          >
                            +{{ event.extendedProps.collaborators.length - 3 }}
                          </VAvatar>
                        </div>
                      </div>
                      <div
                        v-if="event.extendedProps?.linkedTo?.length"
                        class="d-flex align-center gap-2 mt-3"
                      >
                        <div class="v-avatar-group">
                          <VAvatar
                            v-for="c in event.extendedProps.linkedTo.slice(
                              0,
                              3
                            )"
                            :key="c.id"
                            :size="28"
                            color="primary"
                          >
                            <template v-if="c.avatarUrl">
                              <VImg :src="c.avatarUrl" />
                            </template>
                            <template v-else>
                              <span class="text-xxs font-weight-bold">{{
                                String(c.name || "?")
                                  .trim()
                                  .slice(0, 2)
                                  .toUpperCase()
                              }}</span>
                            </template>
                            <VTooltip activator="parent" location="top">{{
                              c.name
                            }}</VTooltip>
                          </VAvatar>

                          <VAvatar
                            v-if="event.extendedProps.linkedTo.length > 3"
                            :size="28"
                            color="secondary"
                          >
                            +{{ event.extendedProps.linkedTo.length - 3 }}
                          </VAvatar>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>

                  <!-- TO-DO POPOVER (unchanged from your working baseline) -->
                  <VCard v-else max-width="320">
                    <VList>
                      <VListItem class="mx-0">
                        <VListItemTitle>{{
                          event.title || "Untitled"
                        }}</VListItemTitle>

                        <VListItemSubtitle
                          class="d-flex flex-wrap align-center gap-2"
                        >
                          <!-- Status chip -->
                          <VChip
                            size="x-small"
                            label
                            class="text-capitalize"
                            :color="statusColor(event.extendedProps?.status)"
                          >
                            {{
                              String(
                                event.extendedProps?.status || "pending"
                              ).replace("_", " ")
                            }}
                          </VChip>

                          <!-- Priority chip -->
                          <VChip
                            size="x-small"
                            label
                            class="text-capitalize"
                            :color="
                              priorityColor(event.extendedProps?.priority)
                            "
                          >
                            {{ event.extendedProps?.priority || "normal" }}
                          </VChip>
                        </VListItemSubtitle>

                        <span class="text-xs" v-if="event.start">
                          •
                          {{
                            event.allDay
                              ? formatSystemDate(event.start)
                              : formatSystemDateTime(event.start)
                          }}
                        </span>
                      </VListItem>
                    </VList>

                    <VCardText class="pt-0">
                      <!-- Notes preview -->
                      <div>
                        {{
                          event.extendedProps?.notes
                            ? event.extendedProps.notes.length > 160
                              ? event.extendedProps.notes.slice(0, 160) + "…"
                              : event.extendedProps.notes
                            : "No notes."
                        }}
                      </div>

                      <!-- Assignees -->
                      <div
                        v-if="event.extendedProps?.collaborators?.length"
                        class="d-flex align-center gap-2 mt-3"
                      >
                        <div class="v-avatar-group">
                          <VAvatar
                            v-for="c in event.extendedProps.collaborators.slice(
                              0,
                              3
                            )"
                            :key="c.id"
                            :size="28"
                            color="primary"
                          >
                            <template v-if="c.avatarUrl">
                              <VImg :src="c.avatarUrl" />
                            </template>
                            <template v-else>
                              <span class="text-xxs font-weight-bold">
                                {{
                                  String(c.name || "?")
                                    .trim()
                                    .slice(0, 2)
                                    .toUpperCase()
                                }}
                              </span>
                            </template>
                            <VTooltip activator="parent" location="top">{{
                              c.name
                            }}</VTooltip>
                          </VAvatar>

                          <VAvatar
                            v-if="event.extendedProps.collaborators.length > 3"
                            :size="28"
                            color="secondary"
                          >
                            +{{ event.extendedProps.collaborators.length - 3 }}
                          </VAvatar>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VMenu>
              </template>
            </FullCalendar>
          </VCard>
        </VMain>
      </VLayout>
    </VCard>

    <!-- 👉 Edit To-Do Drawer -->
    <EditToDoDrawer
      :is-drawer-open="isEditOpen"
      :todo="selectedTodo || undefined"
      :collaborators-options="collaboratorsOptions"
      @update:isDrawerOpen="isEditOpen = $event"
      @save="handleSave"
      @saveSteps="handleSaveSteps"
      @addActivity="handleAddActivity"
    />

    <!-- 👉 Add To-Do Drawer -->
    <AddNewToDoDrawer
      :is-drawer-open="isAddOpen"
      :collaborators-options="collaboratorsOptions"
      @update:isDrawerOpen="isAddOpen = $event"
      @user-data="handleCreate"
    />

    <AddMeetingDrawer
      v-model="isAddMeetingOpen"
      :initial-start="drawerInitialStart"
      :contacts="collaboratorsOptions"
      @save="onCreateMeeting"
    />
  </div>
</template>

<style lang="scss">
/* stylelint-disable selector-pseudo-class-no-unknown */

@use "@core/scss/template/libs/full-calendar";

:deep(.fc .fc-timegrid-slots) {
  --fc-timegrid-slot-min-height: 12px !important; /* try 14–22px */
}

.calendar-event-activator {
  display: block;
  cursor: pointer;
}

.calendar-event-time {
  display: none;
  font-weight: 600;
}

.calendar-event-title {
  display: block;
  overflow: hidden;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fc-event-mirror .calendar-event-activator,
.fc-event-resizing .calendar-event-activator {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.fc-event-mirror .calendar-event-title,
.fc-event-resizing .calendar-event-title {
  display: block;
}

.fc-timegrid-event .calendar-event-activator {
  display: block;
  inline-size: 100%;
}

.fc-event-mirror .calendar-event-time,
.fc-event-resizing .calendar-event-time {
  display: block;
}

:deep(.fc-timegrid) {
  --fc-slot-min-height: 12px;
}

:deep(.fc-timeGridWeek-view .fc-timegrid-axis-cushion),
:deep(.fc-timeGridDay-view .fc-timegrid-axis-cushion) {
  font-size: 0.65rem;
  padding-block: 0.04rem;
  text-transform: lowercase;
}

:deep(.fc-timeGridWeek-view .fc-timegrid-axis),
:deep(.fc-timeGridDay-view .fc-timegrid-axis) {
  inline-size: 42px;
  min-inline-size: 42px;
}

:deep(.fc-timeGridWeek-view .fc-timegrid-all-day .fc-timegrid-slot),
:deep(.fc-timeGridDay-view .fc-timegrid-all-day .fc-timegrid-slot) {
  block-size: 14px !important;
  min-block-size: 14px !important;
}

:deep(.fc-timeGridWeek-view .fc-timegrid-slot-label),
:deep(.fc-timeGridDay-view .fc-timegrid-slot-label) {
  letter-spacing: 0.01em;
  line-height: 1;
}

.calendar-add-event-drawer {
  &.v-navigation-drawer:not(.v-navigation-drawer--temporary) {
    border-end-start-radius: 0.375rem;
    border-start-start-radius: 0.375rem;
  }

  &.v-navigation-drawer--temporary:not(.v-navigation-drawer--active) {
    transform: translateX(-110%) !important;
  }
}

.calendar-date-picker {
  display: none;

  + .flatpickr-input {
    + .flatpickr-calendar.inline {
      border: none;
      box-shadow: none;

      .flatpickr-months {
        border-block-end: none;
      }
    }
  }

  & ~ .flatpickr-calendar .flatpickr-weekdays {
    margin-block: 0 4px;
  }
}

@media screen and (max-width: 1279px) {
  .calendar-add-event-drawer {
    border-width: 0;
  }
}

/* shrink timeGrid (week/day) rows */
/* stylelint-enable selector-pseudo-class-no-unknown */
</style>

<style lang="scss" scoped>
.v-layout {
  overflow: visible !important;

  .v-card {
    overflow: visible;
  }
}
</style>
