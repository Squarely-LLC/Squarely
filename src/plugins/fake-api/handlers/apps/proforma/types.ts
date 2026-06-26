import type { DealBillingPeriod } from "@/plugins/fake-api/handlers/operations/deals/types";

export type ProformaStatus = "Not Paid" | "Paid" | "Partially Paid";

export type LinkedRecordType = "deal" | "contract";

export type ProformaSource = "squarely" | "external";

export interface Client {
  address: string;
  company: string;
  companyEmail: string;
  country: string;
  contact: string;
  name: string;
}

export interface Proforma {
  id: number;
  quoteNumber: string;
  issuedDate: string;
  dueDate: string;
  client: Client;
  service: string;
  total: number;
  avatar: string;
  quotationStatus: ProformaStatus;
  balance: number;
  dealId: number | null;
  linkedRecordType: LinkedRecordType | null;
  source: ProformaSource;
  attachmentName: string | null;
  attachmentFileKey: string | null;
  parentQuotationId: number | null;
  isRevision: boolean;
  revisionLabel: string | null;
}

export interface PaymentDetails {
  totalDue: string;
  bankName: string;
  country: string;
  iban: string;
  swiftCode: string;
}

export interface PurchasedProduct {
  catalogueItemId?: string | null;
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodKey?: string | null;
  dealSelectionKey?: string | null;
  lineConstraints?: {
    quantity?: boolean;
    price?: boolean;
    discount?: boolean;
  } | null;
  title: string;
  cost: number;
  hours: number;
  discountType?: "none" | "percent" | "currency";
  discountValue?: number;
  taxApplicable?: boolean | null;
  description: string;
}

export interface ProformaPaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  createdAt: string;
  balanceBefore: number;
  balanceAfter: number;
}

export type ProformaApprovalMode = "Automatic" | "Request Approval";
export type ProformaApprovalStatus = "pending" | "approved" | "rejected";

export interface ProformaRecord {
  quotation: Proforma;
  paymentDetails: PaymentDetails;
  payments: ProformaPaymentEntry[];
  purchasedProducts: PurchasedProduct[];
  convertedInvoiceId?: number | null;
  note: string;
  showClientNote: boolean;
  totalFx: string | null;
  paymentMethod: string;
  paymentLink: string | null;
  approvalMode: ProformaApprovalMode;
  approvalRequestedAt?: string | null;
  approvalStatus?: ProformaApprovalStatus | null;
  approvalApprovedAt?: string | null;
  approvalApprovedBy?: number | string | null;
  approvalRejectedAt?: string | null;
  approvalRejectedBy?: number | string | null;
  approverEmployeeId: number | string | null;
  salesperson: string;
  thanksNote: string;
}
