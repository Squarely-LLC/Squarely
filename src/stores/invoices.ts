import { database } from "@/plugins/fake-api/handlers/apps/invoice/db";
import type {
  Client,
  Invoice,
  InvoicePaymentEntry,
  InvoiceRecord,
  InvoiceStatus,
  PaymentDetails,
  PurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/invoice/types";
import {
  cloneDealBillingPeriod,
  inferDealBillingPeriodFromKey,
} from "@/utils/dealDocumentDraft";
import {
  buildDocumentNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  getDocumentSequencePrefix,
  loadActiveAppConfigurations,
} from "@/utils/quotationConfig";
import {
  canRecordInvoicePayment,
  canConvertFinanceDocument,
  conversionNoteReferencesDocument,
} from "@/utils/financeApproval";
import {
  applyStoredFinanceApprovalDecision,
  persistFinanceApprovalDecision,
} from "@/utils/financeApprovalDecisions";
import { getSignedInAuthorRef } from "@/utils/currentAccount";
import { normalizeRichText } from "@/utils/richText";
import {
  authorizeRecord,
  filterReadableResources,
  mapAuthorizationResource,
  requireCurrentUserPermission,
} from "@/utils/authorization";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { useDealsStore } from "@/stores/deals";
import { resolveEmployeePersonId } from "@/stores/people";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";

const STORAGE_KEY = "app.invoices.v5";
type InvoicePayload = Omit<Partial<InvoiceRecord>, "quotation"> & {
  quotation?: Partial<Invoice>;
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

function cloneQuotation(quotation: Invoice): Invoice {
  return safeClone(quotation, {
    ...quotation,
    client: cloneClient(quotation.client),
  });
}

function clonePaymentDetails(paymentDetails: PaymentDetails): PaymentDetails {
  return safeClone(paymentDetails, { ...paymentDetails });
}

function cloneInvoicePayment(
  payment: InvoicePaymentEntry,
): InvoicePaymentEntry {
  return safeClone(payment, { ...payment });
}

function clonePurchasedProduct(product: PurchasedProduct): PurchasedProduct {
  return safeClone(product, { ...product });
}

export function cloneInvoiceRecord(record: InvoiceRecord): InvoiceRecord {
  return safeClone(record, {
    ...record,
    quotation: cloneQuotation(record.quotation),
    paymentDetails: clonePaymentDetails(record.paymentDetails),
    payments: (record.payments ?? []).map((payment) =>
      cloneInvoicePayment(payment),
    ),
    purchasedProducts: record.purchasedProducts.map((product) =>
      clonePurchasedProduct(product),
    ),
  });
}

function cloneInvoiceArray(records: InvoiceRecord[]) {
  return records.map((record) => cloneInvoiceRecord(record));
}

function normalizeFinanceAuthorRef(value?: InvoiceRecord["createdBy"] | null) {
  const author = value ?? getSignedInAuthorRef();
  const id =
    author?.id ?? author?.personId ?? author?.employeeId ?? author?.accountId;

  return {
    id,
    accountId: author?.accountId ?? undefined,
    employeeId: author?.employeeId ?? undefined,
    personId: author?.personId ?? undefined,
    name: author?.name ?? undefined,
    email: author?.email ?? undefined,
    avatarUrl: author?.avatarUrl ?? undefined,
  };
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

function triggerInvoiceSequenceCleanup(invoiceIds: Array<number | string>) {
  const normalizedIds = invoiceIds
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);
  if (!normalizedIds.length) return;

  void Promise.all([
    import("@/stores/proformas"),
    import("@/stores/quotations"),
  ])
    .then(([{ useProformasStore }, { useQuotationsStore }]) => {
      const deletedIds = new Set(normalizedIds);
      const proformasStore = useProformasStore();
      const quotationsStore = useQuotationsStore();

      proformasStore.init();
      quotationsStore.init();

      proformasStore.items
        .filter((record) =>
          deletedIds.has(String(record.convertedInvoiceId ?? "")),
        )
        .forEach((record) => {
          proformasStore.updateProforma(record.quotation.id, {
            convertedInvoiceId: null,
          });
        });

      quotationsStore.items
        .filter((record) =>
          deletedIds.has(String(record.quotation.convertedInvoiceId ?? "")),
        )
        .forEach((record) => {
          const convertedProformaId =
            record.quotation.convertedProformaId ?? null;
          const hasRelatedProforma =
            convertedProformaId !== null &&
            Boolean(proformasStore.byId(convertedProformaId));

          quotationsStore.updateQuotation(record.quotation.id, {
            quotation: {
              convertedInvoiceId: null,
              quotationStatus: hasRelatedProforma ? "Converted" : "Approval",
            },
          });
        });
    })
    .catch(() => {
      // Ignore cleanup load failures; delete still succeeds.
    });
}

function loadRecordsFromStorageKey(key: string): InvoiceRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as InvoiceRecord[];
  } catch (error) {
    console.warn(`Failed to load invoices from ${key}:`, error);
    return null;
  }
}

