<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { Status, ToDo } from "@/data/schema";
import type { InvoiceStatus } from "@/plugins/fake-api/handlers/apps/invoice/types";
import type { ProformaStatus } from "@/plugins/fake-api/handlers/apps/proforma/types";
import type { QuotationStatus } from "@/plugins/fake-api/handlers/apps/quotation/types";
import type {
  CatalogueActiveState,
  CatalogueContractualServiceRecord,
  CatalogueItem,
  CatalogueItemType,
  CatalogueOnetimeServiceRecord,
  CatalogueProducedProductRecord,
  CatalogueProductRecord,
  CatalogueReccurentServiceRecord,
  CatalogueRetainerServiceRecord,
  CatalogueSalesTask,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealBillingPeriod,
  DealCustomPhase,
  DealItem,
  DealItemOverride,
  DealProperties,
  DealSalesTaskTemplate,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import { useTodos } from "@/stores/todos";
import {
  type DealDocumentBillingMode,
  type DealDocumentKind,
  type DealDocumentSelectableItem,
  buildCustomBillingPeriod,
  buildDealDocumentDraftRecord,
  buildDealDocumentUsageKey,
  buildMonthlyBillingPeriod,
  buildQuarterlyBillingPeriod,
  buildYearlyBillingPeriod,
  filterDealDocumentItemsByBillingMode,
  getBillableRootDealItems,
  getDealBillingPeriodKey,
  getDealBillingPeriodLabel,
  getDealBillingPeriodMonthValue,
  getDealContractualPhaseLines,
  getDealRecurrentServiceLines,
  getDealRetainerServiceLines,
  getQuotationTopLevelDealItems,
  getSelectableDealItems,
  resolveDealDocumentBillingMode,
  resolveDealDocumentBillingModeForItem,
  resolveStoredBillingPeriodKey,
  saveDealDocumentDraft,
} from "@/utils/dealDocumentDraft";
import {} from "@/utils/dealValue";
import { saveFile } from "@/utils/fileStore";
import {
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
} from "@/utils/quotationConfig";
import { computed, nextTick, reactive, ref } from "vue";
import type { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  deal: DealProperties;
}>();

const emit = defineEmits<{
  (e: "open-add-task", payload: { initial: Partial<ToDo> }): void;
  (e: "open-edit-task", todoId: number | string): void;
  (e: "delete-task", todoId: number | string): void;
}>();

const router = useRouter();
const cataloguesStore = useCataloguesStore();
const configStore = useConfigStore();
const contactsStore = useContactsStore();
const dealsStore = useDealsStore();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();

cataloguesStore.init();
configStore.init();
contactsStore.init();
dealsStore.init();
quotationsStore.init();
proformasStore.init();
invoicesStore.init();
todosStore.init();

interface DerivedGoal {
  id: string;
  overrideKey: string;
  name: string;
  category: string | null;
  note: string | null;
  phaseNumber?: number | null;
  price: number | null;
  typeLabel: string;
  quantity: number | null;
  discountPercent: number | null;
  discountLabel: string | null;
  taxApplicable: boolean | null;
  showQuantity: boolean;
  showPrice: boolean;
  showDiscount: boolean;
  showTaxApplicable: boolean;
}

interface DerivedSection {
  id: string;
  name: string;
  note: string | null;
  price: number | null;
  billingPeriod?: DealBillingPeriod | null;
  goals: DerivedGoal[];
  goalTypeSingular: string;
  goalTypePlural: string;
}

type DealItemWithPlan = DealItem & {
  panelId: number | string;
  isExpandable: boolean;
  derivedSections: DerivedSection[];
  childTypeSingular: string;
  childTypePlural: string;
  childCount: number;
  actionsEnabled: boolean;
};

interface ItemTypeChoice {
  title: string;
  value: CatalogueItemType;
  description: string;
  icon: string;
  comingSoon?: boolean;
}

type DealPreviewKind = "quotation" | "proforma" | "invoice";

interface DealDocumentContainer {
  quotation: {
    id: number | string;
    quoteNumber: string;
    issuedDate: string;
    dueDate: string;
    total: number;
    quotationStatus: string;
    dealId: number | null;
  };
}

interface DealDocumentPanelRecord {
  id: number | string;
  issuedDate: string;
  quoteNumber: string;
  status: string;
  total: number;
}

interface DealDocumentPanel {
  count: number;
  emptyText: string;
  key: DealPreviewKind;
  latest: DealDocumentPanelRecord | null;
  records: DealDocumentPanelRecord[];
  title: string;
}

type ExternalDealDocumentStatus =
  | InvoiceStatus
  | ProformaStatus
  | QuotationStatus;

interface ExternalDealDocumentForm {
  attachment: File | File[] | null;
  amount: number | null;
  date: string | null;
  paidAmount: number | null;
  quoteNumber: string;
  status: ExternalDealDocumentStatus | null;
}

const addItemDialogVisible = ref(false);
const billingModeDialogVisible = ref(false);
const billingPeriodDialogVisible = ref(false);
const createItemTypeDialogVisible = ref(false);
const createDraftItemDialogVisible = ref(false);
const editLineDialogVisible = ref(false);
const phaseDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const selectionDialogVisible = ref(false);
const externalDocumentDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const phaseFormRef = ref<VForm>();
const createDraftItemFormRef = ref<VForm>();
const editLineFormRef = ref<VForm>();
const externalDocumentFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const selectedBillingMode = ref<DealDocumentBillingMode | null>(null);
const selectedCatalogueItemId = ref<string | null>(null);
const selectedCreateItemType = ref<CatalogueItemType | null>(null);
const selectedDocumentKind = ref<DealDocumentKind | null>(null);
const selectedExternalDocumentKind = ref<DealPreviewKind | null>(null);
const selectedExternalDocumentItems = ref<DealDocumentSelectableItem[]>([]);
const selectedExternalDocumentBillingPeriod = ref<DealBillingPeriod | null>(
  null,
);
const externalDocumentSelectionKind = ref<Extract<
  DealPreviewKind,
  "proforma" | "invoice"
> | null>(null);
const selectedItemIds = ref<string[]>([]);
const selectedDocumentParentItemId = ref<string | null>(null);

const selectedPreviewDocument = ref<{
  href: string;
  id: number | string;
  kind: DealPreviewKind;
  title: string;
} | null>(null);

const isItemsOverviewCollapsed = ref(true);
const activeDocumentPanelKey = ref<DealPreviewKind | null>(null);
const pendingDocumentItems = ref<DealDocumentSelectableItem[]>([]);
const billingPeriodPrices = reactive<Record<string, number>>({});
const billingPeriod = ref<DealBillingPeriod>(buildMonthlyBillingPeriod());

const billingPeriodKind = ref<DealBillingPeriod["kind"]>(
  billingPeriod.value.kind,
);

const billingPeriodMonthValue = ref(
  getDealBillingPeriodMonthValue(billingPeriod.value),
);

const defaultBillingYearValue = () => String(new Date().getFullYear());

const defaultBillingQuarterValue = () => {
  const today = new Date();

  return `Q${Math.floor(today.getMonth() / 3) + 1}`;
};

const defaultBillingCustomDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const billingPeriodQuarterYearValue = ref(defaultBillingYearValue());
const billingPeriodQuarterValue = ref(defaultBillingQuarterValue());
const billingPeriodYearValue = ref(defaultBillingYearValue());
const billingPeriodCustomStartDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomEndDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomLabel = ref("");
const selectedRetainerBillingPeriodKey = ref<string | null>(null);
const selectedRecurrentBillingPeriodKeys = ref<string[]>([]);

interface PendingBillingPeriodGroup {
  items: DealDocumentSelectableItem[];
  mode: Extract<
    DealDocumentBillingMode,
    "retainer-period" | "recurrent-period"
  >;
  parentItemId: string;
}

const pendingBillingPeriodGroups = ref<PendingBillingPeriodGroup[]>([]);
const activeBillingPeriodGroupIndex = ref(0);
const billingPeriodAssignments = reactive<Record<string, DealBillingPeriod[]>>(
  {},
);

const billingPeriodKindOptions = [
  { title: "Month", value: "monthly" },
  { title: "Quarter", value: "quarterly" },
  { title: "Year", value: "yearly" },
  { title: "Custom", value: "custom" },
] as const;

const billingQuarterOptions = [
  { title: "Q1", value: "Q1" },
  { title: "Q2", value: "Q2" },
  { title: "Q3", value: "Q3" },
  { title: "Q4", value: "Q4" },
] as const;

const isExternalDocumentFormValid = ref(false);
const externalDocumentError = ref("");

const allowedExternalAttachmentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

const allowedExternalAttachmentExtensions = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
];

const externalAttachmentAccept = allowedExternalAttachmentExtensions.join(",");
const maxExternalAttachmentSizeBytes = 10 * 1024 * 1024;

const getExternalDocumentDefaultStatus = (
  kind: DealPreviewKind | null,
): ExternalDealDocumentStatus | null => {
  if (kind === "quotation") return "Pending";
  if (kind === "proforma" || kind === "invoice") return "Not Paid";

  return null;
};

const emptyExternalDocumentForm = (
  kind: DealPreviewKind | null = selectedExternalDocumentKind.value,
): ExternalDealDocumentForm => ({
  attachment: null,
  amount: null,
  date: null,
  paidAmount: null,
  quoteNumber: "",
  status: getExternalDocumentDefaultStatus(kind),
});

const externalDocumentForm = ref<ExternalDealDocumentForm>(
  emptyExternalDocumentForm(),
);

const syncBillingPeriodDraft = (
  period: DealBillingPeriod = billingPeriod.value,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  const startDate = String(period.startDate || defaultBillingCustomDateValue());
  const endDate = String(period.endDate || startDate);
  const quarterMatch = periodKey.match(/^(\d{4})-q([1-4])$/);
  const yearMatch = periodKey.match(/^(\d{4})$/);
  const startDateMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fallbackYear = startDateMatch?.[1] || defaultBillingYearValue();

  const fallbackQuarter = startDateMatch
    ? `Q${Math.floor((Number(startDateMatch[2]) - 1) / 3) + 1}`
    : defaultBillingQuarterValue();

  billingPeriodKind.value = period.kind;
  billingPeriodMonthValue.value = getDealBillingPeriodMonthValue(period);
  billingPeriodQuarterYearValue.value = quarterMatch?.[1] || fallbackYear;
  billingPeriodQuarterValue.value = quarterMatch
    ? `Q${quarterMatch[2]}`
    : fallbackQuarter;
  billingPeriodYearValue.value = yearMatch?.[1] || fallbackYear;
  billingPeriodCustomStartDate.value = startDate;
  billingPeriodCustomEndDate.value = endDate;
  billingPeriodCustomLabel.value =
    period.kind === "custom" ? getDealBillingPeriodLabel(period) : "";
};

const billingPeriodPreview = computed<DealBillingPeriod | null>(() => {
  if (isRetainerBillingPeriodSelection.value) {
    if (isMultiPeriodBillingSelection.value) {
      return (
        availableRetainerBillingPeriods.value.find((period) =>
          selectedRecurrentBillingPeriodKeys.value.includes(period.key),
        ) || null
      );
    }

    return (
      availableRetainerBillingPeriods.value.find(
        (period) => period.key === selectedRetainerBillingPeriodKey.value,
      ) ||
      availableRetainerBillingPeriods.value[0] ||
      null
    );
  }

  if (billingPeriodKind.value === "quarterly") {
    return buildQuarterlyBillingPeriod(
      `${billingPeriodQuarterYearValue.value}-${billingPeriodQuarterValue.value}`,
    );
  }

  if (billingPeriodKind.value === "yearly")
    return buildYearlyBillingPeriod(billingPeriodYearValue.value);

  if (billingPeriodKind.value === "custom") {
    return buildCustomBillingPeriod({
      endDate: billingPeriodCustomEndDate.value,
      label: billingPeriodCustomLabel.value,
      startDate: billingPeriodCustomStartDate.value,
    });
  }

  return buildMonthlyBillingPeriod(billingPeriodMonthValue.value);
});

syncBillingPeriodDraft();

const commitBillingPeriod = () => {
  if (isRetainerBillingPeriodSelection.value) {
    const selectedPeriod = billingPeriodPreview.value;
    if (!selectedPeriod) return null;

    billingPeriod.value = selectedPeriod;

    return billingPeriod.value;
  }

  const nextPeriod = billingPeriodPreview.value;
  if (!nextPeriod) return null;

  billingPeriod.value = nextPeriod;
  syncBillingPeriodDraft(billingPeriod.value);

  return billingPeriod.value;
};

const commitBillingPeriods = () => {
  if (!isMultiPeriodBillingSelection.value) {
    const nextPeriod = commitBillingPeriod();

    return nextPeriod ? [nextPeriod] : [];
  }

  const selectedPeriods = availableRetainerBillingPeriods.value.filter(
    (period) => selectedRecurrentBillingPeriodKeys.value.includes(period.key),
  );

  if (!selectedPeriods.length) return [] as DealBillingPeriod[];

  billingPeriod.value = selectedPeriods[0];
  syncBillingPeriodDraft(billingPeriod.value);

  return selectedPeriods;
};

const formatIsoDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const defaultRetainerStartDate = () => {
  const date = new Date();

  date.setDate(1);

  return formatIsoDateValue(date);
};

const defaultRetainerEndDate = () => {
  const startDate = new Date(defaultRetainerStartDate());

  return formatIsoDateValue(
    new Date(startDate.getFullYear(), startDate.getMonth() + 12, 0),
  );
};

const parseIsoDateValue = (value?: string | null) => {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, monthIndex, day);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const formatBillingPeriodOptionLabel = (
  periodNumber: number,
  startDate: string,
  endDate: string,
) => {
  const parsedStartDate = parseIsoDateValue(startDate);
  const parsedEndDate = parseIsoDateValue(endDate);

  if (!parsedStartDate || !parsedEndDate) return `Period ${periodNumber}`;

  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `Period ${periodNumber} · ${formatter.format(parsedStartDate)} - ${formatter.format(parsedEndDate)}`;
};

const buildRetainerBillingPeriods = (item?: DealItem | null) => {
  const parsedStartDate = parseIsoDateValue(item?.retainerStartDate);
  const parsedEndDate = parseIsoDateValue(item?.retainerEndDate);
  const totalPeriods = Number(item?.retainerPeriods ?? 0);

  if (!parsedStartDate || !parsedEndDate || parsedEndDate < parsedStartDate)
    return [] as DealBillingPeriod[];
  if (!Number.isInteger(totalPeriods) || totalPeriods <= 0)
    return [] as DealBillingPeriod[];

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
    const normalizedStartDate = formatIsoDateValue(periodStartDate);
    const normalizedEndDate = formatIsoDateValue(periodEndDate);

    return buildCustomBillingPeriod({
      endDate: normalizedEndDate,
      key: `retainer:${item?.id ?? "item"}:period:${index + 1}`,
      label: formatBillingPeriodOptionLabel(
        index + 1,
        normalizedStartDate,
        normalizedEndDate,
      ),
      startDate: normalizedStartDate,
    });
  });
};

const buildRecurrentBillingPeriods = (item?: DealItem | null) => {
  const parsedStartDate = parseIsoDateValue(item?.recurrentStartDate);
  const parsedEndDate = parseIsoDateValue(item?.recurrentEndDate);
  const totalPeriods = Number(item?.recurrentPeriods ?? 0);

  if (!parsedStartDate || !parsedEndDate || parsedEndDate < parsedStartDate)
    return [] as DealBillingPeriod[];
  if (!Number.isInteger(totalPeriods) || totalPeriods <= 0)
    return [] as DealBillingPeriod[];

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
    const normalizedStartDate = formatIsoDateValue(periodStartDate);
    const normalizedEndDate = formatIsoDateValue(periodEndDate);

    return buildCustomBillingPeriod({
      endDate: normalizedEndDate,
      key: `recurrent:${item?.id ?? "item"}:period:${index + 1}`,
      label: formatBillingPeriodOptionLabel(
        index + 1,
        normalizedStartDate,
        normalizedEndDate,
      ),
      startDate: normalizedStartDate,
    });
  });
};

const calculateRetainerBillablePeriods = (
  startDate?: string | null,
  endDate?: string | null,
  periods?: number | string | null,
) => {
  const parsedStartDate = parseIsoDateValue(startDate);
  const parsedEndDate = parseIsoDateValue(endDate);
  const normalizedPeriods = Number(periods);

  if (
    !parsedStartDate ||
    !parsedEndDate ||
    Number.isNaN(normalizedPeriods) ||
    !Number.isInteger(normalizedPeriods) ||
    normalizedPeriods <= 0
  ) {
    return null;
  }

  if (parsedEndDate < parsedStartDate) return null;

  return normalizedPeriods;
};

const isRetainerCatalogueType = (type?: string | null) =>
  type === "Retainer Service";

const isRecurrentCatalogueType = (type?: string | null) =>
  type === "Reccurent Service";

const buildRetainerTermPayload = (input: {
  endDate?: string | null;
  periods?: number | string | null;
  startDate?: string | null;
}) => {
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  const periods = Number(input.periods);
  const billablePeriods = calculateRetainerBillablePeriods(
    startDate,
    endDate,
    periods,
  );

  if (!startDate || !endDate || !Number.isInteger(periods) || periods <= 0)
    return null;
  if (billablePeriods === null) return null;

  return {
    retainerBillablePeriods: billablePeriods,
    retainerEndDate: endDate,
    retainerPeriods: periods,
    retainerStartDate: startDate,
  } satisfies Pick<
    DealItem,
    | "retainerBillablePeriods"
    | "retainerEndDate"
    | "retainerPeriods"
    | "retainerStartDate"
  >;
};

const buildRecurrentTermPayload = (input: {
  endDate?: string | null;
  periods?: number | string | null;
  startDate?: string | null;
}) => {
  const startDate = String(input.startDate ?? "").trim();
  const endDate = String(input.endDate ?? "").trim();
  const periods = Number(input.periods);
  const billablePeriods = calculateRetainerBillablePeriods(
    startDate,
    endDate,
    periods,
  );

  if (!startDate || !endDate || !Number.isInteger(periods) || periods <= 0)
    return null;
  if (billablePeriods === null) return null;

  return {
    recurrentBillablePeriods: billablePeriods,
    recurrentEndDate: endDate,
    recurrentPeriods: periods,
    recurrentStartDate: startDate,
  } satisfies Pick<
    DealItem,
    | "recurrentBillablePeriods"
    | "recurrentEndDate"
    | "recurrentPeriods"
    | "recurrentStartDate"
  >;
};

const positiveWholeNumberValidator = (value: unknown) => {
  const numeric = Number(value);

  return Number.isInteger(numeric) && numeric > 0
    ? true
    : "Enter a whole number greater than 0";
};

const retainerEndDateValidator = (
  value: unknown,
  startDate?: string | null,
) => {
  const parsedStartDate = parseIsoDateValue(startDate);
  const parsedEndDate = parseIsoDateValue(String(value ?? ""));

  if (!parsedEndDate) return "Choose an end date";
  if (!parsedStartDate) return "Choose a start date first";

  return parsedEndDate >= parsedStartDate
    ? true
    : "End date must be on or after the start date";
};

const addItemDraft = reactive({
  quantity: 1,
  recurrentEndDate: defaultRetainerEndDate(),
  recurrentPeriods: 12,
  recurrentStartDate: defaultRetainerStartDate(),
  retainerEndDate: defaultRetainerEndDate(),
  retainerPeriods: 12,
  retainerStartDate: defaultRetainerStartDate(),
});

const createDraftItem = reactive({
  name: "",
  quantity: 1,
  price: 0,
  discountPercent: 0,
  taxApplicable: true,
  note: "",
  recurrentEndDate: defaultRetainerEndDate(),
  recurrentPeriods: 12,
  recurrentStartDate: defaultRetainerStartDate(),
  retainerEndDate: defaultRetainerEndDate(),
  retainerPeriods: 12,
  retainerStartDate: defaultRetainerStartDate(),
});

const addItemRequiresRetainerTerm = computed(() =>
  isRetainerCatalogueType(selectedCatalogueRecord.value?.type),
);

const addItemRequiresRecurrentTerm = computed(() =>
  isRecurrentCatalogueType(selectedCatalogueRecord.value?.type),
);

const createDraftItemRequiresRetainerTerm = computed(
  () => selectedCreateItemType.value === "Retainer Service",
);

const createDraftItemRequiresRecurrentTerm = computed(
  () => selectedCreateItemType.value === "Reccurent Service",
);

const addItemBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    addItemDraft.retainerStartDate,
    addItemDraft.retainerEndDate,
    addItemDraft.retainerPeriods,
  ),
);

const addItemRecurrentBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    addItemDraft.recurrentStartDate,
    addItemDraft.recurrentEndDate,
    addItemDraft.recurrentPeriods,
  ),
);

const createDraftItemBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    createDraftItem.retainerStartDate,
    createDraftItem.retainerEndDate,
    createDraftItem.retainerPeriods,
  ),
);

const createDraftItemRecurrentBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    createDraftItem.recurrentStartDate,
    createDraftItem.recurrentEndDate,
    createDraftItem.recurrentPeriods,
  ),
);

const resolvePeriodDrivenItemQuantity = (periods?: number | string | null) => {
  const quantity = Number(periods);

  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
};

const addItemUsesPeriodQuantity = computed(
  () => addItemRequiresRecurrentTerm.value || addItemRequiresRetainerTerm.value,
);

const createDraftItemUsesPeriodQuantity = computed(
  () =>
    createDraftItemRequiresRecurrentTerm.value ||
    createDraftItemRequiresRetainerTerm.value,
);

const editLine = reactive({
  mode: "item" as "item" | "sub",
  itemId: null as number | null,
  parentItemId: null as number | null,
  overrideKey: "",
  title: "",
  name: "",
  category: "",
  quantity: 1 as number | null,
  unitPrice: 0 as number | null,
  discountPercent: 0 as number | null,
  taxApplicable: null as boolean | null,
  note: "",
  canEditQuantity: true,
  canEditPrice: true,
  canEditDiscount: true,
  canEditTax: true,
  canEditInfo: true,
  recurrentStartDate: defaultRetainerStartDate(),
  recurrentEndDate: defaultRetainerEndDate(),
  recurrentPeriods: 12 as number | null,
  retainerStartDate: defaultRetainerStartDate(),
  retainerEndDate: defaultRetainerEndDate(),
  retainerPeriods: 12 as number | null,
});

const editLineRequiresRetainerTerm = computed(() => {
  if (editLine.mode !== "item") return false;

  return isRetainerCatalogueType(getItemById(editLine.itemId)?.catalogueType);
});

const editLineRequiresRecurrentTerm = computed(() => {
  if (editLine.mode !== "item") return false;

  return isRecurrentCatalogueType(getItemById(editLine.itemId)?.catalogueType);
});

const editLineBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    editLine.retainerStartDate,
    editLine.retainerEndDate,
    editLine.retainerPeriods,
  ),
);

const editLineRecurrentBillablePeriods = computed(() =>
  calculateRetainerBillablePeriods(
    editLine.recurrentStartDate,
    editLine.recurrentEndDate,
    editLine.recurrentPeriods,
  ),
);

const phaseDraft = reactive({
  category: "",
  customPhaseId: null as string | null,
  discountPercent: 0,
  name: "",
  note: "",
  parentItemId: null as number | null,
  price: 0,
  quantity: 1,
  taxApplicable: true as boolean | null,
});

const itemTypeChoices: ItemTypeChoice[] = [
  {
    title: "Onetime Service",
    value: "Onetime Service",
    description:
      "Single-scope service delivered once, such as an installation or one-off site visit.",
    icon: "tabler-bolt",
  },
  {
    title: "Product",
    value: "Product",
    description:
      "Standard stocked item purchased, stored, and sold as inventory.",
    icon: "tabler-package",
  },
  {
    title: "Contractual Service",
    value: "Contractual Service",
    description:
      "Service sold under a fixed contract period, scope, or maintenance agreement.",
    icon: "tabler-file-description",
  },
  {
    title: "Produced Product",
    value: "Produced Product",
    description:
      "Item manufactured, assembled, or custom-built internally before delivery.",
    icon: "tabler-building-factory-2",
  },
  {
    title: "Reccurent Service",
    value: "Reccurent Service",
    description:
      "Scheduled repeat service delivered on a recurring basis such as monthly cleaning or upkeep.",
    icon: "tabler-repeat",
  },
  {
    title: "Rental",
    value: "Rental",
    description:
      "Reusable asset hired out for a defined time window and then returned to stock.",
    icon: "tabler-calendar-time",
    comingSoon: true,
  },
  {
    title: "Retainer Service",
    value: "Retainer Service",
    description:
      "Ongoing advisory or support service billed to reserve team availability over time.",
    icon: "tabler-briefcase",
  },
];

const catalogueOptions = computed(() =>
  cataloguesStore.all
    .filter((item) => item.name.trim())
    .map((item) => ({
      title: `${item.name} (${item.type})`,
      value: item.id,
    })),
);

const selectedCatalogueItem = computed<CatalogueItem | null>(() => {
  if (!selectedCatalogueItemId.value) return null;

  return cataloguesStore.byId(selectedCatalogueItemId.value) ?? null;
});

