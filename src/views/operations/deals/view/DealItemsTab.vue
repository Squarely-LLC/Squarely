<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { Status, ToDo } from "@/data/schema";
import type {
  CatalogueActiveState,
  CatalogueContractualServiceRecord,
  CatalogueItem,
  CatalogueItemType,
  CatalogueOnetimeServiceRecord,
  CatalogueProducedProductRecord,
  CatalogueProductRecord,
  CatalogueReccurentServiceRecord,
  CatalogueRetainerServiceRecord,
  CatalogueSalesTask,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealBillingPeriod,
  DealCustomPhase,
  DealItem,
  DealItemOverride,
  DealProperties,
  DealSalesTaskTemplate,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import { useTodos } from "@/stores/todos";
import {
  buildCustomBillingPeriod,
  buildDealDocumentDraftRecord,
  buildDealDocumentUsageKey,
  buildMonthlyBillingPeriod,
  buildQuarterlyBillingPeriod,
  buildYearlyBillingPeriod,
  filterDealDocumentItemsByBillingMode,
  getBillableRootDealItems,
  getDealBillingPeriodKey,
  getDealBillingPeriodLabel,
  getDealBillingPeriodMonthValue,
  getDealContractualPhaseLines,
  getDealRecurrentServiceLines,
  getDealRetainerServiceLines,
  getQuotationTopLevelDealItems,
  getSelectableDealItems,
  resolveDealDocumentBillingMode,
  resolveDealDocumentBillingModeForItem,
  resolveStoredBillingPeriodKey,
  saveDealDocumentDraft,
  type DealDocumentBillingMode,
  type DealDocumentKind,
  type DealDocumentSelectableItem,
} from "@/utils/dealDocumentDraft";
import {
  getDealDiscountTotal,
  getDealGrandTotal,
  getDealItemsSubtotal,
} from "@/utils/dealValue";
import { computed, reactive, ref } from "vue";
import type { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  deal: DealProperties;
}>();
const emit = defineEmits<{
  (e: "open-add-task", payload: { initial: Partial<ToDo> }): void;
  (e: "open-edit-task", todoId: number | string): void;
  (e: "delete-task", todoId: number | string): void;
}>();

const router = useRouter();
const cataloguesStore = useCataloguesStore();
const configStore = useConfigStore();
const contactsStore = useContactsStore();
const dealsStore = useDealsStore();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();

cataloguesStore.init();
configStore.init();
contactsStore.init();
dealsStore.init();
quotationsStore.init();
proformasStore.init();
invoicesStore.init();
todosStore.init();

type DerivedGoal = {
  id: string;
  overrideKey: string;
  name: string;
  category: string | null;
  note: string | null;
  price: number | null;
  typeLabel: string;
  quantity: number | null;
  discountPercent: number | null;
  discountLabel: string | null;
  taxApplicable: boolean | null;
  showQuantity: boolean;
  showPrice: boolean;
  showDiscount: boolean;
  showTaxApplicable: boolean;
};

type DerivedSection = {
  id: string;
  name: string;
  note: string | null;
  price: number | null;
  goals: DerivedGoal[];
  goalTypeSingular: string;
  goalTypePlural: string;
};

type DealItemWithPlan = DealItem & {
  panelId: number | string;
  isExpandable: boolean;
  derivedSections: DerivedSection[];
  childTypeSingular: string;
  childTypePlural: string;
  childCount: number;
  actionsEnabled: boolean;
};

type ItemTypeChoice = {
  title: string;
  value: CatalogueItemType;
  description: string;
  icon: string;
  comingSoon?: boolean;
};

type DealPreviewKind = "quotation" | "proforma" | "invoice";

type DealDocumentContainer = {
  quotation: {
    id: number | string;
    quoteNumber: string;
    issuedDate: string;
    dueDate: string;
    total: number;
    quotationStatus: string;
    dealId: number | null;
  };
};

type DealDocumentPanelRecord = {
  id: number | string;
  issuedDate: string;
  quoteNumber: string;
  status: string;
  total: number;
};

type DealDocumentPanel = {
  count: number;
  emptyText: string;
  key: DealPreviewKind;
  latest: DealDocumentPanelRecord | null;
  records: DealDocumentPanelRecord[];
  title: string;
};

const addItemDialogVisible = ref(false);
const billingModeDialogVisible = ref(false);
const billingPeriodDialogVisible = ref(false);
const createItemTypeDialogVisible = ref(false);
const createDraftItemDialogVisible = ref(false);
const editLineDialogVisible = ref(false);
const phaseDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const selectionDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const phaseFormRef = ref<VForm>();
const createDraftItemFormRef = ref<VForm>();
const editLineFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const selectedBillingMode = ref<DealDocumentBillingMode | null>(null);
const selectedCatalogueItemId = ref<string | null>(null);
const selectedCreateItemType = ref<CatalogueItemType | null>(null);
const selectedDocumentKind = ref<DealDocumentKind | null>(null);
const selectedItemIds = ref<string[]>([]);
const selectedPreviewDocument = ref<{
  href: string;
  id: number | string;
  kind: DealPreviewKind;
  title: string;
} | null>(null);
const activeDocumentPanelKey = ref<DealPreviewKind | null>(null);
const pendingDocumentItems = ref<DealDocumentSelectableItem[]>([]);
const billingPeriodPrices = reactive<Record<string, number>>({});
const billingPeriod = ref<DealBillingPeriod>(buildMonthlyBillingPeriod());
const billingPeriodKind = ref<DealBillingPeriod["kind"]>(
  billingPeriod.value.kind,
);
const billingPeriodMonthValue = ref(
  getDealBillingPeriodMonthValue(billingPeriod.value),
);
const defaultBillingYearValue = () => String(new Date().getFullYear());
const defaultBillingQuarterValue = () => {
  const today = new Date();

  return `Q${Math.floor(today.getMonth() / 3) + 1}`;
};
const defaultBillingCustomDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
const billingPeriodQuarterYearValue = ref(defaultBillingYearValue());
const billingPeriodQuarterValue = ref(defaultBillingQuarterValue());
const billingPeriodYearValue = ref(defaultBillingYearValue());
const billingPeriodCustomStartDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomEndDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomLabel = ref("");
const billingPeriodKindOptions = [
  { title: "Month", value: "monthly" },
  { title: "Quarter", value: "quarterly" },
  { title: "Year", value: "yearly" },
  { title: "Custom", value: "custom" },
] as const;
const billingQuarterOptions = [
  { title: "Q1", value: "Q1" },
  { title: "Q2", value: "Q2" },
  { title: "Q3", value: "Q3" },
  { title: "Q4", value: "Q4" },
] as const;

const syncBillingPeriodDraft = (
  period: DealBillingPeriod = billingPeriod.value,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  const startDate = String(period.startDate || defaultBillingCustomDateValue());
  const endDate = String(period.endDate || startDate);
  const quarterMatch = periodKey.match(/^(\d{4})-q([1-4])$/);
  const yearMatch = periodKey.match(/^(\d{4})$/);
  const startDateMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fallbackYear = startDateMatch?.[1] || defaultBillingYearValue();
  const fallbackQuarter = startDateMatch
    ? `Q${Math.floor((Number(startDateMatch[2]) - 1) / 3) + 1}`
    : defaultBillingQuarterValue();

  billingPeriodKind.value = period.kind;
  billingPeriodMonthValue.value = getDealBillingPeriodMonthValue(period);
  billingPeriodQuarterYearValue.value = quarterMatch?.[1] || fallbackYear;
  billingPeriodQuarterValue.value = quarterMatch
    ? `Q${quarterMatch[2]}`
    : fallbackQuarter;
  billingPeriodYearValue.value = yearMatch?.[1] || fallbackYear;
  billingPeriodCustomStartDate.value = startDate;
  billingPeriodCustomEndDate.value = endDate;
  billingPeriodCustomLabel.value =
    period.kind === "custom" ? getDealBillingPeriodLabel(period) : "";
};

const billingPeriodPreview = computed(() => {
  if (billingPeriodKind.value === "quarterly") {
    return buildQuarterlyBillingPeriod(
      `${billingPeriodQuarterYearValue.value}-${billingPeriodQuarterValue.value}`,
    );
  }

  if (billingPeriodKind.value === "yearly") {
    return buildYearlyBillingPeriod(billingPeriodYearValue.value);
  }

  if (billingPeriodKind.value === "custom") {
    return buildCustomBillingPeriod({
      endDate: billingPeriodCustomEndDate.value,
      label: billingPeriodCustomLabel.value,
      startDate: billingPeriodCustomStartDate.value,
    });
  }

  return buildMonthlyBillingPeriod(billingPeriodMonthValue.value);
});

syncBillingPeriodDraft();

const commitBillingPeriod = () => {
  billingPeriod.value = billingPeriodPreview.value;
  syncBillingPeriodDraft(billingPeriod.value);

  return billingPeriod.value;
};

const addItemDraft = reactive({
  quantity: 1,
});

const createDraftItem = reactive({
  name: "",
  quantity: 1,
  price: 0,
  discountPercent: 0,
  taxApplicable: true,
  note: "",
});

const editLine = reactive({
  mode: "item" as "item" | "sub",
  itemId: null as number | null,
  parentItemId: null as number | null,
  overrideKey: "",
  title: "",
  name: "",
  category: "",
  quantity: 1 as number | null,
  unitPrice: 0 as number | null,
  discountPercent: 0 as number | null,
  taxApplicable: null as boolean | null,
  note: "",
  canEditQuantity: true,
  canEditPrice: true,
  canEditDiscount: true,
  canEditTax: true,
  canEditInfo: true,
});

const phaseDraft = reactive({
  category: "",
  customPhaseId: null as string | null,
  discountPercent: 0,
  name: "",
  note: "",
  parentItemId: null as number | null,
  price: 0,
  quantity: 1,
  taxApplicable: true as boolean | null,
});

const itemTypeChoices: ItemTypeChoice[] = [
  {
    title: "Onetime Service",
    value: "Onetime Service",
    description:
      "Single-scope service delivered once, such as an installation or one-off site visit.",
    icon: "tabler-bolt",
  },
  {
    title: "Product",
    value: "Product",
    description:
      "Standard stocked item purchased, stored, and sold as inventory.",
    icon: "tabler-package",
  },
  {
    title: "Contractual Service",
    value: "Contractual Service",
    description:
      "Service sold under a fixed contract period, scope, or maintenance agreement.",
    icon: "tabler-file-description",
  },
  {
    title: "Produced Product",
    value: "Produced Product",
    description:
      "Item manufactured, assembled, or custom-built internally before delivery.",
    icon: "tabler-building-factory-2",
  },
  {
    title: "Reccurent Service",
    value: "Reccurent Service",
    description:
      "Scheduled repeat service delivered on a recurring basis such as monthly cleaning or upkeep.",
    icon: "tabler-repeat",
  },
  {
    title: "Rental",
    value: "Rental",
    description:
      "Reusable asset hired out for a defined time window and then returned to stock.",
    icon: "tabler-calendar-time",
    comingSoon: true,
  },
  {
    title: "Retainer Service",
    value: "Retainer Service",
    description:
      "Ongoing advisory or support service billed to reserve team availability over time.",
    icon: "tabler-briefcase",
  },
];

const catalogueOptions = computed(() =>
  cataloguesStore.all
    .filter((item) => item.name.trim())
    .map((item) => ({
      title: `${item.name} (${item.type})`,
      value: item.id,
    })),
);

const selectedCatalogueItem = computed<CatalogueItem | null>(() => {
  if (!selectedCatalogueItemId.value) return null;

  return cataloguesStore.byId(selectedCatalogueItemId.value) ?? null;
});

const selectedCatalogueRecord = computed(() =>
  selectedCatalogueItemId.value
    ? cataloguesStore.recordById(selectedCatalogueItemId.value)
    : null,
);

const buildDealRelatedTo = () => ({
  id: props.deal.id,
  name: props.deal.code || `Deal #${props.deal.id}`,
  type: "deal",
});

const parseAfterWhen = (raw?: string | null) => {
  const base = new Date();
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  const match = value.match(
    /^([+-]?\d+)\s*(day|days|week|weeks|month|months)$/,
  );

  if (!match) return base.toISOString();

  const amount = Number(match[1] || 0);
  const unit = match[2];
  const next = new Date(base);

  if (unit.startsWith("day")) next.setDate(next.getDate() + amount);
  else if (unit.startsWith("week")) next.setDate(next.getDate() + amount * 7);
  else if (unit.startsWith("month")) next.setMonth(next.getMonth() + amount);

  return next.toISOString();
};

const extractSalesTasks = (record: unknown): CatalogueSalesTask[] => {
  if (!record || typeof record !== "object") return [];

  const salesTasks = (record as { salesTasks?: CatalogueSalesTask[] })
    .salesTasks;

  return Array.isArray(salesTasks) ? salesTasks : [];
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

const buildImportedSalesTaskTemplates = (
  items: DealItem[],
  startingId = 1,
): DealSalesTaskTemplate[] => {
  let nextId = startingId;

  return items
    .filter((item) => !item.parentItemId)
    .flatMap((item) => {
      const record = item.catalogueItemId
        ? cataloguesStore.recordById(
            item.catalogueItemId,
            item.catalogueType || undefined,
          )
        : null;

      return extractSalesTasks(record).map((task, index) =>
        cloneDealSalesTaskTemplate({
          ...task,
          id: nextId++,
          relatedTo: buildDealRelatedTo(),
          sourceItemId: item.id,
          sourceTaskId: task.id ?? index + 1,
        }),
      );
    });
};

const nextItemId = () => {
  const ids = (props.deal.items || [])
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id));

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const addDealItemsFromCatalogueItem = (
  catalogueItem: CatalogueItem,
  quantity: number,
  options?: {
    note?: string | null;
    discountPercent?: number | null;
    taxApplicable?: boolean | null;
  },
) => {
  const baseId = nextItemId();
  const catalogueRecord = cataloguesStore.recordById(catalogueItem.id);
  const relatedItems =
    catalogueRecord?.type === "Onetime Service"
      ? (catalogueRecord as CatalogueOnetimeServiceRecord).relatedItems || []
      : [];

  const nextItems: DealItem[] = [
    ...(props.deal.items || []),
    {
      id: baseId,
      name: catalogueItem.name,
      itemTypeLabel: catalogueItem.type,
      category: catalogueItem.category,
      catalogueItemId: catalogueItem.id,
      catalogueType: catalogueItem.type,
      parentItemId: null,
      sourceRelatedItemId: null,
      excludedRelatedItemIds: null,
      discountPercent: options?.discountPercent ?? 0,
      taxApplicable: options?.taxApplicable ?? null,
      quantity,
      unitPrice: Number(catalogueItem.bestPrice || 0),
      status: "Planned",
      note: options?.note ?? (catalogueItem.description || null),
    },
    ...relatedItems.map((relatedItem, index) => ({
      id: baseId + index + 1,
      name: relatedItem.name,
      itemTypeLabel: "Related Item",
      category: relatedItem.category,
      catalogueItemId: catalogueItem.id,
      catalogueType: "Related Item",
      parentItemId: baseId,
      sourceRelatedItemId: relatedItem.id,
      excludedRelatedItemIds: null,
      quantity,
      unitPrice: relatedItem.price ?? null,
      status: "Planned",
      note: relatedItem.description || null,
    })),
  ];

  const existingSalesTasks = buildEditableSalesTasks();
  const importedSalesTasks = buildImportedSalesTaskTemplates(
    nextItems.filter((item) => item.id === baseId),
    nextDealSalesTaskId(existingSalesTasks),
  );

  dealsStore.updateDeal(props.deal.id, {
    items: nextItems,
    salesTasks: [...existingSalesTasks, ...importedSalesTasks],
  });
};

const itemTypeLabel = (item: DealItem) => {
  const raw = item.itemTypeLabel || item.catalogueType || "Item";

  return (
    raw
      .replace(/\bitems?\b/gi, "")
      .replace(/\bservices?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || raw
  );
};

const openAddItemDialog = () => {
  selectedCatalogueItemId.value = null;
  addItemDraft.quantity = 1;
  addItemDialogVisible.value = true;
};

const openCreateCatalogueItem = async () => {
  selectedCreateItemType.value = null;
  createItemTypeDialogVisible.value = true;
};

const saveSelectedCatalogueItem = async () => {
  const { valid } = (await addItemFormRef.value?.validate()) ?? { valid: true };
  if (!valid || !selectedCatalogueItem.value) return;

  const selectedItem = selectedCatalogueItem.value;
  const quantity = Number(addItemDraft.quantity || 1);
  addDealItemsFromCatalogueItem(selectedItem, quantity);
  notifications.push("Item added to deal", "success", 3000);
  addItemDialogVisible.value = false;
};

const openCreateDraftItemDialog = (type: CatalogueItemType) => {
  const choice = itemTypeChoices.find((item) => item.value === type);
  if (choice?.comingSoon) return;

  selectedCreateItemType.value = type;
  createDraftItem.name = "";
  createDraftItem.quantity = 1;
  createDraftItem.price = 0;
  createDraftItem.discountPercent = 0;
  createDraftItem.taxApplicable = true;
  createDraftItem.note = "";
  createItemTypeDialogVisible.value = false;
  createDraftItemDialogVisible.value = true;
};

const saveCreatedDraftItem = async () => {
  const { valid } = (await createDraftItemFormRef.value?.validate()) ?? {
    valid: true,
  };
  if (!valid || !selectedCreateItemType.value) return;

  const draftRecord = cataloguesStore.addItem({
    type: selectedCreateItemType.value,
    name: createDraftItem.name,
    qty: Number(createDraftItem.quantity || 1),
    bestPrice: Number(createDraftItem.price || 0),
    chargeTax: Boolean(createDraftItem.taxApplicable),
    description: String(createDraftItem.note || "").trim(),
    category: "",
    activeState: "Draft" as CatalogueActiveState,
  });

  addDealItemsFromCatalogueItem(
    draftRecord,
    Number(createDraftItem.quantity || 1),
    {
      note: String(createDraftItem.note || "").trim() || null,
      discountPercent: Number(createDraftItem.discountPercent || 0),
      taxApplicable: Boolean(createDraftItem.taxApplicable),
    },
  );

  createDraftItemDialogVisible.value = false;
  notifications.push("Draft catalogue item created and added", "success", 3000);
};

const removeDealItem = (item: DealItemWithPlan) => {
  const isRelatedItemChild =
    item.catalogueType === "Related Item" &&
    !!item.parentItemId &&
    !!item.sourceRelatedItemId;

  let nextItems = (props.deal.items || []).map((existingItem) => {
    if (
      !isRelatedItemChild ||
      existingItem.id !== item.parentItemId ||
      !item.sourceRelatedItemId
    )
      return existingItem;

    const excluded = new Set(existingItem.excludedRelatedItemIds || []);
    excluded.add(item.sourceRelatedItemId);

    return {
      ...existingItem,
      excludedRelatedItemIds: [...excluded],
    };
  });

  nextItems = nextItems.filter(
    (existingItem) =>
      existingItem.id !== item.id && existingItem.parentItemId !== item.id,
  );

  (props.deal.items || [])
    .filter(
      (existingItem) =>
        existingItem.id === item.id || existingItem.parentItemId === item.id,
    )
    .flatMap((existingItem) => existingItem.generatedTaskIds || [])
    .forEach((taskId) => todosStore.removeTodo(taskId));

  const nextSalesTasks = isRelatedItemChild
    ? buildEditableSalesTasks()
    : buildEditableSalesTasks().filter(
        (task) => Number(task.sourceItemId ?? 0) !== Number(item.id),
      );

  dealsStore.updateDeal(props.deal.id, {
    items: nextItems,
    salesTasks: nextSalesTasks,
  });
  notifications.push("Item removed", "success", 2500);
};

const getItemById = (itemId: number | string | null | undefined) =>
  (props.deal.items || []).find(
    (item) => String(item.id) === String(itemId ?? ""),
  ) ?? null;

const normalizeEditableNumber = (value: unknown, fallback: number | null) => {
  if (value === null || value === undefined || value === "") return fallback;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildOverridePayload = (): DealItemOverride => {
  const payload: DealItemOverride = {
    name: editLine.name.trim(),
    category: editLine.category.trim() || null,
    note: editLine.note.trim() || null,
  };

  if (editLine.canEditQuantity)
    payload.quantity = normalizeEditableNumber(editLine.quantity, null);
  if (editLine.canEditPrice)
    payload.unitPrice = normalizeEditableNumber(editLine.unitPrice, null);
  if (editLine.canEditDiscount)
    payload.discountPercent = normalizeEditableNumber(
      editLine.discountPercent,
      0,
    );
  if (editLine.canEditTax) payload.taxApplicable = editLine.taxApplicable;

  return payload;
};

const setEditFieldConstraints = (options: {
  quantity: boolean;
  price: boolean;
  discount: boolean;
  tax: boolean;
  info?: boolean;
}) => {
  editLine.canEditQuantity = options.quantity;
  editLine.canEditPrice = options.price;
  editLine.canEditDiscount = options.discount;
  editLine.canEditTax = options.tax;
  editLine.canEditInfo = options.info ?? true;
};

const openEditItem = (item: DealItemWithPlan) => {
  const isGeneratedRelatedItem =
    item.catalogueType === "Related Item" &&
    !!item.parentItemId &&
    !!item.sourceRelatedItemId &&
    !getItemById(item.panelId);

  if (isGeneratedRelatedItem) {
    const overrideKey = `related-${item.sourceRelatedItemId}`;
    const parent = getItemById(item.parentItemId);
    const override = parent?.subItemOverrides?.[overrideKey] || {};

    editLine.mode = "sub";
    editLine.itemId = null;
    editLine.parentItemId = Number(item.parentItemId);
    editLine.overrideKey = overrideKey;
    editLine.title = item.name;
    editLine.name = override.name ?? item.name;
    editLine.category = override.category ?? item.category ?? "";
    editLine.quantity = override.quantity ?? item.quantity ?? 1;
    editLine.unitPrice = override.unitPrice ?? item.unitPrice ?? 0;
    editLine.discountPercent = override.discountPercent ?? 0;
    editLine.taxApplicable =
      override.taxApplicable ?? item.taxApplicable ?? null;
    editLine.note = override.note ?? item.note ?? "";
    setEditFieldConstraints({
      quantity: true,
      price: true,
      discount: true,
      tax: true,
      info: true,
    });
    editLineDialogVisible.value = true;

    return;
  }

  editLine.mode = "item";
  editLine.itemId = Number(item.id);
  editLine.parentItemId = null;
  editLine.overrideKey = "";
  editLine.title = item.name;
  editLine.name = item.name;
  editLine.category = item.category ?? "";
  editLine.quantity = item.quantity ?? 1;
  editLine.unitPrice = item.unitPrice ?? 0;
  editLine.discountPercent = item.discountPercent ?? 0;
  editLine.taxApplicable = item.taxApplicable ?? null;
  editLine.note = item.note ?? "";
  setEditFieldConstraints({
    quantity: true,
    price: true,
    discount: true,
    tax: true,
    info: true,
  });
  editLineDialogVisible.value = true;
};

const openEditGoal = (parentItem: DealItemWithPlan, goal: DerivedGoal) => {
  if (goal.overrideKey.includes("-custom-")) {
    openEditCustomPhase(parentItem, goal);
    return;
  }

  const sourceItem = getItemById(parentItem.id);
  const override = sourceItem?.subItemOverrides?.[goal.overrideKey] || {};

  editLine.mode = "sub";
  editLine.itemId = null;
  editLine.parentItemId = Number(parentItem.id);
  editLine.overrideKey = goal.overrideKey;
  editLine.title = goal.name;
  editLine.name = override.name ?? goal.name;
  editLine.category = override.category ?? goal.category ?? "";
  editLine.quantity = override.quantity ?? goal.quantity ?? 1;
  editLine.unitPrice = override.unitPrice ?? goal.price ?? 0;
  editLine.discountPercent =
    override.discountPercent ?? goal.discountPercent ?? 0;
  editLine.taxApplicable = override.taxApplicable ?? goal.taxApplicable ?? null;
  editLine.note = override.note ?? goal.note ?? "";
  setEditFieldConstraints({
    quantity: goal.showQuantity,
    price: goal.showPrice,
    discount: goal.showDiscount,
    tax: goal.showTaxApplicable,
    info: true, // Always allow editing info (Name/Note) for all goal types
  });
  editLineDialogVisible.value = true;
};

const saveEditedLine = async () => {
  const { valid } = (await editLineFormRef.value?.validate()) ?? {
    valid: true,
  };
  if (!valid) return;

  const payload = buildOverridePayload();
  const nextItems = (props.deal.items || []).map((item) => {
    if (editLine.mode === "item" && item.id === editLine.itemId) {
      return {
        ...item,
        name: payload.name || item.name,
        category: payload.category,
        quantity: payload.quantity ?? item.quantity,
        unitPrice:
          payload.unitPrice === undefined ? item.unitPrice : payload.unitPrice,
        discountPercent:
          payload.discountPercent === undefined
            ? item.discountPercent
            : payload.discountPercent,
        taxApplicable:
          payload.taxApplicable === undefined
            ? item.taxApplicable
            : payload.taxApplicable,
        note: payload.note,
      };
    }

    if (editLine.mode === "sub" && item.id === editLine.parentItemId) {
      return {
        ...item,
        subItemOverrides: {
          ...(item.subItemOverrides || {}),
          [editLine.overrideKey]: payload,
        },
      };
    }

    return item;
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  editLineDialogVisible.value = false;
  notifications.push("Item updated for this deal", "success", 2500);
};

const isProductLike = (type?: string | null) =>
  type === "Product" ||
  type === "Produced Product" ||
  type === "Rental" ||
  type === "Onetime Service" ||
  type === "Related Item";

const formatMoney = (value?: number | null) =>
  value === null || value === undefined ? "--" : Number(value).toLocaleString();

const formatTaxApplicable = (value: boolean | null) => {
  if (value === null) return "--";

  return value ? "Yes" : "No";
};

const formatPercent = (value?: number | null) =>
  value === null || value === undefined ? "--" : `${Number(value)}%`;

const formatDocumentDate = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "--";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const calculateAmount = (
  price?: number | null,
  quantity?: number | null,
  discountPercent = 0,
) => {
  if (price === null || price === undefined) return null;

  const normalizedQuantity =
    quantity === null || quantity === undefined ? 1 : Number(quantity);
  const subtotal = Number(price) * normalizedQuantity;
  const discount = subtotal * (Number(discountPercent || 0) / 100);

  return subtotal - discount;
};

const itemAmount = (item: DealItem) =>
  calculateAmount(item.unitPrice, item.quantity, item.discountPercent || 0);

const goalAmount = (goal: DerivedGoal) =>
  calculateAmount(goal.price, goal.quantity, goal.discountPercent || 0);

const formatGoalDiscount = (goal: DerivedGoal) =>
  goal.discountPercent === null || goal.discountPercent === undefined
    ? goal.discountLabel
    : formatPercent(goal.discountPercent);

const applySubItemOverride = (
  item: DealItem,
  overrideKey: string,
  goal: DerivedGoal,
): DerivedGoal => {
  const override = item.subItemOverrides?.[overrideKey];
  if (!override) return goal;

  return {
    ...goal,
    name: override.name ?? goal.name,
    category: override.category ?? goal.category,
    note: override.note ?? goal.note,
    price: override.unitPrice ?? goal.price,
    quantity: override.quantity ?? goal.quantity,
    discountPercent: override.discountPercent ?? goal.discountPercent,
    discountLabel:
      override.discountPercent === null ||
      override.discountPercent === undefined
        ? goal.discountLabel
        : formatPercent(override.discountPercent),
    taxApplicable: override.taxApplicable ?? goal.taxApplicable,
  };
};

const makeDerivedGoal = (
  item: DealItem,
  prefix: string,
  typeLabel: string,
  display: {
    quantity: number | null;
    discountPercent?: number | null;
    discountLabel: string | null;
    taxApplicable: boolean | null;
    showQuantity: boolean;
    showPrice: boolean;
    showDiscount: boolean;
    showTaxApplicable: boolean;
  },
  source: {
    id: number | string;
    name: string;
    category?: string | null;
    description?: string | null;
    note?: string | null;
    price?: number | null;
    qty?: number | null;
    chargeTax?: boolean | null;
  },
): DerivedGoal => ({
  id: `${prefix}-${item.id}-${source.id}`,
  overrideKey: `${prefix}-${source.id}`,
  name: source.name,
  category: source.category ?? null,
  note: source.note ?? source.description ?? null,
  price: source.price ?? null,
  typeLabel,
  discountPercent: display.discountPercent ?? null,
  ...display,
});

const makeSection = (
  item: DealItem,
  section: Omit<DerivedSection, "id">,
): DerivedSection => ({
  id: `item-${item.id}`,
  ...section,
});

const deriveSections = (item: DealItem): DerivedSection[] => {
  const record = item.catalogueItemId
    ? cataloguesStore.recordById(
        item.catalogueItemId,
        item.catalogueType || undefined,
      )
    : null;

  if (!record) {
    return [
      makeSection(item, {
        name: item.name,
        note: item.note || null,
        price: item.unitPrice ?? null,
        goals: [],
        goalTypeSingular: itemTypeLabel(item),
        goalTypePlural: `${itemTypeLabel(item)}s`,
      }),
    ];
  }

  if (record.type === "Contractual Service") {
    const contractual = record as CatalogueContractualServiceRecord;

    return [
      makeSection(item, {
        name: contractual.name,
        note: contractual.description || null,
        price: contractual.bestPrice,
        goals: getDealContractualPhaseLines(item, contractual).map((phase) => ({
          ...makeDerivedGoal(
            item,
            "phase",
            "Phase",
            {
              quantity: phase.quantity,
              discountPercent: phase.discountPercent,
              discountLabel: formatPercent(phase.discountPercent ?? 0),
              taxApplicable: phase.taxApplicable,
              showQuantity: true,
              showPrice: true,
              showDiscount: true,
              showTaxApplicable: true,
            },
            {
              category: phase.category,
              description: phase.note,
              id: phase.id,
              name: phase.name,
              note: phase.note,
              price: phase.price,
            },
          ),
          overrideKey: phase.overrideKey,
        })),
        goalTypeSingular: "Phase",
        goalTypePlural: "Phases",
      }),
    ];
  }

  if (record.type === "Retainer Service") {
    const retainer = record as CatalogueRetainerServiceRecord;
    const retainerLines = getDealRetainerServiceLines(item, retainer);

    return [
      makeSection(item, {
        name: retainer.name,
        note: retainer.description || null,
        price: retainer.bestPrice,
        goals: retainerLines.map((service) => ({
          ...makeDerivedGoal(
            item,
            "retainer",
            "Retainer Service",
            {
              quantity: service.quantity,
              discountPercent: service.discountPercent,
              discountLabel: null,
              taxApplicable: service.taxApplicable,
              showQuantity: true,
              showPrice: true,
              showDiscount: false,
              showTaxApplicable: false,
            },
            {
              id: service.id,
              name: service.name,
              category: service.category,
              description: service.note,
              note: service.note,
              price: service.price,
            },
          ),
          overrideKey: service.overrideKey,
        })),
        goalTypeSingular: "Retainer Service",
        goalTypePlural: "Retainer Services",
      }),
    ];
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;
    const recurrentLines = getDealRecurrentServiceLines(item, recurrent);

    return [
      makeSection(item, {
        name: recurrent.name,
        note: recurrent.description || null,
        price: recurrent.bestPrice,
        goals: recurrentLines.map((service) => ({
          ...makeDerivedGoal(
            item,
            "recurrent",
            "Recurrent Service",
            {
              quantity: service.quantity,
              discountPercent: service.discountPercent,
              discountLabel: null,
              taxApplicable: service.taxApplicable,
              showQuantity: false,
              showPrice: true,
              showDiscount: false,
              showTaxApplicable: false,
            },
            {
              id: service.id,
              name: service.name,
              category: service.category,
              description: service.note,
              note: service.note,
              price: service.price,
            },
          ),
          overrideKey: service.overrideKey,
        })),
        goalTypeSingular: "Recurrent Service",
        goalTypePlural: "Recurrent Services",
      }),
    ];
  }

  if (record.type === "Onetime Service") {
    const service = record as CatalogueOnetimeServiceRecord;

    return [
      makeSection(item, {
        name: service.name,
        note: service.description || null,
        price: service.bestPrice,
        goals: [],
        goalTypeSingular: "Related Item",
        goalTypePlural: "Related Items",
      }),
    ];
  }

  if (record.type === "Produced Product") {
    const produced = record as CatalogueProducedProductRecord;

    return [
      makeSection(item, {
        name: produced.name,
        note: produced.description || null,
        price: produced.bestPrice,
        goals: [],
        goalTypeSingular: "Item",
        goalTypePlural: "Items",
      }),
    ];
  }

  const product = record as CatalogueProductRecord;

  if (isProductLike(product.type)) {
    return [
      makeSection(item, {
        name: product.name,
        note: product.description || null,
        price: product.bestPrice,
        goals: [],
        goalTypeSingular: "Item",
        goalTypePlural: "Items",
      }),
    ];
  }

  return [
    makeSection(item, {
      name: item.name,
      note: item.note || null,
      price: item.unitPrice ?? null,
      goals: [],
      goalTypeSingular: "Item",
      goalTypePlural: "Items",
    }),
  ];
};

const deriveRelatedItemMilestones = (item: DealItem): DealItemWithPlan[] => {
  if (item.catalogueType === "Related Item" || item.parentItemId) return [];

  const alreadyMaterialized = (props.deal.items || []).some(
    (existingItem) =>
      existingItem.parentItemId === item.id &&
      existingItem.catalogueType === "Related Item",
  );

  if (alreadyMaterialized) return [];

  const record = item.catalogueItemId
    ? cataloguesStore.recordById(
        item.catalogueItemId,
        item.catalogueType || undefined,
      )
    : null;

  if (!record || record.type !== "Onetime Service") return [];

  const service = record as CatalogueOnetimeServiceRecord;
  const excluded = new Set(item.excludedRelatedItemIds || []);

  return (service.relatedItems || [])
    .filter((relatedItem) => !excluded.has(relatedItem.id))
    .map((relatedItem) => {
      const overrideKey = `related-${relatedItem.id}`;
      const override = item.subItemOverrides?.[overrideKey] || {};

      return {
        id: item.id,
        panelId: `related-${item.id}-${relatedItem.id}`,
        name: override.name ?? relatedItem.name,
        itemTypeLabel: "Related Item",
        category: override.category ?? relatedItem.category,
        catalogueItemId: item.catalogueItemId,
        catalogueType: "Related Item",
        parentItemId: item.id,
        sourceRelatedItemId: relatedItem.id,
        quantity: override.quantity ?? item.quantity,
        unitPrice: override.unitPrice ?? relatedItem.price ?? null,
        discountPercent: override.discountPercent ?? 0,
        taxApplicable: override.taxApplicable ?? relatedItem.chargeTax,
        status: item.status,
        note: override.note ?? relatedItem.description ?? null,
        isExpandable: false,
        derivedSections: [
          makeSection(item, {
            name: override.name ?? relatedItem.name,
            note: override.note ?? relatedItem.description ?? null,
            price: override.unitPrice ?? relatedItem.price ?? null,
            goals: [],
            goalTypeSingular: "Related Item",
            goalTypePlural: "Related Items",
          }),
        ],
        childTypeSingular: "Related Item",
        childTypePlural: "Related Items",
        childCount: 0,
        actionsEnabled: true,
      };
    });
};

const dealItemsWithPlan = computed<DealItemWithPlan[]>(() =>
  (props.deal.items || []).flatMap((item) => {
    const derivedSections = deriveSections(item);
    const relatedItemMilestones = deriveRelatedItemMilestones(item);
    const [firstSection] = derivedSections;

    const primaryItem: DealItemWithPlan = {
      ...item,
      panelId: item.id,
      isExpandable: !isProductLike(item.catalogueType),
      derivedSections,
      childTypeSingular: firstSection?.goalTypeSingular || "Item",
      childTypePlural: firstSection?.goalTypePlural || "Items",
      childCount:
        item.catalogueType === "Onetime Service"
          ? relatedItemMilestones.length
          : derivedSections.reduce(
              (sum, section) => sum + section.goals.length,
              0,
            ),
      actionsEnabled: true,
    };

    return [primaryItem, ...relatedItemMilestones];
  }),
);

const derivedGoalsForItem = (item: DealItemWithPlan) =>
  item.derivedSections.flatMap((section) => section.goals);

const toggleItemExpanded = (panelId: number | string) => {
  const index = expandedItems.value.findIndex(
    (value) => String(value) === String(panelId),
  );

  if (index >= 0) {
    expandedItems.value = expandedItems.value.filter(
      (value) => String(value) !== String(panelId),
    );

    return;
  }

  expandedItems.value = [...expandedItems.value, panelId];
};

const itemsSubtotal = computed(() => getDealItemsSubtotal(props.deal));

const totalDiscount = computed(() => getDealDiscountTotal(props.deal));
const totalTax = computed(() => 0);
const grandTotal = computed(
  () => getDealGrandTotal(props.deal) + totalTax.value,
);
const financialRows = computed(() => props.deal.financials || []);
const totalQuoted = computed(() =>
  financialRows.value
    .filter((entry) => entry.type === "quotation" || entry.type === "invoice")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);
const totalInvoiced = computed(() =>
  invoicesStore.items
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .reduce((sum, record) => sum + Number(record.quotation.total || 0), 0),
);
const totalPaid = computed(() =>
  financialRows.value
    .filter(
      (entry) =>
        entry.type === "payment" &&
        String(entry.status || "").toLowerCase() === "received",
    )
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);
const remainingToInvoice = computed(() =>
  Math.max(grandTotal.value - totalInvoiced.value, 0),
);
const dealItems = computed(() => props.deal.items || []);
const billableRootItems = computed(() =>
  getBillableRootDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const quotationItems = computed(() =>
  getQuotationTopLevelDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const selectableDocumentItems = computed(() =>
  getSelectableDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const billingMode = computed<DealDocumentBillingMode>(() =>
  resolveDealDocumentBillingMode(billableRootItems.value),
);
const effectiveBillingMode = computed<DealDocumentBillingMode>(
  () => selectedBillingMode.value ?? billingMode.value,
);
const contact = computed(() => {
  if (!props.deal.relatedTo) return null;

  return contactsStore.byId(props.deal.relatedTo) ?? null;
});

const sortDealDocumentRecords = <T extends DealDocumentContainer>(
  records: T[],
) =>
  [...records]
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .sort((left, right) => {
      const leftTime = new Date(left.quotation.issuedDate || 0).getTime();
      const rightTime = new Date(right.quotation.issuedDate || 0).getTime();

      if (leftTime !== rightTime) return rightTime - leftTime;

      return Number(right.quotation.id) - Number(left.quotation.id);
    });

const mapDealDocumentPanelRecord = <T extends DealDocumentContainer>(
  record: T,
): DealDocumentPanelRecord => ({
  id: record.quotation.id,
  issuedDate: record.quotation.issuedDate,
  quoteNumber: record.quotation.quoteNumber,
  status: record.quotation.quotationStatus,
  total: Number(record.quotation.total || 0),
});

const dealQuotationRecords = computed(() =>
  sortDealDocumentRecords(quotationsStore.items).map(
    mapDealDocumentPanelRecord,
  ),
);
const dealProformaRecords = computed(() =>
  sortDealDocumentRecords(proformasStore.items).map(mapDealDocumentPanelRecord),
);
const dealInvoiceRecords = computed(() =>
  sortDealDocumentRecords(invoicesStore.items).map(mapDealDocumentPanelRecord),
);
const quotationCount = computed(() => dealQuotationRecords.value.length);
const proformaCount = computed(() => dealProformaRecords.value.length);
const invoiceCount = computed(() => dealInvoiceRecords.value.length);

const dealDocumentPanels = computed<DealDocumentPanel[]>(() => [
  {
    count: dealQuotationRecords.value.length,
    emptyText: "No quotations created yet.",
    key: "quotation",
    latest: dealQuotationRecords.value[0] ?? null,
    records: dealQuotationRecords.value,
    title: "Quotations",
  },
  {
    count: dealProformaRecords.value.length,
    emptyText: "No proformas created yet.",
    key: "proforma",
    latest: dealProformaRecords.value[0] ?? null,
    records: dealProformaRecords.value,
    title: "Proformas",
  },
  {
    count: dealInvoiceRecords.value.length,
    emptyText: "No invoices created yet.",
    key: "invoice",
    latest: dealInvoiceRecords.value[0] ?? null,
    records: dealInvoiceRecords.value,
    title: "Invoices",
  },
]);

const resolvedActiveDocumentPanelKey = computed<DealPreviewKind | null>(() => {
  if (
    activeDocumentPanelKey.value &&
    dealDocumentPanels.value.some(
      (panel) => panel.key === activeDocumentPanelKey.value,
    )
  ) {
    return activeDocumentPanelKey.value;
  }

  return null;
});

const isDocumentPanelExpanded = (key: DealPreviewKind) =>
  resolvedActiveDocumentPanelKey.value === key;

const setActiveDocumentPanel = (key: DealPreviewKind) => {
  activeDocumentPanelKey.value =
    activeDocumentPanelKey.value === key ? null : key;
};

const getPreviewRouteName = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "apps-quotation-preview-id";
  if (kind === "proforma") return "apps-proforma-preview-id";

  return "apps-invoice-preview-id";
};

const openQuickDocumentPreview = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  const route = router.resolve({
    name: getPreviewRouteName(kind),
    params: { id: record.id },
    query: { quickPreview: "1" },
  });

  selectedPreviewDocument.value = {
    href: route.href,
    id: record.id,
    kind,
    title: record.quoteNumber || `${kind.toUpperCase()} #${record.id}`,
  };
  previewDialogVisible.value = true;
};

const openSelectedPreviewInPage = () => {
  if (!selectedPreviewDocument.value) return;

  router.push({
    name: getPreviewRouteName(selectedPreviewDocument.value.kind),
    params: { id: selectedPreviewDocument.value.id },
  });
};

const resolveProductSelectionKey = (product: {
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodKey?: string | null;
  catalogueItemId?: string | null;
  cost?: number | null;
  dealSelectionKey?: string | null;
  hours?: number | null;
  title?: string | null;
}) => {
  const directKey = String(product.dealSelectionKey ?? "").trim();
  if (directKey) return directKey;

  const matches = selectableDocumentItems.value.filter((item) => {
    const sameTitle = item.name.trim() === String(product.title ?? "").trim();
    const sameCatalogueItemId =
      String(item.catalogueItemId ?? "") ===
      String(product.catalogueItemId ?? "");
    const sameHours = Number(item.quantity ?? 1) === Number(product.hours ?? 1);
    const sameCost = Number(item.unitPrice ?? 0) === Number(product.cost ?? 0);

    return sameTitle && sameCatalogueItemId && sameHours && sameCost;
  });

  return matches.length === 1 ? matches[0].selectionKey : "";
};

const resolveSelectableItemBillingPeriodKey = (
  selectionKey?: string | null,
) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return "";

  const selectableItem = selectableDocumentItems.value.find(
    (item) => item.selectionKey === normalizedSelectionKey,
  );
  if (!selectableItem) return "";

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  return itemMode === "retainer-period" || itemMode === "recurrent-period"
    ? getDealBillingPeriodKey(billingPeriod.value)
    : "";
};

const isPeriodBasedSelectableItem = (selectionKey?: string | null) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return false;

  const selectableItem = selectableDocumentItems.value.find(
    (item) => item.selectionKey === normalizedSelectionKey,
  );
  if (!selectableItem) return false;

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  return itemMode === "retainer-period" || itemMode === "recurrent-period";
};

const proformaUsageBySelectionKey = computed(() => {
  const usage = new Map<string, number>();

  proformasStore.items.forEach((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id)) return;

    record.purchasedProducts.forEach((product) => {
      const selectionKey = resolveProductSelectionKey(product);
      const usageKey = buildDealDocumentUsageKey(
        selectionKey,
        resolveStoredBillingPeriodKey(product),
      );
      if (!usageKey) return;

      usage.set(usageKey, (usage.get(usageKey) ?? 0) + 1);
    });
  });

  return usage;
});

const invoiceUsageBySelectionKey = computed(() => {
  const usage = new Map<string, number>();

  invoicesStore.items.forEach((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id)) return;

    record.purchasedProducts.forEach((product) => {
      const selectionKey = resolveProductSelectionKey(product);
      const usageKey = buildDealDocumentUsageKey(
        selectionKey,
        resolveStoredBillingPeriodKey(product),
      );
      if (!usageKey) return;

      usage.set(usageKey, (usage.get(usageKey) ?? 0) + 1);
    });
  });

  return usage;
});

