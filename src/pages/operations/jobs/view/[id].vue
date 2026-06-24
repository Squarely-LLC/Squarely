<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import DialogActionBar from "@/components/DialogActionBar.vue";
import AddStakeholderDialog from "@/components/dialogs/AddStakeholderDialog.vue";
import type { ToDo, ToDoStep } from "@/data/schema";
import type {
  JobProperties,
  JobStatus,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useContactsStore } from "@/stores/contacts";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { useTodos } from "@/stores/todos";
import {
  getContactAndEmployeeRefs,
  getEmployeeOptions,
  getEmployeeRefs,
} from "@/utils/peopleOptions";
import {
  buildCompletedTaskPatch,
  createJobStatusSuggestionNotification,
  deriveSuggestedJobStatus,
  getCompletionMinutesDraft,
  isCurrentProjectOwner,
  isFutureJobTaskStart,
  isJobTask,
} from "@/utils/jobTaskRules";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import AddSiteSurveysDrawer from "@/views/apps/todo/list/AddSiteSurveysDrawer.vue";
import AddSnaglistsDrawer from "@/views/apps/todo/list/AddSnaglistsDrawer.vue";
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";
import JobEditDialog from "@/views/operations/jobs/list/JobEditDialog.vue";
import JobCommunicationTab from "@/views/operations/jobs/view/JobCommunicationTab.vue";
import JobDocumentsTab from "@/views/operations/jobs/view/JobDocumentsTab.vue";
import JobMilestonesGoalsTab from "@/views/operations/jobs/view/JobMilestonesGoalsTab.vue";
import JobStakeholdersCard from "@/views/operations/jobs/view/JobStakeholdersCard.vue";
import JobSummaryCard from "@/views/operations/jobs/view/JobSummaryCard.vue";

const route = useRoute("operations-jobs-view-id");
const router = useRouter();

const jobsStore = useJobsStore();
jobsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const configStore = useConfigStore();
configStore.init();

const employeesStore = useEmployeesStore();
employeesStore.init();

const notifications = useNotificationsStore();
const systemNotificationsStore = useSystemNotificationsStore();
systemNotificationsStore.init();
const todosStore = useTodos();
todosStore.init();

const cloneJob = (job: JobProperties | null) => {
  if (!job) return null;
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
    console.warn("JSON clone failed for job clone", error);
    return { ...raw };
  }
};

const job = ref<JobProperties | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const isStatusPromptVisible = ref(false);
const statusPromptAction = ref("");
const statusPromptTarget = ref<JobStatus | null>(null);
const statusPromptNeverAgain = ref(false);
const isCompletionTimeDialogVisible = ref(false);
const pendingCompletionTodo = ref<ToDo | null>(null);
const completionMinutesDraft = ref<number | null>(null);

const jobTodos = computed(() => {
  const currentJob = job.value;
  if (!currentJob) return [] as ToDo[];
  return todosStore.items.filter(
    (todo) =>
      todo.relatedTo &&
      String(todo.relatedTo.id) === String(currentJob.id) &&
      (todo.relatedTo.type ? todo.relatedTo.type === "job" : true),
  );
});

const suggestedStatus = computed<JobStatus>(() => {
  const currentJob = job.value;
  return deriveSuggestedJobStatus(currentJob, jobTodos.value);
});

const jobTaskTimeCaptureEnabled = computed(() =>
  Boolean(configStore.configurations?.crm?.jobTaskTimeCaptureEnabled),
);

const buildTodoPatch = (payload: any) => {
  const partial: any = {
    title: payload.title,
    collaborators: payload.collaborators,
    dueAt: payload.dueAt,
    startAt: payload.startAt,
    completionMinutes: payload.completionMinutes,
    status: payload.status,
    notes: payload.notes,
    important: payload.important,
    attachment: payload.attachment,
    relatedTo: payload.relatedTo,
  };

  if ("completed" in payload) partial.completed = payload.completed;
  if ("isCompleted" in payload) partial.isCompleted = payload.isCompleted;
  if ("doneAt" in payload) partial.doneAt = payload.doneAt;

  return partial;
};

const queueStatusSuggestion = (action: string) => {
  const currentJob = job.value;
  if (!currentJob || currentJob.statusAutomation?.neverPrompt) return;

  const targetStatus = suggestedStatus.value;
  const currentStatus = (currentJob.status ?? currentJob.stage) as JobStatus;
  if (!targetStatus || targetStatus === currentStatus) return;

  if (!isCurrentProjectOwner(currentJob)) {
    createJobStatusSuggestionNotification(
      systemNotificationsStore,
      currentJob,
      action,
      targetStatus,
    );
    return;
  }

  statusPromptAction.value = action;
  statusPromptTarget.value = targetStatus;
  statusPromptNeverAgain.value = false;
  isStatusPromptVisible.value = true;
};

