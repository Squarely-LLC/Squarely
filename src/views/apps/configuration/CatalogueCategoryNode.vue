<script setup lang="ts">
import type { CatalogueCategory } from "@/plugins/fake-api/handlers/config/types";
import { nextTick, ref, watch } from "vue";

const props = defineProps<{
  node: CatalogueCategory;
  level: number;
  maxDepth: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "add-child", payload: { parentId: string; name: string }): void;
  (e: "remove", id: string): void;
  (e: "rename", payload: { id: string; name: string }): void;
}>();

const isOpen = ref(props.level < 2);
const isAddingChild = ref(false);
const childName = ref("");
const childInputRef = ref<{ $el?: Element } | HTMLElement | null>(null);
const isEditing = ref(false);
const editingName = ref(props.node.name);

watch(
  () => props.node.name,
  value => {
    editingName.value = value;
  },
);

const canAddChild = computed(() => props.level < props.maxDepth);
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0);

watch(isAddingChild, async value => {
  if (!value) return;
  isOpen.value = true;
  await nextTick();
  const inputHost =
    childInputRef.value instanceof HTMLElement
      ? childInputRef.value
      : childInputRef.value?.$el;

  inputHost?.querySelector("input")?.focus();
});

const startAddChild = () => {
  if (!canAddChild.value || props.disabled) return;
  isAddingChild.value = true;
  childName.value = "";
};

const submitAddChild = () => {
  const name = childName.value.trim();
  if (!name) return;
  emit("add-child", { parentId: props.node.id, name });
  childName.value = "";
  isAddingChild.value = false;
  isOpen.value = true;
};

const cancelAddChild = () => {
  childName.value = "";
  isAddingChild.value = false;
};

const startEdit = () => {
  if (props.disabled) return;
  editingName.value = props.node.name;
  isEditing.value = true;
};

const submitEdit = () => {
  const name = editingName.value.trim();
  if (!name) return;
  emit("rename", { id: props.node.id, name });
  isEditing.value = false;
};

const cancelEdit = () => {
  editingName.value = props.node.name;
  isEditing.value = false;
};
</script>

<template>
  <VListGroup v-model="isOpen" fluid>
    <template #activator="{ props: activatorProps }">
      <VListItem v-bind="activatorProps">
        <template #title>
          <div class="d-flex align-center justify-space-between gap-3 w-100">
            <div class="d-flex align-center gap-2 flex-wrap min-w-0">
              <span class="text-body-2 text-medium-emphasis">
                L{{ level }}
              </span>

              <template v-if="isEditing">
                <AppTextField
                  v-model="editingName"
                  density="compact"
                  hide-details
                  autofocus
                  style="min-inline-size: 220px; max-inline-size: 320px"
                  @keydown.enter.prevent="submitEdit"
                  @keydown.esc.prevent="cancelEdit"
                />
              </template>
              <template v-else>
                <span class="text-body-1 text-high-emphasis text-truncate">
                  {{ node.name }}
                </span>
              </template>
            </div>

            <div class="d-flex align-center gap-1">
              <IconBtn
                v-if="isEditing"
                :disabled="disabled"
                @click.stop="submitEdit"
              >
                <VIcon icon="tabler-check" />
              </IconBtn>

              <IconBtn
                v-if="isEditing"
                :disabled="disabled"
                @click.stop="cancelEdit"
              >
                <VIcon icon="tabler-x" />
              </IconBtn>

              <template v-else>
                <IconBtn :disabled="disabled" @click.stop="startEdit">
                  <VIcon icon="tabler-pencil" />
                </IconBtn>

                <IconBtn
                  :disabled="disabled || !canAddChild"
                  @click.stop="startAddChild"
                >
                  <VIcon icon="tabler-plus" />
                </IconBtn>

                <IconBtn :disabled="disabled" @click.stop="emit('remove', node.id)">
                  <VIcon icon="tabler-trash" />
                </IconBtn>
              </template>
            </div>
          </div>
        </template>
      </VListItem>
    </template>

    <div class="ps-4 pb-2">
      <div
        v-if="isAddingChild"
        class="d-flex align-center gap-2 flex-wrap mb-2 mt-1"
      >
        <AppTextField
          ref="childInputRef"
          v-model="childName"
          density="compact"
          hide-details
          :placeholder="`Add level ${level + 1} sub-category`"
          style="min-inline-size: 240px; max-inline-size: 340px"
          @keydown.enter.prevent="submitAddChild"
          @keydown.esc.prevent="cancelAddChild"
        />
        <VBtn size="small" :disabled="disabled || !childName.trim()" @click="submitAddChild">
          Add
        </VBtn>
        <VBtn size="small" variant="text" color="secondary" @click="cancelAddChild">
          Cancel
        </VBtn>
      </div>

      <div
        v-if="!hasChildren && !isAddingChild"
        class="text-body-2 text-medium-emphasis py-1"
      >
        No sub-categories yet.
      </div>

      <VList v-if="hasChildren" class="pa-0">
        <CatalogueCategoryNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :level="level + 1"
          :max-depth="maxDepth"
          :disabled="disabled"
          @add-child="emit('add-child', $event)"
          @remove="emit('remove', $event)"
          @rename="emit('rename', $event)"
        />
      </VList>
    </div>
  </VListGroup>
</template>
