import {
  canCurrentUser,
  type AuthorizationAction,
  type AuthorizationModule,
  type AuthorizationResource,
} from "@/utils/authorization";

type MutationAction = Exclude<AuthorizationAction, "read">;

const moduleLabels: Partial<Record<AuthorizationModule, string>> = {
  calendar: "calendar",
  catalogue: "catalogue",
  configuration: "configuration",
  contacts: "contacts",
  deals: "deals",
  finance: "finance",
  hr: "HR",
  jobs: "jobs",
  tasks: "tasks",
  usersRoles: "users and roles",
};

const actionLabels: Record<MutationAction, string> = {
  approve: "approve",
  create: "create",
  delete: "delete",
  manage: "manage",
  update: "update",
};

export const canMutate = (
  module: AuthorizationModule,
  action: MutationAction,
  resource?: AuthorizationResource,
) => canCurrentUser(module, action, resource);

export const permissionDisabledReason = (
  module: AuthorizationModule,
  action: MutationAction,
) =>
  `You do not have permission to ${actionLabels[action]} ${
    moduleLabels[module] ?? module
  }.`;
