import type { QuotationRecord } from "@db/apps/quotation/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";

const year = new Date().getFullYear();

const mapContactToClient = (
  contact: ContactProperties,
): QuotationRecord["quotation"]["client"] => ({
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
    throw new Error(`Missing contact seed for quotation client ${contactId}`);
  }

  return mapContactToClient(contact);
};

const getSeedAvatar = (contactId: number) => {
  const contact = contactsDb.users.find((entry) => entry.id === contactId);

  if (!contact) {
    throw new Error(`Missing contact seed for quotation avatar ${contactId}`);
  }

  return contact.picture || "";
};

const buildRecord = (
  id: number,
  status: QuotationRecord["quotation"]["quotationStatus"],
  avatar: string,
  overrides: Partial<QuotationRecord["quotation"]> & {
    client: QuotationRecord["quotation"]["client"];
  },
): QuotationRecord => ({
  quotation: {
    id,
    quoteNumber: `QT-${id}`,
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
  purchasedProducts: [
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
  ],
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

export const database: QuotationRecord[] = [
  buildRecord(6101, "Pending", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out quotation",
    dealId: 201,
    linkedRecordType: "deal",
  }),
  buildRecord(6102, "Approved", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package",
    dealId: 202,
    linkedRecordType: "deal",
  }),
  buildRecord(6103, "Lost", "", {
    total: 3100,
    client: getSeedClient(7),
    service: "Gym reception redesign",
    dealId: null,
    linkedRecordType: null,
    source: "external",
    attachmentName: "peakfit-quotation.pdf",
  }),
  buildRecord(6104, "Converted to Invoice", getSeedAvatar(10), {
    total: 9200,
    client: getSeedClient(10),
    service: "Lobby renovation scope",
    dealId: 204,
    linkedRecordType: "deal",
  }),
  buildRecord(6105, "Converted to Proforma", getSeedAvatar(1), {
    total: 5800,
    client: getSeedClient(1),
    service: "Guest suite refurbishment",
    dealId: 205,
    linkedRecordType: "contract",
  }),
  buildRecord(6106, "Pending", getSeedAvatar(9), {
    total: 2500,
    client: getSeedClient(9),
    service: "Clinic partition works",
    dealId: null,
    linkedRecordType: null,
    source: "external",
    attachmentName: "northstar-quote.xlsx",
  }),
  buildRecord(6107, "Approved", getSeedAvatar(8), {
    total: 4450,
    client: getSeedClient(8),
    service: "Pop-up kiosk fabrication",
    dealId: 207,
    linkedRecordType: "deal",
  }),
  buildRecord(6108, "Pending", "", {
    total: 6900,
    client: getSeedClient(6),
    service: "Workspace redesign proposal",
    dealId: 208,
    linkedRecordType: "deal",
  }),
  buildRecord(6111, "Approved", getSeedAvatar(5), {
    quoteNumber: "QT-6102-R1",
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch design package - revision 1",
    dealId: 202,
    linkedRecordType: "deal",
    parentQuotationId: 6102,
    isRevision: true,
    revisionLabel: "R1",
  }),
  buildRecord(6112, "Approved", getSeedAvatar(5), {
    quoteNumber: "QT-6102-R2",
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package - revision 2",
    dealId: 202,
    linkedRecordType: "deal",
    parentQuotationId: 6102,
    isRevision: true,
    revisionLabel: "R2",
  }),
];