const closeStatusPrompt = (mode: "yes" | "no" | "ignore") => {
  const currentJob = job.value;
  if (!currentJob) {
    isStatusPromptVisible.value = false;
    return;
  }

  const automation = {
    ...(currentJob.statusAutomation ?? {}),
    neverPrompt:
      statusPromptNeverAgain.value ||
      Boolean(currentJob.statusAutomation?.neverPrompt),
  };

  if (mode === "yes" && statusPromptTarget.value) {
    const updated = jobsStore.updateJob(currentJob.id, {
      ...currentJob,
      status: statusPromptTarget.value,
      stage: statusPromptTarget.value,
      statusAutomation: automation,
    });
    if (updated) job.value = cloneJob(updated);
  } else if (statusPromptNeverAgain.value) {
    const updated = jobsStore.updateJob(currentJob.id, {
      ...currentJob,
      statusAutomation: automation,
    });
    if (updated) job.value = cloneJob(updated);
  }

  isStatusPromptVisible.value = false;
};

const contactDirectory = computed(() => {
  const map = new Map<
    number,
    {
      name: string;
      picture: string | null;
      email: string | null;
      type: string | null;
      connections: Array<{
        contactId: number;
        contactName: string;
        isPrimary: boolean;
        relation: string;
        picture?: string;
      }>;
    }
  >();
  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
      email: contact.email || null,
      type: contact.type || null,
      connections: Array.isArray(contact.connections)
        ? contact.connections.map((connection) => ({ ...connection }))
        : [],
    });
  });
  return map;
});

const jobStatusOptions = computed(() =>
  (configStore.configurations?.crm?.jobStatuses || [
    "New",
    "Pending",
    "In Progress",
    "On Hold",
    "Completed",
    "Closed",
  ]).map((status) => String(status)),
);

const employeeDirectory = computed(() => {
  const map = new Map<number, { name: string; picture: string | null }>();
  employeesStore.all.forEach((employee) => {
    if (employee?.id === null || employee?.id === undefined) return;
    map.set(Number(employee.id), {
      name: employee.fullName,
      picture: employee.picture || null,
    });
  });
  return map;
});

const importEntityConnections = (
  sourceJob: JobProperties,
  entityIds: Array<number | string | null | undefined>,
  options: { force?: boolean } = {},
) => {
  const stakeholders = Array.isArray(sourceJob.stakeholders)
    ? sourceJob.stakeholders.map((stakeholder) => ({ ...stakeholder }))
    : [];
  const importedEntityIds = new Set(
    (sourceJob.stakeholderConnectionImportIds || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  const existingContactIds = new Set(
    stakeholders
      .map((stakeholder) => Number(stakeholder.contactId))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value)),
  );
  let maxId = stakeholders.length
    ? Math.max(...stakeholders.map((stakeholder) => Number(stakeholder.id) || 0))
    : 0;
  let changed = false;

  entityIds.forEach((entityIdValue) => {
    const entityId = Number(entityIdValue);
    if (!Number.isFinite(entityId) || entityId <= 0) return;
    if (!options.force && importedEntityIds.has(entityId)) return;

    const entity = contactsStore.byId(entityId);
    if (!entity || entity.type !== "Entity") return;

    if (!importedEntityIds.has(entityId)) {
      importedEntityIds.add(entityId);
      changed = true;
    }

    (entity.connections || []).forEach((connection) => {
      const contactId = Number(connection.contactId);
      if (!Number.isFinite(contactId) || contactId <= 0) return;
      if (existingContactIds.has(String(contactId))) return;

      const contact = contactsStore.byId(contactId);
      if (!contact) return;

      maxId += 1;
      existingContactIds.add(String(contactId));
      stakeholders.push({
        id: maxId,
        contactId,
        role: connection.relation || "Related Contact",
      });
      changed = true;
    });
  });

  if (!changed) return null;

  return {
    stakeholders,
    stakeholderConnectionImportIds: Array.from(importedEntityIds),
  };
};

const syncJobEntityConnections = (sourceJob: JobProperties) => {
  const importPatch = importEntityConnections(sourceJob, [sourceJob.relatedTo]);
  if (!importPatch) return sourceJob;

  try {
    const updated = jobsStore.updateJob(sourceJob.id, {
      ...sourceJob,
      ...importPatch,
    });
    return updated ?? sourceJob;
  } catch (error) {
    console.warn("Failed to import job entity connections", error);
    return sourceJob;
  }
};

