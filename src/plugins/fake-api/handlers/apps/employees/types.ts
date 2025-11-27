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

export interface EmployeeAttendance {
  vacation: number;
  sickLeave: number;
  parentalLeave: number;
  carryoverDays: number;
  workSchedule: {
    monday: { active: boolean; remote: boolean; from: string; to: string };
    tuesday: { active: boolean; remote: boolean; from: string; to: string };
    wednesday: { active: boolean; remote: boolean; from: string; to: string };
    thursday: { active: boolean; remote: boolean; from: string; to: string };
    friday: { active: boolean; remote: boolean; from: string; to: string };
    saturday: { active: boolean; remote: boolean; from: string; to: string };
    sunday: { active: boolean; remote: boolean; from: string; to: string };
  };
  allowedExtraTime: number;
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
  isSalesTeamMember?: boolean;
  salesPercentage?: number;
  salesAmount?: number;
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
  isSalesTeamMember?: boolean;
  salesPercentage?: number;
  salesAmount?: number;
}

export interface EmployeeSalary {
  currency?: string;
  history?: EmployeeSalaryRecord[];
}

export interface EmployeePaymentMethod {
  id: number;
  type: string;
  bankName?: string;
  branchName?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  isPrimary?: boolean;
  createdAt?: string;
}

export type EmployeeRequestType =
  | "Leave"
  | "Addition"
  | "Deduction"
  | "Advance"
  | "Time au Lieu";

export type EmployeeRequestStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected";

// Leave Request
export interface LeaveRequest {
  id: number;
  type: "Leave";
  typeId?: string; // Leave type (Vacation, Sick, etc.)
  startDate: string;
  returnDate: string;
  requestedDays: number;
  deductible: boolean;
  periodId?: string; // Period (e.g., "December - 2025")
  deductionAmount?: number;
  reason?: string;
  attachmentFile?: string; // File URL
  attachmentLink?: string; // External link
  status: EmployeeRequestStatus;
  createdAt: string;
  approvedBy?: number | string;
  approvedAt?: string;
  rejectedBy?: number | string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Addition Request
export interface AdditionRequest {
  id: number;
  type: "Addition";
  additionType?: string; // Type of addition
  date: string;
  amount: number;
  period?: string; // Period (e.g., "December - 2025")
  relatedType?: string; // "Not Linked", "Leave", "Deduction", etc.
  relatedId?: string | number; // ID of related entity
  notes?: string;
  attachmentFile?: string;
  attachmentLink?: string;
  status: EmployeeRequestStatus;
  createdAt: string;
  approvedBy?: number | string;
  approvedAt?: string;
  rejectedBy?: number | string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Deduction Request
export interface DeductionRequest {
  id: number;
  type: "Deduction";
  deductionType?: string; // Type of deduction
  date: string;
  amount: number;
  period?: string; // Period (e.g., "December - 2025")
  notes?: string;
  attachmentFile?: string;
  attachmentLink?: string;
  status: EmployeeRequestStatus;
  createdAt: string;
  approvedBy?: number | string;
  approvedAt?: string;
  rejectedBy?: number | string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Advance Request
export interface AdvanceRequest {
  id: number;
  type: "Advance";
  advanceType?: string; // Type of advance
  date: string;
  amount: number;
  payBackInMonths?: number; // Number of months to pay back
  startOfPaymentPeriod?: string; // Period when payment starts
  notes?: string;
  attachmentFile?: string;
  attachmentLink?: string;
  status: EmployeeRequestStatus;
  createdAt: string;
  approvedBy?: number | string;
  approvedAt?: string;
  rejectedBy?: number | string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Time au Lieu Request
export interface TimeAuLieuRequest {
  id: number;
  type: "Time au Lieu";
  numberOfDays: number;
  date: string;
  relatedTo?: string; // "Not Linked" or other relation
  relatedId?: string | number; // ID of related entity
  note?: string;
  status: EmployeeRequestStatus;
  createdAt: string;
  approvedBy?: number | string;
  approvedAt?: string;
  rejectedBy?: number | string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export type EmployeeRequest =
  | LeaveRequest
  | AdditionRequest
  | DeductionRequest
  | AdvanceRequest
  | TimeAuLieuRequest;

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
  attendance?: EmployeeAttendance;
  requests?: EmployeeRequest[];
}
