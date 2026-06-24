<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ToDo } from "@/data/schema";
import type {
  JobGoal,
  JobMilestone,
  JobProperties,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
interface Props {
  jobId: number | string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "open-add-todo", payload: { initial: Record<string, any> }): void;
  (e: "open-edit-todo", todoId: number | string): void;
  (e: "status-automation-trigger", action: string): void;
}>();
const jobsStore = useJobsStore();
const configStore = useConfigStore();
configStore.init();
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
    startDate: null as string | null,
    dueDate: null as string | null,
    dateOverride: false,
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
    startDate: null as string | null,
    dueDate: null as string | null,
    dateOverride: false,
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

type JobTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
};

type WorkStatus = "Not Started" | "In Progress" | "On Hold" | "Completed";

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

const generalTasks = computed(() =>
  jobTodos.value.filter((todo) => {
    const milestoneId = String(todo.milestoneId ?? "").trim();
    const goalId = String(todo.goalId ?? "").trim();

    return !milestoneId && !goalId;
  }),
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

const dueWarningDays = computed(() =>
  Math.max(0, Number(configStore.configurations?.crm?.jobDueWarningDays ?? 5)),
);

const isFutureDate = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
};

const isDueSoon = (value?: string | null) => {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 && diffDays <= dueWarningDays.value;
};

const isTaskLocked = (task: JobTodo) => isFutureDate((task as any).startAt);
const taskStartAt = (task: JobTodo) => (task as any).startAt ?? null;

const validDateValue = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const earliestDate = (values: Array<string | null | undefined>) => {
  const dates = values
    .map((value) => validDateValue(value))
    .filter((value): value is Date => value !== null);
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString();
};

const latestDate = (values: Array<string | null | undefined>) => {
  const dates = values
    .map((value) => validDateValue(value))
    .filter((value): value is Date => value !== null);
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
};

const dateKey = (value?: string | null) => {
  const date = validDateValue(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
};

const datesConflict = (
  enteredStartDate: string | null | undefined,
  enteredDueDate: string | null | undefined,
  derivedStartDate: string | null,
  derivedDueDate: string | null,
) => {
  return Boolean(
    (derivedStartDate && dateKey(enteredStartDate) !== dateKey(derivedStartDate)) ||
      (derivedDueDate && dateKey(enteredDueDate) !== dateKey(derivedDueDate)),
  );
};

const goalDerivedStartDate = (goal: JobGoal & { tasks: JobTodo[] }) =>
  earliestDate(goal.tasks.map((task) => taskStartAt(task)));

const goalDerivedDueDate = (goal: JobGoal & { tasks: JobTodo[] }) =>
  latestDate(goal.tasks.map((task) => task.dueAt));

const goalEffectiveStartDate = (goal: JobGoal & { tasks: JobTodo[] }) =>
  goal.dateOverride
    ? (goal.startDate ?? null)
    : (goalDerivedStartDate(goal) ?? goal.startDate ?? null);

const goalEffectiveDueDate = (goal: JobGoal & { tasks: JobTodo[] }) =>
  goal.dateOverride
    ? (goal.dueDate ?? null)
    : (goalDerivedDueDate(goal) ?? goal.dueDate ?? null);

const milestoneDerivedStartDate = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) =>
  earliestDate([
    ...milestone.tasks.map((task) => taskStartAt(task)),
    ...milestone.goals.map((goal) => goalEffectiveStartDate(goal)),
  ]);

const milestoneDerivedDueDate = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) =>
  latestDate([
    ...milestone.tasks.map((task) => task.dueAt),
    ...milestone.goals.map((goal) => goalEffectiveDueDate(goal)),
  ]);

const milestoneEffectiveStartDate = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) =>
  milestone.dateOverride
    ? (milestone.startDate ?? null)
    : (milestoneDerivedStartDate(milestone) ?? milestone.startDate ?? null);

const milestoneEffectiveDueDate = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) =>
  milestone.dateOverride
    ? (milestone.dueDate ?? null)
    : (milestoneDerivedDueDate(milestone) ?? milestone.dueDate ?? null);

const deriveStatusFromTasks = (
  startDate: string | null | undefined,
  tasks: JobTodo[],
): WorkStatus => {
  if (isFutureDate(startDate)) return "Not Started";
  if (!tasks.length) return "Not Started";
  if (tasks.some((task) => task.status === "in_progress"))
    return "In Progress";
  if (tasks.every((task) => task.status === "completed")) return "Completed";
  if (tasks.some((task) => task.status === "completed")) return "On Hold";
  return "Not Started";
};

