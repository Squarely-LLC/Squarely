import { $api } from "@/utils/api";
import { useCenterStore } from "@/stores/center";
import { syncAbilityRules } from "@/plugins/casl/ability";
import type {
  AuthSession,
  ForgotPasswordResponse,
  GoogleAuthResponse,
  RegisterResponse,
  ResetPasswordResponse,
  ResendVerificationResponse,
  UserData,
  UserAbilityRule,
  VerifyEmailResponse,
} from "@db/auth/types";
import { defineStore } from "pinia";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

interface VerifyEmailPayload {
  email: string;
  code: string;
}

interface GoogleAuthPayload {
  email?: string;
  fullName?: string;
}

interface ForgotPasswordPayload {
  email: string;
}

interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
}

const getUserCookie = () => useCookie<UserData | null>("userData");
const getAccessTokenCookie = () => useCookie<string | null>("accessToken");
const getAbilityCookie = () => useCookie<UserAbilityRule[]>("userAbilityRules");
const getPendingEmailCookie = () =>
  useCookie<string | null>("pendingVerificationEmail");

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as UserData | null,
    accessToken: null as string | null,
    abilityRules: [] as UserAbilityRule[],
    pendingVerificationEmail: null as string | null,
    initialized: false,
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.accessToken),
    isVerified: (state) => Boolean(state.user?.emailVerified),
  },
  actions: {
    bootstrap() {
      const centerStore = useCenterStore();
      this.user = getUserCookie().value;
      this.accessToken = getAccessTokenCookie().value;
      this.abilityRules = getAbilityCookie().value ?? [];
      this.pendingVerificationEmail = getPendingEmailCookie().value;
      syncAbilityRules(this.abilityRules);
      centerStore.bootstrap();
      this.initialized = true;
    },
    applySession(session: AuthSession) {
      const centerStore = useCenterStore();
      this.user = session.userData;
      this.accessToken = session.accessToken;
      this.abilityRules = session.userAbilityRules;

      getUserCookie().value = session.userData;
      getAccessTokenCookie().value = session.accessToken;
      getAbilityCookie().value = session.userAbilityRules;
      syncAbilityRules(session.userAbilityRules);
      centerStore.applyContext(session.centerContext);
    },
    setPendingVerificationEmail(email: string | null) {
      this.pendingVerificationEmail = email;
      getPendingEmailCookie().value = email;
    },
    clearSession() {
      const centerStore = useCenterStore();
      this.user = null;
      this.accessToken = null;
      this.abilityRules = [];
      getUserCookie().value = null;
      getAccessTokenCookie().value = null;
      getAbilityCookie().value = [];
      syncAbilityRules([]);
      centerStore.clear();
    },
    async login(payload: LoginPayload) {
      this.loading = true;
      try {
        const session = await $api<AuthSession>("/auth/login", {
          method: "POST",
          body: payload,
        });
        this.applySession(session);
        this.setPendingVerificationEmail(null);
        return session;
      } finally {
        this.loading = false;
      }
    },
    async register(payload: RegisterPayload) {
      this.loading = true;
      try {
        const response = await $api<RegisterResponse>("/auth/register", {
          method: "POST",
          body: payload,
        });
        this.setPendingVerificationEmail(response.email);
        return response;
      } finally {
        this.loading = false;
      }
    },
    async verifyEmail(payload: VerifyEmailPayload) {
      this.loading = true;
      try {
        const response = await $api<VerifyEmailResponse>("/auth/verify-email", {
          method: "POST",
          body: payload,
        });
        this.applySession(response);
        this.setPendingVerificationEmail(null);
        return response;
      } finally {
        this.loading = false;
      }
    },
    async resendVerification(email?: string) {
      const targetEmail = email || this.pendingVerificationEmail;
      if (!targetEmail) throw new Error("No pending verification email");

      this.loading = true;
      try {
        const response = await $api<ResendVerificationResponse>(
          "/auth/resend-verification",
          {
            method: "POST",
            body: { email: targetEmail },
          },
        );
        this.setPendingVerificationEmail(response.email);
        return response;
      } finally {
        this.loading = false;
      }
    },
    async loginWithGoogle(payload: GoogleAuthPayload = {}) {
      this.loading = true;
      try {
        const response = await $api<GoogleAuthResponse>("/auth/google", {
          method: "POST",
          body: payload,
        });
        this.applySession(response);
        this.setPendingVerificationEmail(null);
        return response;
      } finally {
        this.loading = false;
      }
    },
    async forgotPassword(payload: ForgotPasswordPayload) {
      this.loading = true;
      try {
        return await $api<ForgotPasswordResponse>("/auth/forgot-password", {
          method: "POST",
          body: payload,
        });
      } finally {
        this.loading = false;
      }
    },
    async resetPassword(payload: ResetPasswordPayload) {
      this.loading = true;
      try {
        return await $api<ResetPasswordResponse>("/auth/reset-password", {
          method: "POST",
          body: payload,
        });
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.clearSession();
      this.setPendingVerificationEmail(null);
    },
  },
});