const selectedCatalogueRecord = computed(() =>
  selectedCatalogueItemId.value
    ? cataloguesStore.recordById(selectedCatalogueItemId.value)
    : null,
);

const buildDealRelatedTo = () => ({
  id: props.deal.id,
  name: props.deal.code || `Deal #${props.deal.id}`,
  type: "deal",
});

const parseAfterWhen = (raw?: string | null) => {
  const base = new Date();

  const value = String(raw || "")
    .trim()
    .toLowerCase();

  const match = value.match(
    /^([+-]?\d+)\s*(day|days|week|weeks|month|months)$/,
  );

  if (!match) return base.toISOString();

  const amount = Number(match[1] || 0);
  const unit = match[2];
  const next = new Date(base);

  if (unit.startsWith("day")) next.setDate(next.getDate() + amount);
  else if (unit.startsWith("week")) next.setDate(next.getDate() + amount * 7);
  else if (unit.startsWith("month")) next.setMonth(next.getMonth() + amount);

  return next.toISOString();
};

const extractSalesTasks = (record: unknown): CatalogueSalesTask[] => {
  if (!record || typeof record !== "object") return [];

  const salesTasks = (record as { salesTasks?: CatalogueSalesTask[] })
    .salesTasks;

  return Array.isArray(salesTasks) ? salesTasks : [];
};

const cloneDealSalesTaskTemplate = (
  task: DealSalesTaskTemplate,
): DealSalesTaskTemplate => ({
  ...task,
  collaborators: Array.isArray(task.collaborators)
    ? task.collaborators.map((collaborator) => ({ ...collaborator }))
    : [],
  startTrigger: task.startTrigger
    ? {
        type: task.startTrigger.type,
        goalId: task.startTrigger.goalId ?? null,
        taskId: task.startTrigger.taskId ?? null,
      }
    : null,
  attachment: task.attachment ? { ...task.attachment } : null,
  relatedTo: task.relatedTo ? { ...task.relatedTo } : null,
  steps: Array.isArray(task.steps)
    ? task.steps.map((step, index) => ({
        ...step,
        id: step.id ?? index + 1,
        collaborators: Array.isArray(step.collaborators)
          ? step.collaborators.map((collaborator) => ({ ...collaborator }))
          : [],
      }))
    : [],
  sourceItemId: task.sourceItemId ?? null,
  sourceTaskId: task.sourceTaskId ?? null,
});

const nextDealSalesTaskId = (tasks: DealSalesTaskTemplate[]) => {
  const ids = tasks
    .map((task) => Number(task.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const buildImportedSalesTaskTemplates = (
  items: DealItem[],
  startingId = 1,
): DealSalesTaskTemplate[] => {
  let nextId = startingId;

  return items
    .filter((item) => !item.parentItemId)
    .flatMap((item) => {
      const record = item.catalogueItemId
        ? cataloguesStore.recordById(
            item.catalogueItemId,
            item.catalogueType || undefined,
          )
        : null;

      return extractSalesTasks(record).map((task, index) =>
        cloneDealSalesTaskTemplate({
          ...task,
          id: nextId++,
          relatedTo: buildDealRelatedTo(),
          sourceItemId: item.id,
          sourceTaskId: task.id ?? index + 1,
        }),
      );
    });
};

const nextItemId = () => {
  const ids = (props.deal.items || [])
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id));

  return ids.length ? Math.max(...ids) + 1 : 1;
};

const addDealItemsFromCatalogueItem = (
  catalogueItem: CatalogueItem,
  quantity: number,
  options?: {
    note?: string | null;
    discountPercent?: number | null;
    recurrentTerm?: Pick<
      DealItem,
      | "recurrentBillablePeriods"
      | "recurrentEndDate"
      | "recurrentPeriods"
      | "recurrentStartDate"
    > | null;
    retainerTerm?: Pick<
      DealItem,
      | "retainerBillablePeriods"
      | "retainerEndDate"
      | "retainerPeriods"
      | "retainerStartDate"
    > | null;
    taxApplicable?: boolean | null;
  },
) => {
  const baseId = nextItemId();
  const catalogueRecord = cataloguesStore.recordById(catalogueItem.id);

  const relatedItems =
    catalogueRecord?.type === "Onetime Service"
      ? (catalogueRecord as CatalogueOnetimeServiceRecord).relatedItems || []
      : [];

  const nextItems: DealItem[] = [
    ...(props.deal.items || []),
    {
      id: baseId,
      name: catalogueItem.name,
      itemTypeLabel: catalogueItem.type,
      category: catalogueItem.category,
      catalogueItemId: catalogueItem.id,
      catalogueType: catalogueItem.type,
      parentItemId: null,
      sourceRelatedItemId: null,
      excludedRelatedItemIds: null,
      discountPercent: options?.discountPercent ?? 0,
      taxApplicable: options?.taxApplicable ?? null,
      quantity,
      ...(options?.recurrentTerm || {}),
      ...(options?.retainerTerm || {}),
      unitPrice: Number(catalogueItem.bestPrice || 0),
      status: "Planned",
      note: options?.note ?? (catalogueItem.description || null),
    },
    ...relatedItems.map((relatedItem, index) => ({
      id: baseId + index + 1,
      name: relatedItem.name,
      itemTypeLabel: "Related Item",
      category: relatedItem.category,
      catalogueItemId: catalogueItem.id,
      catalogueType: "Related Item",
      parentItemId: baseId,
      sourceRelatedItemId: relatedItem.id,
      excludedRelatedItemIds: null,
      quantity,
      unitPrice: relatedItem.price ?? null,
      status: "Planned",
      note: relatedItem.description || null,
    })),
  ];

  const existingSalesTasks = buildEditableSalesTasks();

  const importedSalesTasks = buildImportedSalesTaskTemplates(
    nextItems.filter((item) => item.id === baseId),
    nextDealSalesTaskId(existingSalesTasks),
  );

  dealsStore.updateDeal(props.deal.id, {
    items: nextItems,
    salesTasks: [...existingSalesTasks, ...importedSalesTasks],
  });
};

const itemTypeLabel = (item: DealItem) => {
  const raw = item.itemTypeLabel || item.catalogueType || "Item";

  return (
    raw
      .replace(/\bitems?\b/gi, "")
      .replace(/\bservices?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || raw
  );
};

const openAddItemDialog = () => {
  selectedCatalogueItemId.value = null;
  addItemDraft.quantity = 1;
  addItemDraft.recurrentStartDate = defaultRetainerStartDate();
  addItemDraft.recurrentEndDate = defaultRetainerEndDate();
  addItemDraft.recurrentPeriods = 12;
  addItemDraft.retainerStartDate = defaultRetainerStartDate();
  addItemDraft.retainerEndDate = defaultRetainerEndDate();
  addItemDraft.retainerPeriods = 12;
  addItemDialogVisible.value = true;
};

const openCreateCatalogueItem = async () => {
  selectedCreateItemType.value = null;
  createItemTypeDialogVisible.value = true;
};

const saveSelectedCatalogueItem = async () => {
  const { valid } = (await addItemFormRef.value?.validate()) ?? { valid: true };
  if (!valid || !selectedCatalogueItem.value) return;

  const selectedItem = selectedCatalogueItem.value;
  const recurrentTerm = addItemRequiresRecurrentTerm.value
    ? buildRecurrentTermPayload({
        endDate: addItemDraft.recurrentEndDate,
        periods: addItemDraft.recurrentPeriods,
        startDate: addItemDraft.recurrentStartDate,
      })
    : null;
  const retainerTerm = addItemRequiresRetainerTerm.value
    ? buildRetainerTermPayload({
        endDate: addItemDraft.retainerEndDate,
        periods: addItemDraft.retainerPeriods,
        startDate: addItemDraft.retainerStartDate,
      })
    : null;

  if (addItemRequiresRecurrentTerm.value && !recurrentTerm) return;
  if (addItemRequiresRetainerTerm.value && !retainerTerm) return;

  const quantity = recurrentTerm
    ? resolvePeriodDrivenItemQuantity(recurrentTerm.recurrentPeriods)
    : retainerTerm
      ? resolvePeriodDrivenItemQuantity(retainerTerm.retainerPeriods)
      : Number(addItemDraft.quantity || 1);

  addDealItemsFromCatalogueItem(selectedItem, quantity, {
    recurrentTerm,
    retainerTerm,
  });
  notifications.push("Item added to deal", "success", 3000);
  addItemDialogVisible.value = false;
};

const openCreateDraftItemDialog = (type: CatalogueItemType) => {
  const choice = itemTypeChoices.find((item) => item.value === type);
  if (choice?.comingSoon) return;

  selectedCreateItemType.value = type;
  createDraftItem.name = "";
  createDraftItem.quantity = 1;
  createDraftItem.price = 0;
  createDraftItem.discountPercent = 0;
  createDraftItem.taxApplicable = true;
  createDraftItem.note = "";
  createDraftItem.recurrentStartDate = defaultRetainerStartDate();
  createDraftItem.recurrentEndDate = defaultRetainerEndDate();
  createDraftItem.recurrentPeriods = 12;
  createDraftItem.retainerStartDate = defaultRetainerStartDate();
  createDraftItem.retainerEndDate = defaultRetainerEndDate();
  createDraftItem.retainerPeriods = 12;
  createItemTypeDialogVisible.value = false;
  createDraftItemDialogVisible.value = true;
};

const saveCreatedDraftItem = async () => {
  const { valid } = (await createDraftItemFormRef.value?.validate()) ?? {
    valid: true,
  };

  if (!valid || !selectedCreateItemType.value) return;

  const recurrentTerm = createDraftItemRequiresRecurrentTerm.value
    ? buildRecurrentTermPayload({
        endDate: createDraftItem.recurrentEndDate,
        periods: createDraftItem.recurrentPeriods,
        startDate: createDraftItem.recurrentStartDate,
      })
    : null;
  const retainerTerm = createDraftItemRequiresRetainerTerm.value
    ? buildRetainerTermPayload({
        endDate: createDraftItem.retainerEndDate,
        periods: createDraftItem.retainerPeriods,
        startDate: createDraftItem.retainerStartDate,
      })
    : null;

  if (createDraftItemRequiresRecurrentTerm.value && !recurrentTerm) return;
  if (createDraftItemRequiresRetainerTerm.value && !retainerTerm) return;

  const quantity = recurrentTerm
    ? resolvePeriodDrivenItemQuantity(recurrentTerm.recurrentPeriods)
    : retainerTerm
      ? resolvePeriodDrivenItemQuantity(retainerTerm.retainerPeriods)
      : Number(createDraftItem.quantity || 1);

  const draftRecord = cataloguesStore.addItem({
    type: selectedCreateItemType.value,
    name: createDraftItem.name,
    qty: createDraftItemUsesPeriodQuantity.value ? 1 : quantity,
    bestPrice: Number(createDraftItem.price || 0),
    chargeTax: Boolean(createDraftItem.taxApplicable),
    description: String(createDraftItem.note || "").trim(),
    category: "",
    activeState: "Draft" as CatalogueActiveState,
  });

  addDealItemsFromCatalogueItem(draftRecord, quantity, {
    note: String(createDraftItem.note || "").trim() || null,
    discountPercent: Number(createDraftItem.discountPercent || 0),
    recurrentTerm,
    retainerTerm,
    taxApplicable: Boolean(createDraftItem.taxApplicable),
  });

  createDraftItemDialogVisible.value = false;
  notifications.push("Draft catalogue item created and added", "success", 3000);
};

const removeDealItem = (item: DealItemWithPlan) => {
  const isRelatedItemChild =
    item.catalogueType === "Related Item" &&
    !!item.parentItemId &&
    !!item.sourceRelatedItemId;

  let nextItems = (props.deal.items || []).map((existingItem) => {
    if (
      !isRelatedItemChild ||
      existingItem.id !== item.parentItemId ||
      !item.sourceRelatedItemId
    )
      return existingItem;

    const excluded = new Set(existingItem.excludedRelatedItemIds || []);

    excluded.add(item.sourceRelatedItemId);

    return {
      ...existingItem,
      excludedRelatedItemIds: [...excluded],
    };
  });

  nextItems = nextItems.filter(
    (existingItem) =>
      existingItem.id !== item.id && existingItem.parentItemId !== item.id,
  );

  (props.deal.items || [])
    .filter(
      (existingItem) =>
        existingItem.id === item.id || existingItem.parentItemId === item.id,
    )
    .flatMap((existingItem) => existingItem.generatedTaskIds || [])
    .forEach((taskId) => todosStore.removeTodo(taskId));

  const nextSalesTasks = isRelatedItemChild
    ? buildEditableSalesTasks()
    : buildEditableSalesTasks().filter(
        (task) => Number(task.sourceItemId ?? 0) !== Number(item.id),
      );

  dealsStore.updateDeal(props.deal.id, {
    items: nextItems,
    salesTasks: nextSalesTasks,
  });
  notifications.push("Item removed", "success", 2500);
};

const getItemById = (itemId: number | string | null | undefined) =>
  (props.deal.items || []).find(
    (item) => String(item.id) === String(itemId ?? ""),
  ) ?? null;

const normalizeEditableNumber = (value: unknown, fallback: number | null) => {
  if (value === null || value === undefined || value === "") return fallback;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildOverridePayload = (): DealItemOverride => {
  const payload: DealItemOverride = {
    name: editLine.name.trim(),
    category: editLine.category.trim() || null,
    note: editLine.note.trim() || null,
  };

  if (editLine.canEditQuantity)
    payload.quantity = normalizeEditableNumber(editLine.quantity, null);
  if (editLine.canEditPrice)
    payload.unitPrice = normalizeEditableNumber(editLine.unitPrice, null);
  if (editLine.canEditDiscount) {
    payload.discountPercent = normalizeEditableNumber(
      editLine.discountPercent,
      0,
    );
  }
  if (editLine.canEditTax) payload.taxApplicable = editLine.taxApplicable;

  return payload;
};

const setEditFieldConstraints = (options: {
  quantity: boolean;
  price: boolean;
  discount: boolean;
  tax: boolean;
  info?: boolean;
}) => {
  editLine.canEditQuantity = options.quantity;
  editLine.canEditPrice = options.price;
  editLine.canEditDiscount = options.discount;
  editLine.canEditTax = options.tax;
  editLine.canEditInfo = options.info ?? true;
};

const openEditItem = (item: DealItemWithPlan) => {
  const isGeneratedRelatedItem =
    item.catalogueType === "Related Item" &&
    !!item.parentItemId &&
    !!item.sourceRelatedItemId &&
    !getItemById(item.panelId);

  if (isGeneratedRelatedItem) {
    const overrideKey = `related-${item.sourceRelatedItemId}`;
    const parent = getItemById(item.parentItemId);
    const override = parent?.subItemOverrides?.[overrideKey] || {};

    editLine.mode = "sub";
    editLine.itemId = null;
    editLine.parentItemId = Number(item.parentItemId);
    editLine.overrideKey = overrideKey;
    editLine.title = item.name;
    editLine.name = override.name ?? item.name;
    editLine.category = override.category ?? item.category ?? "";
    editLine.quantity = override.quantity ?? item.quantity ?? 1;
    editLine.unitPrice = override.unitPrice ?? item.unitPrice ?? 0;
    editLine.discountPercent = override.discountPercent ?? 0;
    editLine.taxApplicable =
      override.taxApplicable ?? item.taxApplicable ?? null;
    editLine.note = override.note ?? item.note ?? "";
    setEditFieldConstraints({
      quantity: true,
      price: true,
      discount: true,
      tax: true,
      info: true,
    });
    editLineDialogVisible.value = true;

    return;
  }

  editLine.mode = "item";
  editLine.itemId = Number(item.id);
  editLine.parentItemId = null;
  editLine.overrideKey = "";
  editLine.title = item.name;
  editLine.name = item.name;
  editLine.category = item.category ?? "";
  editLine.quantity = item.quantity ?? 1;
  editLine.unitPrice = item.unitPrice ?? 0;
  editLine.discountPercent = item.discountPercent ?? 0;
  editLine.taxApplicable = item.taxApplicable ?? null;
  editLine.note = item.note ?? "";
  editLine.recurrentStartDate =
    item.recurrentStartDate ?? defaultRetainerStartDate();
  editLine.recurrentEndDate = item.recurrentEndDate ?? defaultRetainerEndDate();
  editLine.recurrentPeriods = item.recurrentPeriods ?? 12;
  editLine.retainerStartDate =
    item.retainerStartDate ?? defaultRetainerStartDate();
  editLine.retainerEndDate = item.retainerEndDate ?? defaultRetainerEndDate();
  editLine.retainerPeriods = item.retainerPeriods ?? 12;
  setEditFieldConstraints({
    quantity:
      !isRecurrentCatalogueType(item.catalogueType) &&
      !isRetainerCatalogueType(item.catalogueType),
    price: true,
    discount: true,
    tax: true,
    info: true,
  });
  editLineDialogVisible.value = true;
};

const openEditGoal = (parentItem: DealItemWithPlan, goal: DerivedGoal) => {
  if (goal.overrideKey.includes("-custom-")) {
    openEditCustomPhase(parentItem, goal);

    return;
  }

  const sourceItem = getItemById(parentItem.id);
  const override = sourceItem?.subItemOverrides?.[goal.overrideKey] || {};

  editLine.mode = "sub";
  editLine.itemId = null;
  editLine.parentItemId = Number(parentItem.id);
  editLine.overrideKey = goal.overrideKey;
  editLine.title = goal.name;
  editLine.name = override.name ?? goal.name;
  editLine.category = override.category ?? goal.category ?? "";
  editLine.quantity = override.quantity ?? goal.quantity ?? 1;
  editLine.unitPrice = override.unitPrice ?? goal.price ?? 0;
  editLine.discountPercent =
    override.discountPercent ?? goal.discountPercent ?? 0;
  editLine.taxApplicable = override.taxApplicable ?? goal.taxApplicable ?? null;
  editLine.note = override.note ?? goal.note ?? "";
  setEditFieldConstraints({
    quantity: goal.showQuantity,
    price: goal.showPrice,
    discount: goal.showDiscount,
    tax: goal.showTaxApplicable,
    info: true, // Always allow editing info (Name/Note) for all goal types
  });
  editLineDialogVisible.value = true;
};

const saveEditedLine = async () => {
  const { valid } = (await editLineFormRef.value?.validate()) ?? {
    valid: true,
  };

  if (!valid) return;

  const payload = buildOverridePayload();

  const nextItems = (props.deal.items || []).map((item) => {
    if (editLine.mode === "item" && item.id === editLine.itemId) {
      const recurrentTerm = isRecurrentCatalogueType(item.catalogueType)
        ? buildRecurrentTermPayload({
            endDate: editLine.recurrentEndDate,
            periods: editLine.recurrentPeriods,
            startDate: editLine.recurrentStartDate,
          })
        : null;
      const retainerTerm = isRetainerCatalogueType(item.catalogueType)
        ? buildRetainerTermPayload({
            endDate: editLine.retainerEndDate,
            periods: editLine.retainerPeriods,
            startDate: editLine.retainerStartDate,
          })
        : null;

      if (isRecurrentCatalogueType(item.catalogueType) && !recurrentTerm)
        return item;
      if (isRetainerCatalogueType(item.catalogueType) && !retainerTerm)
        return item;

      const resolvedQuantity = recurrentTerm
        ? resolvePeriodDrivenItemQuantity(recurrentTerm.recurrentPeriods)
        : retainerTerm
          ? resolvePeriodDrivenItemQuantity(retainerTerm.retainerPeriods)
          : (payload.quantity ?? item.quantity);

      return {
        ...item,
        name: payload.name || item.name,
        category: payload.category,
        quantity: resolvedQuantity,
        unitPrice:
          payload.unitPrice === undefined ? item.unitPrice : payload.unitPrice,
        discountPercent:
          payload.discountPercent === undefined
            ? item.discountPercent
            : payload.discountPercent,
        taxApplicable:
          payload.taxApplicable === undefined
            ? item.taxApplicable
            : payload.taxApplicable,
        note: payload.note,
        ...(recurrentTerm || {
          recurrentBillablePeriods: null,
          recurrentEndDate: null,
          recurrentPeriods: null,
          recurrentStartDate: null,
        }),
        ...(retainerTerm || {
          retainerBillablePeriods: null,
          retainerEndDate: null,
          retainerPeriods: null,
          retainerStartDate: null,
        }),
      };
    }

    if (editLine.mode === "sub" && item.id === editLine.parentItemId) {
      return {
        ...item,
        subItemOverrides: {
          ...(item.subItemOverrides || {}),
          [editLine.overrideKey]: payload,
        },
      };
    }

    return item;
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  editLineDialogVisible.value = false;
  notifications.push("Item updated for this deal", "success", 2500);
};

const isProductLike = (type?: string | null) =>
  type === "Product" ||
  type === "Produced Product" ||
  type === "Rental" ||
  type === "Onetime Service" ||
  type === "Related Item";

const formatMoney = (value?: number | null) =>
  value === null || value === undefined ? "--" : Number(value).toLocaleString();

const formatTaxApplicable = (value: boolean | null) => {
  if (value === null) return "--";

  return value ? "Yes" : "No";
};

const formatPercent = (value?: number | null) =>
  value === null || value === undefined ? "--" : `${Number(value)}%`;

const getProducedProductRecord = (
  item?: DealItem | DealItemWithPlan | null,
): CatalogueProducedProductRecord | null => {
  if (!item?.catalogueItemId) return null;

  const record = cataloguesStore.recordById(
    item.catalogueItemId,
    item.catalogueType || undefined,
  );

  return record?.type === "Produced Product"
    ? (record as CatalogueProducedProductRecord)
    : null;
};

const getProducedProductCustomizationSummary = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const produced = getProducedProductRecord(item);
  if (!produced) return null;

  const labels = [
    ...(Array.isArray(produced.options) ? produced.options : []).map((field) =>
      String(field.name ?? "").trim(),
    ),
    ...(Array.isArray(produced.measurements) ? produced.measurements : []).map(
      (field) => String(field.name ?? "").trim(),
    ),
  ].filter(Boolean);

  const uniqueLabels = Array.from(new Set(labels));

  return uniqueLabels.length ? uniqueLabels.join(", ") : null;
};

const getProducedProductSubItemsSummary = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const produced = getProducedProductRecord(item);
  if (!produced) return null;

  const labels = (Array.isArray(produced.subItems) ? produced.subItems : [])
    .map((subItem) => String(subItem.name ?? "").trim())
    .filter(Boolean);

  return labels.length ? labels.join(", ") : null;
};

const formatDocumentDate = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "--";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const isRetainerParentDealItem = (
  item?: DealItem | DealItemWithPlan | null,
): item is DealItem | DealItemWithPlan =>
  Boolean(
    item && !item.parentItemId && isRetainerCatalogueType(item.catalogueType),
  );

const isRecurrentParentDealItem = (
  item?: DealItem | DealItemWithPlan | null,
): item is DealItem | DealItemWithPlan =>
  Boolean(
    item && !item.parentItemId && isRecurrentCatalogueType(item.catalogueType),
  );

const buildRetainerSelectionKeyPrefix = (itemId: number | string) =>
  `item-${itemId}-retainer`;

const buildRecurrentSelectionKeyPrefix = (itemId: number | string) =>
  `item-${itemId}-recurrent`;

const getRecordProductSelectionKey = (product: {
  dealSelectionKey?: string | null;
}) => String(product.dealSelectionKey ?? "").trim();

const getRetainerTotalPeriods = (item?: DealItem | DealItemWithPlan | null) => {
  const totalPeriods = Number(item?.retainerPeriods ?? 0);

  return Number.isInteger(totalPeriods) && totalPeriods > 0 ? totalPeriods : 0;
};

const getRecurrentTotalPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const totalPeriods = Number(item?.recurrentPeriods ?? 0);

  return Number.isInteger(totalPeriods) && totalPeriods > 0 ? totalPeriods : 0;
};

const matchesRetainerRecord = (
  parentItem: DealItem | DealItemWithPlan,
  record: {
    purchasedProducts: Array<{ dealSelectionKey?: string | null }>;
    quotation: { dealId?: number | string | null };
  },
) => {
  if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
    return false;

  const selectionKeyPrefix = buildRetainerSelectionKeyPrefix(parentItem.id);

  return record.purchasedProducts.some((product) =>
    getRecordProductSelectionKey(product).startsWith(selectionKeyPrefix),
  );
};

const getRetainerConsumedPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  if (!isRetainerParentDealItem(item)) return 0;

  const proformaCount = proformasStore.items.filter((record) =>
    matchesRetainerRecord(item, record),
  ).length;

  const invoiceCount = invoicesStore.items.filter((record) =>
    matchesRetainerRecord(item, record),
  ).length;

  return proformaCount + invoiceCount;
};

const getRecurrentConsumedPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  if (!isRecurrentParentDealItem(item)) return 0;

  const selectionKeyPrefix = buildRecurrentSelectionKeyPrefix(item.id);
  const matchesRecord = (record: {
    purchasedProducts: Array<{ dealSelectionKey?: string | null }>;
    quotation: { dealId?: number | string | null };
  }) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
      return false;

    return record.purchasedProducts.some((product) =>
      getRecordProductSelectionKey(product).startsWith(selectionKeyPrefix),
    );
  };

  const proformaCount = proformasStore.items.filter((record) =>
    matchesRecord(record),
  ).length;
  const invoiceCount = invoicesStore.items.filter((record) =>
    matchesRecord(record),
  ).length;

  return proformaCount + invoiceCount;
};

const hasRecurrentRemainingPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => getRecurrentConsumedPeriods(item) < getRecurrentTotalPeriods(item);

const getRetainerRemainingPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const totalPeriods = getRetainerTotalPeriods(item);
  if (!totalPeriods) return 0;

  return Math.max(totalPeriods - getRetainerConsumedPeriods(item), 0);
};

const hasRetainerRemainingPeriods = (
  item?: DealItem | DealItemWithPlan | null,
) => getRetainerRemainingPeriods(item) > 0;

const formatRetainerTermSummary = (item: DealItem) => {
  if (!isRetainerCatalogueType(item.catalogueType)) return null;

  const startDate = formatDocumentDate(item.retainerStartDate);
  const endDate = formatDocumentDate(item.retainerEndDate);
  const periods = getRetainerTotalPeriods(item);
  const consumedPeriods = getRetainerConsumedPeriods(item);

  if (!periods || startDate === "--" || endDate === "--") return null;

  return `Start Date: ${startDate}, End Date: ${endDate}, Paid Periods: ${consumedPeriods}/${periods}`;
};

const formatRecurrentTermSummary = (item: DealItem) => {
  if (!isRecurrentCatalogueType(item.catalogueType)) return null;

  const startDate = formatDocumentDate(item.recurrentStartDate);
  const endDate = formatDocumentDate(item.recurrentEndDate);
  const periods = getRecurrentTotalPeriods(item);
  const consumedPeriods = getRecurrentConsumedPeriods(item);

  if (!periods || startDate === "--" || endDate === "--") return null;

  return `Start Date: ${startDate}, End Date: ${endDate}, Paid Periods: ${consumedPeriods}/${periods}`;
};

const calculateAmount = (
  price?: number | null,
  quantity?: number | null,
  discountPercent = 0,
) => {
  if (price === null || price === undefined) return null;

  const normalizedQuantity =
    quantity === null || quantity === undefined ? 1 : Number(quantity);

  const subtotal = Number(price) * normalizedQuantity;
  const discount = subtotal * (Number(discountPercent || 0) / 100);

  return subtotal - discount;
};

const calculateSubtotal = (price?: number | null, quantity?: number | null) => {
  if (price === null || price === undefined) return null;

  const normalizedQuantity =
    quantity === null || quantity === undefined ? 1 : Number(quantity);

  return Number(price) * normalizedQuantity;
};

const calculateDiscountAmount = (
  price?: number | null,
  quantity?: number | null,
  discountPercent = 0,
) => {
  const subtotal = calculateSubtotal(price, quantity);
  if (subtotal === null) return null;

  return subtotal * (Number(discountPercent || 0) / 100);
};

const getItemEffectiveQuantity = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  if (!item) return 0;
  if (!item.parentItemId && isRetainerCatalogueType(item.catalogueType)) {
    return getRetainerTotalPeriods(item);
  }
  if (!item.parentItemId && isRecurrentCatalogueType(item.catalogueType)) {
    return getRecurrentTotalPeriods(item);
  }

  return Number(item.quantity ?? 0);
};

const getItemQuantityLabel = (item?: DealItem | DealItemWithPlan | null) =>
  isRetainerParentDealItem(item) || isRecurrentParentDealItem(item)
    ? "Total Periods"
    : "Qty";

const getItemQuantityDisplayValue = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  if (!item) return "--";
  if (!item.parentItemId && isRetainerCatalogueType(item.catalogueType)) {
    return getRetainerTotalPeriods(item);
  }
  if (!item.parentItemId && isRecurrentCatalogueType(item.catalogueType)) {
    return getRecurrentTotalPeriods(item);
  }

  return item.quantity ?? "--";
};

const itemAmount = (item: DealItem) =>
  calculateAmount(
    item.unitPrice,
    getItemEffectiveQuantity(item),
    item.discountPercent || 0,
  );

const goalAmount = (goal: DerivedGoal) =>
  calculateAmount(goal.price, goal.quantity, goal.discountPercent || 0);

const formatGoalDiscount = (goal: DerivedGoal) =>
  goal.discountPercent === null || goal.discountPercent === undefined
    ? goal.discountLabel
    : formatPercent(goal.discountPercent);

const applySubItemOverride = (
  item: DealItem,
  overrideKey: string,
  goal: DerivedGoal,
): DerivedGoal => {
  const override = item.subItemOverrides?.[overrideKey];
  if (!override) return goal;

  return {
    ...goal,
    name: override.name ?? goal.name,
    category: override.category ?? goal.category,
    note: override.note ?? goal.note,
    price: override.unitPrice ?? goal.price,
    quantity: override.quantity ?? goal.quantity,
    discountPercent: override.discountPercent ?? goal.discountPercent,
    discountLabel:
      override.discountPercent === null ||
      override.discountPercent === undefined
        ? goal.discountLabel
        : formatPercent(override.discountPercent),
    taxApplicable: override.taxApplicable ?? goal.taxApplicable,
  };
};

const makeDerivedGoal = (
  item: DealItem,
  prefix: string,
  typeLabel: string,
  display: {
    quantity: number | null;
    discountPercent?: number | null;
    discountLabel: string | null;
    taxApplicable: boolean | null;
    showQuantity: boolean;
    showPrice: boolean;
    showDiscount: boolean;
    showTaxApplicable: boolean;
  },
  source: {
    id: number | string;
    name: string;
    category?: string | null;
    description?: string | null;
    note?: string | null;
    price?: number | null;
    qty?: number | null;
    chargeTax?: boolean | null;
  },
): DerivedGoal => ({
  id: `${prefix}-${item.id}-${source.id}`,
  overrideKey: `${prefix}-${source.id}`,
  name: source.name,
  category: source.category ?? null,
  note: source.note ?? source.description ?? null,
  price: source.price ?? null,
  typeLabel,
  discountPercent: display.discountPercent ?? null,
  ...display,
});

const makeSection = (
  item: DealItem,
  section: Omit<DerivedSection, "id"> & { id?: string },
): DerivedSection => ({
  id: section.id ?? `item-${item.id}`,
  ...section,
});

const deriveSections = (item: DealItem): DerivedSection[] => {
  const record = item.catalogueItemId
    ? cataloguesStore.recordById(
        item.catalogueItemId,
        item.catalogueType || undefined,
      )
    : null;

  if (!record) {
    return [
      makeSection(item, {
        name: item.name,
        note: item.note || null,
        price: item.unitPrice ?? null,
        goals: [],
        goalTypeSingular: itemTypeLabel(item),
        goalTypePlural: `${itemTypeLabel(item)}s`,
      }),
    ];
  }

  if (record.type === "Contractual Service") {
    const contractual = record as CatalogueContractualServiceRecord;

    return [
      makeSection(item, {
        name: contractual.name,
        note: contractual.description || null,
        price: contractual.bestPrice,
        goals: getDealContractualPhaseLines(item, contractual).map(
          (phase, index) => ({
            ...makeDerivedGoal(
              item,
              "phase",
              "Phase",
              {
                quantity: phase.quantity,
                discountPercent: phase.discountPercent,
                discountLabel: formatPercent(phase.discountPercent ?? 0),
                taxApplicable: phase.taxApplicable,
                showQuantity: true,
                showPrice: true,
                showDiscount: true,
                showTaxApplicable: true,
              },
              {
                category: phase.category,
                description: phase.note,
                id: phase.id,
                name: phase.name,
                note: phase.note,
                price: phase.price,
              },
            ),
            overrideKey: phase.overrideKey,
            phaseNumber: index + 1,
          }),
        ),
        goalTypeSingular: "Phase",
        goalTypePlural: "Phases",
      }),
    ];
  }

  if (record.type === "Retainer Service") {
    const retainer = record as CatalogueRetainerServiceRecord;
    const retainerLines = getDealRetainerServiceLines(item, retainer);

    return [
      makeSection(item, {
        name: retainer.name,
        note: retainer.description || null,
        price: retainer.bestPrice,
        goals: retainerLines.map((service) => ({
          ...makeDerivedGoal(
            item,
            "retainer",
            "Retainer Service",
            {
              quantity: service.quantity,
              discountPercent: service.discountPercent,
              discountLabel: null,
              taxApplicable: service.taxApplicable,
              showQuantity: false,
              showPrice: false,
              showDiscount: false,
              showTaxApplicable: false,
            },
            {
              id: service.id,
              name: service.name,
              category: service.category,
              description: service.note,
              note: service.note,
              price: service.price,
            },
          ),
          overrideKey: service.overrideKey,
        })),
        goalTypeSingular: "Retainer Service",
        goalTypePlural: "Retainer Services",
      }),
    ];
  }

  if (record.type === "Reccurent Service") {
    const recurrent = record as CatalogueReccurentServiceRecord;
    const recurrentLines = getDealRecurrentServiceLines(item, recurrent);
    const recurrentPeriods = buildRecurrentBillingPeriods(item);

    if (recurrentPeriods.length) {
      return recurrentPeriods.map((period, index) =>
        makeSection(item, {
          id: `item-${item.id}-${period.key}`,
          name: period.label || `Period ${index + 1}`,
          note: null,
          price: null,
          billingPeriod: period,
          goals: recurrentLines.map((service) => ({
            ...makeDerivedGoal(
              item,
              `recurrent-period-${index + 1}`,
              "Recurrent Service",
              {
                quantity: service.quantity,
                discountPercent: service.discountPercent,
                discountLabel: null,
                taxApplicable: service.taxApplicable,
                showQuantity: false,
                showPrice: false,
                showDiscount: false,
                showTaxApplicable: false,
              },
              {
                id: service.id,
                name: service.name,
                category: service.category,
                description: service.note,
                note: service.note,
                price: service.price,
              },
            ),
            overrideKey: service.overrideKey,
          })),
          goalTypeSingular: "Recurrent Service",
          goalTypePlural: "Recurrent Services",
        }),
      );
    }

    return [
      makeSection(item, {
        name: recurrent.name,
        note: recurrent.description || null,
        price: recurrent.bestPrice,
        goals: recurrentLines.map((service) => ({
          ...makeDerivedGoal(
            item,
            "recurrent",
            "Recurrent Service",
            {
              quantity: service.quantity,
              discountPercent: service.discountPercent,
              discountLabel: null,
              taxApplicable: service.taxApplicable,
              showQuantity: false,
              showPrice: false,
              showDiscount: false,
              showTaxApplicable: false,
            },
            {
              id: service.id,
              name: service.name,
              category: service.category,
              description: service.note,
              note: service.note,
              price: service.price,
            },
          ),
          overrideKey: service.overrideKey,
        })),
        goalTypeSingular: "Recurrent Service",
        goalTypePlural: "Recurrent Services",
      }),
    ];
  }

  if (record.type === "Onetime Service") {
    const service = record as CatalogueOnetimeServiceRecord;

    return [
      makeSection(item, {
        name: service.name,
        note: service.description || null,
        price: service.bestPrice,
        goals: [],
        goalTypeSingular: "Related Item",
        goalTypePlural: "Related Items",
      }),
    ];
  }

  if (record.type === "Produced Product") {
    const produced = record as CatalogueProducedProductRecord;

    return [
      makeSection(item, {
        name: produced.name,
        note:
          getProducedProductCustomizationSummary(item) ||
          produced.description ||
          null,
        price: produced.bestPrice,
        goals: (Array.isArray(produced.subItems) ? produced.subItems : []).map(
          (subItem) =>
            makeDerivedGoal(
              item,
              "produced-sub-item",
              "Sub Item",
              {
                quantity: null,
                discountLabel: null,
                taxApplicable: null,
                showQuantity: false,
                showPrice: false,
                showDiscount: false,
                showTaxApplicable: false,
              },
              {
                id: subItem.id,
                name: subItem.name,
                note: [
                  subItem.options.length
                    ? `Customizations: ${subItem.options
                        .map((field) => String(field.name ?? "").trim())
                        .filter(Boolean)
                        .join(", ")}`
                    : "",
                  subItem.measurements.length
                    ? `Measurements: ${subItem.measurements
                        .map((field) => String(field.name ?? "").trim())
                        .filter(Boolean)
                        .join(", ")}`
                    : "",
                  subItem.rawMaterials.length
                    ? `Raw materials: ${subItem.rawMaterials
                        .map((material) => String(material.name ?? "").trim())
                        .filter(Boolean)
                        .join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | "),
              },
            ),
        ),
        goalTypeSingular: "Sub Item",
        goalTypePlural: "Sub Items",
      }),
    ];
  }

  const product = record as CatalogueProductRecord;

  if (isProductLike(product.type)) {
    return [
      makeSection(item, {
        name: product.name,
        note: product.description || null,
        price: product.bestPrice,
        goals: [],
        goalTypeSingular: "Item",
        goalTypePlural: "Items",
      }),
    ];
  }

  return [
    makeSection(item, {
      name: item.name,
      note: item.note || null,
      price: item.unitPrice ?? null,
      goals: [],
      goalTypeSingular: "Item",
      goalTypePlural: "Items",
    }),
  ];
};

const deriveRelatedItemMilestones = (item: DealItem): DealItemWithPlan[] => {
  if (item.catalogueType === "Related Item" || item.parentItemId) return [];

  const alreadyMaterialized = (props.deal.items || []).some(
    (existingItem) =>
      existingItem.parentItemId === item.id &&
      existingItem.catalogueType === "Related Item",
  );

  if (alreadyMaterialized) return [];

  const record = item.catalogueItemId
    ? cataloguesStore.recordById(
        item.catalogueItemId,
        item.catalogueType || undefined,
      )
    : null;

  if (!record || record.type !== "Onetime Service") return [];

  const service = record as CatalogueOnetimeServiceRecord;
  const excluded = new Set(item.excludedRelatedItemIds || []);

  return (service.relatedItems || [])
    .filter((relatedItem) => !excluded.has(relatedItem.id))
    .map((relatedItem) => {
      const overrideKey = `related-${relatedItem.id}`;
      const override = item.subItemOverrides?.[overrideKey] || {};

      return {
        id: item.id,
        panelId: `related-${item.id}-${relatedItem.id}`,
        name: override.name ?? relatedItem.name,
        itemTypeLabel: "Related Item",
        category: override.category ?? relatedItem.category,
        catalogueItemId: item.catalogueItemId,
        catalogueType: "Related Item",
        parentItemId: item.id,
        sourceRelatedItemId: relatedItem.id,
        quantity: override.quantity ?? item.quantity,
        unitPrice: override.unitPrice ?? relatedItem.price ?? null,
        discountPercent: override.discountPercent ?? 0,
        taxApplicable: override.taxApplicable ?? relatedItem.chargeTax,
        status: item.status,
        note: override.note ?? relatedItem.description ?? null,
        isExpandable: false,
        derivedSections: [
          makeSection(item, {
            name: override.name ?? relatedItem.name,
            note: override.note ?? relatedItem.description ?? null,
            price: override.unitPrice ?? relatedItem.price ?? null,
            goals: [],
            goalTypeSingular: "Related Item",
            goalTypePlural: "Related Items",
          }),
        ],
        childTypeSingular: "Related Item",
        childTypePlural: "Related Items",
        childCount: 0,
        actionsEnabled: true,
      };
    });
};

const dealItemsWithPlan = computed<DealItemWithPlan[]>(() =>
  (props.deal.items || []).flatMap((item) => {
    const derivedSections = deriveSections(item);
    const relatedItemMilestones = deriveRelatedItemMilestones(item);
    const [firstSection] = derivedSections;
    const hasDerivedChildren = derivedSections.some(
      (section) => section.goals.length > 0,
    );

    const primaryItem: DealItemWithPlan = {
      ...item,
      panelId: item.id,
      isExpandable:
        !isProductLike(item.catalogueType) ||
        (item.catalogueType === "Produced Product" && hasDerivedChildren),
      derivedSections,
      childTypeSingular: firstSection?.goalTypeSingular || "Item",
      childTypePlural: firstSection?.goalTypePlural || "Items",
      childCount:
        item.catalogueType === "Onetime Service"
          ? relatedItemMilestones.length
          : derivedSections.reduce(
              (sum, section) => sum + section.goals.length,
              0,
            ),
      actionsEnabled: true,
    };

    return [primaryItem, ...relatedItemMilestones];
  }),
);

const derivedGoalsForItem = (item: DealItemWithPlan) =>
  item.derivedSections.flatMap((section) => section.goals);

const toggleItemExpanded = (panelId: number | string) => {
  const index = expandedItems.value.findIndex(
    (value) => String(value) === String(panelId),
  );

  if (index >= 0) {
    expandedItems.value = expandedItems.value.filter(
      (value) => String(value) !== String(panelId),
    );

    return;
  }

  expandedItems.value = [...expandedItems.value, panelId];
};

const itemsSubtotal = computed(() =>
  (props.deal.items || []).reduce(
    (sum, item) =>
      sum + Number(item.unitPrice || 0) * getItemEffectiveQuantity(item),
    0,
  ),
);

const totalDiscount = computed(() =>
  (props.deal.items || []).reduce((sum, item) => {
    const subtotal =
      Number(item.unitPrice || 0) * getItemEffectiveQuantity(item);

    return sum + subtotal * (Number(item.discountPercent || 0) / 100);
  }, 0),
);
const totalTax = computed(() => 0);

const grandTotal = computed(
  () => itemsSubtotal.value - totalDiscount.value + totalTax.value,
);

const financialRows = computed(() => props.deal.financials || []);

const totalQuoted = computed(() =>
  financialRows.value
    .filter((entry) => entry.type === "quotation" || entry.type === "invoice")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);

const totalInvoiced = computed(() =>
  invoicesStore.items
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .reduce((sum, record) => sum + Number(record.quotation.total || 0), 0),
);

const totalPaid = computed(() =>
  financialRows.value
    .filter(
      (entry) =>
        entry.type === "payment" &&
        String(entry.status || "").toLowerCase() === "received",
    )
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);

const remainingToInvoice = computed(() =>
  Math.max(grandTotal.value - totalInvoiced.value, 0),
);

const dealItems = computed(() => props.deal.items || []);

const billableRootItems = computed(() =>
  getBillableRootDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);

const quotationItems = computed(() =>
  getQuotationTopLevelDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);

const selectableDocumentItems = computed(() =>
  getSelectableDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);

const billingMode = computed<DealDocumentBillingMode>(() =>
  resolveDealDocumentBillingMode(billableRootItems.value),
);

const effectiveBillingMode = computed<DealDocumentBillingMode>(
  () => selectedBillingMode.value ?? billingMode.value,
);

const contact = computed(() => {
  if (!props.deal.relatedTo) return null;

  return contactsStore.byId(props.deal.relatedTo) ?? null;
});

const externalDocumentKindLabel = computed(() => {
  if (selectedExternalDocumentKind.value === "quotation") return "Quotation";
  if (selectedExternalDocumentKind.value === "proforma") return "Proforma";
  if (selectedExternalDocumentKind.value === "invoice") return "Invoice";

  return "Document";
});

const externalDocumentDialogTitle = computed(
  () => `Attach External ${externalDocumentKindLabel.value}`,
);

const externalDocumentNumberLabel = computed(
  () => `${externalDocumentKindLabel.value} Number`,
);

const externalDocumentStatusOptions = computed(() => {
  if (selectedExternalDocumentKind.value === "quotation") {
    return [
      { title: "Pending", value: "Pending" },
      { title: "Approved", value: "Approved" },
      { title: "Lost", value: "Lost" },
    ] as const;
  }

  return [
    { title: "Not Paid", value: "Not Paid" },
    { title: "Paid", value: "Paid" },
    { title: "Partially Paid", value: "Partially Paid" },
  ] as const;
});

const selectedExternalAttachment = computed<File | null>(() => {
  const value = externalDocumentForm.value.attachment;

  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;

  return value;
});

const externalDocumentTracksPayments = computed(
  () =>
    selectedExternalDocumentKind.value === "proforma" ||
    selectedExternalDocumentKind.value === "invoice",
);

const requiresExternalPaidAmount = computed(
  () =>
    externalDocumentTracksPayments.value &&
    externalDocumentForm.value.status === "Partially Paid",
);

const externalPaidAmountHint = computed(() => {
  const amount = Number(externalDocumentForm.value.amount || 0);

  if (amount <= 0) return "Enter the total amount first.";

  return `Enter the amount already received from the ${externalDocumentKindLabel.value.toLowerCase()}.`;
});

const externalDocumentClient = computed(() => {
  const contactName = String(contact.value?.fullName ?? "").trim();
  const dealName = String(props.deal.name ?? "").trim();
  const name = contactName || dealName || `Deal #${props.deal.id}`;

  return {
    address: String(contact.value?.address ?? "").trim(),
    company: name,
    companyEmail: String(contact.value?.email ?? "").trim(),
    contact: contactName,
    country: String(contact.value?.country ?? "").trim() || "Lebanon",
    name,
  };
});

const sortDealDocumentRecords = <T extends DealDocumentContainer>(
  records: T[],
) =>
  [...records]
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .sort((left, right) => {
      const leftTime = new Date(left.quotation.issuedDate || 0).getTime();
      const rightTime = new Date(right.quotation.issuedDate || 0).getTime();

      if (leftTime !== rightTime) return rightTime - leftTime;

      return Number(right.quotation.id) - Number(left.quotation.id);
    });

const mapDealDocumentPanelRecord = <T extends DealDocumentContainer>(
  record: T,
): DealDocumentPanelRecord => ({
  id: record.quotation.id,
  issuedDate: record.quotation.issuedDate,
  quoteNumber: record.quotation.quoteNumber,
  status: record.quotation.quotationStatus,
  total: Number(record.quotation.total || 0),
});

const dealQuotationRecords = computed(() =>
  sortDealDocumentRecords(quotationsStore.items).map(
    mapDealDocumentPanelRecord,
  ),
);

const dealProformaRecords = computed(() =>
  sortDealDocumentRecords(proformasStore.items).map(mapDealDocumentPanelRecord),
);

const dealInvoiceRecords = computed(() =>
  sortDealDocumentRecords(invoicesStore.items).map(mapDealDocumentPanelRecord),
);

const quotationCount = computed(() => dealQuotationRecords.value.length);
const proformaCount = computed(() => dealProformaRecords.value.length);
const invoiceCount = computed(() => dealInvoiceRecords.value.length);

const dealDocumentPanels = computed<DealDocumentPanel[]>(() => [
  {
    count: dealQuotationRecords.value.length,
    emptyText: "No quotations created yet.",
    key: "quotation",
    latest: dealQuotationRecords.value[0] ?? null,
    records: dealQuotationRecords.value,
    title: "Quotations",
  },
  {
    count: dealProformaRecords.value.length,
    emptyText: "No proformas created yet.",
    key: "proforma",
    latest: dealProformaRecords.value[0] ?? null,
    records: dealProformaRecords.value,
    title: "Proformas",
  },
  {
    count: dealInvoiceRecords.value.length,
    emptyText: "No invoices created yet.",
    key: "invoice",
    latest: dealInvoiceRecords.value[0] ?? null,
    records: dealInvoiceRecords.value,
    title: "Invoices",
  },
]);

const resolvedActiveDocumentPanelKey = computed<DealPreviewKind | null>(() => {
  if (
    activeDocumentPanelKey.value &&
    dealDocumentPanels.value.some(
      (panel) => panel.key === activeDocumentPanelKey.value,
    )
  )
    return activeDocumentPanelKey.value;

  return null;
});

const isDocumentPanelExpanded = (key: DealPreviewKind) =>
  resolvedActiveDocumentPanelKey.value === key;

const setActiveDocumentPanel = (key: DealPreviewKind) => {
  activeDocumentPanelKey.value =
    activeDocumentPanelKey.value === key ? null : key;
};

const toggleItemsOverviewCollapsed = () => {
  isItemsOverviewCollapsed.value = !isItemsOverviewCollapsed.value;

  if (isItemsOverviewCollapsed.value) activeDocumentPanelKey.value = null;
};

const getPreviewRouteName = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "apps-quotation-preview-id";
  if (kind === "proforma") return "apps-proforma-preview-id";

  return "apps-invoice-preview-id";
};

const openQuickDocumentPreview = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  const route = router.resolve({
    name: getPreviewRouteName(kind),
    params: { id: record.id },
    query: { quickPreview: "1" },
  });

  selectedPreviewDocument.value = {
    href: route.href,
    id: record.id,
    kind,
    title: record.quoteNumber || `${kind.toUpperCase()} #${record.id}`,
  };
  previewDialogVisible.value = true;
};

const openSelectedPreviewInPage = () => {
  if (!selectedPreviewDocument.value) return;

  router.push({
    name: getPreviewRouteName(selectedPreviewDocument.value.kind),
    params: { id: selectedPreviewDocument.value.id },
  });
};

const resolveProductSelectionKey = (product: {
  billingPeriod?: DealBillingPeriod | null;
  billingPeriodKey?: string | null;
  catalogueItemId?: string | null;
  cost?: number | null;
  dealSelectionKey?: string | null;
  hours?: number | null;
  title?: string | null;
}) => {
  const directKey = String(product.dealSelectionKey ?? "").trim();
  if (directKey) return directKey;

  const matches = selectableDocumentItems.value.filter((item) => {
    const sameTitle = item.name.trim() === String(product.title ?? "").trim();

    const sameCatalogueItemId =
      String(item.catalogueItemId ?? "") ===
      String(product.catalogueItemId ?? "");

    const sameHours = Number(item.quantity ?? 1) === Number(product.hours ?? 1);
    const sameCost = Number(item.unitPrice ?? 0) === Number(product.cost ?? 0);

    return sameTitle && sameCatalogueItemId && sameHours && sameCost;
  });

  return matches.length === 1 ? matches[0].selectionKey : "";
};

const resolveSelectableItemBillingPeriodKey = (
  selectionKey?: string | null,
) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return "";

  const selectableItem = selectableDocumentItems.value.find(
    (item) => item.selectionKey === normalizedSelectionKey,
  );

  if (!selectableItem) return "";

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  return itemMode === "retainer-period" || itemMode === "recurrent-period"
    ? getDealBillingPeriodKey(billingPeriod.value)
    : "";
};

const isPeriodBasedSelectableItem = (selectionKey?: string | null) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return false;

  const selectableItem = selectableDocumentItems.value.find(
    (item) => item.selectionKey === normalizedSelectionKey,
  );

  if (!selectableItem) return false;

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  return itemMode === "retainer-period" || itemMode === "recurrent-period";
};

const proformaUsageBySelectionKey = computed(() => {
  const usage = new Map<string, number>();

  proformasStore.items.forEach((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id)) return;

    record.purchasedProducts.forEach((product) => {
      const selectionKey = resolveProductSelectionKey(product);

      const usageKey = buildDealDocumentUsageKey(
        selectionKey,
        resolveStoredBillingPeriodKey(product),
      );

      if (!usageKey) return;

      usage.set(usageKey, (usage.get(usageKey) ?? 0) + 1);
    });
  });

  return usage;
});

const invoiceUsageBySelectionKey = computed(() => {
  const usage = new Map<string, number>();

  invoicesStore.items.forEach((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id)) return;

    record.purchasedProducts.forEach((product) => {
      const selectionKey = resolveProductSelectionKey(product);

      const usageKey = buildDealDocumentUsageKey(
        selectionKey,
        resolveStoredBillingPeriodKey(product),
      );

      if (!usageKey) return;

      usage.set(usageKey, (usage.get(usageKey) ?? 0) + 1);
    });
  });

  return usage;
});

