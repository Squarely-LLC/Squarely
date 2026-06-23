<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from "vue";

import type { ToDo } from "@/data/schema";
import type {
  JobFlag,
  JobProperties,
  JobStatus,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { getContactAndEmployeeRefs, getEmployeeOptions } from "@/utils/peopleOptions";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import AddJobDialog from "@/views/operations/jobs/list/AddJobDialog.vue";
import JobEditDialog from "@/views/operations/jobs/list/JobEditDialog.vue";

type SortKey =
  | "jobOrderNumber"
  | "code"
  | "name"
  | "createdAt"
  | "status"
  | "type"
  | "flag";
type SortOrder = "asc" | "desc";

type DecoratedStakeholder = {
  id: number;
  name: string;
  role: string;
  avatar: string | null;
  isPrimary: boolean;
};

const jobsStore = useJobsStore();
jobsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const notifications = useNotificationsStore();
const todosStore = useTodos();
todosStore.init();
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isAddMeetingOpen = ref(false);
const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);

const searchQuery = ref("");
const selectedStatus = ref<string | undefined>();
const selectedType = ref<string | undefined>();
const selectedFlag = ref<string | undefined>();

const sortOptions: {
  title: string;
  value: { key: SortKey; order: SortOrder };
}[] = [
  { title: "Job Order (A-Z)", value: { key: "jobOrderNumber", order: "asc" } },
  { title: "Project Code (A-Z)", value: { key: "code", order: "asc" } },
  { title: "Name (A-Z)", value: { key: "name", order: "asc" } },
  { title: "Recently Added", value: { key: "createdAt", order: "desc" } },
  { title: "Oldest", value: { key: "createdAt", order: "asc" } },
];

const selectedSort = ref(sortOptions[2].value);
const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<SortKey | undefined>(selectedSort.value?.key);
const orderBy = ref<SortOrder | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

const headers = [
  { title: "Job Order Number", key: "jobOrderNumber" },
  { title: "Project Code", key: "code" },
  { title: "Description", key: "description", sortable: false },
  { title: "Delivery Date", key: "deliveryDate", sortable: false },
  { title: "Progress", key: "progress", sortable: false },
  { title: "Collaborators", key: "collaborators", sortable: false },
  { title: "Status", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];

const configStore = useConfigStore();
configStore.init();

const statusOptions = computed(() => {
  const statuses = configStore.configurations?.crm?.jobStatuses || [
    "New",
    "Pending",
    "In Progress",
    "On Hold",
    "Completed",
    "Closed",
  ];
  return statuses.map((s) => ({ title: s, value: s }));
});

const typeOptions = [
  { title: "Architecture", value: "Architecture" },
  { title: "Interior", value: "Interior" },
  { title: "Architecture & Interior", value: "Architecture & Interior" },
  { title: "Stands & Events", value: "Stands & Events" },
  { title: "Master Plan", value: "Master Plan" },
  { title: "Full Scope", value: "Full Scope" },
  { title: "Internal", value: "Internal" },
  { title: "Other", value: "Other" },
];

const flagOptions = [
  { title: "Normal", value: "Normal" },
  { title: "High", value: "High" },
];

watch(selectedSort, (value) => {
  sortBy.value = value?.key;
  orderBy.value = value?.order;
  page.value = 1;
});

watch([selectedStatus, selectedType, selectedFlag, searchQuery], () => {
  page.value = 1;
});

const cloneJob = (job: JobProperties) => {
  const raw = toRaw(job) as JobProperties;
  const seen = new WeakSet<object>();

  try {
    return JSON.parse(
      JSON.stringify(raw, (_key, value) => {
        if (typeof value === "function" || typeof value === "symbol") {
          return undefined;
        }

        if (typeof Window !== "undefined" && value instanceof Window) {
          return undefined;
        }

        if (value && typeof value === "object") {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }

        return value;
      }),
    ) as JobProperties;
  } catch (error) {
    console.warn("JSON clone failed for job", error);
    return { ...raw };
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

const contactDirectory = computed(() => {
  const map = new Map<
    number,
    { name: string; picture: string | null; email: string | null }
  >();
  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
      email: contact.email || null,
    });
  });
  return map;
});
const collaboratorOptions = computed(() => getEmployeeOptions());
const employeeDirectory = computed(() => {
  const map = new Map<
    string,
    { id: number | string; name: string; avatar: string | null }
  >();
  collaboratorOptions.value.forEach((employee) => {
    const id = employee.employeeId ?? employee.value ?? employee.id;
    if (id === undefined || id === null) return;
    map.set(String(id), {
      id,
      name: employee.title,
      avatar: employee.avatar ?? employee.avatarUrl ?? null,
    });
  });
  return map;
});

