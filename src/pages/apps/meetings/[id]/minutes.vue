<script setup lang="ts">
import type {
  ContactRef,
  Meeting,
  MeetingMom,
  MeetingMomNote,
  MeetingMomSubject,
  MeetingSentiment,
} from "@/data/schema";
import { useDealsStore } from "@/stores/deals";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { getEmployeeRefs } from "@/utils/peopleOptions";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import MomKanbanBoard from "@/views/apps/meetings/MomKanbanBoard.vue";
import { formatSystemDate, formatSystemDateTime } from "@core/utils/formatters";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const todosStore = useTodos();
const notifications = useNotificationsStore();
const dealsStore = useDealsStore();
const jobsStore = useJobsStore();

todosStore.init();
dealsStore.init();
jobsStore.init();

const meetingId = computed(() => String(route.params.id || ""));
const meeting = computed(() => todosStore.meetingById(meetingId.value) as Meeting | null);
const emailDialog = ref<InstanceType<typeof EmailDialog> | null>(null);

const DEFAULT_SUBJECT_ID = "default";

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

const sentimentOptions = [
  { title: "Very Poor", value: "very_poor" },
  { title: "Poor", value: "poor" },
  { title: "Acceptable", value: "acceptable" },
  { title: "Good", value: "good" },
  { title: "Very Good", value: "very_good" },
] as const;

const employeeOptions = computed(() => getEmployeeRefs());

const completeDialog = reactive({
  open: false,
  sentiment: "good" as MeetingSentiment,
  duration: "00:30",
});

const deleteDialog = ref(false);

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function cloneMom(source?: MeetingMom | null): MeetingMom {
  const now = nowIso();
  const subjects = Array.isArray(source?.subjects)
    ? source!.subjects.map((subject) => ({
        ...subject,
        noteIds: Array.isArray(subject.noteIds) ? [...subject.noteIds] : [],
      }))
    : [];

  if (!subjects.some((subject) => String(subject.id) === DEFAULT_SUBJECT_ID)) {
    subjects.unshift({
      id: DEFAULT_SUBJECT_ID,
      title: "Default",
      noteIds: [],
      locked: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    subjects: subjects.map((subject, index) => ({
      ...subject,
      title: index === 0 || String(subject.id) === DEFAULT_SUBJECT_ID ? "Default" : subject.title,
      locked: index === 0 || String(subject.id) === DEFAULT_SUBJECT_ID ? true : subject.locked,
    })),
    notes: Array.isArray(source?.notes)
      ? source!.notes.map((note) => ({
          ...note,
          collaborators: Array.isArray(note.collaborators) ? [...note.collaborators] : [],
          attachments: Array.isArray(note.attachments) ? [...note.attachments] : [],
          links: Array.isArray(note.links) ? [...note.links] : [],
        }))
      : [],
    summaryHtml: source?.summaryHtml || "",
    summaryTouched: Boolean(source?.summaryTouched),
    durationSeconds: source?.durationSeconds ?? null,
    completedAt: source?.completedAt || null,
    cancelledAt: source?.cancelledAt || null,
    sentiment: source?.sentiment || null,
    attendance: { ...(source?.attendance || {}) },
  };
}

function persistMom(nextMom: MeetingMom, patch: Partial<Meeting> = {}) {
  if (!meeting.value) return;
  todosStore.updateMeeting(meeting.value.id, { ...patch, mom: nextMom }, { system: true });
}

const mom = computed(() => cloneMom(meeting.value?.mom));
const subjects = computed(() => mom.value.subjects);
const notes = computed(() => mom.value.notes);

const relatedRecords = computed(() => {
  const records = Array.isArray((meeting.value as any)?.relatedToMany)
    ? [...((meeting.value as any).relatedToMany as any[])]
    : [];
  if (meeting.value?.relatedTo) records.unshift(meeting.value.relatedTo);
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record?.type}:${record?.id}`;
    if (!record?.id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const relatedOptions = computed(() => [
  ...jobsStore.all.map((job: any) => ({
    title: `Job: ${job.code || job.name || job.id}`,
    value: `job:${job.id}`,
    raw: { id: job.id, name: job.name || job.code || `Job #${job.id}`, type: "job" },
  })),
  ...dealsStore.all.map((deal: any) => ({
    title: `Deal: ${deal.code || deal.name || deal.id}`,
    value: `deal:${deal.id}`,
    raw: { id: deal.id, name: deal.name || deal.code || `Deal #${deal.id}`, type: "deal" },
  })),
]);

