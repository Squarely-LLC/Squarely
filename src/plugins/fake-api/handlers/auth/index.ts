import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import { db, getTokenForUserId } from "@db/auth/db";
import type {
  AuthSession,
  CenterSessionContext,
  ForgotPasswordResponse,
  GoogleAuthResponse,
  RegisterResponse,
  ResetPasswordResponse,
  ResendVerificationResponse,
  User,
  UserOut,
  VerifyEmailResponse,
} from "@db/auth/types";

const createUserData = (user: User) =>
  Object.fromEntries(
    Object.entries({ ...user }).filter(
      ([key, _]) =>
        !(
          key === "password" ||
          key === "abilityRules" ||
          key === "currentCenterId" ||
          key === "memberships"
        ),
    ),
  ) as AuthSession["userData"];

const createCenterContext = (user: User): CenterSessionContext => {
  const memberships = Array.isArray(user.memberships) ? user.memberships : [];
  const activeCenterId =
    user.currentCenterId ?? memberships[0]?.centerId ?? null;

  return {
    activeCenterId,
    centers: db.centers.filter((center) =>
      memberships.some((membership) => membership.centerId === center.id),
    ),
    memberships,
  };
};

const syncUserAbilityRules = (user: User) => {
  const memberships = Array.isArray(user.memberships) ? user.memberships : [];
  const activeCenterId =
    user.currentCenterId ?? memberships[0]?.centerId ?? null;
  const activeMembership = memberships.find(
    (membership) => membership.centerId === activeCenterId,
  );

  user.currentCenterId = activeCenterId;
  user.abilityRules = activeMembership?.abilityRules ?? user.abilityRules ?? [];
  return user;
};

const createAuthSession = (user: User): AuthSession => ({
  userAbilityRules: syncUserAbilityRules(user).abilityRules,
  accessToken: getTokenForUserId(user.id),
  userData: createUserData(user),
  centerContext: createCenterContext(user),
});

const createVerificationCode = () =>
  `${Math.floor(100000 + Math.random() * 900000)}`;

const createPasswordResetToken = () =>
  `${Math.floor(100000 + Math.random() * 900000)}`;

const upsertVerification = (email: string) => {
  const nextCode = createVerificationCode();
  const record = {
    email,
    code: nextCode,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  };
  const existingIndex = db.verifications.findIndex(
    (item) => item.email === email,
  );
  if (existingIndex >= 0) db.verifications.splice(existingIndex, 1, record);
  else db.verifications.push(record);

  return record;
};

const getEmailVerification = (email: string) =>
  db.verifications.find((item) => item.email === email);

const upsertPasswordReset = (email: string) => {
  const token = createPasswordResetToken();
  const record = {
    email,
    token,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  };
  const existingIndex = db.passwordResets.findIndex(
    (item) => item.email === email,
  );
  if (existingIndex >= 0) db.passwordResets.splice(existingIndex, 1, record);
  else db.passwordResets.push(record);

  return record;
};

const getPasswordReset = (email: string, token: string) =>
  db.passwordResets.find(
    (item) => item.email === email && item.token === token,
  );

