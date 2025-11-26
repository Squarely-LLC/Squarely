import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "../plugins/fake-api/handlers/apps/employees/db";
import type {
  EmployeeAccounting,
  EmployeeContract,
  EmployeeEmployment,
  EmployeeProperties,
} from "../plugins/fake-api/handlers/apps/employees/types";

import type { EmployeeRecord } from "../plugins/fake-api/handlers/apps/employees/types";

const STORAGE_KEY = "app.employees.v2";

function cloneAccounting(accounting: EmployeeAccounting): EmployeeAccounting {
  const raw = toRaw(accounting) as EmployeeAccounting;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed while cloning accounting:", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as EmployeeAccounting;
  } catch (error) {
    console.warn("JSON clone failed while cloning accounting:", error);
    return { ...raw };
  }
}

function cloneEmployee(contact: EmployeeProperties): EmployeeProperties {
  const raw = toRaw(contact) as EmployeeProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn("structuredClone failed while cloning contact:", error);
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as EmployeeProperties;
  } catch (error) {
    console.warn("JSON clone failed while cloning contact:", error);

    return {
      ...raw,
      accounting: raw.accounting ? { ...raw.accounting } : {},
      records: Array.isArray(raw.records)
        ? raw.records.map((r) => ({ ...r }))
        : [],
    };
  }
}

function cloneEmployeesArray(employees: EmployeeProperties[]) {
  return employees.map((contact) => cloneEmployee(contact));
}

function loadFromStorage(): EmployeeProperties[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as EmployeeProperties[];
  } catch (error) {
    console.warn("Failed to load employees from storage:", error);
    return null;
  }
}

function saveToStorage(employees: EmployeeProperties[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  } catch (error) {
    console.warn("Failed to save employees to storage:", error);
  }
}

function ensureAccounting(
  accounting: EmployeeAccounting | undefined | null
): EmployeeAccounting {
  const base = accounting ? cloneAccounting(accounting) : {};
  return {
    taxId: base.taxId || undefined,
    crn: base.crn || undefined,
    vatNumber: base.vatNumber || undefined,
  };
}

function ensureRecords(
  records: EmployeeRecord[] | undefined | null
): EmployeeRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((r) => ({
    id: Number(r.id) || 0,
    type: r.type || "note",
    title: r.title || undefined,
    body: r.body || undefined,
    author: r.author || null,
    attachments: Array.isArray(r.attachments) ? [...r.attachments] : [],
    createdAt: r.createdAt || new Date().toISOString(),
  }));
}

function ensureContract(
  contract: EmployeeContract | undefined | null
): EmployeeContract | undefined {
  if (!contract) return undefined;
  return {
    id: contract.id || undefined,
    salaryPaid: contract.salaryPaid || null,
    employmentType: contract.employmentType || null,
    startDate: contract.startDate || null,
    probationEndDate: contract.probationEndDate || null,
    firstPayroll: contract.firstPayroll || null,
    note: contract.note || undefined,
    status: contract.status || "Active",
    createdAt: contract.createdAt || new Date().toISOString(),
    termination: contract.termination
      ? {
          noticePeriod: contract.termination.noticePeriod || null,
          terminationType: contract.termination.terminationType || null,
          note: contract.termination.note || undefined,
          lastDayAtWork: contract.termination.lastDayAtWork || null,
          lastPayrollPeriod: contract.termination.lastPayrollPeriod || null,
          fileUrl: contract.termination.fileUrl || undefined,
          attachmentLink: contract.termination.attachmentLink || undefined,
          terminatedAt: contract.termination.terminatedAt || undefined,
        }
      : undefined,
  };
}

function ensureContracts(
  contracts: EmployeeContract[] | undefined | null
): EmployeeContract[] | undefined {
  if (!Array.isArray(contracts)) return undefined;
  return contracts.map((c) => ensureContract(c)!).filter(Boolean);
}

function ensureEmployment(
  employment: EmployeeEmployment | undefined | null
): EmployeeEmployment | undefined {
  if (!employment) return undefined;
  return {
    department: employment.department || undefined,
    reportToIds: Array.isArray(employment.reportToIds)
      ? [...employment.reportToIds]
      : undefined,
    contractStatus: employment.contractStatus || null,
    startDate: employment.startDate || null,
    endDate: employment.endDate || null,
    contract: ensureContract(employment.contract),
    contracts: ensureContracts(employment.contracts),
  };
}

