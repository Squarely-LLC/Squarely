import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type {
    PurchasedProduct as InvoicePurchasedProduct,
    InvoiceRecord,
} from "@/plugins/fake-api/handlers/apps/invoice/types";
import type {
    PurchasedProduct as ProformaPurchasedProduct,
    ProformaRecord,
} from "@/plugins/fake-api/handlers/apps/proforma/types";
import type {
    Client,
    PurchasedProduct as QuotationPurchasedProduct,
    QuotationRecord,
} from "@/plugins/fake-api/handlers/apps/quotation/types";
import type {
    CatalogueContractualServiceRecord,
    CatalogueOnetimeServiceRecord,
    CatalogueReccurentServiceRecord,
    CatalogueRecord,
    CatalogueRetainerServiceRecord,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
    FinancialConfig,
    LegalConfig,
} from "@/plugins/fake-api/handlers/config/types";
import type {
    DealBillingPeriod,
    DealBillingPeriodKind,
    DealCustomPhase,
    DealItem,
    DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import {
    buildDocumentNote,
    buildProformaNote,
    buildQuotationNote,
    buildQuotationPaymentDetails,
    buildQuotationSalesperson,
    buildQuotationThanksNote,
    getDocumentSequencePrefix,
} from "@/utils/quotationConfig";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";

const DEAL_DOCUMENT_DRAFT_KEYS = {
  invoice: "app.invoice.deal-draft.v1",
  proforma: "app.proforma.deal-draft.v1",
  quotation: "app.quotation.deal-draft.v1",
} as const;

const AUTO_BILLABLE_TYPES = new Set([
  "Onetime Service",
  "Product",
  "Produced Product",
  "Rental",
  "Related Item",
]);

const CONTRACTUAL_BILLABLE_TYPES = new Set(["Contractual Service", "Phase"]);

const RETAINER_BILLABLE_TYPES = new Set([
  "Retainer Service",
  "Retainer Service Line",
]);

const RECURRENT_BILLABLE_TYPES = new Set([
  "Reccurent Service",
  "Recurrent Service Line",
]);

type PurchasedProductLike =
  | QuotationPurchasedProduct
  | ProformaPurchasedProduct
  | InvoicePurchasedProduct;

type DealDocumentLineLike = {
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodKey?: string | null;
  catalogueItemId?: string | null;
  dealSelectionKey?: string | null;
  description?: string | null;
  title?: string | null;
};

type DealDocumentLinkedItemLike = Pick<
  DealItem,
  "id" | "catalogueType" | "retainerPeriods" | "recurrentPeriods"
>;

export type DealQuotationConversionOptionKind =
  | "item"
  | "phase"
  | "retainer-period"
  | "recurrent-period";

export interface DealQuotationConversionPeriodOption {
  key: string;
  label: string;
  product: PurchasedProductLike;
}

export interface DealQuotationConversionOption {
  key: string;
  kind: DealQuotationConversionOptionKind;
  title: string;
  description: string;
  product: PurchasedProductLike;
  periods: DealQuotationConversionPeriodOption[];
}

export type DealDocumentKind = keyof typeof DEAL_DOCUMENT_DRAFT_KEYS;
export type DealDocumentBillingMode =
  | "empty"
  | "simple-root"
  | "contractual-stage"
  | "retainer-period"
  | "recurrent-period"
  | "mixed-manual";

export type CatalogueRecordResolver = (
  id: string,
  typeHint?: string | null,
) => CatalogueRecord | null;

export interface DealDocumentSelectableItem extends DealItem {
  selectionKey: string;
  expansionSummary: string | null;
  groupKey: "billable-root" | "child-items";
  groupLabel: string;
  hint: string | null;
  isAutoBillable: boolean;
  isBillableRoot: boolean;
  isGenerated: boolean;
  isRootReplacement?: boolean;
  lineConstraintsOverride?: {
    discount?: boolean;
    price?: boolean;
    quantity?: boolean;
  } | null;
  parentName: string | null;
}

export interface DealDocumentContractualPhaseLine {
  category: string | null;
  discountPercent: number | null;
  id: number | string;
  isCustom: boolean;
  name: string;
  note: string | null;
  overrideKey: string;
  price: number | null;
  quantity: number | null;
  sourcePhaseId: number | null;
  taxApplicable: boolean | null;
}

export interface DealDocumentDraftContext {
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null;
  billingPeriods?: DealBillingPeriod[] | null;
  contact?: ContactProperties | null;
  deal: DealProperties;
  financial?: FinancialConfig | null;
  legal?: LegalConfig | null;
  nextId: number;
  resolveCatalogueRecord?: CatalogueRecordResolver;
  selectedItems: DealDocumentSelectableItem[];
}

export interface DealDocumentDraftPayloadMap {
  invoice: InvoiceRecord;
  proforma: ProformaRecord;
  quotation: QuotationRecord;
}

export interface DealDocumentDraftPayload<TKind extends DealDocumentKind> {
  quotation: DealDocumentDraftPayloadMap[TKind];
  source: "deal";
}

export const isLiteralRelatedDealItem = (item: DealItem) =>
  item.catalogueType === "Related Item";

export const isBillableRootDealItem = (item: DealItem) =>
  !item.parentItemId || isLiteralRelatedDealItem(item);

export const isAutoBillableDealItem = (item: DealItem) =>
  AUTO_BILLABLE_TYPES.has(String(item.catalogueType || ""));

export const resolveDealDocumentBillingMode = (
  items: Array<Pick<DealItem, "catalogueType">> | null | undefined,
): DealDocumentBillingMode => {
  const actualItems = items || [];

  if (!actualItems.length) return "empty";

  if (
    actualItems.every((item) =>
      AUTO_BILLABLE_TYPES.has(String(item.catalogueType || "")),
    )
  ) {
    return "simple-root";
  }

  if (
    actualItems.every((item) =>
      CONTRACTUAL_BILLABLE_TYPES.has(String(item.catalogueType || "")),
    )
  ) {
    return "contractual-stage";
  }

  if (
    actualItems.every((item) =>
      RETAINER_BILLABLE_TYPES.has(String(item.catalogueType || "")),
    )
  ) {
    return "retainer-period";
  }

  if (
    actualItems.every((item) =>
      RECURRENT_BILLABLE_TYPES.has(String(item.catalogueType || "")),
    )
  ) {
    return "recurrent-period";
  }

  return "mixed-manual";
};

export const resolveDealDocumentBillingModeForItem = (
  item: Pick<DealItem, "catalogueType">,
) => resolveDealDocumentBillingMode([item]);

const PHASE_PERIOD_TEXT_PATTERN =
  /\b(phase|billing period|period\s+\d+|retainer|recurrent|recurring|start date|end date|number of periods)\b/i;

export const isDealPhaseOrPeriodItem = (
  item?: Pick<
    DealItem,
    "catalogueType" | "retainerPeriods" | "recurrentPeriods"
  > | null,
) => {
  if (!item) return false;

  const mode = resolveDealDocumentBillingModeForItem(item);

  return (
    mode === "contractual-stage" ||
    mode === "retainer-period" ||
    mode === "recurrent-period" ||
    Number(item.retainerPeriods ?? 0) > 0 ||
    Number(item.recurrentPeriods ?? 0) > 0
  );
};

export const isDealDocumentPhaseOrPeriodLine = (
  product?: DealDocumentLineLike | null,
  linkedDealItems?: DealDocumentLinkedItemLike[] | null,
) => {
  if (!product) return false;

  const selectionKey = String(product.dealSelectionKey ?? "").trim();
  const normalizedSelectionKey = selectionKey.toLowerCase();
  const billingPeriodKey = resolveStoredBillingPeriodKey(product);

  if (
    product.billingPeriod ||
    billingPeriodKey ||
    normalizedSelectionKey.includes("phase") ||
    normalizedSelectionKey.includes("retainer") ||
    normalizedSelectionKey.includes("recurrent")
  ) {
    return true;
  }

  const itemMatch = selectionKey.match(/^item-(\d+)/i);
  const linkedItemId = itemMatch?.[1];
  if (linkedItemId && linkedDealItems?.length) {
    const linkedItem = linkedDealItems.find(
      (item) => String(item.id) === linkedItemId,
    );
    if (isDealPhaseOrPeriodItem(linkedItem)) return true;
  }

  return PHASE_PERIOD_TEXT_PATTERN.test(
    [product.title, product.description].filter(Boolean).join("\n"),
  );
};

export const hasDealDocumentPhaseOrPeriodLines = (
  products?: DealDocumentLineLike[] | null,
  linkedDealItems?: DealDocumentLinkedItemLike[] | null,
) => {
  const actualProducts = products || [];

  if (actualProducts.length) {
    return actualProducts.some((product) =>
      isDealDocumentPhaseOrPeriodLine(product, linkedDealItems),
    );
  }

  return (linkedDealItems || []).some((item) => isDealPhaseOrPeriodItem(item));
};

function buildDealTermBillingPeriods(
  item: Pick<
    DealItem,
    | "id"
    | "retainerStartDate"
    | "retainerEndDate"
    | "retainerPeriods"
    | "recurrentStartDate"
    | "recurrentEndDate"
    | "recurrentPeriods"
  >,
  type: "retainer" | "recurrent",
) {
  const startDateValue =
    type === "retainer" ? item.retainerStartDate : item.recurrentStartDate;
  const endDateValue =
    type === "retainer" ? item.retainerEndDate : item.recurrentEndDate;
  const totalPeriods = Number(
    type === "retainer" ? item.retainerPeriods : item.recurrentPeriods,
  );
  const parsedStartDate = parseBillingPeriodDateValue(startDateValue);
  const parsedEndDate = parseBillingPeriodDateValue(endDateValue);

  if (
    !parsedStartDate ||
    !parsedEndDate ||
    parsedEndDate < parsedStartDate ||
    !Number.isInteger(totalPeriods) ||
    totalPeriods <= 0
  ) {
    return [] as DealBillingPeriod[];
  }

  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const startMilliseconds = parsedStartDate.getTime();
  const inclusiveDurationMilliseconds =
    parsedEndDate.getTime() - startMilliseconds + dayMilliseconds;

  return Array.from({ length: totalPeriods }, (_, index) => {
    const periodStartMilliseconds =
      startMilliseconds +
      Math.floor((inclusiveDurationMilliseconds * index) / totalPeriods);
    const rawPeriodEndMilliseconds =
      startMilliseconds +
      Math.floor((inclusiveDurationMilliseconds * (index + 1)) / totalPeriods) -
      dayMilliseconds;
    const periodStartDate = new Date(periodStartMilliseconds);
    const periodEndDate =
      index === totalPeriods - 1
        ? new Date(parsedEndDate.getTime())
        : new Date(Math.max(rawPeriodEndMilliseconds, periodStartMilliseconds));
    const normalizedStartDate = formatBillingPeriodDateValue(periodStartDate);
    const normalizedEndDate = formatBillingPeriodDateValue(periodEndDate);

    return buildCustomBillingPeriod({
      endDate: normalizedEndDate,
      key: `${type}:${item.id}:period:${index + 1}`,
      label: `Period ${index + 1} - ${normalizedStartDate} - ${normalizedEndDate}`,
      startDate: normalizedStartDate,
    });
  });
}

export const filterDealDocumentItemsByBillingMode = <
  TItem extends Pick<DealItem, "catalogueType">,
>(
  items: TItem[] | null | undefined,
  mode: DealDocumentBillingMode,
) => {
  const actualItems = items || [];

  if (mode === "empty") return [] as TItem[];
  if (mode === "mixed-manual") return [...actualItems];

  return actualItems.filter(
    (item) => resolveDealDocumentBillingModeForItem(item) === mode,
  );
};

export const normalizeBillingPeriodKey = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const DEAL_BILLING_PERIOD_KINDS = new Set<DealBillingPeriodKind>([
  "monthly",
  "quarterly",
  "yearly",
  "custom",
]);

const normalizeDealBillingPeriodKind = (
  kind?: string | null,
): DealBillingPeriodKind => {
  const normalizedKind = String(kind ?? "")
    .trim()
    .toLowerCase();

  return DEAL_BILLING_PERIOD_KINDS.has(normalizedKind as DealBillingPeriodKind)
    ? (normalizedKind as DealBillingPeriodKind)
    : "monthly";
};

function formatBillingPeriodDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatBillingPeriodRangeLabel(startDate: Date, endDate: Date) {
  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  const startLabel = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(endDate);

  return `${startLabel} - ${endLabel}`;
}

function parseBillingPeriodDateValue(value?: string | null) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    !Number.isFinite(year) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    !Number.isFinite(day) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export const buildMonthlyBillingPeriod = (
  monthValue?: string | null,
): DealBillingPeriod => {
  const match = String(monthValue ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})$/);
  const today = new Date();
  const parsedYear = match ? Number(match[1]) : today.getFullYear();
  const parsedMonthIndex = match ? Number(match[2]) - 1 : today.getMonth();
  const year = Number.isFinite(parsedYear) ? parsedYear : today.getFullYear();
  const monthIndex =
    Number.isFinite(parsedMonthIndex) &&
    parsedMonthIndex >= 0 &&
    parsedMonthIndex <= 11
      ? parsedMonthIndex
      : today.getMonth();
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return {
    endDate: formatBillingPeriodDateValue(endDate),
    key,
    kind: "monthly",
    label: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(startDate),
    startDate: formatBillingPeriodDateValue(startDate),
  };
};

