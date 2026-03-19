<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import type { ToDo } from "@/data/schema";
import type {
  JobGoal,
  JobMilestone,
  JobProperties,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
interface Props {
  jobId: number | string;
}
const props = defineProps<Props>();
const jobsStore = useJobsStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();
todosStore.init();
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
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);
const addTodoDrawerRef =
  ref<InstanceType<typeof AddNewToDoDrawer> | null>(null);

type JobTodo = ToDo & {
  goalId?: number | string | null;
};

const jobTodos = computed<JobTodo[]>(() => {
  const jobId = String(props.jobId);
  return (todosStore.items || []).filter((todo: any) => {
    return (
      todo?.relatedTo &&
      String(todo.relatedTo.id) === jobId &&
      (todo.relatedTo.type ? todo.relatedTo.type === "job" : true)
    );
  }) as JobTodo[];
});

const milestoneGoalTree = computed(() => {
  return milestones.value.map((milestone) => {
    const nestedGoals = goals.value
      .filter((goal) => String(goal.milestoneId) === String(milestone.id))
      .map((goal) => ({
        ...goal,
        tasks: jobTodos.value.filter(
          (todo) => String(todo.goalId ?? "") === String(goal.id)
        ),
      }));

    return {
      ...milestone,
      goals: nestedGoals,
    };
  });
});

const milestoneFormRef = ref<VForm>();
const goalFormRef = ref<VForm>();
const isCreatingGoal = computed(() => goalDialog.mode === "create");
const expandedMilestones = ref<Array<number>>([]);
const expandedGoals = ref<Array<number>>([]);

const goalIdsForMilestone = (milestoneId: number) =>
  goals.value
    .filter((goal) => String(goal.milestoneId) === String(milestoneId))
    .map((goal) => goal.id);

watch(
  milestones,
  (nextMilestones, previousMilestones) => {
    const nextIds = nextMilestones.map((milestone) => milestone.id);

    if (!previousMilestones?.length) {
      expandedMilestones.value = nextIds.length ? [nextIds[0]] : [];
      expandedGoals.value = nextIds.length ? goalIdsForMilestone(nextIds[0]) : [];
      return;
    }

    const previousIds = new Set(
      previousMilestones.map((milestone) => milestone.id)
    );
    const preservedIds = expandedMilestones.value.filter((id) =>
      nextIds.includes(id)
    );
    const addedIds = nextIds.filter((id) => !previousIds.has(id));

    expandedMilestones.value = [...new Set([...preservedIds, ...addedIds])];
  },
  { immediate: true }
);

watch(
  expandedMilestones,
  (milestoneIds) => {
    const expandedGoalIds = milestoneIds.flatMap((milestoneId) =>
      goalIdsForMilestone(milestoneId)
    );

    expandedGoals.value = [
      ...new Set([...expandedGoals.value, ...expandedGoalIds]),
    ];
  },
  { deep: true }
);

