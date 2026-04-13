<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type {
  ContactRef,
  Status,
  ToDo,
  ToDoAttachment,
  ToDoStep,
} from "@/data/schema";
import type { CatalogueTaskStartTrigger } from "@/plugins/fake-api/handlers/catalogues/types";
import { useEmployeesStore } from "@/stores/employees";
import { getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type CatalogueTaskTemplatePayload = Partial<ToDo> & {
  afterWhen?: string | null;
  startTrigger?: CatalogueTaskStartTrigger | null;
};

type TriggerOption = {
  title: string;
  value: string;
};

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "save", value: CatalogueTaskTemplatePayload): void;
}

interface Props {
  isDrawerOpen: boolean;
  goalTriggerOptions?: TriggerOption[];
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const activeTab = ref<"details" | "steps">("details");
const employeesStore = useEmployeesStore();
employeesStore.init();

const isFormValid = ref(false);
const refForm = ref<VForm>();
const titleFieldRef = ref<any>(null);
const collabSearch = ref("");
const attachmentFileInputRef = ref<HTMLInputElement | null>(null);
const syncingAttachmentInput = ref(false);
const pendingInitial = ref<CatalogueTaskTemplatePayload | null>(null);

const title = ref("");
const selectedCollaboratorIds = ref<string[]>([]);
const startMode = ref<"time" | "goal">("time");
const afterWhenPreset = ref<"1_day" | "2_days" | "1_week" | "custom">("1_day");
const afterWhenValue = ref<number | null>(1);
const selectedGoalTriggerId = ref<string | null>(null);
const notes = ref("");
const important = ref(false);
const selectedStatus = ref<Status>("pending");
const attachmentInput = ref("");
const attachmentFile = ref<File | null>(null);
const attachment = ref<ToDoAttachment | null>(null);
const goalId = ref<number | string | null>(null);
const milestoneId = ref<number | string | null>(null);
const initialCollaborators = ref<ContactRef[]>([]);
const steps = ref<ToDoStep[]>([]);
const stepDialogOpen = ref(false);
const stepDialogIndex = ref<number | null>(null);
const stepDialogModel = ref<ToDoStep | null>(null);
const stepAfterWhenPreset = ref<"1_day" | "2_days" | "1_week" | "custom">(
  "1_day",
);
const stepAfterWhenValue = ref<number | null>(1);
const showNewDraft = ref(false);
const newSearch = ref("");
const newDraftAfterWhenPreset = ref<"1_day" | "2_days" | "1_week" | "custom">(
  "1_day",
);
const newDraftAfterWhenValue = ref<number | null>(1);
const newDraft = reactive<ToDoStep>({
  id: 0,
  title: "",
  collaborators: [],
  dueAt: "+1 day",
  status: "pending",
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const statusOptions: { title: string; value: Status }[] = [
  { title: "Pending", value: "pending" },
  { title: "In Progress", value: "in_progress" },
  { title: "For Review", value: "for_review" },
  { title: "Completed", value: "completed" },
];

const collaboratorOptions = computed(() => {
  const merged = new Map<
    string,
    {
      id: number | string;
      idKey: string;
      name: string;
      avatarUrl?: string | null;
    }
  >();

  employeesStore.all.forEach((employee) => {
    const idKey = String(employee.id);
    merged.set(idKey, {
      id: employee.id,
      idKey,
      name: employee.fullName,
      avatarUrl: employee.picture,
    });
  });

  initialCollaborators.value.forEach((collaborator) => {
    const idKey = String(collaborator.id);
    if (merged.has(idKey)) return;
    merged.set(idKey, {
      id: collaborator.id,
      idKey,
      name: collaborator.name,
      avatarUrl: collaborator.avatarUrl ?? null,
    });
  });

  return Array.from(merged.values());
});

const idToCollaborator = computed(
  () =>
    new Map(
      collaboratorOptions.value.map((item) => [item.idKey, item] as const),
    ),
);

const selectedCollaborators = computed<ContactRef[]>(() => {
  const lookup = idToCollaborator.value as Map<string, ContactRef>;
  return selectedCollaboratorIds.value
    .map((id) => lookup.get(String(id)))
    .filter(Boolean) as ContactRef[];
});

const cloneStep = (step: Partial<ToDoStep>, index: number): ToDoStep => {
  const now = new Date().toISOString();

  return {
    id: step.id ?? index + 1,
    title: String(step.title ?? "").trim(),
    collaborators: Array.isArray(step.collaborators)
      ? step.collaborators.map((collaborator) => ({
          id: collaborator.id,
          name: String(collaborator.name ?? "").trim(),
          avatarUrl: collaborator.avatarUrl ?? null,
        }))
      : [],
    dueAt: String(step.dueAt ?? now),
    priority:
      step.priority === "low" ||
      step.priority === "normal" ||
      step.priority === "high"
        ? step.priority
        : undefined,
    status:
      step.status === "in_progress" ||
      step.status === "for_review" ||
      step.status === "completed"
        ? step.status
        : "pending",
    notes: String(step.notes ?? "").trim(),
    createdAt: String(step.createdAt ?? now),
    updatedAt: String(step.updatedAt ?? now),
  };
};

const parseAfterWhenValue = (value?: string | null) => {
  const match = String(value ?? "")
    .trim()
    .match(/^\+?\s*(\d+)\s+(day|days|week|weeks|month|months)$/i);

  if (match) {
    const rawValue = Number(match[1]);
    const rawUnit = match[2].toLowerCase();
    const normalizedDays = rawUnit.startsWith("week")
      ? rawValue * 7
      : rawUnit.startsWith("month")
        ? rawValue * 30
        : rawValue;

    return {
      days: normalizedDays,
      preset:
        normalizedDays === 1
          ? ("1_day" as const)
          : normalizedDays === 2
            ? ("2_days" as const)
            : normalizedDays === 7
              ? ("1_week" as const)
              : ("custom" as const),
    };
  }

  const parsedDate = value ? new Date(value) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const startOfTarget = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
    );
    const diffDays = Math.max(
      1,
      Math.round(
        (startOfTarget.getTime() - startOfToday.getTime()) / 86400000,
      ),
    );

    return {
      days: diffDays,
      preset:
        diffDays === 1
          ? ("1_day" as const)
          : diffDays === 2
            ? ("2_days" as const)
            : diffDays === 7
              ? ("1_week" as const)
              : ("custom" as const),
    };
  }

  return { days: 1, preset: "1_day" as const };
};

const focusTitleInput = () => {
  nextTick(() => {
    const input =
      titleFieldRef.value?.$el?.querySelector?.("input") ||
      titleFieldRef.value?.$el?.querySelector?.("textarea") ||
      titleFieldRef.value?.querySelector?.("input") ||
      titleFieldRef.value?.querySelector?.("textarea");

    input?.focus();
  });
};

const resetForm = () => {
  syncingAttachmentInput.value = true;
  refForm.value?.resetValidation();
  activeTab.value = "details";
  title.value = "";
  collabSearch.value = "";
  selectedCollaboratorIds.value = [];
  startMode.value = "time";
  afterWhenPreset.value = "1_day";
  afterWhenValue.value = 1;
  selectedGoalTriggerId.value = null;
  notes.value = "";
  important.value = false;
  selectedStatus.value = "pending";
  initialCollaborators.value = [];
  attachmentInput.value = "";
  attachmentFile.value = null;
  attachment.value = null;
  goalId.value = null;
  milestoneId.value = null;
  steps.value = [];
  stepDialogOpen.value = false;
  stepDialogIndex.value = null;
  stepDialogModel.value = null;
  showNewDraft.value = false;
  newSearch.value = "";
  newDraftAfterWhenPreset.value = "1_day";
  newDraftAfterWhenValue.value = 1;
  nextTick(() => {
    syncingAttachmentInput.value = false;
  });
};

const loadInitial = () => {
  resetForm();

  const init = pendingInitial.value;
  if (init) {
    syncingAttachmentInput.value = true;
    title.value = init.title ?? "";
    selectedCollaboratorIds.value = Array.isArray(init.collaborators)
      ? init.collaborators.map((collaborator) => String(collaborator.id))
      : [];
    initialCollaborators.value = Array.isArray(init.collaborators)
      ? init.collaborators.map((collaborator) => ({ ...collaborator }))
      : [];
    startMode.value =
      init.startTrigger?.type === "goal"
        ? "goal"
        : "time";
    selectedGoalTriggerId.value = init.startTrigger?.goalId
      ? String(init.startTrigger.goalId)
      : null;
    const initialAfterWhen = init.afterWhen ?? init.dueAt ?? null;
    const initialAfterWhenState = parseAfterWhenValue(initialAfterWhen);
    afterWhenValue.value = initialAfterWhenState.days;
    afterWhenPreset.value = initialAfterWhenState.preset;
    notes.value = init.notes ?? "";
    important.value = Boolean(init.important);
    selectedStatus.value = (init.status as Status | undefined) ?? "pending";
    attachment.value = init.attachment ?? null;
    attachmentInput.value =
      init.attachment?.type === "link"
        ? init.attachment.url || ""
        : init.attachment?.name || "";
    goalId.value = init.goalId ?? null;
    milestoneId.value = init.milestoneId ?? null;
    steps.value = Array.isArray(init.steps)
      ? init.steps.map((step, index) => cloneStep(step, index))
      : [];
    showNewDraft.value = false;
    newSearch.value = "";
    nextTick(() => {
      syncingAttachmentInput.value = false;
    });
  }

  pendingInitial.value = null;
  focusTitleInput();
};

const normalizeLink = (raw: string | null | undefined) => {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return /^(https?:)?\/\//i.test(value) ? value : `https://${value}`;
};

const onAttachmentInputUpdate = (value: string | null | undefined) => {
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
};

const openAttachmentPicker = () => {
  attachmentFileInputRef.value?.click();
};

const onAttachmentFileSelected = (event: Event) => {
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
};

const viewAttachment = async () => {
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
};

const closeDrawer = () => {
  emit("update:isDrawerOpen", false);
};

watch(
  () => props.isDrawerOpen,
  (isOpen) => {
    if (isOpen) loadInitial();
    else resetForm();
  },
);

watch(startMode, (mode) => {
  if (mode !== "goal") selectedGoalTriggerId.value = null;
});

const openWith = (initial?: CatalogueTaskTemplatePayload) => {
  pendingInitial.value = initial ?? null;
  if (props.isDrawerOpen) loadInitial();
  else emit("update:isDrawerOpen", true);
};

defineExpose({ openWith });

const buildAfterWhen = () => {
  const presetValueMap = {
    "1_day": 1,
    "2_days": 2,
    "1_week": 7,
  } as const;

  const value = Number(
    afterWhenPreset.value === "custom"
      ? afterWhenValue.value
      : presetValueMap[afterWhenPreset.value],
  );

  if (!Number.isFinite(value) || value <= 0) return null;

  const rounded = Math.floor(value);
  return `+${rounded} ${rounded === 1 ? "day" : "days"}`;
};

const afterWhenPresetOptions = [
  { title: "After 1 day", value: "1_day" },
  { title: "After 2 days", value: "2_days" },
  { title: "After 1 week", value: "1_week" },
  { title: "Custom", value: "custom" },
] as const;

const startModeOptions = [
  { title: "After time", value: "time" },
  { title: "After goal completion", value: "goal" },
] as const;

const buildStartTrigger = (): CatalogueTaskStartTrigger | null => {
  if (startMode.value === "goal") {
    return selectedGoalTriggerId.value
      ? {
          type: "goal",
          goalId: selectedGoalTriggerId.value,
          taskId: null,
        }
      : null;
  }

  return {
    type: "time",
    goalId: null,
    taskId: null,
  };
};

const canSaveTask = computed(() => {
  if (!title.value.trim()) return false;
  if (startMode.value === "goal") return Boolean(selectedGoalTriggerId.value);
  if (afterWhenPreset.value === "custom") {
    return Number.isFinite(Number(afterWhenValue.value)) && Number(afterWhenValue.value) > 0;
  }
  return true;
});

const createBlankStep = (): ToDoStep => {
  const now = new Date().toISOString();

  return {
    id: Date.now(),
    title: "",
    collaborators: [],
    dueAt: "+1 day",
    status: "pending",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
};

const addStep = () => {
  showNewDraft.value = true;
  newSearch.value = "";
  newDraftAfterWhenPreset.value = "1_day";
  newDraftAfterWhenValue.value = 1;
  Object.assign(newDraft, createBlankStep());
};

const buildStepAfterWhen = (
  preset: "1_day" | "2_days" | "1_week" | "custom",
  customValue: number | null,
) => {
  const presetValueMap = {
    "1_day": 1,
    "2_days": 2,
    "1_week": 7,
  } as const;

  const value = Number(
    preset === "custom" ? customValue : presetValueMap[preset],
  );

  if (!Number.isFinite(value) || value <= 0) return null;

  const rounded = Math.floor(value);
  return `+${rounded} ${rounded === 1 ? "day" : "days"}`;
};

const saveNewDraft = () => {
  if (!newDraft.title.trim()) return;

  newDraft.dueAt =
    buildStepAfterWhen(
      newDraftAfterWhenPreset.value,
      newDraftAfterWhenValue.value,
    ) ?? "+1 day";
  steps.value.push(cloneStep(newDraft, steps.value.length));
  showNewDraft.value = false;
  newSearch.value = "";
};

const cancelNewDraft = () => {
  showNewDraft.value = false;
  newSearch.value = "";
};

const openEditStepDialog = (index: number) => {
  stepDialogIndex.value = index;
  stepDialogModel.value = cloneStep(steps.value[index], index);
  const nextAfterWhenState = parseAfterWhenValue(stepDialogModel.value.dueAt);
  stepAfterWhenPreset.value = nextAfterWhenState.preset;
  stepAfterWhenValue.value = nextAfterWhenState.days;
  stepDialogOpen.value = true;
};

const onStepDialogSave = () => {
  if (!stepDialogModel.value) return;

  stepDialogModel.value.dueAt =
    buildStepAfterWhen(stepAfterWhenPreset.value, stepAfterWhenValue.value) ??
    "+1 day";

  const nextStep = cloneStep(
    stepDialogModel.value,
    stepDialogIndex.value ?? steps.value.length,
  );
  nextStep.updatedAt = new Date().toISOString();

  if (!nextStep.createdAt) nextStep.createdAt = nextStep.updatedAt;

  if (stepDialogIndex.value === null) {
    steps.value.push(nextStep);
  } else {
    steps.value[stepDialogIndex.value] = nextStep;
  }

  stepDialogOpen.value = false;
  stepDialogIndex.value = null;
  stepDialogModel.value = null;
};

const closeStepDialog = () => {
  stepDialogOpen.value = false;
  stepDialogIndex.value = null;
  stepDialogModel.value = null;
  stepAfterWhenPreset.value = "1_day";
  stepAfterWhenValue.value = 1;
};

const removeStep = (index: number) => {
  steps.value.splice(index, 1);
};

const toggleStepCompleted = (index: number) => {
  const step = steps.value[index];
  if (!step) return;

  step.status = step.status === "completed" ? "pending" : "completed";
  step.updatedAt = new Date().toISOString();
};

const formatStepDate = (value?: string | null) => {
  if (!value) return "--";

  const parsed = parseAfterWhenValue(value);
  if (String(value).trim().startsWith("+")) {
    return `After ${parsed.days} ${parsed.days === 1 ? "day" : "days"}`;
  }

  return value;
};

const onSubmit = async () => {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const trimmedTitle = title.value.trim();
  const trimmedNotes = notes.value.trim();

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

  emit("save", {
    title: trimmedTitle,
    collaborators: selectedCollaborators.value,
    afterWhen: startMode.value === "time" ? buildAfterWhen() : null,
    startTrigger: buildStartTrigger(),
    status: selectedStatus.value,
    notes: trimmedNotes,
    important: important.value,
    attachment: nextAttachment,
    relatedTo: null,
    goalId: goalId.value,
    milestoneId: milestoneId.value,
    steps: steps.value.map((step, index) => ({
      ...step,
      id: step.id ?? index + 1,
    })),
  });

  emit("update:isDrawerOpen", false);
};

const drawerTitle = computed(() =>
  pendingInitial.value?.title || title.value ? "Edit Task" : "Add New Task",
);
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    class="scrollable-content todo-drawer"
    :model-value="props.isDrawerOpen"
    @update:model-value="(value) => emit('update:isDrawerOpen', value)"
  >
    <AppDrawerHeaderSection :title="drawerTitle" @cancel="closeDrawer" />

    <VDivider />

    <VTabs v-model="activeTab" grow class="px-4 w-100 todo-drawer-tabs">
      <VTab value="details" class="flex-1">Details</VTab>
      <VTab value="steps" class="flex-1">Sub Tasks</VTab>
    </VTabs>

    <VDivider />

    <VCard flat class="drawer-card d-flex flex-column h-100">
      <PerfectScrollbar
        :options="{ wheelPropagation: false }"
        class="flex-1 min-h-0"
      >
        <VCardText class="pt-4">
          <VWindow v-model="activeTab" class="h-100">
            <VWindowItem value="details">
              <VForm
                ref="refForm"
                v-model="isFormValid"
                @submit.prevent="onSubmit"
              >
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
                      :items="collaboratorOptions"
                      item-title="name"
                      item-value="idKey"
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
                        <span v-else-if="index === 3" class="text-caption">
                          +{{ selectedCollaboratorIds.length - 3 }}
                        </span>
                      </template>
                    </VAutocomplete>
                  </VCol>

                  <VCol cols="12">
                    <AppSelect
                      v-model="startMode"
                      label="Start when"
                      :items="startModeOptions"
                      item-title="title"
                      item-value="value"
                    />
                  </VCol>

                  <VCol v-if="startMode === 'time'" cols="12">
                    <div class="text-body-2 mb-2">After when</div>
                    <div class="after-when-control">
                      <AppSelect
                        v-model="afterWhenPreset"
                        :items="afterWhenPresetOptions"
                        item-title="title"
                        item-value="value"
                        hide-details="auto"
                        class="after-when-select"
                      />

                      <AppTextField
                        v-if="afterWhenPreset === 'custom'"
                        v-model.number="afterWhenValue"
                        type="number"
                        min="1"
                        step="1"
                        hide-details="auto"
                        :rules="[requiredValidator]"
                        class="after-when-input"
                        suffix="days"
                      />
                    </div>
                  </VCol>

                  <VCol v-else-if="startMode === 'goal'" cols="12">
                    <AppSelect
                      v-model="selectedGoalTriggerId"
                      label="Start after goal completion"
                      :items="props.goalTriggerOptions || []"
                      item-title="title"
                      item-value="value"
                      :rules="[requiredValidator]"
                    />
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
                          <IconBtn
                            size="small"
                            @click.stop="openAttachmentPicker"
                          >
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
                </VRow>
              </VForm>
            </VWindowItem>

            <VWindowItem value="steps">
              <div class="mb-3">
                <h6 class="text-subtitle-1">Sub Tasks</h6>
              </div>

              <div class="d-flex flex-column gap-3">
                <VCard
                  v-for="(s, idx) in steps"
                  :key="s.id"
                  class="px-3 py-2 step-row"
                  variant="tonal"
                  @click="openEditStepDialog(idx)"
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
                        <strong class="text-body-1">
                          {{ s.title || "Untitled sub task" }}
                        </strong>
                        <span class="text-sm">{{
                          formatStepDate(s.dueAt)
                        }}</span>
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
                          <template v-else>
                            <span class="mono">
                              {{
                                (c.name || "?").trim().slice(0, 1).toUpperCase()
                              }}
                            </span>
                          </template>
                          <VTooltip activator="parent" location="top">
                            {{ c.name }}
                          </VTooltip>
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
                          <IconBtn v-bind="m" @click.stop>
                            <VIcon icon="tabler-dots-vertical" />
                          </IconBtn>
                        </template>
                        <VList density="compact">
                          <VListItem @click="openEditStepDialog(idx)">
                            <VListItemTitle>Edit</VListItemTitle>
                          </VListItem>
                          <VListItem @click="removeStep(idx)">
                            <VListItemTitle class="text-error"
                              >Delete</VListItemTitle
                            >
                          </VListItem>
                        </VList>
                      </VMenu>
                    </div>
                  </div>
                </VCard>

                <VCard
                  v-if="showNewDraft"
                  class="px-3 py-3 step-row"
                  variant="tonal"
                >
                  <h6 class="text-subtitle-2 mb-2">New Sub Task</h6>
                  <div class="d-flex flex-column gap-3">
                    <AppTextField v-model="newDraft.title" label="Title" />
                    <div>
                      <div class="text-body-2 mb-2">After when</div>
                      <div class="after-when-control">
                        <AppSelect
                          v-model="newDraftAfterWhenPreset"
                          :items="afterWhenPresetOptions"
                          item-title="title"
                          item-value="value"
                          hide-details="auto"
                          class="after-when-select"
                        />

                        <AppTextField
                          v-if="newDraftAfterWhenPreset === 'custom'"
                          v-model.number="newDraftAfterWhenValue"
                          type="number"
                          min="1"
                          step="1"
                          hide-details="auto"
                          :rules="[requiredValidator]"
                          class="after-when-input"
                          suffix="days"
                        />
                      </div>
                    </div>
                    <VAutocomplete
                      v-model="newDraft.collaborators"
                      v-model:search="newSearch"
                      class="todo-collaborators"
                      :items="collaboratorOptions"
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
          </VWindow>
        </VCardText>
      </PerfectScrollbar>

      <VCardActions class="px-6 pb-6 pt-0" v-if="activeTab === 'details'">
        <DialogActionBar
          :save-disabled="!canSaveTask"
          @save="onSubmit"
          @cancel="closeDrawer"
        />
      </VCardActions>
    </VCard>

    <VDialog v-model="stepDialogOpen" max-width="720">
      <DialogCloseBtn variant="tonal" @click="closeStepDialog" />
      <VCard v-if="stepDialogModel">
        <VCardTitle class="px-6 pt-4 pb-2">Edit Sub Task</VCardTitle>

        <VCardText class="px-6">
          <div class="d-flex flex-column gap-4">
            <AppTextField
              v-model="stepDialogModel.title"
              label="Title *"
              :rules="[requiredValidator]"
            />

            <VAutocomplete
              v-model="stepDialogModel.collaborators"
              class="todo-collaborators"
              :items="collaboratorOptions"
              item-title="name"
              return-object
              label="Assigned to"
              multiple
              chips
              closable-chips
              clearable
            />

            <div>
              <div class="text-body-2 mb-2">After when</div>
              <div class="after-when-control">
                <AppSelect
                  v-model="stepAfterWhenPreset"
                  :items="afterWhenPresetOptions"
                  item-title="title"
                  item-value="value"
                  hide-details="auto"
                  class="after-when-select"
                />

                <AppTextField
                  v-if="stepAfterWhenPreset === 'custom'"
                  v-model.number="stepAfterWhenValue"
                  type="number"
                  min="1"
                  step="1"
                  hide-details="auto"
                  :rules="[requiredValidator]"
                  class="after-when-input"
                  suffix="days"
                />
              </div>
            </div>

            <div class="d-flex gap-6 align-center">
              <VRadioGroup v-model="stepDialogModel.status" inline>
                <VRadio label="Pending" value="pending" />
                <VRadio label="In Review" value="for_review" />
                <VRadio label="In Progress" value="in_progress" />
                <VRadio label="Completed" value="completed" />
              </VRadioGroup>
            </div>

            <AppTextarea
              v-model="stepDialogModel.notes"
              label="Notes"
              auto-grow
            />
          </div>
        </VCardText>

        <VCardActions class="px-6 pb-4">
          <DialogActionBar
            :save-disabled="!(stepDialogModel.title || '').trim()"
            @save="onStepDialogSave"
            @cancel="closeStepDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>
  </VNavigationDrawer>
</template>

<style scoped>
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
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 56px;
  min-block-size: 56px;
  padding-block: 0;
}

:deep(.todo-drawer-tabs .v-btn__content) {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 56px;
  line-height: 56px;
  margin-block: 0;
  padding-block: 0;
  transform: translateY(0);
  vertical-align: middle;
}

:deep(.todo-drawer-tabs .v-tab__slider) {
  inset-block-end: 0;
}

:deep(.todo-drawer-tabs .v-tab__content) {
  display: flex;
  align-items: center;
  justify-content: center;
  block-size: 56px;
  line-height: 56px;
}

.after-when-control {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
}

.after-when-select {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.after-when-input {
  flex: 0 0 128px;
}

.todo-drawer :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
  block-size: 100%;
}

.drawer-card {
  block-size: 100% !important;
}

.min-h-0 {
  min-block-size: 0;
}

.step-row {
  background: rgba(255, 255, 255, 6%);
  cursor: pointer;
}

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

:deep(.todo-collaborators .v-field__input) {
  padding-block: 10px;
}
</style>
