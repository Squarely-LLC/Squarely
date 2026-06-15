<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ToDo } from "@/data/schema";
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
import { useTodos } from "@/stores/todos";
import {
  getQuotationTopLevelDealItems,
} from "@/utils/dealDocumentDraft";
import {
  getDealDocumentBalance,
  getDealDocumentPaid,
  getDealDocumentTotal,
  getDealItemsGrandTotal,
} from "@/utils/dealBilling";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
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
const isAddNoteDialogVisible = ref(false);
const noteDraft = ref("");
const isCollaboratorDialogVisible = ref(false);
const collaboratorDialogValue = ref<Array<number | string>>([]);
const userData = useCookie<any>("userData");

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

const nextDealSalesTaskId = (tasks: DealSalesTaskTemplate[]) => {
  const ids = tasks
    .map((task) => Number(task.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const isImportedDealSalesTask = (task: DealSalesTaskTemplate) =>
  task.sourceItemId !== null && task.sourceItemId !== undefined;

const isManualDealTodo = (todo: ToDo, dealId: number | string) => {
  if (!todo?.relatedTo) return false;
  if (String(todo.relatedTo.id) !== String(dealId)) return false;
  if (todo.relatedTo.type !== "deal") return false;

  return (
    !String((todo as any).milestoneId ?? "").trim() &&
    !String((todo as any).goalId ?? "").trim()
  );
};

const buildSalesTaskMigrationKey = (task: {
  title?: string | null;
  notes?: string | null;
  afterWhen?: string | null;
  startTrigger?: CatalogueTaskStartTrigger | ToDo["startTrigger"] | null;
}) =>
  [
    String(task.title || "").trim(),
    String(task.notes || "").trim(),
    String(task.afterWhen || "").trim(),
    String(task.startTrigger?.type || "").trim(),
    String(task.startTrigger?.goalId ?? "").trim(),
    String(task.startTrigger?.taskId ?? "").trim(),
  ].join("::");

const migrateLegacyDealSalesTasksToTodos = (
  currentDeal: DealProperties,
): DealProperties => {
  const storedSalesTasks = Array.isArray(currentDeal.salesTasks)
    ? currentDeal.salesTasks.map((task) => cloneDealSalesTaskTemplate(task))
    : [];
  const legacyManualTasks = storedSalesTasks.filter(
    (task) => !isImportedDealSalesTask(task),
  );

  if (!legacyManualTasks.length) return currentDeal;

  const existingManualTodoKeys = new Set(
    (todosStore.items || [])
      .filter((todo) => isManualDealTodo(todo, currentDeal.id))
      .map((todo) => buildSalesTaskMigrationKey(todo as any)),
  );
  const relatedTo = {
    id: currentDeal.id,
    name: currentDeal.code || `Deal #${currentDeal.id}`,
    type: "deal",
  } as const;

  legacyManualTasks.forEach((task) => {
    const migrationKey = buildSalesTaskMigrationKey(task);
    if (existingManualTodoKeys.has(migrationKey)) return;

    todosStore.addTodo({
      title: task.title,
      collaborators: Array.isArray(task.collaborators)
        ? task.collaborators.map((collaborator) => ({ ...collaborator }))
        : [],
      dueAt: new Date().toISOString(),
      afterWhen: task.afterWhen ?? null,
      startTrigger: task.startTrigger
        ? {
            type: task.startTrigger.type,
            goalId: task.startTrigger.goalId ?? null,
            taskId: task.startTrigger.taskId ?? null,
          }
        : null,
      status:
        task.status === "in_progress" ||
        task.status === "for_review" ||
        task.status === "completed"
          ? task.status
          : "pending",
      notes: task.notes || "",
      important: Boolean(task.important),
      attachment: task.attachment ? { ...task.attachment } : null,
      relatedTo,
      steps: Array.isArray(task.steps)
        ? task.steps.map((step) => ({ ...step }))
        : [],
    } as any);
    existingManualTodoKeys.add(migrationKey);
  });

  const retainedSalesTasks = storedSalesTasks.filter(isImportedDealSalesTask);
  const updatedDeal = dealsStore.updateDeal(currentDeal.id, {
    salesTasks: retainedSalesTasks,
  });

  return (
    updatedDeal ?? {
      ...currentDeal,
      salesTasks: retainedSalesTasks,
    }
  );
};

const resolveDealSalesTasks = (
  currentDeal: DealProperties,
): DealSalesTaskTemplate[] => {
  const storedSalesTasks = Array.isArray(currentDeal.salesTasks)
    ? currentDeal.salesTasks.map((task) =>
        cloneDealSalesTaskTemplate({
          ...task,
          relatedTo: {
            id: currentDeal.id,
            name: currentDeal.code || `Deal #${currentDeal.id}`,
            type: "deal",
          },
        }),
      )
    : [];
  let nextId = nextDealSalesTaskId(storedSalesTasks);
  const importedFallbackTasks = (currentDeal.items || [])
    .filter((item) => !item.parentItemId)
    .flatMap((item) => {
      const record = item.catalogueItemId
        ? cataloguesStore.recordById(
            item.catalogueItemId,
            item.catalogueType || undefined,
          )
        : null;

      return resolveSalesTasks(record).map((task, index) =>
        cloneDealSalesTaskTemplate({
          ...task,
          id: nextId++,
          relatedTo: {
            id: currentDeal.id,
            name: currentDeal.code || `Deal #${currentDeal.id}`,
            type: "deal",
          },
          sourceItemId: item.id,
          sourceTaskId: task.id ?? index + 1,
        }),
      );
    });
  const missingImportedTasks = importedFallbackTasks.filter(
    (task) =>
      !storedSalesTasks.some(
        (existingTask) =>
          Number(existingTask.sourceItemId ?? 0) ===
            Number(task.sourceItemId ?? 0) &&
          Number(existingTask.sourceTaskId ?? 0) ===
            Number(task.sourceTaskId ?? 0),
      ),
  );
  const legacyManualTasks = (todosStore.items || [])
    .filter((todo) => {
      if (!todo?.relatedTo) return false;
      if (String(todo.relatedTo.id) !== String(currentDeal.id)) return false;
      if (todo.relatedTo.type !== "deal") return false;

      return (
        !String(todo.milestoneId ?? "").trim() &&
        !String(todo.goalId ?? "").trim()
      );
    })
    .map((todo, index) =>
      cloneDealSalesTaskTemplate({
        id: nextId + index,
        title: todo.title,
        collaborators: todo.collaborators || [],
        afterWhen: todo.afterWhen ?? null,
        startTrigger: (todo.startTrigger as
          | CatalogueTaskStartTrigger
          | null
          | undefined) ?? {
          type: "time",
          goalId: null,
          taskId: null,
        },
        manhours: null,
        notes: todo.notes || "",
        status: todo.status || "pending",
        important: Boolean(todo.important),
        attachment: todo.attachment ?? null,
        relatedTo: todo.relatedTo ?? {
          id: currentDeal.id,
          name: currentDeal.code || `Deal #${currentDeal.id}`,
          type: "deal",
        },
        steps: Array.isArray(todo.steps)
          ? todo.steps.map((step) => ({ ...step }))
          : [],
        sourceItemId: null,
        sourceTaskId: null,
      }),
    )
    .filter(
      (task) =>
        !storedSalesTasks.some(
          (existingTask) =>
            Number(existingTask.sourceItemId ?? 0) === 0 &&
            existingTask.title === task.title &&
            existingTask.notes === task.notes,
        ),
    );

  return [...storedSalesTasks, ...missingImportedTasks, ...legacyManualTasks];
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
};

const cloneDeal = (value: DealProperties | null) => {
  if (!value) return null;

  return JSON.parse(JSON.stringify(value)) as DealProperties;
};

const resolveLatestDealState = () => {
  const currentId = deal.value?.id ?? route.params.id;
  const latest = dealsStore.byId(currentId);

  if (latest) {
    const migrated = migrateLegacyDealSalesTasksToTodos(latest);
    deal.value = cloneDeal(migrated);
    return migrated;
  }

  return deal.value;
};

const resolveDeal = () => {
  loading.value = true;
  const found = dealsStore.byId(route.params.id);

  if (found) {
    deal.value = cloneDeal(migrateLegacyDealSalesTasksToTodos(found));
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

  if (raw.startsWith("contact:")) {
    const contactId = Number(raw.slice("contact:".length));
    const contact = contactsStore.byId(contactId);

    return {
      id: raw,
      name: contact?.fullName || `Contact ${contactId}`,
      avatarUrl: contact?.picture || null,
      type: "contact" as const,
      contactId,
    };
  }

  const employeeId = Number(value);
  const employee = employeesStore.byId(employeeId);

  return {
    id: employeeId,
    name: employee?.fullName || `Employee ${employeeId}`,
    avatarUrl: employee?.picture || null,
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
              employeeId:
                collaborator.type === "employee"
                  ? collaborator.employeeId
                  : undefined,
              contactId:
                collaborator.type === "contact"
                  ? collaborator.contactId
                  : undefined,
            }
          : null;
      })
      .filter(Boolean) as Array<{
      id: number | string;
      name: string;
      avatarUrl: string | null;
      type: "contact" | "employee";
      employeeId?: number;
      contactId?: number;
    }>,
);

const employeeOptions = computed(() =>
  employeesStore.all.map((employee) => ({
    id: employee.id,
    name: employee.fullName,
    avatarUrl: employee.picture || null,
  })),
);

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

const dealCollaboratorOptions = computed(() =>
  [
    ...employeesStore.all.map((employee) => ({
      title: employee.fullName,
      value: employee.id,
      avatarUrl: employee.picture || null,
      type: "employee",
    })),
    ...contactsStore.all.map((contact) => ({
      title: contact.fullName,
      value: `contact:${contact.id}`,
      avatarUrl: contact.picture || null,
      type: "contact",
    })),
  ].sort((left, right) => left.title.localeCompare(right.title)),
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
      name: collaborator.name,
      avatarUrl: collaborator.avatarUrl,
      type: collaborator.type,
      contactId: collaborator.contactId,
      employeeId: collaborator.employeeId,
      roles: [collaborator.type] as ["contact" | "employee"],
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

  return `Already executed into ${linkedJobLabel}.`;
});

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
) => (isValidSalesTaskRelation(relatedTo) ? { ...relatedTo } : dealRelatedRef.value);

