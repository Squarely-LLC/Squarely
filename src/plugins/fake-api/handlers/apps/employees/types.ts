export type EmployeeClass = "Lead" | "Client" | "Supplier" | "Contact" | "Owner";

export type EmployeeType = "Entity" | "Individual";

export type EmployeeCategory = "General" | "VIP" | "Real Estate";

export type EmployeeStatus = "Active" | "Dormant" | "Potential" | "Lost";

export type EmployeeChannel =
  | "Social Media"
  | "Referral"
  | "Direct Sales"
  | "Website"
  | "Email Campaigns";

export interface EmployeeConnection {
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

export interface EmployeeDocument {
  id: number;
  category?: DocumentCategory;
  type?: DocumentType;
  name: string;
  expiry?: string | null;
  expiryReminder?: boolean;
  note?: string;
  fileUrl?: string;
  createdAt?: string;
}

export interface EmployeeRecord {
  id: number;
  type: string;
  title?: string;
  body?: string;
  author?: { id: number | string; name: string } | null;
  attachments?: string[];
  createdAt: string;
}

export interface EmployeeTransaction {
  id: number;
  amount: number;
  currency?: string;
  type?: "credit" | "debit" | "refund" | "other";
  date: string;
  description?: string;
  reference?: string;
  createdAt?: string;
}

export interface EmployeeAccounting {
  taxId?: string;
  crn?: string;
  vatNumber?: string;
}

export interface EmployeeEmployment {
  department?: string;
  reportToId?: number | string | null;
  contractStatus?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface EmployeeSalary {
  base?: number;
  currency?: string;
  memberOfSalesTeam?: boolean;
  lastUpdated?: string | null;
  notes?: string;
}

export interface EmployeePaymentMethod {
  id: number;
  type: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  isPrimary?: boolean;
}

export type EmployeeRequestType =
  | "Leave"
  | "Addition"
  | "Deduction"
  | "Advance"
  | "Time au Lieu";

export interface EmployeeRequest {
  id: number;
  type: EmployeeRequestType;
  status: "draft" | "pending" | "approved" | "rejected";
  createdAt?: string;
}

export interface EmployeeProperties {
  id: number;
  fullName: string;
  class: EmployeeClass;
  type: EmployeeType;
  category: EmployeeCategory;
  email: string;
  number: string;
  status: EmployeeStatus;
  picture?: string;
  connections: EmployeeConnection[];
  accounting: EmployeeAccounting;
  documents?: EmployeeDocument[];
  records?: EmployeeRecord[];
  transactions?: EmployeeTransaction[];
  address?: string;
  country?: string;
  city?: string;
  language?: string;
  website?: string;
  channel: EmployeeChannel;
  birthdate?: string;
  worksInSales: boolean;
  createdAt?: string;
  // HR-specific fields
  department?: string;
  managerId?: number | string | null;
  employment?: EmployeeEmployment;
  salary?: EmployeeSalary | null;
  positions?: string[];
  paymentMethods?: EmployeePaymentMethod[];
  requests?: EmployeeRequest[];
}
