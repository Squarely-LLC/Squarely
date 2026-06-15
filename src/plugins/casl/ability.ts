import { createMongoAbility } from "@casl/ability";

export type Actions =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "manage";

export type Subjects =
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
  | "usersRoles"
  | "AclDemo"
  | "Post"
  | "Comment"
  | "all";

export interface Rule {
  action: Actions;
  subject: Subjects;
}

export const ability = createMongoAbility<[Actions, Subjects]>();
