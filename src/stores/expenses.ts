import { database } from "@/plugins/fake-api/handlers/apps/expense/db";
import type {
  Expense,
  ExpenseRecord,
  ExpenseStatus,
  ExpenseSupplier,
} from "@/plugins/fake-api/handlers/apps/expense/types";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.expenses.v1";

type ExpensePayload = Omit<Partial<ExpenseRecord>, "expense"> & {
  expense?: Partial<Expense>;
};

function safeClone<T>(value: T, fallback: T): T {
  const raw = toRaw(value) as T;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch {
      // Fall through.
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as T;
  } catch {
    return fallback;
  }
}

function cloneSupplier(supplier: ExpenseSupplier): ExpenseSupplier {
  return safeClone(supplier, { ...supplier });
}

function cloneExpense(expense: Expense): Expense {
  return safeClone(expense, {
    ...expense,
    supplier: cloneSupplier(expense.supplier),
  });
}

export function cloneExpenseRecord(record: ExpenseRecord): ExpenseRecord {
  return safeClone(record, {
    ...record,
    expense: cloneExpense(record.expense),
  });
}

function cloneExpenseArray(records: ExpenseRecord[]) {
  return records.map((record) => cloneExpenseRecord(record));
}

function loadFromStorage(): ExpenseRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ExpenseRecord[];
  } catch {
    return null;
  }
}

function saveToStorage(records: ExpenseRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore.
  }
}

