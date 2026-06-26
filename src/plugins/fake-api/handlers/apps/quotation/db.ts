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

const periodPurchasedProducts = (): QuotationRecord["purchasedProducts"] => [
  {
    catalogueItemId: "retainer-service-1",
    dealSelectionKey: "item-1",
    title: "Workplace Acoustic Consulting Retainer",
    cost: 1500,
    hours: 3,
    discountType: "none",
    discountValue: 0,
    description:
      "Monthly acoustic consulting retainer for ongoing workplace planning and review.\nStart Date: 1 May 2026\nEnd Date: 31 Jul 2026\nNumber of Periods: 3\nItems included: Monthly Acoustic Review, Monthly Reporting Pack",
    taxApplicable: false,
  },
  {
    catalogueItemId: "reccurent-service-1",
    dealSelectionKey: "item-2",
    title: "Monthly Meeting Pod Cleaning Service",
    cost: 260,
    hours: 6,
    discountType: "none",
    discountValue: 0,
    description:
      "Recurring monthly cleaning and upkeep service for enclosed meeting pods.\nStart Date: 1 May 2026\nEnd Date: 31 Oct 2026\nNumber of Periods: 6\nItems included: Monthly Pod Cleaning Visit",
    taxApplicable: false,
  },
  {
    catalogueItemId: "product-2",
    dealSelectionKey: "item-3",
    title: "Indoor Planter Set",
    cost: 135,
    hours: 12,
    discountType: "none",
    discountValue: 0,
    description:
      "Indoor planter set with liners for lobbies, corridors, and breakout spaces.",
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
  overrides: Partial<QuotationRecord["quotation"]> &
    Partial<
      Pick<
        QuotationRecord,
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
    client: QuotationRecord["quotation"]["client"];
    purchasedProducts?: QuotationRecord["purchasedProducts"];
  },
): QuotationRecord => {
  const {
    purchasedProducts: overridePurchasedProducts,
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
  const purchasedProducts =
    overridePurchasedProducts ||
    defaultPurchasedProducts(Number(quotationOverrides.total || 0));
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
      ...quotationOverrides,
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

export const database: QuotationRecord[] = [
  buildRecord(6101, "Active", getSeedAvatar(2), {
    total: 4200,
    client: getSeedClient(2),
    service: "Interior fit-out quotation",
    dealId: 1,
    linkedRecordType: "deal",
  }),
  buildRecord(6102, "Approval", getSeedAvatar(5), {
    total: 7600,
    client: getSeedClient(5),
    service: "Retail branch design package",
    dealId: 2,
    linkedRecordType: "deal",
    approvalMode: "Request Approval",
    approverEmployeeId: 1,
    approvalRequestedAt: "2026-06-26T09:30:00Z",
  }),
  buildRecord(6104, "Converted", getSeedAvatar(10), {
    total: 9200,
    client: getSeedClient(10),
    service: "Lobby renovation scope",
    dealId: 3,
    linkedRecordType: "deal",
    convertedProformaId: 6204,
  }),
  buildRecord(6105, "Converted", getSeedAvatar(1), {
    total: 5800,
    client: getSeedClient(1),
    service: "Guest suite refurbishment",
    dealId: 1,
    linkedRecordType: "contract",
    convertedProformaId: 6205,
    convertedInvoiceId: 6305,
  }),
  buildRecord(6109, "Converted", getSeedAvatar(3), {
    client: getSeedClient(3),
    service: "Showroom concept redesign",
    dealId: 2,
    linkedRecordType: "deal",
    convertedProformaId: 6209,
    convertedInvoiceId: 6309,
    purchasedProducts: periodPurchasedProducts(),
  }),
  buildRecord(6111, "Approval", getSeedAvatar(5), {
    quoteNumber: "QT-6102-R1",
    total: 7350,
    client: getSeedClient(5),
    service: "Retail branch design package - revision 1",
    dealId: 2,
    linkedRecordType: "deal",
    parentQuotationId: 6102,
    isRevision: true,
    revisionLabel: "R1",
    approvalMode: "Request Approval",
    approverEmployeeId: 1,
    approvalRequestedAt: "2026-06-26T10:15:00Z",
  }),
];