const getDocumentUsage = (
  selectionKey?: string | null,
  billingPeriodKey?: string | null,
) => {
  const usageKey = buildDealDocumentUsageKey(selectionKey, billingPeriodKey);
  if (!usageKey) return { invoiceCount: 0, proformaCount: 0 };

  return {
    invoiceCount: invoiceUsageBySelectionKey.value.get(usageKey) ?? 0,
    proformaCount: proformaUsageBySelectionKey.value.get(usageKey) ?? 0,
  };
};

const isSelectionDocumentActionDisabled = (selectionKey?: string | null) => {
  if (isPeriodBasedSelectableItem(selectionKey)) return false;

  const usage = getDocumentUsage(
    selectionKey,
    resolveSelectableItemBillingPeriodKey(selectionKey),
  );

  if (selectedDocumentKind.value === "invoice") return usage.invoiceCount > 0;
  if (selectedDocumentKind.value === "proforma") return usage.proformaCount > 0;

  return false;
};

const getPeriodSelectionConflicts = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  if (!periodKey) return [] as DealDocumentSelectableItem[];

  return items.filter((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    if (itemMode !== "retainer-period" && itemMode !== "recurrent-period") {
      return false;
    }

    const usage = getDocumentUsage(item.selectionKey, periodKey);

    if (selectedDocumentKind.value === "invoice") return usage.invoiceCount > 0;
    if (selectedDocumentKind.value === "proforma") {
      return usage.proformaCount > 0;
    }

    return false;
  });
};