const getContactEntry = (id: number | string | null | undefined) => {
  if (id === null || id === undefined) return null;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;
  return contactDirectory.value.get(numericId) ?? null;
};
const getEmployeeEntry = (id: number | string | null | undefined) => {
  if (id === null || id === undefined) return null;
  return employeeDirectory.value.get(String(id)) ?? null;
};

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (job: JobProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const clientName = relatedContactName(job);
    const haystack = [
      job.jobOrderNumber,
      job.name,
      job.code,
      job.location,
      clientName,
    ]
      .filter(Boolean)
      .map((value) => value!.toString().toLowerCase());

    const hasMatch = haystack.some((value) => value.includes(query));
    if (!hasMatch) return false;
  }

  if (selectedStatus.value && job.status !== selectedStatus.value) return false;
  if (selectedType.value && job.type !== selectedType.value) return false;
  if (selectedFlag.value && job.flag !== selectedFlag.value) return false;

  return true;
};

const normalizeSortValue = (job: JobProperties, key?: SortKey) => {
  switch (key) {
    case "jobOrderNumber":
      return job.jobOrderNumber ?? "";
    case "code":
      return job.code?.toLowerCase() ?? "";
    case "name":
      return job.name?.toLowerCase() ?? "";
    case "status":
      return job.status ?? "";
    case "type":
      return job.type ?? "";
    case "flag":
      return job.flag ?? "";
    case "createdAt":
    default:
      return job.createdAt ?? "";
  }
};

const compareJobs = (a: JobProperties, b: JobProperties) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredJobs = computed<JobProperties[]>(() =>
  jobsStore.all
    .map((job) => cloneJob(job))
    .filter((job) => matchesFilters(job)),
);

const sortedJobs = computed<JobProperties[]>(() => {
  const items = [...filteredJobs.value];
  if (items.length > 1) items.sort(compareJobs);
  return items;
});

const displayedJobs = computed<JobProperties[]>(() => {
  const results = sortedJobs.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;
  return results.slice(start, end);
});

const totalJobs = computed(() => sortedJobs.value.length);

const tasksByJobId = computed(() => {
  const map = new Map<string, ToDo[]>();
  todosStore.items.forEach((task) => {
    if (!task.relatedTo || task.relatedTo.type !== "job") return;
    const key = String(task.relatedTo.id);
    const tasks = map.get(key) ?? [];
    tasks.push(task);
    map.set(key, tasks);
  });
  return map;
});