// Handlers for auth
export const handlerAuth = [
  http.post<PathParams>("/api/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as {
      email: string;
      password: string;
    };

    let errors: Record<string, string[]> = {
      email: ["Something went wrong"],
    };

    const user = db.users.find(
      (u) => u.email === email && u.password === password,
    );

    if (user) {
      if (!user.emailVerified)
        return HttpResponse.json(
          { errors: { email: ["Email not verified yet"] } },
          { status: 403 },
        );

      try {
        const response: UserOut = createAuthSession(user);

        return HttpResponse.json(response, { status: 201 });
      } catch (e: unknown) {
        errors = { email: [e as string] };
      }
    } else {
      errors = { email: ["Invalid email or password"] };
    }

    return HttpResponse.json({ errors }, { status: 400 });
  }),

  http.post<PathParams>("/api/auth/register", async ({ request }) => {
    const { username, email, password } = (await request.json()) as {
      username: string;
      email: string;
      password: string;
    };

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    if (!normalizedUsername || !normalizedEmail || !password)
      return HttpResponse.json(
        { errors: { email: ["All fields are required"] } },
        { status: 400 },
      );

    const existingUser = db.users.find(
      (user) => user.email === normalizedEmail,
    );
    if (existingUser)
      return HttpResponse.json(
        { errors: { email: ["Email already exists"] } },
        { status: 400 },
      );

    const nextUserId = db.users.length + 1;
    const nextCenterId = db.centers.length + 1;
    const centerName = `${normalizedUsername}'s Center`;
    const centerSlug = centerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    db.centers.push({
      id: nextCenterId,
      name: centerName,
      slug: centerSlug,
    });

    const user: User = {
      id: nextUserId,
      fullName: normalizedUsername,
      username: normalizedUsername,
      password,
      email: normalizedEmail,
      role: "admin",
      emailVerified: false,
      authProviders: ["password"],
      currentCenterId: nextCenterId,
      memberships: [
        {
          centerId: nextCenterId,
          role: "super-admin",
          status: "active",
          abilityRules: [
            {
              action: "manage",
              subject: "all",
            },
          ],
        },
      ],
      abilityRules: [
        {
          action: "manage",
          subject: "all",
        },
      ],
    };

    db.users.push(user);
    getTokenForUserId(nextUserId);
    const verification = upsertVerification(normalizedEmail);

    const response: RegisterResponse = {
      requiresVerification: true,
      verificationCode: verification.code,
      email: normalizedEmail,
      userData: createUserData(user),
    };

    return HttpResponse.json(response, { status: 201 });
  }),

  http.post<PathParams>("/api/auth/verify-email", async ({ request }) => {
    const { email, code } = (await request.json()) as {
      email: string;
      code: string;
    };
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((item) => item.email === normalizedEmail);
    const verification = getEmailVerification(normalizedEmail);

    if (!user || !verification)
      return HttpResponse.json(
        { errors: { email: ["Verification request not found"] } },
        { status: 404 },
      );

    if (verification.code !== code)
      return HttpResponse.json(
        { errors: { code: ["Invalid verification code"] } },
        { status: 400 },
      );

    if (new Date(verification.expiresAt).getTime() < Date.now())
      return HttpResponse.json(
        { errors: { code: ["Verification code expired"] } },
        { status: 400 },
      );

    user.emailVerified = true;

    const response: VerifyEmailResponse = {
      ...createAuthSession(user),
      verified: true,
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  http.post<PathParams>(
    "/api/auth/resend-verification",
    async ({ request }) => {
      const { email } = (await request.json()) as { email: string };
      const normalizedEmail = email.trim().toLowerCase();
      const user = db.users.find((item) => item.email === normalizedEmail);

      if (!user)
        return HttpResponse.json(
          { errors: { email: ["User not found"] } },
          { status: 404 },
        );

      const verification = upsertVerification(normalizedEmail);
      const response: ResendVerificationResponse = {
        sent: true,
        email: normalizedEmail,
        verificationCode: verification.code,
      };

      return HttpResponse.json(response, { status: 200 });
    },
  ),

  http.post<PathParams>("/api/auth/google", async ({ request }) => {
    const { email, fullName } = (await request.json()) as {
      email?: string;
      fullName?: string;
    };
    const normalizedEmail = (email || "google-admin@demo.com")
      .trim()
      .toLowerCase();
    let user = db.users.find((item) => item.email === normalizedEmail);

    if (!user) {
      const nextUserId = db.users.length + 1;
      const nextCenterId = db.centers.length + 1;
      db.centers.push({
        id: nextCenterId,
        name: `${fullName || "Google User"} Center`,
        slug: `google-user-center-${nextCenterId}`,
      });

      user = {
        id: nextUserId,
        fullName: fullName || "Google User",
        username: (fullName || "google.user").replace(/\s+/g, "").toLowerCase(),
        password: "",
        email: normalizedEmail,
        role: "admin",
        emailVerified: true,
        authProviders: ["google"],
        currentCenterId: nextCenterId,
        memberships: [
          {
            centerId: nextCenterId,
            role: "super-admin",
            status: "active",
            abilityRules: [
              {
                action: "manage",
                subject: "all",
              },
            ],
          },
        ],
        abilityRules: [
          {
            action: "manage",
            subject: "all",
          },
        ],
      };
      db.users.push(user);
      getTokenForUserId(nextUserId);
    }

    user.emailVerified = true;
    user.authProviders = Array.from(
      new Set([...(user.authProviders || []), "google"]),
    );

    const response: GoogleAuthResponse = {
      ...createAuthSession(user),
      provider: "google",
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  http.post<PathParams>("/api/auth/forgot-password", async ({ request }) => {
    const { email } = (await request.json()) as { email: string };
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((item) => item.email === normalizedEmail);

    if (!user)
      return HttpResponse.json(
        { errors: { email: ["User not found"] } },
        { status: 404 },
      );

    const passwordReset = upsertPasswordReset(normalizedEmail);
    const response: ForgotPasswordResponse = {
      sent: true,
      email: normalizedEmail,
      resetToken: passwordReset.token,
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  http.post<PathParams>("/api/auth/reset-password", async ({ request }) => {
    const { email, token, password } = (await request.json()) as {
      email: string;
      token: string;
      password: string;
    };
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((item) => item.email === normalizedEmail);
    const reset = getPasswordReset(normalizedEmail, token);

    if (!user || !reset)
      return HttpResponse.json(
        { errors: { email: ["Reset request not found"] } },
        { status: 404 },
      );

    if (new Date(reset.expiresAt).getTime() < Date.now())
      return HttpResponse.json(
        { errors: { token: ["Reset token expired"] } },
        { status: 400 },
      );

    if (!password?.trim())
      return HttpResponse.json(
        { errors: { password: ["Password is required"] } },
        { status: 400 },
      );

    user.password = password;
    db.passwordResets = db.passwordResets.filter(
      (item) => !(item.email === normalizedEmail && item.token === token),
    );

    const response: ResetPasswordResponse = {
      reset: true,
      email: normalizedEmail,
    };

    return HttpResponse.json(response, { status: 200 });
  }),
];