const findGoalSelectableItem = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) =>
  selectableDocumentItems.value.find(
    (item) =>
      String(item.id) === String(parentItem.id) &&
      item.selectionKey.endsWith(goal.overrideKey),
  ) ?? null;

const getGoalDocumentUsage = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);

  return getDocumentUsage(
    selectableItem?.selectionKey,
    resolveSelectableItemBillingPeriodKey(selectableItem?.selectionKey),
  );
};

const isGoalProformaActionDisabled = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) => getGoalDocumentUsage(parentItem, goal).proformaCount > 0;

const isGoalInvoiceActionDisabled = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) => getGoalDocumentUsage(parentItem, goal).invoiceCount > 0;

const filteredSelectableDocumentItems = computed(() =>
  filterDealDocumentItemsByBillingMode(
    selectableDocumentItems.value,
    effectiveBillingMode.value,
  ),
);

const billingModeOptions = computed(() => {
  const availableModes = Array.from(
    new Set(
      billableRootItems.value
        .map((item) => resolveDealDocumentBillingModeForItem(item))
        .filter((mode) => mode !== "empty" && mode !== "mixed-manual"),
    ),
  ) as DealDocumentBillingMode[];

  return availableModes.map((mode) => ({
    description:
      mode === "simple-root"
        ? "Bill directly from simple top-level items."
        : mode === "contractual-stage"
          ? "Bill by contractual stages."
          : mode === "retainer-period"
            ? "Bill retainer services for a selected period."
            : "Bill recurrent services for a selected period.",
    title:
      mode === "simple-root"
        ? "Simple items"
        : mode === "contractual-stage"
          ? "Contractual stages"
          : mode === "retainer-period"
            ? "Retainer period"
            : "Recurrent period",
    value: mode,
  }));
});