const selectedRelatedKeys = computed(() =>
  relatedRecords.value.map((record) => `${record.type}:${record.id}`),
);

function updateRelatedRecords(keys: Array<string | number>) {
  if (!meeting.value) return;
  const selected = new Set(keys.map(String));
  const records = relatedOptions.value
    .filter((option) => selected.has(option.value))
    .map((option) => option.raw);

  todosStore.updateMeeting(
    meeting.value.id,
    {
      relatedTo: records[0] || null,
      relatedToMany: records,
    },
    { system: true },
  );
}

const attendees = computed<ContactRef[]>(() => {
  const all = [
    ...(Array.isArray(meeting.value?.linkedTo) ? meeting.value!.linkedTo : []),
    meeting.value?.requestedBy,
  ].filter(Boolean) as ContactRef[];
  const seen = new Set<string>();
  return all.filter((attendee) => {
    const key = String(attendee.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const effectiveStatus = computed(() => {
  const raw = meeting.value?.status || "scheduled";
  if (raw === "completed" || raw === "canceled" || raw === "postponed") return raw;
  const start = meeting.value?.startAt ? new Date(meeting.value.startAt).getTime() : NaN;
  if (Number.isFinite(start) && start < Date.now()) return "missed";
  return "scheduled";
});

const statusLabel = computed(() => {
  if (effectiveStatus.value === "postponed")
    return `Postponed (${Number(meeting.value?.postponedCount || 0)})`;
  return {
    scheduled: "Scheduled",
    canceled: "Canceled",
    completed: "Completed",
    missed: "Missed",
  }[effectiveStatus.value] || "Scheduled";
});

function statusColor(status = effectiveStatus.value) {
  if (status === "completed") return "success";
  if (status === "canceled") return "error";
  if (status === "postponed") return "warning";
  if (status === "missed") return "secondary";
  return "primary";
}

function notesForSubject(subjectId: string | number) {
  const orderedIds =
    subjects.value.find((subject) => String(subject.id) === String(subjectId))?.noteIds || [];
  const byId = new Map(notes.value.map((note) => [String(note.id), note]));
  const ordered = orderedIds.map((id) => byId.get(String(id))).filter(Boolean) as MeetingMomNote[];
  const extras = notes.value.filter(
    (note) =>
      String(note.subjectId) === String(subjectId) &&
      !orderedIds.some((id) => String(id) === String(note.id)),
  );
  return [...ordered, ...extras];
}

function stripHtml(html?: string) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || div.innerText || "").trim();
}

function autoSummary(nextMom = mom.value) {
  return nextMom.subjects
    .map((subject) => {
      const subjectNotes = nextMom.notes.filter((note) => String(note.subjectId) === String(subject.id));
      if (!subjectNotes.length) return "";
      const list = subjectNotes
        .map((note) => `<li>${stripHtml(note.bodyHtml) || "Note"}</li>`)
        .join("");
      return `<h3>${subject.title}</h3><ul>${list}</ul>`;
    })
    .filter(Boolean)
    .join("");
}

function syncSummary(nextMom: MeetingMom) {
  if (!nextMom.summaryTouched) nextMom.summaryHtml = autoSummary(nextMom);
  return nextMom;
}

function updateSummary(summaryHtml: string) {
  const nextMom = cloneMom(mom.value);
  nextMom.summaryHtml = summaryHtml;
  nextMom.summaryTouched = true;
  persistMom(nextMom);
}

function parseMmSs(value: string) {
  const [mins = "0", secs = "0"] = String(value || "").split(":");
  const total = Number(mins) * 60 + Number(secs);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

function formatMmSs(seconds?: number | null) {
  const total = Math.max(0, Number(seconds || 0));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function parseHhMm(value: string) {
  const [hours = "0", mins = "0"] = String(value || "").split(":");
  const total = Number(hours) * 3600 + Number(mins) * 60;
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

function formatHhMm(minutes?: number | null) {
  const total = Math.max(0, Number(minutes || 0));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function onDurationChange(value: string) {
  const nextMom = cloneMom(mom.value);
  nextMom.durationSeconds = parseMmSs(value);
  persistMom(nextMom);
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

function addSubject(titleValue: string) {
  const title = titleValue.trim();
  if (!title) return;
  const nextMom = cloneMom(mom.value);
  const now = nowIso();
  nextMom.subjects.push({
    id: makeId("subject"),
    title,
    noteIds: [],
    createdAt: now,
    updatedAt: now,
  });
  persistMom(syncSummary(nextMom));
}

function renameSubject(payload: { subjectId: string | number; title: string }) {
  const subject = subjects.value.find(
    (item) => String(item.id) === String(payload.subjectId),
  );
  if (!subject || subject.locked) return;
  const title = payload.title.trim();
  if (!title) return;
  const nextMom = cloneMom(mom.value);
  nextMom.subjects = nextMom.subjects.map((item) =>
    String(item.id) === String(subject.id) ? { ...item, title, updatedAt: nowIso() } : item,
  );
  persistMom(syncSummary(nextMom));
}

function removeSubject(subject: MeetingMomSubject) {
  if (subject.locked) return;
  const nextMom = cloneMom(mom.value);
  nextMom.subjects = nextMom.subjects.filter((item) => String(item.id) !== String(subject.id));
  nextMom.notes = nextMom.notes.map((note) =>
    String(note.subjectId) === String(subject.id) ? { ...note, subjectId: DEFAULT_SUBJECT_ID } : note,
  );
  const defaultSubject = nextMom.subjects.find((item) => String(item.id) === DEFAULT_SUBJECT_ID);
  if (defaultSubject) {
    defaultSubject.noteIds = nextMom.notes
      .filter((note) => String(note.subjectId) === DEFAULT_SUBJECT_ID)
      .map((note) => note.id);
  }
  persistMom(syncSummary(nextMom));
}

function updateSubjectOrder(ids: Array<string | number>) {
  const nextMom = cloneMom(mom.value);
  const byId = new Map(nextMom.subjects.map((subject) => [String(subject.id), subject]));
  const defaultSubject = nextMom.subjects.find((subject) => String(subject.id) === DEFAULT_SUBJECT_ID);
  const ordered = ids
    .filter((id) => String(id) !== DEFAULT_SUBJECT_ID)
    .map((id) => byId.get(String(id)))
    .filter(Boolean) as MeetingMomSubject[];
  const missing = nextMom.subjects.filter(
    (subject) =>
      String(subject.id) !== DEFAULT_SUBJECT_ID &&
      !ids.some((id) => String(id) === String(subject.id)),
  );

  nextMom.subjects = defaultSubject
    ? [defaultSubject, ...ordered, ...missing]
    : [...ordered, ...missing];
  persistMom(nextMom);
}

function selectedCollaborators(ids: Array<string | number>): ContactRef[] {
  const selected = new Set(ids.map(String));
  return employeeOptions.value
    .filter(
      (employee) =>
        employee.value !== undefined && selected.has(String(employee.value)),
    )
    .map((employee) => ({
      id: employee.value as string | number,
      name: employee.title,
      avatarUrl: employee.avatarUrl || null,
    }));
}

function saveInlineNote(payload: MomNoteSavePayload) {
  const nextMom = cloneMom(mom.value);
  const now = nowIso();
  const existing = notes.value.find((note) => String(note.id) === String(payload.noteId));
  const note: MeetingMomNote = {
    id: payload.noteId || makeId("note"),
    subjectId: payload.subjectId,
    bodyHtml: payload.bodyHtml,
    assignee: payload.assignee.trim(),
    dueAt: payload.dueAt || null,
    createTask: payload.createTask,
    collaborators: selectedCollaborators(payload.collaboratorIds),
    attachments: [...payload.attachments],
    links: [...payload.links],
    internal: payload.internal,
    generatedTaskId: existing?.generatedTaskId || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const index = nextMom.notes.findIndex((item) => String(item.id) === String(note.id));
  if (index === -1) nextMom.notes.push(note);
  else nextMom.notes.splice(index, 1, note);

  nextMom.subjects = nextMom.subjects.map((subject) => {
    const ids = nextMom.notes
      .filter((note) => String(note.subjectId) === String(subject.id))
      .map((note) => note.id);
    return { ...subject, noteIds: ids };
  });

  persistMom(syncSummary(nextMom));
}

function updateNotesState(payload: {
  subjectId: string | number;
  ids: Array<string | number>;
}) {
  const nextMom = cloneMom(mom.value);
  const movedIds = new Set(payload.ids.map(String));
  nextMom.notes = nextMom.notes.map((note) =>
    movedIds.has(String(note.id))
      ? { ...note, subjectId: payload.subjectId, updatedAt: nowIso() }
      : note,
  );
  nextMom.subjects = nextMom.subjects.map((subject) => {
    if (String(subject.id) === String(payload.subjectId))
      return { ...subject, noteIds: [...payload.ids], updatedAt: nowIso() };

    return {
      ...subject,
      noteIds: (subject.noteIds || []).filter((id) => !movedIds.has(String(id))),
    };
  });
  persistMom(syncSummary(nextMom));
}

function deleteNote(note: MeetingMomNote) {
  const nextMom = cloneMom(mom.value);
  nextMom.notes = nextMom.notes.filter((item) => String(item.id) !== String(note.id));
  nextMom.subjects = nextMom.subjects.map((subject) => ({
    ...subject,
    noteIds: subject.noteIds.filter((id) => String(id) !== String(note.id)),
  }));
  persistMom(syncSummary(nextMom));
}

function toggleInternal(note: MeetingMomNote) {
  const nextMom = cloneMom(mom.value);
  nextMom.notes = nextMom.notes.map((item) =>
    String(item.id) === String(note.id)
      ? { ...item, internal: !item.internal, updatedAt: nowIso() }
      : item,
  );
  persistMom(nextMom);
}

function markAttendance(attendee: ContactRef, attended: boolean) {
  const nextMom = cloneMom(mom.value);
  nextMom.attendance = {
    ...(nextMom.attendance || {}),
    [String(attendee.id)]: attended,
  };
  persistMom(nextMom);
}

function openCompleteMeeting() {
  completeDialog.sentiment = (mom.value.sentiment || "good") as MeetingSentiment;
  completeDialog.duration = formatHhMm(
    mom.value.durationSeconds ? Math.round(mom.value.durationSeconds / 60) : meeting.value?.duration || 30,
  );
  completeDialog.open = true;
}

function completeMeeting() {
  const nextMom = cloneMom(mom.value);
  const seconds = parseHhMm(completeDialog.duration);
  nextMom.completedAt = nowIso();
  nextMom.cancelledAt = null;
  nextMom.sentiment = completeDialog.sentiment;
  nextMom.durationSeconds = seconds;
  persistMom(nextMom, {
    status: "completed",
    summary: {
      brief: stripHtml(nextMom.summaryHtml),
      sentiment: completeDialog.sentiment,
      duration: Math.round(seconds / 60),
    },
  });
  completeDialog.open = false;
}

function postponeMeeting() {
  if (!meeting.value || effectiveStatus.value === "completed") return;
  todosStore.updateMeeting(
    meeting.value.id,
    {
      status: "postponed",
      postponedCount: Number(meeting.value.postponedCount || 0) + 1,
    },
    { system: true },
  );
}

function cancelMeeting() {
  if (!meeting.value || effectiveStatus.value === "completed") return;
  const nextMom = cloneMom(mom.value);
  nextMom.cancelledAt = nowIso();
  persistMom(nextMom, { status: "canceled" });
}

function removeMeeting() {
  if (!meeting.value) return;
  todosStore.removeMeeting(meeting.value.id, { system: true });
  deleteDialog.value = false;
  router.push({ name: "apps-calendar" });
}

function generateTasks() {
  if (!meeting.value || !mom.value.completedAt) return;
  const nextMom = cloneMom(mom.value);
  let count = 0;
  nextMom.notes = nextMom.notes.map((note) => {
    if (!note.createTask || note.generatedTaskId) return note;
    const todo = todosStore.addTodo(
      {
        title: stripHtml(note.bodyHtml).slice(0, 80) || `M.O.M note - ${meeting.value?.subject}`,
        notes: stripHtml(note.bodyHtml),
        dueAt: note.dueAt || meeting.value?.startAt || nowIso(),
        collaborators: note.collaborators || [],
        important: false,
        status: "pending",
        attachment: note.attachments[0] || note.links[0] || null,
        relatedTo: {
          id: meeting.value!.id,
          name: meeting.value!.subject,
          type: "meeting",
        },
      },
      { system: true },
    );
    count += 1;
    return { ...note, generatedTaskId: todo.id, updatedAt: nowIso() };
  });
  persistMom(nextMom);
  notifications.push(`${count} M.O.M task${count === 1 ? "" : "s"} generated`, "success");
}

function printableHtml() {
  const related = relatedRecords.value
    .map((record) => `<li>${record.type}: ${record.name}</li>`)
    .join("");
  const notesHtml = subjects.value
    .map((subject) => {
      const body = notesForSubject(subject.id)
        .map((note) => `<li>${stripHtml(note.bodyHtml)}</li>`)
        .join("");
      return `<h2>${subject.title}</h2><ul>${body || "<li>No notes</li>"}</ul>`;
    })
    .join("");

  return `
    <html>
      <head><title>Minutes of Meeting - ${meeting.value?.subject || ""}</title></head>
      <body>
        <h1>Minutes of Meeting</h1>
        <p><strong>${meeting.value?.subject || ""}</strong></p>
        <p>${meeting.value?.startAt ? formatSystemDateTime(new Date(meeting.value.startAt).getTime()) : ""}</p>
        <p>Status: ${statusLabel.value}</p>
        <h2>Related</h2><ul>${related || "<li>None</li>"}</ul>
        <h2>Summary</h2>${mom.value.summaryHtml || ""}
        <h2>Notes</h2>${notesHtml}
      </body>
    </html>
  `;
}

function printMom() {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(printableHtml());
  win.document.close();
  win.focus();
  win.print();
}

function emailMom() {
  emailDialog.value?.openWith({
    subject: `Minutes of Meeting - ${meeting.value?.subject || ""}`,
    message: printableHtml(),
    attachments: [
      {
        name: `MOM-${meeting.value?.id || "meeting"}.html`,
        url: `data:text/html;charset=utf-8,${encodeURIComponent(printableHtml())}`,
      },
    ],
  });
}

watch(
  () => meeting.value?.id,
  () => {
    if (meeting.value && !meeting.value.mom) {
      persistMom(cloneMom(null));
    }
  },
  { immediate: true },
);
</script>

<template>
  <VCard v-if="!meeting" class="pa-6">
    <VCardTitle>Meeting not found</VCardTitle>
    <VCardText>The requested meeting could not be found.</VCardText>
    <VCardActions>
      <VBtn color="primary" @click="router.back()">Back</VBtn>
    </VCardActions>
  </VCard>

  <div v-else class="mom-shell">
    <div class="mom-page">
      <div class="mom-main">
        <VCard class="mom-summary-card mb-6">
          <VCardItem>
            <template #title>Meeting Summary</template>
            <template #append>
              <AppTextField
                :model-value="formatMmSs(mom.durationSeconds)"
                label="Duration"
                placeholder="MM:SS"
                density="compact"
                class="mom-duration-field mom-bordered-field"
                @update:model-value="onDurationChange"
              />
            </template>
          </VCardItem>
          <VCardText>
            <div class="mom-bordered-editor">
              <TiptapEditor
                :model-value="mom.summaryHtml || ''"
                placeholder="Meeting summary"
                @update:model-value="updateSummary"
              />
            </div>
          </VCardText>
        </VCard>

        <MomKanbanBoard
          :subjects="subjects"
          :notes="notes"
          :employee-options="employeeOptions"
          :group-name="`meeting-mom-${meeting.id}`"
          @add-subject="addSubject"
          @rename-subject="renameSubject"
          @delete-subject="removeSubject"
          @save-note="saveInlineNote"
          @delete-note="deleteNote"
          @toggle-internal="toggleInternal"
          @update-subject-order="updateSubjectOrder"
          @update-notes-state="updateNotesState"
        />
      </div>

      <div class="mom-side">
      <VCard class="mom-detail-card">
        <VCardText class="text-center">
          <VAvatar size="84" color="primary" class="mb-3">
            <span class="text-h4">{{ avatarText(meeting.subject) }}</span>
          </VAvatar>
          <h3 class="text-h5 mb-1">{{ meeting.subject }}</h3>
          <VChip :color="statusColor()" size="small">{{ statusLabel }}</VChip>
        </VCardText>

        <VDivider />

        <VCardText>
          <div class="mom-detail-row">
            <strong>Start</strong>
            <span>{{ formatSystemDateTime(new Date(meeting.startAt).getTime()) }}</span>
          </div>
          <div class="mom-detail-row">
            <strong>Planned Duration</strong>
            <span>{{ meeting.duration }} min</span>
          </div>
          <div class="mom-detail-row">
            <strong>Type</strong>
            <span>{{ meeting.type }}</span>
          </div>
          <div class="mom-detail-row">
            <strong>Location</strong>
            <span>{{ meeting.location || "--" }}</span>
          </div>
          <div class="mom-detail-row">
            <strong>Requested By</strong>
            <span>{{ meeting.requestedBy?.name || "--" }}</span>
          </div>

          <div class="mt-4">
            <div class="font-weight-medium mb-2">Related</div>
            <AppAutocomplete
              :model-value="selectedRelatedKeys"
              :items="relatedOptions"
              item-title="title"
              item-value="value"
              multiple
              chips
              closable-chips
              density="compact"
              placeholder="Attach jobs or deals"
              class="mb-3"
              @update:model-value="updateRelatedRecords"
            />
            <VChip
              v-for="record in relatedRecords"
              :key="`${record.type}-${record.id}`"
              size="small"
              class="me-1 mb-1"
            >
              {{ record.type }}: {{ record.name }}
            </VChip>
            <span v-if="!relatedRecords.length" class="text-medium-emphasis">--</span>
          </div>
        </VCardText>

        <VCardText>
          <div class="mom-action-panel">
            <VBtn
              block
              color="success"
              prepend-icon="tabler-check"
              @click="openCompleteMeeting"
            >
              Complete Meeting
            </VBtn>

            <div class="mom-action-grid">
              <VBtn
                color="primary"
                variant="tonal"
                icon
                :disabled="!mom.completedAt"
                @click="generateTasks"
              >
                <VIcon icon="tabler-list-check" />
                <VTooltip activator="parent">Generate Tasks</VTooltip>
              </VBtn>
              <VBtn
                variant="tonal"
                icon
                @click="printMom"
              >
                <VIcon icon="tabler-printer" />
                <VTooltip activator="parent">Print M.O.M</VTooltip>
              </VBtn>
              <VBtn
                variant="tonal"
                icon
                @click="emailMom"
              >
                <VIcon icon="tabler-mail" />
                <VTooltip activator="parent">Email M.O.M</VTooltip>
              </VBtn>
            </div>

            <div class="mom-action-grid">
              <VBtn
                color="warning"
                variant="tonal"
                prepend-icon="tabler-clock-pause"
                :disabled="effectiveStatus === 'completed'"
                @click="postponeMeeting"
              >
                Postpone
              </VBtn>
              <VBtn
                color="secondary"
                variant="tonal"
                prepend-icon="tabler-calendar-x"
                :disabled="effectiveStatus === 'completed'"
                @click="cancelMeeting"
              >
                Cancel
              </VBtn>
            </div>

            <VDivider />

            <VBtn
              color="error"
              variant="text"
              prepend-icon="tabler-trash"
              @click="deleteDialog = true"
            >
              Delete Meeting
            </VBtn>
          </div>
        </VCardText>
      </VCard>

      <VCard>
        <VCardItem title="Attendees" subtitle="Confirm attendance" />
        <VCardText>
          <div
            v-for="attendee in attendees"
            :key="attendee.id"
            class="mom-attendee"
          >
            <div class="d-flex align-center gap-3">
              <VAvatar size="38" color="primary">
                <VImg v-if="attendee.avatarUrl" :src="attendee.avatarUrl" />
                <span v-else>{{ avatarText(attendee.name) }}</span>
              </VAvatar>
              <div>
                <div class="font-weight-medium">{{ attendee.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ mom.attendance?.[String(attendee.id)] ? "Attended" : "Not attended" }}
                </div>
              </div>
            </div>
            <VCheckbox
              :model-value="Boolean(mom.attendance?.[String(attendee.id)])"
              density="compact"
              hide-details
              @update:model-value="markAttendance(attendee, Boolean($event))"
            />
          </div>
          <div v-if="!attendees.length" class="text-medium-emphasis">
            No attendees linked.
          </div>
        </VCardText>
      </VCard>
      </div>
    </div>
  </div>

  <VDialog v-model="completeDialog.open" max-width="420" persistent>
    <VCard title="Complete Meeting">
      <VCardText>
        <AppSelect
          v-model="completeDialog.sentiment"
          :items="sentimentOptions"
          item-title="title"
          item-value="value"
          label="Sentiment"
        />
        <AppTextField
          v-model="completeDialog.duration"
          label="Duration"
          placeholder="HH:MM"
          class="mt-4"
        />
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="completeDialog.open = false">Cancel</VBtn>
        <VBtn color="success" @click="completeMeeting">Complete</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="deleteDialog" max-width="420" persistent>
    <VCard title="Delete Meeting">
      <VCardText>
        <span v-if="mom.completedAt">
          This meeting is completed. Deleting it will remove the completed M.O.M record.
        </span>
        <span v-else>Delete this meeting?</span>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="deleteDialog = false">Cancel</VBtn>
        <VBtn color="error" @click="removeMeeting">Delete</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <EmailDialog ref="emailDialog" />
</template>

<style scoped>
.mom-shell {
  display: grid;
  gap: 1.5rem;
}

.mom-page {
  display: grid;
  align-items: start;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 1fr) 360px;
}

.mom-main {
  min-inline-size: 0;
}

.mom-summary-card {
  z-index: 3;
}

.mom-duration-field {
  inline-size: 130px;
}

.mom-shell :deep(.v-field) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
}

.mom-bordered-editor {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
}

.mom-bordered-editor :deep(.ProseMirror) {
  min-block-size: 7rem;
  padding: 0.75rem;
}

.mom-bordered-field :deep(.v-field) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
}

.mom-side {
  position: sticky;
  display: grid;
  gap: 1rem;
  inset-block-start: 0;
}

.mom-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.35rem;
}

.mom-detail-row span {
  color: rgba(var(--v-theme-on-surface), 0.7);
  text-align: end;
}

.mom-action-panel {
  display: grid;
  gap: 0.75rem;
}

.mom-action-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mom-action-grid .v-btn:not(.v-btn--icon) {
  min-inline-size: 0;
}

.mom-attendee {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.5rem;
}

@media (max-width: 1200px) {
  .mom-page {
    grid-template-columns: 1fr;
  }

  .mom-side {
    position: static;
  }
}
</style>
