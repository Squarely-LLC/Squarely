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
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { getFileObjectUrl, saveFile } from "@/utils/fileStore";
import StepEditDialog from "@/views/apps/todo/StepEditDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type CatalogueTaskTemplatePayload = Partial<ToDo> & {
  afterWhen?: string | null;
};

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "save", value: CatalogueTaskTemplatePayload): void;
}

interface Props {
  isDrawerOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const activeTab = ref<"details" | "steps">("details");
const employeesStore = useEmployeesStore();
employeesStore.init();

const jobsStore = useJobsStore();
jobsStore.init();

const isFormValid = ref(false);
const refForm = ref<VForm>();
const titleFieldRef = ref<any>(null);
const collabSearch = ref("");
const attachmentFileInputRef = ref<HTMLInputElement | null>(null);
const syncingAttachmentInput = ref(false);
const pendingInitial = ref<CatalogueTaskTemplatePayload | null>(null);

const title = ref("");
const selectedCollaboratorIds = ref<string[]>([]);
const afterWhenValue = ref<number | null>(1);
const notes = ref("");
const important = ref(false);
const selectedStatus = ref<Status>("pending");
const selectedRelatedKey = ref<string | null>(null);
const attachmentInput = ref("");
const attachmentFile = ref<File | null>(null);
const attachment = ref<ToDoAttachment | null>(null);
const goalId = ref<number | string | null>(null);
const milestoneId = ref<number | string | null>(null);
const initialCollaborators = ref<ContactRef[]>([]);
const initialRelatedTo = ref<ToDo["relatedTo"]>(null);
const steps = ref<ToDoStep[]>([]);
const stepDialogOpen = ref(false);
const stepDialogIndex = ref<number | null>(null);
const stepDialogModel = ref<ToDoStep | null>(null);
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

const relatedOptions = computed(() => {
  const merged = new Map<
    string,
    { title: string; value: string; rawId: number | string; type: "job" }
  >();

  jobsStore.all.forEach((job) => {
    merged.set(`job-${job.id}`, {
      title: job.name,
      value: `job-${job.id}`,
      rawId: job.id,
      type: "job",
    });
  });

  if (
    initialRelatedTo.value &&
    initialRelatedTo.value.type === "job" &&
    !merged.has(`job-${initialRelatedTo.value.id}`)
  ) {
    merged.set(`job-${initialRelatedTo.value.id}`, {
      title: initialRelatedTo.value.name,
      value: `job-${initialRelatedTo.value.id}`,
      rawId: initialRelatedTo.value.id,
      type: "job",
    });
  }

  return Array.from(merged.values());
});

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
  afterWhenValue.value = 1;
  notes.value = "";
  important.value = false;
  selectedStatus.value = "pending";
  selectedRelatedKey.value = null;
  initialCollaborators.value = [];
  initialRelatedTo.value = null;
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
    const initialAfterWhen = init.afterWhen ?? init.dueAt ?? null;
    const match = String(initialAfterWhen ?? "")
      .trim()
      .match(/^\+?\s*(\d+)\s+(day|days|week|weeks|month|months)$/i);

    if (match) {
      const rawValue = Number(match[1]);
      const rawUnit = match[2].toLowerCase();

      afterWhenValue.value = rawUnit.startsWith("week")
        ? rawValue * 7
        : rawUnit.startsWith("month")
          ? rawValue * 30
          : rawValue;
    }
    notes.value = init.notes ?? "";
    important.value = Boolean(init.important);
    selectedStatus.value = (init.status as Status | undefined) ?? "pending";
    initialRelatedTo.value = init.relatedTo ?? null;
    selectedRelatedKey.value =
      init.relatedTo?.type === "job" ? `job-${init.relatedTo.id}` : null;
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

const openWith = (initial?: CatalogueTaskTemplatePayload) => {
  pendingInitial.value = initial ?? null;
  if (props.isDrawerOpen) loadInitial();
  else emit("update:isDrawerOpen", true);
};

defineExpose({ openWith });

const buildAfterWhen = () => {
  const value =
    afterWhenValue.value === null || afterWhenValue.value === undefined
      ? NaN
      : Number(afterWhenValue.value);

  if (!Number.isFinite(value) || value <= 0) return null;

  const rounded = Math.floor(value);
  return `+${rounded} ${rounded === 1 ? "day" : "days"}`;
};

const addAfterWhenDays = (days: number) => {
  const currentValue =
    afterWhenValue.value === null || afterWhenValue.value === undefined
      ? 0
      : Number(afterWhenValue.value);
  const safeCurrent = Number.isFinite(currentValue)
    ? Math.max(0, Math.floor(currentValue))
    : 0;

  afterWhenValue.value = safeCurrent + days;
};

const createBlankStep = (): ToDoStep => {
  const now = new Date().toISOString();

  return {
    id: Date.now(),
    title: "",
    collaborators: [],
    dueAt: now,
    status: "pending",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
};

const addStep = () => {
  showNewDraft.value = true;
  newSearch.value = "";
  Object.assign(newDraft, createBlankStep());
};

const saveNewDraft = () => {
  if (!newDraft.title.trim()) return;

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
  stepDialogOpen.value = true;
};

const onStepDialogSave = (step: ToDoStep) => {
  const nextStep = cloneStep(step, stepDialogIndex.value ?? steps.value.length);
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

  try {
    return formatSystemDate(value);
  } catch {
    return value;
  }
};

const onSubmit = async () => {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const trimmedTitle = title.value.trim();
  const trimmedNotes = notes.value.trim();
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

  emit("save", {
    title: trimmedTitle,
    collaborators: selectedCollaborators.value,
    afterWhen: buildAfterWhen(),
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
      : null,
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
                    <div class="text-body-2 mb-2">After when</div>
                    <div class="after-when-control">
                      <AppTextField
                        v-model.number="afterWhenValue"
                        type="number"
                        min="1"
                        step="1"
                        hide-details="auto"
                        :rules="[requiredValidator]"
                        class="after-when-input"
                        suffix="days"
                      />

                      <div class="after-when-actions">
                        <VBtn
                          size="small"
                          variant="tonal"
                          @click="addAfterWhenDays(1)"
                        >
                          +1 day
                        </VBtn>
                        <VBtn
                          size="small"
                          variant="tonal"
                          @click="addAfterWhenDays(7)"
                        >
                          +1 week
                        </VBtn>
                        <VBtn
                          size="small"
                          variant="tonal"
                          @click="addAfterWhenDays(30)"
                        >
                          +1 month
                        </VBtn>
                      </div>
                    </div>
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
        <DialogActionBar @save="onSubmit" @cancel="closeDrawer" />
      </VCardActions>
    </VCard>

    <StepEditDialog
      v-model="stepDialogOpen"
      :step="stepDialogModel"
      :collaborators-options="collaboratorOptions"
      title="Edit Subtask"
      @save="onStepDialogSave"
      @close="closeStepDialog"
    />
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
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.after-when-input {
  flex: 0 0 110px;
}

.after-when-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
