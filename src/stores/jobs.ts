import { db } from "@/plugins/fake-api/handlers/operations/jobs/db";
import type {
  JobDocument,
  JobGoal,
  JobMilestone,
  JobProperties,
  JobStatus,
  JobStakeholder,
} from "@/plugins/fake-api/handlers/operations/jobs/types";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import {
  authorizeRecord,
  filterReadableResources,
  mapAuthorizationResource,
  requireCurrentUserPermission,
} from "@/utils/authorization";
import { getSignedInIdentity } from "@/utils/currentAccount";
import {
  generateJobProjectCode,
  normalizeProjectCode,
  parseJobOrderSequence,
} from "@/utils/jobProjectCode";
const STORAGE_KEY = "app.jobs.v2";
const JOB_STATUS_VALUES: JobStatus[] = [
  "New",
  "Pending",
  "In Progress",
  "On Hold",
  "Completed",
  "Closed",
];
const LEGACY_STAGE_STATUS_MAP: Record<string, JobStatus> = {
  PRPSL: "New",
  "In Review": "Pending",
  "Project | In Progress": "In Progress",
  RFI: "On Hold",
};
function safeClone<T extends object>(value: T, label: string): T {
  const raw = toRaw(value) as T;
  const seen = new WeakSet<object>();

  try {
    return JSON.parse(
      JSON.stringify(raw, (_key, currentValue) => {
        if (
          typeof currentValue === "function" ||
          typeof currentValue === "symbol"
        ) {
          return undefined;
        }

        if (typeof Window !== "undefined" && currentValue instanceof Window) {
          return undefined;
        }

        if (currentValue && typeof currentValue === "object") {
          if (seen.has(currentValue)) return undefined;
          seen.add(currentValue);
        }

        return currentValue;
      }),
    ) as T;
  } catch (error) {
    console.warn(`JSON clone failed while cloning ${label}:`, error);
    return { ...raw };
  }
}
function cloneStakeholder(stakeholder: JobStakeholder): JobStakeholder {
  return safeClone(stakeholder, "stakeholder");
}
function cloneMilestone(milestone: JobMilestone): JobMilestone {
  return safeClone(milestone, "milestone");
}
function cloneGoal(goal: JobGoal): JobGoal {
  return safeClone(goal, "goal");
}
function cloneDocument(document: JobDocument): JobDocument {
  return safeClone(document, "job document");
}
function cloneJob(job: JobProperties): JobProperties {
  const raw = toRaw(job) as JobProperties;
  try {
    const cloned = safeClone(raw, "job");
    const projectManagerId =
      cloned.projectManagerId ?? resolveProjectManagerId(cloned);
    const status = normalizeJobStatus(cloned.status, cloned.stage);
    return {
      ...cloned,
      projectManagerId,
      jobOrderNumber: cloned.jobOrderNumber ?? null,
      status,
      stage: status,
      flag: normalizeJobFlag(cloned.flag),
      collaborators: normalizeCollaborators(
        cloned.collaborators,
        projectManagerId,
      ),
      stakeholderConnectionImportIds: normalizeStakeholderConnectionImportIds(
        cloned.stakeholderConnectionImportIds,
      ),
      statusAutomation: cloned.statusAutomation ?? null,
    };
  } catch (error) {
    console.warn("JSON clone failed while cloning job:", error);
    const projectManagerId = raw.projectManagerId ?? resolveProjectManagerId(raw);
    const status = normalizeJobStatus(raw.status, raw.stage);
    return {
      ...raw,
      projectManagerId,
      jobOrderNumber: raw.jobOrderNumber ?? null,
      status,
      stage: status,
      flag: normalizeJobFlag(raw.flag),
      collaborators: normalizeCollaborators(raw.collaborators, projectManagerId),
      stakeholders: ensureStakeholders(raw.stakeholders),
      milestones: ensureMilestones(raw.milestones),
      goals: ensureGoals(raw.goals),
      documents: ensureDocuments(raw.documents),
      stakeholderConnectionImportIds: normalizeStakeholderConnectionImportIds(
        raw.stakeholderConnectionImportIds,
      ),
      statusAutomation: raw.statusAutomation ?? null,
    };
  }
}
function cloneJobsArray(jobs: JobProperties[]) {
  return jobs.map((job) => cloneJob(job));
}
function ensureStakeholders(
  stakeholders: JobStakeholder[] | undefined | null,
): JobStakeholder[] {
  if (!Array.isArray(stakeholders)) return [];
  return stakeholders.map((stakeholder) => cloneStakeholder(stakeholder));
}
function ensureMilestones(
  milestones: JobMilestone[] | undefined | null,
): JobMilestone[] {
  if (!Array.isArray(milestones)) return [];
  return milestones.map((milestone) => cloneMilestone(milestone));
}
function ensureGoals(goals: JobGoal[] | undefined | null): JobGoal[] {
  if (!Array.isArray(goals)) return [];
  return goals.map((goal) => cloneGoal(goal));
}
function ensureDocuments(
  documents: JobDocument[] | undefined | null,
): JobDocument[] {
  if (!Array.isArray(documents)) return [];
  return documents.map((document) => cloneDocument(document));
}
function loadFromStorage(): JobProperties[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as JobProperties[];
  } catch (error) {
    console.warn("Failed to load jobs from storage:", error);
    return null;
  }
}
function saveToStorage(jobs: JobProperties[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (error) {
    console.warn("Failed to save jobs to storage:", error);
  }
}
function toNumberId(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
function currentEmployeePersonId() {
  const identity = getSignedInIdentity();
  return (
    toNumberId(identity.employeeId) ??
    toNumberId(identity.personId) ??
    toNumberId(identity.id)
  );
}
function normalizeCollaborators(
  collaborators: JobProperties["collaborators"] | undefined,
  projectManagerId: number | null,
) {
  const normalized = Array.isArray(collaborators)
    ? collaborators
        .map((value) => toNumberId(value))
        .filter((value): value is number => value !== null)
    : [];

  if (projectManagerId && !normalized.includes(projectManagerId))
    normalized.unshift(projectManagerId);

  return Array.from(new Set(normalized));
}
function normalizeStakeholderConnectionImportIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => toNumberId(entry))
        .filter((entry): entry is number => entry !== null),
    ),
  );
}
function normalizeJobFlag(value: unknown) {
  return value === "High" ? "High" : "Normal";
}
function normalizeJobStatus(value: unknown, fallback?: unknown): JobStatus {
  const candidate = String(value ?? "").trim();
  if ((JOB_STATUS_VALUES as string[]).includes(candidate))
    return candidate as JobStatus;

  const legacy = LEGACY_STAGE_STATUS_MAP[candidate];
  if (legacy) return legacy;

  const fallbackCandidate = String(fallback ?? "").trim();
  if ((JOB_STATUS_VALUES as string[]).includes(fallbackCandidate))
    return fallbackCandidate as JobStatus;

  return LEGACY_STAGE_STATUS_MAP[fallbackCandidate] ?? "New";
}
function nextJobOrderNumber(items: JobProperties[], createdAt = new Date()) {
  const maxSequence = items
    .map((job) => parseJobOrderSequence(job.jobOrderNumber))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);
  const year = String(createdAt.getFullYear()).slice(-2);
  const sequence = String(maxSequence + 1).padStart(3, "0");

  return `JO${year}/${sequence}`;
}
function ensureJobOrderNumbers(items: JobProperties[]) {
  const normalized = [...items];
  normalized.forEach((job, index) => {
    if (job.jobOrderNumber) return;
    normalized[index] = {
      ...job,
      jobOrderNumber: nextJobOrderNumber(
        normalized,
        new Date(job.createdAt || new Date()),
      ),
    };
  });
  return normalized;
}
function resolveProjectManagerId(payload: Partial<JobProperties>) {
  return (
    toNumberId(payload.projectManagerId) ??
    (Array.isArray(payload.collaborators)
      ? (payload.collaborators
          .map((value) => toNumberId(value))
          .find((value): value is number => value !== null) ?? null)
      : null) ??
    currentEmployeePersonId()
  );
}
function normaliseJob(
  payload: Partial<JobProperties>,
  assignedId: number,
  existingJobs: JobProperties[] = [],
): JobProperties {
  const now = new Date().toISOString();
  const createdAt = payload.createdAt ?? now;
  const projectManagerId = resolveProjectManagerId(payload);
  const status = normalizeJobStatus(payload.status, payload.stage);
  const name = payload.name?.trim() || "Untitled Job";
  const jobOrderNumber =
    payload.jobOrderNumber?.trim() ||
    nextJobOrderNumber(existingJobs, new Date(createdAt));
  const jobOrderSequence = parseJobOrderSequence(jobOrderNumber);
  const projectCode =
    normalizeProjectCode(payload.code) ||
    generateJobProjectCode(name, existingJobs, jobOrderSequence ?? undefined);

  return {
    id: assignedId,
    jobOrderNumber,
    name,
    code: projectCode,
    avatar:
      typeof payload.avatar === "string"
        ? payload.avatar.trim() || null
        : (payload.avatar ?? null),
    startDate: payload.startDate || undefined,
    location: payload.location?.trim() || undefined,
    stage: status,
    status,
    type: payload.type ?? "Architecture",
    flag: normalizeJobFlag(payload.flag),
    relatedTo: payload.relatedTo ?? null,
    projectManagerId,
    collaborators: normalizeCollaborators(payload.collaborators, projectManagerId),
    note: payload.note?.trim() || undefined,
    stakeholders: ensureStakeholders(payload.stakeholders),
    milestones: ensureMilestones(payload.milestones),
    goals: ensureGoals(payload.goals),
    documents: ensureDocuments(payload.documents),
    stakeholderConnectionImportIds: normalizeStakeholderConnectionImportIds(
      payload.stakeholderConnectionImportIds,
    ),
    statusAutomation: payload.statusAutomation ?? null,
    createdAt,
  };
}
function mergeJob(
  original: JobProperties,
  patch: Partial<JobProperties>,
): JobProperties {
  const projectManagerId =
    patch.projectManagerId === undefined
      ? (original.projectManagerId ?? resolveProjectManagerId(original))
      : resolveProjectManagerId({
          ...original,
          ...patch,
          projectManagerId: patch.projectManagerId,
        });
  const merged: JobProperties = {
    ...original,
    ...patch,
    projectManagerId,
    jobOrderNumber:
      patch.jobOrderNumber === undefined
        ? original.jobOrderNumber
        : patch.jobOrderNumber?.trim() || original.jobOrderNumber,
    status: normalizeJobStatus(patch.status, patch.stage ?? original.status),
    stage: normalizeJobStatus(patch.status, patch.stage ?? original.status),
    flag: normalizeJobFlag(patch.flag ?? original.flag),
    collaborators: normalizeCollaborators(
      Array.isArray(patch.collaborators)
        ? patch.collaborators
        : original.collaborators,
      projectManagerId,
    ),
    stakeholders: ensureStakeholders(
      patch.stakeholders ?? original.stakeholders,
    ),
    milestones: ensureMilestones(patch.milestones ?? original.milestones),
    goals: ensureGoals(patch.goals ?? original.goals),
    documents: ensureDocuments(patch.documents ?? original.documents),
    stakeholderConnectionImportIds: normalizeStakeholderConnectionImportIds(
      patch.stakeholderConnectionImportIds ??
        original.stakeholderConnectionImportIds,
    ),
    statusAutomation:
      patch.statusAutomation === undefined
        ? (original.statusAutomation ?? null)
        : (patch.statusAutomation ?? null),
  };
  if (typeof merged.avatar === "string") {
    merged.avatar = merged.avatar.trim() || null;
  }
  if (!merged.createdAt) merged.createdAt = original.createdAt;
  return cloneJob(merged);
}
function nextJobId(items: JobProperties[]) {
  const numericIds = items
    .map((job) => Number(job.id))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numericIds.length) return 1;
  return Math.max(...numericIds) + 1;
}
function nextNestedId(collection: Array<{ id: number }>) {
  const numericIds = collection
    .map((item) => Number(item.id))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numericIds.length) return 1;
  return Math.max(...numericIds) + 1;
}
const seedJobs = () => cloneJobsArray(db.jobs);
export const useJobsStore = defineStore("jobs", {
  state: () => ({
    items: [] as JobProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => filterReadableResources("jobs", state.items),
    byId: (state) => (id: number | string) =>
      authorizeRecord(
        "jobs",
        state.items.find((job) => String(job.id) === String(id)) ?? null,
      ),
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;
      const stored = loadFromStorage();
      if (stored && stored.length) {
        this.items = ensureJobOrderNumbers(cloneJobsArray(stored));
      } else {
        this.items = ensureJobOrderNumbers(seedJobs());
        saveToStorage(this.items);
      }
      this.initialized = true;
      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneJobsArray(state.items));
          },
          { detached: true },
        );
      }
    },
    addJob(payload: Partial<JobProperties>) {
      requireCurrentUserPermission("jobs", "create");

      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextJobId(this.items);
      const normalised = normaliseJob(payload, id, this.items);
      this.items.unshift(normalised);
      return normalised;
    },
    updateJob(id: number | string, patch: Partial<JobProperties>) {
      const index = this.items.findIndex(
        (job) => String(job.id) === String(id),
      );
      if (index === -1) return null;
      requireCurrentUserPermission(
        "jobs",
        "update",
        mapAuthorizationResource("jobs", this.items[index]),
      );
      const updated = mergeJob(this.items[index], patch);
      this.items.splice(index, 1, updated);
      return updated;
    },
    removeJob(id: number | string) {
      const index = this.items.findIndex(
        (job) => String(job.id) === String(id),
      );
      if (index === -1) return;
      requireCurrentUserPermission(
        "jobs",
        "delete",
        mapAuthorizationResource("jobs", this.items[index]),
      );
      this.items.splice(index, 1);
    },
    nextId() {
      return nextJobId(this.items);
    },
    addMilestone(jobId: number | string, milestone: Partial<JobMilestone>) {
      const job = this.byId(jobId);
      if (!job) return null;
      const nextIdValue = nextNestedId(job.milestones);
      const normalized: JobMilestone = {
        id:
          milestone.id && Number(milestone.id) > 0
            ? Number(milestone.id)
            : nextIdValue,
        name: milestone.name?.trim() || "Untitled Milestone",
        startDate: milestone.startDate || undefined,
        dueDate: milestone.dueDate || undefined,
        dateOverride: Boolean(milestone.dateOverride),
        priority: milestone.priority ?? "Normal",
        note: milestone.note?.trim() || undefined,
      };
      const updatedMilestones = [...job.milestones, normalized];
      this.updateJob(jobId, { milestones: updatedMilestones });
      return normalized;
    },
    updateMilestone(
      jobId: number | string,
      milestoneId: number | string,
      patch: Partial<JobMilestone>,
    ) {
      const job = this.byId(jobId);
      if (!job) return null;
      const index = job.milestones.findIndex(
        (milestone) => String(milestone.id) === String(milestoneId),
      );
      if (index === -1) return null;
      const existing = job.milestones[index];
      const updated: JobMilestone = {
        ...existing,
        ...patch,
        name: patch.name?.trim() || existing.name,
        note: patch.note?.trim() || existing.note,
      };
      const milestones = [...job.milestones];
      milestones.splice(index, 1, updated);
      this.updateJob(jobId, { milestones });
      return updated;
    },
    removeMilestone(jobId: number | string, milestoneId: number | string) {
      const job = this.byId(jobId);
      if (!job) return;
      const milestones = job.milestones.filter(
        (milestone) => String(milestone.id) !== String(milestoneId),
      );
      const goals = job.goals.map((goal) =>
        String(goal.milestoneId) === String(milestoneId)
          ? { ...goal, milestoneId: null }
          : goal,
      );
      this.updateJob(jobId, { milestones, goals });
    },
    addGoal(jobId: number | string, goal: Partial<JobGoal>) {
      const job = this.byId(jobId);
      if (!job) return null;
      if (goal.milestoneId === undefined || goal.milestoneId === null)
        return null;
      const nextIdValue = nextNestedId(job.goals);
      const normalized: JobGoal = {
        id: goal.id && Number(goal.id) > 0 ? Number(goal.id) : nextIdValue,
        milestoneId: Number(goal.milestoneId),
        name: goal.name?.trim() || "Untitled Goal",
        startDate: goal.startDate || undefined,
        dueDate: goal.dueDate || undefined,
        dateOverride: Boolean(goal.dateOverride),
        priority: goal.priority ?? "Normal",
        note: goal.note?.trim() || undefined,
      };
      const updatedGoals = [...job.goals, normalized];
      this.updateJob(jobId, { goals: updatedGoals });
      return normalized;
    },
    updateGoal(
      jobId: number | string,
      goalId: number | string,
      patch: Partial<JobGoal>,
    ) {
      const job = this.byId(jobId);
      if (!job) return null;
      const index = job.goals.findIndex(
        (goal) => String(goal.id) === String(goalId),
      );
      if (index === -1) return null;
      const existing = job.goals[index];
      const updated: JobGoal = {
        ...existing,
        ...patch,
        name: patch.name?.trim() || existing.name,
        note: patch.note?.trim() || existing.note,
        milestoneId:
          patch.milestoneId === undefined
            ? existing.milestoneId
            : Number(patch.milestoneId),
      };
      const goals = [...job.goals];
      goals.splice(index, 1, updated);
      this.updateJob(jobId, { goals });
      return updated;
    },
    removeGoal(jobId: number | string, goalId: number | string) {
      const job = this.byId(jobId);
      if (!job) return;
      const goals = job.goals.filter(
        (goal) => String(goal.id) !== String(goalId),
      );
      this.updateJob(jobId, { goals });
    },
    addStakeholder(
      jobId: number | string,
      stakeholder: Partial<JobStakeholder>,
    ) {
      const job = this.byId(jobId);
      if (!job) return null;
      const nextIdValue = nextNestedId(job.stakeholders);
      const normalized: JobStakeholder = {
        id:
          stakeholder.id && Number(stakeholder.id) > 0
            ? Number(stakeholder.id)
            : nextIdValue,
        contactId:
          stakeholder.contactId === null || stakeholder.contactId === undefined
            ? null
            : Number(stakeholder.contactId),
        role: stakeholder.role?.trim() || "Stakeholder",
      };
      const updatedStakeholders = [normalized, ...job.stakeholders];
      this.updateJob(jobId, { stakeholders: updatedStakeholders });
      return normalized;
    },
    updateStakeholder(
      jobId: number | string,
      stakeholderId: number | string,
      patch: Partial<JobStakeholder>,
    ) {
      const job = this.byId(jobId);
      if (!job) return null;
      const index = job.stakeholders.findIndex(
        (stakeholder) => String(stakeholder.id) === String(stakeholderId),
      );
      if (index === -1) return null;
      const existing = job.stakeholders[index];
      const updated: JobStakeholder = {
        ...existing,
        ...patch,
        role: patch.role?.trim() || existing.role,
        contactId:
          patch.contactId === undefined
            ? existing.contactId
            : patch.contactId === null
              ? null
              : Number(patch.contactId),
      };
      const stakeholders = [...job.stakeholders];
      stakeholders.splice(index, 1, updated);
      this.updateJob(jobId, { stakeholders });
      return updated;
    },
    removeStakeholder(jobId: number | string, stakeholderId: number | string) {
      const job = this.byId(jobId);
      if (!job) return;
      const stakeholders = job.stakeholders.filter(
        (stakeholder) => String(stakeholder.id) !== String(stakeholderId),
      );
      this.updateJob(jobId, { stakeholders });
    },
    replaceAll(jobs: JobProperties[]) {
      this.items = cloneJobsArray(jobs);
    },
  },
});
