<script setup lang="ts">
import type {
  Activity,
  ContactRef,
  Message,
  Status,
  ToDo,
  ToDoStep,
} from "@/data/schema";
import { useContactsStore } from "@/stores/contacts";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { formatSystemDate } from "@core/utils/formatters";
import { storeToRefs } from "pinia";
import { nextTick, onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTheme } from "vuetify";
/* Ã°Å¸â€˜â€° Drawers/Dialogs */
import AddNewTaskDrawer from "@/views/apps/todo/list/AddNewTaskDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";

/* demo avatar images */
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";
import MessageDrawer from "@/views/apps/todo/list/MessageDrawer.vue";
import WriteMessageDialog from "@/views/apps/todo/list/WriteMessageDialog.vue";
import StepEditDialog from "@/views/apps/todo/StepEditDialog.vue";
import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";

const isMsgDialogOpen = ref(false);
const msgTodo: any = ref(null);
const todosStore = useTodos();
todosStore.init(); // load from localStorage or seeds

// contacts for dropdowns
const contactsStore = useContactsStore();
contactsStore.init();
const contactsOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  })),
);
const { all } = storeToRefs(todosStore); // reactive list from store

// optional: current author to display (use an email as the name to match the screenshot)
const CURRENT_AUTHOR: ContactRef = { id: "me", name: "test@squarely.app" };

function openMessageDialog(t: ToDo) {
  msgTodo.value = t;
  isMsgDialogOpen.value = true;
}

// reuse your existing helper, but let it accept author too

/* ================== Demo/static data ================== */
const theme = useTheme();
const router = useRouter();
const nowISO = () => new Date().toISOString();
const statusOptions: { value: Status; title: string }[] = [
  { value: "pending", title: "Pending" },
  { value: "in_progress", title: "In Progress" },
  { value: "for_review", title: "For Review" },
  { value: "completed", title: "Completed" },
];
const statusLabel = (status: Status) =>
  statusOptions.find((option) => option.value === status)?.title ?? status;
const statusTextClass = (status: Status) =>
  status === "in_progress"
    ? "text-primary"
    : status === "for_review"
      ? "text-warning"
      : status === "pending"
        ? "text-medium-emphasis"
        : "text-success";

/* people */
const C: Record<string, ContactRef> = {
  ted: { id: 1, name: "Ted Samaha", avatarUrl: avatar1 },
  dana: { id: 2, name: "Diana Trix", avatarUrl: avatar2 },
  pierre: { id: 3, name: "Pierre Tannous", avatarUrl: avatar3 },
  alex: { id: 4, name: "Alex Chi" }, // no image
  nora: { id: 5, name: "Nora Farouk" }, // no image
  omar: { id: 6, name: "Omar Haddad" }, // no image
  lina: { id: 7, name: "Lina Azar" }, // no image
};

// ===== Edit Step dialog (from list) =====
const isEditStepDialogOpen = ref(false);
const editStepDialogTodoId = ref<number | string | null>(null);
const editStepDialogModel = ref<ToDoStep | null>(null);
const editStepDialogTitle = ref("Edit Subtask");

function openEditStep(todoId: number | string, step: ToDoStep) {
  editStepDialogTodoId.value = todoId;
  // deep clone so we don't mutate the row until Save
  editStepDialogModel.value = structuredClone(toRaw(step));
  editStepDialogTitle.value = "Edit Subtask";
  isEditStepDialogOpen.value = true;
}

function openAddStep(todoId: number | string) {
  const now = new Date().toISOString();
  editStepDialogTodoId.value = todoId;
  editStepDialogModel.value = {
    id: `step-${Date.now()}`,
    title: "",
    collaborators: [],
    dueAt: now,
    status: "pending",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
  editStepDialogTitle.value = "Add Subtask";
  isEditStepDialogOpen.value = true;
}

function onEditStepSave(edited: ToDoStep) {
  if (editStepDialogTodoId.value == null) return;
  const todoId = editStepDialogTodoId.value;

  const t = todosStore.byId(todoId);
  if (!t) return;

  const existingIndex = t.steps.findIndex((s) => s.id === edited.id);
  const nextStep = { ...edited, updatedAt: new Date().toISOString() };
  const steps =
    existingIndex === -1
      ? [...t.steps, nextStep]
      : t.steps.map((s) => (s.id === edited.id ? nextStep : s));

  todosStore.updateTodo(todoId, {
    steps,
    updatedAt: new Date().toISOString(),
  });

  // close dialog
  isEditStepDialogOpen.value = false;
  editStepDialogTodoId.value = null;
  editStepDialogModel.value = null;
}

function onEditStepClose() {
  isEditStepDialogOpen.value = false;
  editStepDialogTodoId.value = null;
  editStepDialogModel.value = null;
  editStepDialogTitle.value = "Edit Subtask";
}

// add near your other helpers
const clampNote = (s?: string, max = 35) => {
  if (!s) return "-";
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
};

/* ================== UI state ================== */
const isAddNewToDoDrawerVisible = ref(false);
const isAddNewTaskDrawerVisible = ref(false);
const isAssignDialogOpen = ref(false);
const assignDialogTodoId = ref<number | string | null>(null);
const selectedAssignedIds = ref<(number | string)[]>([]);

/* table UI state */
const searchQuery = ref("");
const selectedStatus = ref<Status | undefined>();
type TaskScope = "all" | "my_day" | "this_week" | "next_week";
const selectedScope = ref<TaskScope>("all");
const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<string | undefined>();
const orderBy = ref<"asc" | "desc" | undefined>();
const selectedRows = ref<string[]>([]);
const expanded = ref<string[]>([]);
const openTodoStatusMenuId = ref<number | string | null>(null);
const openStepStatusMenuKey = ref<string | null>(null);

/* ================== helpers ================== */
const fmtDateShort = (iso: string) => {
  try {
    return formatSystemDate(iso);
  } catch {
    return iso;
  }
};

const initials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || first.toUpperCase() || "?";
};

