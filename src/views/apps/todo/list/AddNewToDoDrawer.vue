<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import type { ContactRef, Status, ToDo } from "@/data/schema";
import { useContactsStore } from "@/stores/contacts";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

const toDateOnlyISOString = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
};
const getTodayISOString = () => toDateOnlyISOString();

/* ===== Emits / Props ===== */
interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "userData", value: Partial<ToDo>): void;
}
interface Props {
  isDrawerOpen: boolean;
  collaboratorsOptions: ContactRef[];
  // optional initial payload to prefill the form when opening
  initial?: Partial<ToDo>;
  // if true, autofocus the due date/time picker when the drawer opens
  autofocusDue?: boolean;
  // if true, focus the title input and move the caret to the end when the drawer opens
  autofocusTitleEnd?: boolean;
  // 'contacts' (default) or 'employees' - determines which store to use for collaborators
  source?: "contacts" | "employees";
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

/* ===== Form state ===== */
const isFormValid = ref(false);
const refForm = ref<VForm>();
const collabSearch = ref("");

const title = ref<string>("");
const selectedCollaboratorIds = ref<(number | string)[]>([]);
const dueAt = ref<string | null>(getTodayISOString());
const notes = ref<string>("");
const important = ref<boolean>(false);
const relatedTo = ref<{
  id: number | string;
  name: string;
  type: string;
} | null>(null);
const selectedRelatedKey = ref<string | null>(null);
const relatedToLocked = ref(false);
const goalId = ref<number | string | null>(null);
const milestoneId = ref<number | string | null>(null);
const titleFieldRef = ref<any>(null);

// ref to the AppDateTimePicker component so we can focus/open its input
const duePickerRef = ref<any>(null);

const statusOptions: { title: string; value: Status }[] = [
  { title: "Pending", value: "pending" },
  { title: "In Progress", value: "in_progress" },
  { title: "For Review", value: "for_review" },
  { title: "Completed", value: "completed" },
];

const selectedStatus = ref<Status>("pending");

/* ===== Helpers ===== */
// Fallback to canonical contacts store when parent didn't provide options
const contactsStore = useContactsStore();
contactsStore.init();

const employeesStore = useEmployeesStore();
employeesStore.init();

const jobsStore = useJobsStore();
jobsStore.init();

const relatedOptions = computed(() =>
  jobsStore.all.map((job) => ({
    title: job.name,
    value: `job-${job.id}`,
    type: "job" as const,
    rawId: job.id,
  })),
);

const isRelatedToLocked = computed(() => relatedToLocked.value);

// Use employees or contacts based on source prop
const effectiveOptions = computed(() => {
  const store = props.source === "employees" ? employeesStore : contactsStore;
  return store.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  }));
});

const idToContact = computed(
  () => new Map(effectiveOptions.value.map((c) => [c.id, c] as const)),
);
const selectedCollaborators = computed<ContactRef[]>(() => {
  const mapAny = idToContact.value as Map<any, ContactRef>;
  return selectedCollaboratorIds.value
    .map((id) => mapAny.get(Number(id)) || mapAny.get(String(id)))
    .filter(Boolean) as ContactRef[];
});

/* ===== Reset (also clears validation) ===== */
function resetForm() {
  title.value = "";
  selectedCollaboratorIds.value = [];
  dueAt.value = getTodayISOString();
  notes.value = "";
  important.value = false;
  relatedTo.value = null;
  selectedRelatedKey.value = null;
  relatedToLocked.value = false;
  goalId.value = null;
  milestoneId.value = null;
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
  // when opened, if props.initial exists, load values
  if (val) {
    // delegate to helper for consistency
    nextTick(() => {
      loadInitialAndMaybeFocus();
    });
  }
}