const goalTriggerOptions = computed(
  () => [] as Array<{ title: string; value: string }>,
);

const openEditDialog = () => {
  dialogError.value = null;
  isDealEditDialogVisible.value = true;
};

const openAddNoteDialog = () => {
  noteDraft.value = "";
  isAddNoteDialogVisible.value = true;
};

const closeAddNoteDialog = () => {
  noteDraft.value = "";
  isAddNoteDialogVisible.value = false;
};

const saveDealNote = () => {
  if (!deal.value) return;

  const body = noteDraft.value.trim();
  if (!body) return;

  const user = userData.value || {};
  const authorName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    String(user.fullName || user.name || user.username || "").trim() ||
    null;
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

  collaboratorDialogValue.value = [...(deal.value.collaborators || [])];
  isCollaboratorDialogVisible.value = true;
};

const closeCollaboratorDialog = () => {
  collaboratorDialogValue.value = [];
  isCollaboratorDialogVisible.value = false;
};

const saveDealCollaborators = () => {
  if (!deal.value) return;

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

  const executedAt = new Date().toISOString();

  try {
    executePreview.value = buildExecutionPreview(currentDeal, executedAt);
    executePreviewError.value = null;
  } catch (previewError) {
    console.error("Failed to build deal execution preview", previewError);
    executePreview.value = null;
    executePreviewError.value = "Unable to build execution preview.";
  }

  isExecutePreviewDialogVisible.value = true;
};

