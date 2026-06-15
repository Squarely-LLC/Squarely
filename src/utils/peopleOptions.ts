import type { PersonProperties } from "@/stores/people";
import { usePeopleStore } from "@/stores/people";

export type PeopleContactRef = {
  id: number | string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  group?: string;
  type?: "contact" | "employee" | "employee_contact";
  roles?: ("contact" | "employee")[];
  contactId?: number | string;
  employeeId?: number | string;
  value?: string;
};

export type PeopleSelectOption = {
  title: string;
  value: number | string;
  avatar?: string | null;
  id?: number | string;
  name?: string;
  avatarUrl?: string | null;
  email?: string;
  group?: string;
  type?: "contact" | "employee" | "employee_contact";
  roles?: readonly ("contact" | "employee")[];
  contactId?: number | string;
  employeeId?: number | string;
};

const ensurePeople = () => {
  const peopleStore = usePeopleStore();
  peopleStore.init();
  return peopleStore;
};

const personName = (person: PersonProperties) =>
  String(
    person.fullName || person.email || person.number || `Person #${person.id}`,
  ).trim();

const sortByTitle = <T extends { title?: string; name?: string }>(items: T[]) =>
  [...items].sort((left, right) =>
    String(left.title ?? left.name ?? "").localeCompare(
      String(right.title ?? right.name ?? ""),
      undefined,
      { sensitivity: "base" },
    ),
  );

const toContactRef = (
  person: PersonProperties,
  type: "contact" | "employee" | "employee_contact",
): PeopleContactRef & Omit<PeopleSelectOption, "value"> => ({
  id: person.id,
  title: personName(person),
  value: `${type}-${person.id}`,
  name: personName(person),
  email: person.email,
  avatar: person.picture ?? null,
  avatarUrl: person.picture ?? null,
  group:
    type === "employee_contact"
      ? "Employees & Contacts"
      : type === "employee"
        ? "Employees"
        : "Contacts",
  type,
  roles:
    type === "employee_contact"
      ? ["contact", "employee"]
      : type === "employee"
        ? ["employee"]
        : ["contact"],
  contactId: person.crmProfile ? person.id : undefined,
  employeeId: person.hrProfile ? person.id : undefined,
});

const optionFromPerson = (
  person: PersonProperties,
  value: number | string = person.id,
): PeopleSelectOption => ({
  title: personName(person),
  value,
  id: person.id,
  name: personName(person),
  email: person.email,
  avatar: person.picture ?? null,
  avatarUrl: person.picture ?? null,
  contactId:
    person.legacyContactId ?? (person.crmProfile ? person.id : undefined),
  employeeId:
    person.legacyEmployeeId ?? (person.hrProfile ? person.id : undefined),
});

export const getContactRefs = () =>
  sortByTitle(
    ensurePeople().crmPeople.map((person) => toContactRef(person, "contact")),
  );

export const getEmployeeRefs = () =>
  sortByTitle(
    ensurePeople().hrPeople.map((person) => toContactRef(person, "employee")),
  );

export const getContactAndEmployeeRefs = () =>
  sortByTitle(
    ensurePeople()
      .all.filter((person) => person.crmProfile || person.hrProfile)
      .map((person) =>
        toContactRef(
          person,
          person.crmProfile && person.hrProfile
            ? "employee_contact"
            : person.hrProfile
              ? "employee"
              : "contact",
        ),
      ),
  );

export const getContactOptions = (options?: { salesOnly?: boolean }) =>
  sortByTitle(
    ensurePeople()
      .crmPeople.filter((person) => !options?.salesOnly || person.worksInSales)
      .map((person) => optionFromPerson(person)),
  );

export const getEmployeeOptions = () =>
  sortByTitle(
    ensurePeople().hrPeople.map((person) => optionFromPerson(person)),
  );

export const getSalesContactOptions = () =>
  getContactOptions({ salesOnly: true });

export const getSalesEmployeeOptions = () =>
  sortByTitle(
    ensurePeople()
      .hrPeople.filter(
        (person) => !!person.hrProfile?.employment?.isSalesTeamMember,
      )
      .map((person) => optionFromPerson(person)),
  );

export const getSalesPeopleOptions = () =>
  sortByTitle([
    ...ensurePeople()
      .crmPeople.filter((person) => person.worksInSales)
      .map((person) => optionFromPerson(person, `contact:${person.id}`)),
    ...ensurePeople()
      .hrPeople.filter(
        (person) => !!person.hrProfile?.employment?.isSalesTeamMember,
      )
      .map((person) => optionFromPerson(person)),
  ]);

export const getContactAndEmployeeOptions = () =>
  sortByTitle(
    ensurePeople()
      .all.filter((person) => person.crmProfile || person.hrProfile)
      .map((person) => optionFromPerson(person)),
  );

export const getContactAndEmployeeEmailOptions = () =>
  sortByTitle(
    ensurePeople()
      .all.filter(
        (person) => (person.crmProfile || person.hrProfile) && !!person.email,
      )
      .map((person) => ({
        title: `${personName(person)} <${person.email}>`,
        value: person.email,
      })),
  );

export const resolvePeopleSelection = (
  value: number | string | null | undefined,
  options: Array<PeopleContactRef | PeopleSelectOption>,
  fallbackPrefix = "Person",
) => {
  const raw = String(value ?? "").trim();
  const unprefixed = raw.startsWith("contact:") ? raw.slice(8) : raw;
  const match = options.find(
    (option) =>
      String(option.id) === String(value) ||
      String(option.id) === unprefixed ||
      String(option.contactId ?? "") === unprefixed ||
      String(option.employeeId ?? "") === unprefixed ||
      String((option as PeopleSelectOption).value) === raw,
  );

  if (match) return { ...match } as PeopleContactRef;

  return {
    id: value ?? "",
    name: `${fallbackPrefix} #${unprefixed || value || "unknown"}`,
    avatarUrl: null,
  };
};
