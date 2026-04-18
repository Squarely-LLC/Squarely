<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import CatalogueTaskTemplateDrawer from "@/components/catalogues/CatalogueTaskTemplateDrawer.vue";
import type { ToDo, ToDoStep } from "@/data/schema";
import type {
  CatalogueActiveState,
  CatalogueContractualServiceRecord,
  CatalogueItemType,
  CatalogueOnetimeServiceRecord,
  CatalogueProducedProductFieldType,
  CatalogueProducedProductRecord,
  CatalogueProducedProductSubItem,
  CatalogueReccurentServiceRecord,
  CatalogueRecord,
  CatalogueRetainerServiceRecord,
  CatalogueTaskStartTrigger,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { formatSystemDate } from "@core/utils/formatters";
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import type { VForm } from "vuetify/components/VForm";

type RelatedItemDraft = {
  id: number;
  name: string;
  category: string;
  price: number | null;
  chargeTax: boolean;
  description: string;
};

type PhaseDraft = {
  id: number;
  name: string;
  price: number | null;
};

type ProducedFieldSection = "options" | "measurements";
type ProducedProductTab = "options" | "raw-materials" | "measurements";

type ProducedFieldDraft = {
  id: number;
  name: string;
  type: CatalogueProducedProductFieldType;
  description: string;
  values: string[];
};

type RawMaterialDraft = {
  id: number;
  name: string;
  qty: number | null;
};

type ProducedSubItemDraft = {
  id: number;
  name: string;
  options: ProducedFieldDraft[];
  rawMaterials: RawMaterialDraft[];
  measurements: ProducedFieldDraft[];
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
  collaborators: ToDo["collaborators"];
  afterWhen: string | null;
  startTrigger?: CatalogueTaskStartTrigger | null;
  manhours: number | null;
  notes: string;
  status: JobConfigTaskStatus;
  important: boolean;
  attachment?: ToDo["attachment"];
  relatedTo?: ToDo["relatedTo"];
  steps: ToDoStep[];
};

type SalesTaskDraft = JobConfigTask;

type JobConfigGoal = {
  id: number;
  milestoneId: number;
  phaseId?: number | null;
  retainerServiceId?: number | null;
  reccurentServiceId?: number | null;
  name: string;
  startTrigger?: CatalogueTaskStartTrigger | null;
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

type TaskTriggerOption = {
  title: string;
  value: string;
};

const route = useRoute();
const router = useRouter();
const AsyncDialogActionBar = defineAsyncComponent(
  () => import("@/components/DialogActionBar.vue"),
);
const AsyncCatalogueCategoryTreeSelect = defineAsyncComponent(
  () => import("@/components/catalogues/CatalogueCategoryTreeSelect.vue"),
);
const AsyncProductDescriptionEditor = defineAsyncComponent(
  () => import("@/@core/components/ProductDescriptionEditor.vue"),
);
const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const configStore = useConfigStore();
configStore.init();
const renderDeferredSections = ref(false);
const topActionBarRef = ref<HTMLElement | null>(null);
const isFloatingActionBarVisible = ref(false);
let topActionBarObserver: IntersectionObserver | null = null;

const itemBestPrice = ref<number | null>(null);
const inventoryQty = ref<number | null>(null);
const isTaxChargeToItem = ref(true);

const content = ref("<p></p>");

const selectedType = computed(() => {
  const rawType = route.query.type;
  return typeof rawType === "string" && rawType.trim() ? rawType : "Product";
});

const typeDescriptions: Record<string, string> = {
  "Onetime Service":
    "Single-scope service delivered once, such as an installation or one-off site visit.",
  Product: "Standard stocked item purchased, stored, and sold as inventory.",
  "Contractual Service":
    "Service sold under a fixed contract period, scope, or maintenance agreement.",
  "Retainer Service":
    "Ongoing advisory or support service billed to reserve team availability over time.",
  "Reccurent Service":
    "Scheduled repeat service delivered on a recurring basis such as monthly cleaning or upkeep.",
  "Produced Product":
    "Item manufactured, assembled, or custom-built internally before delivery.",
  Rental:
    "Reusable asset hired out for a defined time window and then returned to stock.",
};

const pageTitle = computed(
  () =>
    `Add ${selectedType.value === "Retainer Service" ? "Retainer" : selectedType.value}`,
);
const editingItemId = computed(() => {
  const raw = route.query.id;
  return typeof raw === "string" && raw.trim() ? raw : null;
});
const isEditing = computed(() => Boolean(editingItemId.value));
const pageSubtitle = computed(
  () => typeDescriptions[selectedType.value] || "Create a new catalogue item.",
);
const publishButtonLabel = computed(() => "Save");

const itemName = ref("");
const selectedCategory = ref("");
const selectedStatus = ref<CatalogueActiveState>("Active");
const itemImage = ref<string | null>(null);
const itemImageInputRef = ref<HTMLInputElement | null>(null);
const isImageUrlDialogOpen = ref(false);
const imageUrlDraft = ref("");
const relatedItemId = ref(1);
const relatedItems = ref<RelatedItemDraft[]>([]);
const isRelatedItemDialogOpen = ref(false);
const relatedItemDialogMode = ref<"create" | "edit">("create");
const relatedItemEditId = ref<number | null>(null);
const relatedItemName = ref("");
const relatedItemCategory = ref("");
const relatedItemPrice = ref<number | null>(null);
const isRelatedItemChargeTax = ref(true);
const relatedItemDescription = ref("");
const relatedItemErrors = ref({
  name: "",
  category: "",
});
const phaseId = ref(1);
const phases = ref<PhaseDraft[]>([]);
const isPhaseComposerVisible = ref(false);
const phaseComposerMode = ref<"create" | "edit">("create");
const phaseEditId = ref<number | null>(null);
const phaseTitleFieldRef = ref<any>(null);
const phaseName = ref("");
const phasePrice = ref<number | null>(null);
const phaseErrors = ref({
  name: "",
});
const producedOptionId = ref(1);
const producedOptions = ref<ProducedFieldDraft[]>([]);
const producedMeasurementId = ref(1);
const producedMeasurements = ref<ProducedFieldDraft[]>([]);
const rawMaterialId = ref(1);
const rawMaterials = ref<RawMaterialDraft[]>([]);
const producedProductTab = ref<ProducedProductTab>("options");
const producedSubItemId = ref(1);
const producedSubItems = ref<ProducedSubItemDraft[]>([]);
const producedSubItemTabs = ref<Record<number, ProducedProductTab>>({});
const producedSubItemComposer = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  editId: null as number | null,
});
const producedSubItemName = ref("");
const producedSubItemErrors = ref({
  name: "",
});
const producedFieldComposer = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  section: "options" as ProducedFieldSection,
  editId: null as number | null,
  subItemId: null as number | null,
});
const producedFieldName = ref("");
const producedFieldType = ref<CatalogueProducedProductFieldType>("Text");
const producedFieldValuesDraft = ref<string[]>([]);
const producedFieldErrors = ref({
  name: "",
});
const rawMaterialComposer = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  editId: null as number | null,
  subItemId: null as number | null,
});
const rawMaterialName = ref("");
const rawMaterialQty = ref<number | null>(null);
const rawMaterialErrors = ref({
  name: "",
});
const salesTaskId = ref(1);
const salesTasks = ref<SalesTaskDraft[]>([]);
const milestoneFormRef = ref<VForm>();
const goalFormRef = ref<VForm>();
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
const milestoneAfterWhenValue = ref<number | null>(null);
const goalDialog = ref({
  visible: false,
  mode: "create" as "create" | "edit",
  targetId: null as number | null,
  milestoneId: null as number | null,
  draft: {
    name: "",
    dueDate: null as string | null,
    startTrigger: null as CatalogueTaskStartTrigger | null,
    priority: "Normal" as JobConfigPriority,
    note: "",
  },
});
const goalAfterWhenValue = ref<number | null>(null);
const goalAfterWhenPreset = ref<"1_day" | "2_days" | "1_week" | "custom">(
  "1_day",
);
const goalStartMode = ref<"time" | "goal">("time");
const selectedGoalDependencyId = ref<string | null>(null);
const isTaskTemplateDrawerOpen = ref(false);
const taskTemplateDrawerRef = ref<InstanceType<
  typeof CatalogueTaskTemplateDrawer
> | null>(null);
const taskTemplateContext = ref<{
  target: "sales" | "milestone" | "goal";
  parentId: number | null;
  mode: "create" | "edit";
  targetId: number | null;
}>({
  target: "sales",
  parentId: null,
  mode: "create",
  targetId: null,
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
    : ["Active", "Draft", "Non-Active", "Archived"];

  return source.map((state) => ({ title: state, value: state }));
});

const isContractualService = computed(
  () => selectedType.value === "Contractual Service",
);
const isProducedProduct = computed(
  () => selectedType.value === "Produced Product",
);
const isInventoryItem = computed(() => selectedType.value === "Product");
const isRetainerService = computed(
  () => selectedType.value === "Retainer Service",
);
const isReccurentService = computed(
  () => selectedType.value === "Reccurent Service",
);
const usesRecurringLinkedServicesUi = computed(
  () => isRetainerService.value || isReccurentService.value,
);
const relatedSectionTitle = computed(() =>
  isRetainerService.value
    ? "Retainer services"
    : isReccurentService.value
      ? "Reccurent services"
      : "Related items",
);
const relatedButtonLabel = computed(() =>
  isRetainerService.value
    ? "Retainer Service"
    : isReccurentService.value
      ? "Reccurent Service"
      : "Related Item",
);
const shouldShowRetainerCategoryField = computed(
  () => !usesRecurringLinkedServicesUi.value,
);
const shouldShowRetainerChargeTaxField = computed(
  () => !usesRecurringLinkedServicesUi.value,
);
const relatedDialogTitle = computed(() =>
  relatedItemDialogMode.value === "edit"
    ? isRetainerService.value
      ? "Edit Retainer Service"
      : isReccurentService.value
        ? "Edit Reccurent Service"
        : "Edit Related Item"
    : isRetainerService.value
      ? "Add Retainer Service"
      : isReccurentService.value
        ? "Add Reccurent Service"
        : "Add Related Item",
);
const relatedDialogSaveLabel = computed(() =>
  relatedItemDialogMode.value === "edit"
    ? isRetainerService.value
      ? "Save Retainer Service"
      : isReccurentService.value
        ? "Save Reccurent Service"
        : "Save Related Item"
    : isRetainerService.value
      ? "Add Retainer Service"
      : isReccurentService.value
        ? "Add Reccurent Service"
        : "Save Related Item",
);
const retainerLinkedServicesTotalPrice = computed(() =>
  relatedItems.value.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
);

const contractualPhaseTotalPrice = computed(() =>
  phases.value.reduce((sum, phase) => sum + (Number(phase.price) || 0), 0),
);

const producedFieldTypeOptions = [
  { title: "Text", value: "Text" },
  { title: "Number", value: "Number" },
  { title: "Pictures", value: "Pictures" },
  { title: "Select Buttons", value: "Select Buttons" },
  { title: "Note", value: "Note" },
  { title: "Dropdown", value: "Dropdown" },
] satisfies { title: string; value: CatalogueProducedProductFieldType }[];

const producedFieldTypeDescriptions: Record<
  CatalogueProducedProductFieldType,
  string
> = {
  Text: "Short free-text input for a custom production detail.",
  Number: "Numeric input for values like count, depth, or weight.",
  Pictures: "Image upload slot for reference photos or finish previews.",
  "Select Buttons":
    "Quick-pick button choices for a fixed set of production options.",
  Note: "Long-form note area for instructions or fabrication remarks.",
  Dropdown: "Single-select dropdown for a predefined list of values.",
};

const producedFieldComposerTitle = computed(() =>
  producedFieldComposer.value.mode === "edit"
    ? producedFieldComposer.value.section === "options"
      ? "Edit Option"
      : "Edit Measurement"
    : producedFieldComposer.value.section === "options"
      ? "Add Option"
      : "Add Measurement",
);

const shouldShowProducedFieldValues = computed(
  () => producedFieldType.value === "Dropdown",
);

const hasProducedSubItems = computed(() => producedSubItems.value.length > 0);

const cloneProducedFieldDraft = (
  field: ProducedFieldDraft,
): ProducedFieldDraft => ({
  id: field.id,
  name: field.name,
  type: field.type,
  description: field.description,
  values: [...field.values],
});

const cloneRawMaterialDraft = (
  material: RawMaterialDraft,
): RawMaterialDraft => ({
  id: material.id,
  name: material.name,
  qty: material.qty,
});

const cloneProducedSubItemDraft = (
  subItem: ProducedSubItemDraft,
): ProducedSubItemDraft => ({
  id: subItem.id,
  name: subItem.name,
  options: subItem.options.map(cloneProducedFieldDraft),
  rawMaterials: subItem.rawMaterials.map(cloneRawMaterialDraft),
  measurements: subItem.measurements.map(cloneProducedFieldDraft),
});

