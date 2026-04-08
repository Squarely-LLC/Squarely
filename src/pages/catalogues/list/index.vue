<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  CatalogueActiveState,
  CatalogueItemType,
  CatalogueProduct,
} from "@/plugins/fake-api/handlers/catalogues/types";
import { useCataloguesStore } from "@/stores/catalogues";

type SortKey =
  | "name"
  | "category"
  | "activeState"
  | "sku"
  | "qty"
  | "type"
  | "createdAt";
type SortOrder = "asc" | "desc";

const cataloguesStore = useCataloguesStore();
cataloguesStore.init();

const headers = [
  { title: "Item", key: "product" },
  { title: "Category", key: "category" },
  { title: "Type", key: "type" },
  { title: "Active", key: "activeState", sortable: false },
  { title: "SKU", key: "sku" },
  { title: "QTY", key: "qty" },
  { title: "Actions", key: "actions", sortable: false },
];

const selectedType = ref<CatalogueItemType | undefined>();
const selectedCategory = ref<string | undefined>();
const selectedActive = ref<CatalogueActiveState | undefined>();
const searchQuery = ref("");

const types = ref<{ title: string; value: CatalogueItemType }[]>([
  { title: "Onetime Service", value: "Onetime Service" },
  { title: "Product", value: "Product" },
  { title: "Contractual Service", value: "Contractual Service" },
  { title: "Retainer Service", value: "Retainer Service" },
  { title: "Reccurent Service", value: "Reccurent Service" },
  { title: "Produced Product", value: "Produced Product" },
  { title: "Rental", value: "Rental" },
]);

const categories = computed(() => {
  const unique = Array.from(
    new Set(cataloguesStore.all.map(product => product.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return unique.map(category => ({ title: category, value: category }));
});

const activeOptions = ref<{ title: string; value: CatalogueActiveState }[]>([
  { title: "Active", value: "Active" },
  { title: "Non-Active", value: "Non-Active" },
  { title: "Archived", value: "Archived" },
]);

const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<SortKey | undefined>("createdAt");
const orderBy = ref<SortOrder | undefined>("desc");
const openActiveMenuId = ref<number | string | null>(null);
const isDeleteConfirmVisible = ref(false);
const deleteCandidate = ref<CatalogueProduct | null>(null);

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
  return { text: "Archived", color: "secondary" };
};

const activeTextClass = (activeState: CatalogueActiveState) =>
  activeState === "Active"
    ? "text-success"
    : activeState === "Non-Active"
      ? "text-warning"
      : "text-secondary";

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (product: CatalogueProduct) => {
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
  } else if (product.activeState === "Archived") {
    return false;
  }

  return true;
};

const normalizeSortValue = (product: CatalogueProduct, key?: SortKey) => {
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

const compareProducts = (a: CatalogueProduct, b: CatalogueProduct) => {
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

const filteredProducts = computed<CatalogueProduct[]>(() =>
  cataloguesStore.all.filter(matchesFilters),
);

const sortedProducts = computed<CatalogueProduct[]>(() => {
  const items = [...filteredProducts.value];
  if (items.length > 1) items.sort(compareProducts);
  return items;
});

const displayedProducts = computed<CatalogueProduct[]>(() => {
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1
      ? sortedProducts.value.length
      : start + itemsPerPage.value;

  return sortedProducts.value.slice(start, end);
});

const totalProducts = computed(() => sortedProducts.value.length);

const updateActiveState = (
  product: CatalogueProduct,
  activeState: CatalogueActiveState,
) => {
  cataloguesStore.updateProduct(product.id, { activeState });
};

const confirmDeleteCandidate = (product: CatalogueProduct) => {
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
              :items="types"
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
              :items="activeOptions"
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
            @click="$router.push('/catalogues/add')"
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
          <div class="d-flex align-center gap-x-4">
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
          <span class="text-body-1 text-high-emphasis">{{ item.category }}</span>
        </template>

        <template #item.type="{ item }">
          <span class="text-body-1 text-high-emphasis">{{ item.type }}</span>
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
                <span class="text-body-1">{{ item.activeState }}</span>
                <VIcon icon="tabler-chevron-down" size="16" class="ms-1" />
              </VBtn>
            </template>

            <VList density="compact" min-width="180">
              <VListItem
                v-for="option in activeOptions"
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
          <IconBtn>
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
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
.status-trigger {
  justify-content: flex-start;
  min-inline-size: 0;
}
</style>
