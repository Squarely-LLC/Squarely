<script setup lang="ts">
import AddAdditionsDrawer from "@/views/apps/hr/view/AddAdditionsDrawer.vue";
import AddAdvancesDrawer from "@/views/apps/hr/view/AddAdvancesDrawer.vue";
import AddDeductionDrawer from "@/views/apps/hr/view/AddDeductionDrawer.vue";
import AddLeaveDrawer from "@/views/apps/hr/view/AddLeaveDrawer.vue";
import AddTimeAuLieuDrawer from "@/views/apps/hr/view/AddTimeAuLieuDrawer.vue";
import AddMeetingDrawer, {
  type NewMeetingPayload,
} from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";
import MessageDrawer from "@/views/apps/todo/list/MessageDrawer.vue";
import { useEmployeesStore } from "@/stores/employees";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { usePeopleStore } from "@/stores/people";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import { useTodos } from "@/stores/todos";
import { getSignedInIdentity } from "@/utils/currentAccount";
import { getCurrentUserRole } from "@/utils/authorization";
import {
  cancelOlderFinanceFamilyVersions,
  normalizeFinanceApprovalStatus,
} from "@/utils/financeApproval";
import {
  dismissFinanceApprovalRequestNotifications,
  notifyFinanceApprovalDecision,
} from "@/utils/financeApprovalNotifications";
import { canMutate } from "@/utils/permissionUi";
import { getContactAndEmployeeRefs, resolvePeopleSelection } from "@/utils/peopleOptions";
import { formatSystemDate } from "@core/utils/formatters";

type DashboardRequestType = "Addition" | "Deduction" | "Advance" | "Time au Lieu";
const requestTypes: DashboardRequestType[] = [
  "Addition",
  "Deduction",
  "Advance",
  "Time au Lieu",
];

const donutChartColors = {
  donut: {
    series1: "#22A95E",
    series2: "#24B364",
    series3: "#56CA00",
    series4: "#53D28C",
    series5: "#7EDDA9",
    series6: "#A9E9C5",
  },
};

const todosStore = useTodos();
const peopleStore = usePeopleStore();
const employeesStore = useEmployeesStore();
const notifications = useNotificationsStore();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();
const router = useRouter();

todosStore.init();
peopleStore.init();
employeesStore.init();
quotationsStore.init();
proformasStore.init();
invoicesStore.init();

const isLeaveDrawerOpen = ref(false);
const isRequestPickerOpen = ref(false);
const isAdditionDrawerOpen = ref(false);
const isDeductionDrawerOpen = ref(false);
const isAdvanceDrawerOpen = ref(false);
const isTimeAuLieuDrawerOpen = ref(false);

const selectedLeaveData = ref(null);
const selectedAdditionData = ref(null);
const selectedDeductionData = ref(null);
const selectedAdvanceData = ref(null);
const selectedTimeAuLieuData = ref(null);
const workScope = ref<"day" | "week">("day");
const isEditTodoDrawerOpen = ref(false);
const editingTodo = ref<any | null>(null);
const isMessageDrawerOpen = ref(false);
const messageDrawerTodo = ref<any | null>(null);
const isMeetingDrawerOpen = ref(false);
const editingMeeting = ref<any | null>(null);
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isRowCollaboratorDialogVisible = ref(false);
const rowCollaboratorTarget = ref<{ type: "task" | "meeting"; record: any } | null>(null);
const rowCollaboratorValue = ref<Array<number | string>>([]);
const dashboardLeftStackRef = ref<HTMLElement | null>(null);
const dashboardTimelineCardRef = ref<any | null>(null);
const dashboardTimelineHeight = ref<number | null>(null);

const identity = computed(() => getSignedInIdentity());
const currentRole = computed(() => getCurrentUserRole());

let dashboardResizeObserver: ResizeObserver | null = null;

const updateDashboardTimelineHeight = () => {
  if (typeof window === "undefined") return;

  if (window.innerWidth < 768) {
    dashboardTimelineHeight.value = null;

    return;
  }

  const leftStack = dashboardLeftStackRef.value;
  const timelineCard = (dashboardTimelineCardRef.value?.$el ??
    dashboardTimelineCardRef.value) as HTMLElement | null;

  if (!leftStack || !timelineCard) return;

  const leftHeight = leftStack.getBoundingClientRect().height;
  const timelineTop = timelineCard.getBoundingClientRect().top;
  const availableHeight = Math.max(320, window.innerHeight - timelineTop - 32);

  dashboardTimelineHeight.value = Math.max(0, Math.min(leftHeight, availableHeight));
};

const dashboardTimelineStyle = computed(() =>
  dashboardTimelineHeight.value
    ? {
        blockSize: `${dashboardTimelineHeight.value}px`,
        maxBlockSize: `${dashboardTimelineHeight.value}px`,
      }
    : undefined,
);

onMounted(() => {
  updateDashboardTimelineHeight();

  if (typeof ResizeObserver !== "undefined" && dashboardLeftStackRef.value) {
    dashboardResizeObserver = new ResizeObserver(() => updateDashboardTimelineHeight());
    dashboardResizeObserver.observe(dashboardLeftStackRef.value);
  }

  window.addEventListener("resize", updateDashboardTimelineHeight);
});

onBeforeUnmount(() => {
  dashboardResizeObserver?.disconnect();
  dashboardResizeObserver = null;

  if (typeof window !== "undefined")
    window.removeEventListener("resize", updateDashboardTimelineHeight);
});

const normalizeKey = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? ""
    : String(value).trim().toLowerCase();

const isAdminUser = computed(() => {
  const signedIn = identity.value as any;
  const roleValues = [
    signedIn.role,
    signedIn.roles,
    signedIn.permissions,
    signedIn.email,
  ];

  return (
    normalizeKey(signedIn.email) === "admin@demo.com" ||
    roleValues.some((entry) => normalizeKey(entry).includes("admin"))
  );
});

const isSuperAdminUser = computed(
  () =>
    currentRole.value?.name === "Account Owner / Super Admin" ||
    normalizeKey((identity.value as any).role) ===
      normalizeKey("Account Owner / Super Admin") ||
    normalizeKey(identity.value.email) === "admin@demo.com",
);

const addIdentityValue = (set: Set<string>, value: unknown) => {
  const key = normalizeKey(value);
  if (key) set.add(key);
};

const collectRefKeys = (value: any, set = new Set<string>()) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRefKeys(entry, set));

    return set;
  }

  if (value && typeof value === "object") {
    [
      value.id,
      value.value,
      value.employeeId,
      value.personId,
      value.contactId,
      value.accountId,
      value.email,
      value.name,
      value.fullName,
      value.title,
      value.username,
    ].forEach((entry) => addIdentityValue(set, entry));

    return set;
  }

  addIdentityValue(set, value);

  return set;
};

const currentPerson = computed(() => {
  const signedIn = identity.value;
  const directCandidates = [
    signedIn.employeeId,
    signedIn.personId,
    signedIn.id,
    signedIn.accountId,
  ]
    .map((entry) => normalizeKey(entry))
    .filter(Boolean);

  return (
    peopleStore.hrPeople.find((person: any) =>
      [
        person.id,
        person.employeeId,
        person.personId,
        person.legacyEmployeeId,
      ]
        .map((entry) => normalizeKey(entry))
        .some((entry) => directCandidates.includes(entry)),
    ) ??
    peopleStore.hrPeople.find((person: any) => {
      const email = normalizeKey(signedIn.email);
      const name = normalizeKey(signedIn.name);

      return (
        (email && normalizeKey(person.email) === email) ||
        (name &&
          [person.name, person.fullName].map((entry) => normalizeKey(entry)).includes(name))
      );
    }) ??
    null
  );
});

