<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  listKey: "additions" | "deductions";
  title: string;
  itemLabel: string;
}>();

const store = useConfigStore();
store.init();
const notifications = useNotificationsStore();

const entries = ref<string[]>([]);
const entriesModel = ref<string[]>([]);
const lastCommittedModel = ref<string[]>([]);
const isSaving = ref(false);
const searchValue = ref("");
const lastTypedValue = ref("");
const hoveredChip = ref<string | null>(null);
const editingChip = ref<{ original: string; index: number } | null>(null);
const editingValue = ref("");
const editingDuplicate = ref(false);
const editingInputRef = ref<HTMLInputElement | null>(null);
const editingChipElement = ref<HTMLElement | null>(null);
const pendingEditDecision = ref<{ formatted: string } | null>(null);
const isEditConfirmDialogVisible = ref(false);

const cardTitle = computed(() => props.title);
const itemLabel = computed(() => props.itemLabel);
const itemLabelLower = computed(() => itemLabel.value.toLowerCase());
const addPlaceholder = computed(() => `Add ${itemLabelLower.value}s`);
const removeDialogTitle = computed(() => `Remove ${itemLabelLower.value}`);

const clearEditingState = () => {
  editingChip.value = null;
  editingValue.value = "";
  editingDuplicate.value = false;
  editingChipElement.value = null;
};

const normalizeValue = (value: string) => value.toLowerCase();

const formatEntry = (value?: string | null) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanEntries = (values?: (string | null | undefined)[] | null) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => formatEntry(value ?? ""))
    .filter((value) => value.length);
};

const buildCounts = (list: string[]) => {
  const counts = new Map<string, number>();
  for (const item of list) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return counts;
};

const diffLists = (prev: string[], next: string[]) => {
  const added: string[] = [];
  const removed: string[] = [];

  const prevCounts = buildCounts(prev.map(normalizeValue));
  const nextCounts = buildCounts(next.map(normalizeValue));

  for (const item of prev) {
    const key = normalizeValue(item);
    const remaining = nextCounts.get(key) ?? 0;
    if (remaining > 0) {
      nextCounts.set(key, remaining - 1);
    } else {
      removed.push(item);
    }
  }

  for (const item of next) {
    const key = normalizeValue(item);
    const remaining = prevCounts.get(key) ?? 0;
    if (remaining > 0) {
      prevCounts.set(key, remaining - 1);
    } else {
      added.push(item);
    }
  }

  return { added, removed };
};

let programmaticUpdateDepth = 0;
let programmaticResetHandle: ReturnType<typeof setTimeout> | null = null;

const markProgrammaticUpdate = () => {
  programmaticUpdateDepth += 1;
  if (programmaticResetHandle) clearTimeout(programmaticResetHandle);
  programmaticResetHandle = setTimeout(() => {
    programmaticUpdateDepth = 0;
    programmaticResetHandle = null;
  }, 0);
};

const shouldIgnoreUpdate = () => {
  if (programmaticUpdateDepth > 0) {
    programmaticUpdateDepth = Math.max(0, programmaticUpdateDepth - 1);
    return true;
  }
  return false;
};

const setModelValues = (values: string[], commit = false) => {
  if (commit) lastCommittedModel.value = [...values];
  markProgrammaticUpdate();
  entriesModel.value = [...values];
};

const revertToLastCommitted = () => {
  setModelValues(lastCommittedModel.value, false);
};

const loadEntries = () => {
  const section = store.configurations.hr?.[props.listKey] || [];
  entries.value = cleanEntries(section);
  lastCommittedModel.value = [...entries.value];
  setModelValues(entries.value, false);
};
onMounted(loadEntries);

// Delete confirmation dialog state
const isDeleteDialogVisible = ref(false);
const pendingDeletion = ref<{
  removedItems: string[];
  nextValues: string[];
} | null>(null);

const openDeleteDialog = (removedItems: string[], nextValues: string[]) => {
  pendingDeletion.value = { removedItems, nextValues };
  isDeleteDialogVisible.value = true;
};

const handleChipClose = (name: string) => {
  if (
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  ) {
    return;
  }
  const normalizedTarget = normalizeValue(name);
  const current = [...lastCommittedModel.value];
  const nextValues = current.filter(
    (value) => normalizeValue(value) !== normalizedTarget
  );
  if (nextValues.length === current.length) return;
  openDeleteDialog([name], nextValues);
};

const cancelDelete = () => {
  pendingDeletion.value = null;
  isDeleteDialogVisible.value = false;
  revertToLastCommitted();
};

const confirmDelete = async () => {
  if (!pendingDeletion.value) return;
  const { nextValues } = pendingDeletion.value;
  pendingDeletion.value = null;
  isDeleteDialogVisible.value = false;
  setModelValues(nextValues, true);
  await saveEntries(nextValues, true);
};