function focusTitleInput(moveCaretToEnd = false) {
  try {
    nextTick(() => {
      const input =
        titleFieldRef.value?.$el?.querySelector?.("input") ||
        titleFieldRef.value?.$el?.querySelector?.("textarea") ||
        titleFieldRef.value?.querySelector?.("input") ||
        titleFieldRef.value?.querySelector?.("textarea");
      if (!input) return;
      input.focus();
      if (moveCaretToEnd) {
        const length = typeof title.value === "string" ? title.value.length : 0;
        input.setSelectionRange(length, length);
      }
    });
  } catch (e) {
    // ignore
  }
}

function loadInitialAndMaybeFocus() {
  // load initial values if provided
  const init = (props as any).initial as any | undefined;
  if (init) {
    title.value = init.title || title.value;
    selectedCollaboratorIds.value = (init.collaborators || []).map(
      (c: any) => c.id,
    );
    dueAt.value = init.dueAt || getTodayISOString();
    notes.value = init.notes || notes.value;
    important.value = !!init.important;
    relatedTo.value = init.relatedTo ?? relatedTo.value;
    selectedRelatedKey.value =
      init.relatedTo?.type === "job" ? `job-${init.relatedTo.id}` : null;
    relatedToLocked.value = init.relatedTo?.type === "job";
    goalId.value = init.goalId ?? goalId.value;
    milestoneId.value = init.milestoneId ?? milestoneId.value;
    selectedStatus.value = (init.status as any) || selectedStatus.value;
  }

  if ((props as any).autofocusTitleEnd) {
    focusTitleInput(true);
  }

  // autofocus the due picker if requested: find the input inside the child and focus/click it
  if ((props as any).autofocusDue) {
    try {
      nextTick(() => {
        const comp = duePickerRef.value as any;
        const el =
          comp?.$el?.querySelector?.("input.flatpickr-input") ||
          comp?.$el?.querySelector?.("input");
        if (el) {
          el.focus();
          // some flatpickr instances require a click to open
          el.click();
        }
      });
    } catch (e) {
      // ignore
    }
  } else if (!(props as any).autofocusTitleEnd) {
    focusTitleInput(false);
  }
}

// also react to prop changes directly when parent toggles the drawer open
watch(
  () => props.isDrawerOpen,
  (val) => {
    if (val) nextTick(() => loadInitialAndMaybeFocus());
  },
);

// Allow parent to open this drawer programmatically with initial data
function openWith(initial?: any) {
  if (initial) {
    // set values immediately
    title.value = initial.title || title.value;
    selectedCollaboratorIds.value = (initial.collaborators || []).map(
      (c: any) => c.id,
    );
    dueAt.value = initial.dueAt || getTodayISOString();
    notes.value = initial.notes || notes.value;
    important.value = !!initial.important;
    relatedTo.value = initial.relatedTo ?? relatedTo.value;
    selectedRelatedKey.value =
      initial.relatedTo?.type === "job" ? `job-${initial.relatedTo.id}` : null;
    relatedToLocked.value = initial.relatedTo?.type === "job";
    goalId.value = initial.goalId ?? goalId.value;
    milestoneId.value = initial.milestoneId ?? milestoneId.value;
    selectedStatus.value = (initial.status as any) || selectedStatus.value;
  }
  // emit both kebab and camel update events to be robust for v-model variants
  emit("update:isDrawerOpen", true);
  nextTick(() => {
    loadInitialAndMaybeFocus();
  });
}

defineExpose({ openWith });

