<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactRef, Status, ToDo, ToDoStep } from "@/data/schema";
import { useJobsStore } from "@/stores/jobs";
import { formatSystemDate } from "@core/utils/formatters";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

/* NEW: reusable dialog */
import { requiredValidator } from "@/@core/utils/validators";
import StepEditDialog from "../StepEditDialog.vue"; // ← import the component

/* ===== Types — align with your table ===== */

/* Local alias for dialog payload type */
type DialogStep = ToDoStep;
const toDateOnlyISOString = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
};

/* ===== Emits / Props ===== */
interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (
    e: "save",
    v: {
      id: number | string;
      title: string;
      collaborators: ContactRef[];
      dueAt: string;
      status: Status;
      notes: string;
      important: boolean;
      relatedTo: { id: number | string; name: string; type: string } | null;
    },
  ): void;
  (e: "saveSteps", v: { id: number | string; steps: ToDoStep[] }): void;
}
interface Props {
  isDrawerOpen: boolean;
  todo: ToDo | null | undefined;
  collaboratorsOptions: ContactRef[];
}
const props = defineProps<Props>();
const emit = defineEmits<Emit>();

/* ===== Tabs ===== */
const activeTab = ref<"details" | "steps">("details");

/* ===== Details form ===== */
const isFormValid = ref(false);
const refForm = ref<VForm>();
const collabSearch = ref("");

// Local UI state
const title = ref<string>("");
const selectedCollaboratorIds = ref<(number | string)[]>([]);
const dueAt = ref<string | null>(null);
const notes = ref<string>("");
const important = ref<boolean>(false);
const selectedStatus = ref<Status>("pending");
const selectedRelatedKey = ref<string | null>(null);

// ✅ Local completed toggle (pure UI; applied on Save)

const statusOptions: { title: string; value: Status }[] = [
  { title: "Pending", value: "pending" },
  { title: "In Progress", value: "in_progress" },
  { title: "For Review", value: "for_review" },
  { title: "Completed", value: "completed" },
];

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

const isRelatedToLocked = computed(() => props.todo?.relatedTo?.type === "job");

/* ===== Helpers ===== */
const idToContact = computed(
  () => new Map(props.collaboratorsOptions.map((c) => [c.id, c] as const)),
);
const selectedCollaborators = computed<ContactRef[]>(
  () =>
    selectedCollaboratorIds.value
      .map((id) => idToContact.value.get(id))
      .filter(Boolean) as ContactRef[],
);
const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
const fmtShort = (iso?: string) => {
  if (!iso) return "—";
  return formatSystemDate(iso);
};

/* ===== Steps state ===== */
const steps = ref<ToDoStep[]>([]);

/* Debounced autosave for steps (existing items) */
let saveTimer: number | null = null;
function scheduleSaveSteps() {
  if (!props.todo) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    emit("saveSteps", { id: props.todo!.id, steps: steps.value });
  }, 300);
}

