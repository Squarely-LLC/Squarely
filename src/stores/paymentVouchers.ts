import { database as expenseSeedDatabase } from "@/plugins/fake-api/handlers/apps/expense/db";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { requireCurrentUserPermission } from "@/utils/authorization";

const STORAGE_KEY = "app.payment-vouchers.v2";

export type PaymentVoucherRecord = {
  id: string;
  voucherNumber: string;
  billId: number;
  billNumber: string;
  supplierName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  paymentNote: string;
  linkedPaymentId: string;
  createdAt: string;
};

type PaymentVoucherInput = Omit<PaymentVoucherRecord, "id" | "createdAt">;

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

function cloneVoucher(record: PaymentVoucherRecord): PaymentVoucherRecord {
  return safeClone(record, { ...record });
}

function cloneVoucherArray(records: PaymentVoucherRecord[]) {
  return records.map((record) => cloneVoucher(record));
}

function loadFromStorage(): PaymentVoucherRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as PaymentVoucherRecord[];
  } catch {
    return null;
  }
}

function saveToStorage(records: PaymentVoucherRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore.
  }
}

function sanitizeVoucher(record: PaymentVoucherRecord): PaymentVoucherRecord {
  const cloned = cloneVoucher(record);

  cloned.id = cloned.id?.trim() || cloned.linkedPaymentId || `voucher-${Date.now()}`;
  cloned.voucherNumber = cloned.voucherNumber?.trim() || `PV-${Date.now()}`;
  cloned.billId = Number(cloned.billId) || 0;
  cloned.billNumber = cloned.billNumber?.trim() || "";
  cloned.supplierName = cloned.supplierName?.trim() || "";
  cloned.amount = Math.max(0, Number(cloned.amount) || 0);
  cloned.date = cloned.date?.trim() || new Date().toISOString().slice(0, 10);
  cloned.paymentMethod = cloned.paymentMethod?.trim() || "Cash";
  cloned.paymentNote = cloned.paymentNote?.trim() || "";
  cloned.linkedPaymentId = cloned.linkedPaymentId?.trim() || cloned.id;
  cloned.createdAt = cloned.createdAt?.trim() || new Date().toISOString();

  return cloned;
}

function normaliseVoucher(input: PaymentVoucherInput): PaymentVoucherRecord {
  return sanitizeVoucher({
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voucher-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
}

function buildSeedVouchers(): PaymentVoucherRecord[] {
  const seedVouchers: PaymentVoucherRecord[] = [];

  expenseSeedDatabase.forEach((record) => {
    const expense = record.expense;
    const payments = Array.isArray(record.payments) ? record.payments : [];

    payments.forEach((payment, index) => {
      seedVouchers.push(
        sanitizeVoucher({
          id: payment.id || `seed-voucher-${expense.id}-${index + 1}`,
          voucherNumber:
            payment.voucherNumber || `PV-SEED-${expense.id}-${index + 1}`,
          billId: Number(expense.id) || 0,
          billNumber: expense.billNumber || "",
          supplierName: expense.supplier.name || "",
          amount: Number(payment.amount) || 0,
          date: payment.date || expense.billDate,
          paymentMethod: payment.method || expense.paymentMethod || "Cash",
          paymentNote: payment.note || record.note || "",
          linkedPaymentId:
            payment.id || `seed-payment-${expense.id}-${index + 1}`,
          createdAt: payment.createdAt || new Date().toISOString(),
        }),
      );
    });
  });

  return seedVouchers;
}

export const usePaymentVouchersStore = defineStore("paymentVouchers", {
  state: () => ({
    items: [] as PaymentVoucherRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byBillNumber: (state) => (billNumber: string) =>
      state.items.filter((item) => item.billNumber === billNumber),
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();
      this.items = stored?.length
        ? stored.map((record) => sanitizeVoucher(record))
        : buildSeedVouchers();

      saveToStorage(this.items);
      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneVoucherArray(state.items));
          },
          { detached: true },
        );
      }
    },

    addVoucher(input: PaymentVoucherInput) {
      requireCurrentUserPermission("finance", "create");

      const existing = this.items.find(
        (record) => record.linkedPaymentId === input.linkedPaymentId,
      );
      if (existing) {
        const updated = sanitizeVoucher({
          ...existing,
          ...input,
          id: existing.id,
          createdAt: existing.createdAt,
        });
        const index = this.items.findIndex((item) => item.id === existing.id);
        if (index !== -1) this.items.splice(index, 1, updated);
        return cloneVoucher(updated);
      }

      const voucher = normaliseVoucher(input);
      this.items.unshift(voucher);
      return cloneVoucher(voucher);
    },
  },
});
