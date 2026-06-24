<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactRef, ToDo } from "@/data/schema";
import type { InvoiceRecord } from "@/plugins/fake-api/handlers/apps/invoice/types";
import type { ProformaRecord } from "@/plugins/fake-api/handlers/apps/proforma/types";
import type {
  CatalogueJobConfigTask,
  CatalogueRecord,
  CatalogueTaskStartTrigger,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealItem,
  DealProperties,
  DealSalesTaskTemplate,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import type {
  JobDocument,
  JobFlag,
  JobProperties,
  JobType,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import { useInvoicesStore } from "@/stores/invoices";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { useTodos } from "@/stores/todos";
import { getQuotationTopLevelDealItems } from "@/utils/dealDocumentDraft";
import {
  getDealDocumentBalance,
  getDealDocumentPaid,
  getDealDocumentTotal,
  getDealItemsGrandTotal,
} from "@/utils/dealBilling";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import {
  getContactAndEmployeeRefs,
  getEmployeeOptions,
  getEmployeeRefs,
} from "@/utils/peopleOptions";
import {
  findCurrentUserOption,
  getSignedInAuthorRef,
  getSignedInIdentity,
} from "@/utils/currentAccount";
import {
  canCurrentUser,
  hasHiddenFinancials,
  isPermissionDeniedError,
  mapAuthorizationResource,
} from "@/utils/authorization";
import {
  canMutate,
  permissionDisabledReason,
} from "@/utils/permissionUi";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";
import EditToDoDrawer from "@/views/apps/todo/list/EditToDoDrawer.vue";
import DealUpsertDialog from "@/views/operations/deals/list/DealUpsertDialog.vue";
import DealBillingSummaryCard from "@/views/operations/deals/view/DealBillingSummaryCard.vue";
import DealCommunicationTab from "@/views/operations/deals/view/DealCommunicationTab.vue";
import DealDocumentsTab from "@/views/operations/deals/view/DealDocumentsTab.vue";
import DealItemsTab from "@/views/operations/deals/view/DealItemsTab.vue";
import DealNotesTab from "@/views/operations/deals/view/DealNotesTab.vue";
import DealSummaryCard from "@/views/operations/deals/view/DealSummaryCard.vue";

const route = useRoute("operations-deals-view-id");
const router = useRouter();

const cataloguesStore = useCataloguesStore();
const configStore = useConfigStore();
const dealsStore = useDealsStore();
const contactsStore = useContactsStore();
const employeesStore = useEmployeesStore();
const jobsStore = useJobsStore();
const notifications = useNotificationsStore();
const systemNotificationsStore = useSystemNotificationsStore();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();
const todosStore = useTodos();

cataloguesStore.init();
configStore.init();
dealsStore.init();
contactsStore.init();
employeesStore.init();
jobsStore.init();
systemNotificationsStore.init();
quotationsStore.init();
proformasStore.init();
invoicesStore.init();
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
const addTodoDrawerRef = ref<InstanceType<typeof AddNewToDoDrawer> | null>(
  null,
);
const isAddTodoDrawerVisible = ref(false);
const showImmediateDueOption = ref(false);
const addTodoInitial = ref<Partial<ToDo> | null>(null);
const editingTodo = ref<ToDo | null>(null);
const editingSalesTaskTemplateId = ref<number | string | null>(null);
const showImmediateDueOptionOnEdit = ref(false);
const isEditTodoDrawerVisible = ref(false);
const isExecutePreviewDialogVisible = ref(false);
const isExecutingDeal = ref(false);
const executePreviewError = ref<string | null>(null);
const executePreview = ref<DealExecutionPreview | null>(null);
const selectedJobOwnerId = ref<number | null>(null);
const isAddNoteDialogVisible = ref(false);
const noteDraft = ref("");
const isCollaboratorDialogVisible = ref(false);
const collaboratorDialogValue = ref<Array<number | string>>([]);

const tabKeys = ["items", "activity", "documents", "notes"] as const;
const tabs = [
  { icon: "tabler-package", title: "Items" },
  { icon: "tabler-message", title: "Activity" },
  { icon: "tabler-folder", title: "Documents" },
  { icon: "tabler-notes", title: "Notes" },
] as const;

type ExecutionPreviewTaskKind = "sales" | "milestone" | "goal";

type ExecutionPreviewTask = {
  key: string;
  title: string;
  dueAt: string;
  startAt: string | null;
  completionMinutes: number | null;
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
  dateOverride?: boolean;
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
  dateOverride?: boolean;
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
  customMilestoneCount: number;
  documentCount: number;
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
  documents: JobDocument[];
  milestones: ExecutionPreviewMilestone[];
  generalTasks: ExecutionPreviewTask[];
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

const avatarText = (name?: string | null) =>
  String(name || "")
    .match(/\b\w/g)
    ?.slice(0, 2)
    .join("")
    .toUpperCase() || "?";

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

const resolveConvertedTaskSchedule = (
  task: Partial<CatalogueJobConfigTask>,
  baselineIso: string,
) => {
  const startAt = resolveScheduledDate(task.afterWhen, baselineIso) || baselineIso;
  const explicitDue =
    (task as any).dueAt ?? (task as any).dueDate ?? null;

  return {
    startAt,
    dueAt: explicitDue
      ? resolveScheduledDate(explicitDue, baselineIso) || startAt
      : startAt,
  };
};

const earliestIso = (values: Array<string | null | undefined>) => {
  let earliest: string | null = null;
  let earliestTime = Number.POSITIVE_INFINITY;

  values.forEach((value) => {
    if (!value) return;
    const time = new Date(value).getTime();
    if (Number.isNaN(time) || time >= earliestTime) return;
    earliest = value;
    earliestTime = time;
  });

  return earliest;
};

const latestIso = (values: Array<string | null | undefined>) => {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  values.forEach((value) => {
    if (!value) return;
    const time = new Date(value).getTime();
    if (Number.isNaN(time) || time <= latestTime) return;
    latest = value;
    latestTime = time;
  });

  return latest;
};

const rollupGoalPreviewDates = (goal: ExecutionPreviewGoal) => {
  if (goal.dateOverride) return;

  const childStarts = goal.tasks.map((task) => task.startAt ?? task.dueAt);
  const childDues = goal.tasks.map((task) => task.dueAt ?? task.startAt);

  goal.startDate = earliestIso(childStarts) ?? goal.startDate;
  goal.dueDate = latestIso(childDues) ?? goal.dueDate;
};

const rollupMilestonePreviewDates = (
  milestone: ExecutionPreviewMilestone,
) => {
  milestone.goals.forEach(rollupGoalPreviewDates);
  if (milestone.dateOverride) return;

  const childStarts = [
    ...milestone.tasks.map((task) => task.startAt ?? task.dueAt),
    ...milestone.goals.map((goal) => goal.startDate),
  ];
  const childDues = [
    ...milestone.tasks.map((task) => task.dueAt ?? task.startAt),
    ...milestone.goals.map((goal) => goal.dueDate),
  ];

  milestone.startDate = earliestIso(childStarts) ?? milestone.startDate;
  milestone.dueDate = latestIso(childDues) ?? milestone.dueDate;
};

const resolveJobConfigMilestones = (record: CatalogueRecord | null) => {
  if (!record || !("jobConfiguration" in record)) return [];

  return Array.isArray(record.jobConfiguration?.milestones)
    ? record.jobConfiguration.milestones
    : [];
};

const cloneDealSalesTaskTemplate = (
  task: DealSalesTaskTemplate,
): DealSalesTaskTemplate => ({
  ...task,
  collaborators: Array.isArray(task.collaborators)
    ? task.collaborators.map((collaborator) => ({ ...collaborator }))
    : [],
  startTrigger: task.startTrigger
    ? {
        type: task.startTrigger.type,
        goalId: task.startTrigger.goalId ?? null,
        taskId: task.startTrigger.taskId ?? null,
      }
    : null,
  attachment: task.attachment ? { ...task.attachment } : null,
  relatedTo: task.relatedTo ? { ...task.relatedTo } : null,
  steps: Array.isArray(task.steps)
    ? task.steps.map((step, index) => ({
        ...step,
        id: step.id ?? index + 1,
        collaborators: Array.isArray(step.collaborators)
          ? step.collaborators.map((collaborator) => ({ ...collaborator }))
          : [],
      }))
    : [],
  sourceItemId: task.sourceItemId ?? null,
  sourceTaskId: task.sourceTaskId ?? null,
});

const resolveDealSalesTasks = (
  currentDeal: DealProperties,
): DealSalesTaskTemplate[] => {
  const currentDealRelatedTo: SalesTaskRelatedTo = {
    id: currentDeal.id,
    name: currentDeal.code || `Deal #${currentDeal.id}`,
    type: "deal",
  };
  const linkedJobId = currentDeal.linkedJobId;
  const currentLinkedJobRelatedTo: SalesTaskRelatedTo | null =
    linkedJobId !== null && linkedJobId !== undefined
      ? {
          id: linkedJobId,
          name:
            linkedJob.value?.code ||
            linkedJob.value?.name ||
            `Job #${linkedJobId}`,
          type: "job",
        }
      : null;
  const normalizeCurrentTaskRelation = (
    relatedTo?: ToDo["relatedTo"] | null,
  ): SalesTaskRelatedTo => {
    const matchesDeal =
      relatedTo?.type === "deal" &&
      String(relatedTo.id) === String(currentDeal.id);
    const matchesLinkedJob =
      Boolean(currentLinkedJobRelatedTo) &&
      relatedTo?.type === "job" &&
      String(relatedTo.id) === String(currentLinkedJobRelatedTo?.id);

    return matchesDeal || matchesLinkedJob
      ? {
          id: relatedTo.id,
          name: relatedTo.name,
          type: relatedTo.type,
        }
      : currentDealRelatedTo;
  };

  return Array.isArray(currentDeal.salesTasks)
    ? currentDeal.salesTasks.map((task) =>
        cloneDealSalesTaskTemplate({
          ...task,
          collaborators: normalizeTaskCollaborators(task.collaborators),
          relatedTo: normalizeCurrentTaskRelation(task.relatedTo),
        }),
      )
    : [];
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
  ...preview.generalTasks.filter((task) => task.kind !== "sales"),
];

const cloneJobDocument = (document: JobDocument): JobDocument => ({
  ...document,
});

const buildStoredAttachmentUrl = (
  fileKey?: string | null,
  fileName?: string | null,
) => {
  const normalizedFileKey = String(fileKey ?? "").trim();

  if (!normalizedFileKey) return "";

  const normalizedFileName = String(fileName ?? "").trim();

  return normalizedFileName
    ? `idb:${normalizedFileKey}|${encodeURIComponent(normalizedFileName)}`
    : `idb:${normalizedFileKey}`;
};

const buildExecutionFinanceDocumentRows = <
  TRecord extends {
    note?: string | null;
    quotation: {
      attachmentFileKey?: string | null;
      attachmentName?: string | null;
      dealId?: number | string | null;
      id: number | string;
      issuedDate?: string | null;
      quoteNumber?: string | null;
      quotationStatus?: string | null;
      source?: string | null;
    };
  },
>(
  kind: "quotation" | "proforma" | "invoice",
  currentDealId: number | string,
  records: TRecord[],
): JobDocument[] =>
  records
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(currentDealId) &&
        (String(record.quotation.attachmentFileKey ?? "").trim() ||
          String(record.quotation.attachmentName ?? "").trim()),
    )
    .map((record, index) => {
      const quoteNumber = String(record.quotation.quoteNumber ?? "").trim();
      const attachmentName = String(
        record.quotation.attachmentName ?? "",
      ).trim();
      const fileUrl = buildStoredAttachmentUrl(
        record.quotation.attachmentFileKey,
        attachmentName,
      );
      const numericRecordId = Number(record.quotation.id);
      const fallbackId = index + 1;
      const stableId = Number.isFinite(numericRecordId)
        ? numericRecordId
        : fallbackId;
      const idBase = kind === "quotation" ? 1 : kind === "proforma" ? 2 : 3;

      return {
        category:
          record.quotation.source === "external"
            ? "External Attachment"
            : "Linked Attachment",
        createdAt:
          String(record.quotation.issuedDate ?? "").trim() || undefined,
        expiry: null,
        expiryReminder: false,
        fileUrl,
        id: -(idBase * 1000000 + stableId),
        name:
          attachmentName ||
          `${kind.toUpperCase()} ${quoteNumber || `#${record.quotation.id}`}`,
        note:
          [
            quoteNumber ? `Number: ${quoteNumber}` : "",
            record.quotation.quotationStatus
              ? `Status: ${record.quotation.quotationStatus}`
              : "",
            String(record.note ?? "").trim(),
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
        type:
          kind === "quotation"
            ? "Quotation"
            : kind === "proforma"
              ? "Proforma"
              : "Invoice",
      } satisfies JobDocument;
    });

const buildExecutionDocuments = (currentDeal: DealProperties) => {
  const dealDocuments = Array.isArray(currentDeal.documents)
    ? currentDeal.documents.map((document) => cloneJobDocument(document))
    : [];
  const linkedFinanceDocuments = [
    ...buildExecutionFinanceDocumentRows(
      "quotation",
      currentDeal.id,
      quotationsStore.items,
    ),
    ...buildExecutionFinanceDocumentRows(
      "proforma",
      currentDeal.id,
      proformasStore.items,
    ),
    ...buildExecutionFinanceDocumentRows(
      "invoice",
      currentDeal.id,
      invoicesStore.items,
    ),
  ];

  return mergeJobDocuments(dealDocuments, linkedFinanceDocuments);
};

const resolveExecutionTargetJob = (currentDeal: DealProperties) => {
  const linkedJobId = currentDeal.linkedJobId;
  if (linkedJobId === null || linkedJobId === undefined) {
    return null;
  }

  return jobsStore.byId(linkedJobId);
};

const mergeJobDocuments = (
  existing: JobDocument[] | undefined | null,
  incoming: JobDocument[] | undefined | null,
) => {
  const merged = new Map<string, JobDocument>();

  (existing || []).forEach((document, index) => {
    const key = String(
      document.id ?? `${document.name}:${document.fileUrl}:${index}`,
    );
    merged.set(key, cloneJobDocument(document));
  });

  (incoming || []).forEach((document, index) => {
    const key = String(
      document.id ?? `${document.name}:${document.fileUrl}:${index}`,
    );
    if (!merged.has(key)) merged.set(key, cloneJobDocument(document));
  });

  return Array.from(merged.values());
};

const buildExecutionPreview = (
  currentDeal: DealProperties,
  executedAt: string,
): DealExecutionPreview => {
  const milestones: ExecutionPreviewMilestone[] = [];
  const generalTasks: ExecutionPreviewTask[] = [];
  const rootItems = (currentDeal.items || []).filter(
    (item) => !item.parentItemId,
  );
  const dealReference =
    currentDeal.code?.trim() ||
    currentDeal.name?.trim() ||
    `Deal #${currentDeal.id}`;

  const job: ExecutionPreviewJob = {
    name: currentDeal.projectCode?.trim() || `Job for ${dealReference}`,
    code: currentDeal.projectCode?.trim() || currentDeal.code?.trim() || null,
    startDate: executedAt,
    location: currentDeal.location?.trim() || null,
    stage: "Project | In Progress",
    type: isJobType(currentDeal.type) ? currentDeal.type : "Other",
    flag: currentDeal.important ? "High" : "Normal",
    relatedTo: currentDeal.relatedTo ?? null,
    collaborators: (currentDeal.collaborators || [])
      .map((value) => (typeof value === "string" ? null : Number(value)))
      .filter((value): value is number => Number.isFinite(value)),
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
        baselineAt?: string | null;
      },
    ): ExecutionPreviewTask => {
      const taskSchedule = resolveConvertedTaskSchedule(
        rawTask,
        options.baselineAt || executedAt,
      );
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
        dueAt: taskSchedule.dueAt,
        startAt: taskSchedule.startAt,
        completionMinutes: Number.isFinite(
          Number(
            (rawTask as any).completionMinutes ??
              (rawTask as any).actualMinutes ??
              (rawTask as any).estimatedMinutes,
          ),
        )
          ? Number(
              (rawTask as any).completionMinutes ??
                (rawTask as any).actualMinutes ??
                (rawTask as any).estimatedMinutes,
            )
          : Number.isFinite(Number(rawTask.manhours))
            ? Math.max(0, Math.round(Number(rawTask.manhours) * 60))
            : null,
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
      const milestoneHasChildren = Boolean(
        milestone.tasks?.length || milestone.goals?.length,
      );
      const milestoneHasOverride = Boolean((milestone as any).dateOverride);
      const configuredMilestoneDue = resolveScheduledDate(
        milestone.afterWhen ?? milestone.dueDate,
        executedAt,
      );
      const configuredMilestoneStart =
        resolveScheduledDate(milestone.afterWhen, executedAt) ??
        configuredMilestoneDue ??
        executedAt;
      const previewMilestone: ExecutionPreviewMilestone = {
        key: milestoneKey,
        name: String(milestone.name || item.name).trim() || item.name,
        startDate:
          milestoneHasOverride || !milestoneHasChildren
            ? configuredMilestoneStart
            : executedAt,
        dueDate:
          milestoneHasOverride || !milestoneHasChildren
            ? configuredMilestoneDue
            : null,
        dateOverride: milestoneHasOverride,
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
          const goalHasTasks = Boolean(goal.tasks?.length);
          const goalHasOverride = Boolean((goal as any).dateOverride);
          const configuredGoalDue = resolveScheduledDate(
            goal.afterWhen ?? goal.dueDate,
            executedAt,
          );
          const configuredGoalStart =
            resolveScheduledDate(goal.afterWhen, executedAt) ??
            configuredGoalDue ??
            previewMilestone.startDate;

          goalTemplateMap.set(String(goal.id), goalKey);
          goalMilestoneMap.set(goalKey, milestoneKey);

          return {
            key: goalKey,
            milestoneKey,
            name: String(goal.name || "").trim() || "Untitled Goal",
            startDate:
              goalHasOverride || !goalHasTasks
                ? configuredGoalStart
                : previewMilestone.startDate,
            dueDate:
              goalHasOverride || !goalHasTasks ? configuredGoalDue : null,
            dateOverride: goalHasOverride,
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
          baselineAt: previewMilestone.startDate,
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
            baselineAt: goalPreview.startDate || previewMilestone.startDate,
          }),
        );
      });

      rollupMilestonePreviewDates(previewMilestone);

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
        dateOverride: false,
        priority: "Normal",
        note: item.note?.trim() || null,
        sourceLabel: item.name,
        isFallback: true,
        tasks: [],
        goals: [],
      });
    }

    itemTasks.forEach((task) => {
      if (task.startTriggerType !== "task" || !task.startTriggerTaskSourceId)
        return;

      const lookupKey = task.startTriggerTaskSourceId;
      if (!lookupKey) return;

      task.startTriggerTaskKey = taskTemplateMap.get(lookupKey) ?? null;
    });
  });

  const documents = buildExecutionDocuments(currentDeal);
  const jobTaskCount = [
    ...milestones.flatMap((milestone) => [
      ...milestone.tasks,
      ...milestone.goals.flatMap((goal) => goal.tasks),
    ]),
    ...generalTasks.filter((task) => task.kind !== "sales"),
  ].length;

  const summary: ExecutionPreviewSummary = {
    milestoneCount: milestones.length,
    goalCount: milestones.reduce(
      (sum, milestone) => sum + milestone.goals.length,
      0,
    ),
    jobTaskCount,
    customMilestoneCount: milestones.filter((milestone) => milestone.isFallback)
      .length,
    documentCount: documents.length,
  };

  return {
    executedAt,
    job,
    documents,
    milestones,
    generalTasks,
    summary,
  };
};

