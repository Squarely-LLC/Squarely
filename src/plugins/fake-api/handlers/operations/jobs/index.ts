import { paginateArray } from "@api-utils/paginateArray";
import is from "@sindresorhus/is";
import { destr } from "destr";
import { HttpResponse, http } from "msw";
import { db } from "./db";
import type { JobProperties } from "./types";
import {
  filterReadableResources,
  mapAuthorizationResource,
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";

db.jobs = db.jobs.map((job) => ({ ...job }));

const positiveNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

export const handlerOperationsJobs = [
  http.get("/api/operations/jobs", ({ request }) => {
    const url = new URL(request.url);

    const q = url.searchParams.get("q");
    const stage = url.searchParams.get("stage");
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
        job.name.toLowerCase().includes(queryLower) ||
        (job.code && job.code.toLowerCase().includes(queryLower)) ||
        (job.location && job.location.toLowerCase().includes(queryLower));

      const matchesStage = stage ? job.stage === stage : true;
      const matchesType = type ? job.type === type : true;
      const matchesFlag = flag ? job.flag === flag : true;

      return matchesQuery && matchesStage && matchesType && matchesFlag;
    });

    if (sortByLocal) {
      if (sortByLocal === "name") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.name.localeCompare(b.name);
          return b.name.localeCompare(a.name);
        });
      }
      if (sortByLocal === "stage") {
        filteredJobs = filteredJobs.sort((a, b) => {
          if (orderByLocal === "asc") return a.stage.localeCompare(b.stage);
          return b.stage.localeCompare(a.stage);
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

    const newJob: JobProperties = {
      id: db.jobs.length ? Math.max(...db.jobs.map((j) => j.id)) + 1 : 1,
      name: job.name || "New Job",
      code: job.code || null,
      avatar: job.avatar || null,
      startDate: job.startDate || null,
      endDate: job.endDate || null,
      location: job.location || null,
      stage: job.stage || "PRPSL",
      type: job.type || "Architecture",
      flag: job.flag || "Normal",
      relatedTo: job.relatedTo || null,
      projectManagerId: projectManagerId ?? collaborators[0] ?? null,
      collaborators,
      note: job.note || null,
      stakeholders: job.stakeholders || [],
      milestones: job.milestones || [],
      goals: job.goals || [],
      createdAt: new Date().toISOString(),
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
      projectManagerId: projectManagerId ?? collaborators[0] ?? null,
      collaborators,
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
