import { database } from "@/plugins/fake-api/handlers/apps/expense/db";
import type {
  Expense,
  ExpensePaymentEntry,
  ExpenseRecord,
  ExpenseStatus,
  ExpenseSupplier,
} from "@/plugins/fake-api/handlers/apps/expense/types";
import { useContactsStore } from "@/stores/contacts";
import { saveFile } from "@/utils/fileStore";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.expenses.v2";

const SEEDED_ATTACHMENT_FACTORIES: Record<
  number,
  () => File
> = {
  1: () =>
    new File(
      [
        `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 174 >>
stream
BT
/F1 18 Tf
72 720 Td
(Office Supplies Bill) Tj
0 -28 Td
/F1 12 Tf
(Supplier: Nora Farouk) Tj
0 -20 Td
(Invoice: NF-4821) Tj
0 -20 Td
(Bill Date: 2026-04-12) Tj
0 -20 Td
(Amount: $185.00) Tj
0 -20 Td
(Seeded attachment preview for expense BILL-1.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000473 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
543
%%EOF`,
      ],
      "office-supplies-apr.pdf",
      { type: "application/pdf" },
    ),
};

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

function cloneExpensePayment(
  payment: ExpensePaymentEntry,
): ExpensePaymentEntry {
  return safeClone(payment, { ...payment });
}

export function cloneExpenseRecord(record: ExpenseRecord): ExpenseRecord {
  return safeClone(record, {
    ...record,
    expense: cloneExpense(record.expense),
    payments: (record.payments ?? []).map((payment) =>
      cloneExpensePayment(payment),
    ),
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

async function ensureSeedExpenseAttachments(records: ExpenseRecord[]) {
  const clonedRecords = cloneExpenseArray(records);
  let hasChanges = false;

  for (const record of clonedRecords) {
    if (record.expense.attachmentFileKey?.trim()) continue;
    if (!record.expense.attachmentName?.trim()) continue;

    const createSeedAttachment = SEEDED_ATTACHMENT_FACTORIES[record.expense.id];
    if (!createSeedAttachment) continue;

    try {
      const fileKey = await saveFile(createSeedAttachment());
      record.expense.attachmentFileKey = fileKey;
      hasChanges = true;
    } catch {
      // Ignore seed attachment failures and keep the record usable.
    }
  }

  return hasChanges ? clonedRecords : records;
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

function normalisePaymentMethod(
  paymentMethod: string | null | undefined,
): "Bank Transfer" | "Cash" | "Credit Card" {
  const trimmed = paymentMethod?.trim().toLowerCase();

  if (
    trimmed === "credit card" ||
    trimmed === "credit" ||
    trimmed === "debit" ||
    trimmed === "card"
  ) {
    return "Credit Card";
  }

  if (trimmed === "cash") return "Cash";

  return "Bank Transfer";
}

function ensurePayments(
  payments: ExpensePaymentEntry[] | undefined | null,
): ExpensePaymentEntry[] {
  if (!Array.isArray(payments) || !payments.length) return [];

  return payments.map((payment, index) => ({
    id: payment.id?.trim() || `expense-payment-${payment.date || "undated"}-${index}`,
    voucherNumber:
      payment.voucherNumber?.trim() || `PV-${Date.now()}-${index + 1}`,
    amount: Math.max(0, Number(payment.amount) || 0),
    date: payment.date?.trim() || new Date().toISOString().slice(0, 10),
    method: normalisePaymentMethod(payment.method),
    note: payment.note?.trim() || "",
    createdAt: payment.createdAt?.trim() || new Date().toISOString(),
    balanceBefore: Math.max(0, Number(payment.balanceBefore) || 0),
    balanceAfter: Math.max(0, Number(payment.balanceAfter) || 0),
  }));
}

export function getExpenseOutstandingBalance(record: ExpenseRecord) {
  const total = Math.max(0, Number(record.expense.amount) || 0);
  const payments = ensurePayments(record.payments);

  if (payments.length) {
    const paidAmount = payments.reduce(
      (sum, payment) => sum + Math.max(0, Number(payment.amount) || 0),
      0,
    );

    return Math.max(0, total - paidAmount);
  }

  const storedBalance = Math.max(0, Number(record.expense.balance) || 0);
  return storedBalance > 0 ? storedBalance : total;
}

function resolveExpenseStatus(record: ExpenseRecord): ExpenseStatus {
  const hasSupplierInvoice = !!record.expense.supplierInvoiceNumber?.trim();
  const hasAttachment =
    !!record.expense.attachmentFileKey?.trim() ||
    !!record.expense.attachmentName?.trim();
  const total = Math.max(0, Number(record.expense.amount) || 0);
  const balance = Math.max(0, Number(record.expense.balance) || 0);

  if (balance <= 0 && total > 0) return "Paid";
  if (balance < total) return "Partially Paid";
  if (!hasSupplierInvoice || !hasAttachment) return "Flagged";

  return "Open";
}

function syncExpensePaymentState(record: ExpenseRecord) {
  record.payments = ensurePayments(record.payments);
  record.expense.balance = getExpenseOutstandingBalance(record);
  record.expense.status = resolveExpenseStatus(record);
  record.expense.paymentMethod = normalisePaymentMethod(
    record.expense.paymentMethod,
  );
  record.expense.paidAt =
    record.expense.balance <= 0 && record.payments.length
      ? record.payments[record.payments.length - 1]?.date || record.expense.paidAt
      : null;

  return record;
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
  cloned.expense.balance = Math.max(
    0,
    Number(cloned.expense.balance ?? cloned.expense.amount) || 0,
  );
  cloned.expense.attachmentName = cloned.expense.attachmentName?.trim() || null;
  cloned.expense.attachmentFileKey =
    cloned.expense.attachmentFileKey?.trim() || null;
  cloned.expense.paidAt = paidAt;
  cloned.expense.avatar = cloned.expense.avatar?.trim() || null;
  cloned.expense.paymentMethod = normalisePaymentMethod(
    cloned.expense.paymentMethod,
  );
  cloned.payments = ensurePayments(cloned.payments);
  cloned.note = cloned.note?.trim() || "";

  return syncExpensePaymentState(cloned);
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
      balance:
        expense.balance === undefined
          ? Number(expense.amount) || 0
          : Number(expense.balance) || 0,
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
      paymentMethod: normalisePaymentMethod(expense.paymentMethod),
    },
    payments: ensurePayments(payload.payments),
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
      balance:
        expensePatch.balance === undefined
          ? original.expense.balance
          : Number(expensePatch.balance) || 0,
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
      paymentMethod: normalisePaymentMethod(
        expensePatch.paymentMethod ?? original.expense.paymentMethod,
      ),
    },
    payments:
      patch.payments === undefined ? original.payments : ensurePayments(patch.payments),
    note: patch.note === undefined ? original.note : patch.note?.trim() || "",
  });
}

