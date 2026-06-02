import { database } from "@/plugins/fake-api/handlers/apps/quotation/db";
import type {
  Client,
  PaymentDetails,
  PurchasedProduct,
  Quotation,
  QuotationRecord,
  QuotationStatus,
} from "@/plugins/fake-api/handlers/apps/quotation/types";
import { database as seedInvoices } from "@/plugins/fake-api/handlers/apps/invoice/db";
import type { InvoiceRecord } from "@/plugins/fake-api/handlers/apps/invoice/types";
import { database as seedProformas } from "@/plugins/fake-api/handlers/apps/proforma/db";
import type { ProformaRecord } from "@/plugins/fake-api/handlers/apps/proforma/types";
import {
  cloneDealBillingPeriod,
  inferDealBillingPeriodFromKey,
} from "@/utils/dealDocumentDraft";
import {
  buildQuotationNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  getDocumentSequencePrefix,
  loadActiveAppConfigurations,
} from "@/utils/quotationConfig";
import { normalizeRichText } from "@/utils/richText";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { useDealsStore } from "@/stores/deals";

const STORAGE_KEY = "app.quotations.v6";
const PROFORMA_STORAGE_KEY = "app.proformas.v2";
const INVOICE_STORAGE_KEY = "app.invoices.v3";
type QuotationPayload = Omit<Partial<QuotationRecord>, "quotation"> & {
  quotation?: Partial<Quotation>;
};
type FollowUpDocumentRecord = ProformaRecord | InvoiceRecord;

function safeClone<T>(value: T, fallback: T): T {
  const raw = toRaw(value) as T;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      if (
        !(error instanceof DOMException && error.name === "DataCloneError")
      ) {
        console.warn(
          "structuredClone failed while cloning quotation data:",
          error,
        );
      }
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
    payments: [],
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

function loadFollowUpDocumentsFromStorage<T>(
  storageKey: string,
  fallback: T[],
): T[] {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch (error) {
    console.warn(`Failed to load follow-up documents from ${storageKey}:`, error);
    return fallback;
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
  return `${getDocumentSequencePrefix("quotation")}${id}`;
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

function normalisePaymentMethod(
  paymentMethod: string | null | undefined,
): "Bank Transfer" | "Cash" | "Credit Card" {
  const trimmed = paymentMethod?.trim().toLowerCase();

  if (
    trimmed === "credit card" ||
    trimmed === "credit" ||
    trimmed === "debit" ||
    trimmed === "paypal" ||
    trimmed === "upi transfer"
  ) {
    return "Credit Card";
  }

  if (trimmed === "cash") return "Cash";

  return "Bank Transfer";
}

function sanitizeStoredRecord(record: QuotationRecord): QuotationRecord {
  const cloned = cloneQuotationRecord(record);
  const config = loadActiveAppConfigurations();
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

  cloned.paymentMethod = normalisePaymentMethod(cloned.paymentMethod);
  cloned.paymentLink =
    cloned.paymentMethod === "Credit Card"
      ? cloned.paymentLink?.trim() || null
      : null;
  cloned.payments = [];
  cloned.totalFx = cloned.totalFx?.trim() || null;
  cloned.showClientNote =
    cloned.showClientNote ?? config.financial?.invoicing?.showNotes ?? true;
  cloned.approvalMode =
    cloned.approvalMode === "Request Approval"
      ? "Request Approval"
      : "Automatic";
  cloned.approverEmployeeId =
    cloned.approvalMode === "Request Approval"
      ? (cloned.approverEmployeeId ?? null)
      : null;
  cloned.approvalRequestedAt =
    cloned.approvalMode === "Request Approval"
      ? cloned.approvalRequestedAt?.trim() || null
      : null;

  syncQuotationFinancialState(cloned);

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
  const config = loadActiveAppConfigurations();
  return buildQuotationPaymentDetails(total, config.legal, config.financial);
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
        catalogueItemId: null,
        title: "",
        cost: 0,
        hours: 1,
        discountType: "none",
        discountValue: 0,
        description: "",
      },
    ];
  }

  return products.map((product) => ({
    catalogueItemId: product.catalogueItemId?.trim() || null,
    billingPeriod:
      cloneDealBillingPeriod(product.billingPeriod) ||
      inferDealBillingPeriodFromKey(product.billingPeriodKey),
    billingPeriodKey: product.billingPeriodKey?.trim() || null,
    lineConstraints: product.lineConstraints
      ? { ...product.lineConstraints }
      : null,
    title: product.title?.trim() || "",
    cost: Number(product.cost) || 0,
    hours: Number(product.hours) || 1,
    discountType:
      product.discountType === "percent" || product.discountType === "currency"
        ? product.discountType
        : "none",
    discountValue: Math.max(0, Number(product.discountValue || 0)),
    description: product.description?.trim() || "",
  }));
}

function formatCurrencyAmount(value: number) {
  return `$${Math.max(0, Number(value) || 0).toLocaleString()}`;
}

