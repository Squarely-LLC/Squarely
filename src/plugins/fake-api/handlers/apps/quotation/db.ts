import type { QuotationRecord } from "@db/apps/quotation/types";
import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";
import avatar4 from "@images/avatars/avatar-4.png";
import avatar5 from "@images/avatars/avatar-5.png";
import avatar6 from "@images/avatars/avatar-6.png";

const year = new Date().getFullYear();

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
  purchasedProducts: [
    {
      title: "Concept design",
      cost: 250,
      hours: 8,
      description: "Initial concept preparation and client revisions.",
    },
    {
      title: "Technical coordination",
      cost: 180,
      hours: 4,
      description: "Coordination across architecture and MEP comments.",
    },
  ],
  note: "Pricing is valid for 14 days from the issue date.",
  paymentMethod: "Bank Transfer",
  salesperson: "Nour Khoury",
  thanksNote: "Thank you for considering Squarely.",
});

export const database: QuotationRecord[] = [
  buildRecord(6101, "Pending", avatar1, {
    total: 4200,
    client: {
      address: "Mar Mikhael Street",
      company: "Cedars Development",
      companyEmail: "pm@cedarsdev.com",
      country: "Lebanon",
      contact: "+961 3 888 221",
      name: "Maya Khoury",
    },
    service: "Interior fit-out quotation",
    dealId: 201,
    linkedRecordType: "deal",
  }),
  buildRecord(6102, "Approved", avatar2, {
    total: 7600,
    client: {
      address: "Hamra Main Road",
      company: "Urban Core SAL",
      companyEmail: "ops@urbancore.com",
      country: "Lebanon",
      contact: "+961 1 332 455",
      name: "Karim Saab",
    },
    service: "Retail branch design package",
    dealId: 202,
    linkedRecordType: "deal",
  }),
  buildRecord(6103, "Lost", "", {
    total: 3100,
    client: {
      address: "Bsalim District",
      company: "Peak Fit Club",
      companyEmail: "admin@peakfit.com",
      country: "Lebanon",
      contact: "+961 70 544 311",
      name: "Rita Hanna",
    },
    service: "Gym reception redesign",
    dealId: null,
    linkedRecordType: null,
    source: "external",
    attachmentName: "peakfit-quotation.pdf",
  }),
  buildRecord(6104, "Converted to Invoice", avatar3, {
    total: 9200,
    client: {
      address: "Antelias Waterfront",
      company: "Harbor Residence",
      companyEmail: "procurement@harborres.com",
      country: "Lebanon",
      contact: "+961 4 999 104",
      name: "Elie Tannous",
    },
    service: "Lobby renovation scope",
    dealId: 204,
    linkedRecordType: "deal",
  }),
  buildRecord(6105, "Converted to Proforma", avatar4, {
    total: 5800,
    client: {
      address: "Jbeil old souk",
      company: "Phoenicia Hospitality",
      companyEmail: "finance@phoeniciah.com",
      country: "Lebanon",
      contact: "+961 9 441 002",
      name: "Dana Azar",
    },
    service: "Guest suite refurbishment",
    dealId: 205,
    linkedRecordType: "contract",
  }),
  buildRecord(6106, "Pending", avatar5, {
    total: 2500,
    client: {
      address: "Verdun Plaza",
      company: "Northstar Clinics",
      companyEmail: "projects@northstarclinics.com",
      country: "Lebanon",
      contact: "+961 70 221 778",
      name: "Samer Younes",
    },
    service: "Clinic partition works",
    dealId: null,
    linkedRecordType: null,
    source: "external",
    attachmentName: "northstar-quote.xlsx",
  }),
  buildRecord(6107, "Approved", avatar6, {
    total: 4450,
    client: {
      address: "Downtown Beirut",
      company: "Muse Retail Group",
      companyEmail: "commercial@museretail.com",
      country: "Lebanon",
      contact: "+961 76 103 552",
      name: "Lynn Farah",
    },
    service: "Pop-up kiosk fabrication",
    dealId: 207,
    linkedRecordType: "deal",
  }),
  buildRecord(6108, "Pending", "", {
    total: 6900,
    client: {
      address: "Dbayeh Business Park",
      company: "Vertex Offices",
      companyEmail: "admin@vertexoffices.com",
      country: "Lebanon",
      contact: "+961 4 558 102",
      name: "Joe Bitar",
    },
    service: "Workspace redesign proposal",
    dealId: 208,
    linkedRecordType: "deal",
  }),
  buildRecord(6111, "Approved", avatar2, {
    quoteNumber: "QT-6102-R1",
    total: 7350,
    client: {
      address: "Hamra Main Road",
      company: "Urban Core SAL",
      companyEmail: "ops@urbancore.com",
      country: "Lebanon",
      contact: "+961 1 332 455",
      name: "Karim Saab",
    },
    service: "Retail branch design package - revision 1",
    dealId: 202,
    linkedRecordType: "deal",
    parentQuotationId: 6102,
    isRevision: true,
    revisionLabel: "R1",
  }),
  buildRecord(6112, "Approved", avatar2, {
    quoteNumber: "QT-6102-R2",
    total: 7600,
    client: {
      address: "Hamra Main Road",
      company: "Urban Core SAL",
      companyEmail: "ops@urbancore.com",
      country: "Lebanon",
      contact: "+961 1 332 455",
      name: "Karim Saab",
    },
    service: "Retail branch design package - revision 2",
    dealId: 202,
    linkedRecordType: "deal",
    parentQuotationId: 6102,
    isRevision: true,
    revisionLabel: "R2",
  }),
];