const serializeProducedField = (field: ProducedFieldDraft) => ({
  id: field.id,
  name: field.name.trim(),
  type: field.type,
  description: field.description.trim(),
  values:
    field.type === "Dropdown"
      ? field.values.map((value) => value.trim()).filter(Boolean)
      : [],
});

const serializeRawMaterial = (material: RawMaterialDraft) => ({
  id: material.id,
  name: material.name.trim(),
  qty:
    material.qty === null || material.qty === undefined
      ? null
      : Number.isFinite(Number(material.qty))
        ? Number(material.qty)
        : null,
});

const setProducedSubItemTab = (
  subItemId: number,
  tab: ProducedProductTab = "options",
) => {
  producedSubItemTabs.value[subItemId] = tab;
};

const clearProducedSubItemTab = (subItemId: number) => {
  delete producedSubItemTabs.value[subItemId];
};

const toProducedSubItemDraft = (
  subItem: CatalogueProducedProductSubItem,
): ProducedSubItemDraft => ({
  id: subItem.id,
  name: subItem.name,
  options: (subItem.options || []).map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type,
    description: field.description,
    values:
      field.type === "Dropdown" && Array.isArray(field.values)
        ? [...field.values]
        : [],
  })),
  rawMaterials: (subItem.rawMaterials || []).map((material) => ({
    id: material.id,
    name: material.name,
    qty: material.qty ?? null,
  })),
  measurements: (subItem.measurements || []).map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type,
    description: field.description,
    values:
      field.type === "Dropdown" && Array.isArray(field.values)
        ? [...field.values]
        : [],
  })),
});

const goalTriggerOptions = computed<TaskTriggerOption[]>(() =>
  jobConfigMilestones.value.flatMap((milestone) =>
    milestone.goals.map((goal) => ({
      title: `${milestone.name} / ${goal.name}`,
      value: `goal:${goal.id}`,
    })),
  ),
);

const currentEditingGoalRef = computed(() =>
  goalDialog.value.mode === "edit" && goalDialog.value.targetId !== null
    ? `goal:${goalDialog.value.targetId}`
    : null,
);

const availableGoalDependencyOptions = computed(() =>
  goalTriggerOptions.value.filter(
    (option) => option.value !== currentEditingGoalRef.value,
  ),
);

const goalStartModeOptions = [
  { title: "After time", value: "time" },
  { title: "After goal completion", value: "goal" },
] as const;

const goalAfterWhenPresetOptions = [
  { title: "After 1 day", value: "1_day" },
  { title: "After 2 days", value: "2_days" },
  { title: "After 1 week", value: "1_week" },
  { title: "Custom", value: "custom" },
] as const;

const buildGoalStartTrigger = (): CatalogueTaskStartTrigger | null => {
  if (goalStartMode.value === "goal") {
    return selectedGoalDependencyId.value
      ? {
          type: "goal",
          goalId: selectedGoalDependencyId.value,
          taskId: null,
        }
      : null;
  }

  return {
    type: "time",
    goalId: null,
    taskId: null,
  };
};

const normalizeStartTrigger = (
  startTrigger?: CatalogueTaskStartTrigger | null,
): CatalogueTaskStartTrigger => {
  if (startTrigger?.type === "goal" || startTrigger?.type === "task") {
    return {
      type: startTrigger.type,
      goalId: startTrigger.goalId ?? null,
      taskId: startTrigger.taskId ?? null,
    };
  }

  return {
    type: "time",
    goalId: null,
    taskId: null,
  };
};

const formatGoalStart = (
  dueDate?: string | null,
  startTrigger?: CatalogueTaskStartTrigger | null,
) => formatTaskStart(dueDate, startTrigger);

const formatTaskStart = (
  afterWhen?: string | null,
  startTrigger?: CatalogueTaskStartTrigger | null,
) => {
  if (startTrigger?.type === "goal" && startTrigger.goalId) {
    const goalId = String(startTrigger.goalId).replace(/^goal:/, "");
    const goal = jobConfigMilestones.value
      .flatMap((milestone) => milestone.goals)
      .find((entry) => String(entry.id) === goalId);

    return goal ? `Goal complete: ${goal.name}` : "After goal completion";
  }

  return `After ${formatTaskAfterWhen(afterWhen)}`;
};

onMounted(() => {
  const activateDeferredSections = () => {
    renderDeferredSections.value = true;
  };

  const idleCallback = (
    window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    }
  ).requestIdleCallback;

  if (idleCallback) {
    idleCallback(activateDeferredSections, { timeout: 200 });
    return;
  }

  requestAnimationFrame(activateDeferredSections);
});

onMounted(() => {
  if (!topActionBarRef.value || typeof IntersectionObserver === "undefined") {
    return;
  }

  topActionBarObserver = new IntersectionObserver(
    ([entry]) => {
      isFloatingActionBarVisible.value = !entry?.isIntersecting;
    },
    {
      threshold: 0.15,
    },
  );

  topActionBarObserver.observe(topActionBarRef.value);
});

onBeforeUnmount(() => {
  topActionBarObserver?.disconnect();
  topActionBarObserver = null;
});

watch(
  defaultMilestoneName,
  (nextName) => {
    const milestone = jobConfigMilestones.value[0];
    if (!milestone || hasCustomMilestoneName.value) return;

    milestone.name = nextName;
  },
  { immediate: true },
);

const openSalesTaskTemplateDrawer = () => {
  taskTemplateContext.value = {
    target: "sales",
    parentId: null,
    mode: "create",
    targetId: null,
  };
  taskTemplateDrawerRef.value?.openWith({
    title: "",
    collaborators: [],
    afterWhen: "+1 day",
    startTrigger: { type: "time", goalId: null, taskId: null },
    notes: "",
    important: false,
    status: "pending",
    attachment: null,
    relatedTo: null,
    steps: [],
  });
};

const openEditSalesTask = (task: SalesTaskDraft) => {
  taskTemplateContext.value = {
    target: "sales",
    parentId: null,
    mode: "edit",
    targetId: task.id,
  };
  taskTemplateDrawerRef.value?.openWith({
    title: task.title,
    collaborators: task.collaborators,
    afterWhen: task.afterWhen,
    startTrigger: task.startTrigger ?? {
      type: "time",
      goalId: null,
      taskId: null,
    },
    notes: task.notes,
    important: task.important,
    status: task.status,
    attachment: task.attachment ?? null,
    relatedTo: task.relatedTo ?? null,
    steps: cloneTaskSteps(task.steps),
  });
};

const removeSalesTask = (taskId: number) => {
  salesTasks.value = salesTasks.value.filter((task) => task.id !== taskId);
};

const findProducedSubItem = (subItemId: number | null) =>
  subItemId === null
    ? null
    : (producedSubItems.value.find((item) => item.id === subItemId) ?? null);

const getProducedFields = (
  section: ProducedFieldSection,
  subItemId: number | null = null,
) => {
  const subItem = findProducedSubItem(subItemId);

  if (subItem) {
    return section === "options" ? subItem.options : subItem.measurements;
  }

  return section === "options"
    ? producedOptions.value
    : producedMeasurements.value;
};

const getRawMaterialCollection = (subItemId: number | null = null) => {
  const subItem = findProducedSubItem(subItemId);

  if (subItem) return subItem.rawMaterials;

  return rawMaterials.value;
};

const producedFieldSectionLabel = (section: ProducedFieldSection) =>
  section === "options" ? "Option" : "Measurement";

const producedFieldTypeDescription = (
  type: CatalogueProducedProductFieldType,
) => producedFieldTypeDescriptions[type];

const formatProducedFieldValues = (field: ProducedFieldDraft) =>
  field.values.join(", ");

const resetProducedFieldDraft = () => {
  producedFieldComposer.value.mode = "create";
  producedFieldComposer.value.editId = null;
  producedFieldComposer.value.subItemId = null;
  producedFieldName.value = "";
  producedFieldType.value = "Text";
  producedFieldValuesDraft.value = [];
  producedFieldErrors.value = {
    name: "",
  };
};

const openProducedFieldComposer = (
  section: ProducedFieldSection,
  subItemId: number | null = null,
) => {
  resetProducedFieldDraft();
  producedFieldComposer.value.section = section;
  producedFieldComposer.value.subItemId = subItemId;
  producedFieldComposer.value.visible = true;
};

const openEditProducedField = (
  section: ProducedFieldSection,
  field: ProducedFieldDraft,
  subItemId: number | null = null,
) => {
  producedFieldComposer.value.visible = true;
  producedFieldComposer.value.mode = "edit";
  producedFieldComposer.value.section = section;
  producedFieldComposer.value.editId = field.id;
  producedFieldComposer.value.subItemId = subItemId;
  producedFieldName.value = field.name;
  producedFieldType.value = field.type;
  producedFieldValuesDraft.value = [...field.values];
  producedFieldErrors.value = {
    name: "",
  };
};

const hideProducedFieldComposer = () => {
  resetProducedFieldDraft();
  producedFieldComposer.value.visible = false;
};

const saveProducedField = () => {
  const trimmedName = producedFieldName.value.trim();

  producedFieldErrors.value = {
    name: trimmedName ? "" : "Name is required",
  };

  if (!trimmedName) return;

  const nextField = {
    id:
      producedFieldComposer.value.editId ??
      (producedFieldComposer.value.section === "options"
        ? producedOptionId.value++
        : producedMeasurementId.value++),
    name: trimmedName,
    type: producedFieldType.value,
    description: producedFieldTypeDescription(producedFieldType.value),
    values:
      producedFieldType.value === "Dropdown"
        ? producedFieldValuesDraft.value
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
        : [],
  } satisfies ProducedFieldDraft;

  const collection = getProducedFields(
    producedFieldComposer.value.section,
    producedFieldComposer.value.subItemId,
  );

  if (
    producedFieldComposer.value.mode === "edit" &&
    producedFieldComposer.value.editId !== null
  ) {
    const existingField = collection.find(
      (field) => field.id === producedFieldComposer.value.editId,
    );

    if (!existingField) return;

    Object.assign(existingField, nextField);
  } else {
    collection.push(nextField);
  }

  hideProducedFieldComposer();
};

const removeProducedField = (
  section: ProducedFieldSection,
  fieldId: number,
  subItemId: number | null = null,
) => {
  const collection = getProducedFields(section, subItemId);
  const fieldIndex = collection.findIndex((field) => field.id === fieldId);

  if (fieldIndex === -1) return;

  collection.splice(fieldIndex, 1);
};

const resetRawMaterialDraft = () => {
  rawMaterialComposer.value.mode = "create";
  rawMaterialComposer.value.editId = null;
  rawMaterialComposer.value.subItemId = null;
  rawMaterialName.value = "";
  rawMaterialQty.value = null;
  rawMaterialErrors.value = {
    name: "",
  };
};

const openRawMaterialComposer = (subItemId: number | null = null) => {
  resetRawMaterialDraft();
  rawMaterialComposer.value.subItemId = subItemId;
  rawMaterialComposer.value.visible = true;
};

const openEditRawMaterial = (
  material: RawMaterialDraft,
  subItemId: number | null = null,
) => {
  rawMaterialComposer.value.visible = true;
  rawMaterialComposer.value.mode = "edit";
  rawMaterialComposer.value.editId = material.id;
  rawMaterialComposer.value.subItemId = subItemId;
  rawMaterialName.value = material.name;
  rawMaterialQty.value = material.qty;
  rawMaterialErrors.value = {
    name: "",
  };
};

const hideRawMaterialComposer = () => {
  resetRawMaterialDraft();
  rawMaterialComposer.value.visible = false;
};

const saveRawMaterial = () => {
  const trimmedName = rawMaterialName.value.trim();

  rawMaterialErrors.value = {
    name: trimmedName ? "" : "Name is required",
  };

  if (!trimmedName) return;

  const nextMaterial = {
    id: rawMaterialComposer.value.editId ?? rawMaterialId.value++,
    name: trimmedName,
    qty:
      rawMaterialQty.value === null || rawMaterialQty.value === undefined
        ? null
        : Number.isFinite(Number(rawMaterialQty.value))
          ? Number(rawMaterialQty.value)
          : null,
  } satisfies RawMaterialDraft;

  const collection = getRawMaterialCollection(
    rawMaterialComposer.value.subItemId,
  );

  if (
    rawMaterialComposer.value.mode === "edit" &&
    rawMaterialComposer.value.editId !== null
  ) {
    const existingMaterial = collection.find(
      (material) => material.id === rawMaterialComposer.value.editId,
    );

    if (!existingMaterial) return;

    Object.assign(existingMaterial, nextMaterial);
  } else {
    collection.push(nextMaterial);
  }

  hideRawMaterialComposer();
};

