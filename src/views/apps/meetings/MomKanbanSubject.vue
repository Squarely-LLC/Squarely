<script setup lang="ts">
import { animations, handleEnd, performTransfer } from "@formkit/drag-and-drop";
import { dragAndDrop } from "@formkit/drag-and-drop/vue";
import type { MeetingMomNote, MeetingMomSubject } from "@/data/schema";
import { getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { requiredValidator } from "@core/utils/validators";
import { VForm } from "vuetify/components/VForm";

type EmployeeOption = {
  title: string;
  value?: string | number;
  avatarUrl?: string | null;
};

type NoteDraft = {
  bodyHtml: string;
  bodyText: string;
  assignee: string;
  dueAt: string;
  createTask: boolean;
  collaboratorIds: Array<string | number>;
  attachments: MeetingMomNote["attachments"];
  links: MeetingMomNote["links"];
  internal: boolean;
  linkName: string;
  linkUrl: string;
};

type MomNoteSavePayload = {
  noteId?: string | number | null;
  subjectId: string | number;
  bodyHtml: string;
  assignee: string;
  dueAt: string | null;
  createTask: boolean;
  collaboratorIds: Array<string | number>;
  attachments: MeetingMomNote["attachments"];
  links: MeetingMomNote["links"];
  internal: boolean;
};

const props = withDefaults(
  defineProps<{
    subject: MeetingMomSubject;
    noteIds: Array<string | number>;
    notes: MeetingMomNote[];
    groupName: string;
    employeeOptions?: EmployeeOption[];
  }>(),
  {
    employeeOptions: () => [],
  },
);

const emit = defineEmits<{
  (e: "renameSubject", value: { subjectId: string | number; title: string }): void;
  (e: "deleteSubject", value: MeetingMomSubject): void;
  (e: "saveNote", value: MomNoteSavePayload): void;
  (e: "deleteNote", value: MeetingMomNote): void;
  (e: "toggleInternal", value: MeetingMomNote): void;
  (e: "toggleCreateTask", value: MeetingMomNote): void;
  (e: "updateNotesState", value: { subjectId: string | number; ids: Array<string | number> }): void;
}>();

const refDropZone = ref<HTMLElement>();
const refAddForm = ref<VForm>();
const refSubjectTitle = ref<VForm>();
const fileInput = ref<HTMLInputElement | null>(null);

const localIds = ref<Array<string | number>>([...props.noteIds]);
const localSubjectTitle = ref(props.subject.title);
const isAddNewFormVisible = ref(false);
const isSubjectNameEditing = ref(false);
const editingNoteId = ref<string | number | null>(null);
const imagePreviewUrls = ref<Record<string, string>>({});
const isCollaboratorPickerVisible = ref(false);
const isLinkEditorVisible = ref(false);

const emptyDraft = (): NoteDraft => ({
  bodyHtml: "",
  bodyText: "",
  assignee: "",
  dueAt: "",
  createTask: false,
  collaboratorIds: [],
  attachments: [],
  links: [],
  internal: false,
  linkName: "",
  linkUrl: "",
});

const draft = reactive<NoteDraft>(emptyDraft());

function sameOrder(
  left: Array<string | number>,
  right: Array<string | number>,
) {
  return (
    left.length === right.length &&
    left.every((id, index) => String(id) === String(right[index]))
  );
}

function emitNotesStateIfChanged() {
  if (sameOrder(localIds.value, props.noteIds)) return;
  emit("updateNotesState", {
    subjectId: props.subject.id,
    ids: [...localIds.value],
  });
}

const subjectActions = computed(() => [
  {
    title: "Rename",
    prependIcon: "tabler-pencil",
    disabled: Boolean(props.subject.locked),
    onClick: () => {
      if (!props.subject.locked) isSubjectNameEditing.value = true;
    },
  },
  {
    title: "Delete",
    prependIcon: "tabler-trash",
    disabled: Boolean(props.subject.locked),
    onClick: () => {
      if (!props.subject.locked) emit("deleteSubject", props.subject);
    },
  },
]);

dragAndDrop({
  parent: refDropZone,
  values: localIds,
  group: props.groupName,
  draggable: (child) => child.classList.contains("kanban-card"),
  plugins: [animations()],
  performTransfer: (state, data) => {
    performTransfer(state, data);
    emitNotesStateIfChanged();
  },
  handleEnd: (data) => {
    handleEnd(data);
    emitNotesStateIfChanged();
  },
});

watch(
  () => props.noteIds,
  () => {
    localIds.value = [...props.noteIds];
  },
  { immediate: true, deep: true },
);

watch(
  () => props.subject.title,
  () => {
    localSubjectTitle.value = props.subject.title;
  },
);

watch(
  () => props.notes,
  () => {
    void loadImagePreviews();
  },
  { immediate: true, deep: true },
);

function resolveNote(id: string | number) {
  return props.notes.find((note) => String(note.id) === String(id));
}

function stripHtml(html?: string) {
  const normalized = String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n");

  return normalized
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function noteText(note?: MeetingMomNote) {
  return stripHtml(note?.bodyHtml) || "Note";
}

function avatarText(name?: string | null) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function formatDueDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileLooksImage(nameOrUrl?: string | null) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(nameOrUrl || ""));
}