const closeExecutePreviewDialog = () => {
  isExecutePreviewDialogVisible.value = false;
  isExecutingDeal.value = false;
  executePreview.value = null;
  executePreviewError.value = null;
  selectedJobOwnerId.value = null;
};

const cloneDeal = (value: DealProperties | null) => {
  if (!value) return null;

  return JSON.parse(JSON.stringify(value)) as DealProperties;
};

const resolveLatestDealState = () => {
  const currentId = deal.value?.id ?? route.params.id;
  const latest = dealsStore.byId(currentId);

  if (latest) {
    deal.value = cloneDeal(latest);
    return latest;
  }

  return deal.value;
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
  const rawQueryTab = String(route.query.tab || tabKeys[0]);
  const queryTab =
    rawQueryTab === "communication" || rawQueryTab === "timeline"
      ? "activity"
      : rawQueryTab;
  const index = (tabKeys as readonly string[]).indexOf(queryTab);
  dealTab.value = index === -1 ? 0 : index;
};

const linkedToName = computed(() => {
  const relatedId = deal.value?.relatedTo;
  if (relatedId === null || relatedId === undefined) return "--";

  return contactsStore.byId(Number(relatedId))?.fullName || "--";
});

const linkedContact = computed(() => {
  const relatedId = deal.value?.relatedTo;
  if (relatedId === null || relatedId === undefined) return null;

  const contact = contactsStore.byId(Number(relatedId));
  if (!contact) return null;

  return {
    name: contact.fullName,
    avatarUrl: contact.picture || null,
    type: contact.type,
  };
});