const confirmDealExecution = () => {
  const currentDeal = resolveLatestDealState();
  if (!currentDeal || !executePreview.value || isExecutingDeal.value) return;

  isExecutingDeal.value = true;
  const currentDealId = currentDeal.id;
  const createdTodoIds: Array<number | string> = [];
  let createdJobId: number | string | null = null;
  const targetJob = resolveExecutionTargetJob(currentDeal);

  try {
    const preview = executePreview.value;
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
        collaborators: [...preview.job.collaborators],
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

    notifications.push(
      `Deal executed into ${executionJob.name} with ${preview.summary.jobTaskCount} tasks`,
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
    if (createdJobId !== null) jobsStore.removeJob(createdJobId);

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
    const shouldApplyManualStage =
      payload.stage !== undefined &&
      String(payload.stage ?? "").trim() !== String(deal.value.stage ?? "").trim();
    const { stage, ...restPayload } = payload;
    const basePatch = shouldApplyManualStage ? restPayload : payload;
    let updated = dealsStore.updateDeal(deal.value.id, basePatch);

    if (updated && shouldApplyManualStage) {
      updated = dealsStore.updateDealStageManually(deal.value.id, stage ?? null);
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
  if (!deal.value) return;

  showImmediateDueOption.value = true;
  addTodoInitial.value = {
    ...payload.initial,
    collaborators:
      payload?.initial?.collaborators &&
      Array.isArray(payload.initial.collaborators) &&
      payload.initial.collaborators.length
        ? payload.initial.collaborators
        : dealEmployeeCollaborators.value,
    relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
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
      ? task.collaborators.map((collaborator) => ({ ...collaborator }))
      : [],
    dueAt,
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
  const todo = findDealTodoById(todoId);
  if (todo) {
    editingSalesTaskTemplateId.value = null;
    showImmediateDueOptionOnEdit.value = true;
    editingTodo.value = {
      ...todo,
      collaborators: Array.isArray(todo.collaborators)
        ? todo.collaborators.map((collaborator) => ({ ...collaborator }))
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
  const todo = findDealTodoById(todoId);
  if (todo) {
    todosStore.removeTodo(todoId);
    notifications.push("Task deleted", "success", 3000);
    return;
  }

  if (!deal.value) return;

  const updatedDeal = dealsStore.updateDeal(deal.value.id, {
    salesTasks: resolveDealSalesTasks(deal.value).filter(
      (task) => String(task.id) !== String(todoId),
    ),
  });
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
  showImmediateDueOption.value = false;
  addTodoInitial.value = {
    ...(payload?.initial ?? {}),
    collaborators:
      payload?.initial?.collaborators &&
      Array.isArray(payload.initial.collaborators) &&
      payload.initial.collaborators.length
        ? payload.initial.collaborators
        : dealEmployeeCollaborators.value,
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
  try {
    try {
      todosStore.init();
    } catch {}
    todosStore.addTodo &&
      todosStore.addTodo({
        ...payload,
        relatedTo: dealRelatedRef.value,
      });
    notifications.push("Task created", "success", 3500);
  } catch (e) {
    console.error("onTodoCreated failed:", e);
    notifications.push("Task created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
    showImmediateDueOption.value = false;
  }
};

watch(isAddTodoDrawerVisible, (isOpen) => {
  if (!isOpen) showImmediateDueOption.value = false;
});

const onTodoEdited = (payload: any) => {
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
              collaborators: Array.isArray(payload.collaborators)
                ? payload.collaborators.map((collaborator: any) => ({
                    ...collaborator,
                  }))
                : [],
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

      const updatedDeal = dealsStore.updateDeal(deal.value.id, {
        salesTasks: nextSalesTasks,
      });
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
    collaborators: payload.collaborators,
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
  if (editingSalesTaskTemplateId.value !== null && deal.value) {
    const updatedDeal = dealsStore.updateDeal(deal.value.id, {
      salesTasks: resolveDealSalesTasks(deal.value).map((task) =>
        String(task.id) === String(payload.id)
          ? {
              ...task,
              steps: payload.steps.map((step) => ({ ...step })),
            }
          : task,
      ),
    });
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
          :salesman-name="salesmanName"
          :collaborator-names="collaboratorNames"
          :collaborators="dealEmployeeCollaborators"
          :linked-contact="linkedContact"
          :stage-options="dealStageOptions"
          :execution-notice="dealExecutionNotice"
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

          <VBtn
            aria-label="Execute deal"
            variant="tonal"
            :disabled="Boolean(dealExecutionNotice)"
            @click="openExecutePreviewDialog"
          >
            <VIcon start icon="tabler-play" />
            Execute Deal
          </VBtn>
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
              @open-add-task="openAddTask"
              @open-edit-task="openEditTask"
              @delete-task="deleteTask"
            />
          </VWindowItem>

          <VWindowItem>
            <DealCommunicationTab :deal="deal" />
          </VWindowItem>

          <VWindowItem>
            <DealDocumentsTab
              :deal-id="deal.id"
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
      :contacts="contactOptions"
      :lock-related-to="lockMeetingRelatedTo"
      @cancel="closeMeetingDrawer"
      @save="onMeetingCreated"
    />

    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      :hide-related-to-field="true"
      :show-immediate-due-option="showImmediateDueOption"
      source="employees"
      :initial="addTodoInitial ?? undefined"
      @user-data="onTodoCreated"
    />

    <EditToDoDrawer
      v-model:is-drawer-open="isEditTodoDrawerVisible"
      :todo="editingTodo"
      :hide-related-to-field="true"
      :show-immediate-due-option="showImmediateDueOptionOnEdit"
      :collaborators-options="employeeOptions"
      @save="onTodoEdited"
      @saveSteps="onTodoStepsEdited"
    />

    <VDialog v-model="isExecutePreviewDialogVisible" max-width="840">
      <DialogCloseBtn @click="isExecutePreviewDialogVisible = false" />
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
                    <span>{{ executionTargetSummary }}</span>
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
            :disabled="!executePreview || Boolean(executePreviewError)"
            @click="confirmDealExecution"
          >
            Confirm Execution
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