function goToContact(contact: ContactRef) {
  try {
    router.push({ name: "apps-contact-view-id", params: { id: contact.id } });
  } catch (e) {
    // ignore navigation errors in dev/mock environment
  }
}

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function weekBounds(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: startOfDay(monday), end: endOfDay(sunday) };
}

const inMyDay = (iso: string) => {
  const d = new Date(iso);
  const s = startOfDay(new Date());
  const e = endOfDay(new Date());
  return d >= s && d <= e;
};

const isRowExpandable = (raw?: ToDo | null) =>
  Array.isArray(raw?.steps) && raw!.steps.length > 0;
const getKey = (raw: ToDo) => String(raw.id);
const toggleRow = (raw: ToDo) => {
  if (!isRowExpandable(raw)) return;
  const key = getKey(raw);
  const i = expanded.value.indexOf(key);
  if (i === -1) expanded.value.push(key);
  else expanded.value.splice(i, 1);
};
const isExpanded = (t: ToDo) => expanded.value.includes(String(t.id));

/* ================== headers Ã¢â‚¬â€ required order ================== */
const headers = [
  { title: "", key: "data-table-select", width: 44, sortable: false },
  { title: "", key: "star", width: 44, sortable: true },
  { title: "Task", key: "todo" },
  { title: "Due Date", key: "due" },
  { title: "Assigned", key: "assigned" },
  { title: "Status", key: "status" },
  // headers
  {
    title: "Actions",
    key: "actions",
    align: "start" as const, // or omit this line (start is default)

    sortable: false,
  },
];

/* ================== filtering + excluding completed ================== */
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
const normalizeSearchText = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : "";

// ADD: normalize Ã¢â‚¬Å“completedÃ¢â‚¬Â across status/flags
function isCompletedRecord(t: any): boolean {
  return Boolean(
    t?.status === "completed" || t?.completed || t?.isCompleted || t?.doneAt,
  );
}

const scopePredicate = (dueISO: string) => {
  const due = new Date(dueISO);
  if (selectedScope.value === "all") return true;
  if (selectedScope.value === "my_day") {
    const s = startOfDay(new Date());
    const e = endOfDay(new Date());
    return due >= s && due <= e;
  }
  if (selectedScope.value === "this_week") {
    const { start, end } = weekBounds(0);
    return due >= start && due <= end;
  }
  if (selectedScope.value === "next_week") {
    const { start, end } = weekBounds(1);
    return due >= start && due <= end;
  }
  return true;
};

const filtered = computed<ToDo[]>(() => {
  let rows = [...all.value];

  if (selectedStatus.value === "completed")
    rows = rows.filter((t: any) => isCompletedRecord(t));
  else rows = rows.filter((t: any) => !isCompletedRecord(t));

  if (normalizedQuery.value) {
    rows = rows.filter((t) => {
      const inTitle = normalizeSearchText(t.title).includes(
        normalizedQuery.value,
      );
      const inNotes = normalizeSearchText(t.notes).includes(
        normalizedQuery.value,
      );
      const inPeople = Array.isArray(t.collaborators)
        ? t.collaborators.some((c) =>
            normalizeSearchText(c?.name).includes(normalizedQuery.value),
          )
        : false;
      return inTitle || inNotes || inPeople;
    });
  }

  if (selectedStatus.value)
    rows = rows.filter((t) => t.status === selectedStatus.value);
  rows = rows.filter((t) => scopePredicate(t.dueAt));

  return rows;
});

/* ================== sorting + pagination ================== */
const statusOrder: Status[] = [
  "pending",
  "in_progress",
  "for_review",
  "completed",
];

const sorted = computed(() => {
  const key = sortBy.value;
  const dir = orderBy.value === "desc" ? -1 : 1;
  const rows = [...filtered.value];

  // DEFAULT: non-overdue first Ã¢â€ â€™ important by nearest due, then others by nearest due.
  // Overdue tasks are pushed to the end, keeping the same internal ordering.
  if (!key) {
    const today = startOfDay(new Date()).getTime();
    const toMs = (t: ToDo) => startOfDay(new Date(t.dueAt)).getTime();
    rows.sort((a, b) => {
      if (a.important !== b.important)
        return Number(b.important) - Number(a.important);

      const aMs = toMs(a);
      const bMs = toMs(b);
      const aOverdue = aMs < today;
      const bOverdue = bMs < today;

      if (aOverdue !== bOverdue) return Number(aOverdue) - Number(bOverdue);
      if (!aOverdue) return aMs - bMs;
      return bMs - aMs;
    });
    return rows;
  }

  if (key === "todo") {
    rows.sort((a, b) => a.title.localeCompare(b.title) * dir);
  } else if (key === "due") {
    rows.sort(
      (a, b) =>
        (new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()) * dir,
    );
  } else if (key === "status") {
    rows.sort(
      (a, b) =>
        (statusOrder.indexOf(a.status as any) -
          statusOrder.indexOf(b.status as any)) *
        dir,
    );
  } else if (key === "star") {
    rows.sort((a, b) => (Number(a.important) - Number(b.important)) * dir);
  } else if (key === "assigned") {
    // Sort by presence of collaborators, then by count, then by title as a stable tiebreaker.
    rows.sort((a, b) => {
      const aHas = a.collaborators.length > 0 ? 1 : 0;
      const bHas = b.collaborators.length > 0 ? 1 : 0;
      const primary = (aHas - bHas) * dir;
      if (primary !== 0) return primary;

      const secondary = (a.collaborators.length - b.collaborators.length) * dir;
      if (secondary !== 0) return secondary;

      return a.title.localeCompare(b.title) * dir;
    });
  }

  return rows;
});

