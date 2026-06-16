import { db as configDb } from "@/plugins/fake-api/handlers/config/db";
import {
  ROLE_TEST_USER_PASSWORD,
  seedIdentityByEmail,
  seedIdentityByRoleId,
  seedIdentities,
} from "@/utils/seedIdentityGraph";

export type AccountStatus = "active" | "pending" | "inactive";
export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "manage";
export type PermissionScope =
  | "all"
  | "owned_team_collab"
  | "owned_collab"
  | "none";
export type PermissionModule =
  | "dashboard"
  | "reports"
  | "calendar"
  | "tasks"
  | "contacts"
  | "deals"
  | "jobs"
  | "finance"
  | "hr"
  | "catalogue"
  | "configuration"
  | "usersRoles";

export interface RolePermission {
  module: PermissionModule;
  moduleLabel: string;
  viewScope: PermissionScope;
  restrictedToModule: boolean;
  hideFinancials: boolean;
  actions: PermissionAction[];
}

export interface RoleRecord {
  id: string;
  centerId: string;
  name: string;
  permissions: RolePermission[];
  system?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountUserRecord {
  id: number;
  centerId: string;
  employeeId?: number | string | null;
  personId?: number | string | null;
  fullName: string;
  username: string;
  email: string;
  password: string;
  roleId: string;
  status: AccountStatus;
  avatar?: string | null;
  temporaryPassword: boolean;
  createdBy?: number | string | null;
  isMaster?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRoleState {
  roles: RoleRecord[];
  users: AccountUserRecord[];
}

const STORAGE_KEY = "app.account-roles.v2";

export const currentCenterId = () => {
  const legal = configDb.configurations.legal;
  const raw = legal?.crn || legal?.companyName || "default-center";
  return `center-${
    String(raw)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "default"
  }`;
};

export const currentCenterName = () =>
  configDb.configurations.legal?.companyName || "Current Center";

const moduleKey = (label: string): PermissionModule =>
  label.toLowerCase() === "configuration"
    ? "configuration"
    : label.toLowerCase() === "users & roles"
      ? "usersRoles"
      : (label.toLowerCase() as PermissionModule);

const permission = (moduleLabel: string, values: string[]): RolePermission => {
  const has = (value: string) => values.includes(value);
  const scope: PermissionScope = has("All")
    ? "all"
    : has("Owned + Team + Collab.")
      ? "owned_team_collab"
      : has("Owned + Collab.")
        ? "owned_collab"
        : "none";

  const actions: PermissionAction[] = [];
  if (scope !== "none") actions.push("read");
  if (has("Create")) actions.push("create");
  if (has("Edit")) actions.push("update");
  if (has("Delete")) actions.push("delete");
  if (has("Approve")) actions.push("approve");

  return {
    module: moduleKey(moduleLabel),
    moduleLabel,
    viewScope: scope,
    restrictedToModule: has("Restricted to Module"),
    hideFinancials: has("Hide Financials"),
    actions,
  };
};

const matrix: Record<string, Record<string, string[]>> = {
  Dashboard: {
    "Account Owner / Super Admin": ["All"],
    Admin: ["All"],
    "HR Manager": ["All", "Restricted to Module"],
    "HR Executive": ["All", "Restricted to Module", "Hide Financials"],
    "Sales Manager": ["All", "Restricted to Module"],
    "Sales Executive": ["All", "Restricted to Module", "Hide Financials"],
    "Operation Manager": ["All", "Restricted to Module"],
    "Operation Executive": ["All", "Restricted to Module", "Hide Financials"],
    Auditor: ["All"],
    "Finance Executive": ["All", "Restricted to Module", "Hide Financials"],
  },
  Reports: {
    "Account Owner / Super Admin": ["All"],
    Admin: ["All"],
    "HR Manager": ["All", "Restricted to Module"],
    "HR Executive": ["All", "Restricted to Module", "Hide Financials"],
    "Sales Manager": ["All", "Restricted to Module"],
    "Sales Executive": ["All", "Restricted to Module", "Hide Financials"],
    "Operation Manager": ["All", "Restricted to Module"],
    "Operation Executive": ["All", "Restricted to Module", "Hide Financials"],
    Auditor: ["All"],
    "Finance Executive": ["All", "Restricted to Module"],
  },
  Calendar: {
    "Account Owner / Super Admin": [
      "Owned + Collab.",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    Admin: ["Owned + Collab.", "Create", "Edit", "Delete", "Approve"],
    "HR Manager": ["Owned + Collab.", "Create", "Edit", "Delete", "Approve"],
    "HR Executive": ["Owned + Collab.", "Create", "Edit", "Delete"],
    "Sales Manager": ["Owned + Collab.", "Create", "Edit", "Delete", "Approve"],
    "Sales Executive": ["Owned + Collab.", "Create", "Edit", "Delete"],
    "Operation Manager": [
      "Owned + Collab.",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    "Operation Executive": ["Owned + Collab.", "Create", "Edit", "Delete"],
    Auditor: ["Owned + Collab.", "Create", "Edit", "Delete"],
    "Finance Executive": ["Owned + Collab.", "Create", "Edit", "Delete"],
  },
  Tasks: {},
  Contacts: {
    "Account Owner / Super Admin": ["All", "Create", "Edit", "Delete"],
    Admin: ["All", "Create", "Edit", "Delete"],
    "HR Manager": ["All", "Hide Financials", "Create", "Edit", "Delete"],
    "HR Executive": ["All", "Hide Financials", "Create", "Edit"],
    "Sales Manager": ["All", "Create", "Edit", "Delete"],
    "Sales Executive": ["All", "Create", "Edit"],
    "Operation Manager": ["All", "Hide Financials", "Create", "Edit", "Delete"],
    "Operation Executive": ["All", "Hide Financials", "Create", "Edit"],
    Auditor: ["All", "Create", "Edit", "Delete"],
    "Finance Executive": ["All", "Create", "Edit"],
  },
  Deals: {
    "Account Owner / Super Admin": [
      "All",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    Admin: ["All", "Create", "Edit", "Delete", "Approve"],
    "HR Manager": [],
    "HR Executive": [],
    "Sales Manager": [
      "Owned + Team + Collab.",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    "Sales Executive": ["Owned + Collab.", "Create", "Edit", "Delete"],
    "Operation Manager": ["Owned + Team + Collab.", "Hide Financials"],
    "Operation Executive": ["Owned + Collab.", "Hide Financials"],
    Auditor: ["All", "Create", "Edit", "Delete", "Approve"],
    "Finance Executive": ["All", "Create", "Edit", "Delete"],
  },
  Jobs: {
    "Account Owner / Super Admin": [
      "All",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    Admin: ["All", "Create", "Edit", "Delete", "Approve"],
    "Operation Manager": [
      "Owned + Team + Collab.",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    "Operation Executive": [
      "Owned + Collab.",
      "Hide Financials",
      "Create",
      "Edit",
      "Delete",
    ],
  },
  Finance: {
    "Account Owner / Super Admin": ["All", "Create", "Edit", "Delete"],
    Admin: ["All", "Create", "Edit", "Delete"],
    Auditor: ["All", "Create", "Edit", "Delete", "Approve"],
    "Finance Executive": ["All", "Create", "Edit", "Delete"],
  },
  HR: {
    "Account Owner / Super Admin": [
      "All",
      "Create",
      "Edit",
      "Delete",
      "Approve",
    ],
    Admin: ["All", "Create", "Edit", "Delete", "Approve"],
    "HR Manager": ["All", "Create", "Edit", "Delete", "Approve"],
    "HR Executive": ["All", "Hide Financials", "Create", "Edit"],
    Auditor: ["All"],
    "Finance Executive": ["All"],
  },
  Catalogue: {
    "Account Owner / Super Admin": ["All", "Create", "Edit", "Delete"],
    Admin: ["All", "Create", "Edit", "Delete"],
    "Sales Manager": ["All", "Create", "Edit", "Delete"],
    "Sales Executive": ["All", "Create", "Edit"],
    "Operation Manager": ["All", "Hide Financials", "Create", "Edit", "Delete"],
    "Operation Executive": ["All", "Hide Financials", "Create", "Edit"],
  },
  Configuration: {
    "Account Owner / Super Admin": ["All", "Create", "Edit", "Delete"],
    Admin: ["All"],
    "HR Manager": ["All", "Restricted to Module", "Create", "Edit", "Delete"],
    "Sales Manager": [
      "All",
      "Restricted to Module",
      "Create",
      "Edit",
      "Delete",
    ],
    "Operation Manager": [
      "All",
      "Restricted to Module",
      "Create",
      "Edit",
      "Delete",
    ],
    Auditor: ["All", "Restricted to Module", "Create", "Edit", "Delete"],
  },
};

const roleNames = [
  "Account Owner / Super Admin",
  "Admin",
  "HR Manager",
  "HR Executive",
  "Sales Manager",
  "Sales Executive",
  "Operation Manager",
  "Operation Executive",
  "Auditor",
  "Finance Executive",
];

matrix.Tasks = Object.fromEntries(
  roleNames.map((role) => [
    role,
    ["Owned + Collab.", "Create", "Edit", "Delete"],
  ]),
);

const roleId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const roleTestUserEmail = (role: RoleRecord) =>
  seedIdentityByRoleId.get(role.id)?.email ??
  `${role.id || roleId(role.name)}@squarely.test`;

const roleTestUserName = (role: RoleRecord) => `${role.name} Test User`;

const nextUserId = (users: AccountUserRecord[]) =>
  Math.max(0, ...users.map((user) => Number(user.id) || 0)) + 1;

const hasUserForRole = (
  users: AccountUserRecord[],
  role: RoleRecord,
) =>
  users.some(
    (user) =>
      user.centerId === role.centerId &&
      String(user.roleId) === String(role.id),
  );

const hasUserEmail = (users: AccountUserRecord[], email: string) =>
  users.some((user) => user.email.toLowerCase() === email.toLowerCase());

const ensureRoleTestUsers = (
  state: AccountRoleState,
): AccountRoleState => {
  const users = [...state.users];
  const now = new Date().toISOString();

  state.roles.forEach((role) => {
    if (hasUserForRole(users, role)) return;

    const baseEmail = roleTestUserEmail(role);
    let email = baseEmail;
    let suffix = 2;
    while (hasUserEmail(users, email)) {
      email = `${role.id || roleId(role.name)}-${suffix}@squarely.test`;
      suffix += 1;
    }

    const identity = seedIdentityByRoleId.get(role.id);
    const id = identity?.id ?? nextUserId(users);
    users.push({
      id,
      centerId: role.centerId,
      employeeId: identity?.id ?? id,
      personId: identity?.id ?? id,
      fullName: identity?.fullName ?? roleTestUserName(role),
      username: identity?.username ?? role.id ?? roleId(role.name),
      email,
      password: ROLE_TEST_USER_PASSWORD,
      roleId: role.id,
      status: "active",
      avatar: identity?.avatar ?? null,
      temporaryPassword: true,
      createdBy: null,
      isMaster: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { ...state, users };
};

export const buildAbilityRules = (role?: RoleRecord | null) => {
  if (!role) return [];
  if (role.name === "Account Owner / Super Admin")
    return [{ action: "manage" as const, subject: "all" as const }];

  return role.permissions.flatMap((entry) =>
    entry.actions.map((action) => ({ action, subject: entry.module })),
  );
};

export const hasRolePermission = (
  role: RoleRecord | null | undefined,
  module: PermissionModule,
  action: PermissionAction = "read",
) =>
  !!role?.permissions.some(
    (entry) =>
      entry.module === module &&
      entry.viewScope !== "none" &&
      entry.actions.includes(action),
  );

export const seedAccountRoleState = (): AccountRoleState => {
  const centerId = currentCenterId();
  const now = new Date().toISOString();
  const roles = roleNames.map((name) => ({
    id: roleId(name),
    centerId,
    name,
    system: true,
    permissions: Object.entries(matrix).map(([moduleLabel, byRole]) =>
      permission(moduleLabel, byRole[name] ?? []),
    ),
    createdAt: now,
    updatedAt: now,
  }));

  roles.forEach((role) => {
    role.permissions.push(
      permission(
        "Users & Roles",
        role.name === "Account Owner / Super Admin" || role.name === "Admin"
          ? ["All", "Create", "Edit", "Delete"]
          : [],
      ),
    );
  });

  const users = seedIdentities.map((identity) => ({
    id: identity.id,
    centerId,
    employeeId: identity.id,
    personId: identity.id,
    fullName: identity.fullName,
    username: identity.username,
    email: identity.email,
    password:
      identity.email === "admin@demo.com"
        ? "TedKarimPamela1"
        : ROLE_TEST_USER_PASSWORD,
    roleId: identity.roleId,
    status: "active" as const,
    avatar: identity.avatar,
    temporaryPassword: identity.email !== "admin@demo.com",
    createdBy: null,
    isMaster: identity.email === "admin@demo.com",
    createdAt: now,
    updatedAt: now,
  }));

  return ensureRoleTestUsers({ roles, users });
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const saveAccountRoleState = (state: AccountRoleState) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(state)));
};

export const loadAccountRoleState = (): AccountRoleState => {
  if (typeof window === "undefined") return seedAccountRoleState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = ensureLinkedUsers(ensureRoleTestUsers(JSON.parse(raw) as AccountRoleState));
      saveAccountRoleState(state);
      return state;
    }
  } catch {}
  const seeded = seedAccountRoleState();
  saveAccountRoleState(seeded);
  return seeded;
};

const ensureLinkedUsers = (state: AccountRoleState): AccountRoleState => ({
  ...state,
  users: state.users.map((user) => {
    const identity =
      seedIdentityByEmail.get(user.email.toLowerCase()) ??
      seedIdentityByRoleId.get(user.roleId);
    if (!identity) return user;

    return {
      ...user,
      employeeId: user.employeeId ?? identity.id,
      personId: user.personId ?? identity.id,
      avatar: user.avatar || identity.avatar,
    };
  }),
});

export const publicUser = (user: AccountUserRecord, role?: RoleRecord) => ({
  id: user.id,
  centerId: user.centerId,
  employeeId: user.employeeId,
  personId: user.personId,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: role?.name ?? user.roleId,
  roleId: user.roleId,
  avatar: user.avatar,
  status: user.status,
  isMaster: !!user.isMaster,
  temporaryPassword: !!user.temporaryPassword,
});
