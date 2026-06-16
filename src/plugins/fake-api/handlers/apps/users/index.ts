import { paginateArray } from "@api-utils/paginateArray";
import is from "@sindresorhus/is";
import { destr } from "destr";
import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import { ensureAccountEmployeeLink } from "@/utils/accountEmployeeLink";
import {
  loadAccountRoleState,
  publicUser,
  saveAccountRoleState,
  type AccountUserRecord,
} from "@/utils/accountRoles";
import {
  permissionDeniedResponse,
  requireCurrentUserPermission,
} from "@/utils/authorization";

const normalizeEmail = (email?: string | null) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

const usernameFromEmail = (email: string) =>
  email.split("@")[0]?.replace(/[^a-z0-9_.-]/gi, "") || "user";

const toTableUser = (user: AccountUserRecord) => {
  const state = loadAccountRoleState();
  const role = state.roles.find((entry) => entry.id === user.roleId);

  return {
    ...publicUser(user, role),
    company: user.centerId,
    role: role?.name ?? user.roleId,
    contact: "",
    country: "",
    currentPlan: user.temporaryPassword ? "temporary password" : "standard",
    billing: user.isMaster ? "Master Account" : "Center Account",
    temporaryPasswordValue: user.temporaryPassword ? user.password : null,
  };
};

