import {
  hasRolePermission,
  loadAccountRoleState,
  type AccountUserRecord,
  type PermissionAction,
  type PermissionModule,
  type RolePermission,
  type RoleRecord,
} from "@/utils/accountRoles";
import { currentUserData, getSignedInIdentity } from "@/utils/currentAccount";

export type AuthorizationAction = PermissionAction;
export type AuthorizationModule = PermissionModule;

export interface AuthorizationResource {
  ownerId?: number | string | null;
  collaboratorIds?: Array<number | string | null | undefined>;
  module?: AuthorizationModule;
  financial?: boolean;
}

export const PERMISSION_DENIED_MESSAGE =
  "You do not have permission to perform this action.";

export class PermissionDeniedError extends Error {
  code = "PERMISSION_DENIED";
  status = 403;
  module: AuthorizationModule;
  action: AuthorizationAction;

  constructor(
    module: AuthorizationModule,
    action: AuthorizationAction,
    message = PERMISSION_DENIED_MESSAGE,
  ) {
    super(message);
    this.name = "PermissionDeniedError";
    this.module = module;
    this.action = action;
  }
}

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

const idsMatch = (
  left: number | string | null | undefined,
  right: number | string | null | undefined,
) => normalize(left) !== "" && normalize(left) === normalize(right);

export const getCurrentAccount = (): AccountUserRecord | null => {
  const userData = currentUserData();
  if (!userData) return null;

  const state = loadAccountRoleState();
  const user =
    state.users.find((entry) => idsMatch(entry.id, userData.id)) ??
    state.users.find((entry) => normalize(entry.email) === normalize(userData.email)) ??
    null;

  if (!user || user.status === "inactive") return null;

  return user;
};

export const getCurrentUserRole = (): RoleRecord | null => {
  const account = getCurrentAccount();
  if (!account) return null;

  const state = loadAccountRoleState();
  return state.roles.find((role) => role.id === account.roleId) ?? null;
};

const modulePermission = (
  role: RoleRecord,
  module: AuthorizationModule,
): RolePermission | null =>
  role.permissions.find((permission) => permission.module === module) ?? null;

const hasResourceScope = (
  permission: RolePermission,
  resource?: AuthorizationResource,
) => {
  if (!resource) return true;
  if (permission.viewScope === "all") return true;
  if (permission.viewScope === "none") return false;

  const identity = getSignedInIdentity();
  const candidates = [
    identity.accountId,
    identity.employeeId,
    identity.personId,
    identity.email,
  ];

  if (candidates.some((candidate) => idsMatch(candidate, resource.ownerId)))
    return true;

  return (resource.collaboratorIds ?? []).some((collaboratorId) =>
    candidates.some((candidate) => idsMatch(candidate, collaboratorId)),
  );
};

export const canCurrentUser = (
  module: AuthorizationModule,
  action: AuthorizationAction = "read",
  resource?: AuthorizationResource,
) => {
  const role = getCurrentUserRole();
  if (!role) return false;
  if (role.name === "Account Owner / Super Admin") return true;

  const permission = modulePermission(role, module);
  if (!permission) return false;
  if (resource?.financial && permission.hideFinancials) return false;
  if (!hasRolePermission(role, module, action)) return false;

  return hasResourceScope(permission, resource);
};

export const requireCurrentUserPermission = (
  module: AuthorizationModule,
  action: AuthorizationAction = "read",
  resource?: AuthorizationResource,
  message = PERMISSION_DENIED_MESSAGE,
) => {
  if (!canCurrentUser(module, action, resource))
    throw new PermissionDeniedError(module, action, message);
};

export const isPermissionDeniedError = (
  error: unknown,
): error is PermissionDeniedError =>
  error instanceof PermissionDeniedError ||
  normalize((error as any)?.code) === "permission_denied";

export const permissionDeniedResponse = (
  module: AuthorizationModule,
  action: AuthorizationAction,
  message = PERMISSION_DENIED_MESSAGE,
) =>
  new Response(
    JSON.stringify({
      message,
      code: "PERMISSION_DENIED",
      module,
      action,
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
