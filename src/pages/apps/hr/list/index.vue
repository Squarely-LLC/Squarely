<!-- Employees page -->
<script setup lang="ts">
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { computed, nextTick, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddNewUserDialog from "@/views/apps/hr/list/AddNewUserDialog.vue";
import ContactEditDialog from "@/views/apps/hr/list/ContactEditDialog.vue";
import AddAdditionsDrawer from "@/views/apps/hr/view/AddAdditionsDrawer.vue";
import AddAdvancesDrawer from "@/views/apps/hr/view/AddAdvancesDrawer.vue";
import AddDeductionDrawer from "@/views/apps/hr/view/AddDeductionDrawer.vue";
import AddLeaveDrawer from "@/views/apps/hr/view/AddLeaveDrawer.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";

type SortKey = "user" | "status" | "category" | "channel" | "createdAt";
type SortVal = { key: SortKey; order: "asc" | "desc" };

const searchQuery = ref("");
const selectedStatus = ref<string | undefined>();
const selectedDepartment = ref<string | undefined>();
const selectedReportTo = ref<number | string | undefined>();

const sortOptions: { title: string; value: SortVal }[] = [
  { title: "Name (A-Z)", value: { key: "user", order: "asc" } },
  { title: "Name (Z-A)", value: { key: "user", order: "desc" } },
  {
    title: "Recently Added",
    value: { key: "createdAt", order: "desc" },
  },
];

const selectedSort = ref<SortVal | undefined>(sortOptions[2].value);

const itemsPerPage = ref(13);
const page = ref(1);
const sortBy = ref<string | undefined>(selectedSort.value?.key);
const orderBy = ref<"asc" | "desc" | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

const rows = computed(() =>
  displayedContacts.value.map((emp) => ({
    ...emp,
    employmentReportTo: resolveManager(emp)?.name ?? "",
    employmentReportToAvatar: resolveManager(emp)?.avatar ?? null,
    employmentReportToId: resolveManager(emp)?.id ?? null,
  })),
);
const headers = [
  { title: "Name", key: "user" },
  { title: "Number", key: "number" },
  { title: "Reports To", key: "employmentReportTo" },

  { title: "Department", key: "employment.department" },

  { title: "Status", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];

const roleFilter = computed(() => undefined);
const planFilter = computed(() => undefined);
const statusFilter = computed(() => {
  if (!selectedStatus.value) return undefined;
  return selectedStatus.value;
});

const employeesStore = useEmployeesStore();
employeesStore.init();

watch(selectedSort, (val) => {
  if (!val) {
    sortBy.value = undefined;
    orderBy.value = undefined;
  } else {
    sortBy.value = val.key;
    orderBy.value = val.order;
  }
  page.value = 1;
});

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (contact: EmployeeProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const haystacks = [contact.fullName, contact.email, contact.number]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase());

    const numberQuery = query.replace(/\D/g, "");
    const hasMatch =
      haystacks.some((value) => value.includes(query)) ||
      (numberQuery &&
        contact.number &&
        contact.number.toString().replace(/\D/g, "").includes(numberQuery));

    if (!hasMatch) return false;
  }

  const mappedStatus = statusFilter.value;
  if (mappedStatus && contact.status !== mappedStatus) return false;

  if (
    selectedDepartment.value &&
    contact.employment?.department !== selectedDepartment.value
  )
    return false;

  if (selectedReportTo.value) {
    const reportToIds = contact.employment?.reportToIds ?? [];
    if (!reportToIds.includes(selectedReportTo.value)) return false;
  }

  return true;
};

const normalizeSortValue = (contact: EmployeeProperties, key?: string) => {
  switch (key) {
    case "user":
      return contact.fullName?.toLowerCase() ?? "";
    case "status":
      return contact.status ?? "";
    case "category":
      return contact.category ?? "";
    case "channel":
      return contact.channel ?? "";
    case "number":
      return (contact.number ?? "").toString().replace(/\D/g, "");
    case "createdAt":
      return contact.createdAt ?? "";
    default:
      return contact.createdAt ?? "";
  }
};