const selectableGroups = computed(() => {
  const groups = new Map<
    string,
    {
      description: string;
      items: DealDocumentSelectableItem[];
      key: string;
      label: string;
    }
  >();

  for (const item of filteredSelectableDocumentItems.value) {
    const description =
      item.groupKey === "billable-root"
        ? "These rows drive quotation and direct invoice/proforma eligibility."
        : "Nested rows are available only through manual selection.";
    const existing = groups.get(item.groupKey);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(item.groupKey, {
      description,
      items: [item],
      key: item.groupKey,
      label: item.groupLabel,
    });
  }

  return Array.from(groups.values());
});

const selectedDocumentItems = computed(() => {
  const selected = new Set(selectedItemIds.value.map((value) => String(value)));

  return filteredSelectableDocumentItems.value.filter(
    (item) =>
      selected.has(String(item.selectionKey)) &&
      !isSelectionDocumentActionDisabled(item.selectionKey),
  );
});

const selectionDialogTitle = computed(() => {
  if (selectedDocumentKind.value === "invoice") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Invoice";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Lines for Invoice";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Lines for Invoice";

    return "Select Items for Invoice";
  }

  if (selectedDocumentKind.value === "proforma") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Proforma";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Lines for Proforma";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Lines for Proforma";

    return "Select Items for Proforma";
  }

  return "Select Items";
});

const selectionDialogIntro = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage") {
    return "Select one or more contractual stages to include in this document.";
  }

  if (effectiveBillingMode.value === "retainer-period") {
    return "Select one or more retainer lines to include in this document.";
  }

  if (effectiveBillingMode.value === "recurrent-period") {
    return "Select one or more recurrent lines to include in this document.";
  }

  return "Select one or more items to include in this document.";
});

const selectionDialogHint = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage") {
    return "Contractual deals bill at stage level. Choose only the stages you want billed in this document.";
  }

  if (effectiveBillingMode.value === "retainer-period") {
    return `Retainer billing uses the selected period. Choose only the service lines you want billed for ${getDealBillingPeriodLabel(billingPeriod.value)}.`;
  }

  if (effectiveBillingMode.value === "recurrent-period") {
    return `Recurrent billing uses the selected period. Choose only the service lines you want billed for ${getDealBillingPeriodLabel(billingPeriod.value)}.`;
  }

  if (effectiveBillingMode.value === "mixed-manual") {
    return "This deal mixes billing bases. Choose any combination of billable rows for this document.";
  }

  return "No rows are preselected. Choose only the rows you want billed.";
});

const getExpandableServiceRecord = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const sourceItem = item ? (getItemById(item.id) ?? item) : null;
  if (!sourceItem?.catalogueItemId) return null;

  const record = cataloguesStore.recordById(
    sourceItem.catalogueItemId,
    sourceItem.catalogueType || undefined,
  );

  if (
    record?.type === "Contractual Service" ||
    record?.type === "Retainer Service" ||
    record?.type === "Reccurent Service"
  )
    return record;

  return null;
};

const getEditableChildLabel = (item?: DealItem | DealItemWithPlan | null) => {
  const record = getExpandableServiceRecord(item);

  if (record?.type === "Contractual Service") return "Phase";
  if (record?.type === "Retainer Service") return "Retainer Service";
  if (record?.type === "Reccurent Service") return "Recurrent Service";

  return "Child";
};

const phaseDialogEntityLabel = computed(() =>
  phaseDraft.parentItemId
    ? getEditableChildLabel(getItemById(phaseDraft.parentItemId))
    : "Child",
);

const phaseDialogTitle = computed(
  () =>
    `${phaseDraft.customPhaseId ? "Edit" : "Add"} ${phaseDialogEntityLabel.value}`,
);

const isRemovableChildGoal = (goal: DerivedGoal) =>
  goal.typeLabel === "Phase" ||
  goal.typeLabel === "Retainer Service" ||
  goal.typeLabel === "Recurrent Service";

const formatItemType = (value?: string | null) => value || "Unknown";

const itemRowOffset = (_item: DealDocumentSelectableItem) => {
  return "0px";
};

const nextIdForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return quotationsStore.nextId();
  if (kind === "proforma") return proformasStore.nextId();

  return invoicesStore.nextId();
};

const routeNameForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return "apps-quotation-add";
  if (kind === "proforma") return "apps-proforma-add";

  return "apps-invoice-add";
};

const resetDocumentWorkflowState = () => {
  billingModeDialogVisible.value = false;
  billingPeriodDialogVisible.value = false;
  selectionDialogVisible.value = false;
  pendingDocumentItems.value = [];
  resetBillingPeriodPrices();
  selectedBillingMode.value = null;
  selectedDocumentKind.value = null;
  selectedItemIds.value = [];
};

const selectionNeedsBillingPeriod = (items: DealDocumentSelectableItem[]) =>
  items.some((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);

    return itemMode === "retainer-period" || itemMode === "recurrent-period";
  });

const pendingBillingPeriodItems = computed(() =>
  pendingDocumentItems.value.filter((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);

    return itemMode === "retainer-period" || itemMode === "recurrent-period";
  }),
);

const getOverrideKeyFromSelectionKey = (selectionKey: string) => {
  const match = selectionKey.match(/^item-\d+-(.+)$/);

  return match?.[1] ?? null;
};

const getStoredBillingPeriodPrice = (
  item: DealDocumentSelectableItem,
  period: DealBillingPeriod,
) => {
  const overrideKey = getOverrideKeyFromSelectionKey(item.selectionKey);
  const periodKey = getDealBillingPeriodKey(period);
  if (!overrideKey || !periodKey) return null;

  const value =
    item.subItemOverrides?.[overrideKey]?.periodUnitPrices?.[periodKey];
  if (value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
};

const resetBillingPeriodPrices = () => {
  Object.keys(billingPeriodPrices).forEach((key) => {
    delete billingPeriodPrices[key];
  });
};

const initializeBillingPeriodPrices = (
  items: DealDocumentSelectableItem[],
  period = billingPeriod.value,
) => {
  resetBillingPeriodPrices();

  items.forEach((item) => {
    billingPeriodPrices[item.selectionKey] = Number(
      getStoredBillingPeriodPrice(item, period) ?? item.unitPrice ?? 0,
    );
  });
};

const applyBillingPeriodPricing = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  if (!periodKey) return items;

  const updatedPrices = new Map<string, number>();

  items.forEach((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
      return;

    const numeric = Number(billingPeriodPrices[item.selectionKey]);
    updatedPrices.set(
      item.selectionKey,
      Number.isFinite(numeric) ? numeric : 0,
    );
  });

  if (!updatedPrices.size) return items;

  const nextItems = (props.deal.items || []).map((item) => {
    const nextOverrides = { ...(item.subItemOverrides || {}) };
    let hasChanges = false;

    Object.keys(nextOverrides).forEach((overrideKey) => {
      const selectionKey = `item-${item.id}-${overrideKey}`;
      const nextPrice = updatedPrices.get(selectionKey);
      if (nextPrice === undefined) return;

      const currentOverride = nextOverrides[overrideKey] || {};
      nextOverrides[overrideKey] = {
        ...currentOverride,
        unitPrice: nextPrice,
        periodUnitPrices: {
          ...(currentOverride.periodUnitPrices || {}),
          [periodKey]: nextPrice,
        },
      };
      hasChanges = true;
    });

    return hasChanges
      ? {
          ...item,
          subItemOverrides: nextOverrides,
        }
      : item;
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });

  return items.map((item) => {
    const nextPrice = updatedPrices.get(item.selectionKey);
    if (nextPrice === undefined) return item;

    return {
      ...item,
      unitPrice: nextPrice,
    };
  });
};

const saveAndNavigateDocumentDraft = async (
  kind: DealDocumentKind,
  selectedItems: DealDocumentSelectableItem[],
) => {
  if (!selectedItems.length) {
    notifications.push("This deal has no billable items yet", "warning", 2500);
    return;
  }

  const draft = buildDealDocumentDraftRecord(kind, {
    billingPeriod: selectionNeedsBillingPeriod(selectedItems)
      ? billingPeriod.value
      : null,
    contact: contact.value,
    deal: props.deal,
    financial: configStore.financial,
    legal: configStore.legal,
    nextId: nextIdForDocument(kind),
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    selectedItems,
  });

  saveDealDocumentDraft(kind, draft);

  await router.push({
    name: routeNameForDocument(kind),
    query: { dealDraft: "1" },
  });

  resetDocumentWorkflowState();
};

