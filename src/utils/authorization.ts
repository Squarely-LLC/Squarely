import {
  hasRolePermission,
  loadAccountRoleState,
  type AccountUserRecord,
  type PermissionAction,
  type PermissionModule,
  type RolePermission,
  type RoleRecord,
} from "@/utils/accountRoles";
import { authVersion } from "@/utils/authSession";
import { currentUserData, getSignedInIdentity } from "@/utils/currentAccount";
import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";

export type AuthorizationAction = PermissionAction;
export type AuthorizationModule = PermissionModule;

export interface AuthorizationResource {
  ownerId?: number | string | null;
  ownerIds?: Array<number | string | null | undefined>;
  collaboratorIds?: Array<number | string | null | undefined>;
  participantIds?: Array<number | string | null | undefined>;
  teamMemberIds?: Array<number | string | null | undefined>;
  financialFields?: string[];
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

const touchAuthSession = () => authVersion.value;

const prefixedRefPattern = /^(account|employee|person)[:-](.+)$/i;

const normalizeRef = (value: unknown) => {
  const normalized = normalize(value);
  const match = normalized.match(prefixedRefPattern);

  return match?.[2]?.trim() || normalized;
};

const idsMatch = (
  left: number | string | null | undefined,
  right: number | string | null | undefined,
) => normalizeRef(left) !== "" && normalizeRef(left) === normalizeRef(right);

const uniqueValues = (values: Array<unknown>) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

export const getCurrentAccount = (): AccountUserRecord | null => {
  touchAuthSession();

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
  touchAuthSession();

  if (!resource) return true;
  if (permission.viewScope === "all") return true;
  if (permission.viewScope === "none") return false;

  const identity = getSignedInIdentity();
  const candidates = [
    identity.accountId,
    identity.accountId ? `account:${identity.accountId}` : null,
    identity.accountId ? `account-${identity.accountId}` : null,
    identity.employeeId,
    identity.employeeId ? `employee:${identity.employeeId}` : null,
    identity.employeeId ? `employee-${identity.employeeId}` : null,
    identity.personId,
    identity.personId ? `person:${identity.personId}` : null,
    identity.personId ? `person-${identity.personId}` : null,
    identity.email,
  ];
  const teamCandidates = getCurrentTeamMemberIds();
  const ownerIds = uniqueValues([resource.ownerId, resource.ownerIds]);
  const participantIds = uniqueValues([
    resource.collaboratorIds,
    resource.participantIds,
  ]);

  if (
    ownerIds.some((ownerId) =>
      candidates.some((candidate) => idsMatch(candidate, ownerId)),
    )
  )
    return true;

  if (
    participantIds.some((participantId) =>
      candidates.some((candidate) => idsMatch(candidate, participantId)),
    )
  )
    return true;

  if (permission.viewScope !== "owned_team_collab") return false;

  return [...ownerIds, ...participantIds].some((recordRef) =>
    teamCandidates.some((teamRef) => idsMatch(teamRef, recordRef)),
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
  if (action !== "read" && resource?.financial && permission.hideFinancials)
    return false;
  if (!hasRolePermission(role, module, action)) return false;

  return hasResourceScope(permission, resource);
};

export const canReadResource = (
  module: AuthorizationModule,
  resource?: AuthorizationResource,
) => canCurrentUser(module, "read", resource);

export const requireCurrentUserPermission = (
  module: AuthorizationModule,
  action: AuthorizationAction = "read",
  resource?: AuthorizationResource,
  message = PERMISSION_DENIED_MESSAGE,
) => {
  if (!canCurrentUser(module, action, resource))
    throw new PermissionDeniedError(module, action, message);
};

export const assertCanMutateResource = (
  module: AuthorizationModule,
  action: Exclude<AuthorizationAction, "read">,
  resource?: AuthorizationResource,
  message = PERMISSION_DENIED_MESSAGE,
) => requireCurrentUserPermission(module, action, resource, message);

export const filterReadableResources = <T>(
  module: AuthorizationModule,
  records: T[],
  mapResource: (record: T) => AuthorizationResource = (record) =>
    mapAuthorizationResource(module, record),
) =>
  records
    .filter((record) => canReadResource(module, mapResource(record)))
    .map((record) => maskFinancialResource(module, record));

export const authorizeRecord = <T>(
  module: AuthorizationModule,
  record: T | null | undefined,
  mapResource: (record: T) => AuthorizationResource = (entry) =>
    mapAuthorizationResource(module, entry),
) => {
  if (!record || !canReadResource(module, mapResource(record))) return null;
  return maskFinancialResource(module, record);
};

export const hasHiddenFinancials = (module: AuthorizationModule) => {
  const role = getCurrentUserRole();
  if (!role) return true;
  if (role.name === "Account Owner / Super Admin") return false;

  const permission = modulePermission(role, module);
  return !permission || permission.viewScope === "none" || permission.hideFinancials;
};

const moneyKeyPattern =
  /(amount|balance|billing|cost|currency|discount|financial|grandtotal|margin|payment|price|profit|rate|subtotal|tax|total|vat)/i;

export const maskFinancialResource = <T>(
  module: AuthorizationModule,
  record: T,
): T => {
  if (!hasHiddenFinancials(module)) return record;
  return maskFinancialValue(record);
};

const maskFinancialValue = <T>(value: T, key = ""): T => {
  if (value === null || value === undefined) return value;
  if (moneyKeyPattern.test(key)) {
    if (Array.isArray(value)) return [] as T;
    if (typeof value === "object") return null as T;
    return null as T;
  }
  if (Array.isArray(value))
    return value.map((entry) => maskFinancialValue(entry)) as T;
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      maskFinancialValue(entryValue, entryKey),
    ]),
  ) as T;
};

