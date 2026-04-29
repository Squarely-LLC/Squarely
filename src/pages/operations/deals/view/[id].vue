<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import CatalogueTaskTemplateDrawer from "@/components/catalogues/CatalogueTaskTemplateDrawer.vue";
import type { ToDo } from "@/data/schema";
import type {
  CatalogueJobConfigTask,
  CatalogueRecord,
  CatalogueTaskStartTrigger,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealItem,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import type {
  JobFlag,
  JobProperties,
  JobType,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";
import DealUpsertDialog from "@/views/operations/deals/list/DealUpsertDialog.vue";
import DealCommunicationTab from "@/views/operations/deals/view/DealCommunicationTab.vue";
import DealDocumentsTab from "@/views/operations/deals/view/DealDocumentsTab.vue";
import DealFinancialsTab from "@/views/operations/deals/view/DealFinancialsTab.vue";
import DealItemsTab from "@/views/operations/deals/view/DealItemsTab.vue";
import DealSummaryCard from "@/views/operations/deals/view/DealSummaryCard.vue";
import DealTimelineTab from "@/views/operations/deals/view/DealTimelineTab.vue";

const route = useRoute("operations-deals-view-id");
const router = useRouter();

const cataloguesStore = useCataloguesStore();
const dealsStore = useDealsStore();
const contactsStore = useContactsStore();
const employeesStore = useEmployeesStore();
const jobsStore = useJobsStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();

cataloguesStore.init();
dealsStore.init();
contactsStore.init();
employeesStore.init();
jobsStore.init();
todosStore.init();

const loading = ref(true);
const error = ref<string | null>(null);
const deal = ref<DealProperties | null>(null);
const dealTab = ref<number | null>(null);
const isDealEditDialogVisible = ref(false);
const dialogLoading = ref(false);
const dialogError = ref<string | null>(null);
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isAddMeetingOpen = ref(false);
const lockMeetingRelatedTo = ref(false);
const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);
const taskTemplateDrawerRef = ref<InstanceType<
  typeof CatalogueTaskTemplateDrawer
> | null>(null);
const isTaskTemplateDrawerOpen = ref(false);
const taskTemplateMode = ref<"create" | "edit">("create");
const taskTemplateTodoId = ref<number | string | null>(null);
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);
const isAddTodoDrawerVisible = ref(false);
const addTodoInitial = ref<Partial<ToDo> | null>(null);
const editingTodo = ref<ToDo | null>(null);
const isEditTodoDrawerVisible = ref(false);
const isExecutePreviewDialogVisible = ref(false);
const isExecutingDeal = ref(false);
const executePreviewError = ref<string | null>(null);
const executePreview = ref<DealExecutionPreview | null>(null);

const tabKeys = [
  "items",
  "communication",
  "documents",
  "financials",
  "timeline",
] as const;
const tabs = [
  { icon: "tabler-package", title: "Items" },
  { icon: "tabler-message", title: "Communication" },
  { icon: "tabler-folder", title: "Documents" },
  { icon: "tabler-credit-card", title: "Invoicing" },
  { icon: "tabler-timeline", title: "Timeline" },
] as const;

type ExecutionPreviewTaskKind = "sales" | "milestone" | "goal";

type ExecutionPreviewTask = {
  key: string;
  title: string;
  dueAt: string;
  notes: string;
  status: ToDo["status"];
  important: boolean;
  collaborators: ToDo["collaborators"];
  attachment: ToDo["attachment"];
  steps: ToDo["steps"];
  sourceLabel: string;
  kind: ExecutionPreviewTaskKind;
  afterWhen: string | null;
  milestoneKey: string | null;
  goalKey: string | null;
  startTriggerType: CatalogueTaskStartTrigger["type"] | null;
  startTriggerGoalKey: string | null;
  startTriggerTaskSourceId: string | null;
  startTriggerTaskKey: string | null;
};

type ExecutionPreviewGoal = {
  key: string;
  milestoneKey: string;
  name: string;
  startDate: string;
  dueDate: string | null;
  priority: JobFlag;
  note: string | null;
  sourceLabel: string;
  tasks: ExecutionPreviewTask[];
};

type ExecutionPreviewMilestone = {
  key: string;
  name: string;
  startDate: string;
  dueDate: string | null;
  priority: JobFlag;
  note: string | null;
  sourceLabel: string;
  isFallback: boolean;
  tasks: ExecutionPreviewTask[];
  goals: ExecutionPreviewGoal[];
};

type ExecutionPreviewSummary = {
  milestoneCount: number;
  goalCount: number;
  jobTaskCount: number;
  keptDealSalesTaskCount: number;
  customMilestoneCount: number;
};

type ExecutionPreviewJob = Pick<
  JobProperties,
  | "name"
  | "code"
  | "startDate"
  | "location"
  | "stage"
  | "type"
  | "flag"
  | "relatedTo"
  | "collaborators"
  | "note"
>;

type DealExecutionPreview = {
  executedAt: string;
  job: ExecutionPreviewJob;
  milestones: ExecutionPreviewMilestone[];
  generalTasks: ExecutionPreviewTask[];
  keptDealSalesTasks: Array<{
    id: number | string;
    title: string;
    dueAt: string;
    status: ToDo["status"];
  }>;
  summary: ExecutionPreviewSummary;
};

const validJobTypes: JobType[] = [
  "Architecture",
  "Interior",
  "Architecture & Interior",
  "Stands & Events",
  "Master Plan",
  "Full Scope",
  "Internal",
  "Other",
];

const isJobType = (value: string | null | undefined): value is JobType =>
  validJobTypes.includes((value || "") as JobType);