const resolveJob = () => {
  loading.value = true;
  const found = jobsStore.byId(route.params.id);

  if (found) {
    job.value = cloneJob(syncJobEntityConnections(found));
    error.value = null;
  } else {
    job.value = null;
    error.value = "Job not found.";
  }

  loading.value = false;
};

const jobTab = ref<number | null>(null);

// stable keys for tabs used in the URL query param (order must match `tabs`)
const tabKeys = [
  "milestones-goals",
  "communication",
  "documents",
  "expenses",
] as const;

const tabs = [
  { icon: "tabler-flag", title: "Details" },
  { icon: "tabler-message", title: "Communication" },
  { icon: "tabler-folder", title: "Documents" },
  { icon: "tabler-credit-card", title: "Expenses" },
] as const;

const setTabFromQuery = () => {
  try {
    const q = String(route.query.tab || tabKeys[0]);
    if (q === "project-info") {
      jobTab.value = 0;
      return;
    }
    const idx = (tabKeys as readonly string[]).indexOf(q);
    jobTab.value = idx === -1 ? 0 : idx;
  } catch (e) {
    jobTab.value = 0;
  }
};

onMounted(() => {
  resolveJob();
  setTabFromQuery();
});
watch(() => route.params.id, resolveJob);
watch(
  () => jobsStore.byId(route.params.id),
  (value) => {
    if (!value) {
      job.value = null;
      error.value = "Job not found.";
      return;
    }
    job.value = cloneJob(syncJobEntityConnections(value));
    error.value = null;
  },
);

// keep jobTab in sync with the route query param
watch(
  () => route.query.tab,
  () => {
    setTabFromQuery();
  },
);

// update the route when the user changes tabs
watch(
  () => jobTab.value,
  (val) => {
    if (val == null) return;
    const key = (tabKeys as readonly string[])[val] || tabKeys[0];
    if (String(route.query.tab) === key) return;
    try {
      router.replace({
        name: route.name as any,
        params: route.params,
        query: { ...(route.query || {}), tab: key },
      });
    } catch (e) {
      // ignore router replace errors
    }
  },
);

// Drawer and dialog refs
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);
const isEditTodoDrawerVisible = ref(false);
const editingTodo = ref<ToDo | null>(null);

const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isAddMeetingOpen = ref(false);
const lockMeetingRelatedTo = ref(false);
const addSurveyRef = ref<InstanceType<typeof AddSiteSurveysDrawer> | null>(
  null,
);
const isAddSurveyOpen = ref(false);
const addSnagRef = ref<InstanceType<typeof AddSnaglistsDrawer> | null>(null);
const isAddSnagOpen = ref(false);

const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);
const isJobEditDialogVisible = ref(false);
const isJobSaving = ref(false);
const jobSaveError = ref<string | null>(null);
const isNoteDialogVisible = ref(false);
const noteDialogValue = ref("");
const isCallDialogVisible = ref(false);
const isCollaboratorDialogVisible = ref(false);
const collaboratorDialogValue = ref<number[]>([]);

// Stakeholder dialogs
const isAddStakeholderDialogVisible = ref(false);
const confirmDeleteStakeholderVisible = ref(false);
const deleteStakeholderCandidateId = ref<number | null>(null);

// People options for drawers
const contactOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture || null,
  })),
);
const taskCollaboratorOptions = computed(() => getEmployeeRefs());
const meetingContacts = computed(() => getContactAndEmployeeRefs());
const collaboratorOptions = computed(() => getEmployeeOptions());

const relatedJobContact = computed(() => {
  if (!job.value?.relatedTo) return null;
  return contactsStore.byId(job.value.relatedTo);
});