const removeRawMaterial = (
  materialId: number,
  subItemId: number | null = null,
) => {
  const collection = getRawMaterialCollection(subItemId);
  const materialIndex = collection.findIndex(
    (material) => material.id === materialId,
  );

  if (materialIndex === -1) return;

  collection.splice(materialIndex, 1);
};

const resetProducedSubItemDraft = () => {
  producedSubItemComposer.value.mode = "create";
  producedSubItemComposer.value.editId = null;
  producedSubItemName.value = "";
  producedSubItemErrors.value = {
    name: "",
  };
};

const openProducedSubItemComposer = () => {
  resetProducedSubItemDraft();
  producedSubItemComposer.value.visible = true;
};

const openEditProducedSubItem = (subItem: ProducedSubItemDraft) => {
  producedSubItemComposer.value.visible = true;
  producedSubItemComposer.value.mode = "edit";
  producedSubItemComposer.value.editId = subItem.id;
  producedSubItemName.value = subItem.name;
  producedSubItemErrors.value = {
    name: "",
  };
};

const hideProducedSubItemComposer = () => {
  resetProducedSubItemDraft();
  producedSubItemComposer.value.visible = false;
};

const saveProducedSubItem = () => {
  const trimmedName = producedSubItemName.value.trim();

  producedSubItemErrors.value = {
    name: trimmedName ? "" : "Name is required",
  };

  if (!trimmedName) return;

  const nextSubItem = {
    id: producedSubItemComposer.value.editId ?? producedSubItemId.value++,
    name: trimmedName,
    options: [] as ProducedFieldDraft[],
    rawMaterials: [] as RawMaterialDraft[],
    measurements: [] as ProducedFieldDraft[],
  } satisfies ProducedSubItemDraft;

  if (
    producedSubItemComposer.value.mode === "edit" &&
    producedSubItemComposer.value.editId !== null
  ) {
    const existingSubItem = producedSubItems.value.find(
      (subItem) => subItem.id === producedSubItemComposer.value.editId,
    );

    if (!existingSubItem) return;

    existingSubItem.name = nextSubItem.name;
    hideProducedSubItemComposer();
    return;
  }

  if (!producedSubItems.value.length) {
    nextSubItem.options = producedOptions.value.map(cloneProducedFieldDraft);
    nextSubItem.rawMaterials = rawMaterials.value.map(cloneRawMaterialDraft);
    nextSubItem.measurements = producedMeasurements.value.map(
      cloneProducedFieldDraft,
    );
    producedOptions.value = [];
    producedMeasurements.value = [];
    rawMaterials.value = [];

    if (
      producedFieldComposer.value.visible &&
      producedFieldComposer.value.subItemId === null
    ) {
      hideProducedFieldComposer();
    }

    if (
      rawMaterialComposer.value.visible &&
      rawMaterialComposer.value.subItemId === null
    ) {
      hideRawMaterialComposer();
    }
  }

  producedSubItems.value.push(nextSubItem);
  setProducedSubItemTab(nextSubItem.id);
  hideProducedSubItemComposer();
};

const removeProducedSubItem = (subItemId: number) => {
  const subItemIndex = producedSubItems.value.findIndex(
    (subItem) => subItem.id === subItemId,
  );

  if (subItemIndex === -1) return;

  const [removedSubItem] = producedSubItems.value.splice(subItemIndex, 1);
  clearProducedSubItemTab(subItemId);

  if (!producedSubItems.value.length && removedSubItem) {
    producedOptions.value = removedSubItem.options.map(cloneProducedFieldDraft);
    producedMeasurements.value = removedSubItem.measurements.map(
      cloneProducedFieldDraft,
    );
    rawMaterials.value = removedSubItem.rawMaterials.map(cloneRawMaterialDraft);
  }

  if (producedFieldComposer.value.subItemId === subItemId) {
    hideProducedFieldComposer();
  }

  if (rawMaterialComposer.value.subItemId === subItemId) {
    hideRawMaterialComposer();
  }

  if (producedSubItemComposer.value.editId === subItemId) {
    hideProducedSubItemComposer();
  }
};

const resetRelatedItemDraft = () => {
  relatedItemDialogMode.value = "create";
  relatedItemEditId.value = null;
  relatedItemName.value = "";
  relatedItemCategory.value = "";
  relatedItemPrice.value = null;
  isRelatedItemChargeTax.value = true;
  relatedItemDescription.value = "";
  relatedItemErrors.value = {
    name: "",
    category: "",
  };
};

const openRelatedItemDialog = () => {
  resetRelatedItemDraft();
  isRelatedItemDialogOpen.value = true;
};

const openEditRelatedItemDialog = (item: RelatedItemDraft) => {
  relatedItemDialogMode.value = "edit";
  relatedItemEditId.value = item.id;
  relatedItemName.value = item.name;
  relatedItemCategory.value = usesRecurringLinkedServicesUi.value
    ? ""
    : item.category;
  relatedItemPrice.value = item.price;
  isRelatedItemChargeTax.value = usesRecurringLinkedServicesUi.value
    ? false
    : item.chargeTax;
  relatedItemDescription.value = item.description;
  relatedItemErrors.value = {
    name: "",
    category: "",
  };
  isRelatedItemDialogOpen.value = true;
};

const saveRelatedItem = () => {
  const trimmedName = relatedItemName.value.trim();
  const trimmedCategory = usesRecurringLinkedServicesUi.value
    ? ""
    : relatedItemCategory.value.trim();

  relatedItemErrors.value = {
    name: trimmedName ? "" : "Title is required",
    category:
      usesRecurringLinkedServicesUi.value || trimmedCategory
        ? ""
        : "Category is required",
  };

  if (
    !trimmedName ||
    (!usesRecurringLinkedServicesUi.value && !trimmedCategory)
  )
    return;

  const nextItem = {
    id: relatedItemEditId.value ?? relatedItemId.value++,
    name: trimmedName,
    category: trimmedCategory,
    price:
      relatedItemPrice.value === null || relatedItemPrice.value === undefined
        ? null
        : Number.isFinite(Number(relatedItemPrice.value))
          ? Number(relatedItemPrice.value)
          : null,
    chargeTax: usesRecurringLinkedServicesUi.value
      ? false
      : isRelatedItemChargeTax.value,
    description: relatedItemDescription.value.trim(),
  };

  if (
    relatedItemDialogMode.value === "edit" &&
    relatedItemEditId.value !== null
  ) {
    const existingItem = relatedItems.value.find(
      (item) => item.id === relatedItemEditId.value,
    );

    if (!existingItem) return;

    Object.assign(existingItem, nextItem);
  } else {
    relatedItems.value.push(nextItem);
  }

  if (usesRecurringLinkedServicesUi.value) syncLinkedServiceGoals();

  isRelatedItemDialogOpen.value = false;
  resetRelatedItemDraft();
};

const removeRelatedItem = (itemId: number) => {
  relatedItems.value = relatedItems.value.filter((item) => item.id !== itemId);
  if (usesRecurringLinkedServicesUi.value) syncLinkedServiceGoals();
};

const resetPhaseDraft = () => {
  phaseComposerMode.value = "create";
  phaseEditId.value = null;
  phaseName.value = "";
  phasePrice.value = null;
  phaseErrors.value = {
    name: "",
  };
};

const showPhaseComposer = () => {
  resetPhaseDraft();
  isPhaseComposerVisible.value = true;

  nextTick(() => {
    const input =
      phaseTitleFieldRef.value?.$el?.querySelector?.("input") ||
      phaseTitleFieldRef.value?.querySelector?.("input");

    input?.focus();
  });
};

const openEditPhase = (phase: PhaseDraft) => {
  phaseComposerMode.value = "edit";
  phaseEditId.value = phase.id;
  phaseName.value = phase.name;
  phasePrice.value = phase.price;
  phaseErrors.value = {
    name: "",
  };
  isPhaseComposerVisible.value = true;

  nextTick(() => {
    const input =
      phaseTitleFieldRef.value?.$el?.querySelector?.("input") ||
      phaseTitleFieldRef.value?.querySelector?.("input");

    input?.focus();
  });
};

const hidePhaseComposer = () => {
  resetPhaseDraft();
  isPhaseComposerVisible.value = false;
};

const savePhase = () => {
  const trimmedName = phaseName.value.trim();

  phaseErrors.value = {
    name: trimmedName ? "" : "Title is required",
  };

  if (!trimmedName) return;

  const nextPhase = {
    id: phaseEditId.value ?? phaseId.value++,
    name: trimmedName,
    price:
      phasePrice.value === null || phasePrice.value === undefined
        ? null
        : Number.isFinite(Number(phasePrice.value))
          ? Number(phasePrice.value)
          : null,
  };

  if (phaseComposerMode.value === "edit" && phaseEditId.value !== null) {
    const existingPhase = phases.value.find(
      (phase) => phase.id === phaseEditId.value,
    );

    if (!existingPhase) return;

    Object.assign(existingPhase, nextPhase);
  } else {
    phases.value.push(nextPhase);
  }

  hidePhaseComposer();
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

const formatTaskAfterWhen = (value?: string | null) => value || "--";

const parseAfterWhenValue = (value?: string | null) => {
  const trimmedValue = String(value ?? "").trim();
  if (!trimmedValue) return null;

  const relativeMatch = trimmedValue.match(
    /^\+?\s*(\d+)\s+(day|days|week|weeks|month|months)$/i,
  );
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();

    if (unit.startsWith("week")) return amount * 7;
    if (unit.startsWith("month")) return amount * 30;
    return amount;
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfTarget = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  );
  const diffInDays = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );

  return diffInDays > 0 ? diffInDays : null;
};

const buildAfterWhenValue = (value?: number | null) => {
  const numericValue =
    value === null || value === undefined ? NaN : Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const roundedValue = Math.floor(numericValue);

  return `+${roundedValue} ${roundedValue === 1 ? "day" : "days"}`;
};

const addAfterWhenDays = (
  target: typeof milestoneAfterWhenValue | typeof goalAfterWhenValue,
  days: number,
) => {
  const currentValue =
    target.value === null || target.value === undefined
      ? 0
      : Number(target.value);
  const safeCurrentValue = Number.isFinite(currentValue)
    ? Math.max(0, Math.floor(currentValue))
    : 0;

  target.value = safeCurrentValue + days;
};

const addMilestoneAfterWhenDays = (days: number) => {
  addAfterWhenDays(milestoneAfterWhenValue, days);
};

const normalizeJobTaskStatus = (
  status?: string | null,
): JobConfigTaskStatus => {
  if (
    status === "in_progress" ||
    status === "for_review" ||
    status === "completed"
  ) {
    return status;
  }

  return "pending";
};

const cloneTaskSteps = (taskSteps?: ToDoStep[] | null): ToDoStep[] => {
  if (!Array.isArray(taskSteps)) return [];

  return taskSteps.map((step, index) => ({
    id: step.id ?? index + 1,
    title: String(step.title ?? "").trim(),
    collaborators: Array.isArray(step.collaborators)
      ? step.collaborators.map((collaborator) => ({
          id: collaborator.id,
          name: String(collaborator.name ?? "").trim(),
          avatarUrl: collaborator.avatarUrl ?? null,
        }))
      : [],
    dueAt: step.dueAt,
    priority:
      step.priority === "low" ||
      step.priority === "normal" ||
      step.priority === "high"
        ? step.priority
        : undefined,
    status: normalizeJobTaskStatus(step.status),
    notes: String(step.notes ?? "").trim(),
    createdAt: step.createdAt ?? new Date().toISOString(),
    updatedAt: step.updatedAt ?? new Date().toISOString(),
  }));
};

const serializeTaskTemplate = (
  task: Partial<JobConfigTask>,
): JobConfigTask => ({
  id: task.id ?? 0,
  title: String(task.title ?? "").trim(),
  collaborators: Array.isArray(task.collaborators)
    ? task.collaborators.map((collaborator) => ({
        id: collaborator.id,
        name: collaborator.name,
        avatarUrl: collaborator.avatarUrl ?? null,
      }))
    : [],
  afterWhen:
    (
      task as Partial<JobConfigTask> & {
        dueAt?: string | null;
      }
    ).afterWhen ??
    (
      task as Partial<JobConfigTask> & {
        dueAt?: string | null;
      }
    ).dueAt ??
    null,
  startTrigger: normalizeStartTrigger(task.startTrigger),
  manhours: task.manhours ?? null,
  notes: String(task.notes ?? "").trim(),
  status: normalizeJobTaskStatus(task.status),
  important: Boolean(task.important),
  attachment: task.attachment ?? null,
  relatedTo: task.relatedTo ?? null,
  steps: cloneTaskSteps(task.steps),
});