const completedTaskCount = (tasks: JobTodo[]) =>
  tasks.filter((task) => task.status === "completed").length;

const goalStatus = (goal: JobGoal & { tasks: JobTodo[] }) =>
  deriveStatusFromTasks(goalEffectiveStartDate(goal), goal.tasks);

const milestoneStatus = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) => {
  const allTasks = [
    ...milestone.tasks,
    ...milestone.goals.flatMap((goal) => goal.tasks),
  ];
  if (isFutureDate(milestoneEffectiveStartDate(milestone)))
    return "Not Started";
  if (!allTasks.length) return "Not Started";
  if (
    milestone.goals.some((goal) => goalStatus(goal) === "In Progress") ||
    allTasks.some((task) => task.status === "in_progress")
  )
    return "In Progress";
  if (allTasks.every((task) => task.status === "completed")) return "Completed";
  if (
    milestone.goals.some((goal) => goalStatus(goal) === "On Hold") ||
    allTasks.some((task) => task.status === "completed")
  )
    return "On Hold";
  return "Not Started";
};

const workStatusColor = (status: WorkStatus) => {
  switch (status) {
    case "Completed":
      return "success";
    case "In Progress":
      return "primary";
    case "On Hold":
      return "secondary";
    case "Not Started":
    default:
      return "secondary";
  }
};

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
const dateOverrideDialog = reactive({
  visible: false,
  kind: "milestone" as "milestone" | "goal",
  derivedStartDate: null as string | null,
  derivedDueDate: null as string | null,
  enteredStartDate: null as string | null,
  enteredDueDate: null as string | null,
  applyChildDates: null as null | (() => void),
  keepManualDates: null as null | (() => void),
});

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
    startDate: null,
    dueDate: null,
    dateOverride: false,
    priority: "Normal",
    note: "",
  };
};
const resetGoalDraft = () => {
  goalDialog.draft = {
    id: undefined,
    milestoneId: undefined,
    name: "",
    startDate: null,
    dueDate: null,
    dateOverride: false,
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
  const milestoneTree = milestone as JobMilestone & {
    tasks: JobTodo[];
    goals: Array<JobGoal & { tasks: JobTodo[] }>;
  };
  const useManualDates = Boolean(milestone.dateOverride);
  milestoneDialog.draft = {
    id: milestone.id,
    name: milestone.name,
    startDate: useManualDates
      ? (milestone.startDate ?? null)
      : milestoneEffectiveStartDate(milestoneTree),
    dueDate: useManualDates
      ? (milestone.dueDate ?? null)
      : milestoneEffectiveDueDate(milestoneTree),
    dateOverride: Boolean(milestone.dateOverride),
    priority: milestone.priority,
    note: milestone.note ?? "",
  };
  nextTick(() => milestoneFormRef.value?.resetValidation());
};

const closeDateOverrideDialog = () => {
  dateOverrideDialog.visible = false;
  dateOverrideDialog.applyChildDates = null;
  dateOverrideDialog.keepManualDates = null;
};

const promptDateOverride = (
  kind: "milestone" | "goal",
  enteredStartDate: string | null | undefined,
  enteredDueDate: string | null | undefined,
  derivedStartDate: string | null,
  derivedDueDate: string | null,
  applyChildDates: () => void,
  keepManualDates: () => void,
) => {
  dateOverrideDialog.kind = kind;
  dateOverrideDialog.enteredStartDate = enteredStartDate ?? null;
  dateOverrideDialog.enteredDueDate = enteredDueDate ?? null;
  dateOverrideDialog.derivedStartDate = derivedStartDate;
  dateOverrideDialog.derivedDueDate = derivedDueDate;
  dateOverrideDialog.applyChildDates = applyChildDates;
  dateOverrideDialog.keepManualDates = keepManualDates;
  dateOverrideDialog.visible = true;
};

const confirmUseChildDates = () => {
  dateOverrideDialog.applyChildDates?.();
  closeDateOverrideDialog();
};

const confirmKeepManualDates = () => {
  dateOverrideDialog.keepManualDates?.();
  closeDateOverrideDialog();
};

const cancelDateOverride = () => closeDateOverrideDialog();

const finishMilestoneSave = (message: string, action: string) => {
  notifications.push(message, "success", 3000);
  emit("status-automation-trigger", action);
  milestoneDialog.visible = false;
  milestoneTargetId.value = null;
  resetMilestoneDraft();
  nextTick(() => milestoneFormRef.value?.resetValidation());
};

const commitMilestone = (
  patch: Partial<JobMilestone>,
  message: string,
  action: string,
) => {
  if (!job.value) return;
  if (milestoneDialog.mode === "create") {
    const createdMilestone = jobsStore.addMilestone(job.value.id, patch);
    if (createdMilestone?.id !== undefined) {
      expandedMilestones.value = [
        ...expandedMilestones.value,
        createdMilestone.id,
      ];
    }
  } else if (milestoneTargetId.value !== null) {
    jobsStore.updateMilestone(job.value.id, milestoneTargetId.value, patch);
  }
  finishMilestoneSave(message, action);
};

const saveMilestone = async () => {
  if (!job.value) return;
  const { valid } = (await milestoneFormRef.value?.validate()) ?? {
    valid: true,
  };
  if (!valid) return;
  const { id, ...draftWithoutId } = milestoneDialog.draft;
  const action =
    milestoneDialog.mode === "create" ? "Milestone added" : "Milestone updated";
  const message =
    milestoneDialog.mode === "create" ? "Milestone added" : "Milestone updated";

  const currentTree = milestoneGoalTree.value.find((milestone) =>
    milestoneDialog.mode === "edit"
      ? String(milestone.id) === String(milestoneTargetId.value)
      : false,
  );
  const derivedStartDate = currentTree
    ? milestoneDerivedStartDate(currentTree)
    : null;
  const derivedDueDate = currentTree ? milestoneDerivedDueDate(currentTree) : null;
  const hasConflict =
    !draftWithoutId.dateOverride &&
    datesConflict(
      draftWithoutId.startDate,
      draftWithoutId.dueDate,
      derivedStartDate,
      derivedDueDate,
    );

  if (hasConflict) {
    promptDateOverride(
      "milestone",
      draftWithoutId.startDate,
      draftWithoutId.dueDate,
      derivedStartDate,
      derivedDueDate,
      () =>
        commitMilestone(
          {
            ...draftWithoutId,
            startDate: derivedStartDate ?? draftWithoutId.startDate,
            dueDate: derivedDueDate ?? draftWithoutId.dueDate,
            dateOverride: false,
          },
          message,
          action,
        ),
      () =>
        commitMilestone(
          {
            ...draftWithoutId,
            dateOverride: true,
          },
          message,
          action,
        ),
    );
    return;
  }

  commitMilestone(draftWithoutId, message, action);
};
const deleteMilestone = (milestone: JobMilestone) => {
  if (!job.value) return;
  jobsStore.removeMilestone(job.value.id, milestone.id);
  expandedMilestones.value = expandedMilestones.value.filter(
    (id) => id !== milestone.id,
  );
  notifications.push("Milestone removed", "success", 3000);
  emit("status-automation-trigger", "Milestone removed");
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
  const goalTree = goal as JobGoal & { tasks: JobTodo[] };
  const useManualDates = Boolean(goal.dateOverride);
  goalDialog.draft = {
    id: goal.id,
    milestoneId: goal.milestoneId ?? undefined,
    name: goal.name,
    startDate: useManualDates
      ? (goal.startDate ?? null)
      : goalEffectiveStartDate(goalTree),
    dueDate: useManualDates
      ? (goal.dueDate ?? null)
      : goalEffectiveDueDate(goalTree),
    dateOverride: Boolean(goal.dateOverride),
    priority: goal.priority,
    note: goal.note ?? "",
  };
  nextTick(() => goalFormRef.value?.resetValidation());
};

const finishGoalSave = (message: string, action: string) => {
  notifications.push(message, "success", 3000);
  emit("status-automation-trigger", action);
  goalDialog.visible = false;
  goalTargetId.value = null;
  resetGoalDraft();
  nextTick(() => goalFormRef.value?.resetValidation());
};

const commitGoal = (
  patch: Partial<JobGoal>,
  message: string,
  action: string,
) => {
  if (!job.value) return;
  if (goalDialog.mode === "create") {
    jobsStore.addGoal(job.value.id, patch);
  } else if (goalTargetId.value !== null) {
    jobsStore.updateGoal(job.value.id, goalTargetId.value, patch);
  }
  finishGoalSave(message, action);
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
  const { id, ...draftWithoutId } = goalDialog.draft;
  const action = goalDialog.mode === "create" ? "Goal added" : "Goal updated";
  const message = goalDialog.mode === "create" ? "Goal added" : "Goal updated";

  const currentGoal = milestoneGoalTree.value
    .flatMap((milestone) => milestone.goals)
    .find((goal) =>
      goalDialog.mode === "edit"
        ? String(goal.id) === String(goalTargetId.value)
        : false,
    );
  const derivedStartDate = currentGoal ? goalDerivedStartDate(currentGoal) : null;
  const derivedDueDate = currentGoal ? goalDerivedDueDate(currentGoal) : null;
  const hasConflict =
    !draftWithoutId.dateOverride &&
    datesConflict(
      draftWithoutId.startDate,
      draftWithoutId.dueDate,
      derivedStartDate,
      derivedDueDate,
    );

  if (hasConflict) {
    promptDateOverride(
      "goal",
      draftWithoutId.startDate,
      draftWithoutId.dueDate,
      derivedStartDate,
      derivedDueDate,
      () =>
        commitGoal(
          {
            ...draftWithoutId,
            startDate: derivedStartDate ?? draftWithoutId.startDate,
            dueDate: derivedDueDate ?? draftWithoutId.dueDate,
            dateOverride: false,
          },
          message,
          action,
        ),
      () =>
        commitGoal(
          {
            ...draftWithoutId,
            dateOverride: true,
          },
          message,
          action,
        ),
    );
    return;
  }

  commitGoal(draftWithoutId, message, action);
};
const deleteGoal = (goal: JobGoal) => {
  if (!job.value) return;
  jobsStore.removeGoal(job.value.id, goal.id);
  expandedGoals.value = expandedGoals.value.filter((id) => id !== goal.id);
  notifications.push("Goal removed", "success", 3000);
  emit("status-automation-trigger", "Goal removed");
};
const buildTaskTitlePrefix = (
  projectName?: string | null,
  parentName?: string | null,
) => {
  const project = projectName?.trim() || "PROJECT NAME";
  const parent = parentName?.trim() || "TASK";
  return `${project} | ${parent} | `;
};

const openCreateTodoForMilestone = (milestone: JobMilestone) => {
  if (!job.value) return;
  const milestoneTree = milestoneGoalTree.value.find(
    (entry) => String(entry.id) === String(milestone.id),
  );
  emit("open-add-todo", {
    initial: {
      title: buildTaskTitlePrefix(job.value.name, milestone.name),
      collaborators: [],
      notes: `Created for milestone: ${milestone.name}`,
      dueAt:
        (milestoneTree ? milestoneEffectiveDueDate(milestoneTree) : milestone.dueDate) ||
        new Date().toISOString(),
      startAt:
        (milestoneTree ? milestoneEffectiveStartDate(milestoneTree) : milestone.startDate) ||
        job.value.startDate ||
        null,
      completionMinutes: null,
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
    },
  });
};

const openCreateTodoForGoal = (goal: JobGoal) => {
  if (!job.value) return;
  const goalTree = milestoneGoalTree.value
    .flatMap((milestone) => milestone.goals)
    .find((entry) => String(entry.id) === String(goal.id));
  emit("open-add-todo", {
    initial: {
      title: buildTaskTitlePrefix(job.value.name, goal.name),
      collaborators: [],
      notes: `Created for goal: ${goal.name}`,
      dueAt:
        (goalTree ? goalEffectiveDueDate(goalTree) : goal.dueDate) ||
        new Date().toISOString(),
      startAt:
        (goalTree ? goalEffectiveStartDate(goalTree) : goal.startDate) ||
        job.value.startDate ||
        null,
      completionMinutes: null,
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
    },
  });
};

const expandedTaskIds = ref<Array<number | string>>([]);
const isTaskExpanded = (task: JobTodo) =>
  expandedTaskIds.value.some((id) => String(id) === String(task.id));
const toggleTaskSteps = (task: JobTodo) => {
  if (!hasTaskSteps(task)) return;
  expandedTaskIds.value = isTaskExpanded(task)
    ? expandedTaskIds.value.filter((id) => String(id) !== String(task.id))
    : [...expandedTaskIds.value, task.id];
};
const priorityColor = (priority: "Low" | "Normal" | "High") => {
  return priority === "High"
    ? "error"
    : priority === "Low"
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
const todoStatusTextClass = (status?: string) =>
  status === "in_progress"
    ? "text-primary"
    : status === "for_review"
      ? "text-warning"
      : status === "completed"
        ? "text-success"
        : "text-medium-emphasis";
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
const completedStepCount = (task: JobTodo) =>
  (task.steps || []).filter((step) => step.status === "completed").length;
const hasTaskSteps = (task: JobTodo) => Boolean(task.steps?.length);
const taskNotesPreview = (task: JobTodo) => {
  const value = String(task.notes ?? "").trim();
  if (!value) return "-";
  return value.length > 36 ? `${value.slice(0, 36)}...` : value;
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
                      :color="workStatusColor(milestoneStatus(milestone))"
                      size="small"
                      label
                    >
                      {{ milestoneStatus(milestone) }}
                    </VChip>
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Start {{ formatDate(milestoneEffectiveStartDate(milestone)) }}
                    <span
                      :class="{
                        'text-warning font-weight-medium': isDueSoon(milestoneEffectiveDueDate(milestone)),
                      }"
                    >
                      | Due {{ formatDate(milestoneEffectiveDueDate(milestone)) }}
                    </span>
                    | {{ completedTaskCount([
                      ...milestone.tasks,
                      ...milestone.goals.flatMap((goal) => goal.tasks),
                    ]) }}/{{ [
                      ...milestone.tasks,
                      ...milestone.goals.flatMap((goal) => goal.tasks),
                    ].length }} tasks completed
                    <span>
                      | {{ milestone.goals.length }} Goal<span
                        v-if="milestone.goals.length !== 1"
                        >s</span
                      >
                    </span>
                    <VChip
                      v-if="milestone.dateOverride"
                      size="x-small"
                      label
                      color="warning"
                      variant="tonal"
                      class="ms-1"
                    >
                      Manual dates
                      <VTooltip activator="parent" location="top">
                        Parent dates were manually kept instead of child rollup.
                      </VTooltip>
                    </VChip>
                  </div>
                  <div
                    v-if="milestone.note"
                    class="text-body-2 text-medium-emphasis mt-1"
                  >
                    {{ milestone.note }}
                  </div>
                </div>

                <div
                  class="d-flex align-center gap-3 milestone-actions"
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
                    <VTooltip activator="parent" location="top">
                      Show more
                    </VTooltip>
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
                  <template
                    v-for="task in milestone.tasks"
                    :key="task.id"
                  >
                    <div
                      class="job-task-row"
                      @click="emit('open-edit-todo', task.id)"
                    >
                      <div class="job-task-priority">
                        <VIcon
                          :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                          size="20"
                          color="warning"
                        />
                      </div>

                      <div class="job-task-main">
                        <div class="job-task-chevron-slot">
                          <VBtn
                            v-if="hasTaskSteps(task)"
                            icon
                            variant="text"
                            size="small"
                            class="job-task-chevron-btn"
                            @click.stop="toggleTaskSteps(task)"
                          >
                            <VIcon
                              :icon="isTaskExpanded(task) ? 'tabler-chevron-up' : 'tabler-chevron-down'"
                              size="18"
                            />
                            <VTooltip activator="parent" location="top">
                              {{ isTaskExpanded(task) ? "Hide subtasks" : "Show subtasks" }}
                            </VTooltip>
                          </VBtn>
                          <div v-else class="job-task-chevron-placeholder" />
                        </div>
                        <div class="job-task-copy">
                          <h6 class="text-base mb-0">{{ task.title }}</h6>
                          <div class="text-sm text-medium-emphasis">
                            {{ taskNotesPreview(task) }}
                          </div>
                          <div
                            v-if="hasTaskSteps(task)"
                            class="text-xs text-medium-emphasis mt-1"
                          >
                            <VIcon icon="tabler-subtask" size="18" class="mr-2" />
                            Subtasks: {{ completedStepCount(task) }}/{{ task.steps.length }}
                          </div>
                        </div>
                      </div>

                      <div class="job-task-date">
                        {{ formatDate(task.dueAt) }}
                      </div>

                      <div class="job-task-assigned">
                        <div
                          v-if="task.collaborators?.length"
                          class="v-avatar-group demo-avatar-group"
                        >
                          <VAvatar
                            v-for="collaborator in task.collaborators.slice(0, 3)"
                            :key="collaborator.id"
                            :size="40"
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
                            v-if="task.collaborators.length > 3"
                            :size="40"
                            color="secondary"
                          >
                            +{{ task.collaborators.length - 3 }}
                          </VAvatar>
                        </div>
                        <span v-else>-</span>
                      </div>

                      <div class="job-task-status">
                        <span
                          class="text-body-1"
                          :class="todoStatusTextClass(task.status)"
                        >
                          {{ isTaskLocked(task) ? "Scheduled" : todoStatusLabel(task.status) }}
                        </span>
                      </div>
                    </div>
                    <div v-if="isTaskExpanded(task)" class="job-subtasks-row">
                      <div
                        v-for="step in task.steps"
                        :key="step.id"
                        class="job-subtask-row"
                      >
                        <VIcon
                          :icon="step.status === 'completed' ? 'tabler-check' : 'tabler-subtask'"
                          size="16"
                          :color="step.status === 'completed' ? 'success' : undefined"
                        />
                        <div class="job-subtask-copy">
                          <span class="font-weight-medium">{{ step.title }}</span>
                          <span class="text-caption text-medium-emphasis">
                            {{ formatDate(step.dueAt) }} | {{ todoStatusLabel(step.status) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </template>
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
                              :color="workStatusColor(goalStatus(goal))"
                              size="x-small"
                              label
                            >
                              {{ goalStatus(goal) }}
                            </VChip>
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            Start {{ formatDate(goalEffectiveStartDate(goal)) }}
                            <span
                              :class="{
                                'text-warning font-weight-medium': isDueSoon(goalEffectiveDueDate(goal)),
                              }"
                            >
                              | Due {{ formatDate(goalEffectiveDueDate(goal)) }}
                            </span>
                            | {{ completedTaskCount(goal.tasks) }}/{{
                              goal.tasks.length
                            }}
                            tasks completed
                            <VChip
                              v-if="goal.dateOverride"
                              size="x-small"
                              label
                              color="warning"
                              variant="tonal"
                              class="ms-1"
                            >
                              Manual dates
                              <VTooltip activator="parent" location="top">
                                Parent dates were manually kept instead of child rollup.
                              </VTooltip>
                            </VChip>
                          </div>
                          <div
                            v-if="goal.note"
                            class="text-body-2 text-medium-emphasis mt-1"
                          >
                            {{ goal.note }}
                          </div>
                        </div>

                        <div
                          class="d-flex align-center gap-3 goal-actions"
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
                            <VTooltip activator="parent" location="top">
                              Show more
                            </VTooltip>
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
                            <template
                              v-for="task in goal.tasks"
                              :key="task.id"
                            >
                              <div
                                class="job-task-row"
                                @click="emit('open-edit-todo', task.id)"
                              >
                                <div class="job-task-priority">
                                  <VIcon
                                    :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                                    size="20"
                                    color="warning"
                                  />
                                </div>
                              <div class="job-task-main">
                                <div class="job-task-chevron-slot">
                                  <VBtn
                                    v-if="hasTaskSteps(task)"
                                    icon
                                    variant="text"
                                    size="small"
                                    class="job-task-chevron-btn"
                                    @click.stop="toggleTaskSteps(task)"
                                  >
                                    <VIcon
                                      :icon="isTaskExpanded(task) ? 'tabler-chevron-up' : 'tabler-chevron-down'"
                                      size="18"
                                    />
                                    <VTooltip activator="parent" location="top">
                                      {{ isTaskExpanded(task) ? "Hide subtasks" : "Show subtasks" }}
                                    </VTooltip>
                                  </VBtn>
                                  <div v-else class="job-task-chevron-placeholder" />
                                </div>
                                <div class="job-task-copy">
                                  <h6 class="text-base mb-0">{{ task.title }}</h6>
                                  <div class="text-sm text-medium-emphasis">
                                    {{ taskNotesPreview(task) }}
                                  </div>
                                  <div
                                    v-if="hasTaskSteps(task)"
                                    class="text-xs text-medium-emphasis mt-1"
                                  >
                                    <VIcon icon="tabler-subtask" size="18" class="mr-2" />
                                    Subtasks: {{ completedStepCount(task) }}/{{ task.steps.length }}
                                  </div>
                                </div>
                              </div>
                              <div class="job-task-date">
                                {{ formatDate(task.dueAt) }}
                              </div>
                              <div class="job-task-assigned">
                                <div
                                  v-if="task.collaborators?.length"
                                  class="v-avatar-group demo-avatar-group"
                                >
                                  <VAvatar
                                    v-for="collaborator in task.collaborators.slice(0, 3)"
                                    :key="collaborator.id"
                                    :size="40"
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
                                    v-if="task.collaborators.length > 3"
                                    :size="40"
                                    color="secondary"
                                  >
                                    +{{ task.collaborators.length - 3 }}
                                  </VAvatar>
                                </div>
                                <span v-else>-</span>
                              </div>
                              <div class="job-task-status">
                                <span
                                  class="text-body-1"
                                  :class="todoStatusTextClass(task.status)"
                                >
                                  {{ isTaskLocked(task) ? "Scheduled" : todoStatusLabel(task.status) }}
                                </span>
                              </div>
                            </div>
                              <div v-if="isTaskExpanded(task)" class="job-subtasks-row">
                                <div
                                  v-for="step in task.steps"
                                  :key="step.id"
                                  class="job-subtask-row"
                                >
                                  <VIcon
                                    :icon="step.status === 'completed' ? 'tabler-check' : 'tabler-subtask'"
                                    size="16"
                                    :color="step.status === 'completed' ? 'success' : undefined"
                                  />
                                  <div class="job-subtask-copy">
                                    <span class="font-weight-medium">{{ step.title }}</span>
                                    <span class="text-caption text-medium-emphasis">
                                      {{ formatDate(step.dueAt) }} | {{ todoStatusLabel(step.status) }}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </template>
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

    <VCard>
      <VCardText>
        <div class="d-flex flex-column gap-1 mb-4">
          <h5 class="text-h5 mb-0">General Tasks</h5>
          <p class="text-body-2 text-medium-emphasis mb-0">
            To dos linked to this project outside milestones and goals appear
            here.
          </p>
        </div>

        <div v-if="generalTasks.length" class="d-flex flex-column gap-2">
          <template
            v-for="task in generalTasks"
            :key="task.id"
          >
            <div
              class="job-task-row"
              @click="emit('open-edit-todo', task.id)"
            >
              <div class="job-task-priority">
                <VIcon
                  :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                  size="20"
                  color="warning"
                />
              </div>
            <div class="job-task-main">
              <div class="job-task-chevron-slot">
                <VBtn
                  v-if="hasTaskSteps(task)"
                  icon
                  variant="text"
                  size="small"
                  class="job-task-chevron-btn"
                  @click.stop="toggleTaskSteps(task)"
                >
                  <VIcon
                    :icon="isTaskExpanded(task) ? 'tabler-chevron-up' : 'tabler-chevron-down'"
                    size="18"
                  />
                  <VTooltip activator="parent" location="top">
                    {{ isTaskExpanded(task) ? "Hide subtasks" : "Show subtasks" }}
                  </VTooltip>
                </VBtn>
                <div v-else class="job-task-chevron-placeholder" />
              </div>
              <div class="job-task-copy">
                <h6 class="text-base mb-0">{{ task.title }}</h6>
                <div class="text-sm text-medium-emphasis">
                  {{ taskNotesPreview(task) }}
                </div>
                <div
                  v-if="hasTaskSteps(task)"
                  class="text-xs text-medium-emphasis mt-1"
                >
                  <VIcon icon="tabler-subtask" size="18" class="mr-2" />
                  Subtasks: {{ completedStepCount(task) }}/{{ task.steps.length }}
                </div>
              </div>
            </div>
            <div class="job-task-date">
              {{ formatDate(task.dueAt) }}
            </div>
            <div class="job-task-assigned">
              <div
                v-if="task.collaborators?.length"
                class="v-avatar-group demo-avatar-group"
              >
                <VAvatar
                  v-for="collaborator in task.collaborators.slice(0, 3)"
                  :key="collaborator.id"
                  :size="40"
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
                  v-if="task.collaborators.length > 3"
                  :size="40"
                  color="secondary"
                >
                  +{{ task.collaborators.length - 3 }}
                </VAvatar>
              </div>
              <span v-else>-</span>
            </div>
            <div class="job-task-status">
              <span
                class="text-body-1"
                :class="todoStatusTextClass(task.status)"
              >
                {{ isTaskLocked(task) ? "Scheduled" : todoStatusLabel(task.status) }}
              </span>
            </div>
          </div>
            <div v-if="isTaskExpanded(task)" class="job-subtasks-row">
              <div
                v-for="step in task.steps"
                :key="step.id"
                class="job-subtask-row"
              >
                <VIcon
                  :icon="step.status === 'completed' ? 'tabler-check' : 'tabler-subtask'"
                  size="16"
                  :color="step.status === 'completed' ? 'success' : undefined"
                />
                <div class="job-subtask-copy">
                  <span class="font-weight-medium">{{ step.title }}</span>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(step.dueAt) }} | {{ todoStatusLabel(step.status) }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis empty-tasks">
          No general tasks linked to this project yet.
        </div>
      </VCardText>
    </VCard>
    <VDialog
      v-model="dateOverrideDialog.visible"
      max-width="560"
      persistent
      no-click-animation
    >
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Date conflict</VCardTitle>
        <VCardText>
          <p class="mb-4">
            This {{ dateOverrideDialog.kind }} has child work with different
            dates. Parent dates should follow their children unless you choose
            to keep your dates.
          </p>
          <div class="text-body-2 text-medium-emphasis">
            <div>
              Child start:
              {{ formatDate(dateOverrideDialog.derivedStartDate) }}
              | Entered start:
              {{ formatDate(dateOverrideDialog.enteredStartDate) }}
            </div>
            <div>
              Child due:
              {{ formatDate(dateOverrideDialog.derivedDueDate) }}
              | Entered due:
              {{ formatDate(dateOverrideDialog.enteredDueDate) }}
            </div>
          </div>
        </VCardText>
        <VCardActions class="justify-end flex-wrap gap-2">
          <VBtn variant="tonal" color="secondary" @click="cancelDateOverride">
            Cancel
          </VBtn>
          <VBtn variant="tonal" color="primary" @click="confirmUseChildDates">
            Use child dates
          </VBtn>
          <VBtn color="warning" @click="confirmKeepManualDates">
            Keep my dates
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
    <VDialog
      :model-value="milestoneDialog.visible"
      attach="body"
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
      attach="body"
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

.milestone-panel-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.goal-panels {
  margin-block-start: 0;
}

.milestone-direct-tasks {
  margin-block-end: 0;
}

.goal-icon {
  color: rgb(var(--v-theme-info));
}

.task-icon {
  color: rgb(var(--v-theme-warning));
}

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

.job-task-row {
  display: grid;
  align-items: center;
  border-block-end: 1px solid rgba(255, 255, 255, 6%);
  background: rgba(255, 255, 255, 2%);
  column-gap: 1rem;
  cursor: pointer;
  grid-template-columns:
    2rem minmax(16rem, 1fr) minmax(5.25rem, 0.45fr)
    minmax(8.75rem, 0.7fr) minmax(7rem, 0.48fr);
  min-block-size: 4.5rem;
  padding-block: 0.625rem;
  padding-inline: 0.75rem;
}

.job-task-row:first-child {
  border-block-start: 1px solid rgba(255, 255, 255, 6%);
}

.job-task-row:hover {
  background: rgba(255, 255, 255, 4%);
}

.job-task-priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
}

.job-task-main {
  display: grid;
  align-items: center;
  column-gap: 0.5rem;
  grid-template-columns: 1.625rem minmax(0, 1fr);
  min-inline-size: 0;
}

.job-task-chevron-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 1.625rem;
  color: rgb(var(--v-theme-primary));
  inline-size: 1.625rem;
}