watch(
  goals,
  (nextGoals, previousGoals) => {
    const nextIds = nextGoals.map((goal) => goal.id);

    if (!previousGoals?.length) {
      expandedGoals.value = expandedMilestones.value.flatMap((milestoneId) =>
        goalIdsForMilestone(milestoneId)
      );
      return;
    }

    const milestoneExpandedGoalIds = expandedMilestones.value.flatMap((milestoneId) =>
      goalIdsForMilestone(milestoneId)
    );

    expandedGoals.value = [
      ...new Set(
        [
          ...expandedGoals.value.filter((id) => nextIds.includes(id)),
          ...milestoneExpandedGoalIds,
        ].filter((id) => nextIds.includes(id))
      ),
    ];
  },
  { immediate: true }
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
  nextTick(() => milestoneFormRef.value?.resetValidation());
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
  nextTick(() => milestoneFormRef.value?.resetValidation());
};
const saveMilestone = async () => {
  if (!job.value) return;
  const { valid } = (await milestoneFormRef.value?.validate()) ?? {
    valid: true,
  };
  if (!valid) return;
  if (milestoneDialog.mode === "create") {
    const createdMilestone = jobsStore.addMilestone(job.value.id, {
      ...milestoneDialog.draft,
    });
    if (createdMilestone?.id !== undefined) {
      expandedMilestones.value = [...expandedMilestones.value, createdMilestone.id];
    }
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
  nextTick(() => milestoneFormRef.value?.resetValidation());
};
const deleteMilestone = (milestone: JobMilestone) => {
  if (!job.value) return;
  jobsStore.removeMilestone(job.value.id, milestone.id);
  expandedMilestones.value = expandedMilestones.value.filter(
    (id) => id !== milestone.id
  );
  notifications.push("Milestone removed", "success", 3000);
};
const openCreateGoal = (milestoneId?: number) => {
  if (milestoneId === undefined || milestoneId === null) return;
  goalDialog.mode = "create";
  goalDialog.visible = true;
  resetGoalDraft();
  goalDialog.draft.milestoneId = milestoneId;
  nextTick(() => goalFormRef.value?.resetValidation());
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
  nextTick(() => goalFormRef.value?.resetValidation());
};
const saveGoal = async () => {
  if (!job.value) return;
  const { valid } = (await goalFormRef.value?.validate()) ?? { valid: true };
  if (!valid) return;
  if (goalDialog.draft.milestoneId === null || goalDialog.draft.milestoneId === undefined) {
    return;
  }
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
  nextTick(() => goalFormRef.value?.resetValidation());
};
const deleteGoal = (goal: JobGoal) => {
  if (!job.value) return;
  jobsStore.removeGoal(job.value.id, goal.id);
  expandedGoals.value = expandedGoals.value.filter((id) => id !== goal.id);
  notifications.push("Goal removed", "success", 3000);
};
const openCreateTodo = (goal: JobGoal) => {
  if (!job.value) return;
  addTodoInitial.value = {
    title: `Task: ${goal.name}`,
    collaborators: [],
    notes: `Created for goal: ${goal.name}`,
    dueAt: goal.dueDate || new Date().toISOString(),
    priority:
      goal.priority === "High"
        ? "high"
        : goal.priority === "Low"
        ? "low"
        : "normal",
    status: "pending",
    relatedTo: {
      id: job.value.id,
      name: job.value.name,
      type: "job",
    },
    goalId: goal.id,
  };
  isAddTodoDrawerVisible.value = true;
};
const onTodoCreated = (payload: any) => {
  const created = todosStore.addTodo(payload);
  notifications.push(
    `Task '${created?.title || payload?.title || "Untitled"}' created`,
    "success",
    3000
  );
  isAddTodoDrawerVisible.value = false;
  addTodoInitial.value = null;
};
const priorityColor = (priority: "Low" | "Normal" | "High") => {
  return priority === "High"
    ? "error"
    : priority === "Low"
    ? "secondary"
    : "primary";
};
const todoPriorityColor = (priority?: string) => {
  return priority === "high"
    ? "error"
    : priority === "low"
    ? "secondary"
    : "primary";
};
const todoStatusLabel = (status?: string) => {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "for_review":
      return "For Review";
    case "completed":
      return "Completed";
    case "pending":
    default:
      return "Pending";
  }
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
        <div class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4">
          <div>
            <h5 class="text-h5 mb-1">Milestones, Goals & Tasks</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Organize delivery as Milestone > Goal > Task.
            </p>
          </div>
          <VBtn class="section-add-btn" prepend-icon="tabler-plus" @click="openCreateMilestone">
            Add Milestone
          </VBtn>
        </div>

        <div v-if="!milestoneGoalTree.length" class="text-center text-medium-emphasis py-6">
          No milestones yet. Add one to get started.
        </div>

        <VExpansionPanels
          v-else
          v-model="expandedMilestones"
          variant="accordion"
          multiple
          class="expansion-panels-width-border milestone-panels"
        >
          <VExpansionPanel
            v-for="milestone in milestoneGoalTree"
            :key="milestone.id"
            :value="milestone.id"
            class="milestone-panel"
          >
            <VExpansionPanelTitle>
              <div class="d-flex align-center gap-3 w-100">
                <div class="rounded-circle milestone-status-dot" />

                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex align-center gap-2 flex-wrap">
                    <div class="font-weight-medium">{{ milestone.name }}</div>
                    <VChip
                      :color="priorityColor(milestone.priority)"
                      size="small"
                      variant="tonal"
                    >
                      {{ milestone.priority }}
                    </VChip>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ milestone.goals.length }} Goal<span v-if="milestone.goals.length !== 1">s</span>
                    | Due {{ formatDate(milestone.dueDate) }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    {{ milestone.note || "No milestone notes." }}
                  </div>
                </div>

                <div class="d-flex align-center gap-2 milestone-actions" @click.stop>
                  <VBtn
                    class="milestone-add-goal-btn"
                    size="x-small"
                    variant="text"
                    prepend-icon="tabler-plus"
                    @click="openCreateGoal(milestone.id)"
                  >
                    Add Goal
                  </VBtn>
                  <VBtn icon variant="text" size="x-small">
                    <VIcon icon="tabler-dots-vertical" size="18" />
                    <VMenu activator="parent">
                      <VList>
                        <VListItem @click="openEditMilestone(milestone)">
                          <template #prepend><VIcon icon="tabler-edit" /></template>
                          <VListItemTitle>Edit</VListItemTitle>
                        </VListItem>
                        <VListItem @click="deleteMilestone(milestone)">
                          <template #prepend><VIcon icon="tabler-trash" color="error" /></template>
                          <VListItemTitle>Delete</VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>
                </div>
              </div>
            </VExpansionPanelTitle>

            <VExpansionPanelText>
              <VCard variant="flat" class="pa-4 milestone-panel-body">
                <VExpansionPanels
                  v-if="milestone.goals.length"
                  v-model="expandedGoals"
                  variant="accordion"
                  multiple
                  class="expansion-panels-width-border goal-panels"
                >
                  <VExpansionPanel
                    v-for="goal in milestone.goals"
                    :key="goal.id"
                    :value="goal.id"
                    class="goal-panel"
                  >
                    <VExpansionPanelTitle>
                      <div class="d-flex align-center gap-3 w-100">
                        <VIcon
                          icon="tabler-target-arrow"
                          size="16"
                          class="goal-icon"
                        />

                        <div class="flex-grow-1 min-w-0">
                          <div class="d-flex align-center gap-2 flex-wrap">
                            <div class="font-weight-medium">{{ goal.name }}</div>
                            <VChip
                              :color="priorityColor(goal.priority)"
                              size="x-small"
                              variant="tonal"
                            >
                              {{ goal.priority }}
                            </VChip>
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ goal.tasks.length }} Task<span v-if="goal.tasks.length !== 1">s</span>
                            | Due {{ formatDate(goal.dueDate) }}
                          </div>
                          <div class="text-body-2 text-medium-emphasis mt-1">
                            {{ goal.note || "No goal notes." }}
                          </div>
                        </div>

                        <div class="d-flex align-center gap-1 goal-actions" @click.stop>
                          <VBtn
                            class="goal-add-task-btn"
                            size="x-small"
                            variant="text"
                            prepend-icon="tabler-plus"
                            @click="openCreateTodo(goal)"
                          >
                            Add Task
                          </VBtn>
                          <VBtn icon variant="text" size="x-small">
                            <VIcon icon="tabler-dots-vertical" size="18" />
                            <VMenu activator="parent">
                              <VList>
                                <VListItem @click="openEditGoal(goal)">
                                  <template #prepend><VIcon icon="tabler-edit" /></template>
                                  <VListItemTitle>Edit</VListItemTitle>
                                </VListItem>
                                <VListItem @click="deleteGoal(goal)">
                                  <template #prepend><VIcon icon="tabler-trash" color="error" /></template>
                                  <VListItemTitle>Delete</VListItemTitle>
                                </VListItem>
                              </VList>
                            </VMenu>
                          </VBtn>
                        </div>
                      </div>
                    </VExpansionPanelTitle>

                    <VExpansionPanelText>
                      <VCard variant="flat" class="pa-4 goal-panel-body">
                        <div class="d-flex flex-column gap-2">
                          <div v-if="goal.tasks.length" class="d-flex flex-column gap-2">
                            <div
                              v-for="task in goal.tasks"
                              :key="task.id"
                              class="task-row"
                            >
                              <div class="task-row-main">
                                <div class="d-flex align-center gap-2 flex-wrap">
                                  <VIcon
                                    icon="tabler-checkbox"
                                    size="15"
                                    class="task-icon"
                                  />
                                  <span class="font-weight-medium">{{ task.title }}</span>
                                  <VChip
                                    :color="todoPriorityColor(task.priority)"
                                    size="x-small"
                                    variant="tonal"
                                  >
                                    {{ task.priority }}
                                  </VChip>
                                  <VChip size="x-small" variant="tonal">
                                    {{ todoStatusLabel(task.status) }}
                                  </VChip>
                                </div>
                                <div class="tree-meta">
                                  Due {{ formatDate(task.dueAt) }}
                                  <span v-if="task.notes"> | {{ task.notes }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div v-else class="text-body-2 text-medium-emphasis empty-tasks">
                            No tasks linked to this goal yet.
                          </div>
                        </div>
                      </VCard>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>

                <div v-else class="text-body-2 text-medium-emphasis">
                  No goals under this milestone yet.
                </div>
              </VCard>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>

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
          <VForm ref="milestoneFormRef" @submit.prevent="saveMilestone">
            <VRow>
              <VCol cols="12" md="8">
                <AppTextField
                  v-model="milestoneDialog.draft.name"
                  label="Milestone Name"
                  placeholder="Milestone Name"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12" md="4">
                <AppSelect
                  v-model="milestoneDialog.draft.priority"
                  label="Priority"
                  placeholder="Select Priority"
                  :items="priorityOptions"
                  :rules="[requiredValidator]"
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
                <VBtn type="submit">Save</VBtn>
              </VCol>
            </VRow>
          </VForm>
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
          <VForm ref="goalFormRef" @submit.prevent="saveGoal">
            <VRow>
              <VCol cols="12" md="8">
                <AppTextField
                  v-model="goalDialog.draft.name"
                  label="Goal Name"
                  placeholder="Goal Name"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12" md="4">
                <AppSelect
                  v-model="goalDialog.draft.priority"
                  label="Priority"
                  placeholder="Select Priority"
                  :items="priorityOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol v-if="!isCreatingGoal" cols="12">
                <AppSelect
                  v-model="goalDialog.draft.milestoneId"
                  label="Milestone"
                  placeholder="Select Milestone"
                  :items="[
                    ...milestones.map((milestone) => ({
                      title: milestone.name,
                      value: milestone.id,
                    })),
                  ]"
                  :rules="[requiredValidator]"
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
                <VBtn type="submit">Save</VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VDialog>
    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      :initial="addTodoInitial"
      @userData="onTodoCreated"
    />
  </div>
