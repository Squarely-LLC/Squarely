<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import CatalogueCategoryTreeSelect from "@/components/catalogues/CatalogueCategoryTreeSelect.vue";
import type {
  CatalogueActiveState,
  CatalogueContractualServiceRecord,
  CatalogueItemType,
  CatalogueOnetimeServiceRecord,
  CatalogueRecord,
  CatalogueRetainerServiceRecord,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { VForm } from "vuetify/components/VForm";

type SalesTaskDraft = {
  id: number;
  title: string;
};

type RelatedItemDraft = {
  id: number;
  name: string;
  category: string;
  price?: number | null;
  description: string;
};

type PhaseDraft = {
  id: number;
  name: string;
  price: number | null;
  chargeTax: boolean;
  description: string;
};

type JobConfigPriority = "Low" | "Normal" | "High";
type JobConfigTaskStatus =
  | "pending"
  | "in_progress"
  | "for_review"
  | "completed";

type JobConfigTask = {
  id: number;
  title: string;
  dueAt: string | null;
  manhours: number | null;
  notes: string;
  status: JobConfigTaskStatus;
  important: boolean;
};

type JobConfigGoal = {
  id: number;
  milestoneId: number;
  phaseId?: number | null;
  retainerServiceId?: number | null;
  name: string;
  dueDate: string | null;
  priority: JobConfigPriority;
  note: string;
  tasks: JobConfigTask[];
};

type JobConfigMilestone = {
  id: number;
  name: string;
  dueDate: string | null;
  priority: JobConfigPriority;
  note: string;
  tasks: JobConfigTask[];
  goals: JobConfigGoal[];
};

const route = useRoute();
const router = useRouter();
const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const configStore = useConfigStore();
configStore.init();

const itemBestPrice = ref<number | null>(null);
const isTaxChargeToItem = ref(true);

const content = ref("<p></p>");

const selectedType = computed(() => {
  const rawType = route.query.type;
  return typeof rawType === "string" && rawType.trim() ? rawType : "Product";
});

const typeDescriptions: Record<string, string> = {
  "Onetime Service":
    "Create a one-off service item for a single defined scope of work.",
  Product: "Create a stocked sellable inventory item.",
  "Contractual Service":
    "Create a service delivered under a contract or maintenance agreement.",
  "Retainer Service": "Create an ongoing retainer-based service offering.",
  "Reccurent Service":
    "Create a recurring service delivered on a repeating schedule.",
  "Produced Product":
    "Create an internally manufactured or custom-built catalogue item.",
  Rental: "Create a rentable asset tracked for availability and return.",
};

const pageTitle = computed(() => `Add ${selectedType.value}`);
const editingItemId = computed(() => {
  const raw = route.query.id;
  return typeof raw === "string" && raw.trim() ? raw : null;
});
const isEditing = computed(() => Boolean(editingItemId.value));
const pageSubtitle = computed(
  () => typeDescriptions[selectedType.value] || "Create a new catalogue item.",
);
const publishButtonLabel = computed(() =>
  isEditing.value
    ? `Save ${selectedType.value}`
    : `Publish ${selectedType.value}`,
);

const itemName = ref("");
const selectedCategory = ref("");
const selectedStatus = ref<CatalogueActiveState>("Active");
const periodStartDate = ref<string | null>(null);
const periodEndDate = ref<string | null>(null);
const itemImage = ref<string | null>(null);
const itemImageInputRef = ref<HTMLInputElement | null>(null);
const isImageUrlDialogOpen = ref(false);
const imageUrlDraft = ref("");
const relatedItemId = ref(1);
const relatedItems = ref<RelatedItemDraft[]>([]);
const isRelatedItemDialogOpen = ref(false);
const relatedItemName = ref("");
const relatedItemCategory = ref("");
const relatedItemPrice = ref<number | null>(null);
const relatedItemDescription = ref("<p></p>");
const relatedItemErrors = ref({
  name: "",
  category: "",
});
const phaseId = ref(1);
const phases = ref<PhaseDraft[]>([]);
const isPhaseDialogOpen = ref(false);
const phaseName = ref("");
const phasePrice = ref<number | null>(null);
const isPhaseChargeTax = ref(true);
const phaseDescription = ref("<p></p>");
const phaseErrors = ref({
  name: "",
});
const salesTaskId = ref(1);
const salesTasks = ref<SalesTaskDraft[]>([]);
const salesTaskFieldRefs = ref<Record<number, HTMLElement | null>>({});
const milestoneFormRef = ref<VForm>();
const goalFormRef = ref<VForm>();
const taskFormRef = ref<VForm>();
const itemFormRef = ref<VForm>();
const hasCustomMilestoneName = ref(false);
const jobConfigGoalId = ref(1);
const jobConfigTaskId = ref(1);
const expandedMilestones = ref<number[]>([1]);
const expandedGoals = ref<number[]>([]);
const priorityOptions = [
  { title: "Low", value: "Low" },
  { title: "Normal", value: "Normal" },
  { title: "High", value: "High" },
];
const taskStatusOptions = [
  { title: "Pending", value: "pending" },
  { title: "In Progress", value: "in_progress" },
  { title: "For Review", value: "for_review" },
  { title: "Completed", value: "completed" },
];
const defaultMilestoneName = computed(() => {
  const trimmedName = itemName.value.trim();
  return trimmedName || "New Item";
});

const jobConfigMilestones = ref<JobConfigMilestone[]>([
  {
    id: 1,
    name: defaultMilestoneName.value,
    dueDate: null,
    priority: "Normal",
    note: "",
    tasks: [],
    goals: [],
  },
]);
const milestoneDialog = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  targetId: null as number | null,
  draft: {
    name: "",
    dueDate: null as string | null,
    priority: "Normal" as JobConfigPriority,
    note: "",
  },
});
const goalDialog = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  targetId: null as number | null,
  milestoneId: null as number | null,
  draft: {
    name: "",
    dueDate: null as string | null,
    priority: "Normal" as JobConfigPriority,
    note: "",
  },
});
const taskDialog = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  parentType: "milestone" as "milestone" | "goal",
  parentId: null as number | null,
  targetId: null as number | null,
  draft: {
    title: "",
    dueAt: null as string | null,
    manhours: null as number | null,
    notes: "",
    status: "pending" as JobConfigTaskStatus,
    important: false,
  },
});

const cleanEntries = (values?: (string | null | undefined)[]) =>
  Array.from(
    new Set(
      (values || []).map((value) => String(value ?? "").trim()).filter(Boolean),
    ),
  );

const categoryTree = computed<CatalogueCategory[]>(
  () => configStore.configurations.catalogue?.categories || [],
);

const activeStateOptions = computed(() => {
  const configured = cleanEntries(
    configStore.configurations.catalogue?.activeStates,
  );
  const source = configured.length
    ? configured
    : ["Active", "Non-Active", "Archived"];

  return source.map((state) => ({ title: state, value: state }));
});