const currentEmployee = computed(() => {
  const id =
    currentPerson.value?.id ??
    identity.value.employeeId ??
    identity.value.personId ??
    identity.value.id;

  return id ? employeesStore.byId(id) : null;
});

const currentUserKeys = computed(() => {
  const keys = new Set<string>();
  const signedIn = identity.value;

  [
    signedIn.id,
    signedIn.accountId,
    signedIn.employeeId,
    signedIn.personId,
    signedIn.email,
    signedIn.name,
    currentPerson.value?.id,
    currentPerson.value?.legacyEmployeeId,
    currentPerson.value?.email,
    (currentPerson.value as any)?.name,
    currentPerson.value?.fullName,
  ].forEach((entry) => addIdentityValue(keys, entry));

  return keys;
});

const directReports = computed(() => {
  const managerKeys = currentUserKeys.value;

  return peopleStore.hrPeople.filter((person: any) =>
    (person.hrProfile?.employment?.reportToIds ?? []).some((managerId: any) =>
      managerKeys.has(normalizeKey(managerId)),
    ),
  );
});

const dashboardPeople = computed(() => {
  const byId = new Map<string, any>();
  if (currentPerson.value) byId.set(String(currentPerson.value.id), currentPerson.value);
  directReports.value.forEach((person: any) => byId.set(String(person.id), person));

  return [...byId.values()];
});

const canSeeTeam = computed(() => directReports.value.length > 0);

const scopedIdentityKeys = computed(() => {
  const keys = new Set(currentUserKeys.value);

  if (canSeeTeam.value) {
    directReports.value.forEach((person: any) => {
      [
        person.id,
        person.legacyEmployeeId,
        person.employeeId,
        person.personId,
        person.email,
        person.name,
        person.fullName,
      ].forEach((entry) => addIdentityValue(keys, entry));
    });
  }

  return keys;
});

const matchesScope = (value: any, keys = scopedIdentityKeys.value) => {
  const valueKeys = collectRefKeys(value);

  return [...valueKeys].some((key) => keys.has(key));
};

const taskBelongsToScope = (task: any) =>
  [
    task.assignedTo,
    task.assignees,
    task.assigned,
    task.collaborators,
    task.owner,
    task.ownerId,
    task.employeeId,
    task.createdBy,
    task.requestedBy,
    task.author,
  ].some((entry) => matchesScope(entry));

const meetingBelongsToScope = (meeting: any) =>
  [
    meeting.linkedTo,
    meeting.attendees,
    meeting.collaborators,
    meeting.requestedBy,
    meeting.createdBy,
    meeting.author,
  ].some((entry) => matchesScope(entry));

const localDateKey = (value: any) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const todayKey = computed(() => localDateKey(new Date()));

const dateValue = (entry: any) =>
  entry?.dueAt ?? entry?.dueDate ?? entry?.date ?? entry?.startAt ?? "";

const isToday = (value: any) => localDateKey(value) === todayKey.value;

const isBeforeToday = (value: any) => {
  const key = localDateKey(value);

  return Boolean(key && key < todayKey.value);
};

const weekRange = computed(() => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
});

const isInSelectedScope = (value: any) => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return false;
  if (workScope.value === "day") return isToday(date);

  return date >= weekRange.value.start && date <= weekRange.value.end;
};

const isTaskCompleted = (task: any) =>
  task?.status === "completed" ||
  task?.status === "Completed" ||
  task?.completed === true ||
  task?.isCompleted === true ||
  Boolean(task?.completedAt);

const isMeetingCompleted = (meeting: any) =>
  meeting?.status === "completed" ||
  meeting?.status === "COMPLETED" ||
  Boolean(meeting?.completedAt) ||
  Boolean(meeting?.mom?.completedAt);

const isMeetingCanceled = (meeting: any) => {
  const status = normalizeKey(meeting?.status);

  return status === "canceled" || status === "cancelled";
};

const scopedTasks = computed(() => todosStore.all.filter((task: any) => taskBelongsToScope(task)));

const scopedMeetings = computed(() =>
  todosStore.meetingsAll.filter((meeting: any) => meetingBelongsToScope(meeting)),
);

const scopedRequests = computed(() =>
  dashboardPeople.value.flatMap((person: any) => {
    const employee =
      employeesStore.byId(person.id) ??
      (person.legacyEmployeeId ? employeesStore.byId(person.legacyEmployeeId) : null) ??
      person;

    return (employee.requests ?? []).map((request: any) => ({
      ...request,
      employeeId: employee.id ?? person.id,
      employeeName:
        employee.fullName ??
        (employee as any).name ??
        person.fullName ??
        person.name ??
        "Employee",
    }));
  }),
);

const ownRequests = computed(() => {
  const own = currentPerson.value;
  if (!own) return [];

  const employee =
    employeesStore.byId(own.id) ??
    (own.legacyEmployeeId ? employeesStore.byId(own.legacyEmployeeId) : null) ??
    own;

  return (((employee as any).requests ?? []) as any[]).map((request: any) => ({
    id: `hr-${employee.id}-${request.id}`,
    type: request.type ?? "Request",
    title: `${request.type ?? "Request"} request`,
    status: request.status ?? "pending",
    date: request.createdAt ?? request.startDate ?? request.date ?? "",
    owner: employee.fullName ?? (employee as any).name ?? own.fullName ?? "Employee",
    raw: request,
  }));
});

const canApproveFinance = computed(() => canMutate("finance", "approve"));
const canApproveHr = computed(() => canMutate("hr", "approve") || canMutate("hr", "update"));

const todaysTasks = computed(() =>
  scopedTasks.value.filter((task: any) => isToday(dateValue(task))),
);

const openTodaysTasks = computed(() =>
  todaysTasks.value.filter((task: any) => !isTaskCompleted(task)),
);

const overdueTasks = computed(() =>
  scopedTasks.value.filter(
    (task: any) => !isTaskCompleted(task) && isBeforeToday(dateValue(task)),
  ),
);

const todaysMeetings = computed(() =>
  scopedMeetings.value.filter(
    (meeting: any) => isToday(meeting.startAt) && !isMeetingCanceled(meeting),
  ),
);

const collaboratorOptions = computed(() => getContactAndEmployeeRefs());

const personCanonicalKey = (value: any) => {
  if (!value || typeof value !== "object") return normalizeKey(value);

  return (
    normalizeKey(value.employeeId) ||
    normalizeKey(value.personId) ||
    normalizeKey(value.contactId) ||
    normalizeKey(value.id) ||
    normalizeKey(value.value) ||
    normalizeKey(value.email) ||
    normalizeKey(value.name)
  );
};

const dedupePeopleRefs = <T extends any>(items: T[]): T[] => {
  const seen = new Set<string>();

  return items.filter((item: any) => {
    const key = personCanonicalKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);

    return true;
  });
};

const normalizedCollaboratorOptions = computed(() =>
  dedupePeopleRefs(collaboratorOptions.value),
);

const resolveDashboardPerson = (value: any) => {
  if (value && typeof value === "object" && value.name)
    return resolvePeopleSelection(
      value.id ?? value.employeeId ?? value.contactId ?? value.value,
      normalizedCollaboratorOptions.value,
      "Person",
    );

  return resolvePeopleSelection(value, normalizedCollaboratorOptions.value, "Person");
};

const normalizeDashboardPeople = (items: any[]) =>
  dedupePeopleRefs(
    (Array.isArray(items) ? items : [])
      .map((entry) => resolveDashboardPerson(entry))
      .filter((entry) => entry && entry.id),
  );