const openSummaryTask = () => {
  if (!job.value) return;

  addTodoInitial.value = {
    title: `Job: ${job.value.name}`,
    description: job.value.note || "",
    relatedTo: {
      id: job.value.id,
      name: job.value.name,
      type: "job",
    },
    linkedTo: [
      {
        id: job.value.id,
        name: job.value.name,
        avatarUrl: job.value.avatar || null,
        type: "job",
      },
    ],
    collaborators: [],
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const openSummaryMeeting = () => {
  handleAddMeetingFromCommunication();
};

const openSummaryEmail = () => {
  if (!job.value) return;
  const contact = relatedJobContact.value;

  isComposeDialogVisible.value = true;
  nextTick(() => {
    try {
      composeDialogRef.value?.openWith?.({
        to: contact?.email ? [contact.email] : [],
        subject: `Regarding ${job.value?.name || "project"}`,
        message: `Hello${
          contact?.fullName ? ` ${contact.fullName}` : ""
        },\n\nI'd like to discuss ${
          job.value?.name || "the project"
        }.\n\nThanks,`,
      });
    } catch {}
  });
};

const openSummaryCall = () => {
  if (!job.value) return;
  isCallDialogVisible.value = true;
};

const openSummaryNote = () => {
  if (!job.value) return;
  noteDialogValue.value = job.value.note || "";
  isNoteDialogVisible.value = true;
};

const saveSummaryNote = () => {
  if (!job.value) return;

  try {
    const updated = jobsStore.updateJob(job.value.id, {
      ...job.value,
      note: noteDialogValue.value,
    });
    if (updated) job.value = cloneJob(updated);
    notifications.push("Note saved", "success", 2500);
    isNoteDialogVisible.value = false;
  } catch (error) {
    console.error("Failed to save job note", error);
    notifications.push("Failed to save note", "error", 3000);
  }
};

const openCollaboratorDialog = () => {
  if (!job.value) return;
  collaboratorDialogValue.value = Array.isArray(job.value.collaborators)
    ? [...job.value.collaborators]
    : [];
  isCollaboratorDialogVisible.value = true;
};

const closeCollaboratorDialog = () => {
  collaboratorDialogValue.value = [];
  isCollaboratorDialogVisible.value = false;
};

const saveJobCollaborators = () => {
  if (!job.value) return;

  try {
    const updated = jobsStore.updateJob(job.value.id, {
      ...job.value,
      collaborators: [...collaboratorDialogValue.value],
    });
    if (updated) job.value = cloneJob(updated);
    closeCollaboratorDialog();
    notifications.push("Collaborators updated", "success", 2500);
  } catch (error) {
    console.error("Failed to update collaborators", error);
    notifications.push("Unable to update collaborators", "error", 3000);
  }
};

// Stakeholder action handlers
const handleStakeholderTodo = (contact: {
  id: number;
  name: string;
  avatar: string | null;
}) => {
  addTodoInitial.value = {
    title: `Follow up: ${contact.name}`,
    description: `Regarding ${job.value?.name || "project"}`,
    relatedTo: job.value
      ? {
          id: job.value.id,
          name: job.value.name,
          type: "job",
        }
      : null,
    linkedTo: job.value
      ? [
          {
            id: job.value.id,
            name: job.value.name,
            avatarUrl: job.value.avatar || null,
            type: "job",
          },
        ]
      : [],
    collaborators: [
      {
        id: contact.id,
        name: contact.name,
        avatarUrl: contact.avatar,
      },
    ],
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const handleStakeholderMeeting = (contact: {
  id: number;
  name: string;
  avatar: string | null;
}) => {
  lockMeetingRelatedTo.value = false;
  nextTick(() => {
    try {
      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${contact.name}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: job.value
          ? [
              {
                id: contact.id,
                name: contact.name,
                avatarUrl: contact.avatar,
                type: "contact",
                roles: ["contact"],
                contactId: contact.id,
              },
              {
                id: job.value.id,
                name: job.value.name,
                avatarUrl: job.value.avatar || null,
                type: "job",
              },
            ]
          : [],
        relatedTo: job.value
          ? {
              id: job.value.id,
              name: job.value.name,
              type: "job",
            }
          : null,
        attendees: [
          {
            id: contact.id,
            name: contact.name,
            avatarUrl: contact.avatar,
          },
        ],
        notes: `Meeting regarding ${job.value?.name || "project"}`,
        // Don't prefill meetingType, location, or locationDetails when adding from stakeholders card
      });
    } catch {}
    isAddMeetingOpen.value = true;
  });
};

const handleAddMeetingFromCommunication = () => {
  lockMeetingRelatedTo.value = true;
  nextTick(() => {
    try {
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

      (job.value?.stakeholders || []).forEach((s) =>
        addContactById(s.contactId),
      );
      (job.value?.collaborators || []).forEach((cId) =>
        addContactById(Number(cId)),
      );
      addContactById(job.value?.relatedTo ?? null);

      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${job.value?.name || "Project"}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: linkedContacts,
        relatedTo: job.value
          ? {
              id: job.value.id,
              name: job.value.name,
              type: "job",
            }
          : null,
        attendees: [],
        notes: `Meeting regarding ${job.value?.name || "project"}`,
        // Don't prefill meetingType, location, or locationDetails when adding from communication tab
      });
    } catch {}
    isAddMeetingOpen.value = true;
  });
};