const compareContacts = (a: EmployeeProperties, b: EmployeeProperties) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  if (!Number.isNaN(Number(aValue)) && !Number.isNaN(Number(bValue))) {
    const diff = Number(aValue) - Number(bValue);
    return order === "asc" ? diff : -diff;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredContacts = computed<EmployeeProperties[]>(() => {
  return employeesStore.all
    .map((stored) => cloneContact(stored))
    .filter((contact): contact is EmployeeProperties => {
      if (!contact) return false;
      if (contact.id === null || contact.id === undefined) return false;
      return matchesFilters(contact);
    });
});

const sortedContacts = computed<EmployeeProperties[]>(() => {
  const items = [...filteredContacts.value];
  if (items.length > 1) items.sort(compareContacts);
  return items;
});

const displayedContacts = computed<EmployeeProperties[]>(() => {
  const results = sortedContacts.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;

  return results.slice(start, end);
});

const totalContacts = computed(() => sortedContacts.value.length);

const roles: any[] = [];
const plans: any[] = [];

const reportToDirectory = computed(() => {
  const map = new Map<
    string | number,
    { id: number | string; name: string; avatar?: string | null }
  >();
  employeesStore.all.forEach((emp) => {
    if (emp?.id === null || emp?.id === undefined) return;
    map.set(emp.id, {
      id: emp.id,
      name: emp.fullName,
      avatar: emp.picture || null,
    });
  });
  return map;
});

const resolveManager = (employee: EmployeeProperties) => {
  const reportToIds = employee.employment?.reportToIds ?? [];
  if (!reportToIds.length) return null;
  const firstManagerId = reportToIds[0];
  return reportToDirectory.value.get(firstManagerId) || null;
};

const decorateManagers = (employee: EmployeeProperties) => {
  const reportToIds = employee.employment?.reportToIds ?? [];

  const allIds = [...reportToIds];

  if (!allIds.length) return [];

  return allIds
    .map((id) => {
      const manager = reportToDirectory.value.get(id);
      if (!manager) return null;
      return {
        id: manager.id,
        avatar: manager.avatar,
        displayName: manager.name,
        isPrimary: false, // No primary concept for managers
      };
    })
    .filter(
      (
        m,
      ): m is {
        id: number | string;
        avatar: string;
        displayName: string;
        isPrimary: boolean;
      } => m !== null,
    );
};

const statusOptions = [
  { title: "All", value: "" },
  { title: "Active", value: "Active" },
  { title: "Not Hired", value: "Not Hired" },
];

const departmentOptions = computed(() => {
  const depts = new Set<string>();
  employeesStore.all.forEach((emp) => {
    const dept = emp?.employment?.department;
    if (dept) depts.add(dept);
  });
  return [
    { title: "All Departments", value: "" },
    ...Array.from(depts)
      .sort()
      .map((dept) => ({ title: dept, value: dept })),
  ];
});

const managerOptions = computed(() => {
  const managerIds = new Set<number | string>();
  employeesStore.all.forEach((emp) => {
    const reportToIds = emp?.employment?.reportToIds ?? [];
    for (const managerId of reportToIds) {
      managerIds.add(managerId);
    }
  });

  const managers = employeesStore.all
    .filter(
      (emp) =>
        emp?.id !== null && emp?.id !== undefined && managerIds.has(emp.id),
    )
    .map((emp) => ({
      title: emp.fullName,
      value: emp.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [{ title: "All Managers", value: "" }, ...managers];
});

const resolveClassVariant = () => ({ color: "info", icon: "tabler-user" });

const resolveStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "success";
    case "Not Hired":
      return "secondary";
    default:
      return "primary";
  }
};

const channelColor = (channel: string) => {
  switch (channel) {
    case "Direct Sales":
      return "primary";
    case "Referral":
      return "success";
    case "Social Media":
      return "info";
    case "Website":
      return "secondary";
    case "Email Campaigns":
      return "warning";
    default:
      return "primary";
  }
};

const avatarText = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};

const cloneContact = (contact: EmployeeProperties | null | undefined) => {
  if (!contact) return contact ?? null;

  const raw = toRaw(contact) as EmployeeProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn(
        "structuredClone failed for contact, falling back to JSON:",
        error,
      );
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as EmployeeProperties;
  } catch (error) {
    console.warn("Failed to clone contact payload:", error);
    return { ...raw };
  }
};

