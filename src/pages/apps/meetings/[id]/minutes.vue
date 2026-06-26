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
import AddMeetingDrawer, {
  type NewMeetingPayload,
} from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import MomKanbanBoard from "@/views/apps/meetings/MomKanbanBoard.vue";
import { formatSystemDateTime } from "@core/utils/formatters";
import { computed, nextTick, reactive, ref, watch } from "vue";
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
const addMeetingRef = ref<InstanceType<typeof AddMeetingDrawer> | null>(null);
const isMeetingDrawerOpen = ref(false);
const emailDialog = ref<InstanceType<typeof EmailDialog> | null>(null);
const isEmailDialogVisible = ref(false);

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
const replaceSummaryDialog = ref(false);
const pendingGeneratedSummary = ref("");

const postponeDialog = reactive({
  open: false,
  startAt: "",
});

function nowIso() {
  return new Date().toISOString();
}

function toast(message: string, color: "success" | "error" | "warning" | "info" = "success") {
  notifications.push(message, color);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  toast("Meeting related records updated.");
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

const canComplete = computed(
  () => effectiveStatus.value !== "canceled" && effectiveStatus.value !== "completed",
);
const canPostpone = computed(
  () => effectiveStatus.value !== "canceled" && effectiveStatus.value !== "completed",
);
const canCancel = computed(
  () => effectiveStatus.value !== "completed" && effectiveStatus.value !== "canceled",
);
const canGenerateTasks = computed(() => Boolean(mom.value.completedAt));

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
        .map((note) => {
          const meta = [
            note.dueAt
              ? `Due: ${formatSystemDateTime(new Date(note.dueAt).getTime())}`
              : "",
            note.assignee ? `Assignee: ${note.assignee}` : "",
            note.collaborators?.length
              ? `Collaborators: ${note.collaborators.map((item) => item.name).join(", ")}`
              : "",
            note.attachments?.length ? `${note.attachments.length} attachment(s)` : "",
            note.links?.length ? `${note.links.length} link(s)` : "",
            note.internal ? "Internal" : "",
            note.createTask ? "Task requested" : "",
          ].filter(Boolean);
          return `<li><p>${escapeHtml(stripHtml(note.bodyHtml) || "Note")}</p>${
            meta.length ? `<small>${escapeHtml(meta.join(" | "))}</small>` : ""
          }</li>`;
        })
        .join("");
      return `<h3>${escapeHtml(subject.title)}</h3><ul>${list}</ul>`;
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

function applyGeneratedSummary(summaryHtml = pendingGeneratedSummary.value) {
  const nextMom = cloneMom(mom.value);
  nextMom.summaryHtml = summaryHtml || "<p>No meeting notes yet.</p>";
  nextMom.summaryTouched = true;
  persistMom(nextMom);
  pendingGeneratedSummary.value = "";
  replaceSummaryDialog.value = false;
  toast("Meeting summary generated.");
}

function generateSummary() {
  const generated = autoSummary(mom.value) || "<p>No meeting notes yet.</p>";
  const hasExisting = stripHtml(mom.value.summaryHtml).trim().length > 0;
  if (hasExisting) {
    pendingGeneratedSummary.value = generated;
    replaceSummaryDialog.value = true;
    return;
  }
  applyGeneratedSummary(generated);
}

function cancelSummaryReplacement() {
  pendingGeneratedSummary.value = "";
  replaceSummaryDialog.value = false;
  toast("Summary replacement canceled.", "info");
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

function toLocalDateTimeInput(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value: string) {
  const normalized = String(value || "").trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function openEditMeeting() {
  if (!meeting.value) return;
  isMeetingDrawerOpen.value = true;
  nextTick(() => {
    addMeetingRef.value?.openWith?.({
      title: meeting.value?.subject,
      initialStart: meeting.value?.startAt,
      durationMins: meeting.value?.duration,
      meetingType: meeting.value?.type,
      notes: meeting.value?.note,
      location: meeting.value?.location,
      linkedTo: meeting.value?.linkedTo || [],
      relatedTo: meeting.value?.relatedTo || null,
      relatedToMany: meeting.value?.relatedToMany || [],
      subject: meeting.value?.subject,
      drawerTitle: "Edit Meeting",
    });
  });
}

function closeMeetingDrawer() {
  isMeetingDrawerOpen.value = false;
}

function saveMeetingEdit(payload: NewMeetingPayload) {
  if (!meeting.value) {
    toast("Meeting update failed.", "error");
    return;
  }

  todosStore.updateMeeting(
    meeting.value.id,
    {
      subject: payload.subject || payload.title,
      startAt: payload.startAt || payload.start,
      duration: payload.duration ?? payload.durationMins,
      type: (payload.type || payload.meetingType) as Meeting["type"],
      linkedTo: payload.linkedTo as any,
      relatedTo: payload.relatedTo || null,
      relatedToMany: Array.isArray(payload.relatedToMany)
        ? (payload.relatedToMany as any)
        : payload.relatedTo
          ? [payload.relatedTo as any]
          : meeting.value.relatedToMany || [],
      location: payload.location || "",
      note: payload.note || payload.notes || "",
      attachments: payload.attachments as any,
    },
    { system: true },
  );
  isMeetingDrawerOpen.value = false;
  toast("Meeting updated.");
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
  toast("Subject added.");
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
  toast("Subject renamed.");
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
  toast("Subject deleted.");
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
  toast("Subjects reordered.");
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
  toast(index === -1 ? "Note added." : "Note updated.");
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
  const targetSubject = subjects.value.find(
    (subject) => String(subject.id) === String(payload.subjectId),
  );
  toast(`Note moved${targetSubject ? ` to ${targetSubject.title}` : ""}.`);
}

function deleteNote(note: MeetingMomNote) {
  const nextMom = cloneMom(mom.value);
  nextMom.notes = nextMom.notes.filter((item) => String(item.id) !== String(note.id));
  nextMom.subjects = nextMom.subjects.map((subject) => ({
    ...subject,
    noteIds: subject.noteIds.filter((id) => String(id) !== String(note.id)),
  }));
  persistMom(syncSummary(nextMom));
  toast("Note deleted.");
}

function toggleInternal(note: MeetingMomNote) {
  const nextMom = cloneMom(mom.value);
  nextMom.notes = nextMom.notes.map((item) =>
    String(item.id) === String(note.id)
      ? { ...item, internal: !item.internal, updatedAt: nowIso() }
      : item,
  );
  persistMom(nextMom);
  toast(!note.internal ? "Note marked internal." : "Note marked public.");
}

function toggleCreateTask(note: MeetingMomNote) {
  const nextMom = cloneMom(mom.value);
  nextMom.notes = nextMom.notes.map((item) =>
    String(item.id) === String(note.id)
      ? { ...item, createTask: !item.createTask, updatedAt: nowIso() }
      : item,
  );
  persistMom(nextMom);
  toast(!note.createTask ? "Note marked as task." : "Note task flag removed.");
}

function markAttendance(attendee: ContactRef, attended: boolean) {
  const nextMom = cloneMom(mom.value);
  nextMom.attendance = {
    ...(nextMom.attendance || {}),
    [String(attendee.id)]: attended,
  };
  persistMom(nextMom);
  toast(`${attendee.name} marked ${attended ? "attended" : "not attended"}.`);
}

function openCompleteMeeting() {
  if (!canComplete.value) {
    toast("Canceled or completed meetings cannot be completed.", "error");
    return;
  }
  completeDialog.sentiment = (mom.value.sentiment || "good") as MeetingSentiment;
  completeDialog.duration = formatHhMm(
    mom.value.durationSeconds ? Math.round(mom.value.durationSeconds / 60) : meeting.value?.duration || 30,
  );
  completeDialog.open = true;
}

function completeMeeting() {
  if (!meeting.value || !canComplete.value) {
    toast("Meeting cannot be completed.", "error");
    return;
  }
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
  toast("Meeting completed.");
}

function openPostponeMeeting() {
  if (!canPostpone.value) {
    toast("Canceled or completed meetings cannot be postponed.", "error");
    return;
  }
  postponeDialog.startAt = toLocalDateTimeInput(meeting.value?.startAt);
  postponeDialog.open = true;
}

function postponeMeeting() {
  if (!meeting.value || !canPostpone.value) {
    toast("Meeting cannot be postponed.", "error");
    return;
  }
  const nextStart = parseDateTimeInput(postponeDialog.startAt);
  if (!nextStart) {
    toast("Select a valid postpone date.", "error");
    return;
  }
  todosStore.updateMeeting(
    meeting.value.id,
    {
      status: "postponed",
      startAt: nextStart.toISOString(),
      postponedCount: Number(meeting.value.postponedCount || 0) + 1,
    },
    { system: true },
  );
  postponeDialog.open = false;
  toast("Meeting postponed.");
}

function cancelMeeting() {
  if (!meeting.value || !canCancel.value) {
    toast("Meeting cannot be canceled.", "error");
    return;
  }
  const nextMom = cloneMom(mom.value);
  nextMom.cancelledAt = nowIso();
  persistMom(nextMom, { status: "canceled" });
  toast("Meeting canceled.");
}

function removeMeeting() {
  if (!meeting.value) {
    toast("Meeting delete failed.", "error");
    return;
  }
  todosStore.removeMeeting(meeting.value.id, { system: true });
  deleteDialog.value = false;
  toast("Meeting deleted.");
  router.push({ name: "apps-calendar" });
}

function generateTasks() {
  if (!meeting.value || !mom.value.completedAt) {
    toast("Complete the meeting before generating tasks.", "error");
    return;
  }
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
  toast(`${count} M.O.M task${count === 1 ? "" : "s"} generated.`);
}

function printableHtml() {
  const related = relatedRecords.value
    .map((record) => `<li>${escapeHtml(record.type)}: ${escapeHtml(record.name)}</li>`)
    .join("");
  const attendeesHtml = attendees.value
    .map((attendee) => {
      const attended = mom.value.attendance?.[String(attendee.id)];
      return `<tr><td>${escapeHtml(attendee.name)}</td><td>${attended ? "Attended" : "Not attended"}</td></tr>`;
    })
    .join("");
  const notesHtml = subjects.value
    .map((subject) => {
      const body = notesForSubject(subject.id)
        .map((note) => {
          const meta = [
            note.dueAt
              ? `Due: ${formatSystemDateTime(new Date(note.dueAt).getTime())}`
              : "",
            note.assignee ? `Assignee: ${note.assignee}` : "",
            note.collaborators?.length
              ? `Collaborators: ${note.collaborators.map((item) => item.name).join(", ")}`
              : "",
            note.attachments?.length ? `${note.attachments.length} attachment(s)` : "",
            note.links?.length ? `${note.links.length} link(s)` : "",
            note.internal ? "Internal" : "",
            note.createTask ? "Task requested" : "",
          ].filter(Boolean);
          return `<li><div>${escapeHtml(stripHtml(note.bodyHtml)) || "Note"}</div>${
            meta.length ? `<small>${escapeHtml(meta.join(" | "))}</small>` : ""
          }</li>`;
        })
        .join("");
      return `<section><h2>${escapeHtml(subject.title)}</h2><ul>${body || "<li>No notes</li>"}</ul></section>`;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Minutes of Meeting - ${escapeHtml(meeting.value?.subject || "")}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; color: #2f2b3d; font-family: Inter, Arial, sans-serif; background: #fff; }
          .doc { max-width: 960px; margin: 0 auto; padding: 40px; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #d7d6de; padding-bottom: 24px; margin-bottom: 28px; }
          .brand { color: #00a6a6; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          h1 { margin: 8px 0 0; font-size: 30px; }
          h2 { margin: 28px 0 12px; font-size: 18px; color: #4b465c; }
          .status { display: inline-block; border-radius: 6px; padding: 6px 10px; background: #eef2ff; font-weight: 600; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
          .label { color: #6f6b7d; font-size: 12px; text-transform: uppercase; }
          .value { font-weight: 600; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #ebe9f1; padding: 10px; text-align: left; }
          ul { margin: 0; padding-left: 20px; }
          li { margin: 8px 0; }
          small { display: block; color: #6f6b7d; margin-top: 3px; }
          .summary { border: 1px solid #ebe9f1; border-radius: 8px; padding: 16px; }
          @media print { .doc { padding: 24px; max-width: none; } }
        </style>
      </head>
      <body>
        <main class="doc">
          <div class="header">
            <div>
              <div class="brand">Squarely</div>
              <h1>Minutes of Meeting</h1>
              <p><strong>${escapeHtml(meeting.value?.subject || "")}</strong></p>
            </div>
            <div><span class="status">${escapeHtml(statusLabel.value)}</span></div>
          </div>
          <section class="grid">
            <div><div class="label">Start</div><div class="value">${meeting.value?.startAt ? formatSystemDateTime(new Date(meeting.value.startAt).getTime()) : "--"}</div></div>
            <div><div class="label">Duration</div><div class="value">${escapeHtml(formatMmSs(mom.value.durationSeconds))}</div></div>
            <div><div class="label">Type</div><div class="value">${escapeHtml(meeting.value?.type || "--")}</div></div>
            <div><div class="label">Location</div><div class="value">${escapeHtml(meeting.value?.location || "--")}</div></div>
          </section>
          <h2>Related</h2><ul>${related || "<li>None</li>"}</ul>
          <h2>Attendees</h2><table><tbody>${attendeesHtml || "<tr><td>No attendees linked.</td><td></td></tr>"}</tbody></table>
          <h2>Summary</h2><div class="summary">${mom.value.summaryHtml || "<p>No summary.</p>"}</div>
          <h2>Notes</h2>${notesHtml}
        </main>
      </body>
    </html>
  `;
}

function printMom() {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    toast("Print preview could not be opened.", "error");
    return;
  }
  win.document.write(printableHtml());
  win.document.close();
  win.focus();
  win.print();
  toast("Print preview opened.");
}

function emailMom() {
  if (!meeting.value) {
    toast("Email could not be prepared.", "error");
    return;
  }
  const html = printableHtml();
  isEmailDialogVisible.value = true;
  nextTick(() => {
    emailDialog.value?.openWith?.({
      subject: `Minutes of Meeting - ${meeting.value?.subject || ""}`,
      message: html,
      attachments: [
        {
          name: `MOM-${meeting.value?.id || "meeting"}.html`,
          url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
        },
      ],
    });
    toast("M.O.M email prepared.");
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
              <VBtn
                color="primary"
                variant="tonal"
                prepend-icon="tabler-sparkles"
                @click="generateSummary"
              >
                Generate Summary
              </VBtn>
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
          @toggle-create-task="toggleCreateTask"
          @update-subject-order="updateSubjectOrder"
          @update-notes-state="updateNotesState"
        />
      </div>

      <div class="mom-side">
      <VCard class="mom-detail-card">
        <VCardText class="text-center">
          <h3 class="text-h5 mb-1">{{ meeting.subject }}</h3>
          <div class="d-flex align-center justify-center gap-2 flex-wrap mb-2">
            <VChip :color="statusColor()" size="small">{{ statusLabel }}</VChip>
          </div>
          <VBtn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="tabler-edit"
            @click="openEditMeeting"
          >
            Edit
          </VBtn>
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
            <div class="mom-action-row mom-action-row--two">
              <VBtn
                color="success"
                prepend-icon="tabler-check"
                :disabled="!canComplete"
                @click="openCompleteMeeting"
              >
                Complete
                <VTooltip v-if="!canComplete" activator="parent">
                  Canceled or completed meetings cannot be completed.
                </VTooltip>
              </VBtn>
              <VBtn
                color="warning"
                variant="tonal"
                prepend-icon="tabler-clock-pause"
                :disabled="!canPostpone"
                @click="openPostponeMeeting"
              >
                Postpone
                <VTooltip v-if="!canPostpone" activator="parent">
                  Canceled or completed meetings cannot be postponed.
                </VTooltip>
              </VBtn>
            </div>

            <div class="mom-action-row mom-action-row--three">
              <VBtn
                color="primary"
                variant="tonal"
                prepend-icon="tabler-list-check"
                :disabled="!canGenerateTasks"
                @click="generateTasks"
              >
                Generate Tasks
                <VTooltip v-if="!canGenerateTasks" activator="parent">
                  Complete the meeting first.
                </VTooltip>
              </VBtn>
              <VBtn
                variant="tonal"
                prepend-icon="tabler-printer"
                @click="printMom"
              >
                Print
              </VBtn>
              <VBtn
                variant="tonal"
                prepend-icon="tabler-mail"
                @click="emailMom"
              >
                Email
              </VBtn>
            </div>

            <div class="mom-action-row mom-action-row--two">
              <VBtn
                color="secondary"
                variant="tonal"
                prepend-icon="tabler-calendar-x"
                :disabled="!canCancel"
                @click="cancelMeeting"
              >
                Cancel
                <VTooltip v-if="!canCancel" activator="parent">
                  Completed or canceled meetings cannot be canceled.
                </VTooltip>
              </VBtn>
              <VBtn
                color="error"
                variant="tonal"
                prepend-icon="tabler-trash"
                @click="deleteDialog = true"
              >
                Delete
              </VBtn>
            </div>
          </div>
        </VCardText>
      </VCard>

      <VCard>
        <VCardItem title="Attendees" subtitle="Confirm attendance">
          <template #append>
            <VBtn
              icon
              size="32"
              variant="tonal"
              color="primary"
              @click="openEditMeeting"
            >
              <VIcon icon="tabler-plus" size="18" />
              <VTooltip activator="parent">Add attendees</VTooltip>
            </VBtn>
          </template>
        </VCardItem>
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

  <VDialog v-model="replaceSummaryDialog" max-width="460" persistent>
    <VCard title="Replace Meeting Summary">
      <VCardText>
        A summary already exists. Replace it with a new summary generated from current notes?
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="cancelSummaryReplacement">Cancel</VBtn>
        <VBtn color="primary" @click="applyGeneratedSummary()">Replace</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="postponeDialog.open" max-width="420" persistent>
    <VCard title="Postpone Meeting">
      <VCardText>
        <AppDateTimePicker
          v-model="postponeDialog.startAt"
          label="Postpone to"
          placeholder="YYYY-MM-DD HH:mm"
          class="mom-bordered-field"
          :config="{ enableTime: true, dateFormat: 'Y-m-d H:i' }"
        />
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="postponeDialog.open = false">Cancel</VBtn>
        <VBtn color="warning" @click="postponeMeeting">Postpone</VBtn>
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

  <AddMeetingDrawer
    ref="addMeetingRef"
    v-model:modelValue="isMeetingDrawerOpen"
    @save="saveMeetingEdit"
    @cancel="closeMeetingDrawer"
  />

  <EmailDialog
    ref="emailDialog"
    v-model:is-dialog-visible="isEmailDialogVisible"
    @close="isEmailDialogVisible = false"
  />
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
  line-height: 1.55;
}

.mom-bordered-editor :deep(.ProseMirror ul),
.mom-bordered-editor :deep(.ProseMirror ol) {
  padding-inline-start: 1.35rem;
  margin-block: 0.4rem;
  list-style-position: outside;
}

.mom-bordered-editor :deep(.ProseMirror li) {
  display: list-item;
  padding-inline-start: 0.2rem;
  margin-block: 0.25rem;
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

.mom-action-row {
  display: grid;
  gap: 0.5rem;
}

.mom-action-row--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mom-action-row--three {
  grid-template-columns: 1fr;
}

.mom-action-row .v-btn {
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