/* New Step Draft (appears at the bottom, explicit Save/Cancel) */
const showNewDraft = ref(false);
const newSearch = ref("");
const newDraft = reactive<ToDoStep>({
  id: 0,
  title: "",
  collaborators: [],
  dueAt: new Date().toISOString(),
  status: "pending",
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
function addStep() {
  showNewDraft.value = true;
  newSearch.value = "";
  const now = new Date().toISOString();
  Object.assign(newDraft, {
    id: Date.now(),
    title: "",
    collaborators: [],
    dueAt: now,
    status: "pending",
    notes: "",
    createdAt: now,
    updatedAt: now,
  } as ToDoStep);
}
function saveNewDraft() {
  if (!newDraft.title.trim()) return;
  steps.value.push(JSON.parse(JSON.stringify(newDraft)));
  showNewDraft.value = false;
  scheduleSaveSteps();
}
function cancelNewDraft() {
  showNewDraft.value = false;
  newSearch.value = "";
}

/* Toggle complete for a step (auto-saves) */
function toggleStepCompleted(idx: number) {
  const s = steps.value[idx];
  s.status = s.status === "completed" ? "pending" : "completed";
  scheduleSaveSteps();
}

/* Remove step (auto-saves) */
function removeStep(idx: number) {
  steps.value.splice(idx, 1);
  scheduleSaveSteps();
}

/* ===== Reusable Step Dialog wiring ===== */
const StepEditDialogOpen = ref(false);
const StepEditDialogIdx = ref<number | null>(null);
const StepEditDialogModel = ref<DialogStep | null>(null);

function openStepEditDialog(idx: number) {
  StepEditDialogIdx.value = idx;
  StepEditDialogModel.value = JSON.parse(JSON.stringify(steps.value[idx]));
  StepEditDialogOpen.value = true;
}

function onStepEditDialogSave(edited: DialogStep) {
  if (StepEditDialogIdx.value == null) return;
  steps.value[StepEditDialogIdx.value] = JSON.parse(JSON.stringify(edited));
  scheduleSaveSteps();
}
function onStepEditDialogClose() {
  StepEditDialogOpen.value = false;
  StepEditDialogModel.value = null;
  StepEditDialogIdx.value = null;
}

/* ===== Load / Reset ===== */
function loadFromToDo(t: ToDo) {
  title.value = t.title ?? "";
  selectedCollaboratorIds.value = (t.collaborators ?? []).map((c) => c.id);
  dueAt.value = t.dueAt ? new Date(t.dueAt).toISOString() : null;
  notes.value = t.notes ?? "";
  important.value = !!t.important;
  selectedRelatedKey.value =
    t.relatedTo?.type === "job" ? `job-${t.relatedTo.id}` : null;
  selectedStatus.value = (t.status ?? "pending") as Status;

  steps.value = JSON.parse(JSON.stringify(t.steps ?? [])) as ToDoStep[];

  // ✅ Initialize local completed toggle from any possible flags/shape
  nextTick(() => {
    refForm.value?.resetValidation();
    collabSearch.value = "";
  });
}
function resetForm() {
  title.value = "";
  selectedCollaboratorIds.value = [];
  dueAt.value = null;
  notes.value = "";
  important.value = false;
  selectedRelatedKey.value = null;
  selectedStatus.value = "pending";
  steps.value = [];
  activeTab.value = "details";
  refForm.value?.reset();
  refForm.value?.resetValidation();
  collabSearch.value = "";
  showNewDraft.value = false;
  newSearch.value = "";
  StepEditDialogOpen.value = false;
  StepEditDialogIdx.value = null;
  StepEditDialogModel.value = null;
}

/* Sync to open/prop changes */
watch(
  () => props.isDrawerOpen,
  (open) => {
    if (open && props.todo) loadFromToDo(props.todo);
    if (!open) nextTick(() => resetForm());
  },
);
watch(
  () => props.todo,
  (t) => {
    if (props.isDrawerOpen && t) loadFromToDo(t);
  },
  { deep: true },
);

function closeDrawer() {
  emit("update:isDrawerOpen", false);
}

/* ===== Save details ===== */
async function onSaveAll() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid || !props.todo) {
    activeTab.value = "details";
    return;
  }
  const dueISO = toDateOnlyISOString(dueAt.value);
  const relatedOption = relatedOptions.value.find(
    (option) => option.value === selectedRelatedKey.value,
  );

  const payload: any = {
    id: props.todo.id,
    title: (title.value ?? "").toString().trim(),
    collaborators: selectedCollaborators.value,
    dueAt: dueISO,
    status: selectedStatus.value, // keep your status UX separate from completion toggle
    notes: (notes.value ?? "").toString().trim(),
    important: Boolean(important.value),
    relatedTo: relatedOption
      ? {
          id: relatedOption.rawId,
          name: relatedOption.title,
          type: relatedOption.type,
        }
      : null,
  };

  if (selectedStatus.value === "completed") {
    payload.completed = true;
    payload.isCompleted = true;
    payload.doneAt = new Date().toISOString();
  } else {
    payload.completed = false;
    payload.isCompleted = false;
    payload.doneAt = null;
  }

  emit("save", payload as any);
  emit("update:isDrawerOpen", false);
}
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    class="scrollable-content todo-drawer"
    :model-value="props.isDrawerOpen"
    @update:model-value="(val) => emit('update:isDrawerOpen', val)"
  >
    <AppDrawerHeaderSection title="Edit To Do" @cancel="closeDrawer" />
    <VDivider />

    <!-- Full-width tabs -->
    <VTabs v-model="activeTab" grow class="px-4 w-100 todo-drawer-tabs">
      <VTab value="details" class="flex-1">Details</VTab>
      <VTab value="steps" class="flex-1">Steps</VTab>
    </VTabs>
    <VDivider />

    <VCard flat class="drawer-card d-flex flex-column h-100">
      <!-- Scrollable area -->
      <PerfectScrollbar
        :options="{ wheelPropagation: false }"
        class="flex-1 min-h-0"
      >
        <VCardText class="pt-4">
          <VWindow v-model="activeTab" class="h-100">
            <!-- ========= DETAILS ========= -->
            <VWindowItem value="details">
              <VForm ref="refForm" v-model="isFormValid" @submit.prevent>
                <VRow>
                  <VCol cols="12">
                    <AppTextarea
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
                      :items="props.collaboratorsOptions"
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
                              <template v-if="item.raw.avatarUrl"
                                ><VImg :src="item.raw.avatarUrl"
                              /></template>
                              <template v-else>
                                <span class="text-caption font-weight-bold">{{
                                  initials(item.raw.name)
                                }}</span>
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
                            <template v-if="item.raw.avatarUrl"
                              ><VImg :src="item.raw.avatarUrl"
                            /></template>
                            <template v-else
                              ><span class="text-xxs font-weight-bold">{{
                                initials(item.raw.name)
                              }}</span></template
                            >
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

                  <!-- ✅ Match Add drawer props & wrapper -->
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
                      label="Notes"
                      placeholder="Notes"
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

                  <!-- ✅ Mark as completed (as a Switch; no auto-save) -->
                  <VCol cols="12">
                    <VFileInput label="Attachment File" />
                  </VCol>
                </VRow>
              </VForm>
            </VWindowItem>

            <!-- ========= STEPS ========= -->
            <VWindowItem value="steps">
              <div class="mb-3">
                <h6 class="text-subtitle-1">Steps</h6>
              </div>

              <div class="d-flex flex-column gap-3">
                <!-- Existing steps -->
                <VCard
                  v-for="(s, idx) in steps"
                  :key="s.id"
                  class="px-3 py-2 step-row"
                  variant="tonal"
                  @click="openStepEditDialog(idx)"
                >
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-3">
                      <VCheckbox
                        hide-details
                        density="compact"
                        :model-value="s.status === 'completed'"
                        @click.stop="toggleStepCompleted(idx)"
                      />

                      <div class="d-flex flex-column">
                        <strong class="text-body-1">{{
                          s.title || "Untitled step"
                        }}</strong>
                        <span class="text-sm">{{ fmtShort(s.dueAt) }}</span>
                        <span
                          class="text-xs text-capitalize mt-1"
                          :class="{
                            'text-primary': s.status === 'in_progress',
                            'text-warning': s.status === 'for_review',
                            'text-medium-emphasis': s.status === 'pending',
                            'text-success': s.status === 'completed',
                          }"
                        >
                          {{
                            s.status === "pending"
                              ? "Pending"
                              : s.status === "in_progress"
                                ? "In Progress"
                                : s.status === "for_review"
                                  ? "For Review"
                                  : "Completed"
                          }}
                        </span>
                      </div>
                    </div>

                    <div class="d-flex align-center">
                      <div
                        v-if="s.collaborators?.length"
                        class="v-avatar-group me-2"
                      >
                        <VAvatar
                          v-for="c in s.collaborators.slice(0, 2)"
                          :key="c.id"
                          :size="28"
                          color="primary"
                        >
                          <template v-if="c.avatarUrl"
                            ><VImg :src="c.avatarUrl"
                          /></template>
                          <template v-else
                            ><span class="mono">{{
                              (c.name || "?").trim().slice(0, 1).toUpperCase()
                            }}</span></template
                          >
                          <VTooltip activator="parent" location="top">{{
                            c.name
                          }}</VTooltip>
                        </VAvatar>
                        <VAvatar
                          v-if="s.collaborators.length > 2"
                          :size="28"
                          color="secondary"
                        >
                          +{{ s.collaborators.length - 2 }}
                          <VTooltip activator="parent" location="top">
                            {{
                              s.collaborators
                                .slice(2)
                                .map((c) => c.name)
                                .join(", ")
                            }}
                          </VTooltip>
                        </VAvatar>
                      </div>

                      <VMenu>
                        <template #activator="{ props: m }">
                          <IconBtn v-bind="m" @click.stop
                            ><VIcon icon="tabler-dots-vertical"
                          /></IconBtn>
                        </template>
                        <VList density="compact">
                          <VListItem @click="openStepEditDialog(idx)"
                            ><VListItemTitle>Edit</VListItemTitle></VListItem
                          >

                          <VListItem @click="removeStep(idx)"
                            ><VListItemTitle class="text-error"
                              >Delete</VListItemTitle
                            ></VListItem
                          >
                        </VList>
                      </VMenu>
                    </div>
                  </div>
                </VCard>

                <!-- New step draft editor -->
                <VCard
                  v-if="showNewDraft"
                  class="px-3 py-3 step-row"
                  variant="tonal"
                >
                  <h6 class="text-subtitle-2 mb-2">New step</h6>
                  <div class="d-flex flex-column gap-3">
                    <AppTextField v-model="newDraft.title" label="Title" />
                    <AppDateTimePicker
                      v-model="newDraft.dueAt"
                      label="Due Date"
                      placeholder="Select date"
                      :config="{ dateFormat: 'Y-m-d' }"
                    />
                    <VAutocomplete
                      v-model="newDraft.collaborators"
                      v-model:search="newSearch"
                      class="todo-collaborators"
                      :items="props.collaboratorsOptions"
                      item-title="name"
                      return-object
                      label="Assigned to"
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="newSearch = ''"
                    />
                    <DialogActionBar
                      @save="saveNewDraft"
                      @cancel="cancelNewDraft"
                    />
                  </div>
                </VCard>

                <div
                  v-if="!steps.length && !showNewDraft"
                  class="text-medium-emphasis text-center py-6"
                >
                  No steps yet. Click the “+” to add one.
                </div>

                <div class="d-flex justify-end pt-2">
                  <VBtn
                    size="small"
                    icon="tabler-plus"
                    color="primary"
                    variant="tonal"
                    @click="addStep"
                  />
                </div>
              </div>
            </VWindowItem>

            <!-- ========= ACTIVITIES ========= -->
          </VWindow>
        </VCardText>
      </PerfectScrollbar>

      <!-- Details actions -->
      <VCardActions class="px-6 pb-6 pt-0" v-if="activeTab === 'details'">
        <DialogActionBar @save="onSaveAll" @cancel="closeDrawer" />
      </VCardActions>
    </VCard>

    <!-- ===== Reusable Step Dialog ===== -->
    <StepEditDialog
      v-model="StepEditDialogOpen"
      :step="StepEditDialogModel"
      :collaborators-options="props.collaboratorsOptions"
      title="Edit Subtask"
      @save="onStepEditDialogSave"
      @close="onStepEditDialogClose"
    />
  </VNavigationDrawer>