export const buildQuarterlyBillingPeriod = (
  quarterValue?: string | null,
): DealBillingPeriod => {
  const match = String(quarterValue ?? "")
    .trim()
    .toUpperCase()
    .match(/^(\d{4})-Q([1-4])$/);
  const today = new Date();
  const fallbackQuarter = Math.floor(today.getMonth() / 3) + 1;
  const year = match ? Number(match[1]) : today.getFullYear();
  const quarter = match ? Number(match[2]) : fallbackQuarter;
  const startDate = new Date(year, (quarter - 1) * 3, 1);
  const endDate = new Date(year, quarter * 3, 0);

  return {
    endDate: formatBillingPeriodDateValue(endDate),
    key: `${year}-q${quarter}`,
    kind: "quarterly",
    label: `Q${quarter} ${year}`,
    startDate: formatBillingPeriodDateValue(startDate),
  };
};

export const buildYearlyBillingPeriod = (
  yearValue?: number | string | null,
): DealBillingPeriod => {
  const match = String(yearValue ?? "")
    .trim()
    .match(/^(\d{4})$/);
  const today = new Date();
  const year = match ? Number(match[1]) : today.getFullYear();
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  return {
    endDate: formatBillingPeriodDateValue(endDate),
    key: String(year),
    kind: "yearly",
    label: String(year),
    startDate: formatBillingPeriodDateValue(startDate),
  };
};

export const buildCustomBillingPeriod = (
  input?: Partial<DealBillingPeriod> | null,
): DealBillingPeriod => {
  const startDate =
    parseBillingPeriodDateValue(input?.startDate) ||
    parseBillingPeriodDateValue(input?.endDate) ||
    new Date();
  const endDate =
    parseBillingPeriodDateValue(input?.endDate) ||
    parseBillingPeriodDateValue(input?.startDate) ||
    startDate;
  const normalizedStartDate =
    startDate <= endDate ? startDate : new Date(endDate.getTime());
  const normalizedEndDate =
    startDate <= endDate ? endDate : new Date(startDate.getTime());
  const startDateValue = formatBillingPeriodDateValue(normalizedStartDate);
  const endDateValue = formatBillingPeriodDateValue(normalizedEndDate);

  return {
    endDate: endDateValue,
    key:
      String(input?.key ?? "").trim() ||
      `custom:${startDateValue}:${endDateValue}`,
    kind: "custom",
    label:
      String(input?.label ?? "").trim() ||
      formatBillingPeriodRangeLabel(normalizedStartDate, normalizedEndDate),
    startDate: startDateValue,
  };
};

