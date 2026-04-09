// src/views/apps/calendar/useCalendar.ts
import { useTodos } from "@/stores/todos";
import { useCalendarStore } from "@/views/apps/calendar/useCalendarStore";
import { useConfigStore } from "@core/stores/config";
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  Ref,
  ref,
  watch,
} from "vue";

import type {
  CalendarApi,
  CalendarOptions,
  EventSourceFunc,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";

// -----------------------------------------------------------------------------
// Legacy compatibility export: some pages still import this
// -----------------------------------------------------------------------------
export const blankEvent = {
  title: "",
  start: "",
  end: "",
  allDay: true,
  url: "",
  extendedProps: {
    calendar: "Task",
    guests: [] as any[],
    location: "",
    description: "",
  },
};

const TODO_CALENDAR_LABEL = "Task";

// Local date string (YYYY-MM-DD)
function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  return `${y}-${pad(m)}-${pad(day)}`;
}

// Local datetime string (YYYY-MM-DDTHH:mm)
function toLocalISO(d: Date) {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toDateFromEventStart(start: string | Date) {
  if (start instanceof Date) return start;
  return new Date(start);
}

function computeEndAt(startAt: string | Date, durationMin: number) {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() + Number(durationMin || 0));
  return d.toISOString();
}

async function patchDueAtOnServer(todoId: string | number, dueAt: string) {
  const res = await fetch(`/api/apps/todos/${todoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dueAt }),
  });
  if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  return res.json();
}

async function fetchOneTodoFromServer(todoId: string | number) {
  const res = await fetch(`/api/apps/todos/${todoId}`);
  if (!res.ok) throw new Error(`GET one failed: ${res.status}`);
  return res.json();
}

// -----------------------------------------------------------------------------
// Composable
// -----------------------------------------------------------------------------
export const useCalendar = (
  _event: Ref<any>,
  _isEventHandlerSidebarActive: Ref<boolean>,
  _isLeftSidebarOpen: Ref<boolean>
) => {
  const configStore = useConfigStore();
  const todos = useTodos();
  const calStore = useCalendarStore();

  const refCalendar = ref<any>(null);
  const calendarApi = ref<CalendarApi | null>(null);

  // Ensure our todos store is loaded
  onMounted(() => {
    try {
      todos.init();
    } catch {}
  });

  // Build color map from availableCalendars; ensure To-Dos exists
  const calendarsColor = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const list = Array.isArray(calStore.availableCalendars)
      ? calStore.availableCalendars
      : [];
    for (const c of list) {
      if (c && typeof c.label === "string")
        map[c.label] = (c as any).color || "primary";
    }
    if (!map[TODO_CALENDAR_LABEL]) map[TODO_CALENDAR_LABEL] = "primary";
    return map;
  });

  // Source of truth = Pinia store
  const rawTodos = computed(() => todos.items);

  // ===================== To-Dos → FullCalendar events =====================
  // Exclude completed. Create timed events if dueAt has time, otherwise all-day.
  const todoEvents = computed<any[]>(
    () =>
      rawTodos.value
        .filter((t) => {
          if (!t || t.dueAt == null) return false;
          const isDone =
            (t as any).completed === true ||
            (t as any).isCompleted === true ||
            String(t.status || "").toLowerCase() === "completed";
          return !isDone;
        })
        .map((t) => {
          const title = (t.title ?? "Untitled Task").toString();

          // Parse dueAt
          const raw = String(t.dueAt ?? "");
          const d = t.dueAt instanceof Date ? t.dueAt : new Date(raw);
          if (Number.isNaN(d.getTime())) return null;

          // Heuristic: treat as timed if string contains time or Date has a time component
          const hasTime =
            /T|\d{1,2}:\d{2}/.test(raw) ||
            d.getHours() + d.getMinutes() + d.getSeconds() !== 0;

          // Default duration for timed to-dos (1 hour) if no explicit end is stored
          const DEFAULT_MS = 60 * 60 * 1000;

          const base = {
            id: `todo-${t.id}`,
            title,
            extendedProps: {
              calendar: TODO_CALENDAR_LABEL,
              todoId: t.id,
              type: "todo",
              sortRank: t.important ? 2 : 1,
              status: t.status,
              priority: t.priority,
              notes: t.notes,
              collaborators: (t as any).collaborators,
              important: Boolean((t as any).important),
            },
          };

          if (hasTime) {
            // Timed event → visible + draggable in Week/Day views
            const start = d;
            const end = new Date(d.getTime() + DEFAULT_MS);
            return { ...base, start, end, allDay: false };
          } else {
            // All-day (date only) → Month view
            const dayStr = toLocalDateStr(d);
            return { ...base, start: dayStr, end: dayStr, allDay: true };
          }
        })
        .filter(Boolean) as any[]
  );

  // Apply calendar selection + "Only important" subfilter
  const visibleTodoEvents = computed(() => {
    const selected: string[] | undefined = calStore?.selectedCalendars;
    const show = Array.isArray(selected)
      ? selected.includes(TODO_CALENDAR_LABEL)
      : true;
    let list = show ? todoEvents.value : [];

    if (calStore.todoImportantOnly) {
      list = list.filter((e) => e?.extendedProps?.important === true);
    }
    return list;
  });

  // ===================== Meetings → FullCalendar events =====================
  const rawMeetings = computed(() => todos.meetings || []);
  // Vuetify theme color for success
  const successColor = "error";
  const color = successColor;

  const meetingEvents = computed<any[]>(
    () =>
      rawMeetings.value
        .map((m) => {
          if (!m?.startAt) return null;
          const startISO = new Date(m.startAt).toISOString();
          const endISO =
            (m as any).endAt ||
            computeEndAt(
              m.startAt,
              typeof m.duration === "number" ? m.duration : 30
            );

          if (!endISO) return null;

          return {
            id: `meeting-${m.id}`,
            title: m.subject || "Untitled meeting",
            start: startISO,
            end: endISO,
            allDay: false,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              calendar: m.type === "Sales" ? "Sales Booking" : "Meeting",
              meetingId: m.id,
              type: "meeting",
              sortRank: 3,
              meetingType: m.type,
              location: m.location,
              requestedBy: m.requestedBy,
            },
          };
        })
        .filter(Boolean) as any[]
  );

  const visibleMeetingEvents = computed(() => {
    const selected: string[] | undefined = calStore?.selectedCalendars;
    if (!Array.isArray(selected)) return meetingEvents.value;

    return meetingEvents.value.filter((event) =>
      selected.includes(String(event.extendedProps?.calendar || "Meeting"))
    );
  });

  const monthCollapsedTodoEvents = computed(() => {
    const grouped = new Map<string, any[]>();

    visibleTodoEvents.value.forEach((event) => {
      const start = toDateFromEventStart(event.start);
      if (Number.isNaN(start.getTime())) return;

      const dayKey = toLocalDateStr(start);
      const list = grouped.get(dayKey) ?? [];
      list.push(event);
      grouped.set(dayKey, list);
    });

    const collapsed: any[] = [];

    grouped.forEach((events, dayKey) => {
      const sorted = [...events].sort((a, b) => {
        const ai = a.extendedProps?.important ? 1 : 0;
        const bi = b.extendedProps?.important ? 1 : 0;
        if (ai !== bi) return bi - ai;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });

      const [firstTask, ...rest] = sorted;
      if (firstTask) collapsed.push(firstTask);

      if (rest.length > 0) {
        collapsed.push({
          id: `todo-more-${dayKey}`,
          title: `+${rest.length} more`,
          start: dayKey,
          end: dayKey,
          allDay: true,
          classNames: ["calendar-task-more"],
          editable: false,
          durationEditable: false,
          extendedProps: {
            calendar: TODO_CALENDAR_LABEL,
            type: "todo-more",
            date: dayKey,
            hiddenCount: rest.length,
            hiddenTodos: rest.map((event) => ({
              id: event.extendedProps?.todoId,
              title: event.title,
              dueAt: event.start,
              important: Boolean(event.extendedProps?.important),
              status: event.extendedProps?.status,
            })),
            sortRank: 0,
          },
        });
      }
    });

    return collapsed;
  });

  // ===================== Event Source =====================
  const fetchEvents: EventSourceFunc = (_info, success) => {
    const currentView = calendarApi.value?.view?.type;
    const todoList =
      currentView === "dayGridMonth"
        ? monthCollapsedTodoEvents.value
        : visibleTodoEvents.value;

    success([...todoList, ...visibleMeetingEvents.value]);
  };

  // ===================== Calendar Options =====================
  const calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin, listPlugin],
    initialView: "dayGridMonth",
    timeZone: "local",
    headerToolbar: {
      start: "drawerToggler,prev,next title",
      end: "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
    },
    customButtons: {
      drawerToggler: {
        text: "calendarDrawerToggler",
        click() {
          try {
            _isLeftSidebarOpen.value = true;
          } catch {}

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("calendar:open-left-sidebar", {
                bubbles: false,
              })
            );
          }
        },
      },
    },
    events: fetchEvents,
    eventTimeFormat: {
      hour: "numeric",
      minute: "2-digit",
      meridiem: false,
    },

    editable: true,
    eventStartEditable: true,
    eventDurationEditable: true,
    eventResizableFromStart: true,
    dragScroll: true,
    dayMaxEvents: 4,
    moreLinkClick: "popover",

    // Meetings always render first, no matter which source they come from.
    eventOrder: (a, b) => {
      const rank = (eventLike: any) => {
        if (eventLike.extendedProps?.type === "meeting") return 3;
        if (eventLike.extendedProps?.type === "todo") {
          return eventLike.extendedProps?.important ? 2 : 1;
        }
        if (eventLike.extendedProps?.type === "todo-more") return 0;
        return Number(eventLike.extendedProps?.sortRank ?? 0);
      };

      const ar = rank(a);
      const br = rank(b);
      if (ar !== br) return br - ar;

      const ai = a.extendedProps?.important ? 1 : 0;
      const bi = b.extendedProps?.important ? 1 : 0;
      if (ai !== bi) return bi - ai;

      const at = (a.title || "").toString();
      const bt = (b.title || "").toString();
      return at.localeCompare(bt);
    },
    eventOrderStrict: true,

    navLinks: true,
    forceEventDuration: true,

    eventClassNames({ event }) {
      const cal = (event.extendedProps as Record<string, any>)?.calendar;
      if (event.extendedProps?.type === "todo-more") {
        return ["calendar-task-more"];
      }
      const isImportant = event.extendedProps?.important === true;
      const baseColor = calendarsColor.value[cal] ?? "primary";
      const colorName = isImportant ? "warning" : baseColor;
      return [`bg-light-${colorName} text-${colorName}`];
    },

    // Clicking calendar items opens the EditToDoDrawer (via global event)
    eventClick: ({ event, jsEvent }) => {
      if (event.extendedProps?.type === "todo-more") {
        window.dispatchEvent(
          new CustomEvent("calendar:open-task-more", {
            detail: {
              date: event.extendedProps?.date,
              tasks: event.extendedProps?.hiddenTodos ?? [],
              x: jsEvent?.clientX ?? 0,
              y: jsEvent?.clientY ?? 0,
            },
          })
        );
        return;
      }

      // For meetings you may later open a meeting drawer; for now keep To-Do open
      const id =
        (event.extendedProps as Record<string, any>)?.todoId ??
        String(event.id || "").replace(/^todo-/, "");
      if (id != null && id !== "") {
        window.dispatchEvent(
          new CustomEvent("todo:open-edit", { detail: { id } })
        );
      }
    },

    // Dragging
    eventDrop: async ({ event, revert }) => {
      // Meetings drag
      if (
        event.extendedProps?.type === "meeting" ||
        String(event.id).startsWith("meeting-")
      ) {
        const meetingId =
          event.extendedProps?.meetingId ??
          String(event.id).replace(/^meeting-/, "");
        if (!meetingId || !event.start || !event.end) {
          try {
            revert();
          } catch {}
          return;
        }

        const startISO = event.start.toISOString();
        const durationMin = Math.max(
          5,
          Math.round((event.end.getTime() - event.start.getTime()) / 60000)
        );

        // Pinia (optimistic)
        todos.updateMeeting(meetingId, {
          startAt: startISO,
          duration: durationMin,
        });
        try {
          calendarApi.value?.refetchEvents();
        } catch {}
        return;
      }

      // To-Dos drag
      const isTodo =
        event.extendedProps?.type === "todo" ||
        String(event.id).startsWith("todo-");
      if (!isTodo) return;

      const todoId =
        event.extendedProps?.todoId ?? String(event.id).replace(/^todo-/, "");
      const newStart: Date | null = event.start ?? null;
      if (!todoId || !newStart) {
        try {
          revert();
        } catch {}
        return;
      }

      // Full datetime for timed events; date-only for all-day
      const newDue = event.allDay
        ? toLocalDateStr(newStart)
        : toLocalISO(newStart);

      // 1) OPTIMISTIC update store
      const before = todos.byId(todoId);
      const prevDue = before?.dueAt;
      todos.updateTodo(todoId, { dueAt: newDue });

      try {
        calendarApi.value?.refetchEvents();
      } catch {}

      // 2) SERVER persist → rollback on failure
      try {
        await patchDueAtOnServer(todoId, newDue);
        await patchDueAtOnServer(todoId, newDue);
        try {
          calendarApi.value?.refetchEvents();
        } catch {}
      } catch (e) {
        console.error("PATCH failed, rolling back:", e);
        if (prevDue) todos.updateTodo(todoId, { dueAt: prevDue });
        try {
          revert();
        } catch {}
        try {
          calendarApi.value?.refetchEvents();
        } catch {}
      }
    },

    // Resizing (meetings only)
    eventResize: ({ event, revert }) => {
      if (
        !(
          event.extendedProps?.type === "meeting" ||
          String(event.id).startsWith("meeting-")
        )
      ) {
        try {
          revert();
        } catch {}
        return;
      }
      if (!event.start || !event.end) {
        try {
          revert();
        } catch {}
        return;
      }

      const meetingId =
        event.extendedProps?.meetingId ??
        String(event.id).replace(/^meeting-/, "");
      const startISO = event.start.toISOString();
      const durationMin = Math.max(
        5,
        Math.round((event.end.getTime() - event.start.getTime()) / 60000)
      );

      todos.updateMeeting(meetingId, {
        startAt: startISO,
        duration: durationMin,
      });
      try {
        calendarApi.value?.refetchEvents();
      } catch {}
    },
  };

  // Acquire API if this composable owns the ref; otherwise we’ll accept it from the page
  onMounted(() => {
    nextTick(() => {
      try {
        const apiMaybe = refCalendar.value?.getApi?.();
        if (apiMaybe) calendarApi.value = apiMaybe;
      } catch {}
    });
  });

  // Bridge: page can provide CalendarApi without exposing its ref
  const onProvideApi = (e: Event) => {
    const detail = (e as CustomEvent).detail as CalendarApi | null;
    calendarApi.value = detail ?? null;
  };
  onMounted(() =>
    window.addEventListener("calendar:provide-api", onProvideApi)
  );
  onUnmounted(() =>
    window.removeEventListener("calendar:provide-api", onProvideApi)
  );

  // RTL/LTR
  watch(
    () => configStore.isAppRTL,
    (val) => {
      calendarApi.value?.setOption("direction", val ? "rtl" : "ltr");
    },
    { immediate: true }
  );

  // Live-refetch when data or filters change
  watch(
    () => todos.items,
    () => {
      try {
        calendarApi.value?.refetchEvents();
      } catch {}
    },
    { deep: true }
  );
  watch(
    () => todos.meetings,
    () => {
      try {
        calendarApi.value?.refetchEvents();
      } catch {}
    },
    { deep: true }
  );
  watch(
    () => calStore.selectedCalendars,
    () => {
      try {
        calendarApi.value?.refetchEvents();
      } catch {}
    },
    { deep: true }
  );
  watch(
    () => calStore.todoImportantOnly,
    () => {
      try {
        calendarApi.value?.refetchEvents();
      } catch {}
    }
  );

  // Public API expected by your page
  const refetchEvents = () => calendarApi.value?.refetchEvents();
  const jumpToDate = (currentDate: string) =>
    calendarApi.value?.gotoDate(new Date(currentDate));

  // No-ops kept for compatibility
  const addEvent = async (_e: any) => {};
  const updateEvent = async (_e: any) => {};
  const removeEvent = async (_id: any) => {};

  return {
    refCalendar,
    calendarOptions,
    fetchEvents,
    refetchEvents,
    jumpToDate,

    // compat
    addEvent,
    updateEvent,
    removeEvent,
  };
};

// Thin wrapper still supported by your page that only needs options
export function useCalendarOptions() {
  const dummy = ref<any>(null);
  const { calendarOptions } = useCalendar(dummy, dummy, dummy);
  return { calendarOptions };
}