const isAddNewUserDrawerVisible = ref(false);
const isContactEditDialogVisible = ref(false);
const selectedContact = ref<EmployeeProperties | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const isConfirmDeleteVisible = ref(false);
const deleteCandidateId = ref<number | null>(null);
const deleteBlockingReasons = ref<string[]>([]);
const notifications = useNotificationsStore();
const router = useRouter();

const addNewContact = (contact: Partial<EmployeeProperties>) => {
  // eslint-disable-next-line no-console
  console.log("addNewContact received:", JSON.parse(JSON.stringify(contact)));

  // The store expects a Partial<EmployeeProperties> for addEmployee.
  // Ensure we pass the payload through directly so the store assigns an id and defaults.
  const newEmployee = employeesStore.addEmployee(contact);
  isAddNewUserDrawerVisible.value = false;

  // Navigate to the newly created employee's profile page
  if (newEmployee?.id) {
    router.push({ name: "apps-hr-view-id", params: { id: newEmployee.id } });
  }
};

// Synchronous low-risk check for references to a contact id across todos, meetings and other contacts' connections
const findDeleteBlockingReasons = (id: number): string[] => {
  const reasons: string[] = [];
  try {
    const todosStore = useTodos();
    // ensure todos initialized
    todosStore.init();

    // check todos - top-level collaborators
    const referencingTodos = todosStore.items.filter(
      (t) =>
        Array.isArray(t.collaborators) &&
        t.collaborators.some((c) => Number(c.id) === Number(id)),
    );
    if (referencingTodos.length) {
      reasons.push(
        `Referenced as an assignee in ${referencingTodos.length} task(s)`,
      );
    }

    // check todo steps collaborators
    const stepRefs = todosStore.items
      .flatMap((t) => t.steps || [])
      .filter(
        (s) =>
          Array.isArray(s.collaborators) &&
          s.collaborators.some((c) => Number(c.id) === Number(id)),
      );
    if (stepRefs.length) {
      reasons.push(
        `Referenced as a collaborator in ${stepRefs.length} todo step(s)`,
      );
    }

    // check activities/messages authors
    const activityRefs = todosStore.items
      .flatMap((t) => t.activities || [])
      .filter((a) => a && a.author && Number(a.author.id) === Number(id));
    if (activityRefs.length) {
      reasons.push(`Author on ${activityRefs.length} activity item(s)`);
    }

    const messageRefs = todosStore.items
      .flatMap((t) => t.messages || [])
      .filter(
        (m) => m && m.author && Number((m.author as any).id) === Number(id),
      );
    if (messageRefs.length) {
      reasons.push(`Author on ${messageRefs.length} message(s)`);
    }

    // meetings: requestedBy, linkedTo (by id) and notes authors
    const meetingsStore = todosStore;
    const referencingMeetings = meetingsStore.meetings.filter((m) => {
      if (m.requestedBy && Number(m.requestedBy.id) === Number(id)) return true;
      if (
        Array.isArray(m.linkedTo) &&
        m.linkedTo.some((l) => Number(l.id) === Number(id))
      )
        return true;
      if (
        Array.isArray(m.notes) &&
        m.notes.some(
          (n: any) => n && n.author && Number(n.author.id) === Number(id),
        )
      )
        return true;
      return false;
    });
    if (referencingMeetings.length) {
      reasons.push(`Referenced in ${referencingMeetings.length} meeting(s)`);
    }
  } catch (e) {
    // If anything goes wrong, be conservative and block deletion with a generic reason
    reasons.push(
      "Unable to guarantee safe deletion due to internal check failure",
    );
  }

  return reasons;
};

const confirmDeleteCandidate = (id: number) => {
  deleteCandidateId.value = id;
  deleteBlockingReasons.value = findDeleteBlockingReasons(id);
  isConfirmDeleteVisible.value = true;
};