</template>

<style scoped>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  gap: 6px;
  min-block-size: 84px;
  min-inline-size: 120px; /* prevents "In Progress" from wrapping */
  padding-block: 10px;
  padding-inline: 12px;
}

:deep(.status-compact .custom-radios-with-icon .custom-input__desc),
:deep(.status-compact .custom-radios-with-icon .custom-input-desc),
:deep(.status-compact .custom-radios-with-icon .custom-radio__desc) {
  display: none !important;
}

:deep(.todo-drawer-tabs .v-slide-group__content) {
  align-items: stretch;
}

:deep(.todo-drawer-tabs) {
  block-size: 56px;
}

:deep(.todo-drawer-tabs .v-slide-group) {
  block-size: 56px;
}

:deep(.todo-drawer-tabs .v-tab) {
  block-size: 56px;
  min-block-size: 56px;
  padding-block: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.todo-drawer-tabs .v-btn__content) {
  display: flex;
  block-size: 56px;
  align-items: center;
  justify-content: center;
  padding-block: 0;
  margin-block: 0;
  transform: translateY(0);
  line-height: 56px;
  vertical-align: middle;
}

:deep(.todo-drawer-tabs .v-tab__slider) {
  inset-block-end: 0;
}

:deep(.todo-drawer-tabs .v-tab__content) {
  display: flex;
  block-size: 56px;
  align-items: center;
  justify-content: center;
  line-height: 56px;
}

:deep(.status-compact .custom-radios-with-icon .custom-input__title),
:deep(.status-compact .custom-radios-with-icon .custom-input-title),
:deep(.status-compact .custom-radios-with-icon .custom-radio__title) {
  overflow: hidden;
  margin: 0;
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

:deep(.status-compact .custom-radios-with-icon .v-icon) {
  block-size: 24px;
  font-size: 24px !important;
  inline-size: 24px;
}

/* Make the drawer content a column that fills height */
.todo-drawer :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  block-size: 100%;
}

/* Card fills the drawer */
.drawer-card {
  block-size: 100% !important;
}

.min-h-0 {
  min-block-size: 0;
}

/* Steps tone */
.step-row {
  background: rgba(255, 255, 255, 6%);
}

/* Monogram */
.mono {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 100%;
  font-size: 0.8rem;
  font-weight: 700;
  inline-size: 100%;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

::v-deep(.todo-collaborators .v-field__input) {
  padding-block: 10px;
}
</style>
