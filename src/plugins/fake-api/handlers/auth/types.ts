export type Actions = "create" | "read" | "update" | "delete" | "manage";

export type Subjects = "Auth" | "Admin" | "AclDemo" | "all";

export type AuthProvider = "password" | "google";

export type CenterRole =
  | "super-admin"
  | "center-admin"
  | "manager"
  | "employee";

export type MembershipStatus = "active" | "invited" | "disabled";

export interface UserAbilityRule {
  action: Actions;
  subject: Subjects;
}

export interface Center {
  id: number;
  name: string;
  slug: string;
}

export interface CenterMembership {
  centerId: number;
  role: CenterRole;
  status: MembershipStatus;
  abilityRules: UserAbilityRule[];
}

export interface CenterSessionContext {
  activeCenterId: number | null;
  centers: Center[];
  memberships: CenterMembership[];
}

export interface User {
  id: number;
  fullName?: string;
  username: string;
  password: string;
  avatar?: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  authProviders?: AuthProvider[];
  currentCenterId?: number | null;
  memberships?: CenterMembership[];
  abilityRules: UserAbilityRule[];
}

export interface VerificationRecord {
  email: string;
  code: string;
  expiresAt: string;
}

export interface PasswordResetRecord {
  email: string;
  token: string;
  expiresAt: string;
}

export type UserData = Omit<
  User,
  "password" | "abilityRules" | "currentCenterId" | "memberships"
>;

export interface AuthSession {
  userAbilityRules: User["abilityRules"];
  accessToken: string;
  userData: UserData;
  centerContext: CenterSessionContext;
}

export interface UserOut {
  userAbilityRules: User["abilityRules"];
  accessToken: string;
  userData: UserData;
}

export interface LoginResponse {
  accessToken: string;
  userData: User;
  userAbilityRules: User["abilityRules"];
}

export interface RegisterResponse {
  requiresVerification: boolean;
  verificationCode: string;
  email: string;
  userData: UserData;
}

export interface VerifyEmailResponse extends AuthSession {
  verified: true;
}

export interface ResendVerificationResponse {
  sent: true;
  email: string;
  verificationCode: string;
}

export interface GoogleAuthResponse extends AuthSession {
  provider: "google";
}

export interface ForgotPasswordResponse {
  sent: true;
  email: string;
  resetToken: string;
}

export interface ResetPasswordResponse {
  reset: true;
  email: string;
}
