import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";

export const getDealItemsSubtotal = (deal: Pick<DealProperties, "items">) =>
  (deal.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    return sum + quantity * unitPrice;
  }, 0);

export const getDealDiscountTotal = (deal: Pick<DealProperties, "items">) =>
  (deal.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPercent = Number(item.discountPercent || 0);

    return sum + quantity * unitPrice * (discountPercent / 100);
  }, 0);

export const getDealGrandTotal = (deal: Pick<DealProperties, "items">) =>
  getDealItemsSubtotal(deal) - getDealDiscountTotal(deal);