const salesmanName = computed(() => {
  const salesman = deal.value?.salesman;
  const raw = String(salesman ?? "").trim();
  if (!raw) return "--";

  if (raw.startsWith("contact:")) {
    const contactId = Number(raw.slice("contact:".length));

    return contactsStore.byId(contactId)?.fullName || `Contact ${contactId}`;
  }

  const employeeId = Number(salesman);
  if (Number.isFinite(employeeId)) {
    const employee = employeesStore.byId(employeeId);
    if (employee) return employee.fullName;
  }

  return raw;
});

const dealStageOptions = computed(() =>
  (configStore.configurations?.deals?.dealStages || []).map((stage) =>
    String(stage),
  ),
);

const resolveDealCollaborator = (value: number | string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const legacyEmployeeAliases: Record<string, number> = {
    "6": 3,
    "18": 4,
  };

  if (raw.startsWith("contact:")) return null;

  const employeeId = legacyEmployeeAliases[raw] ?? Number(value);
  const employee = employeesStore.byId(employeeId);

  if (!employee) return null;

  return {
    id: employeeId,
    name: employee.fullName,
    avatarUrl: employee.picture || null,
    type: "employee" as const,
    employeeId,
  };
};

const collaboratorNames = computed(() =>
  (deal.value?.collaborators || []).map((id) => {
    const collaborator = resolveDealCollaborator(id);

    return collaborator?.name || String(id);
  }),
);

const dealEmployeeCollaborators = computed(
  () =>
    (deal.value?.collaborators || [])
      .map((id) => {
        const collaborator = resolveDealCollaborator(id);

        return collaborator
          ? {
              id: collaborator.id,
              name: collaborator.name,
              avatarUrl: collaborator.avatarUrl,
              type: collaborator.type,
              employeeId: collaborator.employeeId,
            }
          : null;
      })
      .filter(Boolean) as Array<{
      id: number | string;
      name: string;
      avatarUrl: string | null;
      type: "employee";
      employeeId?: number;
    }>,
);

const employeeOptions = computed(() => getEmployeeRefs());

type DealBillingDocument = InvoiceRecord | ProformaRecord;