const startEditingChip = async (name: string) => {
  const index = lastCommittedModel.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (index === -1) return;
  hoveredChip.value = null;
  editingChip.value = { original: name, index };
  editingValue.value = name;
  editingDuplicate.value = false;
  await nextTick();
  editingInputRef.value?.focus();
  editingInputRef.value?.select();
};

const cancelChipEdit = () => {
  clearEditingState();
};

const commitChipEdit = async () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  if (!formatted) {
    notifications.push(`${itemLabel.value} cannot be empty`, "warning", 2000);
    return;
  }

  const currentList = [...lastCommittedModel.value];
  const targetIndex = editingChip.value.index;
  const originalNormalized = normalizeValue(editingChip.value.original);
  const nextNormalized = normalizeValue(formatted);

  if (
    targetIndex < 0 ||
    targetIndex >= currentList.length ||
    normalizeValue(currentList[targetIndex]) !== originalNormalized
  ) {
    cancelChipEdit();
    return;
  }

  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === nextNormalized;
  });

  if (duplicateExists) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
    editingDuplicate.value = true;
    return;
  }

  if (currentList[targetIndex] === formatted) {
    cancelChipEdit();
    return;
  }

  currentList[targetIndex] = formatted;
  cancelChipEdit();
  setModelValues(currentList, true);
  await saveEntries(currentList, false, `${itemLabel.value} updated`);
};

const handleChipBlur = (event: FocusEvent) => {
  if (!editingChip.value) return;
  if (isEventInsideEditingChip(event.relatedTarget)) return;
  promptEditDecisionIfNeeded();
};

const handleEditKeydown = async (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    event.stopPropagation();
    await commitChipEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    cancelChipEdit();
  }
};

const isEditingChip = (name: string) =>
  !!(
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  );

const resolveElement = (el: any): HTMLElement | null => {
  if (!el) return null;
  if (el instanceof HTMLElement) return el;
  if (el?.$el instanceof HTMLElement) return el.$el;
  return null;
};

const registerChipElement = (el: any, name: string) => {
  const domEl = resolveElement(el);
  if (
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  ) {
    editingChipElement.value = domEl;
  } else if (
    !domEl &&
    editingChipElement.value &&
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  ) {
    editingChipElement.value = null;
  }
};

const isEventInsideEditingChip = (target: EventTarget | null) => {
  if (!target) return false;
  const node = target as Node;
  if (editingInputRef.value && editingInputRef.value.contains(node))
    return true;
  if (editingChipElement.value && editingChipElement.value.contains(node))
    return true;
  return false;
};

const promptEditDecisionIfNeeded = () => {
  if (!editingChip.value || isEditConfirmDialogVisible.value) return;
  if (editingDuplicate.value) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
    return;
  }
  const formatted = formatEntry(editingValue.value);
  if (formatted === editingChip.value.original) {
    cancelChipEdit();
    return;
  }
  pendingEditDecision.value = { formatted };
  isEditConfirmDialogVisible.value = true;
};

const handleGlobalPointerDown = (event: PointerEvent) => {
  if (!editingChip.value) return;
  if (isEventInsideEditingChip(event.target)) return;
  promptEditDecisionIfNeeded();
};

const confirmEditDecision = async () => {
  if (!pendingEditDecision.value) return;
  const { formatted } = pendingEditDecision.value;
  pendingEditDecision.value = null;
  isEditConfirmDialogVisible.value = false;
  editingValue.value = formatted;
  handleEditInput();
  if (editingDuplicate.value) return;
  await commitChipEdit();
};

const cancelEditDecision = () => {
  pendingEditDecision.value = null;
  isEditConfirmDialogVisible.value = false;
  cancelChipEdit();
};

onMounted(() => {
  document.addEventListener("pointerdown", handleGlobalPointerDown, true);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
});

watch(
  () => searchValue.value,
  (val) => {
    const formatted = formatEntry(val);
    if (formatted) {
      lastTypedValue.value = formatted;
    }
  }
);

// Save to store (only hr.{listKey} section)
const saveEntries = async (
  newVals: string[],
  isDelete = false,
  successMessage?: string
) => {
  const cleaned = cleanEntries(newVals);
  entries.value = cleaned;

  isSaving.value = true;
  const res = await store.saveRemote({
    hr: { [props.listKey]: cleaned },
  } as any);
  isSaving.value = false;

  if (res) {
    const message =
      successMessage ||
      (isDelete ? `${itemLabel.value} removed` : `${itemLabel.value} saved`);
    notifications.push(message, "success", 2000);
    loadEntries();
  } else {
    notifications.push(`Failed to save ${itemLabelLower.value}`, "error", 3000);
  }
};

