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
  title: string;
  cost: number;
  hours: number;
  description: string;
}

export interface QuotationRecord {
  quotation: Quotation;
  paymentDetails: PaymentDetails;
  purchasedProducts: PurchasedProduct[];
  note: string;
  paymentMethod: string;
  paymentLink: string | null;
  salesperson: string;
  thanksNote: string;
}
