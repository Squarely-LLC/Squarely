import { database } from "@/plugins/fake-api/handlers/apps/receipt/db";
import type {
  Receipt,
  ReceiptRecord,
  ReceiptSourceType,
  ReceiptStatus,
} from "@/plugins/fake-api/handlers/apps/receipt/types";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.receipts.v1";

type ReceiptPayload = Omit<Partial<ReceiptRecord>, "receipt"> & {
  receipt?: Partial<Receipt>;
};

type LinkedPaymentReceiptInput = {
  documentType: "invoice" | "proforma";
  documentId: number | string;
  documentNumber: string;
  client: Partial<Receipt["client"]>;
  avatar?: string | null;
  payment: {
    id: string;
    amount: number;
    date: string;
    method?: string | null;
    note?: string | null;
  };
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

function cloneClient(client: Receipt["client"]): Receipt["client"] {
  return safeClone(client, { ...client });
}

function cloneReceipt(receipt: Receipt): Receipt {
  return safeClone(receipt, {
    ...receipt,
    client: cloneClient(receipt.client),
  });
}

export function cloneReceiptRecord(record: ReceiptRecord): ReceiptRecord {
  return safeClone(record, {
    ...record,
    receipt: cloneReceipt(record.receipt),
  });
}

function cloneReceiptArray(records: ReceiptRecord[]) {
  return records.map((record) => cloneReceiptRecord(record));
}

function loadFromStorage(): ReceiptRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ReceiptRecord[];
  } catch {
    return null;
  }
}

function saveToStorage(records: ReceiptRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore.
  }
}

