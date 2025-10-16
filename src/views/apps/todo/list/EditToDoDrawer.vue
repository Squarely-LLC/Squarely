<script setup lang="ts">
import type { CustomInputContent } from "@core/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

/* NEW: reusable dialog */
import StepEditDialog from "../StepEditDialog.vue"; // ← import the component

/* ===== Types — align with your table ===== */
type Priority = "low" | "normal" | "high";
type Status = "pending" | "in_progress" | "for_review" | "completed";
type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};
type ToDoStep = {
  id: number | string;
  title: string;
  collaborators: ContactRef[];
  dueAt: string;
  priority: Priority;
  status: Exclude<Status, "completed"> | "completed";
  notes?: string;
};
type Activity = {
  id: number | string;
  author?: ContactRef;
  body: string;
  createdAt: string;
};
type ToDo = {
  id: number | string;
  title: string;
  collaborators: ContactRef[];
  dueAt: string;
  priority: Priority;
  important: boolean;
  status: Status;
  steps: ToDoStep[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
};

/* Local alias for dialog payload type */
type DialogStep = ToDoStep;

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
      priority: Priority;
      status: Exclude<Status, "completed">;
      notes: string;
      important: boolean;
    }
  ): void;
  (e: "saveSteps", v: { id: number | string; steps: ToDoStep[] }): void;
  (e: "addActivity", v: { id: number | string; body: string }): void;
}
interface Props {
  isDrawerOpen: boolean;
  todo: ToDo | null | undefined;
  collaboratorsOptions: ContactRef[];
}
const props = defineProps<Props>();
const emit = defineEmits<Emit>();

/* ===== Tabs ===== */
const activeTab = ref<"details" | "steps" | "activities">("details");

/* ===== Details form ===== */
const isFormValid = ref(false);
const refForm = ref<VForm>();
const collabSearch = ref("");

// Local UI state
const title = ref<string>("");
const selectedCollaboratorIds = ref<(number | string)[]>([]);
const dueAt = ref<string | null>(null);
const priority = ref<Priority>("normal");
const notes = ref<string>("");
const important = ref<boolean>(false);
const selectedStatus = ref<Exclude<Status, "completed">>("pending");

// ✅ Local completed toggle (pure UI; applied on Save)
const completed = ref<boolean>(false);

const statusRadios: CustomInputContent[] = [
  {
    title: "Pending",
    value: "pending",
    icon: { icon: "tabler-clock", size: "24" },
  },
  {
    title: "In\u00A0Progress",
    value: "in_progress",
    icon: { icon: "tabler-rotate-clockwise", size: "24" },
  },
  {
    title: "For\u00A0Review",
    value: "for_review",
    icon: { icon: "tabler-eye-check", size: "24" },
  },
];

