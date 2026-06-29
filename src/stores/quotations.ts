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
import {
  canConvertFinanceDocument,
  normalizeFinanceApprovalFields,
} from "@/utils/financeApproval";
import {
  applyStoredFinanceApprovalDecision,
  persistFinanceApprovalDecision,
} from "@/utils/financeApprovalDecisions";
import { normalizeRichText } from "@/utils/richText";
import {
  authorizeRecord,
  filterReadableResources,
  mapAuthorizationResource,
  requireCurrentUserPermission,
} from "@/utils/authorization";
import { getSignedInAuthorRef } from "@/utils/currentAccount";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { useDealsStore } from "@/stores/deals";
import { resolveEmployeePersonId } from "@/stores/people";

const STORAGE_KEY = "app.quotations.v10";
const USER_CREATED_STORAGE_KEY = "squarely.user-created.quotations.v1";
const PROFORMA_STORAGE_KEY = "app.proformas.v6";
const INVOICE_STORAGE_KEY = "app.invoices.v5";
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
      if (!(error instanceof DOMException && error.name === "DataCloneError")) {
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

function normalizeFinanceAuthorRef(
  value?: QuotationRecord["createdBy"] | null,
) {
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

function loadRecordsFromStorageKey(key: string): QuotationRecord[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as QuotationRecord[];
  } catch (error) {
    console.warn(`Failed to load quotations from ${key}:`, error);
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

function loadFromStorage(): QuotationRecord[] | null {
  const current = loadRecordsFromStorageKey(STORAGE_KEY);
  if (current) return current;

  for (const key of legacyStorageKeys("app.quotations.", STORAGE_KEY)) {
    const legacy = loadRecordsFromStorageKey(key);
    if (legacy?.length) return legacy;
  }

  return null;
}

function loadUserCreatedFromStorage(): QuotationRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(USER_CREATED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QuotationRecord[];
  } catch (error) {
    console.warn("Failed to load user-created quotations:", error);
    return [];
  }
}

function isSeedQuotationRecord(record: QuotationRecord) {
  return database.some(
    (seed) =>
      String(seed.quotation.id) === String(record.quotation.id) &&
      String(seed.quotation.quoteNumber ?? "") ===
        String(record.quotation.quoteNumber ?? ""),
  );
}

function saveUserCreatedToStorage(records: QuotationRecord[]) {
  if (typeof window === "undefined") return;

  const userCreated = records.filter((record) => !isSeedQuotationRecord(record));

  try {
    localStorage.setItem(
      USER_CREATED_STORAGE_KEY,
      JSON.stringify(userCreated),
    );
  } catch (error) {
    console.warn("Failed to save user-created quotations:", error);
  }
}

function mergeQuotationRecords(
  baseRecords: QuotationRecord[],
  userRecords: QuotationRecord[],
) {
  const byId = new Map<string, QuotationRecord>();

  baseRecords.forEach((record) =>
    byId.set(String(record.quotation.id), record),
  );
  userRecords.forEach((record) =>
    byId.set(String(record.quotation.id), record),
  );

  return [...byId.values()];
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
    console.warn(
      `Failed to load follow-up documents from ${storageKey}:`,
      error,
    );
    return fallback;
  }
}

function saveToStorage(records: QuotationRecord[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    saveUserCreatedToStorage(records);
    records.forEach((record) =>
      persistFinanceApprovalDecision("quotation", record),
    );
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

function normaliseQuotationStatus(
  status: QuotationStatus | string | null | undefined,
): QuotationStatus {
  const trimmed = String(status ?? "")
    .trim()
    .toLowerCase();

  if (trimmed === "sent") return "Sent";
  if (trimmed === "approval" || trimmed === "approved") return "Approval";
  if (trimmed === "lost") return "Lost";
  if (trimmed === "canceled" || trimmed === "cancelled") return "Canceled";
  if (
    trimmed === "converted" ||
    trimmed === "converted to invoice" ||
    trimmed === "converted to proforma"
  ) {
    return "Converted";
  }

  return "Active";
}

function canMarkQuotationSent(status: string | null | undefined) {
  return !["Approval", "Converted", "Lost", "Canceled"].includes(
    normaliseQuotationStatus(status),
  );
}

function isLatestRevisionRecord(
  records: QuotationRecord[],
  target: QuotationRecord,
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
  normalizeFinanceApprovalFields(cloned);
  cloned.quotation.convertedProformaId =
    cloned.quotation.convertedProformaId === null ||
    cloned.quotation.convertedProformaId === undefined
      ? null
      : Number(cloned.quotation.convertedProformaId);
  cloned.quotation.convertedInvoiceId =
    cloned.quotation.convertedInvoiceId === null ||
    cloned.quotation.convertedInvoiceId === undefined
      ? null
      : Number(cloned.quotation.convertedInvoiceId);
  cloned.quotation.quotationStatus = normaliseQuotationStatus(
    cloned.quotation.quotationStatus,
  );

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
  return ["Active", "Sent", "Approval"].includes(
    normaliseQuotationStatus(status),
  );
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
  const createdBy = normalizeFinanceAuthorRef(payload.createdBy ?? null);

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
      quotationStatus: normaliseQuotationStatus(quotation.quotationStatus),
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
      convertedProformaId:
        quotation.convertedProformaId === null ||
        quotation.convertedProformaId === undefined
          ? null
          : Number(quotation.convertedProformaId),
      convertedInvoiceId:
        quotation.convertedInvoiceId === null ||
        quotation.convertedInvoiceId === undefined
          ? null
          : Number(quotation.convertedInvoiceId),
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

  return syncQuotationFinancialState(normalizeFinanceApprovalFields(record));
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
    convertedProformaId:
      quotationPatch.convertedProformaId === undefined
        ? (original.quotation.convertedProformaId ?? null)
        : quotationPatch.convertedProformaId === null
          ? null
          : Number(quotationPatch.convertedProformaId),
    convertedInvoiceId:
      quotationPatch.convertedInvoiceId === undefined
        ? (original.quotation.convertedInvoiceId ?? null)
        : quotationPatch.convertedInvoiceId === null
          ? null
          : Number(quotationPatch.convertedInvoiceId),
  };

  const merged: QuotationRecord = {
    ...original,
    ...patch,
    quotation: mergedQuotation,
    createdBy:
      patch.createdBy ?? original.createdBy ?? normalizeFinanceAuthorRef(null),
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
  if (
    merged.approvalMode === "Request Approval" &&
    patch.approvalRequestedAt !== undefined &&
    patch.approvalStatus === undefined
  ) {
    merged.approvalStatus = "pending";
  }
  merged.quotation.quotationStatus = normaliseQuotationStatus(
    quotationPatch.quotationStatus ?? original.quotation.quotationStatus,
  );

  return cloneQuotationRecord(syncQuotationFinancialState(normalizeFinanceApprovalFields(merged)));
}

const seedQuotations = () => cloneQuotationArray(database);

export const useQuotationsStore = defineStore("quotations", {
  state: () => ({
    items: [] as QuotationRecord[],
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
    byRouteId: (state) => (id: number | string) => {
      const rawId = String(id ?? "").trim();
      const quoteNumber =
        rawId.toLowerCase().startsWith("qt-") ? rawId : `QT-${rawId}`;
      const record =
        state.items.find((entry) => String(entry.quotation.id) === rawId) ??
        state.items.find(
          (entry) =>
            String(entry.quotation.quoteNumber ?? "").trim().toLowerCase() ===
              rawId.toLowerCase() ||
            String(entry.quotation.quoteNumber ?? "").trim().toLowerCase() ===
              quoteNumber.toLowerCase(),
        ) ??
        null;

      return authorizeRecord("finance", record);
    },
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

      const stored = loadFromStorage();

      const baseRecords =
        stored && stored.length ? stored : seedQuotations();
      const mergedRecords = mergeQuotationRecords(
        baseRecords,
        loadUserCreatedFromStorage(),
      );

      this.items = resequenceRevisions(
        mergedRecords.map((record) =>
          applyStoredFinanceApprovalDecision(
            "quotation",
            sanitizeStoredRecord(record),
          ),
        ),
      );

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
      requireCurrentUserPermission("finance", "create");

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
      const created = this.byId(id) ?? cloneQuotationRecord(normalised);

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
      requireCurrentUserPermission(
        "finance",
        "update",
        mapAuthorizationResource("finance", this.items[index]),
      );
      if (!isLatestRevisionRecord(this.items, this.items[index])) return null;

      const current = this.items[index];
      const quotationPatch = patch.quotation ?? {};
      const setsConvertedProforma =
        quotationPatch.convertedProformaId !== undefined &&
        quotationPatch.convertedProformaId !== null &&
        String(quotationPatch.convertedProformaId) !==
          String(current.quotation.convertedProformaId ?? "");
      const setsConvertedInvoice =
        quotationPatch.convertedInvoiceId !== undefined &&
        quotationPatch.convertedInvoiceId !== null &&
        String(quotationPatch.convertedInvoiceId) !==
          String(current.quotation.convertedInvoiceId ?? "");

      if (
        (setsConvertedProforma || setsConvertedInvoice) &&
        !canConvertFinanceDocument(current)
      ) {
        return null;
      }

      const updated = mergeQuotationRecord(current, patch);
      this.items.splice(index, 1, updated);
      this.items = resequenceRevisions(this.items);
      this.persistItems();
      return this.byId(id);
    },

    markQuotationSent(id: number | string) {
      const current = this.byId(id);
      if (
        !current ||
        !canMarkQuotationSent(current.quotation.quotationStatus)
      ) {
        return current;
      }

      return this.updateQuotation(id, {
        quotation: { quotationStatus: "Sent" },
      });
    },

    removeQuotation(id: number | string) {
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