const isContractualService = computed(
  () => selectedType.value === "Contractual Service",
);
const isRetainerService = computed(
  () => selectedType.value === "Retainer Service",
);
const relatedSectionTitle = computed(() =>
  isRetainerService.value ? "Retainer services" : "Related items",
);
const relatedButtonLabel = computed(() =>
  isRetainerService.value ? "Retainer Service" : "Related Item",
);
const relatedDialogTitle = computed(() =>
  isRetainerService.value ? "Add Retainer Service" : "Add Related Item",
);
const retainerLinkedServicesTotalPrice = computed(() =>
  relatedItems.value.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
);

const contractualPhaseTotalPrice = computed(() =>
  phases.value.reduce((sum, phase) => sum + (Number(phase.price) || 0), 0),
);

const syncRetainerMilestoneDueDate = () => {
  if (!isRetainerService.value) return;

  const milestone = jobConfigMilestones.value[0];
  if (!milestone) return;

  milestone.dueDate = periodEndDate.value ?? null;
};

watch(
  defaultMilestoneName,
  (nextName) => {
    const milestone = jobConfigMilestones.value[0];
    if (!milestone || hasCustomMilestoneName.value) return;

    milestone.name = nextName;
  },
  { immediate: true },
);

watch(
  [isRetainerService, periodEndDate],
  () => {
    syncRetainerMilestoneDueDate();
  },
  { immediate: true },
);

const addSalesTask = () => {
  const taskId = salesTaskId.value++;

  salesTasks.value.push({
    id: taskId,
    title: "",
  });

  nextTick(() => {
    const fieldRoot = salesTaskFieldRefs.value[taskId];
    const input = fieldRoot?.querySelector("input");

    if (input instanceof HTMLInputElement) input.focus();
  });
};

const removeSalesTask = (taskId: number) => {
  salesTasks.value = salesTasks.value.filter((task) => task.id !== taskId);
  delete salesTaskFieldRefs.value[taskId];
};

const pruneSalesTask = (taskId: number) => {
  const task = salesTasks.value.find((entry) => entry.id === taskId);

  if (!task) return;

  task.title = task.title.trim();

  if (!task.title) removeSalesTask(taskId);
};

const resetRelatedItemDraft = () => {
  relatedItemName.value = "";
  relatedItemCategory.value = "";
  relatedItemPrice.value = null;
  relatedItemDescription.value = "<p></p>";
  relatedItemErrors.value = {
    name: "",
    category: "",
  };
};

const openRelatedItemDialog = () => {
  resetRelatedItemDraft();
  isRelatedItemDialogOpen.value = true;
};

const saveRelatedItem = () => {
  const trimmedName = relatedItemName.value.trim();
  const trimmedCategory = relatedItemCategory.value.trim();

  relatedItemErrors.value = {
    name: trimmedName ? "" : "Title is required",
    category: trimmedCategory ? "" : "Category is required",
  };

  if (!trimmedName || !trimmedCategory) return;

  relatedItems.value.push({
    id: relatedItemId.value++,
    name: trimmedName,
    category: trimmedCategory,
    price: isRetainerService.value
      ? relatedItemPrice.value === null || relatedItemPrice.value === undefined
        ? null
        : Number.isFinite(Number(relatedItemPrice.value))
          ? Number(relatedItemPrice.value)
          : null
      : undefined,
    description: relatedItemDescription.value.replace(/<[^>]+>/g, " ").trim(),
  });

  if (isRetainerService.value) syncRetainerServiceGoals();

  isRelatedItemDialogOpen.value = false;
  resetRelatedItemDraft();
};

const removeRelatedItem = (itemId: number) => {
  relatedItems.value = relatedItems.value.filter((item) => item.id !== itemId);
  if (isRetainerService.value) syncRetainerServiceGoals();
};

const resetPhaseDraft = () => {
  phaseName.value = "";
  phasePrice.value = null;
  isPhaseChargeTax.value = true;
  phaseDescription.value = "<p></p>";
  phaseErrors.value = {
    name: "",
  };
};

const openPhaseDialog = () => {
  resetPhaseDraft();
  isPhaseDialogOpen.value = true;
};

const savePhase = () => {
  const trimmedName = phaseName.value.trim();

  phaseErrors.value = {
    name: trimmedName ? "" : "Title is required",
  };

  if (!trimmedName) return;

  phases.value.push({
    id: phaseId.value++,
    name: trimmedName,
    price:
      phasePrice.value === null || phasePrice.value === undefined
        ? null
        : Number.isFinite(Number(phasePrice.value))
          ? Number(phasePrice.value)
          : null,
    chargeTax: isPhaseChargeTax.value,
    description: phaseDescription.value.replace(/<[^>]+>/g, " ").trim(),
  });

  isPhaseDialogOpen.value = false;
  resetPhaseDraft();
  syncContractualPhaseGoals();
};

const removePhase = (itemId: number) => {
  phases.value = phases.value.filter((item) => item.id !== itemId);
  syncContractualPhaseGoals();
};

const priorityColor = (priority: JobConfigPriority) => {
  return priority === "High"
    ? "error"
    : priority === "Low"
      ? "secondary"
      : "primary";
};

const taskStatusLabel = (status?: JobConfigTaskStatus) => {
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
    return formatSystemDate(value);
  } catch {
    return value;
  }
};

const resetMilestoneDraft = () => {
  milestoneDialog.value.targetId = null;
  milestoneDialog.value.draft = {
    name: "",
    dueDate: null,
    priority: "Normal",
    note: "",
  };
};

const resetGoalDraft = () => {
  goalDialog.value.targetId = null;
  goalDialog.value.milestoneId = null;
  goalDialog.value.draft = {
    name: "",
    dueDate: null,
    priority: "Normal",
    note: "",
  };
};

const resetTaskDraft = () => {
  taskDialog.value.mode = "create";
  taskDialog.value.parentType = "milestone";
  taskDialog.value.parentId = null;
  taskDialog.value.targetId = null;
  taskDialog.value.draft = {
    title: "",
    dueAt: null,
    manhours: null,
    notes: "",
    status: "pending",
    important: false,
  };
};

const syncContractualPhaseGoals = () => {
  if (!isContractualService.value) return;

  const milestone = jobConfigMilestones.value[0];
  if (!milestone) return;

  const manualGoals = milestone.goals.filter((goal) => !goal.phaseId);
  const phaseGoals = phases.value.map((phase) => {
    const existingGoal = milestone.goals.find(
      (goal) => goal.phaseId === phase.id,
    );

    return {
      id: existingGoal?.id ?? jobConfigGoalId.value++,
      milestoneId: milestone.id,
      phaseId: phase.id,
      name: phase.name,
      dueDate: existingGoal?.dueDate ?? null,
      priority: existingGoal?.priority ?? "Normal",
      note: phase.description,
      tasks: existingGoal?.tasks ? [...existingGoal.tasks] : [],
    } satisfies JobConfigGoal;
  });

  milestone.goals = [...manualGoals, ...phaseGoals];
  syncExpandedGoals();
};