/* ===== Submit ===== */
async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const trimmedTitle = (title.value ?? "").trim();
  const trimmedNotes = (notes.value ?? "").trim();

  const dueISO = toDateOnlyISOString(dueAt.value);
  const relatedOption = relatedOptions.value.find(
    (option) => option.value === selectedRelatedKey.value,
  );

  emit("userData", {
    title: trimmedTitle,
    collaborators: selectedCollaborators.value,
    dueAt: dueISO,
    status: selectedStatus.value,
    notes: trimmedNotes,
    important: important.value,
    relatedTo: relatedOption
      ? {
          id: relatedOption.rawId,
          name: relatedOption.title,
          type: relatedOption.type,
        }
      : null,
    goalId: goalId.value,
    milestoneId: milestoneId.value,
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
                <AppTextarea
                  ref="titleFieldRef"
                  v-model="title"
                  :rules="[requiredValidator]"
                  label="Title"
                  auto-grow
                  rows="1"
                />
              </VCol>

              <VCol cols="12">
                <VAutocomplete
                  v-model="selectedCollaboratorIds"
                  v-model:search="collabSearch"
                  class="todo-collaborators"
                  :items="effectiveOptions"
                  item-title="name"
                  item-value="id"
                  label="Assigned to"
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
                  ref="duePickerRef"
                  v-model="dueAt"
                  :rules="[requiredValidator]"
                  label="Due Date"
                  placeholder="Select date"
                  :config="{ dateFormat: 'Y-m-d' }"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="selectedRelatedKey"
                  label="Related to"
                  placeholder="Select a job"
                  item-title="title"
                  item-value="value"
                  :items="relatedOptions"
                  clearable
                  :disabled="isRelatedToLocked"
                >
                  <template #prepend-inner>
                    <VIcon icon="tabler-briefcase" size="20" class="me-2" />
                  </template>
                </AppSelect>
              </VCol>

              <VDivider />

              <VCol cols="12">
                <AppSelect
                  v-model="selectedStatus"
                  label="Status"
                  :items="statusOptions"
                  item-title="title"
                  item-value="value"
                />
              </VCol>

              <VDivider />

              <VCol cols="12">
                <AppTextarea
                  v-model="notes"
                  class="notes-singleline"
                  label="Notes"
                  placeholder="Placeholder Text"
                  auto-grow
                  rows="1"
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
/* stylelint-disable selector-pseudo-class-no-unknown, selector-pseudo-element-no-unknown, no-duplicate-selectors, selector-descendant-combinator-no-non-space, order/properties-order */


::v-deep(.status-compact .custom-radios-with-icon .v-icon) {
  block-size: 24px;
  font-size: 24px !important;
  inline-size: 24px;
}

/* Hide native radio controls / selection controls under the tiles */
::v-deep(.status-compact .v-radio-group .v-selection-control),
::v-deep(.status-compact .v-radio-group .v-selection-control__wrapper),
::v-deep(.status-compact .v-radio-group .v-selection-control__input),
::v-deep(.status-compact .v-radio-group .v-icon--radio),
::v-deep(.status-compact .custom-radios-with-icon .v-selection-control),
::v-deep(
  .status-compact .custom-radios-with-icon .v-selection-control__wrapper
),
::v-deep(.status-compact .custom-radios-with-icon .v-selection-control__input),
::v-deep(.status-compact .custom-radios-with-icon .v-icon--radio) {
  display: none !important;
}

/* Force title pieces onto a single row */
::v-deep(.status-compact .custom-radios-with-icon .v-card .custom-input__title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .custom-input-title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .custom-radio__title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .v-card-title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .text-h6) {
  display: block;
  overflow: hidden;
  line-height: 1.1;
  max-inline-size: 100%;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

::v-deep(.status-compact .custom-radios-with-icon .v-card .custom-input__title),
::v-deep(.status-compact .custom-radios-with-icon .v-card .custom-input-title),
::v-deep(
  .status-compact .custom-radios-with-icon .v-card .custom-radio__title
) {
  display: inline-flex !important;
  flex-wrap: nowrap !important;
  align-items: center;
  justify-content: center;
  gap: 4px;
  max-inline-size: 100%;
  text-align: center;
  white-space: nowrap !important;
}

::v-deep(
  .status-compact .custom-radios-with-icon .v-card .custom-input__title > *
),
::v-deep(
  .status-compact .custom-radios-with-icon .v-card .custom-input-title > *
),
::v-deep(
  .status-compact .custom-radios-with-icon .v-card .custom-radio__title > *
) {
  display: inline !important;
}

::v-deep(.todo-collaborators .v-field__input) {
  padding-block: 10px;
}
</style>