const formatDateTime = (value: any) => {
  if (!value) return "--";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const workScopeLabel = computed(() => (workScope.value === "week" ? "My Week" : "My Day"));

const workHeaders = [
  { title: "Description", key: "description", sortable: false },
  { title: "Collaborators", key: "collaborators", sortable: false },
  { title: "Type", key: "type", sortable: false },
  { title: "Time", key: "time", sortable: false },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const },
];

const workRows = computed(() => {
  const tasks = scopedTasks.value
    .filter((task: any) => isInSelectedScope(task.dueAt ?? task.date ?? task.startAt))
    .map((task: any) => ({
      id: `task-${task.id}`,
      sortAt: task.dueAt ?? task.date ?? task.startAt ?? "",
      description: task.title,
      subtitle: task.notes ?? task.note ?? "Task",
      collaborators: normalizeDashboardPeople(task.collaborators),
      type: "Task",
      typeColor: "primary",
      time: task.dueAt ? formatDateTime(task.dueAt) : "--",
      rawType: "task" as const,
      raw: task,
    }));

  const meetings = scopedMeetings.value
    .filter((meeting: any) => isInSelectedScope(meeting.startAt))
    .map((meeting: any) => ({
      id: `meeting-${meeting.id}`,
      sortAt: meeting.startAt,
      description: meeting.subject || meeting.title || "Meeting",
      subtitle: meeting.type || meeting.meetingType || "Meeting",
      collaborators: normalizeDashboardPeople(meeting.linkedTo),
      type: "Meeting",
      typeColor: "info",
      time: formatDateTime(meeting.startAt),
      rawType: "meeting" as const,
      raw: meeting,
    }));

  return [...tasks, ...meetings].sort(
    (a, b) => new Date(a.sortAt || 0).getTime() - new Date(b.sortAt || 0).getTime(),
  );
});

const financeRecordId = (record: any) => record?.quotation?.id;

const financeRevisionRootId = (record: any) =>
  record?.quotation?.parentQuotationId ?? financeRecordId(record);

const isLatestFinanceRevisionRecord = (record: any, records: any[]) => {
  const rootId = financeRevisionRootId(record);
  if (rootId === null || rootId === undefined || rootId === "") return true;

  const family = records.filter((candidate: any) => {
    const candidateId = financeRecordId(candidate);
    const candidateParentId = candidate?.quotation?.parentQuotationId;

    return (
      String(candidateId) === String(rootId) ||
      String(candidateParentId ?? "") === String(rootId)
    );
  });

  if (family.length <= 1) return true;

  const latest = family.reduce((currentLatest: any, candidate: any) =>
    Number(financeRecordId(candidate)) > Number(financeRecordId(currentLatest))
      ? candidate
      : currentLatest,
  );

  return String(financeRecordId(latest)) === String(financeRecordId(record));
};

const documentApprovalRows = computed(() => {
  const currentKeys = currentUserKeys.value;
  const buildRows = (records: any[], kind: "quotation" | "proforma" | "invoice") =>
    records
      .filter(
        (record: any) =>
          isLatestFinanceRevisionRecord(record, records) &&
          record.approvalMode === "Request Approval" &&
          record.approvalRequestedAt &&
          normalizeFinanceApprovalStatus(record) === "pending" &&
          (isSuperAdminUser.value ||
            matchesScope(record.approverEmployeeId, currentKeys)),
      )
      .map((record: any) => {
        const quotation = record.quotation ?? {};
        const documentLabel =
          kind === "quotation" ? "QT" : kind === "proforma" ? "PF" : "INV";
        const documentNumber =
          String(quotation.quoteNumber ?? "").trim() ||
          `${documentLabel}-${quotation.id}`;
        const clientName =
          String(quotation.client?.name ?? quotation.client?.company ?? "").trim() ||
          "Client";
        const serviceName = String(quotation.service ?? "").trim();
        const routeName =
          kind === "quotation"
            ? "apps-quotation-preview-id"
            : kind === "proforma"
              ? "apps-proforma-preview-id"
              : "apps-invoice-preview-id";

        return {
          id: `${kind}-${quotation.id}`,
          kind,
          title: `${documentLabel} ${documentNumber}`,
          requester: serviceName ? `${clientName} - ${serviceName}` : clientName,
          status: quotation.quotationStatus || "Approval",
          date: record.approvalRequestedAt,
          route: { name: routeName, params: { id: quotation.id } },
          action: "open" as const,
          recordId: quotation.id,
          raw: record,
        };
      });

  return [
    ...buildRows(quotationsStore.items, "quotation"),
    ...buildRows(proformasStore.items, "proforma"),
    ...buildRows(invoicesStore.items, "invoice"),
  ];
});

const ownDocumentRequests = computed(() => {
  const keys = currentUserKeys.value;
  const buildRows = (records: any[], kind: "quotation" | "proforma" | "invoice") =>
    records
      .filter((record: any) => {
        if (!record.approvalRequestedAt) return false;
        const possibleOwners = [
          record.salesperson,
          record.requestedBy,
          record.createdBy,
          record.quotation?.client?.name,
        ];

        return possibleOwners.some((owner) => matchesScope(owner, keys));
      })
      .map((record: any) => ({
        id: `doc-request-${kind}-${record.quotation?.id}`,
        type: kind,
        title: `${kind[0].toUpperCase()}${kind.slice(1)} ${record.quotation?.quoteNumber ?? record.quotation?.id}`,
        status: record.quotation?.quotationStatus ?? "Approval",
        date: record.approvalRequestedAt,
        owner: record.salesperson || "Finance",
        raw: record,
      }));

  return [
    ...buildRows(quotationsStore.all, "quotation"),
    ...buildRows(proformasStore.all, "proforma"),
    ...buildRows(invoicesStore.all, "invoice"),
  ];
});

const hrApprovalRows = computed(() => {
  const employees = isSuperAdminUser.value
    ? employeesStore.all
    : directReports.value.map(
        (person: any) =>
          employeesStore.byId(person.id) ??
          (person.legacyEmployeeId
            ? employeesStore.byId(person.legacyEmployeeId)
            : null) ??
          person,
      );

  return employees.flatMap((employee: any) =>
    (employee.requests ?? [])
      .filter((request: any) => String(request.status ?? "").toLowerCase() === "pending")
      .map((request: any) => ({
        id: `hr-approval-${employee.id}-${request.id}`,
        kind: "hr" as const,
        title: `${request.type ?? "HR"} request`,
        requester: employee.fullName ?? (employee as any).name ?? "Employee",
        status: request.status ?? "pending",
        date: request.createdAt ?? request.startDate ?? request.date ?? "",
        employeeId: employee.id,
        requestId: request.id,
      })),
  );
});

const approvalRows = computed(() => [
  ...(canApproveHr.value ? hrApprovalRows.value : []),
  ...(canApproveFinance.value ? documentApprovalRows.value : []),
]);

const canSeeApprovalPanel = computed(
  () => isAdminUser.value || canApproveHr.value || canApproveFinance.value,
);

const showNeedApproval = computed(() => canSeeApprovalPanel.value || approvalRows.value.length > 0);

const myRequestRows = computed(() =>
  [...ownRequests.value, ...ownDocumentRequests.value]
    .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 6),
);

const completedTodaysMeetings = computed(() =>
  todaysMeetings.value.filter((meeting: any) => isMeetingCompleted(meeting)),
);

const completionPercent = computed(() => {
  const tasks = scopedTasks.value;
  const meetings = scopedMeetings.value.filter((meeting: any) => !isMeetingCanceled(meeting));
  const total = tasks.length + meetings.length;
  if (!total) return 0;

  const completed =
    tasks.filter((task: any) => isTaskCompleted(task)).length +
    meetings.filter((meeting: any) => isMeetingCompleted(meeting)).length;

  return Math.round((completed / total) * 100);
});

