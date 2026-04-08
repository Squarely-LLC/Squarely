<script setup lang="ts">
import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";

defineOptions({
  name: "CatalogueCategoryTreeSelectNode",
});

const props = defineProps<{
  node: CatalogueCategory;
  selected?: string;
}>();

const emit = defineEmits<{
  (e: "select", value: string): void;
}>();
</script>

<template>
  <VListGroup
    v-if="node.children?.length"
    :value="node.id"
  >
    <template #activator="{ props: activatorProps }">
      <VListItem
        v-bind="activatorProps"
        :active="selected === node.name"
      >
        <template #title>
          <div class="d-flex align-center justify-space-between w-100">
            <span
              class="cursor-pointer"
              @click.stop="emit('select', node.name)"
            >
              {{ node.name }}
            </span>
          </div>
        </template>
      </VListItem>
    </template>

    <div class="ps-4">
      <CatalogueCategoryTreeSelectNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected="selected"
        @select="emit('select', $event)"
      />
    </div>
  </VListGroup>

  <VListItem
    v-else
    :active="selected === node.name"
    @click="emit('select', node.name)"
  >
    <VListItemTitle>{{ node.name }}</VListItemTitle>
  </VListItem>
</template>