function firstImageAttachment(note?: MeetingMomNote) {
  return note?.attachments?.find((attachment) => {
    if (attachment.type !== "file") return false;
    return fileLooksImage(attachment.url || attachment.name || attachment.fileKey);
  });
}

async function loadImagePreviews() {
  const next: Record<string, string> = {};
  for (const note of props.notes) {
    const image = firstImageAttachment(note);
    if (!image) continue;
    if (image.url) {
      next[String(note.id)] = image.url;
      continue;
    }
    if (image.fileKey) {
      const url = await getFileObjectUrl(image.fileKey);
      if (url) next[String(note.id)] = url;
    }
  }
  imagePreviewUrls.value = next;
}

function resetDraft() {
  Object.assign(draft, emptyDraft());
}

function populateDraft(note: MeetingMomNote) {
  const bodyText = stripHtml(note.bodyHtml);
  Object.assign(draft, {
    bodyHtml: note.bodyHtml || "",
    bodyText,
    assignee: note.assignee || "",
    dueAt: note.dueAt || "",
    createTask: Boolean(note.createTask),
    collaboratorIds: (note.collaborators || []).map((item) => item.id),
    attachments: [...(note.attachments || [])],
    links: [...(note.links || [])],
    internal: Boolean(note.internal),
    linkName: "",
    linkUrl: "",
  });
}

function resetEditorChrome() {
  isCollaboratorPickerVisible.value = false;
  isLinkEditorVisible.value = false;
}

function openAddEditor() {
  editingNoteId.value = null;
  resetDraft();
  resetEditorChrome();
  isAddNewFormVisible.value = true;
}

function openEditEditor(note: MeetingMomNote) {
  editingNoteId.value = note.id;
  populateDraft(note);
  resetEditorChrome();
  isAddNewFormVisible.value = true;
}

function openCollaboratorsEditor(note: MeetingMomNote) {
  openEditEditor(note);
  isCollaboratorPickerVisible.value = true;
  nextTick(() => {
    const input = document.querySelector(
      `[data-mom-subject="${String(props.subject.id)}"] .mom-note-collaborators input`,
    ) as HTMLInputElement | null;
    input?.focus?.();
  });
}

function closeEditor() {
  isAddNewFormVisible.value = false;
  editingNoteId.value = null;
  resetEditorChrome();
  resetDraft();
  const resetValidation = (refAddForm.value as any)?.resetValidation;
  if (typeof resetValidation === "function") resetValidation();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br>");
  return `<p>${lines}</p>`;
}

function saveEditor() {
  const bodyText = draft.bodyText.trim();
  if (!bodyText) return;
  emit("saveNote", {
    noteId: editingNoteId.value,
    subjectId: props.subject.id,
    bodyHtml: textToHtml(bodyText),
    assignee: draft.assignee.trim(),
    dueAt: draft.dueAt || null,
    createTask: draft.createTask,
    collaboratorIds: [...draft.collaboratorIds],
    attachments: [...draft.attachments],
    links: [...draft.links],
    internal: draft.internal,
  });
  closeEditor();
}

