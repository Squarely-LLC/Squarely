export type CatalogueActiveState = "Active" | "Non-Active" | "Archived";
export type CatalogueItemType =
  | "Onetime Service"
  | "Product"
  | "Contractual Service"
  | "Retainer Service"
  | "Reccurent Service"
  | "Produced Product"
  | "Rental";

export interface CatalogueProduct {
  id: number;
  name: string;
  brand?: string | null;
  category: string;
  type: CatalogueItemType;
  activeState: CatalogueActiveState;
  sku: string;
  qty: number;
  image?: string | null;
  createdAt: string;
}
