export type EmployeeClass = string;

export type EmployeeCategory = string;

export type EmployeeStatus = "Active" | "Not Hired";

export type EmployeeChannel =
  | "Social Media"
  | "Referral"
  | "Direct Sales"
  | "Website"
  | "Email Campaigns";

export interface EmployeeConnection {
  contactId: number | string;
  contactName?: string;
  isPrimary?: boolean;
  relation?: string;
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

export type ContractStatus = "Active" | "Terminated" | "Draft";

export interface EmployeeContractTermination {
  noticePeriod?: string | null;
  terminationType?: string | null;
  note?: string;
  lastDayAtWork?: string | null;
  lastPayrollPeriod?: string | null;
  fileUrl?: string;
  attachmentLink?: string;
  terminatedAt?: string;
}

export interface EmployeeContract {
  id?: number;
  salaryPaid?: "Monthly" | "Weekly" | null;
  employmentType?: string | null;
  startDate?: string | null;
  probationEndDate?: string | null;
  firstPayroll?: string | null;
  note?: string;
  status?: ContractStatus;
  termination?: EmployeeContractTermination;
  createdAt?: string;
}

export interface EmployeePosition {
  id?: number;
  position: string;
  startingDate: string;
  note?: string;
  createdAt?: string;
}

export interface EmployeeEmployment {
  department?: string;
  reportToIds?: (number | string)[];
  contractStatus?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  contract?: EmployeeContract; // Deprecated: use contracts array
  contracts?: EmployeeContract[];
  positions?: EmployeePosition[];
}

export interface EmployeeSalaryRecord {
  id?: number;
  basicSalary: number;
  transportation: number;
  housing: number;
  allowance: number;
  date: string;
  startingPeriod: string;
  note?: string;
  createdAt?: string;
}

export interface EmployeeSalary {
  currency?: string;
  history?: EmployeeSalaryRecord[];
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
  class?: EmployeeClass;
  type?: string;
  category?: EmployeeCategory;
  email: string;
  number: string;
  status: EmployeeStatus;
  picture?: string;
  connections?: EmployeeConnection[];
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
  gender?: "Female" | "Male" | string;
  worksInSales: boolean;
  createdAt?: string;
  // HR-specific fields
  department?: string;
  employment?: EmployeeEmployment;
  salary?: EmployeeSalary | null;
  paymentMethods?: EmployeePaymentMethod[];
  requests?: EmployeeRequest[];
}