const performDelete = () => {
  const id = deleteCandidateId.value;
  if (id === null) return;
  // double-check before deleting
  const reasons = findDeleteBlockingReasons(id);
  if (reasons.length) {
    deleteBlockingReasons.value = reasons;
    // keep dialog open and prevent deletion
    return;
  }

  employeesStore.removeEmployee(id);
  const index = selectedRows.value.findIndex((row) => row === id);
  if (index !== -1) selectedRows.value.splice(index, 1);

  // notify success
  notifications.push("Employee deleted", "success", 3500);

  // reset dialog state
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
  isConfirmDeleteVisible.value = false;
};

const cancelDelete = () => {
  isConfirmDeleteVisible.value = false;
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
};

// Remove references to a contact across todos, meetings and other contacts, then delete
const cleanupAndDelete = () => {
  const id = deleteCandidateId.value;
  if (id === null) return;

  const todosStore = useTodos();
  try {
    todosStore.init();
  } catch (e) {
    // continue — init might be a no-op
  }

  // Remove from top-level collaborators
  todosStore.items = todosStore.items.map((t) => {
    const collaborators = (t.collaborators || []).filter(
      (c) => Number(c.id) !== Number(id),
    );

    // steps
    const steps = (t.steps || []).map((s) => ({
      ...s,
      collaborators: (s.collaborators || []).filter(
        (c) => Number(c.id) !== Number(id),
      ),
    }));

    // activities: remove those authored by the contact
    const activities = (t.activities || []).filter(
      (a) => !(a && a.author && Number(a.author.id) === Number(id)),
    );

    // messages: remove authored messages
    const messages = (t.messages || []).filter(
      (m) =>
        !(
          m &&
          (m.author as any) &&
          Number((m.author as any).id) === Number(id)
        ),
    );

    return { ...t, collaborators, steps, activities, messages };
  });

  // Meetings: remove linkedTo and requestedBy and notes authored by contact
  todosStore.meetings = todosStore.meetings.map((m) => {
    const requestedBy =
      m.requestedBy && Number(m.requestedBy.id) === Number(id)
        ? null
        : m.requestedBy;
    const linkedTo = (m.linkedTo || []).filter(
      (l) => Number(l.id) !== Number(id),
    );
    const notes = (m.notes || []).filter(
      (n: any) => !(n && n.author && Number(n.author.id) === Number(id)),
    );
    return { ...m, requestedBy, linkedTo, notes };
  });

  // Finally delete the contact
  employeesStore.removeEmployee(id);
  const idx = selectedRows.value.findIndex((row) => row === id);
  if (idx !== -1) selectedRows.value.splice(idx, 1);

  notifications.push("References removed and contact deleted", "success", 3500);

  // reset dialog
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
  isConfirmDeleteVisible.value = false;
};

const deleteCandidateName = computed(() => {
  const id = deleteCandidateId.value;
  if (id === null) return "";
  const c = employeesStore.byId(id);
  return c?.fullName ?? String(id);
});

const fetchContactDetails = (id: number | string) => {
  loading.value = true;
  error.value = null;

  const contact = employeesStore.byId(id);
  if (!contact) {
    selectedContact.value = null;
    error.value = "Employee not found";
  } else {
    selectedContact.value = cloneContact(contact);
  }

  loading.value = false;
};

const openEditDialog = (id: number | string) => {
  fetchContactDetails(id);
  if (selectedContact.value) {
    isContactEditDialogVisible.value = true;
  }
};

const addTodoDrawerRef = ref<any | null>(null);
const isAddTodoDrawerVisible = ref(false);

const addMeetingRef = ref<any | null>(null);
const isAddMeetingOpen = ref(false);

const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);
const isAddLeaveOpen = ref(false);
const leaveTarget = ref<EmployeeProperties | null>(null);
const isAddAdditionOpen = ref(false);
const additionTarget = ref<EmployeeProperties | null>(null);
const isAddDeductionOpen = ref(false);
const deductionTarget = ref<EmployeeProperties | null>(null);
const isAddAdvanceOpen = ref(false);
const advanceTarget = ref<EmployeeProperties | null>(null);

const contactsOptions = computed(() =>
  employeesStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  })),
);