const formatPreviewDate = (value?: string | null) => {
  if (!value) return "--";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const resolveScheduledDate = (
  raw: string | null | undefined,
  baselineIso: string,
) => {
  const value = String(raw || "").trim();
  if (!value) return null;

  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) return directDate.toISOString();

  const match = value.match(
    /^([+-]?\d+)\s*(day|days|week|weeks|month|months)$/i,
  );
  if (!match) return null;

  const amount = Number(match[1] || 0);
  const unit = String(match[2] || "").toLowerCase();
  const next = new Date(baselineIso);

  if (unit.startsWith("day")) next.setDate(next.getDate() + amount);
  else if (unit.startsWith("week")) next.setDate(next.getDate() + amount * 7);
  else if (unit.startsWith("month")) next.setMonth(next.getMonth() + amount);

  return next.toISOString();
};

const resolveTaskDueAt = (
  raw: string | null | undefined,
  baselineIso: string,
) => resolveScheduledDate(raw, baselineIso) || baselineIso;

const resolveJobConfigMilestones = (record: CatalogueRecord | null) => {
  if (!record || !("jobConfiguration" in record)) return [];

  return Array.isArray(record.jobConfiguration?.milestones)
    ? record.jobConfiguration.milestones
    : [];
};

const resolveSalesTasks = (record: CatalogueRecord | null) => {
  if (!record || !("salesTasks" in record)) return [];

  return Array.isArray(record.salesTasks) ? record.salesTasks : [];
};

const isDraftDealItem = (item: DealItem, record: CatalogueRecord | null) => {
  if (item.parentItemId) return false;
  if (!record) return true;

  return (
    String((record as { activeState?: string }).activeState || "")
      .trim()
      .toLowerCase() === "draft"
  );
};

const flattenPreviewTasks = (preview: DealExecutionPreview) => [
  ...preview.milestones.flatMap((milestone) => [
    ...milestone.tasks,
    ...milestone.goals.flatMap((goal) => goal.tasks),
  ]),
  ...preview.generalTasks,
];

