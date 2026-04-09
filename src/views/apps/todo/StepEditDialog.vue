<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactRef, ToDoStep } from "@/data/schema";
import { computed, reactive, ref, toRaw, watch } from "vue";

const toDateOnlyISOString = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
};

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
    Object.assign(draft, structuredClone(toRaw(s)));
    collabSearch.value = "";
  },
  { immediate: true, deep: true },
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
  if (!title) return;
  const payload: ToDoStep = JSON.parse(
    JSON.stringify({
      ...draft,
      title,
      dueAt: toDateOnlyISOString(draft.dueAt),
    }),
  );
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
        {{ props.title || "Edit Sub Task" }}
      </VCardTitle>

      <VCardText class="px-6">
        <div class="d-flex flex-column gap-4">
          <AppTextField
            v-model="draft.title"
            label="Title *"
            :rules="[requiredValidator]"
          />

          <div class="d-flex gap-3">
            <!-- Assigned to -->
            <VAutocomplete
              v-model="draft.collaborators"
              v-model:search="collabSearch"
              class="todo-collaborators"
              :items="props.collaboratorsOptions"
              item-title="name"
              return-object
              label="Assigned to"
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
          <AppDateTimePicker
            v-model="draft.dueAt"
            label="Due Date"
            placeholder="Select date"
            :config="{ dateFormat: 'Y-m-d' }"
          />
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
        <DialogActionBar
          :save-disabled="!(draft.title || '').trim()"
          @save="onSubmit"
          @cancel="onCancel"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
::v-deep(.todo-collaborators .v-field__input) {
  padding-block: 10px;
}
</style>