const openAddTaskDrawerForContact = (contact: EmployeeProperties) => {
  try {
    const initial = {
      title: `Follow up: ${contact.fullName ?? ""}`,
      collaborators: [
        {
          id: contact.id,
          name: contact.fullName,
          avatarUrl: contact.picture ?? null,
        },
      ],
    } as any;

    if (addTodoDrawerRef.value?.openWith) {
      addTodoDrawerRef.value.openWith(initial);
    } else {
      isAddTodoDrawerVisible.value = true;
      nextTick(() => {
        try {
          addTodoDrawerRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open todo drawer:", e);
  }
};

const openAddMeetingForContact = (contact: EmployeeProperties) => {
  try {
    const initial = {
      title: `Meeting: ${contact.fullName ?? ""}`,
      initialStart: new Date(),
      contacts: contactsOptions.value,
      notes: `Scheduled from contacts list: ${contact.fullName ?? ""}`,
      linkedTo: [
        {
          id: contact.id,
          name: contact.fullName,
          avatarUrl: contact.picture ?? null,
        },
      ],
    } as any;

    if (addMeetingRef.value?.openWith) {
      addMeetingRef.value.openWith(initial);
    } else {
      isAddMeetingOpen.value = true;
      nextTick(() => {
        try {
          addMeetingRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open meeting drawer:", e);
  }
};

const openComposeForContact = (contact: EmployeeProperties) => {
  try {
    const toAddress = contact.email || "";
    const initial = {
      to: toAddress ? [toAddress] : [],
      subject: `Hello ${contact.fullName ?? ""}`,
      message: `Hi ${contact.fullName ?? ""},\n\n`,
    } as any;

    isComposeDialogVisible.value = true;
    nextTick(() => {
      try {
        composeDialogRef.value?.openWith?.(initial);
      } catch (e) {
        /* ignore */
      }
    });
  } catch (e) {
    console.error("Failed to open compose dialog:", e);
  }
};

const openLeaveDrawerForContact = (contact: EmployeeProperties) => {
  leaveTarget.value = contact;
  isAddLeaveOpen.value = true;
};

const openAdditionDrawerForContact = (contact: EmployeeProperties) => {
  additionTarget.value = contact;
  isAddAdditionOpen.value = true;
};

const openDeductionDrawerForContact = (contact: EmployeeProperties) => {
  deductionTarget.value = contact;
  isAddDeductionOpen.value = true;
};

const openAdvanceDrawerForContact = (contact: EmployeeProperties) => {
  advanceTarget.value = contact;
  isAddAdvanceOpen.value = true;
};

const handleLeaveSubmit = (payload: any) => {
  if (!leaveTarget.value) return;
  const target = leaveTarget.value;
  const currentRequests = target.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  const newRequest = {
    ...payload,
    id: newId,
    type: "Leave",
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  employeesStore.updateEmployee(target.id, {
    requests: JSON.parse(
      JSON.stringify([...currentRequests, newRequest] as any[]),
    ),
  });

  notifications.push("Leave request added", "success", 3500);
  isAddLeaveOpen.value = false;
  leaveTarget.value = null;
};

const handleLeaveClose = () => {
  isAddLeaveOpen.value = false;
  leaveTarget.value = null;
};

const handleAdditionSubmit = (payload: any) => {
  if (!additionTarget.value) return;
  const target = additionTarget.value;
  const currentRequests = target.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  const newRequest = {
    ...payload,
    id: newId,
    type: "Addition",
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  employeesStore.updateEmployee(target.id, {
    requests: JSON.parse(
      JSON.stringify([...currentRequests, newRequest] as any[]),
    ),
  });

  notifications.push("Addition request added", "success", 3500);
  isAddAdditionOpen.value = false;
  additionTarget.value = null;
};

const handleAdditionClose = () => {
  isAddAdditionOpen.value = false;
  additionTarget.value = null;
};

const handleDeductionSubmit = (payload: any) => {
  if (!deductionTarget.value) return;
  const target = deductionTarget.value;
  const currentRequests = target.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  const newRequest = {
    ...payload,
    id: newId,
    type: "Deduction",
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  employeesStore.updateEmployee(target.id, {
    requests: JSON.parse(
      JSON.stringify([...currentRequests, newRequest] as any[]),
    ),
  });

  notifications.push("Deduction request added", "success", 3500);
  isAddDeductionOpen.value = false;
  deductionTarget.value = null;
};

const handleDeductionClose = () => {
  isAddDeductionOpen.value = false;
  deductionTarget.value = null;
};

const handleAdvanceSubmit = (payload: any) => {
  if (!advanceTarget.value) return;
  const target = advanceTarget.value;
  const currentRequests = target.requests || [];
  const newId =
    currentRequests.length > 0
      ? Math.max(...currentRequests.map((r: any) => r.id || 0)) + 1
      : 1;

  const newRequest = {
    ...payload,
    id: newId,
    type: "Advance",
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  employeesStore.updateEmployee(target.id, {
    requests: JSON.parse(
      JSON.stringify([...currentRequests, newRequest] as any[]),
    ),
  });

  notifications.push("Advance request added", "success", 3500);
  isAddAdvanceOpen.value = false;
  advanceTarget.value = null;
};

const handleAdvanceClose = () => {
  isAddAdvanceOpen.value = false;
  advanceTarget.value = null;
};

const handleAction = (action: string, item: EmployeeProperties) => {
  if (action === "Leave") {
    openLeaveDrawerForContact(item);
    return;
  }
  if (action === "Addition") {
    openAdditionDrawerForContact(item);
    return;
  }
  if (action === "Deduction") {
    openDeductionDrawerForContact(item);
    return;
  }
  if (action === "Advance") {
    openAdvanceDrawerForContact(item);
    return;
  }
  // Fallback placeholder for actions not yet implemented
  notifications.push(`${action} for ${item.fullName}`, "info", 3000);
};

const onMeetingCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addMeeting && todos.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (e) {
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
  }
};

const onTaskCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addTodo && todos.addTodo(payload);
    notifications.push("Task created", "success", 3500);
  } catch (e) {
    console.error("onTaskCreated failed:", e);
    notifications.push("Task created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
  }
};

const saveEditedContact = (payload: EmployeeProperties) => {
  loading.value = true;
  error.value = null;

  const updated = employeesStore.updateEmployee(payload.id, payload);
  if (!updated) {
    error.value = "Failed to save contact";
    loading.value = false;
    return;
  }

  // notify and close
  notifications.push(`${payload.fullName} updated`, "success", 3000);
  isContactEditDialogVisible.value = false;
  selectedContact.value = null;
  loading.value = false;
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy?.[0]?.key;
  orderBy.value = options.sortBy?.[0]?.order;

  // keep dropdown visually in sync with header clicks
  const found = sortOptions.find(
    (opt) =>
      opt.value.key === sortBy.value && opt.value.order === orderBy.value,
  );
  selectedSort.value = found?.value;
};

// Called from the template when the items-per-page selector changes.
const updateItemsPerPage = (value: number | string) => {
  itemsPerPage.value = Number(value);
};
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Employees</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedDepartment"
              placeholder="Select Department"
              :items="departmentOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedReportTo"
              placeholder="Reports To"
              :items="managerOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 13, title: '13' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="updateItemsPerPage"
          />
        </div>

        <VSpacer />

        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField
              v-model="searchQuery"
              placeholder="Search Employees"
            />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddNewUserDrawerVisible = true"
          >
            Employee
          </VBtn>
        </div>
      </VCardText>
      <VDivider />
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="rows"
        :items-length="totalContacts"
        item-value="id"
        :headers="headers"
        class="text-no-wrap"
        :sort-by="sortBy ? [{ key: sortBy, order: orderBy }] : []"
        @update:options="updateOptions"
      >
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4 pb-2 pt-2">
            <template v-if="item.id !== null && item.id !== undefined">
              <RouterLink
                :to="{ name: 'apps-hr-view-id', params: { id: item.id } }"
                class="d-inline-block"
              >
                <VAvatar
                  size="40"
                  :variant="!item.picture ? 'tonal' : undefined"
                  :color="!item.picture ? 'info' : undefined"
                >
                  <VImg v-if="item.picture" :src="item.picture" />
                  <span v-else>{{ avatarText(item.fullName) }}</span>
                </VAvatar>
              </RouterLink>
            </template>
            <template v-else>
              <VAvatar
                size="40"
                :variant="!item.picture ? 'tonal' : undefined"
                :color="!item.picture ? 'info' : undefined"
              >
                <VImg v-if="item.picture" :src="item.picture" />
                <span v-else>{{ avatarText(item.fullName) }}</span>
              </VAvatar>
            </template>
            <div class="d-flex flex-column">
              <h6 class="text-base d-flex align-center gap-1">
                <template v-if="item.id !== null && item.id !== undefined">
                  <RouterLink
                    :to="{
                      name: 'apps-hr-view-id',
                      params: { id: item.id },
                    }"
                    class="font-weight-medium text-link"
                  >
                    {{ item.fullName }}
                  </RouterLink>
                </template>
                <template v-else>
                  <span class="font-weight-medium text-high-emphasis">
                    {{ item.fullName }}
                  </span>
                </template>
              </h6>
              <div class="text-sm">
                {{ item.email }}
              </div>
              <div class="text-sm text-medium-emphasis">
                {{
                  item.employment?.positions &&
                  item.employment.positions.length > 0
                    ? item.employment.positions
                        .map((p) => p.position)
                        .join(", ")
                    : "No Position"
                }}
              </div>
            </div>
          </div>
        </template>

        <template #item.number="{ item }">
          <a class="text-body-1" :href="`tel:${item.number}`">{{
            item.number
          }}</a>
        </template>

        <template #item.employmentReportTo="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              v-if="decorateManagers(item).length"
              class="v-avatar-group demo-avatar-group"
            >
              <template
                v-for="manager in decorateManagers(item).slice(0, 3)"
                :key="`${item.id}-${manager.id}`"
              >
                <RouterLink
                  :to="{
                    name: 'apps-hr-view-id',
                    params: { id: manager.id },
                  }"
                  class="d-inline-block"
                >
                  <VAvatar
                    :size="40"
                    :color="manager.avatar ? undefined : 'primary'"
                    :class="[
                      manager.avatar ? null : 'text-white font-weight-medium',
                    ]"
                  >
                    <template v-if="manager.avatar">
                      <VImg :src="manager.avatar" />
                    </template>
                    <template v-else>
                      <span>{{ avatarText(manager.displayName) }}</span>
                    </template>

                    <VTooltip activator="parent" location="top">
                      <div class="d-flex flex-column gap-1">
                        <span class="font-weight-medium">
                          {{ manager.displayName }}
                        </span>
                      </div>
                    </VTooltip>
                  </VAvatar>
                </RouterLink>
              </template>

              <VAvatar
                v-if="decorateManagers(item).length > 3"
                color="secondary"
                :size="40"
                class="text-white font-weight-medium"
              >
                <span>+{{ decorateManagers(item).length - 3 }}</span>
                <VTooltip activator="parent" location="top">
                  {{ decorateManagers(item).length - 3 }} more
                </VTooltip>
              </VAvatar>
            </div>
            <span v-else class="text-medium-emphasis">-</span>
          </div>
        </template>

        <template #item.employment.department="{ item }">
          <span>{{ item.employment?.department || "-" }}</span>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="resolveStatusColor(item.status)"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <template #item.channel="{ item }">
          <VChip
            :color="channelColor(item.channel)"
            size="small"
            variant="tonal"
          >
            {{ item.channel }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="openEditDialog(item.id)" :disabled="loading">
            <VIcon icon="tabler-edit" />
          </IconBtn>

          <VBtn icon variant="text" color="medium-emphasis">
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem @click="openAddTaskDrawerForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-list-check" />
                  </template>
                  <VListItemTitle>Task</VListItemTitle>
                </VListItem>

                <VListItem @click="openAddMeetingForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-calendar" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>

                <VListItem @click="openComposeForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-mail" />
                  </template>
                  <VListItemTitle>Email</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Call', item)">
                  <template #prepend>
                    <VIcon icon="tabler-phone" />
                  </template>
                  <VListItemTitle>Call</VListItemTitle>
                </VListItem>

                <VDivider />

                <VListItem @click="handleAction('Leave', item)">
                  <template #prepend>
                    <VIcon icon="tabler-door-exit" />
                  </template>
                  <VListItemTitle>Leave</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Addition', item)">
                  <template #prepend>
                    <VIcon icon="tabler-plus" />
                  </template>
                  <VListItemTitle>Addition</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Deduction', item)">
                  <template #prepend>
                    <VIcon icon="tabler-minus" />
                  </template>
                  <VListItemTitle>Deduction</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Advance', item)">
                  <template #prepend>
                    <VIcon icon="tabler-cash" />
                  </template>
                  <VListItemTitle>Advance</VListItemTitle>
                </VListItem>
                <VDivider />

                <VListItem @click="confirmDeleteCandidate(item.id)">
                  <template #prepend>
                    <VIcon color="error" icon="tabler-trash" />
                  </template>
                  <VListItemTitle>Delete</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalContacts"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <AddNewUserDialog
      v-model:is-dialog-visible="isAddNewUserDrawerVisible"
      @submit="addNewContact"
    />

    <ContactEditDialog
      v-if="isContactEditDialogVisible && selectedContact"
      v-model:is-dialog-visible="isContactEditDialogVisible"
      :contact="selectedContact"
      :loading="loading"
      :error="error"
      @submit="saveEditedContact"
    />

    <AddLeaveDrawer
      v-model:is-drawer-open="isAddLeaveOpen"
      :employee-name="leaveTarget?.fullName || ''"
      :available-days="leaveTarget?.attendance?.vacation || 0"
      :leave-data="null"
      @submit="handleLeaveSubmit"
      @close="handleLeaveClose"
    />

    <AddAdditionsDrawer
      v-model:is-drawer-open="isAddAdditionOpen"
      :addition-data="null"
      @submit="handleAdditionSubmit"
      @close="handleAdditionClose"
    />

    <AddDeductionDrawer
      v-model:is-drawer-open="isAddDeductionOpen"
      :deduction-data="null"
      @submit="handleDeductionSubmit"
      @close="handleDeductionClose"
    />

    <AddAdvancesDrawer
      v-model:is-drawer-open="isAddAdvanceOpen"
      :advance-data="null"
      @submit="handleAdvanceSubmit"
      @close="handleAdvanceClose"
    />

    <!-- Tasks / Meeting / Email components wired for quick-create from contact list -->
    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      source="employees"
      @user-data="onTaskCreated"
    />

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model="isAddMeetingOpen"
      :contacts="contactsOptions"
      source="employees"
      @save="onMeetingCreated"
    />

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            const recipients = Array.isArray(payload?.to)
              ? payload.to
              : payload?.to
                ? [String(payload.to)]
                : [];
            notifications.push(
              `Email sent to ${recipients.length} recipient(s)`,
              'success',
              3500,
            );
          } catch (e) {
            notifications.push('Email sent', 'success', 3500);
          }
        }
      "
    />

    <VDialog v-model="isConfirmDeleteVisible" max-width="540">
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete Employee</VCardTitle>
        <VCardText>
          <div v-if="deleteBlockingReasons.length">
            <p>
              This employee cannot be deleted because it is referenced
              elsewhere:
            </p>
            <ul>
              <li v-for="(r, idx) in deleteBlockingReasons" :key="idx">
                {{ r }}
              </li>
            </ul>
            <p class="mt-5">
              Please review these references before deleting the employee.
            </p>
          </div>
          <div v-else>
            <p>
              Are you sure you want to permanently delete
              <strong>{{ deleteCandidateName }}</strong
              >?
            </p>
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="cancelDelete">
            Cancel
          </VBtn>
          <VBtn
            v-if="deleteBlockingReasons.length"
            variant="tonal"
            color="error"
            @click="cleanupAndDelete"
          >
            Remove references & Delete
          </VBtn>
          <VBtn
            v-if="!deleteBlockingReasons.length"
            variant="tonal"
            color="error"
            @click="performDelete"
          >
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
<style scoped>
.contact-primary-border {
  --primary-border-color: rgb(var(--v-theme-primary));

  position: relative;
}

.contact-primary-border::after {
  position: absolute;
  border: 2px solid var(--primary-border-color);
  border-radius: inherit;
  content: "";
  inset: -2px;
  pointer-events: none;
}
</style>
