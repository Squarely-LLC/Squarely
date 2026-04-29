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
  DealItem,
  DealItemOverride,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useDealsStore } from "@/stores/deals";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { computed, reactive, ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  deal: DealProperties;
}>();
const emit = defineEmits<{
  (e: "open-add-task", payload: { initial: Partial<ToDo> }): void;
  (e: "open-edit-task", todoId: number | string): void;
  (e: "delete-task", todoId: number | string): void;
}>();

const cataloguesStore = useCataloguesStore();
const dealsStore = useDealsStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();

cataloguesStore.init();
dealsStore.init();
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

const addItemDialogVisible = ref(false);
const createItemTypeDialogVisible = ref(false);
const createDraftItemDialogVisible = ref(false);
const editLineDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const createDraftItemFormRef = ref<VForm>();
const editLineFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const selectedCatalogueItemId = ref<string | null>(null);
const selectedCreateItemType = ref<CatalogueItemType | null>(null);

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

const createTodosFromSalesTasks = (
  item: Pick<DealItem, "id" | "name">,
  salesTasks: CatalogueSalesTask[],
) =>
  salesTasks.map((task) =>
    todosStore.addTodo({
      title: task.title,
      collaborators: (task.collaborators || []).map((collaborator) => ({
        ...collaborator,
      })),
      dueAt: parseAfterWhen(task.afterWhen),
      afterWhen: task.afterWhen ?? null,
      startTrigger: task.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      status: (task.status as Status) || "pending",
      notes: [item.name, task.notes].filter(Boolean).join(" | "),
      important: Boolean(task.important),
      attachment: task.attachment ?? null,
      relatedTo: buildDealRelatedTo(),
      steps: Array.isArray(task.steps)
        ? task.steps.map((step) => ({ ...step }))
        : [],
    }),
  );

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
  const generatedTaskIds = createTodosFromSalesTasks(
    {
      id: baseId,
      name: catalogueItem.name,
    },
    extractSalesTasks(cataloguesStore.recordById(catalogueItem.id)),
  ).map((todo) => todo.id);
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
      generatedTaskIds,
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

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
};

const itemTypeLabel = (item: DealItem) =>
  item.itemTypeLabel || item.catalogueType || "Item";

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

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
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

const buildOverridePayload = (): DealItemOverride => ({
  name: editLine.name.trim(),
  category: editLine.category.trim() || null,
  quantity: normalizeEditableNumber(editLine.quantity, null),
  unitPrice: normalizeEditableNumber(editLine.unitPrice, null),
  discountPercent: normalizeEditableNumber(editLine.discountPercent, 0),
  taxApplicable: editLine.taxApplicable,
  note: editLine.note.trim() || null,
});

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
    editLine.taxApplicable = override.taxApplicable ?? item.taxApplicable ?? null;
    editLine.note = override.note ?? item.note ?? "";
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
  editLineDialogVisible.value = true;
};