function parseDateOnly(value: string | null | undefined) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);

  return next;
}

function isAutoCancelableQuotationStatus(status: string | null | undefined) {
  return status === "Pending" || status === "Approved";
}

function documentReferencesQuotation(
  document: FollowUpDocumentRecord,
  quotation: Quotation,
) {
  const quoteNumber = quotation.quoteNumber.trim().toLowerCase();
  const note = String(document.note ?? "").toLowerCase();

  return Boolean(
    quoteNumber && note.includes(`converted from quotation ${quoteNumber}`),
  );
}

function isFollowUpDocumentForQuotation(
  document: FollowUpDocumentRecord,
  quotation: Quotation,
) {
  if (documentReferencesQuotation(document, quotation)) return true;

  const quotationDealId = quotation.dealId;
  const documentDealId = document.quotation.dealId;

  if (
    quotationDealId === null ||
    quotationDealId === undefined ||
    documentDealId === null ||
    documentDealId === undefined ||
    String(quotationDealId) !== String(documentDealId)
  ) {
    return false;
  }

  const quotationIssuedDate = parseDateOnly(quotation.issuedDate);
  const documentIssuedDate = parseDateOnly(document.quotation.issuedDate);

  if (!quotationIssuedDate || !documentIssuedDate) return true;

  return documentIssuedDate.getTime() >= quotationIssuedDate.getTime();
}

function shouldAutoCancelQuotation(
  record: QuotationRecord,
  followUpDocuments: FollowUpDocumentRecord[],
  configuredDays: number,
  today = new Date(),
) {
  const status = record.quotation.quotationStatus;

  if (!isAutoCancelableQuotationStatus(status)) return false;
  if (!Number.isFinite(configuredDays) || configuredDays <= 0) return false;
  if (
    followUpDocuments.some((document) =>
      isFollowUpDocumentForQuotation(document, record.quotation),
    )
  ) {
    return false;
  }

  const issuedDate = parseDateOnly(record.quotation.issuedDate);
  if (!issuedDate) return false;

  return (
    startOfDay(today).getTime() >= addDays(issuedDate, configuredDays).getTime()
  );
}

export type QuotationPaymentInput = {
  amount: number;
  date: string;
  method: string;
  note: string;
};

export function getQuotationOutstandingBalance(record: QuotationRecord) {
  const total = Math.max(0, Number(record.quotation.total) || 0);
  const storedBalance = Math.max(0, Number(record.quotation.balance) || 0);

  return storedBalance > 0 ? storedBalance : total;
}

function syncQuotationFinancialState(record: QuotationRecord) {
  record.payments = [];
  record.quotation.balance = getQuotationOutstandingBalance(record);
  record.paymentDetails.totalDue = formatCurrencyAmount(
    record.quotation.balance,
  );

  return record;
}

