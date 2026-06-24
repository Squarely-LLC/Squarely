import { paginateArray } from "@api-utils/paginateArray";
import is from "@sindresorhus/is";
import { destr } from "destr";
import { HttpResponse, http } from "msw";
import { db } from "./db";
import type { JobProperties, JobStatus } from "./types";
import {
  filterReadableResources,
  mapAuthorizationResource,
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";
import {
  generateJobProjectCode,
  normalizeProjectCode,
  parseJobOrderSequence,
} from "@/utils/jobProjectCode";

db.jobs = db.jobs.map((job) => ({ ...job }));
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

const positiveNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};
const normalizeJobFlag = (value: unknown) =>
  value === "High" ? "High" : "Normal";
const normalizeJobStatus = (value: unknown, fallback?: unknown): JobStatus => {
  const candidate = String(value ?? "").trim();
  if ((JOB_STATUS_VALUES as string[]).includes(candidate))
    return candidate as JobStatus;

  const fallbackCandidate = String(fallback ?? "").trim();
  if ((JOB_STATUS_VALUES as string[]).includes(fallbackCandidate))
    return fallbackCandidate as JobStatus;

  return (
    LEGACY_STAGE_STATUS_MAP[candidate] ??
    LEGACY_STAGE_STATUS_MAP[fallbackCandidate] ??
    "New"
  );
};
const nextJobOrderNumber = (createdAt = new Date()) => {
  const maxSequence = db.jobs
    .map((job) => parseJobOrderSequence(job.jobOrderNumber))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);
  const year = String(createdAt.getFullYear()).slice(-2);

  return `JO${year}/${String(maxSequence + 1).padStart(3, "0")}`;
};

