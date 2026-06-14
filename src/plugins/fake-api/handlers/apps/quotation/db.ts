import type { QuotationRecord } from "@db/apps/quotation/types";
import { db as contactsDb } from "../contact/db";
import type { ContactProperties } from "../contact/types";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";

const year = new Date().getFullYear();

const defaultPurchasedProducts = (
  total = 2720,
): QuotationRecord["purchasedProducts"] => [
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
): QuotationRecord => {
  const purchasedProducts = defaultPurchasedProducts(Number(overrides.total || 0));
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    quotation: {
    id,
    quoteNumber: `QT-${id}`,
    issuedDate: `${year}-04-0${(id % 7) + 1}`,
    dueDate: `${year}-04-${String((id % 7) + 12).padStart(2, "0")}`,
    service: "Architectural design services",
    avatar,
    quotationStatus: status,
    balance: 0,
    dealId: null,
    linkedRecordType: null,
    source: "squarely",
    attachmentName: null,
    attachmentFileKey: null,
    parentQuotationId: null,
    isRevision: false,
    revisionLabel: null,
    convertedProformaId: null,
    convertedInvoiceId: null,
    ...overrides,
    total,
  },
  paymentDetails: {
    totalDue: `$${total.toLocaleString()}`,
    bankName: "Byblos Bank",
    country: "Lebanon",
    iban: "LB12345678901234567890123456",
    swiftCode: "BYBALBBX",
  },
  payments: [],
  purchasedProducts,
  note: "Pricing is valid for 14 days from the issue date.",
  showClientNote: true,
  totalFx: null,
  paymentMethod: "Bank Transfer",
  paymentLink: null,
  approvalMode: "Automatic",
  approverEmployeeId: null,
  salesperson: "Nour Khoury",
  thanksNote: "Thank you for considering Squarely.",
  };
};

export const database: QuotationRecord[] = [
  buildRecord(6101, "Active", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out quotation",
    dealId: 201,
    linkedRecordType: "deal",
  }),
  buildRecord(6102, "Approval", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package",
    dealId: 202,
    linkedRecordType: "deal",
  }),
  buildRecord(6104, "Converted", getSeedAvatar(10), {
    total: 9200,
    client: getSeedClient(10),
    service: "Lobby renovation scope",
    dealId: 204,
    linkedRecordType: "deal",
    convertedProformaId: 6204,
  }),
  buildRecord(6105, "Converted", getSeedAvatar(1), {
    total: 5800,
    client: getSeedClient(1),
    service: "Guest suite refurbishment",
    dealId: 205,
    linkedRecordType: "contract",
    convertedProformaId: 6205,
    convertedInvoiceId: 6305,
  }),
  buildRecord(6109, "Converted", getSeedAvatar(3), {
    total: 8450,
    client: getSeedClient(3),
    service: "Showroom concept redesign",
    dealId: 209,
    linkedRecordType: "deal",
    convertedProformaId: 6209,
    convertedInvoiceId: 6309,
  }),
  buildRecord(6111, "Approval", getSeedAvatar(5), {
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
];