const openGoalDocumentPage = async (
  kind: Extract<DealDocumentKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);

  if (!selectableItem) {
    notifications.push(
      "Could not resolve this item for document creation.",
      "warning",
      3000,
    );
    return;
  }

  await saveAndNavigateDocumentDraft(kind, [selectableItem]);
};

const openSelectionDialog = (
  kind: DealDocumentKind,
  mode: DealDocumentBillingMode = billingMode.value,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  selectedItemIds.value = [];
  selectionDialogVisible.value = true;
};

const openBillingPeriodDialog = (
  kind: DealDocumentKind,
  mode: Extract<
    DealDocumentBillingMode,
    "retainer-period" | "recurrent-period"
  >,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  syncBillingPeriodDraft();
  initializeBillingPeriodPrices(pendingBillingPeriodItems.value);
  billingPeriodDialogVisible.value = true;
};

const confirmBillingPeriod = () => {
  if (!selectedDocumentKind.value) return;

  const nextBillingPeriod = commitBillingPeriod();
  if (!getDealBillingPeriodKey(nextBillingPeriod)) {
    notifications.push("Select a billing period first", "warning", 2500);
    return;
  }

  const conflictingItems = getPeriodSelectionConflicts(
    pendingDocumentItems.value,
    nextBillingPeriod,
  );
  if (conflictingItems.length) {
    const conflictingNames = conflictingItems
      .slice(0, 2)
      .map((item) => item.name)
      .join(", ");
    const conflictSuffix = conflictingItems.length > 2 ? " and more" : "";

    notifications.push(
      `${conflictingNames}${conflictSuffix} already used for ${getDealBillingPeriodLabel(nextBillingPeriod)}.`,
      "warning",
      3500,
    );
    return;
  }

  billingPeriodDialogVisible.value = false;

  if (pendingDocumentItems.value.length) {
    const kind = selectedDocumentKind.value;
    const items = applyBillingPeriodPricing(
      [...pendingDocumentItems.value],
      nextBillingPeriod,
    );

    pendingDocumentItems.value = [];
    void saveAndNavigateDocumentDraft(kind, items);
    return;
  }

  openSelectionDialog(selectedDocumentKind.value, effectiveBillingMode.value);
};

const confirmBillingModeSelection = () => {
  if (!selectedDocumentKind.value || !selectedBillingMode.value) {
    notifications.push("Choose a billing basis first", "warning", 2500);
    return;
  }

  billingModeDialogVisible.value = false;

  openSelectionDialog(selectedDocumentKind.value, selectedBillingMode.value);
};

const closeSelectionDialog = () => {
  selectionDialogVisible.value = false;
  if (!billingModeDialogVisible.value && !billingPeriodDialogVisible.value) {
    selectedBillingMode.value = null;
    selectedDocumentKind.value = null;
  }
  selectedItemIds.value = [];
};

const confirmSelectedDocumentItems = async () => {
  if (!selectedDocumentKind.value || !selectedDocumentItems.value.length)
    return;

  const kind = selectedDocumentKind.value;
  const items = [...selectedDocumentItems.value];

  if (selectionNeedsBillingPeriod(items)) {
    pendingDocumentItems.value = items;
    initializeBillingPeriodPrices(
      items.filter((item) => {
        const itemMode = resolveDealDocumentBillingModeForItem(item);

        return (
          itemMode === "retainer-period" || itemMode === "recurrent-period"
        );
      }),
    );
    selectionDialogVisible.value = false;
    billingPeriodDialogVisible.value = true;
    return;
  }

  selectionDialogVisible.value = false;
  await saveAndNavigateDocumentDraft(kind, items);
};

const openDocumentPage = async (kind: DealDocumentKind) => {
  if (kind !== "quotation") {
    if (billingMode.value === "simple-root") {
      await saveAndNavigateDocumentDraft(kind, billableRootItems.value);
      return;
    }

    if (billingMode.value === "contractual-stage") {
      openSelectionDialog(kind, "contractual-stage");
      return;
    }

    if (billingMode.value === "retainer-period") {
      openSelectionDialog(kind, "retainer-period");
      return;
    }

    if (billingMode.value === "recurrent-period") {
      openSelectionDialog(kind, "recurrent-period");
      return;
    }

    openSelectionDialog(kind, "mixed-manual");
    return;
  }

  const selectedItems = quotationItems.value;

  if (selectedItems.length) {
    await saveAndNavigateDocumentDraft(kind, selectedItems);
    return;
  }

  await router.push({ name: routeNameForDocument(kind) });
};

const openAddPhase = (item: DealItemWithPlan) => {
  const record = getExpandableServiceRecord(item);
  if (!record) return;

  phaseDraft.parentItemId = Number(item.id);
  phaseDraft.customPhaseId = null;
  phaseDraft.name = "";
  phaseDraft.category = item.category ?? "";
  phaseDraft.quantity = item.quantity ?? 1;
  phaseDraft.price = 0;
  phaseDraft.discountPercent = 0;
  phaseDraft.taxApplicable = record.chargeTax;
  phaseDraft.note = item.note ?? record.description ?? "";
  phaseDialogVisible.value = true;
};

const openEditCustomPhase = (item: DealItemWithPlan, goal: DerivedGoal) => {
  const sourceItem = getItemById(item.id);
  const customPhase = sourceItem?.customPhases?.find(
    (phase) =>
      `phase-custom-${phase.id}` === goal.overrideKey ||
      `retainer-custom-${phase.id}` === goal.overrideKey ||
      `recurrent-custom-${phase.id}` === goal.overrideKey,
  );
  if (!customPhase) return;

  phaseDraft.parentItemId = Number(item.id);
  phaseDraft.customPhaseId = customPhase.id;
  phaseDraft.name = customPhase.name;
  phaseDraft.category = customPhase.category ?? goal.category ?? "";
  phaseDraft.quantity = customPhase.quantity ?? goal.quantity ?? 1;
  phaseDraft.price = customPhase.price ?? goal.price ?? 0;
  phaseDraft.discountPercent =
    customPhase.discountPercent ?? goal.discountPercent ?? 0;
  phaseDraft.taxApplicable =
    customPhase.taxApplicable ?? goal.taxApplicable ?? null;
  phaseDraft.note = customPhase.note ?? goal.note ?? "";
  phaseDialogVisible.value = true;
};