function renameSubject() {
  if (props.subject.locked) return;
  refSubjectTitle.value?.validate().then((valid) => {
    if (!valid.valid) return;
    emit("renameSubject", {
      subjectId: props.subject.id,
      title: localSubjectTitle.value,
    });
    isSubjectNameEditing.value = false;
  });
}

function hideResetSubjectNameForm() {
  isSubjectNameEditing.value = false;
  localSubjectTitle.value = props.subject.title;
}

function addLink() {
  const url = draft.linkUrl.trim();
  if (!url) return;
  draft.links.push({
    type: "link",
    name: draft.linkName.trim() || url,
    url,
  });
  draft.linkName = "";
  draft.linkUrl = "";
  isLinkEditorVisible.value = false;
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const fileKey = await saveFile(file);
  draft.attachments.push({
    type: "file",
    name: file.name,
    fileKey,
  });
  input.value = "";
}

function removeAttachment(index: number) {
  draft.attachments.splice(index, 1);
}

function removeLink(index: number) {
  draft.links.splice(index, 1);
}

function selectedCollaboratorOptions() {
  const selected = new Set(draft.collaboratorIds.map(String));
  return props.employeeOptions.filter(
    (option) => option.value !== undefined && selected.has(String(option.value)),
  );
}

onClickOutside(refSubjectTitle, hideResetSubjectNameForm);
</script>

