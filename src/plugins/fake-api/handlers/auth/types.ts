export type Actions =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "manage";

export type Subjects =
  | "Auth"
  | "Admin"
  | "AclDemo"
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
  | "all";

export interface UserAbilityRule {
  action: Actions;
  subject: Subjects;
}

export interface User {
  id: number;
  fullName?: string;
  username: string;
  password: string;
  avatar?: string;
  email: string;
  role: string;
  abilityRules: UserAbilityRule[];
}

export interface UserOut {
  userAbilityRules: User["abilityRules"];
  accessToken: string;
  userData: Omit<User, "abilities" | "password">;
}

export interface LoginResponse {
  accessToken: string;
  userData: User;
  userAbilityRules: User["abilityRules"];
}

export interface RegisterResponse {
  accessToken: string;
  userData: User;
  userAbilityRules: User["abilityRules"];
}
