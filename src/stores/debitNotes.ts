import { defineStore } from "pinia";
import { toRaw } from "vue";
import { database as invoiceSeedDatabase } from "@/plugins/fake-api/handlers/apps/invoice/db";

const STORAGE_KEY = "app.debit-notes.v2";

export type DebitNoteStatus = "Draft" | "Issued" | "Voided";

export type DebitNoteRecord = {
  id: number;
  noteNumber: string;
  issuedDate: string;
  linkedInvoiceId: number;
  linkedInvoiceNumber: string;
  clientName: string;
  amount: number;
  reason: string;
  status: DebitNoteStatus;
  note: string;
};

type DebitNotePayload = Partial<DebitNoteRecord>;

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

function cloneRecord(record: DebitNoteRecord): DebitNoteRecord {
  return safeClone(record, { ...record });
}

function cloneArray(records: DebitNoteRecord[]) {
  return records.map((record) => cloneRecord(record));
}

function loadFromStorage(): DebitNoteRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as DebitNoteRecord[];
  } catch {
    return null;
  }
}

function saveToStorage(records: DebitNoteRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore.
  }
}

function nextId(items: DebitNoteRecord[]) {
  const ids = items
    .map((item) => Number(item.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
}

function formatNoteNumber(id: number) {
  return `DN-${id}`;
}

function normalizeStatus(
  value: DebitNoteStatus | string | null | undefined,
): DebitNoteStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "issued") return "Issued";
  if (normalized === "voided") return "Voided";
  return "Draft";
}

function normalizeRecord(
  payload: DebitNotePayload,
  assignedId: number,
): DebitNoteRecord {
  return {
    id: assignedId,
    noteNumber: payload.noteNumber?.trim() || formatNoteNumber(assignedId),
    issuedDate: payload.issuedDate?.trim() || new Date().toISOString().slice(0, 10),
    linkedInvoiceId: Math.max(1, Number(payload.linkedInvoiceId) || 1),
    linkedInvoiceNumber: payload.linkedInvoiceNumber?.trim() || "",
    clientName: payload.clientName?.trim() || "",
    amount: Math.max(0, Number(payload.amount) || 0),
    reason: payload.reason?.trim() || "",
    status: normalizeStatus(payload.status),
    note: payload.note?.trim() || "",
  };
}

function buildSeedRecords(): DebitNoteRecord[] {
  const invoiceSeeds = invoiceSeedDatabase
    .map((record) => record.quotation)
    .filter((quotation) => !quotation.parentQuotationId)
    .slice(0, 2);

  if (!invoiceSeeds.length) return [];

  const template = [
    {
      amountFactor: 0.12,
      reason: "Additional scope billed after invoice issue",
      note: "Generated from invoice-level scope adjustment.",
      status: "Issued" as const,
    },
    {
      amountFactor: 0.08,
      reason: "Rate correction on approved variation",
      note: "Generated from invoice-level rate correction.",
      status: "Draft" as const,
    },
  ];

  return invoiceSeeds.map((invoice, index) => {
    const id = index + 1;
    const config = template[index] ?? template[template.length - 1];
    const computedAmount = Math.max(
      1,
      Math.round(Number(invoice.total || 0) * config.amountFactor),
    );

    return normalizeRecord(
      {
        id,
        noteNumber: `DN-${id}`,
        issuedDate: invoice.issuedDate,
        linkedInvoiceId: invoice.id,
        linkedInvoiceNumber: invoice.quoteNumber,
        clientName: invoice.client.name || invoice.client.company || "-",
        amount: computedAmount,
        reason: config.reason,
        note: config.note,
        status: config.status,
      },
      id,
    );
  });
}

export const useDebitNotesStore = defineStore("debitNotes", {
  state: () => ({
    items: [] as DebitNoteRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((record) => String(record.id) === String(id)) ?? null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();
      this.items =
        stored?.length
          ? stored.map((record, index) =>
              normalizeRecord(record, Number(record.id) || index + 1),
            )
          : buildSeedRecords();
      this.initialized = true;
      saveToStorage(this.items);

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneArray(state.items));
          },
          { detached: true },
        );
      }
    },

    addNote(payload: DebitNotePayload) {
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextId(this.items);
      const record = normalizeRecord(payload, id);
      this.items.unshift(record);
      return this.byId(id);
    },

    updateNote(id: number | string, patch: DebitNotePayload) {
      const index = this.items.findIndex(
        (record) => String(record.id) === String(id),
      );
      if (index === -1) return null;

      const current = this.items[index];
      const merged = normalizeRecord(
        {
          ...current,
          ...patch,
          id: current.id,
          noteNumber: current.noteNumber,
        },
        current.id,
      );
      this.items.splice(index, 1, merged);
      return this.byId(id);
    },

    removeNote(id: number | string) {
      this.items = this.items.filter((record) => String(record.id) !== String(id));
    },
  },
});
