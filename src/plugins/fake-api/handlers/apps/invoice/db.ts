import type { InvoiceRecord } from "@db/apps/invoice/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";
import { database as quotationDatabase } from "../quotation/db";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";
import {
  buildDocumentNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  formatCurrencyAmount,
  getDocumentSequencePrefix,
  loadActiveAppConfigurations,
} from "@/utils/quotationConfig";
import { seedEmployeeId } from "@/utils/seedIdentityGraph";

const year = new Date().getFullYear();
const appConfig = loadActiveAppConfigurations();
const invoicePrefix = getDocumentSequencePrefix("invoice", appConfig);

const formatInvoiceNumber = (id: number, revisionLabel?: string | null) =>
  `${invoicePrefix}${id}${revisionLabel ? `-${revisionLabel}` : ""}`;

const defaultPurchasedProducts = (
  total = 2720,
): InvoiceRecord["purchasedProducts"] => [
  {
    catalogueItemId: null,
    title: "Concept design",
    cost: Math.round(total * 0.6),
    hours: 1,
    discountType: "none",
    discountValue: 0,
    description: "Initial concept preparation and client revisions.",
    taxApplicable: true,
  },
  {
    catalogueItemId: null,
    title: "Technical coordination",
    cost: total - Math.round(total * 0.6),
    hours: 1,
    discountType: "none",
    discountValue: 0,
    description: "Coordination across architecture and MEP comments.",
    taxApplicable: true,
  },
];

const mapContactToClient = (
  contact: ContactProperties,
): InvoiceRecord["quotation"]["client"] => ({
  address: contact.address?.trim() || "",
  company: contact.fullName.trim(),
  companyEmail: contact.email?.trim() || "",
  country: contact.country?.trim() || "Lebanon",
  contact: contact.number?.trim() || "",
  name: contact.fullName.trim(),
});

const getSeedClient = (contactId: number) => {
  const contact = contactsDb.users.find((entry) => entry.id === contactId);

  if (!contact) {
    throw new Error(`Missing contact seed for invoice client ${contactId}`);
  }

  return mapContactToClient(contact);
};

const getSeedAvatar = (contactId: number) => {
  const contact = contactsDb.users.find((entry) => entry.id === contactId);

  if (!contact) {
    throw new Error(`Missing contact seed for invoice avatar ${contactId}`);
  }

  return contact.picture || "";
};

const buildStandaloneRecord = (
  id: number,
  status: InvoiceRecord["quotation"]["quotationStatus"],
  avatar: string,
  overrides: Partial<InvoiceRecord["quotation"]> &
    Partial<
      Pick<
        InvoiceRecord,
        | "approvalMode"
        | "approvalRequestedAt"
        | "approvalStatus"
        | "approvalApprovedAt"
        | "approvalApprovedBy"
        | "approvalRejectedAt"
        | "approvalRejectedBy"
        | "approverEmployeeId"
      >
    > & {
    client: InvoiceRecord["quotation"]["client"];
  },
  payments: InvoiceRecord["payments"] = [],
): InvoiceRecord => {
  const {
    approvalMode,
    approvalRequestedAt,
    approvalStatus,
    approvalApprovedAt,
    approvalApprovedBy,
    approvalRejectedAt,
    approvalRejectedBy,
    approverEmployeeId,
    ...quotationOverrides
  } = overrides;
  const purchasedProducts = defaultPurchasedProducts(Number(overrides.total || 0));
  const total = getQuotationGrandTotal(purchasedProducts);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return {
    quotation: {
    id,
    quoteNumber: formatInvoiceNumber(id),
    issuedDate: `${year}-04-0${(id % 7) + 1}`,
    dueDate: `${year}-04-${String((id % 7) + 12).padStart(2, "0")}`,
    service: "Architectural design services",
    avatar,
    quotationStatus: status,
    dealId: null,
    linkedRecordType: null,
    source: "squarely",
    attachmentName: null,
    parentQuotationId: null,
    isRevision: false,
    revisionLabel: null,
    ...quotationOverrides,
    attachmentFileKey: quotationOverrides.attachmentFileKey ?? null,
    total,
    balance: Math.max(total - paid, 0),
  },
  paymentDetails: buildQuotationPaymentDetails(
    total,
    appConfig.legal,
    appConfig.financial,
  ),
  payments,
  purchasedProducts,
  note: buildDocumentNote(appConfig.financial, "invoice", 30),
  showClientNote: true,
  totalFx: null,
  paymentMethod: "Bank Transfer",
  paymentLink: null,
  approvalMode: approvalMode ?? "Automatic",
  approvalRequestedAt: approvalRequestedAt ?? null,
  approvalStatus:
    approvalMode === "Request Approval" ? approvalStatus ?? "pending" : null,
  approvalApprovedAt: approvalApprovedAt ?? null,
  approvalApprovedBy: approvalApprovedBy ?? null,
  approvalRejectedAt: approvalRejectedAt ?? null,
  approvalRejectedBy: approvalRejectedBy ?? null,
  approverEmployeeId: approverEmployeeId ?? null,
  salesperson: buildQuotationSalesperson(appConfig.legal),
  thanksNote: buildQuotationThanksNote(appConfig.legal),
  };
};

