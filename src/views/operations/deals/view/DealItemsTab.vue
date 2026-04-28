<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type {
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
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  deal: DealProperties;
}>();

const cataloguesStore = useCataloguesStore();
const dealsStore = useDealsStore();
const notifications = useNotificationsStore();
const router = useRouter();

cataloguesStore.init();
dealsStore.init();

type DerivedGoal = {
  id: string;
  name: string;
  note: string | null;
  price: number | null;
};

type DerivedSection = {
  id: string;
  name: string;
  note: string | null;
  price: number | null;
  goals: DerivedGoal[];
};

type DealItemWithPlan = DealItem & {
  isExpandable: boolean;
  derivedSections: DerivedSection[];
};

const addItemDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const selectedCatalogueItemId = ref<string | null>(null);

const addItemDraft = reactive({
  quantity: 1,
  status: "Planned",
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

const nextItemId = () => {
  const ids = (props.deal.items || [])
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id));

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const openAddItemDialog = () => {
  selectedCatalogueItemId.value = null;
  addItemDraft.quantity = 1;
  addItemDraft.status = "Planned";
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

  const nextItems: DealItem[] = [
    ...(props.deal.items || []),
    {
      id: nextItemId(),
      name: selectedCatalogueItem.value.name,
      category: selectedCatalogueItem.value.category,
      catalogueItemId: selectedCatalogueItem.value.id,
      catalogueType: selectedCatalogueItem.value.type,
      quantity: Number(addItemDraft.quantity || 1),
      unitPrice: Number(selectedCatalogueItem.value.bestPrice || 0),
      status: addItemDraft.status || "Planned",
      note: selectedCatalogueItem.value.description || null,
    },
  ];

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  notifications.push("Item added to deal", "success", 3000);
  addItemDialogVisible.value = false;
};

const removeDealItem = (itemId: number) => {
  const nextItems = (props.deal.items || []).filter(
    (item) => item.id !== itemId,
  );

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  notifications.push("Item removed", "success", 2500);
};

const isProductLike = (type?: string | null) =>
  type === "Product" ||
  type === "Produced Product" ||
  type === "Onetime Service";

const childLabelForItem = (item: DealItem) => {
  const type = (item.catalogueType || "").trim();

  if (type === "Contractual Service")
    return { singular: "Phase", plural: "Phases" };
  if (type === "Reccurent Service")
    return { singular: "Recurrent Service", plural: "Recurrent Services" };
  if (type === "Retainer Service")
    return { singular: "Retainer Service", plural: "Retainer Services" };

  return { singular: "Item", plural: "Items" };
};

const formatMoney = (value?: number | null) =>
  value === null || value === undefined ? "--" : Number(value).toLocaleString();

const normalizeComparableText = (value?: string | null) =>
  (value || "").trim().toLowerCase();

const shouldShowSectionHeader = (
  item: DealItemWithPlan,
  section: DerivedSection,
) => {
  const isSingleSection = item.derivedSections.length === 1;

  if (!isSingleSection) return true;

  const sameName =
    normalizeComparableText(section.name) ===
    normalizeComparableText(item.name);
  const sameNote =
    normalizeComparableText(section.note) ===
    normalizeComparableText(item.note);
  const samePrice = (section.price ?? null) === (item.unitPrice ?? null);

  return !(sameName && sameNote && samePrice);
};

const deriveSections = (item: DealItem): DerivedSection[] => {
  const record = item.catalogueItemId
    ? cataloguesStore.recordById(
        item.catalogueItemId,
        item.catalogueType || undefined,
      )
    : null;

  if (!record) {
    return [
      {
        id: `item-${item.id}`,
        name: item.name,
        note: item.note || null,
        price: item.unitPrice ?? null,
        goals: [],
      },
    ];
  }

  if (record.type === "Contractual Service") {
    const contractual = record as CatalogueContractualServiceRecord;

    return [
      {
        id: `item-${item.id}`,
        name: contractual.name,
        note: contractual.description || null,
        price: contractual.bestPrice,
        goals: (contractual.phases || []).map((phase) => ({
          id: `phase-${item.id}-${phase.id}`,
          name: phase.name,
          note: null,
          price: phase.price,
        })),
      },
    ];
  }

  if (record.type === "Retainer Service") {
    const retainer = record as CatalogueRetainerServiceRecord;

    return [
      {
        id: `item-${item.id}`,
        name: retainer.name,
        note: retainer.description || null,
        price: retainer.bestPrice,
        goals: (retainer.retainerServices || []).map((service) => ({
          id: `retainer-${item.id}-${service.id}`,
          name: service.name,
          note: service.description || null,
          price: service.price,
        })),
      },
    ];
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;

    return [
      {
        id: `item-${item.id}`,
        name: recurrent.name,
        note: recurrent.description || null,
        price: recurrent.bestPrice,
        goals: (recurrent.reccurentServices || []).map((service) => ({
          id: `recurrent-${item.id}-${service.id}`,
          name: service.name,
          note: service.description || null,
          price: service.price,
        })),
      },
    ];
  }

  if (record.type === "Onetime Service") {
    const service = record as CatalogueOnetimeServiceRecord;

    return [
      {
        id: `item-${item.id}`,
        name: service.name,
        note: service.description || null,
        price: service.bestPrice,
        goals: [],
      },
    ];
  }

  if (record.type === "Produced Product") {
    const produced = record as CatalogueProducedProductRecord;

    return [
      {
        id: `item-${item.id}`,
        name: produced.name,
        note: produced.description || null,
        price: produced.bestPrice,
        goals: [],
      },
    ];
  }

  const product = record as CatalogueProductRecord;

  if (isProductLike(product.type)) {
    return [
      {
        id: `item-${item.id}`,
        name: product.name,
        note: product.description || null,
        price: product.bestPrice,
        goals: [],
      },
    ];
  }

  return [
    {
      id: `item-${item.id}`,
      name: item.name,
      note: item.note || null,
      price: item.unitPrice ?? null,
      goals: [],
    },
  ];
};

const dealItemsWithPlan = computed<DealItemWithPlan[]>(() =>
  (props.deal.items || []).map((item) => ({
    ...item,
    isExpandable: !isProductLike(item.catalogueType),
    derivedSections: deriveSections(item),
  })),
);

const totalChildrenCount = (item: DealItemWithPlan) =>
  item.derivedSections.reduce((sum, section) => sum + section.goals.length, 0);
</script>

<template>
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

      <div v-else class="d-flex flex-column gap-4">
        <template v-for="item in dealItemsWithPlan" :key="item.id">
          <VExpansionPanels
            v-model="expandedItems"
            variant="accordion"
            multiple
            class="expansion-panels-width-border milestone-panels"
          >
            <VExpansionPanel
              :value="item.id"
              class="milestone-panel"
              :class="{ 'milestone-panel--static': !item.isExpandable }"
            >
              <VExpansionPanelTitle
                @click.capture="
                  (event: MouseEvent) => {
                    if (!item.isExpandable) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }
                "
              >
                <div class="d-flex align-center gap-3 w-100">
                  <div class="rounded-circle milestone-status-dot" />

                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex align-center gap-2 flex-wrap">
                      <div
                        class="font-weight-medium truncate-title truncate-title--header"
                      >
                        {{ item.name }}
                      </div>
                      <VChip size="small" variant="text" color="primary">
                        {{ item.catalogueType || "Custom Item" }}
                      </VChip>
                    </div>

                    <div class="text-caption text-medium-emphasis">
                      <span v-if="item.category">{{ item.category }} | </span>
                      <span>Qty {{ item.quantity }}</span>
                      <span
                        v-if="
                          item.unitPrice !== null &&
                          item.unitPrice !== undefined
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
                    class="d-flex align-center gap-2 milestone-actions"
                    @click.stop
                  >
                    <VBtn icon variant="text" size="x-small">
                      <VIcon icon="tabler-dots-vertical" size="18" />
                      <VMenu activator="parent">
                        <VList>
                          <VListItem @click="removeDealItem(item.id)">
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
                  <div class="d-flex flex-column gap-3">
                    <VCard
                      v-for="section in item.derivedSections"
                      :key="section.id"
                      variant="tonal"
                      class="item-plan-card"
                    >
                      <VCardText>
                        <div
                          v-if="shouldShowSectionHeader(item, section)"
                          class="d-flex justify-space-between align-center gap-2 flex-wrap"
                        >
                          <div>
                            <div class="font-weight-medium">
                              {{ section.name }}
                            </div>
                            <div class="text-sm text-medium-emphasis">
                              {{ section.note || "No item notes." }}
                            </div>
                          </div>

                          <div class="text-sm text-medium-emphasis">
                            {{ formatMoney(section.price) }}
                          </div>
                        </div>

                        <div
                          v-if="section.goals.length"
                          class="d-flex align-center gap-2 flex-wrap text-caption text-medium-emphasis"
                          :class="{
                            'mt-4': shouldShowSectionHeader(item, section),
                          }"
                        >
                          <span class="font-weight-medium">
                            {{
                              `${section.goals.length} ${
                                section.goals.length === 1
                                  ? childLabelForItem(item).singular
                                  : childLabelForItem(item).plural
                              }`
                            }}
                          </span>
                        </div>

                        <div
                          v-if="section.goals.length"
                          class="d-flex flex-column gap-2"
                          :class="{
                            'mt-3': shouldShowSectionHeader(item, section),
                          }"
                        >
                          <VCard
                            v-for="goal in section.goals"
                            :key="goal.id"
                            variant="tonal"
                            class="child-static-row"
                          >
                            <div class="d-flex align-center gap-3 w-100">
                              <VIcon
                                icon="tabler-target-arrow"
                                size="16"
                                class="goal-icon"
                              />

                              <div class="flex-grow-1 min-w-0">
                                <div
                                  class="font-weight-medium truncate-title truncate-title--header"
                                >
                                  {{ goal.name }}
                                </div>
                                <div
                                  class="text-body-2 text-medium-emphasis mt-1"
                                >
                                  {{ goal.note || "No notes." }}
                                </div>
                              </div>

                              <div class="text-sm text-medium-emphasis">
                                {{ formatMoney(goal.price) }}
                              </div>
                            </div>
                          </VCard>
                        </div>
                      </VCardText>
                    </VCard>
                  </div>
                </VCard>
              </VExpansionPanelText>
            </VExpansionPanel>
          </VExpansionPanels>
        </template>
      </div>
    </VCardText>
  </VCard>

  <VDialog v-model="addItemDialogVisible" max-width="640">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add Item</h5>

        <VForm ref="addItemFormRef" @submit.prevent="saveSelectedCatalogueItem">
          <VRow>
            <VCol cols="12">
              <AppSelect
                v-model="selectedCatalogueItemId"
                label="Catalogue Item"
                placeholder="Select catalogue item"
                :items="catalogueOptions"
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

            <VCol cols="12" md="6">
              <AppTextField
                v-model="addItemDraft.quantity"
                type="number"
                min="1"
                label="Quantity"
                placeholder="1"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="addItemDraft.status"
                label="Status"
                placeholder="Planned"
              />
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
.milestone-panels :deep(.v-expansion-panel) {
  background: transparent;
}

.milestone-panels :deep(.v-expansion-panel-title) {
  padding-block: 1rem;
  padding-inline: 1.25rem;
}

.milestone-panels :deep(.v-expansion-panel-text__wrapper) {
  padding-block: 0 1rem;
  padding-inline: 1rem;
}

.milestone-panels :deep(.v-expansion-panel__shadow) {
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

.milestone-actions {
  min-inline-size: 0;
}

.milestone-actions :deep(.v-btn) {
  margin: 0;
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

.child-static-row {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
  padding-block: 1rem;
  padding-inline: 1.25rem;
}

.item-plan-card {
  border: 1px solid rgba(255, 255, 255, 6%);
}

.empty-tasks {
  padding-block: 0.5rem;
  padding-inline: 0;
}
</style>
