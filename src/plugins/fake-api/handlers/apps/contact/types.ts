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
  address?: string;
  poBox?: string;
  country?: string;
  city?: string;
  language?: string;
  channel: ContactChannel;
  birthdate?: string;
  worksInSales: boolean;
  createdAt?: string;
}
