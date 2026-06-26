<script setup lang="ts">
import { animations, remapNodes } from "@formkit/drag-and-drop";
import { dragAndDrop } from "@formkit/drag-and-drop/vue";
import type { MeetingMomNote, MeetingMomSubject } from "@/data/schema";
import MomKanbanSubject from "@/views/apps/meetings/MomKanbanSubject.vue";
import { requiredValidator } from "@core/utils/validators";
import { VForm } from "vuetify/components/VForm";

type EmployeeOption = {
  title: string;
  value?: string | number;
  avatarUrl?: string | null;
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
    subjects: MeetingMomSubject[];
    notes: MeetingMomNote[];
    employeeOptions?: EmployeeOption[];
    groupName?: string;
  }>(),
  {
    groupName: "meeting-mom",
    employeeOptions: () => [],
  },
);

const emit = defineEmits<{
  (e: "addSubject", value: string): void;
  (e: "renameSubject", value: { subjectId: string | number; title: string }): void;
  (e: "deleteSubject", value: MeetingMomSubject): void;
  (e: "saveNote", value: MomNoteSavePayload): void;
  (e: "deleteNote", value: MeetingMomNote): void;
  (e: "toggleInternal", value: MeetingMomNote): void;
  (e: "toggleCreateTask", value: MeetingMomNote): void;
  (e: "updateSubjectOrder", value: Array<string | number>): void;
  (e: "updateNotesState", value: { subjectId: string | number; ids: Array<string | number> }): void;
}>();

const boardWrapper = ref<HTMLElement>();
const topScroll = ref<HTMLElement>();
const bottomScroll = ref<HTMLElement>();
const scrollContentWidth = ref(0);
const refAddSubject = ref<VForm>();
const localSubjects = ref<MeetingMomSubject[]>([]);
const isAddNewFormVisible = ref(false);
const activeEditorKey = ref<string | null>(null);
const isNoteEditorOpen = computed(() => Boolean(activeEditorKey.value));
const subjectTitle = ref("");
let resizeObserver: ResizeObserver | null = null;

function sameOrder(
  left: Array<string | number>,
  right: Array<string | number>,
) {
  return (
    left.length === right.length &&
    left.every((id, index) => String(id) === String(right[index]))
  );
}

function pinDefault(subjects: MeetingMomSubject[]) {
  const defaultSubject = subjects.find((subject) => String(subject.id) === "default");
  const rest = subjects.filter((subject) => String(subject.id) !== "default");
  return defaultSubject ? [defaultSubject, ...rest] : subjects;
}

dragAndDrop({
  parent: boardWrapper,
  values: localSubjects,
  dragHandle: ".mom-subject-drag-handler",
  draggable: (child) => !isNoteEditorOpen.value && child.classList.contains("kanban-board"),
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
    if (isNoteEditorOpen.value) return;
    const pinned = pinDefault([...localSubjects.value]);
    const changed = pinned.some((subject, index) => subject.id !== localSubjects.value[index]?.id);
    if (changed) {
      localSubjects.value = pinned;
      return;
    }
    const nextIds = pinned.map((subject) => subject.id);
    const propIds = pinDefault([...props.subjects]).map((subject) => subject.id);
    if (sameOrder(nextIds, propIds)) return;
    emit(
      "updateSubjectOrder",
      nextIds,
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
  if (isNoteEditorOpen.value) return;
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

function requestNoteEditor(key: string) {
  if (activeEditorKey.value && activeEditorKey.value !== key) return false;
  activeEditorKey.value = key;
  return true;
}

function releaseNoteEditor(key: string) {
  if (activeEditorKey.value === key) activeEditorKey.value = null;
}

function updateScrollContentWidth() {
  scrollContentWidth.value = bottomScroll.value?.scrollWidth || 0;
}

const hasHorizontalOverflow = computed(() => {
  const bottom = bottomScroll.value;
  if (!bottom) return false;
  return scrollContentWidth.value > bottom.clientWidth + 1;
});

function syncScroll(source: "top" | "bottom") {
  const top = topScroll.value;
  const bottom = bottomScroll.value;
  if (!top || !bottom) return;
  if (source === "top" && bottom.scrollLeft !== top.scrollLeft)
    bottom.scrollLeft = top.scrollLeft;
  if (source === "bottom" && top.scrollLeft !== bottom.scrollLeft)
    top.scrollLeft = bottom.scrollLeft;
}

onMounted(() => {
  nextTick(updateScrollContentWidth);
  resizeObserver = new ResizeObserver(updateScrollContentWidth);
  if (bottomScroll.value) resizeObserver.observe(bottomScroll.value);
  if (boardWrapper.value) resizeObserver.observe(boardWrapper.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

onClickOutside(refAddSubject, hideAddNewForm);
</script>

<template>
  <div
    v-show="hasHorizontalOverflow"
    ref="topScroll"
    class="mom-kanban-top-scroll"
    @scroll="syncScroll('top')"
  >
    <div :style="{ inlineSize: `${scrollContentWidth}px` }" />
  </div>

  <div
    ref="bottomScroll"
    class="mom-kanban-main-wrapper kanban-main-wrapper d-flex gap-4 h-100"
    :class="{ 'mom-kanban-main-wrapper--locked': isNoteEditorOpen }"
    @scroll="syncScroll('bottom')"
  >
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
          :employee-options="employeeOptions"
          :drag-disabled="isNoteEditorOpen"
          :board-locked="isNoteEditorOpen"
          :request-editor-open="requestNoteEditor"
          :release-editor="releaseNoteEditor"
          @rename-subject="emit('renameSubject', $event)"
          @delete-subject="emit('deleteSubject', $event)"
          @save-note="emit('saveNote', $event)"
          @delete-note="emit('deleteNote', $event)"
          @toggle-internal="emit('toggleInternal', $event)"
          @toggle-create-task="emit('toggleCreateTask', $event)"
          @update-notes-state="emit('updateNotesState', $event)"
        />
      </template>
    </div>

    <div
      v-if="!isNoteEditorOpen"
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
    .v-field {
      border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
      border-radius: vuetify.$border-radius-root;
    }

    .v-field__field {
      border-radius: vuetify.$border-radius-root;
      background-color: rgb(var(--v-theme-surface));
    }
  }
}

.mom-kanban-main-wrapper--locked {
  .mom-subject-drag-handler {
    pointer-events: none;
    opacity: 0 !important;
  }
}

.mom-kanban-top-scroll {
  overflow: auto hidden;
  block-size: 14px;
  margin-block-end: 0.75rem;

  > div {
    block-size: 1px;
  }
}

.mom-kanban-main-wrapper,
.mom-kanban-top-scroll {
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.35) transparent;
  scrollbar-width: thin;
}

.mom-kanban-main-wrapper::-webkit-scrollbar,
.mom-kanban-top-scroll::-webkit-scrollbar {
  block-size: 8px;
  inline-size: 8px;
}

.mom-kanban-main-wrapper::-webkit-scrollbar-thumb,
.mom-kanban-top-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: rgba(var(--v-theme-on-surface), 0.28);
}

.mom-kanban-main-wrapper::-webkit-scrollbar-track,
.mom-kanban-top-scroll::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
