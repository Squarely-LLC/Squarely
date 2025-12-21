<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRaw, watch } from "vue";

import AddStakeholderDialog from "@/components/dialogs/AddStakeholderDialog.vue";
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useContactsStore } from "@/stores/contacts";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import JobMilestonesGoalsTab from "@/views/operations/jobs/view/JobMilestonesGoalsTab.vue";
import JobProjectInfoTab from "@/views/operations/jobs/view/JobProjectInfoTab.vue";
import JobStakeholdersCard from "@/views/operations/jobs/view/JobStakeholdersCard.vue";
import JobStakeholdersTab from "@/views/operations/jobs/view/JobStakeholdersTab.vue";
import JobSummaryCard from "@/views/operations/jobs/view/JobSummaryCard.vue";

const route = useRoute("operations-jobs-view-id");

const jobsStore = useJobsStore();
jobsStore.init();

const contactsStore = useContactsStore();
contactsStore.init();

const notifications = useNotificationsStore();
const todosStore = useTodos();

const cloneJob = (job: JobProperties | null) => {
  if (!job) return null;
  const raw = toRaw(job) as JobProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed for job clone", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as JobProperties;
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

onMounted(resolveJob);
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
  }
);

const jobTab = ref(0);

const tabs = [
  { icon: "tabler-clipboard", title: "Project Info" },
  { icon: "tabler-flag", title: "Milestones & Goals" },
  { icon: "tabler-users", title: "Stakeholders" },
] as const;

// Drawer and dialog refs
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);

const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isAddMeetingOpen = ref(false);

const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);

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
  }))
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
  nextTick(() => {
    try {
      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${contact.name}`,
        initialStart: new Date(),
        durationMins: 60,
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
        attendees: [
          {
            id: contact.id,
            name: contact.name,
            avatarUrl: contact.avatar,
          },
        ],
        notes: `Meeting regarding ${job.value?.name || "project"}`,
        location: job.value?.location || "",
      });
    } catch {}
    isAddMeetingOpen.value = true;
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
    (s) => s.id !== deleteStakeholderCandidateId.value
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

const onTodoCreated = (payload: any) => {
  try {
    try {
      todosStore.init();
    } catch {}
    todosStore.addTodo && todosStore.addTodo(payload);
    notifications.push("To Do created", "success", 3500);
  } catch (e) {
    console.error("onTodoCreated failed:", e);
    notifications.push("To Do created", "success", 3500);
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
  }
};

const closeMeetingDrawer = () => {
  isAddMeetingOpen.value = false;
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
        <JobSummaryCard :job="job" :contact-directory="contactDirectory" />

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
            <JobProjectInfoTab :job-id="job.id" />
          </VWindowItem>

          <VWindowItem>
            <JobMilestonesGoalsTab :job-id="job.id" />
          </VWindowItem>

          <VWindowItem>
            <JobStakeholdersTab :job-id="job.id" />
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
      @userData="onTodoCreated"
    />

    <!-- Meeting Drawer -->
    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="contactOptions"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
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
              3500
            );
          } catch (e) {
            notifications.push('Email sent', 'success', 3500);
          }
        }
      "
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