const totalRows = computed(() => sorted.value.length);
const pageRows = computed(() => {
  if (itemsPerPage.value === -1) return sorted.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return sorted.value.slice(start, start + itemsPerPage.value);
});

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const onRowDblClick = ({ item }: { item: ToDo }) => {
  if (isRowExpandable(item)) toggleRow(item);
};

const togglePendingProgress = (t: ToDo) => {
  const next = t.status === "in_progress" ? "pending" : "in_progress";
  todosStore.setStatus(t.id, next);
};

const markForReview = (t: ToDo) => todosStore.setStatus(t.id, "for_review");
const updateStatus = (t: ToDo, status: Status) =>
  todosStore.setStatus(t.id, status);

const openAssignDialog = (t: ToDo) => {
  assignDialogTodoId.value = t.id;
  selectedAssignedIds.value = Array.isArray(t.collaborators)
    ? t.collaborators.map((c) => c.id)
    : [];
  isAssignDialogOpen.value = true;
};

const closeAssignDialog = () => {
  isAssignDialogOpen.value = false;
  assignDialogTodoId.value = null;
  selectedAssignedIds.value = [];
};

const saveAssignedCollaborators = () => {
  if (assignDialogTodoId.value == null) return;

  const selected = selectedAssignedIds.value
    .map((id) =>
      contactsOptions.value.find(
        (contact) => String(contact.id) === String(id),
      ),
    )
    .filter(Boolean) as ContactRef[];

  todosStore.updateTodo(assignDialogTodoId.value, {
    collaborators: selected,
  });

  closeAssignDialog();
};

/* ================== actions / drawer handlers ================== */
const toggleImportant = (t: ToDo) => todosStore.toggleImportant(t.id);

function setTodoStatusMenu(todoId: number | string, isOpen: boolean) {
  openTodoStatusMenuId.value = isOpen ? todoId : null;
}

function setStepStatusMenu(
  todoId: number | string,
  stepId: number | string,
  isOpen: boolean,
) {
  openStepStatusMenuKey.value = isOpen ? `${todoId}:${stepId}` : null;
}

const addNewToDo = (payload: Partial<ToDo>) => {
  try {
    const created = todosStore.addTodo(payload);
    page.value = 1;
    isAddNewToDoDrawerVisible.value = false;
    try {
      const rawTitle =
        (created && created.title) || payload?.title || "Untitled";
      const safeTitle =
        String(rawTitle).length > 60
          ? String(rawTitle).slice(0, 57) + "..."
          : String(rawTitle);
      useNotificationsStore().push(
        `To-do '${safeTitle}' created`,
        "success",
        3000,
      );
    } catch {}
  } catch (e) {
    // fallback: still close drawer
    page.value = 1;
    isAddNewToDoDrawerVisible.value = false;
    try {
      useNotificationsStore().push("To-do created", "success", 3000);
    } catch {}
  }
};

// REPLACE the whole function with:
const markCompleted = (id: number | string) => {
  todosStore.setStatus(id, "completed"); // keep legacy path
  // ALSO persist flags so other views (and future) agree
  todosStore.updateTodo(id, {
    completed: true,
    isCompleted: true,
    doneAt: new Date().toISOString(),
  } as any);
};

function toggleStepCompleted(todoId: number | string, stepId: number | string) {
  const t = todosStore.byId(todoId);
  if (!t) return;
  const steps: ToDoStep[] = t.steps.map((s) =>
    s.id === stepId
      ? { ...s, status: s.status === "completed" ? "pending" : "completed" }
      : s,
  );
  todosStore.updateTodo(todoId, { steps });
}

function updateStepStatus(
  todoId: number | string,
  stepId: number | string,
  status: Status,
) {
  const t = todosStore.byId(todoId);
  if (!t) return;
  const steps: ToDoStep[] = t.steps.map((s) =>
    s.id === stepId ? { ...s, status } : s,
  );
  todosStore.updateTodo(todoId, { steps });
  openStepStatusMenuKey.value = null;
}
const deleteRow = (id: number | string) => {
  todosStore.removeTodo(id);
  const key = String(id);
  const i = selectedRows.value.indexOf(key);
  if (i !== -1) selectedRows.value.splice(i, 1);
};
/* ================== subtask alignment & anchoring ================== */
const expandedLeftPad = ref(112);
const anchors = ref({
  dueLeft: 0,
  assignedLeft: 0,
  statusLeft: 0,
  actionsLeft: 0,
});
let resizeObserver: ResizeObserver | null = null;

