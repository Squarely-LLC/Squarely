import { paginateArray } from "@api-utils/paginateArray";
import { db } from "@db/apps/employees/db";
import is from "@sindresorhus/is";
import { destr } from "destr";
import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import type { EmployeeProperties } from "./types";
import {
  filterReadableResources,
  mapAuthorizationResource,
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";

db.users = db.users.map((employee) => ({ ...employee }));

export const handlerAppsEmployees = [
  http.get("/api/apps/employees", ({ request }) => {
    const url = new URL(request.url);

    const q = url.searchParams.get("q");
    const contactClass = url.searchParams.get("class");
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
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

    let filteredUsers = db.users.filter((user) => {
      const matchesQuery =
        !queryLower ||
        user.fullName.toLowerCase().includes(queryLower) ||
        user.email.toLowerCase().includes(queryLower) ||
        user.number.toLowerCase().includes(queryLower);

      const matchesClass = contactClass ? user.class === contactClass : true;
      const matchesCategory = category ? user.category === category : true;
      const matchesStatus = status ? user.status === status : true;
      const matchesChannel = channel ? user.channel === channel : true;

      return (
        matchesQuery &&
        matchesClass &&
        matchesCategory &&
        matchesStatus &&
        matchesChannel
      );
    });

    if (sortByLocal) {
      if (sortByLocal === "user") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc")
            return a.fullName.localeCompare(b.fullName);
          return b.fullName.localeCompare(a.fullName);
        });
      }
      if (sortByLocal === "class") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc")
            return (a.class ?? "").localeCompare(b.class ?? "");
          return (b.class ?? "").localeCompare(a.class ?? "");
        });
      }
      if (sortByLocal === "number") {
        const normalizeNumber = (value?: string) =>
          (value ?? "").replace(/\D/g, "");

        filteredUsers = filteredUsers.sort((a, b) => {
          const aNumber = normalizeNumber(a.number);
          const bNumber = normalizeNumber(b.number);

          if (orderByLocal === "asc") return aNumber.localeCompare(bNumber);
          return bNumber.localeCompare(aNumber);
        });
      }
      if (sortByLocal === "email") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc") return a.email.localeCompare(b.email);
          return b.email.localeCompare(a.email);
        });
      }
      if (sortByLocal === "status") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc") return a.status.localeCompare(b.status);
          return b.status.localeCompare(a.status);
        });
      }
      if (sortByLocal === "category") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc")
            return (a.category ?? "").localeCompare(b.category ?? "");
          return (b.category ?? "").localeCompare(a.category ?? "");
        });
      }
      if (sortByLocal === "channel") {
        filteredUsers = filteredUsers.sort((a, b) => {
          if (orderByLocal === "asc") return a.channel.localeCompare(b.channel);
          return b.channel.localeCompare(a.channel);
        });
      }
      if (sortByLocal === "createdAt") {
        filteredUsers = filteredUsers.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return orderByLocal === "asc" ? aTime - bTime : bTime - aTime;
        });
      }
    }

    filteredUsers = filterReadableResources("hr", filteredUsers);
    const totalUsers = filteredUsers.length;
    const totalPages = Math.ceil(totalUsers / itemsPerPageLocal);

    return HttpResponse.json(
      {
        users: paginateArray(filteredUsers, itemsPerPageLocal, pageLocal),
        totalPages,
        totalUsers,
        page: pageLocal > Math.ceil(totalUsers / itemsPerPageLocal) ? 1 : page,
      },
      { status: 200 }
    );
  }),

  http.get<PathParams>("/api/apps/employees/:id", ({ params }) => {
    const userId = Number(params.id);

    const user =
      filterReadableResources("hr", db.users).find(
        (entry) => entry.id === userId,
      ) ?? null;

    if (!user) {
      return HttpResponse.json({ message: "User not found" }, { status: 404 });
    }

    return HttpResponse.json(
      {
        ...user,
      },
      { status: 200 }
    );
  }),

  http.delete("/api/apps/employees/:id", ({ params }) => {
    const userId = Number(params.id);

    const index = db.users.findIndex((entry) => entry.id === userId);

    if (index === -1)
      return HttpResponse.json("User not found", { status: 404 });
    try {
      requireCurrentUserPermission(
        "hr",
        "delete",
        mapAuthorizationResource("hr", db.users[index]),
      );
    } catch {
      return permissionDeniedResponse("hr", "delete");
    }

    db.users.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  http.put("/api/apps/employees/:id", async ({ params, request }) => {
    const userId = Number(params.id);
    const body = (await request.json()) as Partial<EmployeeProperties>;

    const { accounting: incomingAccounting, ...restBody } = body;

    const index = db.users.findIndex((entry) => entry.id === userId);
    if (index === -1)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });
    try {
      requireCurrentUserPermission(
        "hr",
        "update",
        mapAuthorizationResource("hr", db.users[index]),
      );
    } catch {
      return permissionDeniedResponse("hr", "update");
    }

    const nextAccounting = {
      taxId:
        incomingAccounting?.taxId ?? db.users[index].accounting.taxId ?? "",
      crn: incomingAccounting?.crn ?? db.users[index].accounting.crn ?? "",
      vatNumber:
        incomingAccounting?.vatNumber ??
        db.users[index].accounting.vatNumber ??
        "",
    };

    db.users[index] = {
      ...db.users[index],
      ...restBody,
      accounting: nextAccounting,
    };

    return HttpResponse.json(db.users[index], { status: 200 });
  }),

  http.post("/api/apps/employees/:id/records", async ({ params, request }) => {
    try {
      requireCurrentUserPermission("hr", "update");
    } catch {
      return permissionDeniedResponse("hr", "update");
    }

    const userId = Number(params.id);
    const payload = (await request.json()) as any;

    const index = db.users.findIndex((entry) => entry.id === userId);
    if (index === -1)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });

    const incomingRecord = {
      id: payload.id ?? Date.now(),
      type: payload.type ?? "note",
      title: payload.title ?? undefined,
      body: payload.body ?? undefined,
      author: payload.author ?? null,
      attachments: Array.isArray(payload.attachments)
        ? payload.attachments
        : [],
      createdAt: payload.createdAt || new Date().toISOString(),
    };

    if (!Array.isArray(db.users[index].records)) db.users[index].records = [];
    // prepend so newest first
    db.users[index].records.unshift(incomingRecord);

    return HttpResponse.json(
      {
        record: incomingRecord,
        employee: {
          ...db.users[index],
        },
      },
      { status: 201 }
    );
  }),

  http.put(
    "/api/apps/employees/:id/records/:rid",
    async ({ params, request }) => {
      try {
        requireCurrentUserPermission("hr", "update");
      } catch {
        return permissionDeniedResponse("hr", "update");
      }

      const userId = Number(params.id);
      const recordId = Number(params.rid);
      const payload = (await request.json()) as any;

      const index = db.users.findIndex((entry) => entry.id === userId);
      if (index === -1)
        return HttpResponse.json(
          { message: "User not found" },
          { status: 404 }
        );

      if (!Array.isArray(db.users[index].records)) db.users[index].records = [];

      const ridx = db.users[index].records.findIndex(
        (r) => Number(r.id) === recordId
      );
      if (ridx === -1)
        return HttpResponse.json(
          { message: "Record not found" },
          { status: 404 }
        );

      db.users[index].records[ridx] = {
        ...db.users[index].records[ridx],
        ...payload,
      };

      return HttpResponse.json(
        {
          record: db.users[index].records[ridx],
          employee: {
            ...db.users[index],
          },
        },
        { status: 200 }
      );
    }
  ),

  http.delete("/api/apps/employees/:id/records/:rid", ({ params }) => {
    try {
      requireCurrentUserPermission("hr", "update");
    } catch {
      return permissionDeniedResponse("hr", "update");
    }

    const userId = Number(params.id);
    const recordId = Number(params.rid);

    const index = db.users.findIndex((entry) => entry.id === userId);
    if (index === -1)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });

    if (!Array.isArray(db.users[index].records)) db.users[index].records = [];

    const ridx = db.users[index].records.findIndex(
      (r) => Number(r.id) === recordId
    );
    if (ridx === -1)
      return HttpResponse.json(
        { message: "Record not found" },
        { status: 404 }
      );

    db.users[index].records.splice(ridx, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/apps/employees", async ({ request }) => {
    try {
      requireCurrentUserPermission("hr", "create");
    } catch {
      return permissionDeniedResponse("hr", "create");
    }

    const payload = (await request.json()) as any;

    const { accounting: incomingAccounting, ...restPayload } = payload;

    const accounting = {
      taxId: incomingAccounting?.taxId ?? "",
      crn: incomingAccounting?.crn ?? "",
      vatNumber: incomingAccounting?.vatNumber ?? "",
    };

    const newEmployee = {
      ...restPayload,
      id:
        Math.max(100, ...db.users.map((employee) => Number(employee.id) || 0)) +
        1,
      accounting,
    };

    db.users.push(newEmployee);

    return HttpResponse.json(newEmployee, { status: 201 });
  }),
];
