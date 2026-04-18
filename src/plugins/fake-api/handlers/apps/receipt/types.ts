import type { Client } from "@/plugins/fake-api/handlers/apps/invoice/types";

export type ReceiptStatus = "Recorded" | "Flagged";

export type ReceiptSourceType =
  | "invoice"
  | "proforma"
  | "manual"
  | "attachment";

export interface Receipt {
  id: number;
  receiptNumber: string;
  issuedDate: string;
  receivedDate: string;
  client: Client;
  amount: number;
  avatar: string;
  status: ReceiptStatus;
  sourceType: ReceiptSourceType;
  linkedInvoiceId: number | null;
  linkedInvoiceNumber: string | null;
  linkedProformaId: number | null;
  linkedProformaNumber: string | null;
  attachmentName: string | null;
  attachmentFileKey: string | null;
}

export interface ReceiptRecord {
  receipt: Receipt;
  paymentMethod: string;
  note: string;
}