const computeAnchors = () => {
  const table = document.querySelector(".v-data-table") as HTMLElement | null;
  if (!table) return;

  const ths = table.querySelectorAll("thead th");
  if (!ths.length) return;

  const IDX = {
    checkbox: 0,
    star: 1,
    note: 2,
    date: 3,
    assigned: 4,
    status: 5,
    actions: 6,
  };

  const rectTable = table.getBoundingClientRect();
  const leftFor = (idx: number) =>
    (ths[idx] as HTMLElement).getBoundingClientRect().left - rectTable.left + 8;

  anchors.value = {
    dueLeft: leftFor(IDX.date),
    assignedLeft: leftFor(IDX.assigned),
    statusLeft: leftFor(IDX.status),
    actionsLeft: leftFor(IDX.actions),
  };
};

const computeExpandedLeftPad = () => {
  const table = document.querySelector(".v-data-table");
  if (!table) return;
  const ths = table.querySelectorAll("thead th");
  if (ths.length >= 3) {
    const checkboxW = (ths[0] as HTMLElement).offsetWidth;
    const starW = (ths[1] as HTMLElement).offsetWidth;
    const todoCellPadLeft = 16;
    const chevronEl = table.querySelector(
      ".todo-chevron",
    ) as HTMLElement | null;
    const chevronW = chevronEl ? chevronEl.offsetWidth : 28;
    const gap = 8;
    expandedLeftPad.value =
      checkboxW + starW + todoCellPadLeft + chevronW + gap;
  }
  computeAnchors();
};

onMounted(async () => {
  await nextTick();
  computeExpandedLeftPad();
  resizeObserver = new ResizeObserver(() => computeExpandedLeftPad());
  const table = document.querySelector(".v-data-table");
  if (table) resizeObserver.observe(table);
  window.addEventListener("resize", computeExpandedLeftPad);
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener("resize", computeExpandedLeftPad);
});

const isEditDrawerOpen = ref(false);
const editingToDo = ref<ToDo | null>(null);

function openEdit(t: ToDo) {
  editingToDo.value = t;
  isEditDrawerOpen.value = true;
}

function applyEdit(payload: any) {
  const partial: any = {
    title: payload.title,
    collaborators: payload.collaborators,
    dueAt: payload.dueAt,
    status: payload.status,
    notes: payload.notes,
    important: payload.important,
    attachment: payload.attachment,
    relatedTo: payload.relatedTo,
  };
  // ADD: carry completion flags if provided by the drawer switch
  if ("completed" in payload) partial.completed = payload.completed;
  if ("isCompleted" in payload) partial.isCompleted = payload.isCompleted;
  if ("doneAt" in payload) partial.doneAt = payload.doneAt;

  todosStore.updateTodo(payload.id, partial);
}

function saveStepsForTodo(payload: { id: number | string; steps: ToDoStep[] }) {
  todosStore.updateTodo(payload.id, {
    steps: payload.steps.map((s) => ({ ...s })),
  });
}

function addActivityToTodo(payload: {
  id: number | string;
  body: string;
  author?: ContactRef;
}) {
  const t = todosStore.byId(payload.id);
  if (!t) return;
  const author = payload.author ?? CURRENT_AUTHOR;
  const activities: Activity[] = [
    ...t.activities,
    {
      id: Date.now(),
      author,
      body: payload.body,
      createdAt: new Date().toISOString(),
    },
  ];
  todosStore.updateTodo(payload.id, { activities });
}
// BELOW your other UI state:
const isMessageDrawerOpen = ref(false);
const messageDrawerTodo = ref<ToDo | null>(null);

// open from the table
function openMessageDrawer(t: ToDo) {
  messageDrawerTodo.value = t;
  isMessageDrawerOpen.value = true;
}

// message count helper (keeps typing untouched)
const unreadMsgCount = (t: any) =>
  Array.isArray(t?.messages)
    ? t.messages.filter((message: any) => !message?.isRead).length
    : 0;

// handle send -> reuse your existing addActivityToTodo()
function addMessageToTodo(payload: {
  id: number | string;
  body: string;
  author?: ContactRef;
  messageId?: number | string;
}) {
  const t = todosStore.byId(payload.id);
  if (!t) return;
  const body = payload.body.trim();
  if (!body) return;
  // store allows extra fields; keep messages on the record
  const messages = Array.isArray((t as any).messages)
    ? [...(t as any).messages]
    : [];
  messages.push({
    id: payload.messageId ?? Date.now(),
    author: payload.author,
    body,
    createdAt: new Date().toISOString(),
    isRead: true,
    editedAt: null,
  });
  todosStore.updateTodo(payload.id, { ...(t as any), messages } as any);
}
function onMessageSend(payload: {
  id: number | string;
  body: string;
  author?: ContactRef;
  messageId?: number | string;
}) {
  addMessageToTodo(payload);
}

function onMessageEdit(payload: {
  id: number | string;
  messageId: number | string;
  body: string;
}) {
  const t = todosStore.byId(payload.id);
  if (!t) return;
  const body = payload.body.trim();
  if (!body) return;
  const messages: Message[] = Array.isArray((t as any).messages)
    ? (t as any).messages.map((message: any) =>
        String(message.id) === String(payload.messageId)
          ? {
              ...message,
              body,
              editedAt: new Date().toISOString(),
            }
          : message,
      )
    : [];
  todosStore.updateTodo(payload.id, { ...(t as any), messages } as any);
}