const buildExecutionPreview = (
  currentDeal: DealProperties,
  executedAt: string,
): DealExecutionPreview => {
  const milestones: ExecutionPreviewMilestone[] = [];
  const generalTasks: ExecutionPreviewTask[] = [];
  const rootItems = (currentDeal.items || []).filter(
    (item) => !item.parentItemId,
  );
  const keptDealSalesTasks = rootItems
    .flatMap((item) => item.generatedTaskIds || [])
    .map((taskId) => todosStore.byId(taskId))
    .filter((task): task is ToDo => Boolean(task))
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt,
      status: task.status,
    }));

  const job: ExecutionPreviewJob = {
    name:
      currentDeal.code?.trim() ||
      currentDeal.name?.trim() ||
      `Job for Deal #${currentDeal.id}`,
    code: currentDeal.code?.trim() || null,
    startDate: executedAt,
    location: currentDeal.location?.trim() || null,
    stage: "Project | In Progress",
    type: isJobType(currentDeal.type) ? currentDeal.type : "Other",
    flag: currentDeal.important ? "High" : "Normal",
    relatedTo: currentDeal.id,
    collaborators: [...(currentDeal.collaborators || [])],
    note: currentDeal.note?.trim() || null,
  };

  rootItems.forEach((item) => {
    const record = item.catalogueItemId
      ? cataloguesStore.recordById(
          item.catalogueItemId,
          item.catalogueType || undefined,
        )
      : null;
    const configMilestones = resolveJobConfigMilestones(record);
    const salesTasks = resolveSalesTasks(record);
    const goalTemplateMap = new Map<string, string>();
    const goalMilestoneMap = new Map<string, string>();
    const taskTemplateMap = new Map<string, string | null>();
    const itemTasks: ExecutionPreviewTask[] = [];

    const registerTaskTemplate = (
      taskId: number | string | null | undefined,
      previewKey: string,
    ) => {
      const lookupKey = String(taskId ?? "").trim();
      if (!lookupKey) return;

      if (!taskTemplateMap.has(lookupKey)) {
        taskTemplateMap.set(lookupKey, previewKey);
        return;
      }

      taskTemplateMap.set(lookupKey, null);
    };

    const createPreviewTask = (
      rawTask: CatalogueJobConfigTask,
      options: {
        key: string;
        kind: ExecutionPreviewTaskKind;
        sourceLabel: string;
        milestoneKey?: string | null;
        goalKey?: string | null;
      },
    ): ExecutionPreviewTask => {
      const triggerGoalKey =
        rawTask.startTrigger?.type === "goal" ||
        rawTask.startTrigger?.type === "task"
          ? (goalTemplateMap.get(
              String(rawTask.startTrigger.goalId ?? "").trim(),
            ) ?? null)
          : null;
      const goalKey = options.goalKey ?? triggerGoalKey ?? null;
      const milestoneKey =
        options.milestoneKey ??
        (goalKey ? (goalMilestoneMap.get(goalKey) ?? null) : null);
      const previewTask: ExecutionPreviewTask = {
        key: options.key,
        title: String(rawTask.title || "").trim() || "Untitled Task",
        dueAt: resolveTaskDueAt(rawTask.afterWhen, executedAt),
        notes: String(rawTask.notes || "").trim(),
        status:
          rawTask.status === "in_progress" ||
          rawTask.status === "for_review" ||
          rawTask.status === "completed"
            ? rawTask.status
            : "pending",
        important: Boolean(rawTask.important),
        collaborators: Array.isArray(rawTask.collaborators)
          ? rawTask.collaborators.map((collaborator) => ({ ...collaborator }))
          : [],
        attachment: rawTask.attachment ? { ...rawTask.attachment } : null,
        steps: Array.isArray(rawTask.steps)
          ? rawTask.steps.map((step) => ({ ...step }))
          : [],
        sourceLabel: options.sourceLabel,
        kind: options.kind,
        afterWhen: rawTask.afterWhen ?? null,
        milestoneKey,
        goalKey,
        startTriggerType: rawTask.startTrigger?.type ?? null,
        startTriggerGoalKey: triggerGoalKey,
        startTriggerTaskSourceId:
          rawTask.startTrigger?.type === "task"
            ? String(rawTask.startTrigger.taskId ?? "").trim() || null
            : null,
        startTriggerTaskKey: null,
      };

      registerTaskTemplate(rawTask.id, previewTask.key);
      itemTasks.push(previewTask);

      return previewTask;
    };

    configMilestones.forEach((milestone, milestoneIndex) => {
      const milestoneKey = `milestone:${item.id}:${milestone.id}:${milestoneIndex}`;
      const previewMilestone: ExecutionPreviewMilestone = {
        key: milestoneKey,
        name: String(milestone.name || item.name).trim() || item.name,
        startDate: executedAt,
        dueDate:
          resolveScheduledDate(
            milestone.afterWhen ?? milestone.dueDate,
            executedAt,
          ) ?? null,
        priority: milestone.priority ?? "Normal",
        note: String(milestone.note || "").trim() || null,
        sourceLabel: item.name,
        isFallback: false,
        tasks: [],
        goals: [],
      };

      previewMilestone.goals = (milestone.goals || []).map(
        (goal, goalIndex) => {
          const goalKey = `goal:${item.id}:${milestone.id}:${goal.id}:${goalIndex}`;

          goalTemplateMap.set(String(goal.id), goalKey);
          goalMilestoneMap.set(goalKey, milestoneKey);

          return {
            key: goalKey,
            milestoneKey,
            name: String(goal.name || "").trim() || "Untitled Goal",
            startDate: executedAt,
            dueDate:
              resolveScheduledDate(
                goal.afterWhen ?? goal.dueDate,
                executedAt,
              ) ?? null,
            priority: goal.priority ?? "Normal",
            note: String(goal.note || "").trim() || null,
            sourceLabel: item.name,
            tasks: [],
          };
        },
      );

      previewMilestone.tasks = (milestone.tasks || []).map((task, taskIndex) =>
        createPreviewTask(task, {
          key: `task:milestone:${item.id}:${milestone.id}:${task.id}:${taskIndex}`,
          kind: "milestone",
          sourceLabel: `${item.name} / ${previewMilestone.name}`,
          milestoneKey,
        }),
      );

      previewMilestone.goals.forEach((goalPreview, goalIndex) => {
        const goalConfig = milestone.goals?.[goalIndex];
        goalPreview.tasks = (goalConfig?.tasks || []).map((task, taskIndex) =>
          createPreviewTask(task, {
            key: `task:goal:${item.id}:${goalConfig?.id}:${task.id}:${taskIndex}`,
            kind: "goal",
            sourceLabel: `${item.name} / ${goalPreview.name}`,
            milestoneKey,
            goalKey: goalPreview.key,
          }),
        );
      });

      milestones.push(previewMilestone);
    });

    if (!configMilestones.length && isDraftDealItem(item, record)) {
      milestones.push({
        key: `milestone:fallback:${item.id}`,
        name: item.name,
        startDate: executedAt,
        dueDate: resolveScheduledDate(
          currentDeal.estimatedDeliveryDate,
          executedAt,
        ),
        priority: "Normal",
        note: item.note?.trim() || null,
        sourceLabel: item.name,
        isFallback: true,
        tasks: [],
        goals: [],
      });
    }

    salesTasks.forEach((task, taskIndex) => {
      const previewTask = createPreviewTask(task, {
        key: `task:sales:${item.id}:${task.id}:${taskIndex}`,
        kind: "sales",
        sourceLabel: `${item.name} / Sales Task`,
      });

      if (previewTask.goalKey) {
        const milestoneKey = previewTask.milestoneKey;
        const milestoneTarget = milestones.find(
          (entry) => entry.key === milestoneKey,
        );
        const goalTarget = milestoneTarget?.goals.find(
          (entry) => entry.key === previewTask.goalKey,
        );

        if (goalTarget) {
          goalTarget.tasks.push(previewTask);
          return;
        }
      }

      generalTasks.push(previewTask);
    });

    itemTasks.forEach((task) => {
      if (task.startTriggerType !== "task" || !task.startTriggerTaskSourceId)
        return;

      const lookupKey = task.startTriggerTaskSourceId;
      if (!lookupKey) return;

      task.startTriggerTaskKey = taskTemplateMap.get(lookupKey) ?? null;
    });
  });

  const summary: ExecutionPreviewSummary = {
    milestoneCount: milestones.length,
    goalCount: milestones.reduce(
      (sum, milestone) => sum + milestone.goals.length,
      0,
    ),
    jobTaskCount: flattenPreviewTasks({
      executedAt,
      job,
      milestones,
      generalTasks,
      keptDealSalesTasks,
      summary: {
        milestoneCount: 0,
        goalCount: 0,
        jobTaskCount: 0,
        keptDealSalesTaskCount: 0,
        customMilestoneCount: 0,
      },
    }).length,
    keptDealSalesTaskCount: keptDealSalesTasks.length,
    customMilestoneCount: milestones.filter((milestone) => milestone.isFallback)
      .length,
  };

  return {
    executedAt,
    job,
    milestones,
    generalTasks,
    keptDealSalesTasks,
    summary,
  };
};

