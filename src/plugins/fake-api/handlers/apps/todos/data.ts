import { paginateArray } from "@api-utils/paginateArray";
import {
  getRequestScope,
  inCenterScope,
} from "@/plugins/fake-api/handlers/utils/requestScope";
import { db } from "@db/apps/todos/db";
import is from "@sindresorhus/is";
import { destr } from "destr";
import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";

const toDateOnlyISOString = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).toISOString();
};

export const handlerAppsTodos = [
  // 👉 list & filter todos
  http.get("/api/apps/todos", ({ request }) => {
    const scope = getRequestScope(request);
    const url = new URL(request.url);

    const q = url.searchParams.get("q");
    const status = url.searchParams.get("status"); // pending | in_progress | for_review | completed
    const priority = url.searchParams.get("priority"); // low | normal | high
    const important = url.searchParams.get("important"); // 'true' | 'false'
    const collaboratorId = url.searchParams.get("collaboratorId"); // numeric id
    const sortBy = url.searchParams.get("sortBy"); // title | dueAt | priority | status | important | createdAt
    const orderBy = url.searchParams.get("orderBy"); // asc | desc
    const itemsPerPage = url.searchParams.get("itemsPerPage");
    const page = url.searchParams.get("page");

    const queryLower = (is.string(q) ? q : "").toLowerCase();
    const parsedItemsPerPage = destr(itemsPerPage);
    const parsedPage = destr(page);
    const ipp = is.number(parsedItemsPerPage) ? parsedItemsPerPage : 10;
    const pageLocal = is.number(parsedPage) ? parsedPage : 1;

    const parsedSortBy = destr(sortBy);
    const sortByLocal = is.string(parsedSortBy) ? parsedSortBy : "";
    const parsedOrderBy = destr(orderBy);
    const orderByLocal = is.string(parsedOrderBy) ? parsedOrderBy : "desc";

    const importantFilter =
      important === null ? undefined : important === "true";
    const collaboratorIdNum = collaboratorId
      ? Number(collaboratorId)
      : undefined;

    // filter
    let filtered = db.todos.filter((t) => {
      if (!inCenterScope(t, scope.centerId)) return false;

      const matchesQuery =
        t.title.toLowerCase().includes(queryLower) ||
        (t.notes?.toLowerCase().includes(queryLower) ?? false);

      const matchesStatus = status ? t.status === status : true;
      const matchesPriority = priority ? t.priority === priority : true;
      const matchesImportant =
        importantFilter === undefined ? true : t.important === importantFilter;
      const matchesCollaborator = collaboratorIdNum
        ? (t.collaborators ?? []).some(
            (c) => Number(c.id) === collaboratorIdNum,
          )
        : true;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesPriority &&
        matchesImportant &&
        matchesCollaborator
      );
    });

    // sort
    if (sortByLocal) {
      filtered = filtered.sort((a, b) => {
        const dir = orderByLocal === "asc" ? 1 : -1;
        const val = (key: any) => key ?? "";
        switch (sortByLocal) {
          case "title":
            return dir * val(a.title).localeCompare(val(b.title));
          case "priority":
            return dir * val(a.priority).localeCompare(val(b.priority));
          case "status":
            return dir * val(a.status).localeCompare(val(b.status));
          case "important":
            return (
              dir * (a.important === b.important ? 0 : a.important ? 1 : -1)
            );
          case "dueAt":
            return (
              dir * (new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            );
          case "createdAt":
            return (
              dir *
              (new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime())
            );
          default:
            return 0;
        }
      });
    } else {
      // default newest first by updatedAt
      filtered = filtered.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / ipp) || 1;

    return HttpResponse.json(
      {
        todos: paginateArray(filtered, ipp, pageLocal),
        totalPages,
        totalTodos: total,
        page: pageLocal > totalPages ? 1 : pageLocal,
      },
      { status: 200 },
    );
  }),

  // 👉 get one
  http.get<PathParams>("/api/apps/todos/:id", ({ params, request }) => {
    const scope = getRequestScope(request);
    const id = Number(params.id);
    const todo = db.todos.find(
      (t) => t.id === id && inCenterScope(t, scope.centerId),
    );
    return todo
      ? HttpResponse.json(todo, { status: 200 })
      : HttpResponse.json({ message: "ToDo not found" }, { status: 404 });
  }),

  // 👉 create
  http.post("/api/apps/todos", async ({ request }) => {
    const scope = getRequestScope(request);
    const payload = (await request.json()) as any;

    const providedId = Number(payload.id);
    const hasProvidedId = Number.isFinite(providedId) && providedId > 0;

    const resolvedId = hasProvidedId
      ? providedId
      : (db.todos.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0) || 0) + 1;

    const existingIdx = db.todos.findIndex((t) => Number(t.id) === resolvedId);
    const existing = existingIdx === -1 ? undefined : db.todos[existingIdx];

    const now = new Date().toISOString();

    const normalizeSteps = (steps: any[] | undefined, fallback: any[] = []) => {
      const source = Array.isArray(steps) ? steps : fallback;
      return Array.isArray(source)
        ? source.map((step) => ({
            ...step,
            dueAt: toDateOnlyISOString(step?.dueAt),
          }))
        : [];
    };

    const newTodo = {
      id: resolvedId,
      title: payload.title ?? existing?.title ?? "Untitled",
      collaborators: payload.collaborators ?? existing?.collaborators ?? [],
      dueAt: toDateOnlyISOString(payload.dueAt ?? existing?.dueAt ?? now),
      priority: payload.priority ?? existing?.priority ?? "normal",
      important: payload.important ?? existing?.important ?? false,
      status: payload.status ?? existing?.status ?? "pending",
      steps: normalizeSteps(payload.steps, existing?.steps ?? []),
      notes: payload.notes ?? existing?.notes ?? "",
      activities: payload.activities ?? existing?.activities ?? [],
      messages: payload.messages ?? existing?.messages ?? [],
      centerId: payload.centerId ?? existing?.centerId ?? scope.centerId ?? 1,
      ownerUserId: payload.ownerUserId ?? existing?.ownerUserId ?? scope.userId,
      createdAt: payload.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingIdx !== -1) {
      db.todos.splice(existingIdx, 1, newTodo);
      return HttpResponse.json(newTodo, { status: 200 });
    }

    db.todos.unshift(newTodo);
    return HttpResponse.json(newTodo, { status: hasProvidedId ? 200 : 201 });
  }),

  // 👉 update (partial)
  http.patch<PathParams>("/api/apps/todos/:id", async ({ params, request }) => {
    const scope = getRequestScope(request);
    const id = Number(params.id);
    const idx = db.todos.findIndex(
      (t) => Number(t.id) === id && inCenterScope(t, scope.centerId),
    );
    if (idx === -1)
      return HttpResponse.json({ message: "ToDo not found" }, { status: 404 });

    const patch = (await request.json()) as any;
    const normalizedPatch = { ...patch };
    if ("dueAt" in normalizedPatch)
      normalizedPatch.dueAt = toDateOnlyISOString(normalizedPatch.dueAt);
    if (Array.isArray(normalizedPatch.steps)) {
      normalizedPatch.steps = normalizedPatch.steps.map((step: any) => ({
        ...step,
        dueAt: toDateOnlyISOString(step?.dueAt),
      }));
    }

    const updated = {
      ...db.todos[idx],
      ...normalizedPatch,
      updatedAt: new Date().toISOString(),
    };
    db.todos[idx] = updated;
    return HttpResponse.json(updated, { status: 200 });
  }),

  // 👉 delete
  http.delete<PathParams>("/api/apps/todos/:id", ({ params, request }) => {
    const scope = getRequestScope(request);
    const id = Number(params.id);
    const idx = db.todos.findIndex(
      (t) => t.id === id && inCenterScope(t, scope.centerId),
    );
    if (idx === -1)
      return HttpResponse.json({ message: "ToDo not found" }, { status: 404 });

    db.todos.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // (optional) expose contacts your todos reference
  http.get("/api/apps/todos/contacts", () => {
    return HttpResponse.json(
      { contacts: Object.values(db.contacts) },
      { status: 200 },
    );
  }),
];
