import type { InvoiceRecord, PurchasedProduct } from "@db/apps/invoice/types";

export type InvoiceData = InvoiceRecord;
export type { PurchasedProduct };

export interface InvoiceParams {
  q?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  options?: object;
}
