import type { DealBillingPeriod } from "@/plugins/fake-api/handlers/operations/deals/types";

export type QuotationStatus =
  | "Pending"
  | "Approved"
  | "Lost"
  | "Converted to Invoice"
  | "Converted to Proforma";

export type LinkedRecordType = "deal" | "contract";

export type QuotationSource = "squarely" | "external";

export interface Client {
  address: string;
  company: string;
  companyEmail: string;
  country: string;
  contact: string;
  name: string;
}

export interface Quotation {
  id: number;
  quoteNumber: string;
  issuedDate: string;
  dueDate: string;
  client: Client;
  service: string;
  total: number;
  avatar: string;
  quotationStatus: QuotationStatus;
  balance: number;
  dealId: number | null;
  linkedRecordType: LinkedRecordType | null;
  source: QuotationSource;
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
  description: string;
}

export interface QuotationPaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  createdAt: string;
  balanceBefore: number;
  balanceAfter: number;
}

export type QuotationApprovalMode = "Automatic" | "Request Approval";

export interface QuotationRecord {
  quotation: Quotation;
  paymentDetails: PaymentDetails;
  payments: QuotationPaymentEntry[];
  purchasedProducts: PurchasedProduct[];
  note: string;
  showClientNote: boolean;
  totalFx: string | null;
  paymentMethod: string;
  paymentLink: string | null;
  approvalMode: QuotationApprovalMode;
  approvalRequestedAt?: string | null;
  approverEmployeeId: number | string | null;
  salesperson: string;
  thanksNote: string;
}
