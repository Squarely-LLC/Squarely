import type {
  PeopleContactRef,
  PeopleSelectOption,
} from "@/utils/peopleOptions";
import { seedIdentityByEmail } from "@/utils/seedIdentityGraph";

export const currentUserData = () => useCookie<any>("userData").value;

export interface SignedInIdentity {
  id: number | string;
  accountId: number | string;
  employeeId?: number | string | null;
  personId?: number | string | null;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

const isPlaceholderAuthor = (value: any) => {
  const id = String(value?.id ?? value ?? "").trim().toLowerCase();
  const name = String(value?.name ?? "").trim().toLowerCase();
  const email = String(value?.email ?? "").trim().toLowerCase();

  return (
    id === "me" ||
    name === "you" ||
    name === "me" ||
    name === "test@squarely.app" ||
    email === "test@squarely.app"
  );
};

export const getSignedInIdentity = (): SignedInIdentity => {
  const user = currentUserData() ?? {};
  const seededIdentity =
    user.email
      ? seedIdentityByEmail.get(String(user.email).trim().toLowerCase())
      : null;
  const employeeId = seededIdentity?.id ?? user.employeeId ?? null;
  const personId = seededIdentity?.id ?? user.personId ?? null;
  const accountId = user.id ?? user.accountId ?? employeeId ?? "me";
  const name =
    String(
      seededIdentity?.fullName ??
        user.fullName ??
        user.name ??
        user.username ??
        user.email ??
        "User",
    ).trim() || "User";

  return {
    id: personId ?? employeeId ?? accountId,
    accountId,
    employeeId,
    personId,
    name,
    email: seededIdentity?.email ?? user.email ?? null,
    avatarUrl: seededIdentity?.avatar ?? user.avatar ?? user.avatarUrl ?? null,
  };
};

export const getSignedInAuthorRef = () => {
  const identity = getSignedInIdentity();

  return {
    id: identity.personId ?? identity.employeeId ?? identity.accountId,
    accountId: identity.accountId,
    employeeId: identity.employeeId ?? undefined,
    personId: identity.personId ?? undefined,
    name: identity.name,
    avatarUrl: identity.avatarUrl ?? undefined,
    email: identity.email ?? undefined,
  };
};

export const normalizeAuthorRef = (author: any) => {
  if (!author || isPlaceholderAuthor(author)) return getSignedInAuthorRef();

  const name = String(author.name ?? author.fullName ?? "").trim();
  const id = author.id ?? author.personId ?? author.employeeId;

  if (!name || id === undefined || id === null || id === "")
    return getSignedInAuthorRef();

  return {
    ...author,
    id,
    name,
    avatarUrl: author.avatarUrl ?? author.avatar ?? author.picture ?? undefined,
  };
};

export const findCurrentUserOption = <
  T extends PeopleContactRef | PeopleSelectOption,
>(
  options: T[],
) => {
  const user = currentUserData();
  if (!user) return null;

  const candidates = [
    user.employeeId,
    user.personId,
    user.id,
    user.email,
    user.fullName,
    user.username,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => String(value).trim().toLowerCase());

  return (
    options.find((option) => {
      const optionValues = [
        option.id,
        (option as PeopleSelectOption).value,
        option.employeeId,
        option.email,
        option.name,
        (option as PeopleSelectOption).title,
      ]
        .filter(
          (value) => value !== undefined && value !== null && value !== "",
        )
        .map((value) => String(value).trim().toLowerCase());

      return optionValues.some((value) => candidates.includes(value));
    }) ?? null
  );
};