const savePhase = async () => {
  const { valid } = (await phaseFormRef.value?.validate()) ?? { valid: true };
  if (!valid || !phaseDraft.parentItemId) return;

  const parentItem = getItemById(phaseDraft.parentItemId);
  if (!parentItem) return;

  const nextItems = (props.deal.items || []).map((item) => {
    if (item.id !== phaseDraft.parentItemId) return item;

    const existingCustomPhases = Array.isArray(item.customPhases)
      ? item.customPhases.map((phase) => ({ ...phase }))
      : [];

    const nextPhase: DealCustomPhase = {
      id: phaseDraft.customPhaseId ?? `${Date.now()}`,
      name: phaseDraft.name.trim(),
      category: phaseDraft.category.trim() || null,
      quantity: Number(phaseDraft.quantity || 1),
      price: Number(phaseDraft.price || 0),
      discountPercent: Number(phaseDraft.discountPercent || 0),
      taxApplicable: phaseDraft.taxApplicable,
      note: phaseDraft.note.trim() || null,
    };

    const customPhases = phaseDraft.customPhaseId
      ? existingCustomPhases.map((phase) =>
          phase.id === phaseDraft.customPhaseId ? nextPhase : phase,
        )
      : [...existingCustomPhases, nextPhase];

    return {
      ...item,
      customPhases,
    };
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  phaseDialogVisible.value = false;
  notifications.push(
    `${phaseDialogEntityLabel.value} ${phaseDraft.customPhaseId ? "updated" : "added"}`,
    "success",
    2500,
  );
};

const removeGoal = (parentItem: DealItemWithPlan, goal: DerivedGoal) => {
  if (!isRemovableChildGoal(goal)) {
    notifications.push(
      "Remove is only available for item children.",
      "info",
      2500,
    );
    return;
  }

  const nextItems = (props.deal.items || []).map((item) => {
    if (item.id !== parentItem.id) return item;

    if (goal.overrideKey.includes("-custom-")) {
      return {
        ...item,
        customPhases: (item.customPhases || []).filter(
          (phase) =>
            `phase-custom-${phase.id}` !== goal.overrideKey &&
            `retainer-custom-${phase.id}` !== goal.overrideKey &&
            `recurrent-custom-${phase.id}` !== goal.overrideKey,
        ),
      };
    }

    const phaseId = Number(goal.overrideKey.replace(/^[^-]+-/, ""));
    const removedPhaseIds = new Set(item.removedPhaseIds || []);
    if (Number.isFinite(phaseId)) removedPhaseIds.add(phaseId);

    const nextOverrides = { ...(item.subItemOverrides || {}) };
    delete nextOverrides[goal.overrideKey];

    return {
      ...item,
      removedPhaseIds: Array.from(removedPhaseIds),
      subItemOverrides: Object.keys(nextOverrides).length
        ? nextOverrides
        : null,
    };
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  notifications.push(
    `${getEditableChildLabel(parentItem)} removed`,
    "success",
    2500,
  );
};

type DealTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
};

type DealSalesTaskRow = {
  id: number | string;
  title: string;
  afterWhen: string | null;
  startTrigger: ToDo["startTrigger"];
  notes: string;
  collaborators: ToDo["collaborators"];
  important: boolean;
  status: Status;
  isImported: boolean;
};

const dealTodos = computed<DealTodo[]>(
  () =>
    (todosStore.items || []).filter((todo) => {
      if (!todo?.relatedTo) return false;

      return (
        String(todo.relatedTo.id) === String(props.deal.id) &&
        todo.relatedTo.type === "deal"
      );
    }) as DealTodo[],
);

const manualDealSalesTodos = computed<DealTodo[]>(() =>
  dealTodos.value.filter((todo) => {
    const milestoneId = String(todo.milestoneId ?? "").trim();
    const goalId = String(todo.goalId ?? "").trim();

    return !milestoneId && !goalId;
  }),
);

const buildEditableSalesTasks = (): DealSalesTaskTemplate[] => {
  const storedSalesTasks = Array.isArray(props.deal.salesTasks)
    ? props.deal.salesTasks.map((task) => cloneDealSalesTaskTemplate(task))
    : [];
  const importedSalesTasks = buildImportedSalesTaskTemplates(
    props.deal.items || [],
    nextDealSalesTaskId(storedSalesTasks),
  );
  const missingImportedSalesTasks = importedSalesTasks.filter(
    (task) =>
      !storedSalesTasks.some(
        (existingTask) =>
          Number(existingTask.sourceItemId ?? 0) ===
            Number(task.sourceItemId ?? 0) &&
          Number(existingTask.sourceTaskId ?? 0) ===
            Number(task.sourceTaskId ?? 0),
      ),
  );
  const legacyManualSalesTasks = dealTodos.value
    .filter((todo) => {
      const milestoneId = String(todo.milestoneId ?? "").trim();
      const goalId = String(todo.goalId ?? "").trim();

      return !milestoneId && !goalId;
    })
    .map((todo, index) =>
      cloneDealSalesTaskTemplate({
        id:
          nextDealSalesTaskId([...storedSalesTasks, ...importedSalesTasks]) +
          index,
        title: todo.title,
        collaborators: todo.collaborators || [],
        afterWhen: todo.afterWhen ?? null,
        startTrigger: (todo.startTrigger as any) ?? {
          type: "time",
          goalId: null,
          taskId: null,
        },
        manhours: null,
        notes: todo.notes || "",
        status: (todo.status as Status) || "pending",
        important: Boolean(todo.important),
        attachment: todo.attachment ?? null,
        relatedTo: buildDealRelatedTo(),
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

  return [
    ...storedSalesTasks,
    ...missingImportedSalesTasks,
    ...legacyManualSalesTasks,
  ];
};

const salesTasks = computed<DealSalesTaskRow[]>(() => {
  const manualTodoKeys = new Set(
    manualDealSalesTodos.value.map(
      (todo) => `${todo.title || ""}::${todo.notes || ""}`,
    ),
  );
  const fallbackTasks = buildEditableSalesTasks().filter((task) => {
    if (task.sourceItemId !== null && task.sourceItemId !== undefined)
      return true;

    return !manualTodoKeys.has(`${task.title || ""}::${task.notes || ""}`);
  });

  return [
    ...manualDealSalesTodos.value.map((todo) => ({
      id: todo.id,
      title: todo.title,
      afterWhen: todo.afterWhen ?? null,
      startTrigger: todo.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: todo.notes || "",
      collaborators: todo.collaborators || [],
      important: Boolean(todo.important),
      status: (todo.status as Status) || "pending",
      isImported: false,
    })),
    ...fallbackTasks.map((task) => ({
      id: task.id,
      title: task.title,
      afterWhen: task.afterWhen ?? null,
      startTrigger: task.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: task.notes || "",
      collaborators: task.collaborators || [],
      important: Boolean(task.important),
      status: (task.status as Status) || "pending",
      isImported: task.sourceItemId !== null && task.sourceItemId !== undefined,
    })),
  ];
});

const manualSalesTasks = computed(() =>
  salesTasks.value.filter((task) => !task.isImported),
);

const catalogueTemplateSalesTasks = computed(() =>
  salesTasks.value.filter((task) => task.isImported),
);

const collaboratorInitials = (name?: string) =>
  name
    ? (name.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()
    : "?";

const todoStatusLabel = (status?: Status) => {
  if (status === "in_progress") return "In Progress";
  if (status === "for_review") return "For Review";
  if (status === "completed") return "Completed";

  return "Pending";
};

const formatTaskAfterWhen = (afterWhen?: string | null) => {
  const match = String(afterWhen ?? "")
    .trim()
    .match(/^\+?\s*(\d+)\s+(day|days|week|weeks|month|months)$/i);

  if (!match) return "1 day";

  const rawValue = Number(match[1]);
  const rawUnit = match[2].toLowerCase();
  const normalizedDays = rawUnit.startsWith("week")
    ? rawValue * 7
    : rawUnit.startsWith("month")
      ? rawValue * 30
      : rawValue;

  return `${normalizedDays} ${normalizedDays === 1 ? "day" : "days"}`;
};

const formatTaskStart = (
  afterWhen?: string | null,
  startTrigger?: ToDo["startTrigger"],
) => {
  if (startTrigger?.type === "goal" && startTrigger.goalId)
    return "After goal completion";

  return `After ${formatTaskAfterWhen(afterWhen)}`;
};

const toggleTaskCompleted = (taskId: number | string) => {
  const task = todosStore.byId(taskId);
  if (!task) return;

  todosStore.updateTodo(taskId, {
    status: task.status === "completed" ? "pending" : "completed",
  });
};

const openAddTask = () => {
  emit("open-add-task", {
    initial: {
      relatedTo: buildDealRelatedTo(),
      dueAt: new Date().toISOString(),
      status: "pending",
    },
  });
};

const openEditTask = (taskId: number | string) => {
  emit("open-edit-task", taskId);
};
</script>

<template>
  <div class="d-flex flex-column gap-4">
    <VCard>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div>
            <h5 class="text-h5 mb-1">Items</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Add or create catalogue items .
            </p>
          </div>

          <VMenu>
            <template #activator="{ props: menuProps }">
              <VBtn v-bind="menuProps" prepend-icon="tabler-plus">
                Add Item
              </VBtn>
            </template>

            <VList>
              <VListItem @click="openAddItemDialog">
                <template #prepend>
                  <VIcon icon="tabler-package" />
                </template>
                <VListItemTitle>Select from Catalogue</VListItemTitle>
              </VListItem>

              <VListItem @click="openCreateCatalogueItem">
                <template #prepend>
                  <VIcon icon="tabler-layout-grid-add" />
                </template>
                <VListItemTitle>Add new Item</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </div>

        <div
          v-if="!dealItemsWithPlan.length"
          class="text-center text-medium-emphasis py-6"
        >
          No items yet. Add one to get started.
        </div>

        <VExpansionPanels
          v-else
          v-model="expandedItems"
          variant="accordion"
          multiple
          class="expansion-panels-width-border milestone-panels"
        >
          <VExpansionPanel
            v-for="item in dealItemsWithPlan"
            :key="item.panelId"
            :value="item.panelId"
            class="milestone-panel"
            :class="{ 'milestone-panel--static': !item.isExpandable }"
            :readonly="!item.isExpandable"
          >
            <VExpansionPanelTitle>
              <div class="item-card-shell" @click.stop="openEditItem(item)">
                <div class="flex-grow-1 min-w-0">
                  <div class="item-card-header">
                    <VTooltip :text="item.name" location="top">
                      <template #activator="{ props: tooltipProps }">
                        <div
                          v-bind="tooltipProps"
                          class="item-card-title truncate-title"
                        >
                          {{ item.name }}
                        </div>
                      </template>
                    </VTooltip>
                    <VChip
                      size="small"
                      variant="plain"
                      color="primary"
                      class="item-type-chip"
                    >
                      {{ itemTypeLabel(item) }}
                    </VChip>
                  </div>

                  <div class="product-metrics">
                    <div class="product-metric">
                      <span>Price</span>
                      <strong>{{ formatMoney(item.unitPrice) }}</strong>
                    </div>
                    <div class="product-metric">
                      <span>Qty</span>
                      <strong>{{ item.quantity ?? "--" }}</strong>
                    </div>
                    <div class="product-metric">
                      <span>Discount</span>
                      <strong>
                        {{ formatPercent(item.discountPercent || 0) }}
                      </strong>
                    </div>
                    <div class="product-metric">
                      <span>Tax</span>
                      <strong>
                        {{ formatTaxApplicable(item.taxApplicable ?? null) }}
                      </strong>
                    </div>
                    <div class="product-metric product-metric--amount">
                      <span>Amount</span>
                      <strong>{{ formatMoney(itemAmount(item)) }}</strong>
                    </div>
                  </div>

                  <div
                    v-if="item.note"
                    class="item-card-note text-body-2 text-medium-emphasis"
                  >
                    {{ item.note }}
                  </div>
                </div>

                <div
                  v-if="item.actionsEnabled"
                  class="milestone-actions"
                  @click.stop
                >
                  <VBtn icon variant="text" size="x-small">
                    <VIcon icon="tabler-dots-vertical" size="18" />
                    <VMenu activator="parent">
                      <VList>
                        <VListItem @click="openEditItem(item)">
                          <template #prepend>
                            <VIcon icon="tabler-pencil" />
                          </template>
                          <VListItemTitle>Edit</VListItemTitle>
                        </VListItem>
                        <VListItem
                          v-if="getExpandableServiceRecord(item)"
                          @click="openAddPhase(item)"
                        >
                          <template #prepend>
                            <VIcon icon="tabler-layout-grid-add" />
                          </template>
                          <VListItemTitle>
                            Add {{ item.childTypeSingular }}
                          </VListItemTitle>
                        </VListItem>
                        <VListItem @click="removeDealItem(item)">
                          <template #prepend>
                            <VIcon icon="tabler-trash" color="error" />
                          </template>
                          <VListItemTitle>Remove</VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>

                  <VBtn
                    v-if="item.isExpandable"
                    icon
                    variant="text"
                    size="x-small"
                    class="item-expand-btn"
                    @click.stop="toggleItemExpanded(item.panelId)"
                  >
                    <VIcon
                      :icon="
                        expandedItems.includes(item.panelId)
                          ? 'tabler-chevron-up'
                          : 'tabler-chevron-down'
                      "
                      size="18"
                    />
                  </VBtn>
                  <div v-else class="item-expand-placeholder" />
                </div>
              </div>
            </VExpansionPanelTitle>

            <VExpansionPanelText v-if="item.isExpandable">
              <VCard variant="flat" class="pa-3 milestone-panel-body">
                <div
                  v-if="derivedGoalsForItem(item).length"
                  class="d-flex flex-column gap-2 goal-panels"
                >
                  <VCard
                    v-for="goal in derivedGoalsForItem(item)"
                    :key="goal.id"
                    variant="tonal"
                    class="goal-panel goal-panel--static"
                  >
                    <div class="phase-card-shell">
                      <div class="flex-grow-1 min-w-0">
                        <div class="item-card-header">
                          <VTooltip :text="goal.name" location="top">
                            <template #activator="{ props: tooltipProps }">
                              <div
                                v-bind="tooltipProps"
                                class="item-card-title item-card-title--phase truncate-title"
                              >
                                {{ goal.name }}
                              </div>
                            </template>
                          </VTooltip>
                          <VChip
                            color="primary"
                            size="x-small"
                            variant="plain"
                            class="item-type-chip item-type-chip--phase"
                          >
                            {{ goal.typeLabel }}
                          </VChip>
                        </div>

                        <div
                          v-if="
                            goal.showQuantity ||
                            goal.showPrice ||
                            goal.showDiscount ||
                            goal.showTaxApplicable
                          "
                          class="product-metrics product-metrics--phase"
                        >
                          <div v-if="goal.showPrice" class="product-metric">
                            <span>Price</span>
                            <strong>{{ formatMoney(goal.price) }}</strong>
                          </div>
                          <div v-if="goal.showQuantity" class="product-metric">
                            <span>Qty</span>
                            <strong>{{ goal.quantity ?? "--" }}</strong>
                          </div>
                          <div v-if="goal.showDiscount" class="product-metric">
                            <span>Discount</span>
                            <strong>{{
                              formatGoalDiscount(goal) || "--"
                            }}</strong>
                          </div>
                          <div
                            v-if="goal.showTaxApplicable"
                            class="product-metric"
                          >
                            <span>Tax</span>
                            <strong>
                              {{ formatTaxApplicable(goal.taxApplicable) }}
                            </strong>
                          </div>
                          <div v-if="goal.showPrice" class="product-metric">
                            <span>Amount</span>
                            <strong>{{ formatMoney(goalAmount(goal)) }}</strong>
                          </div>
                        </div>

                        <div
                          v-if="goal.note"
                          class="item-card-note text-body-2 text-medium-emphasis"
                        >
                          {{ goal.note }}
                        </div>
                      </div>

                      <div class="goal-card-actions">
                        <VBtn
                          icon
                          variant="text"
                          size="x-small"
                          class="phase-edit-btn"
                        >
                          <VIcon icon="tabler-dots-vertical" size="16" />
                          <VMenu activator="parent">
                            <VList>
                              <VListItem @click="openEditGoal(item, goal)">
                                <template #prepend>
                                  <VIcon icon="tabler-pencil" />
                                </template>
                                <VListItemTitle>Edit</VListItemTitle>
                              </VListItem>
                              <VListItem
                                :disabled="
                                  isGoalProformaActionDisabled(item, goal)
                                "
                                @click="
                                  openGoalDocumentPage('proforma', item, goal)
                                "
                              >
                                <template #prepend>
                                  <VIcon icon="tabler-file-certificate" />
                                </template>
                                <VListItemTitle>Create Proforma</VListItemTitle>
                              </VListItem>
                              <VListItem
                                :disabled="
                                  isGoalInvoiceActionDisabled(item, goal)
                                "
                                @click="
                                  openGoalDocumentPage('invoice', item, goal)
                                "
                              >
                                <template #prepend>
                                  <VIcon icon="tabler-file-invoice" />
                                </template>
                                <VListItemTitle>Create Invoice</VListItemTitle>
                              </VListItem>
                              <VListItem
                                v-if="isRemovableChildGoal(goal)"
                                @click="removeGoal(item, goal)"
                              >
                                <template #prepend>
                                  <VIcon icon="tabler-trash" color="error" />
                                </template>
                                <VListItemTitle>
                                  Remove {{ goal.typeLabel }}
                                </VListItemTitle>
                              </VListItem>
                            </VList>
                          </VMenu>
                        </VBtn>
                      </div>
                    </div>
                  </VCard>
                </div>

                <div v-else class="text-body-2 text-medium-emphasis">
                  No {{ item.childTypePlural.toLowerCase() }} under this item
                  yet.
                </div>
              </VCard>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCardText>
    </VCard>

    <VCard v-if="dealItemsWithPlan.length">
      <VCardText>
        <div class="items-overview">
          <div class="items-overview__header">
            <div class="items-overview__heading">
              <div class="text-h6 mb-1">Invoicing Summary</div>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Totals, billed amount, remaining balance, and documents.
              </p>
            </div>

            <div class="items-overview__documents">
              <div class="items-overview__document-pill">
                <button
                  type="button"
                  class="items-overview__document-action"
                  @click="openDocumentPage('quotation')"
                >
                  <VIcon icon="tabler-plus" size="14" />
                  <span>QT</span>
                </button>
                <strong>{{ quotationCount }}</strong>
              </div>
              <div class="items-overview__document-pill">
                <button
                  type="button"
                  class="items-overview__document-action"
                  @click="openDocumentPage('proforma')"
                >
                  <VIcon icon="tabler-plus" size="14" />
                  <span>PF</span>
                </button>
                <strong>{{ proformaCount }}</strong>
              </div>
              <div class="items-overview__document-pill">
                <button
                  type="button"
                  class="items-overview__document-action"
                  @click="openDocumentPage('invoice')"
                >
                  <VIcon icon="tabler-plus" size="14" />
                  <span>INV</span>
                </button>
                <strong>{{ invoiceCount }}</strong>
              </div>
            </div>
          </div>

          <div class="items-overview__metrics">
            <div class="items-overview__metric items-overview__metric--primary">
              <span>Total</span>
              <strong>{{ formatMoney(grandTotal) }}</strong>
            </div>
            <div class="items-overview__metric items-overview__metric--accent">
              <span>Invoiced</span>
              <strong>{{ formatMoney(totalInvoiced) }}</strong>
            </div>
            <div class="items-overview__metric items-overview__metric--accent">
              <span>Remaining</span>
              <strong>{{ formatMoney(remainingToInvoice) }}</strong>
            </div>
          </div>

          <div class="items-overview__details">
            <div class="items-overview__detail">
              <span>Subtotal</span>
              <strong>{{ formatMoney(itemsSubtotal) }}</strong>
            </div>
            <div class="items-overview__detail">
              <span>Discount</span>
              <strong>{{ formatMoney(totalDiscount) }}</strong>
            </div>
            <div class="items-overview__detail">
              <span>Tax</span>
              <strong>{{ formatMoney(totalTax) }}</strong>
            </div>
            <div class="items-overview__detail">
              <span>Quoted</span>
              <strong>{{ formatMoney(totalQuoted) }}</strong>
            </div>
            <div class="items-overview__detail">
              <span>Paid</span>
              <strong>{{ formatMoney(totalPaid) }}</strong>
            </div>
          </div>

          <div class="items-overview__previews">
            <section
              v-for="panel in dealDocumentPanels"
              :key="panel.key"
              class="items-overview__preview-panel"
              :class="[
                `items-overview__preview-panel--${panel.key}`,
                {
                  'items-overview__preview-panel--expanded':
                    isDocumentPanelExpanded(panel.key),
                },
              ]"
            >
              <button
                type="button"
                class="items-overview__preview-summary"
                @click="setActiveDocumentPanel(panel.key)"
              >
                <div>
                  <div class="items-overview__preview-kicker">
                    {{ panel.title }}
                  </div>
                  <strong class="items-overview__preview-title">
                    {{
                      panel.latest?.quoteNumber ||
                      `No ${panel.title.toLowerCase()}`
                    }}
                  </strong>
                </div>

                <div class="items-overview__preview-summary-side">
                  <div class="items-overview__preview-count">
                    {{ panel.count }}
                  </div>
                  <VIcon
                    :icon="
                      isDocumentPanelExpanded(panel.key)
                        ? 'tabler-chevron-up'
                        : 'tabler-chevron-down'
                    "
                    size="16"
                  />
                </div>
              </button>

              <div
                v-if="isDocumentPanelExpanded(panel.key)"
                class="items-overview__preview-body"
              >
                <template v-if="panel.latest">
                  <button
                    type="button"
                    class="items-overview__preview-primary"
                    @click="openQuickDocumentPreview(panel.key, panel.latest)"
                  >
                    <div class="items-overview__preview-meta">
                      <span>{{ panel.latest.status }}</span>
                      <span>{{
                        formatDocumentDate(panel.latest.issuedDate)
                      }}</span>
                    </div>

                    <div class="items-overview__preview-total">
                      {{ formatMoney(panel.latest.total) }}
                    </div>
                  </button>

                  <div class="items-overview__preview-list">
                    <button
                      v-for="record in panel.records.slice(0, 4)"
                      :key="`${panel.key}-${record.id}`"
                      type="button"
                      class="items-overview__preview-chip"
                      @click="openQuickDocumentPreview(panel.key, record)"
                    >
                      {{ record.quoteNumber }}
                    </button>

                    <span
                      v-if="panel.records.length > 4"
                      class="items-overview__preview-more"
                    >
                      +{{ panel.records.length - 4 }} more
                    </span>
                  </div>
                </template>

                <p v-else class="items-overview__preview-empty mb-0 px-4">
                  {{ panel.emptyText }}
                </p>
              </div>
            </section>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard>
      <VDialog v-model="previewDialogVisible" max-width="1280">
        <VCard class="items-preview-dialog">
          <VCardItem>
            <template #title>
              <div
                class="d-flex align-center justify-space-between gap-4 flex-wrap"
              >
                <div>
                  <div class="text-overline text-primary mb-1">
                    Quick Preview
                  </div>
                  <div class="text-h6">
                    {{ selectedPreviewDocument?.title || "Document Preview" }}
                  </div>
                </div>

                <div class="d-flex align-center gap-2 flex-wrap">
                  <VBtn
                    variant="tonal"
                    prepend-icon="tabler-external-link"
                    :disabled="!selectedPreviewDocument"
                    @click="openSelectedPreviewInPage"
                  >
                    Open Full Page
                  </VBtn>
                  <VBtn
                    icon
                    variant="text"
                    @click="previewDialogVisible = false"
                  >
                    <VIcon icon="tabler-x" />
                  </VBtn>
                </div>
              </div>
            </template>
          </VCardItem>

          <VDivider />

          <VCardText class="items-preview-dialog__body">
            <iframe
              v-if="selectedPreviewDocument"
              :key="selectedPreviewDocument.href"
              :src="selectedPreviewDocument.href"
              class="items-preview-dialog__frame"
              title="Document quick preview"
            />
          </VCardText>
        </VCard>
      </VDialog>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div class="d-flex flex-column gap-1">
            <h5 class="text-h5 mb-0">Sales Tasks</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Sales tasks from added items appear here. Add more if needed.
            </p>
          </div>

          <VBtn prepend-icon="tabler-plus" @click="openAddTask">
            Add Task
          </VBtn>
        </div>

        <div v-if="salesTasks.length" class="d-flex flex-column gap-4">
          <div v-if="manualSalesTasks.length" class="d-flex flex-column gap-2">
            <div class="d-flex align-center justify-space-between gap-3">
              <div>
                <div class="text-subtitle-1 font-weight-medium">
                  Sales Tasks
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Regular pre-execution tasks added directly to this deal.
                </div>
              </div>
              <VChip size="small" variant="outlined">
                {{ manualSalesTasks.length }}
              </VChip>
            </div>

            <VCard
              v-for="task in manualSalesTasks"
              :key="task.id"
              class="task-row"
              variant="tonal"
              @click="openEditTask(task.id)"
            >
              <div class="task-row-main">
                <div class="task-row-left">
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
                    <span class="text-sm">
                      {{ formatTaskStart(task.afterWhen, task.startTrigger) }}
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
                  <div
                    v-if="task.collaborators?.length"
                    class="v-avatar-group demo-avatar-group"
                  >
                    <VAvatar
                      v-for="collaborator in task.collaborators.slice(0, 2)"
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

                  <VIcon
                    v-if="task.important"
                    icon="tabler-star-filled"
                    color="warning"
                    size="18"
                  />
                  <VBtn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="emit('delete-task', task.id)"
                  >
                    <VIcon icon="tabler-trash" color="error" size="18" />
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
                    {{ todoStatusLabel(task.status) }}
                  </span>
                </div>
              </div>
            </VCard>
          </div>

          <div
            v-if="catalogueTemplateSalesTasks.length"
            class="d-flex flex-column gap-2"
          >
            <div class="d-flex align-center justify-space-between gap-3">
              <div>
                <div class="text-subtitle-1 font-weight-medium">
                  Catalogue Template Tasks
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Tasks inherited from the selected catalogue items.
                </div>
              </div>
              <VChip size="small" variant="outlined">
                {{ catalogueTemplateSalesTasks.length }}
              </VChip>
            </div>

            <VCard
              v-for="task in catalogueTemplateSalesTasks"
              :key="task.id"
              class="task-row"
              variant="tonal"
              @click="openEditTask(task.id)"
            >
              <div class="task-row-main">
                <div class="task-row-left">
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
                    <span class="text-sm">
                      {{ formatTaskStart(task.afterWhen, task.startTrigger) }}
                    </span>
                    <span class="text-sm text-info">From catalogue item</span>
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
                      v-for="collaborator in task.collaborators.slice(0, 2)"
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

                  <VIcon
                    v-if="task.important"
                    icon="tabler-star-filled"
                    color="warning"
                    size="18"
                  />
                  <VBtn
                    icon
                    variant="text"
                    size="x-small"
                    @click.stop="emit('delete-task', task.id)"
                  >
                    <VIcon icon="tabler-trash" color="error" size="18" />
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
                    {{ todoStatusLabel(task.status) }}
                  </span>
                </div>
              </div>
            </VCard>
          </div>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis empty-tasks">
          No sales tasks linked to this deal yet.
        </div>
      </VCardText>
    </VCard>
  </div>

  <VDialog v-model="addItemDialogVisible" max-width="640">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add Item</h5>

        <VForm ref="addItemFormRef" @submit.prevent="saveSelectedCatalogueItem">
          <VRow>
            <VCol cols="12" md="8">
              <AppAutocomplete
                v-model="selectedCatalogueItemId"
                label="Catalogue Item"
                placeholder="Select catalogue item"
                :items="catalogueOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="4">
              <AppTextField
                v-model="addItemDraft.quantity"
                type="number"
                min="1"
                label="Quantity"
                placeholder="1"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol v-if="selectedCatalogueItem" cols="12">
              <VCard variant="tonal" class="pa-4">
                <div class="font-weight-medium mb-1">
                  {{ selectedCatalogueItem.name }}
                </div>
                <div class="text-sm text-medium-emphasis mb-1">
                  {{ selectedCatalogueItem.type }} |
                  {{ selectedCatalogueItem.category }}
                </div>
                <div class="text-sm text-medium-emphasis">
                  {{ selectedCatalogueItem.description || "No description." }}
                </div>
              </VCard>
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="addItemDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="editLineDialogVisible" max-width="760">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Edit {{ editLine.title || "Item" }}</h5>

        <VForm ref="editLineFormRef" @submit.prevent="saveEditedLine">
          <VRow>
            <VCol v-if="editLine.canEditInfo" cols="12" md="8">
              <AppTextField
                v-model="editLine.name"
                label="Name"
                placeholder="Item name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol v-if="editLine.canEditInfo" cols="12" md="4">
              <AppTextField
                v-model="editLine.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol v-if="editLine.canEditPrice" cols="12" md="3">
              <AppTextField
                v-model="editLine.unitPrice"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol v-if="editLine.canEditQuantity" cols="12" md="3">
              <AppTextField
                v-model="editLine.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol v-if="editLine.canEditDiscount" cols="12" md="3">
              <AppTextField
                v-model="editLine.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol v-if="editLine.canEditTax" cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="editLine.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol v-if="editLine.canEditInfo" cols="12">
              <AppTextarea
                v-model="editLine.note"
                label="Note"
                placeholder="Short note"
                rows="2"
                auto-grow
              />
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="editLineDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="phaseDialogVisible" max-width="760">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">{{ phaseDialogTitle }}</h5>

        <VForm ref="phaseFormRef" @submit.prevent="savePhase">
          <VRow>
            <VCol cols="12" md="8">
              <AppTextField
                v-model="phaseDraft.name"
                label="Phase Name"
                placeholder="Phase name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="4">
              <AppTextField
                v-model="phaseDraft.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.price"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="phaseDraft.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="phaseDraft.note"
                label="Note"
                placeholder="Short note"
                rows="2"
                auto-grow
              />
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="phaseDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="billingModeDialogVisible" max-width="560">
    <VCard>
      <VCardItem>
        <VCardTitle>Choose Billing Basis</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          This deal mixes billing modes. Choose how you want to build this
          document.
        </div>

        <VRadioGroup v-model="selectedBillingMode" color="primary">
          <VRadio
            v-for="option in billingModeOptions"
            :key="option.value"
            :value="option.value"
          >
            <template #label>
              <div>
                <div class="text-body-1 font-weight-medium">
                  {{ option.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ option.description }}
                </div>
              </div>
            </template>
          </VRadio>
        </VRadioGroup>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="resetDocumentWorkflowState">Cancel</VBtn>
        <VBtn color="primary" @click="confirmBillingModeSelection"
          >Continue</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="billingPeriodDialogVisible" max-width="640">
    <VCard>
      <VCardItem>
        <VCardTitle>Select Billing Period</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText class="d-flex flex-column gap-4">
        <div class="text-sm text-medium-emphasis">
          Enter the billing period and explicit prices for the selected
          period-based lines.
        </div>

        <div class="rounded border pa-4 bg-var-theme-background">
          <VRow>
            <VCol cols="12" md="6">
              <VSelect
                v-model="billingPeriodKind"
                label="Period Type"
                :items="billingPeriodKindOptions"
              />
            </VCol>

            <VCol cols="12" md="6">
              <VTextField
                v-if="billingPeriodKind === 'monthly'"
                v-model="billingPeriodMonthValue"
                type="month"
                label="Billing Month"
              />

              <VTextField
                v-else-if="billingPeriodKind === 'quarterly'"
                v-model="billingPeriodQuarterYearValue"
                type="number"
                min="2000"
                label="Billing Year"
              />

              <VTextField
                v-else-if="billingPeriodKind === 'yearly'"
                v-model="billingPeriodYearValue"
                type="number"
                min="2000"
                label="Billing Year"
              />

              <VTextField
                v-else
                v-model="billingPeriodCustomStartDate"
                type="date"
                label="Start Date"
              />
            </VCol>
          </VRow>

          <VRow v-if="billingPeriodKind === 'quarterly'">
            <VCol cols="12" md="6" offset-md="6">
              <VSelect
                v-model="billingPeriodQuarterValue"
                label="Billing Quarter"
                :items="billingQuarterOptions"
              />
            </VCol>
          </VRow>

          <VRow v-else-if="billingPeriodKind === 'custom'">
            <VCol cols="12" md="6">
              <VTextField
                v-model="billingPeriodCustomEndDate"
                type="date"
                label="End Date"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="billingPeriodCustomLabel"
                label="Custom Label"
                placeholder="Optional"
              />
            </VCol>
          </VRow>
        </div>

        <div class="rounded border pa-3 bg-var-theme-background">
          <div class="text-xs text-medium-emphasis mb-1">Selected period</div>
          <div class="text-body-1 font-weight-medium">
            {{ billingPeriodPreview.label }}
          </div>
        </div>

        <div
          v-if="pendingBillingPeriodItems.length"
          class="d-flex flex-column gap-3 mt-4"
        >
          <div
            v-for="item in pendingBillingPeriodItems"
            :key="item.selectionKey"
            class="border rounded-lg pa-4 bg-var-theme-background"
          >
            <div class="text-body-1 font-weight-medium mb-1">
              {{ item.name }}
            </div>
            <div class="text-sm text-medium-emphasis mb-3">
              Set the explicit billed amount for this period.
            </div>

            <AppTextField
              v-model.number="billingPeriodPrices[item.selectionKey]"
              type="number"
              min="0"
              step="0.01"
              label="Period Price"
            />
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="resetDocumentWorkflowState">Cancel</VBtn>
        <VBtn color="primary" @click="confirmBillingPeriod">Continue</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="selectionDialogVisible" max-width="760">
    <VCard>
      <VCardItem>
        <VCardTitle>{{ selectionDialogTitle }}</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogIntro }}
        </div>

        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogHint }}
        </div>

        <div
          v-if="filteredSelectableDocumentItems.length"
          class="d-flex flex-column gap-3"
        >
          <div
            v-for="group in selectableGroups"
            :key="group.key"
            class="d-flex flex-column gap-3"
          >
            <div>
              <div class="text-subtitle-2 font-weight-medium">
                {{ group.label }}
              </div>
              <div class="text-sm text-medium-emphasis">
                {{ group.description }}
              </div>
            </div>

            <label
              v-for="item in group.items"
              :key="item.selectionKey"
              class="border rounded pa-3 d-flex align-start gap-3"
              :class="{
                'opacity-50': isSelectionDocumentActionDisabled(
                  item.selectionKey,
                ),
              }"
              :style="{ marginInlineStart: itemRowOffset(item) }"
            >
              <VCheckbox
                v-model="selectedItemIds"
                :value="item.selectionKey"
                :disabled="isSelectionDocumentActionDisabled(item.selectionKey)"
                color="primary"
                hide-details
                class="mt-0 pt-0"
              />

              <div class="flex-grow-1 min-w-0">
                <div class="d-flex flex-wrap align-center gap-2 mb-1">
                  <div class="text-body-1 font-weight-medium">
                    {{ item.name }}
                  </div>

                  <VChip size="x-small" label color="primary" variant="tonal">
                    {{ formatItemType(item.catalogueType) }}
                  </VChip>

                  <VChip
                    v-if="item.parentName"
                    size="x-small"
                    label
                    color="secondary"
                    variant="tonal"
                  >
                    Parent: {{ item.parentName }}
                  </VChip>

                  <VChip
                    v-if="item.isBillableRoot && item.isAutoBillable"
                    size="x-small"
                    label
                    color="success"
                    variant="tonal"
                  >
                    Auto-flow eligible
                  </VChip>

                  <VChip
                    v-else-if="item.isBillableRoot && !item.isRootReplacement"
                    size="x-small"
                    label
                    color="warning"
                    variant="tonal"
                  >
                    Selection flow
                  </VChip>

                  <VChip
                    v-if="item.expansionSummary"
                    size="x-small"
                    label
                    color="info"
                    variant="tonal"
                  >
                    {{ item.expansionSummary }}
                  </VChip>
                </div>

                <div class="text-sm text-medium-emphasis mb-1">
                  {{ formatMoney(item.unitPrice) }} x {{ item.quantity ?? 1 }}
                </div>

                <div v-if="item.hint" class="text-sm text-medium-emphasis mb-1">
                  {{ item.hint }}
                </div>

                <div
                  v-if="isSelectionDocumentActionDisabled(item.selectionKey)"
                  class="text-sm text-warning mb-1"
                >
                  {{
                    selectedDocumentKind === "invoice"
                      ? "Already invoiced."
                      : "Already proforma'd."
                  }}
                </div>

                <div v-if="item.note" class="text-sm text-medium-emphasis">
                  {{ item.note }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis">
          No selectable rows available for this billing mode.
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="closeSelectionDialog">Cancel</VBtn>
        <VBtn
          color="primary"
          :disabled="!selectedDocumentItems.length"
          @click="confirmSelectedDocumentItems"
        >
          Continue
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="createItemTypeDialogVisible" max-width="920">
    <VCard class="pa-sm-6 pa-4">
      <VCardTitle class="text-h4 pb-2">Choose Item Type</VCardTitle>
      <VCardText class="text-body-1 text-medium-emphasis pb-6">
        Select kind of catalogue item you want to create. Each option opens
        matching add flow.
      </VCardText>

      <VRow>
        <VCol
          v-for="choice in itemTypeChoices"
          :key="choice.value"
          cols="12"
          md="6"
        >
          <VCard
            variant="outlined"
            class="item-type-card h-100"
            :class="{ 'item-type-card--disabled': choice.comingSoon }"
            @click="openCreateDraftItemDialog(choice.value)"
          >
            <VCardText class="d-flex align-start gap-4">
              <VAvatar size="44" rounded variant="tonal" color="primary">
                <VIcon :icon="choice.icon" size="22" />
              </VAvatar>

              <div class="flex-grow-1">
                <div
                  class="d-flex align-center justify-space-between gap-3 mb-1"
                >
                  <div class="text-h6 text-high-emphasis">
                    {{ choice.title }}
                  </div>
                  <VChip
                    v-if="choice.comingSoon"
                    size="small"
                    color="warning"
                    variant="outlined"
                  >
                    Coming Soon
                  </VChip>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ choice.description }}
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VCardActions class="pt-6">
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="createItemTypeDialogVisible = false"
        >
          Cancel
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="createDraftItemDialogVisible" max-width="720">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add {{ selectedCreateItemType || "Item" }}</h5>

        <VForm
          ref="createDraftItemFormRef"
          @submit.prevent="saveCreatedDraftItem"
        >
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="createDraftItem.name"
                label="Item Name"
                placeholder="Item name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.quantity"
                type="number"
                min="1"
                label="Quantity"
                placeholder="1"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.price"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="createDraftItem.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="createDraftItem.note"
                label="Note"
                placeholder="Short note"
                rows="1"
                auto-grow
              />
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="createDraftItemDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.item-type-card {
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.item-type-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  transform: translateY(-1px);
}