function onMessageReadStateChange(payload: {
  id: number | string;
  messageId: number | string;
  isRead: boolean;
}) {
  const t = todosStore.byId(payload.id);
  if (!t) return;
  const messages: Message[] = Array.isArray((t as any).messages)
    ? (t as any).messages.map((message: any) =>
        String(message.id) === String(payload.messageId)
          ? {
              ...message,
              isRead: payload.isRead,
            }
          : message,
      )
    : [];
  todosStore.updateTodo(payload.id, { ...(t as any), messages } as any);
}

/* ========= NEW: row click Ã¢â€ â€™ open edit (ignore controls/icons/avatars) ========= */
function isNoEditTarget(el: Element | null): boolean {
  if (!el) return false;
  // Ignore clicks on interactive controls, icons, avatars, chevrons, inputs, etc.
  return Boolean(
    (el as HTMLElement).closest(
      [
        "button",
        "a",
        ".v-btn",
        ".v-icon",
        "svg",
        "path",
        ".v-checkbox",
        ".v-switch",
        ".v-file-input",
        ".v-chip",
        "input",
        "textarea",
        "select",
        ".v-avatar",
        ".v-avatar-group",
        ".chevron-btn",
        "[role='button']",
      ].join(","),
    ),
  );
}

function onRowClick(e: MouseEvent, payload: any) {
  const target = (e?.target as Element) || null;
  if (!target) return;
  const item = payload?.item ?? payload;
  if (!item) return;
  if (isNoEditTarget(target)) return;
  openEdit(item);
}
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Tasks</VCardTitle>
      </VCardItem>

      <!-- Filters row -->
      <VCardText>
        <VRow>
          <VCol cols="12" sm="4">
            <AppSelect
              v-model="selectedScope"
              placeholder="Tasks"
              :items="[
                { title: 'All Tasks', value: 'all' },
                { title: 'My Day', value: 'my_day' },
                { title: 'This Week', value: 'this_week' },
                { title: 'Next Week', value: 'next_week' },
              ]"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="4">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="[
                { title: 'Pending', value: 'pending' },
                { title: 'In Progress', value: 'in_progress' },
                { title: 'For Review', value: 'for_review' },
                { title: 'Completed', value: 'completed' },
              ]"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="4">
            <div>
              <AppTextField
                v-model="searchQuery"
                placeholder="Search Task"
                clearable
              />
            </div>
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 15, title: '15' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>
        <VSpacer />
        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>
          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddNewToDoDrawerVisible = true"
          >
            Task
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        v-model:expanded="expanded"
        :item-value="(item: ToDo) => String(item.id)"
        :items="pageRows"
        :items-length="totalRows"
        :headers="headers"
        :multi-sort="false"
        :must-sort="false"
        class="text-no-wrap"
        @update:options="updateOptions"
        @dblclick:row="onRowDblClick"
        @click:row="onRowClick"
      >
        <!-- remove select-all header -->
        <template #header.data-table-select></template>
        <!-- Left-align the ACTIONS header label only -->
        <template #header.actions="{ column }">
          <span class="th-actions">{{ column.title }}</span>
        </template>

        <!-- row checkbox -> mark completed -->
        <template #item.data-table-select="{ item }">
          <div class="lead-cell justify-center">
            <VCheckbox
              hide-details
              density="compact"
              @click.stop="markCompleted(item.id)"
            />
          </div>
        </template>

        <!-- star sortable -->
        <template #item.star="{ item }">
          <div class="lead-cell justify-center">
            <VBtn
              icon
              variant="text"
              size="small"
              @click.stop="toggleImportant(item)"
            >
              <VIcon
                :icon="item.important ? 'tabler-star-filled' : 'tabler-star'"
                size="20"
                color="warning"
              />
            </VBtn>
          </div>
        </template>

        <!-- NOTE cell: equalized chevron width so titles align -->
        <!-- NOTE cell: equalized chevron slot so titles align perfectly -->
        <template #item.todo="{ item }">
          <div class="todosquare d-flex align-center">
            <div class="chevron-slot">
              <VBtn
                v-if="isRowExpandable(item)"
                icon
                variant="text"
                size="small"
                class="todo-chevron chevron-btn"
                @click.stop="toggleRow(item)"
                :aria-expanded="isExpanded(item)"
                :aria-label="
                  isExpanded(item) ? 'Collapse subtasks' : 'Expand subtasks'
                "
              >
                <VIcon
                  :icon="
                    isExpanded(item)
                      ? 'tabler-chevron-up'
                      : 'tabler-chevron-down'
                  "
                  size="18"
                />
              </VBtn>
              <div v-else class="chevron-placeholder" aria-hidden="true"></div>
            </div>

            <div class="todo-title-stack">
              <h6 class="text-base">{{ item.title }}</h6>
              <div class="text-sm">
                {{ clampNote(item.notes) }}
              </div>
              <div
                v-if="item.steps && item.steps.length"
                class="text-xs text-medium-emphasis mt-1"
              >
                <VIcon icon="tabler-subtask" size="18" class="mr-2" />
                Subtasks:
                {{
                  item.steps.filter((s) => s.status === "completed").length
                }}/{{ item.steps.length }}
              </div>
            </div>
          </div>
        </template>

        <!-- DATE -->
        <template #item.due="{ item }">
          {{ fmtDateShort(item.dueAt) }}
        </template>

        <!-- ASSIGNED -->
        <template #item.assigned="{ item }">
          <div class="assigned-cell-wrap">
            <div
              v-if="item.collaborators.length"
              class="v-avatar-group demo-avatar-group"
            >
              <VAvatar
                color="primary"
                v-for="c in item.collaborators.slice(0, 3)"
                :key="c.id"
                :size="40"
                @click.stop="goToContact(c)"
                style="cursor: pointer"
              >
                <template v-if="c.avatarUrl">
                  <VImg :src="c.avatarUrl" />
                </template>
                <template v-else>
                  <span class="mono">{{ initials(c.name) }}</span>
                </template>
                <VTooltip activator="parent" location="top">{{
                  c.name
                }}</VTooltip>
              </VAvatar>

              <VAvatar
                color="secondary"
                v-if="item.collaborators.length > 3"
                :size="40"
              >
                +{{ item.collaborators.length - 3 }}
                <VTooltip activator="parent" location="top">
                  {{
                    item.collaborators
                      .slice(3)
                      .map((c) => c.name)
                      .join(", ")
                  }}
                </VTooltip>
              </VAvatar>
            </div>
            <span v-else>-</span>

            <VBtn
              icon
              size="x-small"
              variant="tonal"
              color="primary"
              class="assign-add-btn"
              @click.stop="openAssignDialog(item)"
            >
              <VIcon icon="tabler-plus" size="16" />
              <VTooltip activator="parent" location="top">
                Add assignee
              </VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- STATUS -->
        <template #item.status="{ item }">
          <VMenu
            location="bottom start"
            :model-value="openTodoStatusMenuId === item.id"
            @update:model-value="setTodoStatusMenu(item.id, $event)"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                variant="text"
                size="small"
                class="status-trigger px-0 text-none"
                :class="statusTextClass(item.status)"
                @click.stop
              >
                <span class="text-body-1">{{ statusLabel(item.status) }}</span>
                <VIcon icon="tabler-chevron-down" size="16" class="ms-1" />
              </VBtn>
            </template>

            <VList density="compact" min-width="180">
              <VListItem
                v-for="option in statusOptions"
                :key="option.value"
                :active="item.status === option.value"
                @click="
                  updateStatus(item, option.value);
                  openTodoStatusMenuId = null;
                "
              >
                <template #prepend>
                  <VIcon
                    icon="tabler-check"
                    size="16"
                    :class="
                      item.status === option.value
                        ? 'text-primary'
                        : 'opacity-0'
                    "
                  />
                </template>

                <VListItemTitle :class="statusTextClass(option.value)">
                  {{ option.title }}
                </VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </template>

        <!-- ACTIONS -->
        <template #item.actions="{ item }">
          <div class="actions-cell">
            <VBadge
              class="msg-badge"
              :model-value="unreadMsgCount(item) > 0"
              :content="unreadMsgCount(item)"
              color="error"
              location="top end"
              overlap
              floating
              offset-x="2"
              offset-y="2"
            >
              <IconBtn @click.stop="openMessageDrawer(item)">
                <VIcon icon="tabler-message" />
              </IconBtn>
            </VBadge>
          </div>
        </template>

        <!-- Expanded Row: subtasks aligned to table columns -->
        <template #expanded-row="{ item, columns }">
          <tr
            v-if="item.steps && item.steps.length"
            class="v-data-table__tr expanded-row"
          >
            <td :colspan="columns.length">
              <div
                class="expanded-inner"
                :style="{
                  padding: `12px 16px 16px ${expandedLeftPad}px`,
                  '--subtask-left': expandedLeftPad + 'px',
                  '--due-left': anchors.dueLeft + 'px',
                  '--assigned-left': anchors.assignedLeft + 'px',
                  '--status-left': anchors.statusLeft + 'px',
                  '--actions-left': anchors.actionsLeft + 'px',
                }"
              >
                <div class="subtasks-header mb-2">
                  <h6 class="text-h6 mb-0">Subtasks</h6>
                  <VBtn
                    icon
                    size="x-small"
                    color="primary"
                    @click.stop="openAddStep(item.id)"
                  >
                    <VIcon icon="tabler-plus" size="16" />
                    <VTooltip activator="parent" location="top">
                      Add subtask
                    </VTooltip>
                  </VBtn>
                </div>

                <div class="d-flex flex-column gap-2">
                  <div
                    v-for="s in item.steps"
                    :key="s.id"
                    class="subtask-card"
                    @click="openEditStep(item.id, s)"
                    style="cursor: pointer"
                  >
                    <!-- left: checkbox + icon + title + date -->
                    <div class="subtask-left">
                      <VCheckbox
                        class="mr-2"
                        hide-details
                        density="compact"
                        :model-value="s.status === 'completed'"
                        @click.stop="toggleStepCompleted(item.id, s.id)"
                      />

                      <div class="d-flex flex-column">
                        {{ s.title }}
                      </div>
                    </div>

                    <div class="subtask-date">
                      <span class="text-sm">{{ fmtDateShort(s.dueAt) }}</span>
                    </div>

                    <!-- centered under ASSIGNED -->
                    <div class="subtask-assigned">
                      <div
                        v-if="s.collaborators.length"
                        class="v-avatar-group demo-avatar-group"
                      >
                        <VAvatar
                          color="primary"
                          v-for="c in s.collaborators.slice(0, 3)"
                          :key="c.id"
                          :size="32"
                          @click.stop="goToContact(c)"
                          style="cursor: pointer"
                        >
                          <template v-if="c.avatarUrl">
                            <VImg :src="c.avatarUrl" />
                          </template>
                          <template v-else>
                            <span class="mono">{{ initials(c.name) }}</span>
                          </template>
                          <VTooltip activator="parent" location="top">{{
                            c.name
                          }}</VTooltip>
                        </VAvatar>

                        <VAvatar
                          color="secondary"
                          v-if="s.collaborators.length > 3"
                          :size="32"
                        >
                          +{{ s.collaborators.length - 3 }}
                          <VTooltip activator="parent" location="top">
                            {{
                              s.collaborators
                                .slice(3)
                                .map((c) => c.name)
                                .join(", ")
                            }}
                          </VTooltip>
                        </VAvatar>
                      </div>
                    </div>

                    <!-- under STATUS -->
                    <div class="subtask-status">
                      <VMenu
                        location="bottom start"
                        :model-value="
                          openStepStatusMenuKey === `${item.id}:${s.id}`
                        "
                        @update:model-value="
                          setStepStatusMenu(item.id, s.id, $event)
                        "
                      >
                        <template #activator="{ props }">
                          <VBtn
                            v-bind="props"
                            variant="text"
                            size="small"
                            class="status-trigger px-0 text-none"
                            :class="statusTextClass(s.status)"
                            @click.stop
                          >
                            <span class="text-body-2">
                              {{ statusLabel(s.status) }}
                            </span>
                            <VIcon
                              icon="tabler-chevron-down"
                              size="16"
                              class="ms-1"
                            />
                          </VBtn>
                        </template>

                        <VList density="compact" min-width="180">
                          <VListItem
                            v-for="option in statusOptions"
                            :key="option.value"
                            :active="s.status === option.value"
                            @click="
                              updateStepStatus(item.id, s.id, option.value)
                            "
                          >
                            <template #prepend>
                              <VIcon
                                icon="tabler-check"
                                size="16"
                                :class="
                                  s.status === option.value
                                    ? 'text-primary'
                                    : 'opacity-0'
                                "
                              />
                            </template>

                            <VListItemTitle
                              :class="statusTextClass(option.value)"
                            >
                              {{ option.title }}
                            </VListItemTitle>
                          </VListItem>
                        </VList>
                      </VMenu>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>

        <!-- pagination -->
        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalRows"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <!-- same list as table -->
    <AddNewToDoDrawer
      v-model:is-drawer-open="isAddNewToDoDrawerVisible"
      :collaborators-options="contactsOptions"
      @user-data="addNewToDo"
    />

    <EditToDoDrawer
      :is-drawer-open="isEditDrawerOpen"
      :todo="editingToDo"
      :collaborators-options="contactsOptions"
      @update:isDrawerOpen="isEditDrawerOpen = $event"
      @save="applyEdit"
      @saveSteps="saveStepsForTodo"
      @addActivity="addActivityToTodo"
    />

    <StepEditDialog
      v-model="isEditStepDialogOpen"
      :step="editStepDialogModel"
      :collaborators-options="contactsOptions"
      :title="editStepDialogTitle"
      @save="onEditStepSave"
      @close="onEditStepClose"
    />

    <WriteMessageDialog
      v-model="isMsgDialogOpen"
      :todo="msgTodo"
      :author="CURRENT_AUTHOR"
    />

    <MessageDrawer
      v-model:is-drawer-open="isMessageDrawerOpen"
      :todo="messageDrawerTodo"
      :author="CURRENT_AUTHOR"
      @send="onMessageSend"
      @edit-message="onMessageEdit"
      @toggle-read="onMessageReadStateChange"
    />

    <VDialog v-model="isAssignDialogOpen" max-width="560">
      <VCard>
        <VCardItem title="Assign To" />
        <VDivider />

        <VCardText>
          <VAutocomplete
            v-model="selectedAssignedIds"
            :items="contactsOptions"
            item-title="name"
            item-value="id"
            label="Assigned"
            multiple
            chips
            closable-chips
            clearable
          >
            <template #item="{ props: itemProps, item }">
              <VListItem v-bind="itemProps">
                <template #prepend>
                  <VAvatar size="28" color="primary">
                    <template v-if="item.raw.avatarUrl">
                      <VImg :src="item.raw.avatarUrl" />
                    </template>
                    <template v-else>
                      <span class="text-caption font-weight-bold">
                        {{
                          (item.raw.name?.match(/\b\w/g) || [])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        }}
                      </span>
                    </template>
                  </VAvatar>
                </template>
              </VListItem>
            </template>
          </VAutocomplete>
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn
            color="primary"
            variant="tonal"
            @click="saveAssignedCollaborators"
          >
            Save
          </VBtn>
          <VBtn variant="tonal" color="secondary" @click="closeAssignDialog">
            Cancel
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <AddNewTaskDrawer v-model:is-drawer-open="isAddNewTaskDrawerVisible" />
  </section>