const firstName = computed(() => {
  const name =
    (currentPerson.value as any)?.name ??
    currentPerson.value?.fullName ??
    identity.value.name ??
    "User";

  return String(name).trim().split(/\s+/)[0] || "User";
});

const statCards = computed(() => [
  {
    title: "Today's Tasks",
    value: `${openTodaysTasks.value.length}/${todaysTasks.value.length}`,
    hint:
      overdueTasks.value.length > 0
        ? `${overdueTasks.value.length} overdue`
        : "No overdue tasks",
    icon: "tabler-list-check",
    color: "primary",
  },
  {
    title: "Today's Meetings",
    value: String(todaysMeetings.value.length),
    hint: `${completedTodaysMeetings.value.length} completed`,
    icon: "tabler-calendar-event",
    color: "info",
  },
  {
    title: "Requests",
    value: String(scopedRequests.value.length),
    hint: canSeeTeam.value ? "Own + team" : "Own",
    icon: "tabler-file-text",
    color: "warning",
  },
]);

const totalActivities = computed(
  () => scopedTasks.value.length + scopedMeetings.value.length + scopedRequests.value.length,
);

const donutSeries = computed(() => {
  const todayCount = openTodaysTasks.value.length;
  const outstandingCount = overdueTasks.value.length;
  if (todayCount + outstandingCount <= 0) return [1];

  return [todayCount, outstandingCount];
});

const donutLabels = computed(() =>
  openTodaysTasks.value.length + overdueTasks.value.length <= 0
    ? ["No to-dos"]
    : ["Today's To Dos", "Outstanding To Dos"],
);

const timeSpendingChartConfig = computed(() => ({
  chart: {
    height: 157,
    width: 130,
    parentHeightOffset: 0,
    type: "donut",
  },
  labels: donutLabels.value,
  colors: [
    donutChartColors.donut.series1,
    donutChartColors.donut.series2,
    donutChartColors.donut.series3,
    donutChartColors.donut.series4,
    donutChartColors.donut.series5,
    donutChartColors.donut.series6,
  ],
  stroke: { width: 0 },
  dataLabels: { enabled: false },
  legend: { show: false },
  tooltip: {
    theme: false,
    y: {
      formatter: (value: number) => `${Math.round(value)} to-dos`,
    },
  },
  grid: { padding: { top: 0 } },
  plotOptions: {
    pie: {
      donut: {
        size: "75%",
        labels: {
          show: true,
          value: {
            fontSize: "1.125rem",
            color: "rgba(var(--v-theme-on-background), var(--v-high-emphasis-opacity))",
            fontWeight: 500,
            offsetY: -15,
            formatter: () => `${completionPercent.value}%`,
          },
          name: { offsetY: 20 },
          total: {
            show: true,
            fontSize: "15px",
            label: "Completed",
            color: "rgba(var(--v-theme-on-background), var(--v-disabled-opacity))",
            formatter: () => `${completionPercent.value}%`,
          },
        },
      },
    },
  },
}));

const employeeRequestTarget = computed(() => {
  const employee =
    currentEmployee.value ??
    (currentPerson.value?.id ? employeesStore.byId(currentPerson.value.id) : null);

  return employee;
});

const currentEmployeeName = computed(
  () =>
    employeeRequestTarget.value?.fullName ??
    (employeeRequestTarget.value as any)?.name ??
    identity.value.name ??
    "",
);

const currentEmployeeAvailableDays = computed(
  () => Number(employeeRequestTarget.value?.attendance?.vacation ?? 0),
);

const addCurrentEmployeeRequest = (type: string, payload: any) => {
  const employee = employeeRequestTarget.value;
  if (!employee?.id) {
    notifications.push("Could not find current employee profile", "error", 3500);

    return;
  }

  const created = employeesStore.addRequest(employee.id, {
    ...payload,
    type,
    createdAt: new Date().toISOString(),
    status: "pending",
  });

  if (created) notifications.push(`${type} request submitted`, "success", 3500);
  else notifications.push(`Could not submit ${type.toLowerCase()} request`, "error", 3500);
};

const submitLeave = (payload: any) => {
  addCurrentEmployeeRequest("Leave", payload);
  selectedLeaveData.value = null;
  isLeaveDrawerOpen.value = false;
};

const submitAddition = (payload: any) => {
  addCurrentEmployeeRequest("Addition", payload);
  selectedAdditionData.value = null;
  isAdditionDrawerOpen.value = false;
};

const submitDeduction = (payload: any) => {
  addCurrentEmployeeRequest("Deduction", payload);
  selectedDeductionData.value = null;
  isDeductionDrawerOpen.value = false;
};

const submitAdvance = (payload: any) => {
  addCurrentEmployeeRequest("Advance", payload);
  selectedAdvanceData.value = null;
  isAdvanceDrawerOpen.value = false;
};

const submitTimeAuLieu = (payload: any) => {
  addCurrentEmployeeRequest("Time au Lieu", payload);
  selectedTimeAuLieuData.value = null;
  isTimeAuLieuDrawerOpen.value = false;
};

const openRequestDrawer = (type: DashboardRequestType) => {
  isRequestPickerOpen.value = false;
  selectedAdditionData.value = null;
  selectedDeductionData.value = null;
  selectedAdvanceData.value = null;
  selectedTimeAuLieuData.value = null;

  if (type === "Addition") isAdditionDrawerOpen.value = true;
  if (type === "Deduction") isDeductionDrawerOpen.value = true;
  if (type === "Advance") isAdvanceDrawerOpen.value = true;
  if (type === "Time au Lieu") isTimeAuLieuDrawerOpen.value = true;
};

const currentAuthor = computed(() => ({
  id: identity.value.personId ?? identity.value.employeeId ?? identity.value.id,
  employeeId: identity.value.employeeId ?? undefined,
  personId: identity.value.personId ?? undefined,
  name: identity.value.name,
  email: identity.value.email ?? undefined,
  avatarUrl: identity.value.avatarUrl ?? undefined,
}));

const openTaskEdit = (task: any) => {
  editingTodo.value = task;
  isEditTodoDrawerOpen.value = true;
};

const saveEditedTask = (payload: any) => {
  todosStore.updateTodo(payload.id, payload);
  notifications.push("Task updated", "success", 2500);
};

const saveTaskSteps = (payload: any) => {
  todosStore.updateTodo(payload.id, { steps: payload.steps } as any);
  notifications.push("Subtasks updated", "success", 2500);
};

const openRowCollaboratorDialog = (item: any) => {
  rowCollaboratorTarget.value = {
    type: item.rawType === "meeting" ? "meeting" : "task",
    record: item.raw,
  };
  rowCollaboratorValue.value = normalizeDashboardPeople(item.collaborators).map(
    (collaborator: any) => collaborator.id,
  );
  isRowCollaboratorDialogVisible.value = true;
};

const saveRowCollaborators = () => {
  const target = rowCollaboratorTarget.value;
  if (!target) return;

  const selected = normalizeDashboardPeople(
    rowCollaboratorValue.value.map((id) => resolveDashboardPerson(id)),
  );

  if (target.type === "meeting") {
    todosStore.updateMeeting(target.record.id, { linkedTo: selected } as any);
    notifications.push("Meeting attendees updated", "success", 2500);
  } else {
    todosStore.updateTodo(target.record.id, { collaborators: selected } as any);
    notifications.push("Task collaborators updated", "success", 2500);
  }

  rowCollaboratorTarget.value = null;
  rowCollaboratorValue.value = [];
  isRowCollaboratorDialogVisible.value = false;
};

const openTaskMessages = (task: any) => {
  messageDrawerTodo.value = task;
  isMessageDrawerOpen.value = true;
};