const syncRetainerServiceGoals = () => {
  if (!isRetainerService.value) return;

  const milestone = jobConfigMilestones.value[0];
  if (!milestone) return;

  const manualGoals = milestone.goals.filter((goal) => !goal.retainerServiceId);
  const retainerGoals = relatedItems.value.map((service) => {
    const existingGoal = milestone.goals.find(
      (goal) =>
        goal.retainerServiceId === service.id ||
        (goal.retainerServiceId === null || goal.retainerServiceId === undefined) &&
          goal.name === service.name,
    );

    return {
      id: existingGoal?.id ?? jobConfigGoalId.value++,
      milestoneId: milestone.id,
      retainerServiceId: service.id,
      name: service.name,
      dueDate: existingGoal?.dueDate ?? null,
      priority: existingGoal?.priority ?? "Normal",
      note: service.description,
      tasks: existingGoal?.tasks ? [...existingGoal.tasks] : [],
    } satisfies JobConfigGoal;
  });

  milestone.goals = [...manualGoals, ...retainerGoals];
  syncExpandedGoals();
};

const syncExpandedGoals = () => {
  expandedGoals.value = jobConfigMilestones.value.flatMap((milestone) =>
    milestone.goals
      .filter((goal) => goal.tasks.length > 0)
      .map((goal) => goal.id),
  );
};

const openEditMilestone = (milestone: JobConfigMilestone) => {
  milestoneDialog.value.mode = "edit";
  milestoneDialog.value.visible = true;
  milestoneDialog.value.targetId = milestone.id;
  milestoneDialog.value.draft = {
    name: milestone.name,
    dueDate: milestone.dueDate,
    priority: milestone.priority,
    note: milestone.note,
  };
  nextTick(() => milestoneFormRef.value?.resetValidation());
};

const saveMilestone = async () => {
  const result = await milestoneFormRef.value?.validate();
  if (!result?.valid) return;

  const draft = milestoneDialog.value.draft;

  const milestone = jobConfigMilestones.value.find(
    (entry) => entry.id === milestoneDialog.value.targetId,
  );

  if (milestone) {
    milestone.name = draft.name.trim();
    milestone.dueDate = draft.dueDate;
    milestone.priority = draft.priority;
    milestone.note = draft.note.trim();
    hasCustomMilestoneName.value =
      milestone.name !== defaultMilestoneName.value;
  }

  milestoneDialog.value.visible = false;
  resetMilestoneDraft();
};

const openCreateGoal = (milestoneId: number) => {
  resetGoalDraft();
  goalDialog.value.mode = "create";
  goalDialog.value.visible = true;
  goalDialog.value.milestoneId = milestoneId;
  expandedMilestones.value = [
    ...new Set([...expandedMilestones.value, milestoneId]),
  ];
  nextTick(() => goalFormRef.value?.resetValidation());
};

const openEditGoal = (milestoneId: number, goal: JobConfigGoal) => {
  goalDialog.value.mode = "edit";
  goalDialog.value.visible = true;
  goalDialog.value.targetId = goal.id;
  goalDialog.value.milestoneId = milestoneId;
  goalDialog.value.draft = {
    name: goal.name,
    dueDate: goal.dueDate,
    priority: goal.priority,
    note: goal.note,
  };
  nextTick(() => goalFormRef.value?.resetValidation());
};

const saveGoal = async () => {
  const result = await goalFormRef.value?.validate();
  if (!result?.valid || goalDialog.value.milestoneId === null) return;

  const milestone = jobConfigMilestones.value.find(
    (entry) => entry.id === goalDialog.value.milestoneId,
  );
  if (!milestone) return;

  const draft = goalDialog.value.draft;

  if (goalDialog.value.mode === "edit" && goalDialog.value.targetId !== null) {
    const goal = milestone.goals.find(
      (entry) => entry.id === goalDialog.value.targetId,
    );

    if (goal) {
      goal.name = draft.name.trim();
      goal.dueDate = draft.dueDate;
      goal.priority = draft.priority;
      goal.note = draft.note.trim();
    }
  } else {
    milestone.goals.push({
      id: jobConfigGoalId.value++,
      milestoneId: milestone.id,
      name: draft.name.trim(),
      dueDate: draft.dueDate,
      priority: draft.priority,
      note: draft.note.trim(),
      tasks: [],
      retainerServiceId: null,
    });
  }

  goalDialog.value.visible = false;
  resetGoalDraft();
  syncExpandedGoals();
};

const deleteGoal = (milestoneId: number, goalId: number) => {
  const milestone = jobConfigMilestones.value.find(
    (entry) => entry.id === milestoneId,
  );
  if (!milestone) return;

  milestone.goals = milestone.goals.filter((entry) => entry.id !== goalId);
  syncExpandedGoals();
};

const openCreateTaskForMilestone = (milestoneId: number) => {
  resetTaskDraft();
  taskDialog.value.visible = true;
  taskDialog.value.mode = "create";
  taskDialog.value.parentType = "milestone";
  taskDialog.value.parentId = milestoneId;
  expandedMilestones.value = [
    ...new Set([...expandedMilestones.value, milestoneId]),
  ];
  nextTick(() => taskFormRef.value?.resetValidation());
};

const openCreateTaskForGoal = (goalId: number) => {
  resetTaskDraft();
  taskDialog.value.visible = true;
  taskDialog.value.mode = "create";
  taskDialog.value.parentType = "goal";
  taskDialog.value.parentId = goalId;
  expandedGoals.value = [...new Set([...expandedGoals.value, goalId])];
  nextTick(() => taskFormRef.value?.resetValidation());
};

const openEditTaskForMilestone = (milestoneId: number, task: JobConfigTask) => {
  taskDialog.value.visible = true;
  taskDialog.value.mode = "edit";
  taskDialog.value.parentType = "milestone";
  taskDialog.value.parentId = milestoneId;
  taskDialog.value.targetId = task.id;
  taskDialog.value.draft = {
    title: task.title,
    dueAt: task.dueAt,
    manhours: task.manhours,
    notes: task.notes,
    status: task.status,
    important: task.important,
  };
  nextTick(() => taskFormRef.value?.resetValidation());
};

const openEditTaskForGoal = (goalId: number, task: JobConfigTask) => {
  taskDialog.value.visible = true;
  taskDialog.value.mode = "edit";
  taskDialog.value.parentType = "goal";
  taskDialog.value.parentId = goalId;
  taskDialog.value.targetId = task.id;
  taskDialog.value.draft = {
    title: task.title,
    dueAt: task.dueAt,
    manhours: task.manhours,
    notes: task.notes,
    status: task.status,
    important: task.important,
  };
  nextTick(() => taskFormRef.value?.resetValidation());
};

const deleteTaskFromMilestone = (milestoneId: number, taskId: number) => {
  const milestone = jobConfigMilestones.value.find(
    (entry) => entry.id === milestoneId,
  );
  if (!milestone) return;

  milestone.tasks = milestone.tasks.filter((entry) => entry.id !== taskId);
};

const deleteTaskFromGoal = (goalId: number, taskId: number) => {
  const milestone = jobConfigMilestones.value.find((entry) =>
    entry.goals.some((goal) => goal.id === goalId),
  );
  const goal = milestone?.goals.find((entry) => entry.id === goalId);
  if (!goal) return;

  goal.tasks = goal.tasks.filter((entry) => entry.id !== taskId);
  syncExpandedGoals();
};

