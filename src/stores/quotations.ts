import { database } from "@/plugins/fake-api/handlers/apps/quotation/db";
import type {
  Client,
  PaymentDetails,
  PurchasedProduct,
  Quotation,
  QuotationRecord,
} from "@/plugins/fake-api/handlers/apps/quotation/types";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.quotations.v6";
type QuotationPayload = Omit<Partial<QuotationRecord>, "quotation"> & {
  quotation?: Partial<Quotation>;
};

function safeClone<T>(value: T, fallback: T): T {
  const raw = toRaw(value) as T;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn(
        "structuredClone failed while cloning quotation data:",
        error,
      );
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as T;
  } catch (error) {
    console.warn("JSON clone failed while cloning quotation data:", error);
    return fallback;
  }
}

function cloneClient(client: Client): Client {
  return safeClone(client, { ...client });
}

function cloneQuotation(quotation: Quotation): Quotation {
  return safeClone(quotation, {
    ...quotation,
    client: cloneClient(quotation.client),
  });
}

function clonePaymentDetails(paymentDetails: PaymentDetails): PaymentDetails {
  return safeClone(paymentDetails, { ...paymentDetails });
}

function clonePurchasedProduct(product: PurchasedProduct): PurchasedProduct {
  return safeClone(product, { ...product });
}

export function cloneQuotationRecord(record: QuotationRecord): QuotationRecord {
  return safeClone(record, {
    ...record,
    quotation: cloneQuotation(record.quotation),
    paymentDetails: clonePaymentDetails(record.paymentDetails),
    purchasedProducts: record.purchasedProducts.map((product) =>
      clonePurchasedProduct(product),
    ),
  });
}

function cloneQuotationArray(records: QuotationRecord[]) {
  return records.map((record) => cloneQuotationRecord(record));
}

function loadFromStorage(): QuotationRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as QuotationRecord[];
  } catch (error) {
    console.warn("Failed to load quotations from storage:", error);
    return null;
  }
}

function saveToStorage(records: QuotationRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("Failed to save quotations to storage:", error);
  }
}

function nextQuotationId(items: QuotationRecord[]) {
  const numericIds = items
    .map((record) => Number(record.quotation.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function formatQuoteNumber(id: number) {
  return `QT-${id}`;
}

function normaliseRevisionLabel(
  label: string | null | undefined,
): string | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:revision\s*)?(\d+)$/i);
  if (match?.[1]) return `R${match[1]}`;

  return trimmed.toUpperCase().startsWith("R")
    ? trimmed.toUpperCase()
    : trimmed;
}

function getRevisionNumberFromValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match =
    trimmed.match(/(?:^|-)R(\d+)$/i) || trimmed.match(/revision\s*(\d+)$/i);
  if (!match?.[1]) return null;

  return Number(match[1]);
}

function getBaseQuoteNumber(quoteNumber: string | null | undefined) {
  const trimmed = quoteNumber?.trim();
  if (!trimmed) return null;

  return trimmed.replace(/(?:-R\d+)+$/i, "");
}

function sanitizeStoredRecord(record: QuotationRecord): QuotationRecord {
  const cloned = cloneQuotationRecord(record);
  const parentQuotationId =
    cloned.quotation.parentQuotationId === null ||
    cloned.quotation.parentQuotationId === undefined
      ? null
      : Number(cloned.quotation.parentQuotationId);
  const baseQuoteNumber = getBaseQuoteNumber(cloned.quotation.quoteNumber);
  const revisionNumber =
    getRevisionNumberFromValue(cloned.quotation.revisionLabel) ??
    getRevisionNumberFromValue(cloned.quotation.quoteNumber);
  const derivedParentId =
    parentQuotationId ??
    (() => {
      const match = baseQuoteNumber?.match(/^QT-(\d+)$/i);
      return match?.[1] ? Number(match[1]) : null;
    })();
  const hasParent = Boolean(parentQuotationId);
  const isRevision =
    hasParent || Boolean(revisionNumber) || cloned.quotation.isRevision;
  const finalParentId = isRevision ? derivedParentId : null;

  cloned.quotation.parentQuotationId = finalParentId;
  cloned.quotation.isRevision = Boolean(finalParentId);
  cloned.quotation.revisionLabel = finalParentId
    ? normaliseRevisionLabel(
        revisionNumber ? `R${revisionNumber}` : cloned.quotation.revisionLabel,
      )
    : null;

  if (finalParentId && baseQuoteNumber) {
    const safeRevisionNumber = revisionNumber ?? 1;
    cloned.quotation.quoteNumber = `${baseQuoteNumber}-R${safeRevisionNumber}`;
  } else if (baseQuoteNumber) {
    cloned.quotation.quoteNumber = baseQuoteNumber;
  }

  return cloned;
}