</template>

<style scoped>
/* Align "Note" header text with the title below (chevron slot = 28px + 8px gap) */
:deep(.v-data-table thead th:nth-child(3) .v-data-table-header__content) {
  padding-inline-start: 30px;
}

:deep(.v-data-table tbody td:nth-child(3)) {
  padding-inline-start: 4px !important;
}

/* --- Chevron slot: exact same width whether button exists or not --- */
.chevron-slot {
  display: inline-flex;
  flex: 0 0 26px;
  align-items: center;
  justify-content: center;
  block-size: 26px; /* fixed height */
  inline-size: 26px; /* fixed width */
  margin-inline-start: -4px;
}

/* When there's no chevron, we still reserve identical space */
.chevron-placeholder {
  block-size: 26px;
  inline-size: 26px;
}

.lead-cell {
  display: inline-flex;
  flex: 0 0 26px;
  align-items: center;
  block-size: 26px;
  inline-size: 26px;
}

.assigned-cell-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-block-size: 40px;
}

.assign-add-btn {
  flex: 0 0 auto;
}

/* Remove extra padding/min-width Vuetify adds to icon buttons */
:deep(.chevron-btn.v-btn) {
  padding: 0;
  min-inline-size: 0;
}

:deep(.lead-cell .v-input) {
  margin: 0;
}

