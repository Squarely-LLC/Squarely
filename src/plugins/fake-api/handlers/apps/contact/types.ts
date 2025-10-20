export type ContactClass = "Lead" | "Client" | "Supplier" | "Contact" | "Owner";

export type ContactType = "Entity" | "Individual";

export type ContactCategory = "General" | "VIP" | "Real Estate";

export type ContactStatus = "Active" | "Dormant" | "Potential" | "Lost";

export type ContactChannel =
  | "Social Media"
  | "Referral"
  | "Direct Sales"
  | "Website"
  | "Email Campaigns";

export interface ContactConnection {
  contactId: number;
  contactName: string;
  isPrimary: boolean;
  relation: string;
  picture?: string;
}

export type DocumentCategory = "JPG" | "PNG" | "PDF" | "EXCEL" | "WORD";

export type DocumentType =
  | "Contract"
  | "Passport"
  | "Visa"
  | "ID Card"
  | "Labor Card"
  | "Health Card"
  | "Insurance Card"
  | "Residency Card"
  | "Other"
  | "Tax Registration"
  | "Trade License"
  | "VAT Certificate"
  | "VAT ,License"
  | "Tax License"
  | "Payslip"
  | "Reimbursements Invoice"
  | "Bank Details"
  | "SOPs"
  | "Proposals";

export interface ContactDocument {
  id: number;
  category?: DocumentCategory; // file attachment category (JPG/PNG/PDF/EXCEL/WORD)
  type?: DocumentType; // restrict to screenshot values
  name: string;
  expiry?: string | null; // ISO date string
  expiryReminder?: boolean; // whether reminder is set
  note?: string;
  fileUrl?: string; // attachment URL or link
  createdAt?: string;
}

export interface ContactAccounting {
  taxId?: string;
  crn?: string;
  vatNumber?: string;
}

export interface ContactProperties {
  id: number;
  fullName: string;
  class: ContactClass;
  type: ContactType;
  category: ContactCategory;
  email: string;
  number: string;
  status: ContactStatus;
  picture?: string;
  connections: ContactConnection[];
  accounting: ContactAccounting;
  documents?: ContactDocument[];
  address?: string;
  country?: string;
  city?: string;
  language?: string;
  channel: ContactChannel;
  birthdate?: string;
  worksInSales: boolean;
  createdAt?: string;
}