function resequenceRevisions(records: QuotationRecord[]): QuotationRecord[] {
  const cloned = cloneQuotationArray(records);
  const parentQuoteNumbers = new Map<number, string>();

  for (const record of cloned) {
    if (record.quotation.parentQuotationId) continue;

    parentQuoteNumbers.set(
      record.quotation.id,
      getBaseQuoteNumber(record.quotation.quoteNumber) ??
        formatQuoteNumber(record.quotation.id),
    );
  }

  const revisionsByParent = new Map<number, QuotationRecord[]>();

  for (const record of cloned) {
    if (!record.quotation.parentQuotationId) continue;

    const parentId = Number(record.quotation.parentQuotationId);
    const existing = revisionsByParent.get(parentId) ?? [];
    existing.push(record);
    revisionsByParent.set(parentId, existing);
  }

  for (const [parentId, revisions] of revisionsByParent.entries()) {
    const fallbackBaseQuoteNumber =
      getBaseQuoteNumber(revisions[0]?.quotation.quoteNumber) ??
      formatQuoteNumber(parentId);
    const baseQuoteNumber =
      parentQuoteNumbers.get(parentId) ?? fallbackBaseQuoteNumber;

    revisions
      .sort((a, b) => {
        const revisionA =
          getRevisionNumberFromValue(a.quotation.revisionLabel) ??
          getRevisionNumberFromValue(a.quotation.quoteNumber) ??
          Number.MAX_SAFE_INTEGER;
        const revisionB =
          getRevisionNumberFromValue(b.quotation.revisionLabel) ??
          getRevisionNumberFromValue(b.quotation.quoteNumber) ??
          Number.MAX_SAFE_INTEGER;

        if (revisionA !== revisionB) return revisionA - revisionB;

        const issuedA = new Date(a.quotation.issuedDate).getTime();
        const issuedB = new Date(b.quotation.issuedDate).getTime();
        if (issuedA !== issuedB) return issuedA - issuedB;

        return a.quotation.id - b.quotation.id;
      })
      .forEach((record, index) => {
        const revisionNumber = index + 1;
        record.quotation.parentQuotationId = parentId;
        record.quotation.isRevision = true;
        record.quotation.revisionLabel = `R${revisionNumber}`;
        record.quotation.quoteNumber = `${baseQuoteNumber}-R${revisionNumber}`;
      });
  }

  return cloned;
}

function defaultPaymentDetails(total: number): PaymentDetails {
  return {
    totalDue: `$${Number(total || 0).toLocaleString()}`,
    bankName: "Byblos Bank",
    country: "Lebanon",
    iban: "LB12345678901234567890123456",
    swiftCode: "BYBALBBX",
  };
}

function ensureClient(client: Partial<Client> | undefined): Client {
  return {
    address: client?.address?.trim() || "",
    company: client?.company?.trim() || client?.name?.trim() || "",
    companyEmail: client?.companyEmail?.trim() || "",
    country: client?.country?.trim() || "Lebanon",
    contact: client?.contact?.trim() || "",
    name: client?.name?.trim() || "",
  };
}

function ensureProducts(
  products: PurchasedProduct[] | undefined | null,
): PurchasedProduct[] {
  if (!Array.isArray(products) || !products.length) {
    return [
      {
        title: "Concept design",
        cost: 0,
        hours: 1,
        description: "",
      },
    ];
  }

  return products.map((product) => ({
    title: product.title?.trim() || "New line item",
    cost: Number(product.cost) || 0,
    hours: Number(product.hours) || 1,
    description: product.description?.trim() || "",
  }));
}

function normaliseQuotationRecord(
  payload: QuotationPayload,
  assignedId: number,
): QuotationRecord {
  const quotation: Partial<Quotation> = payload.quotation ?? {};
  const client = ensureClient(quotation.client);
  const total = Number(quotation.total) || 0;

  return {
    quotation: {
      id: assignedId,
      quoteNumber:
        quotation.quoteNumber?.trim() || formatQuoteNumber(assignedId),
      issuedDate: quotation.issuedDate || new Date().toISOString().slice(0, 10),
      dueDate:
        quotation.dueDate ||
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      client,
      service: quotation.service?.trim() || "Architectural services",
      total,
      avatar: quotation.avatar || "",
      quotationStatus: quotation.quotationStatus ?? "Pending",
      balance: Number(quotation.balance) || 0,
      dealId:
        quotation.dealId === null || quotation.dealId === undefined
          ? null
          : Number(quotation.dealId),
      linkedRecordType: quotation.linkedRecordType ?? null,
      source: quotation.source ?? "squarely",
      attachmentName: quotation.attachmentName ?? null,
      parentQuotationId:
        quotation.parentQuotationId === null ||
        quotation.parentQuotationId === undefined
          ? null
          : Number(quotation.parentQuotationId),
      isRevision: quotation.isRevision ?? false,
      revisionLabel: normaliseRevisionLabel(quotation.revisionLabel),
    },
    paymentDetails: payload.paymentDetails
      ? clonePaymentDetails(payload.paymentDetails)
      : defaultPaymentDetails(total),
    purchasedProducts: ensureProducts(payload.purchasedProducts),
    note:
      payload.note?.trim() ||
      "Pricing is valid for 14 days from the issue date.",
    paymentMethod: payload.paymentMethod?.trim() || "Bank Transfer",
    salesperson: payload.salesperson?.trim() || "Squarely Team",
    thanksNote:
      payload.thanksNote?.trim() || "Thank you for considering Squarely.",
  };
}