const openEditGoal = (parentItem: DealItemWithPlan, goal: DerivedGoal) => {
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
  editLine.discountPercent = override.discountPercent ?? goal.discountPercent ?? 0;
  editLine.taxApplicable = override.taxApplicable ?? goal.taxApplicable ?? null;
  editLine.note = override.note ?? goal.note ?? "";
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
        unitPrice: payload.unitPrice,
        discountPercent: payload.discountPercent,
        taxApplicable: payload.taxApplicable,
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
      override.discountPercent === null || override.discountPercent === undefined
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
        goals: (contractual.phases || []).map((phase) =>
          applySubItemOverride(
            item,
            `phase-${phase.id}`,
            makeDerivedGoal(
              item,
              "phase",
              "Phase",
              {
                quantity: item.quantity,
                discountPercent: 0,
                discountLabel: "0%",
                taxApplicable: contractual.chargeTax,
                showQuantity: true,
                showPrice: true,
                showDiscount: true,
                showTaxApplicable: true,
              },
              phase,
            ),
          ),
        ),
        goalTypeSingular: "Phase",
        goalTypePlural: "Phases",
      }),
    ];
  }

  if (record.type === "Retainer Service") {
    const retainer = record as CatalogueRetainerServiceRecord;

    return [
      makeSection(item, {
        name: retainer.name,
        note: retainer.description || null,
        price: retainer.bestPrice,
        goals: (retainer.retainerServices || []).map((service) =>
          applySubItemOverride(
            item,
            `retainer-${service.id}`,
            makeDerivedGoal(
              item,
              "retainer",
              "Retainer Service",
              {
                quantity: item.quantity,
                discountPercent: 0,
                discountLabel: "0%",
                taxApplicable: service.chargeTax,
                showQuantity: true,
                showPrice: true,
                showDiscount: true,
                showTaxApplicable: true,
              },
              service,
            ),
          ),
        ),
        goalTypeSingular: "Retainer Service",
        goalTypePlural: "Retainer Services",
      }),
    ];
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;

    return [
      makeSection(item, {
        name: recurrent.name,
        note: recurrent.description || null,
        price: recurrent.bestPrice,
        goals: (recurrent.reccurentServices || []).map((service) =>
          applySubItemOverride(
            item,
            `recurrent-${service.id}`,
            makeDerivedGoal(
              item,
              "recurrent",
              "Recurrent Service",
              {
                quantity: item.quantity,
                discountPercent: 0,
                discountLabel: "0%",
                taxApplicable: service.chargeTax,
                showQuantity: true,
                showPrice: true,
                showDiscount: true,
                showTaxApplicable: true,
              },
              service,
            ),
          ),
        ),
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

const totalChildrenCount = (item: DealItemWithPlan) => item.childCount;

const derivedGoalsForItem = (item: DealItemWithPlan) =>
  item.derivedSections.flatMap((section) => section.goals);

const childCountLabel = (item: DealItemWithPlan) => {
  const count = totalChildrenCount(item);

  return `${count} ${
    count === 1 ? item.childTypeSingular : item.childTypePlural
  }`;
};

const itemsSubtotal = computed(() =>
  (props.deal.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    return sum + quantity * unitPrice;
  }, 0),
);

const totalDiscount = computed(() =>
  (props.deal.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPercent = Number(item.discountPercent || 0);

    return sum + quantity * unitPrice * (discountPercent / 100);
  }, 0),
);
const totalTax = computed(() => 0);
const grandTotal = computed(
  () => itemsSubtotal.value - totalDiscount.value + totalTax.value,
);

type DealTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
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

const salesTasks = computed(() =>
  dealTodos.value.filter((todo) => {
    const milestoneId = String(todo.milestoneId ?? "").trim();
    const goalId = String(todo.goalId ?? "").trim();

    return !milestoneId && !goalId;
  }),
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

const ensureGeneratedSalesTasks = () => {
  const currentItems = props.deal.items || [];
  let changed = false;

  const nextItems = currentItems.map((item) => {
    if (item.parentItemId || Array.isArray(item.generatedTaskIds)) return item;

    const record = item.catalogueItemId
      ? cataloguesStore.recordById(
          item.catalogueItemId,
          item.catalogueType || undefined,
        )
      : null;

    const salesTaskItems = extractSalesTasks(record);
    const generatedTaskIds = createTodosFromSalesTasks(
      item,
      salesTaskItems,
    ).map((todo) => todo.id);

    changed = true;

    return {
      ...item,
      generatedTaskIds,
    };
  });

  if (changed) dealsStore.updateDeal(props.deal.id, { items: nextItems });
};

watch(
  () => props.deal.items,
  () => {
    ensureGeneratedSalesTasks();
  },
  { immediate: true, deep: true },
);
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
              <div class="item-card-shell">
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
                    <VChip size="small" variant="tonal" color="primary">
                      {{ itemTypeLabel(item) }}
                    </VChip>
                  </div>

                  <div class="item-card-meta">
                    <span v-if="item.category">{{ item.category }}</span>
                    <span>{{ childCountLabel(item) }}</span>
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
                  class="d-flex align-center gap-2 milestone-actions"
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
                        <VListItem @click="removeDealItem(item)">
                          <template #prepend>
                            <VIcon icon="tabler-trash" color="error" />
                          </template>
                          <VListItemTitle>Remove</VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>
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
                          <VChip color="primary" size="x-small" variant="tonal">
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
                            <strong>{{ formatGoalDiscount(goal) || "--" }}</strong>
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

                      <VBtn
                        icon
                        variant="text"
                        size="x-small"
                        class="phase-edit-btn"
                        @click.stop="openEditGoal(item, goal)"
                      >
                        <VIcon icon="tabler-pencil" size="16" />
                      </VBtn>
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

        <div v-if="dealItemsWithPlan.length" class="items-summary mt-4 pt-4">
          <div class="items-summary__row">
            <span>Total</span>
            <strong>{{ formatMoney(itemsSubtotal) }}</strong>
          </div>
          <div class="items-summary__row">
            <span>Total Discount</span>
            <strong>{{ formatMoney(totalDiscount) }}</strong>
          </div>
          <div class="items-summary__row">
            <span>Total Tax</span>
            <strong>{{ formatMoney(totalTax) }}</strong>
          </div>
          <div class="items-summary__row items-summary__row--grand">
            <span>Grand Total</span>
            <strong>{{ formatMoney(grandTotal) }}</strong>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard>
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

        <div v-if="salesTasks.length" class="d-flex flex-column gap-2">
          <VCard
            v-for="task in salesTasks"
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
                  <span v-if="task.notes" class="text-sm text-medium-emphasis">
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
              <AppSelect
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
            <VCol cols="12" md="8">
              <AppTextField
                v-model="editLine.name"
                label="Name"
                placeholder="Item name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="4">
              <AppTextField
                v-model="editLine.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="editLine.unitPrice"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="editLine.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="editLine.discountPercent"
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
                  v-model="editLine.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol cols="12">
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
                    variant="tonal"
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

.milestone-panel--static :deep(.v-expansion-panel-title__icon) {
  display: none;
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

.item-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  line-height: 1.2;
  margin-block-start: 0.15rem;
}

.item-card-meta span + span {
  position: relative;
}

.item-card-meta span + span::before {
  position: absolute;
  border-radius: 999px;
  background: currentColor;
  block-size: 0.25rem;
  content: "";
  inline-size: 0.25rem;
  inset-block-start: 50%;
  inset-inline-start: -0.5rem;
  transform: translateY(-50%);
}

.product-metrics {
  display: grid;
  gap: 0.375rem;
  grid-template-columns: repeat(5, minmax(5rem, 1fr));
  margin-block-start: 0.5rem;
}

.product-metrics--phase {
  grid-template-columns: repeat(5, minmax(4.75rem, 1fr));
}

.product-metric {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.18);
  min-inline-size: 0;
  padding-block: 0.35rem;
  padding-inline: 0.5rem;
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
  border-color: rgba(var(--v-theme-primary), 0.2);
  background: rgba(var(--v-theme-primary), 0.08);
}

.phase-edit-btn {
  align-self: flex-start;
  flex: 0 0 auto;
  margin-block-start: -0.25rem;
}

.item-card-note {
  display: -webkit-box;
  overflow: hidden;
  margin-block-start: 0.45rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
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

.items-summary {
  border-block-start: 1px solid rgba(255, 255, 255, 8%);
  margin-inline-start: auto;
  max-inline-size: 20rem;
}

.items-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.375rem;
}

.items-summary__row--grand {
  font-weight: 700;
  padding-block-start: 0.75rem;
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

  .item-card-shell,
  .phase-card-shell {
    gap: 0.75rem;
  }

  .item-card-header {
    align-items: flex-start;
    flex-direction: column;
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
