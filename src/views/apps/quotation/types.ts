import type {
  PurchasedProduct,
  QuotationRecord,
} from "@db/apps/quotation/types";

export type QuotationData = QuotationRecord;
export type { PurchasedProduct };

export interface QuotationParams {
  q?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  options?: object;
}
