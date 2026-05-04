export type InvoiceStatus = "Not Paid" | "Paid" | "Partially Paid";

export type LinkedRecordType = "deal" | "contract";

export type InvoiceSource = "squarely" | "external";

export interface Client {
  address: string;
  company: string;
  companyEmail: string;
  country: string;
  contact: string;
  name: string;
}

export interface Invoice {
  id: number;
  quoteNumber: string;
  issuedDate: string;
  dueDate: string;
  client: Client;
  service: string;
  total: number;
  avatar: string;
  quotationStatus: InvoiceStatus;
  balance: number;
  dealId: number | null;
  linkedRecordType: LinkedRecordType | null;
  source: InvoiceSource;
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
  description: string;
}

export interface InvoicePaymentEntry {
  id: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  createdAt: string;
  balanceBefore: number;
  balanceAfter: number;
}

export type InvoiceApprovalMode = "Automatic" | "Request Approval";

export interface InvoiceRecord {
  quotation: Invoice;
  paymentDetails: PaymentDetails;
  payments: InvoicePaymentEntry[];
  purchasedProducts: PurchasedProduct[];
  note: string;
  showClientNote: boolean;
  totalFx: string | null;
  paymentMethod: string;
  paymentLink: string | null;
  approvalMode: InvoiceApprovalMode;
  approverEmployeeId: number | string | null;
  salesperson: string;
  thanksNote: string;
}