const getDocumentUsage = (
  selectionKey?: string | null,
  billingPeriodKey?: string | null,
) => {
  const usageKey = buildDealDocumentUsageKey(selectionKey, billingPeriodKey);
  if (!usageKey) return { invoiceCount: 0, proformaCount: 0 };

  return {
    invoiceCount: invoiceUsageBySelectionKey.value.get(usageKey) ?? 0,
    proformaCount: proformaUsageBySelectionKey.value.get(usageKey) ?? 0,
  };
};

const isSelectionDocumentActionDisabled = (selectionKey?: string | null) => {
  if (isPeriodBasedSelectableItem(selectionKey)) return false;

  const usage = getDocumentUsage(
    selectionKey,
    resolveSelectableItemBillingPeriodKey(selectionKey),
  );

  if (selectedDocumentKind.value === "invoice") return usage.invoiceCount > 0;
  if (selectedDocumentKind.value === "proforma") return usage.proformaCount > 0;

  return false;
};

const getPeriodSelectionConflicts = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  if (!periodKey) return [] as DealDocumentSelectableItem[];

  return items.filter((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
      return false;

    const usage = getDocumentUsage(item.selectionKey, periodKey);

    if (selectedDocumentKind.value === "invoice") return usage.invoiceCount > 0;
    if (selectedDocumentKind.value === "proforma")
      return usage.proformaCount > 0;

    return false;
  });
};

const selectedDocumentParentItem = computed(
  () =>
    (props.deal.items || []).find(
      (item) =>
        String(item.id) === String(selectedDocumentParentItemId.value ?? ""),
    ) ?? null,
);

const isRetainerBillingPeriodSelection = computed(() => {
  if (!selectedDocumentParentItemId.value) return false;

  return Boolean(selectedDocumentParentItem.value);
});

const retainerBillingPeriods = computed(() => {
  if (
    isRetainerCatalogueType(selectedDocumentParentItem.value?.catalogueType)
  ) {
    return buildRetainerBillingPeriods(selectedDocumentParentItem.value);
  }

  if (
    isRecurrentCatalogueType(selectedDocumentParentItem.value?.catalogueType)
  ) {
    return buildRecurrentBillingPeriods(selectedDocumentParentItem.value);
  }

  return [] as DealBillingPeriod[];
});

const availableRetainerBillingPeriods = computed(() =>
  retainerBillingPeriods.value.filter(
    (period) =>
      !getPeriodSelectionConflicts(pendingDocumentItems.value, period).length,
  ),
);

const isRecurrentBillingPeriodSelection = computed(
  () =>
    isRetainerBillingPeriodSelection.value &&
    isRecurrentCatalogueType(selectedDocumentParentItem.value?.catalogueType),
);

const isMultiPeriodBillingSelection = computed(
  () =>
    isRetainerBillingPeriodSelection.value &&
    !externalDocumentSelectionKind.value,
);

const selectedRecurrentBillingPeriods = computed(() =>
  availableRetainerBillingPeriods.value.filter((period) =>
    selectedRecurrentBillingPeriodKeys.value.includes(period.key),
  ),
);

const billingPeriodPreviewLabel = computed(() => {
  if (isMultiPeriodBillingSelection.value) {
    return selectedRecurrentBillingPeriods.value.length
      ? selectedRecurrentBillingPeriods.value
          .map((period) => period.label)
          .join(", ")
      : "--";
  }

  return billingPeriodPreview.value?.label || "--";
});

const isBillingPeriodConfirmationDisabled = computed(() => {
  if (isMultiPeriodBillingSelection.value)
    return !selectedRecurrentBillingPeriods.value.length;

  return isRetainerBillingPeriodSelection.value && !billingPeriodPreview.value;
});

const findGoalSelectableItem = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) =>
  selectableDocumentItems.value.find(
    (item) =>
      String(item.id) === String(parentItem.id) &&
      item.selectionKey.endsWith(goal.overrideKey),
  ) ?? null;

const isRetainerGoal = (goal: DerivedGoal) =>
  goal.typeLabel === "Retainer Service";

const isRecurrentGoal = (goal: DerivedGoal) =>
  goal.typeLabel === "Recurrent Service";

const isBillableChildGoal = (goal: DerivedGoal) =>
  goal.typeLabel === "Phase" || isRecurrentGoal(goal);

const isCompactGoal = (goal: DerivedGoal) =>
  isRetainerGoal(goal) || isRecurrentGoal(goal);

const shouldShowPeriodSectionGoals = (
  item: DealItemWithPlan,
  section: DerivedSection,
  sectionIndex: number,
) => {
  if (!section.billingPeriod) return true;

  return !isRecurrentParentDealItem(item) || sectionIndex === 0;
};

const getVisibleSectionGoals = (
  item: DealItemWithPlan,
  section: DerivedSection,
  sectionIndex: number,
) =>
  shouldShowPeriodSectionGoals(item, section, sectionIndex)
    ? section.goals
    : [];

const shouldRenderGoalSection = (
  item: DealItemWithPlan,
  section: DerivedSection,
  sectionIndex: number,
) =>
  getVisibleSectionGoals(item, section, sectionIndex).length > 0 ||
  Boolean(section.billingPeriod);

const resolveGoalBillingPeriodKey = (
  selectableItem: DealDocumentSelectableItem | null,
  period?: DealBillingPeriod | null,
) => {
  if (!selectableItem) return "";

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  if (itemMode !== "retainer-period" && itemMode !== "recurrent-period") {
    return resolveSelectableItemBillingPeriodKey(selectableItem.selectionKey);
  }

  return getDealBillingPeriodKey(period ?? billingPeriod.value);
};

const getGoalDocumentUsage = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  period?: DealBillingPeriod | null,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);

  return getDocumentUsage(
    selectableItem?.selectionKey,
    resolveGoalBillingPeriodKey(selectableItem, period),
  );
};

const getGoalInvoiceState = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
) => {
  if (goal.typeLabel !== "Phase") return null;

  const selectableItem = findGoalSelectableItem(parentItem, goal);
  const selectionKey = selectableItem?.selectionKey;
  if (!selectionKey) return "Not invoiced";

  const billingPeriodKey = resolveSelectableItemBillingPeriodKey(selectionKey);
  const usageKey = buildDealDocumentUsageKey(selectionKey, billingPeriodKey);
  if (!usageKey) return "Not invoiced";

  const matchingInvoices = invoicesStore.items.filter((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
      return false;

    return record.purchasedProducts.some((product) => {
      const productSelectionKey = resolveProductSelectionKey(product);

      const productUsageKey = buildDealDocumentUsageKey(
        productSelectionKey,
        resolveStoredBillingPeriodKey(product),
      );

      return productUsageKey === usageKey;
    });
  });

  if (!matchingInvoices.length) return "Not invoiced";

  const isPaid = matchingInvoices.some(
    (record) => String(record.quotation.quotationStatus) === "Paid",
  );

  return isPaid ? "Invoiced · Paid" : "Invoiced · Unpaid";
};

const getSectionInvoiceState = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  if (!section.billingPeriod) return null;

  const recurrentSectionBillingKey = isRecurrentParentDealItem(parentItem)
    ? getDealBillingPeriodKey(section.billingPeriod)
    : "";

  if (recurrentSectionBillingKey) {
    const usage = getDocumentUsage(
      `item-${parentItem.id}`,
      recurrentSectionBillingKey,
    );

    if (!usage.invoiceCount) return "Not invoiced";

    const matchingInvoices = invoicesStore.items.filter((record) => {
      if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
        return false;

      return record.purchasedProducts.some((product) => {
        const billingKey = resolveStoredBillingPeriodKey(product);
        const selectionKey = resolveProductSelectionKey(product);

        return (
          billingKey === recurrentSectionBillingKey &&
          selectionKey === `item-${parentItem.id}`
        );
      });
    });

    const isPaid = matchingInvoices.some(
      (record) => String(record.quotation.quotationStatus) === "Paid",
    );

    return isPaid ? "Invoiced · Paid" : "Invoiced · Unpaid";
  }

  const usageByGoal = section.goals.map((goal) =>
    getGoalDocumentUsage(parentItem, goal, section.billingPeriod),
  );

  const hasInvoice = usageByGoal.some((usage) => usage.invoiceCount > 0);
  if (!hasInvoice) return "Not invoiced";

  const periodKey = getDealBillingPeriodKey(section.billingPeriod);

  const matchingInvoices = invoicesStore.items.filter((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
      return false;

    return record.purchasedProducts.some((product) => {
      const billingKey = resolveStoredBillingPeriodKey(product);
      if (billingKey !== periodKey) return false;

      const selectionKey = resolveProductSelectionKey(product);

      return section.goals.some((goal) => {
        const selectableItem = findGoalSelectableItem(parentItem, goal);

        return selectableItem?.selectionKey === selectionKey;
      });
    });
  });

  const isPaid = matchingInvoices.some(
    (record) => String(record.quotation.quotationStatus) === "Paid",
  );

  return isPaid ? "Invoiced · Paid" : "Invoiced · Unpaid";
};

const getSectionSelectableItems = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) =>
  section.goals
    .map((goal) => findGoalSelectableItem(parentItem, goal))
    .filter((item): item is DealDocumentSelectableItem =>
      Boolean(
        item &&
        (!section.billingPeriod || isRecurrentParentDealItem(parentItem)),
      ),
    );

const getSectionDocumentTargetItems = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const sectionItems = getSectionSelectableItems(parentItem, section);

  if (!section.billingPeriod || !isRecurrentParentDealItem(parentItem)) {
    return sectionItems;
  }

  const rootItem = getItemById(parentItem.id);
  if (!rootItem) return [] as DealDocumentSelectableItem[];

  return [
    {
      ...sectionItems[0],
      ...rootItem,
      catalogueType: rootItem.catalogueType,
      isAutoBillable: true,
      isBillableRoot: true,
      isGenerated: false,
      isRootReplacement: undefined,
      lineConstraintsOverride: null,
      parentName: null,
      selectionKey: `item-${rootItem.id}`,
    },
  ];
};

const getSectionDocumentUsage = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const usage = getSectionDocumentTargetItems(parentItem, section).map((item) =>
    getDocumentUsage(
      item.selectionKey,
      resolveGoalBillingPeriodKey(item, section.billingPeriod),
    ),
  );

  return {
    invoiceCount: usage.reduce((sum, entry) => sum + entry.invoiceCount, 0),
    proformaCount: usage.reduce((sum, entry) => sum + entry.proformaCount, 0),
  };
};

const isSectionDocumentActionDisabled = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const usage = getSectionDocumentUsage(parentItem, section);

  if (kind === "invoice") return usage.invoiceCount > 0;

  return usage.proformaCount > 0;
};

const openSectionDocumentPage = async (
  kind: Extract<DealDocumentKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const sectionItems = getSectionDocumentTargetItems(parentItem, section);

  if (!sectionItems.length) {
    notifications.push(
      "This period has no billable lines yet.",
      "warning",
      3000,
    );

    return;
  }

  const preferredPeriod = section.billingPeriod ?? null;

  if (preferredPeriod) {
    billingPeriod.value = preferredPeriod;
    syncBillingPeriodDraft(preferredPeriod);
  }

  await saveAndNavigateDocumentDraft(kind, sectionItems);
};

const openSectionExternalDocumentDialog = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const sectionItems = getSectionDocumentTargetItems(parentItem, section);

  if (!sectionItems.length) {
    notifications.push(
      "This period has no billable lines yet.",
      "warning",
      3000,
    );

    return;
  }

  openExternalDocumentDialog(kind, sectionItems, section.billingPeriod ?? null);
};

const isGoalProformaActionDisabled = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  period?: DealBillingPeriod | null,
) =>
  isRetainerGoal(goal) ||
  getGoalDocumentUsage(parentItem, goal, period).proformaCount > 0;

const isGoalInvoiceActionDisabled = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  period?: DealBillingPeriod | null,
) =>
  isRetainerGoal(goal) ||
  getGoalDocumentUsage(parentItem, goal, period).invoiceCount > 0;

const filteredSelectableDocumentItems = computed(() => {
  const filteredItems = filterDealDocumentItemsByBillingMode(
    selectableDocumentItems.value,
    effectiveBillingMode.value,
  );

  const normalizedItems =
    effectiveBillingMode.value === "mixed-manual" ||
    effectiveBillingMode.value === "recurrent-period" ||
    effectiveBillingMode.value === "retainer-period"
      ? Array.from(
          new Map(
            filteredItems.map((item) => {
              if (
                item.catalogueType !== "Recurrent Service Line" &&
                item.catalogueType !== "Retainer Service Line"
              )
                return [item.selectionKey, item] as const;

              const parentItem =
                item.catalogueType === "Retainer Service Line"
                  ? buildRetainerDocumentTargetItem(item)
                  : buildRecurrentDocumentTargetItem(item);

              return [
                parentItem?.selectionKey ?? item.selectionKey,
                parentItem ?? item,
              ] as const;
            }),
          ).values(),
        )
      : filteredItems;

  if (selectedDocumentParentItemId.value) {
    return normalizedItems.filter(
      (item) => String(item.id) === selectedDocumentParentItemId.value,
    );
  }

  return normalizedItems;
});

const billingModeOptions = computed(() => {
  const availableModes = Array.from(
    new Set(
      billableRootItems.value
        .map((item) => resolveDealDocumentBillingModeForItem(item))
        .filter((mode) => mode !== "empty" && mode !== "mixed-manual"),
    ),
  ) as DealDocumentBillingMode[];

  return availableModes.map((mode) => ({
    description:
      mode === "simple-root"
        ? "Bill directly from simple top-level items."
        : mode === "contractual-stage"
          ? "Bill by contractual stages."
          : mode === "retainer-period"
            ? "Bill retainer services for a selected period."
            : "Bill recurrent services for a selected period.",
    title:
      mode === "simple-root"
        ? "Simple items"
        : mode === "contractual-stage"
          ? "Contractual stages"
          : mode === "retainer-period"
            ? "Retainer period"
            : "Recurrent period",
    value: mode,
  }));
});

const selectableGroups = computed(() => {
  const groups = new Map<
    string,
    {
      description: string;
      items: DealDocumentSelectableItem[];
      key: string;
      label: string;
    }
  >();

  for (const item of filteredSelectableDocumentItems.value) {
    const description =
      item.groupKey === "billable-root"
        ? "These rows drive quotation and direct invoice/proforma eligibility."
        : "Nested rows are available only through manual selection.";

    const existing = groups.get(item.groupKey);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(item.groupKey, {
      description,
      items: [item],
      key: item.groupKey,
      label: item.groupLabel,
    });
  }

  return Array.from(groups.values());
});

const selectedDocumentItems = computed(() => {
  const selected = new Set(selectedItemIds.value.map((value) => String(value)));

  return filteredSelectableDocumentItems.value.filter(
    (item) =>
      selected.has(String(item.selectionKey)) &&
      !isSelectionDocumentActionDisabled(item.selectionKey),
  );
});

const selectionDialogTitle = computed(() => {
  if (selectedDocumentKind.value === "invoice") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Invoice";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Item for Invoice";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Items for Invoice";

    return "Select Items for Invoice";
  }

  if (selectedDocumentKind.value === "proforma") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Proforma";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Item for Proforma";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Items for Proforma";

    return "Select Items for Proforma";
  }

  return "Select Items";
});

const selectionDialogIntro = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage")
    return "Select one or more contractual stages to include in this document.";

  if (effectiveBillingMode.value === "retainer-period")
    return "Select one retainer item, then choose the period you want to bill.";

  if (effectiveBillingMode.value === "recurrent-period")
    return "Select one recurrent item to choose the period you want to bill.";

  return "Select one or more items to include in this document.";
});

const selectionDialogHint = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage")
    return "Contractual deals bill at stage level. Choose only the stages you want billed in this document.";

  if (effectiveBillingMode.value === "retainer-period")
    return "Retainer billing is period-based. Choose the retainer item first, then choose the period you want to bill.";

  if (effectiveBillingMode.value === "recurrent-period")
    return "Recurrent billing is period-based. Choose the recurrent item first, then choose the period you want to bill.";

  if (effectiveBillingMode.value === "mixed-manual")
    return "This deal mixes billing bases. Choose any combination of billable rows for this document.";

  return "No rows are preselected. Choose only the rows you want billed.";
});

const getExpandableServiceRecord = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  const sourceItem = item ? (getItemById(item.id) ?? item) : null;
  if (!sourceItem?.catalogueItemId) return null;

  const record = cataloguesStore.recordById(
    sourceItem.catalogueItemId,
    sourceItem.catalogueType || undefined,
  );

  if (
    record?.type === "Contractual Service" ||
    record?.type === "Retainer Service" ||
    record?.type === "Reccurent Service"
  )
    return record;

  return null;
};

const getEditableChildLabel = (item?: DealItem | DealItemWithPlan | null) => {
  const record = getExpandableServiceRecord(item);

  if (record?.type === "Contractual Service") return "Phase";
  if (record?.type === "Retainer Service") return "Retainer Service";
  if (record?.type === "Reccurent Service") return "Recurrent Service";

  return "Child";
};

const phaseDialogEntityLabel = computed(() =>
  phaseDraft.parentItemId
    ? getEditableChildLabel(getItemById(phaseDraft.parentItemId))
    : "Child",
);

const phaseDialogTitle = computed(
  () =>
    `${phaseDraft.customPhaseId ? "Edit" : "Add"} ${phaseDialogEntityLabel.value}`,
);

const isRemovableChildGoal = (goal: DerivedGoal) =>
  goal.typeLabel === "Phase" ||
  goal.typeLabel === "Retainer Service" ||
  goal.typeLabel === "Recurrent Service";

const formatItemType = (value?: string | null) => value || "Unknown";

const itemRowOffset = (_item: DealDocumentSelectableItem) => {
  return "0px";
};

const nextIdForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return quotationsStore.nextId();
  if (kind === "proforma") return proformasStore.nextId();

  return invoicesStore.nextId();
};

const routeNameForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return "apps-quotation-add";
  if (kind === "proforma") return "apps-proforma-add";

  return "apps-invoice-add";
};

const resetDocumentWorkflowState = () => {
  billingModeDialogVisible.value = false;
  billingPeriodDialogVisible.value = false;
  selectionDialogVisible.value = false;
  externalDocumentSelectionKind.value = null;
  pendingDocumentItems.value = [];
  pendingBillingPeriodGroups.value = [];
  activeBillingPeriodGroupIndex.value = 0;
  resetBillingPeriodPrices();
  Object.keys(billingPeriodAssignments).forEach((key) => {
    delete billingPeriodAssignments[key];
  });
  selectedBillingMode.value = null;
  selectedDocumentKind.value = null;
  selectedDocumentParentItemId.value = null;
  selectedRetainerBillingPeriodKey.value = null;
  selectedRecurrentBillingPeriodKeys.value = [];
  selectedItemIds.value = [];
};

const selectionNeedsBillingPeriod = (items: DealDocumentSelectableItem[]) =>
  items.some((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);

    return itemMode === "retainer-period" || itemMode === "recurrent-period";
  });