const saveTask = async () => {
  const result = await taskFormRef.value?.validate();
  if (!result?.valid || taskDialog.value.parentId === null) return;

  const draftTask: JobConfigTask = {
    id: taskDialog.value.targetId ?? jobConfigTaskId.value++,
    title: taskDialog.value.draft.title.trim(),
    dueAt: taskDialog.value.draft.dueAt,
    manhours: taskDialog.value.draft.manhours,
    notes: taskDialog.value.draft.notes.trim(),
    status: taskDialog.value.draft.status,
    important: taskDialog.value.draft.important,
  };

  if (taskDialog.value.parentType === "milestone") {
    const milestone = jobConfigMilestones.value.find(
      (entry) => entry.id === taskDialog.value.parentId,
    );
    if (!milestone) return;
    if (
      taskDialog.value.mode === "edit" &&
      taskDialog.value.targetId !== null
    ) {
      const task = milestone.tasks.find(
        (entry) => entry.id === taskDialog.value.targetId,
      );
      if (task) Object.assign(task, draftTask);
    } else {
      milestone.tasks.push(draftTask);
    }
  } else {
    const milestone = jobConfigMilestones.value.find((entry) =>
      entry.goals.some((goal) => goal.id === taskDialog.value.parentId),
    );
    const goal = milestone?.goals.find(
      (entry) => entry.id === taskDialog.value.parentId,
    );
    if (!goal) return;
    if (
      taskDialog.value.mode === "edit" &&
      taskDialog.value.targetId !== null
    ) {
      const task = goal.tasks.find(
        (entry) => entry.id === taskDialog.value.targetId,
      );
      if (task) Object.assign(task, draftTask);
    } else {
      goal.tasks.push(draftTask);
    }
    syncExpandedGoals();
  }

  taskDialog.value.visible = false;
  resetTaskDraft();
};

const stripRichText = (value: string) => value.replace(/<[^>]+>/g, " ").trim();

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const openImageFilePicker = () => {
  itemImageInputRef.value?.click();
};

const handleImageFileSelection = async (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    target.value = "";
    return;
  }

  try {
    itemImage.value = await fileToDataUrl(file);
  } finally {
    target.value = "";
  }
};

const openImageUrlDialog = () => {
  imageUrlDraft.value =
    itemImage.value && !itemImage.value.startsWith("data:")
      ? itemImage.value
      : "";
  isImageUrlDialogOpen.value = true;
};

const saveImageFromUrl = () => {
  const trimmedUrl = imageUrlDraft.value.trim();
  if (!trimmedUrl) return;

  itemImage.value = trimmedUrl;
  isImageUrlDialogOpen.value = false;
};

const removeItemImage = () => {
  itemImage.value = null;
  imageUrlDraft.value = "";
};

const applySharedRecord = (record: CatalogueRecord) => {
  itemName.value = record.name;
  selectedCategory.value = record.category;
  selectedStatus.value = record.activeState;
  periodStartDate.value = null;
  periodEndDate.value = null;
  itemBestPrice.value = record.bestPrice ?? null;
  isTaxChargeToItem.value = record.chargeTax ?? true;
  itemImage.value = record.image ?? null;
  content.value = record.description
    ? `<p>${record.description}</p>`
    : "<p></p>";
  relatedItems.value = [];
  relatedItemId.value = 1;
  salesTasks.value = [];
  salesTaskId.value = 1;
  hasCustomMilestoneName.value = false;
  jobConfigGoalId.value = 1;
  jobConfigTaskId.value = 1;
  jobConfigMilestones.value = [
    {
      id: 1,
      name: record.name || defaultMilestoneName.value,
      dueDate: null,
      priority: "Normal",
      note: "",
      tasks: [],
      goals: [],
    },
  ];
  expandedMilestones.value = [1];
  expandedGoals.value = [];
};

const applyServiceTemplateRecord = (
  record:
    | CatalogueOnetimeServiceRecord
    | CatalogueContractualServiceRecord
    | CatalogueRetainerServiceRecord,
) => {
  applySharedRecord(record);
  if (record.type === "Onetime Service") {
    relatedItems.value = (record.relatedItems || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
    }));
    relatedItemId.value =
      relatedItems.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    phases.value = [];
    phaseId.value = 1;
  } else if (record.type === "Retainer Service") {
    relatedItems.value = (record.retainerServices || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price ?? null,
      description: item.description,
    }));
    relatedItemId.value =
      relatedItems.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    phases.value = [];
    phaseId.value = 1;
    periodStartDate.value = record.startDate ?? null;
    periodEndDate.value = record.endDate ?? null;
  } else {
    phases.value = (record.phases || []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      price: phase.price ?? null,
      chargeTax: phase.chargeTax ?? true,
      description: phase.description,
    }));
    phaseId.value =
      phases.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    relatedItems.value = [];
    relatedItemId.value = 1;
    syncContractualPhaseGoals();
  }

  salesTasks.value = (record.salesTasks || []).map((task) => ({
    id: task.id,
    title: task.title,
  }));
  salesTaskId.value =
    salesTasks.value.reduce((max, task) => Math.max(max, task.id), 0) + 1;

  const milestones = record.jobConfiguration?.milestones?.length
    ? record.jobConfiguration.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note,
        tasks: (milestone.tasks || []).map((task) => ({ ...task })),
        goals: (milestone.goals || []).map((goal) => ({
          ...goal,
          retainerServiceId: goal.retainerServiceId ?? null,
          tasks: (goal.tasks || []).map((task) => ({ ...task })),
        })),
      }))
    : [
        {
          id: 1,
          name: record.name || defaultMilestoneName.value,
          dueDate: null,
          priority: "Normal" as JobConfigPriority,
          note: "",
          tasks: [],
          goals: [],
        },
      ];

  jobConfigMilestones.value = milestones;
  expandedMilestones.value = milestones.map((milestone) => milestone.id);
  if (record.type === "Retainer Service") syncRetainerMilestoneDueDate();
  if (record.type === "Retainer Service") syncRetainerServiceGoals();
  if (record.type === "Contractual Service") syncContractualPhaseGoals();
  syncExpandedGoals();
  hasCustomMilestoneName.value =
    milestones[0]?.name !== defaultMilestoneName.value;
  jobConfigGoalId.value =
    milestones.reduce(
      (max, milestone) =>
        Math.max(max, ...milestone.goals.map((goal) => goal.id), 0),
      0,
    ) + 1;
  jobConfigTaskId.value =
    milestones.reduce((max, milestone) => {
      const directTaskMax = Math.max(
        0,
        ...milestone.tasks.map((task) => task.id),
      );
      const goalTaskMax = Math.max(
        0,
        ...milestone.goals.flatMap((goal) => goal.tasks.map((task) => task.id)),
      );

      return Math.max(max, directTaskMax, goalTaskMax);
    }, 0) + 1;
};

