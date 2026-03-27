<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
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
import { formatSystemDate } from "@core/utils/formatters";
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
    id: undefined as number | undefined,
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
    id: undefined as number | undefined,
    milestoneId: undefined as number | undefined,
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
  milestoneDialog.mode === "create" ? "Add Milestone" : "Edit Milestone",
);
const goalTitle = computed(() =>
  goalDialog.mode === "create" ? "Add Goal" : "Edit Goal",
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<any | null>(null);
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);

type JobTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
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

const milestoneTasksForMilestone = (milestoneId: number) =>
  jobTodos.value.filter(
    (todo) =>
      String(todo.milestoneId ?? "") === String(milestoneId) &&
      (todo.goalId === null ||
        todo.goalId === undefined ||
        String(todo.goalId).trim() === ""),
  );

const milestoneGoalTree = computed(() => {
  return milestones.value.map((milestone) => {
    const nestedGoals = goals.value
      .filter((goal) => String(goal.milestoneId) === String(milestone.id))
      .map((goal) => ({
        ...goal,
        tasks: jobTodos.value.filter(
          (todo) => String(todo.goalId ?? "") === String(goal.id),
        ),
      }));

    return {
      ...milestone,
      tasks: milestoneTasksForMilestone(milestone.id),
      goals: nestedGoals,
    };
  });
});

const shouldExpandGoal = (goalId: number) => {
  const tasks = jobTodos.value.filter(
    (todo) => String(todo.goalId ?? "") === String(goalId),
  );

  if (!tasks.length) return false;

  return tasks.some((task) => task.status !== "completed");
};

const shouldExpandMilestone = (milestoneId: number) => {
  const directTasks = milestoneTasksForMilestone(milestoneId);
  if (
    directTasks.length &&
    directTasks.some((task) => task.status !== "completed")
  ) {
    return true;
  }

  return goals.value
    .filter((goal) => String(goal.milestoneId) === String(milestoneId))
    .some((goal) => shouldExpandGoal(goal.id));
};

const milestoneFormRef = ref<VForm>();
const goalFormRef = ref<VForm>();
const isCreatingGoal = computed(() => goalDialog.mode === "create");
const expandedMilestones = ref<Array<number>>([]);
const expandedGoals = ref<Array<number>>([]);

const goalIdsForMilestone = (milestoneId: number) =>
  goals.value
    .filter((goal) => String(goal.milestoneId) === String(milestoneId))
    .filter((goal) => shouldExpandGoal(goal.id))
    .map((goal) => goal.id);

watch(
  [milestones, goals, jobTodos],
  ([nextMilestones], previousValue) => {
    const previousMilestones = previousValue?.[0];
    const nextIds = nextMilestones.map((milestone) => milestone.id);
    const eligibleIds = nextIds.filter((id) => shouldExpandMilestone(id));

    if (!previousMilestones?.length) {
      expandedMilestones.value = eligibleIds;
      expandedGoals.value = eligibleIds.flatMap((milestoneId) =>
        goalIdsForMilestone(milestoneId),
      );
      return;
    }

    const previousIds = new Set(
      previousMilestones.map((milestone) => milestone.id),
    );
    const preservedIds = expandedMilestones.value.filter((id) =>
      eligibleIds.includes(id),
    );
    const addedIds = eligibleIds.filter((id) => !previousIds.has(id));

    expandedMilestones.value = [...new Set([...preservedIds, ...addedIds])];
  },
  { immediate: true },
);

watch(
  expandedMilestones,
  (milestoneIds) => {
    const expandedGoalIds = milestoneIds.flatMap((milestoneId) =>
      goalIdsForMilestone(milestoneId),
    );

    expandedGoals.value = [
      ...new Set([...expandedGoals.value, ...expandedGoalIds]),
    ];
  },
  { deep: true },
);

