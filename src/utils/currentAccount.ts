import type {
  PeopleContactRef,
  PeopleSelectOption,
} from "@/utils/peopleOptions";

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
  const accountId = user.id ?? user.accountId ?? user.employeeId ?? "me";
  const name =
    String(user.fullName ?? user.name ?? user.username ?? user.email ?? "User")
      .trim() || "User";

  return {
    id: user.personId ?? user.employeeId ?? accountId,
    accountId,
    employeeId: user.employeeId ?? null,
    personId: user.personId ?? null,
    name,
    email: user.email ?? null,
    avatarUrl: user.avatar ?? user.avatarUrl ?? null,
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
