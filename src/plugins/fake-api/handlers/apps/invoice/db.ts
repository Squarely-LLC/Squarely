import type { InvoiceRecord } from "@db/apps/invoice/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";
import { database as quotationDatabase } from "../quotation/db";

const year = new Date().getFullYear();

const defaultPurchasedProducts = (): InvoiceRecord["purchasedProducts"] => [
  {
    catalogueItemId: null,
    title: "Concept design",
    cost: 250,
    hours: 8,
    discountType: "none",
    discountValue: 0,
    description: "Initial concept preparation and client revisions.",
  },
  {
    catalogueItemId: null,
    title: "Technical coordination",
    cost: 180,
    hours: 4,
    discountType: "none",
    discountValue: 0,
    description: "Coordination across architecture and MEP comments.",
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
  overrides: Partial<InvoiceRecord["quotation"]> & {
    client: InvoiceRecord["quotation"]["client"];
  },
): InvoiceRecord => ({
  quotation: {
    id,
    quoteNumber: `INV-${id}`,
    issuedDate: `${year}-04-0${(id % 7) + 1}`,
    dueDate: `${year}-04-${String((id % 7) + 12).padStart(2, "0")}`,
    service: "Architectural design services",
    total: 0,
    avatar,
    quotationStatus: status,
    balance: 0,
    dealId: null,
    linkedRecordType: null,
    source: "squarely",
    attachmentName: null,
    parentQuotationId: null,
    isRevision: false,
    revisionLabel: null,
    ...overrides,
  },
  paymentDetails: {
    totalDue: `$${Number(overrides.total ?? 0).toLocaleString()}`,
    bankName: "Byblos Bank",
    country: "Lebanon",
    iban: "LB12345678901234567890123456",
    swiftCode: "BYBALBBX",
  },
  payments: [],
  purchasedProducts: defaultPurchasedProducts(),
  note: "Pricing is valid for 14 days from the issue date.",
  showClientNote: true,
  totalFx: null,
  paymentMethod: "Bank Transfer",
  paymentLink: null,
  approvalMode: "Automatic",
  approverEmployeeId: null,
  salesperson: "Nour Khoury",
  thanksNote: "Thank you for considering Squarely.",
});
const toInvoiceQuoteNumber = (quoteNumber: string) =>
  quoteNumber.replace(/^QT-/, "INV-");

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
    quoteNumber: toInvoiceQuoteNumber(quotationRecord.quotation.quoteNumber),
    quotationStatus: "Not Paid",
    attachmentName: toInvoiceAttachmentName(
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
  approverEmployeeId: quotationRecord.approverEmployeeId,
  salesperson: quotationRecord.salesperson,
  thanksNote: quotationRecord.thanksNote,
});

const convertedQuotationRecords: InvoiceRecord[] = quotationDatabase
  .filter(
    (record) => record.quotation.quotationStatus === "Converted to Invoice",
  )
  .map((record) => toInvoiceRecord(record));

const standaloneRecords: InvoiceRecord[] = [
  buildStandaloneRecord(6301, "Not Paid", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out invoice",
    dealId: 401,
    linkedRecordType: "deal",
  }),
  buildStandaloneRecord(6302, "Partially Paid", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch execution invoice",
    dealId: 402,
    linkedRecordType: "deal",
  }),
  buildStandaloneRecord(6311, "Paid", getSeedAvatar(5), {
    quoteNumber: "INV-6302-R1",
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch execution invoice - revision 1",
    dealId: 402,
    linkedRecordType: "deal",
    parentQuotationId: 6302,
    isRevision: true,
    revisionLabel: "R1",
  }),
];

export const database: InvoiceRecord[] = [
  ...convertedQuotationRecords,
  ...standaloneRecords,
];
