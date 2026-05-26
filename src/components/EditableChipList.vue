<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

type PendingDeletion = { removed: string[]; next: string[] };

const props = defineProps<{
  label: string;
  items: string[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "save", payload: { values: string[]; action: "update" | "delete" }): void;
  (e: "warn", message: string): void;
  (e: "error", message: string): void;
}>();

const model = ref<string[]>([...props.items]);
const hoveredChip = ref<string | null>(null);
const editingChip = ref<{ original: string; index: number } | null>(null);
const editingValue = ref("");
const editingDuplicate = ref(false);
const editingInputRef = ref<HTMLInputElement | null>(null);
const pendingDeletion = ref<PendingDeletion | null>(null);
const pendingEditDecision = ref<{ formatted: string } | null>(null);

const normalizeValue = (value: string) => value.toLowerCase();
const formatEntry = (value?: string | null) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanEntries = (values?: (string | null | undefined)[]) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => formatEntry(value ?? ""))
    .filter((value) => value.length);
};

watch(
  () => props.items,
  (next) => {
    model.value = [...next];
    editingChip.value = null;
    editingValue.value = "";
    editingDuplicate.value = false;
    pendingDeletion.value = null;
    pendingEditDecision.value = null;
  }
);

const resetModel = () => {
  model.value = [...props.items];
  editingChip.value = null;
  editingValue.value = "";
  editingDuplicate.value = false;
};

const startEditingChip = async (name: string) => {
  const idx = model.value.findIndex(
    (item) => normalizeValue(item) === normalizeValue(name)
  );
  if (idx === -1) return;
  hoveredChip.value = null;
  editingChip.value = { original: name, index: idx };
  editingValue.value = name;
  editingDuplicate.value = false;
  await nextTick();
  editingInputRef.value?.focus();
  editingInputRef.value?.select();
};

const handleEditInput = () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  const duplicateExists = model.value.some((item, index) => {
    if (index === editingChip.value!.index) return false;
    return normalizeValue(item) === normalizeValue(formatted);
  });
  if (duplicateExists && !editingDuplicate.value) {
    emit("warn", `${props.label} already exists`);
  }
  editingDuplicate.value = duplicateExists;
};

const commitEditingChip = () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  if (!formatted) {
    emit("warn", `${props.label} cannot be empty`);
    editingValue.value = editingChip.value.original;
    return;
  }
  if (editingDuplicate.value) return;

  const current = [...model.value];
  current[editingChip.value.index] = formatted;
  editingChip.value = null;
  editingValue.value = "";
  emit("save", { values: cleanEntries(current), action: "update" });
};

const handleChipClose = (name: string) => {
  if (
    editingChip.value &&
    normalizeValue(editingChip.value.original) === normalizeValue(name)
  )
    return;
  const cleaned = cleanEntries(
    model.value.filter((item) => normalizeValue(item) !== normalizeValue(name))
  );
  pendingDeletion.value = { removed: [name], next: cleaned };
  resetModel();
};

const confirmDeletion = () => {
  if (!pendingDeletion.value) return;
  const next = pendingDeletion.value.next;
  emit(
    "error",
    pendingDeletion.value.removed.length
      ? `${props.label} removed: ${pendingDeletion.value.removed.join(", ")}`
      : `${props.label} removed`
  );
  pendingDeletion.value = null;
  emit("save", { values: cleanEntries(next), action: "delete" });
};

const cancelDeletion = () => {
  pendingDeletion.value = null;
  resetModel();
};

const syncModel = (vals: string[]) => {
  const cleaned = cleanEntries(vals);
  const cleanedNormalized = cleaned.map(normalizeValue);

  const hasLocalDuplicates =
    new Set(cleanedNormalized).size !== cleanedNormalized.length;
  if (hasLocalDuplicates) {
    emit("warn", `${props.label} already exists`);
    resetModel();
    return;
  }

  const currentNormalized = props.items.map(normalizeValue);
  const sameValues =
    cleaned.length === props.items.length &&
    cleanedNormalized.every((val, idx) => val === currentNormalized[idx]);

  if (sameValues) {
    resetModel();
    return;
  }

  const removed = props.items.filter(
    (item) => !cleanedNormalized.includes(normalizeValue(item))
  );

  if (removed.length && cleaned.length < props.items.length) {
    pendingDeletion.value = { removed, next: cleaned };
    resetModel();
    return;
  }

  emit("save", { values: cleaned, action: "update" });
};