const resetOnetimeServiceForm = () => {
  itemName.value = "";
  selectedCategory.value = "";
  selectedStatus.value = "Active";
  periodStartDate.value = null;
  periodEndDate.value = null;
  itemBestPrice.value = null;
  isTaxChargeToItem.value = true;
  itemImage.value = null;
  imageUrlDraft.value = "";
  content.value = "<p></p>";
  relatedItems.value = [];
  relatedItemId.value = 1;
  phases.value = [];
  phaseId.value = 1;
  salesTasks.value = [];
  salesTaskId.value = 1;
  hasCustomMilestoneName.value = false;
  jobConfigGoalId.value = 1;
  jobConfigTaskId.value = 1;
  jobConfigMilestones.value = [
    {
      id: 1,
      name: defaultMilestoneName.value,
      dueDate: null,
      priority: "Normal",
      note: "",
      tasks: [],
      goals: [],
    },
  ];
  expandedMilestones.value = [1];
  expandedGoals.value = [];
};

const saveItem = async (mode: "draft" | "publish" = "publish") => {
  const validation = await itemFormRef.value?.validate();
  if (validation && !validation.valid) return;

  const payload = {
    type: selectedType.value as CatalogueItemType,
    name: itemName.value.trim(),
    category: selectedCategory.value.trim() || "Uncategorized",
    activeState: mode === "draft" ? "Non-Active" : selectedStatus.value,
    startDate: isRetainerService.value ? periodStartDate.value : undefined,
    endDate: isRetainerService.value ? periodEndDate.value : undefined,
    image: itemImage.value?.trim() || null,
    bestPrice: isContractualService.value
      ? contractualPhaseTotalPrice.value
      : isRetainerService.value
        ? retainerLinkedServicesTotalPrice.value
        : itemBestPrice.value === null || itemBestPrice.value === undefined
        ? null
        : Number.isFinite(Number(itemBestPrice.value))
          ? Number(itemBestPrice.value)
          : null,
    chargeTax: isTaxChargeToItem.value,
    description: stripRichText(content.value),
    relatedItems: isContractualService.value || isRetainerService.value
      ? undefined
      : relatedItems.value.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          category: item.category.trim(),
          description: item.description.trim(),
        })),
    retainerServices: isRetainerService.value
      ? relatedItems.value.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          category: item.category.trim(),
          price:
            item.price === null || item.price === undefined
              ? null
              : Number.isFinite(Number(item.price))
                ? Number(item.price)
                : null,
          description: item.description.trim(),
        }))
      : undefined,
    phases: isContractualService.value
      ? phases.value.map((phase) => ({
          id: phase.id,
          name: phase.name.trim(),
          price:
            phase.price === null || phase.price === undefined
              ? null
              : Number.isFinite(Number(phase.price))
                ? Number(phase.price)
                : null,
          chargeTax: phase.chargeTax,
          description: phase.description.trim(),
        }))
      : undefined,
    salesTasks: salesTasks.value
      .map((task) => ({
        id: task.id,
        title: task.title.trim(),
      }))
      .filter((task) => task.title),
    jobConfiguration: {
      milestones: jobConfigMilestones.value.map((milestone, index) => ({
        id: milestone.id,
        name: milestone.name.trim(),
        dueDate:
          isRetainerService.value && index === 0
            ? periodEndDate.value
            : milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note.trim(),
        tasks: milestone.tasks.map((task) => ({
          id: task.id,
          title: task.title.trim(),
          dueAt: task.dueAt,
          manhours: task.manhours,
          notes: task.notes.trim(),
          status: task.status,
          important: task.important,
        })),
        goals: milestone.goals.map((goal) => ({
          id: goal.id,
          milestoneId: goal.milestoneId,
          name: goal.name.trim(),
          dueDate: goal.dueDate,
          phaseId: goal.phaseId ?? null,
          retainerServiceId: goal.retainerServiceId ?? null,
          priority: goal.priority,
          note: goal.note.trim(),
          tasks: goal.tasks.map((task) => ({
            id: task.id,
            title: task.title.trim(),
            dueAt: task.dueAt,
            manhours: task.manhours,
            notes: task.notes.trim(),
            status: task.status,
            important: task.important,
          })),
        })),
      })),
    },
  };

  if (editingItemId.value) {
    cataloguesStore.updateItem(editingItemId.value, payload);
  } else {
    cataloguesStore.addItem(payload);
  }

  router.push("/catalogues/list");
};