<template>
  <div class="kanban-board">
    <div class="kanban-board-header pb-4">
      <VForm
        v-if="isSubjectNameEditing"
        ref="refSubjectTitle"
        @submit.prevent="renameSubject"
      >
        <VTextField
          v-model="localSubjectTitle"
          autofocus
          variant="underlined"
          :rules="[requiredValidator]"
          hide-details
          class="border-0"
          @keydown.esc="hideResetSubjectNameForm"
        >
          <template #append-inner>
            <VIcon
              size="20"
              color="success"
              icon="tabler-check"
              class="me-1"
              @click="renameSubject"
            />
            <VIcon
              size="20"
              color="error"
              icon="tabler-x"
              @click="hideResetSubjectNameForm"
            />
          </template>
        </VTextField>
      </VForm>

      <div
        v-else
        class="d-flex align-center justify-space-between"
      >
        <h4 class="text-lg font-weight-medium text-truncate">
          {{ subject.title }}
        </h4>
        <div class="d-flex align-center">
          <VIcon
            v-if="!subject.locked"
            class="mom-subject-drag-handler"
            size="20"
            icon="tabler-arrows-move"
          />
          <MoreBtn
            size="28"
            icon-size="20"
            class="text-high-emphasis"
            :menu-list="subjectActions"
            item-props
          />
        </div>
      </div>
    </div>

    <div
      ref="refDropZone"
      class="kanban-board-drop-zone rounded d-flex flex-column gap-4"
      :class="localIds.length || isAddNewFormVisible ? 'mb-4' : ''"
      :data-mom-subject="String(subject.id)"
    >
      <div class="add-new-form">
        <h6
          v-if="!isAddNewFormVisible"
          class="text-base font-weight-regular cursor-pointer ms-4 mb-0"
          @click="openAddEditor"
        >
          <VIcon
            size="15"
            icon="tabler-plus"
          />
          Add New Item
        </h6>

        <VCard
          v-else-if="editingNoteId === null"
          class="mom-inline-editor-card"
        >
          <VCardText class="pa-3">
            <VForm
              ref="refAddForm"
              class="mom-inline-editor"
              validate-on="submit"
              @submit.prevent="saveEditor"
            >
              <div class="mom-editor-toolbar mb-2">
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="draft.createTask ? 'primary' : 'secondary'"
                  @click="draft.createTask = !draft.createTask"
                >
                  <VIcon
                    icon="tabler-list-check"
                    size="18"
                  />
                  <VTooltip activator="parent">Create Task</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="draft.internal ? 'warning' : 'secondary'"
                  @click="draft.internal = !draft.internal"
                >
                  <VIcon
                    icon="tabler-lock"
                    size="18"
                  />
                  <VTooltip activator="parent">Internal</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  color="secondary"
                  @click="fileInput?.click()"
                >
                  <VIcon
                    icon="tabler-paperclip"
                    size="18"
                  />
                  <VTooltip activator="parent">Attachment</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="isLinkEditorVisible ? 'primary' : 'secondary'"
                  @click="isLinkEditorVisible = !isLinkEditorVisible"
                >
                  <VIcon
                    icon="tabler-link"
                    size="18"
                  />
                  <VTooltip activator="parent">Attach Link</VTooltip>
                </VBtn>
                <input
                  ref="fileInput"
                  type="file"
                  class="d-none"
                  @change="onFilePicked"
                />
              </div>

              <VTextarea
                v-model="draft.bodyText"
                class="mom-bordered-field mom-note-textarea"
                placeholder="Write note..."
                auto-grow
                rows="2"
                hide-details
                @keydown.enter.exact.prevent="saveEditor"
              />

              <div class="mom-editor-meta-grid mt-3">
                <AppTextField
                  v-model="draft.assignee"
                  class="mom-bordered-field"
                  label="Assignee"
                  density="compact"
                  hide-details
                />
                <AppDateTimePicker
                  v-model="draft.dueAt"
                  class="mom-bordered-field"
                  label="Due"
                  placeholder="YYYY-MM-DD HH:mm"
                  density="compact"
                  hide-details
                  :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
                />
              </div>

              <div class="mom-editor-collabs mt-3">
                <div class="d-flex align-center min-w-0">
                  <div
                    v-if="selectedCollaboratorOptions().length"
                    class="v-avatar-group"
                  >
                    <VAvatar
                      v-for="collaborator in selectedCollaboratorOptions().slice(0, 4)"
                      :key="collaborator.value"
                      size="28"
                      color="primary"
                    >
                      <VImg
                        v-if="collaborator.avatarUrl"
                        :src="collaborator.avatarUrl"
                      />
                      <span v-else class="text-xs">{{ avatarText(collaborator.title) }}</span>
                      <VTooltip activator="parent">
                        {{ collaborator.title }}
                      </VTooltip>
                    </VAvatar>
                  </div>
                  <span v-else class="text-body-2 text-medium-emphasis">No collaborators</span>
                </div>
                <VBtn
                  icon
                  size="30"
                  variant="tonal"
                  color="secondary"
                  @click="isCollaboratorPickerVisible = !isCollaboratorPickerVisible"
                >
                  <VIcon
                    icon="tabler-plus"
                    size="18"
                  />
                  <VTooltip activator="parent">Add Collaborators</VTooltip>
                </VBtn>
              </div>

              <VExpandTransition>
                <div
                  v-if="isCollaboratorPickerVisible"
                  class="mt-3"
                >
                  <AppAutocomplete
                    v-model="draft.collaboratorIds"
                    class="mom-note-collaborators mom-bordered-field"
                    :items="employeeOptions"
                    item-title="title"
                    item-value="value"
                    label="Collaborators"
                    multiple
                    chips
                    closable-chips
                    density="compact"
                  />
                </div>
              </VExpandTransition>

              <VExpandTransition>
                <div
                  v-if="isLinkEditorVisible"
                  class="mom-link-row mt-3"
                >
                  <AppTextField
                    v-model="draft.linkName"
                    class="mom-bordered-field"
                    label="Link Name"
                    density="compact"
                    hide-details
                  />
                  <AppTextField
                    v-model="draft.linkUrl"
                    class="mom-bordered-field"
                    label="Link URL"
                    density="compact"
                    hide-details
                  />
                  <VBtn
                    variant="tonal"
                    icon
                    @click="addLink"
                  >
                    <VIcon icon="tabler-plus" />
                    <VTooltip activator="parent">Add Link</VTooltip>
                  </VBtn>
                </div>
              </VExpandTransition>

              <div
                v-if="draft.attachments.length || draft.links.length"
                class="mom-editor-pills mt-3"
              >
                <VChip
                  v-for="(attachment, index) in draft.attachments"
                  :key="`${attachment.name}-${attachment.fileKey}`"
                  size="small"
                  closable
                  @click:close="removeAttachment(index)"
                >
                  <VIcon
                    icon="tabler-paperclip"
                    start
                    size="14"
                  />
                  {{ attachment.name }}
                </VChip>
                <VChip
                  v-for="(link, index) in draft.links"
                  :key="`${link.name}-${link.url}`"
                  size="small"
                  closable
                  @click:close="removeLink(index)"
                >
                  <VIcon
                    icon="tabler-link"
                    start
                    size="14"
                  />
                  {{ link.name }}
                </VChip>
              </div>

              <div class="mom-editor-footer mt-3">
                <VBtn
                  size="small"
                  type="submit"
                >
                  Save
                </VBtn>
                <VBtn
                  size="small"
                  variant="tonal"
                  color="secondary"
                  @click="closeEditor"
                >
                  Cancel
                </VBtn>
              </div>
            </VForm>
          </VCardText>
        </VCard>
      </div>

      <template
        v-for="id in localIds"
        :key="id"
      >
        <VCard
          v-if="resolveNote(id) && String(editingNoteId) !== String(id)"
          class="kanban-card position-relative"
          :ripple="false"
          :link="false"
          @click="openEditEditor(resolveNote(id)!)"
        >
          <VCardText class="d-flex flex-column gap-3">
            <div class="d-flex align-start gap-2 pe-6">
              <div class="d-flex flex-wrap gap-2">
                <VChip
                  v-if="resolveNote(id)?.internal"
                  size="small"
                  color="warning"
                >
                  Internal
                </VChip>
                <VChip
                  v-if="resolveNote(id)?.createTask"
                  size="small"
                  color="primary"
                >
                  Task
                </VChip>
                <VChip
                  v-if="resolveNote(id)?.assignee"
                  size="small"
                  color="secondary"
                >
                  {{ resolveNote(id)?.assignee }}
                </VChip>
              </div>
              <VSpacer />
              <VMenu>
                <template #activator="{ props: p, isActive }">
                  <VIcon
                    v-bind="p"
                    icon="tabler-dots-vertical"
                    class="position-absolute more-options"
                    style="inset-block-start: 16px; inset-inline-end: 10px"
                    :style="isActive ? 'opacity: 1' : ''"
                    size="20"
                    @click.stop
                  />
                </template>
                <VList>
                  <VListItem @click.stop="emit('toggleInternal', resolveNote(id)!)">
                    <VListItemTitle>Mark Internal</VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="emit('toggleCreateTask', resolveNote(id)!)">
                    <VListItemTitle>
                      {{ resolveNote(id)?.createTask ? "Unmark as Task" : "Mark as Task" }}
                    </VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="openEditEditor(resolveNote(id)!)">
                    <VListItemTitle>Edit</VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="emit('deleteNote', resolveNote(id)!)">
                    <VListItemTitle>Delete</VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="openCollaboratorsEditor(resolveNote(id)!)">
                    <VListItemTitle>Add Collaborators</VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </div>

            <VImg
              v-if="imagePreviewUrls[String(id)]"
              :src="imagePreviewUrls[String(id)]"
              class="mom-note-preview-image"
              cover
            />

            <p class="text-base text-high-emphasis font-weight-medium mb-0 mom-note-preview">
              {{ noteText(resolveNote(id)) }}
            </p>

            <div class="task-footer d-flex align-center flex-wrap justify-space-between gap-2">
              <div class="d-flex align-center flex-wrap gap-3">
                <div v-if="resolveNote(id)?.attachments?.length">
                  <VIcon
                    size="18"
                    icon="tabler-paperclip"
                    class="me-1"
                  />
                  <span class="text-body-2 d-inline-block">{{ resolveNote(id)?.attachments?.length }}</span>
                </div>
                <div v-if="resolveNote(id)?.links?.length">
                  <VIcon
                    size="18"
                    icon="tabler-link"
                    class="me-1"
                  />
                  <span class="text-body-2 d-inline-block">{{ resolveNote(id)?.links?.length }}</span>
                </div>
                <div v-if="resolveNote(id)?.dueAt">
                  <VIcon
                    size="18"
                    icon="tabler-calendar"
                    class="me-1"
                  />
                  <span class="text-body-2 d-inline-block">{{ formatDueDate(resolveNote(id)?.dueAt) }}</span>
                </div>
              </div>

              <div
                v-if="resolveNote(id)?.collaborators?.length"
                class="v-avatar-group"
              >
                <VAvatar
                  v-for="collaborator in resolveNote(id)?.collaborators?.slice(0, 4)"
                  :key="collaborator.id"
                  size="30"
                  color="primary"
                >
                  <VImg
                    v-if="collaborator.avatarUrl"
                    :src="collaborator.avatarUrl"
                  />
                  <span v-else class="text-xs">{{ avatarText(collaborator.name) }}</span>
                  <VTooltip activator="parent">
                    {{ collaborator.name }}
                  </VTooltip>
                </VAvatar>
              </div>
            </div>
          </VCardText>
        </VCard>

        <VCard
          v-else-if="resolveNote(id) && String(editingNoteId) === String(id)"
          class="mom-inline-editor-card"
        >
          <VCardText class="pa-3">
            <VForm
              ref="refAddForm"
              class="mom-inline-editor"
              validate-on="submit"
              @submit.prevent="saveEditor"
            >
              <div class="mom-editor-toolbar mb-2">
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="draft.createTask ? 'primary' : 'secondary'"
                  @click="draft.createTask = !draft.createTask"
                >
                  <VIcon icon="tabler-list-check" size="18" />
                  <VTooltip activator="parent">Create Task</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="draft.internal ? 'warning' : 'secondary'"
                  @click="draft.internal = !draft.internal"
                >
                  <VIcon icon="tabler-lock" size="18" />
                  <VTooltip activator="parent">Internal</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  color="secondary"
                  @click="fileInput?.click()"
                >
                  <VIcon icon="tabler-paperclip" size="18" />
                  <VTooltip activator="parent">Attachment</VTooltip>
                </VBtn>
                <VBtn
                  icon
                  size="32"
                  variant="tonal"
                  :color="isLinkEditorVisible ? 'primary' : 'secondary'"
                  @click="isLinkEditorVisible = !isLinkEditorVisible"
                >
                  <VIcon icon="tabler-link" size="18" />
                  <VTooltip activator="parent">Attach Link</VTooltip>
                </VBtn>
                <input
                  ref="fileInput"
                  type="file"
                  class="d-none"
                  @change="onFilePicked"
                />
              </div>

              <VTextarea
                v-model="draft.bodyText"
                class="mom-bordered-field mom-note-textarea"
                placeholder="Write note..."
                auto-grow
                rows="2"
                hide-details
                @keydown.enter.exact.prevent="saveEditor"
              />

              <div class="mom-editor-meta-grid mt-3">
                <AppTextField
                  v-model="draft.assignee"
                  class="mom-bordered-field"
                  label="Assignee"
                  density="compact"
                  hide-details
                />
                <AppDateTimePicker
                  v-model="draft.dueAt"
                  class="mom-bordered-field"
                  label="Due"
                  placeholder="YYYY-MM-DD HH:mm"
                  density="compact"
                  hide-details
                  :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
                />
              </div>

              <div class="mom-editor-collabs mt-3">
                <div class="d-flex align-center min-w-0">
                  <div
                    v-if="selectedCollaboratorOptions().length"
                    class="v-avatar-group"
                  >
                    <VAvatar
                      v-for="collaborator in selectedCollaboratorOptions().slice(0, 4)"
                      :key="collaborator.value"
                      size="28"
                      color="primary"
                    >
                      <VImg
                        v-if="collaborator.avatarUrl"
                        :src="collaborator.avatarUrl"
                      />
                      <span v-else class="text-xs">{{ avatarText(collaborator.title) }}</span>
                      <VTooltip activator="parent">
                        {{ collaborator.title }}
                      </VTooltip>
                    </VAvatar>
                  </div>
                  <span v-else class="text-body-2 text-medium-emphasis">No collaborators</span>
                </div>
                <VBtn
                  icon
                  size="30"
                  variant="tonal"
                  color="secondary"
                  @click="isCollaboratorPickerVisible = !isCollaboratorPickerVisible"
                >
                  <VIcon
                    icon="tabler-plus"
                    size="18"
                  />
                  <VTooltip activator="parent">Add Collaborators</VTooltip>
                </VBtn>
              </div>

              <VExpandTransition>
                <div
                  v-if="isCollaboratorPickerVisible"
                  class="mt-3"
                >
                  <AppAutocomplete
                    v-model="draft.collaboratorIds"
                    class="mom-note-collaborators mom-bordered-field"
                    :items="employeeOptions"
                    item-title="title"
                    item-value="value"
                    label="Collaborators"
                    multiple
                    chips
                    closable-chips
                    density="compact"
                  />
                </div>
              </VExpandTransition>

              <VExpandTransition>
                <div
                  v-if="isLinkEditorVisible"
                  class="mom-link-row mt-3"
                >
                  <AppTextField
                    v-model="draft.linkName"
                    class="mom-bordered-field"
                    label="Link Name"
                    density="compact"
                    hide-details
                  />
                  <AppTextField
                    v-model="draft.linkUrl"
                    class="mom-bordered-field"
                    label="Link URL"
                    density="compact"
                    hide-details
                  />
                  <VBtn
                    variant="tonal"
                    icon
                    @click="addLink"
                  >
                    <VIcon icon="tabler-plus" />
                    <VTooltip activator="parent">Add Link</VTooltip>
                  </VBtn>
                </div>
              </VExpandTransition>

              <div
                v-if="draft.attachments.length || draft.links.length"
                class="mom-editor-pills mt-3"
              >
                <VChip
                  v-for="(attachment, index) in draft.attachments"
                  :key="`${attachment.name}-${attachment.fileKey}`"
                  size="small"
                  closable
                  @click:close="removeAttachment(index)"
                >
                  <VIcon
                    icon="tabler-paperclip"
                    start
                    size="14"
                  />
                  {{ attachment.name }}
                </VChip>
                <VChip
                  v-for="(link, index) in draft.links"
                  :key="`${link.name}-${link.url}`"
                  size="small"
                  closable
                  @click:close="removeLink(index)"
                >
                  <VIcon
                    icon="tabler-link"
                    start
                    size="14"
                  />
                  {{ link.name }}
                </VChip>
              </div>

              <div class="mom-editor-footer mt-3">
                <VBtn
                  size="small"
                  type="submit"
                >
                  Save
                </VBtn>
                <VBtn
                  size="small"
                  variant="tonal"
                  color="secondary"
                  @click="closeEditor"
                >
                  Cancel
                </VBtn>
              </div>
            </VForm>
          </VCardText>
        </VCard>
      </template>

    </div>
  </div>