const storageVersionNumber = (key: string) => {
  const match = key.match(/\.v(\d+)$/i);

  return match?.[1] ? Number(match[1]) : 0;
};

function legacyStorageKeys(prefix: string, currentKey: string) {
  if (typeof window === "undefined") return [];

  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix) && key !== currentKey)
    .sort((left, right) => storageVersionNumber(right) - storageVersionNumber(left));
}

function loadFromStorage(): InvoiceRecord[] | null {
  const current = loadRecordsFromStorageKey(STORAGE_KEY);
  if (current) return current;

  for (const key of legacyStorageKeys("app.invoices.", STORAGE_KEY)) {
    const legacy = loadRecordsFromStorageKey(key);
    if (legacy?.length) return legacy;
  }

  return null;
}

function saveToStorage(records: InvoiceRecord[]) {
  if (typeof window === "undefined") return;

  try {
    records.forEach((record) =>
      persistFinanceApprovalDecision("invoice", record),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("Failed to save invoices to storage:", error);
  }
}

function nextInvoiceId(items: InvoiceRecord[]) {
  const numericIds = items
    .map((record) => Number(record.quotation.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericIds.length) return 1;

  return Math.max(...numericIds) + 1;
}

function formatQuoteNumber(id: number) {
  return `${getDocumentSequencePrefix("invoice")}${id}`;
}

function normaliseInvoiceStatus(
  status: InvoiceStatus | string | null | undefined,
): InvoiceStatus {
  const trimmed = String(status ?? "")
    .trim()
    .toLowerCase();

  if (trimmed === "paid") return "Paid";
  if (trimmed === "partially paid") return "Partially Paid";
  if (trimmed === "canceled" || trimmed === "cancelled") return "Canceled";

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

function isLatestRevisionRecord(
  records: InvoiceRecord[],
  target: InvoiceRecord,
) {
  const rootId = target.quotation.parentQuotationId ?? target.quotation.id;
  const family = records.filter(
    (record) =>
      record.quotation.id === rootId ||
      record.quotation.parentQuotationId === rootId,
  );

  if (family.length <= 1) return true;

  const latest = family.reduce((currentLatest, record) =>
    Number(record.quotation.id) > Number(currentLatest.quotation.id)
      ? record
      : currentLatest,
  );

  return String(latest.quotation.id) === String(target.quotation.id);
}

function sanitizeStoredRecord(record: InvoiceRecord): InvoiceRecord {
  const cloned = cloneInvoiceRecord(record);
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
  cloned.totalFx = cloned.totalFx?.trim() || null;
  cloned.showClientNote =
    cloned.showClientNote ?? config.financial?.invoicing?.showNotes ?? true;
  cloned.approvalMode =
    cloned.approvalMode === "Request Approval"
      ? "Request Approval"
      : "Automatic";
  cloned.approverEmployeeId =
    cloned.approvalMode === "Request Approval"
      ? resolveEmployeePersonId(cloned.approverEmployeeId ?? null)
      : null;
  cloned.approvalRequestedAt =
    cloned.approvalMode === "Request Approval"
      ? cloned.approvalRequestedAt?.trim() || null
      : null;
  cloned.approvalStatus =
    cloned.approvalStatus === "approved" || cloned.approvalStatus === "rejected"
      ? cloned.approvalStatus
      : cloned.approvalMode === "Request Approval"
        ? "pending"
        : null;
  cloned.approvalApprovedAt = cloned.approvalApprovedAt?.trim() || null;
  cloned.approvalApprovedBy =
    cloned.approvalApprovedBy === null || cloned.approvalApprovedBy === undefined
      ? null
      : resolveEmployeePersonId(cloned.approvalApprovedBy);
  cloned.approvalRejectedAt = cloned.approvalRejectedAt?.trim() || null;
  cloned.approvalRejectedBy =
    cloned.approvalRejectedBy === null || cloned.approvalRejectedBy === undefined
      ? null
      : resolveEmployeePersonId(cloned.approvalRejectedBy);
  cloned.quotation.quotationStatus = normaliseInvoiceStatus(
    cloned.quotation.quotationStatus,
  );

  syncInvoicePaymentState(cloned);

  return cloned;
}

function resequenceRevisions(records: InvoiceRecord[]): InvoiceRecord[] {
  const cloned = cloneInvoiceArray(records);
  const parentQuoteNumbers = new Map<number, string>();

  for (const record of cloned) {
    if (record.quotation.parentQuotationId) continue;

    parentQuoteNumbers.set(
      record.quotation.id,
      getBaseQuoteNumber(record.quotation.quoteNumber) ??
        formatQuoteNumber(record.quotation.id),
    );
  }

  const revisionsByParent = new Map<number, InvoiceRecord[]>();

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
  payments: InvoicePaymentEntry[] | undefined | null,
): InvoicePaymentEntry[] {
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

function resolveInvoiceStatusFromBalance(record: InvoiceRecord): InvoiceStatus {
  if (record.quotation.quotationStatus === "Canceled") return "Canceled";

  const total = Math.max(0, Number(record.quotation.total) || 0);
  const balance = Math.max(0, Number(record.quotation.balance) || 0);

  if (balance <= 0) return "Paid";
  if (balance < total) return "Partially Paid";

  return "Not Paid";
}

export type InvoicePaymentInput = {
  amount: number;
  date: string;
  method: string;
  note: string;
};

export function getInvoiceOutstandingBalance(record: InvoiceRecord) {
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

function syncInvoicePaymentState(record: InvoiceRecord) {
  record.payments = ensurePayments(record.payments);
  record.quotation.balance = getInvoiceOutstandingBalance(record);
  record.quotation.quotationStatus = resolveInvoiceStatusFromBalance(record);
  record.paymentDetails.totalDue = formatCurrencyAmount(
    record.quotation.balance,
  );

  return record;
}

export function applyInvoicePayment(
  record: InvoiceRecord,
  paymentInput: InvoicePaymentInput,
) {
  const nextRecord = cloneInvoiceRecord(record);
  const balanceBefore = getInvoiceOutstandingBalance(nextRecord);
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

function normaliseInvoiceRecord(
  payload: InvoicePayload,
  assignedId: number,
): InvoiceRecord {
  const config = loadActiveAppConfigurations();
  const quotation: Partial<Invoice> = payload.quotation ?? {};
  const client = ensureClient(quotation.client);
  const total = Number(quotation.total) || 0;
  const createdBy = normalizeFinanceAuthorRef(payload.createdBy ?? null);

  const record: InvoiceRecord = {
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
      quotationStatus: normaliseInvoiceStatus(quotation.quotationStatus),
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
    createdBy,
    createdById:
      payload.createdById ??
      createdBy.personId ??
      createdBy.employeeId ??
      createdBy.id ??
      null,
    paymentDetails: payload.paymentDetails
      ? clonePaymentDetails(payload.paymentDetails)
      : defaultPaymentDetails(total),
    payments: ensurePayments(payload.payments),
    purchasedProducts: ensureProducts(payload.purchasedProducts),
    note:
      normalizeRichText(payload.note) ||
      buildDocumentNote(config.financial, "invoice", 7),
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
    approvalStatus:
      payload.approvalMode === "Request Approval"
        ? payload.approvalStatus === "approved" ||
          payload.approvalStatus === "rejected"
          ? payload.approvalStatus
          : "pending"
        : null,
    approvalApprovedAt: payload.approvalApprovedAt?.trim() || null,
    approvalApprovedBy:
      payload.approvalApprovedBy === null ||
      payload.approvalApprovedBy === undefined
        ? null
        : resolveEmployeePersonId(payload.approvalApprovedBy),
    approvalRejectedAt: payload.approvalRejectedAt?.trim() || null,
    approvalRejectedBy:
      payload.approvalRejectedBy === null ||
      payload.approvalRejectedBy === undefined
        ? null
        : resolveEmployeePersonId(payload.approvalRejectedBy),
    approverEmployeeId:
      payload.approvalMode === "Request Approval"
        ? resolveEmployeePersonId(payload.approverEmployeeId ?? null)
        : null,
    salesperson:
      payload.salesperson?.trim() || buildQuotationSalesperson(config.legal),
    thanksNote:
      payload.thanksNote?.trim() || buildQuotationThanksNote(config.legal),
  };

  return syncInvoicePaymentState(record);
}

function mergeInvoiceRecord(
  original: InvoiceRecord,
  patch: InvoicePayload,
): InvoiceRecord {
  const quotationPatch: Partial<Invoice> = patch.quotation ?? {};
  const mergedQuotation: Invoice = {
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

  const merged: InvoiceRecord = {
    ...original,
    ...patch,
    quotation: mergedQuotation,
    createdBy: patch.createdBy === undefined ? original.createdBy ?? null : patch.createdBy,
    createdById:
      patch.createdById ??
      original.createdById ??
      original.createdBy?.personId ??
      original.createdBy?.employeeId ??
      original.createdBy?.id ??
      null,
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
    approvalStatus:
      patch.approvalStatus === undefined
        ? original.approvalStatus ?? null
        : patch.approvalStatus ?? null,
    approvalApprovedAt:
      patch.approvalApprovedAt === undefined
        ? original.approvalApprovedAt?.trim() || null
        : patch.approvalApprovedAt?.trim() || null,
    approvalApprovedBy:
      patch.approvalApprovedBy === undefined
        ? original.approvalApprovedBy ?? null
        : patch.approvalApprovedBy === null || patch.approvalApprovedBy === undefined
          ? null
          : resolveEmployeePersonId(patch.approvalApprovedBy),
    approvalRejectedAt:
      patch.approvalRejectedAt === undefined
        ? original.approvalRejectedAt?.trim() || null
        : patch.approvalRejectedAt?.trim() || null,
    approvalRejectedBy:
      patch.approvalRejectedBy === undefined
        ? original.approvalRejectedBy ?? null
        : patch.approvalRejectedBy === null || patch.approvalRejectedBy === undefined
          ? null
          : resolveEmployeePersonId(patch.approvalRejectedBy),
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
        ? resolveEmployeePersonId(original.approverEmployeeId ?? null)
        : resolveEmployeePersonId(patch.approverEmployeeId ?? null)
      : null;
  merged.approvalRequestedAt =
    merged.approvalMode === "Request Approval"
      ? patch.approvalRequestedAt === undefined
        ? original.approvalRequestedAt?.trim() || null
        : patch.approvalRequestedAt?.trim() || null
      : null;
  if (merged.approvalMode !== "Request Approval") {
    merged.approvalStatus = null;
    merged.approvalApprovedAt = null;
    merged.approvalApprovedBy = null;
    merged.approvalRejectedAt = null;
    merged.approvalRejectedBy = null;
  } else if (
    patch.approvalRequestedAt !== undefined &&
    patch.approvalStatus === undefined
  ) {
    merged.approvalStatus = "pending";
    merged.approvalApprovedAt = null;
    merged.approvalApprovedBy = null;
    merged.approvalRejectedAt = null;
    merged.approvalRejectedBy = null;
  } else {
    merged.approvalStatus =
      merged.approvalStatus === "approved" || merged.approvalStatus === "rejected"
        ? merged.approvalStatus
        : "pending";

    if (merged.approvalStatus === "approved") {
      merged.approvalRejectedAt = null;
      merged.approvalRejectedBy = null;
    } else if (merged.approvalStatus === "rejected") {
      merged.approvalApprovedAt = null;
      merged.approvalApprovedBy = null;
    } else {
      merged.approvalApprovedAt = null;
      merged.approvalApprovedBy = null;
      merged.approvalRejectedAt = null;
      merged.approvalRejectedBy = null;
    }
  }
  merged.quotation.quotationStatus = normaliseInvoiceStatus(
    quotationPatch.quotationStatus ?? original.quotation.quotationStatus,
  );

  return cloneInvoiceRecord(syncInvoicePaymentState(merged));
}

const seedInvoices = () => cloneInvoiceArray(database);

export const useInvoicesStore = defineStore("invoices", {
  state: () => ({
    items: [] as InvoiceRecord[],
    initialized: false,
  }),
  getters: {
    all: (state) => filterReadableResources("finance", state.items),
    summaries: (state) =>
      filterReadableResources("finance", state.items)
        .map((record) => record.quotation)
        .filter((quotation) => !quotation.parentQuotationId),
    revisionsByParent: (state) => (parentId: number | string) =>
      filterReadableResources("finance", state.items)
        .map((record) => record.quotation)
        .filter(
          (quotation) =>
            quotation.parentQuotationId &&
            String(quotation.parentQuotationId) === String(parentId),
        ),
    byId: (state) => (id: number | string) =>
      authorizeRecord(
        "finance",
        state.items.find(
          (record) => String(record.quotation.id) === String(id),
        ) ?? null,
      ),
    clients: (state) => {
      const seen = new Set<string>();

      return filterReadableResources("finance", state.items)
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
      saveToStorage(cloneInvoiceArray(this.items));
    },

    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();

      if (stored && stored.length) {
        this.items = resequenceRevisions(
          stored.map((record) =>
            applyStoredFinanceApprovalDecision(
              "invoice",
              sanitizeStoredRecord(record),
            ),
          ),
        );
        saveToStorage(this.items);
      } else {
        this.items = resequenceRevisions(
          seedInvoices().map((record) =>
            applyStoredFinanceApprovalDecision(
              "invoice",
              sanitizeStoredRecord(record),
            ),
          ),
        );
        saveToStorage(this.items);
      }

      this.initialized = true;
      triggerReceiptReconciliation();

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneInvoiceArray(state.items));
          },
          { detached: true },
        );
      }
    },

    nextId() {
      return nextInvoiceId(this.items);
    },

    addInvoice(payload: InvoicePayload) {
      requireCurrentUserPermission("finance", "create");

      const quotationsStore = useQuotationsStore();
      const proformasStore = useProformasStore();
      quotationsStore.init();
      proformasStore.init();
      const sourceQuotation = quotationsStore.all.find((record) =>
        conversionNoteReferencesDocument(
          payload.note,
          "quotation",
          record.quotation.quoteNumber,
        ),
      );
      const sourceProforma = proformasStore.all.find((record) =>
        conversionNoteReferencesDocument(
          payload.note,
          "proforma",
          record.quotation.quoteNumber,
        ),
      );

      if (
        (sourceQuotation && !canConvertFinanceDocument(sourceQuotation)) ||
        (sourceProforma && !canConvertFinanceDocument(sourceProforma))
      ) {
        return null;
      }

      const incomingId =
        payload.quotation?.id && Number(payload.quotation.id) > 0
          ? Number(payload.quotation.id)
          : undefined;

      const id = incomingId ?? nextInvoiceId(this.items);
      const normalised = sanitizeStoredRecord(
        normaliseInvoiceRecord(payload, id),
      );
      this.items.unshift(normalised);
      this.items = resequenceRevisions(this.items);
      this.persistItems();
      triggerReceiptReconciliation();
      const created = this.byId(id);

      if (created?.quotation.dealId) {
        const dealsStore = useDealsStore();
        dealsStore.init();
        const normalizedNote = String(created.note ?? "").toLowerCase();
        const lifecycleReason = normalizedNote.includes(
          "converted from quotation",
        )
          ? "Quotation converted to invoice"
          : normalizedNote.includes("converted from proforma")
            ? "Proforma converted to invoice"
            : created.quotation.source === "external"
              ? "Invoice attached"
              : "Invoice created";

        dealsStore.triggerLifecycleStageTransition(
          created.quotation.dealId,
          "Active",
          lifecycleReason,
          "invoice-created",
        );
      }

      return created;
    },

    updateInvoice(id: number | string, patch: InvoicePayload) {
      const index = this.items.findIndex(
        (record) => String(record.quotation.id) === String(id),
      );

      if (index === -1) return null;
      requireCurrentUserPermission(
        "finance",
        "update",
        mapAuthorizationResource("finance", this.items[index]),
      );
      if (!isLatestRevisionRecord(this.items, this.items[index])) return null;

      const current = this.items[index];
      const changesPayments =
        patch.payments !== undefined &&
        JSON.stringify(ensurePayments(patch.payments)) !==
          JSON.stringify(ensurePayments(current.payments));

      if (changesPayments && !canRecordInvoicePayment(current)) return null;

      const updated = mergeInvoiceRecord(current, patch);
      this.items.splice(index, 1, updated);
      this.items = resequenceRevisions(this.items);
      this.persistItems();
      triggerReceiptReconciliation();
      return this.byId(id);
    },

    recordPayment(id: number | string, payment: InvoicePaymentInput) {
      const current = this.byId(id);
      if (!current) return null;
      if (!canRecordInvoicePayment(current)) return null;

      const updated = applyInvoicePayment(current, payment);
      const nextRecord = this.updateInvoice(id, updated);

      if (nextRecord?.quotation.dealId) {
        const dealsStore = useDealsStore();
        dealsStore.init();
        void dealsStore.reevaluateDealClosureFromInvoices(
          nextRecord.quotation.dealId,
        );
      }

      return nextRecord;
    },

    removeInvoice(id: number | string) {
      const target = this.items.find(
        (record) => String(record.quotation.id) === String(id),
      );

      if (!target) return;
      requireCurrentUserPermission(
        "finance",
        "delete",
        mapAuthorizationResource("finance", target),
      );
      if (!isLatestRevisionRecord(this.items, target)) return;

      const numericId = Number(target.quotation.id);
      const parentId = target.quotation.parentQuotationId;

      const deletedInvoiceIds: Array<number | string> = [];

      this.items = this.items.filter((record) => {
        const shouldDelete =
          String(record.quotation.id) === String(id) ||
          (!parentId && record.quotation.parentQuotationId === numericId);

        if (shouldDelete) {
          deletedInvoiceIds.push(record.quotation.id);
          return false;
        }

        return true;
      });

      this.items = resequenceRevisions(this.items);
      this.persistItems();
      triggerInvoiceSequenceCleanup(deletedInvoiceIds);
      triggerReceiptReconciliation();
    },

    replaceAll(records: InvoiceRecord[]) {
      this.items = resequenceRevisions(records);
      this.persistItems();
      triggerReceiptReconciliation();
    },
  },
});
