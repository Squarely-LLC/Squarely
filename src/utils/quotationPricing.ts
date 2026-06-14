import type { PurchasedProduct } from "@/plugins/fake-api/handlers/apps/quotation/types";

export type LineDiscountType = "none" | "percent" | "currency";

export type PricedProduct = {
  cost?: number | null;
  discountType?: PurchasedProduct["discountType"] | null;
  discountValue?: number | null;
  hours?: number | null;
};

export function getLineBaseTotal(product: PricedProduct) {
  return Number(product.cost || 0) * Number(product.hours || 0);
}

export function getLineDiscountAmount(
  product: PricedProduct,
) {
  const baseTotal = getLineBaseTotal(product);
  const discountValue = Math.max(0, Number(product.discountValue || 0));

  if (product.discountType === "percent") {
    return Math.min(baseTotal, (baseTotal * discountValue) / 100);
  }

  if (product.discountType === "currency") {
    return Math.min(baseTotal, discountValue);
  }

  return 0;
}

export function getLineTotal(
  product: PricedProduct,
) {
  const baseTotal = getLineBaseTotal(product);
  return Math.max(0, baseTotal - getLineDiscountAmount(product));
}

export function getQuotationSubtotal(
  products: PricedProduct[],
) {
  return products.reduce((sum, product) => sum + getLineBaseTotal(product), 0);
}

export function getQuotationDiscountTotal(products: PricedProduct[]) {
  return products.reduce((sum, product) => sum + getLineDiscountAmount(product), 0);
}

export function getQuotationGrandTotal(products: PricedProduct[]) {
  return products.reduce((sum, product) => sum + getLineTotal(product), 0);
}