const buildPendingBillingPeriodGroups = (
  items: DealDocumentSelectableItem[],
) => {
  const groups = new Map<string, PendingBillingPeriodGroup>();

  items.forEach((item) => {
    const mode = resolveDealDocumentBillingModeForItem(item);
    if (mode !== "retainer-period" && mode !== "recurrent-period") return;

    const parentItemId = String(item.id);
    const key = `${mode}:${parentItemId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    groups.set(key, {
      items: [item],
      mode,
      parentItemId,
    });
  });

  return Array.from(groups.values());
};

const activeBillingPeriodGroup = computed<PendingBillingPeriodGroup | null>(
  () =>
    pendingBillingPeriodGroups.value[activeBillingPeriodGroupIndex.value] ??
    null,
);

const applyActiveBillingPeriodGroup = () => {
  const activeGroup = activeBillingPeriodGroup.value;
  selectedDocumentParentItemId.value = activeGroup?.parentItemId ?? null;

  const defaultPeriodKey =
    availableRetainerBillingPeriods.value[0]?.key ?? null;

  selectedRetainerBillingPeriodKey.value = defaultPeriodKey;
  selectedRecurrentBillingPeriodKeys.value =
    isMultiPeriodBillingSelection.value && defaultPeriodKey
      ? [defaultPeriodKey]
      : [];

  initializeBillingPeriodPrices(pendingBillingPeriodItems.value);
};

const pendingBillingPeriodItems = computed(
  () =>
    activeBillingPeriodGroup.value?.items ||
    pendingDocumentItems.value.filter((item) => {
      const itemMode = resolveDealDocumentBillingModeForItem(item);

      return itemMode === "retainer-period" || itemMode === "recurrent-period";
    }),
);

const getOverrideKeyFromSelectionKey = (selectionKey: string) => {
  const match = selectionKey.match(/^item-\d+-(.+)$/);

  return match?.[1] ?? null;
};

const getStoredBillingPeriodPrice = (
  item: DealDocumentSelectableItem,
  period: DealBillingPeriod,
) => {
  const overrideKey = getOverrideKeyFromSelectionKey(item.selectionKey);
  const periodKey = getDealBillingPeriodKey(period);
  if (!overrideKey || !periodKey) return null;

  const value =
    item.subItemOverrides?.[overrideKey]?.periodUnitPrices?.[periodKey];

  if (value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
};

const resetBillingPeriodPrices = () => {
  Object.keys(billingPeriodPrices).forEach((key) => {
    delete billingPeriodPrices[key];
  });
};

const initializeBillingPeriodPrices = (
  items: DealDocumentSelectableItem[],
  period = billingPeriod.value,
) => {
  resetBillingPeriodPrices();

  items.forEach((item) => {
    billingPeriodPrices[item.selectionKey] = Number(
      getStoredBillingPeriodPrice(item, period) ?? item.unitPrice ?? 0,
    );
  });
};

const applyBillingPeriodPricing = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  if (!periodKey) return items;

  const updatedPrices = new Map<string, number>();

  items.forEach((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
      return;

    const numeric = Number(billingPeriodPrices[item.selectionKey]);

    updatedPrices.set(
      item.selectionKey,
      Number.isFinite(numeric) ? numeric : 0,
    );
  });

  if (!updatedPrices.size) return items;

  const nextItems = (props.deal.items || []).map((item) => {
    const nextOverrides = { ...(item.subItemOverrides || {}) };
    let hasChanges = false;

    Object.keys(nextOverrides).forEach((overrideKey) => {
      const selectionKey = `item-${item.id}-${overrideKey}`;
      const nextPrice = updatedPrices.get(selectionKey);
      if (nextPrice === undefined) return;

      const currentOverride = nextOverrides[overrideKey] || {};

      nextOverrides[overrideKey] = {
        ...currentOverride,
        unitPrice: nextPrice,
        periodUnitPrices: {
          ...(currentOverride.periodUnitPrices || {}),
          [periodKey]: nextPrice,
        },
      };
      hasChanges = true;
    });

    return hasChanges
      ? {
          ...item,
          subItemOverrides: nextOverrides,
        }
      : item;
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });

  return items.map((item) => {
    const nextPrice = updatedPrices.get(item.selectionKey);
    if (nextPrice === undefined) return item;

    return {
      ...item,
      unitPrice: nextPrice,
    };
  });
};

const saveAndNavigateDocumentDraft = async (
  kind: DealDocumentKind,
  selectedItems: DealDocumentSelectableItem[],
  selectedBillingPeriods?: DealBillingPeriod[] | null,
  selectedBillingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null,
) => {
  if (!selectedItems.length) {
    notifications.push("This deal has no billable items yet", "warning", 2500);

    return;
  }

  const draft = buildDealDocumentDraftRecord(kind, {
    billingPeriods: selectedBillingPeriods?.length
      ? selectedBillingPeriods
      : null,
    billingPeriodAssignments: selectedBillingPeriodAssignments || null,
    billingPeriod: selectionNeedsBillingPeriod(selectedItems)
      ? (selectedBillingPeriods?.[0] ?? billingPeriod.value)
      : null,
    contact: contact.value,
    deal: props.deal,
    financial: configStore.financial,
    legal: configStore.legal,
    nextId: nextIdForDocument(kind),
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    selectedItems,
  });

  saveDealDocumentDraft(kind, draft);

  await router.push({
    name: routeNameForDocument(kind),
    query: { dealDraft: "1" },
  });

  resetDocumentWorkflowState();
};

const openGoalDocumentPage = async (
  kind: Extract<DealDocumentKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  preferredPeriod?: DealBillingPeriod | null,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);

  if (!selectableItem) {
    notifications.push(
      "Could not resolve this item for document creation.",
      "warning",
      3000,
    );

    return;
  }

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);

  if (itemMode === "recurrent-period") {
    pendingDocumentItems.value = [selectableItem];
    selectedDocumentParentItemId.value = String(parentItem.id);
    selectedRetainerBillingPeriodKey.value =
      preferredPeriod?.key ??
      availableRetainerBillingPeriods.value[0]?.key ??
      null;
    openBillingPeriodDialog(kind, "recurrent-period");

    return;
  }

  await saveAndNavigateDocumentDraft(kind, [selectableItem]);
};

const setExternalDocumentTargets = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod | null = null,
) => {
  selectedExternalDocumentItems.value = [...items];
  selectedExternalDocumentBillingPeriod.value = period ? { ...period } : null;
};

const openExternalDocumentSelectionDialog = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  mode: DealDocumentBillingMode = billingMode.value,
) => {
  externalDocumentSelectionKind.value = kind;
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  if (mode !== "retainer-period" && mode !== "recurrent-period") {
    selectedDocumentParentItemId.value = null;
    selectedRetainerBillingPeriodKey.value = null;
  }
  selectedItemIds.value = [];
  selectionDialogVisible.value = true;
};

const openSelectionDialog = (
  kind: DealDocumentKind,
  mode: DealDocumentBillingMode = billingMode.value,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  if (mode !== "retainer-period" && mode !== "recurrent-period") {
    selectedDocumentParentItemId.value = null;
    selectedRetainerBillingPeriodKey.value = null;
  }
  selectedItemIds.value = [];
  selectionDialogVisible.value = true;
};

const openExternalDocumentFlow = (kind: DealPreviewKind) => {
  if (kind === "quotation") {
    if (!quotationItems.value.length) {
      notifications.push(
        "This deal has no billable items yet",
        "warning",
        2500,
      );

      return;
    }

    openExternalDocumentDialog(kind, quotationItems.value);

    return;
  }

  if (billingMode.value === "simple-root") {
    if (!billableRootItems.value.length) {
      notifications.push(
        "This deal has no billable items yet",
        "warning",
        2500,
      );

      return;
    }

    openExternalDocumentDialog(kind, billableRootItems.value);

    return;
  }

  if (billingMode.value === "contractual-stage") {
    openExternalDocumentSelectionDialog(kind, "contractual-stage");

    return;
  }

  if (billingMode.value === "retainer-period") {
    openExternalDocumentSelectionDialog(kind, "retainer-period");

    return;
  }

  if (billingMode.value === "recurrent-period") {
    if (!recurrentParentItems.value.length) {
      notifications.push(
        "This deal has no recurrent item ready for billing.",
        "warning",
        3000,
      );

      return;
    }

    if (recurrentParentItems.value.length > 1) {
      openExternalDocumentSelectionDialog(kind, "recurrent-period");

      return;
    }

    const parentItem = recurrentParentItems.value[0];

    openRecurrentExternalDocumentDialog(kind, parentItem);

    return;
  }

  openExternalDocumentSelectionDialog(kind, "mixed-manual");
};

const openGoalExternalDocumentDialog = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  preferredPeriod?: DealBillingPeriod | null,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);

  if (!selectableItem) {
    notifications.push(
      "Could not resolve this item for external document import.",
      "warning",
      3000,
    );

    return;
  }

  const itemMode = resolveDealDocumentBillingModeForItem(selectableItem);
  if (itemMode === "recurrent-period") {
    pendingDocumentItems.value = [selectableItem];
    selectedDocumentParentItemId.value = String(parentItem.id);
    selectedRetainerBillingPeriodKey.value =
      preferredPeriod?.key ??
      availableRetainerBillingPeriods.value[0]?.key ??
      null;
    externalDocumentSelectionKind.value = kind;
    selectedDocumentKind.value = kind;
    selectedBillingMode.value = "recurrent-period";
    initializeBillingPeriodPrices([selectableItem]);
    billingPeriodDialogVisible.value = true;

    return;
  }

  const period = itemMode === "retainer-period" ? billingPeriod.value : null;

  openExternalDocumentDialog(kind, [selectableItem], period);
};

const openBillingPeriodDialog = (
  kind: DealDocumentKind,
  mode: Extract<
    DealDocumentBillingMode,
    "retainer-period" | "recurrent-period"
  >,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  if (selectedDocumentParentItemId.value) {
    if (
      !pendingBillingPeriodGroups.value.length &&
      pendingDocumentItems.value.length
    ) {
      pendingBillingPeriodGroups.value = [
        {
          items: [...pendingBillingPeriodItems.value],
          mode,
          parentItemId: String(selectedDocumentParentItemId.value),
        },
      ];
      activeBillingPeriodGroupIndex.value = 0;
    }

    applyActiveBillingPeriodGroup();
  } else {
    selectedRecurrentBillingPeriodKeys.value = [];
    syncBillingPeriodDraft();
  }
  billingPeriodDialogVisible.value = true;
};

const confirmBillingPeriod = () => {
  if (!selectedDocumentKind.value) return;

  const nextBillingPeriods = commitBillingPeriods();
  if (!nextBillingPeriods.length) {
    notifications.push("Select a billing period first", "warning", 2500);

    return;
  }

  const nextBillingPeriod = nextBillingPeriods[0];

  if (!getDealBillingPeriodKey(nextBillingPeriod)) {
    notifications.push("Select a billing period first", "warning", 2500);

    return;
  }

  const conflictingPeriod = nextBillingPeriods.find(
    (period) =>
      getPeriodSelectionConflicts(pendingDocumentItems.value, period).length,
  );

  const conflictingItems = conflictingPeriod
    ? getPeriodSelectionConflicts(pendingDocumentItems.value, conflictingPeriod)
    : [];

  if (conflictingItems.length) {
    const conflictingNames = conflictingItems
      .slice(0, 2)
      .map((item) => item.name)
      .join(", ");

    const conflictSuffix = conflictingItems.length > 2 ? " and more" : "";

    notifications.push(
      `${conflictingNames}${conflictSuffix} already used for ${getDealBillingPeriodLabel(conflictingPeriod)}.`,
      "warning",
      3500,
    );

    return;
  }

  pendingBillingPeriodItems.value.forEach((item) => {
    billingPeriodAssignments[item.selectionKey] = nextBillingPeriods.map(
      (period) => ({
        ...period,
      }),
    );
  });

  const hasNextGroup =
    activeBillingPeriodGroupIndex.value <
    pendingBillingPeriodGroups.value.length - 1;

  if (hasNextGroup) {
    activeBillingPeriodGroupIndex.value += 1;
    applyActiveBillingPeriodGroup();

    return;
  }

  billingPeriodDialogVisible.value = false;

  if (pendingDocumentItems.value.length) {
    const kind = selectedDocumentKind.value;

    const items = isMultiPeriodBillingSelection.value
      ? [...pendingDocumentItems.value]
      : nextBillingPeriods.flatMap((period) =>
          applyBillingPeriodPricing([...pendingDocumentItems.value], period),
        );

    pendingDocumentItems.value = [];

    if (externalDocumentSelectionKind.value) {
      openExternalDocumentDialog(
        externalDocumentSelectionKind.value,
        items,
        nextBillingPeriod,
      );
      resetDocumentWorkflowState();

      return;
    }

    void saveAndNavigateDocumentDraft(
      kind,
      items,
      nextBillingPeriods,
      billingPeriodAssignments,
    );

    return;
  }

  openSelectionDialog(selectedDocumentKind.value, effectiveBillingMode.value);
};

const confirmBillingModeSelection = () => {
  if (!selectedDocumentKind.value || !selectedBillingMode.value) {
    notifications.push("Choose a billing basis first", "warning", 2500);

    return;
  }

  billingModeDialogVisible.value = false;

  openSelectionDialog(selectedDocumentKind.value, selectedBillingMode.value);
};

const closeSelectionDialog = () => {
  selectionDialogVisible.value = false;
  if (!billingModeDialogVisible.value && !billingPeriodDialogVisible.value) {
    selectedBillingMode.value = null;
    selectedDocumentKind.value = null;
    selectedDocumentParentItemId.value = null;
  }
  selectedItemIds.value = [];
};

const confirmSelectedDocumentItems = async () => {
  if (!selectedDocumentKind.value || !selectedDocumentItems.value.length)
    return;

  const kind = selectedDocumentKind.value;
  const items = [...selectedDocumentItems.value];

  if (selectionNeedsBillingPeriod(items)) {
    const groups = buildPendingBillingPeriodGroups(items);
    if (!groups.length) return;

    pendingDocumentItems.value = items;
    pendingBillingPeriodGroups.value = groups;
    activeBillingPeriodGroupIndex.value = 0;
    Object.keys(billingPeriodAssignments).forEach((key) => {
      delete billingPeriodAssignments[key];
    });
    applyActiveBillingPeriodGroup();
    selectionDialogVisible.value = false;
    billingPeriodDialogVisible.value = true;

    return;
  }

  selectionDialogVisible.value = false;

  if (externalDocumentSelectionKind.value) {
    openExternalDocumentDialog(externalDocumentSelectionKind.value, items);
    resetDocumentWorkflowState();

    return;
  }

  await saveAndNavigateDocumentDraft(kind, items);
};

const openDocumentPage = async (kind: DealDocumentKind) => {
  if (kind !== "quotation") {
    if (billingMode.value === "simple-root") {
      await saveAndNavigateDocumentDraft(kind, billableRootItems.value);

      return;
    }

    if (billingMode.value === "contractual-stage") {
      openSelectionDialog(kind, "contractual-stage");

      return;
    }

    if (billingMode.value === "retainer-period") {
      openSelectionDialog(kind, "retainer-period");

      return;
    }

    if (billingMode.value === "recurrent-period") {
      if (!recurrentParentItems.value.length) {
        notifications.push(
          "This deal has no recurrent item ready for billing.",
          "warning",
          3000,
        );

        return;
      }

      if (recurrentParentItems.value.length > 1) {
        openSelectionDialog(kind, "recurrent-period");

        return;
      }

      const parentItem = recurrentParentItems.value[0];

      await openRecurrentDocumentPage(kind, parentItem);

      return;
    }

    openSelectionDialog(kind, "mixed-manual");

    return;
  }

  const selectedItems = quotationItems.value;

  if (selectedItems.length) {
    await saveAndNavigateDocumentDraft(kind, selectedItems);

    return;
  }

  await router.push({ name: routeNameForDocument(kind) });
};

const notifyRetainerPeriodsExhausted = () => {
  notifications.push(
    "No more periods are billable for this retainer.",
    "warning",
    3000,
  );
};

const openRetainerDocumentPage = async (
  kind: DealDocumentKind,
  parentItem: DealItemWithPlan,
) => {
  if (!isRetainerParentDealItem(parentItem)) return;

  if (kind === "quotation") {
    await openDocumentPage(kind);

    return;
  }

  if (!hasRetainerRemainingPeriods(parentItem)) {
    notifyRetainerPeriodsExhausted();

    return;
  }

  const targetItem = buildRetainerDocumentTargetItem(parentItem);
  if (!targetItem) {
    notifications.push(
      "This retainer has no billable periods yet.",
      "warning",
      3000,
    );

    return;
  }

  pendingDocumentItems.value = [targetItem];
  selectedDocumentParentItemId.value = String(parentItem.id);
  selectedRetainerBillingPeriodKey.value =
    availableRetainerBillingPeriods.value[0]?.key ?? null;
  openBillingPeriodDialog(kind, "retainer-period");
};

const buildRetainerDocumentTargetItem = (parentItem: {
  id: string | number;
}): DealDocumentSelectableItem | null => {
  const rootItem = getItemById(parentItem.id);
  if (!rootItem) return null;

  return {
    ...rootItem,
    expansionSummary: null,
    groupKey: "billable-root",
    groupLabel: "Billable Root Items",
    hint: null,
    isAutoBillable: true,
    isBillableRoot: true,
    isGenerated: false,
    parentName: null,
    selectionKey: `item-${rootItem.id}`,
  };
};

const buildRecurrentDocumentTargetItem = (parentItem: {
  id: string | number;
}): DealDocumentSelectableItem | null => {
  const rootItem = getItemById(parentItem.id);
  if (!rootItem) return null;

  return {
    ...rootItem,
    expansionSummary: null,
    groupKey: "billable-root",
    groupLabel: "Billable Root Items",
    hint: null,
    isAutoBillable: true,
    isBillableRoot: true,
    isGenerated: false,
    parentName: null,
    selectionKey: `item-${rootItem.id}`,
  };
};

const openRecurrentDocumentPage = async (
  kind: Extract<DealDocumentKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
) => {
  if (!isRecurrentParentDealItem(parentItem)) return;

  if (!hasRecurrentRemainingPeriods(parentItem)) {
    notifications.push(
      "No more periods are billable for this recurrent item.",
      "warning",
      3000,
    );

    return;
  }

  const targetItem = buildRecurrentDocumentTargetItem(parentItem);
  if (!targetItem) {
    notifications.push(
      "This recurrent item has no billable periods yet.",
      "warning",
      3000,
    );

    return;
  }

  pendingDocumentItems.value = [targetItem];
  selectedDocumentParentItemId.value = String(parentItem.id);
  selectedRetainerBillingPeriodKey.value =
    availableRetainerBillingPeriods.value[0]?.key ?? null;
  openBillingPeriodDialog(kind, "recurrent-period");
};

const openRetainerExternalDocumentDialog = (
  kind: DealPreviewKind,
  parentItem: DealItemWithPlan,
) => {
  if (!isRetainerParentDealItem(parentItem)) return;

  if (kind === "quotation") {
    openExternalDocumentFlow(kind);

    return;
  }

  if (!hasRetainerRemainingPeriods(parentItem)) {
    notifyRetainerPeriodsExhausted();

    return;
  }

  const targetItem = buildRetainerDocumentTargetItem(parentItem);
  if (!targetItem) {
    notifications.push(
      "This retainer has no billable periods yet.",
      "warning",
      3000,
    );

    return;
  }

  pendingDocumentItems.value = [targetItem];
  selectedDocumentParentItemId.value = String(parentItem.id);
  selectedRetainerBillingPeriodKey.value =
    availableRetainerBillingPeriods.value[0]?.key ?? null;
  externalDocumentSelectionKind.value = kind;
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = "retainer-period";
  initializeBillingPeriodPrices([targetItem]);
  billingPeriodDialogVisible.value = true;
};

const openRecurrentExternalDocumentDialog = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
) => {
  if (!isRecurrentParentDealItem(parentItem)) return;

  if (!hasRecurrentRemainingPeriods(parentItem)) {
    notifications.push(
      "No more periods are billable for this recurrent item.",
      "warning",
      3000,
    );

    return;
  }

  const targetItem = buildRecurrentDocumentTargetItem(parentItem);
  if (!targetItem) {
    notifications.push(
      "This recurrent item has no billable periods yet.",
      "warning",
      3000,
    );

    return;
  }

  pendingDocumentItems.value = [targetItem];
  selectedDocumentParentItemId.value = String(parentItem.id);
  selectedRetainerBillingPeriodKey.value =
    availableRetainerBillingPeriods.value[0]?.key ?? null;
  externalDocumentSelectionKind.value = kind;
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = "recurrent-period";
  initializeBillingPeriodPrices([targetItem]);
  billingPeriodDialogVisible.value = true;
};

const isRetainerParentDocumentActionDisabled = (
  kind: DealPreviewKind,
  parentItem: DealItemWithPlan,
) => {
  if (!isRetainerParentDealItem(parentItem)) return false;
  if (kind === "quotation") return false;

  return !hasRetainerRemainingPeriods(parentItem);
};

const retainerParentItems = computed(() =>
  dealItemsWithPlan.value.filter((item) => isRetainerParentDealItem(item)),
);

const recurrentParentItems = computed(() =>
  dealItemsWithPlan.value.filter((item) => isRecurrentParentDealItem(item)),
);

const getSingleRetainerParentItem = () => {
  if (retainerParentItems.value.length === 1)
    return retainerParentItems.value[0];

  if (!retainerParentItems.value.length) {
    notifications.push(
      "This deal has no retainer ready for billing.",
      "warning",
      3000,
    );

    return null;
  }

  notifications.push(
    "Choose the mother retainer row to create or attach documents.",
    "info",
    3000,
  );

  return null;
};

const getSingleRecurrentParentItem = () => {
  if (recurrentParentItems.value.length === 1)
    return recurrentParentItems.value[0];

  if (!recurrentParentItems.value.length) {
    notifications.push(
      "This deal has no recurrent item ready for billing.",
      "warning",
      3000,
    );

    return null;
  }

  notifications.push(
    "Choose the recurrent item period you want to bill.",
    "info",
    3000,
  );

  return null;
};

const isSingleModeRetainerPanelFlow = computed(
  () =>
    billingModeOptions.value.length === 1 &&
    billingModeOptions.value[0]?.value === "retainer-period",
);

const openPanelDocumentPage = async (kind: DealDocumentKind) => {
  if (!isSingleModeRetainerPanelFlow.value) {
    await openDocumentPage(kind);

    return;
  }

  const parentItem = getSingleRetainerParentItem();
  if (!parentItem) return;

  await openRetainerDocumentPage(kind, parentItem);
};

const openPanelExternalDocumentFlow = (kind: DealPreviewKind) => {
  if (!isSingleModeRetainerPanelFlow.value) {
    openExternalDocumentFlow(kind);

    return;
  }

  const parentItem = getSingleRetainerParentItem();
  if (!parentItem) return;

  openRetainerExternalDocumentDialog(kind, parentItem);
};

const isRetainerPanelDocumentActionDisabled = (kind: DealPreviewKind) => {
  if (!isSingleModeRetainerPanelFlow.value) return false;
  if (retainerParentItems.value.length !== 1) return false;

  return isRetainerParentDocumentActionDisabled(
    kind,
    retainerParentItems.value[0],
  );
};

const positiveAmountValidator = (value: unknown) => {
  if (value === null || value === undefined || value === "")
    return "This field is required";

  return Number(value) > 0 || "Amount must be greater than 0";
};

const validateExternalAttachment = () => {
  const file = selectedExternalAttachment.value;

  if (!file) return "Attachment is required.";

  const fileName = file.name.toLowerCase();

  const hasAllowedExtension = allowedExternalAttachmentExtensions.some(
    (extension) => fileName.endsWith(extension),
  );

  const hasAllowedMimeType = allowedExternalAttachmentTypes.includes(file.type);

  if (!hasAllowedExtension && !hasAllowedMimeType)
    return "Attachment type is not allowed. Use PDF, Word, Excel, PNG, or JPG files only.";

  if (file.size > maxExternalAttachmentSizeBytes)
    return "Attachment must be 10MB or smaller.";

  return "";
};

const attachmentValidator = () => validateExternalAttachment() || true;

const partialPaidAmountValidator = (value: unknown) => {
  if (!requiresExternalPaidAmount.value) return true;

  const totalAmount = Number(externalDocumentForm.value.amount || 0);
  if (totalAmount <= 0) return "Enter the total amount first";

  if (value === null || value === undefined || value === "")
    return "Enter the paid amount";

  const paidAmount = Number(value);

  if (!Number.isFinite(paidAmount) || paidAmount <= 0)
    return "Paid amount must be greater than 0";

  if (paidAmount >= totalAmount)
    return "Paid amount must be less than the total for a partially paid document";

  return true;
};

const uniqueExternalDocumentNumberValidator = (value: unknown) => {
  const documentNumber = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!documentNumber) return true;

  const exists =
    selectedExternalDocumentKind.value === "quotation"
      ? quotationsStore.items.some(
          (record) =>
            record.quotation.quoteNumber.trim().toLowerCase() ===
            documentNumber,
        )
      : selectedExternalDocumentKind.value === "proforma"
        ? proformasStore.items.some(
            (record) =>
              record.quotation.quoteNumber.trim().toLowerCase() ===
              documentNumber,
          )
        : invoicesStore.items.some(
            (record) =>
              record.quotation.quoteNumber.trim().toLowerCase() ===
              documentNumber,
          );

  return exists
    ? `${externalDocumentKindLabel.value} number already exists`
    : true;
};

const closeExternalDocumentDialog = () => {
  externalDocumentDialogVisible.value = false;
  selectedExternalDocumentKind.value = null;
  setExternalDocumentTargets([]);
  isExternalDocumentFormValid.value = false;
  externalDocumentError.value = "";
  externalDocumentForm.value = emptyExternalDocumentForm(null);
  nextTick(() => {
    externalDocumentFormRef.value?.resetValidation();
  });
};

const openExternalDocumentDialog = (
  kind: DealPreviewKind,
  items: DealDocumentSelectableItem[] = [],
  period: DealBillingPeriod | null = null,
) => {
  selectedExternalDocumentKind.value = kind;
  setExternalDocumentTargets(items, period);
  isExternalDocumentFormValid.value = false;
  externalDocumentError.value = "";
  externalDocumentForm.value = emptyExternalDocumentForm(kind);
  externalDocumentDialogVisible.value = true;
  nextTick(() => {
    externalDocumentFormRef.value?.resetValidation();
  });
};

const buildImportedPaymentEntries = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  totalAmount: number,
  status: ProformaStatus | InvoiceStatus,
  date: string,
  paidAmountInput: number | null,
) => {
  if (status === "Not Paid") {
    return {
      balance: totalAmount,
      payments: [],
    };
  }

  const paidAmount =
    status === "Paid"
      ? totalAmount
      : Math.min(Math.max(Number(paidAmountInput || 0), 0), totalAmount);

  if (paidAmount <= 0) {
    return {
      balance: totalAmount,
      payments: [],
    };
  }

  const balanceAfter = Math.max(totalAmount - paidAmount, 0);
  const paymentId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `imported-${Date.now()}`;

  return {
    balance: balanceAfter,
    payments: [
      {
        amount: paidAmount,
        balanceAfter,
        balanceBefore: totalAmount,
        createdAt: new Date().toISOString(),
        date,
        id: paymentId,
        method: "Bank Transfer",
        note: `Imported ${kind} payment state from external system.`,
      },
    ],
  };
};

const buildExternalDocumentPurchasedProducts = () => {
  if (!selectedExternalDocumentItems.value.length) {
    return [
      {
        cost: 0,
        description: "Imported from another system.",
        hours: 1,
        title: `Imported ${selectedExternalDocumentKind.value ?? "document"} amount`,
      },
    ];
  }

  const period = selectedExternalDocumentBillingPeriod.value;
  const periodKey = period ? getDealBillingPeriodKey(period) : null;

  return selectedExternalDocumentItems.value.map((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    const usesPeriod =
      itemMode === "retainer-period" || itemMode === "recurrent-period";

    return {
      billingPeriod: usesPeriod ? period : null,
      billingPeriodKey: usesPeriod ? periodKey : null,
      catalogueItemId: item.catalogueItemId ?? null,
      cost: Number(item.unitPrice ?? 0),
      dealSelectionKey: item.selectionKey,
      description:
        String(item.note ?? "").trim() ||
        String(item.expansionSummary ?? "").trim() ||
        "Imported from another system.",
      discountType:
        Number(item.discountPercent || 0) > 0
          ? ("percent" as const)
          : ("none" as const),
      discountValue: Number(item.discountPercent || 0),
      hours: Number(item.quantity ?? 1),
      lineConstraints: item.lineConstraintsOverride || undefined,
      title: item.name,
    };
  });
};

const saveExternalDocument = async () => {
  externalDocumentError.value = "";

  const kind = selectedExternalDocumentKind.value;
  if (!kind) return;

  const { valid } = (await externalDocumentFormRef.value?.validate()) ?? {
    valid: true,
  };

  if (!valid) {
    externalDocumentError.value = "Fix the highlighted fields before saving.";

    return;
  }

  const attachmentValidationError = validateExternalAttachment();
  if (attachmentValidationError) {
    externalDocumentError.value = attachmentValidationError;

    return;
  }

  const amount = Number(externalDocumentForm.value.amount || 0);
  const documentDate = externalDocumentForm.value.date!;
  const documentStatus = externalDocumentForm.value.status;
  const attachmentFile = selectedExternalAttachment.value;
  let attachmentFileKey: string | null = null;

  if (attachmentFile) {
    try {
      attachmentFileKey = await saveFile(attachmentFile);
    } catch {
      externalDocumentError.value =
        "Attachment could not be saved locally for preview.";

      return;
    }
  }

  const payload = {
    note: `Imported ${kind} linked to this deal.${selectedExternalDocumentItems.value.length ? ` ${selectedExternalDocumentItems.value.length} line(s) mapped to deal billing.` : ""}`,
    paymentDetails: buildQuotationPaymentDetails(
      amount,
      configStore.legal,
      configStore.financial,
    ),
    paymentMethod: "Bank Transfer",
    purchasedProducts: buildExternalDocumentPurchasedProducts(),
    quotation: {
      attachmentFileKey,
      attachmentName: attachmentFile?.name ?? null,
      avatar: "",
      balance: 0,
      client: externalDocumentClient.value,
      dealId: props.deal.id,
      dueDate: documentDate,
      issuedDate: documentDate,
      linkedRecordType: "deal" as const,
      quoteNumber: externalDocumentForm.value.quoteNumber.trim(),
      service: `Imported ${kind}`,
      source: "external" as const,
      total: amount,
    },
    salesperson: buildQuotationSalesperson(configStore.legal),
    thanksNote: buildQuotationThanksNote(configStore.legal),
  };

  if (kind === "quotation") {
    quotationsStore.addQuotation({
      ...payload,
      quotation: {
        ...payload.quotation,
        quotationStatus:
          (documentStatus as QuotationStatus | null) ?? "Pending",
      },
    });
  } else if (kind === "proforma") {
    const importedPaymentState = buildImportedPaymentEntries(
      kind,
      amount,
      (documentStatus as ProformaStatus | null) ?? "Not Paid",
      documentDate,
      externalDocumentForm.value.paidAmount,
    );

    proformasStore.addProforma({
      ...payload,
      payments: importedPaymentState.payments,
      quotation: {
        ...payload.quotation,
        balance: importedPaymentState.balance,
        quotationStatus:
          (documentStatus as ProformaStatus | null) ?? "Not Paid",
      },
    });
  } else {
    const importedPaymentState = buildImportedPaymentEntries(
      kind,
      amount,
      (documentStatus as InvoiceStatus | null) ?? "Not Paid",
      documentDate,
      externalDocumentForm.value.paidAmount,
    );

    invoicesStore.addInvoice({
      ...payload,
      payments: importedPaymentState.payments,
      quotation: {
        ...payload.quotation,
        balance: importedPaymentState.balance,
        quotationStatus: (documentStatus as InvoiceStatus | null) ?? "Not Paid",
      },
    });
  }

  notifications.push(
    `External ${kind} attached to this deal.`,
    "success",
    3500,
  );
  closeExternalDocumentDialog();
};

const openAddPhase = (item: DealItemWithPlan) => {
  const record = getExpandableServiceRecord(item);
  if (!record) return;

  phaseDraft.parentItemId = Number(item.id);
  phaseDraft.customPhaseId = null;
  phaseDraft.name = "";
  phaseDraft.category = item.category ?? "";
  phaseDraft.quantity = item.quantity ?? 1;
  phaseDraft.price = 0;
  phaseDraft.discountPercent = 0;
  phaseDraft.taxApplicable = record.chargeTax;
  phaseDraft.note = item.note ?? record.description ?? "";
  phaseDialogVisible.value = true;
};

const openEditCustomPhase = (item: DealItemWithPlan, goal: DerivedGoal) => {
  const sourceItem = getItemById(item.id);

  const customPhase = sourceItem?.customPhases?.find(
    (phase) =>
      `phase-custom-${phase.id}` === goal.overrideKey ||
      `retainer-custom-${phase.id}` === goal.overrideKey ||
      `recurrent-custom-${phase.id}` === goal.overrideKey,
  );

  if (!customPhase) return;

  phaseDraft.parentItemId = Number(item.id);
  phaseDraft.customPhaseId = customPhase.id;
  phaseDraft.name = customPhase.name;
  phaseDraft.category = customPhase.category ?? goal.category ?? "";
  phaseDraft.quantity = customPhase.quantity ?? goal.quantity ?? 1;
  phaseDraft.price = customPhase.price ?? goal.price ?? 0;
  phaseDraft.discountPercent =
    customPhase.discountPercent ?? goal.discountPercent ?? 0;
  phaseDraft.taxApplicable =
    customPhase.taxApplicable ?? goal.taxApplicable ?? null;
  phaseDraft.note = customPhase.note ?? goal.note ?? "";
  phaseDialogVisible.value = true;
};

const savePhase = async () => {
  const { valid } = (await phaseFormRef.value?.validate()) ?? { valid: true };
  if (!valid || !phaseDraft.parentItemId) return;

  const parentItem = getItemById(phaseDraft.parentItemId);
  if (!parentItem) return;

  const nextItems = (props.deal.items || []).map((item) => {
    if (item.id !== phaseDraft.parentItemId) return item;

    const existingCustomPhases = Array.isArray(item.customPhases)
      ? item.customPhases.map((phase) => ({ ...phase }))
      : [];

    const nextPhase: DealCustomPhase = {
      id: phaseDraft.customPhaseId ?? `${Date.now()}`,
      name: phaseDraft.name.trim(),
      category: phaseDraft.category.trim() || null,
      quantity: Number(phaseDraft.quantity || 1),
      price: Number(phaseDraft.price || 0),
      discountPercent: Number(phaseDraft.discountPercent || 0),
      taxApplicable: phaseDraft.taxApplicable,
      note: phaseDraft.note.trim() || null,
    };

    const customPhases = phaseDraft.customPhaseId
      ? existingCustomPhases.map((phase) =>
          phase.id === phaseDraft.customPhaseId ? nextPhase : phase,
        )
      : [...existingCustomPhases, nextPhase];

    return {
      ...item,
      customPhases,
    };
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  phaseDialogVisible.value = false;
  notifications.push(
    `${phaseDialogEntityLabel.value} ${phaseDraft.customPhaseId ? "updated" : "added"}`,
    "success",
    2500,
  );
};

const removeGoal = (parentItem: DealItemWithPlan, goal: DerivedGoal) => {
  if (!isRemovableChildGoal(goal)) {
    notifications.push(
      "Remove is only available for item children.",
      "info",
      2500,
    );

    return;
  }

  const nextItems = (props.deal.items || []).map((item) => {
    if (item.id !== parentItem.id) return item;

    if (goal.overrideKey.includes("-custom-")) {
      return {
        ...item,
        customPhases: (item.customPhases || []).filter(
          (phase) =>
            `phase-custom-${phase.id}` !== goal.overrideKey &&
            `retainer-custom-${phase.id}` !== goal.overrideKey &&
            `recurrent-custom-${phase.id}` !== goal.overrideKey,
        ),
      };
    }

    const phaseId = Number(goal.overrideKey.replace(/^[^-]+-/, ""));
    const removedPhaseIds = new Set(item.removedPhaseIds || []);
    if (Number.isFinite(phaseId)) removedPhaseIds.add(phaseId);

    const nextOverrides = { ...(item.subItemOverrides || {}) };

    delete nextOverrides[goal.overrideKey];

    return {
      ...item,
      removedPhaseIds: Array.from(removedPhaseIds),
      subItemOverrides: Object.keys(nextOverrides).length
        ? nextOverrides
        : null,
    };
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });
  notifications.push(
    `${getEditableChildLabel(parentItem)} removed`,
    "success",
    2500,
  );
};

type DealTodo = ToDo & {
  goalId?: number | string | null;
  milestoneId?: number | string | null;
};

interface DealSalesTaskRow {
  id: number | string;
  title: string;
  afterWhen: string | null;
  startTrigger: ToDo["startTrigger"];
  notes: string;
  collaborators: ToDo["collaborators"];
  important: boolean;
  status: Status;
  isImported: boolean;
  sourceLabel: string | null;
}

const dealTodos = computed<DealTodo[]>(
  () =>
    (todosStore.items || []).filter((todo) => {
      if (!todo?.relatedTo) return false;

      const matchesDeal =
        String(todo.relatedTo.id) === String(props.deal.id) &&
        todo.relatedTo.type === "deal";

      const matchesLinkedJob =
        props.deal.linkedJobId !== null &&
        props.deal.linkedJobId !== undefined &&
        String(todo.relatedTo.id) === String(props.deal.linkedJobId) &&
        todo.relatedTo.type === "job";

      return matchesDeal || matchesLinkedJob;
    }) as DealTodo[],
);

const manualDealSalesTodos = computed<DealTodo[]>(() =>
  dealTodos.value.filter((todo) => {
    const milestoneId = String(todo.milestoneId ?? "").trim();
    const goalId = String(todo.goalId ?? "").trim();

    return !milestoneId && !goalId;
  }),
);

const buildEditableSalesTasks = (): DealSalesTaskTemplate[] => {
  const storedSalesTasks = Array.isArray(props.deal.salesTasks)
    ? props.deal.salesTasks.map((task) => cloneDealSalesTaskTemplate(task))
    : [];

  const importedSalesTasks = buildImportedSalesTaskTemplates(
    props.deal.items || [],
    nextDealSalesTaskId(storedSalesTasks),
  );

  const missingImportedSalesTasks = importedSalesTasks.filter(
    (task) =>
      !storedSalesTasks.some(
        (existingTask) =>
          Number(existingTask.sourceItemId ?? 0) ===
            Number(task.sourceItemId ?? 0) &&
          Number(existingTask.sourceTaskId ?? 0) ===
            Number(task.sourceTaskId ?? 0),
      ),
  );

  const legacyManualSalesTasks = dealTodos.value
    .filter((todo) => {
      const milestoneId = String(todo.milestoneId ?? "").trim();
      const goalId = String(todo.goalId ?? "").trim();

      return !milestoneId && !goalId;
    })
    .map((todo, index) =>
      cloneDealSalesTaskTemplate({
        id:
          nextDealSalesTaskId([...storedSalesTasks, ...importedSalesTasks]) +
          index,
        title: todo.title,
        collaborators: todo.collaborators || [],
        afterWhen: todo.afterWhen ?? null,
        startTrigger: (todo.startTrigger as any) ?? {
          type: "time",
          goalId: null,
          taskId: null,
        },
        manhours: null,
        notes: todo.notes || "",
        status: (todo.status as Status) || "pending",
        important: Boolean(todo.important),
        attachment: todo.attachment ?? null,
        relatedTo: buildDealRelatedTo(),
        steps: Array.isArray(todo.steps)
          ? todo.steps.map((step) => ({ ...step }))
          : [],
        sourceItemId: null,
        sourceTaskId: null,
      }),
    )
    .filter(
      (task) =>
        !storedSalesTasks.some(
          (existingTask) =>
            Number(existingTask.sourceItemId ?? 0) === 0 &&
            existingTask.title === task.title &&
            existingTask.notes === task.notes,
        ),
    );

  return [
    ...storedSalesTasks,
    ...missingImportedSalesTasks,
    ...legacyManualSalesTasks,
  ];
};

const salesTasks = computed<DealSalesTaskRow[]>(() => {
  const manualTodoKeys = new Set(
    manualDealSalesTodos.value.map(
      (todo) => `${todo.title || ""}::${todo.notes || ""}`,
    ),
  );

  const fallbackTasks = buildEditableSalesTasks().filter((task) => {
    if (task.sourceItemId !== null && task.sourceItemId !== undefined)
      return true;

    return !manualTodoKeys.has(`${task.title || ""}::${task.notes || ""}`);
  });

  return [
    ...manualDealSalesTodos.value.map((todo) => ({
      id: todo.id,
      title: todo.title,
      afterWhen: todo.afterWhen ?? null,
      startTrigger: todo.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: todo.notes || "",
      collaborators: todo.collaborators || [],
      important: Boolean(todo.important),
      status: (todo.status as Status) || "pending",
      isImported: false,
      sourceLabel: null,
    })),
    ...fallbackTasks.map((task) => ({
      id: task.id,
      title: task.title,
      afterWhen: task.afterWhen ?? null,
      startTrigger: task.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: task.notes || "",
      collaborators: task.collaborators || [],
      important: Boolean(task.important),
      status: (task.status as Status) || "pending",
      isImported: task.sourceItemId !== null && task.sourceItemId !== undefined,
      sourceLabel:
        task.sourceItemId !== null && task.sourceItemId !== undefined
          ? "From item sales task template"
          : null,
    })),
  ];
});

const collaboratorInitials = (name?: string) =>
  name
    ? (name.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()
    : "?";

const todoStatusLabel = (status?: Status) => {
  if (status === "in_progress") return "In Progress";
  if (status === "for_review") return "For Review";
  if (status === "completed") return "Completed";

  return "Pending";
};

const formatTaskAfterWhen = (afterWhen?: string | null) => {
  if (!String(afterWhen ?? "").trim()) return "Immediately";

  const match = String(afterWhen ?? "")
    .trim()
    .match(/^\+?\s*(\d+)\s+(day|days|week|weeks|month|months)$/i);

  if (!match) return "Immediately";

  const rawValue = Number(match[1]);
  const rawUnit = match[2].toLowerCase();

  const normalizedDays = rawUnit.startsWith("week")
    ? rawValue * 7
    : rawUnit.startsWith("month")
      ? rawValue * 30
      : rawValue;

  return `${normalizedDays} ${normalizedDays === 1 ? "day" : "days"}`;
};

const formatTaskStart = (
  afterWhen?: string | null,
  startTrigger?: ToDo["startTrigger"],
) => {
  if (startTrigger?.type === "goal" && startTrigger.goalId)
    return "After goal completion";

  return afterWhen ? `After ${formatTaskAfterWhen(afterWhen)}` : "Immediately";
};

const toggleTaskCompleted = (taskId: number | string) => {
  const task = todosStore.byId(taskId);
  if (!task) return;

  todosStore.updateTodo(taskId, {
    status: task.status === "completed" ? "pending" : "completed",
  });
};

const openAddTask = () => {
  emit("open-add-task", {
    initial: {
      relatedTo: buildDealRelatedTo(),
      status: "pending",
    },
  });
};

const openEditTask = (taskId: number | string) => {
  emit("open-edit-task", taskId);
};
</script>

<template>
  <div class="d-flex flex-column gap-4">
    <VCard>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div>
            <h5 class="text-h5 mb-1">Items</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Add or create catalogue items .
            </p>
          </div>

          <VMenu>
            <template #activator="{ props: menuProps }">
              <VBtn v-bind="menuProps" prepend-icon="tabler-plus">
                Add Item
              </VBtn>
            </template>

            <VList>
              <VListItem @click="openAddItemDialog">
                <template #prepend>
                  <VIcon icon="tabler-package" />
                </template>
                <VListItemTitle>Select from Catalogue</VListItemTitle>
              </VListItem>

              <VListItem @click="openCreateCatalogueItem">
                <template #prepend>
                  <VIcon icon="tabler-layout-grid-add" />
                </template>
                <VListItemTitle>Add new Item</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </div>

        <div
          v-if="!dealItemsWithPlan.length"
          class="text-center text-medium-emphasis py-6"
        >
          No items yet. Add one to get started.
        </div>

        <VExpansionPanels
          v-else
          v-model="expandedItems"
          variant="accordion"
          multiple
          class="expansion-panels-width-border milestone-panels"
        >
          <VExpansionPanel
            v-for="item in dealItemsWithPlan"
            :key="item.panelId"
            :value="item.panelId"
            class="milestone-panel"
            :class="{ 'milestone-panel--static': !item.isExpandable }"
            :readonly="!item.isExpandable"
          >
            <VExpansionPanelTitle>
              <div class="item-card-shell" @click.stop="openEditItem(item)">
                <div class="flex-grow-1 min-w-0">
                  <div class="item-card-header">
                    <div class="flex-grow-1 min-w-0">
                      <div class="item-card-title-row">
                        <VTooltip :text="item.name" location="top">
                          <template #activator="{ props: tooltipProps }">
                            <div
                              v-bind="tooltipProps"
                              class="item-card-title truncate-title"
                            >
                              {{ item.name }}
                            </div>
                          </template>
                        </VTooltip>

                        <VChip
                          size="small"
                          variant="plain"
                          color="primary"
                          class="item-type-chip"
                        >
                          {{ itemTypeLabel(item) }}
                        </VChip>
                      </div>

                      <div
                        v-if="
                          formatRetainerTermSummary(item) ||
                          formatRecurrentTermSummary(item)
                        "
                        class="item-card-note text-body-2 text-medium-emphasis"
                      >
                        {{
                          formatRetainerTermSummary(item) ||
                          formatRecurrentTermSummary(item)
                        }}
                      </div>
                    </div>
                  </div>

                  <div class="product-metrics">
                    <div class="product-metric">
                      <span>Price</span>
                      <strong>{{ formatMoney(item.unitPrice) }}</strong>
                    </div>
                    <div class="product-metric">
                      <span>{{ getItemQuantityLabel(item) }}</span>
                      <strong>{{ getItemQuantityDisplayValue(item) }}</strong>
                    </div>
                    <div class="product-metric">
                      <span>Discount</span>
                      <strong>
                        {{ formatPercent(item.discountPercent || 0) }}
                      </strong>
                    </div>
                    <div class="product-metric">
                      <span>Tax</span>
                      <strong>
                        {{ formatTaxApplicable(item.taxApplicable ?? null) }}
                      </strong>
                    </div>
                    <div class="product-metric product-metric--amount">
                      <span>Amount</span>
                      <strong>{{ formatMoney(itemAmount(item)) }}</strong>
                    </div>
                  </div>

                  <div
                    v-if="item.note"
                    class="item-card-note text-body-2 text-medium-emphasis"
                  >
                    {{ item.note }}
                  </div>

                  <div
                    v-if="getProducedProductCustomizationSummary(item)"
                    class="item-card-note text-body-2 text-medium-emphasis"
                  >
                    Customizations:
                    {{ getProducedProductCustomizationSummary(item) }}
                  </div>

                  <div
                    v-if="getProducedProductSubItemsSummary(item)"
                    class="item-card-note text-body-2 text-medium-emphasis"
                  >
                    Sub items: {{ getProducedProductSubItemsSummary(item) }}
                  </div>
                </div>

                <div
                  v-if="item.actionsEnabled"
                  class="milestone-actions"
                  @click.stop
                >
                  <VBtn icon variant="text" size="x-small">
                    <VIcon icon="tabler-dots-vertical" size="18" />
                    <VMenu activator="parent">
                      <VList>
                        <VListItem @click="openEditItem(item)">
                          <template #prepend>
                            <VIcon icon="tabler-pencil" />
                          </template>
                          <VListItemTitle>Edit</VListItemTitle>
                        </VListItem>
                        <VDivider v-if="getExpandableServiceRecord(item)" />
                        <VListItem
                          v-if="getExpandableServiceRecord(item)"
                          @click="openAddPhase(item)"
                        >
                          <template #prepend>
                            <VIcon icon="tabler-layout-grid-add" />
                          </template>
                          <VListItemTitle>
                            Add {{ item.childTypeSingular }}
                          </VListItemTitle>
                        </VListItem>
                        <template v-if="isRetainerParentDealItem(item)">
                          <VDivider />
                          <VListItem
                            @click="openRetainerDocumentPage('quotation', item)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-file-text" />
                            </template>
                            <VListItemTitle>Create Quotation</VListItemTitle>
                          </VListItem>
                          <VListItem
                            :disabled="
                              isRetainerParentDocumentActionDisabled(
                                'proforma',
                                item,
                              )
                            "
                            @click="openRetainerDocumentPage('proforma', item)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-file-certificate" />
                            </template>
                            <VListItemTitle>Create Proforma</VListItemTitle>
                          </VListItem>
                          <VListItem
                            :disabled="
                              isRetainerParentDocumentActionDisabled(
                                'invoice',
                                item,
                              )
                            "
                            @click="openRetainerDocumentPage('invoice', item)"
                          >
                            <template #prepend>
                              <VIcon icon="tabler-file-invoice" />
                            </template>
                            <VListItemTitle>Create Invoice</VListItemTitle>
                          </VListItem>
                          <VDivider />
                          <VListItem
                            @click="
                              openRetainerExternalDocumentDialog(
                                'quotation',
                                item,
                              )
                            "
                          >
                            <template #prepend>
                              <VIcon icon="tabler-paperclip" />
                            </template>
                            <VListItemTitle
                              >Attach External Quotation</VListItemTitle
                            >
                          </VListItem>
                          <VListItem
                            :disabled="
                              isRetainerParentDocumentActionDisabled(
                                'proforma',
                                item,
                              )
                            "
                            @click="
                              openRetainerExternalDocumentDialog(
                                'proforma',
                                item,
                              )
                            "
                          >
                            <template #prepend>
                              <VIcon icon="tabler-paperclip" />
                            </template>
                            <VListItemTitle
                              >Attach External Proforma</VListItemTitle
                            >
                          </VListItem>
                          <VListItem
                            :disabled="
                              isRetainerParentDocumentActionDisabled(
                                'invoice',
                                item,
                              )
                            "
                            @click="
                              openRetainerExternalDocumentDialog(
                                'invoice',
                                item,
                              )
                            "
                          >
                            <template #prepend>
                              <VIcon icon="tabler-paperclip" />
                            </template>
                            <VListItemTitle
                              >Attach External Invoice</VListItemTitle
                            >
                          </VListItem>
                        </template>
                        <VDivider />
                        <VListItem @click="removeDealItem(item)">
                          <template #prepend>
                            <VIcon icon="tabler-trash" color="error" />
                          </template>
                          <VListItemTitle>Remove</VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>

                  <VBtn
                    v-if="item.isExpandable"
                    icon
                    variant="text"
                    size="x-small"
                    class="item-expand-btn"
                    @click.stop="toggleItemExpanded(item.panelId)"
                  >
                    <VIcon
                      :icon="
                        expandedItems.includes(item.panelId)
                          ? 'tabler-chevron-up'
                          : 'tabler-chevron-down'
                      "
                      size="18"
                    />
                  </VBtn>
                  <div v-else class="item-expand-placeholder" />
                </div>
              </div>
            </VExpansionPanelTitle>

            <VExpansionPanelText v-if="item.isExpandable">
              <VCard variant="flat" class="pa-3 milestone-panel-body">
                <div
                  v-if="
                    item.derivedSections.some((section) => section.goals.length)
                  "
                  class="d-flex flex-column gap-2 goal-sections"
                >
                  <VCard
                    v-for="(
                      section, sectionIndex
                    ) in item.derivedSections.filter((section, index) =>
                      shouldRenderGoalSection(item, section, index),
                    )"
                    :key="section.id"
                    variant="flat"
                    class="goal-section-panel"
                    :class="{
                      'goal-section-panel--grouped':
                        item.derivedSections.length > 1,
                    }"
                  >
                    <div
                      v-if="item.derivedSections.length > 1"
                      class="goal-section-header"
                    >
                      <div class="goal-section-header-row">
                        <div class="item-card-title-row">
                          <div class="item-card-title item-card-title--phase">
                            {{ section.name }}
                          </div>
                          <VChip
                            color="secondary"
                            size="x-small"
                            variant="plain"
                            class="item-type-chip item-type-chip--phase"
                          >
                            Period
                          </VChip>
                        </div>
                        <div class="item-card-title item-card-title--phase">
                          <span
                            v-if="
                              getSectionInvoiceState(item, section) ||
                              section.note
                            "
                            class="goal-section-status text-body-2 text-medium-emphasis"
                          >
                            {{
                              getSectionInvoiceState(item, section) ||
                              section.note
                            }}
                          </span>
                        </div>
                        <div
                          v-if="section.billingPeriod"
                          class="goal-section-actions"
                          @click.stop
                        >
                          <VBtn icon variant="text" size="x-small">
                            <VIcon icon="tabler-dots-vertical" size="16" />
                            <VMenu activator="parent">
                              <VList>
                                <VListItem
                                  :disabled="
                                    isSectionDocumentActionDisabled(
                                      'proforma',
                                      item,
                                      section,
                                    )
                                  "
                                  @click="
                                    openSectionDocumentPage(
                                      'proforma',
                                      item,
                                      section,
                                    )
                                  "
                                >
                                  <template #prepend>
                                    <VIcon icon="tabler-file-certificate" />
                                  </template>
                                  <VListItemTitle
                                    >Create Proforma</VListItemTitle
                                  >
                                </VListItem>
                                <VListItem
                                  :disabled="
                                    isSectionDocumentActionDisabled(
                                      'invoice',
                                      item,
                                      section,
                                    )
                                  "
                                  @click="
                                    openSectionDocumentPage(
                                      'invoice',
                                      item,
                                      section,
                                    )
                                  "
                                >
                                  <template #prepend>
                                    <VIcon icon="tabler-file-invoice" />
                                  </template>
                                  <VListItemTitle
                                    >Create Invoice</VListItemTitle
                                  >
                                </VListItem>
                                <VDivider />
                                <VListItem
                                  :disabled="
                                    isSectionDocumentActionDisabled(
                                      'proforma',
                                      item,
                                      section,
                                    )
                                  "
                                  @click="
                                    openSectionExternalDocumentDialog(
                                      'proforma',
                                      item,
                                      section,
                                    )
                                  "
                                >
                                  <template #prepend>
                                    <VIcon icon="tabler-paperclip" />
                                  </template>
                                  <VListItemTitle
                                    >Attach External Proforma</VListItemTitle
                                  >
                                </VListItem>
                                <VListItem
                                  :disabled="
                                    isSectionDocumentActionDisabled(
                                      'invoice',
                                      item,
                                      section,
                                    )
                                  "
                                  @click="
                                    openSectionExternalDocumentDialog(
                                      'invoice',
                                      item,
                                      section,
                                    )
                                  "
                                >
                                  <template #prepend>
                                    <VIcon icon="tabler-paperclip" />
                                  </template>
                                  <VListItemTitle
                                    >Attach External Invoice</VListItemTitle
                                  >
                                </VListItem>
                              </VList>
                            </VMenu>
                          </VBtn>
                        </div>
                      </div>
                    </div>

                    <div class="d-flex flex-column gap-2 goal-panels">
                      <VCard
                        v-for="goal in getVisibleSectionGoals(
                          item,
                          section,
                          sectionIndex,
                        )"
                        :key="goal.id"
                        variant="tonal"
                        class="goal-panel goal-panel--static"
                      >
                        <div class="phase-card-shell">
                          <div class="flex-grow-1 min-w-0">
                            <div class="item-card-header">
                              <div class="item-card-title-row">
                                <VTooltip :text="goal.name" location="top">
                                  <template
                                    #activator="{ props: tooltipProps }"
                                  >
                                    <div
                                      v-bind="tooltipProps"
                                      class="item-card-title item-card-title--phase truncate-title"
                                    >
                                      {{ goal.name }}
                                      <span
                                        v-if="
                                          isCompactGoal(goal) && goal.quantity
                                        "
                                        class="text-body-2 text-medium-emphasis"
                                      >
                                        · Qty {{ goal.quantity }}
                                      </span>
                                    </div>
                                  </template>
                                </VTooltip>
                                <VChip
                                  color="primary"
                                  size="x-small"
                                  variant="plain"
                                  class="item-type-chip item-type-chip--phase"
                                >
                                  {{
                                    goal.typeLabel === "Phase" &&
                                    goal.phaseNumber
                                      ? `Phase ${goal.phaseNumber}`
                                      : goal.typeLabel
                                  }}
                                </VChip>
                              </div>
                            </div>

                            <div
                              v-if="goal.typeLabel === 'Phase'"
                              class="item-card-note text-body-2 text-medium-emphasis"
                            >
                              {{ getGoalInvoiceState(item, goal) }}
                            </div>

                            <div
                              v-if="
                                goal.showQuantity ||
                                goal.showPrice ||
                                goal.showDiscount ||
                                goal.showTaxApplicable
                              "
                              class="product-metrics product-metrics--phase"
                            >
                              <div v-if="goal.showPrice" class="product-metric">
                                <span>Price</span>
                                <strong>{{ formatMoney(goal.price) }}</strong>
                              </div>
                              <div
                                v-if="goal.showQuantity"
                                class="product-metric"
                              >
                                <span>Qty</span>
                                <strong>{{ goal.quantity ?? "--" }}</strong>
                              </div>
                              <div
                                v-if="goal.showDiscount"
                                class="product-metric"
                              >
                                <span>Discount</span>
                                <strong>{{
                                  formatGoalDiscount(goal) || "--"
                                }}</strong>
                              </div>
                              <div
                                v-if="goal.showTaxApplicable"
                                class="product-metric"
                              >
                                <span>Tax</span>
                                <strong>
                                  {{ formatTaxApplicable(goal.taxApplicable) }}
                                </strong>
                              </div>
                              <div v-if="goal.showPrice" class="product-metric">
                                <span>Amount</span>
                                <strong>{{
                                  formatMoney(goalAmount(goal))
                                }}</strong>
                              </div>
                            </div>

                            <div
                              v-if="goal.note && !isCompactGoal(goal)"
                              class="item-card-note text-body-2 text-medium-emphasis"
                            >
                              {{ goal.note }}
                            </div>
                          </div>

                          <div class="goal-card-actions">
                            <VBtn
                              icon
                              variant="text"
                              size="x-small"
                              class="phase-edit-btn"
                            >
                              <VIcon icon="tabler-dots-vertical" size="16" />
                              <VMenu activator="parent">
                                <VList>
                                  <VListItem @click="openEditGoal(item, goal)">
                                    <template #prepend>
                                      <VIcon icon="tabler-pencil" />
                                    </template>
                                    <VListItemTitle>Edit</VListItemTitle>
                                  </VListItem>
                                  <template
                                    v-if="
                                      isBillableChildGoal(goal) &&
                                      !section.billingPeriod
                                    "
                                  >
                                    <VDivider />
                                    <VListItem
                                      :disabled="
                                        isGoalProformaActionDisabled(
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                      @click="
                                        openGoalDocumentPage(
                                          'proforma',
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                    >
                                      <template #prepend>
                                        <VIcon icon="tabler-file-certificate" />
                                      </template>
                                      <VListItemTitle
                                        >Create Proforma</VListItemTitle
                                      >
                                    </VListItem>
                                    <VListItem
                                      :disabled="
                                        isGoalInvoiceActionDisabled(
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                      @click="
                                        openGoalDocumentPage(
                                          'invoice',
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                    >
                                      <template #prepend>
                                        <VIcon icon="tabler-file-invoice" />
                                      </template>
                                      <VListItemTitle
                                        >Create Invoice</VListItemTitle
                                      >
                                    </VListItem>
                                    <VDivider />
                                    <VListItem
                                      @click="
                                        openGoalExternalDocumentDialog(
                                          'proforma',
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                    >
                                      <template #prepend>
                                        <VIcon icon="tabler-paperclip" />
                                      </template>
                                      <VListItemTitle>
                                        Attach External Proforma
                                      </VListItemTitle>
                                    </VListItem>
                                    <VListItem
                                      @click="
                                        openGoalExternalDocumentDialog(
                                          'invoice',
                                          item,
                                          goal,
                                          section.billingPeriod,
                                        )
                                      "
                                    >
                                      <template #prepend>
                                        <VIcon icon="tabler-paperclip" />
                                      </template>
                                      <VListItemTitle>
                                        Attach External Invoice
                                      </VListItemTitle>
                                    </VListItem>
                                  </template>
                                  <VDivider v-if="isRemovableChildGoal(goal)" />
                                  <VListItem
                                    v-if="isRemovableChildGoal(goal)"
                                    @click="removeGoal(item, goal)"
                                  >
                                    <template #prepend>
                                      <VIcon
                                        icon="tabler-trash"
                                        color="error"
                                      />
                                    </template>
                                    <VListItemTitle>
                                      Remove {{ goal.typeLabel }}
                                    </VListItemTitle>
                                  </VListItem>
                                </VList>
                              </VMenu>
                            </VBtn>
                          </div>
                        </div>
                      </VCard>
                    </div>
                  </VCard>
                </div>

                <div v-else class="text-body-2 text-medium-emphasis">
                  No {{ item.childTypePlural.toLowerCase() }} under this item
                  yet.
                </div>
              </VCard>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>

        <div v-if="dealItemsWithPlan.length" class="items-card-summary">
          <div class="items-card-summary__rows">
            <div class="items-card-summary__row">
              <span>Total:</span>
              <strong>{{ formatMoney(itemsSubtotal) }}</strong>
            </div>
            <div class="items-card-summary__row">
              <span>Discount:</span>
              <strong>{{ formatMoney(totalDiscount) }}</strong>
            </div>
            <div class="items-card-summary__row">
              <span>Tax:</span>
              <strong>{{ formatMoney(totalTax) }}</strong>
            </div>
            <div class="items-card-summary__row items-card-summary__row--total">
              <span>Grand Total:</span>
              <strong>{{ formatMoney(grandTotal) }}</strong>
            </div>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard v-if="dealItemsWithPlan.length" class="items-overview-card">
      <VCardItem>
        <template #title> Invoicing Summary </template>
        <template #append>
          <button
            type="button"
            class="items-overview__collapse-toggle"
            :aria-expanded="!isItemsOverviewCollapsed"
            @click="toggleItemsOverviewCollapsed"
          >
            <VIcon
              :icon="
                isItemsOverviewCollapsed
                  ? 'tabler-chevron-down'
                  : 'tabler-chevron-up'
              "
              size="18"
            />
          </button>
        </template>
      </VCardItem>
      <VCardText class="items-overview-card__content">
        <div class="items-overview">
          <div v-if="!isItemsOverviewCollapsed" class="items-overview__body">
            <div
              class="items-overview__table"
              role="group"
              aria-label="Invoicing summary"
            >
              <div class="items-overview__row" role="presentation">
                <span class="items-overview__cell-label">Paid</span>
                <strong class="items-overview__cell-value">{{
                  formatMoney(totalPaid)
                }}</strong>
              </div>
              <div class="items-overview__row" role="presentation">
                <span class="items-overview__cell-label">Invoiced</span>
                <strong class="items-overview__cell-value">{{
                  formatMoney(totalInvoiced)
                }}</strong>
              </div>
              <div
                class="items-overview__row items-overview__row--accent"
                role="presentation"
              >
                <span class="items-overview__cell-label">Outstanding</span>
                <strong class="items-overview__cell-value">{{
                  formatMoney(remainingToInvoice)
                }}</strong>
              </div>
            </div>

            <div class="items-overview__previews">
              <template
                v-for="(panel, index) in dealDocumentPanels"
                :key="panel.key"
              >
                <VDivider v-if="index > 0" class="my-3" />

                <section
                  class="items-overview__preview-panel"
                  :class="[
                    `items-overview__preview-panel--${panel.key}`,
                    {
                      'items-overview__preview-panel--expanded':
                        isDocumentPanelExpanded(panel.key),
                    },
                  ]"
                >
                  <button
                    type="button"
                    class="items-overview__preview-summary"
                    @click="setActiveDocumentPanel(panel.key)"
                  >
                    <strong class="items-overview__preview-title">
                      {{
                        panel.latest?.quoteNumber ||
                        `No ${panel.title.slice(0, -1).toLowerCase()}`
                      }}
                    </strong>

                    <div class="items-overview__preview-summary-side">
                      <div class="items-overview__preview-count">
                        {{ panel.count }}
                      </div>
                      <VBtn
                        icon
                        variant="text"
                        size="x-small"
                        class="items-overview__preview-add"
                        :aria-label="`Add ${panel.title.slice(0, -1).toLowerCase()}`"
                        @click.stop
                      >
                        <VIcon icon="tabler-plus" size="14" />
                        <VMenu activator="parent">
                          <VList density="compact">
                            <VListItem
                              :disabled="
                                isRetainerPanelDocumentActionDisabled(panel.key)
                              "
                              @click="openPanelDocumentPage(panel.key)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-plus" />
                              </template>
                              <VListItemTitle>
                                Create {{ panel.title.slice(0, -1) }}
                              </VListItemTitle>
                            </VListItem>
                            <VDivider />
                            <VListItem
                              :disabled="
                                isRetainerPanelDocumentActionDisabled(panel.key)
                              "
                              @click="openPanelExternalDocumentFlow(panel.key)"
                            >
                              <template #prepend>
                                <VIcon icon="tabler-paperclip" />
                              </template>
                              <VListItemTitle>
                                Attach External {{ panel.title.slice(0, -1) }}
                              </VListItemTitle>
                            </VListItem>
                          </VList>
                        </VMenu>
                      </VBtn>
                      <VIcon
                        :icon="
                          isDocumentPanelExpanded(panel.key)
                            ? 'tabler-chevron-up'
                            : 'tabler-chevron-down'
                        "
                        size="16"
                      />
                    </div>
                  </button>

                  <div
                    v-if="isDocumentPanelExpanded(panel.key)"
                    class="items-overview__preview-body"
                  >
                    <template v-if="panel.latest">
                      <div class="items-overview__preview-table" role="table">
                        <div
                          class="items-overview__preview-table-head"
                          role="row"
                        >
                          <span role="columnheader">Number</span>
                          <span role="columnheader">Status</span>
                          <span role="columnheader">Date</span>
                          <span role="columnheader">Total</span>
                        </div>

                        <button
                          v-for="record in panel.records"
                          :key="`${panel.key}-${record.id}`"
                          type="button"
                          class="items-overview__preview-table-row"
                          role="row"
                          @click="openQuickDocumentPreview(panel.key, record)"
                        >
                          <span role="cell">{{ record.quoteNumber }}</span>
                          <span role="cell">{{ record.status }}</span>
                          <span role="cell">{{
                            formatDocumentDate(record.issuedDate)
                          }}</span>
                          <strong role="cell">{{
                            formatMoney(record.total)
                          }}</strong>
                        </button>
                      </div>
                    </template>

                    <p v-else class="items-overview__preview-empty mb-0 px-4">
                      {{ panel.emptyText }}
                    </p>
                  </div>
                </section>
              </template>
            </div>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard>
      <VDialog v-model="previewDialogVisible" max-width="1280">
        <VCard class="items-preview-dialog">
          <VCardItem>
            <template #title>
              <div
                class="d-flex align-center justify-space-between gap-4 flex-wrap"
              >
                <div>
                  <div class="text-overline text-primary mb-1">
                    Quick Preview
                  </div>
                  <div class="text-h6">
                    {{ selectedPreviewDocument?.title || "Document Preview" }}
                  </div>
                </div>

                <div class="d-flex align-center gap-2 flex-wrap">
                  <VBtn
                    variant="tonal"
                    prepend-icon="tabler-external-link"
                    :disabled="!selectedPreviewDocument"
                    @click="openSelectedPreviewInPage"
                  >
                    Open Full Page
                  </VBtn>
                  <VBtn
                    icon
                    variant="text"
                    @click="previewDialogVisible = false"
                  >
                    <VIcon icon="tabler-x" />
                  </VBtn>
                </div>
              </div>
            </template>
          </VCardItem>

          <VDivider />

          <VCardText class="items-preview-dialog__body">
            <iframe
              v-if="selectedPreviewDocument"
              :key="selectedPreviewDocument.href"
              :src="selectedPreviewDocument.href"
              class="items-preview-dialog__frame"
              title="Document quick preview"
            />
          </VCardText>
        </VCard>
      </VDialog>
      <VDialog v-model="externalDocumentDialogVisible" max-width="680">
        <VCard>
          <VCardItem>
            <VCardTitle>{{ externalDocumentDialogTitle }}</VCardTitle>
          </VCardItem>

          <VCardText>
            <VAlert
              v-if="externalDocumentError"
              type="error"
              variant="tonal"
              density="comfortable"
              class="mb-4"
            >
              {{ externalDocumentError }}
            </VAlert>

            <div class="text-sm text-medium-emphasis mb-4">
              This document will be linked directly to this deal and shown in
              the invoicing summary.
            </div>

            <VForm
              ref="externalDocumentFormRef"
              v-model="isExternalDocumentFormValid"
              @submit.prevent="saveExternalDocument"
            >
              <VRow>
                <VCol cols="12" md="6">
                  <AppDateTimePicker
                    v-model="externalDocumentForm.date"
                    label="Date"
                    placeholder="Select date"
                    clearable
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="externalDocumentForm.quoteNumber"
                    :label="externalDocumentNumberLabel"
                    :placeholder="`${externalDocumentKindLabel} number`"
                    :rules="[
                      requiredValidator,
                      uniqueExternalDocumentNumberValidator,
                    ]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="externalDocumentForm.amount"
                    type="number"
                    min="0"
                    label="Amount"
                    placeholder="0"
                    :rules="[positiveAmountValidator]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="externalDocumentForm.status"
                    label="Status"
                    :items="externalDocumentStatusOptions"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol v-if="requiresExternalPaidAmount" cols="12" md="6">
                  <AppTextField
                    v-model="externalDocumentForm.paidAmount"
                    type="number"
                    min="0"
                    :max="externalDocumentForm.amount ?? undefined"
                    label="Paid Amount"
                    :hint="externalPaidAmountHint"
                    persistent-hint
                    :rules="[partialPaidAmountValidator]"
                  />
                </VCol>

                <VCol cols="12">
                  <VFileInput
                    v-model="externalDocumentForm.attachment"
                    label="Attachment"
                    prepend-icon="tabler-paperclip"
                    :accept="externalAttachmentAccept"
                    :rules="[attachmentValidator]"
                    show-size
                    clearable
                  />
                </VCol>

                <VCol cols="12">
                  <div class="d-flex justify-end flex-wrap gap-3 w-100">
                    <VBtn
                      variant="tonal"
                      color="secondary"
                      @click="closeExternalDocumentDialog"
                    >
                      Cancel
                    </VBtn>
                    <VBtn type="submit" color="primary"> Attach </VBtn>
                  </div>
                </VCol>
              </VRow>
            </VForm>
          </VCardText>
        </VCard>
      </VDialog>
      <VCardText>
        <div
          class="d-flex justify-space-between align-center flex-wrap gap-4 mb-4"
        >
          <div class="d-flex flex-column gap-1">
            <h5 class="text-h5 mb-0">Sales Tasks</h5>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Sales tasks from added items appear here. Add more if needed.
            </p>
          </div>

          <VBtn prepend-icon="tabler-plus" @click="openAddTask">
            Add Task
          </VBtn>
        </div>

        <div v-if="salesTasks.length" class="d-flex flex-column gap-2">
          <VCard
            v-for="task in salesTasks"
            :key="task.id"
            class="task-row"
            variant="tonal"
            @click="openEditTask(task.id)"
          >
            <div class="task-row-main">
              <div class="task-row-left">
                <div class="task-copy">
                  <VTooltip :text="task.title" location="top">
                    <template #activator="{ props: tooltipProps }">
                      <strong
                        v-bind="tooltipProps"
                        class="text-body-1 truncate-title"
                      >
                        {{ task.title }}
                      </strong>
                    </template>
                  </VTooltip>
                  <span class="text-sm">
                    {{ formatTaskStart(task.afterWhen, task.startTrigger) }}
                  </span>
                  <span v-if="task.sourceLabel" class="text-sm text-info">
                    {{ task.sourceLabel }}
                  </span>
                  <span v-if="task.notes" class="text-sm text-medium-emphasis">
                    {{ task.notes }}
                  </span>
                </div>
              </div>

              <div class="task-row-side">
                <div
                  v-if="task.collaborators?.length"
                  class="v-avatar-group demo-avatar-group"
                >
                  <VAvatar
                    v-for="collaborator in task.collaborators.slice(0, 2)"
                    :key="collaborator.id"
                    :size="28"
                    color="primary"
                  >
                    <template v-if="collaborator.avatarUrl">
                      <VImg :src="collaborator.avatarUrl" />
                    </template>
                    <template v-else>
                      <span class="task-mono">
                        {{ collaboratorInitials(collaborator.name) }}
                      </span>
                    </template>
                    <VTooltip activator="parent" location="top">
                      {{ collaborator.name }}
                    </VTooltip>
                  </VAvatar>
                  <VAvatar
                    v-if="task.collaborators.length > 2"
                    :size="28"
                    color="secondary"
                  >
                    +{{ task.collaborators.length - 2 }}
                  </VAvatar>
                </div>

                <VIcon
                  v-if="task.important"
                  icon="tabler-star-filled"
                  color="warning"
                  size="18"
                />
                <VBtn
                  icon
                  variant="text"
                  size="x-small"
                  @click.stop="emit('delete-task', task.id)"
                >
                  <VIcon icon="tabler-trash" color="error" size="18" />
                </VBtn>
                <span
                  class="text-sm"
                  :class="{
                    'text-primary': task.status === 'in_progress',
                    'text-warning': task.status === 'for_review',
                    'text-medium-emphasis': task.status === 'pending',
                    'text-success': task.status === 'completed',
                  }"
                >
                  {{ todoStatusLabel(task.status) }}
                </span>
              </div>
            </div>
          </VCard>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis empty-tasks">
          No sales tasks linked to this deal yet.
        </div>
      </VCardText>
    </VCard>
  </div>

  <VDialog v-model="addItemDialogVisible" max-width="640">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add Item</h5>

        <VForm ref="addItemFormRef" @submit.prevent="saveSelectedCatalogueItem">
          <VRow>
            <VCol cols="12" :md="addItemUsesPeriodQuantity ? 12 : 8">
              <AppAutocomplete
                v-model="selectedCatalogueItemId"
                label="Catalogue Item"
                placeholder="Select catalogue item"
                :items="catalogueOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol v-if="!addItemUsesPeriodQuantity" cols="12" md="4">
              <AppTextField
                v-model="addItemDraft.quantity"
                type="number"
                min="1"
                label="Quantity"
                placeholder="1"
                :rules="[requiredValidator]"
              />
            </VCol>

            <template v-if="addItemRequiresRecurrentTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="addItemDraft.recurrentStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="addItemDraft.recurrentEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        addItemDraft.recurrentStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="addItemDraft.recurrentPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods:
                  {{ addItemRecurrentBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <template v-if="addItemRequiresRetainerTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="addItemDraft.retainerStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="addItemDraft.retainerEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        addItemDraft.retainerStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="addItemDraft.retainerPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods: {{ addItemBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <VCol v-if="selectedCatalogueItem" cols="12">
              <VCard variant="tonal" class="pa-4">
                <div class="font-weight-medium mb-1">
                  {{ selectedCatalogueItem.name }}
                </div>
                <div class="text-sm text-medium-emphasis mb-1">
                  {{ selectedCatalogueItem.type }} |
                  {{ selectedCatalogueItem.category }}
                </div>
                <div class="text-sm text-medium-emphasis">
                  {{ selectedCatalogueItem.description || "No description." }}
                </div>
              </VCard>
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="addItemDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="editLineDialogVisible" max-width="760">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Edit {{ editLine.title || "Item" }}</h5>

        <VForm ref="editLineFormRef" @submit.prevent="saveEditedLine">
          <VRow>
            <VCol v-if="editLine.canEditInfo" cols="12" md="8">
              <AppTextField
                v-model="editLine.name"
                label="Name"
                placeholder="Item name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol v-if="editLine.canEditInfo" cols="12" md="4">
              <AppTextField
                v-model="editLine.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol v-if="editLine.canEditPrice" cols="12" md="3">
              <AppTextField
                v-model="editLine.unitPrice"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol v-if="editLine.canEditQuantity" cols="12" md="3">
              <AppTextField
                v-model="editLine.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol v-if="editLine.canEditDiscount" cols="12" md="3">
              <AppTextField
                v-model="editLine.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol v-if="editLine.canEditTax" cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="editLine.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol v-if="editLine.canEditInfo" cols="12">
              <AppTextarea
                v-model="editLine.note"
                label="Note"
                placeholder="Short note"
                rows="2"
                auto-grow
              />
            </VCol>

            <template v-if="editLineRequiresRecurrentTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="editLine.recurrentStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="editLine.recurrentEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        editLine.recurrentStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="editLine.recurrentPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods:
                  {{ editLineRecurrentBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <template v-if="editLineRequiresRetainerTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="editLine.retainerStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="editLine.retainerEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        editLine.retainerStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="editLine.retainerPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods: {{ editLineBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="editLineDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="phaseDialogVisible" max-width="760">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">
          {{ phaseDialogTitle }}
        </h5>

        <VForm ref="phaseFormRef" @submit.prevent="savePhase">
          <VRow>
            <VCol cols="12" md="8">
              <AppTextField
                v-model="phaseDraft.name"
                label="Phase Name"
                placeholder="Phase name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="4">
              <AppTextField
                v-model="phaseDraft.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.price"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="phaseDraft.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="phaseDraft.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="phaseDraft.note"
                label="Note"
                placeholder="Short note"
                rows="2"
                auto-grow
              />
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="phaseDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog v-model="billingModeDialogVisible" max-width="560">
    <VCard>
      <VCardItem>
        <VCardTitle>Choose Billing Basis</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          This deal mixes billing modes. Choose how you want to build this
          document.
        </div>

        <VRadioGroup v-model="selectedBillingMode" color="primary">
          <VRadio
            v-for="option in billingModeOptions"
            :key="option.value"
            :value="option.value"
          >
            <template #label>
              <div>
                <div class="text-body-1 font-weight-medium">
                  {{ option.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ option.description }}
                </div>
              </div>
            </template>
          </VRadio>
        </VRadioGroup>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="resetDocumentWorkflowState"> Cancel </VBtn>
        <VBtn color="primary" @click="confirmBillingModeSelection">
          Continue
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="billingPeriodDialogVisible" max-width="640">
    <VCard>
      <VCardItem>
        <VCardTitle>Select Billing Period</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText class="d-flex flex-column gap-4">
        <div class="text-sm text-medium-emphasis">
          {{
            isMultiPeriodBillingSelection
              ? "Select one or more billing periods. The saved item price will be used for each selected period."
              : "Select the billing period for this period-based item."
          }}
        </div>

        <div class="rounded border pa-4 bg-var-theme-background">
          <template v-if="isRetainerBillingPeriodSelection">
            <VSelect
              v-if="isMultiPeriodBillingSelection"
              v-model="selectedRecurrentBillingPeriodKeys"
              :label="
                isRecurrentBillingPeriodSelection
                  ? 'Recurrent Periods'
                  : 'Retainer Periods'
              "
              :items="
                availableRetainerBillingPeriods.map((period) => ({
                  title: period.label,
                  value: period.key,
                }))
              "
              :disabled="!availableRetainerBillingPeriods.length"
              chips
              multiple
            />

            <VSelect
              v-else
              v-model="selectedRetainerBillingPeriodKey"
              :label="
                isRecurrentBillingPeriodSelection
                  ? 'Recurrent Period'
                  : 'Retainer Period'
              "
              :items="
                availableRetainerBillingPeriods.map((period) => ({
                  title: period.label,
                  value: period.key,
                }))
              "
              :disabled="!availableRetainerBillingPeriods.length"
            />

            <div
              v-if="!availableRetainerBillingPeriods.length"
              class="text-sm text-warning mt-3"
            >
              No billable
              {{ isRecurrentBillingPeriodSelection ? "recurrent" : "retainer" }}
              periods remain available.
            </div>
          </template>

          <template v-else>
            <VRow>
              <VCol cols="12" md="6">
                <VSelect
                  v-model="billingPeriodKind"
                  label="Period Type"
                  :items="billingPeriodKindOptions"
                />
              </VCol>

              <VCol cols="12" md="6">
                <VTextField
                  v-if="billingPeriodKind === 'monthly'"
                  v-model="billingPeriodMonthValue"
                  type="month"
                  label="Billing Month"
                />

                <VTextField
                  v-else-if="billingPeriodKind === 'quarterly'"
                  v-model="billingPeriodQuarterYearValue"
                  type="number"
                  min="2000"
                  label="Billing Year"
                />

                <VTextField
                  v-else-if="billingPeriodKind === 'yearly'"
                  v-model="billingPeriodYearValue"
                  type="number"
                  min="2000"
                  label="Billing Year"
                />

                <VTextField
                  v-else
                  v-model="billingPeriodCustomStartDate"
                  type="date"
                  label="Start Date"
                />
              </VCol>
            </VRow>

            <VRow v-if="billingPeriodKind === 'quarterly'">
              <VCol cols="12" md="6" offset-md="6">
                <VSelect
                  v-model="billingPeriodQuarterValue"
                  label="Billing Quarter"
                  :items="billingQuarterOptions"
                />
              </VCol>
            </VRow>

            <VRow v-else-if="billingPeriodKind === 'custom'">
              <VCol cols="12" md="6">
                <VTextField
                  v-model="billingPeriodCustomEndDate"
                  type="date"
                  label="End Date"
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="billingPeriodCustomLabel"
                  label="Custom Label"
                  placeholder="Optional"
                />
              </VCol>
            </VRow>
          </template>
        </div>

        <div class="rounded border pa-3 bg-var-theme-background">
          <div class="text-xs text-medium-emphasis mb-1">
            {{
              isMultiPeriodBillingSelection
                ? "Selected periods"
                : "Selected period"
            }}
          </div>
          <div class="text-body-1 font-weight-medium">
            {{ billingPeriodPreviewLabel }}
          </div>
        </div>

        <div
          v-if="pendingBillingPeriodItems.length"
          class="d-flex flex-column gap-3 mt-4"
        >
          <div
            v-if="isMultiPeriodBillingSelection"
            class="border rounded-lg pa-4 bg-var-theme-background text-sm text-medium-emphasis"
          >
            {{
              pendingBillingPeriodItems[0]?.name ||
              (isRecurrentBillingPeriodSelection
                ? "This recurrent item"
                : "This retainer item")
            }}
            will use its saved
            {{ isRecurrentBillingPeriodSelection ? "recurrent" : "retainer" }}
            price for each selected period.
          </div>

          <div
            v-else
            v-for="item in pendingBillingPeriodItems"
            :key="item.selectionKey"
            class="border rounded-lg pa-4 bg-var-theme-background"
          >
            <div class="text-body-1 font-weight-medium mb-1">
              {{ item.name }}
            </div>
            <div class="text-sm text-medium-emphasis mb-3">
              Set the explicit billed amount for this period.
            </div>

            <AppTextField
              v-model.number="billingPeriodPrices[item.selectionKey]"
              type="number"
              min="0"
              step="0.01"
              label="Period Price"
            />
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="resetDocumentWorkflowState"> Cancel </VBtn>
        <VBtn
          color="primary"
          :disabled="isBillingPeriodConfirmationDisabled"
          @click="confirmBillingPeriod"
        >
          Continue
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="selectionDialogVisible" max-width="760">
    <VCard>
      <VCardItem>
        <VCardTitle>{{ selectionDialogTitle }}</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogIntro }}
        </div>

        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogHint }}
        </div>

        <div
          v-if="filteredSelectableDocumentItems.length"
          class="d-flex flex-column gap-3"
        >
          <div
            v-for="group in selectableGroups"
            :key="group.key"
            class="d-flex flex-column gap-3"
          >
            <div>
              <div class="text-subtitle-2 font-weight-medium">
                {{ group.label }}
              </div>
              <div class="text-sm text-medium-emphasis">
                {{ group.description }}
              </div>
            </div>

            <label
              v-for="item in group.items"
              :key="item.selectionKey"
              class="border rounded pa-3 d-flex align-start gap-3"
              :class="{
                'opacity-50': isSelectionDocumentActionDisabled(
                  item.selectionKey,
                ),
              }"
              :style="{ marginInlineStart: itemRowOffset(item) }"
            >
              <VCheckbox
                v-model="selectedItemIds"
                :value="item.selectionKey"
                :disabled="isSelectionDocumentActionDisabled(item.selectionKey)"
                color="primary"
                hide-details
                class="mt-0 pt-0"
              />

              <div class="flex-grow-1 min-w-0">
                <div class="d-flex flex-wrap align-center gap-2 mb-1">
                  <div class="text-body-1 font-weight-medium">
                    {{ item.name }}
                  </div>

                  <VChip size="x-small" label color="primary" variant="tonal">
                    {{ formatItemType(item.catalogueType) }}
                  </VChip>

                  <VChip
                    v-if="item.parentName"
                    size="x-small"
                    label
                    color="secondary"
                    variant="tonal"
                  >
                    Parent: {{ item.parentName }}
                  </VChip>

                  <VChip
                    v-if="item.isBillableRoot && item.isAutoBillable"
                    size="x-small"
                    label
                    color="success"
                    variant="tonal"
                  >
                    Auto-flow eligible
                  </VChip>

                  <VChip
                    v-else-if="item.isBillableRoot && !item.isRootReplacement"
                    size="x-small"
                    label
                    color="warning"
                    variant="tonal"
                  >
                    Selection flow
                  </VChip>

                  <VChip
                    v-if="item.expansionSummary"
                    size="x-small"
                    label
                    color="info"
                    variant="tonal"
                  >
                    {{ item.expansionSummary }}
                  </VChip>
                </div>

                <div class="text-sm text-medium-emphasis mb-1">
                  {{ formatMoney(item.unitPrice) }} x {{ item.quantity ?? 1 }}
                </div>

                <div v-if="item.hint" class="text-sm text-medium-emphasis mb-1">
                  {{ item.hint }}
                </div>

                <div
                  v-if="isSelectionDocumentActionDisabled(item.selectionKey)"
                  class="text-sm text-warning mb-1"
                >
                  {{
                    selectedDocumentKind === "invoice"
                      ? "Already invoiced."
                      : "Already proforma'd."
                  }}
                </div>

                <div v-if="item.note" class="text-sm text-medium-emphasis">
                  {{ item.note }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis">
          No selectable rows available for this billing mode.
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="closeSelectionDialog"> Cancel </VBtn>
        <VBtn
          color="primary"
          :disabled="!selectedDocumentItems.length"
          @click="confirmSelectedDocumentItems"
        >
          Continue
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="createItemTypeDialogVisible" max-width="920">
    <VCard class="pa-sm-6 pa-4">
      <VCardTitle class="text-h4 pb-2"> Choose Item Type </VCardTitle>
      <VCardText class="text-body-1 text-medium-emphasis pb-6">
        Select kind of catalogue item you want to create. Each option opens
        matching add flow.
      </VCardText>

      <VRow>
        <VCol
          v-for="choice in itemTypeChoices"
          :key="choice.value"
          cols="12"
          md="6"
        >
          <VCard
            variant="outlined"
            class="item-type-card h-100"
            :class="{ 'item-type-card--disabled': choice.comingSoon }"
            @click="openCreateDraftItemDialog(choice.value)"
          >
            <VCardText class="d-flex align-start gap-4">
              <VAvatar size="44" rounded variant="tonal" color="primary">
                <VIcon :icon="choice.icon" size="22" />
              </VAvatar>

              <div class="flex-grow-1">
                <div
                  class="d-flex align-center justify-space-between gap-3 mb-1"
                >
                  <div class="text-h6 text-high-emphasis">
                    {{ choice.title }}
                  </div>
                  <VChip
                    v-if="choice.comingSoon"
                    size="small"
                    color="warning"
                    variant="outlined"
                  >
                    Coming Soon
                  </VChip>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ choice.description }}
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VCardActions class="pt-6">
        <VSpacer />
        <VBtn
          variant="text"
          color="secondary"
          @click="createItemTypeDialogVisible = false"
        >
          Cancel
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="createDraftItemDialogVisible" max-width="720">
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add {{ selectedCreateItemType || "Item" }}</h5>

        <VForm
          ref="createDraftItemFormRef"
          @submit.prevent="saveCreatedDraftItem"
        >
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="createDraftItem.name"
                label="Item Name"
                placeholder="Item name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol v-if="!createDraftItemUsesPeriodQuantity" cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.quantity"
                type="number"
                min="1"
                label="Quantity"
                placeholder="1"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.price"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                v-model="createDraftItem.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol cols="12" md="3">
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">Tax?</span>
                <VSwitch
                  v-model="createDraftItem.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                  label="Applicable"
                />
              </div>
            </VCol>

            <template v-if="createDraftItemRequiresRecurrentTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="createDraftItem.recurrentStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="createDraftItem.recurrentEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        createDraftItem.recurrentStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="createDraftItem.recurrentPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods:
                  {{ createDraftItemRecurrentBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <template v-if="createDraftItemRequiresRetainerTerm">
              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="createDraftItem.retainerStartDate"
                  label="Start Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppDateTimePicker
                  v-model="createDraftItem.retainerEndDate"
                  label="End Date"
                  :config="{ dateFormat: 'Y-m-d' }"
                  :rules="[
                    requiredValidator,
                    (value: unknown) =>
                      retainerEndDateValidator(
                        value,
                        createDraftItem.retainerStartDate,
                      ),
                  ]"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="createDraftItem.retainerPeriods"
                  type="number"
                  min="1"
                  label="Periods"
                  placeholder="12"
                  :rules="[requiredValidator, positiveWholeNumberValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VAlert variant="tonal" color="primary">
                  Billable periods: {{ createDraftItemBillablePeriods ?? "--" }}
                </VAlert>
              </VCol>
            </template>

            <VCol cols="12">
              <AppTextarea
                v-model="createDraftItem.note"
                label="Note"
                placeholder="Short note"
                rows="1"
                auto-grow
              />
            </VCol>

            <VCol cols="12">
              <DialogActionBar
                save-type="submit"
                @save="() => undefined"
                @cancel="createDraftItemDialogVisible = false"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.item-type-card {
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.item-type-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  transform: translateY(-1px);
}

.item-type-card--disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.milestone-panels :deep(.v-expansion-panel),
.goal-panels :deep(.v-expansion-panel) {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.12);
}

.milestone-panels {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.milestone-panels :deep(.v-expansion-panel-title),
.goal-panels :deep(.v-expansion-panel-title) {
  min-block-size: auto;
  padding-block: 0.65rem;
  padding-inline: 1rem;
}

.milestone-panels :deep(.v-expansion-panel-text__wrapper),
.goal-panels :deep(.v-expansion-panel-text__wrapper) {
  padding-block: 0 0.75rem;
  padding-inline: 0.75rem;
}

.milestone-panels :deep(.v-expansion-panel__shadow),
.goal-panels :deep(.v-expansion-panel__shadow) {
  box-shadow: none;
}

.milestone-panel {
  overflow: hidden;
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.milestone-panel:hover {
  border-color: rgba(var(--v-theme-primary), 0.24);
  background: rgba(var(--v-theme-surface), 0.18);
}

.milestone-panel--static {
  cursor: default;
}

.milestone-panel-body {
  display: flex;
  flex-direction: column;
  background: transparent;
  box-shadow: none;
  gap: 0.5rem;
}

.goal-panels :deep(.v-expansion-panel) {
  border: 0;
  border-radius: 10px;
  background: rgba(var(--v-theme-info), 0.035);
}

.goal-panel--static {
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.18);
  padding-block: 0.65rem;
  padding-inline: 0.8rem;
}

.goal-panels :deep(.v-expansion-panel + .v-expansion-panel) {
  margin-block-start: 0.625rem;
}

.goal-panels :deep(.v-expansion-panel-title) {
  min-block-size: auto;
}

.goal-panel-body {
  background: rgba(var(--v-theme-surface), 0.14);
  box-shadow: none;
}

.goal-panels {
  margin-block-start: 0;
}

.goal-sections {
  gap: 0.75rem;
}

.goal-section-panel {
  background: transparent;
  box-shadow: none;
}

.goal-section-panel--grouped {
  padding: 0.8rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 10px;
  background: rgba(var(--v-theme-surface), 0.12);
}

.goal-section-header {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-block-end: 0.65rem;
}

.goal-section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-inline-size: 0;
}

.goal-section-status {
  flex: 0 0 auto;
  margin-block-start: 0;
  white-space: nowrap;
}

.item-card-shell,
.phase-card-shell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  inline-size: 100%;
  min-inline-size: 0;
}

.item-card-shell {
  cursor: pointer;
  padding-block: 0.125rem;
}

.phase-card-shell {
  padding-block: 0.125rem;
}

.item-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-inline-size: 0;
}

.item-card-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-inline-size: 0;
}

.item-card-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}

.item-card-title--phase {
  font-size: 0.9rem;
}

.item-type-chip {
  position: relative;
  background: transparent !important;
  box-shadow: none !important;
  gap: 0.4rem;
  margin-inline-start: 0.2rem;
  min-block-size: auto;
  opacity: 1 !important;
  padding-inline-start: 0.85rem;
}

.item-type-chip :deep(.v-chip__underlay) {
  display: none;
}

.item-type-chip:hover {
  opacity: 1 !important;
}

.item-type-chip::before {
  position: absolute;
  border-radius: 999px;
  background: currentcolor;
  block-size: 1rem;
  content: "";
  inline-size: 0.25rem;
  inset-block-start: 50%;
  inset-inline-start: 0.2rem;
  transform: translateY(-50%);
}

.item-type-chip--phase {
  margin-inline-start: 0;
}

.product-metrics {
  display: grid;
  gap: 0;
  grid-template-columns: repeat(5, minmax(5rem, 1fr));
  margin-block-start: 0.5rem;
}

.product-metrics--phase {
  grid-template-columns: repeat(5, minmax(4.75rem, 1fr));
}

.product-metric {
  position: relative;
  background: transparent;
  min-inline-size: 0;
  padding-block: 0.35rem;
  padding-inline: 0.5rem;
}

.product-metric:not(:last-child)::after {
  position: absolute;
  background: rgba(var(--v-theme-on-surface), 0.12);
  block-size: calc(100% - 0.5rem);
  content: "";
  inline-size: 1px;
  inset-block-start: 0.25rem;
  inset-inline-end: 0;
}

.product-metric span,
.product-metric strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-metric span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.15;
  text-transform: uppercase;
}

.product-metric strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.82rem;
  line-height: 1.25;
  margin-block-start: 0.1rem;
}

.product-metric--amount {
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.items-card-summary {
  display: flex;
  justify-content: flex-end;
  margin-block-start: 1rem;
}

.items-card-summary__rows {
  display: flex;
  flex-direction: column;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  gap: 0.35rem;
  inline-size: min(100%, 16rem);
  padding-block-start: 0.875rem;
}

.items-card-summary__row {
  display: grid;
  align-items: center;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto;
}

.items-card-summary__row span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
  line-height: 1.25;
}

.items-card-summary__row strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: end;
}

.items-card-summary__row--total {
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding-block-start: 0.45rem;
}

.items-card-summary__row--total span,
.items-card-summary__row--total strong {
  font-size: 0.92rem;
}

.goal-card-actions {
  display: flex;
  align-self: flex-start;
  gap: 0.15rem;
  margin-block-start: -0.25rem;
}

.phase-edit-btn {
  flex: 0 0 auto;
}

.item-card-note {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  margin-block-start: 0.45rem;
}

.milestone-actions {
  display: grid;
  flex: 0 0 3.75rem;
  align-self: center;
  justify-content: end;
  grid-template-columns: 1.75rem 1.75rem;
  inline-size: 3.75rem;
  justify-items: center;
  margin-inline-start: auto;
}

.milestone-actions :deep(.v-btn) {
  margin: 0;
}

.item-expand-placeholder {
  block-size: 1.75rem;
  inline-size: 1.75rem;
}

.milestone-panel :deep(.v-expansion-panel-title__icon) {
  display: none;
}

.truncate-title {
  display: block;
  overflow: hidden;
  max-inline-size: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.truncate-title--header {
  max-inline-size: min(28rem, 100%);
}

.items-overview-card__content {
  padding-block-start: 0;
}

.items-overview {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.items-overview__document-pill {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(var(--v-theme-primary), 0.16);
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.78rem;
  font-weight: 600;
  gap: 0.5rem;
  letter-spacing: 0.04em;
  min-inline-size: 4.6rem;
  padding-block: 0.4rem;
  padding-inline: 0.7rem;
}

.items-overview__document-pill span {
  color: rgba(var(--v-theme-primary), 0.92);
}

.items-overview__collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  block-size: 2rem;
  color: inherit;
  cursor: pointer;
  font: inherit;
  inline-size: 2rem;
}

.items-overview__collapse-toggle:hover,
.items-overview__preview-add:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgba(var(--v-theme-primary), 0.96);
}

.items-overview__body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.9rem;
}

.items-overview__previews {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  inline-size: 100%;
  min-inline-size: 0;
}

.items-overview__preview-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  inline-size: 100%;
  min-inline-size: 0;
}

.items-overview__table {
  display: grid;
  overflow: hidden;
  align-self: stretch;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.16);
  gap: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.items-overview__row {
  position: relative;
  display: grid;
  background: transparent;
  min-inline-size: 0;
  padding-block: 0.45rem;
  padding-inline: 0.65rem;
}

.items-overview__row:not(:last-child)::after {
  position: absolute;
  background: rgba(var(--v-theme-on-surface), 0.12);
  block-size: calc(100% - 0.6rem);
  content: "";
  inline-size: 1px;
  inset-block-start: 0.3rem;
  inset-inline-end: 0;
}

.items-overview__cell-label {
  display: block;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.15;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.items-overview__cell-value {
  display: block;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  margin-block-start: 0.14rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items-overview__row--accent {
  background: rgba(var(--v-theme-primary), 0.06);
}

.items-overview__row--accent .items-overview__cell-value {
  color: rgba(var(--v-theme-primary), 0.96);
}

.items-overview__preview-panel:hover {
  background: rgba(var(--v-theme-primary), 0.03);
}

.items-overview__preview-panel--quotation {
  box-shadow: none;
}

.items-overview__preview-panel--proforma {
  box-shadow: none;
}

.items-overview__preview-panel--invoice {
  box-shadow: none;
}

.items-overview__preview-summary,
.items-overview__preview-primary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  inline-size: 100%;
  padding-block: 0.78rem;
  padding-inline: 0.9rem;
  text-align: start;
}

.items-overview__preview-summary-side {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.items-overview__preview-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  block-size: 1.9rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  inline-size: 1.9rem;
  min-inline-size: 1.9rem;
}

.items-overview__preview-body {
  display: flex;
  flex-direction: column;
  padding-block-end: 0.75rem;
}

.items-overview__preview-kicker {
  display: inline-flex;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.68rem;
  gap: 0.4rem;
  line-height: 1.1;
  margin-block-end: 0.25rem;
  text-transform: uppercase;
}

.items-overview__preview-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-theme-warning), 0.22);
  border-radius: 999px;
  background: rgba(var(--v-theme-warning), 0.12);
  color: rgba(var(--v-theme-warning), 0.98);
  font-size: 0.66rem;
  font-weight: 700;
  min-inline-size: 2.1rem;
  padding-block: 0.18rem;
  padding-inline: 0.42rem;
}

.items-overview__preview-title {
  display: block;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.2;
}

.items-overview__preview-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgba(var(--v-theme-primary), 0.92);
  font-size: 0.8rem;
  font-weight: 700;
  min-inline-size: 2rem;
  padding-block: 0.3rem;
  padding-inline: 0.55rem;
}

.items-overview__preview-meta {
  flex-wrap: wrap;
  justify-content: flex-start;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.76rem;
}

.items-overview__preview-total {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.1;
}

.items-overview__preview-table {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  margin-inline: 0.9rem;
}

.items-overview__preview-table-head,
.items-overview__preview-table-row {
  display: grid;
  align-items: center;
  column-gap: 0.75rem;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1fr) auto;
}

.items-overview__preview-table-head {
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding-block: 0.55rem;
  padding-inline: 0.8rem;
  text-transform: uppercase;
}

.items-overview__preview-table-row {
  border: 0;
  background: transparent;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  cursor: pointer;
  font: inherit;
  inline-size: 100%;
  padding-block: 0.72rem;
  padding-inline: 0.8rem;
  text-align: start;
}

.items-overview__preview-table-row:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.items-overview__preview-table-row strong {
  text-align: end;
}

.items-overview__preview-empty {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.78rem;
}

.items-preview-dialog {
  overflow: hidden;
}

.items-preview-dialog__body {
  padding: 0;
}

.items-preview-dialog__frame {
  display: block;
  border: 0;
  background: #fff;
  inline-size: 100%;
  min-block-size: 75vh;
}

@media (max-width: 639px) {
  .items-overview__table {
    grid-template-columns: minmax(0, 1fr);
  }

  .items-overview__row {
    padding-block: 0.55rem;
  }

  .items-overview__preview-table-head,
  .items-overview__preview-table-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .items-overview__row:not(:last-child)::after {
    block-size: 1px;
    inline-size: calc(100% - 1rem);
    inset-block: auto 0;
    inset-inline-start: 0.5rem;
  }
}

.task-row {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.task-row:hover {
  border-color: rgba(var(--v-theme-primary), 0.28);
  transform: translateY(-1px);
}

.task-row-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 1rem;
  padding-inline: 1.125rem;
}

.task-row-left {
  display: flex;
  flex: 1 1 auto;
  align-items: flex-start;
  gap: 0.5rem;
  min-inline-size: 0;
}

.task-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-inline-size: 0;
}

.task-copy strong,
.task-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row-side {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  align-self: center;
  gap: 0.75rem;
}

.task-mono {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.empty-tasks {
  padding-block: 1rem 0.5rem;
}

@media (max-width: 767px) {
  .milestone-panels :deep(.v-expansion-panel-title),
  .goal-panels :deep(.v-expansion-panel-title) {
    padding-block: 0.875rem;
    padding-inline: 1rem;
  }

  .milestone-panels :deep(.v-expansion-panel-text__wrapper),
  .goal-panels :deep(.v-expansion-panel-text__wrapper) {
    padding-block: 0 0.875rem;
    padding-inline: 0.875rem;
  }

  .milestone-panel-body,
  .goal-panel-body {
    padding: 0.75rem !important;
  }

  .goal-panels :deep(.v-expansion-panel + .v-expansion-panel) {
    margin-block-start: 0.5rem;
  }

  .items-card-summary {
    justify-content: stretch;
  }

  .items-card-summary__rows {
    inline-size: 100%;
  }

  .milestone-actions {
    flex-basis: 3.5rem;
    grid-template-columns: 1.625rem 1.625rem;
    inline-size: 3.5rem;
  }

  .milestone-actions :deep(.v-btn) {
    max-inline-size: 100%;
    min-block-size: 30px;
  }

  .item-card-shell,
  .phase-card-shell {
    gap: 0.75rem;
  }

  .item-card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .product-metrics,
  .product-metrics--phase {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .items-summary {
    max-inline-size: 100%;
  }

  .task-row-main {
    flex-direction: column;
    align-items: stretch;
  }

  .task-row-left,
  .task-row-side {
    inline-size: 100%;
  }

  .task-row-side {
    justify-content: space-between;
  }
}
</style>