const isCurrentDealBillingDocument = (record: DealBillingDocument) => {
  if (!deal.value) return false;
  if (String(record.quotation?.dealId ?? "") !== String(deal.value.id))
    return false;

  const linkedType = record.quotation?.linkedRecordType;

  return (
    linkedType === "deal" || linkedType === null || linkedType === undefined
  );
};

const dealBillingDocuments = computed<DealBillingDocument[]>(() => [
  ...invoicesStore.items.filter(isCurrentDealBillingDocument),
]);

const dealProformaBillingAmount = computed(() =>
  proformasStore.items
    .filter(isCurrentDealBillingDocument)
    .reduce((sum, record) => sum + getDealDocumentTotal(record), 0),
);

const dealProformaBillingCount = computed(
  () => proformasStore.items.filter(isCurrentDealBillingDocument).length,
);

const dealBillingPaid = computed(() =>
  dealBillingDocuments.value.reduce(
    (sum, record) => sum + getDealDocumentPaid(record),
    0,
  ),
);

const dealBillingUnpaid = computed(() =>
  dealBillingDocuments.value.reduce(
    (sum, record) => sum + getDealDocumentBalance(record),
    0,
  ),
);

const getDealItemBillingQuantity = (item: DealItem) => {
  if (!item.parentItemId && item.catalogueType === "Retainer Service")
    return Math.max(Number(item.retainerPeriods ?? 1), 1);
  if (!item.parentItemId && item.catalogueType === "Reccurent Service")
    return Math.max(Number(item.recurrentPeriods ?? 1), 1);

  return Number(item.quantity ?? 1);
};

const dealBillingGrossTotal = computed(() => {
  if (!deal.value) return 0;

  return getDealItemsGrandTotal(
    getQuotationTopLevelDealItems(deal.value.items || [], (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    ),
    getDealItemBillingQuantity,
  );
});

const dealBillingToBeInvoiced = computed(() =>
  Math.max(
    dealBillingGrossTotal.value -
      dealBillingPaid.value -
      dealBillingUnpaid.value,
    0,
  ),
);

const dealCollaboratorOptions = computed(() => getEmployeeOptions());
const jobOwnerOptions = computed(() => getEmployeeOptions());

const numericEmployeeId = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const resolveDefaultJobOwnerId = (currentDeal: DealProperties) => {
  const currentUserOption = findCurrentUserOption(jobOwnerOptions.value);
  const currentUserId = numericEmployeeId(currentUserOption?.value);
  if (currentUserId) return currentUserId;

  const optionIds = new Set(
    jobOwnerOptions.value
      .map((option) => numericEmployeeId(option.value))
      .filter((value): value is number => value !== null),
  );
  const dealCollaboratorId = (currentDeal.collaborators || [])
    .map((value) => {
      const collaborator = resolveDealCollaborator(value);
      return numericEmployeeId(collaborator?.employeeId ?? value);
    })
    .find((value): value is number => value !== null && optionIds.has(value));

  return dealCollaboratorId ?? null;
};

const selectedJobOwnerName = computed(() => {
  const ownerId = selectedJobOwnerId.value;
  if (!ownerId) return "--";

  return (
    jobOwnerOptions.value.find(
      (option) => String(option.value) === String(ownerId),
    )?.title ?? `Employee #${ownerId}`
  );
});

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
      name: collaborator.name,
      avatarUrl: collaborator.avatarUrl,
      type: collaborator.type,
      employeeId: collaborator.employeeId,
      roles: ["employee"] as ["employee"],
    });
  });

  return entries;
});

const meetingContacts = computed(() => getContactAndEmployeeRefs());