watch(
  editingItemId,
  (nextId) => {
    if (!nextId) {
      resetOnetimeServiceForm();
      return;
    }

    const record = cataloguesStore.recordById(nextId, selectedType.value);
    if (!record) {
      resetOnetimeServiceForm();
      return;
    }

    if (
      record.type === "Onetime Service" ||
      record.type === "Contractual Service" ||
      record.type === "Retainer Service"
    ) {
      applyServiceTemplateRecord(record);
      return;
    }

    applySharedRecord(record);
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <div
      class="d-flex flex-wrap justify-start justify-sm-space-between gap-y-4 gap-x-6 mb-6"
    >
      <div class="d-flex flex-column justify-center">
        <h4 class="text-h4 font-weight-medium">
          {{ pageTitle }}
        </h4>
        <div class="text-body-1">
          {{ pageSubtitle }}
        </div>
      </div>

      <div class="d-flex gap-4 align-center flex-wrap">
        <VBtn
          variant="tonal"
          color="secondary"
          @click="router.push('/catalogues/list')"
        >
          Discard
        </VBtn>
        <VBtn variant="tonal" color="primary" @click="saveItem('draft')">
          Save Draft
        </VBtn>
        <VBtn @click="saveItem('publish')">{{ publishButtonLabel }}</VBtn>
      </div>
    </div>

    <VRow>
      <VCol md="8">
        <!-- 👉 Item Information -->
        <VCard class="mb-6">
          <VCardItem>
            <template #title> Item Information </template>
          </VCardItem>

          <VCardText>
            <VForm ref="itemFormRef" @submit.prevent="saveItem('publish')">
              <VRow>
                <VCol cols="12">
                  <AppTextField
                    v-model="itemName"
                    label="Name"
                    placeholder="iPhone 14"
                    :rules="[requiredValidator]"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <CatalogueCategoryTreeSelect
                    v-model="selectedCategory"
                    label="Category"
                    placeholder="Select Category"
                    :items="categoryTree"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="selectedStatus"
                    label="Status"
                    placeholder="Select Status"
                    :items="activeStateOptions"
                  />
                </VCol>
                <template v-if="isRetainerService">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="periodStartDate"
                      label="Start Date"
                      placeholder="YYYY-MM-DD"
                    />
                  </VCol>
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="periodEndDate"
                      label="End Date"
                      placeholder="YYYY-MM-DD"
                    />
                  </VCol>
                </template>
                <VCol>
                  <span class="mb-1">Description (optional)</span>
                  <ProductDescriptionEditor
                    v-model="content"
                    placeholder="Item Description"
                    class="border rounded"
                  />
                </VCol>
              </VRow>
            </VForm>

            <div v-if="!isContractualService && relatedItems.length" class="mt-6">
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ relatedSectionTitle }}
              </div>

              <div class="d-flex flex-column gap-4">
                <div
                  v-for="relatedItem in relatedItems"
                  :key="relatedItem.id"
                  class="related-item-card"
                >
                  <div class="related-item-card__header">
                    <div class="related-item-card__dot" />

                    <div class="related-item-card__content">
                      <div
                        class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                      >
                        <div class="text-h6 font-weight-medium">
                          {{ relatedItem.name }}
                        </div>
                        <VChip
                          v-if="isRetainerService && relatedItem.price !== null"
                          color="primary"
                          size="small"
                          variant="text"
                        >
                          ${{ relatedItem.price }}
                        </VChip>
                      </div>

                      <div class="text-body-2 text-medium-emphasis">
                        {{ relatedItem.category || "Uncategorized" }}
                      </div>
                    </div>

                    <VBtn
                      icon
                      variant="text"
                      color="error"
                      @click="removeRelatedItem(relatedItem.id)"
                    >
                      <VIcon icon="tabler-trash" />
                    </VBtn>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="isContractualService && phases.length" class="mt-6">
              <div class="text-body-2 text-medium-emphasis mb-4">Phases</div>

              <div class="d-flex flex-column gap-4">
                <div
                  v-for="phase in phases"
                  :key="phase.id"
                  class="related-item-card"
                >
                  <div class="related-item-card__header">
                    <div class="related-item-card__dot" />

                    <div class="related-item-card__content">
                      <div
                        class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                      >
                        <div class="text-h6 font-weight-medium">
                          {{ phase.name }}
                        </div>
                        <VChip
                          v-if="phase.price !== null"
                          color="primary"
                          size="small"
                          variant="text"
                        >
                          ${{ phase.price }}
                        </VChip>
                        <VChip
                          size="small"
                          :color="phase.chargeTax ? 'success' : 'secondary'"
                          variant="text"
                        >
                          {{ phase.chargeTax ? "Taxable" : "No Tax" }}
                        </VChip>
                      </div>

                      <div
                        v-if="phase.description"
                        class="text-body-2 text-medium-emphasis"
                      >
                        {{ phase.description }}
                      </div>
                    </div>

                    <VBtn
                      icon
                      variant="text"
                      color="error"
                      @click="removePhase(phase.id)"
                    >
                      <VIcon icon="tabler-trash" />
                    </VBtn>
                  </div>
                </div>
              </div>
            </div>
          </VCardText>

          <VCardActions class="px-6 pb-6 pt-0 justify-end">
            <VBtn
              size="small"
              color="primary"
              variant="elevated"
              :prepend-icon="
                isContractualService
                  ? 'tabler-layers-linked'
                  : 'tabler-link-plus'
              "
              @click="
                isContractualService
                  ? openPhaseDialog()
                  : openRelatedItemDialog()
              "
            >
              {{ isContractualService ? "Phase" : relatedButtonLabel }}
            </VBtn>
          </VCardActions>
        </VCard>

        <!-- 👉 Sales Tasks -->
        <VCard class="mb-6">
          <VCardItem>
            <template #title> Sales Tasks </template>
            <template #append>
              <VBtn
                size="small"
                prepend-icon="tabler-plus"
                @click="addSalesTask"
              >
                Add Task
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <div class="d-flex flex-column gap-4">
              <div
                v-for="task in salesTasks"
                :key="task.id"
                class="sales-task-row"
              >
                <div class="sales-task-row__icon">
                  <VIcon icon="tabler-checklist" size="20" />
                </div>

                <div
                  class="sales-task-row__field"
                  :ref="
                    (el) =>
                      (salesTaskFieldRefs[task.id] = el as HTMLElement | null)
                  "
                >
                  <AppTextField
                    v-model="task.title"
                    label="Task"
                    placeholder="Site inspection"
                    @blur="pruneSalesTask(task.id)"
                  />
                </div>

                <VBtn
                  icon
                  variant="text"
                  color="error"
                  class="sales-task-row__delete"
                  @click="removeSalesTask(task.id)"
                >
                  <VIcon icon="tabler-trash" />
                </VBtn>
              </div>
            </div>
          </VCardText>
        </VCard>

        <VCard class="mb-6">
          <VCardText>
            <div
              class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
            >
              <div>
                <h5 class="text-h5 mb-1">Job Configuration</h5>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Tasks can live directly under a milestone or under a goal.
                </p>
              </div>
            </div>

            <VExpansionPanels
              v-model="expandedMilestones"
              variant="accordion"
              multiple
              class="expansion-panels-width-border milestone-panels"
            >
              <VExpansionPanel
                v-for="milestone in jobConfigMilestones"
                :key="milestone.id"
                :value="milestone.id"
                class="milestone-panel"
              >
                <VExpansionPanelTitle>
                  <div class="d-flex align-center gap-3 w-100">
                    <div class="rounded-circle milestone-status-dot" />

                    <div class="flex-grow-1 min-w-0">
                      <div class="d-flex align-center gap-2 flex-wrap">
                        <div
                          class="font-weight-medium truncate-title truncate-title--header"
                        >
                          {{ milestone.name }}
                        </div>
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
                            size="x-small"
                            variant="text"
                            icon="tabler-checkbox"
                            @click="openCreateTaskForMilestone(milestone.id)"
                          />
                        </template>
                      </VTooltip>
                      <VTooltip text="Add Goal" location="top">
                        <template #activator="{ props: tooltipProps }">
                          <VBtn
                            v-bind="tooltipProps"
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
                              <template #prepend>
                                <VIcon icon="tabler-edit" />
                              </template>
                              <VListItemTitle>Edit</VListItemTitle>
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
                            <VIcon
                              icon="tabler-checklist"
                              size="18"
                              class="task-template-icon"
                            />

                            <div class="task-copy">
                              <strong class="text-body-1 truncate-title">
                                {{ task.title }}
                              </strong>
                              <span class="text-sm">
                                Due {{ formatDate(task.dueAt) }}
                                <span v-if="task.manhours !== null">
                                  | {{ task.manhours }} Manhour<span
                                    v-if="task.manhours !== 1"
                                    >s</span
                                  >
                                </span>
                              </span>
                              <span
                                v-if="task.notes"
                                class="text-sm text-medium-emphasis"
                              >
                                {{ task.notes }}
                              </span>
                            </div>
                          </div>

                          <div class="task-row-side">
                            <VIcon
                              v-if="task.important"
                              icon="tabler-star-filled"
                              color="warning"
                              size="18"
                            />
                            <VBtn icon variant="text" size="x-small">
                              <VIcon icon="tabler-dots-vertical" size="18" />
                              <VMenu activator="parent">
                                <VList>
                                  <VListItem
                                    @click="
                                      openEditTaskForMilestone(
                                        milestone.id,
                                        task,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-edit" />
                                    </template>
                                    <VListItemTitle>Edit</VListItemTitle>
                                  </VListItem>
                                  <VListItem
                                    @click="
                                      deleteTaskFromMilestone(
                                        milestone.id,
                                        task.id,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon
                                        icon="tabler-trash"
                                        color="error"
                                      />
                                    </template>
                                    <VListItemTitle>Delete</VListItemTitle>
                                  </VListItem>
                                </VList>
                              </VMenu>
                            </VBtn>
                            <span
                              class="text-sm"
                              :class="{
                                'text-primary': task.status === 'in_progress',
                                'text-warning': task.status === 'for_review',
                                'text-medium-emphasis':
                                  task.status === 'pending',
                                'text-success': task.status === 'completed',
                              }"
                            >
                              {{ taskStatusLabel(task.status) }}
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
                                <div
                                  class="font-weight-medium truncate-title truncate-title--header"
                                >
                                  {{ goal.name }}
                                </div>
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
                              <div
                                class="text-body-2 text-medium-emphasis mt-1"
                              >
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
                                    size="x-small"
                                    variant="text"
                                    icon="tabler-checkbox"
                                    @click="openCreateTaskForGoal(goal.id)"
                                  />
                                </template>
                              </VTooltip>
                              <VBtn icon variant="text" size="x-small">
                                <VIcon icon="tabler-dots-vertical" size="18" />
                                <VMenu activator="parent">
                                  <VList>
                                    <VListItem
                                      @click="openEditGoal(milestone.id, goal)"
                                    >
                                      <template #prepend>
                                        <VIcon icon="tabler-edit" />
                                      </template>
                                      <VListItemTitle>Edit</VListItemTitle>
                                    </VListItem>
                                    <VListItem
                                      @click="deleteGoal(milestone.id, goal.id)"
                                    >
                                      <template #prepend>
                                        <VIcon
                                          icon="tabler-trash"
                                          color="error"
                                        />
                                      </template>
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
                                    <VIcon
                                      icon="tabler-checklist"
                                      size="18"
                                      class="task-template-icon"
                                    />

                                    <div class="task-copy">
                                      <strong
                                        class="text-body-1 truncate-title"
                                      >
                                        {{ task.title }}
                                      </strong>
                                      <span class="text-sm">
                                        Due {{ formatDate(task.dueAt) }}
                                        <span v-if="task.manhours !== null">
                                          | {{ task.manhours }} Manhour<span
                                            v-if="task.manhours !== 1"
                                            >s</span
                                          >
                                        </span>
                                      </span>
                                      <span
                                        v-if="task.notes"
                                        class="text-sm text-medium-emphasis"
                                      >
                                        {{ task.notes }}
                                      </span>
                                    </div>
                                  </div>

                                  <div class="task-row-side">
                                    <VIcon
                                      v-if="task.important"
                                      icon="tabler-star-filled"
                                      color="warning"
                                      size="18"
                                    />
                                    <VBtn icon variant="text" size="x-small">
                                      <VIcon
                                        icon="tabler-dots-vertical"
                                        size="18"
                                      />
                                      <VMenu activator="parent">
                                        <VList>
                                          <VListItem
                                            @click="
                                              openEditTaskForGoal(goal.id, task)
                                            "
                                          >
                                            <template #prepend>
                                              <VIcon icon="tabler-edit" />
                                            </template>
                                            <VListItemTitle
                                              >Edit</VListItemTitle
                                            >
                                          </VListItem>
                                          <VListItem
                                            @click="
                                              deleteTaskFromGoal(
                                                goal.id,
                                                task.id,
                                              )
                                            "
                                          >
                                            <template #prepend>
                                              <VIcon
                                                icon="tabler-trash"
                                                color="error"
                                              />
                                            </template>
                                            <VListItemTitle
                                              >Delete</VListItemTitle
                                            >
                                          </VListItem>
                                        </VList>
                                      </VMenu>
                                    </VBtn>
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
                                      {{ taskStatusLabel(task.status) }}
                                    </span>
                                  </div>
                                </div>
                              </VCard>
                            </div>

                            <div
                              v-else
                              class="text-body-2 text-medium-emphasis empty-tasks"
                            >
                              No tasks under this goal yet.
                            </div>
                          </VCard>
                        </VExpansionPanelText>
                      </VExpansionPanel>
                    </VExpansionPanels>

                    <div
                      v-if="!milestone.tasks.length && !milestone.goals.length"
                      class="text-body-2 text-medium-emphasis empty-tasks"
                    >
                      No goals or tasks under this milestone yet.
                    </div>
                  </VCard>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>
          </VCardText>
        </VCard>
      </VCol>

      <VCol md="4" cols="12">
        <!-- 👉 Pricing -->
        <VCard title="Pricing" class="mb-6">
          <VCardText>
            <AppTextField
              v-if="isContractualService"
              :model-value="contractualPhaseTotalPrice"
              label="Best Price"
              placeholder="Calculated from phases"
              type="number"
              min="0"
              step="0.01"
              class="mb-6"
              disabled
            />
            <AppTextField
              v-else-if="isRetainerService"
              :model-value="retainerLinkedServicesTotalPrice"
              label="Best Price"
              placeholder="Calculated from retainer services"
              type="number"
              min="0"
              step="0.01"
              class="mb-6"
              disabled
            />
            <AppTextField
              v-else
              v-model.number="itemBestPrice"
              label="Best Price"
              placeholder="Price"
              type="number"
              min="0"
              step="0.01"
              class="mb-6"
            />

            <VCheckbox
              v-model="isTaxChargeToItem"
              label="Charge Tax on this item"
            />
          </VCardText>
        </VCard>

        <!-- 👉 Image -->
        <!-- 👉 Media -->
        <VCard class="mb-6">
          <VCardItem>
            <template #title> Item Image </template>
            <template #append>
              <VBtn
                variant="text"
                color="primary"
                size="small"
                class="px-0"
                @click="openImageUrlDialog"
              >
                Add Media from URL
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <input
              ref="itemImageInputRef"
              type="file"
              accept="image/*"
              class="d-none"
              @change="handleImageFileSelection"
            />

            <div v-if="itemImage" class="d-flex flex-column gap-y-4">
              <VImg
                :src="itemImage"
                height="240"
                cover
                class="rounded border"
              />

              <div class="d-flex gap-3 flex-wrap">
                <VBtn
                  color="primary"
                  variant="tonal"
                  prepend-icon="tabler-upload"
                  @click="openImageFilePicker"
                >
                  Replace Image
                </VBtn>
                <VBtn
                  color="secondary"
                  variant="tonal"
                  prepend-icon="tabler-link"
                  @click="openImageUrlDialog"
                >
                  Update URL
                </VBtn>
                <VBtn
                  color="error"
                  variant="tonal"
                  prepend-icon="tabler-trash"
                  @click="removeItemImage"
                >
                  Remove Image
                </VBtn>
              </div>
            </div>

            <div
              v-else
              class="d-flex flex-column justify-center align-center gap-y-3 pa-12 drop-zone rounded cursor-pointer"
              @click="openImageFilePicker"
            >
              <IconBtn variant="tonal" class="rounded-sm">
                <VIcon icon="tabler-upload" />
              </IconBtn>
              <h5 class="text-h5 text-center">Upload an item image</h5>
              <span class="text-disabled text-center">
                Click to browse for an image file or use the URL option above.
              </span>

              <VBtn
                color="primary"
                variant="tonal"
                size="small"
                @click.stop="openImageFilePicker"
              >
                Browse Images
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="isImageUrlDialogOpen" max-width="560">
      <VCard>
        <VCardItem title="Add Image From URL" />

        <VCardText>
          <AppTextField
            v-model="imageUrlDraft"
            label="Image URL"
            placeholder="https://example.com/image.jpg"
          />
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn
            color="primary"
            variant="tonal"
            :disabled="!imageUrlDraft.trim()"
            @click="saveImageFromUrl"
          >
            Save Image
          </VBtn>
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isImageUrlDialogOpen = false"
          >
            Cancel
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isRelatedItemDialogOpen" max-width="760">
      <VCard>
        <VCardItem :title="relatedDialogTitle" />

        <VCardText>
          <VRow>
            <VCol cols="6">
              <AppTextField
                v-model="relatedItemName"
                label="Name"
                placeholder="Acoustic Wall Panel"
                :error="Boolean(relatedItemErrors.name)"
                :error-messages="relatedItemErrors.name"
              />
            </VCol>
            <VCol cols="12" md="6">
              <CatalogueCategoryTreeSelect
                v-model="relatedItemCategory"
                label="Category"
                placeholder="Select Category"
                :items="categoryTree"
              />
              <div
                v-if="relatedItemErrors.category"
                class="text-error text-caption mt-1"
              >
                {{ relatedItemErrors.category }}
              </div>
            </VCol>
            <VCol v-if="isRetainerService" cols="12">
              <AppTextField
                v-model.number="relatedItemPrice"
                label="Service Price"
                placeholder="1500"
                type="number"
                min="0"
                step="0.01"
              />
            </VCol>
            <VCol cols="12">
              <span class="mb-1">Description (optional)</span>
              <ProductDescriptionEditor
                v-model="relatedItemDescription"
                placeholder="Item Description"
                class="border rounded"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn color="primary" variant="tonal" @click="saveRelatedItem">
            Save Related Item
          </VBtn>
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isRelatedItemDialogOpen = false"
          >
            Cancel
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isPhaseDialogOpen" max-width="760">
      <VCard>
        <VCardItem title="Add Phase" />

        <VCardText>
          <VRow>
            <VCol cols="6">
              <AppTextField
                v-model="phaseName"
                label="Name"
                placeholder="Mobilization"
                :error="Boolean(phaseErrors.name)"
                :error-messages="phaseErrors.name"
              />
            </VCol>
            <VCol cols="6">
              <AppTextField
                v-model.number="phasePrice"
                label="Phase Price"
                placeholder="900"
                type="number"
                min="0"
                step="0.01"
              />
            </VCol>
            <VCol cols="12">
              <VCheckbox
                v-model="isPhaseChargeTax"
                label="Charge Tax on this phase"
              />
            </VCol>
            <VCol cols="12">
              <span class="mb-1">Description (optional)</span>
              <ProductDescriptionEditor
                v-model="phaseDescription"
                placeholder="Phase Description"
                class="border rounded"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn color="primary" variant="tonal" @click="savePhase">
            Save Phase
          </VBtn>
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isPhaseDialogOpen = false"
          >
            Cancel
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="milestoneDialog.visible" max-width="560">
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-4">Edit Milestone</h5>
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
              <VCol cols="12">
                <AppDateTimePicker
                  v-model="milestoneDialog.draft.dueDate"
                  label="Due Date"
                  placeholder="YYYY-MM-DD"
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

    <VDialog v-model="goalDialog.visible" max-width="560">
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-4">
            {{ goalDialog.mode === "create" ? "Add Goal" : "Edit Goal" }}
          </h5>
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
              <VCol cols="12">
                <AppDateTimePicker
                  v-model="goalDialog.draft.dueDate"
                  label="Due Date"
                  placeholder="YYYY-MM-DD"
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

    <VDialog v-model="taskDialog.visible" max-width="560">
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-4">
            {{ taskDialog.mode === "create" ? "Add Task" : "Edit Task" }}
          </h5>
          <VForm ref="taskFormRef" @submit.prevent="saveTask">
            <VRow>
              <VCol cols="12" md="8">
                <AppTextField
                  v-model="taskDialog.draft.title"
                  label="Task Title"
                  placeholder="Task Title"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12" md="4">
                <AppSelect
                  v-model="taskDialog.draft.status"
                  label="Status"
                  placeholder="Select Status"
                  :items="taskStatusOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="6">
                <AppDateTimePicker
                  v-model="taskDialog.draft.dueAt"
                  label="Due Date"
                  placeholder="YYYY-MM-DD"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppTextField
                  v-model.number="taskDialog.draft.manhours"
                  label="Manhours"
                  placeholder="8"
                  type="number"
                  min="0"
                  step="0.5"
                />
              </VCol>
              <VCol cols="12">
                <AppTextarea
                  v-model="taskDialog.draft.notes"
                  label="Notes"
                  placeholder="Task notes"
                  auto-grow
                />
              </VCol>
              <VCol cols="12">
                <VCheckbox
                  v-model="taskDialog.draft.important"
                  label="Mark as important"
                />
              </VCol>
              <VCol cols="12">
                <DialogActionBar
                  save-type="submit"
                  @save="() => undefined"
                  @cancel="taskDialog.visible = false"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VDialog>
  </div>
</template>

<style lang="scss" scoped>
.drop-zone {
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
}

.sales-task-row {
  display: flex;
  align-items: flex-end;
  padding: 1rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  gap: 1rem;
}

.sales-task-row__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.14);
  block-size: 2.5rem;
  color: rgb(var(--v-theme-primary));
  inline-size: 2.5rem;
  margin-block-end: 0.25rem;
}