function nextReceiptId(items: ReceiptRecord[]) {
  const numericIds = items
    .map((record) => Number(record.receipt.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function formatReceiptNumber(id: number) {
  return `RV-${id}`;
}

function normaliseSourceType(
  sourceType: ReceiptSourceType | string | null | undefined,
): ReceiptSourceType {
  const trimmed = String(sourceType ?? "")
    .trim()
    .toLowerCase();

  if (trimmed === "invoice") return "invoice";
  if (trimmed === "proforma") return "proforma";
  if (trimmed === "attachment") return "attachment";

  return "manual";
}

function resolveReceiptStatus(sourceType: ReceiptSourceType): ReceiptStatus {
  return sourceType === "manual" || sourceType === "attachment"
    ? "Flagged"
    : "Recorded";
}

function ensureClient(client: Partial<Receipt["client"]> | undefined) {
  return {
    address: client?.address?.trim() || "",
    company: client?.company?.trim() || client?.name?.trim() || "",
    companyEmail: client?.companyEmail?.trim() || "",
    country: client?.country?.trim() || "Lebanon",
    contact: client?.contact?.trim() || "",
    name: client?.name?.trim() || "",
  };
}

function sanitizeStoredRecord(record: ReceiptRecord): ReceiptRecord {
  const cloned = cloneReceiptRecord(record);
  const sourceType = normaliseSourceType(cloned.receipt.sourceType);

  cloned.receipt.sourceType = sourceType;
  cloned.receipt.status = resolveReceiptStatus(sourceType);
  cloned.receipt.receiptNumber =
    cloned.receipt.receiptNumber?.trim() ||
    formatReceiptNumber(cloned.receipt.id);
  cloned.receipt.issuedDate =
    cloned.receipt.issuedDate?.trim() || new Date().toISOString().slice(0, 10);
  cloned.receipt.receivedDate =
    cloned.receipt.receivedDate?.trim() || cloned.receipt.issuedDate;
  cloned.receipt.linkedPaymentId =
    cloned.receipt.linkedPaymentId?.trim() || null;
  cloned.receipt.client = ensureClient(cloned.receipt.client);
  cloned.receipt.amount = Math.max(0, Number(cloned.receipt.amount) || 0);
  cloned.receipt.avatar = cloned.receipt.avatar?.trim() || "";
  cloned.receipt.linkedInvoiceId =
    cloned.receipt.linkedInvoiceId === null ||
    cloned.receipt.linkedInvoiceId === undefined
      ? null
      : Number(cloned.receipt.linkedInvoiceId);
  cloned.receipt.linkedProformaId =
    cloned.receipt.linkedProformaId === null ||
    cloned.receipt.linkedProformaId === undefined
      ? null
      : Number(cloned.receipt.linkedProformaId);
  cloned.receipt.linkedInvoiceNumber =
    cloned.receipt.linkedInvoiceNumber?.trim() || null;
  cloned.receipt.linkedProformaNumber =
    cloned.receipt.linkedProformaNumber?.trim() || null;
  cloned.receipt.attachmentName = cloned.receipt.attachmentName?.trim() || null;
  cloned.receipt.attachmentFileKey =
    cloned.receipt.attachmentFileKey?.trim() || null;
  cloned.paymentMethod = cloned.paymentMethod?.trim() || "Cash";
  cloned.note = cloned.note?.trim() || "";

  return cloned;
}

function normaliseReceiptRecord(
  payload: ReceiptPayload,
  assignedId: number,
): ReceiptRecord {
  const receipt: Partial<Receipt> = payload.receipt ?? {};
  const sourceType = normaliseSourceType(receipt.sourceType);

  return sanitizeStoredRecord({
    receipt: {
      id: assignedId,
      receiptNumber:
        receipt.receiptNumber?.trim() || formatReceiptNumber(assignedId),
      issuedDate: receipt.issuedDate || new Date().toISOString().slice(0, 10),
      receivedDate:
        receipt.receivedDate || new Date().toISOString().slice(0, 10),
      linkedPaymentId: receipt.linkedPaymentId?.trim() || null,
      client: ensureClient(receipt.client),
      amount: Number(receipt.amount) || 0,
      avatar: receipt.avatar?.trim() || "",
      status: resolveReceiptStatus(sourceType),
      sourceType,
      linkedInvoiceId:
        receipt.linkedInvoiceId === null ||
        receipt.linkedInvoiceId === undefined
          ? null
          : Number(receipt.linkedInvoiceId),
      linkedInvoiceNumber: receipt.linkedInvoiceNumber?.trim() || null,
      linkedProformaId:
        receipt.linkedProformaId === null ||
        receipt.linkedProformaId === undefined
          ? null
          : Number(receipt.linkedProformaId),
      linkedProformaNumber: receipt.linkedProformaNumber?.trim() || null,
      attachmentName: receipt.attachmentName?.trim() || null,
      attachmentFileKey: receipt.attachmentFileKey?.trim() || null,
    },
    paymentMethod: payload.paymentMethod?.trim() || "Cash",
    note: payload.note?.trim() || "",
  });
}

function mergeReceiptRecord(
  original: ReceiptRecord,
  patch: ReceiptPayload,
): ReceiptRecord {
  const receiptPatch = patch.receipt ?? {};
  const sourceType = normaliseSourceType(
    receiptPatch.sourceType ?? original.receipt.sourceType,
  );

  return sanitizeStoredRecord({
    ...original,
    ...patch,
    receipt: {
      ...original.receipt,
      ...receiptPatch,
      client: ensureClient({
        ...original.receipt.client,
        ...receiptPatch.client,
      }),
      linkedPaymentId:
        receiptPatch.linkedPaymentId === undefined
          ? original.receipt.linkedPaymentId
          : receiptPatch.linkedPaymentId?.trim() || null,
      status: resolveReceiptStatus(sourceType),
      sourceType,
    },
    paymentMethod:
      patch.paymentMethod === undefined
        ? original.paymentMethod
        : patch.paymentMethod?.trim() || "Cash",
    note: patch.note === undefined ? original.note : patch.note?.trim() || "",
  });
}

const seedReceipts = () => cloneReceiptArray(database);

export const useReceiptsStore = defineStore("receipts", {
  state: () => ({
    items: [] as ReceiptRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((record) => String(record.receipt.id) === String(id)) ??
      null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      this.items = stored?.length
        ? stored.map((record) => sanitizeStoredRecord(record))
        : seedReceipts().map((record) => sanitizeStoredRecord(record));

      saveToStorage(this.items);
      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneReceiptArray(state.items));
          },
          { detached: true },
        );
      }
    },

    nextId() {
      return nextReceiptId(this.items);
    },

    addReceipt(payload: ReceiptPayload) {
      const incomingId =
        payload.receipt?.id && Number(payload.receipt.id) > 0
          ? Number(payload.receipt.id)
          : undefined;

      const id = incomingId ?? nextReceiptId(this.items);
      const normalised = normaliseReceiptRecord(payload, id);
      this.items.unshift(normalised);
      return this.byId(id);
    },

    addReceiptFromLinkedPayment(input: LinkedPaymentReceiptInput) {
      const paymentId = input.payment.id?.trim();
      const amount = Math.max(0, Number(input.payment.amount) || 0);
      if (!paymentId || amount <= 0) return null;

      const existing = this.items.find((record) => {
        if (record.receipt.linkedPaymentId !== paymentId) return false;

        return input.documentType === "invoice"
          ? String(record.receipt.linkedInvoiceId) === String(input.documentId)
          : String(record.receipt.linkedProformaId) ===
              String(input.documentId);
      });
      if (existing) return cloneReceiptRecord(existing);

      return this.addReceipt({
        receipt: {
          issuedDate: input.payment.date,
          receivedDate: input.payment.date,
          linkedPaymentId: paymentId,
          client: ensureClient(input.client),
          amount,
          avatar: input.avatar?.trim() || "",
          sourceType: input.documentType,
          linkedInvoiceId:
            input.documentType === "invoice" ? Number(input.documentId) : null,
          linkedInvoiceNumber:
            input.documentType === "invoice" ? input.documentNumber : null,
          linkedProformaId:
            input.documentType === "proforma" ? Number(input.documentId) : null,
          linkedProformaNumber:
            input.documentType === "proforma" ? input.documentNumber : null,
          attachmentName: null,
          attachmentFileKey: null,
        },
        paymentMethod: input.payment.method?.trim() || "Cash",
        note: input.payment.note?.trim() || "",
      });
    },

    updateReceipt(id: number | string, patch: ReceiptPayload) {
      const index = this.items.findIndex(
        (record) => String(record.receipt.id) === String(id),
      );

      if (index === -1) return null;

      const updated = mergeReceiptRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      return this.byId(id);
    },

    removeReceipt(id: number | string) {
      this.items = this.items.filter(
        (record) => String(record.receipt.id) !== String(id),
      );
    },
  },
});
