import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type {
  InvoiceRecord,
  PurchasedProduct as InvoicePurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/invoice/types";
import type {
  ProformaRecord,
  PurchasedProduct as ProformaPurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/proforma/types";
import type {
  Client,
  PurchasedProduct as QuotationPurchasedProduct,
  QuotationRecord,
} from "@/plugins/fake-api/handlers/apps/quotation/types";
import type {
  FinancialConfig,
  LegalConfig,
} from "@/plugins/fake-api/handlers/config/types";
import type {
  DealItem,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import {
  buildDocumentNote,
  buildProformaNote,
  buildQuotationNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  getDocumentSequencePrefix,
} from "@/utils/quotationConfig";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";

const DEAL_DOCUMENT_DRAFT_KEYS = {
  invoice: "app.invoice.deal-draft.v1",
  proforma: "app.proforma.deal-draft.v1",
  quotation: "app.quotation.deal-draft.v1",
} as const;

const AUTO_BILLABLE_TYPES = new Set([
  "Onetime Service",
  "Product",
  "Produced Product",
  "Related Item",
]);

export type DealDocumentKind = keyof typeof DEAL_DOCUMENT_DRAFT_KEYS;

export interface DealDocumentDraftContext {
  contact?: ContactProperties | null;
  deal: DealProperties;
  financial?: FinancialConfig | null;
  legal?: LegalConfig | null;
  nextId: number;
  selectedItems: DealItem[];
}

export interface DealDocumentDraftPayloadMap {
  invoice: InvoiceRecord;
  proforma: ProformaRecord;
  quotation: QuotationRecord;
}

export interface DealDocumentDraftPayload<TKind extends DealDocumentKind> {
  quotation: DealDocumentDraftPayloadMap[TKind];
  source: "deal";
}

export const isLiteralRelatedDealItem = (item: DealItem) =>
  item.catalogueType === "Related Item";

export const isBillableRootDealItem = (item: DealItem) =>
  !item.parentItemId || isLiteralRelatedDealItem(item);

export const isAutoBillableDealItem = (item: DealItem) =>
  AUTO_BILLABLE_TYPES.has(String(item.catalogueType || ""));

export const getBillableRootDealItems = (
  items: DealItem[] | null | undefined,
) => (items || []).filter(isBillableRootDealItem);

export const getSelectableDealItems = (
  items: DealItem[] | null | undefined,
) => [...(items || [])];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultDueDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function buildClient(contact?: ContactProperties | null): Client {
  if (!contact) {
    return {
      address: "",
      company: "",
      companyEmail: "",
      contact: "",
      country: "Lebanon",
      name: "",
    };
  }

  return {
    address: contact.address?.trim() || "",
    company: contact.fullName.trim(),
    companyEmail: contact.email?.trim() || "",
    contact: contact.number?.trim() || "",
    country: contact.country?.trim() || "Lebanon",
    name: contact.fullName.trim(),
  };
}

function buildLineConstraints(item: DealItem) {
  const type = String(item.catalogueType || "");

  if (type === "Retainer Service" || type === "Reccurent Service") {
    return {
      discount: false,
      price: false,
      quantity: false,
    };
  }

  return undefined;
}

function mapDealItemToPurchasedProduct(
  item: DealItem,
):
  | QuotationPurchasedProduct
  | ProformaPurchasedProduct
  | InvoicePurchasedProduct {
  const discountValue = Number(item.discountPercent || 0);

  return {
    catalogueItemId: item.catalogueItemId ?? null,
    cost: Number(item.unitPrice || 0),
    description: item.note?.trim() || item.category?.trim() || "",
    discountType: discountValue > 0 ? "percent" : "none",
    discountValue,
    hours: Number(item.quantity || 1),
    lineConstraints: buildLineConstraints(item),
    title: item.name,
  };
}

function buildPurchasedProducts(items: DealItem[]) {
  if (!items.length) {
    return [
      {
        catalogueItemId: null,
        cost: 0,
        description: "",
        discountType: "none" as const,
        discountValue: 0,
        hours: 1,
        title: "",
      },
    ];
  }

  return items.map(mapDealItemToPurchasedProduct);
}

function buildServiceLabel(deal: DealProperties) {
  return String(deal.code || deal.name || "Architectural services").trim();
}

function buildQuotationDraftRecord({
  contact,
  deal,
  financial,
  legal,
  nextId,
  selectedItems,
}: DealDocumentDraftContext): QuotationRecord {
  const purchasedProducts = buildPurchasedProducts(selectedItems);
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    note: buildQuotationNote(financial, 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: 0,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("quotation")}${nextId}`,
      quotationStatus: "Pending",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

function buildProformaDraftRecord({
  contact,
  deal,
  financial,
  legal,
  nextId,
  selectedItems,
}: DealDocumentDraftContext): ProformaRecord {
  const purchasedProducts = buildPurchasedProducts(selectedItems);
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    convertedInvoiceId: null,
    note: buildProformaNote(financial, 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: total,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("proforma")}${nextId}`,
      quotationStatus: "Not Paid",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

function buildInvoiceDraftRecord({
  contact,
  deal,
  financial,
  legal,
  nextId,
  selectedItems,
}: DealDocumentDraftContext): InvoiceRecord {
  const purchasedProducts = buildPurchasedProducts(selectedItems);
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    note: buildDocumentNote(financial, "invoice", 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: total,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("invoice")}${nextId}`,
      quotationStatus: "Not Paid",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

export function buildDealDocumentDraftRecord<TKind extends DealDocumentKind>(
  kind: TKind,
  context: DealDocumentDraftContext,
): DealDocumentDraftPayloadMap[TKind] {
  if (kind === "quotation") {
    return buildQuotationDraftRecord(
      context,
    ) as DealDocumentDraftPayloadMap[TKind];
  }

  if (kind === "proforma") {
    return buildProformaDraftRecord(
      context,
    ) as DealDocumentDraftPayloadMap[TKind];
  }

  return buildInvoiceDraftRecord(context) as DealDocumentDraftPayloadMap[TKind];
}

export function saveDealDocumentDraft<TKind extends DealDocumentKind>(
  kind: TKind,
  quotation: DealDocumentDraftPayloadMap[TKind],
) {
  if (typeof window === "undefined") return;

  const payload: DealDocumentDraftPayload<TKind> = {
    quotation,
    source: "deal",
  };

  sessionStorage.setItem(
    DEAL_DOCUMENT_DRAFT_KEYS[kind],
    JSON.stringify(payload),
  );
}

export function loadDealDocumentDraft<TKind extends DealDocumentKind>(
  kind: TKind,
): DealDocumentDraftPayload<TKind> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(DEAL_DOCUMENT_DRAFT_KEYS[kind]);
    if (!raw) return null;

    return JSON.parse(raw) as DealDocumentDraftPayload<TKind>;
  } catch {
    return null;
  }
}

export function clearDealDocumentDraft(kind: DealDocumentKind) {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(DEAL_DOCUMENT_DRAFT_KEYS[kind]);
}
