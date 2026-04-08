<script setup lang="ts">
import type {
  CatalogueCategory,
  CatalogueConfig,
} from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import CatalogueCategoryNode from "@/views/apps/configuration/CatalogueCategoryNode.vue";
import { onMounted, ref } from "vue";

const store = useConfigStore();
store.init();

const notifications = useNotificationsStore();

const itemTypes = ref<string[]>([]);
const activeStates = ref<string[]>([]);
const hideArchivedByDefault = ref(true);
const categories = ref<CatalogueCategory[]>([]);
const rootCategoryName = ref("");

const isSavingItemTypes = ref(false);
const isSavingActiveStates = ref(false);
const isSavingVisibility = ref(false);
const isSavingCategories = ref(false);
const MAX_CATEGORY_DEPTH = 5;

const cleanEntries = (values?: (string | null | undefined)[]) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1));
};

const loadData = () => {
  const cfg = (store.configurations.catalogue || {}) as CatalogueConfig;
  itemTypes.value = cleanEntries(cfg.itemTypes || []);
  activeStates.value = cleanEntries(cfg.activeStates || []);
  hideArchivedByDefault.value = cfg.hideArchivedByDefault ?? true;
  categories.value = cloneCategories(cfg.categories || []);
};

onMounted(loadData);

const saveItemTypes = async (payload: {
  values: string[];
  action: "update" | "delete";
}) => {
  isSavingItemTypes.value = true;
  const cleaned = cleanEntries(payload.values);
  const res = await store.saveRemote({ catalogue: { itemTypes: cleaned } });
  isSavingItemTypes.value = false;

  if (res) {
    itemTypes.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Catalogue item types saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save catalogue item types", "error", 3000);
    loadData();
  }
};

const saveActiveStates = async (payload: {
  values: string[];
  action: "update" | "delete";
}) => {
  isSavingActiveStates.value = true;
  const cleaned = cleanEntries(payload.values);
  const res = await store.saveRemote({ catalogue: { activeStates: cleaned } });
  isSavingActiveStates.value = false;

  if (res) {
    activeStates.value = cleaned;
    if (payload.action !== "delete") {
      notifications.push("Catalogue active states saved", "success", 2000);
    }
  } else {
    notifications.push("Failed to save catalogue active states", "error", 3000);
    loadData();
  }
};

const saveVisibility = async () => {
  isSavingVisibility.value = true;
  const res = await store.saveRemote({
    catalogue: { hideArchivedByDefault: hideArchivedByDefault.value },
  });
  isSavingVisibility.value = false;

  if (res) {
    notifications.push("Catalogue visibility settings saved", "success", 2000);
  } else {
    notifications.push(
      "Failed to save catalogue visibility settings",
      "error",
      3000,
    );
    loadData();
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const cloneCategories = (items: CatalogueCategory[]): CatalogueCategory[] =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    children: cloneCategories(item.children || []),
  }));

const saveCategories = async (next: CatalogueCategory[]) => {
  isSavingCategories.value = true;
  const res = await store.saveRemote({ catalogue: { categories: next } });
  isSavingCategories.value = false;

  if (res) {
    categories.value = cloneCategories(next);
    notifications.push("Catalogue categories saved", "success", 2000);
  } else {
    notifications.push("Failed to save catalogue categories", "error", 3000);
    loadData();
  }
};

const categoryDepth = (
  items: CatalogueCategory[],
  id: string,
  level = 1,
): number | null => {
  for (const item of items) {
    if (item.id === id) return level;
    const nested = categoryDepth(item.children || [], id, level + 1);
    if (nested !== null) return nested;
  }
  return null;
};

const appendChild = (
  items: CatalogueCategory[],
  parentId: string,
  child: CatalogueCategory,
): CatalogueCategory[] =>
  items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [...(item.children || []), child],
      };
    }

    return {
      ...item,
      children: appendChild(item.children || [], parentId, child),
    };
  });

const renameCategory = (
  items: CatalogueCategory[],
  id: string,
  name: string,
): CatalogueCategory[] =>
  items.map((item) => ({
    ...item,
    name: item.id === id ? name : item.name,
    children: renameCategory(item.children || [], id, name),
  }));

const removeCategory = (
  items: CatalogueCategory[],
  id: string,
): CatalogueCategory[] =>
  items
    .filter((item) => item.id !== id)
    .map((item) => ({
      ...item,
      children: removeCategory(item.children || [], id),
    }));

const makeCategoryNode = (name: string): CatalogueCategory => ({
  id: `catalogue-category-${Date.now()}-${slugify(name) || "item"}`,
  name: name.trim(),
  children: [],
});

const addRootCategory = async () => {
  const name = rootCategoryName.value.trim();
  if (!name) return;

  const next = [...categories.value, makeCategoryNode(name)];
  rootCategoryName.value = "";
  await saveCategories(next);
};

const addChildCategory = async (payload: {
  parentId: string;
  name: string;
}) => {
  const depth = categoryDepth(categories.value, payload.parentId);
  if (depth === null) return;
  if (depth >= MAX_CATEGORY_DEPTH) {
    notifications.push(
      "You can only create up to 5 category levels",
      "warning",
      2500,
    );
    return;
  }

  const next = appendChild(
    categories.value,
    payload.parentId,
    makeCategoryNode(payload.name),
  );
  await saveCategories(next);
};

const updateCategoryName = async (payload: { id: string; name: string }) => {
  const next = renameCategory(
    categories.value,
    payload.id,
    payload.name.trim(),
  );
  await saveCategories(next);
};

const deleteCategory = async (id: string) => {
  const next = removeCategory(categories.value, id);
  await saveCategories(next);
};
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard title="Categories">
        <VCardText class="d-flex flex-column gap-4">
          <div class="d-flex align-center gap-2 flex-wrap">
            <AppTextField
              v-model="rootCategoryName"
              hide-details
              placeholder="Add root category"
              style="max-inline-size: 420px; min-inline-size: 280px"
              @keydown.enter.prevent="addRootCategory"
            />
            <VBtn
              :loading="isSavingCategories"
              :disabled="!rootCategoryName.trim()"
              @click="addRootCategory"
            >
              Add Category
            </VBtn>
          </div>

          <VCard variant="outlined">
            <VList class="pa-2">
              <template v-if="categories.length">
                <template
                  v-for="(category, index) in categories"
                  :key="category.id"
                >
                  <VDivider v-if="index > 0" class="my-2" />
                  <CatalogueCategoryNode
                    :node="category"
                    :level="1"
                    :max-depth="MAX_CATEGORY_DEPTH"
                    :disabled="isSavingCategories"
                    @add-child="addChildCategory"
                    @remove="deleteCategory"
                    @rename="updateCategoryName"
                  />
                </template>
              </template>
              <div v-else class="text-body-2 text-medium-emphasis pa-3">
                No categories yet. Add your first root category above.
              </div>
            </VList>
          </VCard>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard title="Catalogue Setup">
        <VCardText class="d-flex flex-column gap-6">
          <div
            class="d-flex align-center justify-space-between flex-wrap gap-4"
          >
            <div>
              <div class="text-body-1 font-weight-medium">
                Hide archived items by default
              </div>
              <div class="text-body-2 text-medium-emphasis">
                Keeps archived catalogue items out of list pages until
                explicitly filtered.
              </div>
            </div>

            <VSwitch
              v-model="hideArchivedByDefault"
              :loading="isSavingVisibility"
              @update:model-value="saveVisibility"
            />
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>
