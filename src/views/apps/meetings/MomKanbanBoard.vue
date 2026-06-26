<script setup lang="ts">
import { animations, remapNodes } from "@formkit/drag-and-drop";
import { dragAndDrop } from "@formkit/drag-and-drop/vue";
import type { MeetingMomNote, MeetingMomSubject } from "@/data/schema";
import MomKanbanSubject from "@/views/apps/meetings/MomKanbanSubject.vue";
import { requiredValidator } from "@core/utils/validators";
import { VForm } from "vuetify/components/VForm";

const props = withDefaults(
  defineProps<{
    subjects: MeetingMomSubject[];
    notes: MeetingMomNote[];
    groupName?: string;
  }>(),
  {
    groupName: "meeting-mom",
  },
);

const emit = defineEmits<{
  (e: "addSubject", value: string): void;
  (e: "renameSubject", value: { subjectId: string | number; title: string }): void;
  (e: "deleteSubject", value: MeetingMomSubject): void;
  (e: "addNote", value: { subjectId: string | number; title: string }): void;
  (e: "editNote", value: MeetingMomNote): void;
  (e: "deleteNote", value: MeetingMomNote): void;
  (e: "toggleInternal", value: MeetingMomNote): void;
  (e: "addCollaborators", value: MeetingMomNote): void;
  (e: "updateSubjectOrder", value: Array<string | number>): void;
  (e: "updateNotesState", value: { subjectId: string | number; ids: Array<string | number> }): void;
}>();

const boardWrapper = ref<HTMLElement>();
const refAddSubject = ref<VForm>();
const localSubjects = ref<MeetingMomSubject[]>([]);
const isAddNewFormVisible = ref(false);
const subjectTitle = ref("");

function pinDefault(subjects: MeetingMomSubject[]) {
  const defaultSubject = subjects.find((subject) => String(subject.id) === "default");
  const rest = subjects.filter((subject) => String(subject.id) !== "default");
  return defaultSubject ? [defaultSubject, ...rest] : subjects;
}

dragAndDrop({
  parent: boardWrapper,
  values: localSubjects,
  dragHandle: ".mom-subject-drag-handler",
  plugins: [animations()],
});

watch(
  () => props.subjects,
  () => {
    localSubjects.value = pinDefault([...props.subjects]);
    if (boardWrapper.value) remapNodes(boardWrapper.value as any);
  },
  { deep: true, immediate: true },
);

watch(
  localSubjects,
  () => {
    const pinned = pinDefault([...localSubjects.value]);
    const changed = pinned.some((subject, index) => subject.id !== localSubjects.value[index]?.id);
    if (changed) {
      localSubjects.value = pinned;
      return;
    }
    emit(
      "updateSubjectOrder",
      pinned.map((subject) => subject.id),
    );
  },
  { deep: true },
);

function noteIdsForSubject(subject: MeetingMomSubject) {
  const explicit = Array.isArray(subject.noteIds) ? subject.noteIds : [];
  const explicitSet = new Set(explicit.map(String));
  const extras = props.notes
    .filter(
      (note) =>
        String(note.subjectId) === String(subject.id) &&
        !explicitSet.has(String(note.id)),
    )
    .map((note) => note.id);
  return [...explicit, ...extras];
}

function addNewSubject() {
  refAddSubject.value?.validate().then((valid) => {
    if (!valid.valid) return;
    emit("addSubject", subjectTitle.value);
    isAddNewFormVisible.value = false;
    subjectTitle.value = "";
  });
}

function hideAddNewForm() {
  isAddNewFormVisible.value = false;
  refAddSubject.value?.reset();
}

onClickOutside(refAddSubject, hideAddNewForm);
</script>

<template>
  <div class="mom-kanban-main-wrapper kanban-main-wrapper d-flex gap-4 h-100">
    <div
      ref="boardWrapper"
      class="d-flex ga-6"
    >
      <template
        v-for="subject in localSubjects"
        :key="subject.id"
      >
        <MomKanbanSubject
          :group-name="groupName"
          :subject="subject"
          :note-ids="noteIdsForSubject(subject)"
          :notes="notes"
          @rename-subject="emit('renameSubject', $event)"
          @delete-subject="emit('deleteSubject', $event)"
          @add-note="emit('addNote', $event)"
          @edit-note="emit('editNote', $event)"
          @delete-note="emit('deleteNote', $event)"
          @toggle-internal="emit('toggleInternal', $event)"
          @add-collaborators="emit('addCollaborators', $event)"
          @update-notes-state="emit('updateNotesState', $event)"
        />
      </template>
    </div>

    <div
      class="add-new-form text-no-wrap"
      style="inline-size: 10rem"
    >
      <h6
        class="text-lg font-weight-medium cursor-pointer"
        @click="isAddNewFormVisible = !isAddNewFormVisible"
      >
        <VIcon
          size="18"
          icon="tabler-plus"
        />
        Add New
      </h6>

      <VForm
        v-if="isAddNewFormVisible"
        ref="refAddSubject"
        class="mt-4"
        validate-on="submit"
        @submit.prevent="addNewSubject"
      >
        <div class="mb-4">
          <VTextField
            v-model="subjectTitle"
            :rules="[requiredValidator]"
            autofocus
            placeholder="Add Subject Title"
            @keydown.esc="hideAddNewForm"
          />
        </div>
        <div class="d-flex gap-3">
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
</template>

<style lang="scss">
@use "@styles/variables/_vuetify.scss" as vuetify;

.mom-kanban-main-wrapper {
  overflow: auto hidden;
  margin-inline-start: -0.6rem;
  min-block-size: calc(100vh - 20rem);
  padding-inline-start: 0.6rem;

  .kanban-board {
    inline-size: 16.875rem;
    min-inline-size: 16.875rem;

    .kanban-board-drop-zone {
      min-block-size: 100%;
    }
  }

  .add-new-form {
    .v-field__field {
      border-radius: vuetify.$border-radius-root;
      background-color: rgb(var(--v-theme-surface));
    }
  }
}
</style>