export type ExpensePaymentInput = {
  paymentId?: string | null;
  amount: number;
  date: string;
  method: string;
  note: string;
  voucherNumber?: string | null;
};

function recalculateExpensePayments(record: ExpenseRecord) {
  const total = Math.max(0, Number(record.expense.amount) || 0);
  let remaining = total;

  record.payments = ensurePayments(record.payments).map((payment) => {
    const normalizedAmount = Math.min(
      Math.max(0, Number(payment.amount) || 0),
      remaining,
    );
    const balanceBefore = remaining;
    const balanceAfter = Math.max(0, balanceBefore - normalizedAmount);
    remaining = balanceAfter;

    return {
      ...payment,
      amount: normalizedAmount,
      method: normalisePaymentMethod(payment.method),
      note: payment.note?.trim() || "",
      balanceBefore,
      balanceAfter,
    };
  });

  record.expense.balance = remaining;
  record.expense.paidAt =
    remaining <= 0 && record.payments.length
      ? record.payments[record.payments.length - 1]?.date || record.expense.paidAt
      : null;

  return syncExpensePaymentState(record);
}

export function applyExpensePayment(
  record: ExpenseRecord,
  paymentInput: ExpensePaymentInput,
) {
  const nextRecord = cloneExpenseRecord(record);
  const balanceBefore = getExpenseOutstandingBalance(nextRecord);
  const amount = Math.min(
    Math.max(0, Number(paymentInput.amount) || 0),
    balanceBefore,
  );
  const paymentDate =
    paymentInput.date?.trim() || new Date().toISOString().slice(0, 10);
  const paymentMethod = normalisePaymentMethod(paymentInput.method);
  const paymentNote = paymentInput.note?.trim() || "";
  const balanceAfter = Math.max(0, balanceBefore - amount);

  nextRecord.payments = [
    ...ensurePayments(nextRecord.payments),
    {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `expense-payment-${Date.now()}`,
      voucherNumber:
        paymentInput.voucherNumber?.trim() || `PV-${Date.now()}`,
      amount,
      date: paymentDate,
      method: paymentMethod,
      note: paymentNote,
      createdAt: new Date().toISOString(),
      balanceBefore,
      balanceAfter,
    },
  ];
  nextRecord.expense.balance = balanceAfter;
  nextRecord.expense.paymentMethod = paymentMethod;
  nextRecord.expense.paidAt = balanceAfter <= 0 ? paymentDate : null;

  return syncExpensePaymentState(nextRecord);
}

