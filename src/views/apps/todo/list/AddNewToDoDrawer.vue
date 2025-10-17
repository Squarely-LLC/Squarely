<script setup lang="ts">
import { useContactsStore } from "@/stores/contacts";
import type { CustomInputContent } from "@core/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

/* ===== Types aligned with your table ===== */
type Priority = "low" | "normal" | "high";
type Status = "pending" | "in_progress" | "for_review" | "completed";
type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};

/* ===== Emits / Props ===== */
interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (
    e: "userData",
    value: Partial<{
      title: string;
      collaborators: ContactRef[];
      dueAt: string;
      priority: Priority;
      status: Status;
      notes: string;
      important: boolean;
    }>
  ): void;
}
interface Props {
  isDrawerOpen: boolean;
  collaboratorsOptions: ContactRef[];
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

/* ===== Form state ===== */
const isFormValid = ref(false);
const refForm = ref<VForm>();
const collabSearch = ref("");

const title = ref<string>("");
const selectedCollaboratorIds = ref<(number | string)[]>([]);
const dueAt = ref<string | null>(null);
const priority = ref<Priority>("normal"); // default = normal
const notes = ref<string>("");
const important = ref<boolean>(false);

/* ===== Status (compact tiles) ===== */
/* ===== Status (compact tiles) ===== */
const statusRadios: CustomInputContent[] = [
  {
    title: "Pending",
    value: "pending",
    icon: { icon: "tabler-clock", size: "24" },
  },
  {
    // NBSP keeps it on one line
    title: "In\u00A0Progress",
    value: "in_progress",
    icon: { icon: "tabler-rotate-clockwise", size: "24" },
  },
  {
    // NBSP keeps it on one line
    title: "For\u00A0Review",
    value: "for_review",
    icon: { icon: "tabler-eye-check", size: "24" },
  },
];

const selectedStatus = ref<Exclude<Status, "completed">>("pending");

/* ===== Helpers ===== */
// Fallback to canonical contacts store when parent didn't provide options
const contactsStore = useContactsStore();
contactsStore.init();

// Always use canonical contacts for dropdown data to avoid stale static lists
const effectiveOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  }))
);

const idToContact = computed(
  () => new Map(effectiveOptions.value.map((c) => [c.id, c] as const))
);
const selectedCollaborators = computed<ContactRef[]>(
  () =>
    selectedCollaboratorIds.value
      .map((id) => idToContact.value.get(id))
      .filter(Boolean) as ContactRef[]
);

/* ===== Reset (also clears validation) ===== */
function resetForm() {
  title.value = "";
  selectedCollaboratorIds.value = [];
  dueAt.value = null;
  priority.value = "normal";
  notes.value = "";
  important.value = false;
  selectedStatus.value = "pending";
  refForm.value?.reset();
  refForm.value?.resetValidation();
}

/* ===== Close / open handling ===== */
function closeNavigationDrawer() {
  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}
function handleDrawerModelValueUpdate(val: boolean) {
  emit("update:isDrawerOpen", val);
  if (!val) nextTick(() => resetForm());
}

/* ===== Submit ===== */
async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const trimmedTitle = (title.value ?? "").trim();
  const trimmedNotes = (notes.value ?? "").trim();

  const dueISO = dueAt.value
    ? new Date(dueAt.value).toISOString()
    : new Date().toISOString();

  emit("userData", {
    title: trimmedTitle,
    collaborators: selectedCollaborators.value,
    dueAt: dueISO,
    priority: priority.value,
    status: selectedStatus.value,
    notes: trimmedNotes,
    important: important.value,
  });

  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    class="scrollable-content"
    :model-value="props.isDrawerOpen"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection
      title="Add New To Do"
      @cancel="closeNavigationDrawer"
    />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="title"
                  :rules="[requiredValidator]"
                  label="Title"
                />
              </VCol>

              <VCol cols="12">
                <VAutocomplete
                  v-model="selectedCollaboratorIds"
                  v-model:search="collabSearch"
                  :items="effectiveOptions"
                  item-title="name"
                  item-value="id"
                  label="Collaborators"
                  multiple
                  chips
                  closable-chips
                  clearable
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
                              {{
                                (item.raw.name?.match(/\b\w/g) || [])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()
                              }}
                            </span>
                          </template>
                        </VAvatar>
                      </template>
                    </VListItem>
                  </template>

                  <template #selection="{ item, index }">
                    <VChip
                      v-if="index < 3"
                      size="small"
                      class="me-1 mb-1"
                      variant="elevated"
                    >
                      <VAvatar start size="20" color="primary">
                        <template v-if="item.raw.avatarUrl">
                          <VImg :src="item.raw.avatarUrl" />
                        </template>
                        <template v-else>
                          <span class="text-xxs font-weight-bold">
                            {{
                              (item.raw.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            }}
                          </span>
                        </template>
                      </VAvatar>
                      {{ item.raw.name }}
                    </VChip>
                    <span v-else-if="index === 3" class="text-caption"
                      >+{{ selectedCollaboratorIds.length - 3 }}</span
                    >
                  </template>
                </VAutocomplete>
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  v-model="dueAt"
                  :rules="[requiredValidator]"
                  label="Due Date"
                  placeholder="Select date and time"
                  :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="priority"
                  label="Priority"
                  placeholder="Select Priority"
                  :rules="[requiredValidator]"
                  :items="[
                    { title: 'Low', value: 'low' },
                    { title: 'Normal', value: 'normal' },
                    { title: 'High', value: 'high' },
                  ]"
                />
              </VCol>

              <VDivider />

              <VCol cols="12">
                <div class="status-compact">
                  <CustomRadiosWithIcon
                    v-model:selected-radio="selectedStatus"
                    :radio-content="statusRadios"
                    :grid-column="{ sm: '4', cols: '12' }"
                  />
                </div>
              </VCol>

              <VDivider />

              <VCol cols="12">
                <AppTextarea
                  v-model="notes"
                  label="Notes"
                  placeholder="Placeholder Text"
                  auto-grow
                />
              </VCol>

              <VCol cols="12">
                <VSwitch
                  v-model="important"
                  color="warning"
                  inset
                  label="Mark as important"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput label="Attachment File" />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">Save</VBtn>
                <VBtn
                  type="button"
                  variant="tonal"
                  color="error"
                  @click="closeNavigationDrawer"
                  >Cancel</VBtn
                >
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>

