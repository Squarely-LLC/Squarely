<script setup lang="ts">
import { animations, handleEnd, performTransfer } from "@formkit/drag-and-drop";
import { dragAndDrop } from "@formkit/drag-and-drop/vue";
import type { MeetingMomNote, MeetingMomSubject } from "@/data/schema";
import { requiredValidator } from "@core/utils/validators";
import { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  subject: MeetingMomSubject;
  noteIds: Array<string | number>;
  notes: MeetingMomNote[];
  groupName: string;
}>();

const emit = defineEmits<{
  (e: "renameSubject", value: { subjectId: string | number; title: string }): void;
  (e: "deleteSubject", value: MeetingMomSubject): void;
  (e: "addNote", value: { subjectId: string | number; title: string }): void;
  (e: "editNote", value: MeetingMomNote): void;
  (e: "deleteNote", value: MeetingMomNote): void;
  (e: "toggleInternal", value: MeetingMomNote): void;
  (e: "addCollaborators", value: MeetingMomNote): void;
  (e: "updateNotesState", value: { subjectId: string | number; ids: Array<string | number> }): void;
}>();

const refDropZone = ref<HTMLElement>();
const refAddForm = ref<VForm>();
const refSubjectTitle = ref<VForm>();

const localIds = ref<Array<string | number>>([...props.noteIds]);
const localSubjectTitle = ref(props.subject.title);
const isAddNewFormVisible = ref(false);
const isSubjectNameEditing = ref(false);
const newNoteTitle = ref("");

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
    emit("updateNotesState", { subjectId: props.subject.id, ids: [...localIds.value] });
  },
  handleEnd: (data) => {
    handleEnd(data);
    emit("updateNotesState", { subjectId: props.subject.id, ids: [...localIds.value] });
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

function resolveNote(id: string | number) {
  return props.notes.find((note) => String(note.id) === String(id));
}

function noteText(note?: MeetingMomNote) {
  if (!note?.bodyHtml) return "Note";
  return note.bodyHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Note";
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

function addNewNote() {
  refAddForm.value?.validate().then((valid) => {
    if (!valid.valid) return;
    emit("addNote", {
      subjectId: props.subject.id,
      title: newNoteTitle.value,
    });
    isAddNewFormVisible.value = false;
    newNoteTitle.value = "";
  });
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

function hideAddNewForm() {
  isAddNewFormVisible.value = false;
  refAddForm.value?.reset();
}

function hideResetSubjectNameForm() {
  isSubjectNameEditing.value = false;
  localSubjectTitle.value = props.subject.title;
}

function handleEnterKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    addNewNote();
  }
}

onClickOutside(refAddForm, hideAddNewForm);
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
      :class="localIds.length ? 'mb-4' : ''"
    >
      <template
        v-for="id in localIds"
        :key="id"
      >
        <VCard
          v-if="resolveNote(id)"
          class="kanban-card position-relative"
          :ripple="false"
          :link="false"
          @click="emit('editNote', resolveNote(id)!)"
        >
          <VCardText class="d-flex flex-column gap-2">
            <div class="d-flex align-start gap-2">
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
                  <VListItem @click.stop="emit('editNote', resolveNote(id)!)">
                    <VListItemTitle>Edit</VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="emit('deleteNote', resolveNote(id)!)">
                    <VListItemTitle>Delete</VListItemTitle>
                  </VListItem>
                  <VListItem @click.stop="emit('addCollaborators', resolveNote(id)!)">
                    <VListItemTitle>Add Collaborators</VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </div>

            <p class="text-base text-high-emphasis mb-0">
              {{ noteText(resolveNote(id)) }}
            </p>

            <div class="task-footer d-flex align-center flex-wrap justify-space-between">
              <div class="d-flex align-center gap-4">
                <div v-if="(resolveNote(id)?.attachments?.length || 0) + (resolveNote(id)?.links?.length || 0)">
                  <VIcon
                    size="20"
                    icon="tabler-paperclip"
                    class="me-1"
                  />
                  <span class="text-body-1 d-inline-block">
                    {{ (resolveNote(id)?.attachments?.length || 0) + (resolveNote(id)?.links?.length || 0) }}
                  </span>
                </div>
                <div v-if="resolveNote(id)?.dueAt">
                  <VIcon
                    size="20"
                    icon="tabler-calendar"
                    class="me-1"
                  />
                  <span class="text-body-1 d-inline-block">{{ resolveNote(id)?.dueAt }}</span>
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
      </template>

      <div class="add-new-form">
        <h6
          class="text-base font-weight-regular cursor-pointer ms-4"
          @click="isAddNewFormVisible = !isAddNewFormVisible"
        >
          <VIcon
            size="15"
            icon="tabler-plus"
          />
          Add New Item
        </h6>

        <VForm
          v-if="isAddNewFormVisible"
          ref="refAddForm"
          class="mt-4"
          validate-on="submit"
          @submit.prevent="addNewNote"
        >
          <div class="mb-4">
            <VTextarea
              v-model="newNoteTitle"
              :rules="[requiredValidator]"
              placeholder="Add Content"
              autofocus
              rows="2"
              @keydown.enter="handleEnterKeydown"
              @keydown.esc="hideAddNewForm"
            />
          </div>
          <div class="d-flex gap-4 flex-wrap">
            <VBtn
              size="small"
              type="submit"
            >
              Add
            </VBtn>
            <VBtn
              size="small"
              variant="tonal"
              color="secondary"
              @click="hideAddNewForm"
            >
              Cancel
            </VBtn>
          </div>
        </VForm>
      </div>
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
    opacity: 0;
  }

  &:hover .more-options {
    opacity: 1;
  }
}
</style>