</template>

<style scoped>
.milestone-panels :deep(.v-expansion-panel),
.goal-panels :deep(.v-expansion-panel) {
  background: transparent;
}

.milestone-panels :deep(.v-expansion-panel-title),
.goal-panels :deep(.v-expansion-panel-title) {
  padding: 1rem 1.25rem;
}

.milestone-panels :deep(.v-expansion-panel-text__wrapper),
.goal-panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 0 1rem 1rem;
}

.milestone-panels :deep(.v-expansion-panel__shadow),
.goal-panels :deep(.v-expansion-panel__shadow) {
  box-shadow: none;
}

.milestone-panel {
  border-radius: 12px;
}

.goal-panels :deep(.v-expansion-panel) {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
}

.goal-panels :deep(.v-expansion-panel + .v-expansion-panel) {
  margin-block-start: 0.625rem;
}

.goal-panels :deep(.v-expansion-panel-title) {
  min-block-size: auto;
}

.milestone-status-dot {
  inline-size: 10px;
  block-size: 10px;
  min-inline-size: 10px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
}

.milestone-panel-body,
.goal-panel-body {
  background: rgba(var(--v-theme-surface), 0.14);
  box-shadow: none;
}

.goal-panels {
  margin-block-start: 1rem;
}

.goal-icon {
  color: rgb(var(--v-theme-info));
}