const jobTasks = (job: JobProperties) => tasksByJobId.value.get(String(job.id)) ?? [];
const isTaskCompleted = (task: any) => task?.status === "completed";
const isGoalCompleted = (job: JobProperties, goalId: number | string) => {
  const tasks = jobTasks(job).filter(
    (task: any) => String(task.goalId ?? "") === String(goalId),
  );
  return tasks.length > 0 && tasks.every(isTaskCompleted);
};
const isMilestoneCompleted = (
  job: JobProperties,
  milestoneId: number | string,
) => {
  const directTasks = jobTasks(job).filter(
    (task: any) =>
      String(task.milestoneId ?? "") === String(milestoneId) &&
      (task.goalId === null ||
        task.goalId === undefined ||
        String(task.goalId).trim() === ""),
  );
  const goals = job.goals.filter(
    (goal) => String(goal.milestoneId) === String(milestoneId),
  );
  const directComplete =
    !directTasks.length || directTasks.every(isTaskCompleted);
  const goalsComplete = !goals.length || goals.every((goal) => isGoalCompleted(job, goal.id));

  return (directTasks.length > 0 || goals.length > 0) && directComplete && goalsComplete;
};
const deliveryDateByJobId = computed(() => {
  const map = new Map<string, string | null>();
  const now = Date.now();
  sortedJobs.value.forEach((job) => {
    const candidates: string[] = [];
    job.goals.forEach((goal) => {
      if (goal.dueDate && !isGoalCompleted(job, goal.id)) candidates.push(goal.dueDate);
    });
    job.milestones.forEach((milestone) => {
      if (milestone.dueDate && !isMilestoneCompleted(job, milestone.id))
        candidates.push(milestone.dueDate);
    });

    const datedCandidates = candidates
      .map((value) => ({ value, time: new Date(value).getTime() }))
      .filter((entry) => Number.isFinite(entry.time));
    const upcoming = datedCandidates
      .filter((entry) => entry.time >= now)
      .sort((a, b) => a.time - b.time)[0];
    const overdue = datedCandidates
      .filter((entry) => entry.time < now)
      .sort((a, b) => b.time - a.time)[0];

    map.set(String(job.id), upcoming?.value ?? overdue?.value ?? job.endDate ?? null);
  });
  return map;
});
const progressByJobId = computed(() => {
  const map = new Map<string, number>();
  sortedJobs.value.forEach((job) => {
    const entities: boolean[] = [
      ...jobTasks(job).map(isTaskCompleted),
      ...job.goals.map((goal) => isGoalCompleted(job, goal.id)),
      ...job.milestones.map((milestone) =>
        isMilestoneCompleted(job, milestone.id),
      ),
    ];
    const progress = entities.length
      ? Math.round((entities.filter(Boolean).length / entities.length) * 100)
      : 0;
    map.set(String(job.id), progress);
  });
  return map;
});
const deliveryDateForJob = (job: JobProperties) =>
  deliveryDateByJobId.value.get(String(job.id)) ?? null;
const progressForJob = (job: JobProperties) =>
  progressByJobId.value.get(String(job.id)) ?? 0;
const isOverdue = (value?: string | null) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
};
const formatDate = (value?: string | null) => {
  if (!value) return "";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};

const decorateStakeholders = (job: JobProperties): DecoratedStakeholder[] => {
  if (!Array.isArray(job.stakeholders)) return [];

  return job.stakeholders.map((stakeholder, index) => {
    const contact = stakeholder.contactId
      ? getContactEntry(stakeholder.contactId)
      : null;
    const name = contact?.name || stakeholder.role || "Unassigned";

    return {
      id: stakeholder.id,
      name,
      role: stakeholder.role || "--",
      avatar: contact?.picture || null,
      isPrimary: index === 0,
    };
  });
};

const resolveFlagColor = (flag: JobProperties["flag"]) => {
  switch (flag) {
    case "High":
      return "error";
    case "Normal":
    default:
      return "primary";
  }
};

const jobAvatarColor = (flag: JobProperties["flag"]) => resolveFlagColor(flag);
const statusColor = (status?: string | null) => {
  switch (status) {
    case "New":
      return "teal";
    case "Pending":
    case "On Hold":
      return "purple";
    case "In Progress":
      return "info";
    case "Completed":
      return "success";
    case "Closed":
      return "secondary";
    default:
      return "primary";
  }
};

const relatedContactName = (job: JobProperties) => {
  const entry = getContactEntry(job.relatedTo);
  return entry?.name ?? "--";
};

const isAddJobDialogVisible = ref(false);
const isJobEditDialogVisible = ref(false);
const selectedJob = ref<JobProperties | null>(null);
const dialogLoading = ref(false);
const dialogError = ref<string | null>(null);

const openEditDialog = (job: JobProperties) => {
  selectedJob.value = cloneJob(job);
  dialogError.value = null;
  isJobEditDialogVisible.value = true;
};