/* ===== Helpers ===== */
const idToContact = computed(
  () => new Map(props.collaboratorsOptions.map((c) => [c.id, c] as const))
);
const selectedCollaborators = computed<ContactRef[]>(
  () =>
    selectedCollaboratorIds.value
      .map((id) => idToContact.value.get(id))
      .filter(Boolean) as ContactRef[]
);
const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
const fmtShort = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
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
  priority: "normal",
  status: "pending",
  notes: "",
});
function addStep() {
  showNewDraft.value = true;
  newSearch.value = "";
  Object.assign(newDraft, {
    id: Date.now(),
    title: "",
    collaborators: [],
    dueAt: new Date().toISOString(),
    priority: "normal",
    status: "pending",
    notes: "",
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

/* ===== Activities ===== */
const newMessage = ref("");
function sendMessage() {
  if (!props.todo || !newMessage.value.trim()) return;
  emit("addActivity", { id: props.todo.id, body: newMessage.value.trim() });
  newMessage.value = "";
}

/* ===== Load / Reset ===== */
function loadFromToDo(t: ToDo) {
  title.value = t.title ?? "";
  selectedCollaboratorIds.value = (t.collaborators ?? []).map((c) => c.id);
  dueAt.value = t.dueAt ? new Date(t.dueAt).toISOString() : null;
  priority.value = (t.priority ?? "normal") as Priority;
  notes.value = t.notes ?? "";
  important.value = !!t.important;
  selectedStatus.value = (t.status ?? "pending") as Exclude<
    Status,
    "completed"
  >;

  steps.value = JSON.parse(JSON.stringify(t.steps ?? [])) as ToDoStep[];

  // ✅ Initialize local completed toggle from any possible flags/shape
  const anyT: any = t as any;
  completed.value = Boolean(
    anyT?.completed ||
      anyT?.isCompleted ||
      anyT?.doneAt ||
      anyT?.status === "completed"
  );

  nextTick(() => {
    refForm.value?.resetValidation();
    collabSearch.value = "";
  });
}
function resetForm() {
  title.value = "";
  selectedCollaboratorIds.value = [];
  dueAt.value = null;
  priority.value = "normal";
  notes.value = "";
  important.value = false;
  selectedStatus.value = "pending";
  steps.value = [];
  completed.value = false; // reset local toggle
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
  }
);
watch(
  () => props.todo,
  (t) => {
    if (props.isDrawerOpen && t) loadFromToDo(t);
  },
  { deep: true }
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
  const dueISO = dueAt.value
    ? new Date(dueAt.value).toISOString()
    : new Date().toISOString();

  const payload: any = {
    id: props.todo.id,
    title: (title.value ?? "").toString().trim(),
    collaborators: selectedCollaborators.value,
    dueAt: dueISO,
    priority: priority.value,
    status: selectedStatus.value, // keep your status UX separate from completion toggle
    notes: (notes.value ?? "").toString().trim(),
    important: Boolean(important.value),
  };

  // attach completion flags based on local switch
  if (completed.value) {
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
    <VTabs v-model="activeTab" grow class="px-4 w-100">
      <VTab value="details" class="flex-1">Details</VTab>
      <VTab value="steps" class="flex-1">Steps</VTab>
      <VTab value="activities" class="flex-1">Activities</VTab>
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
                      :items="props.collaboratorsOptions"
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

                  <!-- ✅ Match Add drawer props & wrapper -->
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
                      placeholder="Notes"
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

                  <!-- ✅ Mark as completed (as a Switch; no auto-save) -->
                  <VCol cols="12" class="pt-0">
                    <VSwitch
                      v-model="completed"
                      color="success"
                      inset
                      label="Mark as completed"
                      hide-details
                    />
                  </VCol>

                  <VCol cols="12">
                    <VFileInput label="Attachment File" />
                  </VCol>
                </VRow>
              </VForm>
            </VWindowItem>

            <!-- ========= STEPS ========= -->
            <VWindowItem value="steps">
              <div class="d-flex justify-space-between align-center mb-3">
                <h6 class="text-subtitle-1">Steps</h6>
                <VBtn size="small" icon="tabler-plus" @click="addStep" />
              </div>

              <div class="d-flex flex-column gap-3">
                <!-- Existing steps -->
                <VCard
                  v-for="(s, idx) in steps"
                  :key="s.id"
                  class="px-3 py-2 step-row"
                  variant="tonal"
                >
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-3">
                      <VCheckbox
                        hide-details
                        density="compact"
                        :model-value="s.status === 'completed'"
                        @click.stop="toggleStepCompleted(idx)"
                      />
                      <VIcon icon="tabler-subtask" size="18" />
                      <div class="d-flex flex-column">
                        <strong class="text-body-1">{{
                          s.title || "Untitled step"
                        }}</strong>
                        <span class="text-sm">{{ fmtShort(s.dueAt) }}</span>
                        <div class="d-flex align-center gap-2 mt-1">
                          <VChip
                            :color="
                              s.priority === 'low'
                                ? 'secondary'
                                : s.priority === 'normal'
                                ? 'primary'
                                : 'error'
                            "
                            size="x-small"
                            label
                            class="text-capitalize"
                          >
                            {{
                              s.priority === "low"
                                ? "Low"
                                : s.priority === "normal"
                                ? "Normal"
                                : "High"
                            }}
                          </VChip>
                          <span
                            class="text-xs text-capitalize"
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
                          <IconBtn v-bind="m"
                            ><VIcon icon="tabler-dots-vertical"
                          /></IconBtn>
                        </template>
                        <VList density="compact">
                          <VListItem @click="openStepEditDialog(idx)"
                            ><VListItemTitle>Edit</VListItemTitle></VListItem
                          >
                          <VListItem
                            @click="
                              () => {
                                s.status = 'for_review';
                                scheduleSaveSteps();
                              }
                            "
                          >
                            <VListItemTitle>Submit for review</VListItemTitle>
                          </VListItem>
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
                      placeholder="Select date and time"
                      :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
                    />
                    <VAutocomplete
                      v-model="newDraft.collaborators"
                      v-model:search="newSearch"
                      :items="props.collaboratorsOptions"
                      item-title="name"
                      return-object
                      label="Assign to someone else.."
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="newSearch = ''"
                    />
                    <div class="d-flex justify-end gap-2">
                      <VBtn
                        variant="tonal"
                        color="error"
                        @click="cancelNewDraft"
                        >Cancel</VBtn
                      >
                      <VBtn @click="saveNewDraft">Save</VBtn>
                    </div>
                  </div>
                </VCard>

                <div
                  v-if="!steps.length && !showNewDraft"
                  class="text-medium-emphasis text-center py-6"
                >
                  No steps yet. Click the “+” to add one.
                </div>
              </div>
            </VWindowItem>

            <!-- ========= ACTIVITIES ========= -->
            <VWindowItem value="activities">
              <div class="activities-pane">
                <div class="history">
                  <div
                    v-for="a in props.todo?.activities || []"
                    :key="a.id"
                    class="pa-3 rounded border mb-3"
                    style="border-color: rgba(255, 255, 255, 8%)"
                  >
                    <div class="text-sm mb-1">
                      <strong>{{ a.author?.name || "Someone" }}</strong>
                      <span class="text-disabled">
                        • {{ new Date(a.createdAt).toLocaleString() }}</span
                      >
                    </div>
                    <div>{{ a.body }}</div>
                  </div>
                  <div
                    v-if="!props.todo?.activities?.length"
                    class="text-medium-emphasis"
                  >
                    No messages yet.
                  </div>
                </div>
              </div>
            </VWindowItem>
          </VWindow>
        </VCardText>
      </PerfectScrollbar>

      <!-- Details actions -->
      <VCardActions class="px-6 pb-6 pt-0" v-if="activeTab === 'details'">
        <VBtn variant="tonal" class="me-3" @click="onSaveAll">Save</VBtn>
        <VBtn type="button" variant="tonal" color="error" @click="closeDrawer"
          >Cancel</VBtn
        >
      </VCardActions>

      <!-- Pinned composer for Activities -->
      <!-- <VCardActions
        v-if="activeTab === 'activities'"
        class="px-6 py-4 composer align-center"
      >
        <AppTextarea
          v-model="newMessage"
          rows="4"
          label="Write a message"
          placeholder="Type and press Send"
          class="flex-grow-1 me-3"
        />
        <VBtn variant="flat" @click="sendMessage">Send</VBtn>
      </VCardActions> -->
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

/* Activities layout */
.activities-pane {
  display: flex;
  flex-direction: column;
  min-block-size: 100%;
}

.history {
  flex: 1 1 auto;
  padding-block-end: 88px;
}

.composer {
  position: sticky;
  z-index: 2;
  background: transparent;
  border-block-start: 1px solid rgba(255, 255, 255, 6%);
  inset-block-end: 0;
  margin-block-start: auto;
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
</style>