const closeExecutePreviewDialog = () => {
  isExecutePreviewDialogVisible.value = false;
  isExecutingDeal.value = false;
  executePreview.value = null;
  executePreviewError.value = null;
};

const cloneDeal = (value: DealProperties | null) => {
  if (!value) return null;

  return JSON.parse(JSON.stringify(value)) as DealProperties;
};

const resolveDeal = () => {
  loading.value = true;
  const found = dealsStore.byId(route.params.id);

  if (found) {
    deal.value = cloneDeal(found);
    error.value = null;
  } else {
    deal.value = null;
    error.value = "Deal not found.";
  }

  loading.value = false;
};

const setTabFromQuery = () => {
  const queryTab = String(route.query.tab || tabKeys[0]);
  const index = (tabKeys as readonly string[]).indexOf(queryTab);
  dealTab.value = index === -1 ? 0 : index;
};

const linkedToName = computed(() => {
  const relatedId = deal.value?.relatedTo;
  if (relatedId === null || relatedId === undefined) return "--";

  return contactsStore.byId(Number(relatedId))?.fullName || "--";
});

const collaboratorNames = computed(() =>
  (deal.value?.collaborators || []).map((id) => {
    const employee = employeesStore.byId(Number(id));

    return employee?.fullName || `Employee ${id}`;
  }),
);

const dealEmployeeCollaborators = computed(() =>
  (deal.value?.collaborators || []).map((id) => {
    const employee = employeesStore.byId(Number(id));

    return {
      id: Number(id),
      name: employee?.fullName || `Employee ${id}`,
      avatarUrl: employee?.picture || null,
    };
  }),
);

const dealLinkedEntities = computed(() => {
  const entries: Array<any> = [];

  if (deal.value?.relatedTo !== null && deal.value?.relatedTo !== undefined) {
    const relatedContact = contactsStore.byId(Number(deal.value.relatedTo));
    entries.push({
      id: deal.value.relatedTo,
      contactId: deal.value.relatedTo,
      name: relatedContact?.fullName || linkedToName.value,
      avatarUrl: relatedContact?.picture || null,
      type: "contact" as const,
      roles: ["contact"] as ["contact"],
    });
  }

  dealEmployeeCollaborators.value.forEach((collaborator) => {
    entries.push({
      id: collaborator.id,
      employeeId: collaborator.id,
      name: collaborator.name,
      avatarUrl: collaborator.avatarUrl,
      type: "employee" as const,
      roles: ["employee"] as ["employee"],
    });
  });

  return entries;
});

const meetingContacts = computed(() =>
  contactsStore.all.map((contact) => ({
    id: contact.id,
    name: contact.fullName,
    avatarUrl: contact.picture || null,
  })),
);

const contactOptions = computed(() =>
  contactsStore.all.map((contact) => ({
    id: contact.id,
    name: contact.fullName,
    avatarUrl: contact.picture || null,
  })),
);

const dealRelatedRef = computed(() =>
  deal.value
    ? {
        id: deal.value.id,
        name: deal.value.code || `Deal #${deal.value.id}`,
        type: "deal",
      }
    : null,
);

const goalTriggerOptions = computed(
  () => [] as Array<{ title: string; value: string }>,
);

const openEditDialog = () => {
  dialogError.value = null;
  isDealEditDialogVisible.value = true;
};

const openExecutePreviewDialog = () => {
  if (!deal.value) return;

  const executedAt = new Date().toISOString();

  try {
    executePreview.value = buildExecutionPreview(deal.value, executedAt);
    executePreviewError.value = null;
  } catch (previewError) {
    console.error("Failed to build deal execution preview", previewError);
    executePreview.value = null;
    executePreviewError.value = "Unable to build execution preview.";
  }

  isExecutePreviewDialogVisible.value = true;
};

