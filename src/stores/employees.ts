import type {
  EmployeePosition,
  EmployeeProperties,
  EmployeeRecord,
  EmployeeRequest,
  EmployeeSalaryRecord,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { personToEmployee, usePeopleStore } from "@/stores/people";
import { defineStore } from "pinia";

const cloneEmployee = (employee: EmployeeProperties): EmployeeProperties =>
  JSON.parse(JSON.stringify(employee)) as EmployeeProperties;

const cloneEmployeesArray = (employees: EmployeeProperties[]) =>
  employees.map((employee) => cloneEmployee(employee));

const refreshEmployees = () => {
  const peopleStore = usePeopleStore();
  peopleStore.init();

  return cloneEmployeesArray(peopleStore.hrPeople.map(personToEmployee));
};

export const useEmployeesStore = defineStore("employees", {
  state: () => ({
    items: [] as EmployeeProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) => {
      const direct = state.items.find(
        (employee) => String(employee.id) === String(id),
      );
      if (direct) return direct;

      const peopleStore = usePeopleStore();
      peopleStore.init();

      const legacyMatch = peopleStore.hrPeople.find(
        (person) => String(person.legacyEmployeeId) === String(id),
      );

      return legacyMatch ? personToEmployee(legacyMatch) : null;
    },
    search:
      (state) =>
      (query: string): EmployeeProperties[] => {
        const q = query.trim().toLowerCase();
        if (!q) return state.items;

        return state.items.filter((employee) => {
          const haystacks = [
            employee.fullName,
            employee.email,
            employee.number,
            employee.city,
            employee.country,
            employee.channel,
            employee.status,
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

      const peopleStore = usePeopleStore();
      peopleStore.init();
      this.items = refreshEmployees();
      this.initialized = true;

      if (!(this as any)._peopleUnsubscribe) {
        (this as any)._peopleUnsubscribe = peopleStore.$subscribe(
          () => {
            this.items = refreshEmployees();
          },
          { detached: true },
        );
      }
    },

    refresh() {
      this.items = refreshEmployees();
    },

    addEmployee(payload: Partial<EmployeeProperties>) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? peopleStore.nextId();
      const created = peopleStore.upsertEmployee({ ...payload, id });
      this.refresh();

      return created;
    },

    updateEmployee(id: number | string, patch: Partial<EmployeeProperties>) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      const updated = peopleStore.patchEmployee(id, patch);
      this.refresh();

      return updated;
    },

    addRecord(contactId: number | string, record: EmployeeRecord) {
      const employee = this.byId(contactId);
      if (!employee) return null;

      const records = [record, ...(employee.records ?? [])];

      return this.updateEmployee(contactId, { records });
    },

    updateRecord(contactId: number | string, record: EmployeeRecord) {
      const employee = this.byId(contactId);
      if (!employee) return null;

      const records = (employee.records ?? []).map((entry) =>
        String(entry.id) === String(record.id)
          ? { ...entry, ...record }
          : entry,
      );

      return this.updateEmployee(contactId, { records });
    },

    removeRecord(contactId: number | string, recordId: number | string) {
      const employee = this.byId(contactId);
      if (!employee) return null;

      const records = (employee.records ?? []).filter(
        (entry) => String(entry.id) !== String(recordId),
      );

      return this.updateEmployee(contactId, { records });
    },

    removeEmployee(id: number | string) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      peopleStore.removeEmployeeProfile(id);
      this.refresh();
    },

    addRequest(
      employeeId: number | string,
      request: Partial<EmployeeRequest> & { type: string },
    ) {
      const employee = this.byId(employeeId);
      if (!employee) return null;

      const existing = Array.isArray(employee.requests)
        ? employee.requests
        : [];
      const newId =
        existing.length > 0
          ? Math.max(...existing.map((entry) => Number(entry.id) || 0)) + 1
          : 1;
      const newRequest = {
        ...request,
        id: newId,
        status: (request as any).status || "pending",
        createdAt: (request as any).createdAt || new Date().toISOString(),
      } as EmployeeRequest;
      const requests = [newRequest, ...existing];

      this.updateEmployee(employeeId, { requests });

      return newRequest;
    },

    updateRequest(
      employeeId: number | string,
      requestId: number | string,
      patch: Partial<EmployeeRequest>,
    ) {
      const employee = this.byId(employeeId);
      if (!employee) return null;

      const requests = (employee.requests ?? []).map((entry) =>
        String(entry.id) === String(requestId) ? { ...entry, ...patch } : entry,
      ) as EmployeeRequest[];

      this.updateEmployee(employeeId, { requests });

      return requests.find((entry) => String(entry.id) === String(requestId));
    },

    removeRequest(employeeId: number | string, requestId: number | string) {
      const employee = this.byId(employeeId);
      if (!employee) return null;

      const requests = (employee.requests ?? []).filter(
        (entry) => String(entry.id) !== String(requestId),
      );

      this.updateEmployee(employeeId, { requests });

      return requests;
    },

    nextId() {
      const peopleStore = usePeopleStore();
      peopleStore.init();

      return peopleStore.nextId();
    },

    replaceAll(employees: EmployeeProperties[]) {
      const peopleStore = usePeopleStore();
      peopleStore.init();
      peopleStore.replaceEmployees(cloneEmployeesArray(employees));
      this.refresh();
    },
  },
});

export type { EmployeePosition, EmployeeSalaryRecord };