const addMessageToTodo = (payload: any) => {
  const todo = todosStore.byId(payload.id);
  const body = String(payload.body ?? "").trim();
  if (!todo || !body) return;

  const messages = Array.isArray((todo as any).messages)
    ? [...(todo as any).messages]
    : [];
  messages.push({
    id: payload.messageId ?? Date.now(),
    author: payload.author ?? currentAuthor.value,
    body,
    createdAt: new Date().toISOString(),
    isRead: true,
    editedAt: null,
  });
  todosStore.updateTodo(payload.id, { messages } as any);
  notifications.push("Message added", "success", 2500);
};

const editTodoMessage = (payload: any) => {
  const todo = todosStore.byId(payload.id);
  if (!todo) return;
  const body = String(payload.body ?? "").trim();
  if (!body) return;
  const messages = Array.isArray((todo as any).messages)
    ? (todo as any).messages.map((message: any) =>
        String(message.id) === String(payload.messageId)
          ? { ...message, body, editedAt: new Date().toISOString() }
          : message,
      )
    : [];
  todosStore.updateTodo(payload.id, { messages } as any);
  notifications.push("Message updated", "success", 2500);
};

const toggleTodoMessageRead = (payload: any) => {
  const todo = todosStore.byId(payload.id);
  if (!todo) return;
  const messages = Array.isArray((todo as any).messages)
    ? (todo as any).messages.map((message: any) =>
        String(message.id) === String(payload.messageId)
          ? { ...message, isRead: payload.isRead }
          : message,
      )
    : [];
  todosStore.updateTodo(payload.id, { messages } as any);
};

const openMeetingMinutes = (meeting: any) => {
  router.push({ name: "apps-meetings-id-minutes", params: { id: meeting.id } });
};

const openMeetingEdit = async (meeting: any) => {
  editingMeeting.value = meeting;
  isMeetingDrawerOpen.value = true;
  await nextTick();
  addMeetingRef.value?.openWith?.({
    ...meeting,
    drawerTitle: "Edit Meeting",
    title: meeting.subject,
    start: meeting.startAt,
    initialStart: meeting.startAt,
    durationMins: meeting.duration,
    meetingType: meeting.type,
    notes: meeting.note,
  });
};

const saveMeeting = (payload: NewMeetingPayload) => {
  if (editingMeeting.value?.id) {
    todosStore.updateMeeting(editingMeeting.value.id, {
      subject: payload.subject || payload.title,
      title: payload.title,
      startAt: payload.startAt || payload.start,
      start: payload.start,
      end: payload.end,
      duration: payload.duration ?? payload.durationMins,
      durationMins: payload.durationMins,
      type: payload.type || payload.meetingType,
      meetingType: payload.meetingType,
      linkedTo: payload.linkedTo,
      attendees: payload.attendees,
      relatedTo: payload.relatedTo ?? null,
      relatedToMany: payload.relatedToMany ?? [],
      location: payload.location,
      note: payload.note || payload.notes,
      notes: payload.notes,
    } as any);
    notifications.push("Meeting updated", "success", 2500);
  } else {
    todosStore.addMeeting(payload as any);
    notifications.push("Meeting created", "success", 2500);
  }
  editingMeeting.value = null;
  isMeetingDrawerOpen.value = false;
};

const openDocumentApproval = (row: any) => {
  if (row.route) router.push(row.route);
};

const approveHrRequest = (row: any) => {
  employeesStore.updateRequest(row.employeeId, row.requestId, {
    status: "approved",
    approvedBy: identity.value.employeeId ?? identity.value.personId ?? identity.value.id,
    approvedAt: new Date().toISOString(),
  } as any);
  notifications.push("Request approved", "success", 2500);
};

const rejectHrRequest = (row: any) => {
  employeesStore.updateRequest(row.employeeId, row.requestId, {
    status: "rejected",
    rejectedBy: identity.value.employeeId ?? identity.value.personId ?? identity.value.id,
    rejectedAt: new Date().toISOString(),
  } as any);
  notifications.push("Request rejected", "success", 2500);
};

const currentApproverId = computed(
  () => identity.value.employeeId ?? identity.value.personId ?? identity.value.id,
);

const cancelOlderApprovedFinanceVersions = (kind: string, updated: any) => {
  const records =
    kind === "quotation"
      ? quotationsStore.all
      : kind === "proforma"
        ? proformasStore.all
        : invoicesStore.all;

  cancelOlderFinanceFamilyVersions(
    records.map((record: any) => record.quotation),
    updated.quotation,
    (quotation: any) => {
      const patch = { quotation: { quotationStatus: "Canceled" } } as any;

      if (kind === "quotation") quotationsStore.updateQuotation(quotation.id, patch);
      else if (kind === "proforma") proformasStore.updateProforma(quotation.id, patch);
      else invoicesStore.updateInvoice(quotation.id, patch);
    },
  );
};

const approveFinanceApproval = (row: any) => {
  const patch = {
    approvalStatus: "approved",
    approvalApprovedAt: new Date().toISOString(),
    approvalApprovedBy: currentApproverId.value,
    approvalRejectedAt: null,
    approvalRejectedBy: null,
  } as any;
  const updated =
    row.kind === "quotation"
      ? quotationsStore.updateQuotation(row.recordId, patch)
      : row.kind === "proforma"
        ? proformasStore.updateProforma(row.recordId, patch)
        : invoicesStore.updateInvoice(row.recordId, patch);

  if (updated) {
    cancelOlderApprovedFinanceVersions(row.kind, updated);
    dismissFinanceApprovalRequestNotifications(row.kind, updated);
    notifyFinanceApprovalDecision(row.kind, updated, "approved");
    notifications.push("Finance document approved", "success", 2500);
  } else notifications.push("Unable to approve finance document", "error", 3000);
};

const declineFinanceApproval = (row: any) => {
  const patch = {
    approvalStatus: "rejected",
    approvalRejectedAt: new Date().toISOString(),
    approvalRejectedBy: currentApproverId.value,
    approvalApprovedAt: null,
    approvalApprovedBy: null,
  } as any;
  const updated =
    row.kind === "quotation"
      ? quotationsStore.updateQuotation(row.recordId, patch)
      : row.kind === "proforma"
        ? proformasStore.updateProforma(row.recordId, patch)
        : invoicesStore.updateInvoice(row.recordId, patch);

  if (updated) {
    dismissFinanceApprovalRequestNotifications(row.kind, updated);
    notifyFinanceApprovalDecision(row.kind, updated, "rejected");
    notifications.push("Finance document declined", "success", 2500);
  } else notifications.push("Unable to decline finance document", "error", 3000);
};

const activityTimelineRows = computed(() => {
  const taskActivities = scopedTasks.value.map((task: any) => ({
    id: `task-${task.id}`,
    kind: "todo",
    title: task.title,
    body: task.notes ?? task.note ?? (task.status === "completed" ? "Task completed" : "Task due"),
    chip: "To Do",
    collaborators: normalizeDashboardPeople(task.collaborators),
    date: task.updatedAt ?? task.dueAt ?? task.createdAt ?? "",
    color: task.status === "completed" ? "success" : "primary",
  }));

  const meetingActivities = scopedMeetings.value.map((meeting: any) => ({
    id: `meeting-${meeting.id}`,
    kind: "meeting",
    title: meeting.subject || "Meeting",
    body: meeting.status || meeting.type || "Meeting",
    chip: "Meeting",
    collaborators: normalizeDashboardPeople(meeting.linkedTo),
    date: meeting.updatedAt ?? meeting.startAt ?? "",
    color: "success",
  }));

  const requestActivities = scopedRequests.value.map((request: any) => ({
    id: `request-${request.employeeId}-${request.id}`,
    kind: "request",
    title: `${request.employeeName} · ${request.type}`,
    body: `Status: ${request.status ?? "pending"}`,
    chip: "Request",
    collaborators: [],
    date: request.createdAt ?? request.startDate ?? request.date ?? "",
    color:
      request.status === "approved"
        ? "success"
        : request.status === "rejected"
          ? "error"
          : "warning",
  }));

  const approvalActivities = approvalRows.value.map((approval: any) => ({
    id: `approval-${approval.id}`,
    kind: "approval",
    title: approval.title,
    body: `Needs approval · ${approval.requester}`,
    chip: "Approval",
    collaborators: [],
    date: approval.date,
    color: approval.kind === "hr" ? "warning" : "info",
  }));

  return [
    ...taskActivities,
    ...meetingActivities,
    ...requestActivities,
    ...approvalActivities,
  ]
    .filter((entry) => entry.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12);
});