const handleAddSurveyFromCommunication = () => {
  nextTick(() => {
    try {
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

      (job.value?.stakeholders || []).forEach((s) =>
        addContactById(s.contactId),
      );
      (job.value?.collaborators || []).forEach((cId) =>
        addContactById(Number(cId)),
      );
      addContactById(job.value?.relatedTo ?? null);

      addSurveyRef.value?.openWith?.({
        title: `Site Survey: ${job.value?.name || "Project"}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: linkedContacts,
        relatedTo: job.value
          ? {
              id: job.value.id,
              name: job.value.name,
              type: "job",
            }
          : null,
        attendees: [],
        notes: `Site survey for ${job.value?.name || "project"}`,
      });
    } catch {}
    isAddSurveyOpen.value = true;
  });
};

const handleAddSnagFromCommunication = () => {
  nextTick(() => {
    try {
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

      (job.value?.stakeholders || []).forEach((s) =>
        addContactById(s.contactId),
      );
      (job.value?.collaborators || []).forEach((cId) =>
        addContactById(Number(cId)),
      );
      addContactById(job.value?.relatedTo ?? null);

      addSnagRef.value?.openWith?.({
        title: `Snaglist: ${job.value?.name || "Project"}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: linkedContacts,
        relatedTo: job.value
          ? {
              id: job.value.id,
              name: job.value.name,
              type: "job",
            }
          : null,
        attendees: [],
        notes: `Snaglist for ${job.value?.name || "project"}`,
      });
    } catch {}
    isAddSnagOpen.value = true;
  });
};

const handleStakeholderEmail = (contact: {
  id: number;
  name: string;
  avatar: string | null;
}) => {
  const contactEntry = contactsStore.byId(contact.id);
  const toAddress = contactEntry?.email || "";

  isComposeDialogVisible.value = true;
  nextTick(() => {
    try {
      composeDialogRef.value?.openWith?.({
        to: toAddress ? [toAddress] : [],
        subject: `Regarding ${job.value?.name || "project"}`,
        message: `Hello ${contact.name},\n\nI'd like to discuss ${
          job.value?.name || "the project"
        }.\n\nThanks,`,
      });
    } catch {}
  });
};

const handleStakeholderCall = (contact: {
  id: number;
  name: string;
  avatar: string | null;
}) => {
  notifications.push(`Call ${contact.name}`, "info", 2500);
};

const handleAddStakeholder = () => {
  isAddStakeholderDialogVisible.value = true;
};

const handleEditJob = () => {
  jobSaveError.value = null;
  isJobEditDialogVisible.value = true;
};

const onEditJobSubmit = async (payload: JobProperties) => {
  if (!job.value) return;

  isJobSaving.value = true;
  jobSaveError.value = null;

  try {
    const updated = jobsStore.updateJob(job.value.id, payload);

    if (!updated) {
      jobSaveError.value = "Failed to update project";
      notifications.push("Unable to update job", "error", 4000);
      return;
    }

    notifications.push("Project information updated", "success", 3000);
    isJobEditDialogVisible.value = false;
  } catch (error) {
    console.error("Failed to update project info", error);
    jobSaveError.value = "An unexpected error occurred";
    notifications.push("Failed to update job", "error", 4000);
  } finally {
    isJobSaving.value = false;
  }
};

const onAddStakeholder = (payload: {
  contactId: number | string;
  role?: string;
}) => {
  if (!job.value) return;

  const currentStakeholders = Array.isArray(job.value.stakeholders)
    ? job.value.stakeholders
    : [];
  const maxId =
    currentStakeholders.length > 0
      ? Math.max(...currentStakeholders.map((s) => s.id))
      : 0;

  const newStakeholder = {
    id: maxId + 1,
    contactId: Number(payload.contactId),
    role: payload.role || "",
  };

  const draftJob = {
    ...job.value,
    stakeholders: [...currentStakeholders, newStakeholder],
  };
  const importPatch = importEntityConnections(
    draftJob,
    [payload.contactId],
    { force: true },
  );

  try {
    const updated = jobsStore.updateJob(job.value.id, {
      ...draftJob,
      ...(importPatch ?? {}),
    });
    if (updated) job.value = cloneJob(updated);
    notifications.push("Stakeholder added", "success", 3000);
  } catch (err) {
    console.error("Failed to add stakeholder:", err);
    notifications.push("Failed to add stakeholder", "error", 3000);
  }
};

const handleRemoveStakeholder = (stakeholderId: number) => {
  deleteStakeholderCandidateId.value = stakeholderId;
  confirmDeleteStakeholderVisible.value = true;
};