const addJob = (payload: Partial<JobProperties>) => {
  dialogLoading.value = true;
  try {
    jobsStore.addJob(payload);
    notifications.push("Job created", "success", 3000);
  } catch (error) {
    console.error("Failed to create job", error);
    notifications.push("Failed to create job", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const updateJob = (payload: JobProperties) => {
  if (!payload?.id) return;
  dialogLoading.value = true;
  dialogError.value = null;

  try {
    const updated = jobsStore.updateJob(payload.id, payload);
    if (!updated) {
      dialogError.value = "Failed to save job";
      notifications.push("Unable to update job", "error", 4000);
      return;
    }

    notifications.push("Job updated", "success", 3000);
    isJobEditDialogVisible.value = false;
    selectedJob.value = null;
  } catch (error) {
    console.error("Failed to update job", error);
    dialogError.value = "An unexpected error occurred";
    notifications.push("Failed to update job", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const isStageDialogVisible = ref(false);
const statusDialogValue = ref<JobStatus | null>(null);
const stageDialogJobId = ref<number | null>(null);
const collaboratorDialogJob = ref<JobProperties | null>(null);
const collaboratorDialogValue = ref<number[]>([]);
const isCollaboratorDialogVisible = ref(false);
const noteDialogJob = ref<JobProperties | null>(null);
const noteDialogValue = ref("");
const isNoteDialogVisible = ref(false);
const callDialogJob = ref<JobProperties | null>(null);
const isCallDialogVisible = ref(false);
const meetingContacts = computed(() => getContactAndEmployeeRefs());

const onTodoCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addTodo && todos.addTodo(payload);
    notifications.push("Task created", "success", 3500);
  } catch (e) {
    console.error("onTodoCreated failed:", e);
    notifications.push("Task created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
  }
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
    console.error("onMeetingCreated failed:", e);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
  }
};

const closeMeetingDrawer = () => {
  isAddMeetingOpen.value = false;
};

const handleJobAction = (action: string, job: JobProperties) => {
  switch (action) {
    case "note":
      noteDialogJob.value = cloneJob(job);
      noteDialogValue.value = job.note ?? "";
      isNoteDialogVisible.value = true;
      break;
    case "todo":
      addTodoInitial.value = {
        title: `Job: ${job.name}`,
        description: job.note || "",
        relatedTo: {
          id: job.id,
          name: job.name,
          type: "job",
        },
        linkedTo: [
          {
            id: job.id,
            name: job.name,
            avatarUrl: job.avatar || null,
            type: "job",
          },
        ],
        // prefill collaborators from related contact if present
        collaborators: job.relatedTo
          ? [
              {
                id: job.relatedTo as number,
                name: relatedContactName(job),
                avatarUrl: getContactEntry(job.relatedTo)?.picture || null,
              },
            ]
          : [],
      };
      isAddTodoDrawerVisible.value = true;
      nextTick(() => {
        try {
          addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
        } catch {}
        addTodoInitial.value = null;
      });
      break;
    case "meeting":
      nextTick(() => {
        try {
          // Build linkedTo list from stakeholders, collaborators, and relatedTo
          const linkedSet = new Set<string | number>();
          const linkedContacts: Array<{
            id: number | string;
            name: string;
            avatarUrl: string | null;
            type: "contact";
            roles: ["contact"];
            contactId: number | string;
          }> = [];

          const addContactById = (id?: number | null) => {
            if (id === null || id === undefined) return;
            const key = String(id);
            if (linkedSet.has(key)) return;
            linkedSet.add(key);
            const entry = contactsStore.byId(id);
            linkedContacts.push({
              id,
              contactId: id,
              name: entry?.fullName || `Contact ${id}`,
              avatarUrl: entry?.picture || null,
              type: "contact",
              roles: ["contact"],
            });
          };

          // Add stakeholders
          (job.stakeholders || []).forEach((s) => addContactById(s.contactId));
          // Add collaborators
          (job.collaborators || []).forEach((cId) =>
            addContactById(Number(cId)),
          );
          // Add relatedTo
          addContactById(job.relatedTo ?? null);

          addMeetingRef.value?.openWith?.({
            title: `Meeting: ${job.name}`,
            initialStart: new Date(),
            durationMins: 60,
            linkedTo: linkedContacts,
            relatedTo: {
              id: job.id,
              name: job.name,
              type: "job",
            },
            attendees: [],
            notes: `Meeting regarding ${job.name}`,
          });
        } catch {}
        isAddMeetingOpen.value = true;
      });
      break;
    case "email":
      isComposeDialogVisible.value = true;
      nextTick(() => {
        try {
          const toAddress =
            (getContactEntry(job.relatedTo)?.email as string | undefined) || "";
          composeDialogRef.value?.openWith?.({
            to: toAddress ? [toAddress] : [],
            subject: `Regarding ${job.name}`,
            message: `Hello,\n\nI'd like to discuss ${job.name}.\n\nThanks,`,
          });
        } catch {}
      });
      break;
    case "call":
      callDialogJob.value = cloneJob(job);
      isCallDialogVisible.value = true;
      break;
    case "stage":
      stageDialogJobId.value = job.id as number;
      statusDialogValue.value = (job.status ?? job.stage) as JobStatus;
      isStageDialogVisible.value = true;
      break;
    default:
      break;
  }
};

const togglePriority = (job: JobProperties) => {
  const nextFlag: JobFlag = job.flag === "High" ? "Normal" : "High";
  jobsStore.updateJob(job.id, {
    ...job,
    flag: nextFlag,
  });
  notifications.push(
    nextFlag === "High" ? "Job marked high priority" : "Job priority cleared",
    "success",
    2500,
  );
};

const openCollaboratorDialog = (job: JobProperties) => {
  collaboratorDialogJob.value = cloneJob(job);
  collaboratorDialogValue.value = Array.isArray(job.collaborators)
    ? [...job.collaborators]
    : [];
  isCollaboratorDialogVisible.value = true;
};

const saveCollaborators = () => {
  if (!collaboratorDialogJob.value) return;
  jobsStore.updateJob(collaboratorDialogJob.value.id, {
    ...collaboratorDialogJob.value,
    collaborators: collaboratorDialogValue.value,
  });
  notifications.push("Collaborators updated", "success", 2500);
  isCollaboratorDialogVisible.value = false;
  collaboratorDialogJob.value = null;
};

const saveNote = () => {
  if (!noteDialogJob.value) return;
  jobsStore.updateJob(noteDialogJob.value.id, {
    ...noteDialogJob.value,
    note: noteDialogValue.value,
  });
  notifications.push("Note saved", "success", 2500);
  isNoteDialogVisible.value = false;
  noteDialogJob.value = null;
};

const saveStageChange = () => {
  if (stageDialogJobId.value === null || !statusDialogValue.value) {
    isStageDialogVisible.value = false;
    return;
  }
  jobsStore.updateJob(stageDialogJobId.value, {
    ...(jobsStore.byId(stageDialogJobId.value) as any),
    stage: statusDialogValue.value,
    status: statusDialogValue.value,
  } as any);
  notifications.push("Status updated", "success", 2500);
  isStageDialogVisible.value = false;
  stageDialogJobId.value = null;
};

const updateOptions = (options: {
  sortBy?: Array<{ key: SortKey; order: SortOrder }>;
}) => {
  const [sort] = options.sortBy ?? [];
  if (sort) {
    sortBy.value = sort.key;
    orderBy.value = sort.order;
  }

  const matched = sortOptions.find(
    (option) =>
      option.value.key === sortBy.value && option.value.order === orderBy.value,
  );

  if (matched) selectedSort.value = matched.value;
};

const updateItemsPerPage = (value: number | string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;

  itemsPerPage.value = numeric;
  page.value = 1;
};
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Jobs</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedType"
              placeholder="Select Type"
              :items="typeOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              v-model="selectedFlag"
              placeholder="Select Priority"
              :items="flagOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" md="3">
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
              { value: 15, title: '15' },
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

        <div class="d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField v-model="searchQuery" placeholder="Search Jobs" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddJobDialogVisible = true"
          >
            Add New Job
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedJobs"
        item-value="id"
        :items-length="totalJobs"
        :headers="headers"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.jobOrderNumber="{ item }">
          <div class="d-flex align-center gap-2">
            <VBtn
              icon
              variant="text"
              size="small"
              :color="item.flag === 'High' ? 'warning' : 'secondary'"
              @click.stop="togglePriority(item)"
            >
              <VIcon
                :icon="item.flag === 'High' ? 'tabler-star-filled' : 'tabler-star'"
              />
              <VTooltip activator="parent" location="top">
                {{ item.flag === "High" ? "High priority" : "Normal priority" }}
              </VTooltip>
            </VBtn>
            <RouterLink
              :to="{ name: 'operations-jobs-view-id', params: { id: item.id } }"
              class="font-weight-medium text-link"
            >
              {{ item.jobOrderNumber || "--" }}
            </RouterLink>
          </div>
        </template>

        <template #item.code="{ item }">
          <RouterLink
            :to="{ name: 'operations-jobs-view-id', params: { id: item.id } }"
            class="font-weight-medium text-link"
          >
            {{ item.code || "--" }}
          </RouterLink>
        </template>

        <template #item.description="{ item }">
          <div class="d-flex flex-column gap-1 py-2">
            <RouterLink
              :to="{ name: 'operations-jobs-view-id', params: { id: item.id } }"
              class="text-body-2 font-weight-medium text-link"
            >
              {{ relatedContactName(item) }}
            </RouterLink>
            <span class="text-high-emphasis">
              {{ item.name }} | {{ item.type }} | Created:
              {{ formatDate(item.createdAt) }}
            </span>
          </div>
        </template>

        <template #item.deliveryDate="{ item }">
          <span
            :class="{
              'text-warning font-weight-medium': isOverdue(deliveryDateForJob(item)),
              'text-medium-emphasis': !deliveryDateForJob(item),
            }"
          >
            {{ formatDate(deliveryDateForJob(item)) || "" }}
          </span>
        </template>

        <template #item.progress="{ item }">
          <div class="d-flex align-center gap-2" style="min-inline-size: 120px">
            <VProgressLinear
              :model-value="progressForJob(item)"
              color="primary"
              height="8"
              rounded
            />
            <span class="text-caption text-medium-emphasis">
              {{ progressForJob(item) }}%
            </span>
          </div>
        </template>

        <template #item.collaborators="{ item }">
          <div class="d-flex align-center gap-2">
            <div class="v-avatar-group demo-avatar-group">
              <VAvatar
                v-for="collaboratorId in (item.collaborators || []).slice(0, 4)"
                :key="`${item.id}-${collaboratorId}`"
                :size="32"
                :color="!getEmployeeEntry(collaboratorId)?.avatar ? 'primary' : undefined"
                class="text-white font-weight-medium"
              >
                <VImg
                  v-if="getEmployeeEntry(collaboratorId)?.avatar"
                  :src="getEmployeeEntry(collaboratorId)?.avatar || ''"
                />
                <span v-else>
                  {{ avatarText(getEmployeeEntry(collaboratorId)?.name) }}
                </span>
                <VTooltip activator="parent" location="top">
                  {{ getEmployeeEntry(collaboratorId)?.name || "Unknown" }}
                </VTooltip>
              </VAvatar>
              <VAvatar
                v-if="(item.collaborators || []).length > 4"
                color="secondary"
                :size="32"
                class="text-white font-weight-medium"
              >
                +{{ (item.collaborators || []).length - 4 }}
              </VAvatar>
            </div>
            <IconBtn size="32" @click.stop="openCollaboratorDialog(item)">
              <VIcon icon="tabler-plus" />
              <VTooltip activator="parent" location="top">
                Add or remove collaborators
              </VTooltip>
            </IconBtn>
          </div>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="statusColor(item.status || item.stage)"
            label
            size="small"
            class="cursor-pointer"
            @click="handleJobAction('stage', item)"
          >
            {{ item.status || item.stage }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="openEditDialog(item)">
            <VIcon icon="tabler-edit" />
            <VTooltip activator="parent" location="top">Edit</VTooltip>
          </IconBtn>
          <VBtn icon variant="text" color="medium-emphasis">
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem @click="handleJobAction('note', item)">
                  <template #prepend>
                    <VIcon icon="tabler-note" />
                  </template>
                  <VListItemTitle>Note</VListItemTitle>
                </VListItem>
                <VListItem @click="handleJobAction('todo', item)">
                  <template #prepend>
                    <VIcon icon="tabler-list-check" />
                  </template>
                  <VListItemTitle>Todo</VListItemTitle>
                </VListItem>
                <VListItem @click="handleJobAction('meeting', item)">
                  <template #prepend>
                    <VIcon icon="tabler-calendar" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>
                <VListItem @click="handleJobAction('email', item)">
                  <template #prepend>
                    <VIcon icon="tabler-mail" />
                  </template>
                  <VListItemTitle>Email</VListItemTitle>
                </VListItem>
                <VListItem @click="handleJobAction('call', item)">
                  <template #prepend>
                    <VIcon icon="tabler-phone" />
                  </template>
                  <VListItemTitle>Call</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>
      </VDataTableServer>
    </VCard>

    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      source="contacts"
      :initial="addTodoInitial"
      @user-data="onTodoCreated"
    />

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="meetingContacts"
      source="contacts"
      @cancel="closeMeetingDrawer"
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

    <VDialog v-model="isCollaboratorDialogVisible" max-width="560">
      <DialogCloseBtn @click="isCollaboratorDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Collaborators</VCardTitle>
        <VCardText>
          <AppSelect
            v-model="collaboratorDialogValue"
            label="Assigned collaborators"
            placeholder="Select collaborators"
            :items="collaboratorOptions"
            item-title="title"
            item-value="value"
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
            @click="isCollaboratorDialogVisible = false"
          >
            Close
          </VBtn>
          <VBtn color="primary" @click="saveCollaborators">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isNoteDialogVisible" max-width="560">
      <DialogCloseBtn @click="isNoteDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Note</VCardTitle>
        <VCardText>
          <AppTextarea
            v-model="noteDialogValue"
            label="Performance Note"
            placeholder="Add note"
            auto-grow
            rows="4"
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isNoteDialogVisible = false"
          >
            Close
          </VBtn>
          <VBtn color="primary" @click="saveNote">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isCallDialogVisible" max-width="520">
      <DialogCloseBtn @click="isCallDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Call</VCardTitle>
        <VCardText>
          <div class="text-body-1">
            Call for {{ callDialogJob?.name || "job" }}.
          </div>
          <div class="text-body-2 text-medium-emphasis mt-2">
            Client: {{ callDialogJob ? relatedContactName(callDialogJob) : "--" }}
          </div>
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn color="primary" @click="isCallDialogVisible = false">
            Done
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isStageDialogVisible" max-width="480">
      <DialogCloseBtn @click="isStageDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Change Status</VCardTitle>
        <VCardText>
          <AppSelect
            v-model="statusDialogValue"
            placeholder="Select Status"
            :items="statusOptions"
            clearable
            clear-icon="tabler-x"
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isStageDialogVisible = false"
          >
            Close
          </VBtn>
          <VBtn color="primary" @click="saveStageChange">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <AddJobDialog
      v-model:is-dialog-visible="isAddJobDialogVisible"
      @submit="addJob"
    />

    <JobEditDialog
      :job="selectedJob"
      v-model:is-dialog-visible="isJobEditDialogVisible"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="updateJob"
    />
  </section>
</template>

<style scoped>
.job-primary-border {
  --job-primary-color: rgb(var(--v-theme-primary));

  position: relative;
}

.job-primary-border::after {
  position: absolute;
  border: 2px solid var(--job-primary-color);
  border-radius: inherit;
  content: "";
  inset: -2px;
  pointer-events: none;
}
</style>