function normaliseEmployee(
  payload: Partial<EmployeeProperties>,
  assignedId: number
): EmployeeProperties {
  const now = new Date().toISOString();

  return {
    id: assignedId,
    fullName: payload.fullName?.trim() || "Untitled Employee",
    class: payload.class || undefined,
    category: payload.category || undefined,
    email: payload.email?.trim() || "unknown@example.com",
    number: payload.number?.trim() || "",
    status: payload.status ?? "Not Hired",
    picture: payload.picture || undefined,
    accounting: ensureAccounting(payload.accounting),
    records: ensureRecords(payload.records),
    address: payload.address || undefined,
    country: payload.country || undefined,
    city: payload.city || undefined,
    language: payload.language || undefined,
    channel: payload.channel ?? "Direct Sales",
    birthdate: payload.birthdate || undefined,
    worksInSales: payload.worksInSales ?? false,
    createdAt: payload.createdAt || now,
    employment: ensureEmployment(payload.employment),
    salary: payload.salary || undefined,
    gender: payload.gender || undefined,
  };
}

function mergeEmployee(
  original: EmployeeProperties,
  patch: Partial<EmployeeProperties>
): EmployeeProperties {
  const merged = {
    ...original,
    ...patch,
    class: patch.class ?? original.class ?? undefined,
    category: patch.category ?? original.category ?? undefined,
    accounting: ensureAccounting({
      ...(original.accounting ?? {}),
      ...(patch.accounting ?? {}),
    }),
    records: ensureRecords(patch.records ?? original.records ?? []),
    employment: patch.employment
      ? ensureEmployment({
          ...(original.employment ?? {}),
          ...(patch.employment ?? {}),
          contract: patch.employment.contract
            ? {
                ...(original.employment?.contract ?? {}),
                ...(patch.employment.contract ?? {}),
              }
            : original.employment?.contract,
        })
      : original.employment,
  };

  if (!merged.createdAt) merged.createdAt = original.createdAt;

  return cloneEmployee(merged);
}

function nextEmployeeId(items: EmployeeProperties[]) {
  const numericIds = items
    .map((contact) => Number(contact.id))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!numericIds.length) return 1;
  return Math.max(...numericIds) + 1;
}

const seedEmployees = () => cloneEmployeesArray(db.users);

export const useEmployeesStore = defineStore("employees", {
  state: () => ({
    items: [] as EmployeeProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((contact) => String(contact.id) === String(id)) ?? null,
    search:
      (state) =>
      (query: string): EmployeeProperties[] => {
        const q = query.trim().toLowerCase();
        if (!q) return state.items;
        return state.items.filter((contact) => {
          const haystacks = [
            contact.fullName,
            contact.email,
            contact.number,
            contact.city,
            contact.country,
            contact.channel,
            contact.status,
          ]
            .filter(Boolean)
            .map((value) => value!.toString().toLowerCase());
          return haystacks.some((value) => value.includes(q));
        });
      },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      if (stored && stored.length) {
        this.items = cloneEmployeesArray(stored);
      } else {
        this.items = seedEmployees();
        saveToStorage(this.items);
      }

      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneEmployeesArray(state.items));
          },
          { detached: true }
        );
      }
    },

    addEmployee(payload: Partial<EmployeeProperties>) {
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextEmployeeId(this.items);
      const normalised = normaliseEmployee(payload, id);
      this.items.unshift(normalised);
      return normalised;
    },

    updateEmployee(id: number | string, patch: Partial<EmployeeProperties>) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(id)
      );
      if (index === -1) return null;

      const updated = mergeEmployee(this.items[index], patch);
      this.items.splice(index, 1, updated);
      return updated;
    },

    /**
     * Add a record to a contact's records array. New records are prepended.
     * Returns the updated contact or null if contact not found.
     */
    addRecord(contactId: number | string, record: EmployeeRecord) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const newRecords = [record, ...existing];

      const updated = mergeEmployee(original, { records: newRecords });
      this.items.splice(index, 1, updated);
      return updated;
    },

    /**
     * Update an existing record for a contact. Matches by record.id.
     */
    updateRecord(contactId: number | string, record: EmployeeRecord) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const updatedRecords = existing.map((r) =>
        String(r.id) === String(record.id) ? { ...r, ...record } : r
      );

      const updated = mergeEmployee(original, { records: updatedRecords });
      this.items.splice(index, 1, updated);
      return updated;
    },

    /**
     * Remove a record from a contact by id.
     */
    removeRecord(contactId: number | string, recordId: number | string) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(contactId)
      );
      if (index === -1) return null;

      const original = this.items[index];
      const existing = Array.isArray(original.records) ? original.records : [];
      const updatedRecords = existing.filter(
        (r) => String(r.id) !== String(recordId)
      );

      const updated = mergeEmployee(original, { records: updatedRecords });
      this.items.splice(index, 1, updated);
      return updated;
    },

    removeEmployee(id: number | string) {
      const index = this.items.findIndex(
        (contact) => String(contact.id) === String(id)
      );
      if (index === -1) return;
      this.items.splice(index, 1);
    },

    nextId() {
      return nextEmployeeId(this.items);
    },

    replaceAll(employees: EmployeeProperties[]) {
      this.items = cloneEmployeesArray(employees);
    },
  },
});
