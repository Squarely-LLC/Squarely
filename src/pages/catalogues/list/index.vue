<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import type {
  CatalogueActiveState,
  CatalogueItem,
  CatalogueItemType,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";

type SortKey =
  | "name"
  | "category"
  | "activeState"
  | "sku"
  | "qty"
  | "type"
  | "createdAt";
type SortOrder = "asc" | "desc";
type ItemTypeChoice = {
  title: string;
  value: string;
  description: string;
  icon: string;
};

const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const configStore = useConfigStore();
configStore.init();
const router = useRouter();

const headers = [
  { title: "Item", key: "product" },
  { title: "Category", key: "category" },
  { title: "Type", key: "type" },
  { title: "Active", key: "activeState", sortable: false },
  { title: "SKU", key: "sku" },
  { title: "QTY", key: "qty" },
  { title: "Actions", key: "actions", sortable: false },
];

const selectedType = ref<string | undefined>();
const selectedCategory = ref<string | undefined>();
const selectedActive = ref<string | undefined>();
const searchQuery = ref("");

const DEFAULT_TYPE_OPTIONS: CatalogueItemType[] = [
  "Onetime Service",
  "Product",
  "Contractual Service",
  "Retainer Service",
  "Reccurent Service",
  "Produced Product",
  "Rental",
];

const DEFAULT_ACTIVE_OPTIONS: CatalogueActiveState[] = [
  "Active",
  "Non-Active",
  "Archived",
];

const cleanEntries = (values?: (string | null | undefined)[]) =>
  Array.from(
    new Set(
      (values || [])
        .map(value => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );

const flattenCategoryNames = (items?: CatalogueCategory[]) => {
  const names: string[] = [];

  for (const item of items || []) {
    const name = item.name?.trim();
    if (name) names.push(name);

    if (item.children?.length) names.push(...flattenCategoryNames(item.children));
  }

  return names;
};

const configuredTypes = computed<{ title: string; value: CatalogueItemType }[]>(() => {
  const values = cleanEntries(configStore.configurations.catalogue?.itemTypes);
  const source = (values.length ? values : DEFAULT_TYPE_OPTIONS) as CatalogueItemType[];

  return source.map(value => ({ title: value, value }));
});

const categories = computed(() => {
  const unique = Array.from(
    new Set(flattenCategoryNames(configStore.configurations.catalogue?.categories)),
  ).sort((a, b) => a.localeCompare(b));

  return unique.map(category => ({ title: category, value: category }));
});

const configuredActiveOptions = computed<
  { title: string; value: CatalogueActiveState }[]
>(() => {
  const values = cleanEntries(configStore.configurations.catalogue?.activeStates);
  const source = values.length ? values : DEFAULT_ACTIVE_OPTIONS;

  return source.map(value => ({ title: value, value }));
});

const hideArchivedByDefault = computed(
  () => configStore.configurations.catalogue?.hideArchivedByDefault ?? true,
);

const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<SortKey | undefined>("createdAt");
const orderBy = ref<SortOrder | undefined>("desc");
const openActiveMenuId = ref<number | string | null>(null);
const isDeleteConfirmVisible = ref(false);
const isAddItemTypeDialogVisible = ref(false);
const deleteCandidate = ref<CatalogueItem | null>(null);
const itemTypeChoices: ItemTypeChoice[] = [
  {
    title: "Onetime Service",
    value: "Onetime Service",
    description: "Single-scope service delivered once, such as an installation or one-off site visit.",
    icon: "tabler-bolt",
  },
  {
    title: "Product",
    value: "Product",
    description: "Standard stocked item purchased, stored, and sold as inventory.",
    icon: "tabler-package",
  },
  {
    title: "Contractual Service",
    value: "Contractual Service",
    description: "Service sold under a fixed contract period, scope, or maintenance agreement.",
    icon: "tabler-file-description",
  },
  {
    title: "Retainer Service",
    value: "Retainer Service",
    description: "Ongoing advisory or support service billed to reserve team availability over time.",
    icon: "tabler-briefcase",
  },
  {
    title: "Reccurent Service",
    value: "Reccurent Service",
    description: "Scheduled repeat service delivered on a recurring basis such as monthly cleaning or upkeep.",
    icon: "tabler-repeat",
  },
  {
    title: "Produced Product",
    value: "Produced Product",
    description: "Item manufactured, assembled, or custom-built internally before delivery.",
    icon: "tabler-building-factory-2",
  },
  {
    title: "Rental",
    value: "Rental",
    description: "Reusable asset hired out for a defined time window and then returned to stock.",
    icon: "tabler-calendar-time",
  },
];

const updateOptions = (options: {
  sortBy?: Array<{ key: SortKey; order: SortOrder }>;
}) => {
  sortBy.value = options.sortBy?.[0]?.key ?? "createdAt";
  orderBy.value = options.sortBy?.[0]?.order ?? "desc";
};

watch([selectedType, selectedCategory, selectedActive, searchQuery], () => {
  page.value = 1;
});

const setActiveMenu = (id: number | string, value: boolean) => {
  openActiveMenuId.value = value ? id : null;
};

const resolveActive = (activeState: CatalogueActiveState) => {
  if (activeState === "Active") return { text: "Active", color: "success" };
  if (activeState === "Non-Active")
    return { text: "Non-Active", color: "warning" };
  if (activeState === "Archived") return { text: "Archived", color: "secondary" };
  return { text: activeState, color: "primary" };
};

const activeTextClass = (activeState: CatalogueActiveState) =>
  activeState === "Active"
    ? "text-success"
    : activeState === "Non-Active"
      ? "text-warning"
      : activeState === "Archived"
        ? "text-secondary"
        : "text-primary";

const isArchivedState = (value?: string | null) =>
  String(value ?? "").trim().toLowerCase() === "archived";

const hasInventoryQuantity = (product: CatalogueItem) =>
  product.type === "Product" ||
  product.type === "Produced Product" ||
  product.type === "Rental";

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (product: CatalogueItem) => {
  const query = normalizedSearch.value;
  if (query) {
    const haystacks = [
      product.name,
      product.brand,
      product.category,
      product.type,
      product.sku,
      product.activeState,
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase());

    if (!haystacks.some(value => value.includes(query))) return false;
  }

  if (selectedType.value && product.type !== selectedType.value) {
    return false;
  }

  if (selectedCategory.value && product.category !== selectedCategory.value) {
    return false;
  }

  if (selectedActive.value) {
    if (product.activeState !== selectedActive.value) return false;
  } else if (hideArchivedByDefault.value && isArchivedState(product.activeState)) {
    return false;
  }

  return true;
};

const normalizeSortValue = (product: CatalogueItem, key?: SortKey) => {
  switch (key) {
    case "name":
      return product.name?.toLowerCase() ?? "";
    case "category":
      return product.category?.toLowerCase() ?? "";
    case "activeState":
      return product.activeState ?? "";
    case "sku":
      return product.sku?.toLowerCase() ?? "";
    case "qty":
      return product.qty ?? 0;
    case "type":
      return product.type ?? "";
    case "createdAt":
    default:
      return product.createdAt ?? "";
  }
};

const compareProducts = (a: CatalogueItem, b: CatalogueItem) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(String(aValue)).getTime() : 0;
    const bDate = bValue ? new Date(String(bValue)).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  if (key === "qty") {
    const diff = Number(aValue) - Number(bValue);
    return order === "asc" ? diff : -diff;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredProducts = computed<CatalogueItem[]>(() =>
  cataloguesStore.all.filter(matchesFilters),
);

const sortedProducts = computed<CatalogueItem[]>(() => {
  const items = [...filteredProducts.value];
  if (items.length > 1) items.sort(compareProducts);
  return items;
});

const displayedProducts = computed<CatalogueItem[]>(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1
      ? sortedProducts.value.length
      : start + itemsPerPage.value;

  return sortedProducts.value.slice(start, end);
});

const totalProducts = computed(() => sortedProducts.value.length);

const updateActiveState = (product: CatalogueItem, activeState: string) => {
  cataloguesStore.updateProduct(product.id, { activeState });
};

const confirmDeleteCandidate = (product: CatalogueItem) => {
  deleteCandidate.value = product;
  isDeleteConfirmVisible.value = true;
};

const performDeleteConfirmed = () => {
  if (deleteCandidate.value) {
    cataloguesStore.removeProduct(deleteCandidate.value.id);
  }

  isDeleteConfirmVisible.value = false;
  deleteCandidate.value = null;
};

const cancelDelete = () => {
  isDeleteConfirmVisible.value = false;
  deleteCandidate.value = null;
};

const openAddItemTypeDialog = () => {
  isAddItemTypeDialogVisible.value = true;
};

const goToAddItemPage = (type: string) => {
  isAddItemTypeDialogVisible.value = false;
  router.push({
    path: "/catalogues/add",
    query: {
      type,
    },
  });
};

const goToEditItemPage = (item: CatalogueItem) => {
  router.push({
    path: "/catalogues/add",
    query: {
      type: item.type,
      id: item.id,
    },
  });
};
</script>

<template>
  <div>
    <VCard title="Filters" class="mb-6">
      <VCardText>
        <VRow>
          <VCol cols="12" sm="4">
            <AppSelect
              v-model="selectedType"
              placeholder="Type"
              :items="configuredTypes"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="4">
            <AppSelect
              v-model="selectedCategory"
              placeholder="Category"
              :items="categories"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="4">
            <AppSelect
              v-model="selectedActive"
              placeholder="Active"
              :items="configuredActiveOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <div class="d-flex flex-wrap gap-4 ma-6">
        <div class="d-flex align-center">
          <AppTextField
            v-model="searchQuery"
            placeholder="Search Catalogue"
            style="inline-size: 200px"
            class="me-3"
          />
        </div>

        <VSpacer />
        <div class="d-flex gap-4 flex-wrap align-center">
          <AppSelect v-model="itemsPerPage" :items="[5, 10, 20, 25, 50]" />

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            color="primary"
            prepend-icon="tabler-plus"
            @click="openAddItemTypeDialog"
          >
            Add Item
          </VBtn>
        </div>
      </div>

      <VDivider class="mt-4" />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="displayedProducts"
        :items-length="totalProducts"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.product="{ item }">
          <div
            class="d-flex align-center gap-x-4 item-link-cell"
            role="button"
            tabindex="0"
            @click="goToEditItemPage(item)"
            @keydown.enter.prevent="goToEditItemPage(item)"
            @keydown.space.prevent="goToEditItemPage(item)"
          >
            <VAvatar
              v-if="item.image"
              size="38"
              variant="tonal"
              rounded
              :image="item.image"
            />
            <div class="d-flex flex-column">
              <span class="text-body-1 font-weight-medium text-high-emphasis">
                {{ item.name }}
              </span>
              <span class="text-body-2">{{ item.brand }}</span>
            </div>
          </div>
        </template>

        <template #item.category="{ item }">
          <span
            class="text-body-1 text-high-emphasis item-link-cell"
            role="button"
            tabindex="0"
            @click="goToEditItemPage(item)"
            @keydown.enter.prevent="goToEditItemPage(item)"
            @keydown.space.prevent="goToEditItemPage(item)"
          >
            {{ item.category }}
          </span>
        </template>

        <template #item.type="{ item }">
          <span
            class="text-body-1 text-high-emphasis item-link-cell"
            role="button"
            tabindex="0"
            @click="goToEditItemPage(item)"
            @keydown.enter.prevent="goToEditItemPage(item)"
            @keydown.space.prevent="goToEditItemPage(item)"
          >
            {{ item.type }}
          </span>
        </template>

        <template #item.qty="{ item }">
          <span
            class="text-body-1 text-high-emphasis item-link-cell"
            role="button"
            tabindex="0"
            @click="goToEditItemPage(item)"
            @keydown.enter.prevent="goToEditItemPage(item)"
            @keydown.space.prevent="goToEditItemPage(item)"
          >
            {{ hasInventoryQuantity(item) ? item.qty : "-" }}
          </span>
        </template>

        <template #item.activeState="{ item }">
          <VMenu
            location="bottom start"
            :model-value="openActiveMenuId === item.id"
            @update:model-value="setActiveMenu(item.id, $event)"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                variant="text"
                size="small"
                class="status-trigger px-0 text-none"
                :class="activeTextClass(item.activeState)"
                @click.stop
              >
                <span class="text-body-1">{{ resolveActive(item.activeState).text }}</span>
                <VIcon icon="tabler-chevron-down" size="16" class="ms-1" />
              </VBtn>
            </template>

            <VList density="compact" min-width="180">
              <VListItem
                v-for="option in configuredActiveOptions"
                :key="option.value"
                :active="item.activeState === option.value"
                @click="
                  updateActiveState(item, option.value);
                  openActiveMenuId = null;
                "
              >
                <template #prepend>
                  <VIcon
                    icon="tabler-check"
                    size="16"
                    :class="
                      item.activeState === option.value
                        ? 'text-primary'
                        : 'opacity-0'
                    "
                  />
                </template>

                <VListItemTitle :class="activeTextClass(option.value)">
                  {{ option.title }}
                </VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="goToEditItemPage(item)">
            <VIcon icon="tabler-edit" />
          </IconBtn>

          <IconBtn>
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem value="download" prepend-icon="tabler-download">
                  Download
                </VListItem>

                <VListItem
                  value="delete"
                  prepend-icon="tabler-trash"
                  @click="confirmDeleteCandidate(item)"
                >
                  Delete
                </VListItem>

                <VListItem
                  value="duplicate"
                  prepend-icon="tabler-copy"
                  @click="cataloguesStore.duplicateProduct(item.id)"
                >
                  Duplicate
                </VListItem>
              </VList>
            </VMenu>
          </IconBtn>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalProducts"
          />
        </template>
      </VDataTableServer>

      <VDialog v-model="isDeleteConfirmVisible" max-width="540">
        <VCard class="pa-sm-8 pa-4">
          <VCardTitle>Delete catalogue item</VCardTitle>
          <VCardText>
            <p>
              Are you sure you want to permanently delete
              <strong>{{ deleteCandidate?.name || "this catalogue item" }}</strong
              >?
            </p>
          </VCardText>
          <VCardActions>
            <VSpacer />
            <VBtn variant="text" color="secondary" @click="cancelDelete">
              Cancel
            </VBtn>
            <VBtn variant="tonal" color="error" @click="performDeleteConfirmed">
              Delete
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>

      <VDialog v-model="isAddItemTypeDialogVisible" max-width="920">
        <VCard class="pa-sm-6 pa-4">
          <VCardTitle class="text-h4 pb-2">
            Choose Item Type
          </VCardTitle>
          <VCardText class="text-body-1 text-medium-emphasis pb-6">
            Select the kind of catalogue item you want to create. Each option opens the matching add flow.
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
                @click="goToAddItemPage(choice.value)"
              >
                <VCardText class="d-flex align-start gap-4">
                  <VAvatar
                    size="44"
                    rounded
                    variant="tonal"
                    color="primary"
                  >
                    <VIcon :icon="choice.icon" size="22" />
                  </VAvatar>

                  <div class="flex-grow-1">
                    <div class="text-h6 text-high-emphasis mb-1">
                      {{ choice.title }}
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
              @click="isAddItemTypeDialogVisible = false"
            >
              Cancel
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
.status-trigger {
  justify-content: flex-start;
  min-inline-size: 0;
}

.item-link-cell {
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: rgb(var(--v-theme-primary)) !important;
  }
}

.item-type-card {
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: rgb(var(--v-theme-primary));
    background-color: rgba(var(--v-theme-primary), 0.04);
    transform: translateY(-2px);
  }
}
</style>