export const cloneDealBillingPeriod = (
  period?: Partial<DealBillingPeriod> | null,
): DealBillingPeriod | null => {
  if (!period) return null;

  const kind = normalizeDealBillingPeriodKind(period.kind);
  const key = String(period.key ?? "").trim();
  const label = String(period.label ?? "").trim();
  const startDate = String(period.startDate ?? "").trim();
  const endDate = String(period.endDate ?? "").trim();

  if (key && label && startDate && endDate) {
    return {
      endDate,
      key,
      kind,
      label,
      startDate,
    };
  }

  if (kind === "monthly") return buildMonthlyBillingPeriod(key || undefined);
  if (kind === "quarterly")
    return buildQuarterlyBillingPeriod(key || undefined);
  if (kind === "yearly") return buildYearlyBillingPeriod(key || undefined);

  if (startDate || endDate || key || label) {
    return buildCustomBillingPeriod({
      endDate: endDate || undefined,
      key: key || undefined,
      label: label || undefined,
      startDate: startDate || undefined,
    });
  }

  return null;
};

export const inferDealBillingPeriodFromKey = (
  billingPeriodKey?: string | null,
): DealBillingPeriod | null => {
  const normalizedKey = normalizeBillingPeriodKey(billingPeriodKey);
  if (!normalizedKey) return null;

  if (/^\d{4}-\d{2}$/.test(normalizedKey)) {
    return buildMonthlyBillingPeriod(normalizedKey);
  }

  const quarterMatch = normalizedKey.match(/^(\d{4})-q([1-4])$/);
  if (quarterMatch) {
    return buildQuarterlyBillingPeriod(
      `${quarterMatch[1]}-Q${quarterMatch[2]}`,
    );
  }

  if (/^\d{4}$/.test(normalizedKey)) {
    return buildYearlyBillingPeriod(normalizedKey);
  }

  const customMatch = normalizedKey.match(
    /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/,
  );
  if (customMatch) {
    return buildCustomBillingPeriod({
      endDate: customMatch[2],
      key: normalizedKey,
      startDate: customMatch[1],
    });
  }

  return buildCustomBillingPeriod({
    key: normalizedKey,
    label: String(billingPeriodKey ?? "").trim() || normalizedKey,
  });
};

export const getDealBillingPeriodKey = (period?: DealBillingPeriod | null) =>
  normalizeBillingPeriodKey(period?.key);

export const getDealBillingPeriodLabel = (period?: DealBillingPeriod | null) =>
  String(period?.label ?? "").trim();

export const getDealBillingPeriodMonthValue = (
  period?: DealBillingPeriod | null,
) => {
  const periodKey = getDealBillingPeriodKey(period);

  if (/^\d{4}-\d{2}$/.test(periodKey)) return periodKey;

  return buildMonthlyBillingPeriod().key;
};

export const resolveStoredBillingPeriodKey = (
  input?: {
    billingPeriod?: DealBillingPeriod | null;
    billingPeriodKey?: string | null;
  } | null,
) =>
  getDealBillingPeriodKey(
    cloneDealBillingPeriod(input?.billingPeriod) ||
      inferDealBillingPeriodFromKey(input?.billingPeriodKey),
  ) || normalizeBillingPeriodKey(input?.billingPeriodKey);

export const buildDealDocumentUsageKey = (
  selectionKey?: string | null,
  billingPeriodKey?: string | null,
) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return "";

  const normalizedPeriodKey = normalizeBillingPeriodKey(billingPeriodKey);

  return normalizedPeriodKey
    ? `${normalizedSelectionKey}::${normalizedPeriodKey}`
    : normalizedSelectionKey;
};

function normalizeCustomPhases(item: DealItem) {
  return Array.isArray(item.customPhases)
    ? item.customPhases.filter(Boolean)
    : ([] as DealCustomPhase[]);
}

function normalizeRemovedChildIds(item: DealItem) {
  return new Set(
    Array.isArray(item.removedPhaseIds)
      ? item.removedPhaseIds
          .map((value) => Number(value))
          .filter(Number.isFinite)
      : [],
  );
}

function buildDealLinkedServiceLines(
  item: DealItem,
  options: {
    chargeTax: boolean | null;
    customPrefix: "retainer" | "recurrent";
    defaultNote?: string | null;
    overridePrefix: "retainer" | "recurrent";
    services: Array<{
      id: number;
      name: string;
      category: string;
      description: string;
      quantity: number | null;
    }>;
  },
): DealDocumentContractualPhaseLine[] {
  const removedChildIds = normalizeRemovedChildIds(item);

  const baseLines = options.services
    .filter((service) => !removedChildIds.has(Number(service.id)))
    .map((service) => {
      const override =
        item.subItemOverrides?.[`${options.overridePrefix}-${service.id}`] ||
        {};

      return {
        category:
          override.category ?? service.category ?? item.category ?? null,
        discountPercent: override.discountPercent ?? 0,
        id: service.id,
        isCustom: false,
        name: override.name ?? service.name,
        note:
          override.note ??
          service.description ??
          item.note ??
          options.defaultNote ??
          null,
        overrideKey: `${options.overridePrefix}-${service.id}`,
        price: override.unitPrice ?? null,
        quantity: override.quantity ?? service.quantity ?? item.quantity,
        sourcePhaseId: Number(service.id),
        taxApplicable: override.taxApplicable ?? options.chargeTax,
      } satisfies DealDocumentContractualPhaseLine;
    });

  const customLines = normalizeCustomPhases(item).map(
    (phase) =>
      ({
        category: phase.category ?? item.category ?? null,
        discountPercent: phase.discountPercent ?? 0,
        id: phase.id,
        isCustom: true,
        name: String(phase.name || "").trim(),
        note: phase.note ?? item.note ?? options.defaultNote ?? null,
        overrideKey: `${options.customPrefix}-custom-${phase.id}`,
        price: phase.price ?? null,
        quantity: phase.quantity ?? item.quantity,
        sourcePhaseId: null,
        taxApplicable: phase.taxApplicable ?? options.chargeTax,
      }) satisfies DealDocumentContractualPhaseLine,
  );

  return [...baseLines, ...customLines];
}

export const getDealContractualPhaseLines = (
  item: DealItem,
  record: CatalogueContractualServiceRecord,
): DealDocumentContractualPhaseLine[] => {
  const removedPhaseIds = new Set(
    Array.isArray(item.removedPhaseIds)
      ? item.removedPhaseIds
          .map((value) => Number(value))
          .filter(Number.isFinite)
      : [],
  );

  const basePhases = (record.phases || [])
    .filter((phase) => !removedPhaseIds.has(Number(phase.id)))
    .map((phase) => {
      const override = item.subItemOverrides?.[`phase-${phase.id}`] || {};

      return {
        category: override.category ?? item.category ?? null,
        discountPercent: override.discountPercent ?? 0,
        id: phase.id,
        isCustom: false,
        name: override.name ?? phase.name,
        note: override.note ?? item.note ?? record.description ?? null,
        overrideKey: `phase-${phase.id}`,
        price: override.unitPrice ?? phase.price ?? null,
        quantity: override.quantity ?? item.quantity,
        sourcePhaseId: Number(phase.id),
        taxApplicable: override.taxApplicable ?? record.chargeTax,
      } satisfies DealDocumentContractualPhaseLine;
    });

  const customPhases = normalizeCustomPhases(item).map(
    (phase) =>
      ({
        category: phase.category ?? item.category ?? null,
        discountPercent: phase.discountPercent ?? 0,
        id: phase.id,
        isCustom: true,
        name: String(phase.name || "").trim(),
        note: phase.note ?? item.note ?? record.description ?? null,
        overrideKey: `phase-custom-${phase.id}`,
        price: phase.price ?? null,
        quantity: phase.quantity ?? item.quantity,
        sourcePhaseId: null,
        taxApplicable: phase.taxApplicable ?? record.chargeTax,
      }) satisfies DealDocumentContractualPhaseLine,
  );

  return [...basePhases, ...customPhases];
};

