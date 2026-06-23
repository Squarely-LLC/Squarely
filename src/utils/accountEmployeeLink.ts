import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";
import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { employeeToPerson, type PersonProperties } from "@/stores/people";

const PEOPLE_STORAGE_KEY = "app.people.v2";

const normalizeEmail = (email?: string | null) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

const loadPeople = (): PersonProperties[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PEOPLE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed as PersonProperties[];
  } catch {}

  return [];
};

const savePeople = (people: PersonProperties[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
};

const nextPersonId = (people: PersonProperties[]) => {
  const ids = people
    .map((person) => Number(person.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
};

export function ensureAccountEmployeeLink(input: {
  fullName: string;
  email: string;
  avatar?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const people = loadPeople();
  const existingPerson = people.find(
    (person) => !!person.hrProfile && normalizeEmail(person.email) === email,
  );
  if (existingPerson) {
    return {
      employeeId: existingPerson.id,
      personId: existingPerson.id,
      avatar: existingPerson.picture || input.avatar || null,
    };
  }

  const existingSeed = employeesDb.users.find(
    (employee) => normalizeEmail(employee.email) === email,
  );
  if (existingSeed) {
    return {
      employeeId: existingSeed.id,
      personId: existingSeed.id,
      avatar: existingSeed.picture || input.avatar || null,
    };
  }

  const id = nextPersonId(people);
  const now = new Date().toISOString();
  const employee: Partial<EmployeeProperties> = {
    id,
    fullName: input.fullName.trim() || email,
    email,
    number: "",
    status: "Active",
    picture: input.avatar || undefined,
    accounting: {},
    documents: [],
    records: [],
    transactions: [],
    channel: "Direct Sales",
    worksInSales: false,
    createdAt: now,
    employment: {
      department: "Management",
      contractStatus: "draft",
      startDate: now.slice(0, 10),
      endDate: null,
      isSalesTeamMember: false,
    },
  };

  const person = employeeToPerson(employee, id);
  people.unshift(person);
  savePeople(people);

  return {
    employeeId: person.id,
    personId: person.id,
    avatar: person.picture || null,
  };
}