export const mapAuthorizationResource = (
  module: AuthorizationModule,
  record: any,
): AuthorizationResource => {
  if (!record) return { module, ownerIds: [], participantIds: [] };

  const nested = (...paths: string[]) =>
    paths.map((path) =>
      path.split(".").reduce((current, segment) => current?.[segment], record),
    );
  const collectPrimitiveAliases = (value: number | string): unknown[] => {
    const raw = String(value ?? "").trim();
    if (!raw) return [];

    const match = raw.match(prefixedRefPattern);

    return match?.[2]?.trim() ? [raw, match[2].trim()] : [raw];
  };
  const collectIds = (value: any): unknown[] => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value.flatMap((entry) => collectIds(entry));
    if (typeof value === "object")
      return [
        value.value,
        value.id,
        value.accountId,
        value.employeeId,
        value.personId,
        value.email,
        value.name,
        value.fullName,
      ].flatMap(collectIds);
    return collectPrimitiveAliases(value);
  };

  const ownerIds = uniqueValues(
    collectIds(
      nested(
        "ownerId",
        "projectManagerId",
        "createdBy",
        "createdById",
        "createdBy.accountId",
        "createdBy.employeeId",
        "createdBy.personId",
        "author",
        "author.id",
        "author.accountId",
        "requestedBy",
        "requestedBy.id",
        "requestedBy.employeeId",
        "salesman",
        "salesperson",
        "quotation.salesperson",
        "quotation.salesperson.id",
        "employeeId",
        "personId",
      ),
    ),
  );

  const participantIds = uniqueValues(
    collectIds([
      nested(
        "collaborators",
        "collaboratorIds",
        "assignees",
        "assignedTo",
        "attendees",
        "linkedTo",
        "requestedBy",
        "approverEmployeeId",
        "approvalApprovedBy",
        "approvalRejectedBy",
      ),
      record.milestones?.flatMap((entry: any) => collectIds(entry.collaborators)),
      record.goals?.flatMap((entry: any) => collectIds(entry.collaborators)),
      record.steps?.flatMap((entry: any) => collectIds(entry.collaborators)),
      record.items?.flatMap((entry: any) => [
        ...collectIds(entry.collaborators),
        ...collectIds(entry.salesTasks),
      ]),
    ]),
  );

  return {
    module,
    ownerIds,
    participantIds,
    collaboratorIds: participantIds,
    financial:
      record.financial === true ||
      record.financials !== undefined ||
      record.total !== undefined ||
      record.amount !== undefined,
  };
};

export const getCurrentTeamMemberIds = () => {
  const identity = getSignedInIdentity();
  const currentRefs = uniqueValues([
    identity.accountId,
    identity.employeeId,
    identity.personId,
    identity.email,
    identity.name,
  ]);
  const people = loadPeopleForAuth();
  const personRefs = (person: any) =>
    uniqueValues([
      person.id,
      person.employeeId,
      person.email,
      person.fullName,
    ]);
  const reportsTo = (person: any) =>
    uniqueValues([
      person.hrProfile?.employment?.reportToIds,
      person.employment?.reportToIds,
    ]);
  const currentPeople = people.filter((person) =>
    personRefs(person).some((ref) =>
      currentRefs.some((currentRef) => idsMatch(ref, currentRef)),
    ),
  );
  const included = new Set<string>(currentRefs);
  const queue = [...currentPeople];

  while (queue.length) {
    const person = queue.shift();
    if (!person) continue;
    personRefs(person).forEach((ref) => included.add(String(ref)));

    const relatedPeople = people.filter((candidate) => {
      const candidateRefs = personRefs(candidate);
      const candidateReportsTo = reportsTo(candidate);
      const personIds = personRefs(person);

      return (
        reportsTo(person).some((managerRef) =>
          candidateRefs.some((candidateRef) => idsMatch(managerRef, candidateRef)),
        ) ||
        candidateReportsTo.some((managerRef) =>
          personIds.some((personRef) => idsMatch(managerRef, personRef)),
        )
      );
    });

    relatedPeople.forEach((related) => {
      const alreadyIncluded = personRefs(related).some((ref) => included.has(String(ref)));
      if (!alreadyIncluded) queue.push(related);
    });
  }

  return Array.from(included);
};

const loadPeopleForAuth = () => {
  if (typeof window !== "undefined") {
    try {
      const parsed = JSON.parse(localStorage.getItem("app.people.v2") || "[]");
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {}
  }

  return employeesDb.users.map((employee) => ({
    ...employee,
    hrProfile: { employment: employee.employment },
  }));
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