export const getDealRetainerServiceLines = (
  item: DealItem,
  record: CatalogueRetainerServiceRecord,
): DealDocumentContractualPhaseLine[] =>
  buildDealLinkedServiceLines(item, {
    chargeTax: record.chargeTax,
    customPrefix: "retainer",
    defaultNote: record.description ?? null,
    overridePrefix: "retainer",
    services: (record.retainerServices || []).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      description: service.description,
      quantity: service.qty ?? item.quantity,
    })),
  });

export const getDealRecurrentServiceLines = (
  item: DealItem,
  record: CatalogueReccurentServiceRecord,
): DealDocumentContractualPhaseLine[] =>
  buildDealLinkedServiceLines(item, {
    chargeTax: record.chargeTax,
    customPrefix: "recurrent",
    defaultNote: record.description ?? null,
    overridePrefix: "recurrent",
    services: (record.reccurentServices || []).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      description: service.description,
      quantity: item.quantity ?? 1,
    })),
  });

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultDueDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function buildClient(contact?: ContactProperties | null): Client {
  if (!contact) {
    return {
      address: "",
      company: "",
      companyEmail: "",
      contact: "",
      country: "Lebanon",
      name: "",
    };
  }

  return {
    address: contact.address?.trim() || "",
    company: contact.fullName.trim(),
    companyEmail: contact.email?.trim() || "",
    contact: contact.number?.trim() || "",
    country: contact.country?.trim() || "Lebanon",
    name: contact.fullName.trim(),
  };
}

function normalizeLineQuantity(value: unknown, fallback = 1) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeLineCost(value: unknown) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSelectionKey(
  item: DealItem,
  isGenerated: boolean,
  suffix?: string,
) {
  if (isGenerated) {
    return `generated-${item.parentItemId ?? item.id}-${item.sourceRelatedItemId ?? item.id}${suffix ? `-${suffix}` : ""}`;
  }

  return `item-${item.id}${suffix ? `-${suffix}` : ""}`;
}