const requestStatusColor = (status: unknown) => {
  const normalized = normalizeKey(status);
  if (normalized === "approved" || normalized === "completed") return "success";
  if (normalized === "rejected" || normalized === "cancelled" || normalized === "canceled") return "error";
  if (normalized === "pending") return "warning";

  return "secondary";
};

const timelineChipColor = (kind: string) => {
  if (kind === "meeting") return "success";
  if (kind === "todo") return "warning";
  if (kind === "request") return "primary";
  if (kind === "approval") return "info";

  return "secondary";
};

const personLabel = (person: any) => {
  const resolved = resolveDashboardPerson(person);

  return String(
    resolved?.name ?? person?.name ?? person?.fullName ?? person?.title ?? person?.email ?? "User",
  );
};

const personAvatar = (person: any) => {
  const resolved = resolveDashboardPerson(person);

  return resolved?.avatarUrl ?? person?.avatarUrl ?? person?.avatar ?? person?.photo ?? person?.image ?? null;
};

</script>

<template>
  <div>
    <VRow class="py-6">
      <VCol
        cols="12"
        md="8"
        :class="$vuetify.display.mdAndUp ? 'border-e' : 'border-b'"
      >
        <div class="pe-3">
            <div class="d-flex flex-wrap justify-space-between gap-4">
              <div>
                <h5 class="text-h5 mb-2">
                  Welcome back, <span class="text-h4">{{ firstName }} 👋🏻 </span>
                </h5>

                <div
                  class="text-wrap text-body-1"
                  style="max-inline-size: 420px;"
                >
                  {{ canSeeTeam ? "Your team dashboard for today." : "Your operational dashboard for today." }}
                </div>
              </div>

              <div class="d-flex flex-wrap gap-3 align-start">
                <VBtn
                  color="primary"
                  prepend-icon="tabler-calendar-plus"
                  @click="isLeaveDrawerOpen = true"
                >
                  Leave Requests
                </VBtn>
                <VBtn
                  color="secondary"
                  variant="tonal"
                  prepend-icon="tabler-forms"
                  @click="isRequestPickerOpen = true"
                >
                  Other Requests
                </VBtn>
              </div>
            </div>

            <div class="d-flex justify-space-between flex-wrap gap-4 mt-5">
              <div
                v-for="stat in statCards"
                :key="stat.title"
                class="dashboard-stat"
              >
                <div class="d-flex align-center">
                  <VAvatar
                    variant="tonal"
                    :color="stat.color"
                    rounded
                    size="54"
                    class="me-4"
                  >
                    <VIcon
                      :icon="stat.icon"
                      size="34"
                    />
                  </VAvatar>
                  <div>
                    <h6 class="text-h6 text-medium-emphasis">
                      {{ stat.title }}
                    </h6>
                    <div class="d-flex align-end gap-2">
                      <h4
                        class="text-h4"
                        :class="`text-${stat.color}`"
                      >
                        {{ stat.value }}
                      </h4>
                      <span class="text-caption text-medium-emphasis pb-1">
                        {{ stat.hint }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </VCol>

      <VCol
        cols="12"
        md="4"
      >
        <div class="d-flex justify-space-between align-center">
          <div class="d-flex flex-column ps-3">
            <h5 class="text-h5 mb-1 text-no-wrap">
              Total Activities
            </h5>
            <div class="text-body-1 mb-7">
              Tasks, meetings, requests
            </div>
            <h4 class="text-h4 mb-2">
              {{ totalActivities }}
            </h4>
            <div>
              <VChip
                color="success"
                label
                size="small"
              >
                {{ completionPercent }}% completed
              </VChip>
            </div>
          </div>
          <div>
            <VueApexCharts
              type="donut"
              height="150"
              width="150"
              :options="timeSpendingChartConfig"
              :series="donutSeries"
            />
          </div>
        </div>
      </VCol>
    </VRow>

    <VRow class="dashboard-workspace align-stretch">
      <VCol
        cols="12"
        sm="8"
        md="8"
      >
        <div ref="dashboardLeftStackRef">
          <VCard class="mb-6">
            <VCardItem>
              <div class="d-flex flex-wrap align-center justify-space-between gap-3">
                <div>
                  <VMenu>
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        variant="text"
                        class="px-0 text-h5 font-weight-medium"
                        append-icon="tabler-chevron-down"
                      >
                        {{ workScopeLabel }}
                      </VBtn>
                    </template>
                    <VList density="compact">
                      <VListItem
                        title="My Day"
                        value="day"
                        @click="workScope = 'day'"
                      />
                      <VListItem
                        title="My Week"
                        value="week"
                        @click="workScope = 'week'"
                      />
                    </VList>
                  </VMenu>
                  <VCardSubtitle>Tasks and meetings in scope</VCardSubtitle>
                </div>
              </div>
            </VCardItem>

            <VDataTable
              :headers="workHeaders"
              :items="workRows"
              :items-per-page="5"
              density="comfortable"
              class="dashboard-work-table"
            >
            <template #item.description="{ item }">
              <div class="py-2">
                <div class="font-weight-medium text-high-emphasis text-truncate">
                  {{ item.description }}
                </div>
                <div class="text-caption text-medium-emphasis text-truncate">
                  {{ item.subtitle }}
                </div>
              </div>
            </template>

            <template #item.collaborators="{ item }">
              <div class="dashboard-collaborators-cell d-flex align-center gap-1">
                <div
                  v-if="item.collaborators.length"
                  class="v-avatar-group demo-avatar-group"
                >
                  <template
                    v-for="collaborator in item.collaborators.slice(0, 3)"
                    :key="`${item.id}-${personCanonicalKey(collaborator)}`"
                  >
                    <VAvatar
                      :size="32"
                      :color="personAvatar(collaborator) ? undefined : 'primary'"
                      :class="personAvatar(collaborator) ? undefined : 'text-white font-weight-medium'"
                    >
                      <template v-if="personAvatar(collaborator)">
                        <VImg :src="personAvatar(collaborator)" />
                      </template>
                      <template v-else>
                        <span>{{ personLabel(collaborator).slice(0, 2).toUpperCase() }}</span>
                      </template>
                      <VTooltip activator="parent" location="top">
                        {{ personLabel(collaborator) }}
                      </VTooltip>
                    </VAvatar>
                  </template>

                  <VAvatar
                    v-if="item.collaborators.length > 3"
                    :size="32"
                    color="secondary"
                    class="font-weight-medium text-white"
                  >
                    +{{ item.collaborators.length - 3 }}
                    <VTooltip activator="parent" location="top">
                      {{
                        item.collaborators
                          .slice(3)
                          .map((collaborator: any) => personLabel(collaborator))
                          .join(", ")
                      }}
                    </VTooltip>
                  </VAvatar>
                </div>

                <span
                  v-else
                  class="text-medium-emphasis"
                >-</span>
                <IconBtn
                  @click.stop="openRowCollaboratorDialog(item)"
                >
                  <VIcon icon="tabler-plus" />
                  <VTooltip activator="parent" location="top">
                    Add or remove collaborators
                  </VTooltip>
                </IconBtn>
              </div>
            </template>

            <template #item.type="{ item }">
              <VChip
                :color="item.typeColor"
                size="small"
                label
              >
                {{ item.type }}
              </VChip>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex justify-end gap-1">
                <template v-if="item.rawType === 'task'">
                  <VTooltip text="Edit task">
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        color="secondary"
                        @click="openTaskEdit(item.raw)"
                      >
                        <VIcon icon="tabler-edit" />
                      </VBtn>
                    </template>
                  </VTooltip>
                  <VTooltip text="Messages">
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        color="secondary"
                        @click="openTaskMessages(item.raw)"
                      >
                        <VIcon icon="tabler-message-circle" />
                      </VBtn>
                    </template>
                  </VTooltip>
                </template>

                <template v-else>
                  <VTooltip text="Minutes of Meeting">
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        color="secondary"
                        @click="openMeetingMinutes(item.raw)"
                      >
                        <VIcon icon="tabler-notes" />
                      </VBtn>
                    </template>
                  </VTooltip>
                  <VTooltip text="Edit meeting">
                    <template #activator="{ props }">
                      <VBtn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        color="secondary"
                        @click="openMeetingEdit(item.raw)"
                      >
                        <VIcon icon="tabler-edit" />
                      </VBtn>
                    </template>
                  </VTooltip>
                </template>
              </div>
            </template>
            </VDataTable>
          </VCard>

          <VRow>
          <VCol
            cols="12"
            :md="showNeedApproval ? 6 : 12"
          >
            <VCard class="h-100">
              <VCardItem>
                <VCardTitle>My Requests</VCardTitle>
                <VCardSubtitle>Requests and approvals you started</VCardSubtitle>
              </VCardItem>
              <VDivider />
              <VList
                v-if="myRequestRows.length"
                lines="two"
                class="py-0"
              >
                <VListItem
                  v-for="request in myRequestRows"
                  :key="request.id"
                  :title="request.title"
                  :subtitle="request.date ? formatSystemDate(request.date) : request.owner"
                >
                  <template #prepend>
                    <VAvatar
                      rounded
                      variant="tonal"
                      color="primary"
                    >
                      <VIcon icon="tabler-file-text" />
                    </VAvatar>
                  </template>
                  <template #append>
                    <VChip
                      :color="requestStatusColor(request.status)"
                      size="small"
                      label
                    >
                      {{ request.status }}
                    </VChip>
                  </template>
                </VListItem>
              </VList>
              <VCardText
                v-else
                class="text-medium-emphasis"
              >
                No requests found.
              </VCardText>
            </VCard>
          </VCol>

          <VCol
            v-if="showNeedApproval"
            cols="12"
            md="6"
          >
            <VCard class="h-100">
              <VCardItem>
                <VCardTitle>Need Approval</VCardTitle>
                <VCardSubtitle>Systemwide approvals assigned to you</VCardSubtitle>
              </VCardItem>
              <VDivider />
              <VList
                v-if="approvalRows.length"
                lines="two"
                class="py-0"
              >
                <VListItem
                  v-for="approval in approvalRows"
                  :key="approval.id"
                  :title="approval.title"
                  :subtitle="`${approval.requester} · ${approval.date ? formatSystemDate(approval.date) : 'Pending'}`"
                >
                  <template #prepend>
                    <VAvatar
                      rounded
                      variant="tonal"
                      :color="approval.kind === 'hr' ? 'warning' : 'info'"
                    >
                      <VIcon
                        :icon="approval.kind === 'hr' ? 'tabler-user-check' : 'tabler-file-invoice'"
                      />
                    </VAvatar>
                  </template>

                  <template #append>
                    <div class="d-flex align-center gap-1">
                      <template v-if="approval.kind === 'hr'">
                        <VBtn
                          icon
                          size="small"
                          variant="text"
                          color="success"
                          @click="approveHrRequest(approval)"
                        >
                          <VIcon icon="tabler-check" />
                        </VBtn>
                        <VBtn
                          icon
                          size="small"
                          variant="text"
                          color="error"
                          @click="rejectHrRequest(approval)"
                        >
                          <VIcon icon="tabler-x" />
                        </VBtn>
                      </template>

                      <template v-else>
                        <VTooltip text="Approve">
                          <template #activator="{ props: tooltipProps }">
                            <VBtn
                              v-bind="tooltipProps"
                              icon
                              size="small"
                              variant="text"
                              color="success"
                              @click="approveFinanceApproval(approval)"
                            >
                              <VIcon icon="tabler-check" />
                            </VBtn>
                          </template>
                        </VTooltip>
                        <VTooltip text="Decline">
                          <template #activator="{ props: tooltipProps }">
                            <VBtn
                              v-bind="tooltipProps"
                              icon
                              size="small"
                              variant="text"
                              color="error"
                              @click="declineFinanceApproval(approval)"
                            >
                              <VIcon icon="tabler-x" />
                            </VBtn>
                          </template>
                        </VTooltip>
                        <VTooltip text="Open">
                          <template #activator="{ props: tooltipProps }">
                            <VBtn
                              v-bind="tooltipProps"
                              icon
                              size="small"
                              variant="text"
                              color="info"
                              @click="openDocumentApproval(approval)"
                            >
                              <VIcon icon="tabler-external-link" />
                            </VBtn>
                          </template>
                        </VTooltip>
                      </template>
                    </div>
                  </template>
                </VListItem>
              </VList>
              <VCardText
                v-else
                class="text-medium-emphasis"
              >
                No approvals currently assigned.
              </VCardText>
            </VCard>
          </VCol>
          </VRow>
        </div>
      </VCol>

      <VCol
        cols="12"
        sm="4"
        md="4"
        class="dashboard-timeline-col"
      >
        <VCard
          ref="dashboardTimelineCardRef"
          class="dashboard-timeline-card"
          :style="dashboardTimelineStyle"
        >
          <VCardItem>
            <VCardTitle>Activity Timeline</VCardTitle>
            <VCardSubtitle>{{ canSeeTeam ? "Own and team activity" : "Your activity" }}</VCardSubtitle>
          </VCardItem>
          <VCardText class="dashboard-timeline-body">
            <VTimeline
              v-if="activityTimelineRows.length"
              side="end"
              align="start"
              line-inset="8"
              truncate-line="start"
              density="compact"
            >
              <VTimelineItem
                v-for="activity in activityTimelineRows"
                :key="activity.id"
                :dot-color="activity.color"
                size="x-small"
              >
                <div class="d-flex justify-space-between align-start gap-2 mb-2">
                  <div class="dashboard-timeline-heading">
                    <span class="app-timeline-title">{{ activity.title }}</span>
                    <VChip
                      size="small"
                      class="timeline-chip"
                      :color="timelineChipColor(activity.kind)"
                      density="compact"
                    >
                      {{ activity.chip }}
                    </VChip>
                  </div>
                  <span class="app-timeline-meta">{{ formatSystemDate(activity.date) }}</span>
                </div>
                <div class="app-timeline-text mt-1">
                  {{ activity.body }}
                </div>
                <div
                  v-if="activity.collaborators.length"
                  class="v-avatar-group demo-avatar-group mt-2"
                >
                  <template
                    v-for="collaborator in activity.collaborators.slice(0, 4)"
                    :key="`${activity.id}-${personCanonicalKey(collaborator)}`"
                  >
                    <VTooltip location="top">
                      <template #activator="{ props }">
                        <VAvatar
                          v-bind="props"
                          :size="32"
                          :color="personAvatar(collaborator) ? undefined : 'primary'"
                          :class="personAvatar(collaborator) ? undefined : 'text-white font-weight-medium'"
                        >
                          <template v-if="personAvatar(collaborator)">
                            <VImg :src="personAvatar(collaborator)" />
                          </template>
                          <template v-else>
                            <span>{{ personLabel(collaborator).slice(0, 2).toUpperCase() }}</span>
                          </template>
                        </VAvatar>
                      </template>
                      {{ personLabel(collaborator) }}
                    </VTooltip>
                  </template>
                  <VAvatar
                    v-if="activity.collaborators.length > 4"
                    :size="32"
                    color="secondary"
                    class="font-weight-medium text-white"
                  >
                    +{{ activity.collaborators.length - 4 }}
                  </VAvatar>
                </div>
              </VTimelineItem>
            </VTimeline>
            <div
              v-else
              class="text-medium-emphasis"
            >
              No activity in scope.
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog
      v-model="isRequestPickerOpen"
      max-width="520"
    >
      <VCard>
        <VCardItem>
          <VCardTitle>Other Requests</VCardTitle>
          <VCardSubtitle>Select a request type for {{ currentEmployeeName || "current user" }}.</VCardSubtitle>
        </VCardItem>
        <VCardText>
          <VRow>
            <VCol
              v-for="requestType in requestTypes"
              :key="requestType"
              cols="12"
              sm="6"
            >
              <VBtn
                block
                variant="tonal"
                color="primary"
                @click="openRequestDrawer(requestType)"
              >
                {{ requestType }}
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VDialog>

    <VDialog
      v-model="isRowCollaboratorDialogVisible"
      max-width="560"
    >
      <DialogCloseBtn @click="isRowCollaboratorDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>
          {{ rowCollaboratorTarget?.type === "meeting" ? "Meeting attendees" : "Task collaborators" }}
        </VCardTitle>
        <VCardText>
          <AppSelect
            v-model="rowCollaboratorValue"
            label="Collaborators"
            placeholder="Select people"
            :items="normalizedCollaboratorOptions"
            item-title="name"
            item-value="id"
            multiple
            chips
            closable-chips
            clearable
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isRowCollaboratorDialogVisible = false"
          >
            Close
          </VBtn>
          <VBtn
            color="primary"
            @click="saveRowCollaborators"
          >
            Save
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VOverlay
      v-model="isLeaveDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddLeaveDrawer
      v-model:is-drawer-open="isLeaveDrawerOpen"
      :employee-name="currentEmployeeName"
      :available-days="currentEmployeeAvailableDays"
      :leave-data="selectedLeaveData"
      @submit="submitLeave"
      @close="selectedLeaveData = null"
    />

    <VOverlay
      v-model="isAdditionDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdditionsDrawer
      v-model:is-drawer-open="isAdditionDrawerOpen"
      :addition-data="selectedAdditionData"
      @submit="submitAddition"
      @close="selectedAdditionData = null"
    />

    <VOverlay
      v-model="isDeductionDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddDeductionDrawer
      v-model:is-drawer-open="isDeductionDrawerOpen"
      :deduction-data="selectedDeductionData"
      @submit="submitDeduction"
      @close="selectedDeductionData = null"
    />

    <VOverlay
      v-model="isAdvanceDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddAdvancesDrawer
      v-model:is-drawer-open="isAdvanceDrawerOpen"
      :advance-data="selectedAdvanceData"
      @submit="submitAdvance"
      @close="selectedAdvanceData = null"
    />

    <VOverlay
      v-model="isTimeAuLieuDrawerOpen"
      scrim="rgba(17, 24, 39, 0.72)"
      :z-index="1995"
    />
    <AddTimeAuLieuDrawer
      v-model:is-drawer-open="isTimeAuLieuDrawerOpen"
      :time-au-lieu-data="selectedTimeAuLieuData"
      @submit="submitTimeAuLieu"
      @close="selectedTimeAuLieuData = null"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerOpen"
      :todo="editingTodo"
      :collaborators-options="normalizedCollaboratorOptions"
      @save="saveEditedTask"
      @save-steps="saveTaskSteps"
    />

    <MessageDrawer
      v-model:is-drawer-open="isMessageDrawerOpen"
      :todo="messageDrawerTodo"
      :author="currentAuthor"
      @send="addMessageToTodo"
      @edit-message="editTodoMessage"
      @toggle-read="toggleTodoMessageRead"
    />

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model="isMeetingDrawerOpen"
      @save="saveMeeting"
      @cancel="editingMeeting = null"
    />
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/libs/apex-chart.scss";

.dashboard-stat {
  min-inline-size: 210px;
}

.dashboard-workspace {
  .dashboard-work-table {
    overflow: hidden;

    .v-table__wrapper {
      overflow-x: hidden;
    }

    table {
      inline-size: 100%;
      table-layout: fixed;
    }

    .v-data-table__td,
    .v-data-table__th {
      overflow: hidden;
      padding-inline: 1rem;
      white-space: nowrap;
    }

    .v-data-table__td:nth-child(1),
    .v-data-table__th:nth-child(1) {
      inline-size: 36%;
    }

    .v-data-table__td:nth-child(2),
    .v-data-table__th:nth-child(2) {
      inline-size: 20%;
    }

    .v-data-table__td:nth-child(3),
    .v-data-table__th:nth-child(3) {
      inline-size: 11%;
    }

    .v-data-table__td:nth-child(4),
    .v-data-table__th:nth-child(4) {
      inline-size: 21%;
    }

    .v-data-table__td:nth-child(5),
    .v-data-table__th:nth-child(5) {
      inline-size: 12%;
    }

    .v-data-table__td:first-child {
      white-space: normal;
    }
  }

  .dashboard-collaborators-cell {
    min-inline-size: 0;
    overflow: hidden;

    .v-avatar-group {
      flex: 0 1 auto;
      min-inline-size: 0;
      max-inline-size: calc(100% - 2rem);
    }

    .v-avatar {
      border: 2px solid rgb(var(--v-theme-surface));
    }
  }

  .dashboard-timeline-col {
    display: flex;
    min-block-size: 0;
  }

  .dashboard-timeline-card {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    inline-size: 100%;
    min-block-size: 0;
    overflow: hidden;
  }

  .dashboard-timeline-body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding-block-start: 0.5rem;
    scrollbar-color: rgba(var(--v-theme-on-surface), 0.28) transparent;
    scrollbar-width: thin;

    &::-webkit-scrollbar {
      inline-size: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background-color: rgba(var(--v-theme-on-surface), 0.28);
    }
  }

  .app-timeline-title,
  .app-timeline-text {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
  }

  .app-timeline-title {
    -webkit-line-clamp: 2;
  }

  .dashboard-timeline-heading {
    display: flex;
    min-inline-size: 0;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .timeline-chip {
    max-inline-size: 100%;
    flex: 0 0 auto;
  }

  .app-timeline-text {
    -webkit-line-clamp: 3;
  }

  @media (max-height: 820px) {
    .dashboard-timeline-card {
      max-block-size: clamp(12rem, calc(100vh - 24rem), 29rem);
    }
  }

  @media (max-height: 700px) {
    .dashboard-timeline-card {
      max-block-size: clamp(10rem, calc(100vh - 21rem), 23rem);
    }
  }

  @media (max-width: 767.98px) {
    .dashboard-timeline-card {
      block-size: auto;
      max-block-size: clamp(18rem, calc(100vh - 12rem), 34rem);
    }
  }
}
</style>