function mergeQuotationRecord(
  original: QuotationRecord,
  patch: QuotationPayload,
): QuotationRecord {
  const quotationPatch: Partial<Quotation> = patch.quotation ?? {};
  const mergedQuotation: Quotation = {
    ...original.quotation,
    ...quotationPatch,
    client: ensureClient({
      ...original.quotation.client,
      ...quotationPatch.client,
    }),
    total:
      quotationPatch.total === undefined
        ? original.quotation.total
        : Number(quotationPatch.total) || 0,
    balance:
      quotationPatch.balance === undefined
        ? original.quotation.balance
        : Number(quotationPatch.balance) || 0,
    dealId:
      quotationPatch.dealId === undefined
        ? original.quotation.dealId
        : quotationPatch.dealId === null
          ? null
          : Number(quotationPatch.dealId),
    parentQuotationId:
      quotationPatch.parentQuotationId === undefined
        ? original.quotation.parentQuotationId
        : quotationPatch.parentQuotationId === null
          ? null
          : Number(quotationPatch.parentQuotationId),
    isRevision:
      quotationPatch.isRevision === undefined
        ? original.quotation.isRevision
        : Boolean(quotationPatch.isRevision),
    revisionLabel:
      quotationPatch.revisionLabel === undefined
        ? original.quotation.revisionLabel
        : normaliseRevisionLabel(quotationPatch.revisionLabel),
  };

  const merged: QuotationRecord = {
    ...original,
    ...patch,
    quotation: mergedQuotation,
    paymentDetails: patch.paymentDetails
      ? clonePaymentDetails(patch.paymentDetails)
      : clonePaymentDetails(original.paymentDetails),
    purchasedProducts: ensureProducts(
      patch.purchasedProducts ?? original.purchasedProducts,
    ),
    note: patch.note ?? original.note,
    paymentMethod: patch.paymentMethod ?? original.paymentMethod,
    salesperson: patch.salesperson ?? original.salesperson,
    thanksNote: patch.thanksNote ?? original.thanksNote,
  };

  merged.paymentDetails.totalDue = `$${Number(
    merged.quotation.total || 0,
  ).toLocaleString()}`;

  return cloneQuotationRecord(merged);
}

const seedQuotations = () => cloneQuotationArray(database);

export const useQuotationsStore = defineStore("quotations", {
  state: () => ({
    items: [] as QuotationRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    summaries: (state) =>
      state.items
        .map((record) => record.quotation)
        .filter((quotation) => !quotation.parentQuotationId),
    revisionsByParent: (state) => (parentId: number | string) =>
      state.items
        .map((record) => record.quotation)
        .filter(
          (quotation) =>
            quotation.parentQuotationId &&
            String(quotation.parentQuotationId) === String(parentId),
        ),
    byId: (state) => (id: number | string) =>
      state.items.find(
        (record) => String(record.quotation.id) === String(id),
      ) ?? null,
    clients: (state) => {
      const seen = new Set<string>();

      return state.items
        .map((record) => record.quotation.client)
        .filter((client) => {
          const key = `${client.name}|${client.companyEmail}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((client) => cloneClient(client));
    },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      // Migrate: remove all older storage versions
      if (typeof window !== "undefined") {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("app.quotations.") && key !== STORAGE_KEY) {
            localStorage.removeItem(key);
          }
        }
      }

      const stored = loadFromStorage();

      if (stored && stored.length) {
        this.items = resequenceRevisions(
          stored.map((record) => sanitizeStoredRecord(record)),
        );
        saveToStorage(this.items);
      } else {
        this.items = resequenceRevisions(
          seedQuotations().map((record) => sanitizeStoredRecord(record)),
        );
        saveToStorage(this.items);
      }

      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneQuotationArray(state.items));
          },
          { detached: true },
        );
      }
    },

    nextId() {
      return nextQuotationId(this.items);
    },

    addQuotation(payload: QuotationPayload) {
      const incomingId =
        payload.quotation?.id && Number(payload.quotation.id) > 0
          ? Number(payload.quotation.id)
          : undefined;

      const id = incomingId ?? nextQuotationId(this.items);
      const normalised = sanitizeStoredRecord(
        normaliseQuotationRecord(payload, id),
      );
      this.items.unshift(normalised);
      this.items = resequenceRevisions(this.items);
      return this.byId(id);
    },

    updateQuotation(id: number | string, patch: QuotationPayload) {
      const index = this.items.findIndex(
        (record) => String(record.quotation.id) === String(id),
      );

      if (index === -1) return null;

      const updated = mergeQuotationRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      this.items = resequenceRevisions(this.items);
      return this.byId(id);
    },

    removeQuotation(id: number | string) {
      const index = this.items.findIndex(
        (record) => String(record.quotation.id) === String(id),
      );

      if (index === -1) return;

      this.items.splice(index, 1);
    },

    replaceAll(records: QuotationRecord[]) {
      this.items = resequenceRevisions(records);
    },
  },
});