<style scoped>
/* Existing tile styling (keep yours) */
:deep(.status-compact .custom-radios-with-icon .v-card) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  gap: 6px;
  min-block-size: 84px;
  padding-block: 10px;
  padding-inline: 12px;
}

:deep(.status-compact .custom-radios-with-icon .custom-input__title),
:deep(.status-compact .custom-radios-with-icon .custom-input-title),
:deep(.status-compact .custom-radios-with-icon .custom-radio__title) {
  overflow: hidden;
  margin: 0;
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.status-compact .custom-radios-with-icon .custom-input__desc),
:deep(.status-compact .custom-radios-with-icon .custom-input-desc),
:deep(.status-compact .custom-radios-with-icon .custom-radio__desc) {
  display: none !important;
}

:deep(.status-compact .custom-radios-with-icon .v-icon) {
  block-size: 24px;
  font-size: 24px !important;
  inline-size: 24px;
}

/* Status tiles look */
:deep(.status-compact .custom-radios-with-icon .v-card) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  gap: 6px;
  min-block-size: 84px;
  padding-block: 10px;
  padding-inline: 12px;
}

/* 🔥 Hide ALL radio controls/dots that the component renders under the tiles */
:deep(.status-compact .v-radio-group .v-selection-control),
:deep(.status-compact .v-radio-group .v-selection-control__wrapper),
:deep(.status-compact .v-radio-group .v-selection-control__input),
:deep(.status-compact .v-radio-group .v-icon--radio) {
  display: none !important;
}

/* Also hide any selection-control that might be placed inside the tiles */
:deep(.status-compact .custom-radios-with-icon .v-selection-control),
:deep(.status-compact .custom-radios-with-icon .v-selection-control__wrapper),
:deep(.status-compact .custom-radios-with-icon .v-selection-control__input),
:deep(.status-compact .custom-radios-with-icon .v-icon--radio) {
  display: none !important;
}

/* Give each status tile enough width so two-word labels fit on one line */
:deep(.status-compact .custom-radios-with-icon .v-card) {
  min-inline-size: 120px; /* prevents “In Progress” from wrapping */
}

/* Force the label under the icon to stay on ONE line (any title class) */
:deep(
    .status-compact
      .custom-radios-with-icon
      .v-card
      :is(
        .custom-input__title,
        .custom-input-title,
        .custom-radio__title,
        .v-card-title,
        .title,
        .text-h6
      )
  ) {
  display: block;
  overflow: hidden;
  line-height: 1.1;
  max-inline-size: 100%;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

/* Make each tile wide enough so one-line labels fit comfortably */
:deep(.status-compact .custom-radios-with-icon .v-card) {
  min-inline-size: 120px;
}

/* Force the title to be a single line, even if the component renders
   each word in separate block nodes */
:deep(.status-compact .custom-radios-with-icon .v-card .custom-input__title),
:deep(.status-compact .custom-radios-with-icon .v-card .custom-input-title),
:deep(.status-compact .custom-radios-with-icon .v-card .custom-radio__title) {
  display: inline-flex !important; /* put title pieces on one row */
  flex-wrap: nowrap !important; /* no wrapping */
  align-items: center;
  justify-content: center;
  gap: 4px; /* small space between words */
  max-inline-size: 100%;
  text-align: center;
  white-space: nowrap !important; /* belt-and-suspenders */
}

/* If the title has block children, turn them into inline pieces */
:deep(
    .status-compact .custom-radios-with-icon .v-card .custom-input__title > *,
    .status-compact .custom-radios-with-icon .v-card .custom-input-title > *,
    .status-compact .custom-radios-with-icon .v-card .custom-radio__title > *
  ) {
  display: inline !important;
}
</style>
