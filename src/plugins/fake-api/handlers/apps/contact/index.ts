import { paginateArray } from "@api-utils/paginateArray";
import {
  getRequestScope,
  inCenterScope,
} from "@/plugins/fake-api/handlers/utils/requestScope";
import { db } from "@db/apps/contact/db";
import is from "@sindresorhus/is";
import { destr } from "destr";
import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import type { ContactProperties } from "./types";

const normalizeConnections = (
  connections?: ContactProperties["connections"]
) => {
  if (!Array.isArray(connections)) return [];

  let primaryIndex = -1;

  connections.forEach((connection, index) => {
    if (connection?.isPrimary) primaryIndex = index;
  });

  return connections.map(({ picture, ...connection }, index) => ({
    ...connection,
    isPrimary: primaryIndex === index && primaryIndex !== -1,
  }));
};

const buildContactLookup = (contacts: ContactProperties[] = db.users) =>
  new Map(contacts.map((contact) => [contact.id, contact]));

const hydrateConnections = (
  connections: ContactProperties["connections"],
  contactLookup: Map<number, ContactProperties>
) =>
  normalizeConnections(connections).map((connection) => {
    const linked = contactLookup.get(connection.contactId);
    return {
      ...connection,
      contactName: linked?.fullName ?? connection.contactName,
      picture: linked?.picture ?? "",
    };
  });

db.users = db.users.map((contact) => ({
  ...contact,
  connections: normalizeConnections(contact.connections),
}));