.task-icon {
  color: rgb(var(--v-theme-warning));
}

.task-row {
  padding: 0.75rem 0.875rem;
  border: 0;
  border-inline-start: 2px solid rgba(var(--v-theme-warning), 0.34);
  border-radius: 10px;
  background: rgba(var(--v-theme-warning), 0.035);
}

.task-row-main,
.milestone-actions,
.goal-actions {
  min-inline-size: 0;
}

.tree-meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  margin-block-start: 0.25rem;
}

.empty-tasks {
  padding: 0.5rem 0;
}

@media (max-width: 767px) {
  .milestone-panels :deep(.v-expansion-panel-title),
  .goal-panels :deep(.v-expansion-panel-title) {
    padding: 0.875rem 1rem;
  }

  .milestone-panels :deep(.v-expansion-panel-text__wrapper),
  .goal-panels :deep(.v-expansion-panel-text__wrapper) {
    padding: 0 0.875rem 0.875rem;
  }

  .milestone-panel-body,
  .goal-panel-body {
    padding: 0.75rem !important;
  }

  .goal-panels :deep(.v-expansion-panel + .v-expansion-panel) {
    margin-block-start: 0.5rem;
  }

  .milestone-actions,
  .goal-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .milestone-actions :deep(.v-btn),
  .goal-actions :deep(.v-btn) {
    max-inline-size: 100%;
    min-block-size: 30px;
  }

  .task-row {
    padding: 0.5rem 0.625rem;
    background: rgba(var(--v-theme-surface), 0.22);
  }

  .tree-meta {
    overflow-wrap: anywhere;
  }

  .section-add-btn,
  .milestone-add-goal-btn,
  .goal-add-task-btn {
    font-size: 0.75rem;
  }

  .section-add-btn :deep(.v-btn__content),
  .milestone-add-goal-btn :deep(.v-btn__content),
  .goal-add-task-btn :deep(.v-btn__content) {
    gap: 0.25rem;
  }

  .section-add-btn {
    align-self: flex-start;
  }

  .section-add-btn :deep(.v-btn),
  .milestone-add-goal-btn :deep(.v-btn),
  .goal-add-task-btn :deep(.v-btn) {
    padding-inline: 0.625rem;
  }

  .section-add-btn :deep(.v-btn__prepend),
  .milestone-add-goal-btn :deep(.v-btn__prepend),
  .goal-add-task-btn :deep(.v-btn__prepend) {
    margin-inline-end: 0;
  }

  .milestone-add-goal-btn,
  .goal-add-task-btn {
    letter-spacing: 0;
  }

  .task-row-main .font-weight-medium {
    line-height: 1.25;
  }

  .tree-meta {
    font-size: 0.75rem;
    margin-block-start: 0.125rem;
  }

  .empty-tasks {
    padding: 0.25rem 0 0;
  }
}
</style>