function buildExpansionSummary(
  item: DealItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (item.catalogueType === "Related Item") {
    return "Directly billable related item";
  }

  if (!item.catalogueItemId || !resolveCatalogueRecord) return null;

  const record = resolveCatalogueRecord(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  if (!record) return null;

  if (record.type === "Contractual Service") {
    return formatCountLabel(
      getDealContractualPhaseLines(item, record).length,
      "phase",
      "phases",
    );
  }

  if (record.type === "Retainer Service") {
    return formatCountLabel(
      getDealRetainerServiceLines(item, record).length,
      "retainer service",
      "retainer services",
    );
  }

  if (record.type === "Reccurent Service") {
    return formatCountLabel(
      getDealRecurrentServiceLines(item, record).length,
      "recurrent service",
      "recurrent services",
    );
  }

  return null;
}

function buildItemHint(
  item: DealItem,
  expansionSummary: string | null,
  parentName: string | null,
  isRootReplacement = false,
) {
  if (isRootReplacement) return null;

  if (item.catalogueType === "Related Item") {
    return "Counts as a directly billable related item.";
  }

  if (isBillableRootDealItem(item) && isAutoBillableDealItem(item)) {
    return "Eligible for direct invoice/proforma flow when all billable-root items are eligible.";
  }

  if (isBillableRootDealItem(item) && expansionSummary) {
    return `Selecting this row expands into ${expansionSummary}.`;
  }

  if (isBillableRootDealItem(item)) {
    return "Requires manual selection for invoice/proforma flow.";
  }

  if (parentName) {
    return `Nested under ${parentName}.`;
  }

  return null;
}

function toSelectableItem(
  item: DealItem,
  options: {
    isGenerated: boolean;
    isRootReplacement?: boolean;
    lineConstraintsOverride?: {
      discount?: boolean;
      price?: boolean;
      quantity?: boolean;
    } | null;
    parentName: string | null;
    resolveCatalogueRecord?: CatalogueRecordResolver;
    selectionKeySuffix?: string;
  },
): DealDocumentSelectableItem {
  const expansionSummary = options.isRootReplacement
    ? null
    : buildExpansionSummary(item, options.resolveCatalogueRecord);

  return {
    ...item,
    selectionKey: buildSelectionKey(
      item,
      options.isGenerated,
      options.selectionKeySuffix,
    ),
    expansionSummary,
    groupKey:
      options.isRootReplacement || isBillableRootDealItem(item)
        ? "billable-root"
        : "child-items",
    groupLabel:
      options.isRootReplacement || isBillableRootDealItem(item)
        ? "Billable Root Items"
        : "Child Items",
    hint: buildItemHint(
      item,
      expansionSummary,
      options.parentName,
      Boolean(options.isRootReplacement),
    ),
    isAutoBillable: isAutoBillableDealItem(item),
    isBillableRoot: options.isRootReplacement || isBillableRootDealItem(item),
    isGenerated: options.isGenerated,
    isRootReplacement: options.isRootReplacement || undefined,
    lineConstraintsOverride: options.lineConstraintsOverride || undefined,
    parentName: options.parentName,
  };
}

function buildDerivedSelectableLines(
  item: DealItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (!item.catalogueItemId || !resolveCatalogueRecord || item.parentItemId) {
    return [] as DealDocumentSelectableItem[];
  }

  const record = resolveCatalogueRecord(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  if (!record) return [] as DealDocumentSelectableItem[];

  if (record.type === "Contractual Service") {
    const contractual = record as CatalogueContractualServiceRecord;

    return getDealContractualPhaseLines(item, contractual).map((phase) => {
      return toSelectableItem(
        {
          ...item,
          catalogueType: "Phase",
          category: phase.category,
          discountPercent: phase.discountPercent ?? 0,
          name: phase.name,
          note: phase.note,
          quantity: phase.quantity ?? item.quantity ?? 1,
          taxApplicable: phase.taxApplicable,
          unitPrice: phase.price,
        },
        {
          isGenerated: false,
          isRootReplacement: true,
          parentName: item.name,
          resolveCatalogueRecord,
          selectionKeySuffix: phase.overrideKey,
        },
      );
    });
  }

  if (record.type === "Retainer Service") {
    const retainer = record as CatalogueRetainerServiceRecord;

    return getDealRetainerServiceLines(item, retainer).map((service) => {
      return toSelectableItem(
        {
          ...item,
          catalogueType: "Retainer Service Line",
          category: service.category,
          discountPercent: service.discountPercent ?? 0,
          name: service.name,
          note: service.note,
          quantity: service.quantity ?? item.quantity,
          taxApplicable: service.taxApplicable,
          unitPrice: service.price ?? item.unitPrice ?? null,
        },
        {
          isGenerated: false,
          isRootReplacement: true,
          lineConstraintsOverride: {
            discount: false,
            price: false,
          },
          parentName: item.name,
          resolveCatalogueRecord,
          selectionKeySuffix: service.overrideKey,
        },
      );
    });
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;

    return getDealRecurrentServiceLines(item, recurrent).map((service) => {
      return toSelectableItem(
        {
          ...item,
          catalogueType: "Recurrent Service Line",
          category: service.category,
          discountPercent: service.discountPercent ?? 0,
          name: service.name,
          note: service.note,
          quantity: service.quantity ?? item.quantity,
          taxApplicable: service.taxApplicable,
          unitPrice: service.price ?? item.unitPrice ?? null,
        },
        {
          isGenerated: false,
          isRootReplacement: true,
          lineConstraintsOverride: {
            discount: false,
            price: false,
            quantity: false,
          },
          parentName: item.name,
          resolveCatalogueRecord,
          selectionKeySuffix: service.overrideKey,
        },
      );
    });
  }

  return [] as DealDocumentSelectableItem[];
}

function deriveGeneratedRelatedItems(
  item: DealItem,
  materializedRelatedKeys: Set<string>,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (item.catalogueType === "Related Item" || item.parentItemId) return [];
  if (!item.catalogueItemId || !resolveCatalogueRecord) return [];

  const record = resolveCatalogueRecord(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  if (!record || record.type !== "Onetime Service") return [];

  const service = record as CatalogueOnetimeServiceRecord;
  const excluded = new Set(item.excludedRelatedItemIds || []);

  return (service.relatedItems || [])
    .filter((relatedItem) => !excluded.has(relatedItem.id))
    .filter(
      (relatedItem) =>
        !materializedRelatedKeys.has(`${item.id}:${relatedItem.id}`),
    )
    .map((relatedItem) => {
      const overrideKey = `related-${relatedItem.id}`;
      const override = item.subItemOverrides?.[overrideKey] || {};

      return {
        ...item,
        id: item.id,
        name: override.name ?? relatedItem.name,
        itemTypeLabel: "Related Item",
        category: override.category ?? relatedItem.category,
        catalogueType: "Related Item",
        parentItemId: item.id,
        sourceRelatedItemId: relatedItem.id,
        quantity: override.quantity ?? item.quantity ?? 1,
        unitPrice: override.unitPrice ?? relatedItem.price ?? null,
        discountPercent: override.discountPercent ?? 0,
        taxApplicable: override.taxApplicable ?? relatedItem.chargeTax,
        note: override.note ?? relatedItem.description ?? null,
      } satisfies DealItem;
    });
}

export function getSelectableDealItems(
  items: DealItem[] | null | undefined,
  resolveCatalogueRecord?: CatalogueRecordResolver,
): DealDocumentSelectableItem[] {
  const actualItems = items || [];
  const parentNames = new Map(
    actualItems.map((item) => [String(item.id), item.name]),
  );
  const materializedRelatedKeys = new Set(
    actualItems
      .filter(
        (item) =>
          item.catalogueType === "Related Item" &&
          !!item.parentItemId &&
          !!item.sourceRelatedItemId,
      )
      .map((item) => `${item.parentItemId}:${item.sourceRelatedItemId}`),
  );

  return actualItems.flatMap((item) => {
    const derivedSelectableLines = buildDerivedSelectableLines(
      item,
      resolveCatalogueRecord,
    );
    const parentName = item.parentItemId
      ? parentNames.get(String(item.parentItemId)) || null
      : null;
    const baseItems = derivedSelectableLines.length
      ? []
      : [
          toSelectableItem(item, {
            isGenerated: false,
            parentName,
            resolveCatalogueRecord,
          }),
        ];
    const generatedRelatedItems = deriveGeneratedRelatedItems(
      item,
      materializedRelatedKeys,
      resolveCatalogueRecord,
    ).map((generatedItem) =>
      toSelectableItem(generatedItem, {
        isGenerated: true,
        parentName: item.name,
        resolveCatalogueRecord,
      }),
    );

    return [...baseItems, ...derivedSelectableLines, ...generatedRelatedItems];
  });
}

export function getBillableRootDealItems(
  items: DealItem[] | null | undefined,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  return getSelectableDealItems(items, resolveCatalogueRecord).filter(
    (item) => item.isBillableRoot,
  );
}

export function getQuotationTopLevelDealItems(
  items: DealItem[] | null | undefined,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const topLevelItems = (items || [])
    .filter((item) => !item.parentItemId)
    .map((item) =>
      toSelectableItem(item, {
        isGenerated: false,
        parentName: null,
        resolveCatalogueRecord,
      }),
    );

  const relatedItems = getSelectableDealItems(
    items,
    resolveCatalogueRecord,
  ).filter(
    (item) => item.catalogueType === "Related Item" && !item.isRootReplacement,
  );

  return Array.from(
    new Map(
      [...topLevelItems, ...relatedItems].map((item) => [
        item.selectionKey,
        item,
      ]),
    ).values(),
  );
}

function normalizePeriodCount(value?: number | null) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function getRetainerBillingQuantity(
  item: DealDocumentSelectableItem | DealItem,
  billingPeriod?: DealBillingPeriod | null,
) {
  return billingPeriod ? 1 : normalizePeriodCount(item.retainerPeriods);
}

function getRecurrentBillingQuantity(
  item: DealDocumentSelectableItem | DealItem,
  billingPeriod?: DealBillingPeriod | null,
) {
  return billingPeriod ? 1 : normalizePeriodCount(item.recurrentPeriods);
}

function createPurchasedProduct(input: {
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodKey?: string | null;
  catalogueItemId?: string | null;
  dealSelectionKey?: string | null;
  cost?: number | null;
  description?: string | null;
  discountPercent?: number | null;
  hours?: number | null;
  lineConstraints?: {
    discount?: boolean;
    price?: boolean;
    quantity?: boolean;
  } | null;
  title: string;
}): PurchasedProductLike {
  const discountValue = Number(input.discountPercent || 0);
  const billingPeriod = cloneDealBillingPeriod(input.billingPeriod);

  return {
    billingPeriod: billingPeriod ?? null,
    billingPeriodKey:
      resolveStoredBillingPeriodKey({
        billingPeriod,
        billingPeriodKey: input.billingPeriodKey,
      }) || null,
    catalogueItemId: input.catalogueItemId ?? null,
    dealSelectionKey: input.dealSelectionKey ?? null,
    cost: normalizeLineCost(input.cost),
    description: input.description?.trim() || "",
    discountType: discountValue > 0 ? "percent" : "none",
    discountValue,
    hours: normalizeLineQuantity(input.hours, 1),
    lineConstraints: input.lineConstraints || undefined,
    title: input.title,
  };
}

function formatQuotationPeriodDate(value?: string | null) {
  const date = parseBillingPeriodDateValue(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildQuotationPeriodSummary(item: DealDocumentSelectableItem) {
  const itemMode = resolveDealDocumentBillingModeForItem(item);
  if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
    return "";

  const startDate =
    itemMode === "retainer-period"
      ? formatQuotationPeriodDate(item.retainerStartDate)
      : formatQuotationPeriodDate(item.recurrentStartDate);
  const endDate =
    itemMode === "retainer-period"
      ? formatQuotationPeriodDate(item.retainerEndDate)
      : formatQuotationPeriodDate(item.recurrentEndDate);
  const periods = Number(
    itemMode === "retainer-period"
      ? item.retainerPeriods
      : item.recurrentPeriods,
  );

  return [
    startDate ? `Start Date: ${startDate}` : "",
    endDate ? `End Date: ${endDate}` : "",
    periods > 0 ? `Number of Periods: ${periods}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBillingPeriodSummary(billingPeriod?: DealBillingPeriod | null) {
  const label = getDealBillingPeriodLabel(billingPeriod);
  if (!label) return "";

  return `Billing Period: ${label}`;
}

function buildIncludedItemsSummary(names: string[]) {
  const uniqueNames = Array.from(
    new Set(names.map((name) => String(name || "").trim()).filter(Boolean)),
  );

  return uniqueNames.length ? `Items included: ${uniqueNames.join(", ")}` : "";
}

function buildPurchasedProductDescription(input: {
  base?: string | null;
  billingPeriod?: DealBillingPeriod | null;
  includedItems?: string[];
  item?: DealDocumentSelectableItem | DealItem | null;
  label?: string | null;
  parentName?: string | null;
  phaseName?: string | null;
}) {
  const parts = [
    input.label?.trim() || "",
    input.parentName?.trim() ? `Parent Item: ${input.parentName.trim()}` : "",
    input.phaseName?.trim() ? `Phase: ${input.phaseName.trim()}` : "",
    input.base?.trim() || "",
    input.item ? buildQuotationPeriodSummary(input.item as DealDocumentSelectableItem) : "",
    buildBillingPeriodSummary(input.billingPeriod),
    input.includedItems?.length
      ? buildIncludedItemsSummary(input.includedItems)
      : "",
  ];

  return parts.filter(Boolean).join("\n");
}

function buildStandardPurchasedProduct(
  item: DealDocumentSelectableItem,
  billingPeriod?: DealBillingPeriod | null,
) {
  const itemMode = resolveDealDocumentBillingModeForItem(item);
  const isPeriodBasedLine =
    itemMode === "retainer-period" || itemMode === "recurrent-period";

  return createPurchasedProduct({
    billingPeriod: isPeriodBasedLine ? billingPeriod : null,
    billingPeriodKey: isPeriodBasedLine
      ? getDealBillingPeriodKey(billingPeriod)
      : null,
    catalogueItemId: item.catalogueItemId ?? null,
    dealSelectionKey: item.selectionKey,
    cost: item.unitPrice ?? 0,
    description: buildPurchasedProductDescription({
      base: item.note?.trim() || item.category?.trim() || "",
      billingPeriod: isPeriodBasedLine ? billingPeriod : null,
      item,
      parentName: item.parentName,
    }),
    discountPercent: item.discountPercent ?? 0,
    hours: isPeriodBasedLine
      ? itemMode === "retainer-period"
        ? getRetainerBillingQuantity(item, billingPeriod)
        : getRecurrentBillingQuantity(item, billingPeriod)
      : item.quantity,
    lineConstraints: item.lineConstraintsOverride,
    title: item.name,
  });
}

function buildContractualProducts(
  item: DealDocumentSelectableItem,
  record: CatalogueContractualServiceRecord,
) {
  return getDealContractualPhaseLines(item, record).map((phase) => {
    return createPurchasedProduct({
      catalogueItemId: item.catalogueItemId ?? null,
      dealSelectionKey: `item-${item.id}-${phase.overrideKey}`,
      cost: phase.price ?? 0,
      description: buildPurchasedProductDescription({
        base: phase.note ?? item.note ?? record.description ?? item.category ?? "",
        item,
        label: phase.isCustom ? "Custom contractual phase" : "Contractual phase",
        parentName: item.name,
        phaseName: phase.name,
      }),
      discountPercent: phase.discountPercent ?? 0,
      hours: phase.quantity,
      title: phase.name,
    });
  });
}

function buildRetainerProducts(
  item: DealDocumentSelectableItem,
  record: CatalogueRetainerServiceRecord,
  billingPeriod?: DealBillingPeriod | null,
) {
  const services = getDealRetainerServiceLines(item, record);
  const serviceNames = services.map((service) => service.name);

  return [
    createPurchasedProduct({
      billingPeriod: billingPeriod ?? null,
      billingPeriodKey: getDealBillingPeriodKey(billingPeriod) || null,
      catalogueItemId: item.catalogueItemId ?? null,
      dealSelectionKey: item.selectionKey,
      cost: item.unitPrice ?? record.bestPrice ?? 0,
      description: buildPurchasedProductDescription({
        base: String(item.note || record.description || item.category || "").trim(),
        billingPeriod,
        includedItems: serviceNames,
        item,
        label: "Retainer service",
      }),
      discountPercent: item.discountPercent ?? 0,
      hours: getRetainerBillingQuantity(item, billingPeriod),
      title: item.name,
    }),
  ];
}

function buildCollapsedRetainerPeriodProduct(
  items: DealDocumentSelectableItem[],
  deal: DealProperties,
  billingPeriod?: DealBillingPeriod | null,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const firstItem = items[0];
  if (!firstItem) return null;

  const rootItem =
    deal.items.find(
      (item) => String(item.id) === String(firstItem.id) && !item.parentItemId,
    ) || firstItem;

  const rootRecord =
    rootItem.catalogueItemId && resolveCatalogueRecord
      ? resolveCatalogueRecord(
          rootItem.catalogueItemId,
          rootItem.catalogueType || undefined,
        )
      : null;

  const itemNames = items
    .map((item) => String(item.name || "").trim())
    .filter(Boolean);

  return createPurchasedProduct({
    billingPeriod: billingPeriod ?? null,
    billingPeriodKey: getDealBillingPeriodKey(billingPeriod) || null,
    catalogueItemId: rootItem.catalogueItemId ?? null,
    dealSelectionKey: buildSelectionKey(rootItem, false),
    cost: rootItem.unitPrice ?? rootRecord?.bestPrice ?? 0,
    description: buildPurchasedProductDescription({
      base: String(
        rootItem.note || rootItem.category || rootRecord?.description || "",
      ).trim(),
      billingPeriod,
      includedItems: itemNames,
      item: rootItem,
      label: "Retainer service",
    }),
    discountPercent: rootItem.discountPercent ?? 0,
    hours: getRetainerBillingQuantity(rootItem, billingPeriod),
    title: rootItem.name,
  });
}

function buildRecurrentProducts(
  item: DealDocumentSelectableItem,
  record: CatalogueReccurentServiceRecord,
  billingPeriod?: DealBillingPeriod | null,
) {
  const services = getDealRecurrentServiceLines(item, record);
  const billingPeriodKey = getDealBillingPeriodKey(billingPeriod);
  const serviceNames = services.map((service) => service.name);

  return [
    createPurchasedProduct({
      billingPeriod: billingPeriod ?? null,
      billingPeriodKey: billingPeriodKey || null,
      catalogueItemId: item.catalogueItemId ?? null,
      dealSelectionKey: item.selectionKey,
      cost: item.unitPrice ?? record.bestPrice ?? 0,
      description: buildPurchasedProductDescription({
        base: String(item.note || record.description || item.category || "").trim(),
        billingPeriod,
        includedItems: serviceNames,
        item,
        label: "Recurrent service",
      }),
      discountPercent: item.discountPercent ?? 0,
      hours: getRecurrentBillingQuantity(item, billingPeriod),
      title: item.name,
    }),
  ];
}

function buildCollapsedRecurrentPeriodProduct(
  items: DealDocumentSelectableItem[],
  deal: DealProperties,
  billingPeriod?: DealBillingPeriod | null,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const firstItem = items[0];
  if (!firstItem) return null;

  const rootItem =
    deal.items.find(
      (item) => String(item.id) === String(firstItem.id) && !item.parentItemId,
    ) || firstItem;

  const rootRecord =
    rootItem.catalogueItemId && resolveCatalogueRecord
      ? resolveCatalogueRecord(
          rootItem.catalogueItemId,
          rootItem.catalogueType || undefined,
        )
      : null;

  const itemNames = items
    .map((item) => String(item.name || "").trim())
    .filter(Boolean);


  return createPurchasedProduct({
    billingPeriod: billingPeriod ?? null,
    billingPeriodKey: getDealBillingPeriodKey(billingPeriod) || null,
    catalogueItemId: rootItem.catalogueItemId ?? null,
    dealSelectionKey: buildSelectionKey(rootItem, false),
    cost: rootItem.unitPrice ?? rootRecord?.bestPrice ?? 0,
    description: buildPurchasedProductDescription({
      base: String(
        rootItem.note || rootItem.category || rootRecord?.description || "",
      ).trim(),
      billingPeriod,
      includedItems: itemNames,
      item: rootItem,
      label: "Recurrent service",
    }),
    discountPercent: rootItem.discountPercent ?? 0,
    hours: getRecurrentBillingQuantity(rootItem, billingPeriod),
    title: rootItem.name,
  });
}

function expandDealItemToPurchasedProducts(
  item: DealDocumentSelectableItem,
  billingPeriod?: DealBillingPeriod | null,
  billingPeriods?: DealBillingPeriod[] | null,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (
    item.catalogueType === "Related Item" ||
    item.catalogueType === "Phase" ||
    item.catalogueType === "Retainer Service Line" ||
    item.catalogueType === "Recurrent Service Line"
  ) {
    return [buildStandardPurchasedProduct(item, billingPeriod)];
  }

  if (!item.catalogueItemId || !resolveCatalogueRecord) {
    return [buildStandardPurchasedProduct(item, billingPeriod)];
  }

  const record = resolveCatalogueRecord(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  if (!record) return [buildStandardPurchasedProduct(item, billingPeriod)];
  if (record.type === "Contractual Service") {
    return buildContractualProducts(item, record);
  }
  if (record.type === "Retainer Service") {
    if (billingPeriods?.length) {
      return billingPeriods.flatMap((period) =>
        buildRetainerProducts(item, record, period),
      );
    }

    return buildRetainerProducts(item, record, billingPeriod);
  }
  if (record.type === "Reccurent Service") {
    if (billingPeriods?.length) {
      return billingPeriods.flatMap((period) =>
        buildRecurrentProducts(item, record, period),
      );
    }

    return buildRecurrentProducts(item, record, billingPeriod);
  }

  return [buildStandardPurchasedProduct(item, billingPeriod)];
}

function resolveItemBillingPeriods(
  item: DealDocumentSelectableItem,
  billingPeriod?: DealBillingPeriod | null,
  billingPeriods?: DealBillingPeriod[] | null,
  billingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null,
) {
  const assignedPeriods = billingPeriodAssignments?.[item.selectionKey] || [];

  if (assignedPeriods.length) return assignedPeriods;
  if (billingPeriods?.length) return billingPeriods;
  if (billingPeriod) return [billingPeriod];

  return [] as DealBillingPeriod[];
}

function buildPurchasedProducts(
  items: DealDocumentSelectableItem[],
  deal: DealProperties,
  billingPeriod?: DealBillingPeriod | null,
  billingPeriods?: DealBillingPeriod[] | null,
  billingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const orderedProducts: PurchasedProductLike[] = [];
  const periodLineGroups = new Map<string, DealDocumentSelectableItem[]>();

  items.forEach((item) => {
    const itemBillingPeriods = resolveItemBillingPeriods(
      item,
      billingPeriod,
      billingPeriods,
      billingPeriodAssignments,
    );
    const itemBillingPeriod = itemBillingPeriods[0] ?? billingPeriod;

    if (
      item.catalogueType !== "Retainer Service Line" &&
      item.catalogueType !== "Recurrent Service Line"
    ) {
      orderedProducts.push(
        ...expandDealItemToPurchasedProducts(
          item,
          itemBillingPeriod,
          itemBillingPeriods.length > 1 ? itemBillingPeriods : null,
          resolveCatalogueRecord,
        ),
      );

      return;
    }

    const groupKey = `${item.catalogueType}:${item.id}:${getDealBillingPeriodKey(itemBillingPeriod) || ""}`;
    const existingGroup = periodLineGroups.get(groupKey);

    if (existingGroup) {
      existingGroup.push(item);
      return;
    }

    periodLineGroups.set(groupKey, [item]);

    const groupItems = periodLineGroups.get(groupKey)!;
    const collapsedProduct =
      item.catalogueType === "Retainer Service Line"
        ? buildCollapsedRetainerPeriodProduct(
            groupItems,
            deal,
            itemBillingPeriod,
            resolveCatalogueRecord,
          )
        : buildCollapsedRecurrentPeriodProduct(
            groupItems,
            deal,
            itemBillingPeriod,
            resolveCatalogueRecord,
          );

    if (collapsedProduct) orderedProducts.push(collapsedProduct);
  });

  const purchasedProducts = orderedProducts;

  if (purchasedProducts.length) return purchasedProducts;

  return [
    createPurchasedProduct({
      catalogueItemId: null,
      cost: 0,
      description: "",
      discountPercent: 0,
      hours: 1,
      title: "",
    }),
  ];
}

function normalizeDocumentMatchText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function resolveQuotationConversionParentItem(
  product: DealDocumentLineLike,
  deal: DealProperties,
) {
  const selectionKey = String(product.dealSelectionKey ?? "").trim();
  const itemMatch = selectionKey.match(/^item-(\d+)(?:-|$)/i);
  const matchedBySelection = itemMatch?.[1]
    ? deal.items.find((item) => String(item.id) === itemMatch[1])
    : null;
  if (matchedBySelection && isDealPhaseOrPeriodItem(matchedBySelection)) {
    return matchedBySelection;
  }

  const catalogueItemId = String(product.catalogueItemId ?? "").trim();
  if (catalogueItemId) {
    const matchedByCatalogue = deal.items.find(
      (item) =>
        String(item.catalogueItemId ?? "") === catalogueItemId &&
        isDealPhaseOrPeriodItem(item),
    );
    if (matchedByCatalogue) return matchedByCatalogue;
  }

  const productTitle = normalizeDocumentMatchText(product.title);
  if (productTitle) {
    const matchedByTitle = deal.items.find(
      (item) =>
        normalizeDocumentMatchText(item.name) === productTitle &&
        isDealPhaseOrPeriodItem(item),
    );
    if (matchedByTitle) return matchedByTitle;
  }

  return null;
}

export function buildDealQuotationConversionProducts(input: {
  deal?: DealProperties | null;
  products?: DealDocumentLineLike[] | null;
  resolveCatalogueRecord?: CatalogueRecordResolver;
}): PurchasedProductLike[] {
  const deal = input.deal;
  const products = input.products || [];
  if (!deal || !products.length) return products as PurchasedProductLike[];

  const selectableItems = getSelectableDealItems(
    deal.items,
    input.resolveCatalogueRecord,
  );
  const expandedProducts: PurchasedProductLike[] = [];

  products.forEach((product) => {
    const selectionKey = String(product.dealSelectionKey ?? "").trim();
    const isSpecificSelection = /^item-\d+-.+/i.test(selectionKey);

    if (product.billingPeriod || resolveStoredBillingPeriodKey(product) || isSpecificSelection) {
      expandedProducts.push(product as PurchasedProductLike);
      return;
    }

    const parentItem = resolveQuotationConversionParentItem(product, deal);

    if (!parentItem || !isDealPhaseOrPeriodItem(parentItem)) {
      expandedProducts.push(product as PurchasedProductLike);
      return;
    }

    const mode = resolveDealDocumentBillingModeForItem(parentItem);
    const parentSelectableItems = selectableItems.filter(
      (item) => String(item.id) === String(parentItem.id),
    );

    if (mode === "contractual-stage") {
      const phaseProducts = parentSelectableItems
        .filter((item) => item.catalogueType === "Phase")
        .flatMap((item) =>
          buildPurchasedProducts(
            [item],
            deal,
            null,
            null,
            null,
            input.resolveCatalogueRecord,
          ),
        );

      expandedProducts.push(...phaseProducts);
      return;
    }

    if (mode === "retainer-period" || mode === "recurrent-period") {
      const lineType =
        mode === "retainer-period"
          ? "Retainer Service Line"
          : "Recurrent Service Line";
      const periodType =
        mode === "retainer-period" ? "retainer" : "recurrent";
      const serviceLines = parentSelectableItems.filter(
        (item) => item.catalogueType === lineType,
      );
      const periods = buildDealTermBillingPeriods(parentItem, periodType);

      if (!serviceLines.length || !periods.length) {
        expandedProducts.push(product as PurchasedProductLike);
        return;
      }

      expandedProducts.push(
        ...periods.flatMap((period) =>
          buildPurchasedProducts(
            serviceLines,
            deal,
            period,
            null,
            null,
            input.resolveCatalogueRecord,
          ),
        ),
      );
      return;
    }

    expandedProducts.push(product as PurchasedProductLike);
  });

  return expandedProducts.length ? expandedProducts : products as PurchasedProductLike[];
}

const getConversionOptionTypeLabel = (
  kind: DealQuotationConversionOptionKind,
) => {
  if (kind === "phase") return "Phase";
  if (kind === "retainer-period") return "Retainer";
  if (kind === "recurrent-period") return "Recurrent";

  return "Item";
};

const getConversionProductPeriodLabel = (
  product: PurchasedProductLike,
  fallbackIndex: number,
) => {
  const period = cloneDealBillingPeriod(product.billingPeriod);
  if (period) return getDealBillingPeriodLabel(period);

  const periodKey = resolveStoredBillingPeriodKey(product);
  if (periodKey) return periodKey;

  return `Period ${fallbackIndex + 1}`;
};

const resolveConversionOptionKind = (
  product: PurchasedProductLike,
  deal?: DealProperties | null,
): DealQuotationConversionOptionKind => {
  const parentItem = deal
    ? resolveQuotationConversionParentItem(product, deal)
    : null;
  const parentMode = parentItem
    ? resolveDealDocumentBillingModeForItem(parentItem)
    : null;
  const selectionKey = String(product.dealSelectionKey ?? "").toLowerCase();
  const text = `${product.title ?? ""}\n${product.description ?? ""}`.toLowerCase();

  if (parentMode === "retainer-period" || selectionKey.includes("retainer")) {
    return "retainer-period";
  }

  if (
    parentMode === "recurrent-period" ||
    selectionKey.includes("recurrent") ||
    selectionKey.includes("reccurent")
  ) {
    return "recurrent-period";
  }

  if (
    parentMode === "contractual-stage" ||
    selectionKey.includes("phase") ||
    /\bphase\b/i.test(text)
  ) {
    return "phase";
  }

  return "item";
};

export function buildDealQuotationConversionOptions(input: {
  deal?: DealProperties | null;
  products?: DealDocumentLineLike[] | null;
  resolveCatalogueRecord?: CatalogueRecordResolver;
}): DealQuotationConversionOption[] {
  const products = buildDealQuotationConversionProducts(input);
  const options: DealQuotationConversionOption[] = [];
  const periodGroups = new Map<string, DealQuotationConversionOption>();

  products.forEach((product, index) => {
    const kind = resolveConversionOptionKind(product, input.deal);
    const title =
      String(product.title ?? "").trim() ||
      `${getConversionOptionTypeLabel(kind)} ${index + 1}`;
    const description = String(product.description ?? "").trim();
    const selectionKey = String(product.dealSelectionKey ?? "").trim();
    const baseKey = [
      kind,
      selectionKey,
      String(product.catalogueItemId ?? "").trim(),
      title,
    ]
      .filter(Boolean)
      .join(":");
    const periodKey = resolveStoredBillingPeriodKey(product);
    const isPeriodKind =
      kind === "retainer-period" || kind === "recurrent-period";

    if (isPeriodKind && periodKey) {
      const optionKey = baseKey || `${kind}:${index}`;
      let option = periodGroups.get(optionKey);

      if (!option) {
        option = {
          description,
          key: optionKey,
          kind,
          periods: [],
          product,
          title,
        };
        periodGroups.set(optionKey, option);
        options.push(option);
      }

      option.periods.push({
        key: periodKey,
        label: getConversionProductPeriodLabel(product, option.periods.length),
        product,
      });

      return;
    }

    options.push({
      description,
      key: baseKey || `${kind}:${index}`,
      kind,
      periods: [],
      product,
      title,
    });
  });

  return options;
}

function buildServiceLabel(deal: DealProperties) {
  return String(deal.code || deal.name || "Architectural services").trim();
}

function buildQuotationDraftRecord({
  contact,
  deal,
  financial,
  legal,
  nextId,
  resolveCatalogueRecord,
  selectedItems,
}: DealDocumentDraftContext): QuotationRecord {
  const purchasedProducts = buildPurchasedProducts(
    selectedItems,
    deal,
    null,
    null,
    null,
    resolveCatalogueRecord,
  );
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    note: buildQuotationNote(financial, 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: 0,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("quotation")}${nextId}`,
      quotationStatus: "Active",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

function buildProformaDraftRecord({
  billingPeriod,
  billingPeriodAssignments,
  billingPeriods,
  contact,
  deal,
  financial,
  legal,
  nextId,
  resolveCatalogueRecord,
  selectedItems,
}: DealDocumentDraftContext): ProformaRecord {
  const purchasedProducts = buildPurchasedProducts(
    selectedItems,
    deal,
    billingPeriod,
    billingPeriods,
    billingPeriodAssignments,
    resolveCatalogueRecord,
  );
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    convertedInvoiceId: null,
    note: buildProformaNote(financial, 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: total,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("proforma")}${nextId}`,
      quotationStatus: "Not Paid",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

function buildInvoiceDraftRecord({
  billingPeriod,
  billingPeriodAssignments,
  billingPeriods,
  contact,
  deal,
  financial,
  legal,
  nextId,
  resolveCatalogueRecord,
  selectedItems,
}: DealDocumentDraftContext): InvoiceRecord {
  const purchasedProducts = buildPurchasedProducts(
    selectedItems,
    deal,
    billingPeriod,
    billingPeriods,
    billingPeriodAssignments,
    resolveCatalogueRecord,
  );
  const total = getQuotationGrandTotal(purchasedProducts);

  return {
    approvalMode: "Automatic",
    approverEmployeeId: null,
    note: buildDocumentNote(financial, "invoice", 7),
    paymentDetails: buildQuotationPaymentDetails(total, legal, financial),
    paymentLink: null,
    paymentMethod: "Bank Transfer",
    payments: [],
    purchasedProducts,
    quotation: {
      attachmentFileKey: null,
      attachmentName: null,
      avatar: contact?.picture || "",
      balance: total,
      client: buildClient(contact),
      dealId: deal.id,
      dueDate: getDefaultDueDate(),
      id: nextId,
      isRevision: false,
      issuedDate: getTodayDate(),
      linkedRecordType: "deal",
      parentQuotationId: null,
      quoteNumber: `${getDocumentSequencePrefix("invoice")}${nextId}`,
      quotationStatus: "Not Paid",
      revisionLabel: null,
      service: buildServiceLabel(deal),
      source: "squarely",
      total,
    },
    salesperson: buildQuotationSalesperson(legal),
    showClientNote: financial?.invoicing?.showNotes ?? true,
    thanksNote: buildQuotationThanksNote(legal),
    totalFx: null,
  };
}

export function buildDealDocumentDraftRecord<TKind extends DealDocumentKind>(
  kind: TKind,
  context: DealDocumentDraftContext,
): DealDocumentDraftPayloadMap[TKind] {
  if (kind === "quotation") {
    return buildQuotationDraftRecord(
      context,
    ) as DealDocumentDraftPayloadMap[TKind];
  }

  if (kind === "proforma") {
    return buildProformaDraftRecord(
      context,
    ) as DealDocumentDraftPayloadMap[TKind];
  }

  return buildInvoiceDraftRecord(context) as DealDocumentDraftPayloadMap[TKind];
}

export function saveDealDocumentDraft<TKind extends DealDocumentKind>(
  kind: TKind,
  quotation: DealDocumentDraftPayloadMap[TKind],
) {
  if (typeof window === "undefined") return;

  const payload: DealDocumentDraftPayload<TKind> = {
    quotation,
    source: "deal",
  };

  sessionStorage.setItem(
    DEAL_DOCUMENT_DRAFT_KEYS[kind],
    JSON.stringify(payload),
  );
}

export function loadDealDocumentDraft<TKind extends DealDocumentKind>(
  kind: TKind,
): DealDocumentDraftPayload<TKind> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(DEAL_DOCUMENT_DRAFT_KEYS[kind]);
    if (!raw) return null;

    return JSON.parse(raw) as DealDocumentDraftPayload<TKind>;
  } catch {
    return null;
  }
}

export function clearDealDocumentDraft(kind: DealDocumentKind) {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(DEAL_DOCUMENT_DRAFT_KEYS[kind]);
}
