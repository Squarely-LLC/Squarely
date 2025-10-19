<script setup lang="ts">
import type {
  JobGoal,
  JobMilestone,
  JobProperties,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, reactive, ref } from "vue";
interface Props {
  jobId: number | string;
}
const props = defineProps<Props>();
const jobsStore = useJobsStore();
const notifications = useNotificationsStore();
const job = computed<JobProperties | null>(() => jobsStore.byId(props.jobId));
const milestones = computed(() => job.value?.milestones ?? []);
const goals = computed(() => job.value?.goals ?? []);
const priorityOptions = [
  { title: "Low", value: "Low" },
  { title: "Normal", value: "Normal" },
  { title: "High", value: "High" },
];
const milestoneDialog = reactive({
  visible: false,
  mode: "create" as "create" | "edit",
  draft: {
    id: null as number | null,
    name: "",
    startDate: undefined as string | undefined,
    dueDate: undefined as string | undefined,
    priority: "Normal" as JobMilestone["priority"],
    note: "",
  },
});
const goalDialog = reactive({
  visible: false,
  mode: "create" as "create" | "edit",
  draft: {
    id: null as number | null,
    milestoneId: null as number | null,
    name: "",
    startDate: undefined as string | undefined,
    dueDate: undefined as string | undefined,
    priority: "Normal" as JobGoal["priority"],
    note: "",
  },
});
const milestoneTargetId = ref<number | null>(null);
const goalTargetId = ref<number | null>(null);
const milestoneTitle = computed(() =>
  milestoneDialog.mode === "create" ? "Add Milestone" : "Edit Milestone"
);
const goalTitle = computed(() =>
  goalDialog.mode === "create" ? "Add Goal" : "Edit Goal"
);
const resetMilestoneDraft = () => {
  milestoneDialog.draft = {
    id: null,
    name: "",
    startDate: undefined,
    dueDate: undefined,
    priority: "Normal",
    note: "",
  };
};
const resetGoalDraft = () => {
  goalDialog.draft = {
    id: null,
    milestoneId: null,
    name: "",
    startDate: undefined,
    dueDate: undefined,
    priority: "Normal",
    note: "",
  };
};
const openCreateMilestone = () => {
  milestoneDialog.mode = "create";
  milestoneDialog.visible = true;
  resetMilestoneDraft();
};
const openEditMilestone = (milestone: JobMilestone) => {
  milestoneDialog.mode = "edit";
  milestoneDialog.visible = true;
  milestoneTargetId.value = milestone.id;
  milestoneDialog.draft = {
    id: milestone.id,
    name: milestone.name,
    startDate: milestone.startDate ?? undefined,
    dueDate: milestone.dueDate ?? undefined,
    priority: milestone.priority,
    note: milestone.note ?? "",
  };
};
const saveMilestone = () => {
  if (!job.value) return;
  if (milestoneDialog.mode === "create") {
    jobsStore.addMilestone(job.value.id, { ...milestoneDialog.draft });
    notifications.push("Milestone added", "success", 3000);
  } else if (milestoneTargetId.value !== null) {
    jobsStore.updateMilestone(job.value.id, milestoneTargetId.value, {
      ...milestoneDialog.draft,
    });
    notifications.push("Milestone updated", "success", 3000);
  }
  milestoneDialog.visible = false;
  milestoneTargetId.value = null;
  resetMilestoneDraft();
};
const deleteMilestone = (milestone: JobMilestone) => {
  if (!job.value) return;
  jobsStore.removeMilestone(job.value.id, milestone.id);
  notifications.push("Milestone removed", "success", 3000);
};
const openCreateGoal = (milestoneId?: number) => {
  goalDialog.mode = "create";
  goalDialog.visible = true;
  resetGoalDraft();
  goalDialog.draft.milestoneId = milestoneId ?? null;
};
const openEditGoal = (goal: JobGoal) => {
  goalDialog.mode = "edit";
  goalDialog.visible = true;
  goalTargetId.value = goal.id;
  goalDialog.draft = {
    id: goal.id,
    milestoneId: goal.milestoneId ?? null,
    name: goal.name,
    startDate: goal.startDate ?? undefined,
    dueDate: goal.dueDate ?? undefined,
    priority: goal.priority,
    note: goal.note ?? "",
  };
};
const saveGoal = () => {
  if (!job.value) return;
  if (goalDialog.mode === "create") {
    jobsStore.addGoal(job.value.id, { ...goalDialog.draft });
    notifications.push("Goal added", "success", 3000);
  } else if (goalTargetId.value !== null) {
    jobsStore.updateGoal(job.value.id, goalTargetId.value, {
      ...goalDialog.draft,
    });
    notifications.push("Goal updated", "success", 3000);
  }
  goalDialog.visible = false;
  goalTargetId.value = null;
  resetGoalDraft();
};
const deleteGoal = (goal: JobGoal) => {
  if (!job.value) return;
  jobsStore.removeGoal(job.value.id, goal.id);
  notifications.push("Goal removed", "success", 3000);
};
const milestoneLabel = (milestoneId: number | null) => {
  if (milestoneId === null) return "No milestone";
  return (
    milestones.value.find((milestone) => milestone.id === milestoneId)?.name ??
    "No milestone"
  );
};
const formatDate = (value?: string | null) => {
  if (!value) return "--";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    console.warn("Failed to format date", error);
    return value;
  }
};
</script>
<template>
  <div class="d-flex flex-column gap-6">
    <VCard>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div>
            <h5 class="text-h5 mb-1">Milestones</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Track the major phases for this job.
            </p>
          </div>
          <VBtn prepend-icon="tabler-plus" @click="openCreateMilestone">
            Add Milestone
          </VBtn>
        </div>
        <VTable density="comfortable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Note</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!milestones.length">
              <td colspan="6" class="text-center text-medium-emphasis py-6">
                No milestones yet. Add one to get started.
              </td>
            </tr>
            <tr v-for="milestone in milestones" :key="milestone.id">
              <td class="text-high-emphasis">{{ milestone.name }}</td>
              <td>{{ formatDate(milestone.startDate) }}</td>
              <td>{{ formatDate(milestone.dueDate) }}</td>
              <td>
                <VChip
                  :color="
                    milestone.priority === 'High'
                      ? 'error'
                      : milestone.priority === 'Low'
                      ? 'secondary'
                      : 'primary'
                  "
                  label
                  size="small"
                >
                  {{ milestone.priority }}
                </VChip>
              </td>
              <td class="text-medium-emphasis">{{ milestone.note || "--" }}</td>
              <td class="text-end">
                <VBtn
                  variant="text"
                  color="primary"
                  @click="openEditMilestone(milestone)"
                >
                  Edit
                </VBtn>
                <VBtn
                  variant="text"
                  color="error"
                  @click="deleteMilestone(milestone)"
                >
                  Delete
                </VBtn>
                <VBtn
                  variant="text"
                  color="secondary"
                  @click="openCreateGoal(milestone.id)"
                >
                  Add Goal
                </VBtn>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>
    <VCard>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div>
            <h5 class="text-h5 mb-1">Goals</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Maintain the key deliverables linked to milestones.
            </p>
          </div>
          <VBtn prepend-icon="tabler-plus" @click="openCreateGoal()">
            Add Goal
          </VBtn>
        </div>
        <VTable density="comfortable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Milestone</th>
              <th>Start</th>
              <th>Due</th>
              <th>Priority</th>
              <th>Note</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!goals.length">
              <td colspan="7" class="text-center text-medium-emphasis py-6">
                No goals yet. Create a goal to plan your next milestone steps.
              </td>
            </tr>
            <tr v-for="goal in goals" :key="goal.id">
              <td class="text-high-emphasis">{{ goal.name }}</td>
              <td>{{ milestoneLabel(goal.milestoneId ?? null) }}</td>
              <td>{{ formatDate(goal.startDate) }}</td>
              <td>{{ formatDate(goal.dueDate) }}</td>
              <td>
                <VChip
                  :color="
                    goal.priority === 'High'
                      ? 'error'
                      : goal.priority === 'Low'
                      ? 'secondary'
                      : 'primary'
                  "
                  label
                  size="small"
                >
                  {{ goal.priority }}
                </VChip>
              </td>
              <td class="text-medium-emphasis">{{ goal.note || "--" }}</td>
              <td class="text-end">
                <VBtn
                  variant="text"
                  color="primary"
                  @click="openEditGoal(goal)"
                >
                  Edit
                </VBtn>
                <VBtn variant="text" color="error" @click="deleteGoal(goal)">
                  Delete
                </VBtn>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>
    <VDialog
      :model-value="milestoneDialog.visible"
      :width="$vuetify.display.smAndDown ? 'auto' : 560"
      @update:model-value="(val: boolean) => (milestoneDialog.visible = val)"
    >
      <DialogCloseBtn @click="milestoneDialog.visible = false" />
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-4">{{ milestoneTitle }}</h5>
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="milestoneDialog.draft.name"
                label="Milestone Name"
                placeholder="Milestone Name"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="milestoneDialog.draft.startDate"
                label="Start Date"
                placeholder="YYYY-MM-DD HH:mm"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="milestoneDialog.draft.dueDate"
                label="Due Date"
                placeholder="YYYY-MM-DD HH:mm"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="milestoneDialog.draft.priority"
                label="Priority"
                placeholder="Select Priority"
                :items="priorityOptions"
              />
            </VCol>
            <VCol cols="12">
              <AppTextarea
                v-model="milestoneDialog.draft.note"
                label="Notes"
                placeholder="Notes about the milestone"
                auto-grow
              />
            </VCol>
            <VCol cols="12" class="d-flex justify-end gap-4">
              <VBtn
                variant="tonal"
                color="secondary"
                @click="milestoneDialog.visible = false"
              >
                Cancel
              </VBtn>
              <VBtn @click="saveMilestone">Save</VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VDialog>
    <VDialog
      :model-value="goalDialog.visible"
      :width="$vuetify.display.smAndDown ? 'auto' : 560"
      @update:model-value="(val: boolean) => (goalDialog.visible = val)"
    >
      <DialogCloseBtn @click="goalDialog.visible = false" />
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-4">{{ goalTitle }}</h5>
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="goalDialog.draft.name"
                label="Goal Name"
                placeholder="Goal Name"
              />
            </VCol>
            <VCol cols="12">
              <AppSelect
                v-model="goalDialog.draft.milestoneId"
                label="Milestone"
                placeholder="Select Milestone"
                :items="[
                  { title: 'No milestone', value: null },
                  ...milestones.map((milestone) => ({
                    title: milestone.name,
                    value: milestone.id,
                  })),
                ]"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="goalDialog.draft.startDate"
                label="Start Date"
                placeholder="YYYY-MM-DD HH:mm"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="goalDialog.draft.dueDate"
                label="Due Date"
                placeholder="YYYY-MM-DD HH:mm"
                clearable
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="goalDialog.draft.priority"
                label="Priority"
                placeholder="Select Priority"
                :items="priorityOptions"
              />
            </VCol>
            <VCol cols="12">
              <AppTextarea
                v-model="goalDialog.draft.note"
                label="Notes"
                placeholder="Notes about the goal"
                auto-grow
              />
            </VCol>
            <VCol cols="12" class="d-flex justify-end gap-4">
              <VBtn
                variant="tonal"
                color="secondary"
                @click="goalDialog.visible = false"
              >
                Cancel
              </VBtn>
              <VBtn @click="saveGoal">Save</VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VDialog>
  </div>
</template>
