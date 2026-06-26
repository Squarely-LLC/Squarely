import type { ProformaRecord } from "@db/apps/proforma/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";
import { database as quotationDatabase } from "../quotation/db";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";

const year = new Date().getFullYear();

const defaultPurchasedProducts = (
  total = 2720,
): ProformaRecord["purchasedProducts"] => [
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
): ProformaRecord["quotation"]["client"] => ({
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
    throw new Error(`Missing contact seed for proforma client ${contactId}`);
  }

  return mapContactToClient(contact);
};

const getSeedAvatar = (contactId: number) => {
  const contact = contactsDb.users.find((entry) => entry.id === contactId);

  if (!contact) {
    throw new Error(`Missing contact seed for proforma avatar ${contactId}`);
  }

  return contact.picture || "";
};

const buildStandaloneRecord = (
  id: number,
  status: ProformaRecord["quotation"]["quotationStatus"],
  avatar: string,
  overrides: Partial<ProformaRecord["quotation"]> &
    Partial<
      Pick<
        ProformaRecord,
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
    client: ProformaRecord["quotation"]["client"];
  },
  payments: ProformaRecord["payments"] = [],
): ProformaRecord => {
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
    quoteNumber: `PF-${id}`,
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
  paymentDetails: {
    totalDue: `$${total.toLocaleString()}`,
    bankName: "Byblos Bank",
    country: "Lebanon",
    iban: "LB12345678901234567890123456",
    swiftCode: "BYBALBBX",
  },
  payments,
  purchasedProducts,
  note: "Pricing is valid for 14 days from the issue date.",
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
  salesperson: "Nour Khoury",
  thanksNote: "Thank you for considering Squarely.",
  };
};
const toProformaQuoteNumber = (quoteNumber: string) =>
  quoteNumber.replace(/^QT-/, "PF-");

const toProformaAttachmentName = (attachmentName: string | null) => {
  if (!attachmentName) return null;

  return attachmentName
    .replace(/quotation/gi, "proforma")
    .replace(/quote/gi, "proforma");
};

const toProformaRecord = (
  quotationRecord: (typeof quotationDatabase)[number],
): ProformaRecord => ({
  quotation: {
    ...quotationRecord.quotation,
    id:
      quotationRecord.quotation.convertedProformaId ??
      quotationRecord.quotation.id,
    quoteNumber: toProformaQuoteNumber(
      `QT-${quotationRecord.quotation.convertedProformaId ?? quotationRecord.quotation.id}`,
    ),
    quotationStatus: "Not Paid",
    balance: quotationRecord.quotation.total,
    attachmentName: toProformaAttachmentName(
      quotationRecord.quotation.attachmentName,
    ),
  },
  paymentDetails: {
    ...quotationRecord.paymentDetails,
    totalDue: `$${Number(quotationRecord.quotation.total || 0).toLocaleString()}`,
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
  convertedInvoiceId: quotationRecord.quotation.convertedInvoiceId ?? null,
  salesperson: quotationRecord.salesperson,
  thanksNote: quotationRecord.thanksNote,
});

const convertedQuotationRecords: ProformaRecord[] = quotationDatabase
  .filter(
    (record) =>
      record.quotation.quotationStatus === "Converted" &&
      record.quotation.convertedProformaId,
  )
  .map((record) => toProformaRecord(record));

const standaloneRecords: ProformaRecord[] = [
  buildStandaloneRecord(6201, "Not Paid", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out proforma",
    dealId: 1,
    linkedRecordType: "deal",
  }),
  buildStandaloneRecord(6202, "Not Paid", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package",
    dealId: 2,
    linkedRecordType: "deal",
    approvalMode: "Request Approval",
    approverEmployeeId: 1,
    approvalRequestedAt: "2026-06-26T10:45:00Z",
  }),
  buildStandaloneRecord(6203, "Not Paid", "", {
    total: 3100,
    client: getSeedClient(7),
    service: "Gym reception redesign",
    dealId: null,
    linkedRecordType: null,
    source: "external",
    attachmentName: "peakfit-proforma.pdf",
  }),
  buildStandaloneRecord(6211, "Not Paid", getSeedAvatar(5), {
    quoteNumber: "PF-6202-R1",
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch design package - revision 1",
    dealId: 2,
    linkedRecordType: "deal",
    parentQuotationId: 6202,
    isRevision: true,
    revisionLabel: "R1",
  }),
];

export const database: ProformaRecord[] = [
  ...convertedQuotationRecords,
  ...standaloneRecords,
];