</template>

<style lang="scss" scoped>
.kanban-board-header {
  .mom-subject-drag-handler {
    cursor: grab;
    opacity: 0;

    &:active {
      cursor: grabbing;
    }
  }

  &:hover {
    .mom-subject-drag-handler {
      opacity: 1;
    }
  }
}

.kanban-card {
  cursor: grab;

  :active {
    cursor: grabbing;
  }

  &[style^="z-index"] {
    cursor: grabbing !important;
  }

  .more-options {
    opacity: 1;
  }
}

.mom-note-preview-image {
  overflow: hidden;
  border-radius: 6px;
  block-size: 12rem;
}

.mom-note-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.mom-note-preview {
  -webkit-line-clamp: 3;
}

.mom-inline-editor-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.mom-inline-editor {
  display: grid;
  gap: 0;
}

.mom-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.mom-note-textarea :deep(textarea) {
  line-height: 1.45;
  min-block-size: 5.25rem;
}

.mom-editor-meta-grid,
.mom-link-row {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.mom-link-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
}

.mom-editor-collabs,
.mom-editor-footer,
.mom-editor-pills {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mom-editor-collabs {
  justify-content: space-between;
}

.mom-editor-footer {
  position: sticky;
  z-index: 1;
  justify-content: flex-end;
  border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  inset-block-end: 0;
  padding-block-start: 0.75rem;
}

.mom-editor-pills {
  flex-wrap: wrap;
}

.mom-bordered-field :deep(.v-field) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
}

@media (max-width: 520px) {
  .mom-editor-meta-grid,
  .mom-link-row {
    grid-template-columns: 1fr;
  }

  .mom-link-row {
    align-items: start;
  }
}
</style>