const promptEditDecisionIfNeeded = () => {
  if (!editingChip.value) return;
  const formatted = formatEntry(editingValue.value);
  const normalizedFormatted = normalizeValue(formatted);
  const normalizedOriginal = normalizeValue(editingChip.value.original);

  if (!formatted || normalizedFormatted === normalizedOriginal) {
    resetModel();
    return;
  }

  if (editingDuplicate.value) {
    emit("warn", `${props.label} already exists`);
    resetModel();
    return;
  }

  pendingEditDecision.value = { formatted };
};

const confirmEditDecision = () => {
  if (!pendingEditDecision.value || !editingChip.value) return;
  const formatted = pendingEditDecision.value.formatted;
  const next = [...model.value];
  next[editingChip.value.index] = formatted;
  pendingEditDecision.value = null;
  editingChip.value = null;
  editingValue.value = "";
  editingDuplicate.value = false;
  emit("save", { values: cleanEntries(next), action: "update" });
};

const cancelEditDecision = () => {
  pendingEditDecision.value = null;
  resetModel();
};
</script>

<template>
  <div>
    <label class="text-caption mb-2 d-block">{{ label }}</label>
    <VCombobox
      v-model="model"
      multiple
      chips
      hide-details
      :placeholder="placeholder || `Add ${label.toLowerCase()}s`"
      :loading="loading"
      :disabled="disabled || loading"
      class="mb-4"
      @update:model-value="syncModel($event as string[])"
    >
      <template #chip="{ props: chipProps, item }">
        <VChip
          v-bind="chipProps"
          size="small"
          class="d-inline-flex align-center"
          :class="{
            'chip-editing':
              editingChip &&
              normalizeValue(editingChip.original) === normalizeValue(item.raw),
            duplicate:
              editingDuplicate &&
              editingChip &&
              normalizeValue(editingChip.original) ===
                normalizeValue(item.raw),
          }"
          :variant="
            hoveredChip === item.raw ? 'tonal' : (chipProps.variant as any)
          "
          :color="
            hoveredChip === item.raw ? 'error' : (chipProps.color as string)
          "
          @dblclick.stop.prevent="startEditingChip(item.raw)"
          tabindex="0"
        >
          <template
            v-if="
              editingChip &&
              normalizeValue(editingChip.original) === normalizeValue(item.raw)
            "
          >
            <input
              ref="editingInputRef"
              v-model="editingValue"
              class="chip-edit-input me-2"
              @keydown.stop.prevent.enter="commitEditingChip"
              @keydown.stop.prevent.tab="commitEditingChip"
              @keydown.stop.prevent.esc="resetModel"
              @input="handleEditInput"
              @blur="promptEditDecisionIfNeeded"
              @click.stop
              @mousedown.stop
              @pointerdown.stop
            />
            <VIcon
              icon="tabler-x"
              size="14"
              class="cursor-pointer"
              @click.stop.prevent="resetModel"
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
  </div>

  <VDialog
    :model-value="!!pendingDeletion"
    max-width="480"
    @update:model-value="(val: boolean) => {
      if (!val) cancelDeletion();
    }"
  >
    <DialogCloseBtn @click="cancelDeletion" />
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Remove {{ label }}</VCardTitle>
      <VCardText>
        <p v-if="pendingDeletion">
          Are you sure you want to permanently remove
          <strong>{{ pendingDeletion.removed.join(", ") }}</strong
          >?
        </p>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelDeletion">
          Cancel
        </VBtn>
        <VBtn variant="tonal" color="error" @click="confirmDeletion">
          Remove
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog
    :model-value="!!pendingEditDecision"
    max-width="480"
    @update:model-value="(val: boolean) => {
      if (!val) cancelEditDecision();
    }"
  >
    <DialogCloseBtn @click="cancelEditDecision" />
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