.job-task-chevron-btn {
  block-size: 1.625rem !important;
  inline-size: 1.625rem !important;
  min-block-size: 1.625rem !important;
  min-inline-size: 1.625rem !important;
}

.job-task-chevron-placeholder {
  block-size: 1.625rem;
  inline-size: 1.625rem;
}

.job-task-copy {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.job-task-copy h6,
.job-task-copy div {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.job-task-date,
.job-task-status {
  min-inline-size: 0;
}

.job-task-date {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-weight: 600;
}

.job-task-assigned {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-inline-size: 0;
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

.job-subtasks-row {
  border-block-end: 1px solid rgba(255, 255, 255, 6%);
  background: rgba(255, 255, 255, 2.5%);
  padding-block: 0.5rem 0.75rem;
  padding-inline: calc(0.75rem + 3rem) 0.75rem;
}

.job-subtask-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding-block: 0.375rem;
}

.job-subtask-copy {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
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

  .section-add-btn {
    align-self: flex-start;
  }

  .section-add-btn :deep(.v-btn) {
    padding-inline: 0.625rem;
  }

  .section-add-btn :deep(.v-btn__prepend) {
    margin-inline-end: 0;
  }

  .job-task-row {
    align-items: flex-start;
    grid-template-columns: 2rem minmax(0, 1fr);
    row-gap: 0.5rem;
  }

  .job-task-date,
  .job-task-assigned,
  .job-task-status {
    grid-column: 2 / 3;
  }

  .job-task-assigned {
    flex-wrap: wrap;
  }

  .job-subtasks-row {
    padding-inline: calc(0.75rem + 2rem) 0.75rem;
  }

  .empty-tasks {
    padding-block: 0.25rem 0;
    padding-inline: 0;
  }
}
</style>
