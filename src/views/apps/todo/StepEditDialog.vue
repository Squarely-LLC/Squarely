<script setup lang="ts">
import type { ContactRef, ToDoStep } from "@/data/schema";
import { computed, reactive, ref, watch } from "vue";

type Props = {
  modelValue: boolean;
  step: ToDoStep | null;
  collaboratorsOptions: ContactRef[];
  title?: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
  (e: "close"): void;
  (e: "save", step: ToDoStep): void;
}>();

/* Local draft (deep copy) */
const draft = reactive<ToDoStep>({
  id: 0,
  title: "",
  collaborators: [],
  dueAt: new Date().toISOString(),
  priority: "normal",
  status: "pending",
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const collabSearch = ref("");

watch(
  () => props.step,
  (s) => {
    if (!s) return;
    Object.assign(draft, JSON.parse(JSON.stringify(s)));
    collabSearch.value = "";
  },
  { immediate: true, deep: true }
);

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

function onCancel() {
  emit("close");
  open.value = false;
}

function onSubmit() {
  const title = (draft.title || "").trim();
  const payload: ToDoStep = JSON.parse(JSON.stringify({ ...draft, title }));
  emit("save", payload);
  open.value = false;
}

const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
</script>

<template>
  <VDialog v-model="open" max-width="720">
    <DialogCloseBtn variant="tonal" @click="onCancel" />
    <VCard>
      <VCardTitle class="px-6 pt-4 pb-2">
        {{ props.title || "Edit Subtask" }}
      </VCardTitle>

      <VCardText class="px-6">
        <div class="d-flex flex-column gap-4">
          <AppTextField v-model="draft.title" label="Title *" />

          <div class="d-flex gap-3">
            <!-- Collaborators (one line, same height as select) -->
            <VAutocomplete
              v-model="draft.collaborators"
              v-model:search="collabSearch"
              :items="props.collaboratorsOptions"
              item-title="name"
              return-object
              label="Collaborators"
              multiple
              chips
              closable-chips
              clearable
              density="comfortable"
              @update:model-value="collabSearch = ''"
            >
              <template #item="{ props: itemProps, item }">
                <VListItem v-bind="itemProps">
                  <template #prepend>
                    <VAvatar size="28" color="primary">
                      <template v-if="item.raw.avatarUrl">
                        <VImg :src="item.raw.avatarUrl" />
                      </template>
                      <template v-else>
                        <span class="text-caption font-weight-bold">
                          {{ initials(item.raw.name) }}
                        </span>
                      </template>
                    </VAvatar>
                  </template>
                </VListItem>
              </template>
            </VAutocomplete>
          </div>
          <VRow>
            <VCol sm="6">
              <AppSelect
                v-model="draft.priority"
                label="Priority"
                :items="[
                  { title: 'Low', value: 'low' },
                  { title: 'Normal', value: 'normal' },
                  { title: 'High', value: 'high' },
                ]"
              />
            </VCol>
            <VCol sm="6">
              <AppDateTimePicker
                v-model="draft.dueAt"
                label="Due Date"
                placeholder="Select date and time"
                :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
              />
            </VCol>
          </VRow>
          <div class="d-flex gap-6 align-center">
            <VRadioGroup v-model="draft.status" inline>
              <VRadio label="Pending" value="pending" />
              <VRadio label="In Review" value="for_review" />
              <VRadio label="In Progress" value="in_progress" />
              <VRadio label="Completed" value="completed" />
            </VRadioGroup>
          </div>

          <AppTextarea v-model="draft.notes" label="Notes" auto-grow />
        </div>
      </VCardText>

      <VCardActions class="px-6 pb-4">
        <!-- Solid (tonal) like Cancel -->
        <VBtn class="me-3" variant="tonal" color="success" @click="onSubmit">
          Submit
        </VBtn>
        <VBtn variant="tonal" color="error" @click="onCancel">Cancel</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
/* One-line chips + fixed control height without leaking styles */
:deep(.collabOneLine .v-field__input) {
  overflow: hidden;
  align-items: center;
  max-block-size: 56px;
  min-block-size: 56px;
  white-space: nowrap;
}

:deep(.collabOneLine .v-chip) {
  margin-block-end: 0; /* keep height at one line */
}
</style>
