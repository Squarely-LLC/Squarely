<script setup lang="ts">
import { computed, ref } from "vue";

import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";
import CatalogueCategoryTreeSelectNode from "@/components/catalogues/CatalogueCategoryTreeSelectNode.vue";

const props = defineProps<{
  modelValue?: string;
  items: CatalogueCategory[];
  label?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const isOpen = ref(false);

const collectExpandableIds = (items: CatalogueCategory[]): string[] => {
  const ids: string[] = [];

  for (const item of items) {
    if (item.children?.length) {
      ids.push(item.id, ...collectExpandableIds(item.children));
    }
  }

  return ids;
};

const openedGroups = computed(() => collectExpandableIds(props.items));

const displayValue = computed(() => props.modelValue || "");

const selectCategory = (value: string) => {
  emit("update:modelValue", value);
  isOpen.value = false;
};
</script>

<template>
  <VMenu
    v-model="isOpen"
    :close-on-content-click="false"
    location="bottom start"
    max-width="420"
    min-width="320"
  >
    <template #activator="{ props: menuProps }">
      <AppTextField
        :model-value="displayValue"
        :label="label"
        :placeholder="placeholder"
        readonly
        append-inner-icon="tabler-chevron-down"
        v-bind="menuProps"
      />
    </template>

    <VCard>
      <VList
        :opened="openedGroups"
        class="pa-2"
        density="compact"
      >
        <CatalogueCategoryTreeSelectNode
          v-for="item in items"
          :key="item.id"
          :node="item"
          :selected="modelValue"
          @select="selectCategory"
        />
      </VList>
    </VCard>
  </VMenu>
</template>