const taskCollaboratorOptions = computed(() => {
  const byKey = new Map<string, ContactRef>();
  const addOption = (option: ContactRef) => {
    byKey.set(String(option.id), option);
  };

  employeeOptions.value.forEach(addOption);
  dealEmployeeCollaborators.value.forEach((collaborator) =>
    addOption({
      id: collaborator.id,
      name: collaborator.name,
      avatarUrl: collaborator.avatarUrl,
    }),
  );

  return Array.from(byKey.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
});

const resolveTaskCollaborator = (entry: unknown): ContactRef => {
  const raw =
    entry && typeof entry === "object"
      ? (entry as Partial<ContactRef> & { fullName?: string; picture?: string })
      : null;
  const rawId =
    raw?.id ??
    (typeof entry === "string" || typeof entry === "number" ? entry : null);
  const matched = taskCollaboratorOptions.value.find(
    (option) => String(option.id) === String(rawId),
  );

  if (matched) return { ...matched };

  const fallbackName =
    raw?.name || raw?.fullName || `User #${rawId ?? "unknown"}`;

  return {
    id: rawId ?? fallbackName,
    name: fallbackName,
    avatarUrl: raw?.avatarUrl ?? raw?.picture ?? null,
  };
};

const normalizeTaskCollaborators = (collaborators: unknown): ContactRef[] =>
  Array.isArray(collaborators)
    ? collaborators.map(resolveTaskCollaborator)
    : [];

const notifyJobConversionRecipients = (
  executionJob: JobProperties,
  projectManagerId: number,
) => {
  const owner = employeesStore.items.find(
    (entry) => String(entry.id) === String(projectManagerId),
  );
  const managerIds = Array.isArray(owner?.employment?.reportToIds)
    ? owner.employment.reportToIds
    : [];
  const recipientIds = Array.from(
    new Set(
      [projectManagerId, ...managerIds]
        .map((value) => numericEmployeeId(value))
        .filter((value): value is number => value !== null),
    ),
  );
  const now = new Date().toISOString();
  const dealLabel =
    deal.value?.code?.trim() || deal.value?.name?.trim() || `Deal #${deal.value?.id}`;

  return recipientIds
    .map((recipientId) => {
      const recipient = employeesStore.items.find(
        (entry) => String(entry.id) === String(recipientId),
      );
      if (!recipient) return null;

      const created = systemNotificationsStore.addNotification({
        recipientEmployeeId: recipient.id,
        title: `Job assignment: ${executionJob.name}`,
        body: `${dealLabel} was converted to ${executionJob.name}. Owner: ${selectedJobOwnerName.value}.`,
        createdAt: now,
        type: "job-assignment",
        target: {
          entityType: "job",
          entityId: executionJob.id,
          routeName: "operations-jobs-view-id",
          query: { tab: "milestones-goals" },
        },
      });

      return created.id;
    })
    .filter((value): value is number => value !== null);
};

const linkedJob = computed(() => {
  const linkedJobId = Number(deal.value?.linkedJobId ?? NaN);
  if (!Number.isFinite(linkedJobId)) return null;

  return jobsStore.byId(linkedJobId) ?? null;
});

const dealExecutionNotice = computed(() => {
  if (!linkedJob.value) return null;

  const linkedJobLabel =
    linkedJob.value.code?.trim() ||
    linkedJob.value.name?.trim() ||
    "linked job";

  return `Already converted to ${linkedJobLabel}.`;
});

const currentDealResource = computed(() =>
  deal.value ? mapAuthorizationResource("deals", deal.value) : undefined,
);

const canUpdateDeal = computed(() =>
  canCurrentUser("deals", "update", currentDealResource.value),
);

const hideDealFinancials = computed(() => hasHiddenFinancials("deals"));

const canCreateTask = computed(() => canMutate("tasks", "create"));
const canUpdateTask = computed(() => canMutate("tasks", "update"));
const canDeleteTask = computed(() => canMutate("tasks", "delete"));
const canCreateCalendar = computed(() => canMutate("calendar", "create"));
const canCreateJob = computed(() => canMutate("jobs", "create"));
const canCreateFinance = computed(() => canMutate("finance", "create"));
const canUpdateFinance = computed(() => canMutate("finance", "update"));
const canDeleteFinance = computed(() => canMutate("finance", "delete"));
const canApproveFinance = computed(() => canMutate("finance", "approve"));

const dealUpdateDisabledReason = computed(() =>
  permissionDisabledReason("deals", "update"),
);
const taskCreateDisabledReason = computed(() =>
  permissionDisabledReason("tasks", "create"),
);
const taskUpdateDisabledReason = computed(() =>
  permissionDisabledReason("tasks", "update"),
);
const taskDeleteDisabledReason = computed(() =>
  permissionDisabledReason("tasks", "delete"),
);
const calendarCreateDisabledReason = computed(() =>
  permissionDisabledReason("calendar", "create"),
);
const financeCreateDisabledReason = computed(() =>
  hideDealFinancials.value
    ? "Financials are hidden for this role."
    : permissionDisabledReason("finance", "create"),
);
const canExecuteDeal = computed(
  () => canUpdateDeal.value && canCreateJob.value && canCreateTask.value,
);
const executeDealDisabledReason = computed(() => {
  if (dealExecutionNotice.value) return dealExecutionNotice.value;
  if (!canUpdateDeal.value) return dealUpdateDisabledReason.value;
  if (!canCreateJob.value) return permissionDisabledReason("jobs", "create");
  if (!canCreateTask.value) return taskCreateDisabledReason.value;

  return "";
});

const notifyDealUpdateDenied = () => {
  notifications.push(dealUpdateDisabledReason.value, "warning", 3000);
};

const notifyPermissionDenied = (message: string) => {
  notifications.push(message, "warning", 3000);
};

const executionTargetSummary = computed(() => {
  if (linkedJob.value) {
    return `Merge into ${linkedJob.value.name}`;
  }

  return "Create a new job";
});

const dealRelatedRef = computed(() =>
  deal.value
    ? {
        id: deal.value.id,
        name: deal.value.code || `Deal #${deal.value.id}`,
        type: "deal",
      }
    : null,
);

type SalesTaskRelatedTo = NonNullable<ToDo["relatedTo"]>;

const linkedJobRelatedRef = computed(() =>
  deal.value?.linkedJobId !== null && deal.value?.linkedJobId !== undefined
    ? {
        id: deal.value.linkedJobId,
        name:
          linkedJob.value?.code?.trim() ||
          linkedJob.value?.name?.trim() ||
          `Job #${deal.value.linkedJobId}`,
        type: "job",
      }
    : null,
);

const taskRelationCandidates = computed(() => {
  const candidates: Array<{ id: number | string; type: string }> = [];

  if (dealRelatedRef.value) {
    candidates.push({
      id: dealRelatedRef.value.id,
      type: dealRelatedRef.value.type,
    });
  }

  if (linkedJobRelatedRef.value) {
    candidates.push({
      id: linkedJobRelatedRef.value.id,
      type: linkedJobRelatedRef.value.type,
    });
  }

  return candidates;
});

const isValidSalesTaskRelation = (relatedTo?: ToDo["relatedTo"] | null) =>
  Boolean(
    relatedTo &&
    taskRelationCandidates.value.some(
      (candidate) =>
        relatedTo.type === candidate.type &&
        String(relatedTo.id) === String(candidate.id),
    ),
  );

const normalizeSalesTaskRelatedTo = (
  relatedTo?: ToDo["relatedTo"] | null,
): SalesTaskRelatedTo | null =>
  isValidSalesTaskRelation(relatedTo) && relatedTo
    ? {
        id: relatedTo.id,
        name: relatedTo.name,
        type: relatedTo.type,
      }
    : dealRelatedRef.value;

const goalTriggerOptions = computed(
  () => [] as Array<{ title: string; value: string }>,
);

const openEditDialog = () => {
  dialogError.value = null;
  if (!canUpdateDeal.value) {
    notifyDealUpdateDenied();
    return;
  }
  isDealEditDialogVisible.value = true;
};

const openAddNoteDialog = () => {
  if (!canUpdateDeal.value) {
    notifyDealUpdateDenied();
    return;
  }

  noteDraft.value = "";
  isAddNoteDialogVisible.value = true;
};

const closeAddNoteDialog = () => {
  noteDraft.value = "";
  isAddNoteDialogVisible.value = false;
};

const saveDealNote = () => {
  if (!deal.value) return;
  if (!canUpdateDeal.value) {
    notifyDealUpdateDenied();
    return;
  }

  const body = noteDraft.value.trim();
  if (!body) return;

  const authorName = getSignedInIdentity().name;
  const createdAt = new Date().toISOString();
  const updated = dealsStore.updateDeal(deal.value.id, {
    notes: [
      ...(deal.value.notes || []),
      {
        id: `note-${createdAt}-${Math.random().toString(36).slice(2)}`,
        body,
        createdAt,
        authorName,
      },
    ],
  });

  if (!updated) {
    notifications.push("Unable to save note", "error", 3000);
    return;
  }

  deal.value = cloneDeal(updated);
  closeAddNoteDialog();
  dealTab.value = tabKeys.indexOf("notes");
  notifications.push("Note added", "success", 2500);
};

const openCollaboratorDialog = () => {
  if (!deal.value) return;
  if (!canUpdateDeal.value) {
    notifyDealUpdateDenied();
    return;
  }

  collaboratorDialogValue.value = [...(deal.value.collaborators || [])];
  isCollaboratorDialogVisible.value = true;
};

const closeCollaboratorDialog = () => {
  collaboratorDialogValue.value = [];
  isCollaboratorDialogVisible.value = false;
};

const saveDealCollaborators = () => {
  if (!deal.value) return;
  if (!canUpdateDeal.value) {
    notifyDealUpdateDenied();
    return;
  }

  const updated = dealsStore.updateDeal(deal.value.id, {
    collaborators: [...collaboratorDialogValue.value],
  });

  if (!updated) {
    notifications.push("Unable to update collaborators", "error", 3000);
    return;
  }

  deal.value = cloneDeal(updated);
  closeCollaboratorDialog();
  notifications.push("Collaborators updated", "success", 2500);
};

const openExecutePreviewDialog = () => {
  const currentDeal = resolveLatestDealState();
  if (!currentDeal) return;
  if (linkedJob.value) return;
  if (!canExecuteDeal.value) {
    notifyPermissionDenied(executeDealDisabledReason.value);
    return;
  }

  const executedAt = new Date().toISOString();

  try {
    executePreview.value = buildExecutionPreview(currentDeal, executedAt);
    executePreviewError.value = null;
    selectedJobOwnerId.value = resolveDefaultJobOwnerId(currentDeal);
  } catch (previewError) {
    console.error("Failed to build deal conversion preview", previewError);
    executePreview.value = null;
    executePreviewError.value = "Unable to build conversion preview.";
    selectedJobOwnerId.value = null;
  }

  isExecutePreviewDialogVisible.value = true;
};

const confirmDealExecution = () => {
  const currentDeal = resolveLatestDealState();
  if (!currentDeal || !executePreview.value || isExecutingDeal.value) return;
  if (!canExecuteDeal.value) {
    notifyPermissionDenied(executeDealDisabledReason.value);
    return;
  }
  const projectManagerId = numericEmployeeId(selectedJobOwnerId.value);
  if (!projectManagerId) {
    notifications.push("Select a job owner before converting.", "warning", 3000);
    return;
  }

  isExecutingDeal.value = true;
  const currentDealId = currentDeal.id;
  const createdTodoIds: Array<number | string> = [];
  const createdNotificationIds: number[] = [];
  let createdJobId: number | string | null = null;
  const targetJob = resolveExecutionTargetJob(currentDeal);

  try {
    const preview = executePreview.value;
    const jobCollaborators = Array.from(
      new Set([projectManagerId, ...preview.job.collaborators]),
    );
    const stakeholderContactId = Number(preview.job.relatedTo ?? NaN);
    const stakeholders = Number.isFinite(stakeholderContactId)
      ? [
          {
            id: 1,
            contactId: stakeholderContactId,
            role: "Client",
          },
        ]
      : [];
    const executionJob =
      targetJob ??
      jobsStore.addJob({
        name: preview.job.name,
        code: preview.job.code,
        startDate: preview.job.startDate,
        location: preview.job.location,
        stage: preview.job.stage,
        type: preview.job.type,
        flag: preview.job.flag,
        relatedTo: preview.job.relatedTo,
        projectManagerId,
        collaborators: jobCollaborators,
        note: preview.job.note,
        milestones: [],
        goals: [],
        documents: preview.documents.map((document) =>
          cloneJobDocument(document),
        ),
        stakeholders,
      });
    if (!targetJob) createdJobId = executionJob.id;

    if (targetJob) {
      jobsStore.updateJob(targetJob.id, {
        documents: mergeJobDocuments(targetJob.documents, preview.documents),
      });
    }

    const relatedTo = {
      id: executionJob.id,
      name: executionJob.name,
      type: "job",
    };
    const updatedDeal = dealsStore.updateDeal(currentDealId, {
      linkedJobId: Number(executionJob.id),
    });
    if (updatedDeal) deal.value = cloneDeal(updatedDeal);

    const milestoneIdByKey = new Map<string, number>();
    const goalIdByKey = new Map<string, number>();
    const taskIdByKey = new Map<string, number | string>();

    preview.milestones.forEach((milestone) => {
      const createdMilestone = jobsStore.addMilestone(executionJob.id, {
        name: milestone.name,
        startDate: milestone.startDate,
        dueDate: milestone.dueDate,
        dateOverride: Boolean(milestone.dateOverride),
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
        const createdGoal = jobsStore.addGoal(executionJob.id, {
          milestoneId,
          name: goal.name,
          startDate: goal.startDate,
          dueDate: goal.dueDate,
          dateOverride: Boolean(goal.dateOverride),
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
        startAt: task.startAt,
        completionMinutes: task.completionMinutes,
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

    createdNotificationIds.push(
      ...notifyJobConversionRecipients(executionJob, projectManagerId),
    );
    notifications.push(
      `Deal converted to job ${executionJob.name} with ${preview.summary.jobTaskCount} tasks`,
      "success",
      4000,
    );
    closeExecutePreviewDialog();
    void router.push({
      name: "operations-jobs-view-id",
      params: { id: executionJob.id },
    });
  } catch (executionError) {
    createdTodoIds.forEach((todoId) => todosStore.removeTodo(todoId));
    systemNotificationsStore.removeMany(createdNotificationIds);
    if (createdJobId !== null) jobsStore.removeJob(createdJobId);

    console.error("Failed to convert deal to job", executionError);
    executePreviewError.value =
      "Conversion failed. Created changes were rolled back.";
    notifications.push("Failed to convert deal to job", "error", 4000);
    isExecutingDeal.value = false;
  }
};

const saveDeal = (payload: Partial<DealProperties>) => {
  if (!deal.value) return;
  if (!canUpdateDeal.value) {
    dialogError.value = "You do not have permission to update this deal.";
    notifyDealUpdateDenied();
    return;
  }

  dialogLoading.value = true;
  dialogError.value = null;

  try {
    const shouldApplyManualStage =
      payload.stage !== undefined &&
      String(payload.stage ?? "").trim() !==
        String(deal.value.stage ?? "").trim();
    const { stage, ...restPayload } = payload;
    const basePatch = shouldApplyManualStage ? restPayload : payload;
    let updated = dealsStore.updateDeal(deal.value.id, basePatch);

    if (updated && shouldApplyManualStage) {
      updated = dealsStore.updateDealStageManually(
        deal.value.id,
        stage ?? null,
      );
    }

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
    if (isPermissionDeniedError(updateError)) {
      dialogError.value = "You do not have permission to update this deal.";
      notifyDealUpdateDenied();
    } else {
      dialogError.value = "An unexpected error occurred";
      notifications.push("Failed to update deal", "error", 4000);
    }
  } finally {
    dialogLoading.value = false;
  }
};

const openAddMeeting = () => {
  if (!deal.value) return;
  if (!canCreateCalendar.value) {
    notifyPermissionDenied(calendarCreateDisabledReason.value);
    return;
  }

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
  if (!canCreateCalendar.value) {
    notifyPermissionDenied(calendarCreateDisabledReason.value);
    return;
  }

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
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return;
  }

  const currentDeal = deal.value;

  addTodoInitial.value = {
    title: `Task: ${currentDeal.code || `Deal #${currentDeal.id}`}`,
    collaborators: dealEmployeeCollaborators.value,
    relatedTo: dealRelatedRef.value,
    dueAt: new Date().toISOString(),
    notes: `Task regarding ${currentDeal.code || `deal #${currentDeal.id}`}`,
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
  if (!canCreateCalendar.value) {
    notifyPermissionDenied(calendarCreateDisabledReason.value);
    return;
  }

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
  if (!canCreateCalendar.value) {
    notifyPermissionDenied(calendarCreateDisabledReason.value);
    return;
  }

  try {
    todosStore.addMeeting && todosStore.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (meetingError) {
    if (isPermissionDeniedError(meetingError)) {
      notifyPermissionDenied(calendarCreateDisabledReason.value);
      return;
    }
    console.error("onMeetingCreated failed:", meetingError);
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
    lockMeetingRelatedTo.value = false;
  }
};

const openEmail = () => {
  if (!deal.value) return;
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return;
  }

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
  if (!deal.value) return;
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return;
  }

  showImmediateDueOption.value = true;
  addTodoInitial.value = {
    ...payload.initial,
    collaborators:
      payload?.initial?.collaborators &&
      Array.isArray(payload.initial.collaborators) &&
      payload.initial.collaborators.length
        ? normalizeTaskCollaborators(payload.initial.collaborators)
        : normalizeTaskCollaborators(dealEmployeeCollaborators.value),
    relatedTo: dealRelatedRef.value,
    status: payload?.initial?.status ?? "pending",
    important: Boolean(payload?.initial?.important),
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const findDealTodoById = (todoId: number | string) => {
  if (!deal.value) return null;

  return (
    todosStore.items.find((todo) => {
      if (String(todo.id) !== String(todoId)) return false;
      const matchesRelation = taskRelationCandidates.value.some(
        (candidate) =>
          todo.relatedTo?.type === candidate.type &&
          String(todo.relatedTo?.id) === String(candidate.id),
      );
      if (!matchesRelation) return false;

      return (
        !String((todo as any).milestoneId ?? "").trim() &&
        !String((todo as any).goalId ?? "").trim()
      );
    }) ?? null
  );
};

const mapSalesTaskTemplateToEditableTodo = (
  task: DealSalesTaskTemplate,
): ToDo => {
  const dueAt = task.afterWhen
    ? resolveTaskDueAt(task.afterWhen, new Date().toISOString())
    : new Date().toISOString();

  return {
    id: task.id,
    title: task.title,
    collaborators: Array.isArray(task.collaborators)
      ? normalizeTaskCollaborators(task.collaborators)
      : [],
    dueAt,
    startAt: dueAt,
    status:
      task.status === "in_progress" ||
      task.status === "for_review" ||
      task.status === "completed"
        ? task.status
        : "pending",
    notes: task.notes || "",
    important: Boolean(task.important),
    attachment: task.attachment ? { ...task.attachment } : null,
    relatedTo: dealRelatedRef.value,
    steps: Array.isArray(task.steps)
      ? task.steps.map((step) => ({ ...step }))
      : [],
    afterWhen: task.afterWhen ?? null,
    startTrigger: task.startTrigger
      ? {
          type: task.startTrigger.type,
          goalId: task.startTrigger.goalId ?? null,
          taskId: task.startTrigger.taskId ?? null,
        }
      : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ToDo;
};

const openEditTask = (todoId: number | string) => {
  if (!canUpdateTask.value) {
    notifyPermissionDenied(taskUpdateDisabledReason.value);
    return;
  }

  const todo = findDealTodoById(todoId);
  if (todo) {
    editingSalesTaskTemplateId.value = null;
    showImmediateDueOptionOnEdit.value = true;
    editingTodo.value = {
      ...todo,
      collaborators: Array.isArray(todo.collaborators)
        ? normalizeTaskCollaborators(todo.collaborators)
        : [],
      relatedTo: normalizeSalesTaskRelatedTo(todo.relatedTo),
      steps: Array.isArray(todo.steps)
        ? todo.steps.map((step) => ({ ...step }))
        : [],
      attachment: todo.attachment ? { ...todo.attachment } : null,
    };
    isEditTodoDrawerVisible.value = true;
    return;
  }

  if (!deal.value) return;

  const task = resolveDealSalesTasks(deal.value).find(
    (entry) => String(entry.id) === String(todoId),
  );
  if (!task) return;

  editingSalesTaskTemplateId.value = todoId;
  showImmediateDueOptionOnEdit.value = true;
  editingTodo.value = mapSalesTaskTemplateToEditableTodo(task);
  isEditTodoDrawerVisible.value = true;
};

const deleteTask = (todoId: number | string) => {
  if (!canDeleteTask.value) {
    notifyPermissionDenied(taskDeleteDisabledReason.value);
    return;
  }

  const todo = findDealTodoById(todoId);
  if (todo) {
    todosStore.removeTodo(todoId);
    notifications.push("Task deleted", "success", 3000);
    return;
  }

  if (!deal.value) return;

  const updatedDeal = dealsStore.updateDeal(deal.value.id, {
    salesTasks: resolveDealSalesTasks(deal.value)
      .filter((task) => String(task.id) !== String(todoId))
      .map((task) => ({
        ...task,
        relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
      })),
  }, { system: true });
  if (updatedDeal) deal.value = cloneDeal(updatedDeal);
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
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return;
  }

  showImmediateDueOption.value = false;
  addTodoInitial.value = {
    ...(payload?.initial ?? {}),
    collaborators:
      payload?.initial?.collaborators &&
      Array.isArray(payload.initial.collaborators) &&
      payload.initial.collaborators.length
        ? normalizeTaskCollaborators(payload.initial.collaborators)
        : normalizeTaskCollaborators(dealEmployeeCollaborators.value),
    relatedTo: dealRelatedRef.value,
  };
  isAddTodoDrawerVisible.value = true;
  nextTick(() => {
    try {
      addTodoDrawerRef.value?.openWith?.(addTodoInitial.value);
    } catch {}
    addTodoInitial.value = null;
  });
};

const onTodoCreated = (payload: any) => {
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return;
  }

  try {
    try {
      todosStore.init();
    } catch {}
    todosStore.addTodo &&
      todosStore.addTodo({
        ...payload,
        collaborators: normalizeTaskCollaborators(payload.collaborators),
        relatedTo: dealRelatedRef.value,
      });
    notifications.push("Task created", "success", 3500);
  } catch (e) {
    if (isPermissionDeniedError(e)) {
      notifyPermissionDenied(taskCreateDisabledReason.value);
      return;
    }
    console.error("onTodoCreated failed:", e);
    notifications.push("Unable to create task", "error", 3000);
  } finally {
    isAddTodoDrawerVisible.value = false;
    showImmediateDueOption.value = false;
  }
};

watch(isAddTodoDrawerVisible, (isOpen) => {
  if (!isOpen) showImmediateDueOption.value = false;
});

const onTodoEdited = (payload: any) => {
  if (!canUpdateTask.value) {
    notifyPermissionDenied(taskUpdateDisabledReason.value);
    return;
  }

  if (editingSalesTaskTemplateId.value !== null && deal.value) {
    const existingTasks = resolveDealSalesTasks(deal.value);
    const editingTask =
      existingTasks.find(
        (task) => String(task.id) === String(editingSalesTaskTemplateId.value),
      ) ?? null;

    if (editingTask) {
      const nextSalesTasks = existingTasks.map((task) =>
        String(task.id) !== String(editingSalesTaskTemplateId.value)
          ? task
          : {
              ...task,
              title: String(payload.title ?? "").trim(),
              collaborators: normalizeTaskCollaborators(payload.collaborators),
              afterWhen: payload.dueAt ?? null,
              notes: String(payload.notes ?? "").trim(),
              important: Boolean(payload.important),
              status:
                payload.status === "in_progress" ||
                payload.status === "for_review" ||
                payload.status === "completed"
                  ? payload.status
                  : "pending",
              attachment: payload.attachment ?? null,
              relatedTo: normalizeSalesTaskRelatedTo(payload.relatedTo),
            },
      );

      const updatedDeal = dealsStore.updateDeal(
        deal.value.id,
        {
          salesTasks: nextSalesTasks,
        },
        { system: true },
      );
      if (updatedDeal) deal.value = cloneDeal(updatedDeal);
    }

    isEditTodoDrawerVisible.value = false;
    showImmediateDueOptionOnEdit.value = false;
    editingSalesTaskTemplateId.value = null;
    notifications.push("Task updated", "success", 3500);
    return;
  }

  const partial: any = {
    title: payload.title,
    collaborators: normalizeTaskCollaborators(payload.collaborators),
    dueAt: payload.dueAt,
    status: payload.status,
    notes: payload.notes,
    important: payload.important,
    attachment: payload.attachment,
    relatedTo: normalizeSalesTaskRelatedTo(payload.relatedTo),
  };

  if ("completed" in payload) partial.completed = payload.completed;
  if ("isCompleted" in payload) partial.isCompleted = payload.isCompleted;
  if ("doneAt" in payload) partial.doneAt = payload.doneAt;

  todosStore.updateTodo(payload.id, partial);
  isEditTodoDrawerVisible.value = false;
  showImmediateDueOptionOnEdit.value = false;
  editingSalesTaskTemplateId.value = null;
  notifications.push("Task updated", "success", 3500);
};

watch(isEditTodoDrawerVisible, (isOpen) => {
  if (!isOpen) {
    showImmediateDueOptionOnEdit.value = false;
    editingSalesTaskTemplateId.value = null;
  }
});

const onTodoStepsEdited = (payload: { id: number | string; steps: any[] }) => {
  if (!canUpdateTask.value) {
    notifyPermissionDenied(taskUpdateDisabledReason.value);
    return;
  }
  if (editingSalesTaskTemplateId.value !== null && deal.value) {
    const updatedDeal = dealsStore.updateDeal(
      deal.value.id,
      {
        salesTasks: resolveDealSalesTasks(deal.value).map((task) =>
          String(task.id) === String(payload.id)
            ? {
                ...task,
                relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
                steps: payload.steps.map((step) => ({ ...step })),
              }
            : {
                ...task,
                relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
              },
        ),
      },
      { system: true },
    );
    if (updatedDeal) deal.value = cloneDeal(updatedDeal);
    return;
  }

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
  if (!canCreateTask.value) {
    notifyPermissionDenied(taskCreateDisabledReason.value);
    return null;
  }

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
    author: getSignedInAuthorRef(),
    body,
    createdAt: new Date().toISOString(),
    isRead: true,
  };

  if (existing) {
    if (!canUpdateTask.value) {
      notifyPermissionDenied(taskUpdateDisabledReason.value);
      return existing.id;
    }

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
          :salesman-name="salesmanName"
          :collaborator-names="collaboratorNames"
          :collaborators="dealEmployeeCollaborators"
          :linked-contact="linkedContact"
          :stage-options="dealStageOptions"
          :execution-notice="dealExecutionNotice"
          :can-edit="canUpdateDeal"
          :edit-disabled-reason="dealUpdateDisabledReason"
          :can-add-task="canCreateTask"
          :task-disabled-reason="taskCreateDisabledReason"
          :can-add-email="canCreateTask"
          :email-disabled-reason="taskCreateDisabledReason"
          :can-add-meeting="canCreateCalendar"
          :meeting-disabled-reason="calendarCreateDisabledReason"
          :can-add-call="canCreateCalendar"
          :call-disabled-reason="calendarCreateDisabledReason"
          :can-add-note="canUpdateDeal"
          :note-disabled-reason="dealUpdateDisabledReason"
          :hide-financials="hideDealFinancials"
          @edit="openEditDialog"
          @open-add-task="handleAddTaskFromCommunication"
          @open-add-email="openEmail"
          @open-add-meeting="handleAddMeetingFromCommunication"
          @open-add-call="handleAddCallFromCommunication"
          @open-add-note="openAddNoteDialog"
          @open-collaborators="openCollaboratorDialog"
        />

        <DealBillingSummaryCard
          class="mt-4"
          :paid="dealBillingPaid"
          :proforma-amount="dealProformaBillingAmount"
          :proforma-count="dealProformaBillingCount"
          :unpaid="dealBillingUnpaid"
          :to-be-invoiced="dealBillingToBeInvoiced"
          :hidden="hideDealFinancials"
        />
      </VCol>

      <VCol cols="12" md="7" lg="8">
        <div class="deal-view-toolbar mb-4">
          <VTabs v-model="dealTab" class="v-tabs-pill">
            <VTab v-for="tab in tabs" :key="tab.icon">
              <VIcon :size="18" :icon="tab.icon" class="me-1" />
              <span>{{ tab.title }}</span>
            </VTab>
          </VTabs>

          <VTooltip
            :text="canExecuteDeal && !dealExecutionNotice ? 'Convert to job' : executeDealDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  aria-label="Convert to job"
                  variant="tonal"
                  :disabled="!canExecuteDeal || Boolean(dealExecutionNotice)"
                  @click="openExecutePreviewDialog"
                >
                  <VIcon start icon="tabler-play" />
                  Convert to Job
                </VBtn>
              </span>
            </template>
          </VTooltip>
        </div>

        <VAlert
          v-if="dealExecutionNotice"
          type="info"
          variant="tonal"
          density="comfortable"
          class="mb-4"
        >
          {{ dealExecutionNotice }}
        </VAlert>

        <VWindow
          v-model="dealTab"
          class="disable-tab-transition"
          :touch="false"
        >
          <VWindowItem>
            <DealItemsTab
              :deal="deal"
              :can-update-deal="canUpdateDeal"
              :deal-update-disabled-reason="dealUpdateDisabledReason"
              :can-create-task="canCreateTask"
              :can-update-task="canUpdateTask"
              :can-delete-task="canDeleteTask"
              :task-create-disabled-reason="taskCreateDisabledReason"
              :task-update-disabled-reason="taskUpdateDisabledReason"
              :task-delete-disabled-reason="taskDeleteDisabledReason"
              :can-create-finance="canCreateFinance"
              :can-update-finance="canUpdateFinance"
              :can-delete-finance="canDeleteFinance"
              :can-approve-finance="canApproveFinance"
              :finance-create-disabled-reason="financeCreateDisabledReason"
              :hide-financials="hideDealFinancials"
              @open-add-task="openAddTask"
              @open-edit-task="openEditTask"
              @delete-task="deleteTask"
            />
          </VWindowItem>

          <VWindowItem>
            <DealCommunicationTab
              :deal="deal"
              :hide-financials="hideDealFinancials"
            />
          </VWindowItem>

          <VWindowItem>
            <DealDocumentsTab
              :deal-id="deal.id"
              :can-update-deal="canUpdateDeal"
              :can-create-task="canCreateTask"
              :hide-financials="hideDealFinancials"
              :deal-update-disabled-reason="dealUpdateDisabledReason"
              :task-create-disabled-reason="taskCreateDisabledReason"
              @open-add-todo="handleDocumentTodoRequest"
            />
          </VWindowItem>

          <VWindowItem>
            <DealNotesTab :deal="deal" />
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
      :contacts="meetingContacts"
      :lock-related-to="lockMeetingRelatedTo"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="taskCollaboratorOptions"
      :initial="addTodoInitial ?? undefined"
      @user-data="onTodoCreated"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerVisible"
      :todo="editingTodo"
      :collaborators-options="taskCollaboratorOptions"
      @save="onTodoEdited"
      @saveSteps="onTodoStepsEdited"
    />

    <VDialog v-model="isExecutePreviewDialogVisible" max-width="840">
      <DialogCloseBtn @click="closeExecutePreviewDialog" />
      <VCard>
        <VCardItem>
          <VCardTitle>Convert to Job</VCardTitle>
          <VCardSubtitle>
            Select the job owner and review job creation, milestones, goals, and tasks before confirming.
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
            <AppSelect
              v-model="selectedJobOwnerId"
              class="mb-4"
              :items="jobOwnerOptions"
              item-title="title"
              item-value="value"
              label="Job Owner"
              placeholder="Select job owner"
              :rules="[requiredValidator]"
            />

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
                  <div class="text-overline mb-2">Conversion Summary</div>
                  <div class="d-flex flex-column gap-1 text-body-2">
                    <span>{{ executionTargetSummary }}</span>
                    <span>Owner: {{ selectedJobOwnerName }}</span>
                    <span>
                      {{ executePreview.summary.milestoneCount }} milestones
                    </span>
                    <span>{{ executePreview.summary.goalCount }} goals</span>
                    <span>
                      {{ executePreview.summary.jobTaskCount }} new job tasks
                    </span>
                    <span>
                      {{ executePreview.summary.documentCount }} documents
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
            :disabled="!executePreview || Boolean(executePreviewError) || !selectedJobOwnerId"
            @click="confirmDealExecution"
          >
            Convert to Job
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isAddNoteDialogVisible" max-width="520">
      <DialogCloseBtn @click="closeAddNoteDialog" />
      <VCard class="pa-sm-6 pa-4">
        <VCardItem>
          <VCardTitle>Add Note</VCardTitle>
          <VCardSubtitle>
            {{ deal?.code || `Deal #${deal?.id}` }}
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <AppTextarea
            v-model="noteDraft"
            auto-grow
            rows="5"
            label="Note"
            placeholder="Write a note"
          />
        </VCardText>

        <VCardActions>
          <DialogActionBar
            :save-disabled="!noteDraft.trim()"
            @save="saveDealNote"
            @cancel="closeAddNoteDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isCollaboratorDialogVisible" max-width="560">
      <DialogCloseBtn @click="closeCollaboratorDialog" />
      <VCard class="pa-sm-6 pa-4">
        <VCardItem>
          <VCardTitle>Collaborators</VCardTitle>
          <VCardSubtitle>
            Add employees or contacts to this deal.
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <AppSelect
            v-model="collaboratorDialogValue"
            :items="dealCollaboratorOptions"
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
                  <VImg v-if="item.raw.avatarUrl" :src="item.raw.avatarUrl" />
                  <span v-else class="text-xxs font-weight-bold">
                    {{ avatarText(item.raw.title) }}
                  </span>
                </VAvatar>
                {{ item.raw.title }}
              </VChip>
            </template>

            <template #item="{ item, props: itemProps }">
              <VListItem v-bind="itemProps">
                <template #prepend>
                  <VAvatar size="28" color="primary" variant="tonal">
                    <VImg v-if="item.raw.avatarUrl" :src="item.raw.avatarUrl" />
                    <span v-else class="text-xs font-weight-bold">
                      {{ avatarText(item.raw.title) }}
                    </span>
                  </VAvatar>
                </template>
              </VListItem>
            </template>
          </AppSelect>
        </VCardText>

        <VCardActions>
          <DialogActionBar
            @save="saveDealCollaborators"
            @cancel="closeCollaboratorDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            const threadId = upsertDealEmailThread(payload);
            if (!threadId) return;
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
            if (isPermissionDeniedError(e)) {
              notifications.push(
                'You do not have permission to create tasks.',
                'warning',
                3000,
              );
            } else {
              notifications.push('Unable to send email', 'error', 3000);
            }
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

<style scoped>
.deal-view-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

@media (max-width: 960px) {
  .deal-view-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