const resetMilestoneDraft = () => {
  milestoneDialog.value.targetId = null;
  milestoneDialog.value.draft = {
    name: "",
    dueDate: null,
    priority: "Normal",
    note: "",
  };
  milestoneAfterWhenValue.value = null;
};

const resetGoalDraft = () => {
  goalDialog.value.targetId = null;
  goalDialog.value.milestoneId = null;
  goalDialog.value.draft = {
    name: "",
    dueDate: null,
    startTrigger: null,
    priority: "Normal",
    note: "",
  };
  goalStartMode.value = "time";
  selectedGoalDependencyId.value = null;
  goalAfterWhenPreset.value = "1_day";
  goalAfterWhenValue.value = null;
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
      startTrigger: existingGoal?.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      dueDate: existingGoal?.dueDate ?? null,
      priority: existingGoal?.priority ?? "Normal",
      note: existingGoal?.note ?? "",
      tasks: existingGoal?.tasks ? [...existingGoal.tasks] : [],
    } satisfies JobConfigGoal;
  });

  milestone.goals = [...manualGoals, ...phaseGoals];
  syncExpandedGoals();
};

const syncLinkedServiceGoals = () => {
  if (!usesRecurringLinkedServicesUi.value) return;

  const milestone = jobConfigMilestones.value[0];
  if (!milestone) return;

  const manualGoals = milestone.goals.filter((goal) =>
    isRetainerService.value
      ? !goal.retainerServiceId
      : !goal.reccurentServiceId,
  );
  const linkedServiceGoals = relatedItems.value.map((service) => {
    const existingGoal = milestone.goals.find(
      (goal) =>
        (isRetainerService.value
          ? goal.retainerServiceId === service.id
          : goal.reccurentServiceId === service.id) ||
        ((isRetainerService.value
          ? goal.retainerServiceId === null ||
            goal.retainerServiceId === undefined
          : goal.reccurentServiceId === null ||
            goal.reccurentServiceId === undefined) &&
          goal.name === service.name),
    );

    return {
      id: existingGoal?.id ?? jobConfigGoalId.value++,
      milestoneId: milestone.id,
      retainerServiceId: isRetainerService.value ? service.id : null,
      reccurentServiceId: isReccurentService.value ? service.id : null,
      name: service.name,
      startTrigger: existingGoal?.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      dueDate: existingGoal?.dueDate ?? null,
      priority: existingGoal?.priority ?? "Normal",
      note: service.description,
      tasks: existingGoal?.tasks ? [...existingGoal.tasks] : [],
    } satisfies JobConfigGoal;
  });

  milestone.goals = [...manualGoals, ...linkedServiceGoals];
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
  milestoneAfterWhenValue.value = parseAfterWhenValue(milestone.dueDate);
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
    milestone.dueDate = buildAfterWhenValue(milestoneAfterWhenValue.value);
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
  goalStartMode.value = "time";
  selectedGoalDependencyId.value = null;
  goalAfterWhenPreset.value = "1_day";
  goalAfterWhenValue.value = null;
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
    startTrigger: goal.startTrigger ?? {
      type: "time",
      goalId: null,
      taskId: null,
    },
    priority: goal.priority,
    note: goal.note,
  };
  goalStartMode.value = goal.startTrigger?.type === "goal" ? "goal" : "time";
  selectedGoalDependencyId.value = goal.startTrigger?.goalId
    ? String(goal.startTrigger.goalId)
    : null;
  goalAfterWhenValue.value = parseAfterWhenValue(goal.dueDate);
  goalAfterWhenPreset.value =
    goalAfterWhenValue.value === 1
      ? "1_day"
      : goalAfterWhenValue.value === 2
        ? "2_days"
        : goalAfterWhenValue.value === 7
          ? "1_week"
          : "custom";
  nextTick(() => goalFormRef.value?.resetValidation());
};