const performDeleteStakeholder = () => {
  if (!job.value || deleteStakeholderCandidateId.value === null) return;

  const updatedStakeholders = job.value.stakeholders.filter(
    (s) => s.id !== deleteStakeholderCandidateId.value,
  );

  try {
    jobsStore.updateJob(job.value.id, {
      ...job.value,
      stakeholders: updatedStakeholders,
    });
    notifications.push("Stakeholder removed", "success", 3000);
  } catch (err) {
    console.error("Failed to remove stakeholder:", err);
    notifications.push("Failed to remove stakeholder", "error", 3000);
  }

  confirmDeleteStakeholderVisible.value = false;
  deleteStakeholderCandidateId.value = null;
};

// Handle todo creation from documents tab
const handleDocumentTodoRequest = (payload: {
  initial: Record<string, any>;
  collaborators: Array<{
    id: number | string;
    name: string;
    avatarUrl?: string | null;
  }>;
}) => {
  addTodoInitial.value = {
    ...(payload?.initial ?? {}),
    relatedTo:
      payload?.initial?.relatedTo ??
      (job.value
        ? {
            id: job.value.id,
            name: job.value.name,
            type: "job",
          }
        : null),
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const handleMilestoneGoalTodoRequest = (payload: {
  initial: Record<string, any>;
}) => {
  handleDocumentTodoRequest({
    initial: payload?.initial ?? {},
    collaborators: [],
  });
};

const handleMilestoneGoalTodoEditRequest = (todoId: number | string) => {
  const todo = todosStore.byId(todoId);
  if (!todo) return;

  editingTodo.value = todo;
  isEditTodoDrawerVisible.value = true;
};

const onTodoEdited = (payload: any) => {
  const partial = buildTodoPatch(payload);
  const previousTodo = todosStore.byId(payload.id);
  if (
    previousTodo &&
    isJobTask(previousTodo) &&
    payload.status !== "pending" &&
    isFutureJobTaskStart(partial.startAt ?? (previousTodo as any).startAt)
  ) {
    notifications.push("Task is locked until its start date", "warning", 3000);
    return;
  }
  if (
    jobTaskTimeCaptureEnabled.value &&
    previousTodo &&
    isJobTask(previousTodo) &&
    payload.status === "completed" &&
    previousTodo.status !== "completed"
  ) {
    pendingCompletionTodo.value = { ...previousTodo, ...partial } as ToDo;
    completionMinutesDraft.value = getCompletionMinutesDraft(
      previousTodo,
      partial.completionMinutes,
    );
    isCompletionTimeDialogVisible.value = true;
    return;
  }
  todosStore.updateTodo(payload.id, partial);
  isEditTodoDrawerVisible.value = false;
  nextTick(() => queueStatusSuggestion("Task updated"));
};

const onTodoStepsEdited = (payload: {
  id: number | string;
  steps: ToDoStep[];
}) => {
  todosStore.updateTodo(payload.id, {
    steps: payload.steps.map((step) => ({ ...step })),
  });
};

const onTodoCreated = (payload: any) => {
  try {
    try {
      todosStore.init();
    } catch {}
    if (isJobTask(payload) && isFutureJobTaskStart(payload.startAt)) {
      payload.status = "pending";
    }
    todosStore.addTodo && todosStore.addTodo(payload);
    notifications.push("Task created", "success", 3500);
    nextTick(() => queueStatusSuggestion("Task created"));
  } catch (e) {
    console.error("onTodoCreated failed:", e);
    notifications.push("Task created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
  }
};

const saveCompletionTime = () => {
  const todo = pendingCompletionTodo.value;
  if (!todo) {
    isCompletionTimeDialogVisible.value = false;
    return;
  }

  todosStore.updateTodo(todo.id, {
    ...todo,
    ...buildCompletedTaskPatch(completionMinutesDraft.value),
  } as any);
  pendingCompletionTodo.value = null;
  completionMinutesDraft.value = null;
  isCompletionTimeDialogVisible.value = false;
  isEditTodoDrawerVisible.value = false;
  nextTick(() => queueStatusSuggestion("Task completed"));
};

const cancelCompletionTime = () => {
  pendingCompletionTodo.value = null;
  completionMinutesDraft.value = null;
  isCompletionTimeDialogVisible.value = false;
};

const onMeetingCreated = (payload: any) => {
  try {
    try {
      todosStore.init();
    } catch {}
    todosStore.addMeeting && todosStore.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (e) {
    console.error("onMeetingCreated failed:", e);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
    lockMeetingRelatedTo.value = false;
  }
};

const closeMeetingDrawer = () => {
  isAddMeetingOpen.value = false;
  lockMeetingRelatedTo.value = false;
};

const closeSurveyDrawer = () => {
  isAddSurveyOpen.value = false;
};

const closeSnagDrawer = () => {
  isAddSnagOpen.value = false;
};
</script>

<template>
  <div>
    <VProgressLinear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <VRow v-if="job">
      <VCol cols="12" md="5" lg="4">
        <JobSummaryCard
          :job="job"
          :contact-directory="contactDirectory"
          :employee-directory="employeeDirectory"
          :status-options="jobStatusOptions"
          @edit="handleEditJob"
          @open-add-task="openSummaryTask"
          @open-add-email="openSummaryEmail"
          @open-add-meeting="openSummaryMeeting"
          @open-add-call="openSummaryCall"
          @open-add-note="openSummaryNote"
          @open-collaborators="openCollaboratorDialog"
        />

        <JobStakeholdersCard
          :job="job"
          :contact-directory="contactDirectory"
          class="mt-4"
          @add-stakeholder="handleAddStakeholder"
          @remove-stakeholder="handleRemoveStakeholder"
          @todo="handleStakeholderTodo"
          @meeting="handleStakeholderMeeting"
          @email="handleStakeholderEmail"
          @call="handleStakeholderCall"
        />
      </VCol>

      <VCol cols="12" md="7" lg="8">
        <VTabs v-model="jobTab" class="v-tabs-pill mb-4">
          <VTab v-for="tab in tabs" :key="tab.icon">
            <VIcon :size="18" :icon="tab.icon" class="me-1" />
            <span>{{ tab.title }}</span>
          </VTab>
        </VTabs>

        <VWindow v-model="jobTab" class="disable-tab-transition" :touch="false">
          <VWindowItem>
            <JobMilestonesGoalsTab
              :job-id="job.id"
              @open-add-todo="handleMilestoneGoalTodoRequest"
              @open-edit-todo="handleMilestoneGoalTodoEditRequest"
              @status-automation-trigger="queueStatusSuggestion"
            />
          </VWindowItem>

          <VWindowItem>
            <JobCommunicationTab
              :job-id="job.id"
              @open-add-meeting="handleAddMeetingFromCommunication"
              @open-add-survey="handleAddSurveyFromCommunication"
              @open-add-snag="handleAddSnagFromCommunication"
            />
          </VWindowItem>

          <VWindowItem>
            <JobDocumentsTab
              :job-id="job.id"
              @open-add-todo="handleDocumentTodoRequest"
            />
          </VWindowItem>
        </VWindow>
      </VCol>
    </VRow>

    <VAlert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </VAlert>

    <VDialog
      v-model="isStatusPromptVisible"
      max-width="560"
      persistent
      no-click-animation
    >
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Status suggestion</VCardTitle>
        <VCardText>
          {{ statusPromptAction }} has happened. Do you want to change the
          status to {{ statusPromptTarget }}?
          <VCheckbox
            v-model="statusPromptNeverAgain"
            class="mt-4"
            density="compact"
            label="Never show again for this project"
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn variant="tonal" color="secondary" @click="closeStatusPrompt('no')">
            No
          </VBtn>
          <VBtn variant="tonal" color="warning" @click="closeStatusPrompt('ignore')">
            Ignore
          </VBtn>
          <VBtn color="primary" @click="closeStatusPrompt('yes')">
            Yes
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Todo Drawer -->
    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="taskCollaboratorOptions"
      :initial="addTodoInitial"
      job-task-mode
      @user-data="onTodoCreated"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerVisible"
      :todo="editingTodo"
      :collaborators-options="taskCollaboratorOptions"
      job-task-mode
      @save="onTodoEdited"
      @saveSteps="onTodoStepsEdited"
    />

    <VDialog
      v-model="isCompletionTimeDialogVisible"
      max-width="420"
      persistent
      no-click-animation
    >
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Time for Completion</VCardTitle>
        <VCardText>
          <AppTextField
            v-model.number="completionMinutesDraft"
            type="number"
            min="0"
            label="Time for Completion (min)"
            placeholder="Minutes"
          />
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn variant="tonal" color="secondary" @click="cancelCompletionTime">
            Cancel
          </VBtn>
          <VBtn color="primary" @click="saveCompletionTime">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Meeting Drawer -->
    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="meetingContacts"
      :lock-related-to="lockMeetingRelatedTo"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <!-- Site Survey Drawer -->
    <AddSiteSurveysDrawer
      ref="addSurveyRef"
      v-model:modelValue="isAddSurveyOpen"
      :contacts="[]"
      :lock-related-to="true"
      @cancel="closeSurveyDrawer"
      @save="closeSurveyDrawer"
    />

    <!-- Snaglist Drawer -->
    <AddSnaglistsDrawer
      ref="addSnagRef"
      v-model:modelValue="isAddSnagOpen"
      :contacts="[]"
      :lock-related-to="true"
      @cancel="closeSnagDrawer"
      @save="closeSnagDrawer"
    />

    <!-- Email Dialog -->
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

    <JobEditDialog
      v-model:is-dialog-visible="isJobEditDialogVisible"
      :job="job"
      :loading="isJobSaving"
      :error="jobSaveError"
      @submit="onEditJobSubmit"
    />

    <VDialog v-model="isNoteDialogVisible" max-width="560">
      <DialogCloseBtn @click="isNoteDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Note</VCardTitle>
        <VCardText>
          <AppTextarea
            v-model="noteDialogValue"
            label="Project note"
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
          <VBtn color="primary" @click="saveSummaryNote">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isCallDialogVisible" max-width="520">
      <DialogCloseBtn @click="isCallDialogVisible = false" />
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Call</VCardTitle>
        <VCardText>
          <div class="text-body-1">
            Call for {{ job?.name || "project" }}.
          </div>
          <div class="text-body-2 text-medium-emphasis mt-2">
            Client: {{ relatedJobContact?.fullName || "Internal project" }}
          </div>
          <div
            v-if="relatedJobContact?.number"
            class="text-body-2 text-medium-emphasis mt-1"
          >
            Number: {{ relatedJobContact.number }}
          </div>
        </VCardText>
        <VCardActions class="justify-end">
          <VBtn color="primary" @click="isCallDialogVisible = false">
            Done
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isCollaboratorDialogVisible" max-width="560">
      <DialogCloseBtn @click="closeCollaboratorDialog" />
      <VCard class="pa-sm-6 pa-4">
        <VCardItem>
          <VCardTitle>Collaborators</VCardTitle>
          <VCardSubtitle>
            Add employees assigned to this job.
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <AppSelect
            v-model="collaboratorDialogValue"
            :items="collaboratorOptions"
            item-title="title"
            item-value="value"
            label="Collaborators"
            placeholder="Select collaborators"
            multiple
            chips
            clearable
            clear-icon="tabler-x"
          >
            <template #selection="{ item }">
              <VChip size="small" class="me-1">
                <VAvatar start size="20" color="primary" variant="tonal">
                  <VImg
                    v-if="item.raw.avatarUrl || item.raw.avatar"
                    :src="item.raw.avatarUrl || item.raw.avatar"
                  />
                  <span v-else class="text-xxs font-weight-bold">
                    {{ item.raw.title?.slice(0, 2).toUpperCase() }}
                  </span>
                </VAvatar>
                {{ item.raw.title }}
              </VChip>
            </template>

            <template #item="{ item, props: itemProps }">
              <VListItem v-bind="itemProps">
                <template #prepend>
                  <VAvatar size="28" color="primary" variant="tonal">
                    <VImg
                      v-if="item.raw.avatarUrl || item.raw.avatar"
                      :src="item.raw.avatarUrl || item.raw.avatar"
                    />
                    <span v-else class="text-xs font-weight-bold">
                      {{ item.raw.title?.slice(0, 2).toUpperCase() }}
                    </span>
                  </VAvatar>
                </template>
              </VListItem>
            </template>
          </AppSelect>
        </VCardText>

        <VCardActions>
          <DialogActionBar
            @save="saveJobCollaborators"
            @cancel="closeCollaboratorDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Add Stakeholder Dialog -->
    <AddStakeholderDialog
      v-model:is-dialog-visible="isAddStakeholderDialogVisible"
      :existing-stakeholder-ids="
        job?.stakeholders
          ?.map((s) => s.contactId)
          .filter((id): id is number => id !== null) || []
      "
      @add-stakeholder="onAddStakeholder"
    />

    <!-- Delete Stakeholder Confirmation Dialog -->
    <VDialog
      v-model="confirmDeleteStakeholderVisible"
      persistent
      max-width="400"
    >
      <DialogCloseBtn @click="confirmDeleteStakeholderVisible = false" />
      <VCard>
        <VCardText class="pt-6">
          Are you sure you want to remove this stakeholder?
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="
              confirmDeleteStakeholderVisible = false;
              deleteStakeholderCandidateId = null;
            "
          >
            Cancel
          </VBtn>
          <VBtn color="error" variant="tonal" @click="performDeleteStakeholder">
            Remove
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
