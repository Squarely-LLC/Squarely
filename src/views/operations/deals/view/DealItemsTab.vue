<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { Status, ToDo } from "@/data/schema";
import type {
  CatalogueSalesTask,
  CatalogueContractualServiceRecord,
  CatalogueItem,
  CatalogueOnetimeServiceRecord,
  CatalogueProducedProductRecord,
  CatalogueProductRecord,
  CatalogueReccurentServiceRecord,
  CatalogueRetainerServiceRecord,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealItem,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useDealsStore } from "@/stores/deals";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
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
const router = useRouter();

cataloguesStore.init();
dealsStore.init();
todosStore.init();

type DerivedGoal = {
  id: string;
  name: string;
  note: string | null;
  price: number | null;
  typeLabel: string;
  quantity: number | null;
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

const addItemDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const selectedCatalogueItemId = ref<string | null>(null);

const addItemDraft = reactive({
  quantity: 1,
});

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
  const value = String(raw || "").trim().toLowerCase();
  const match = value.match(/^([+-]?\d+)\s*(day|days|week|weeks|month|months)$/);

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

  const salesTasks = (record as { salesTasks?: CatalogueSalesTask[] }).salesTasks;

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
      startTrigger: task.startTrigger ?? { type: "time", goalId: null, taskId: null },
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

const itemTypeLabel = (item: DealItem) =>
  item.itemTypeLabel || item.catalogueType || "Item";

const openAddItemDialog = () => {
  selectedCatalogueItemId.value = null;
  addItemDraft.quantity = 1;
  addItemDialogVisible.value = true;
};

const openCreateCatalogueItem = async () => {
  const target = router.resolve({ name: "catalogues-add" });

  if (typeof window !== "undefined")
    window.open(target.href, "_blank", "noopener,noreferrer");
};

const saveSelectedCatalogueItem = async () => {
  const { valid } = (await addItemFormRef.value?.validate()) ?? { valid: true };
  if (!valid || !selectedCatalogueItem.value) return;

  const selectedItem = selectedCatalogueItem.value;
  const baseId = nextItemId();
  const quantity = Number(addItemDraft.quantity || 1);
  const generatedTaskIds = createTodosFromSalesTasks(
    {
      id: baseId,
      name: selectedItem.name,
    },
    extractSalesTasks(selectedCatalogueRecord.value),
  ).map((todo) => todo.id);
  const relatedItems =
    selectedCatalogueRecord.value?.type === "Onetime Service"
      ? (selectedCatalogueRecord.value as CatalogueOnetimeServiceRecord)
          .relatedItems || []
      : [];

  const nextItems: DealItem[] = [
    ...(props.deal.items || []),
    {
      id: baseId,
      name: selectedItem.name,
      itemTypeLabel: selectedItem.type,
      category: selectedItem.category,
      catalogueItemId: selectedItem.id,
      catalogueType: selectedItem.type,
      parentItemId: null,
      sourceRelatedItemId: null,
      excludedRelatedItemIds: null,
      generatedTaskIds,
      quantity,
      unitPrice: Number(selectedItem.bestPrice || 0),
      status: "Planned",
      note: selectedItem.description || null,
    },
    ...relatedItems.map((relatedItem, index) => ({
      id: baseId + index + 1,
      name: relatedItem.name,
      itemTypeLabel: "Related Item",
      category: relatedItem.category,
      catalogueItemId: selectedItem.id,
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
  notifications.push("Item added to deal", "success", 3000);
  addItemDialogVisible.value = false;
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

const isProductLike = (type?: string | null) =>
  type === "Product" ||
  type === "Produced Product" ||
  type === "Rental" ||
  type === "Onetime Service" ||
  type === "Related Item";

const formatMoney = (value?: number | null) =>
  value === null || value === undefined ? "--" : Number(value).toLocaleString();

const formatTaxApplicable = (value: boolean | null) => {
  if (value === null)
    return "--";

  return value ? "Yes" : "No";
};

const makeDerivedGoal = (
  item: DealItem,
  prefix: string,
  typeLabel: string,
  display: {
    quantity: number | null;
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
    description?: string | null;
    note?: string | null;
    price?: number | null;
    chargeTax?: boolean | null;
  },
): DerivedGoal => ({
  id: `${prefix}-${item.id}-${source.id}`,
  name: source.name,
  note: source.note ?? source.description ?? null,
  price: source.price ?? null,
  typeLabel,
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
        goals: (contractual.phases || []).map((phase) => ({
          ...makeDerivedGoal(
            item,
            "phase",
            "Phase",
            {
              quantity: item.quantity,
              discountLabel: "0%",
              taxApplicable: contractual.chargeTax,
              showQuantity: true,
              showPrice: true,
              showDiscount: true,
              showTaxApplicable: true,
            },
            phase,
          ),
        })),
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
          makeDerivedGoal(
            item,
            "retainer",
            "Retainer Service",
            {
              quantity: item.quantity,
              discountLabel: null,
              taxApplicable: null,
              showQuantity: true,
              showPrice: false,
              showDiscount: false,
              showTaxApplicable: false,
            },
            service,
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
          makeDerivedGoal(
            item,
            "recurrent",
            "Recurrent Service",
            {
              quantity: null,
              discountLabel: null,
              taxApplicable: null,
              showQuantity: false,
              showPrice: false,
              showDiscount: false,
              showTaxApplicable: false,
            },
            service,
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
    .map((relatedItem) => ({
      id: item.id,
      panelId: `related-${item.id}-${relatedItem.id}`,
      name: relatedItem.name,
      itemTypeLabel: "Related Item",
      category: relatedItem.category,
      catalogueItemId: item.catalogueItemId,
      catalogueType: "Related Item",
      parentItemId: item.id,
      sourceRelatedItemId: relatedItem.id,
      quantity: item.quantity,
      unitPrice: relatedItem.price ?? null,
      status: item.status,
      note: relatedItem.description || null,
      isExpandable: false,
      derivedSections: [
        makeSection(item, {
          name: relatedItem.name,
          note: relatedItem.description || null,
          price: relatedItem.price ?? null,
          goals: [],
          goalTypeSingular: "Related Item",
          goalTypePlural: "Related Items",
        }),
      ],
      childTypeSingular: "Related Item",
      childTypePlural: "Related Items",
      childCount: 0,
      actionsEnabled: true,
    }));
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

const totalDiscount = computed(() => 0);
const totalTax = computed(() => 0);
const grandTotal = computed(
  () => itemsSubtotal.value - totalDiscount.value + totalTax.value,
);

type DealTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
};

const dealTodos = computed<DealTodo[]>(() =>
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
    ? (name.trim().match(/\b\w/g) || [])
        .slice(0, 2)
        .join("")
        .toUpperCase()
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
    const generatedTaskIds = createTodosFromSalesTasks(item, salesTaskItems).map(
      (todo) => todo.id,
    );

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
              <VListItemTitle>Create Catalogue Item</VListItemTitle>
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
            <div class="d-flex align-center gap-3 w-100">
              <div class="rounded-circle milestone-status-dot" />

              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-center gap-2 flex-wrap">
                  <VTooltip :text="item.name" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <div
                        v-bind="tooltipProps"
                        class="font-weight-medium truncate-title truncate-title--header"
                      >
                        {{ item.name }}
                      </div>
                    </template>
                  </VTooltip>
                  <VChip size="small" variant="text" color="primary">
                    {{ itemTypeLabel(item) }}
                  </VChip>
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ childCountLabel(item) }}
                  <span v-if="item.category"> | {{ item.category }}</span>
                  | Qty {{ item.quantity }}
                  <span
                    v-if="
                      item.unitPrice !== null && item.unitPrice !== undefined
                    "
                  >
                    | {{ formatMoney(item.unitPrice) }}
                  </span>
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">
                  {{ item.note || "No item notes." }}
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
            <VCard variant="flat" class="pa-4 milestone-panel-body">
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
                        <VChip color="primary" size="x-small" variant="text">
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
                        class="text-caption text-medium-emphasis"
                      >
                        <span v-if="goal.showQuantity">
                          Qty {{ goal.quantity ?? "--" }}
                        </span>
                        <span v-if="goal.showPrice">
                          | Price {{ formatMoney(goal.price) }}
                        </span>
                        <span v-if="goal.showDiscount">
                          | Discount {{ goal.discountLabel || "--" }}
                        </span>
                        <span v-if="goal.showTaxApplicable">
                          | Tax Applicable
                          {{ formatTaxApplicable(goal.taxApplicable) }}
                        </span>
                      </div>
                      <div class="text-body-2 text-medium-emphasis mt-1">
                        {{ goal.note || "No notes." }}
                      </div>
                    </div>
                  </div>
                </VCard>
              </div>

              <div v-else class="text-body-2 text-medium-emphasis">
                No {{ item.childTypePlural.toLowerCase() }} under this item yet.
              </div>
            </VCard>
          </VExpansionPanelText>
        </VExpansionPanel>
      </VExpansionPanels>

        <div
          v-if="dealItemsWithPlan.length"
          class="items-summary mt-4 pt-4"
        >
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
        <div class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4">
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
                <VBtn icon variant="text" size="x-small" @click.stop="emit('delete-task', task.id)">
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

.milestone-panel--static {
  cursor: default;
}

.milestone-panel--static :deep(.v-expansion-panel-title__icon) {
  display: none;
}

.milestone-status-dot {
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  block-size: 10px;
  inline-size: 10px;
  min-inline-size: 10px;
}

.milestone-panel-body {
  display: flex;
  flex-direction: column;
  background: rgba(var(--v-theme-surface), 0.14);
  box-shadow: none;
  gap: 1rem;
}

.goal-panels :deep(.v-expansion-panel) {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
}

.goal-panel--static {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
  padding-block: 1rem;
  padding-inline: 1.25rem;
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

.goal-icon {
  color: rgb(var(--v-theme-info));
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
  transition: border-color 0.18s ease, transform 0.18s ease;
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
  padding: 1rem 1.125rem;
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