const saveGoal = async () => {
  const result = await goalFormRef.value?.validate();
  if (!result?.valid || goalDialog.value.milestoneId === null) return;
  if (goalStartMode.value === "goal" && !selectedGoalDependencyId.value) return;

  const resolvedGoalAfterWhenValue =
    goalAfterWhenPreset.value === "1_day"
      ? 1
      : goalAfterWhenPreset.value === "2_days"
        ? 2
        : goalAfterWhenPreset.value === "1_week"
          ? 7
          : goalAfterWhenValue.value;

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
      goal.dueDate =
        goalStartMode.value === "time"
          ? buildAfterWhenValue(resolvedGoalAfterWhenValue)
          : null;
      goal.startTrigger = buildGoalStartTrigger();
      goal.priority = draft.priority;
      goal.note = draft.note.trim();
    }
  } else {
    milestone.goals.push({
      id: jobConfigGoalId.value++,
      milestoneId: milestone.id,
      name: draft.name.trim(),
      dueDate:
        goalStartMode.value === "time"
          ? buildAfterWhenValue(resolvedGoalAfterWhenValue)
          : null,
      startTrigger: buildGoalStartTrigger(),
      priority: draft.priority,
      note: draft.note.trim(),
      tasks: [],
      retainerServiceId: null,
      reccurentServiceId: null,
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
  taskTemplateContext.value = {
    target: "milestone",
    parentId: milestoneId,
    mode: "create",
    targetId: null,
  };
  expandedMilestones.value = [
    ...new Set([...expandedMilestones.value, milestoneId]),
  ];
  taskTemplateDrawerRef.value?.openWith({
    title: "",
    collaborators: [],
    notes: "",
    important: false,
    status: "pending",
    afterWhen: "+1 day",
    startTrigger: { type: "time", goalId: null, taskId: null },
    attachment: null,
    relatedTo: null,
    milestoneId,
    steps: [],
  });
};

const openCreateTaskForGoal = (goalId: number) => {
  taskTemplateContext.value = {
    target: "goal",
    parentId: goalId,
    mode: "create",
    targetId: null,
  };
  expandedGoals.value = [...new Set([...expandedGoals.value, goalId])];
  taskTemplateDrawerRef.value?.openWith({
    title: "",
    collaborators: [],
    notes: "",
    important: false,
    status: "pending",
    afterWhen: "+1 day",
    startTrigger: { type: "time", goalId: null, taskId: null },
    attachment: null,
    relatedTo: null,
    goalId,
    steps: [],
  });
};

const openEditTaskForMilestone = (milestoneId: number, task: JobConfigTask) => {
  taskTemplateContext.value = {
    target: "milestone",
    parentId: milestoneId,
    mode: "edit",
    targetId: task.id,
  };
  taskTemplateDrawerRef.value?.openWith({
    title: task.title,
    collaborators: task.collaborators,
    afterWhen: task.afterWhen,
    startTrigger: task.startTrigger ?? {
      type: "time",
      goalId: null,
      taskId: null,
    },
    notes: task.notes,
    status: task.status,
    important: task.important,
    attachment: task.attachment ?? null,
    relatedTo: task.relatedTo ?? null,
    steps: cloneTaskSteps(task.steps),
  });
};

const openEditTaskForGoal = (goalId: number, task: JobConfigTask) => {
  taskTemplateContext.value = {
    target: "goal",
    parentId: goalId,
    mode: "edit",
    targetId: task.id,
  };
  taskTemplateDrawerRef.value?.openWith({
    title: task.title,
    collaborators: task.collaborators,
    afterWhen: task.afterWhen,
    startTrigger: task.startTrigger ?? {
      type: "time",
      goalId: null,
      taskId: null,
    },
    notes: task.notes,
    status: task.status,
    important: task.important,
    attachment: task.attachment ?? null,
    relatedTo: task.relatedTo ?? null,
    steps: cloneTaskSteps(task.steps),
  });
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

const handleTaskTemplateCreated = (
  task: Partial<ToDo> & {
    afterWhen?: string | null;
    startTrigger?: CatalogueTaskStartTrigger | null;
  },
) => {
  const title = String(task.title ?? "").trim();

  if (!title) return;

  const draftTask: JobConfigTask = {
    id: taskTemplateContext.value.targetId ?? jobConfigTaskId.value++,
    title,
    collaborators: Array.isArray(task.collaborators)
      ? task.collaborators.map((collaborator) => ({ ...collaborator }))
      : [],
    afterWhen:
      (
        task as Partial<ToDo> & {
          afterWhen?: string | null;
          dueAt?: string | null;
        }
      ).afterWhen ??
      (
        task as Partial<ToDo> & {
          dueAt?: string | null;
        }
      ).dueAt ??
      null,
    startTrigger:
      task.startTrigger?.type === "goal" || task.startTrigger?.type === "task"
        ? {
            type: task.startTrigger.type,
            goalId: task.startTrigger.goalId ?? null,
            taskId: task.startTrigger.taskId ?? null,
          }
        : { type: "time", goalId: null, taskId: null },
    manhours: null,
    notes: String(task.notes ?? "").trim(),
    status:
      task.status === "in_progress" ||
      task.status === "for_review" ||
      task.status === "completed"
        ? task.status
        : "pending",
    important: Boolean(task.important),
    attachment: task.attachment
      ? {
          type: task.attachment.type,
          name: task.attachment.name,
          url: task.attachment.url ?? null,
          fileKey: task.attachment.fileKey ?? null,
        }
      : null,
    relatedTo: task.relatedTo
      ? {
          id: task.relatedTo.id,
          name: task.relatedTo.name,
          type: task.relatedTo.type,
        }
      : null,
    steps: Array.isArray(task.steps)
      ? task.steps.map((step, index) => ({
          id: Number(step.id ?? index + 1),
          title: String(step.title ?? "").trim(),
          collaborators: Array.isArray(step.collaborators)
            ? step.collaborators.map((collaborator) => ({ ...collaborator }))
            : [],
          dueAt: String(step.dueAt ?? "").trim(),
          priority: step.priority,
          status:
            step.status === "in_progress" ||
            step.status === "for_review" ||
            step.status === "completed"
              ? step.status
              : "pending",
          notes: String(step.notes ?? "").trim(),
          createdAt: step.createdAt ?? new Date().toISOString(),
          updatedAt: step.updatedAt ?? new Date().toISOString(),
        }))
      : [],
  };

  if (taskTemplateContext.value.target === "sales") {
    if (
      taskTemplateContext.value.mode === "edit" &&
      taskTemplateContext.value.targetId !== null
    ) {
      const existingTask = salesTasks.value.find(
        (entry) => entry.id === taskTemplateContext.value.targetId,
      );
      if (!existingTask) return;

      Object.assign(existingTask, draftTask);
    } else {
      salesTasks.value.push({
        ...draftTask,
        id: salesTaskId.value++,
      });
    }

    return;
  }

  if (taskTemplateContext.value.target === "milestone") {
    const milestone = jobConfigMilestones.value.find(
      (entry) => entry.id === taskTemplateContext.value.parentId,
    );
    if (!milestone) return;

    if (
      taskTemplateContext.value.mode === "edit" &&
      taskTemplateContext.value.targetId !== null
    ) {
      const existingTask = milestone.tasks.find(
        (entry) => entry.id === taskTemplateContext.value.targetId,
      );
      if (!existingTask) return;

      Object.assign(existingTask, draftTask);
    } else {
      milestone.tasks.push(draftTask);
    }
    return;
  }

  const milestone = jobConfigMilestones.value.find((entry) =>
    entry.goals.some((goal) => goal.id === taskTemplateContext.value.parentId),
  );
  const goal = milestone?.goals.find(
    (entry) => entry.id === taskTemplateContext.value.parentId,
  );
  if (!goal) return;

  if (
    taskTemplateContext.value.mode === "edit" &&
    taskTemplateContext.value.targetId !== null
  ) {
    const existingTask = goal.tasks.find(
      (entry) => entry.id === taskTemplateContext.value.targetId,
    );
    if (!existingTask) return;

    Object.assign(existingTask, draftTask);
  } else {
    goal.tasks.push(draftTask);
  }
  syncExpandedGoals();
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
  itemBestPrice.value = record.bestPrice ?? null;
  inventoryQty.value = "qty" in record ? (record.qty ?? null) : null;
  isTaxChargeToItem.value = record.chargeTax ?? true;
  itemImage.value = record.image ?? null;
  content.value = record.description
    ? `<p>${record.description}</p>`
    : "<p></p>";
  relatedItems.value = [];
  relatedItemId.value = 1;
  producedOptions.value = [];
  producedOptionId.value = 1;
  producedMeasurements.value = [];
  producedMeasurementId.value = 1;
  rawMaterials.value = [];
  rawMaterialId.value = 1;
  producedProductTab.value = "options";
  producedSubItems.value = [];
  producedSubItemId.value = 1;
  producedSubItemTabs.value = {};
  hideProducedSubItemComposer();
  hideProducedFieldComposer();
  hideRawMaterialComposer();
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
    | CatalogueRetainerServiceRecord
    | CatalogueReccurentServiceRecord,
) => {
  applySharedRecord(record);
  if (record.type === "Onetime Service") {
    relatedItems.value = (record.relatedItems || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price ?? null,
      chargeTax: item.chargeTax ?? true,
      description: item.description,
    }));
    relatedItemId.value =
      relatedItems.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    phases.value = [];
    phaseId.value = 1;
    isPhaseComposerVisible.value = false;
  } else if (
    record.type === "Retainer Service" ||
    record.type === "Reccurent Service"
  ) {
    const linkedServices =
      record.type === "Retainer Service"
        ? record.retainerServices || []
        : record.reccurentServices || [];

    relatedItems.value = linkedServices.map((item) => ({
      id: item.id,
      name: item.name,
      category: "",
      price: item.price ?? null,
      chargeTax: false,
      description: item.description,
    }));
    relatedItemId.value =
      relatedItems.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    phases.value = [];
    phaseId.value = 1;
    isPhaseComposerVisible.value = false;
  } else {
    phases.value = (record.phases || []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      price: phase.price ?? null,
    }));
    phaseId.value =
      phases.value.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    isPhaseComposerVisible.value = false;
    relatedItems.value = [];
    relatedItemId.value = 1;
    syncContractualPhaseGoals();
  }

  salesTasks.value = (record.salesTasks || []).map((task) => ({
    id: task.id,
    title: task.title,
    collaborators: task.collaborators ? [...task.collaborators] : [],
    afterWhen:
      (
        task as {
          afterWhen?: string | null;
          dueAt?: string | null;
        }
      ).afterWhen ??
      (task as { dueAt?: string | null }).dueAt ??
      null,
    startTrigger: normalizeStartTrigger(task.startTrigger),
    manhours: task.manhours ?? null,
    notes: task.notes ?? "",
    status: task.status ?? "pending",
    important: task.important ?? false,
    attachment: task.attachment ?? null,
    relatedTo: task.relatedTo ?? null,
    steps: cloneTaskSteps(task.steps),
  }));
  salesTaskId.value =
    salesTasks.value.reduce((max, task) => Math.max(max, task.id), 0) + 1;

  const milestones: JobConfigMilestone[] = record.jobConfiguration?.milestones
    ?.length
    ? record.jobConfiguration.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note,
        tasks: (milestone.tasks || []).map((task) => ({
          ...task,
          afterWhen:
            (
              task as {
                afterWhen?: string | null;
                dueAt?: string | null;
              }
            ).afterWhen ??
            (task as { dueAt?: string | null }).dueAt ??
            null,
          startTrigger: normalizeStartTrigger(task.startTrigger),
          steps: cloneTaskSteps(task.steps),
        })),
        goals: (milestone.goals || []).map((goal) => ({
          ...goal,
          retainerServiceId: goal.retainerServiceId ?? null,
          reccurentServiceId: goal.reccurentServiceId ?? null,
          startTrigger: normalizeStartTrigger(goal.startTrigger),
          tasks: (goal.tasks || []).map((task) => ({
            ...task,
            afterWhen:
              (
                task as {
                  afterWhen?: string | null;
                  dueAt?: string | null;
                }
              ).afterWhen ??
              (task as { dueAt?: string | null }).dueAt ??
              null,
            startTrigger: normalizeStartTrigger(task.startTrigger),
            steps: cloneTaskSteps(task.steps),
          })),
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
  if (
    record.type === "Retainer Service" ||
    record.type === "Reccurent Service"
  ) {
    syncLinkedServiceGoals();
  }
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

const applyProducedProductRecord = (record: CatalogueProducedProductRecord) => {
  applySharedRecord(record);
  producedSubItems.value = (record.subItems || []).map(toProducedSubItemDraft);
  producedSubItemTabs.value = Object.fromEntries(
    producedSubItems.value.map((subItem) => [subItem.id, "options"]),
  );
  producedSubItemId.value =
    producedSubItems.value.reduce(
      (max, subItem) => Math.max(max, subItem.id),
      0,
    ) + 1;

  if (producedSubItems.value.length) {
    producedOptions.value = [];
    rawMaterials.value = [];
    producedMeasurements.value = [];
  } else {
    producedOptions.value = (record.options || []).map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      description: field.description,
      values:
        field.type === "Dropdown" && Array.isArray(field.values)
          ? [...field.values]
          : [],
    }));
    rawMaterials.value = (record.rawMaterials || []).map((material) => ({
      id: material.id,
      name: material.name,
      qty: material.qty ?? null,
    }));
    producedMeasurements.value = (record.measurements || []).map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      description: field.description,
      values:
        field.type === "Dropdown" && Array.isArray(field.values)
          ? [...field.values]
          : [],
    }));
  }

  producedOptionId.value =
    Math.max(
      0,
      ...producedOptions.value.map((field) => field.id),
      ...producedSubItems.value.flatMap((subItem) =>
        subItem.options.map((field) => field.id),
      ),
    ) + 1;
  rawMaterialId.value =
    Math.max(
      0,
      ...rawMaterials.value.map((material) => material.id),
      ...producedSubItems.value.flatMap((subItem) =>
        subItem.rawMaterials.map((material) => material.id),
      ),
    ) + 1;
  producedMeasurementId.value =
    Math.max(
      0,
      ...producedMeasurements.value.map((field) => field.id),
      ...producedSubItems.value.flatMap((subItem) =>
        subItem.measurements.map((field) => field.id),
      ),
    ) + 1;

  salesTasks.value = (record.salesTasks || []).map((task) => ({
    id: task.id,
    title: task.title,
    collaborators: task.collaborators ? [...task.collaborators] : [],
    afterWhen:
      (
        task as {
          afterWhen?: string | null;
          dueAt?: string | null;
        }
      ).afterWhen ??
      (task as { dueAt?: string | null }).dueAt ??
      null,
    startTrigger: normalizeStartTrigger(task.startTrigger),
    manhours: task.manhours ?? null,
    notes: task.notes ?? "",
    status: task.status ?? "pending",
    important: task.important ?? false,
    attachment: task.attachment ?? null,
    relatedTo: task.relatedTo ?? null,
    steps: cloneTaskSteps(task.steps),
  }));
  salesTaskId.value =
    salesTasks.value.reduce((max, task) => Math.max(max, task.id), 0) + 1;

  const milestones: JobConfigMilestone[] = record.jobConfiguration?.milestones
    ?.length
    ? record.jobConfiguration.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        dueDate: milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note,
        tasks: (milestone.tasks || []).map((task) => ({
          ...task,
          afterWhen:
            (
              task as {
                afterWhen?: string | null;
                dueAt?: string | null;
              }
            ).afterWhen ??
            (task as { dueAt?: string | null }).dueAt ??
            null,
          startTrigger: normalizeStartTrigger(task.startTrigger),
          steps: cloneTaskSteps(task.steps),
        })),
        goals: (milestone.goals || []).map((goal) => ({
          ...goal,
          retainerServiceId: goal.retainerServiceId ?? null,
          reccurentServiceId: goal.reccurentServiceId ?? null,
          startTrigger: normalizeStartTrigger(goal.startTrigger),
          tasks: (goal.tasks || []).map((task) => ({
            ...task,
            afterWhen:
              (
                task as {
                  afterWhen?: string | null;
                  dueAt?: string | null;
                }
              ).afterWhen ??
              (task as { dueAt?: string | null }).dueAt ??
              null,
            startTrigger: normalizeStartTrigger(task.startTrigger),
            steps: cloneTaskSteps(task.steps),
          })),
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
  itemBestPrice.value = null;
  inventoryQty.value = null;
  isTaxChargeToItem.value = true;
  itemImage.value = null;
  imageUrlDraft.value = "";
  content.value = "<p></p>";
  relatedItems.value = [];
  relatedItemId.value = 1;
  producedOptions.value = [];
  producedOptionId.value = 1;
  producedMeasurements.value = [];
  producedMeasurementId.value = 1;
  rawMaterials.value = [];
  rawMaterialId.value = 1;
  producedProductTab.value = "options";
  producedSubItems.value = [];
  producedSubItemId.value = 1;
  producedSubItemTabs.value = {};
  hideProducedSubItemComposer();
  hideProducedFieldComposer();
  hideRawMaterialComposer();
  phases.value = [];
  phaseId.value = 1;
  isPhaseComposerVisible.value = false;
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

const saveItem = async () => {
  const validation = await itemFormRef.value?.validate();
  if (validation && !validation.valid) return;

  const payload = {
    type: selectedType.value as CatalogueItemType,
    name: itemName.value.trim(),
    category: selectedCategory.value.trim() || "Uncategorized",
    activeState: selectedStatus.value,
    image: itemImage.value?.trim() || null,
    bestPrice: isContractualService.value
      ? contractualPhaseTotalPrice.value
      : itemBestPrice.value === null || itemBestPrice.value === undefined
        ? null
        : Number.isFinite(Number(itemBestPrice.value))
          ? Number(itemBestPrice.value)
          : null,
    qty: isInventoryItem.value
      ? inventoryQty.value === null || inventoryQty.value === undefined
        ? 0
        : Number.isFinite(Number(inventoryQty.value))
          ? Number(inventoryQty.value)
          : 0
      : undefined,
    chargeTax: isTaxChargeToItem.value,
    description: stripRichText(content.value),
    relatedItems:
      isContractualService.value ||
      usesRecurringLinkedServicesUi.value ||
      isProducedProduct.value
        ? undefined
        : relatedItems.value.map((item) => ({
            id: item.id,
            name: item.name.trim(),
            category: item.category.trim(),
            price:
              item.price === null || item.price === undefined
                ? null
                : Number.isFinite(Number(item.price))
                  ? Number(item.price)
                  : null,
            chargeTax: item.chargeTax,
            description: item.description.trim(),
          })),
    retainerServices: isRetainerService.value
      ? relatedItems.value.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          category: "",
          price:
            item.price === null || item.price === undefined
              ? null
              : Number.isFinite(Number(item.price))
                ? Number(item.price)
                : null,
          chargeTax: false,
          description: item.description.trim(),
        }))
      : undefined,
    reccurentServices: isReccurentService.value
      ? relatedItems.value.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          category: "",
          price:
            item.price === null || item.price === undefined
              ? null
              : Number.isFinite(Number(item.price))
                ? Number(item.price)
                : null,
          chargeTax: false,
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
        }))
      : undefined,
    options:
      isProducedProduct.value && !hasProducedSubItems.value
        ? producedOptions.value.map(serializeProducedField)
        : undefined,
    rawMaterials:
      isProducedProduct.value && !hasProducedSubItems.value
        ? rawMaterials.value.map(serializeRawMaterial)
        : undefined,
    measurements:
      isProducedProduct.value && !hasProducedSubItems.value
        ? producedMeasurements.value.map(serializeProducedField)
        : undefined,
    subItems:
      isProducedProduct.value && hasProducedSubItems.value
        ? producedSubItems.value.map((subItem) => ({
            id: subItem.id,
            name: subItem.name.trim(),
            options: subItem.options.map(serializeProducedField),
            rawMaterials: subItem.rawMaterials.map(serializeRawMaterial),
            measurements: subItem.measurements.map(serializeProducedField),
          }))
        : undefined,
    salesTasks: salesTasks.value
      .map((task) => serializeTaskTemplate(task))
      .filter((task) => task.title),
    jobConfiguration: {
      milestones: jobConfigMilestones.value.map((milestone, index) => ({
        id: milestone.id,
        name: milestone.name.trim(),
        dueDate: milestone.dueDate,
        priority: milestone.priority,
        note: milestone.note.trim(),
        tasks: milestone.tasks.map((task) => serializeTaskTemplate(task)),
        goals: milestone.goals.map((goal) => ({
          id: goal.id,
          milestoneId: goal.milestoneId,
          name: goal.name.trim(),
          dueDate: goal.dueDate,
          startTrigger: normalizeStartTrigger(goal.startTrigger),
          phaseId: goal.phaseId ?? null,
          retainerServiceId: goal.retainerServiceId ?? null,
          reccurentServiceId: goal.reccurentServiceId ?? null,
          priority: goal.priority,
          note: goal.note.trim(),
          tasks: goal.tasks.map((task) => serializeTaskTemplate(task)),
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
      record.type === "Produced Product" ||
      record.type === "Onetime Service" ||
      record.type === "Contractual Service" ||
      record.type === "Retainer Service" ||
      record.type === "Reccurent Service"
    ) {
      if (record.type === "Produced Product") {
        applyProducedProductRecord(record);
        return;
      }

      applyServiceTemplateRecord(record);
      return;
    }

    applySharedRecord(record);
  },
  { immediate: true },
);
</script>

<template>
  <div class="catalogue-add-page">
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

      <div ref="topActionBarRef" class="d-flex gap-4 align-center flex-wrap">
        <VBtn
          variant="tonal"
          color="secondary"
          @click="router.push('/catalogues/list')"
        >
          Discard
        </VBtn>
        <VBtn @click="saveItem">{{ publishButtonLabel }}</VBtn>
      </div>
    </div>

    <VRow>
      <VCol md="8">
        <!-- 👉 Item Information -->
        <VCard v-if="renderDeferredSections" class="mb-6">
          <VCardItem>
            <template #title> Item Information </template>
          </VCardItem>

          <VCardText>
            <VForm ref="itemFormRef" @submit.prevent="saveItem">
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
                  <AsyncCatalogueCategoryTreeSelect
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
                <VCol>
                  <span class="mb-1">Description (optional)</span>
                  <AsyncProductDescriptionEditor
                    v-model="content"
                    placeholder="Item Description"
                    class="border rounded"
                  />
                </VCol>
                <template v-if="isContractualService">
                  <VCol cols="12">
                    <VDivider class="my-2" />
                    <div class="text-body-2 text-medium-emphasis">Phases</div>
                  </VCol>
                </template>
              </VRow>
            </VForm>

            <div
              v-if="
                !isContractualService &&
                !isProducedProduct &&
                relatedItems.length
              "
              class="mt-6"
            >
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ relatedSectionTitle }}
              </div>

              <div class="d-flex flex-column gap-4">
                <div
                  v-for="relatedItem in relatedItems"
                  :key="relatedItem.id"
                  class="related-item-card"
                  role="button"
                  tabindex="0"
                  @click="openEditRelatedItemDialog(relatedItem)"
                  @keydown.enter.prevent="
                    openEditRelatedItemDialog(relatedItem)
                  "
                  @keydown.space.prevent="
                    openEditRelatedItemDialog(relatedItem)
                  "
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
                          v-if="relatedItem.price !== null"
                          color="primary"
                          size="small"
                          variant="text"
                        >
                          ${{ relatedItem.price }}
                        </VChip>
                        <VChip
                          v-if="!usesRecurringLinkedServicesUi"
                          size="small"
                          :color="
                            relatedItem.chargeTax ? 'success' : 'secondary'
                          "
                          variant="text"
                        >
                          {{ relatedItem.chargeTax ? "Taxable" : "No Tax" }}
                        </VChip>
                      </div>

                      <div
                        v-if="!usesRecurringLinkedServicesUi"
                        class="text-body-2 text-medium-emphasis"
                      >
                        {{ relatedItem.category || "Uncategorized" }}
                      </div>
                    </div>

                    <div class="d-flex align-center">
                      <VBtn
                        icon
                        variant="text"
                        color="primary"
                        @click.stop="openEditRelatedItemDialog(relatedItem)"
                      >
                        <VIcon icon="tabler-edit" />
                      </VBtn>
                      <VBtn
                        icon
                        variant="text"
                        color="error"
                        @click.stop="removeRelatedItem(relatedItem.id)"
                      >
                        <VIcon icon="tabler-trash" />
                      </VBtn>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="isContractualService && phases.length" class="mt-6">
              <div class="d-flex flex-column gap-4">
                <div
                  v-for="phase in phases"
                  :key="phase.id"
                  class="related-item-card"
                  role="button"
                  tabindex="0"
                  @click="openEditPhase(phase)"
                  @keydown.enter.prevent="openEditPhase(phase)"
                  @keydown.space.prevent="openEditPhase(phase)"
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
                      </div>
                    </div>

                    <div class="d-flex align-center">
                      <VBtn
                        icon
                        variant="text"
                        color="primary"
                        @click.stop="openEditPhase(phase)"
                      >
                        <VIcon icon="tabler-edit" />
                      </VBtn>
                      <VBtn
                        icon
                        variant="text"
                        color="error"
                        @click.stop="removePhase(phase.id)"
                      >
                        <VIcon icon="tabler-trash" />
                      </VBtn>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="!isPhaseComposerVisible"
                class="d-flex justify-end mt-4"
              >
                <VBtn
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="tabler-layers-linked"
                  @click="showPhaseComposer"
                >
                  Add Phase
                </VBtn>
              </div>
            </div>

            <div
              v-else-if="isContractualService && !isPhaseComposerVisible"
              class="d-flex justify-end mt-6"
            >
              <VBtn
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="tabler-layers-linked"
                @click="showPhaseComposer"
              >
                Add Phase
              </VBtn>
            </div>

            <div
              v-if="isContractualService && isPhaseComposerVisible"
              class="mt-6"
            >
              <VRow>
                <VCol cols="12" md="6">
                  <AppTextField
                    ref="phaseTitleFieldRef"
                    v-model="phaseName"
                    label="Name"
                    placeholder="Mobilization"
                    :error="Boolean(phaseErrors.name)"
                    :error-messages="phaseErrors.name"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <AppTextField
                    v-model.number="phasePrice"
                    label="Phase Price"
                    placeholder="900"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </VCol>
                <VCol cols="12" class="d-flex justify-end gap-3 flex-wrap">
                  <VBtn
                    variant="tonal"
                    color="secondary"
                    @click="hidePhaseComposer"
                  >
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="primary"
                    prepend-icon="tabler-layers-linked"
                    @click="savePhase"
                  >
                    {{
                      phaseComposerMode === "edit" ? "Save Phase" : "Add Phase"
                    }}
                  </VBtn>
                </VCol>
              </VRow>
            </div>
          </VCardText>

          <VCardActions class="px-6 pb-6 pt-0 justify-end">
            <VBtn
              v-if="!isContractualService && !isProducedProduct"
              size="small"
              color="primary"
              variant="tonal"
              prepend-icon="tabler-link-plus"
              @click="openRelatedItemDialog"
            >
              {{ relatedButtonLabel }}
            </VBtn>
          </VCardActions>
        </VCard>

        <VCard v-if="isProducedProduct" class="mb-6">
          <VCardItem>
            <template #title> Sub Items </template>
            <template #append>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="openProducedSubItemComposer"
              >
                Add Sub Item
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <div
              v-if="producedSubItems.length"
              class="d-flex flex-column gap-4"
            >
              <VCard
                v-for="subItem in producedSubItems"
                :key="subItem.id"
                variant="outlined"
              >
                <VCardItem>
                  <template #title>
                    {{ subItem.name }}
                  </template>
                  <template #append>
                    <div class="d-flex align-center gap-1">
                      <VBtn
                        icon
                        variant="text"
                        color="primary"
                        @click="openEditProducedSubItem(subItem)"
                      >
                        <VIcon icon="tabler-edit" />
                      </VBtn>
                      <VBtn
                        icon
                        variant="text"
                        color="error"
                        @click="removeProducedSubItem(subItem.id)"
                      >
                        <VIcon icon="tabler-trash" />
                      </VBtn>
                    </div>
                  </template>
                </VCardItem>

                <VCardText>
                  <VCard variant="outlined">
                    <VCardItem>
                      <template #title> Customisation </template>
                    </VCardItem>

                    <VCardText>
                      <VTabs
                        v-model="producedSubItemTabs[subItem.id]"
                        class="mb-4"
                      >
                        <VTab value="options">Options</VTab>
                        <VTab value="raw-materials">Raw Materials</VTab>
                        <VTab value="measurements">Measurements</VTab>
                      </VTabs>

                      <VWindow v-model="producedSubItemTabs[subItem.id]">
                        <VWindowItem value="options">
                          <div class="d-flex justify-end mb-4">
                            <VBtn
                              size="small"
                              color="primary"
                              variant="tonal"
                              prepend-icon="tabler-plus"
                              @click="
                                openProducedFieldComposer('options', subItem.id)
                              "
                            >
                              Add Option
                            </VBtn>
                          </div>

                          <div
                            v-if="subItem.options.length"
                            class="d-flex flex-column gap-4"
                          >
                            <div
                              v-for="field in subItem.options"
                              :key="field.id"
                              class="related-item-card"
                            >
                              <div class="related-item-card__header">
                                <div class="related-item-card__dot" />

                                <div class="related-item-card__content">
                                  <div
                                    class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                                  >
                                    <div class="text-h6 font-weight-medium">
                                      {{ field.name }}
                                    </div>
                                    <VChip
                                      color="primary"
                                      size="small"
                                      variant="text"
                                    >
                                      {{ field.type }}
                                    </VChip>
                                  </div>

                                  <div class="text-body-2 text-medium-emphasis">
                                    {{
                                      field.description ||
                                      producedFieldTypeDescription(field.type)
                                    }}
                                  </div>

                                  <div
                                    v-if="field.values.length"
                                    class="text-body-2 text-medium-emphasis mt-1"
                                  >
                                    Values:
                                    {{ formatProducedFieldValues(field) }}
                                  </div>
                                </div>

                                <div class="d-flex align-center">
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="primary"
                                    @click.stop="
                                      openEditProducedField(
                                        'options',
                                        field,
                                        subItem.id,
                                      )
                                    "
                                  >
                                    <VIcon icon="tabler-edit" />
                                  </VBtn>
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="error"
                                    @click.stop="
                                      removeProducedField(
                                        'options',
                                        field.id,
                                        subItem.id,
                                      )
                                    "
                                  >
                                    <VIcon icon="tabler-trash" />
                                  </VBtn>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            v-if="
                              producedFieldComposer.visible &&
                              producedFieldComposer.section === 'options' &&
                              producedFieldComposer.subItemId === subItem.id
                            "
                            class="mt-4"
                          >
                            <VRow>
                              <VCol cols="12">
                                <AppTextField
                                  v-model="producedFieldName"
                                  label="Option Name"
                                  placeholder="Finish"
                                  :error="Boolean(producedFieldErrors.name)"
                                  :error-messages="producedFieldErrors.name"
                                />
                              </VCol>
                              <VCol cols="12">
                                <AppSelect
                                  v-model="producedFieldType"
                                  label="Option Type"
                                  :items="producedFieldTypeOptions"
                                />
                                <div
                                  class="text-body-2 text-medium-emphasis mt-2"
                                >
                                  {{
                                    producedFieldTypeDescription(
                                      producedFieldType,
                                    )
                                  }}
                                </div>
                              </VCol>
                              <VCol
                                v-if="shouldShowProducedFieldValues"
                                cols="12"
                              >
                                <AppCombobox
                                  v-model="producedFieldValuesDraft"
                                  label="Dropdown Items"
                                  placeholder="Type an item and press Enter"
                                  :items="producedFieldValuesDraft"
                                  hide-selected
                                  hide-no-data
                                  multiple
                                  chips
                                  closable-chips
                                />
                              </VCol>
                              <VCol
                                cols="12"
                                class="d-flex justify-end gap-3 flex-wrap"
                              >
                                <VBtn
                                  variant="tonal"
                                  color="secondary"
                                  @click="hideProducedFieldComposer"
                                >
                                  Cancel
                                </VBtn>
                                <VBtn
                                  variant="tonal"
                                  color="primary"
                                  @click="saveProducedField"
                                >
                                  {{ producedFieldComposerTitle }}
                                </VBtn>
                              </VCol>
                            </VRow>
                          </div>
                        </VWindowItem>

                        <VWindowItem value="raw-materials">
                          <div class="d-flex justify-end mb-4">
                            <VBtn
                              size="small"
                              color="primary"
                              variant="tonal"
                              prepend-icon="tabler-plus"
                              @click="openRawMaterialComposer(subItem.id)"
                            >
                              Add Raw Material
                            </VBtn>
                          </div>

                          <div
                            v-if="subItem.rawMaterials.length"
                            class="d-flex flex-column gap-4"
                          >
                            <div
                              v-for="material in subItem.rawMaterials"
                              :key="material.id"
                              class="related-item-card"
                            >
                              <div class="related-item-card__header">
                                <div class="related-item-card__dot" />

                                <div class="related-item-card__content">
                                  <div
                                    class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                                  >
                                    <div class="text-h6 font-weight-medium">
                                      {{ material.name }}
                                    </div>
                                    <VChip
                                      v-if="material.qty !== null"
                                      color="primary"
                                      size="small"
                                      variant="text"
                                    >
                                      Qty {{ material.qty }}
                                    </VChip>
                                  </div>
                                </div>

                                <div class="d-flex align-center">
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="primary"
                                    @click.stop="
                                      openEditRawMaterial(material, subItem.id)
                                    "
                                  >
                                    <VIcon icon="tabler-edit" />
                                  </VBtn>
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="error"
                                    @click.stop="
                                      removeRawMaterial(material.id, subItem.id)
                                    "
                                  >
                                    <VIcon icon="tabler-trash" />
                                  </VBtn>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            v-if="
                              rawMaterialComposer.visible &&
                              rawMaterialComposer.subItemId === subItem.id
                            "
                            class="mt-4"
                          >
                            <VRow>
                              <VCol cols="12">
                                <AppTextField
                                  v-model="rawMaterialName"
                                  label="Material Name"
                                  placeholder="MDF Board"
                                  :error="Boolean(rawMaterialErrors.name)"
                                  :error-messages="rawMaterialErrors.name"
                                />
                              </VCol>
                              <VCol cols="12">
                                <AppTextField
                                  v-model.number="rawMaterialQty"
                                  label="Quantity"
                                  placeholder="2"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                />
                              </VCol>
                              <VCol
                                cols="12"
                                class="d-flex justify-end gap-3 flex-wrap"
                              >
                                <VBtn
                                  variant="tonal"
                                  color="secondary"
                                  @click="hideRawMaterialComposer"
                                >
                                  Cancel
                                </VBtn>
                                <VBtn
                                  variant="tonal"
                                  color="primary"
                                  @click="saveRawMaterial"
                                >
                                  {{
                                    rawMaterialComposer.mode === "edit"
                                      ? "Save Raw Material"
                                      : "Add Raw Material"
                                  }}
                                </VBtn>
                              </VCol>
                            </VRow>
                          </div>
                        </VWindowItem>

                        <VWindowItem value="measurements">
                          <div class="d-flex justify-end mb-4">
                            <VBtn
                              size="small"
                              color="primary"
                              variant="tonal"
                              prepend-icon="tabler-plus"
                              @click="
                                openProducedFieldComposer(
                                  'measurements',
                                  subItem.id,
                                )
                              "
                            >
                              Add Measurement
                            </VBtn>
                          </div>

                          <div
                            v-if="subItem.measurements.length"
                            class="d-flex flex-column gap-4"
                          >
                            <div
                              v-for="field in subItem.measurements"
                              :key="field.id"
                              class="related-item-card"
                            >
                              <div class="related-item-card__header">
                                <div class="related-item-card__dot" />

                                <div class="related-item-card__content">
                                  <div
                                    class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                                  >
                                    <div class="text-h6 font-weight-medium">
                                      {{ field.name }}
                                    </div>
                                    <VChip
                                      color="primary"
                                      size="small"
                                      variant="text"
                                    >
                                      {{ field.type }}
                                    </VChip>
                                  </div>

                                  <div class="text-body-2 text-medium-emphasis">
                                    {{
                                      field.description ||
                                      producedFieldTypeDescription(field.type)
                                    }}
                                  </div>

                                  <div
                                    v-if="field.values.length"
                                    class="text-body-2 text-medium-emphasis mt-1"
                                  >
                                    Values:
                                    {{ formatProducedFieldValues(field) }}
                                  </div>
                                </div>

                                <div class="d-flex align-center">
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="primary"
                                    @click.stop="
                                      openEditProducedField(
                                        'measurements',
                                        field,
                                        subItem.id,
                                      )
                                    "
                                  >
                                    <VIcon icon="tabler-edit" />
                                  </VBtn>
                                  <VBtn
                                    icon
                                    variant="text"
                                    color="error"
                                    @click.stop="
                                      removeProducedField(
                                        'measurements',
                                        field.id,
                                        subItem.id,
                                      )
                                    "
                                  >
                                    <VIcon icon="tabler-trash" />
                                  </VBtn>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            v-if="
                              producedFieldComposer.visible &&
                              producedFieldComposer.section ===
                                'measurements' &&
                              producedFieldComposer.subItemId === subItem.id
                            "
                            class="mt-4"
                          >
                            <VRow>
                              <VCol cols="12">
                                <AppTextField
                                  v-model="producedFieldName"
                                  label="Measurement Name"
                                  placeholder="Width"
                                  :error="Boolean(producedFieldErrors.name)"
                                  :error-messages="producedFieldErrors.name"
                                />
                              </VCol>
                              <VCol cols="12">
                                <AppSelect
                                  v-model="producedFieldType"
                                  label="Measurement Type"
                                  :items="producedFieldTypeOptions"
                                />
                                <div
                                  class="text-body-2 text-medium-emphasis mt-2"
                                >
                                  {{
                                    producedFieldTypeDescription(
                                      producedFieldType,
                                    )
                                  }}
                                </div>
                              </VCol>
                              <VCol
                                v-if="shouldShowProducedFieldValues"
                                cols="12"
                              >
                                <AppCombobox
                                  v-model="producedFieldValuesDraft"
                                  label="Dropdown Items"
                                  placeholder="Type an item and press Enter"
                                  :items="producedFieldValuesDraft"
                                  hide-selected
                                  hide-no-data
                                  multiple
                                  chips
                                  closable-chips
                                />
                              </VCol>
                              <VCol
                                cols="12"
                                class="d-flex justify-end gap-3 flex-wrap"
                              >
                                <VBtn
                                  variant="tonal"
                                  color="secondary"
                                  @click="hideProducedFieldComposer"
                                >
                                  Cancel
                                </VBtn>
                                <VBtn
                                  variant="tonal"
                                  color="primary"
                                  @click="saveProducedField"
                                >
                                  {{ producedFieldComposerTitle }}
                                </VBtn>
                              </VCol>
                            </VRow>
                          </div>
                        </VWindowItem>
                      </VWindow>
                    </VCardText>
                  </VCard>
                </VCardText>
              </VCard>
            </div>

            <div v-else class="text-body-2 text-medium-emphasis">
              No sub items added yet. Product-level options, raw materials, and
              measurements will stay below until you add one.
            </div>

            <div v-if="producedSubItemComposer.visible" class="mt-4">
              <VRow>
                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="producedSubItemName"
                    label="Sub Item Name"
                    placeholder="Frame"
                    :error="Boolean(producedSubItemErrors.name)"
                    :error-messages="producedSubItemErrors.name"
                  />
                </VCol>
                <VCol cols="12" class="d-flex justify-end gap-3 flex-wrap">
                  <VBtn
                    variant="tonal"
                    color="secondary"
                    @click="hideProducedSubItemComposer"
                  >
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="primary"
                    @click="saveProducedSubItem"
                  >
                    {{
                      producedSubItemComposer.mode === "edit"
                        ? "Save Sub Item"
                        : "Add Sub Item"
                    }}
                  </VBtn>
                </VCol>
              </VRow>
            </div>
          </VCardText>
        </VCard>

        <VCard v-if="isProducedProduct && !hasProducedSubItems" class="mb-6">
          <VCardItem>
            <template #title> Customisation </template>
          </VCardItem>

          <VCardText>
            <VTabs v-model="producedProductTab" class="mb-4">
              <VTab value="options">Options</VTab>
              <VTab value="raw-materials">Raw Materials</VTab>
              <VTab value="measurements">Measurements</VTab>
            </VTabs>

            <VWindow v-model="producedProductTab">
              <VWindowItem value="options">
                <div class="d-flex justify-end mb-4">
                  <VBtn
                    size="small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    @click="openProducedFieldComposer('options')"
                  >
                    Add Option
                  </VBtn>
                </div>

                <div
                  v-if="producedOptions.length"
                  class="d-flex flex-column gap-4"
                >
                  <div
                    v-for="field in producedOptions"
                    :key="field.id"
                    class="related-item-card"
                  >
                    <div class="related-item-card__header">
                      <div class="related-item-card__dot" />

                      <div class="related-item-card__content">
                        <div
                          class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                        >
                          <div class="text-h6 font-weight-medium">
                            {{ field.name }}
                          </div>
                          <VChip color="primary" size="small" variant="text">
                            {{ field.type }}
                          </VChip>
                        </div>

                        <div class="text-body-2 text-medium-emphasis">
                          {{
                            field.description ||
                            producedFieldTypeDescription(field.type)
                          }}
                        </div>

                        <div
                          v-if="field.values.length"
                          class="text-body-2 text-medium-emphasis mt-1"
                        >
                          Values: {{ formatProducedFieldValues(field) }}
                        </div>
                      </div>

                      <div class="d-flex align-center">
                        <VBtn
                          icon
                          variant="text"
                          color="primary"
                          @click.stop="openEditProducedField('options', field)"
                        >
                          <VIcon icon="tabler-edit" />
                        </VBtn>
                        <VBtn
                          icon
                          variant="text"
                          color="error"
                          @click.stop="removeProducedField('options', field.id)"
                        >
                          <VIcon icon="tabler-trash" />
                        </VBtn>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="
                    producedFieldComposer.visible &&
                    producedFieldComposer.section === 'options' &&
                    producedFieldComposer.subItemId === null
                  "
                  class="mt-4"
                >
                  <VRow>
                    <VCol cols="12" md="6">
                      <AppTextField
                        v-model="producedFieldName"
                        label="Option Name"
                        placeholder="Finish"
                        :error="Boolean(producedFieldErrors.name)"
                        :error-messages="producedFieldErrors.name"
                      />
                    </VCol>
                    <VCol cols="12" md="6">
                      <AppSelect
                        v-model="producedFieldType"
                        label="Option Type"
                        :items="producedFieldTypeOptions"
                      />
                      <div class="text-body-2 text-medium-emphasis mt-2">
                        {{ producedFieldTypeDescription(producedFieldType) }}
                      </div>
                    </VCol>
                    <VCol v-if="shouldShowProducedFieldValues" cols="12">
                      <AppCombobox
                        v-model="producedFieldValuesDraft"
                        label="Dropdown Items"
                        placeholder="Type an item and press Enter"
                        :items="producedFieldValuesDraft"
                        hide-selected
                        hide-no-data
                        multiple
                        chips
                        closable-chips
                      />
                    </VCol>
                    <VCol cols="12" class="d-flex justify-end gap-3 flex-wrap">
                      <VBtn
                        variant="tonal"
                        color="secondary"
                        @click="hideProducedFieldComposer"
                      >
                        Cancel
                      </VBtn>
                      <VBtn
                        variant="tonal"
                        color="primary"
                        @click="saveProducedField"
                      >
                        {{ producedFieldComposerTitle }}
                      </VBtn>
                    </VCol>
                  </VRow>
                </div>
              </VWindowItem>

              <VWindowItem value="raw-materials">
                <div class="d-flex justify-end mb-4">
                  <VBtn
                    size="small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    @click="openRawMaterialComposer"
                  >
                    Add Raw Material
                  </VBtn>
                </div>

                <div
                  v-if="rawMaterials.length"
                  class="d-flex flex-column gap-4"
                >
                  <div
                    v-for="material in rawMaterials"
                    :key="material.id"
                    class="related-item-card"
                  >
                    <div class="related-item-card__header">
                      <div class="related-item-card__dot" />

                      <div class="related-item-card__content">
                        <div
                          class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                        >
                          <div class="text-h6 font-weight-medium">
                            {{ material.name }}
                          </div>
                          <VChip
                            v-if="material.qty !== null"
                            color="primary"
                            size="small"
                            variant="text"
                          >
                            Qty {{ material.qty }}
                          </VChip>
                        </div>
                      </div>

                      <div class="d-flex align-center">
                        <VBtn
                          icon
                          variant="text"
                          color="primary"
                          @click.stop="openEditRawMaterial(material)"
                        >
                          <VIcon icon="tabler-edit" />
                        </VBtn>
                        <VBtn
                          icon
                          variant="text"
                          color="error"
                          @click.stop="removeRawMaterial(material.id)"
                        >
                          <VIcon icon="tabler-trash" />
                        </VBtn>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="
                    rawMaterialComposer.visible &&
                    rawMaterialComposer.subItemId === null
                  "
                  class="mt-4"
                >
                  <VRow>
                    <VCol cols="12" md="6">
                      <AppTextField
                        v-model="rawMaterialName"
                        label="Material Name"
                        placeholder="MDF Board"
                        :error="Boolean(rawMaterialErrors.name)"
                        :error-messages="rawMaterialErrors.name"
                      />
                    </VCol>
                    <VCol cols="12" md="6">
                      <AppTextField
                        v-model.number="rawMaterialQty"
                        label="Quantity"
                        placeholder="2"
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </VCol>
                    <VCol cols="12" class="d-flex justify-end gap-3 flex-wrap">
                      <VBtn
                        variant="tonal"
                        color="secondary"
                        @click="hideRawMaterialComposer"
                      >
                        Cancel
                      </VBtn>
                      <VBtn
                        variant="tonal"
                        color="primary"
                        @click="saveRawMaterial"
                      >
                        {{
                          rawMaterialComposer.mode === "edit"
                            ? "Save Raw Material"
                            : "Add Raw Material"
                        }}
                      </VBtn>
                    </VCol>
                  </VRow>
                </div>
              </VWindowItem>

              <VWindowItem value="measurements">
                <div class="d-flex justify-end mb-4">
                  <VBtn
                    size="small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="tabler-plus"
                    @click="openProducedFieldComposer('measurements')"
                  >
                    Add Measurement
                  </VBtn>
                </div>

                <div
                  v-if="producedMeasurements.length"
                  class="d-flex flex-column gap-4"
                >
                  <div
                    v-for="field in producedMeasurements"
                    :key="field.id"
                    class="related-item-card"
                  >
                    <div class="related-item-card__header">
                      <div class="related-item-card__dot" />

                      <div class="related-item-card__content">
                        <div
                          class="d-flex flex-wrap align-center gap-x-3 gap-y-1"
                        >
                          <div class="text-h6 font-weight-medium">
                            {{ field.name }}
                          </div>
                          <VChip color="primary" size="small" variant="text">
                            {{ field.type }}
                          </VChip>
                        </div>

                        <div class="text-body-2 text-medium-emphasis">
                          {{
                            field.description ||
                            producedFieldTypeDescription(field.type)
                          }}
                        </div>

                        <div
                          v-if="field.values.length"
                          class="text-body-2 text-medium-emphasis mt-1"
                        >
                          Values: {{ formatProducedFieldValues(field) }}
                        </div>
                      </div>

                      <div class="d-flex align-center">
                        <VBtn
                          icon
                          variant="text"
                          color="primary"
                          @click.stop="
                            openEditProducedField('measurements', field)
                          "
                        >
                          <VIcon icon="tabler-edit" />
                        </VBtn>
                        <VBtn
                          icon
                          variant="text"
                          color="error"
                          @click.stop="
                            removeProducedField('measurements', field.id)
                          "
                        >
                          <VIcon icon="tabler-trash" />
                        </VBtn>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="
                    producedFieldComposer.visible &&
                    producedFieldComposer.section === 'measurements' &&
                    producedFieldComposer.subItemId === null
                  "
                  class="mt-4"
                >
                  <VRow>
                    <VCol cols="12" md="6">
                      <AppTextField
                        v-model="producedFieldName"
                        label="Measurement Name"
                        placeholder="Width"
                        :error="Boolean(producedFieldErrors.name)"
                        :error-messages="producedFieldErrors.name"
                      />
                    </VCol>
                    <VCol cols="12" md="6">
                      <AppSelect
                        v-model="producedFieldType"
                        label="Measurement Type"
                        :items="producedFieldTypeOptions"
                      />
                      <div class="text-body-2 text-medium-emphasis mt-2">
                        {{ producedFieldTypeDescription(producedFieldType) }}
                      </div>
                    </VCol>
                    <VCol v-if="shouldShowProducedFieldValues" cols="12">
                      <AppCombobox
                        v-model="producedFieldValuesDraft"
                        label="Dropdown Items"
                        placeholder="Type an item and press Enter"
                        :items="producedFieldValuesDraft"
                        hide-selected
                        hide-no-data
                        multiple
                        chips
                        closable-chips
                      />
                    </VCol>
                    <VCol cols="12" class="d-flex justify-end gap-3 flex-wrap">
                      <VBtn
                        variant="tonal"
                        color="secondary"
                        @click="hideProducedFieldComposer"
                      >
                        Cancel
                      </VBtn>
                      <VBtn
                        variant="tonal"
                        color="primary"
                        @click="saveProducedField"
                      >
                        {{ producedFieldComposerTitle }}
                      </VBtn>
                    </VCol>
                  </VRow>
                </div>
              </VWindowItem>
            </VWindow>
          </VCardText>
        </VCard>

        <!-- 👉 Sales Tasks -->
        <VCard class="mb-6">
          <VCardItem>
            <template #title> Sales Tasks </template>
            <template #append>
              <VBtn
                size="small"
                variant="tonal"
                prepend-icon="tabler-plus"
                @click="openSalesTaskTemplateDrawer"
              >
                Add Task
              </VBtn>
            </template>
          </VCardItem>

          <VCardText>
            <div class="d-flex flex-column gap-4">
              <VCard
                v-for="task in salesTasks"
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
                        {{ formatTaskStart(task.afterWhen, task.startTrigger) }}
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
                          <VListItem @click="openEditSalesTask(task)">
                            <template #prepend>
                              <VIcon icon="tabler-edit" />
                            </template>
                            <VListItemTitle>Edit</VListItemTitle>
                          </VListItem>
                          <VListItem @click="removeSalesTask(task.id)">
                            <template #prepend>
                              <VIcon icon="tabler-trash" color="error" />
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
                        'text-medium-emphasis': task.status === 'pending',
                        'text-success': task.status === 'completed',
                      }"
                    >
                      {{ taskStatusLabel(task.status) }}
                    </span>
                  </div>
                </div>
              </VCard>
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
                        | After {{ formatTaskAfterWhen(milestone.dueDate) }}
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
                                {{
                                  formatTaskStart(
                                    task.afterWhen,
                                    task.startTrigger,
                                  )
                                }}
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
                                |
                                {{
                                  formatGoalStart(
                                    goal.dueDate,
                                    goal.startTrigger,
                                  )
                                }}
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
                                        {{
                                          formatTaskStart(
                                            task.afterWhen,
                                            task.startTrigger,
                                          )
                                        }}
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
        <VCard v-if="!renderDeferredSections" class="mb-6">
          <VCardText class="py-8">
            <div
              class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
            >
              <div>
                <h5 class="text-h5 mb-1">Job Configuration</h5>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Loading job template configuration...
                </p>
              </div>
            </div>
            <VSkeletonLoader type="list-item-two-line, list-item-two-line" />
          </VCardText>
        </VCard>
      </VCol>

      <VCol md="4" cols="12">
        <!-- 👉 Pricing -->
        <VCard title="Pricing" class="mb-6">
          <VCardText>
            <AppTextField
              v-if="isInventoryItem"
              v-model.number="inventoryQty"
              label="Quantity"
              placeholder="0"
              type="number"
              min="0"
              step="1"
              class="mb-6"
            />
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
              v-else-if="usesRecurringLinkedServicesUi"
              v-model.number="itemBestPrice"
              label="Best Price"
              placeholder="Price"
              type="number"
              min="0"
              step="0.01"
              class="mb-6"
            />
            <div
              v-if="usesRecurringLinkedServicesUi"
              class="text-body-2 text-medium-emphasis mb-6"
            >
              Linked services total: ${{ retainerLinkedServicesTotalPrice }}
            </div>
            <template v-else-if="!isContractualService">
              <AppTextField
                v-model.number="itemBestPrice"
                label="Best Price"
                placeholder="Price"
                type="number"
                min="0"
                step="0.01"
                class="mb-6"
              />
            </template>

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
            <template #title> Image </template>
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

              <div class="image-action-row d-flex gap-3">
                <VBtn
                  color="primary"
                  variant="tonal"
                  prepend-icon="tabler-upload"
                  class="image-action-btn"
                  @click="openImageFilePicker"
                >
                  Replace
                </VBtn>

                <VBtn
                  color="error"
                  variant="tonal"
                  prepend-icon="tabler-trash"
                  class="image-action-btn"
                  @click="removeItemImage"
                >
                  Remove
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
                Browse Image
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog
      v-if="isImageUrlDialogOpen"
      v-model="isImageUrlDialogOpen"
      max-width="560"
    >
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

    <VDialog
      v-if="isRelatedItemDialogOpen"
      v-model="isRelatedItemDialogOpen"
      max-width="760"
    >
      <VCard>
        <VCardItem :title="relatedDialogTitle" />

        <VCardText>
          <VRow>
            <VCol cols="12" :md="shouldShowRetainerCategoryField ? 12 : 6">
              <AppTextField
                v-model="relatedItemName"
                label="Name"
                placeholder="Acoustic Wall Panel"
                :error="Boolean(relatedItemErrors.name)"
                :error-messages="relatedItemErrors.name"
              />
            </VCol>
            <VCol v-if="shouldShowRetainerCategoryField" cols="6" md="6">
              <AsyncCatalogueCategoryTreeSelect
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
            <VCol :cols="shouldShowRetainerCategoryField ? '6' : '12'" md="6">
              <AppTextField
                v-model.number="relatedItemPrice"
                label="Price"
                placeholder="1500"
                type="number"
                min="0"
                step="0.01"
              />
            </VCol>
            <VCol v-if="shouldShowRetainerChargeTaxField" cols="12" md="6">
              <VCheckbox
                v-model="isRelatedItemChargeTax"
                label="Charge Tax on this  item"
              />
            </VCol>
            <VCol cols="12">
              <AppTextarea
                v-model="relatedItemDescription"
                label="Description (optional)"
                placeholder="Item Description"
                auto-grow
                rows="2"
              />
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn color="primary" variant="tonal" @click="saveRelatedItem">
            {{ relatedDialogSaveLabel }}
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

    <VDialog
      v-if="milestoneDialog.visible"
      v-model="milestoneDialog.visible"
      max-width="560"
    >
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
                <div class="text-body-2 mb-2">After when</div>
                <div class="after-when-control">
                  <AppTextField
                    v-model.number="milestoneAfterWhenValue"
                    type="number"
                    min="1"
                    step="1"
                    hide-details="auto"
                    class="after-when-input"
                    suffix="days"
                  />

                  <div class="after-when-actions">
                    <VBtn
                      size="small"
                      variant="tonal"
                      @click="addMilestoneAfterWhenDays(1)"
                    >
                      +1 day
                    </VBtn>
                    <VBtn
                      size="small"
                      variant="tonal"
                      @click="addMilestoneAfterWhenDays(7)"
                    >
                      +1 week
                    </VBtn>
                    <VBtn
                      size="small"
                      variant="tonal"
                      @click="addMilestoneAfterWhenDays(30)"
                    >
                      +1 month
                    </VBtn>
                  </div>
                </div>
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
                <AsyncDialogActionBar
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
      v-if="goalDialog.visible"
      v-model="goalDialog.visible"
      max-width="560"
    >
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
                <AppSelect
                  v-model="goalStartMode"
                  label="Start when"
                  :items="goalStartModeOptions"
                  item-title="title"
                  item-value="value"
                />
              </VCol>
              <VCol v-if="goalStartMode === 'time'" cols="12">
                <div class="text-body-2 mb-2">After when</div>
                <div class="after-when-control">
                  <AppSelect
                    v-model="goalAfterWhenPreset"
                    :items="goalAfterWhenPresetOptions"
                    item-title="title"
                    item-value="value"
                    hide-details="auto"
                    class="after-when-select"
                  />

                  <AppTextField
                    v-if="goalAfterWhenPreset === 'custom'"
                    v-model.number="goalAfterWhenValue"
                    type="number"
                    min="1"
                    step="1"
                    hide-details="auto"
                    :rules="[requiredValidator]"
                    class="after-when-input"
                    suffix="days"
                  />
                </div>
              </VCol>
              <VCol v-else cols="12">
                <AppSelect
                  v-model="selectedGoalDependencyId"
                  label="Start after goal completion"
                  :items="availableGoalDependencyOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[requiredValidator]"
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
                <AsyncDialogActionBar
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

    <CatalogueTaskTemplateDrawer
      ref="taskTemplateDrawerRef"
      v-model:is-drawer-open="isTaskTemplateDrawerOpen"
      :goal-trigger-options="goalTriggerOptions"
      @save="handleTaskTemplateCreated"
    />

    <div
      v-show="isFloatingActionBarVisible"
      class="catalogue-add-page__action-bar"
    >
      <div class="catalogue-add-page__action-bar-inner">
        <VBtn
          variant="tonal"
          color="secondary"
          @click="router.push('/catalogues/list')"
        >
          Discard
        </VBtn>
        <VBtn @click="saveItem">{{ publishButtonLabel }}</VBtn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.catalogue-add-page {
  padding-block-end: 6.5rem;
}

.catalogue-add-page__action-bar {
  position: fixed;
  z-index: 20;
  backdrop-filter: blur(10px);
  background: linear-gradient(
    to top,
    rgba(var(--v-theme-surface), 0.98),
    rgba(var(--v-theme-surface), 0.88)
  );
  border-block-start: 1px solid
    rgba(var(--v-border-color), var(--v-border-opacity));
  inset-block-end: 0;
  inset-inline: 0;
  padding-block: 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0));
  padding-inline: 1rem;
}

.catalogue-add-page__action-bar-inner {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  inline-size: min(100%, 1440px);
  margin-inline: auto;
}

@media (max-width: 599px) {
  .catalogue-add-page__action-bar-inner {
    justify-content: stretch;
  }

  .catalogue-add-page__action-bar-inner :deep(.v-btn) {
    flex: 1 1 0;
    min-inline-size: 0;
  }
}

.drop-zone {
  border: 2px dashed rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
}

.after-when-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.after-when-select {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.after-when-input {
  flex: 0 0 110px;
}

.after-when-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-action-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  inline-size: 100%;
}

.image-action-btn {
  flex: 1 1 0;
  min-inline-size: 0;
}

.image-action-btn :deep(.v-btn__content) {
  overflow: hidden;
  justify-content: center;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-item-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.related-item-card:hover,
.related-item-card:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.45);
  background: rgba(var(--v-theme-primary), 0.05);
  outline: none;
  transform: translateY(-1px);
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