export const handlerOperationsJobs = [
  http.get("/api/operations/jobs", ({ request }) => {
    const url = new URL(request.url);

    const q = url.searchParams.get("q");
    const stage = url.searchParams.get("stage");
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const flag = url.searchParams.get("flag");
    const sortBy = url.searchParams.get("sortBy");
    const itemsPerPage = url.searchParams.get("itemsPerPage");
    const page = url.searchParams.get("page");
    const orderBy = url.searchParams.get("orderBy");

    const searchQuery = is.string(q) ? q : undefined;
    const queryLower = (searchQuery ?? "").toString().toLowerCase();

    const sortByLocal = is.string(sortBy) ? sortBy : "";
    const orderByLocal =
      orderBy === "asc" || orderBy === "desc" ? orderBy : "asc";

    const parsedItemsPerPage = destr(itemsPerPage);
    const parsedPage = destr(page);

    const itemsPerPageLocal = is.number(parsedItemsPerPage)
      ? parsedItemsPerPage
      : 10;
    const pageLocal = is.number(parsedPage) ? parsedPage : 1;

    let filteredJobs = db.jobs.filter((job) => {
      const matchesQuery =
        !queryLower ||
        (job.jobOrderNumber &&
          job.jobOrderNumber.toLowerCase().includes(queryLower)) ||
        job.name.toLowerCase().includes(queryLower) ||
        (job.code && job.code.toLowerCase().includes(queryLower)) ||
        (job.location && job.location.toLowerCase().includes(queryLower));

      const matchesStage = stage ? job.stage === stage : true;
      const matchesStatus = status ? job.status === status : true;
      const matchesType = type ? job.type === type : true;
      const matchesFlag = flag ? job.flag === flag : true;

      return (
        matchesQuery &&
        matchesStage &&
        matchesStatus &&
        matchesType &&
        matchesFlag
      );
    });

    if (sortByLocal) {
      if (sortByLocal === "name") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.name.localeCompare(b.name);
          return b.name.localeCompare(a.name);
        });
      }
      if (sortByLocal === "jobOrderNumber") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc")
            return String(a.jobOrderNumber ?? "").localeCompare(
              String(b.jobOrderNumber ?? ""),
            );
          return String(b.jobOrderNumber ?? "").localeCompare(
            String(a.jobOrderNumber ?? ""),
          );
        });
      }
      if (sortByLocal === "code") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc")
            return String(a.code ?? "").localeCompare(String(b.code ?? ""));
          return String(b.code ?? "").localeCompare(String(a.code ?? ""));
        });
      }
      if (sortByLocal === "stage") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.stage.localeCompare(b.stage);
          return b.stage.localeCompare(a.stage);
        });
      }
      if (sortByLocal === "status") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc")
            return String(a.status ?? "").localeCompare(String(b.status ?? ""));
          return String(b.status ?? "").localeCompare(String(a.status ?? ""));
        });
      }
      if (sortByLocal === "type") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.type.localeCompare(b.type);
          return b.type.localeCompare(a.type);
        });
      }
      if (sortByLocal === "flag") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.flag.localeCompare(b.flag);
          return b.flag.localeCompare(a.flag);
        });
      }
      if (sortByLocal === "createdAt") {
        filteredJobs = filteredJobs.sort((a, b) => {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          if (orderByLocal === "asc") return aDate - bDate;
          return bDate - aDate;
        });
      }
    }

    filteredJobs = filterReadableResources("jobs", filteredJobs);
    const totalJobs = filteredJobs.length;

    if (itemsPerPageLocal !== -1) {
      filteredJobs = paginateArray(
        filteredJobs,
        itemsPerPageLocal,
        pageLocal,
      ) as JobProperties[];
    }

    return HttpResponse.json(
      {
        jobs: filteredJobs,
        totalJobs,
      },
      { status: 200 }
    );
  }),

  http.get("/api/operations/jobs/:id", ({ params }) => {
    const jobId = Number(params.id);
    const job = db.jobs.find((j) => j.id === jobId);

    if (!job) {
      return new HttpResponse(null, {
        status: 404,
        statusText: "Job Not Found",
      });
    }

    return HttpResponse.json(job, { status: 200 });
  }),

  http.post("/api/operations/jobs", async ({ request }) => {
    try {
      requireCurrentUserPermission("jobs", "create");
    } catch {
      return permissionDeniedResponse("jobs", "create");
    }

    const job = (await request.json()) as Partial<JobProperties>;
    const projectManagerId = positiveNumber(job.projectManagerId);
    const collaborators = Array.from(
      new Set([
        ...(projectManagerId ? [projectManagerId] : []),
        ...(Array.isArray(job.collaborators)
          ? job.collaborators
              .map((value) => positiveNumber(value))
              .filter((value): value is number => value !== null)
          : []),
      ]),
    );

    const createdAt = new Date().toISOString();
    const status = normalizeJobStatus(job.status, job.stage);
    const jobOrderNumber =
      job.jobOrderNumber || nextJobOrderNumber(new Date(createdAt));
    const name = String(job.name ?? "").trim() || "New Job";
    const code =
      normalizeProjectCode(job.code) ||
      generateJobProjectCode(
        name,
        db.jobs,
        parseJobOrderSequence(jobOrderNumber) ?? undefined,
      );
    const newJob: JobProperties = {
      id: db.jobs.length ? Math.max(...db.jobs.map((j) => j.id)) + 1 : 1,
      jobOrderNumber,
      name,
      code,
      avatar: job.avatar || null,
      startDate: job.startDate || null,
      endDate: job.endDate || null,
      location: job.location || null,
      stage: status,
      status,
      type: job.type || "Architecture",
      flag: normalizeJobFlag(job.flag),
      relatedTo: job.relatedTo || null,
      projectManagerId: projectManagerId ?? collaborators[0] ?? null,
      collaborators,
      note: job.note || null,
      stakeholders: job.stakeholders || [],
      milestones: job.milestones || [],
      goals: job.goals || [],
      stakeholderConnectionImportIds: Array.isArray(
        job.stakeholderConnectionImportIds,
      )
        ? job.stakeholderConnectionImportIds
        : [],
      statusAutomation: job.statusAutomation ?? null,
      createdAt,
    };

    db.jobs.push(newJob);

    return HttpResponse.json(newJob, { status: 201 });
  }),

  http.patch("/api/operations/jobs/:id", async ({ params, request }) => {
    const jobId = Number(params.id);
    const updates = (await request.json()) as Partial<JobProperties>;

    const jobIndex = db.jobs.findIndex((j) => j.id === jobId);

    if (jobIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
        statusText: "Job Not Found",
      });
    }
    try {
      requireCurrentUserPermission(
        "jobs",
        "update",
        mapAuthorizationResource("jobs", db.jobs[jobIndex]),
      );
    } catch {
      return permissionDeniedResponse("jobs", "update");
    }

    const merged = {
      ...db.jobs[jobIndex],
      ...updates,
      id: jobId,
    };
    const status = normalizeJobStatus(merged.status, merged.stage);
    const projectManagerId = positiveNumber(merged.projectManagerId);
    const collaborators = Array.from(
      new Set([
        ...(projectManagerId ? [projectManagerId] : []),
        ...(Array.isArray(merged.collaborators)
          ? merged.collaborators
              .map((value) => positiveNumber(value))
              .filter((value): value is number => value !== null)
          : []),
      ]),
    );

    db.jobs[jobIndex] = {
      ...merged,
      jobOrderNumber:
        merged.jobOrderNumber ||
        nextJobOrderNumber(new Date(merged.createdAt || new Date())),
      status,
      stage: status,
      flag: normalizeJobFlag(merged.flag),
      projectManagerId: projectManagerId ?? collaborators[0] ?? null,
      collaborators,
      stakeholderConnectionImportIds: Array.isArray(
        merged.stakeholderConnectionImportIds,
      )
        ? merged.stakeholderConnectionImportIds
        : [],
      statusAutomation: merged.statusAutomation ?? null,
    };

    return HttpResponse.json(db.jobs[jobIndex], { status: 200 });
  }),

  http.delete("/api/operations/jobs/:id", ({ params }) => {
    const jobId = Number(params.id);
    const jobIndex = db.jobs.findIndex((j) => j.id === jobId);

    if (jobIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
        statusText: "Job Not Found",
      });
    }
    try {
      requireCurrentUserPermission(
        "jobs",
        "delete",
        mapAuthorizationResource("jobs", db.jobs[jobIndex]),
      );
    } catch {
      return permissionDeniedResponse("jobs", "delete");
    }

    db.jobs.splice(jobIndex, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