function nextExpenseId(items: ExpenseRecord[]) {
  const numericIds = items
    .map((record) => Number(record.expense.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function formatExpenseNumber(id: number) {
  return `BILL-${id}`;
}

function ensureSupplier(
  supplier: Partial<ExpenseSupplier> | undefined,
): ExpenseSupplier {
  return {
    id:
      supplier?.id === null || supplier?.id === undefined
        ? null
        : Number(supplier.id),
    name: supplier?.name?.trim() || "",
    email: supplier?.email?.trim() || "",
    phone: supplier?.phone?.trim() || "",
    address: supplier?.address?.trim() || "",
  };
}

function buildExpenseStatus(
  expense: Pick<
    Expense,
    "supplierInvoiceNumber" | "attachmentFileKey" | "attachmentName" | "paidAt"
  >,
): ExpenseStatus {
  const hasSupplierInvoice = !!expense.supplierInvoiceNumber?.trim();
  const hasAttachment =
    !!expense.attachmentFileKey?.trim() || !!expense.attachmentName?.trim();

  if (!hasSupplierInvoice || !hasAttachment) return "Flagged";
  if (expense.paidAt) return "Paid";
  return "Open";
}

function sanitizeStoredRecord(record: ExpenseRecord): ExpenseRecord {
  const cloned = cloneExpenseRecord(record);
  const paidAt = cloned.expense.paidAt?.trim() || null;

  cloned.expense.billNumber =
    cloned.expense.billNumber?.trim() ||
    formatExpenseNumber(Number(cloned.expense.id) || 0);
  cloned.expense.billDate =
    cloned.expense.billDate?.trim() || new Date().toISOString().slice(0, 10);
  cloned.expense.supplier = ensureSupplier(cloned.expense.supplier);
  cloned.expense.category = cloned.expense.category?.trim() || "";
  cloned.expense.supplierInvoiceNumber =
    cloned.expense.supplierInvoiceNumber?.trim() || "";
  cloned.expense.amount = Math.max(0, Number(cloned.expense.amount) || 0);
  cloned.expense.attachmentName = cloned.expense.attachmentName?.trim() || null;
  cloned.expense.attachmentFileKey =
    cloned.expense.attachmentFileKey?.trim() || null;
  cloned.expense.paidAt = paidAt;
  cloned.expense.avatar = cloned.expense.avatar?.trim() || null;
  cloned.expense.status = buildExpenseStatus({
    supplierInvoiceNumber: cloned.expense.supplierInvoiceNumber,
    attachmentFileKey: cloned.expense.attachmentFileKey,
    attachmentName: cloned.expense.attachmentName,
    paidAt,
  });
  cloned.note = cloned.note?.trim() || "";

  return cloned;
}

function normaliseExpenseRecord(
  payload: ExpensePayload,
  assignedId: number,
): ExpenseRecord {
  const expense: Partial<Expense> = payload.expense ?? {};
  const paidAt = expense.paidAt?.trim() || null;

  return sanitizeStoredRecord({
    expense: {
      id: assignedId,
      billNumber: expense.billNumber?.trim() || formatExpenseNumber(assignedId),
      billDate: expense.billDate || new Date().toISOString().slice(0, 10),
      supplier: ensureSupplier(expense.supplier),
      category: expense.category?.trim() || "",
      supplierInvoiceNumber: expense.supplierInvoiceNumber?.trim() || "",
      amount: Number(expense.amount) || 0,
      status: buildExpenseStatus({
        supplierInvoiceNumber: expense.supplierInvoiceNumber?.trim() || "",
        attachmentFileKey: expense.attachmentFileKey?.trim() || null,
        attachmentName: expense.attachmentName?.trim() || null,
        paidAt,
      }),
      attachmentName: expense.attachmentName?.trim() || null,
      attachmentFileKey: expense.attachmentFileKey?.trim() || null,
      paidAt,
      avatar: expense.avatar?.trim() || null,
    },
    note: payload.note?.trim() || "",
  });
}

function mergeExpenseRecord(
  original: ExpenseRecord,
  patch: ExpensePayload,
): ExpenseRecord {
  const expensePatch = patch.expense ?? {};
  const paidAt =
    expensePatch.paidAt === undefined
      ? original.expense.paidAt?.trim() || null
      : expensePatch.paidAt?.trim() || null;

  return sanitizeStoredRecord({
    ...original,
    ...patch,
    expense: {
      ...original.expense,
      ...expensePatch,
      supplier: ensureSupplier({
        ...original.expense.supplier,
        ...expensePatch.supplier,
      }),
      paidAt,
      status: buildExpenseStatus({
        supplierInvoiceNumber:
          expensePatch.supplierInvoiceNumber === undefined
            ? original.expense.supplierInvoiceNumber
            : expensePatch.supplierInvoiceNumber?.trim() || "",
        attachmentFileKey:
          expensePatch.attachmentFileKey === undefined
            ? original.expense.attachmentFileKey
            : expensePatch.attachmentFileKey?.trim() || null,
        attachmentName:
          expensePatch.attachmentName === undefined
            ? original.expense.attachmentName
            : expensePatch.attachmentName?.trim() || null,
        paidAt,
      }),
    },
    note: patch.note === undefined ? original.note : patch.note?.trim() || "",
  });
}

const seedExpenses = () => cloneExpenseArray(database);

export const useExpensesStore = defineStore("expenses", {
  state: () => ({
    items: [] as ExpenseRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((record) => String(record.expense.id) === String(id)) ??
      null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      this.items = stored?.length
        ? stored.map((record) => sanitizeStoredRecord(record))
        : seedExpenses().map((record) => sanitizeStoredRecord(record));

      saveToStorage(this.items);
      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneExpenseArray(state.items));
          },
          { detached: true },
        );
      }
    },

    nextId() {
      return nextExpenseId(this.items);
    },

    addExpense(payload: ExpensePayload) {
      const incomingId =
        payload.expense?.id && Number(payload.expense.id) > 0
          ? Number(payload.expense.id)
          : undefined;

      const id = incomingId ?? nextExpenseId(this.items);
      const normalised = normaliseExpenseRecord(payload, id);
      this.items.unshift(normalised);
      return this.byId(id);
    },

    updateExpense(id: number | string, patch: ExpensePayload) {
      const index = this.items.findIndex(
        (record) => String(record.expense.id) === String(id),
      );
      if (index === -1) return null;

      const updated = mergeExpenseRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      return this.byId(id);
    },

    removeExpense(id: number | string) {
      this.items = this.items.filter(
        (record) => String(record.expense.id) !== String(id),
      );
    },
  },
});