const confirmDealExecution = () => {
  if (!deal.value || !executePreview.value || isExecutingDeal.value) return;

  isExecutingDeal.value = true;
  const currentDealId = deal.value.id;
  const previousRelatedTo = deal.value.relatedTo ?? null;
  const createdTodoIds: Array<number | string> = [];
  let createdJobId: number | string | null = null;

  try {
    const preview = executePreview.value;
    const createdJob = jobsStore.addJob({
      name: preview.job.name,
      code: preview.job.code,
      startDate: preview.job.startDate,
      location: preview.job.location,
      stage: preview.job.stage,
      type: preview.job.type,
      flag: preview.job.flag,
      relatedTo: preview.job.relatedTo,
      collaborators: [...preview.job.collaborators],
      note: preview.job.note,
      milestones: [],
      goals: [],
      stakeholders: [],
    });
    createdJobId = createdJob.id;
    const relatedTo = {
      id: createdJob.id,
      name: createdJob.name,
      type: "job",
    };
    const milestoneIdByKey = new Map<string, number>();
    const goalIdByKey = new Map<string, number>();
    const taskIdByKey = new Map<string, number | string>();

    preview.milestones.forEach((milestone) => {
      const createdMilestone = jobsStore.addMilestone(createdJob.id, {
        name: milestone.name,
        startDate: milestone.startDate,
        dueDate: milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note,
      });

      if (createdMilestone)
        milestoneIdByKey.set(milestone.key, createdMilestone.id);
    });

    preview.milestones.forEach((milestone) => {
      const milestoneId = milestoneIdByKey.get(milestone.key);
      if (!milestoneId) return;

      milestone.goals.forEach((goal) => {
        const createdGoal = jobsStore.addGoal(createdJob.id, {
          milestoneId,
          name: goal.name,
          startDate: goal.startDate,
          dueDate: goal.dueDate,
          priority: goal.priority,
          note: goal.note,
        });

        if (createdGoal) goalIdByKey.set(goal.key, createdGoal.id);
      });
    });

    const previewTasks = flattenPreviewTasks(preview);

    previewTasks.forEach((task) => {
      const createdTodo = todosStore.addTodo({
        title: task.title,
        collaborators: task.collaborators.map((collaborator) => ({
          ...collaborator,
        })),
        dueAt: task.dueAt,
        afterWhen: task.afterWhen,
        startTrigger:
          task.startTriggerType === "goal" && task.startTriggerGoalKey
            ? {
                type: "goal",
                goalId: goalIdByKey.get(task.startTriggerGoalKey) ?? null,
                taskId: null,
              }
            : task.startTriggerType === "task"
              ? {
                  type: "task",
                  goalId: task.startTriggerGoalKey
                    ? (goalIdByKey.get(task.startTriggerGoalKey) ?? null)
                    : null,
                  taskId: null,
                }
              : task.startTriggerType === "time"
                ? {
                    type: "time",
                    goalId: null,
                    taskId: null,
                  }
                : null,
        status: task.status,
        notes: task.notes,
        important: task.important,
        attachment: task.attachment ? { ...task.attachment } : null,
        relatedTo,
        milestoneId: task.milestoneKey
          ? (milestoneIdByKey.get(task.milestoneKey) ?? null)
          : null,
        goalId: task.goalKey ? (goalIdByKey.get(task.goalKey) ?? null) : null,
        steps: task.steps.map((step) => ({ ...step })),
      });

      taskIdByKey.set(task.key, createdTodo.id);
      createdTodoIds.push(createdTodo.id);
    });

    previewTasks.forEach((task) => {
      if (task.startTriggerType !== "task" || !task.startTriggerTaskKey) return;

      const createdTaskId = taskIdByKey.get(task.key);
      const triggerTaskId = taskIdByKey.get(task.startTriggerTaskKey);
      if (!createdTaskId || !triggerTaskId) return;

      todosStore.updateTodo(createdTaskId, {
        startTrigger: {
          type: "task",
          goalId: task.startTriggerGoalKey
            ? (goalIdByKey.get(task.startTriggerGoalKey) ?? null)
            : null,
          taskId: triggerTaskId,
        } as any,
      } as any);
    });

    const updatedDeal = dealsStore.updateDeal(currentDealId, {
      relatedTo: createdJob.id,
    });
    if (updatedDeal) deal.value = cloneDeal(updatedDeal);

    notifications.push(
      `Deal executed into ${createdJob.name} with ${preview.summary.jobTaskCount} tasks`,
      "success",
      4000,
    );
    closeExecutePreviewDialog();
  } catch (executionError) {
    createdTodoIds.forEach((todoId) => todosStore.removeTodo(todoId));
    if (createdJobId !== null) jobsStore.removeJob(createdJobId);

    const revertedDeal = dealsStore.updateDeal(currentDealId, {
      relatedTo: previousRelatedTo,
    });
    if (revertedDeal) deal.value = cloneDeal(revertedDeal);

    console.error("Failed to execute deal", executionError);
    executePreviewError.value =
      "Execution failed. Created changes were rolled back.";
    notifications.push("Failed to execute deal", "error", 4000);
    isExecutingDeal.value = false;
  }
};

const saveDeal = (payload: Partial<DealProperties>) => {
  if (!deal.value) return;

  dialogLoading.value = true;
  dialogError.value = null;

  try {
    const updated = dealsStore.updateDeal(deal.value.id, payload);
    if (!updated) {
      dialogError.value = "Failed to update deal";
      notifications.push("Unable to update deal", "error", 4000);

      return;
    }

    deal.value = cloneDeal(updated);
    isDealEditDialogVisible.value = false;
    notifications.push("Deal updated", "success", 3000);
  } catch (updateError) {
    console.error("Failed to update deal", updateError);
    dialogError.value = "An unexpected error occurred";
    notifications.push("Failed to update deal", "error", 4000);
  } finally {
    dialogLoading.value = false;
  }
};

const openAddMeeting = () => {
  if (!deal.value) return;

  nextTick(() => {
    try {
      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${deal.value?.code || `Deal #${deal.value?.id}`}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: dealLinkedEntities.value,
        relatedTo: dealRelatedRef.value,
        attendees: [],
        notes: `Meeting regarding ${deal.value?.code || `deal #${deal.value?.id}`}`,
      });
    } catch {}
    isAddMeetingOpen.value = true;
  });
};

const handleAddMeetingFromCommunication = () => {
  if (!deal.value) return;
  const currentDeal = deal.value;

  lockMeetingRelatedTo.value = true;
  nextTick(() => {
    try {
      addMeetingRef.value?.openWith?.({
        title: `Meeting: ${currentDeal.code || `Deal #${currentDeal.id}`}`,
        initialStart: new Date(),
        durationMins: 60,
        linkedTo: dealLinkedEntities.value,
        relatedTo: dealRelatedRef.value,
        attendees: [],
        notes: `Meeting regarding ${currentDeal.code || `deal #${currentDeal.id}`}`,
      });
    } catch {}
    isAddMeetingOpen.value = true;
  });
};

