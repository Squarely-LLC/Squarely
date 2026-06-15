import type { PathParams } from "msw";
import { HttpResponse, http } from "msw";
import type { UserOut } from "@db/auth/types";
import {
  buildAbilityRules,
  loadAccountRoleState,
  publicUser,
} from "@/utils/accountRoles";

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

    const state = loadAccountRoleState();
    const user = state.users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password,
    );
    const role = state.roles.find((entry) => entry.id === user?.roleId);

    if (user && role && user.status !== "inactive") {
      try {
        const accessToken = `squarely-token-${user.id}-${Date.now()}`;
        const userOutData = publicUser(
          user,
          role,
        ) as unknown as UserOut["userData"];

        const response: UserOut = {
          userAbilityRules: buildAbilityRules(role),
          accessToken,
          userData: userOutData,
        };

        return HttpResponse.json(response, { status: 201 });
      } catch (e: unknown) {
        errors = { email: [e as string] };
      }
    } else {
      errors = { email: ["Invalid email or password"] };
    }

    return HttpResponse.json({ errors }, { status: 400 });
  }),
];
