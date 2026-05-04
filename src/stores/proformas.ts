import { database } from "@/plugins/fake-api/handlers/apps/proforma/db";
import type {
    Client,
    PaymentDetails,
    Proforma,
    ProformaPaymentEntry,
    ProformaRecord,
    ProformaStatus,
    PurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/proforma/types";
import {
    cloneDealBillingPeriod,
    inferDealBillingPeriodFromKey,
} from "@/utils/dealDocumentDraft";
import {
    buildProformaNote,
    buildQuotationPaymentDetails,
    buildQuotationSalesperson,
    buildQuotationThanksNote,
    getDocumentSequencePrefix,
    loadActiveAppConfigurations,
} from "@/utils/quotationConfig";
import { normalizeRichText } from "@/utils/richText";
import { defineStore } from "pinia";
import { toRaw } from "vue";

const STORAGE_KEY = "app.proformas.v2";
type ProformaPayload = Omit<Partial<ProformaRecord>, "quotation"> & {
  quotation?: Partial<Proforma>;
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

function cloneQuotation(quotation: Proforma): Proforma {
  return safeClone(quotation, {
    ...quotation,
    client: cloneClient(quotation.client),
  });
}

function clonePaymentDetails(paymentDetails: PaymentDetails): PaymentDetails {
  return safeClone(paymentDetails, { ...paymentDetails });
}

function cloneProformaPayment(
  payment: ProformaPaymentEntry,
): ProformaPaymentEntry {
  return safeClone(payment, { ...payment });
}

function clonePurchasedProduct(product: PurchasedProduct): PurchasedProduct {
  return safeClone(product, { ...product });
}

export function cloneProformaRecord(record: ProformaRecord): ProformaRecord {
  return safeClone(record, {
    ...record,
    quotation: cloneQuotation(record.quotation),
    paymentDetails: clonePaymentDetails(record.paymentDetails),
    payments: (record.payments ?? []).map((payment) =>
      cloneProformaPayment(payment),
    ),
    purchasedProducts: record.purchasedProducts.map((product) =>
      clonePurchasedProduct(product),
    ),
  });
}

function cloneProformaArray(records: ProformaRecord[]) {
  return records.map((record) => cloneProformaRecord(record));
}

function triggerReceiptReconciliation() {
  void import("@/stores/receipts")
    .then(({ useReceiptsStore }) => {
      const receiptsStore = useReceiptsStore();
      receiptsStore.init();
      receiptsStore.reconcileLinkedPaymentReceipts();
    })
    .catch(() => {
      // Ignore reconciliation load failures.
    });
}

function loadFromStorage(): ProformaRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ProformaRecord[];
  } catch (error) {
    console.warn("Failed to load proformas from storage:", error);
    return null;
  }
}

function saveToStorage(records: ProformaRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("Failed to save proformas to storage:", error);
  }
}

