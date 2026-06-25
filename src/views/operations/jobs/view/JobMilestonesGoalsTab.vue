<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ToDo } from "@/data/schema";
import type { DealItem } from "@/plugins/fake-api/handlers/operations/deals/types";
import type {
  JobGoal,
  JobMilestone,
  JobProperties,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { useTodos } from "@/stores/todos";
import {
  jobWorkStatusChipStyle,
  jobWorkStatusColor,
} from "@/utils/jobStatusColors";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
import { getDealRetainerServiceLines } from "@/utils/dealDocumentDraft";
interface Props {
  jobId: number | string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "open-add-todo", payload: { initial: Record<string, any> }): void;
  (e: "open-edit-todo", todoId: number | string): void;
  (e: "update-todo", payload: Record<string, any>): void;
  (e: "status-automation-trigger", action: string): void;
}>();
const jobsStore = useJobsStore();
const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const dealsStore = useDealsStore();
dealsStore.init();
const configStore = useConfigStore();
configStore.init();
const employeesStore = useEmployeesStore();
employeesStore.init();
const notifications = useNotificationsStore();
const systemNotificationsStore = useSystemNotificationsStore();
systemNotificationsStore.init();
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
    source: null as JobGoal["source"],
  },
});
const retainerServicesDialog = reactive({
  visible: false,
  groupKey: "",
  periodNumber: 0,
  milestoneId: 0,
  goalId: null as number | string | null,
  periodSource: null as JobGoal["source"],
  selections: [] as RetainerServiceSelection[],
  customServices: [] as RetainerCustomServiceDraft[],
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
type GoalWithTasks = JobGoal & { tasks: JobTodo[] };
type MilestoneWithChildren = JobMilestone & {
  tasks: JobTodo[];
  goals: GoalWithTasks[];
};
type PeriodSection = {
  key: string;
  periodNumber: number;
  label: string;
  source: NonNullable<JobGoal["source"]>;
  goals: GoalWithTasks[];
};
type PeriodGroup = {
  key: string;
  kind: "recurrent" | "retainer";
  title: string;
  milestoneId: number;
  totalPeriods: number;
  sections: PeriodSection[];
};
type RetainerServiceSelection = {
  id: number | string;
  name: string;
  original: number;
  used: number;
  remaining: number;
  quantity: number;
  note?: string | null;
  kind?: "imported" | "custom" | null;
};
type RetainerCustomServiceDraft = {
  id: string;
  name: string;
  quantity: number;
  note: string;
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
const formatTaskStartDate = (task: JobTodo) => formatDate(taskStartAt(task));
const formatTaskEndDate = (task: JobTodo) => formatDate(task.dueAt);

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

const hasGoalDateConflict = (goal: JobGoal & { tasks: JobTodo[] }) =>
  datesConflict(
    goal.startDate,
    goal.dueDate,
    goalDerivedStartDate(goal),
    goalDerivedDueDate(goal),
  );

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

const hasMilestoneDateConflict = (milestone: JobMilestone & {
  tasks: JobTodo[];
  goals: Array<JobGoal & { tasks: JobTodo[] }>;
}) =>
  datesConflict(
    milestone.startDate,
    milestone.dueDate,
    milestoneDerivedStartDate(milestone),
    milestoneDerivedDueDate(milestone),
  );

const deriveStatusFromTasks = (
  startDate: string | null | undefined,
  tasks: JobTodo[],
): WorkStatus => {
  if (!tasks.length) return "Not Started";
  if (tasks.every((task) => task.status === "completed")) return "Completed";
  if (tasks.some((task) => task.status === "in_progress"))
    return "In Progress";
  if (
    tasks.some(
      (task) => task.status === "for_review" || Boolean((task as any).startedEarlyAt),
    )
  )
    return "In Progress";
  if (tasks.some((task) => task.status === "completed")) return "On Hold";
  if (isFutureDate(startDate)) return "Not Started";
  return "Not Started";
};

const completedTaskCount = (tasks: JobTodo[]) =>
  tasks.filter((task) => task.status === "completed").length;

const hasCompletedTasksOnly = (tasks: JobTodo[]) =>
  tasks.length > 0 && tasks.every((task) => task.status === "completed");

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
  const hasChildWork = milestone.tasks.length > 0 || milestone.goals.length > 0;
  if (!hasChildWork) return "Not Started";
  const directTasksComplete =
    !milestone.tasks.length || hasCompletedTasksOnly(milestone.tasks);
  const childGoalsComplete =
    !milestone.goals.length ||
    milestone.goals.every((goal) => goalStatus(goal) === "Completed");
  if (directTasksComplete && childGoalsComplete) return "Completed";
  if (
    milestone.goals.some((goal) => goalStatus(goal) === "In Progress") ||
    allTasks.some(
      (task) =>
        task.status === "in_progress" ||
        task.status === "for_review" ||
        Boolean((task as any).startedEarlyAt),
    )
  )
    return "In Progress";
  if (
    milestone.goals.some((goal) => goalStatus(goal) === "On Hold") ||
    milestone.goals.some((goal) => goalStatus(goal) === "Not Started") ||
    allTasks.some((task) => task.status === "completed")
  )
    return "On Hold";
  if (isFutureDate(milestoneEffectiveStartDate(milestone)))
    return "Not Started";
  return "Not Started";
};

const workStatusColor = (status: WorkStatus) => jobWorkStatusColor(status);

const isPeriodGoal = (goal: JobGoal) =>
  goal.source?.periodKind === "recurrent" || goal.source?.periodKind === "retainer";

const isRetainerPlaceholderGoal = (goal: JobGoal) =>
  goal.source?.periodKind === "retainer" && Boolean(goal.source?.isPeriodPlaceholder);

const periodVisibleGoals = (section: PeriodSection) =>
  section.goals.filter(
    (goal) => !isRetainerPlaceholderGoal(goal) || goal.tasks.length > 0,
  );

const periodGoalLabel = (goal: JobGoal) =>
  goal.source?.periodLabel ||
  (goal.source?.periodNumber ? `Period ${goal.source.periodNumber}` : "Period");

const periodGoalTitle = (goal: JobGoal) =>
  goal.source?.itemName
    ? `${periodGoalLabel(goal)} - ${goal.source.itemName}`
    : goal.name;

const periodGoalDateRange = (goal: JobGoal) =>
  `${formatDate(goal.source?.periodStartDate ?? goal.startDate)} - ${formatDate(
    goal.source?.periodEndDate ?? goal.dueDate,
  )}`;

const periodGoalKindLabel = (goal: JobGoal) =>
  goal.source?.periodKind === "retainer" ? "Retainer period" : "Recurrent period";

const selectedPeriodByGroup = reactive<Record<string, number>>({});

const normalGoalsForMilestone = (milestone: MilestoneWithChildren) =>
  milestone.goals.filter((goal) => !isPeriodGoal(goal));

const periodGroupKey = (goal: JobGoal) =>
  [
    goal.source?.periodKind ?? "period",
    goal.source?.dealItemId ?? goal.source?.itemName ?? "item",
    goal.milestoneId ?? "milestone",
  ].join(":");

const periodGroupsForMilestone = (milestone: MilestoneWithChildren): PeriodGroup[] => {
  const groupMap = new Map<string, PeriodGroup>();

  milestone.goals.filter(isPeriodGoal).forEach((goal) => {
    const source = goal.source;
    if (!source?.periodKind) return;

    const groupKey = periodGroupKey(goal);
    const periodNumber = Math.max(1, Number(source.periodNumber ?? 1) || 1);
    const totalPeriods = Math.max(
      periodNumber,
      Number(source.totalPeriods ?? periodNumber) || periodNumber,
    );
    const group =
      groupMap.get(groupKey) ??
      ({
        key: groupKey,
        kind: source.periodKind,
        title: source.itemName || goal.name,
        milestoneId: milestone.id,
        totalPeriods,
        sections: [],
      } satisfies PeriodGroup);

    group.totalPeriods = Math.max(group.totalPeriods, totalPeriods);

    let section = group.sections.find(
      (entry) => entry.periodNumber === periodNumber,
    );
    if (!section) {
      section = {
        key: `${groupKey}:${periodNumber}`,
        periodNumber,
        label: source.periodLabel || `Period ${periodNumber}`,
        source,
        goals: [],
      };
      group.sections.push(section);
    }

    section.goals.push(goal as GoalWithTasks);
    groupMap.set(groupKey, group);
  });

  return [...groupMap.values()].map((group) => ({
    ...group,
    sections: group.sections.sort((a, b) => a.periodNumber - b.periodNumber),
  }));
};

const periodSectionTasks = (section: PeriodSection) =>
  section.goals.flatMap((goal) => goal.tasks);

const periodServiceTasks = (section: PeriodSection) =>
  section.goals
    .filter((goal) => isRetainerPlaceholderGoal(goal))
    .flatMap((goal) => goal.tasks);

const periodSectionStatus = (section: PeriodSection): WorkStatus => {
  const tasks = periodSectionTasks(section);
  const serviceGoals = periodVisibleGoals(section);
  if (!tasks.length && !serviceGoals.length) return "Not Started";
  if (!tasks.length) return "Not Started";
  const goalStatuses = serviceGoals.length
    ? serviceGoals.map((goal) => goalStatus(goal))
    : [deriveStatusFromTasks(section.source.periodStartDate, tasks)];
  if (goalStatuses.every((status) => status === "Completed")) return "Completed";
  if (goalStatuses.some((status) => status === "In Progress"))
    return "In Progress";
  if (
    goalStatuses.some((status) => status === "On Hold") ||
    tasks.some((task) => task.status === "completed")
  )
    return "On Hold";
  if (isFutureDate(section.source.periodStartDate)) return "Not Started";
  return "Not Started";
};

const periodSectionStatusClass = (section: PeriodSection) =>
  `job-period-timeline__step--${periodSectionStatus(section)
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

const periodSectionDateRange = (section: PeriodSection) =>
  `${formatDate(section.source.periodStartDate)} - ${formatDate(
    section.source.periodEndDate,
  )}`;

const selectedPeriodNumber = (group: PeriodGroup) =>
  selectedPeriodByGroup[group.key] ?? group.sections[0]?.periodNumber ?? 1;

const selectedPeriodSection = (group: PeriodGroup) =>
  group.sections.find(
    (section) => section.periodNumber === selectedPeriodNumber(group),
  ) ?? group.sections[0] ?? null;

const selectPeriodSection = (group: PeriodGroup, section: PeriodSection) => {
  selectedPeriodByGroup[group.key] = section.periodNumber;
};

const periodTimelineProgressWidth = (group: PeriodGroup) => {
  if (!group.sections.length) return "0%";
  const completed = group.sections.filter(
    (section) => periodSectionStatus(section) === "Completed",
  ).length;

  return `${Math.round((completed / group.sections.length) * 100)}%`;
};

const periodGroupTypeLabel = (group: PeriodGroup) =>
  group.kind === "retainer" ? "Retainer Periods" : "Recurrent Periods";

const retainerServicesFromLinkedDeal = (group: PeriodGroup) => {
  const source = group.sections.find((section) => section.source.dealItemId)?.source;
  if (!source?.dealItemId) return [];

  const dealItem = dealsStore.all
    .flatMap((deal) => deal.items || [])
    .find((item) => String(item.id) === String(source.dealItemId));
  if (!dealItem) return [];

  const record = dealItem.catalogueItemId
    ? cataloguesStore.recordById(
        dealItem.catalogueItemId,
        dealItem.catalogueType || undefined,
      )
    : null;
  if (record?.type !== "Retainer Service") return [];

  return getDealRetainerServiceLines(dealItem as DealItem, record).map((service) => ({
    id: service.isCustom ? `custom-${service.id}` : service.id,
    name: service.name,
    quantity: Math.max(1, Number(service.quantity ?? 1)),
    note: service.note ?? null,
    kind: service.isCustom ? "custom" as const : "imported" as const,
  }));
};

const retainerServicesForGroup = (group: PeriodGroup) => {
  const services = new Map<
    string,
    {
      id: number | string;
      name: string;
      quantity: number;
      note?: string | null;
      kind?: "imported" | "custom" | null;
    }
  >();

  group.sections.forEach((section) => {
    (section.source.retainerServices || []).forEach((service) => {
      if (!service?.name) return;
      const quantity = Number(service.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      services.set(String(service.id), {
        id: service.id,
        name: service.name,
        quantity,
        note: service.note ?? null,
        kind: service.kind ?? "imported",
      });
    });
  });

  if (!services.size) {
    retainerServicesFromLinkedDeal(group).forEach((service) => {
      services.set(String(service.id), service);
    });
  }

  return [...services.values()];
};

const usedRetainerServiceQuantity = (
  group: PeriodGroup,
  serviceId: number | string,
) => {
  const usedFromGoals = group.sections
    .flatMap((section) => periodVisibleGoals(section))
    .filter((goal) => String(goal.source?.serviceId ?? "") === String(serviceId))
    .reduce((sum, goal) => sum + Math.max(1, Number(goal.source?.serviceQuantity ?? 1)), 0);
  const usedFromTasks = group.sections
    .flatMap((section) => periodSectionTasks(section))
    .filter((task) => String((task as any).source?.serviceId ?? "") === String(serviceId))
    .reduce(
      (sum, task) =>
        sum + Math.max(1, Number((task as any).source?.serviceQuantity ?? 1)),
      0,
    );

  return usedFromGoals + usedFromTasks;
};

const remainingRetainerServices = (group: PeriodGroup) =>
  retainerServicesForGroup(group)
    .map((service) => {
      const used = usedRetainerServiceQuantity(group, service.id);

      return {
        ...service,
        used,
        remaining: Math.max(0, service.quantity - used),
      };
    });

const addCustomRetainerServiceDraft = () => {
  retainerServicesDialog.customServices.push({
    id: `custom-${Date.now()}-${retainerServicesDialog.customServices.length + 1}`,
    name: "",
    quantity: 1,
    note: "",
  });
};

const removeCustomRetainerServiceDraft = (id: string) => {
  retainerServicesDialog.customServices =
    retainerServicesDialog.customServices.filter((service) => service.id !== id);
};

const openAddRetainerServices = (group: PeriodGroup, section: PeriodSection) => {
  const periodGoal =
    section.goals.find((goal) => isRetainerPlaceholderGoal(goal)) ??
    section.goals[0] ??
    null;
  retainerServicesDialog.visible = true;
  retainerServicesDialog.groupKey = group.key;
  retainerServicesDialog.periodNumber = section.periodNumber;
  retainerServicesDialog.milestoneId = group.milestoneId;
  retainerServicesDialog.goalId = periodGoal?.id ?? null;
  retainerServicesDialog.periodSource = section.source;
  retainerServicesDialog.selections = remainingRetainerServices(group).map(
    (service) => ({
      id: service.id,
      name: service.name,
      original: service.quantity,
      used: service.used,
      remaining: service.remaining,
      quantity: 0,
      note: service.note ?? null,
      kind: service.kind ?? "imported",
    }),
  );
  retainerServicesDialog.customServices = [];
  if (!retainerServicesDialog.selections.some((service) => service.remaining > 0))
    addCustomRetainerServiceDraft();
};

const closeRetainerServicesDialog = () => {
  retainerServicesDialog.visible = false;
  retainerServicesDialog.groupKey = "";
  retainerServicesDialog.periodNumber = 0;
  retainerServicesDialog.milestoneId = 0;
  retainerServicesDialog.goalId = null;
  retainerServicesDialog.periodSource = null;
  retainerServicesDialog.selections = [];
  retainerServicesDialog.customServices = [];
};

const saveRetainerServices = () => {
  if (!job.value || !retainerServicesDialog.periodSource) return;

  const selected = retainerServicesDialog.selections.filter(
    (service) => Number(service.quantity) > 0,
  );
  const customServices = retainerServicesDialog.customServices
    .map((service) => ({
      ...service,
      name: service.name.trim(),
      quantity: Number(service.quantity),
      note: service.note.trim(),
    }))
    .filter((service) => service.name && service.quantity > 0);

  if (!selected.length && !customServices.length) {
    notifications.push("Select at least one service", "warning", 2500);
    return;
  }
  if (
    retainerServicesDialog.customServices.some(
      (service) => service.name.trim() && Number(service.quantity) <= 0,
    )
  ) {
    notifications.push("Custom service quantity must be greater than 0", "warning", 3000);
    return;
  }
  if (
    selected.some(
      (service) =>
        Number(service.quantity) > service.remaining || Number(service.quantity) < 0,
    )
  ) {
    notifications.push("Service quantity exceeds remaining quantity", "warning", 3000);
    return;
  }

  const addRetainerServiceTask = (service: {
    id: number | string;
    name: string;
    quantity: number;
    note?: string | null;
    kind?: "imported" | "custom" | null;
    customServiceId?: number | string | null;
  }) => {
    const quantity = Math.max(1, Number(service.quantity));
    const taskTitle = `${service.name}${quantity > 1 ? ` x ${quantity}` : ""}`;

    todosStore.addTodo({
      title: taskTitle,
      collaborators: [],
      dueAt:
        retainerServicesDialog.periodSource?.periodEndDate ||
        new Date().toISOString(),
      startAt:
        retainerServicesDialog.periodSource?.periodStartDate ||
        job.value?.startDate ||
        null,
      completionMinutes: null,
      important: false,
      status: "pending",
      steps: [],
      notes: service.note || `Created for retainer period service: ${service.name}`,
      activities: [],
      messages: [],
      relatedTo: {
        id: job.value!.id,
        name: job.value!.name,
        type: "job",
      },
      milestoneId: retainerServicesDialog.milestoneId,
      goalId: retainerServicesDialog.goalId,
      source: {
        ...(retainerServicesDialog.periodSource || {}),
        type: "job-retainer-service",
        isPeriodPlaceholder: false,
        serviceId: service.id,
        serviceKind: service.kind ?? "imported",
        customServiceId: service.customServiceId ?? null,
        serviceName: service.name,
        serviceQuantity: quantity,
      } as any,
    });
  };

  selected.forEach((service) => {
    const quantity = Math.max(1, Number(service.quantity));
    addRetainerServiceTask({
      id: service.id,
      name: service.name,
      quantity,
      note: service.note ?? null,
      kind: service.kind ?? "imported",
    });
  });

  customServices.forEach((service) => {
    const quantity = Math.max(1, Number(service.quantity));
    const customServiceId = service.id || `custom-${Date.now()}`;

    addRetainerServiceTask({
      id: customServiceId,
      name: service.name,
      quantity,
      note: service.note || null,
      kind: "custom",
      customServiceId,
    });
  });

  if (customServices.length) notifyCustomRetainerServiceManagers(customServices);

  notifications.push("Services added", "success", 2500);
  closeRetainerServicesDialog();
  emit("status-automation-trigger", "Retainer services added");
};

const notifyCustomRetainerServiceManagers = (
  customServices: Array<{ name: string; quantity: number }>,
) => {
  if (!job.value || !customServices.length) return;

  const owner = job.value.projectManagerId
    ? employeesStore.byId(job.value.projectManagerId)
    : null;
  const managerIds = [
    ...new Set(
      ((owner?.employment?.reportToIds ?? []) as Array<number | string>)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const jobId = job.value.id;
  const jobName = job.value.name ?? "Job";
  const servicesLabel = customServices
    .map((service) => `${service.name} x ${Math.max(1, Number(service.quantity))}`)
    .join(", ");
  const periodLabel =
    retainerServicesDialog.periodSource?.periodLabel ||
    `Period ${retainerServicesDialog.periodNumber}`;

  managerIds.forEach((managerId) => {
    systemNotificationsStore.addNotification({
      recipientEmployeeId: managerId,
      title: `Custom retainer service: ${jobName}`,
      body: `${servicesLabel} added to ${periodLabel}.`,
      type: "retainer-custom-service",
      target: {
        entityType: "job",
        entityId: jobId,
        routeName: "operations-jobs-view-id",
        query: { tab: "milestones-goals" },
      },
    });
  });
};

const notifyRetainerOverageManagers = (source: JobGoal["source"]) => {
  if (!job.value || source?.periodKind !== "retainer") return;
  const totalPeriods = Number(source.totalPeriods ?? 0);
  if (!totalPeriods) return;

  const relatedRetainerGoals = goals.value.filter(
    (goal) =>
      goal.source?.periodKind === "retainer" &&
      String(goal.source?.dealItemId ?? "") === String(source.dealItemId ?? ""),
  );
  if (relatedRetainerGoals.length <= totalPeriods) return;

  const owner = job.value.projectManagerId
    ? employeesStore.byId(job.value.projectManagerId)
    : null;
  const managerIds = [
    ...new Set(
      ((owner?.employment?.reportToIds ?? []) as Array<number | string>)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const jobId = job.value.id;
  const jobName = job.value.name ?? "Job";

  managerIds.forEach((managerId) => {
    systemNotificationsStore.addNotification({
      recipientEmployeeId: managerId,
      title: `Retainer goal overage: ${jobName}`,
      body: `${source.itemName ?? "Retainer"} has ${relatedRetainerGoals.length} goals across ${totalPeriods} period(s).`,
      type: "retainer-overage",
      target: {
        entityType: "job",
        entityId: jobId,
        routeName: "operations-jobs-view-id",
        query: { tab: "milestones-goals" },
      },
    });
  });
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
    source: null,
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
const openCreateGoal = (milestoneId?: number, source?: JobGoal["source"]) => {
  if (milestoneId === undefined || milestoneId === null) return;
  goalDialog.mode = "create";
  goalDialog.visible = true;
  resetGoalDraft();
  goalDialog.draft.milestoneId = milestoneId;
  goalDialog.draft.source = source ?? null;
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
    source: goal.source ?? null,
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
    const createdGoal = jobsStore.addGoal(job.value.id, patch);
    if (createdGoal?.source?.periodKind === "retainer")
      notifyRetainerOverageManagers(createdGoal.source);
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
const toggleTaskImportant = (task: JobTodo) => {
  emit("update-todo", {
    ...task,
    important: !task.important,
  });
};
const toggleTaskComplete = (task: JobTodo, checked: boolean) => {
  emit("update-todo", {
    ...task,
    status: checked ? "completed" : "pending",
    completed: checked,
    isCompleted: checked,
    doneAt: checked ? new Date().toISOString() : null,
  });
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
                      :style="jobWorkStatusChipStyle(milestoneStatus(milestone))"
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
                      v-if="hasMilestoneDateConflict(milestone)"
                      size="x-small"
                      label
                      color="warning"
                      variant="tonal"
                      class="ms-1"
                    >
                      Conflicting dates
                      <VTooltip activator="parent" location="top">
                        Parent dates differ from child rollup dates.
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
                      <div class="job-task-check">
                        <VCheckboxBtn
                          :model-value="task.status === 'completed'"
                          density="compact"
                          @click.stop
                          @update:model-value="(value) => toggleTaskComplete(task, Boolean(value))"
                        />
                      </div>
                      <div class="job-task-priority">
                        <VBtn
                          icon
                          variant="text"
                          size="small"
                          class="job-task-star-btn"
                          @click.stop="toggleTaskImportant(task)"
                        >
                          <VIcon
                            :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                            size="20"
                            color="warning"
                          />
                          <VTooltip activator="parent" location="top">
                            {{ task.important ? "Clear priority" : "Mark priority" }}
                          </VTooltip>
                        </VBtn>
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
                        <span>{{ formatTaskStartDate(task) }}</span>
                        <span>{{ formatTaskEndDate(task) }}</span>
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
                  v-if="periodGroupsForMilestone(milestone).length"
                  class="job-period-groups"
                >
                  <div
                    v-for="periodGroup in periodGroupsForMilestone(milestone)"
                    :key="periodGroup.key"
                    class="job-period-timeline"
                  >
                    <div class="job-period-timeline__services">
                      <div class="job-period-timeline__services-heading">
                        <div class="job-period-timeline__services-title">
                          {{ periodGroupTypeLabel(periodGroup) }}
                        </div>
                      </div>
                      <div class="job-period-timeline__services-list">
                        <VCard
                          v-for="goal in selectedPeriodSection(periodGroup)?.goals || []"
                          :key="goal.id"
                          variant="flat"
                          class="job-period-service-row"
                        >
                          <div class="job-period-service-shell">
                            <div class="flex-grow-1 min-w-0">
                              <div class="d-flex align-center gap-2 flex-wrap">
                                <VTooltip :text="goal.name" location="top">
                                  <template #activator="{ props: tooltipProps }">
                                    <div
                                      v-bind="tooltipProps"
                                      class="job-period-service-title truncate-title"
                                    >
                                      {{ goal.name }}
                                    </div>
                                  </template>
                                </VTooltip>
                                <VChip
                                  color="primary"
                                  size="x-small"
                                  variant="plain"
                                  class="job-period-service-chip"
                                >
                                  {{ periodGoalKindLabel(goal) }}
                                </VChip>
                                <VChip
                                  :color="workStatusColor(goalStatus(goal))"
                                  :style="jobWorkStatusChipStyle(goalStatus(goal))"
                                  size="x-small"
                                  label
                                >
                                  {{ goalStatus(goal) }}
                                </VChip>
                              </div>
                              <div class="text-caption text-medium-emphasis mt-1">
                                {{ periodGoalDateRange(goal) }} |
                                {{ completedTaskCount(goal.tasks) }}/{{ goal.tasks.length }}
                                tasks completed
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
                              <VBtn
                                v-if="periodGroup.kind === 'retainer' && selectedPeriodSection(periodGroup)"
                                size="x-small"
                                color="primary"
                                variant="tonal"
                                prepend-icon="tabler-plus"
                                @click="openAddRetainerServices(periodGroup, selectedPeriodSection(periodGroup)!)"
                              >
                                Add Services
                              </VBtn>
                              <VTooltip text="Add Task" location="top">
                                <template #activator="{ props: tooltipProps }">
                                  <VBtn
                                    v-if="!isRetainerPlaceholderGoal(goal)"
                                    v-bind="tooltipProps"
                                    class="goal-add-task-btn"
                                    size="x-small"
                                    variant="text"
                                    icon="tabler-checkbox"
                                    @click="openCreateTodoForGoal(goal)"
                                  />
                                </template>
                              </VTooltip>
                              <VBtn
                                v-if="!isRetainerPlaceholderGoal(goal)"
                                icon
                                variant="text"
                                size="x-small"
                              >
                                <VIcon icon="tabler-dots-vertical" size="18" />
                                <VTooltip activator="parent" location="top">
                                  Show more
                                </VTooltip>
                                <VMenu activator="parent">
                                  <VList>
                                    <VListItem @click="openEditGoal(goal)">
                                      <template #prepend>
                                        <VIcon icon="tabler-edit" />
                                      </template>
                                      <VListItemTitle>Edit</VListItemTitle>
                                    </VListItem>
                                    <VListItem @click="deleteGoal(goal)">
                                      <template #prepend>
                                        <VIcon icon="tabler-trash" color="error" />
                                      </template>
                                      <VListItemTitle>Delete</VListItemTitle>
                                    </VListItem>
                                  </VList>
                                </VMenu>
                              </VBtn>
                            </div>
                          </div>
                        </VCard>
                      </div>
                    </div>

                    <div class="job-period-timeline__track">
                      <div
                        class="job-period-timeline__progress"
                        :style="{ inlineSize: periodTimelineProgressWidth(periodGroup) }"
                      />
                    </div>

                    <div
                      class="job-period-timeline__steps"
                      :style="{ '--period-count': periodGroup.sections.length }"
                    >
                      <div
                        v-for="section in periodGroup.sections"
                        :key="section.key"
                        class="job-period-timeline__step"
                        :class="[
                          periodSectionStatusClass(section),
                          {
                            'job-period-timeline__step--active':
                              selectedPeriodNumber(periodGroup) === section.periodNumber,
                          },
                        ]"
                      >
                        <VMenu location="bottom">
                          <template #activator="{ props: menuProps }">
                            <button
                              v-bind="menuProps"
                              type="button"
                              class="job-period-timeline__button"
                              @click="selectPeriodSection(periodGroup, section)"
                            >
                              <span>
                                <span class="job-period-timeline__dot" />
                                <span class="job-period-timeline__label">
                                  P{{ section.periodNumber }}
                                </span>
                              </span>
                            </button>
                          </template>

                          <VList class="job-period-action-menu">
                            <div class="job-period-action-menu__info">
                              <VIcon
                                icon="tabler-info-circle"
                                size="16"
                                class="job-period-action-menu__info-icon"
                              />
                              <div class="job-period-action-menu__info-copy">
                                <div class="job-period-action-menu__info-title">
                                  {{ section.label }}
                                </div>
                                <div class="job-period-action-menu__dates">
                                  <span>
                                    Start Date:
                                    <strong>{{ formatDate(section.source.periodStartDate) }}</strong>
                                  </span>
                                  <span class="job-period-action-menu__date-separator">
                                    |
                                  </span>
                                  <span>
                                    End Date:
                                    <strong>{{ formatDate(section.source.periodEndDate) }}</strong>
                                  </span>
                                </div>
                                <div class="job-period-action-menu__info-status">
                                  {{ periodSectionStatus(section) }}
                                </div>
                              </div>
                            </div>
                            <template v-if="periodGroup.kind === 'retainer'">
                              <VDivider class="my-1" />
                              <VListItem
                                @click="openAddRetainerServices(periodGroup, section)"
                              >
                                <template #prepend>
                                  <VIcon icon="tabler-target-arrow" />
                                </template>
                                <VListItemTitle>Add Services</VListItemTitle>
                              </VListItem>
                            </template>
                          </VList>
                        </VMenu>
                      </div>
                    </div>

                    <div
                      v-if="selectedPeriodSection(periodGroup)"
                      class="job-period-selected"
                    >
                      <div
                        v-if="periodGroup.kind === 'retainer' && selectedPeriodSection(periodGroup) && !periodVisibleGoals(selectedPeriodSection(periodGroup)!).length"
                        class="text-body-2 text-medium-emphasis empty-tasks"
                      >
                        No services added to this period yet.
                      </div>
                      <template
                        v-for="goal in selectedPeriodSection(periodGroup) ? periodVisibleGoals(selectedPeriodSection(periodGroup)!) : []"
                        :key="`period-goal-tasks-${goal.id}`"
                      >
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
                              <div class="job-task-check">
                                <VCheckboxBtn
                                  :model-value="task.status === 'completed'"
                                  density="compact"
                                  @click.stop
                                  @update:model-value="(value) => toggleTaskComplete(task, Boolean(value))"
                                />
                              </div>
                              <div class="job-task-priority">
                                <VBtn
                                  icon
                                  variant="text"
                                  size="small"
                                  class="job-task-star-btn"
                                  @click.stop="toggleTaskImportant(task)"
                                >
                                  <VIcon
                                    :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                                    size="20"
                                    color="warning"
                                  />
                                  <VTooltip activator="parent" location="top">
                                    {{ task.important ? "Clear priority" : "Mark priority" }}
                                  </VTooltip>
                                </VBtn>
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
                                <span>{{ formatTaskStartDate(task) }}</span>
                                <span>{{ formatTaskEndDate(task) }}</span>
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
                          No tasks linked to this period goal yet.
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <VExpansionPanels
                  v-if="normalGoalsForMilestone(milestone).length"
                  v-model="expandedGoals"
                  variant="accordion"
                  multiple
                  class="expansion-panels-width-border goal-panels"
                >
                  <VExpansionPanel
                    v-for="goal in normalGoalsForMilestone(milestone)"
                    :key="goal.id"
                    :value="goal.id"
                    class="goal-panel"
                  >
                    <VExpansionPanelTitle>
                      <div class="d-flex align-center gap-3 w-100">
                        <VIcon
                          :icon="isPeriodGoal(goal) ? 'tabler-calendar-stats' : 'tabler-target-arrow'"
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
                                  {{ isPeriodGoal(goal) ? periodGoalTitle(goal) : goal.name }}
                                </div>
                              </template>
                            </VTooltip>
                            <VChip
                              :color="workStatusColor(goalStatus(goal))"
                              :style="jobWorkStatusChipStyle(goalStatus(goal))"
                              size="x-small"
                              label
                            >
                              {{ goalStatus(goal) }}
                            </VChip>
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            <template v-if="isPeriodGoal(goal)">
                              {{ periodGoalKindLabel(goal) }}
                              <span v-if="goal.source?.periodNumber">
                                {{ goal.source.periodNumber }}/{{ goal.source.totalPeriods || "--" }}
                              </span>
                              | {{ periodGoalDateRange(goal) }}
                            </template>
                            <template v-else>
                            Start {{ formatDate(goalEffectiveStartDate(goal)) }}
                            <span
                              :class="{
                                'text-warning font-weight-medium': isDueSoon(goalEffectiveDueDate(goal)),
                              }"
                            >
                              | Due {{ formatDate(goalEffectiveDueDate(goal)) }}
                            </span>
                            </template>
                            | {{ completedTaskCount(goal.tasks) }}/{{
                              goal.tasks.length
                            }}
                            tasks completed
                            <VChip
                              v-if="hasGoalDateConflict(goal)"
                              size="x-small"
                              label
                              color="warning"
                              variant="tonal"
                              class="ms-1"
                            >
                              Conflicting dates
                              <VTooltip activator="parent" location="top">
                                Parent dates differ from child rollup dates.
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
                                <div class="job-task-check">
                                  <VCheckboxBtn
                                    :model-value="task.status === 'completed'"
                                    density="compact"
                                    @click.stop
                                    @update:model-value="(value) => toggleTaskComplete(task, Boolean(value))"
                                  />
                                </div>
                                <div class="job-task-priority">
                                  <VBtn
                                    icon
                                    variant="text"
                                    size="small"
                                    class="job-task-star-btn"
                                    @click.stop="toggleTaskImportant(task)"
                                  >
                                    <VIcon
                                      :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                                      size="20"
                                      color="warning"
                                    />
                                    <VTooltip activator="parent" location="top">
                                      {{ task.important ? "Clear priority" : "Mark priority" }}
                                    </VTooltip>
                                  </VBtn>
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
                                <span>{{ formatTaskStartDate(task) }}</span>
                                <span>{{ formatTaskEndDate(task) }}</span>
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
                  v-else-if="!milestone.tasks.length && !milestone.goals.length"
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
              <div class="job-task-check">
                <VCheckboxBtn
                  :model-value="task.status === 'completed'"
                  density="compact"
                  @click.stop
                  @update:model-value="(value) => toggleTaskComplete(task, Boolean(value))"
                />
              </div>
              <div class="job-task-priority">
                <VBtn
                  icon
                  variant="text"
                  size="small"
                  class="job-task-star-btn"
                  @click.stop="toggleTaskImportant(task)"
                >
                  <VIcon
                    :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                    size="20"
                    color="warning"
                  />
                  <VTooltip activator="parent" location="top">
                    {{ task.important ? "Clear priority" : "Mark priority" }}
                  </VTooltip>
                </VBtn>
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
              <span>{{ formatTaskStartDate(task) }}</span>
              <span>{{ formatTaskEndDate(task) }}</span>
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
      :model-value="retainerServicesDialog.visible"
      attach="body"
      :width="$vuetify.display.smAndDown ? 'auto' : 640"
      @update:model-value="(val: boolean) => (val ? undefined : closeRetainerServicesDialog())"
    >
      <DialogCloseBtn @click="closeRetainerServicesDialog" />
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-2">Add Services</h5>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Add imported services by remaining quantity, or add custom services for this period.
          </p>
          <div class="text-subtitle-2 mb-2">Imported Services</div>
          <div
            v-if="retainerServicesDialog.selections.length"
            class="d-flex flex-column gap-3"
          >
            <VCard
              v-for="service in retainerServicesDialog.selections"
              :key="service.id"
              variant="tonal"
              class="pa-3"
            >
              <div class="d-flex align-center gap-3 flex-wrap">
                <div class="flex-grow-1 min-w-0">
                  <div class="font-weight-medium">{{ service.name }}</div>
                  <div class="text-caption text-medium-emphasis">
                    Original: {{ service.original }} | Used: {{ service.used }} |
                    Remaining: {{ service.remaining }}
                  </div>
                </div>
                <VTextField
                  v-model.number="service.quantity"
                  label="Qty"
                  type="number"
                  min="0"
                  :max="service.remaining"
                  density="compact"
                  :disabled="service.remaining <= 0"
                  hide-details
                  style="max-inline-size: 7rem"
                />
              </div>
            </VCard>
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            No imported services found for this period.
          </div>

          <VDivider class="my-4" />

          <div class="d-flex align-center justify-space-between gap-3 mb-2">
            <div>
              <div class="text-subtitle-2">Custom Services</div>
              <div class="text-caption text-medium-emphasis">
                Custom services notify the project owner's managers.
              </div>
            </div>
            <VBtn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="tabler-plus"
              @click="addCustomRetainerServiceDraft"
            >
              Custom
            </VBtn>
          </div>

          <div
            v-if="retainerServicesDialog.customServices.length"
            class="d-flex flex-column gap-3"
          >
            <VCard
              v-for="service in retainerServicesDialog.customServices"
              :key="service.id"
              variant="tonal"
              class="pa-3"
            >
              <VRow dense>
                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="service.name"
                    label="Service"
                    placeholder="Service name"
                    hide-details
                  />
                </VCol>
                <VCol cols="8" md="3">
                  <AppTextField
                    v-model.number="service.quantity"
                    label="Qty"
                    type="number"
                    min="1"
                    placeholder="1"
                    hide-details
                  />
                </VCol>
                <VCol cols="4" md="3" class="d-flex justify-end align-center">
                  <VBtn
                    icon
                    variant="text"
                    color="error"
                    @click="removeCustomRetainerServiceDraft(service.id)"
                  >
                    <VIcon icon="tabler-trash" size="18" />
                  </VBtn>
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="service.note"
                    label="Note"
                    rows="2"
                    auto-grow
                    hide-details
                  />
                </VCol>
              </VRow>
            </VCard>
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            No custom services added.
          </div>
        </VCardText>
        <VCardActions class="justify-end flex-wrap gap-2">
          <VBtn variant="tonal" color="secondary" @click="closeRetainerServicesDialog">
            Cancel
          </VBtn>
          <VBtn
            color="primary"
            @click="saveRetainerServices"
          >
            Add Services
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

.goal-panels :deep(.goal-panel--period) {
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  background: rgba(var(--v-theme-primary), 0.055);
}

.goal-panel--period :deep(.v-expansion-panel-title) {
  border-block-end: 1px solid rgba(var(--v-theme-primary), 0.14);
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

.job-period-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.job-period-timeline {
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.05);
  padding-block: 0.8rem;
  padding-inline: 0.85rem;
}

.job-period-timeline__services {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-block-end: 0.9rem;
}

.job-period-timeline__services-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.job-period-timeline__services-title {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.job-period-timeline__services-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-period-service-row {
  inline-size: 100%;
  padding-block: 0.65rem;
  padding-inline: 0.75rem;
}

.job-period-service-shell {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.job-period-service-title {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
}

.job-period-service-chip {
  font-weight: 700;
}

.job-period-timeline__track {
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  block-size: 4px;
}

.job-period-timeline__progress {
  border-radius: inherit;
  background: rgb(var(--v-theme-primary));
  block-size: 100%;
  transition: inline-size 0.2s ease;
}

.job-period-timeline__steps {
  display: grid;
  gap: 0.15rem;
  grid-template-columns: repeat(var(--period-count), minmax(0, 1fr));
  margin-block-start: 0.55rem;
}

.job-period-timeline__step {
  min-inline-size: 0;
}

.job-period-timeline__button {
  display: flex;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  font: inherit;
  inline-size: 100%;
  min-inline-size: 0;
}

.job-period-timeline__button > span {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  inline-size: 100%;
  min-inline-size: 0;
}

.job-period-timeline__dot {
  border: 2px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface));
  block-size: 0.68rem;
  inline-size: 0.68rem;
}

.job-period-timeline__label {
  overflow: hidden;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  max-inline-size: 100%;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-period-timeline__step--active .job-period-timeline__label {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.job-period-timeline__step--not-started .job-period-timeline__button {
  color: rgb(var(--v-theme-secondary));
}

.job-period-timeline__step--in-progress .job-period-timeline__button,
.job-period-timeline__step--active .job-period-timeline__button {
  color: rgb(var(--v-theme-primary));
}

.job-period-timeline__step--on-hold .job-period-timeline__button {
  color: #d59bea;
}

.job-period-timeline__step--completed .job-period-timeline__button {
  color: rgb(var(--v-theme-success));
}

.job-period-timeline__step--not-started .job-period-timeline__dot {
  border-color: rgb(var(--v-theme-secondary));
}

.job-period-timeline__step--in-progress .job-period-timeline__dot,
.job-period-timeline__step--active .job-period-timeline__dot {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.job-period-timeline__step--on-hold .job-period-timeline__dot {
  border-color: #d59bea;
  background: #d59bea;
}

.job-period-timeline__step--completed .job-period-timeline__dot {
  border-color: rgb(var(--v-theme-success));
  background: rgb(var(--v-theme-success));
}

.job-period-action-menu__info {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  max-inline-size: 16rem;
  padding-block: 0.55rem 0.45rem;
  padding-inline: 1rem;
}

.job-period-action-menu__info-icon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
  margin-block-start: 0.1rem;
}

.job-period-action-menu__info-copy {
  min-inline-size: 0;
}

.job-period-action-menu__info-title {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.job-period-action-menu__dates {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  gap: 0.35rem;
  line-height: 1.35;
  margin-block-start: 0.2rem;
}

.job-period-action-menu__dates span {
  white-space: nowrap;
}

.job-period-action-menu__dates strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: inherit;
  font-weight: 700;
  line-height: inherit;
}

.job-period-action-menu__date-separator {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

.job-period-action-menu__info-status {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  line-height: 1.35;
  margin-block-start: 0.2rem;
}

.job-period-selected {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-block-start: 0.9rem;
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
    1.75rem 2rem minmax(16rem, 1fr) minmax(5.25rem, 0.38fr)
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

.job-task-check,
.job-task-priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
}

.job-task-check :deep(.v-selection-control) {
  min-block-size: 1.625rem;
}

.job-task-check :deep(.v-selection-control__wrapper) {
  block-size: 1.625rem;
  inline-size: 1.625rem;
}

.job-task-star-btn {
  block-size: 1.625rem !important;
  inline-size: 1.625rem !important;
  min-block-size: 1.625rem !important;
  min-inline-size: 1.625rem !important;
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
  display: flex;
  flex-direction: column;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  gap: 0.05rem;
  line-height: 1.15;
}

.job-task-date span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding-inline: calc(0.75rem + 4.75rem) 0.75rem;
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
    grid-template-columns: 1.75rem 2rem minmax(0, 1fr);
    row-gap: 0.5rem;
  }

  .job-task-date,
  .job-task-assigned,
  .job-task-status {
    grid-column: 3 / 4;
  }

  .job-task-assigned {
    flex-wrap: wrap;
  }

  .job-subtasks-row {
    padding-inline: calc(0.75rem + 3.75rem) 0.75rem;
  }

  .empty-tasks {
    padding-block: 0.25rem 0;
    padding-inline: 0;
  }
}
</style>