.item-type-card--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.milestone-panels :deep(.v-expansion-panel),
.goal-panels :deep(.v-expansion-panel) {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.12);
}

.milestone-panels {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.milestone-panels :deep(.v-expansion-panel-title),
.goal-panels :deep(.v-expansion-panel-title) {
  min-block-size: auto;
  padding-block: 0.65rem;
  padding-inline: 1rem;
}

.milestone-panels :deep(.v-expansion-panel-text__wrapper),
.goal-panels :deep(.v-expansion-panel-text__wrapper) {
  padding-block: 0 0.75rem;
  padding-inline: 0.75rem;
}

.milestone-panels :deep(.v-expansion-panel__shadow),
.goal-panels :deep(.v-expansion-panel__shadow) {
  box-shadow: none;
}

.milestone-panel {
  overflow: hidden;
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.milestone-panel:hover {
  border-color: rgba(var(--v-theme-primary), 0.24);
  background: rgba(var(--v-theme-surface), 0.18);
}

.milestone-panel--static {
  cursor: default;
}

.milestone-panel-body {
  display: flex;
  flex-direction: column;
  background: transparent;
  box-shadow: none;
  gap: 0.5rem;
}

.goal-panels :deep(.v-expansion-panel) {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
}

.goal-panel--static {
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.18);
  padding-block: 0.65rem;
  padding-inline: 0.8rem;
}

.goal-panels :deep(.v-expansion-panel + .v-expansion-panel) {
  margin-block-start: 0.625rem;
}

.goal-panels :deep(.v-expansion-panel-title) {
  min-block-size: auto;
}

.goal-panel-body {
  background: rgba(var(--v-theme-surface), 0.14);
  box-shadow: none;
}

.goal-panels {
  margin-block-start: 0;
}

.item-card-shell,
.phase-card-shell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  inline-size: 100%;
  min-inline-size: 0;
}