function normaliseQuotationRecord(
  payload: QuotationPayload,
  assignedId: number,
): QuotationRecord {
  const config = loadActiveAppConfigurations();
  const quotation: Partial<Quotation> = payload.quotation ?? {};
  const client = ensureClient(quotation.client);
  const total = Number(quotation.total) || 0;

  const record: QuotationRecord = {
    quotation: {
      id: assignedId,
      quoteNumber:
        quotation.quoteNumber?.trim() || formatQuoteNumber(assignedId),
      issuedDate: quotation.issuedDate || new Date().toISOString().slice(0, 10),
      dueDate:
        quotation.dueDate ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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
      attachmentFileKey: quotation.attachmentFileKey ?? null,
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
    payments: [],
    purchasedProducts: ensureProducts(payload.purchasedProducts),
    note:
      normalizeRichText(payload.note) ||
      buildQuotationNote(config.financial, 7),
    showClientNote:
      payload.showClientNote ?? config.financial?.invoicing?.showNotes ?? true,
    totalFx: payload.totalFx?.trim() || null,
    paymentMethod: normalisePaymentMethod(payload.paymentMethod),
    paymentLink:
      normalisePaymentMethod(payload.paymentMethod) === "Credit Card"
        ? payload.paymentLink?.trim() || null
        : null,
    approvalMode:
      payload.approvalMode === "Request Approval"
        ? "Request Approval"
        : "Automatic",
    approvalRequestedAt:
      payload.approvalMode === "Request Approval"
        ? payload.approvalRequestedAt?.trim() || null
        : null,
    approverEmployeeId:
      payload.approvalMode === "Request Approval"
        ? (payload.approverEmployeeId ?? null)
        : null,
    salesperson:
      payload.salesperson?.trim() || buildQuotationSalesperson(config.legal),
    thanksNote:
      payload.thanksNote?.trim() || buildQuotationThanksNote(config.legal),
  };

  return syncQuotationFinancialState(record);
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
    payments: [],
    purchasedProducts: ensureProducts(
      patch.purchasedProducts ?? original.purchasedProducts,
    ),
    note:
      patch.note === undefined ? original.note : normalizeRichText(patch.note),
    showClientNote: patch.showClientNote ?? original.showClientNote,
    totalFx:
      patch.totalFx === undefined
        ? original.totalFx
        : patch.totalFx?.trim() || null,
    paymentMethod: normalisePaymentMethod(
      patch.paymentMethod ?? original.paymentMethod,
    ),
    paymentLink: null,
    approvalMode:
      patch.approvalMode === undefined
        ? original.approvalMode
        : patch.approvalMode === "Request Approval"
          ? "Request Approval"
          : "Automatic",
    approvalRequestedAt: null,
    approverEmployeeId: null,
    salesperson: patch.salesperson ?? original.salesperson,
    thanksNote: patch.thanksNote ?? original.thanksNote,
  };

  merged.paymentLink =
    merged.paymentMethod === "Credit Card"
      ? patch.paymentLink === undefined
        ? original.paymentLink?.trim() || null
        : patch.paymentLink?.trim() || null
      : null;
  merged.approverEmployeeId =
    merged.approvalMode === "Request Approval"
      ? patch.approverEmployeeId === undefined
        ? (original.approverEmployeeId ?? null)
        : (patch.approverEmployeeId ?? null)
      : null;
  merged.approvalRequestedAt =
    merged.approvalMode === "Request Approval"
      ? patch.approvalRequestedAt === undefined
        ? original.approvalRequestedAt?.trim() || null
        : patch.approvalRequestedAt?.trim() || null
      : null;

  return cloneQuotationRecord(syncQuotationFinancialState(merged));
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
    persistItems() {
      saveToStorage(cloneQuotationArray(this.items));
    },

    applyAutoCancellation(today = new Date()) {
      const config = loadActiveAppConfigurations();
      const configuredDays = Number(config.deals?.quotationLostIn ?? 0);

      if (!Number.isFinite(configuredDays) || configuredDays <= 0) return 0;

      const followUpDocuments: FollowUpDocumentRecord[] = [
        ...loadFollowUpDocumentsFromStorage<ProformaRecord>(
          PROFORMA_STORAGE_KEY,
          seedProformas,
        ),
        ...loadFollowUpDocumentsFromStorage<InvoiceRecord>(
          INVOICE_STORAGE_KEY,
          seedInvoices,
        ),
      ];
      let canceledCount = 0;
      const canceledDealIds = new Set<number | string>();

      this.items = this.items.map((record) => {
        if (
          !shouldAutoCancelQuotation(
            record,
            followUpDocuments,
            configuredDays,
            today,
          )
        ) {
          return record;
        }

        canceledCount += 1;
        if (
          record.quotation.dealId !== null &&
          record.quotation.dealId !== undefined
        ) {
          canceledDealIds.add(record.quotation.dealId);
        }

        return {
          ...record,
          quotation: {
            ...record.quotation,
            quotationStatus: "Canceled" as QuotationStatus,
          },
        };
      });

      if (canceledCount) {
        this.persistItems();

        if (canceledDealIds.size) {
          const dealsStore = useDealsStore();
          dealsStore.init();
          canceledDealIds.forEach((dealId) => {
            dealsStore.triggerLifecycleStageTransition(
              dealId,
              "Closed",
              "Quotation canceled",
              "quotation-canceled",
            );
          });
        }
      }

      return canceledCount;
    },

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
      } else {
        this.items = resequenceRevisions(
          seedQuotations().map((record) => sanitizeStoredRecord(record)),
        );
      }

      this.applyAutoCancellation();
      saveToStorage(this.items);
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
      this.persistItems();
      const created = this.byId(id);

      if (created?.quotation.dealId) {
        const dealsStore = useDealsStore();
        dealsStore.init();
        dealsStore.triggerLifecycleStageTransition(
          created.quotation.dealId,
          "Negotation",
          created.quotation.source === "external"
            ? "Quotation attached"
            : "Quotation created",
          "quotation-created",
        );
      }

      return created;
    },

    updateQuotation(id: number | string, patch: QuotationPayload) {
      const index = this.items.findIndex(
        (record) => String(record.quotation.id) === String(id),
      );

      if (index === -1) return null;

      const updated = mergeQuotationRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      this.items = resequenceRevisions(this.items);
      this.persistItems();
      return this.byId(id);
    },

    removeQuotation(id: number | string) {
      const target = this.items.find(
        (record) => String(record.quotation.id) === String(id),
      );

      if (!target) return;

      const numericId = Number(target.quotation.id);
      const parentId = target.quotation.parentQuotationId;

      this.items = this.items.filter((record) => {
        if (String(record.quotation.id) === String(id)) return false;

        if (!parentId && record.quotation.parentQuotationId === numericId) {
          return false;
        }

        return true;
      });

      this.items = resequenceRevisions(this.items);
      this.persistItems();
    },

    replaceAll(records: QuotationRecord[]) {
      this.items = resequenceRevisions(records);
      this.persistItems();
    },
  },
});