const toInvoiceAttachmentName = (attachmentName: string | null) => {
  if (!attachmentName) return null;

  return attachmentName
    .replace(/quotation/gi, "invoice")
    .replace(/quote/gi, "invoice");
};

const toInvoiceRecord = (
  quotationRecord: (typeof quotationDatabase)[number],
): InvoiceRecord => ({
  quotation: {
    ...quotationRecord.quotation,
    id:
      quotationRecord.quotation.convertedInvoiceId ??
      quotationRecord.quotation.id,
    quoteNumber: formatInvoiceNumber(
      quotationRecord.quotation.convertedInvoiceId ??
        quotationRecord.quotation.id,
    ),
    quotationStatus: "Not Paid",
    balance: quotationRecord.quotation.total,
    attachmentName: toInvoiceAttachmentName(
      quotationRecord.quotation.attachmentName,
    ),
  },
  paymentDetails: {
    ...quotationRecord.paymentDetails,
    totalDue: formatCurrencyAmount(
      quotationRecord.quotation.total,
      appConfig.financial,
    ),
  },
  payments: [],
  purchasedProducts: quotationRecord.purchasedProducts.map((product) => ({
    ...product,
  })),
  note: quotationRecord.note,
  showClientNote: quotationRecord.showClientNote,
  totalFx: quotationRecord.totalFx,
  paymentMethod: quotationRecord.paymentMethod,
  paymentLink: quotationRecord.paymentLink,
  approvalMode: quotationRecord.approvalMode,
  approvalRequestedAt: quotationRecord.approvalRequestedAt ?? null,
  approvalStatus: quotationRecord.approvalStatus ?? null,
  approvalApprovedAt: quotationRecord.approvalApprovedAt ?? null,
  approvalApprovedBy: quotationRecord.approvalApprovedBy ?? null,
  approvalRejectedAt: quotationRecord.approvalRejectedAt ?? null,
  approvalRejectedBy: quotationRecord.approvalRejectedBy ?? null,
  approverEmployeeId: quotationRecord.approverEmployeeId,
  salesperson: quotationRecord.salesperson,
  thanksNote: quotationRecord.thanksNote,
});

const convertedQuotationRecords: InvoiceRecord[] = quotationDatabase
  .filter(
    (record) =>
      record.quotation.quotationStatus === "Converted" &&
      record.quotation.convertedInvoiceId,
  )
  .map((record) => toInvoiceRecord(record));

const standaloneRecords: InvoiceRecord[] = [
  buildStandaloneRecord(6301, "Not Paid", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out invoice",
    dealId: 1,
    linkedRecordType: "deal",
  }, [
    {
      id: "inv-pay-6301-1",
      amount: 2100,
      date: `${year}-04-14`,
      method: "Bank Transfer",
      note: "Initial partial payment posted by finance.",
      createdAt: `${year}-04-14T10:00:00Z`,
      balanceBefore: 4200,
      balanceAfter: 2100,
    },
  ]),
  buildStandaloneRecord(6302, "Partially Paid", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch execution invoice",
    dealId: 2,
    linkedRecordType: "deal",
    approvalMode: "Request Approval",
    approverEmployeeId: seedEmployeeId.lina,
    approvalRequestedAt: "2026-06-26T11:05:00Z",
  }, [
    {
      id: "inv-pay-6302-1",
      amount: 3200,
      date: `${year}-04-12`,
      method: "Credit Card",
      note: "Card settlement batch 1.",
      createdAt: `${year}-04-12T12:00:00Z`,
      balanceBefore: 7600,
      balanceAfter: 4400,
    },
  ]),
  buildStandaloneRecord(6311, "Paid", getSeedAvatar(5), {
    quoteNumber: formatInvoiceNumber(6302, "R1"),
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch execution invoice - revision 1",
    dealId: 2,
    linkedRecordType: "deal",
    parentQuotationId: 6302,
    isRevision: true,
    revisionLabel: "R1",
  }, [
    {
      id: "inv-pay-6311-1",
      amount: 7350,
      date: `${year}-04-16`,
      method: "Bank Transfer",
      note: "Revision invoice settled in full.",
      createdAt: `${year}-04-16T14:30:00Z`,
      balanceBefore: 7350,
      balanceAfter: 0,
    },
  ]),
  buildStandaloneRecord(6401, "Partially Paid", getSeedAvatar(15), {
    total: 1800,
    client: getSeedClient(15),
    service: "Landscaping concept and permitting package",
    dealId: 3,
    linkedRecordType: "deal",
  }, [
    {
      id: "inv-pay-6401-1",
      amount: 900,
      date: `${year}-04-17`,
      method: "Bank Transfer",
      note: "First installment received.",
      createdAt: `${year}-04-17T11:15:00Z`,
      balanceBefore: 1800,
      balanceAfter: 900,
    },
  ]),
];

export const database: InvoiceRecord[] = [
  ...convertedQuotationRecords,
  ...standaloneRecords,
];