:deep(.lead-cell .v-selection-control) {
  justify-content: center;
  min-block-size: 26px;
}

/* Expanded row colors (kept) */
:deep(.v-data-table .expanded-row > td) {
  padding: 0 !important;
  background-color: rgba(66, 66, 66, 15.8%) !important;
  border-block-end: 1px solid rgba(255, 255, 255, 6%);
  border-block-start: 1px solid rgba(255, 255, 255, 6%);
}

/* :deep(.v-data-table .expanded-row:hover > td) {
  background-color: rgba(0, 184, 212, 18%) !important;
} */

.todo-title-stack {
  margin-inline-start: 8px;
  min-inline-size: 0;
}

.todosquare {
  padding-block: 0.5rem;
  padding-inline: 0.5rem 0;
}

/* 2-letter monogram for avatars without images */
.mono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 100%;
  font-size: 0.9rem;
  font-weight: 700;
  inline-size: 100%;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.status-trigger {
  justify-content: flex-start;
  min-inline-size: 0;
}

/* ---------- Subtask layout aligned to table columns ---------- */
.expanded-inner {
  position: relative;
}

.subtasks-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Card stops before Actions column */
.subtask-card {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 6%);
  border-radius: 12px;
  background: rgba(255, 255, 255, 3%);
  inline-size: calc(var(--actions-left) - var(--subtask-left) - 74px);
  padding-block: 12px;
  padding-inline: 16px;
}