export function applyExpensePaymentUpdate(
  record: ExpenseRecord,
  paymentInput: ExpensePaymentInput,
) {
  const paymentId = paymentInput.paymentId?.trim();
  if (!paymentId) return null;

  const nextRecord = cloneExpenseRecord(record);
  const nextPayments = ensurePayments(nextRecord.payments);
  const targetIndex = nextPayments.findIndex((payment) => payment.id === paymentId);
  if (targetIndex === -1) return null;

  const total = Math.max(0, Number(nextRecord.expense.amount) || 0);
  const paidByOtherEntries = nextPayments.reduce((sum, payment, index) => {
    if (index === targetIndex) return sum;
    return sum + Math.max(0, Number(payment.amount) || 0);
  }, 0);
  const maxAmount = Math.max(0, total - paidByOtherEntries);
  const nextAmount = Math.min(Math.max(0, Number(paymentInput.amount) || 0), maxAmount);
  const nextDate = paymentInput.date?.trim() || new Date().toISOString().slice(0, 10);
  const nextMethod = normalisePaymentMethod(paymentInput.method);
  const nextNote = paymentInput.note?.trim() || "";

  nextPayments[targetIndex] = {
    ...nextPayments[targetIndex],
    amount: nextAmount,
    date: nextDate,
    method: nextMethod,
    note: nextNote,
  };

  nextRecord.payments = nextPayments;
  nextRecord.expense.paymentMethod = nextMethod;

  return recalculateExpensePayments(nextRecord);
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
    async init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();
      const initialItems = stored?.length ? stored : seedExpenses();
      const hydratedItems = await ensureSeedExpenseAttachments(initialItems);

      this.items = hydratedItems.map((record) => sanitizeStoredRecord(record));
      this.syncSupplierContactFlags();

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
      this.flagSupplierContact(normalised.expense.supplier);
      return this.byId(id);
    },

    updateExpense(id: number | string, patch: ExpensePayload) {
      const index = this.items.findIndex(
        (record) => String(record.expense.id) === String(id),
      );
      if (index === -1) return null;

      const updated = mergeExpenseRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      this.flagSupplierContact(updated.expense.supplier);
      return this.byId(id);
    },

    addPayment(id: number | string, paymentInput: ExpensePaymentInput) {
      const index = this.items.findIndex(
        (record) => String(record.expense.id) === String(id),
      );
      if (index === -1) return null;

      const updated = applyExpensePayment(this.items[index], paymentInput);
      this.items.splice(index, 1, updated);
      return this.byId(id);
    },

    updatePayment(id: number | string, paymentInput: ExpensePaymentInput) {
      const index = this.items.findIndex(
        (record) => String(record.expense.id) === String(id),
      );
      if (index === -1) return null;

      const updated = applyExpensePaymentUpdate(this.items[index], paymentInput);
      if (!updated) return null;
      this.items.splice(index, 1, updated);
      return this.byId(id);
    },

    removeExpense(id: number | string) {
      this.items = this.items.filter(
        (record) => String(record.expense.id) !== String(id),
      );
    },

    flagSupplierContact(supplier: ExpenseSupplier | null | undefined) {
      const supplierId = Number(supplier?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) return;

      const contactsStore = useContactsStore();
      contactsStore.init();

      const contact = contactsStore.byId(supplierId);
      if (!contact || contact.class === "Supplier") return;

      contactsStore.updateContact(supplierId, { class: "Supplier" });
    },

    syncSupplierContactFlags() {
      const uniqueSupplierIds = new Set<number>();

      this.items.forEach((record) => {
        const supplierId = Number(record.expense.supplier.id);
        if (!Number.isFinite(supplierId) || supplierId <= 0) return;
        uniqueSupplierIds.add(supplierId);
      });

      uniqueSupplierIds.forEach((supplierId) => {
        this.flagSupplierContact({
          id: supplierId,
          name: "",
          email: "",
          phone: "",
          address: "",
        });
      });
    },
  },
});