export const handlerAppsContacts = [
  http.get("/api/apps/contacts", ({ request }) => {
    const scope = getRequestScope(request);
    const url = new URL(request.url);

    const q = url.searchParams.get("q");
    const contactClass = url.searchParams.get("class");
    const contactType = url.searchParams.get("type");
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

    const scopedUsers = db.users.filter((user) =>
      inCenterScope(user, scope.centerId),
    );

    let filteredUsers = scopedUsers.filter((user) => {
      const matchesQuery =
        !queryLower ||
        user.fullName.toLowerCase().includes(queryLower) ||
        user.email.toLowerCase().includes(queryLower) ||
        user.number.toLowerCase().includes(queryLower);

      const matchesClass = contactClass ? user.class === contactClass : true;
      const matchesType = contactType ? user.type === contactType : true;
      const matchesCategory = category ? user.category === category : true;
      const matchesStatus = status ? user.status === status : true;
      const matchesChannel = channel ? user.channel === channel : true;

      return (
        matchesQuery &&
        matchesClass &&
        matchesType &&
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
          if (orderByLocal === "asc") return a.class.localeCompare(b.class);
          return b.class.localeCompare(a.class);
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
            return a.category.localeCompare(b.category);
          return b.category.localeCompare(a.category);
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

    const contactLookup = buildContactLookup(scopedUsers);

    const hydratedUsers = filteredUsers.map((user) => ({
      ...user,
      connections: hydrateConnections(user.connections, contactLookup),
    }));

    const totalUsers = hydratedUsers.length;
    const totalPages = Math.ceil(totalUsers / itemsPerPageLocal);

    return HttpResponse.json(
      {
        users: paginateArray(hydratedUsers, itemsPerPageLocal, pageLocal),
        totalPages,
        totalUsers,
        page: pageLocal > Math.ceil(totalUsers / itemsPerPageLocal) ? 1 : page,
      },
      { status: 200 }
    );
  }),

  http.get<PathParams>("/api/apps/contacts/:id", ({ params, request }) => {
    const scope = getRequestScope(request);
    const userId = Number(params.id);

    const user = db.users.find(
      (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
    );

    if (!user) {
      return HttpResponse.json({ message: "User not found" }, { status: 404 });
    }

    const contactLookup = buildContactLookup(
      db.users.filter((entry) => inCenterScope(entry, scope.centerId)),
    );

    return HttpResponse.json(
      {
        ...user,
        connections: hydrateConnections(user.connections, contactLookup),
      },
      { status: 200 }
    );
  }),

  http.delete("/api/apps/contacts/:id", ({ params, request }) => {
    const scope = getRequestScope(request);
    const userId = Number(params.id);

    const index = db.users.findIndex(
      (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
    );

    if (index === -1)
      return HttpResponse.json("User not found", { status: 404 });

    db.users.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  http.put("/api/apps/contacts/:id", async ({ params, request }) => {
    const scope = getRequestScope(request);
    const userId = Number(params.id);
    const body = (await request.json()) as Partial<ContactProperties>;

    const {
      connections: incomingConnections,
      accounting: incomingAccounting,
      ...restBody
    } = body;

    const index = db.users.findIndex(
      (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
    );
    if (index === -1)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });

    const nextAccounting = {
      taxId:
        incomingAccounting?.taxId ?? db.users[index].accounting.taxId ?? "",
      crn: incomingAccounting?.crn ?? db.users[index].accounting.crn ?? "",
      vatNumber:
        incomingAccounting?.vatNumber ??
        db.users[index].accounting.vatNumber ??
        "",
    };

    const normalizedConnections = Array.isArray(incomingConnections)
      ? normalizeConnections(incomingConnections)
      : normalizeConnections(db.users[index].connections);

    db.users[index] = {
      ...db.users[index],
      ...restBody,
      accounting: nextAccounting,
      connections: normalizedConnections,
    };

    const contactLookup = buildContactLookup(
      db.users.filter((entry) => inCenterScope(entry, scope.centerId)),
    );

    return HttpResponse.json(
      {
        ...db.users[index],
        connections: hydrateConnections(
          db.users[index].connections,
          contactLookup
        ),
      },
      { status: 200 }
    );
  }),

  http.post("/api/apps/contacts/:id/records", async ({ params, request }) => {
    const scope = getRequestScope(request);
    const userId = Number(params.id);
    const payload = (await request.json()) as any;

    const index = db.users.findIndex(
      (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
    );
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

    const contactLookup = buildContactLookup(
      db.users.filter((entry) => inCenterScope(entry, scope.centerId)),
    );

    return HttpResponse.json(
      {
        record: incomingRecord,
        contact: {
          ...db.users[index],
          connections: hydrateConnections(
            db.users[index].connections,
            contactLookup
          ),
        },
      },
      { status: 201 }
    );
  }),

  http.put(
    "/api/apps/contacts/:id/records/:rid",
    async ({ params, request }) => {
      const scope = getRequestScope(request);
      const userId = Number(params.id);
      const recordId = Number(params.rid);
      const payload = (await request.json()) as any;

      const index = db.users.findIndex(
        (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
      );
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

      const contactLookup = buildContactLookup(
        db.users.filter((entry) => inCenterScope(entry, scope.centerId)),
      );

      return HttpResponse.json(
        {
          record: db.users[index].records[ridx],
          contact: {
            ...db.users[index],
            connections: hydrateConnections(
              db.users[index].connections,
              contactLookup
            ),
          },
        },
        { status: 200 }
      );
    }
  ),

  http.delete("/api/apps/contacts/:id/records/:rid", ({ params, request }) => {
    const scope = getRequestScope(request);
    const userId = Number(params.id);
    const recordId = Number(params.rid);

    const index = db.users.findIndex(
      (entry) => entry.id === userId && inCenterScope(entry, scope.centerId),
    );
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

  http.post("/api/apps/contacts", async ({ request }) => {
    const scope = getRequestScope(request);
    const payload = (await request.json()) as any;

    const {
      connections: incomingConnections,
      accounting: incomingAccounting,
      ...restPayload
    } = payload;

    const accounting = {
      taxId: incomingAccounting?.taxId ?? "",
      crn: incomingAccounting?.crn ?? "",
      vatNumber: incomingAccounting?.vatNumber ?? "",
    };

    const normalizedConnections = normalizeConnections(incomingConnections);

    db.users.push({
      ...restPayload,
      id: db.users.length + 1,
      accounting,
      connections: normalizedConnections,
      centerId: payload.centerId ?? scope.centerId ?? 1,
      ownerUserId: payload.ownerUserId ?? scope.userId,
    });

    return HttpResponse.json({ body: payload }, { status: 201 });
  }),
];