.sales-task-row__field {
  flex: 1 1 auto;
}

.sales-task-row__delete {
  flex: 0 0 auto;
  margin-block-end: 0.25rem;
}

.related-item-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.related-item-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-block: 0.875rem;
  padding-inline: 1rem;
}

.related-item-card__dot {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  block-size: 0.625rem;
  inline-size: 0.625rem;
  margin-block-start: 0.4rem;
}

.related-item-card__content {
  flex: 1 1 auto;
  min-inline-size: 0;
}

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

.task-row {
  border: 1px solid rgba(255, 255, 255, 6%);
  border-radius: 12px;
  background: rgba(255, 255, 255, 3%);
  padding-block: 0.75rem;
  padding-inline: 1rem;
}

.task-template-icon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
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

.empty-tasks {
  padding-block: 0.5rem;
  padding-inline: 0;
}
</style>

<style lang="scss">
.inventory-card {
  .v-tabs.v-tabs-pill {
    .v-slide-group-item--active.v-tab--selected.text-primary {
      h6 {
        color: #fff !important;
      }
    }
  }

  .v-radio-group,
  .v-checkbox {
    .v-selection-control {
      align-items: start !important;
    }

    .v-label.custom-input {
      border: none !important;
    }
  }
}

.ProseMirror {
  p {
    margin-block-end: 0;
  }

  padding: 0.5rem;
  outline: none;

  p.is-editor-empty:first-child::before {
    block-size: 0;
    color: #adb5bd;
    content: attr(data-placeholder);
    float: inline-start;
    pointer-events: none;
  }
}
</style>