watch(
  [goals, jobTodos],
  ([nextGoals], previousValue) => {
    const previousGoals = previousValue?.[0];
    const nextIds = nextGoals.map((goal) => goal.id);

    if (!previousGoals?.length) {
      expandedGoals.value = expandedMilestones.value.flatMap((milestoneId) =>
        goalIdsForMilestone(milestoneId),
      );
      return;
    }

    const milestoneExpandedGoalIds = expandedMilestones.value.flatMap(
      (milestoneId) => goalIdsForMilestone(milestoneId),
    );

    expandedGoals.value = [
      ...new Set(
        [
          ...expandedGoals.value.filter((id) => nextIds.includes(id)),
          ...milestoneExpandedGoalIds,
        ].filter((id) => nextIds.includes(id)),
      ),
    ];
  },
  { immediate: true },
);
const resetMilestoneDraft = () => {
  milestoneDialog.draft = {
    id: undefined,
    name: "",
    startDate: undefined,
    dueDate: undefined,
    priority: "Normal",
    note: "",
  };
};
const resetGoalDraft = () => {
  goalDialog.draft = {
    id: undefined,
    milestoneId: undefined,
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
    const { id, ...draftWithoutId } = milestoneDialog.draft;
    const createdMilestone = jobsStore.addMilestone(job.value.id, {
      ...draftWithoutId,
    });
    if (createdMilestone?.id !== undefined) {
      expandedMilestones.value = [
        ...expandedMilestones.value,
        createdMilestone.id,
      ];
    }
    notifications.push("Milestone added", "success", 3000);
  } else if (milestoneTargetId.value !== null) {
    const { id, ...draftWithoutId } = milestoneDialog.draft;
    jobsStore.updateMilestone(job.value.id, milestoneTargetId.value, {
      ...draftWithoutId,
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
    (id) => id !== milestone.id,
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
    milestoneId: goal.milestoneId ?? undefined,
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
  if (
    goalDialog.draft.milestoneId === null ||
    goalDialog.draft.milestoneId === undefined
  ) {
    return;
  }
  if (goalDialog.mode === "create") {
    const { id, ...draftWithoutId } = goalDialog.draft;
    jobsStore.addGoal(job.value.id, { ...draftWithoutId });
    notifications.push("Goal added", "success", 3000);
  } else if (goalTargetId.value !== null) {
    const { id, ...draftWithoutId } = goalDialog.draft;
    jobsStore.updateGoal(job.value.id, goalTargetId.value, {
      ...draftWithoutId,
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
const buildTaskTitlePrefix = (
  projectName?: string | null,
  parentName?: string | null,
) => {
  const project = projectName?.trim() || "PROJECT NAME";
  const parent = parentName?.trim() || "TASK";
  return `${project} | ${parent} | `;
};

const normalizeTaskTitle = (
  rawTitle: unknown,
  projectName?: string | null,
  parentName?: string | null,
) => {
  const prefix = buildTaskTitlePrefix(projectName, parentName);
  const prefixBase = prefix.trimEnd();
  const trimmedTitle = typeof rawTitle === "string" ? rawTitle.trim() : "";

  if (!trimmedTitle) return prefix;
  if (trimmedTitle === prefixBase) return prefix;
  if (trimmedTitle.startsWith(prefixBase)) return trimmedTitle;

  return `${prefix}${trimmedTitle}`;
};

const openCreateTodoForMilestone = (milestone: JobMilestone) => {
  if (!job.value) return;
  addTodoInitial.value = {
    title: buildTaskTitlePrefix(job.value.name, milestone.name),
    collaborators: [],
    notes: `Created for milestone: ${milestone.name}`,
    dueAt: milestone.dueDate || new Date().toISOString(),
    priority:
      milestone.priority === "High"
        ? "high"
        : milestone.priority === "Low"
          ? "low"
          : "normal",
    status: "pending",
    relatedTo: {
      id: job.value.id,
      name: job.value.name,
      type: "job",
    },
    milestoneId: milestone.id,
    goalId: null,
  };
  isAddTodoDrawerVisible.value = true;
};

const openCreateTodoForGoal = (goal: JobGoal) => {
  if (!job.value) return;
  addTodoInitial.value = {
    title: buildTaskTitlePrefix(job.value.name, goal.name),
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
    milestoneId: null,
  };
  isAddTodoDrawerVisible.value = true;
};

const normalizeTaskOwnership = (payload: any) => {
  if (
    payload?.goalId !== null &&
    payload?.goalId !== undefined &&
    String(payload.goalId).trim() !== ""
  ) {
    return {
      ...payload,
      goalId: payload.goalId,
      milestoneId: null,
    };
  }

  if (
    payload?.milestoneId !== null &&
    payload?.milestoneId !== undefined &&
    String(payload.milestoneId).trim() !== ""
  ) {
    return {
      ...payload,
      milestoneId: payload.milestoneId,
      goalId: null,
    };
  }

  return {
    ...payload,
    goalId: null,
    milestoneId: null,
  };
};

const onTodoCreated = (payload: any) => {
  const ownedPayload = normalizeTaskOwnership(payload);
  const goalName =
    goals.value.find((goal) => String(goal.id) === String(ownedPayload?.goalId))
      ?.name ?? null;
  const milestoneName =
    milestones.value.find(
      (milestone) => String(milestone.id) === String(ownedPayload?.milestoneId),
    )?.name ?? null;
  const normalizedPayload = {
    ...ownedPayload,
    title: normalizeTaskTitle(
      ownedPayload?.title,
      job.value?.name,
      goalName || milestoneName,
    ),
  };
  const created = todosStore.addTodo(normalizedPayload);
  notifications.push(
    `Task '${created?.title || normalizedPayload.title || "Untitled"}' created`,
    "success",
    3000,
  );
  isAddTodoDrawerVisible.value = false;
  addTodoInitial.value = null;
};
const toggleTaskCompleted = (taskId: number | string) => {
  const task = todosStore.byId(taskId);
  if (!task) return;

  todosStore.updateTodo(taskId, {
    status: task.status === "completed" ? "pending" : "completed",
  });
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
const todoPriorityLabel = (priority?: string) => {
  return priority === "high" ? "High" : priority === "low" ? "Low" : "Normal";
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
const collaboratorInitials = (name?: string | null) => {
  if (!name) return "?";
  const matches = name.trim().match(/\b\w/g) || [];
  return (
    matches.slice(0, 2).join("").toUpperCase() || name.slice(0, 1).toUpperCase()
  );
};
const formatDate = (value?: string | null) => {
  if (!value) return "--";
  try {
    return formatSystemDate(value);
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
            <h5 class="text-h5 mb-1">Milestones, Goals & Tasks</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Tasks can live directly under a milestone or under a goal.
            </p>
          </div>
          <VBtn
            class="section-add-btn"
            prepend-icon="tabler-plus"
            @click="openCreateMilestone"
          >
            Add Milestone
          </VBtn>
        </div>

        <div
          v-if="!milestoneGoalTree.length"
          class="text-center text-medium-emphasis py-6"
        >
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
                    <VTooltip :text="milestone.name" location="top">
                      <template #activator="{ props: tooltipProps }">
                        <div
                          v-bind="tooltipProps"
                          class="font-weight-medium truncate-title truncate-title--header"
                        >
                          {{ milestone.name }}
                        </div>
                      </template>
                    </VTooltip>
                    <VChip
                      :color="priorityColor(milestone.priority)"
                      size="small"
                      variant="text"
                    >
                      {{ milestone.priority }}
                    </VChip>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ milestone.goals.length }} Goal<span
                      v-if="milestone.goals.length !== 1"
                      >s</span
                    >
                    <span v-if="milestone.tasks.length">
                      | {{ milestone.tasks.length }} Task<span
                        v-if="milestone.tasks.length !== 1"
                        >s</span
                      >
                    </span>
                    | Due {{ formatDate(milestone.dueDate) }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis mt-1">
                    {{ milestone.note || "No milestone notes." }}
                  </div>
                </div>

                <div
                  class="d-flex align-center gap-2 milestone-actions"
                  @click.stop
                >
                  <VTooltip text="Add Task" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <VBtn
                        v-bind="tooltipProps"
                        class="milestone-add-task-btn"
                        size="x-small"
                        variant="text"
                        icon="tabler-checkbox"
                        @click="openCreateTodoForMilestone(milestone)"
                      />
                    </template>
                  </VTooltip>
                  <VTooltip text="Add Goal" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <VBtn
                        v-bind="tooltipProps"
                        class="milestone-add-goal-btn"
                        size="x-small"
                        variant="text"
                        icon="tabler-target-arrow"
                        @click="openCreateGoal(milestone.id)"
                      />
                    </template>
                  </VTooltip>
                  <VBtn icon variant="text" size="x-small">
                    <VIcon icon="tabler-dots-vertical" size="18" />
                    <VMenu activator="parent">
                      <VList>
                        <VListItem @click="openEditMilestone(milestone)">
                          <template #prepend
                            ><VIcon icon="tabler-edit"
                          /></template>
                          <VListItemTitle>Edit</VListItemTitle>
                        </VListItem>
                        <VListItem @click="deleteMilestone(milestone)">
                          <template #prepend
                            ><VIcon icon="tabler-trash" color="error"
                          /></template>
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
                <div
                  v-if="milestone.tasks.length"
                  class="d-flex flex-column gap-2 milestone-direct-tasks"
                >
                  <VCard
                    v-for="task in milestone.tasks"
                    :key="task.id"
                    class="task-row"
                    variant="tonal"
                  >
                    <div class="task-row-main">
                      <div class="task-row-left">
                        <VCheckbox
                          hide-details
                          density="compact"
                          :model-value="task.status === 'completed'"
                          @click.stop="toggleTaskCompleted(task.id)"
                        />

                        <div class="task-copy">
                          <VTooltip :text="task.title" location="top">
                            <template #activator="{ props: tooltipProps }">
                              <strong
                                v-bind="tooltipProps"
                                class="text-body-1 truncate-title"
                              >
                                {{ task.title }}
                              </strong>
                            </template>
                          </VTooltip>
                          <span class="text-sm"
                            >Due {{ formatDate(task.dueAt) }}</span
                          >
                          <span
                            v-if="task.notes"
                            class="text-sm text-medium-emphasis"
                          >
                            {{ task.notes }}
                          </span>
                        </div>
                      </div>

                      <div class="task-row-side">
                        <div
                          v-if="task.collaborators?.length"
                          class="v-avatar-group demo-avatar-group"
                        >
                          <VAvatar
                            v-for="collaborator in task.collaborators.slice(
                              0,
                              2,
                            )"
                            :key="collaborator.id"
                            :size="28"
                            color="primary"
                          >
                            <template v-if="collaborator.avatarUrl">
                              <VImg :src="collaborator.avatarUrl" />
                            </template>
                            <template v-else>
                              <span class="task-mono">
                                {{ collaboratorInitials(collaborator.name) }}
                              </span>
                            </template>
                            <VTooltip activator="parent" location="top">
                              {{ collaborator.name }}
                            </VTooltip>
                          </VAvatar>
                          <VAvatar
                            v-if="task.collaborators.length > 2"
                            :size="28"
                            color="secondary"
                          >
                            +{{ task.collaborators.length - 2 }}
                          </VAvatar>
                        </div>

                        <VChip
                          :color="todoPriorityColor(task.priority)"
                          size="x-small"
                          label
                          class="text-capitalize"
                          variant="text"
                        >
                          {{ todoPriorityLabel(task.priority) }}
                        </VChip>
                        <span
                          class="text-sm"
                          :class="{
                            'text-primary': task.status === 'in_progress',
                            'text-warning': task.status === 'for_review',
                            'text-medium-emphasis': task.status === 'pending',
                            'text-success': task.status === 'completed',
                          }"
                        >
                          {{ todoStatusLabel(task.status) }}
                        </span>
                      </div>
                    </div>
                  </VCard>
                </div>

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
                            <VTooltip :text="goal.name" location="top">
                              <template #activator="{ props: tooltipProps }">
                                <div
                                  v-bind="tooltipProps"
                                  class="font-weight-medium truncate-title truncate-title--header"
                                >
                                  {{ goal.name }}
                                </div>
                              </template>
                            </VTooltip>
                            <VChip
                              :color="priorityColor(goal.priority)"
                              size="x-small"
                              variant="text"
                            >
                              {{ goal.priority }}
                            </VChip>
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ goal.tasks.length }} Task<span
                              v-if="goal.tasks.length !== 1"
                              >s</span
                            >
                            | Due {{ formatDate(goal.dueDate) }}
                          </div>
                          <div class="text-body-2 text-medium-emphasis mt-1">
                            {{ goal.note || "No goal notes." }}
                          </div>
                        </div>

                        <div
                          class="d-flex align-center gap-1 goal-actions"
                          @click.stop
                        >
                          <VTooltip text="Add Task" location="top">
                            <template #activator="{ props: tooltipProps }">
                              <VBtn
                                v-bind="tooltipProps"
                                class="goal-add-task-btn"
                                size="x-small"
                                variant="text"
                                icon="tabler-checkbox"
                                @click="openCreateTodoForGoal(goal)"
                              />
                            </template>
                          </VTooltip>
                          <VBtn icon variant="text" size="x-small">
                            <VIcon icon="tabler-dots-vertical" size="18" />
                            <VMenu activator="parent">
                              <VList>
                                <VListItem @click="openEditGoal(goal)">
                                  <template #prepend
                                    ><VIcon icon="tabler-edit"
                                  /></template>
                                  <VListItemTitle>Edit</VListItemTitle>
                                </VListItem>
                                <VListItem @click="deleteGoal(goal)">
                                  <template #prepend
                                    ><VIcon icon="tabler-trash" color="error"
                                  /></template>
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
                          <div
                            v-if="goal.tasks.length"
                            class="d-flex flex-column gap-2"
                          >
                            <VCard
                              v-for="task in goal.tasks"
                              :key="task.id"
                              class="task-row"
                              variant="tonal"
                            >
                              <div class="task-row-main">
                                <div class="task-row-left">
                                  <VCheckbox
                                    hide-details
                                    density="compact"
                                    :model-value="task.status === 'completed'"
                                    @click.stop="toggleTaskCompleted(task.id)"
                                  />

                                  <div class="task-copy">
                                    <VTooltip :text="task.title" location="top">
                                      <template
                                        #activator="{ props: tooltipProps }"
                                      >
                                        <strong
                                          v-bind="tooltipProps"
                                          class="text-body-1 truncate-title"
                                        >
                                          {{ task.title }}
                                        </strong>
                                      </template>
                                    </VTooltip>
                                    <span class="text-sm"
                                      >Due {{ formatDate(task.dueAt) }}</span
                                    >
                                    <span
                                      v-if="task.notes"
                                      class="text-sm text-medium-emphasis"
                                    >
                                      {{ task.notes }}
                                    </span>
                                  </div>
                                </div>

                                <div class="task-row-side">
                                  <div
                                    v-if="task.collaborators?.length"
                                    class="v-avatar-group demo-avatar-group"
                                  >
                                    <VAvatar
                                      v-for="collaborator in task.collaborators.slice(
                                        0,
                                        2,
                                      )"
                                      :key="collaborator.id"
                                      :size="28"
                                      color="primary"
                                    >
                                      <template v-if="collaborator.avatarUrl">
                                        <VImg :src="collaborator.avatarUrl" />
                                      </template>
                                      <template v-else>
                                        <span class="task-mono">
                                          {{
                                            collaboratorInitials(
                                              collaborator.name,
                                            )
                                          }}
                                        </span>
                                      </template>
                                      <VTooltip
                                        activator="parent"
                                        location="top"
                                      >
                                        {{ collaborator.name }}
                                      </VTooltip>
                                    </VAvatar>
                                    <VAvatar
                                      v-if="task.collaborators.length > 2"
                                      :size="28"
                                      color="secondary"
                                    >
                                      +{{ task.collaborators.length - 2 }}
                                    </VAvatar>
                                  </div>

                                  <VChip
                                    :color="todoPriorityColor(task.priority)"
                                    size="x-small"
                                    label
                                    class="text-capitalize"
                                    variant="text"
                                  >
                                    {{ todoPriorityLabel(task.priority) }}
                                  </VChip>
                                  <span
                                    class="text-sm"
                                    :class="{
                                      'text-primary':
                                        task.status === 'in_progress',
                                      'text-warning':
                                        task.status === 'for_review',
                                      'text-medium-emphasis':
                                        task.status === 'pending',
                                      'text-success':
                                        task.status === 'completed',
                                    }"
                                  >
                                    {{ todoStatusLabel(task.status) }}
                                  </span>
                                </div>
                              </div>
                            </VCard>
                          </div>
                          <div
                            v-else
                            class="text-body-2 text-medium-emphasis empty-tasks"
                          >
                            No tasks linked to this goal yet.
                          </div>
                        </div>
                      </VCard>
                    </VExpansionPanelText>
                  </VExpansionPanel>
                </VExpansionPanels>

                <div
                  v-else-if="!milestone.tasks.length"
                  class="text-body-2 text-medium-emphasis"
                >
                  No goals or tasks under this milestone yet.
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
              <VCol cols="12">
                <DialogActionBar
                  save-type="submit"
                  @save="() => undefined"
                  @cancel="milestoneDialog.visible = false"
                />
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
              <VCol cols="12">
                <DialogActionBar
                  save-type="submit"
                  @save="() => undefined"
                  @cancel="goalDialog.visible = false"
                />
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
      autofocus-title-end
      :initial="addTodoInitial"
      @user-data="onTodoCreated"
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
  padding-block: 1rem;
  padding-inline: 1.25rem;
}

.milestone-panels :deep(.v-expansion-panel-text__wrapper),
.goal-panels :deep(.v-expansion-panel-text__wrapper) {
  padding-block: 0 1rem;
  padding-inline: 1rem;
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
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  block-size: 10px;
  inline-size: 10px;
  min-inline-size: 10px;
}

.milestone-panel-body,
.goal-panel-body {
  background: rgba(var(--v-theme-surface), 0.14);
  box-shadow: none;
}

.goal-panels {
  margin-block-start: 1rem;
}

.milestone-direct-tasks {
  margin-block-end: 1rem;
}

.goal-icon {
  color: rgb(var(--v-theme-info));
}

.task-icon {
  color: rgb(var(--v-theme-warning));
}

.task-row {
  border: 1px solid rgba(255, 255, 255, 6%);
  border-radius: 12px;
  background: rgba(255, 255, 255, 3%);
  padding-block: 0.75rem;
  padding-inline: 1rem;
}

.task-row-main,
.milestone-actions,
.goal-actions {
  min-inline-size: 0;
}

.milestone-actions,
.goal-actions {
  gap: 0.25rem !important;
}

.milestone-actions :deep(.v-btn),
.goal-actions :deep(.v-btn) {
  margin: 0;
}

.milestone-panel :deep(.v-expansion-panel-title__icon),
.goal-panel :deep(.v-expansion-panel-title__icon) {
  margin-inline-start: 0.25rem;
}

.task-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.task-row-left {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-inline-size: 0;
}

.task-copy {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-inline-size: 0;
}

.task-copy strong,
.task-copy span {
  overflow-wrap: anywhere;
}

.truncate-title {
  display: block;
  overflow: hidden;
  max-inline-size: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.truncate-title--header {
  max-inline-size: min(28rem, 100%);
}

.task-row-side {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.task-mono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 100%;
  font-size: 0.75rem;
  font-weight: 700;
  inline-size: 100%;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.empty-tasks {
  padding-block: 0.5rem;
  padding-inline: 0;
}

@media (max-width: 767px) {
  .milestone-panels :deep(.v-expansion-panel-title),
  .goal-panels :deep(.v-expansion-panel-title) {
    padding-block: 0.875rem;
    padding-inline: 1rem;
  }

  .milestone-panels :deep(.v-expansion-panel-text__wrapper),
  .goal-panels :deep(.v-expansion-panel-text__wrapper) {
    padding-block: 0 0.875rem;
    padding-inline: 0.875rem;
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.375rem;
  }

  .milestone-actions :deep(.v-btn),
  .goal-actions :deep(.v-btn) {
    max-inline-size: 100%;
    min-block-size: 30px;
  }

  .task-row {
    padding-block: 0.625rem;
    padding-inline: 0.75rem;
  }

  .section-add-btn {
    align-self: flex-start;
  }

  .section-add-btn :deep(.v-btn) {
    padding-inline: 0.625rem;
  }

  .section-add-btn :deep(.v-btn__prepend) {
    margin-inline-end: 0;
  }

  .task-row-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-row-left,
  .task-row-side {
    inline-size: 100%;
  }

  .task-row-side {
    justify-content: flex-start;
  }

  .empty-tasks {
    padding-block: 0.25rem 0;
    padding-inline: 0;
  }
}
</style>
