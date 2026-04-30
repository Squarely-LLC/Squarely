import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type {
  InvoiceRecord,
  PurchasedProduct as InvoicePurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/invoice/types";
import type {
  ProformaRecord,
  PurchasedProduct as ProformaPurchasedProduct,
} from "@/plugins/fake-api/handlers/apps/proforma/types";
import type {
  CatalogueContractualServiceRecord,
  CatalogueOnetimeServiceRecord,
  CatalogueReccurentServiceRecord,
  CatalogueRecord,
  CatalogueRetainerServiceRecord,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  Client,
  PurchasedProduct as QuotationPurchasedProduct,
  QuotationRecord,
} from "@/plugins/fake-api/handlers/apps/quotation/types";
import type {
  FinancialConfig,
  LegalConfig,
} from "@/plugins/fake-api/handlers/config/types";
import type {
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
  "Related Item",
]);

type PurchasedProductLike =
  | QuotationPurchasedProduct
  | ProformaPurchasedProduct
  | InvoicePurchasedProduct;

export type DealDocumentKind = keyof typeof DEAL_DOCUMENT_DRAFT_KEYS;
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

export interface DealDocumentDraftContext {
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

    return (contractual.phases || []).map((phase) => {
      const override = item.subItemOverrides?.[`phase-${phase.id}`] || {};

      return toSelectableItem(
        {
          ...item,
          catalogueType: "Phase",
          discountPercent: override.discountPercent ?? 0,
          name: override.name ?? phase.name,
          note: override.note ?? item.note ?? record.description ?? null,
          quantity: override.quantity ?? item.quantity,
          unitPrice: override.unitPrice ?? phase.price ?? null,
        },
        {
          isGenerated: false,
          isRootReplacement: true,
          parentName: item.name,
          resolveCatalogueRecord,
          selectionKeySuffix: `phase-${phase.id}`,
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

function createPurchasedProduct(input: {
  catalogueItemId?: string | null;
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

  return {
    catalogueItemId: input.catalogueItemId ?? null,
    cost: normalizeLineCost(input.cost),
    description: input.description?.trim() || "",
    discountType: discountValue > 0 ? "percent" : "none",
    discountValue,
    hours: normalizeLineQuantity(input.hours, 1),
    lineConstraints: input.lineConstraints || undefined,
    title: input.title,
  };
}

function buildStandardPurchasedProduct(item: DealDocumentSelectableItem) {
  return createPurchasedProduct({
    catalogueItemId: item.catalogueItemId ?? null,
    cost: item.unitPrice ?? 0,
    description: item.note?.trim() || item.category?.trim() || "",
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
  return (record.phases || []).map((phase) => {
    const override = item.subItemOverrides?.[`phase-${phase.id}`] || {};

    return createPurchasedProduct({
      catalogueItemId: item.catalogueItemId ?? null,
      cost: override.unitPrice ?? phase.price ?? 0,
      description:
        override.note ?? item.note ?? record.description ?? item.category ?? "",
      discountPercent: override.discountPercent ?? 0,
      hours: override.quantity ?? item.quantity,
      title: override.name ?? phase.name,
    });
  });
}

function buildRetainerProducts(
  item: DealDocumentSelectableItem,
  record: CatalogueRetainerServiceRecord,
) {
  const services = record.retainerServices || [];
  const totalCost = normalizeLineCost(item.unitPrice ?? record.bestPrice ?? 0);

  return services.map((service, index) => {
    const override = item.subItemOverrides?.[`retainer-${service.id}`] || {};

    return createPurchasedProduct({
      catalogueItemId: item.catalogueItemId ?? null,
      cost:
        override.unitPrice ??
        buildDistributedCost(totalCost, services.length, index),
      description:
        override.note ?? service.description ?? item.note ?? record.description,
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
) {
  const services = record.reccurentServices || [];
  const totalCost = normalizeLineCost(item.unitPrice ?? record.bestPrice ?? 0);

  return services.map((service, index) => {
    const override = item.subItemOverrides?.[`recurrent-${service.id}`] || {};

    return createPurchasedProduct({
      catalogueItemId: item.catalogueItemId ?? null,
      cost:
        override.unitPrice ??
        buildDistributedCost(totalCost, services.length, index),
      description:
        override.note ?? service.description ?? item.note ?? record.description,
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
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  if (
    item.catalogueType === "Related Item" ||
    item.catalogueType === "Phase" ||
    item.catalogueType === "Retainer Service Line" ||
    item.catalogueType === "Recurrent Service Line"
  ) {
    return [buildStandardPurchasedProduct(item)];
  }

  if (!item.catalogueItemId || !resolveCatalogueRecord) {
    return [buildStandardPurchasedProduct(item)];
  }

  const record = resolveCatalogueRecord(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  if (!record) return [buildStandardPurchasedProduct(item)];
  if (record.type === "Contractual Service") {
    return buildContractualProducts(item, record);
  }
  if (record.type === "Retainer Service") {
    return buildRetainerProducts(item, record);
  }
  if (record.type === "Reccurent Service") {
    return buildRecurrentProducts(item, record);
  }

  return [buildStandardPurchasedProduct(item)];
}

function buildPurchasedProducts(
  items: DealDocumentSelectableItem[],
  resolveCatalogueRecord?: CatalogueRecordResolver,
) {
  const purchasedProducts = items.flatMap((item) =>
    expandDealItemToPurchasedProducts(item, resolveCatalogueRecord),
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
    ? selectedItems.map((item) => buildStandardPurchasedProduct(item))
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