.subtask-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Anchored columns */
.subtask-date,
.subtask-assigned,
.subtask-status {
  position: absolute;
  inset-block-start: 50%;
  transform: translateY(-50%);
}

.subtask-date {
  inset-inline-start: calc(var(--due-left) - var(--subtask-left));
}

.subtask-assigned {
  inset-inline-start: calc(var(--assigned-left) - var(--subtask-left));
}

.subtask-status {
  inset-inline-start: calc(var(--status-left) - var(--subtask-left));
}

/* Keep the badge-wrapped icon aligned with other IconBtn's */
:deep(.msg-badge) {
  display: inline-flex; /* same inline box as other icons */
  vertical-align: middle; /* align with neighbors */
}

:deep(.msg-badge .v-badge__wrapper) {
  display: inline-flex; /* don't expand height */
  align-items: center;
  justify-content: center;
  line-height: 0; /* prevent extra baseline space */
}

/* Left-anchor the whole cellÃ¢â‚¬â„¢s contents */
.actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  margin-inline-start: 0;
  padding-inline-end: 4px;
}

/* Compact badge; doesnÃ¢â‚¬â„¢t affect cell width */
:deep(.msg-badge .v-badge__badge) {
  block-size: 14px;
  font-size: 10px;
  line-height: 14px;
  min-inline-size: 14px;
  padding-inline: 3px;
}

/* Make sure buttons inside actions donÃ¢â‚¬â„¢t add side margins */
:deep(td .actions-cell .v-btn) {
  margin-inline: 0;
}

/* Actions column = 7th cell (after checkbox + star + To Do + Due + Assigned + Status) */

/* Header: make the wrapper left-justify */
:deep(.v-data-table thead th:nth-child(7) .v-data-table-header__content) {
  justify-content: flex-start !important;
  padding-inline-start: 16px; /* matches td padding */
}

/* Body cells: left-align text/inline content */
:deep(.v-data-table tbody td:nth-child(7)) {
  padding-inline-start: 16px; /* same as other columns */
  text-align: start !important;
}

/* Remove any padding/margins and force a compact square */
:deep(td:nth-child(7) .v-btn.v-btn--icon) {
  padding: 0 !important;
  margin: 0 !important;
  block-size: 28px !important;
  inline-size: 28px !important; /* compact hit area */
  min-block-size: 28px !important;
  min-inline-size: 28px !important;
}

/* Keep the icons visually smaller so the row height stays tight */
:deep(td:nth-child(7) .v-btn .v-icon) {
  font-size: 18px !important;
  line-height: 1 !important;
}

/* ACTIONS header label Ã¢â€ â€™ left-aligned */
:deep(.th-actions) {
  display: flex;
  justify-content: flex-start;
  inline-size: 100%;
  padding-inline-start: 6px;
}
</style>