function nextProformaId(items: ProformaRecord[]) {
  const numericIds = items
    .map((record) => Number(record.quotation.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function formatQuoteNumber(id: number) {
  return `${getDocumentSequencePrefix("proforma")}${id}`;
}

function normaliseProformaStatus(
  status: ProformaStatus | string | null | undefined,
): ProformaStatus {
  const trimmed = String(status ?? "")
    .trim()
    .toLowerCase();

  if (trimmed === "paid") return "Paid";
  if (trimmed === "partially paid") return "Partially Paid";

  return "Not Paid";
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

function sanitizeStoredRecord(record: ProformaRecord): ProformaRecord {
  const cloned = cloneProformaRecord(record);
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
      const match = baseQuoteNumber?.match(/(\d+)$/);
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
  cloned.payments = ensurePayments(cloned.payments);
  cloned.convertedInvoiceId =
    cloned.convertedInvoiceId === null ||
    cloned.convertedInvoiceId === undefined
      ? null
      : Number(cloned.convertedInvoiceId);
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
  cloned.quotation.quotationStatus = normaliseProformaStatus(
    cloned.quotation.quotationStatus,
  );

  syncProformaPaymentState(cloned);

  return cloned;
}

function resequenceRevisions(records: ProformaRecord[]): ProformaRecord[] {
  const cloned = cloneProformaArray(records);
  const parentQuoteNumbers = new Map<number, string>();

  for (const record of cloned) {
    if (record.quotation.parentQuotationId) continue;

    parentQuoteNumbers.set(
      record.quotation.id,
      getBaseQuoteNumber(record.quotation.quoteNumber) ??
        formatQuoteNumber(record.quotation.id),
    );
  }

  const revisionsByParent = new Map<number, ProformaRecord[]>();

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
    dealSelectionKey: product.dealSelectionKey?.trim() || null,
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

function ensurePayments(
  payments: ProformaPaymentEntry[] | undefined | null,
): ProformaPaymentEntry[] {
  if (!Array.isArray(payments) || !payments.length) return [];

  return payments.map((payment, index) => ({
    id: payment.id?.trim() || `payment-${payment.date || "undated"}-${index}`,
    amount: Math.max(0, Number(payment.amount) || 0),
    date: payment.date?.trim() || new Date().toISOString().slice(0, 10),
    method: payment.method?.trim() || "Cash",
    note: payment.note?.trim() || "",
    createdAt: payment.createdAt?.trim() || new Date().toISOString(),
    balanceBefore: Math.max(0, Number(payment.balanceBefore) || 0),
    balanceAfter: Math.max(0, Number(payment.balanceAfter) || 0),
  }));
}

function formatCurrencyAmount(value: number) {
  return `$${Math.max(0, Number(value) || 0).toLocaleString()}`;
}

function resolveProformaStatusFromBalance(
  record: ProformaRecord,
): ProformaStatus {
  const total = Math.max(0, Number(record.quotation.total) || 0);
  const balance = Math.max(0, Number(record.quotation.balance) || 0);

  if (balance <= 0) return "Paid";
  if (balance < total) return "Partially Paid";

  return "Not Paid";
}

export type ProformaPaymentInput = {
  amount: number;
  date: string;
  method: string;
  note: string;
};

export function getProformaOutstandingBalance(record: ProformaRecord) {
  const total = Math.max(0, Number(record.quotation.total) || 0);
  const payments = ensurePayments(record.payments);

  if (payments.length) {
    const paidAmount = payments.reduce(
      (sum, payment) => sum + Math.max(0, Number(payment.amount) || 0),
      0,
    );

    return Math.max(0, total - paidAmount);
  }

  const storedBalance = Math.max(0, Number(record.quotation.balance) || 0);

  return storedBalance > 0 ? storedBalance : total;
}

function syncProformaPaymentState(record: ProformaRecord) {
  record.payments = ensurePayments(record.payments);
  record.quotation.balance = getProformaOutstandingBalance(record);
  record.quotation.quotationStatus = resolveProformaStatusFromBalance(record);
  record.paymentDetails.totalDue = formatCurrencyAmount(
    record.quotation.balance,
  );

  return record;
}

export function applyProformaPayment(
  record: ProformaRecord,
  paymentInput: ProformaPaymentInput,
) {
  const nextRecord = cloneProformaRecord(record);
  const balanceBefore = getProformaOutstandingBalance(nextRecord);
  const amount = Math.min(
    Math.max(0, Number(paymentInput.amount) || 0),
    balanceBefore,
  );
  const paymentDate =
    paymentInput.date?.trim() || new Date().toISOString().slice(0, 10);
  const paymentMethod = paymentInput.method?.trim() || "Cash";
  const paymentNote = paymentInput.note?.trim() || "";
  const balanceAfter = Math.max(0, balanceBefore - amount);

  nextRecord.payments = [
    ...ensurePayments(nextRecord.payments),
    {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `payment-${Date.now()}`,
      amount,
      date: paymentDate,
      method: paymentMethod,
      note: paymentNote,
      createdAt: new Date().toISOString(),
      balanceBefore,
      balanceAfter,
    },
  ];
  nextRecord.quotation.balance = balanceAfter;
  nextRecord.paymentDetails.totalDue = formatCurrencyAmount(balanceAfter);

  return nextRecord;
}

function normaliseProformaRecord(
  payload: ProformaPayload,
  assignedId: number,
): ProformaRecord {
  const config = loadActiveAppConfigurations();
  const quotation: Partial<Proforma> = payload.quotation ?? {};
  const client = ensureClient(quotation.client);
  const total = Number(quotation.total) || 0;

  const record: ProformaRecord = {
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
      quotationStatus: normaliseProformaStatus(quotation.quotationStatus),
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
    payments: ensurePayments(payload.payments),
    purchasedProducts: ensureProducts(payload.purchasedProducts),
    convertedInvoiceId:
      payload.convertedInvoiceId === null ||
      payload.convertedInvoiceId === undefined
        ? null
        : Number(payload.convertedInvoiceId),
    note:
      normalizeRichText(payload.note) || buildProformaNote(config.financial, 7),
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
    approverEmployeeId:
      payload.approvalMode === "Request Approval"
        ? (payload.approverEmployeeId ?? null)
        : null,
    salesperson:
      payload.salesperson?.trim() || buildQuotationSalesperson(config.legal),
    thanksNote:
      payload.thanksNote?.trim() || buildQuotationThanksNote(config.legal),
  };

  return syncProformaPaymentState(record);
}

function mergeProformaRecord(
  original: ProformaRecord,
  patch: ProformaPayload,
): ProformaRecord {
  const quotationPatch: Partial<Proforma> = patch.quotation ?? {};
  const mergedQuotation: Proforma = {
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

  const merged: ProformaRecord = {
    ...original,
    ...patch,
    quotation: mergedQuotation,
    paymentDetails: patch.paymentDetails
      ? clonePaymentDetails(patch.paymentDetails)
      : clonePaymentDetails(original.paymentDetails),
    payments:
      patch.payments === undefined
        ? ensurePayments(original.payments)
        : ensurePayments(patch.payments),
    purchasedProducts: ensureProducts(
      patch.purchasedProducts ?? original.purchasedProducts,
    ),
    convertedInvoiceId:
      patch.convertedInvoiceId === undefined
        ? (original.convertedInvoiceId ?? null)
        : patch.convertedInvoiceId === null
          ? null
          : Number(patch.convertedInvoiceId),
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
  merged.quotation.quotationStatus = normaliseProformaStatus(
    quotationPatch.quotationStatus ?? original.quotation.quotationStatus,
  );

  return cloneProformaRecord(syncProformaPaymentState(merged));
}

const seedProformas = () => cloneProformaArray(database);

export const useProformasStore = defineStore("proformas", {
  state: () => ({
    items: [] as ProformaRecord[],
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
          if (key.startsWith("app.proformas.") && key !== STORAGE_KEY) {
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
          seedProformas().map((record) => sanitizeStoredRecord(record)),
        );
        saveToStorage(this.items);
      }

      this.initialized = true;
      triggerReceiptReconciliation();

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneProformaArray(state.items));
          },
          { detached: true },
        );
      }
    },

    nextId() {
      return nextProformaId(this.items);
    },

    addProforma(payload: ProformaPayload) {
      const incomingId =
        payload.quotation?.id && Number(payload.quotation.id) > 0
          ? Number(payload.quotation.id)
          : undefined;

      const id = incomingId ?? nextProformaId(this.items);
      const normalised = sanitizeStoredRecord(
        normaliseProformaRecord(payload, id),
      );
      this.items.unshift(normalised);
      this.items = resequenceRevisions(this.items);
      triggerReceiptReconciliation();
      return this.byId(id);
    },

    updateProforma(id: number | string, patch: ProformaPayload) {
      const index = this.items.findIndex(
        (record) => String(record.quotation.id) === String(id),
      );

      if (index === -1) return null;

      const updated = mergeProformaRecord(this.items[index], patch);
      this.items.splice(index, 1, updated);
      this.items = resequenceRevisions(this.items);
      triggerReceiptReconciliation();
      return this.byId(id);
    },

    recordPayment(id: number | string, payment: ProformaPaymentInput) {
      const current = this.byId(id);
      if (!current) return null;

      const updated = applyProformaPayment(current, payment);
      return this.updateProforma(id, updated);
    },

    removeProforma(id: number | string) {
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
      triggerReceiptReconciliation();
    },

    replaceAll(records: ProformaRecord[]) {
      this.items = resequenceRevisions(records);
      triggerReceiptReconciliation();
    },
  },
});