.item-card-shell {
  cursor: pointer;
  padding-block: 0.125rem;
}

.phase-card-shell {
  padding-block: 0.125rem;
}

.item-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-inline-size: 0;
}

.item-card-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}

.item-card-title--phase {
  font-size: 0.9rem;
}

.item-type-chip {
  position: relative;
  background: transparent !important;
  box-shadow: none !important;
  gap: 0.4rem;
  margin-inline-start: 0.2rem;
  min-block-size: auto;
  opacity: 1 !important;
  padding-inline-start: 0.85rem;
}

.item-type-chip :deep(.v-chip__underlay) {
  display: none;
}

.item-type-chip:hover {
  opacity: 1 !important;
}

.item-type-chip::before {
  position: absolute;
  border-radius: 999px;
  background: currentcolor;
  block-size: 1rem;
  content: "";
  inline-size: 0.25rem;
  inset-block-start: 50%;
  inset-inline-start: 0.2rem;
  transform: translateY(-50%);
}

.item-type-chip--phase {
  margin-inline-start: 0;
}

.product-metrics {
  display: grid;
  gap: 0;
  grid-template-columns: repeat(5, minmax(5rem, 1fr));
  margin-block-start: 0.5rem;
}

.product-metrics--phase {
  grid-template-columns: repeat(5, minmax(4.75rem, 1fr));
}

.product-metric {
  position: relative;
  background: transparent;
  min-inline-size: 0;
  padding-block: 0.35rem;
  padding-inline: 0.5rem;
}

.product-metric:not(:last-child)::after {
  position: absolute;
  background: rgba(var(--v-theme-on-surface), 0.12);
  block-size: calc(100% - 0.5rem);
  content: "";
  inline-size: 1px;
  inset-block-start: 0.25rem;
  inset-inline-end: 0;
}

.product-metric span,
.product-metric strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-metric span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.15;
  text-transform: uppercase;
}

.product-metric strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.82rem;
  line-height: 1.25;
  margin-block-start: 0.1rem;
}

.product-metric--amount {
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.goal-card-actions {
  display: flex;
  align-self: flex-start;
  gap: 0.15rem;
  margin-block-start: -0.25rem;
}

.phase-edit-btn {
  flex: 0 0 auto;
}

.item-card-note {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  margin-block-start: 0.45rem;
}

.milestone-actions {
  display: grid;
  flex: 0 0 3.75rem;
  justify-content: end;
  grid-template-columns: 1.75rem 1.75rem;
  inline-size: 3.75rem;
  justify-items: center;
  margin-inline-start: auto;
}

.milestone-actions :deep(.v-btn) {
  margin: 0;
}

.item-expand-placeholder {
  block-size: 1.75rem;
  inline-size: 1.75rem;
}

.milestone-panel :deep(.v-expansion-panel-title__icon) {
  display: none;
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

.items-overview {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 16px;
  background:
    linear-gradient(
      180deg,
      rgba(var(--v-theme-surface), 0.36),
      rgba(var(--v-theme-surface), 0.18)
    ),
    rgba(var(--v-theme-surface), 0.16);
  gap: 1rem;
  margin-block-start: 1rem;
  padding-block: 1rem;
  padding-inline: 1rem;
}

.items-overview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.items-overview__heading {
  flex: 1 1 auto;
  max-inline-size: 34rem;
  min-inline-size: 0;
}

.items-overview__documents {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.items-overview__document-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(var(--v-theme-primary), 0.16);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  gap: 0.5rem;
  letter-spacing: 0.04em;
  padding-block: 0.4rem;
  padding-inline: 0.7rem;
}

.items-overview__document-pill span {
  color: rgba(var(--v-theme-primary), 0.92);
}

.items-overview__document-action {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  gap: 0.35rem;
}

.items-overview__document-action:hover {
  color: rgba(var(--v-theme-primary), 0.96);
}

.items-overview__metrics {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.items-overview__metric {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.24);
  gap: 0.35rem;
  padding-block: 0.95rem;
  padding-inline: 1rem;
}

.items-overview__metric span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8rem;
}

.items-overview__metric strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
}

.items-overview__metric--primary {
  border: 1px solid rgba(var(--v-theme-primary), 0.12);
  background: rgba(var(--v-theme-primary), 0.08);
}

.items-overview__metric--accent {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.items-overview__details {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.items-overview__previews {
  display: flex;
  overflow: auto;
  flex-direction: column;
  gap: 0.75rem;
  max-block-size: 18rem;
  min-inline-size: 0;
  padding-inline-end: 0.25rem;
}

.items-overview__preview-panel {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: stretch;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.2);
  color: inherit;
  min-inline-size: 0;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}

.items-overview__preview-panel:hover {
  border-color: rgba(var(--v-theme-primary), 0.24);
  background: rgba(var(--v-theme-primary), 0.06);
  transform: translateY(-1px);
}

.items-overview__preview-panel--quotation {
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-info), 0.08);
}

.items-overview__preview-panel--proforma {
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-warning), 0.08);
}

.items-overview__preview-panel--invoice {
  box-shadow: inset 0 0 0 1px rgba(var(--v-theme-success), 0.08);
}

.items-overview__preview-summary,
.items-overview__preview-primary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  inline-size: 100%;
  padding-block: 0.95rem;
  padding-inline: 1rem;
  text-align: start;
}

.items-overview__preview-summary-side {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.items-overview__preview-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-block-end: 0.95rem;
}

.items-overview__preview-header,
.items-overview__preview-meta,
.items-overview__preview-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.items-overview__preview-header {
  align-items: flex-start;
}

.items-overview__preview-kicker {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.74rem;
  line-height: 1.1;
  margin-block-end: 0.25rem;
  text-transform: uppercase;
}

.items-overview__preview-title {
  display: block;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.items-overview__preview-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgba(var(--v-theme-primary), 0.92);
  font-size: 0.8rem;
  font-weight: 700;
  min-inline-size: 2rem;
  padding-block: 0.3rem;
  padding-inline: 0.55rem;
}

.items-overview__preview-meta {
  flex-wrap: wrap;
  justify-content: flex-start;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.76rem;
}

.items-overview__preview-total {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.1;
}

.items-overview__preview-primary {
  align-items: center;
  padding-block: 0;
}

.items-overview__preview-list {
  flex-wrap: wrap;
  justify-content: flex-start;
  padding-inline: 1rem;
}

.items-overview__preview-chip {
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgba(var(--v-theme-primary), 0.96);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding-block: 0.25rem;
  padding-inline: 0.6rem;
}

.items-overview__preview-more,
.items-overview__preview-empty {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
}

.items-preview-dialog {
  overflow: hidden;
}

.items-preview-dialog__body {
  padding: 0;
}

.items-preview-dialog__frame {
  display: block;
  border: 0;
  background: #fff;
  inline-size: 100%;
  min-block-size: 75vh;
}

.items-overview__detail {
  display: flex;
  flex-direction: column;
  border-inline-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  gap: 0.25rem;
  min-inline-size: 0;
  padding-inline-start: 0.75rem;
}

.items-overview__detail:first-child {
  border-inline-start: 0;
  padding-inline-start: 0;
}

.items-overview__detail span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
}

.items-overview__detail strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.98rem;
  font-weight: 600;
}

@media (max-width: 959px) {
  .items-overview__header {
    flex-direction: column;
  }

  .items-overview__documents {
    justify-content: flex-start;
  }

  .items-overview__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .items-overview__details {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .items-overview__previews {
    max-block-size: none;
  }
}

@media (max-width: 639px) {
  .items-overview__metrics,
  .items-overview__details {
    grid-template-columns: minmax(0, 1fr);
  }

  .items-overview__detail {
    border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    border-inline-start: 0;
    padding-block-start: 0.6rem;
    padding-inline-start: 0;
  }

  .items-overview__detail:first-child {
    border-block-start: 0;
    padding-block-start: 0;
  }
}

.task-row {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.task-row:hover {
  border-color: rgba(var(--v-theme-primary), 0.28);
  transform: translateY(-1px);
}

.task-row-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 1rem;
  padding-inline: 1.125rem;
}

.task-row-left {
  display: flex;
  flex: 1 1 auto;
  align-items: flex-start;
  gap: 0.5rem;
  min-inline-size: 0;
}

.task-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-inline-size: 0;
}

.task-copy strong,
.task-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row-side {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  align-self: center;
  gap: 0.75rem;
}

.task-mono {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.empty-tasks {
  padding-block: 1rem 0.5rem;
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

  .milestone-actions {
    flex-basis: 3.5rem;
    grid-template-columns: 1.625rem 1.625rem;
    inline-size: 3.5rem;
  }

  .milestone-actions :deep(.v-btn) {
    max-inline-size: 100%;
    min-block-size: 30px;
  }

  .item-card-shell,
  .phase-card-shell {
    gap: 0.75rem;
  }

  .item-card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .product-metrics,
  .product-metrics--phase {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .items-summary {
    max-inline-size: 100%;
  }

  .task-row-main {
    flex-direction: column;
    align-items: stretch;
  }

  .task-row-left,
  .task-row-side {
    inline-size: 100%;
  }

  .task-row-side {
    justify-content: space-between;
  }
}
</style>
