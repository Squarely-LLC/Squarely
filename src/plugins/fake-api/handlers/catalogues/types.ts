export type CatalogueActiveState = string;
export type CatalogueItemType = string;

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
