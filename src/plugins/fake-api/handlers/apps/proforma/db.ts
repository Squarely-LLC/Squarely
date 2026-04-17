import type { ProformaRecord } from "@db/apps/proforma/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";
import { database as quotationDatabase } from "../quotation/db";

const year = new Date().getFullYear();

const defaultPurchasedProducts = (): ProformaRecord["purchasedProducts"] => [
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
  overrides: Partial<ProformaRecord["quotation"]> & {
    client: ProformaRecord["quotation"]["client"];
  },
): ProformaRecord => ({
  quotation: {
    id,
    quoteNumber: `PF-${id}`,
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
    quoteNumber: toProformaQuoteNumber(quotationRecord.quotation.quoteNumber),
    quotationStatus: "Not Paid",
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
  approverEmployeeId: quotationRecord.approverEmployeeId,
  salesperson: quotationRecord.salesperson,
  thanksNote: quotationRecord.thanksNote,
});

const convertedQuotationRecords: ProformaRecord[] = quotationDatabase
  .filter(
    (record) => record.quotation.quotationStatus === "Converted to Proforma",
  )
  .map((record) => toProformaRecord(record));

const standaloneRecords: ProformaRecord[] = [
  buildStandaloneRecord(6201, "Not Paid", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out proforma",
    dealId: 301,
    linkedRecordType: "deal",
  }),
  buildStandaloneRecord(6202, "Partially Paid", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package",
    dealId: 302,
    linkedRecordType: "deal",
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
  buildStandaloneRecord(6211, "Partially Paid", getSeedAvatar(5), {
    quoteNumber: "PF-6202-R1",
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch design package - revision 1",
    dealId: 302,
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