// Auto-save when model changes (new entry added or removed)
const syncModelToEntries = async (vals: string[]) => {
  if (shouldIgnoreUpdate()) return;

  const cleaned = cleanEntries(vals);
  const current = [...lastCommittedModel.value];
  const cleanedNormalized = cleaned.map(normalizeValue);
  const typedNormalized = normalizeValue(lastTypedValue.value || "");

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
    lastTypedValue.value = "";
    revertToLastCommitted();
    return;
  }

  const currentNormalized = current.map(normalizeValue);
  const sameValues =
    cleaned.length === current.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    if (typedNormalized && currentNormalized.includes(typedNormalized)) {
      notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
      lastTypedValue.value = "";
    }
    revertToLastCommitted();
    return;
  }

  const { added, removed } = diffLists(current, cleaned);

  if (!added.length && !removed.length) {
    revertToLastCommitted();
    return;
  }

  const duplicateOfExisting = added.some((item) =>
    currentNormalized.includes(normalizeValue(item))
  );

  if (duplicateOfExisting) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
    lastTypedValue.value = "";
    revertToLastCommitted();
    return;
  }

  if (
    removed.length === 1 &&
    !added.length &&
    typedNormalized &&
    normalizeValue(removed[0]) === typedNormalized
  ) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
    lastTypedValue.value = "";
    revertToLastCommitted();
    return;
  }

  if (removed.length && !added.length) {
    openDeleteDialog(removed, cleaned);
    revertToLastCommitted();
    return;
  }

  setModelValues(cleaned, true);
  lastTypedValue.value = "";
  await saveEntries(cleaned, false);
};

const handleEditInput = () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  const currentList = [...lastCommittedModel.value];
  const targetIndex = editingChip.value.index;
  const duplicateExists = currentList.some((item, index) => {
    if (index === targetIndex) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !editingDuplicate.value) {
    notifications.push(`${itemLabel.value} already exists`, "warning", 2000);
  }
  editingDuplicate.value = duplicateExists;
};
</script>

<template>
  <VCard :title="cardTitle" class="mb-6">
    <VCardText>
      <VCombobox
        v-model="entriesModel"
        multiple
        chips
        hide-details
        :placeholder="addPlaceholder"
        :loading="isSaving"
        :disabled="isSaving"
        class="mb-4"
        v-model:search="searchValue"
        @update:model-value="syncModelToEntries($event as string[])"
      >
        <template #chip="{ props, item }">
          <VChip
            v-bind="props"
            size="small"
            class="d-inline-flex align-center"
            :class="{
              'chip-editing': isEditingChip(item.raw),
              duplicate: editingDuplicate && isEditingChip(item.raw),
            }"
            :variant="hoveredChip === item.raw ? 'tonal' : (props.variant as any)"
            :color="hoveredChip === item.raw ? 'error' : (props.color as string)"
            @dblclick.stop.prevent="startEditingChip(item.raw)"
            @blur="handleChipBlur"
            tabindex="0"
            :ref="(el: HTMLElement | null) => registerChipElement(el, item.raw)"
          >
            <template v-if="isEditingChip(item.raw)">
              <input
                ref="editingInputRef"
                v-model="editingValue"
                class="chip-edit-input me-2"
                @keydown.stop="handleEditKeydown"
                @input="handleEditInput"
                @click.stop
                @mousedown.stop
              />
              <VIcon
                icon="tabler-x"
                size="14"
                class="cursor-pointer"
                @click.stop.prevent="cancelChipEdit"
              />
            </template>
            <template v-else>
              <span class="me-2">{{ item.raw }}</span>
              <VIcon
                icon="tabler-x"
                size="14"
                class="cursor-pointer"
                @mouseenter="hoveredChip = item.raw"
                @mouseleave="hoveredChip = null"
                @click.stop.prevent="handleChipClose(item.raw)"
              />
            </template>
          </VChip>
        </template>
      </VCombobox>
    </VCardText>
  </VCard>

  <VDialog v-model="isDeleteDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>{{ removeDialogTitle }}</VCardTitle>
      <VCardText>
        <p v-if="pendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ pendingDeletion.removedItems.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelDelete">
          Cancel
        </VBtn>
        <VBtn variant="tonal" color="error" @click="confirmDelete">
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="isEditConfirmDialogVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Unsaved changes</VCardTitle>
      <VCardText>
        <p>
          Keep the changes to
          <strong
            >{{ editingChip?.original }} ->
            {{ pendingEditDecision?.formatted }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelEditDecision">
          Revert
        </VBtn>
        <VBtn variant="tonal" color="primary" @click="confirmEditDecision">
          Keep changes
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.chip-edit-input {
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  inline-size: 120px;
  min-inline-size: 80px;
  outline: none;
}

.chip-editing {
  border: 1px dashed rgb(var(--v-theme-primary));
  padding-inline: 6px;
}

.chip-editing.duplicate {
  border-color: rgb(var(--v-theme-error));
}
</style>
