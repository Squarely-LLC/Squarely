import type { CatalogueContractualServiceRecord } from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealItem,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { getDealContractualPhaseLines } from "@/utils/dealDocumentDraft";

type CatalogueRecordResolver = (
  id?: string | number | null,
  typeHint?: string | null,
) => unknown;

const finiteMoney = (value: unknown) => {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
};

const getLineSubtotal = (price: unknown, quantity: unknown) =>
  finiteMoney(price) * finiteMoney(quantity ?? 1);

const getLineDiscount = (
  price: unknown,
  quantity: unknown,
  discountPercent: unknown,
) => {
  const subtotal = getLineSubtotal(price, quantity);

  return Math.min(subtotal, subtotal * (finiteMoney(discountPercent) / 100));
};

const resolveContractualRecord = (
  item: DealItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) => {
  const catalogueType = String(item.catalogueType ?? "")
    .trim()
    .toLowerCase();

  if (
    !resolveCatalogueRecord ||
    catalogueType !== "contractual service" ||
    !item.catalogueItemId
  )
    return null;

  const record = resolveCatalogueRecord(item.catalogueItemId, item.catalogueType);

  return record &&
    typeof record === "object" &&
    (record as { type?: string }).type === "Contractual Service"
    ? (record as CatalogueContractualServiceRecord)
    : null;
};

const getContractualItemSubtotal = (
  item: DealItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) => {
  const record = resolveContractualRecord(item, resolveCatalogueRecord);
  if (!record) return null;

  return getDealContractualPhaseLines(item, record).reduce(
    (sum, phase) => sum + getLineSubtotal(phase.price, phase.quantity ?? 1),
    0,
  );
};

const getContractualItemDiscountTotal = (
  item: DealItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) => {
  const record = resolveContractualRecord(item, resolveCatalogueRecord);
  if (!record) return null;

  return getDealContractualPhaseLines(item, record).reduce(
    (sum, phase) =>
      sum +
      getLineDiscount(
        phase.price,
        phase.quantity ?? 1,
        phase.discountPercent ?? 0,
      ),
    0,
  );
};

export const getDealItemsSubtotal = (
  deal: Pick<DealProperties, "items">,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) =>
  (deal.items || []).reduce((sum, item) => {
    const contractualSubtotal = getContractualItemSubtotal(
      item,
      resolveCatalogueRecord,
    );
    if (contractualSubtotal !== null) return sum + contractualSubtotal;

    return sum + getLineSubtotal(item.unitPrice, item.quantity);
  }, 0);

export const getDealDiscountTotal = (
  deal: Pick<DealProperties, "items">,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) =>
  (deal.items || []).reduce((sum, item) => {
    const contractualDiscount = getContractualItemDiscountTotal(
      item,
      resolveCatalogueRecord,
    );
    if (contractualDiscount !== null) return sum + contractualDiscount;

    return (
      sum + getLineDiscount(item.unitPrice, item.quantity, item.discountPercent)
    );
  }, 0);

export const getDealGrandTotal = (
  deal: Pick<DealProperties, "items">,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) =>
  getDealItemsSubtotal(deal, resolveCatalogueRecord) -
  getDealDiscountTotal(deal, resolveCatalogueRecord);
