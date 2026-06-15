import type {
  PeopleContactRef,
  PeopleSelectOption,
} from "@/utils/peopleOptions";

export const currentUserData = () => useCookie<any>("userData").value;

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
