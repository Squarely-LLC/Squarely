import type { DealItem } from "@/plugins/fake-api/handlers/operations/deals/types";
import {
  type PricedProduct,
  getLineBaseTotal,
  getLineDiscountAmount,
  getQuotationGrandTotal,
} from "@/utils/quotationPricing";

type DealBillingDocument = {
  purchasedProducts?: PricedProduct[];
  quotation?: {
    balance?: number | null;
    quotationStatus?: string | null;
    total?: number | null;
  };
  payments?: Array<{ amount?: number | null }>;
};

const finiteMoney = (value: unknown) => {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
};

export const getDealDocumentSubtotal = (record: DealBillingDocument) =>
  record.purchasedProducts?.length
    ? record.purchasedProducts.reduce(
        (sum, product) => sum + getLineBaseTotal(product),
        0,
      )
    : getDealDocumentTotal(record);

export const getDealDocumentDiscountTotal = (record: DealBillingDocument) =>
  record.purchasedProducts?.length
    ? record.purchasedProducts.reduce(
        (sum, product) => sum + getLineDiscountAmount(product),
        0,
      )
    : 0;

export const getDealDocumentTotal = (record: DealBillingDocument) => {
  if (record.purchasedProducts?.length) {
    return finiteMoney(getQuotationGrandTotal(record.purchasedProducts));
  }

  return finiteMoney(record.quotation?.total);
};

export const getDealDocumentBalance = (record: DealBillingDocument) => {
  const balance = Number(record.quotation?.balance ?? NaN);
  if (Number.isFinite(balance)) return Math.min(Math.max(balance, 0), getDealDocumentTotal(record));

  const total = getDealDocumentTotal(record);
  const paid = (record.payments || []).reduce(
    (sum, payment) => sum + finiteMoney(payment.amount),
    0,
  );

  return Math.max(total - paid, 0);
};

export const getDealDocumentPaid = (record: DealBillingDocument) => {
  const total = getDealDocumentTotal(record);
  if (String(record.quotation?.quotationStatus || "") === "Paid") return total;

  return Math.min(Math.max(total - getDealDocumentBalance(record), 0), total);
};

export const getDealItemSubtotal = (
  item: Pick<DealItem, "unitPrice">,
  quantity = 1,
) => finiteMoney(item.unitPrice) * finiteMoney(quantity);

export const getDealItemDiscountTotal = (
  item: Pick<DealItem, "discountPercent" | "unitPrice">,
  quantity = 1,
) => {
  const subtotal = getDealItemSubtotal(item, quantity);
  const discountPercent = finiteMoney(item.discountPercent);

  return Math.min(subtotal, (subtotal * discountPercent) / 100);
};

export const getDealItemGrandTotal = (
  item: Pick<DealItem, "discountPercent" | "unitPrice">,
  quantity = 1,
) => Math.max(getDealItemSubtotal(item, quantity) - getDealItemDiscountTotal(item, quantity), 0);

export const getDealItemsSubtotal = <TItem extends Pick<DealItem, "unitPrice">>(
  items: TItem[],
  getQuantity: (item: TItem) => number,
) =>
  items.reduce(
    (sum, item) => sum + getDealItemSubtotal(item, getQuantity(item)),
    0,
  );

export const getDealItemsDiscountTotal = <
  TItem extends Pick<DealItem, "discountPercent" | "unitPrice">,
>(
  items: TItem[],
  getQuantity: (item: TItem) => number,
) =>
  items.reduce(
    (sum, item) => sum + getDealItemDiscountTotal(item, getQuantity(item)),
    0,
  );

export const getDealItemsGrandTotal = <
  TItem extends Pick<DealItem, "discountPercent" | "unitPrice">,
>(
  items: TItem[],
  getQuantity: (item: TItem) => number,
) => Math.max(getDealItemsSubtotal(items, getQuantity) - getDealItemsDiscountTotal(items, getQuantity), 0);
