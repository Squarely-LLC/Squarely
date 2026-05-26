<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import AddStakeholderDialog from "@/components/dialogs/AddStakeholderDialog.vue";
import type { ToDo, ToDoStep } from "@/data/schema";
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useContactsStore } from "@/stores/contacts";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
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

const employeesStore = useEmployeesStore();
employeesStore.init();

const notifications = useNotificationsStore();
const todosStore = useTodos();

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

const contactDirectory = computed(() => {
  const map = new Map<number, { name: string; picture: string | null }>();
  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(Number(contact.id), {
      name: contact.fullName,
      picture: contact.picture || null,
    });
  });
  return map;
});

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

const resolveJob = () => {
  loading.value = true;
  const found = jobsStore.byId(route.params.id);

  if (found) {
    job.value = cloneJob(found);
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
  { icon: "tabler-flag", title: "Milestones & Goals" },
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
    job.value = cloneJob(value);
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

// Stakeholder dialogs
const isAddStakeholderDialogVisible = ref(false);
const confirmDeleteStakeholderVisible = ref(false);
const deleteStakeholderCandidateId = ref<number | null>(null);

// Contact options for dropdowns
const contactOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture || null,
  })),
);

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

  const maxId =
    job.value.stakeholders.length > 0
      ? Math.max(...job.value.stakeholders.map((s) => s.id))
      : 0;

  const newStakeholder = {
    id: maxId + 1,
    contactId: Number(payload.contactId),
    role: payload.role || "",
  };

  const updatedStakeholders = [...job.value.stakeholders, newStakeholder];

  try {
    jobsStore.updateJob(job.value.id, {
      ...job.value,
      stakeholders: updatedStakeholders,
    });
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

  if ("completed" in payload) partial.completed = payload.completed;
  if ("isCompleted" in payload) partial.isCompleted = payload.isCompleted;
  if ("doneAt" in payload) partial.doneAt = payload.doneAt;

  todosStore.updateTodo(payload.id, partial);
  isEditTodoDrawerVisible.value = false;
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
    todosStore.addTodo && todosStore.addTodo(payload);
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
          @edit="handleEditJob"
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

    <!-- Todo Drawer -->
    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      :initial="addTodoInitial"
      @user-data="onTodoCreated"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerVisible"
      :todo="editingTodo"
      :collaborators-options="contactOptions"
      @save="onTodoEdited"
      @saveSteps="onTodoStepsEdited"
    />

    <!-- Meeting Drawer -->
    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="contactOptions"
      :lock-related-to="lockMeetingRelatedTo"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <!-- Site Survey Drawer -->
    <AddSiteSurveysDrawer
      ref="addSurveyRef"
      v-model:modelValue="isAddSurveyOpen"
      :contacts="contactOptions"
      :lock-related-to="true"
      @cancel="closeSurveyDrawer"
      @save="closeSurveyDrawer"
    />

    <!-- Snaglist Drawer -->
    <AddSnaglistsDrawer
      ref="addSnagRef"
      v-model:modelValue="isAddSnagOpen"
      :contacts="contactOptions"
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
