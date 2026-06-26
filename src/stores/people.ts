import { db as contactsDb } from "@/plugins/fake-api/handlers/apps/contact/db";
import type {
  ContactAccounting,
  ContactChannel,
  ContactClass,
  ContactConnection,
  ContactProperties,
  ContactRole,
  ContactStatus,
  ContactType,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { db as employeesDb } from "@/plugins/fake-api/handlers/apps/employees/db";
import type {
  EmployeeAttendance,
  EmployeeChannel,
  EmployeeConnection,
  EmployeeEmployment,
  EmployeePaymentMethod,
  EmployeeProperties,
  EmployeeRequest,
  EmployeeSalary,
  EmployeeStatus,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.people.v3";

export type PersonProfileKind = "crm" | "hr";

export interface PersonCrmProfile {
  class: ContactClass;
  roles?: ContactRole[];
  type: ContactType;
  category: ContactProperties["category"];
  status: ContactStatus;
}

export interface PersonHrProfile {
  class?: EmployeeProperties["class"];
  type?: EmployeeProperties["type"];
  category?: EmployeeProperties["category"];
  status: EmployeeStatus;
  department?: string;
  employment?: EmployeeEmployment;
  salary?: EmployeeSalary | null;
  paymentMethods?: EmployeePaymentMethod[];
  attendance?: EmployeeAttendance;
  requests?: EmployeeRequest[];
  gender?: EmployeeProperties["gender"];
}

export interface PersonProperties {
  id: number;
  fullName: string;
  email: string;
  number: string;
  picture?: string;
  address?: string;
  country?: string;
  city?: string;
  language?: string;
  website?: string;
  channel: ContactChannel | EmployeeChannel;
  birthdate?: string;
  worksInSales: boolean;
  connections: Array<ContactConnection | EmployeeConnection>;
  accounting: ContactAccounting;
  documents?: Array<
    | NonNullable<ContactProperties["documents"]>[number]
    | NonNullable<EmployeeProperties["documents"]>[number]
  >;
  records?: Array<
    | NonNullable<ContactProperties["records"]>[number]
    | NonNullable<EmployeeProperties["records"]>[number]
  >;
  transactions?: Array<
    | NonNullable<ContactProperties["transactions"]>[number]
    | NonNullable<EmployeeProperties["transactions"]>[number]
  >;
  crmProfile?: PersonCrmProfile;
  hrProfile?: PersonHrProfile;
  legacyContactId?: number | string;
  legacyEmployeeId?: number | string;
  createdAt?: string;
}

const cloneDeep = <T>(value: T): T => {
  if (value === undefined || value === null) return value;

  const raw = toRaw(value) as T;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch {}
  }

  return JSON.parse(JSON.stringify(raw)) as T;
};

const normalizeEmail = (email?: string | null) =>
  String(email ?? "")
    .trim()
    .toLowerCase();

const normalizePhone = (phone?: string | null) =>
  String(phone ?? "").replace(/\D/g, "");

const personKeyFor = (entry: {
  email?: string | null;
  number?: string | null;
}) => {
  const email = normalizeEmail(entry.email);
  if (email && email !== "unknown@example.com") return `email:${email}`;

  const phone = normalizePhone(entry.number);
  return phone ? `phone:${phone}` : "";
};

const asNumberId = (
  value: number | string | undefined | null,
  fallback: number,
) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const nextPersonId = (people: PersonProperties[]) => {
  const ids = people
    .map((person) => Number(person.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const ensureAccounting = (
  accounting?: ContactAccounting | EmployeeProperties["accounting"] | null,
): ContactAccounting => ({
  taxId: accounting?.taxId || undefined,
  crn: accounting?.crn || undefined,
  vatNumber: accounting?.vatNumber || undefined,
});

const normalizeCrmRoles = (
  roles: ContactRole[] | undefined | null,
  contactClass?: ContactClass,
): ContactRole[] => {
  const next = new Set<ContactRole>();

  if (Array.isArray(roles)) {
    roles.forEach((role) => {
      if (role === "client" || role === "supplier") next.add(role);
    });
  }

  if (contactClass === "Client") next.add("client");
  if (contactClass === "Supplier") next.add("supplier");

  return Array.from(next);
};

const deriveCrmClass = (
  currentClass: ContactClass,
  roles: ContactRole[],
): ContactClass => {
  const hasClientRole = roles.includes("client");
  const hasSupplierRole = roles.includes("supplier");

  if (hasClientRole && !hasSupplierRole) return "Client";
  if (!hasClientRole && hasSupplierRole) return "Supplier";
  if (hasClientRole && hasSupplierRole) {
    return currentClass === "Client" || currentClass === "Supplier"
      ? currentClass
      : "Contact";
  }

  return currentClass;
};

const clonePeopleArray = (people: PersonProperties[]) =>
  people.map((person) => cloneDeep(person));

function loadJsonArray<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch (error) {
    console.warn(`Failed to load ${key}:`, error);
    return null;
  }
}

function savePeople(people: PersonProperties[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  } catch (error) {
    console.warn("Failed to save people:", error);
  }
}

export function contactToPerson(
  contact: Partial<ContactProperties>,
  assignedId?: number,
): PersonProperties {
  const id = asNumberId(contact.id, assignedId ?? 1);
  const roles = normalizeCrmRoles(contact.roles, contact.class);
  const contactClass = deriveCrmClass(contact.class ?? "Contact", roles);
  const now = new Date().toISOString();

  return {
    id,
    fullName: contact.fullName?.trim() || "Untitled Contact",
    email: contact.email?.trim() || "unknown@example.com",
    number: contact.number?.trim() || "",
    picture: contact.picture || undefined,
    address: contact.address || undefined,
    country: contact.country || undefined,
    city: contact.city || undefined,
    language: contact.language || undefined,
    website: contact.website || undefined,
    channel: contact.channel ?? "Direct Sales",
    birthdate: contact.birthdate || undefined,
    worksInSales: contact.worksInSales ?? false,
    connections: Array.isArray(contact.connections)
      ? cloneDeep(contact.connections)
      : [],
    accounting: ensureAccounting(contact.accounting),
    documents: Array.isArray(contact.documents)
      ? cloneDeep(contact.documents)
      : undefined,
    records: Array.isArray(contact.records) ? cloneDeep(contact.records) : [],
    transactions: Array.isArray(contact.transactions)
      ? cloneDeep(contact.transactions)
      : undefined,
    crmProfile: {
      class: contactClass,
      roles,
      type: contact.type ?? "Individual",
      category: contact.category ?? "General",
      status: contact.status ?? "Active",
    },
    legacyContactId: contact.id,
    createdAt: contact.createdAt || now,
  };
}

export function employeeToPerson(
  employee: Partial<EmployeeProperties>,
  assignedId?: number,
): PersonProperties {
  const id = asNumberId(employee.id, assignedId ?? 1);
  const now = new Date().toISOString();

  return {
    id,
    fullName: employee.fullName?.trim() || "Untitled Employee",
    email: employee.email?.trim() || "unknown@example.com",
    number: employee.number?.trim() || "",
    picture: employee.picture || undefined,
    address: employee.address || undefined,
    country: employee.country || undefined,
    city: employee.city || undefined,
    language: employee.language || undefined,
    website: employee.website || undefined,
    channel: employee.channel ?? "Direct Sales",
    birthdate: employee.birthdate || undefined,
    worksInSales: employee.worksInSales ?? false,
    connections: Array.isArray(employee.connections)
      ? cloneDeep(employee.connections)
      : [],
    accounting: ensureAccounting(employee.accounting),
    documents: Array.isArray(employee.documents)
      ? cloneDeep(employee.documents)
      : undefined,
    records: Array.isArray(employee.records) ? cloneDeep(employee.records) : [],
    transactions: Array.isArray(employee.transactions)
      ? cloneDeep(employee.transactions)
      : undefined,
    hrProfile: {
      class: employee.class || undefined,
      type: employee.type || undefined,
      category: employee.category || undefined,
      status: employee.status ?? "Not Hired",
      department: employee.department || employee.employment?.department,
      employment: employee.employment
        ? cloneDeep(employee.employment)
        : undefined,
      salary: employee.salary ? cloneDeep(employee.salary) : undefined,
      paymentMethods: Array.isArray(employee.paymentMethods)
        ? cloneDeep(employee.paymentMethods)
        : undefined,
      attendance: employee.attendance
        ? cloneDeep(employee.attendance)
        : undefined,
      requests: Array.isArray(employee.requests)
        ? cloneDeep(employee.requests)
        : undefined,
      gender: employee.gender || undefined,
    },
    legacyEmployeeId: employee.id,
    createdAt: employee.createdAt || now,
  };
}

const mergeShared = (
  existing: PersonProperties,
  incoming: PersonProperties,
): PersonProperties => ({
  ...existing,
  fullName: existing.fullName || incoming.fullName,
  email:
    existing.email && existing.email !== "unknown@example.com"
      ? existing.email
      : incoming.email,
  number: existing.number || incoming.number,
  picture: existing.picture || incoming.picture,
  address: existing.address || incoming.address,
  country: existing.country || incoming.country,
  city: existing.city || incoming.city,
  language: existing.language || incoming.language,
  website: existing.website || incoming.website,
  channel: existing.channel || incoming.channel,
  birthdate: existing.birthdate || incoming.birthdate,
  worksInSales: existing.worksInSales || incoming.worksInSales,
  connections: existing.connections?.length
    ? existing.connections
    : incoming.connections,
  accounting: ensureAccounting({
    ...(incoming.accounting ?? {}),
    ...(existing.accounting ?? {}),
  }),
  documents: existing.documents?.length
    ? existing.documents
    : incoming.documents,
  records: existing.records?.length ? existing.records : incoming.records,
  transactions: existing.transactions?.length
    ? existing.transactions
    : incoming.transactions,
  crmProfile: existing.crmProfile ?? incoming.crmProfile,
  hrProfile: existing.hrProfile ?? incoming.hrProfile,
  legacyContactId: existing.legacyContactId ?? incoming.legacyContactId,
  legacyEmployeeId: existing.legacyEmployeeId ?? incoming.legacyEmployeeId,
});

const applyContactUpdate = (
  existing: PersonProperties,
  incoming: PersonProperties,
): PersonProperties => ({
  ...existing,
  fullName: incoming.fullName,
  email: incoming.email,
  number: incoming.number,
  picture: incoming.picture,
  address: incoming.address,
  country: incoming.country,
  city: incoming.city,
  language: incoming.language,
  website: incoming.website,
  channel: incoming.channel,
  birthdate: incoming.birthdate,
  worksInSales: incoming.worksInSales,
  connections: incoming.connections,
  accounting: incoming.accounting,
  documents: incoming.documents,
  records: incoming.records,
  transactions: incoming.transactions,
  crmProfile: incoming.crmProfile,
  legacyContactId: incoming.legacyContactId ?? existing.legacyContactId,
  createdAt: existing.createdAt || incoming.createdAt,
});

const applyEmployeeUpdate = (
  existing: PersonProperties,
  incoming: PersonProperties,
): PersonProperties => ({
  ...existing,
  fullName: incoming.fullName,
  email: incoming.email,
  number: incoming.number,
  picture: incoming.picture,
  address: incoming.address,
  country: incoming.country,
  city: incoming.city,
  language: incoming.language,
  website: incoming.website,
  channel: incoming.channel,
  birthdate: incoming.birthdate,
  worksInSales: incoming.worksInSales,
  connections: incoming.connections,
  accounting: incoming.accounting,
  documents: incoming.documents,
  records: incoming.records,
  transactions: incoming.transactions,
  hrProfile: incoming.hrProfile,
  legacyEmployeeId: incoming.legacyEmployeeId ?? existing.legacyEmployeeId,
  createdAt: existing.createdAt || incoming.createdAt,
});

export function personToContact(person: PersonProperties): ContactProperties {
  const crm = person.crmProfile;

  return {
    id: person.id,
    fullName: person.fullName,
    class: crm?.class ?? "Contact",
    roles: crm?.roles ?? [],
    type: crm?.type ?? "Individual",
    category: crm?.category ?? "General",
    email: person.email,
    number: person.number,
    status: crm?.status ?? "Active",
    picture: person.picture,
    connections: cloneDeep(person.connections ?? []) as ContactConnection[],
    accounting: cloneDeep(person.accounting ?? {}),
    documents: cloneDeep(
      person.documents ?? [],
    ) as ContactProperties["documents"],
    records: cloneDeep(person.records ?? []) as ContactProperties["records"],
    transactions: cloneDeep(
      person.transactions ?? [],
    ) as ContactProperties["transactions"],
    address: person.address,
    country: person.country,
    city: person.city,
    language: person.language,
    website: person.website,
    channel: person.channel as ContactChannel,
    birthdate: person.birthdate,
    worksInSales: person.worksInSales,
    createdAt: person.createdAt,
  };
}

export function personToEmployee(person: PersonProperties): EmployeeProperties {
  const hr = person.hrProfile;

  return {
    id: person.id,
    fullName: person.fullName,
    class: hr?.class,
    type: hr?.type,
    category: hr?.category,
    email: person.email,
    number: person.number,
    status: hr?.status ?? "Not Hired",
    picture: person.picture,
    connections: cloneDeep(person.connections ?? []) as EmployeeConnection[],
    accounting: cloneDeep(person.accounting ?? {}),
    documents: cloneDeep(
      person.documents ?? [],
    ) as EmployeeProperties["documents"],
    records: cloneDeep(person.records ?? []) as EmployeeProperties["records"],
    transactions: cloneDeep(
      person.transactions ?? [],
    ) as EmployeeProperties["transactions"],
    address: person.address,
    country: person.country,
    city: person.city,
    language: person.language,
    website: person.website,
    channel: person.channel as EmployeeChannel,
    birthdate: person.birthdate,
    worksInSales: person.worksInSales,
    createdAt: person.createdAt,
    department: hr?.department,
    employment: cloneDeep(hr?.employment),
    salary: cloneDeep(hr?.salary),
    paymentMethods: cloneDeep(hr?.paymentMethods),
    attendance: cloneDeep(hr?.attendance),
    requests: cloneDeep(hr?.requests),
    gender: hr?.gender,
  };
}

function mergePeopleSources(
  contacts: Partial<ContactProperties>[],
  employees: Partial<EmployeeProperties>[],
) {
  const people: PersonProperties[] = [];
  const keyToPersonId = new Map<string, number>();
  const employeeIdToPersonId = new Map<string, number>();

  const rememberKeys = (person: PersonProperties) => {
    const email = normalizeEmail(person.email);
    const phone = normalizePhone(person.number);
    if (email && email !== "unknown@example.com") {
      keyToPersonId.set(`email:${email}`, person.id);
    }
    if (phone) keyToPersonId.set(`phone:${phone}`, person.id);
  };

  contacts.forEach((contact) => {
    const person = contactToPerson(contact, nextPersonId(people));
    const key = personKeyFor(person);
    const existingId = key ? keyToPersonId.get(key) : undefined;
    const existingIndex = people.findIndex((item) => item.id === existingId);

    if (existingIndex >= 0) {
      people.splice(
        existingIndex,
        1,
        mergeShared(people[existingIndex], person),
      );
    } else {
      people.push(person);
    }

    rememberKeys(people[people.length - 1]);
  });

  employees.forEach((employee) => {
    const key = personKeyFor(employee);
    const existingId = key ? keyToPersonId.get(key) : undefined;
    const existingIndex = people.findIndex((item) => item.id === existingId);
    const assignedId =
      existingIndex >= 0
        ? people[existingIndex].id
        : people.some((item) => item.id === Number(employee.id))
          ? nextPersonId(people)
          : asNumberId(employee.id, nextPersonId(people));
    const person = employeeToPerson(employee, assignedId);

    if (existingIndex >= 0) {
      people.splice(
        existingIndex,
        1,
        mergeShared(people[existingIndex], person),
      );
    } else {
      people.push(person);
    }

    if (employee.id !== undefined && employee.id !== null) {
      employeeIdToPersonId.set(String(employee.id), assignedId);
    }
    rememberKeys(people.find((item) => item.id === assignedId) ?? person);
  });

  const remapEmployeeId = (value: number | string) =>
    employeeIdToPersonId.get(String(value)) ?? value;

  const remapOptionalEmployeeId = (value: number | string | undefined) => {
    if (value === undefined || value === null) return value;

    return remapEmployeeId(value);
  };

  people.forEach((person) => {
    const employment = person.hrProfile?.employment;

    if (employment?.reportToIds?.length) {
      employment.reportToIds = employment.reportToIds.map(remapEmployeeId);
    }

    person.hrProfile?.requests?.forEach((request) => {
      if ("approvedBy" in request) {
        request.approvedBy = remapOptionalEmployeeId(request.approvedBy);
      }

      if ("rejectedBy" in request) {
        request.rejectedBy = remapOptionalEmployeeId(request.rejectedBy);
      }
    });
  });

  return { people: clonePeopleArray(people), employeeIdToPersonId };
}

const loadInitialPeople = () => {
  const storedPeople = loadJsonArray<PersonProperties>(STORAGE_KEY);
  if (storedPeople?.length) return clonePeopleArray(storedPeople);

  return mergePeopleSources(contactsDb.users, employeesDb.users).people;
};

export const usePeopleStore = defineStore("people", {
  state: () => ({
    items: [] as PersonProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((person) => String(person.id) === String(id)) ?? null,
    crmPeople: (state) => state.items.filter((person) => !!person.crmProfile),
    hrPeople: (state) => state.items.filter((person) => !!person.hrProfile),
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      this.items = loadInitialPeople();
      savePeople(this.items);
      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            savePeople(clonePeopleArray(state.items));
          },
          { detached: true },
        );
      }
    },

    upsertContact(payload: Partial<ContactProperties>) {
      this.init();
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const existingIndex =
        incomingId === undefined
          ? -1
          : this.items.findIndex(
              (person) => String(person.id) === String(incomingId),
            );
      const id =
        existingIndex >= 0
          ? this.items[existingIndex].id
          : incomingId && !this.items.some((person) => person.id === incomingId)
            ? incomingId
            : nextPersonId(this.items);
      const next = contactToPerson(payload, id);

      if (existingIndex >= 0) {
        this.items.splice(
          existingIndex,
          1,
          applyContactUpdate(this.items[existingIndex], next),
        );
      } else {
        this.items.unshift(next);
      }

      return personToContact(this.byId(id)!);
    },

    patchContact(id: number | string, patch: Partial<ContactProperties>) {
      this.init();
      const index = this.items.findIndex(
        (person) => String(person.id) === String(id),
      );
      if (index === -1) return null;

      const currentContact = personToContact(this.items[index]);
      const next = contactToPerson({
        ...currentContact,
        ...patch,
        id: this.items[index].id,
      });
      this.items.splice(index, 1, applyContactUpdate(this.items[index], next));
      return personToContact(this.items[index]);
    },

    removeContactProfile(id: number | string) {
      this.init();
      const index = this.items.findIndex(
        (person) => String(person.id) === String(id),
      );
      if (index === -1) return;

      const person = { ...this.items[index], crmProfile: undefined };
      if (!person.hrProfile) this.items.splice(index, 1);
      else this.items.splice(index, 1, person);
    },

    upsertEmployee(payload: Partial<EmployeeProperties>) {
      this.init();
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const existingIndex =
        incomingId === undefined
          ? -1
          : this.items.findIndex(
              (person) => String(person.id) === String(incomingId),
            );
      const id =
        existingIndex >= 0
          ? this.items[existingIndex].id
          : incomingId && !this.items.some((person) => person.id === incomingId)
            ? incomingId
            : nextPersonId(this.items);
      const next = employeeToPerson(payload, id);

      if (existingIndex >= 0) {
        this.items.splice(
          existingIndex,
          1,
          applyEmployeeUpdate(this.items[existingIndex], next),
        );
      } else {
        this.items.unshift(next);
      }

      return personToEmployee(this.byId(id)!);
    },

    patchEmployee(id: number | string, patch: Partial<EmployeeProperties>) {
      this.init();
      const index = this.items.findIndex(
        (person) => String(person.id) === String(id),
      );
      if (index === -1) return null;

      const currentEmployee = personToEmployee(this.items[index]);
      const next = employeeToPerson({
        ...currentEmployee,
        ...patch,
        id: this.items[index].id,
      });
      this.items.splice(index, 1, applyEmployeeUpdate(this.items[index], next));
      return personToEmployee(this.items[index]);
    },

    removeEmployeeProfile(id: number | string) {
      this.init();
      const index = this.items.findIndex(
        (person) => String(person.id) === String(id),
      );
      if (index === -1) return;

      const person = { ...this.items[index], hrProfile: undefined };
      if (!person.crmProfile) this.items.splice(index, 1);
      else this.items.splice(index, 1, person);
    },

    replaceContacts(contacts: ContactProperties[]) {
      this.init();
      const existingEmployees = this.items
        .filter((person) => !!person.hrProfile)
        .map(personToEmployee);
      const merged = mergePeopleSources(contacts, existingEmployees).people;
      this.items = merged.filter(
        (person) => person.crmProfile || person.hrProfile,
      );
    },

    replaceEmployees(employees: EmployeeProperties[]) {
      this.init();
      const existingContacts = this.items
        .filter((person) => !!person.crmProfile)
        .map(personToContact);
      const merged = mergePeopleSources(existingContacts, employees).people;
      this.items = merged.filter(
        (person) => person.crmProfile || person.hrProfile,
      );
    },

    nextId() {
      this.init();
      return nextPersonId(this.items);
    },
  },
});

export function resolveEmployeePersonId<
  T extends number | string | null | undefined,
>(value: T): T {
  if (value === null || value === undefined || value === "") return value;

  const peopleStore = usePeopleStore();
  peopleStore.init();

  const person = peopleStore.hrPeople.find(
    (entry) =>
      String(entry.id) === String(value) ||
      String(entry.legacyEmployeeId) === String(value),
  );

  return (person?.id ?? value) as T;
}