export const handlerAppsUsers = [
  http.get("/api/apps/users", ({ request }) => {
    const state = loadAccountRoleState();
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");
    const sortBy = url.searchParams.get("sortBy");
    const orderBy = url.searchParams.get("orderBy");
    const itemsPerPage = destr(url.searchParams.get("itemsPerPage"));
    const page = destr(url.searchParams.get("page"));
    const itemsPerPageLocal = is.number(itemsPerPage) ? itemsPerPage : 10;
    const pageLocal = is.number(page) ? page : 1;
    const queryLower = String(q ?? "").toLowerCase();

    let filteredUsers = state.users.map(toTableUser).filter((user) => {
      const matchesQuery =
        user.fullName.toLowerCase().includes(queryLower) ||
        user.email.toLowerCase().includes(queryLower);
      const matchesRole = role
        ? user.roleId === role || user.role === role
        : true;
      const matchesStatus = status ? user.status === status : true;

      return matchesQuery && matchesRole && matchesStatus;
    });

    const sortKey = is.string(destr(sortBy)) ? String(destr(sortBy)) : "";
    const direction = is.string(destr(orderBy)) ? String(destr(orderBy)) : "";
    if (sortKey) {
      filteredUsers = filteredUsers.sort((a, b) => {
        const left = String((a as any)[sortKey] ?? "");
        const right = String((b as any)[sortKey] ?? "");
        return direction === "asc"
          ? left.localeCompare(right)
          : right.localeCompare(left);
      });
    } else {
      filteredUsers.reverse();
    }

    return HttpResponse.json({
      users: paginateArray(filteredUsers, itemsPerPageLocal, pageLocal),
      totalPages: Math.ceil(filteredUsers.length / itemsPerPageLocal),
      totalUsers: filteredUsers.length,
      page: pageLocal,
    });
  }),

  http.get<PathParams>("/api/apps/users/:id", ({ params }) => {
    const state = loadAccountRoleState();
    const user = state.users.find(
      (entry) => String(entry.id) === String(params.id),
    );
    if (!user)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });

    return HttpResponse.json(toTableUser(user));
  }),

  http.delete<PathParams>("/api/apps/users/:id", ({ params }) => {
    try {
      requireCurrentUserPermission("usersRoles", "delete");
    } catch {
      return permissionDeniedResponse("usersRoles", "delete");
    }

    const state = loadAccountRoleState();
    const index = state.users.findIndex(
      (entry) => String(entry.id) === String(params.id),
    );
    if (index === -1)
      return HttpResponse.json("User not found", { status: 404 });
    if (state.users[index].isMaster)
      return HttpResponse.json("The master account cannot be deleted.", {
        status: 403,
      });

    state.users.splice(index, 1);
    saveAccountRoleState(state);

    return new HttpResponse(null, { status: 204 });
  }),

  http.put<PathParams>("/api/apps/users/:id", async ({ params, request }) => {
    try {
      requireCurrentUserPermission("usersRoles", "update");
    } catch {
      return permissionDeniedResponse("usersRoles", "update");
    }

    const payload = (await request.json()) as Partial<AccountUserRecord> & {
      role?: string;
    };
    const state = loadAccountRoleState();
    const index = state.users.findIndex(
      (entry) => String(entry.id) === String(params.id),
    );
    if (index === -1)
      return HttpResponse.json({ message: "User not found" }, { status: 404 });

    const user = state.users[index];
    const role =
      payload.roleId || payload.role
        ? state.roles.find((entry) => entry.id === payload.roleId) ||
          state.roles.find((entry) => entry.name === payload.role)
        : state.roles.find((entry) => entry.id === user.roleId);

    if (!role)
      return HttpResponse.json(
        { message: "Role is required." },
        { status: 400 },
      );

    if (user.isMaster) {
      if (role.id !== user.roleId)
        return HttpResponse.json(
          { message: "The master account role cannot be changed." },
          { status: 403 },
        );
      if (payload.status && payload.status !== user.status)
        return HttpResponse.json(
          { message: "The master account cannot be deactivated." },
          { status: 403 },
        );
    }

    const email =
      payload.email !== undefined ? normalizeEmail(payload.email) : user.email;
    if (!email)
      return HttpResponse.json(
        { message: "Email is required." },
        { status: 400 },
      );
    if (
      email !== normalizeEmail(user.email) &&
      state.users.some(
        (entry) => entry.id !== user.id && normalizeEmail(entry.email) === email,
      )
    )
      return HttpResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 },
      );

    user.fullName =
      payload.fullName !== undefined
        ? String(payload.fullName || email).trim()
        : user.fullName;
    user.email = email;
    user.username = usernameFromEmail(email);
    user.roleId = role.id;
    user.status = payload.status || user.status;
    if (payload.avatar !== undefined) user.avatar = payload.avatar || null;
    if (payload.password && String(payload.password).trim()) {
      user.password = String(payload.password).trim();
      user.temporaryPassword = payload.temporaryPassword ?? true;
    }
    user.updatedAt = new Date().toISOString();
    saveAccountRoleState(state);

    return HttpResponse.json(toTableUser(user));
  }),

  http.post("/api/apps/users", async ({ request }) => {
    try {
      requireCurrentUserPermission("usersRoles", "create");
    } catch {
      return permissionDeniedResponse("usersRoles", "create");
    }

    const payload = (await request.json()) as Partial<AccountUserRecord> & {
      role?: string;
      password?: string;
    };
    const state = loadAccountRoleState();
    const email = normalizeEmail(payload.email);
    if (!email)
      return HttpResponse.json(
        { message: "Email is required." },
        { status: 400 },
      );
    if (state.users.some((user) => normalizeEmail(user.email) === email))
      return HttpResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 },
      );

    const role =
      state.roles.find((entry) => entry.id === payload.roleId) ||
      state.roles.find((entry) => entry.name === payload.role) ||
      state.roles.find((entry) => entry.name === "Admin");

    if (!role)
      return HttpResponse.json(
        { message: "Role is required." },
        { status: 400 },
      );

    const nextId =
      Math.max(0, ...state.users.map((user) => Number(user.id) || 0)) + 1;
    const now = new Date().toISOString();
    const employeeLink = ensureAccountEmployeeLink({
      fullName: String(payload.fullName || email),
      email,
      avatar: payload.avatar || null,
    });
    const user: AccountUserRecord = {
      id: nextId,
      centerId: payload.centerId || state.users[0]?.centerId || role.centerId,
      employeeId: payload.employeeId ?? employeeLink.employeeId,
      personId: payload.personId ?? payload.employeeId ?? employeeLink.personId,
      fullName: String(payload.fullName || email).trim(),
      username: payload.username || email.split("@")[0],
      email,
      password: payload.password || `Temp#${nextId}Squarely`,
      roleId: role.id,
      status: payload.status || "active",
      avatar: payload.avatar || employeeLink.avatar || null,
      temporaryPassword: payload.temporaryPassword ?? true,
      createdBy: payload.createdBy ?? null,
      isMaster: false,
      createdAt: now,
      updatedAt: now,
    };

    state.users.unshift(user);
    saveAccountRoleState(state);

    return HttpResponse.json({ body: toTableUser(user) }, { status: 201 });
  }),
];
