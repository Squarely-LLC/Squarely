import type { ProformaRecord, PurchasedProduct } from "@db/apps/proforma/types";

export type ProformaData = ProformaRecord;
export type { PurchasedProduct };

export interface ProformaParams {
  q?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  options?: object;
}