const handleAddTaskFromCommunication = () => {
  if (!deal.value) return;

  addTodoInitial.value = {
    title: "",
    collaborators: dealEmployeeCollaborators.value,
    relatedTo: dealRelatedRef.value,
    dueAt: new Date().toISOString(),
    notes: "",
    important: false,
    status: "pending",
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const handleAddCallFromCommunication = () => {
  if (!deal.value) return;
  const currentDeal = deal.value;

  nextTick(() => {
    try {
      addMeetingRef.value?.openWith?.({
        title: `Call: ${currentDeal.code || `Deal #${currentDeal.id}`}`,
        initialStart: new Date(),
        durationMins: 30,
        meetingType: "Brief",
        linkedTo: dealLinkedEntities.value,
        relatedTo: dealRelatedRef.value,
        attendees: [],
        location: "Phone",
        notes: `Call regarding ${currentDeal.code || `deal #${currentDeal.id}`}`,
      });
    } catch {}
    isAddMeetingOpen.value = true;
  });
};

const onMeetingCreated = (payload: any) => {
  try {
    todosStore.addMeeting && todosStore.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (meetingError) {
    console.error("onMeetingCreated failed:", meetingError);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
    lockMeetingRelatedTo.value = false;
  }
};

const openEmail = () => {
  if (!deal.value) return;

  isComposeDialogVisible.value = true;
  nextTick(() => {
    try {
      const relatedContact = contactsStore.byId(Number(deal.value?.relatedTo));
      composeDialogRef.value?.openWith?.({
        to: relatedContact?.email ? [relatedContact.email] : [],
        subject: `Regarding ${deal.value?.code || `Deal #${deal.value?.id}`}`,
        message: `Hello,\n\nI'd like to discuss ${deal.value?.code || `deal #${deal.value?.id}`}.\n\nThanks,`,
        linkedTo: dealLinkedEntities.value,
        relatedTo: dealRelatedRef.value,
      });
    } catch {}
  });
};

const openAddTask = (payload: { initial: Partial<ToDo> }) => {
  taskTemplateMode.value = "create";
  taskTemplateTodoId.value = null;

  nextTick(() => {
    try {
      taskTemplateDrawerRef.value?.openWith?.({
        ...payload.initial,
        afterWhen: (payload.initial as ToDo).afterWhen ?? "+1 day",
        startTrigger: (payload.initial as ToDo).startTrigger ?? {
          type: "time",
          goalId: null,
          taskId: null,
        },
      });
    } catch {}
  });
  isTaskTemplateDrawerOpen.value = true;
};

const openEditTask = (todoId: number | string) => {
  const todo = todosStore.byId(todoId);
  if (!todo) return;

  taskTemplateMode.value = "edit";
  taskTemplateTodoId.value = todoId;
  nextTick(() => {
    try {
      taskTemplateDrawerRef.value?.openWith?.({
        title: todo.title,
        collaborators: todo.collaborators,
        afterWhen: todo.afterWhen ?? todo.dueAt ?? "+1 day",
        startTrigger: (todo.startTrigger as
          | CatalogueTaskStartTrigger
          | null
          | undefined) ?? {
          type: "time",
          goalId: null,
          taskId: null,
        },
        notes: todo.notes ?? "",
        important: todo.important,
        status: todo.status,
        attachment: todo.attachment ?? null,
        relatedTo: todo.relatedTo ?? null,
        goalId: todo.goalId ?? null,
        milestoneId: todo.milestoneId ?? null,
        steps: Array.isArray(todo.steps)
          ? todo.steps.map((step) => ({ ...step }))
          : [],
      });
    } catch {}
  });
  isTaskTemplateDrawerOpen.value = true;
};

const deleteTask = (todoId: number | string) => {
  todosStore.removeTodo(todoId);
  notifications.push("Task deleted", "success", 3000);
};

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
    collaborators:
      payload?.initial?.collaborators &&
      Array.isArray(payload.initial.collaborators) &&
      payload.initial.collaborators.length
        ? payload.initial.collaborators
        : dealEmployeeCollaborators.value,
    relatedTo:
      payload?.initial?.relatedTo ??
      (deal.value
        ? {
            id: deal.value.id,
            name: deal.value.code || `Deal #${deal.value.id}`,
            type: "deal",
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

const onTaskTemplateSaved = (
  payload: Partial<ToDo> & {
    afterWhen?: string | null;
    startTrigger?: CatalogueTaskStartTrigger | null;
  },
) => {
  if (!deal.value) return;
  const relatedTo = {
    id: deal.value.id,
    name: deal.value.code || `Deal #${deal.value.id}`,
    type: "deal",
  };
  const normalized: Partial<ToDo> = {
    title: String(payload.title ?? "").trim(),
    collaborators: Array.isArray(payload.collaborators)
      ? payload.collaborators.map((collaborator) => ({ ...collaborator }))
      : [],
    dueAt: String(payload.afterWhen ?? payload.dueAt ?? "+1 day"),
    afterWhen: payload.afterWhen ?? payload.dueAt ?? null,
    startTrigger:
      payload.startTrigger?.type === "goal" ||
      payload.startTrigger?.type === "task"
        ? {
            type: payload.startTrigger.type,
            goalId: payload.startTrigger.goalId ?? null,
            taskId: payload.startTrigger.taskId ?? null,
          }
        : {
            type: "time" as const,
            goalId: null,
            taskId: null,
          },
    status:
      payload.status === "in_progress" ||
      payload.status === "for_review" ||
      payload.status === "completed"
        ? payload.status
        : "pending",
    notes: String(payload.notes ?? "").trim(),
    important: Boolean(payload.important),
    attachment: payload.attachment ?? null,
    relatedTo,
    goalId: payload.goalId ?? null,
    milestoneId: payload.milestoneId ?? null,
    steps: Array.isArray(payload.steps)
      ? payload.steps.map((step, index) => ({
          ...step,
          id: step.id ?? index + 1,
        }))
      : [],
  };

  if (taskTemplateMode.value === "edit" && taskTemplateTodoId.value !== null) {
    todosStore.updateTodo(taskTemplateTodoId.value, normalized);
    notifications.push("Task updated", "success", 3000);
  } else {
    todosStore.addTodo(normalized);
    notifications.push("Task created", "success", 3000);
  }

  isTaskTemplateDrawerOpen.value = false;
  taskTemplateTodoId.value = null;
  taskTemplateMode.value = "create";
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

const onTodoStepsEdited = (payload: { id: number | string; steps: any[] }) => {
  todosStore.updateTodo(payload.id, {
    steps: payload.steps.map((step) => ({ ...step })),
  });
};

const closeMeetingDrawer = () => {
  isAddMeetingOpen.value = false;
  lockMeetingRelatedTo.value = false;
};

const upsertDealEmailThread = (payload: any) => {
  if (!deal.value) return null;

  const existing = todosStore.items.find(
    (todo) =>
      todo.relatedTo?.type === "deal" &&
      String(todo.relatedTo.id) === String(deal.value?.id) &&
      todo.notes === "__deal_email_thread__",
  );

  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  const subject = String(
    payload?.subject ||
      `Regarding ${deal.value.code || `Deal #${deal.value.id}`}`,
  ).trim();
  const messageBody = String(payload?.message || "").trim();
  const recipientsLabel = recipients.length
    ? `To: ${recipients.join(", ")}`
    : "";
  const body = [subject, recipientsLabel, messageBody]
    .filter(Boolean)
    .join("\n");
  const newMessage = {
    id: `deal-email-${Date.now()}`,
    author: { id: "me", name: "You" },
    body,
    createdAt: new Date().toISOString(),
    isRead: true,
  };

  if (existing) {
    todosStore.updateTodo(existing.id, {
      messages: [...(existing.messages || []), newMessage],
    } as any);
    return existing.id;
  }

  return todosStore.addTodo({
    title: "Email Correspondence",
    collaborators: [],
    dueAt: new Date().toISOString(),
    important: false,
    status: "completed",
    steps: [],
    notes: "__deal_email_thread__",
    activities: [],
    messages: [newMessage],
    relatedTo: dealRelatedRef.value,
  } as any).id;
};

onMounted(() => {
  resolveDeal();
  setTabFromQuery();
});

watch(() => route.params.id, resolveDeal);
watch(
  () => dealsStore.byId(route.params.id),
  (value) => {
    if (!value) {
      deal.value = null;
      error.value = "Deal not found.";
      return;
    }

    deal.value = cloneDeal(value);
    error.value = null;
  },
);

watch(() => route.query.tab, setTabFromQuery);
watch(
  () => dealTab.value,
  (value) => {
    if (value == null) return;

    const key = (tabKeys as readonly string[])[value] || tabKeys[0];
    if (String(route.query.tab) === key) return;

    try {
      router.replace({
        name: route.name as any,
        params: route.params,
        query: { ...(route.query || {}), tab: key },
      });
    } catch {}
  },
);
</script>

<template>
  <div>
    <VProgressLinear
      v-if="loading"
      indeterminate
      color="primary"
      class="mb-4"
    />

    <VRow v-if="deal">
      <VCol cols="12" md="5" lg="4">
        <DealSummaryCard
          :deal="deal"
          :linked-to-name="linkedToName"
          :collaborator-names="collaboratorNames"
          @edit="openEditDialog"
          @execute="openExecutePreviewDialog"
        />
      </VCol>

      <VCol cols="12" md="7" lg="8">
        <VTabs v-model="dealTab" class="v-tabs-pill mb-4">
          <VTab v-for="tab in tabs" :key="tab.icon">
            <VIcon :size="18" :icon="tab.icon" class="me-1" />
            <span>{{ tab.title }}</span>
          </VTab>
        </VTabs>

        <VWindow
          v-model="dealTab"
          class="disable-tab-transition"
          :touch="false"
        >
          <VWindowItem>
            <DealItemsTab
              :deal="deal"
              @open-add-task="openAddTask"
              @open-edit-task="openEditTask"
              @delete-task="deleteTask"
            />
          </VWindowItem>

          <VWindowItem>
            <DealCommunicationTab
              :deal-id="deal.id"
              :deal-code="deal.code || `Deal #${deal.id}`"
              @open-add-task="handleAddTaskFromCommunication"
              @open-add-email="openEmail"
              @open-add-meeting="handleAddMeetingFromCommunication"
              @open-add-call="handleAddCallFromCommunication"
            />
          </VWindowItem>

          <VWindowItem>
            <DealDocumentsTab
              :deal-id="deal.id"
              @open-add-todo="handleDocumentTodoRequest"
            />
          </VWindowItem>

          <VWindowItem>
            <DealFinancialsTab :deal="deal" />
          </VWindowItem>

          <VWindowItem>
            <DealTimelineTab :deal="deal" />
          </VWindowItem>
        </VWindow>
      </VCol>
    </VRow>

    <VAlert v-else-if="error" type="error" variant="tonal">
      {{ error }}
    </VAlert>

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model:modelValue="isAddMeetingOpen"
      :contacts="contactOptions"
      :lock-related-to="lockMeetingRelatedTo"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      source="employees"
      :initial="addTodoInitial ?? undefined"
      @user-data="onTodoCreated"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerVisible"
      :todo="editingTodo"
      :collaborators-options="contactOptions"
      @save="onTodoEdited"
      @saveSteps="onTodoStepsEdited"
    />

    <CatalogueTaskTemplateDrawer
      ref="taskTemplateDrawerRef"
      v-model:is-drawer-open="isTaskTemplateDrawerOpen"
      :goal-trigger-options="goalTriggerOptions"
      @save="onTaskTemplateSaved"
    />

    <VDialog v-model="isExecutePreviewDialogVisible" max-width="840">
      <VCard>
        <VCardItem>
          <VCardTitle>Confirm Deal Execution</VCardTitle>
          <VCardSubtitle>
            Review job creation, milestones, goals, and tasks before confirming.
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <VAlert
            v-if="executePreviewError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ executePreviewError }}
          </VAlert>

          <template v-else-if="executePreview">
            <VRow class="mb-2">
              <VCol cols="12" md="6">
                <VCard variant="tonal" class="pa-4 h-100">
                  <div class="text-overline mb-2">New Job</div>
                  <div class="text-h6 mb-2">{{ executePreview.job.name }}</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ executePreview.job.type }} |
                    {{ executePreview.job.stage }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    Start: {{ formatPreviewDate(executePreview.executedAt) }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    Location: {{ executePreview.job.location || "--" }}
                  </div>
                </VCard>
              </VCol>

              <VCol cols="12" md="6">
                <VCard variant="tonal" class="pa-4 h-100">
                  <div class="text-overline mb-2">Execution Summary</div>
                  <div class="d-flex flex-column gap-1 text-body-2">
                    <span>
                      {{ executePreview.summary.milestoneCount }} milestones
                    </span>
                    <span>{{ executePreview.summary.goalCount }} goals</span>
                    <span>
                      {{ executePreview.summary.jobTaskCount }} new job tasks
                    </span>
                    <span>
                      {{
                        executePreview.summary.keptDealSalesTaskCount
                      }}
                      existing deal sales tasks stay on deal
                    </span>
                    <span>
                      {{ executePreview.summary.customMilestoneCount }} custom
                      item milestones
                    </span>
                  </div>
                </VCard>
              </VCol>
            </VRow>

            <VExpansionPanels multiple>
              <VExpansionPanel
                v-for="milestone in executePreview.milestones"
                :key="milestone.key"
              >
                <VExpansionPanelTitle>
                  <div>
                    <div class="font-weight-medium">
                      {{ milestone.name }}
                      <VChip
                        v-if="milestone.isFallback"
                        size="x-small"
                        color="warning"
                        class="ms-2"
                        label
                      >
                        Custom Item
                      </VChip>
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ milestone.sourceLabel }} | Due
                      {{ formatPreviewDate(milestone.dueDate) }}
                    </div>
                  </div>
                </VExpansionPanelTitle>

                <VExpansionPanelText>
                  <div class="text-body-2 mb-3">
                    {{ milestone.note || "No milestone note." }}
                  </div>

                  <div v-if="milestone.tasks.length" class="mb-4">
                    <div class="text-subtitle-2 mb-2">Milestone Tasks</div>
                    <VList density="compact">
                      <VListItem
                        v-for="task in milestone.tasks"
                        :key="task.key"
                        :title="task.title"
                        :subtitle="`${formatPreviewDate(task.dueAt)} | ${task.sourceLabel}`"
                      />
                    </VList>
                  </div>

                  <div
                    v-if="milestone.goals.length"
                    class="d-flex flex-column gap-3"
                  >
                    <VCard
                      v-for="goal in milestone.goals"
                      :key="goal.key"
                      variant="outlined"
                      class="pa-4"
                    >
                      <div class="font-weight-medium">{{ goal.name }}</div>
                      <div class="text-body-2 text-medium-emphasis mb-2">
                        Due {{ formatPreviewDate(goal.dueDate) }}
                      </div>
                      <div class="text-body-2 mb-3">
                        {{ goal.note || "No goal note." }}
                      </div>
                      <VList v-if="goal.tasks.length" density="compact">
                        <VListItem
                          v-for="task in goal.tasks"
                          :key="task.key"
                          :title="task.title"
                          :subtitle="`${formatPreviewDate(task.dueAt)} | ${task.sourceLabel}`"
                        />
                      </VList>
                      <div v-else class="text-body-2 text-medium-emphasis">
                        No goal tasks.
                      </div>
                    </VCard>
                  </div>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>

            <VCard
              v-if="executePreview.generalTasks.length"
              variant="outlined"
              class="pa-4 mt-4"
            >
              <div class="text-subtitle-1 mb-2">General Job Tasks</div>
              <VList density="compact">
                <VListItem
                  v-for="task in executePreview.generalTasks"
                  :key="task.key"
                  :title="task.title"
                  :subtitle="`${formatPreviewDate(task.dueAt)} | ${task.sourceLabel}`"
                />
              </VList>
            </VCard>

            <VCard variant="outlined" class="pa-4 mt-4">
              <div class="text-subtitle-1 mb-2">Existing Deal Sales Tasks</div>
              <VList
                v-if="executePreview.keptDealSalesTasks.length"
                density="compact"
              >
                <VListItem
                  v-for="task in executePreview.keptDealSalesTasks"
                  :key="task.id"
                  :title="task.title"
                  :subtitle="`${formatPreviewDate(task.dueAt)} | ${task.status}`"
                />
              </VList>
              <div v-else class="text-body-2 text-medium-emphasis">
                No existing deal sales tasks will be kept.
              </div>
            </VCard>
          </template>
        </VCardText>

        <VCardActions class="justify-end">
          <VBtn
            variant="text"
            color="secondary"
            :disabled="isExecutingDeal"
            @click="closeExecutePreviewDialog"
          >
            Cancel
          </VBtn>
          <VBtn
            color="primary"
            :loading="isExecutingDeal"
            :disabled="!executePreview || Boolean(executePreviewError)"
            @click="confirmDealExecution"
          >
            Confirm Execution
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            upsertDealEmailThread(payload);
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

    <DealUpsertDialog
      v-model:is-dialog-visible="isDealEditDialogVisible"
      :deal="deal"
      :loading="dialogLoading"
      :error="dialogError"
      @submit="saveDeal"
    />
  </div>
</template>
