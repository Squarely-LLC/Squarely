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
  (e: "move-request", payload: { id: string; name: string }): void;
  (e: "remove", id: string): void;
  (e: "rename", payload: { id: string; name: string }): void;
}>();

const isOpen = ref((props.node.children?.length ?? 0) > 0);
const isAddingChild = ref(false);
const childName = ref("");
const childInputRef = ref<{ $el?: Element } | HTMLElement | null>(null);
const isEditing = ref(false);
const editingName = ref(props.node.name);

watch(
  () => props.node.name,
  (value) => {
    editingName.value = value;
  },
);

const canAddChild = computed(() => props.level < props.maxDepth);
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0);
const levelIcon = computed(() => {
  if (props.level === 1) return "tabler-category";
  if (hasChildren.value) return "tabler-folder";
  return "tabler-tag";
});
const openedGroups = computed({
  get: () => (isOpen.value ? [props.node.id] : []),
  set: (value) => {
    isOpen.value = value.includes(props.node.id);
  },
});

const focusChildInput = async () => {
  await nextTick();
  const inputHost =
    childInputRef.value instanceof HTMLElement
      ? childInputRef.value
      : childInputRef.value?.$el;

  inputHost?.querySelector("input")?.focus();
};

watch(isAddingChild, (value) => {
  if (!value) return;
  void focusChildInput();
});

const startAddChild = async () => {
  if (!canAddChild.value || props.disabled) return;
  isOpen.value = true;
  childName.value = "";
  isAddingChild.value = true;
  await focusChildInput();
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
  <VList v-model:opened="openedGroups" class="pa-0">
    <VListGroup :value="node.id" fluid>
      <template #activator="{ props: activatorProps }">
        <VListItem v-bind="activatorProps">
          <template #title>
            <div class="d-flex align-center justify-space-between gap-3 w-100">
              <div class="d-flex align-center gap-2 flex-wrap min-w-0">
                <VIcon
                  :icon="levelIcon"
                  size="18"
                  class="text-medium-emphasis"
                />

                <template v-if="isEditing">
                  <AppTextField
                    v-model="editingName"
                    density="compact"
                    hide-details
                    autofocus
                    style="max-inline-size: 320px; min-inline-size: 220px"
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
                  <IconBtn
                    v-if="canAddChild"
                    :disabled="disabled"
                    @click.stop.prevent="startAddChild"
                  >
                    <VIcon icon="tabler-plus" />
                  </IconBtn>

                  <VMenu location="bottom end">
                    <template #activator="{ props: menuProps }">
                      <IconBtn
                        v-bind="menuProps"
                        :disabled="disabled"
                        @click.stop
                      >
                        <VIcon icon="tabler-dots-vertical" />
                      </IconBtn>
                    </template>

                    <VList density="compact" min-width="180">
                      <VListItem @click="startEdit">
                        <template #prepend>
                          <VIcon icon="tabler-pencil" size="18" />
                        </template>
                        <VListItemTitle>Edit category</VListItemTitle>
                      </VListItem>

                      <VListItem
                        v-if="level > 1"
                        @click="
                          emit('move-request', { id: node.id, name: node.name })
                        "
                      >
                        <template #prepend>
                          <VIcon icon="tabler-arrows-random" size="18" />
                        </template>
                        <VListItemTitle>Move category</VListItemTitle>
                      </VListItem>

                      <VListItem @click="emit('remove', node.id)">
                        <template #prepend>
                          <VIcon icon="tabler-trash" size="18" />
                        </template>
                        <VListItemTitle>Delete category</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
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
            style="max-inline-size: 340px; min-inline-size: 240px"
            @keydown.enter.prevent="submitAddChild"
            @keydown.esc.prevent="cancelAddChild"
          />
          <VBtn
            size="small"
            :disabled="disabled || !childName.trim()"
            @click="submitAddChild"
          >
            Add
          </VBtn>
          <VBtn
            size="small"
            variant="text"
            color="secondary"
            @click="cancelAddChild"
          >
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
            @move-request="emit('move-request', $event)"
            @remove="emit('remove', $event)"
            @rename="emit('rename', $event)"
          />
        </VList>
      </div>
    </VListGroup>
  </VList>
</template>
