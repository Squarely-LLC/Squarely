<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import type { ContactRef, Status, ToDo, ToDoAttachment } from "@/data/schema";
import { useDealsStore } from "@/stores/deals";
import { useJobsStore } from "@/stores/jobs";
import { findCurrentUserOption } from "@/utils/currentAccount";
import { getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { getEmployeeRefs, resolvePeopleSelection } from "@/utils/peopleOptions";
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
const getDefaultDueMode = (showImmediateDueOption?: boolean) =>
  showImmediateDueOption ? "immediately" : "scheduled";
const getDefaultDueAt = (showImmediateDueOption?: boolean) =>
  showImmediateDueOption ? new Date().toISOString() : getTodayISOString();

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
  showImmediateDueOption?: boolean;
  hideRelatedToField?: boolean;
  jobTaskMode?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

/* ===== Form state ===== */
const isFormValid = ref(false);
const refForm = ref<VForm>();
const collabSearch = ref("");

const title = ref<string>("");
const selectedCollaboratorIds = ref<(number | string)[]>([]);
const dueAt = ref<string | null>(getDefaultDueAt());
const startAt = ref<string | null>(null);
const completionMinutes = ref<number | null>(null);
const dueMode = ref<"scheduled" | "immediately">(getDefaultDueMode());
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
const attachmentInput = ref("");
const attachmentFile = ref<File | null>(null);
const attachment = ref<ToDoAttachment | null>(null);
const attachmentFileInputRef = ref<HTMLInputElement | null>(null);
const pendingInitial = ref<Partial<ToDo> | null>(null);
const syncingAttachmentInput = ref(false);

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
const jobsStore = useJobsStore();
jobsStore.init();

const dealsStore = useDealsStore();
dealsStore.init();

const relatedOptions = computed(() => [
  ...dealsStore.all.map((deal) => ({
    title: deal.code || `Deal #${deal.id}`,
    value: `deal-${deal.id}`,
    type: "deal" as const,
    rawId: deal.id,
  })),
  ...jobsStore.all.map((job) => ({
    title: job.name,
    value: `job-${job.id}`,
    type: "job" as const,
    rawId: job.id,
  })),
]);

const isRelatedToLocked = computed(() => relatedToLocked.value);

// Use employees or contacts based on source prop
const effectiveOptions = computed(() => {
  if (props.collaboratorsOptions.length) return props.collaboratorsOptions;

  return getEmployeeRefs();
});
const defaultCollaboratorOption = computed(() =>
  findCurrentUserOption(effectiveOptions.value),
);

const idToContact = computed(
  () => new Map(effectiveOptions.value.map((c) => [c.id, c] as const)),
);
const selectedCollaborators = computed<ContactRef[]>(() => {
  const mapAny = idToContact.value as Map<any, ContactRef>;
  return selectedCollaboratorIds.value
    .map(
      (id) =>
        mapAny.get(Number(id)) ||
        mapAny.get(String(id)) ||
        resolvePeopleSelection(id, effectiveOptions.value, "Employee"),
    )
    .filter(Boolean) as ContactRef[];
});

/* ===== Reset (also clears validation) ===== */
function resetForm() {
  syncingAttachmentInput.value = true;
  refForm.value?.resetValidation();
  title.value = "";
  selectedCollaboratorIds.value = defaultCollaboratorOption.value
    ? [defaultCollaboratorOption.value.id]
    : [];
  dueMode.value = getDefaultDueMode(props.showImmediateDueOption);
  dueAt.value = getDefaultDueAt(props.showImmediateDueOption);
  startAt.value = null;
  completionMinutes.value = null;
  notes.value = "";
  important.value = false;
  relatedTo.value = null;
  selectedRelatedKey.value = null;
  relatedToLocked.value = false;
  goalId.value = null;
  milestoneId.value = null;
  selectedStatus.value = "pending";
  attachmentInput.value = "";
  attachmentFile.value = null;
  attachment.value = null;
  nextTick(() => {
    syncingAttachmentInput.value = false;
  });
}

/* ===== Close / open handling ===== */
function closeNavigationDrawer() {
  emit("update:isDrawerOpen", false);
}
function handleDrawerModelValueUpdate(val: boolean) {
  emit("update:isDrawerOpen", val);
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
  resetForm();

  // load initial values if provided
  const init = (pendingInitial.value ?? (props as any).initial) as
    | Partial<ToDo>
    | undefined;
  if (init) {
    syncingAttachmentInput.value = true;
    title.value = init.title ?? title.value;
    selectedCollaboratorIds.value = (init.collaborators || []).map(
      (c: any) => c.id,
    );
    dueMode.value = getDefaultDueMode(props.showImmediateDueOption);
    dueAt.value = init.dueAt === undefined ? dueAt.value : (init.dueAt ?? null);
    startAt.value = (init as any).startAt ?? startAt.value;
    completionMinutes.value =
      (init as any).completionMinutes ??
      (init as any).actualMinutes ??
      (init as any).estimatedMinutes ??
      completionMinutes.value;

    if (init.dueAt) {
      dueMode.value = "scheduled";
    }
    notes.value = init.notes ?? notes.value;
    important.value = !!init.important;
    relatedTo.value = init.relatedTo ?? relatedTo.value;
    selectedRelatedKey.value =
      init.relatedTo?.type === "deal"
        ? `deal-${init.relatedTo.id}`
        : init.relatedTo?.type === "job"
          ? `job-${init.relatedTo.id}`
          : init.relatedTo?.type === "contact"
            ? null
            : null;
    relatedToLocked.value = false;
    goalId.value = init.goalId ?? goalId.value;
    milestoneId.value = init.milestoneId ?? milestoneId.value;
    selectedStatus.value = (init.status as any) ?? selectedStatus.value;
    attachment.value = init.attachment ?? null;
    attachmentInput.value =
      init.attachment?.type === "link"
        ? init.attachment?.url || ""
        : init.attachment?.name || "";
    nextTick(() => {
      syncingAttachmentInput.value = false;
    });
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

  pendingInitial.value = null;
}

function normalizeLink(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return /^(https?:)?\/\//i.test(value) ? value : `https://${value}`;
}

function setImmediateDue() {
  dueMode.value = "immediately";
  dueAt.value = new Date().toISOString();
}

function setScheduledDue() {
  dueMode.value = "scheduled";
  dueAt.value = toDateOnlyISOString(dueAt.value);
}

function onAttachmentInputUpdate(value: string | null | undefined) {
  if (syncingAttachmentInput.value) return;

  const nextValue = typeof value === "string" ? value : "";
  attachmentInput.value = nextValue;
  if (attachmentFile.value && nextValue === attachmentFile.value.name) return;

  attachmentFile.value = null;
  const trimmed = nextValue.trim();
  attachment.value = trimmed
    ? {
        type: "link",
        name: trimmed,
        url: normalizeLink(trimmed),
        fileKey: null,
      }
    : null;
}

function openAttachmentPicker() {
  attachmentFileInputRef.value?.click();
}

function onAttachmentFileSelected(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;

  attachmentFile.value = file;
  attachment.value = {
    type: "file",
    name: file.name,
    fileKey: null,
    url: null,
  };
  attachmentInput.value = file.name;
  if (input) input.value = "";
}

async function viewAttachment() {
  if (attachmentFile.value) {
    const objectUrl = URL.createObjectURL(attachmentFile.value);
    window.open(objectUrl, "_blank", "noopener");
    return;
  }
  if (attachment.value?.type === "link" && attachment.value.url) {
    window.open(attachment.value.url, "_blank", "noopener");
    return;
  }
  if (attachment.value?.type === "file" && attachment.value.fileKey) {
    const objectUrl = await getFileObjectUrl(attachment.value.fileKey);
    if (objectUrl) window.open(objectUrl, "_blank", "noopener");
  }
}

// also react to prop changes directly when parent toggles the drawer open
watch(
  () => props.isDrawerOpen,
  (val) => {
    if (val) nextTick(() => loadInitialAndMaybeFocus());
    else resetForm();
  },
);

// Allow parent to open this drawer programmatically with initial data
function openWith(initial?: any) {
  pendingInitial.value = initial ?? null;
  if (props.isDrawerOpen) {
    // Drawer already open – watcher won't fire, so load directly
    loadInitialAndMaybeFocus();
  } else {
    // Opening the drawer – the isDrawerOpen watcher will call loadInitialAndMaybeFocus()
    emit("update:isDrawerOpen", true);
  }
}

defineExpose({ openWith });

/* ===== Submit ===== */
async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const trimmedTitle = (title.value ?? "").trim();
  const trimmedNotes = (notes.value ?? "").trim();

  const dueISO =
    dueMode.value === "immediately"
      ? new Date().toISOString()
      : toDateOnlyISOString(dueAt.value);
  const relatedOption = relatedOptions.value.find(
    (option) => option.value === selectedRelatedKey.value,
  );

  let nextAttachment: ToDoAttachment | null = attachment.value;
  if (attachmentFile.value) {
    const fileKey = await saveFile(attachmentFile.value);
    nextAttachment = {
      type: "file",
      name: attachmentFile.value.name,
      fileKey,
      url: null,
    };
  }

  emit("userData", {
    title: trimmedTitle,
    collaborators: selectedCollaborators.value,
    dueAt: dueISO,
    startAt: props.jobTaskMode ? startAt.value : undefined,
    completionMinutes: props.jobTaskMode ? completionMinutes.value : undefined,
    status: selectedStatus.value,
    notes: trimmedNotes,
    important: important.value,
    attachment: nextAttachment,
    relatedTo: relatedOption
      ? {
          id: relatedOption.rawId,
          name: relatedOption.title,
          type: relatedOption.type,
        }
      : relatedTo.value,
    goalId: goalId.value,
    milestoneId: milestoneId.value,
  });

  emit("update:isDrawerOpen", false);
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
      title="Add New Task"
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
                <div
                  v-if="props.showImmediateDueOption"
                  class="due-mode-toggle mb-2"
                >
                  <VChip
                    size="small"
                    class="due-mode-toggle__chip"
                    :class="{
                      'due-mode-toggle__chip--active': dueMode === 'scheduled',
                    }"
                    :variant="dueMode === 'scheduled' ? 'flat' : 'text'"
                    @click="setScheduledDue"
                  >
                    Pick date
                  </VChip>
                  <VChip
                    size="small"
                    class="due-mode-toggle__chip"
                    :class="{
                      'due-mode-toggle__chip--active':
                        dueMode === 'immediately',
                    }"
                    :variant="dueMode === 'immediately' ? 'flat' : 'text'"
                    @click="setImmediateDue"
                  >
                    Immediately
                  </VChip>
                </div>

                <AppDateTimePicker
                  ref="duePickerRef"
                  v-model="dueAt"
                  :rules="[requiredValidator]"
                  label="Due Date"
                  :placeholder="
                    dueMode === 'immediately' ? 'Immediately' : 'Select date'
                  "
                  :disabled="dueMode === 'immediately'"
                  :config="{ dateFormat: 'Y-m-d' }"
                />
              </VCol>

              <VCol v-if="props.jobTaskMode" cols="12">
                <AppDateTimePicker
                  v-model="startAt"
                  label="Start Date"
                  placeholder="Select start date"
                  clearable
                  :config="{ dateFormat: 'Y-m-d' }"
                />
              </VCol>

              <VCol v-if="props.jobTaskMode" cols="12">
                <AppTextField
                  v-model.number="completionMinutes"
                  type="number"
                  min="0"
                  label="Time for Completion (min)"
                  placeholder="Minutes"
                />
              </VCol>

              <VCol v-if="!props.hideRelatedToField" cols="12">
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
                <input
                  ref="attachmentFileInputRef"
                  type="file"
                  class="d-none"
                  @change="onAttachmentFileSelected"
                />
                <AppTextField
                  :model-value="attachmentInput"
                  label="Attachment or Link"
                  placeholder="Paste a link or upload a file"
                  clearable
                  @update:model-value="onAttachmentInputUpdate"
                  @click:clear="onAttachmentInputUpdate('')"
                >
                  <template #append-inner>
                    <div class="d-flex align-center">
                      <IconBtn size="small" @click.stop="openAttachmentPicker">
                        <VIcon icon="tabler-paperclip" />
                      </IconBtn>
                      <IconBtn
                        size="small"
                        :disabled="!attachment"
                        @click.stop="viewAttachment"
                      >
                        <VIcon icon="tabler-external-link" />
                        <VTooltip activator="parent" location="top">
                          View
                        </VTooltip>
                      </IconBtn>
                    </div>
                  </template>
                </AppTextField>
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

.due-mode-toggle {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(var(--v-theme-primary), 0.18);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.06);
  gap: 0.35rem;
  padding: 0.2rem;
}

.due-mode-toggle__chip {
  cursor: pointer;
  font-weight: 600;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.due-mode-toggle__chip--active {
  background: rgba(var(--v-theme-primary), 0.94);
  box-shadow: 0 6px 16px rgba(var(--v-theme-primary), 0.24);
  color: rgb(var(--v-theme-on-primary));
}

.task-related-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8rem;
}
</style>
