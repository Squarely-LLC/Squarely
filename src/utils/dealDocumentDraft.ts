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
    return formatCountLabel(record.phases.length, "phase", "phases");
  }

  if (record.type === "Retainer Service") {
    return formatCountLabel(
      record.retainerServices.length,
      "retainer service",
      "retainer services",
    );
  }

  if (record.type === "Reccurent Service") {
    return formatCountLabel(
      record.reccurentServices.length,
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
) {
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
  const expansionSummary = buildExpansionSummary(
    item,
    options.resolveCatalogueRecord,
  );

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
    hint: buildItemHint(item, expansionSummary, options.parentName),
    isAutoBillable: isAutoBillableDealItem(item),
    isBillableRoot: options.isRootReplacement || isBillableRootDealItem(item),
    isGenerated: options.isGenerated,
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

    return (retainer.retainerServices || []).map((service) => {
      const override = item.subItemOverrides?.[`retainer-${service.id}`] || {};

      return toSelectableItem(
        {
          ...item,
          catalogueType: "Retainer Service Line",
          discountPercent: override.discountPercent ?? 0,
          name: override.name ?? service.name,
          note: override.note ?? service.description ?? item.note ?? null,
          quantity: override.quantity ?? service.qty ?? item.quantity,
          unitPrice: override.unitPrice ?? item.unitPrice ?? null,
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
          selectionKeySuffix: `retainer-${service.id}`,
        },
      );
    });
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;

    return (recurrent.reccurentServices || []).map((service) => {
      const override = item.subItemOverrides?.[`recurrent-${service.id}`] || {};

      return toSelectableItem(
        {
          ...item,
          catalogueType: "Recurrent Service Line",
          discountPercent: override.discountPercent ?? 0,
          name: override.name ?? service.name,
          note: override.note ?? service.description ?? item.note ?? null,
          quantity: override.quantity ?? item.quantity,
          unitPrice: override.unitPrice ?? item.unitPrice ?? null,
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
          selectionKeySuffix: `recurrent-${service.id}`,
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
  return (items || [])
    .filter((item) => !item.parentItemId)
    .map((item) =>
      toSelectableItem(item, {
        isGenerated: false,
        parentName: null,
        resolveCatalogueRecord,
      }),
    );
}

function buildDistributedCost(totalCost: number, count: number, index: number) {
  if (count <= 0) return 0;
  if (count === 1) return normalizeLineCost(totalCost);

  const safeTotal = normalizeLineCost(totalCost);
  const baseShare = Number((safeTotal / count).toFixed(2));

  if (index < count - 1) return baseShare;

  return Number((safeTotal - baseShare * (count - 1)).toFixed(2));
}

function appendBillingPeriodLabel(
  value: string | null | undefined,
  billingPeriod?: DealBillingPeriod | null,
) {
  const label = getDealBillingPeriodLabel(billingPeriod);
  if (!label) return value?.trim() || "";

  const base = value?.trim();

  return base
    ? `${base}\nBilling Period: ${label}`
    : `Billing Period: ${label}`;
}

function resolvePeriodUnitPrice(
  unitPrices: Record<string, number | null> | null | undefined,
  billingPeriod?: DealBillingPeriod | null,
) {
  const billingPeriodKey = getDealBillingPeriodKey(billingPeriod);
  if (!billingPeriodKey || !unitPrices) return null;

  const value = unitPrices[billingPeriodKey];
  if (value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
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

function buildQuotationChildSummary(
  item: DealDocumentSelectableItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (
    item.catalogueType === "Contractual Service" &&
    item.catalogueItemId &&
    resolveCatalogueRecord
  ) {
    const record = resolveCatalogueRecord(
      item.catalogueItemId,
      item.catalogueType || undefined,
    );
    if (record?.type === "Contractual Service") {
      const phases = getDealContractualPhaseLines(item, record)
        .map((phase) => phase.name.trim())
        .filter(Boolean);

      if (phases.length) return phases.join("\n");
    }
  }

  if (item.catalogueItemId && resolveCatalogueRecord) {
    const record = resolveCatalogueRecord(
      item.catalogueItemId,
      item.catalogueType || undefined,
    );

    if (record?.type === "Retainer Service") {
      const lines = (record.retainerServices || [])
        .map((service) => {
          const override =
            item.subItemOverrides?.[`retainer-${service.id}`] || {};
          return String(override.name ?? service.name).trim();
        })
        .filter(Boolean);

      if (lines.length) return lines.join("\n");
    }

    if (record?.type === "Reccurent Service") {
      const lines = (record.reccurentServices || [])
        .map((service) => {
          const override =
            item.subItemOverrides?.[`recurrent-${service.id}`] || {};
          return String(override.name ?? service.name).trim();
        })
        .filter(Boolean);

      if (lines.length) return lines.join("\n");
    }

    if (record?.type === "Onetime Service") {
      const excluded = new Set(item.excludedRelatedItemIds || []);
      const related = (record.relatedItems || [])
        .filter((relatedItem) => !excluded.has(Number(relatedItem.id)))
        .map((relatedItem) => {
          const override =
            item.subItemOverrides?.[`related-${relatedItem.id}`] || {};
          return String(override.name ?? relatedItem.name).trim();
        })
        .filter(Boolean);

      if (related.length) return related.join("\n");
    }
  }

  return "";
}

function buildQuotationDescription(
  item: DealDocumentSelectableItem,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const baseDescription = item.note?.trim() || item.category?.trim() || "";
  const childSummary = buildQuotationChildSummary(item, resolveCatalogueRecord);

  if (baseDescription && childSummary)
    return `${baseDescription}\n\n${childSummary}`;
  if (childSummary) return childSummary;

  return baseDescription;
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
    description: isPeriodBasedLine
      ? appendBillingPeriodLabel(
          item.note?.trim() || item.category?.trim() || "",
          billingPeriod,
        )
      : item.note?.trim() || item.category?.trim() || "",
    discountPercent: item.discountPercent ?? 0,
    hours: item.quantity,
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
      description:
        phase.note ?? item.note ?? record.description ?? item.category ?? "",
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
  const services = record.retainerServices || [];
  const billingPeriodKey = getDealBillingPeriodKey(billingPeriod);
  const totalCost = normalizeLineCost(item.unitPrice ?? record.bestPrice ?? 0);

  return services.map((service, index) => {
    const override = item.subItemOverrides?.[`retainer-${service.id}`] || {};
    const periodUnitPrice = resolvePeriodUnitPrice(
      override.periodUnitPrices,
      billingPeriod,
    );

    return createPurchasedProduct({
      billingPeriod: billingPeriod ?? null,
      billingPeriodKey: billingPeriodKey || null,
      catalogueItemId: item.catalogueItemId ?? null,
      dealSelectionKey: item.selectionKey.endsWith(`retainer-${service.id}`)
        ? item.selectionKey
        : `item-${item.id}-retainer-${service.id}`,
      cost:
        periodUnitPrice ??
        override.unitPrice ??
        buildDistributedCost(totalCost, services.length, index),
      description: appendBillingPeriodLabel(
        override.note ?? service.description ?? item.note ?? record.description,
        billingPeriod,
      ),
      discountPercent: override.discountPercent ?? 0,
      hours: override.quantity ?? service.qty ?? item.quantity,
      lineConstraints: {
        discount: false,
        price: false,
      },
      title: override.name ?? service.name,
    });
  });
}

function buildRecurrentProducts(
  item: DealDocumentSelectableItem,
  record: CatalogueReccurentServiceRecord,
  billingPeriod?: DealBillingPeriod | null,
) {
  const services = record.reccurentServices || [];
  const billingPeriodKey = getDealBillingPeriodKey(billingPeriod);
  const totalCost = normalizeLineCost(item.unitPrice ?? record.bestPrice ?? 0);

  return services.map((service, index) => {
    const override = item.subItemOverrides?.[`recurrent-${service.id}`] || {};
    const periodUnitPrice = resolvePeriodUnitPrice(
      override.periodUnitPrices,
      billingPeriod,
    );

    return createPurchasedProduct({
      billingPeriod: billingPeriod ?? null,
      billingPeriodKey: billingPeriodKey || null,
      catalogueItemId: item.catalogueItemId ?? null,
      dealSelectionKey: item.selectionKey.endsWith(`recurrent-${service.id}`)
        ? item.selectionKey
        : `item-${item.id}-recurrent-${service.id}`,
      cost:
        periodUnitPrice ??
        override.unitPrice ??
        buildDistributedCost(totalCost, services.length, index),
      description: appendBillingPeriodLabel(
        override.note ?? service.description ?? item.note ?? record.description,
        billingPeriod,
      ),
      discountPercent: override.discountPercent ?? 0,
      hours: override.quantity ?? item.quantity,
      lineConstraints: {
        discount: false,
        price: false,
        quantity: false,
      },
      title: override.name ?? service.name,
    });
  });
}

function expandDealItemToPurchasedProducts(
  item: DealDocumentSelectableItem,
  billingPeriod?: DealBillingPeriod | null,
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
    return buildRetainerProducts(item, record, billingPeriod);
  }
  if (record.type === "Reccurent Service") {
    return buildRecurrentProducts(item, record, billingPeriod);
  }

  return [buildStandardPurchasedProduct(item, billingPeriod)];
}

function buildPurchasedProducts(
  items: DealDocumentSelectableItem[],
  billingPeriod?: DealBillingPeriod | null,
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const purchasedProducts = items.flatMap((item) =>
    expandDealItemToPurchasedProducts(
      item,
      billingPeriod,
      resolveCatalogueRecord,
    ),
  );

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
  const purchasedProducts = selectedItems.length
    ? selectedItems.map((item) =>
        createPurchasedProduct({
          catalogueItemId: item.catalogueItemId ?? null,
          cost: item.unitPrice ?? 0,
          description: buildQuotationDescription(item, resolveCatalogueRecord),
          discountPercent: item.discountPercent ?? 0,
          hours: item.quantity,
          lineConstraints: item.lineConstraintsOverride,
          title: item.name,
        }),
      )
    : [
        createPurchasedProduct({
          catalogueItemId: null,
          cost: 0,
          description: "",
          discountPercent: 0,
          hours: 1,
          title: "",
        }),
      ];
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
      quotationStatus: "Pending",
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
    billingPeriod,
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
    billingPeriod,
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
