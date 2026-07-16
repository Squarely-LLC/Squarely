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
  CatalogueProducedProductFieldType,
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
  DealProducedCustomization,
  DealProducedCustomizationField,
  DealProperties,
  DealSalesTaskTemplate,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import type { InvoicePaymentInput } from "@/stores/invoices";
import { cloneInvoiceRecord, useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { cloneProformaRecord, useProformasStore } from "@/stores/proformas";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import { useReceiptsStore } from "@/stores/receipts";
import { useTodos } from "@/stores/todos";
import {
  type DealDocumentBillingMode,
  type DealDocumentKind,
  type DealDocumentSelectableItem,
  type DealQuotationConversionOption,
  buildCustomBillingPeriod,
  buildDealDocumentDraftRecord,
  buildDealQuotationConversionOptions,
  buildDealQuotationConversionProducts,
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
  hasDealDocumentPhaseOrPeriodLines,
  getSelectableDealItems,
  resolveDealDocumentBillingMode,
  resolveDealDocumentBillingModeForItem,
  resolveStoredBillingPeriodKey,
  saveDealDocumentDraft,
} from "@/utils/dealDocumentDraft";
import {
  getDealDocumentBalance,
  getDealDocumentPaid,
  getDealDocumentTotal,
  getDealItemsDiscountTotal,
  getDealItemsGrandTotal,
  getDealItemsSubtotal,
} from "@/utils/dealBilling";
import { getDealGrandTotal } from "@/utils/dealValue";
import {
  type DealDocumentSourceKind,
  isDocumentSourceExternal,
  isDocumentSourceInternal,
} from "@/utils/documentSourceModes";
import { saveFile } from "@/utils/fileStore";
import {
  canRecordInvoicePayment,
  canConvertFinanceDocument,
  FINANCE_APPROVAL_CONVERSION_MESSAGE,
  FINANCE_APPROVAL_PAYMENT_MESSAGE,
  normalizeFinanceApprovalStatus,
} from "@/utils/financeApproval";
import { notifyFinanceApprovalRequest } from "@/utils/financeApprovalNotifications";
import {
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  formatCurrencyAmount,
} from "@/utils/quotationConfig";
import {
  getLineDiscountAmount,
  getLineTotal,
  getQuotationGrandTotal,
} from "@/utils/quotationPricing";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import InvoiceAddPaymentDrawer from "@/views/apps/invoice/InvoiceAddPaymentDrawer.vue";
import DealProducedCustomizationForm from "@/views/operations/deals/view/DealProducedCustomizationForm.vue";
import { formatSystemDate } from "@core/utils/formatters";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { VForm } from "vuetify/components/VForm";

const props = defineProps<{
  canApproveFinance?: boolean;
  canCreateFinance?: boolean;
  canCreateTask?: boolean;
  canDeleteFinance?: boolean;
  canDeleteTask?: boolean;
  canUpdateFinance?: boolean;
  canUpdateDeal?: boolean;
  canUpdateTask?: boolean;
  deal: DealProperties;
  dealUpdateDisabledReason?: string;
  financeCreateDisabledReason?: string;
  hideFinancials?: boolean;
  taskCreateDisabledReason?: string;
  taskDeleteDisabledReason?: string;
  taskUpdateDisabledReason?: string;
}>();

type SalesTaskRelatedTo = NonNullable<ToDo["relatedTo"]>;

const emit = defineEmits<{
  (e: "open-add-task", payload: { initial: Partial<ToDo> }): void;
  (e: "open-edit-task", todoId: number | string): void;
  (e: "delete-task", todoId: number | string): void;
}>();

const route = useRoute();
const router = useRouter();
const cataloguesStore = useCataloguesStore();
const configStore = useConfigStore();
const contactsStore = useContactsStore();
const dealsStore = useDealsStore();
const employeesStore = useEmployeesStore();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();
const receiptsStore = useReceiptsStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();

const defaultDisabledReason =
  "You do not have permission to perform this action.";

const dealUpdateReason = computed(
  () => props.dealUpdateDisabledReason || defaultDisabledReason,
);
const taskCreateReason = computed(
  () => props.taskCreateDisabledReason || defaultDisabledReason,
);
const taskUpdateReason = computed(
  () => props.taskUpdateDisabledReason || defaultDisabledReason,
);
const taskDeleteReason = computed(
  () => props.taskDeleteDisabledReason || defaultDisabledReason,
);
const financeCreateReason = computed(
  () =>
    props.financeCreateDisabledReason ||
    (props.hideFinancials
      ? "Financials are hidden for this role."
      : defaultDisabledReason),
);
const canUseDealUpdate = computed(() => Boolean(props.canUpdateDeal));
const canUseTaskCreate = computed(() => Boolean(props.canCreateTask));
const canUseTaskUpdate = computed(() => Boolean(props.canUpdateTask));
const canUseTaskDelete = computed(() => Boolean(props.canDeleteTask));
const canUseFinanceCreate = computed(
  () =>
    Boolean(props.canCreateFinance) &&
    Boolean(props.canUpdateDeal) &&
    !props.hideFinancials,
);
const canUseFinanceUpdate = computed(
  () => Boolean(props.canUpdateFinance) && !props.hideFinancials,
);
const canUseFinanceDelete = computed(
  () => Boolean(props.canDeleteFinance) && !props.hideFinancials,
);
const canUseDocumentShare = computed(() => !props.hideFinancials);

cataloguesStore.init();
configStore.init();
contactsStore.init();
dealsStore.init();
employeesStore.init();
quotationsStore.init();
proformasStore.init();
invoicesStore.init();
receiptsStore.init();
todosStore.init();

const canCreateDocumentSource = (kind: DealDocumentSourceKind) =>
  isDocumentSourceInternal(configStore.financial, kind);

const canAttachDocumentSource = (kind: DealDocumentSourceKind) =>
  isDocumentSourceExternal(configStore.financial, kind);

const canCreateAnyDocumentSource = () =>
  canCreateDocumentSource("quotation") ||
  canCreateDocumentSource("proforma") ||
  canCreateDocumentSource("invoice");

const canAttachAnyDocumentSource = () =>
  canAttachDocumentSource("quotation") ||
  canAttachDocumentSource("proforma") ||
  canAttachDocumentSource("invoice");

const canStartFinanceCreateFlow = () => {
  if (canUseFinanceCreate.value) return true;

  notifications.push(financeCreateReason.value, "warning", 3000);

  return false;
};

const financeUpdateReason = computed(() =>
  props.hideFinancials
    ? "Financials are hidden for this role."
    : "You do not have permission to update finance.",
);
const financeDeleteReason = computed(() =>
  props.hideFinancials
    ? "Financials are hidden for this role."
    : "You do not have permission to delete finance.",
);
const financeShareReason = computed(() =>
  props.hideFinancials
    ? "Financials are hidden for this role."
    : defaultDisabledReason,
);

const notifyFinanceDenied = (reason: string) => {
  notifications.push(reason, "warning", 3000);
};

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
    balance?: number | null;
    quotationStatus: string;
    dealId: number | null;
    parentQuotationId?: number | string | null;
    isRevision?: boolean | null;
    client?: unknown;
    avatar?: string;
  };
  purchasedProducts?: Array<{
    billingPeriod?: DealBillingPeriod | null;
    billingPeriodKey?: string | null;
    catalogueItemId?: string | null;
    cost?: number | null;
    dealSelectionKey?: string | null;
    description?: string | null;
    discountType?: "none" | "percent" | "currency" | null;
    discountValue?: number | null;
    hours?: number | null;
    taxApplicable?: boolean | null;
    title?: string | null;
  }>;
  convertedInvoiceId?: number | string | null;
  convertedProformaId?: number | string | null;
  paymentMethod?: string | null;
  payments?: Array<{ amount?: number | null }>;
}

interface DealDocumentPanelRecord {
  id: number | string;
  balance: number;
  dueDate: string;
  issuedDate: string;
  periodPhase: string;
  quoteNumber: string;
  record: DealDocumentContainer;
  status: string;
  total: number;
}

interface DealDocumentPanel {
  emptyText: string;
  key: DealPreviewKind;
  numberHeader: string;
  records: DealDocumentPanelRecord[];
  summary: string;
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
const selectionDialogVisible = ref(false);
const alreadyQuotedDialogVisible = ref(false);
const externalDocumentDialogVisible = ref(false);
const addItemFormRef = ref<VForm>();
const phaseFormRef = ref<VForm>();
const createDraftItemFormRef = ref<VForm>();
const editLineFormRef = ref<VForm>();
const externalDocumentFormRef = ref<VForm>();
const expandedItems = ref<Array<number | string>>([]);
const activePeriodActionPanel = ref<{
  itemId: number | string;
  sectionId: string;
} | null>(null);
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
const alreadyQuotedDialogItems = ref<DealDocumentSelectableItem[]>([]);
const alreadyQuotedDialogResolver = ref<((value: boolean) => void) | null>(
  null,
);

const isItemsOverviewCollapsed = ref(false);
const activeDocumentPanelKeys = ref<DealPreviewKind[]>([]);
const highlightedDocumentRowKey = ref<string | null>(null);
let highlightedDocumentRowTimer: ReturnType<typeof setTimeout> | null = null;
const selectedPaymentDocument = ref<{
  id: number | string;
  kind: Extract<DealPreviewKind, "proforma" | "invoice">;
} | null>(null);
const pendingDeleteTask = ref<DealSalesTaskRow | null>(null);
const invoicePaymentDrawerOpen = ref(false);
const previewActionFrame = ref<HTMLIFrameElement | null>(null);
const previewActionFrameKind = ref<DealPreviewKind | null>(null);
const previewActionFrameSrc = ref("");
const isPreviewActionFrameReady = ref(false);
const pendingPreviewAction = ref<{
  action: "print" | "download";
  kind: DealPreviewKind;
  recordId: number | string;
} | null>(null);
const isSendDocumentDialogOpen = ref(false);
const emailDialogRef = ref<any | null>(null);
const pendingEmailDocument = ref<{
  kind: DealPreviewKind;
  recordId: number | string;
} | null>(null);
const invoiceConversionDialogVisible = ref(false);
const pendingInvoiceConversionRecord = ref<DealDocumentPanelRecord | null>(
  null,
);
const quotationConversionDialogVisible = ref(false);
const pendingQuotationConversionRecord = ref<DealDocumentPanelRecord | null>(
  null,
);
const pendingQuotationConversionKind = ref<Extract<
  DealPreviewKind,
  "proforma" | "invoice"
> | null>(null);
const selectedQuotationConversionOptionKeys = ref<string[]>([]);
const selectedQuotationConversionPeriodKeys = ref<Record<string, string[]>>({});
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
  if (kind === "quotation") return "Active";
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

  return `Period ${periodNumber} - ${formatter.format(parsedStartDate)} - ${formatter.format(parsedEndDate)}`;
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
  discountPercent: 0,
  name: "",
  note: "",
  price: 0,
  quantity: 1,
  recurrentEndDate: defaultRetainerEndDate(),
  recurrentPeriods: 12,
  recurrentStartDate: defaultRetainerStartDate(),
  retainerEndDate: defaultRetainerEndDate(),
  retainerPeriods: 12,
  retainerStartDate: defaultRetainerStartDate(),
  taxApplicable: true as boolean | null,
});
const addProducedCustomization = ref<DealProducedCustomization | null>(null);

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
const editProducedCustomization = ref<DealProducedCustomization | null>(null);

const editLineRequiresRetainerTerm = computed(() => {
  if (editLine.mode !== "item") return false;

  return isRetainerCatalogueType(getItemById(editLine.itemId)?.catalogueType);
});

const editLineRequiresRecurrentTerm = computed(() => {
  if (editLine.mode !== "item") return false;

  return isRecurrentCatalogueType(getItemById(editLine.itemId)?.catalogueType);
});

const editLineUsesPeriodQuantity = computed(
  () =>
    editLineRequiresRecurrentTerm.value || editLineRequiresRetainerTerm.value,
);

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
      rawName: item.name.trim(),
      value: item.id,
    })),
);

const catalogueItemLabels = computed(() =>
  catalogueOptions.value.map((item) => item.title),
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

watch(selectedCatalogueItemId, () => {
  const item = selectedCatalogueItem.value;
  const record = selectedCatalogueRecord.value as {
    chargeTax?: boolean;
    taxApplicable?: boolean;
  } | null;

  addItemDraft.name = item?.name ?? "";
  addItemDraft.price = Number(item?.bestPrice || 0);
  addItemDraft.discountPercent = 0;
  addItemDraft.taxApplicable =
    record?.chargeTax ?? record?.taxApplicable ?? true;
  addItemDraft.note = item?.description ?? "";
  addProducedCustomization.value = addProducedProductRecord.value
    ? buildProducedCustomizationDraft(addProducedProductRecord.value)
    : null;
});

const selectedCatalogueItemName = computed({
  get: () => addItemDraft.name,
  set: (value: string | null) => {
    const nextName = String(value ?? "").trim();

    if (!nextName) {
      selectedCatalogueItemId.value = null;
      addItemDraft.name = "";
      return;
    }

    const matchedOption =
      catalogueOptions.value.find(
        (item) =>
          item.title.toLowerCase() === nextName.toLowerCase() ||
          item.rawName.toLowerCase() === nextName.toLowerCase(),
      ) ?? null;

    if (
      matchedOption &&
      String(selectedCatalogueItemId.value ?? "") !==
        String(matchedOption.value)
    ) {
      selectedCatalogueItemId.value = matchedOption.value;
      return;
    }

    addItemDraft.name = nextName;
  },
});

const normalizeProducedCustomizationValue = (
  type: CatalogueProducedProductFieldType,
  value: unknown,
) => {
  if (type === "Pictures") {
    return Array.isArray(value)
      ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];
  }

  if (type === "Number") {
    if (value === null || value === undefined || value === "") return null;

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(", ");

  const normalized = String(value).trim();
  return normalized || null;
};

const cloneProducedCustomizationField = (
  field: DealProducedCustomizationField,
): DealProducedCustomizationField => ({
  ...field,
  values: Array.isArray(field.values) ? [...field.values] : [],
  value: Array.isArray(field.value) ? [...field.value] : field.value,
});

const cloneProducedCustomization = (
  customization: DealProducedCustomization | null | undefined,
): DealProducedCustomization | null =>
  customization
    ? {
        options: customization.options.map(cloneProducedCustomizationField),
        measurements: customization.measurements.map(
          cloneProducedCustomizationField,
        ),
        subItems: customization.subItems.map((subItem) => ({
          ...subItem,
          options: subItem.options.map(cloneProducedCustomizationField),
          measurements: subItem.measurements.map(
            cloneProducedCustomizationField,
          ),
        })),
      }
    : null;

const buildProducedCustomizationFields = (
  fields: Array<{
    id: number;
    name: string;
    type: CatalogueProducedProductFieldType;
    description: string;
    values: string[];
  }>,
  existing?: DealProducedCustomizationField[] | null,
) =>
  fields.map((field) => {
    const current =
      existing?.find((entry) => Number(entry.fieldId) === Number(field.id)) ??
      null;

    return {
      fieldId: Number(field.id),
      name: String(field.name ?? "").trim(),
      type: field.type,
      description: String(field.description ?? "").trim(),
      values: Array.isArray(field.values) ? [...field.values] : [],
      value: normalizeProducedCustomizationValue(field.type, current?.value),
    } satisfies DealProducedCustomizationField;
  });

const buildProducedCustomizationDraft = (
  record: CatalogueProducedProductRecord,
  existing?: DealProducedCustomization | null,
): DealProducedCustomization => ({
  options: buildProducedCustomizationFields(
    Array.isArray(record.options) ? record.options : [],
    existing?.options,
  ),
  measurements: buildProducedCustomizationFields(
    Array.isArray(record.measurements) ? record.measurements : [],
    existing?.measurements,
  ),
  subItems: (Array.isArray(record.subItems) ? record.subItems : []).map(
    (subItem) => {
      const current =
        existing?.subItems.find(
          (entry) => Number(entry.subItemId) === Number(subItem.id),
        ) ?? null;

      return {
        subItemId: Number(subItem.id),
        name: String(subItem.name ?? "").trim(),
        options: buildProducedCustomizationFields(
          Array.isArray(subItem.options) ? subItem.options : [],
          current?.options,
        ),
        measurements: buildProducedCustomizationFields(
          Array.isArray(subItem.measurements) ? subItem.measurements : [],
          current?.measurements,
        ),
      };
    },
  ),
});

const addProducedProductRecord = computed(() =>
  selectedCatalogueRecord.value?.type === "Produced Product"
    ? (selectedCatalogueRecord.value as CatalogueProducedProductRecord)
    : null,
);

const editProducedProductRecord = computed(() => {
  if (editLine.mode !== "item") return null;

  return getProducedProductRecord(getItemById(editLine.itemId));
});

const addItemDialogMaxWidth = computed(() =>
  addProducedProductRecord.value ? 1020 : 880,
);

const editItemDialogMaxWidth = computed(() =>
  editProducedProductRecord.value ? 1020 : 880,
);

const buildProducedProductReturnQuery = (extra?: Record<string, string>) => ({
  dealFlow: "produced-product",
  dealId: String(props.deal.id),
  returnTab: "items",
  producedFlow: "create",
  ...(extra || {}),
});

const openProducedProductCatalogueCreator = async () => {
  await router.push({
    path: "/catalogues/add",
    query: {
      type: "Produced Product",
      ...buildProducedProductReturnQuery(),
    },
  });
};

const handleProducedProductReturn = async () => {
  if (route.query.dealFlow !== "produced-product") return;
  if (String(route.query.dealId || "") !== String(props.deal.id)) return;

  const flow = String(route.query.producedFlow || "");
  const returnedCatalogueItemId = String(
    route.query.catalogueItemId || "",
  ).trim();

  if (flow === "create") {
    openAddItemDialog();

    if (returnedCatalogueItemId) {
      selectedCatalogueItemId.value = returnedCatalogueItemId;
    }
  }

  await nextTick();

  try {
    await router.replace({
      path: route.path,
      query: { tab: "items" },
    });
  } catch {}
};

const buildDealRelatedTo = (): SalesTaskRelatedTo => ({
  id: props.deal.id,
  name: props.deal.code || `Deal #${props.deal.id}`,
  type: "deal",
});

const buildLinkedJobRelatedTo = (): SalesTaskRelatedTo | null =>
  props.deal.linkedJobId !== null && props.deal.linkedJobId !== undefined
    ? {
        id: props.deal.linkedJobId,
        name: `Job #${props.deal.linkedJobId}`,
        type: "job",
      }
    : null;

const isValidSalesTaskRelation = (relatedTo?: ToDo["relatedTo"] | null) => {
  if (!relatedTo) return false;

  const matchesDeal =
    relatedTo.type === "deal" && String(relatedTo.id) === String(props.deal.id);

  const linkedJob = buildLinkedJobRelatedTo();
  const matchesLinkedJob =
    Boolean(linkedJob) &&
    relatedTo.type === "job" &&
    String(relatedTo.id) === String(linkedJob?.id);

  return matchesDeal || matchesLinkedJob;
};

const normalizeSalesTaskRelatedTo = (
  relatedTo?: ToDo["relatedTo"] | null,
): SalesTaskRelatedTo =>
  isValidSalesTaskRelation(relatedTo) && relatedTo
    ? {
        id: relatedTo.id,
        name: relatedTo.name,
        type: relatedTo.type,
      }
    : buildDealRelatedTo();

const resolveSalesTaskCollaborator = (entry: unknown) => {
  const raw =
    entry && typeof entry === "object"
      ? (entry as {
          id?: number | string;
          name?: string;
          fullName?: string;
          avatarUrl?: string | null;
          picture?: string | null;
        })
      : null;
  const rawId =
    raw?.id ??
    (typeof entry === "string" || typeof entry === "number" ? entry : null);
  const employee = rawId !== null ? employeesStore.byId(Number(rawId)) : null;
  const contact = rawId !== null ? contactsStore.byId(Number(rawId)) : null;

  return {
    id: rawId ?? raw?.name ?? "unknown",
    name:
      raw?.name ||
      raw?.fullName ||
      employee?.fullName ||
      contact?.fullName ||
      `User #${rawId ?? "unknown"}`,
    avatarUrl:
      raw?.avatarUrl ??
      raw?.picture ??
      employee?.picture ??
      contact?.picture ??
      null,
  };
};

const normalizeSalesTaskCollaborators = (collaborators: unknown) =>
  Array.isArray(collaborators)
    ? collaborators.map(resolveSalesTaskCollaborator)
    : [];

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

const buildSalesTaskSource = (
  itemId: number | string,
  taskId: number | string,
): NonNullable<ToDo["source"]> => ({
  type: "deal-sales-task",
  dealId: props.deal.id,
  itemId,
  taskId,
});

const isGeneratedSalesTaskForSource = (
  todo: ToDo,
  itemId: number | string,
  taskId?: number | string | null,
) =>
  todo.source?.type === "deal-sales-task" &&
  String(todo.source.dealId) === String(props.deal.id) &&
  String(todo.source.itemId) === String(itemId) &&
  (taskId === null ||
    taskId === undefined ||
    String(todo.source.taskId) === String(taskId));

const findGeneratedSalesTask = (
  itemId: number | string,
  taskId: number | string,
) =>
  todosStore.items.find((todo) =>
    isGeneratedSalesTaskForSource(todo, itemId, taskId),
  );

const buildTodoFromImportedSalesTask = (
  task: DealSalesTaskTemplate,
): Partial<ToDo> | null => {
  if (task.sourceItemId === null || task.sourceItemId === undefined)
    return null;
  if (task.sourceTaskId === null || task.sourceTaskId === undefined)
    return null;

  return {
    title: task.title,
    collaborators: normalizeSalesTaskCollaborators(task.collaborators),
    dueAt: task.afterWhen
      ? parseAfterWhen(task.afterWhen)
      : new Date().toISOString(),
    afterWhen: task.afterWhen ?? null,
    startTrigger: task.startTrigger ?? {
      type: "time",
      goalId: null,
      taskId: null,
    },
    notes: task.notes || "",
    status: task.status || "pending",
    important: Boolean(task.important),
    attachment: task.attachment ?? null,
    relatedTo: buildDealRelatedTo(),
    steps: Array.isArray(task.steps)
      ? task.steps.map((step) => ({
          ...step,
          collaborators: normalizeSalesTaskCollaborators(step.collaborators),
        }))
      : [],
    source: buildSalesTaskSource(task.sourceItemId, task.sourceTaskId),
  };
};

const materializeImportedSalesTasks = () => {
  const catalogueImportedSalesTasks = buildImportedSalesTaskTemplates(
    props.deal.items || [],
  );
  const legacyImportedSalesTasks = Array.isArray(props.deal.salesTasks)
    ? props.deal.salesTasks
        .filter(
          (task) =>
            task.sourceItemId !== null && task.sourceItemId !== undefined,
        )
        .map((task) =>
          cloneDealSalesTaskTemplate({
            ...task,
            relatedTo: buildDealRelatedTo(),
          }),
        )
    : [];
  const importedSalesTasks = [
    ...catalogueImportedSalesTasks,
    ...legacyImportedSalesTasks.filter(
      (legacyTask) =>
        !catalogueImportedSalesTasks.some(
          (catalogueTask) =>
            String(catalogueTask.sourceItemId) ===
              String(legacyTask.sourceItemId) &&
            String(catalogueTask.sourceTaskId) ===
              String(legacyTask.sourceTaskId),
        ),
    ),
  ];

  importedSalesTasks.forEach((task) => {
    if (task.sourceItemId === null || task.sourceItemId === undefined) return;
    if (task.sourceTaskId === null || task.sourceTaskId === undefined) return;

    const existing = findGeneratedSalesTask(
      task.sourceItemId,
      task.sourceTaskId,
    );
    const payload = buildTodoFromImportedSalesTask(task);
    if (!payload) return;

    if (existing) {
      todosStore.updateTodo(
        existing.id,
        {
          source: payload.source,
          relatedTo: buildDealRelatedTo(),
        },
        { system: true },
      );
      return;
    }

    todosStore.addTodo(payload, { system: true });
  });
};

const removeGeneratedSalesTasksForItem = (itemId: number | string) => {
  todosStore.items
    .filter((todo) => isGeneratedSalesTaskForSource(todo, itemId))
    .forEach((todo) => todosStore.removeTodo(todo.id));
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
    ? normalizeSalesTaskCollaborators(task.collaborators)
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

watch(
  () => props.deal.items,
  () => materializeImportedSalesTasks(),
  { deep: true },
);

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
    name?: string | null;
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
    producedCustomization?: DealProducedCustomization | null;
    taxApplicable?: boolean | null;
    unitPrice?: number | null;
  },
) => {
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

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
      name: options?.name?.trim() || catalogueItem.name,
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
      producedCustomization: cloneProducedCustomization(
        options?.producedCustomization,
      ),
      unitPrice: Number(options?.unitPrice ?? catalogueItem.bestPrice ?? 0),
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
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

  if (route.query.dealFlow !== "produced-product") {
    selectedCatalogueItemId.value = null;
  }
  addProducedCustomization.value = null;
  addItemDraft.name = "";
  addItemDraft.price = 0;
  addItemDraft.discountPercent = 0;
  addItemDraft.taxApplicable = true;
  addItemDraft.note = "";
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
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

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
    discountPercent: Number(addItemDraft.discountPercent || 0),
    name: addItemDraft.name,
    note: addItemDraft.note?.trim() || null,
    recurrentTerm,
    retainerTerm,
    taxApplicable: addItemDraft.taxApplicable,
    unitPrice: Number(addItemDraft.price || 0),
    producedCustomization:
      selectedItem.type === "Produced Product"
        ? cloneProducedCustomization(addProducedCustomization.value)
        : null,
  });
  notifications.push("Item added to deal", "success", 3000);
  addItemDialogVisible.value = false;
};

const openCreateDraftItemDialog = (type: CatalogueItemType) => {
  const choice = itemTypeChoices.find((item) => item.value === type);
  if (choice?.comingSoon) return;

  if (type === "Produced Product") {
    createItemTypeDialogVisible.value = false;
    void openProducedProductCatalogueCreator();
    return;
  }

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
  if (isDealItemInvoiced(item)) {
    notifyInvoicedItemLocked();

    return;
  }

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
    .forEach((existingItem) => {
      removeGeneratedSalesTasksForItem(existingItem.id);
      (existingItem.generatedTaskIds || []).forEach((taskId) =>
        todosStore.removeTodo(taskId),
      );
    });

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
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

  if (isDealItemInvoiced(item)) {
    notifyInvoicedItemLocked();

    return;
  }

  const isGeneratedRelatedItem =
    item.catalogueType === "Related Item" &&
    !!item.parentItemId &&
    !!item.sourceRelatedItemId &&
    !getItemById(item.panelId);

  if (isGeneratedRelatedItem) {
    const overrideKey = `related-${item.sourceRelatedItemId}`;
    const parent = getItemById(item.parentItemId);
    const override = parent?.subItemOverrides?.[overrideKey] || {};

    editProducedCustomization.value = null;
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
  const producedRecord =
    item.catalogueType === "Produced Product"
      ? getProducedProductRecord(item)
      : null;
  editProducedCustomization.value = producedRecord
    ? buildProducedCustomizationDraft(
        producedRecord,
        item.producedCustomization || null,
      )
    : null;
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
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

  if (goal.overrideKey.includes("-custom-")) {
    openEditCustomPhase(parentItem, goal);

    return;
  }

  const sourceItem = getItemById(parentItem.id);
  const override = sourceItem?.subItemOverrides?.[goal.overrideKey] || {};

  editProducedCustomization.value = null;
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
  if (!canUseDealUpdate.value) {
    notifications.push(dealUpdateReason.value, "warning", 3000);
    return;
  }

  const { valid } = (await editLineFormRef.value?.validate()) ?? {
    valid: true,
  };

  if (!valid) return;

  const editSelectionKey =
    editLine.mode === "item"
      ? `item-${editLine.itemId}`
      : `item-${editLine.parentItemId}-${editLine.overrideKey}`;
  if (isSelectionInvoiced(editSelectionKey)) {
    notifyInvoicedItemLocked();

    return;
  }

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
        producedCustomization:
          item.catalogueType === "Produced Product"
            ? cloneProducedCustomization(editProducedCustomization.value)
            : null,
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
  props.hideFinancials
    ? "Hidden"
    : value === null || value === undefined
      ? "--"
      : Number(value).toLocaleString();

const formatDealMoney = (value?: number | null) =>
  props.hideFinancials
    ? "Hidden"
    : formatCurrencyAmount(value, configStore.financial);

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
  const formatProducedCustomizationValue = (value: unknown) =>
    Array.isArray(value)
      ? value.join(", ")
      : value === null || value === undefined
        ? ""
        : String(value).trim();

  const valueSummary = [
    ...(item?.producedCustomization?.options || []),
    ...(item?.producedCustomization?.measurements || []),
  ]
    .map((field) => {
      const value = formatProducedCustomizationValue(field.value);

      if (!value) return "";
      return `${field.name}: ${value}`;
    })
    .filter(Boolean);

  if (valueSummary.length) return valueSummary.join(" | ");

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
  const formatProducedCustomizationValue = (value: unknown) =>
    Array.isArray(value)
      ? value.join(", ")
      : value === null || value === undefined
        ? ""
        : String(value).trim();

  const customizationSummary = (item?.producedCustomization?.subItems || [])
    .map((subItem) => {
      const values = [
        ...(subItem.options || []),
        ...(subItem.measurements || []),
      ]
        .map((field) => {
          const value = formatProducedCustomizationValue(field.value);

          if (!value) return "";
          return `${field.name}: ${value}`;
        })
        .filter(Boolean);

      if (!values.length) return "";
      return `${subItem.name}: ${values.join(", ")}`;
    })
    .filter(Boolean);

  if (customizationSummary.length) return customizationSummary.join(" | ");

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

const isPeriodDrivenParentDealItem = (
  item?: DealItem | DealItemWithPlan | null,
) => isRetainerParentDealItem(item) || isRecurrentParentDealItem(item);

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

const isContractualParentDealItem = (
  item?: DealItem | DealItemWithPlan | null,
) =>
  String(item?.catalogueType ?? "")
    .trim()
    .toLowerCase() === "contractual service";

const getItemDisplayMetric = (item?: DealItem | DealItemWithPlan | null) => {
  if (!item) return { label: "Qty", value: "--" };

  if (isRetainerParentDealItem(item) || isRecurrentParentDealItem(item)) {
    const periodLabel = getPeriodPriceLabel(item);

    return {
      label: "Periods",
      value: periodLabel || String(getItemEffectiveQuantity(item)),
    };
  }

  const metricType = String(
    (item as DealItem).catalogueType || (item as DealItem).itemTypeLabel || "",
  )
    .trim()
    .toLowerCase();

  if (metricType === "phase") {
    return {
      label: "Phase",
      value: String(getItemQuantityDisplayValue(item)),
    };
  }

  return {
    label: "Qty",
    value: String(getItemQuantityDisplayValue(item)),
  };
};

const isPeriodDrivenHeaderItem = (
  item?: DealItem | DealItemWithPlan | null,
) => isRetainerParentDealItem(item) || isRecurrentParentDealItem(item);

const getItemDateFields = (item?: DealItem | DealItemWithPlan | null) => {
  if (!item)
    return [] as Array<{ label: "Start date" | "End date"; value: string }>;

  const rawStartDate = isRetainerCatalogueType(item.catalogueType)
    ? item.retainerStartDate
    : isRecurrentCatalogueType(item.catalogueType)
      ? item.recurrentStartDate
      : null;
  const rawEndDate = isRetainerCatalogueType(item.catalogueType)
    ? item.retainerEndDate
    : isRecurrentCatalogueType(item.catalogueType)
      ? item.recurrentEndDate
      : null;

  const startDate = formatDocumentDate(rawStartDate);
  const endDate = formatDocumentDate(rawEndDate);
  const fields: Array<{ label: "Start date" | "End date"; value: string }> = [];

  if (startDate !== "--") {
    fields.push({ label: "Start date", value: startDate });
  }

  if (endDate !== "--") {
    fields.push({
      label: "End date",
      value:
        startDate !== "--" && endDate === startDate
          ? "same as start"
          : endDate,
    });
  }

  return fields;
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
  if (!item.parentItemId && isRetainerCatalogueType(item.catalogueType))
    return Math.max(Number((item as DealItem).retainerPeriods ?? 1), 1);
  if (!item.parentItemId && isRecurrentCatalogueType(item.catalogueType))
    return Math.max(Number((item as DealItem).recurrentPeriods ?? 1), 1);

  return Number(item.quantity ?? 0);
};

const getItemQuantityDisplayValue = (
  item?: DealItem | DealItemWithPlan | null,
) => {
  if (!item) return "--";
  if (
    !item.parentItemId &&
    (isRetainerCatalogueType(item.catalogueType) ||
      isRecurrentCatalogueType(item.catalogueType))
  ) {
    return getItemEffectiveQuantity(item);
  }

  return item.quantity ?? "--";
};

const getPeriodPriceLabel = (
  item?: DealItem | DealItemWithPlan | DealDocumentSelectableItem | null,
) => {
  if (!item) return "";
  if (isRetainerCatalogueType(item.catalogueType)) {
    const periods = Number((item as DealItem).retainerPeriods ?? 0);

    return periods > 0
      ? `${periods} retainer period${periods === 1 ? "" : "s"}`
      : "";
  }
  if (isRecurrentCatalogueType(item.catalogueType)) {
    const periods = Number((item as DealItem).recurrentPeriods ?? 0);

    return periods > 0
      ? `${periods} recurrent period${periods === 1 ? "" : "s"}`
      : "";
  }

  return "";
};

const getSelectableItemPriceSummary = (item: DealDocumentSelectableItem) => {
  const itemMode = resolveDealDocumentBillingModeForItem(item);
  const price = formatMoney(item.unitPrice);

  if (itemMode === "retainer-period" || itemMode === "recurrent-period") {
    const periodLabel = getPeriodPriceLabel(item);
    if (!periodLabel) return `${price} x 1 period`;

    return `${price} x ${periodLabel}`;
  }

  return `${price} x ${item.quantity ?? 1}`;
};

const itemAmount = (item: DealItem) =>
  calculateAmount(
    item.unitPrice,
    getItemEffectiveQuantity(item),
    item.discountPercent || 0,
  );

const itemDiscountedUnitPrice = (item: DealItem) =>
  calculateAmount(item.unitPrice, 1, item.discountPercent || 0);

const contractualItemAmount = (item: DealItem) =>
  getDealGrandTotal({ items: [item] }, (id, typeHint) =>
    id == null
      ? null
      : cataloguesStore.recordById(String(id), typeHint || undefined),
  );

const itemHeaderPrice = (item: DealItem) =>
  isContractualParentDealItem(item)
    ? contractualItemAmount(item)
    : itemDiscountedUnitPrice(item);

const itemHeaderAmount = (item: DealItem) =>
  isContractualParentDealItem(item)
    ? contractualItemAmount(item)
    : itemAmount(item);

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
    const retainerPeriods = buildRetainerBillingPeriods(item);

    if (retainerPeriods.length) {
      return retainerPeriods.map((period, index) =>
        makeSection(item, {
          id: `item-${item.id}-${period.key}`,
          name: period.label || `Period ${index + 1}`,
          note: null,
          price: null,
          billingPeriod: period,
          goals: retainerLines.map((service) => ({
            ...makeDerivedGoal(
              item,
              `retainer-period-${index + 1}`,
              "Retainer Service",
              {
                quantity: service.quantity,
                discountPercent: service.discountPercent,
                discountLabel: null,
                taxApplicable: service.taxApplicable,
                showQuantity: true,
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
      );
    }

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
              showQuantity: true,
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

const billingSummaryItems = computed(() =>
  getQuotationTopLevelDealItems(props.deal.items || [], (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);

const itemsSubtotal = computed(() =>
  getDealItemsSubtotal(billingSummaryItems.value, getItemEffectiveQuantity),
);

const totalDiscount = computed(() =>
  getDealItemsDiscountTotal(
    billingSummaryItems.value,
    getItemEffectiveQuantity,
  ),
);
const totalTax = computed(() => 0);

const grandTotal = computed(
  () =>
    getDealItemsGrandTotal(
      billingSummaryItems.value,
      getItemEffectiveQuantity,
    ) + totalTax.value,
);

const totalInvoiced = computed(() =>
  invoicesStore.items
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .reduce((sum, record) => sum + getDealDocumentTotal(record), 0),
);

const totalPaid = computed(() =>
  invoicesStore.items
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.deal.id),
    )
    .reduce((sum, record) => sum + getDealDocumentPaid(record), 0),
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
      { title: "Active", value: "Active" },
      { title: "Sent", value: "Sent" },
      { title: "Approval", value: "Approval" },
      { title: "Lost", value: "Lost" },
      { title: "Canceled", value: "Canceled" },
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
  balance: getDealDocumentBalance(record),
  dueDate: record.quotation.dueDate,
  id: record.quotation.id,
  issuedDate: record.quotation.issuedDate,
  periodPhase: resolveDocumentPeriodPhase(record),
  quoteNumber: record.quotation.quoteNumber,
  record,
  status: record.quotation.quotationStatus,
  total: getDealDocumentTotal(record),
});

const normalizeDocumentStatus = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isDocumentPaid = (record: DealDocumentPanelRecord) =>
  normalizeDocumentStatus(record.status) === "paid" || record.balance <= 0;

const isDocumentConverted = (record: DealDocumentPanelRecord) => {
  const status = normalizeDocumentStatus(record.status);

  return (
    status === "converted" ||
    Boolean(record.record.convertedInvoiceId) ||
    Boolean(record.record.convertedProformaId)
  );
};

const CONVERTED_LOCK_MESSAGE =
  "This document is converted and locked. Create a revision instead.";
const REVISION_LOCK_MESSAGE =
  "Older revisions cannot be edited or deleted. Use the latest revision.";
const getDocumentRecordsByKind = (kind: DealPreviewKind) => {
  if (kind === "quotation") return dealQuotationRecords.value;
  if (kind === "proforma") return dealProformaRecords.value;

  return dealInvoiceRecords.value;
};

const isOlderDocumentRevision = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  const parentId = record.record.quotation.parentQuotationId ?? record.id;
  const family = getDocumentRecordsByKind(kind).filter((candidate) => {
    const candidateParentId =
      candidate.record.quotation.parentQuotationId ?? candidate.id;

    return String(candidateParentId) === String(parentId);
  });

  if (family.length <= 1) return false;

  const latest = family.reduce((currentLatest, candidate) =>
    Number(candidate.id) > Number(currentLatest.id) ? candidate : currentLatest,
  );

  return String(latest.id) !== String(record.id);
};

const getDocumentLockReason = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (
    (kind === "quotation" || kind === "proforma") &&
    isDocumentConverted(record)
  ) {
    return CONVERTED_LOCK_MESSAGE;
  }

  if (isOlderDocumentRevision(kind, record)) return REVISION_LOCK_MESSAGE;

  return "";
};

const isDocumentConversionBlocked = (record: DealDocumentPanelRecord) => {
  const status = normalizeDocumentStatus(record.status);

  return (
    status === "canceled" ||
    status === "lost" ||
    isDocumentConverted(record) ||
    !canConvertFinanceDocument(record.record as any)
  );
};

const canPayDocument = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) =>
  (kind === "proforma" || kind === "invoice") &&
  !isDocumentPaid(record) &&
  record.balance > 0;

const getApprovalDocument = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (kind === "quotation") return quotationsStore.byId(record.id) as any;
  if (kind === "proforma") return proformasStore.byId(record.id) as any;
  if (kind === "invoice") return invoicesStore.byId(record.id) as any;

  return null;
};

const getApprovalAction = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  const document = getApprovalDocument(kind, record);
  const approvalMode = document?.approvalMode;
  const approvalRequestedAt = document?.approvalRequestedAt?.trim?.() || null;
  const approvalStatus = normalizeFinanceApprovalStatus(document);

  if (approvalMode !== "Request Approval") {
    return {
      disabled: true,
      title: "Approval Automatic",
    };
  }

  if (approvalStatus === "approved") {
    return {
      disabled: true,
      title: "Approved",
    };
  }

  if (approvalStatus === "pending" && approvalRequestedAt) {
    return {
      disabled: false,
      title: "Remind Approver",
    };
  }

  return {
    disabled: false,
    title: "Request Approval",
  };
};

const requestApproval = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canUseFinanceUpdate.value) {
    notifyFinanceDenied(financeUpdateReason.value);
    return;
  }

  if (getApprovalAction(kind, record).disabled) return;

  const patch = {
    approvalRequestedAt: new Date().toISOString(),
    approvalStatus: "pending",
    approvalApprovedAt: null,
    approvalApprovedBy: null,
    approvalRejectedAt: null,
    approvalRejectedBy: null,
  } as any;

  const updated =
    kind === "quotation"
      ? quotationsStore.updateQuotation(record.id, patch)
      : kind === "proforma"
        ? proformasStore.updateProforma(record.id, patch)
        : invoicesStore.updateInvoice(record.id, patch);

  if (updated) {
    const approvalDocument = getApprovalDocument(kind, record);

    notifyFinanceApprovalRequest(kind, updated, {
      force: true,
      reminder: Boolean(approvalDocument?.approvalRequestedAt),
    });
  }

  notifications.push("Approval requested.", "success", 2500);
};

const canConvertQuotationRecord = (record: DealDocumentPanelRecord) =>
  !isDocumentConversionBlocked(record);

const resolveCatalogueRecordForDocuments = (
  id: string,
  typeHint?: string | null,
) => cataloguesStore.recordById(id, typeHint);

const getQuotationConversionProductsForRecord = (
  record: DealDocumentPanelRecord,
) =>
  buildDealQuotationConversionProducts({
    deal: props.deal,
    products: record.record.purchasedProducts || [],
    resolveCatalogueRecord: resolveCatalogueRecordForDocuments,
  });

const getQuotationConversionOptionsForRecord = (
  record: DealDocumentPanelRecord,
) =>
  buildDealQuotationConversionOptions({
    deal: props.deal,
    products: record.record.purchasedProducts || [],
    resolveCatalogueRecord: resolveCatalogueRecordForDocuments,
  });

const quotationConversionOptions = computed(() =>
  pendingQuotationConversionRecord.value
    ? getQuotationConversionOptionsForRecord(
        pendingQuotationConversionRecord.value,
      )
    : [],
);

const initializeQuotationConversionSelection = (
  options: DealQuotationConversionOption[],
) => {
  selectedQuotationConversionOptionKeys.value = options.map(
    (option) => option.key,
  );
  selectedQuotationConversionPeriodKeys.value = Object.fromEntries(
    options
      .filter((option) => option.periods.length)
      .map((option) => [
        option.key,
        option.periods.map((period) => period.key),
      ]),
  );
};

const selectedQuotationConversionProducts = computed(() => {
  const selectedOptions = new Set(selectedQuotationConversionOptionKeys.value);

  return quotationConversionOptions.value.flatMap((option) => {
    if (!selectedOptions.has(option.key)) return [];

    if (!option.periods.length) return [option.product];

    const selectedPeriods = new Set(
      selectedQuotationConversionPeriodKeys.value[option.key] || [],
    );

    return option.periods
      .filter((period) => selectedPeriods.has(period.key))
      .map((period) => period.product);
  });
});

const selectedQuotationConversionTotal = computed(() =>
  getQuotationGrandTotal(selectedQuotationConversionProducts.value as never),
);

const getConversionLineContext = (
  product: NonNullable<DealDocumentContainer["purchasedProducts"]>[number],
) => {
  if (product.billingPeriod)
    return getDealBillingPeriodLabel(product.billingPeriod) || "Billing period";

  const billingPeriodKey = resolveStoredBillingPeriodKey(product);
  if (billingPeriodKey) return billingPeriodKey;

  const selectionKey = String(product.dealSelectionKey ?? "");
  if (selectionKey.includes("phase")) return "Phase";
  if (selectionKey.includes("retainer")) return "Retainer period";
  if (selectionKey.includes("recurrent")) return "Recurrent period";

  return "--";
};

const getConversionLineDiscount = (
  product: NonNullable<DealDocumentContainer["purchasedProducts"]>[number],
) => formatMoney(getLineDiscountAmount(product as never));

const getConversionLineTotal = (
  product: NonNullable<DealDocumentContainer["purchasedProducts"]>[number],
) => formatMoney(getLineTotal(product as never));

const getConversionOptionTypeLabel = (
  option: DealQuotationConversionOption,
) => {
  if (option.kind === "phase") return "Phase";
  if (option.kind === "retainer-period") return "Retainer";
  if (option.kind === "recurrent-period") return "Recurrent";

  return "Item";
};

const getConversionOptionTotal = (option: DealQuotationConversionOption) => {
  if (!option.periods.length)
    return getConversionLineTotal(option.product as never);

  const selectedPeriods = new Set(
    selectedQuotationConversionPeriodKeys.value[option.key] || [],
  );
  const products = option.periods
    .filter((period) => selectedPeriods.has(period.key))
    .map((period) => period.product);

  return formatMoney(getQuotationGrandTotal(products as never));
};

const getConversionLineTaxStatus = (
  product: NonNullable<DealDocumentContainer["purchasedProducts"]>[number],
) => (product.taxApplicable === false ? "VAT not applied" : "VAT applicable");

const resolveDocumentPeriodPhase = (record: DealDocumentContainer) => {
  const labels = (record.purchasedProducts || [])
    .map((product) => {
      if (product.billingPeriod)
        return getDealBillingPeriodLabel(product.billingPeriod);

      const billingKey = resolveStoredBillingPeriodKey(product);
      if (billingKey) return billingKey;

      const selectionKey = resolveProductSelectionKey(product);
      const selectable = selectableDocumentItems.value.find(
        (item) => item.selectionKey === selectionKey,
      );

      return selectable?.parentName || product.title || null;
    })
    .filter((label): label is string => Boolean(label?.trim()));

  const uniqueLabels = Array.from(new Set(labels));

  if (!uniqueLabels.length) return "--";
  if (uniqueLabels.length <= 2) return uniqueLabels.join(", ");

  return `${uniqueLabels[0]} +${uniqueLabels.length - 1}`;
};

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

const formatCompactDocumentDate = (value?: string | null) => {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
};

const getDaysUntil = (value?: string | null) => {
  if (!value) return null;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};

const getQuotationPanelSummary = (records: DealDocumentPanelRecord[]) => {
  if (!records.length) return "No quotations";
  if (records.some(isDocumentConverted)) return "Converted";

  const expiryRecord =
    records
      .filter((record) => record.dueDate)
      .sort(
        (left, right) =>
          new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
      )[0] ?? records[0];
  const days = getDaysUntil(expiryRecord.dueDate);
  const dayLabel = days === null ? "" : ` (${days} days)`;

  return `Expiry: ${formatCompactDocumentDate(expiryRecord.dueDate)}${dayLabel}`;
};

const getProformaPanelSummary = (records: DealDocumentPanelRecord[]) => {
  const paid = records.filter(isDocumentPaid).length;
  const converted = records.filter(isDocumentConverted).length;
  const notPaid = records.filter(
    (record) => !isDocumentPaid(record) && !isDocumentConverted(record),
  ).length;
  const active = records.length - converted;

  return `${active} active | ${paid} paid | ${notPaid} not paid | ${converted} converted`;
};

const getInvoicePanelSummary = (records: DealDocumentPanelRecord[]) => {
  const paid = records.filter(isDocumentPaid).length;
  const notPaid = records.length - paid;

  return `${notPaid} not paid | ${paid} paid`;
};

const dealDocumentPanels = computed<DealDocumentPanel[]>(() => [
  {
    emptyText: "No quotations created yet.",
    key: "quotation",
    numberHeader: "QT #",
    records: dealQuotationRecords.value,
    summary: getQuotationPanelSummary(dealQuotationRecords.value),
    title: "Quotations",
  },
  {
    emptyText: "No proformas created yet.",
    key: "proforma",
    numberHeader: "PF #",
    records: dealProformaRecords.value,
    summary: getProformaPanelSummary(dealProformaRecords.value),
    title: "Proformas",
  },
  {
    emptyText: "No invoices created yet.",
    key: "invoice",
    numberHeader: "INV #",
    records: dealInvoiceRecords.value,
    summary: getInvoicePanelSummary(dealInvoiceRecords.value),
    title: "Invoices",
  },
]);

const isDocumentPanelExpanded = (key: DealPreviewKind) =>
  activeDocumentPanelKeys.value.includes(key);

const getDocumentSummaryRowKey = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => `${kind}-${record.id}`;

const getDocumentSummaryRowId = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => `deal-document-row-${kind}-${record.id}`;

const jumpToDocumentSummaryRecord = async (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  record: DealDocumentPanelRecord | null,
) => {
  if (!record) return;

  const rowKey = getDocumentSummaryRowKey(kind, record);

  isItemsOverviewCollapsed.value = false;
  if (!activeDocumentPanelKeys.value.includes(kind)) {
    activeDocumentPanelKeys.value = [...activeDocumentPanelKeys.value, kind];
  }
  highlightedDocumentRowKey.value = rowKey;

  await nextTick();

  document
    .getElementById(getDocumentSummaryRowId(kind, record))
    ?.scrollIntoView({ behavior: "smooth", block: "center" });

  if (highlightedDocumentRowTimer) clearTimeout(highlightedDocumentRowTimer);

  highlightedDocumentRowTimer = setTimeout(() => {
    if (highlightedDocumentRowKey.value === rowKey) {
      highlightedDocumentRowKey.value = null;
    }

    highlightedDocumentRowTimer = null;
  }, 2400);
};

const setActiveDocumentPanel = (key: DealPreviewKind) => {
  activeDocumentPanelKeys.value = activeDocumentPanelKeys.value.includes(key)
    ? activeDocumentPanelKeys.value.filter((panelKey) => panelKey !== key)
    : [...activeDocumentPanelKeys.value, key];
};

const toggleItemsOverviewCollapsed = () => {
  isItemsOverviewCollapsed.value = !isItemsOverviewCollapsed.value;
};

const getPreviewRouteName = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "apps-quotation-preview-id";
  if (kind === "proforma") return "apps-proforma-preview-id";

  return "apps-invoice-preview-id";
};

const getDocumentLabel = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "Quotation";
  if (kind === "proforma") return "Proforma";

  return "Invoice";
};

const getDocumentStoreRecord = (
  kind: DealPreviewKind,
  recordId: number | string,
) => {
  if (kind === "quotation") return quotationsStore.byId(recordId) as any;
  if (kind === "proforma") return proformasStore.byId(recordId) as any;

  return invoicesStore.byId(recordId) as any;
};

const cloneDealPreviewRecord = (
  kind: DealPreviewKind,
  record: DealDocumentContainer,
) => {
  if (kind === "quotation") return cloneQuotationRecord(record as any);
  if (kind === "proforma") return cloneProformaRecord(record as any);

  return cloneInvoiceRecord(record as any);
};

const clonePreviewPayloadSection = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON cloning for reactive proxies.
    }
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const getPreviewReadyMessageType = (kind: DealPreviewKind) =>
  `${kind}-preview-ready`;

const getPreviewActionMessageType = (kind: DealPreviewKind) =>
  `${kind}-preview-action`;

const ensurePreviewActionFrame = (
  kind: DealPreviewKind,
  recordId: number | string,
) => {
  if (!previewActionFrame.value) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.insetInlineStart = "-2000px";
    iframe.style.insetBlockStart = "0";
    iframe.style.inlineSize = "1280px";
    iframe.style.blockSize = "1800px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
    previewActionFrame.value = iframe;
  }

  const routeLocation = router.resolve({
    name: getPreviewRouteName(kind),
    params: { id: recordId },
    query: { embedded: "1" },
  });

  if (previewActionFrameSrc.value !== routeLocation.href) {
    isPreviewActionFrameReady.value = false;
    previewActionFrameKind.value = kind;
    previewActionFrameSrc.value = routeLocation.href;
    previewActionFrame.value.src = routeLocation.href;
  }
};

const sendPreviewAction = (
  kind: DealPreviewKind,
  recordId: number | string,
  action: "print" | "download",
) => {
  const storeRecord = getDocumentStoreRecord(kind, recordId);
  if (!storeRecord || !previewActionFrame.value?.contentWindow) return;

  previewActionFrame.value.contentWindow.postMessage(
    {
      type: getPreviewActionMessageType(kind),
      payload: {
        action,
        quotation: cloneDealPreviewRecord(kind, storeRecord),
        legal: clonePreviewPayloadSection(configStore.legal),
        financial: clonePreviewPayloadSection(configStore.financial),
      },
    },
    window.location.origin,
  );
};

const flushPendingPreviewAction = () => {
  const pendingAction = pendingPreviewAction.value;
  if (!pendingAction || !isPreviewActionFrameReady.value) return;

  sendPreviewAction(
    pendingAction.kind,
    pendingAction.recordId,
    pendingAction.action,
  );

  const storeRecord = getDocumentStoreRecord(
    pendingAction.kind,
    pendingAction.recordId,
  );
  const quoteNumber = storeRecord?.quotation?.quoteNumber || "document";

  notifications.push(
    `${pendingAction.action === "download" ? "Download" : "Print"} started for ${quoteNumber}.`,
    "success",
    2500,
  );

  pendingPreviewAction.value = null;
};

const handlePreviewActionFrameMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;
  const kind = previewActionFrameKind.value;
  if (!kind || event.data?.type !== getPreviewReadyMessageType(kind)) return;

  isPreviewActionFrameReady.value = true;
  flushPendingPreviewAction();
};

onMounted(() => {
  window.addEventListener("message", handlePreviewActionFrameMessage);
  void handleProducedProductReturn();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionFrameMessage);

  if (highlightedDocumentRowTimer) {
    clearTimeout(highlightedDocumentRowTimer);
    highlightedDocumentRowTimer = null;
  }

  if (previewActionFrame.value?.parentNode) {
    previewActionFrame.value.parentNode.removeChild(previewActionFrame.value);
  }

  previewActionFrame.value = null;
  previewActionFrameKind.value = null;
  previewActionFrameSrc.value = "";
  isPreviewActionFrameReady.value = false;
  pendingPreviewAction.value = null;
});

watch(
  () => route.query,
  () => {
    void handleProducedProductReturn();
  },
);

watch(
  [
    externalDocumentDialogVisible,
    billingPeriodDialogVisible,
    selectionDialogVisible,
    invoiceConversionDialogVisible,
    quotationConversionDialogVisible,
    alreadyQuotedDialogVisible,
  ],
  (currentValues, previousValues) => {
    const dialogClosed = currentValues.some(
      (isOpen, index) => !isOpen && previousValues?.[index],
    );

    if (dialogClosed) activePeriodActionPanel.value = null;
  },
);

const getEditRouteName = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "apps-quotation-edit-id";
  if (kind === "proforma") return "apps-proforma-edit-id";

  return "apps-invoice-edit-id";
};

const openQuickDocumentPreview = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  const route = router.resolve({
    name: getPreviewRouteName(kind),
    params: { id: record.id },
    query: undefined,
  });
  window.open(route.href, "_blank", "noopener,noreferrer");
};

const openDocumentEdit = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canUseFinanceUpdate.value) {
    notifyFinanceDenied(financeUpdateReason.value);
    return;
  }

  const lockReason = getDocumentLockReason(kind, record);
  if (lockReason) {
    notifications.push(lockReason, "warning", 3000);
    return;
  }

  router.push({
    name: getEditRouteName(kind),
    params: { id: record.id },
  });
};

const getAddRouteName = (kind: DealPreviewKind) => {
  if (kind === "quotation") return "apps-quotation-add";
  if (kind === "proforma") return "apps-proforma-add";

  return "apps-invoice-add";
};

const openDocumentPreviewAction = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
  action: "download" | "print",
) => {
  if (!canUseDocumentShare.value) {
    notifyFinanceDenied(financeShareReason.value);
    return;
  }

  ensurePreviewActionFrame(kind, record.id);
  pendingPreviewAction.value = { kind, recordId: record.id, action };

  if (!isPreviewActionFrameReady.value) return;

  flushPendingPreviewAction();
};

const emailDocumentRecord = computed(() => {
  const pending = pendingEmailDocument.value;
  if (!pending) return null;

  return getDocumentStoreRecord(pending.kind, pending.recordId);
});

const documentEmailDraft = computed(() => {
  const pending = pendingEmailDocument.value;
  const documentRecord = emailDocumentRecord.value;
  const quotation = documentRecord?.quotation;
  const label = pending ? getDocumentLabel(pending.kind) : "Document";
  const companyName = configStore.legal?.companyName?.trim() || "Squarely";
  const to = quotation?.client?.companyEmail?.trim?.() || "";
  const clientName = quotation?.client?.name?.trim?.() || "there";
  const quoteNumber = quotation?.quoteNumber?.trim?.() || "document";
  const total = formatCurrencyAmount(quotation?.total, configStore.financial);
  const expiryDate = quotation?.dueDate?.trim?.() || "";

  return {
    to,
    subject: `${label} ${quoteNumber} from ${companyName}`,
    message: `Dear ${clientName},

Please find ${quoteNumber} attached.

${label} amount: ${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName}`.trim(),
    attachments: [
      {
        name: quoteNumber ? `${quoteNumber}.pdf` : `${label} Attached`,
      },
    ],
  };
});

const openDocumentEmailDialog = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canUseDocumentShare.value) {
    notifyFinanceDenied(financeShareReason.value);
    return;
  }

  pendingEmailDocument.value = { kind, recordId: record.id };
  isSendDocumentDialogOpen.value = true;

  nextTick(() => {
    emailDialogRef.value?.openWith?.(documentEmailDraft.value);
  });
};

const closeDocumentEmailDialog = () => {
  isSendDocumentDialogOpen.value = false;
  pendingEmailDocument.value = null;
};

const onDocumentEmailSend = (payload: any) => {
  const pending = pendingEmailDocument.value;
  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  const subject = String(payload?.subject || "(no subject)");
  const count = recipients.length;

  notifications.push(
    `Email sent${count ? ` to ${count} recipient${count > 1 ? "s" : ""}` : ""}: ${subject}`,
    "success",
    3500,
  );

  if (pending?.kind === "quotation") {
    quotationsStore.markQuotationSent(pending.recordId);
  }

  closeDocumentEmailDialog();
};

const deleteDocumentRecord = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canUseFinanceDelete.value) {
    notifyFinanceDenied(financeDeleteReason.value);
    return;
  }

  const lockReason = getDocumentLockReason(kind, record);
  if (lockReason) {
    notifications.push(lockReason, "warning", 3000);
    return;
  }

  if (kind === "quotation") quotationsStore.removeQuotation(record.id);
  else if (kind === "proforma") proformasStore.removeProforma(record.id);
  else invoicesStore.removeInvoice(record.id);

  notifications.push(`${record.quoteNumber} deleted.`, "success", 2500);
};

const openDocumentRevisionDraft = async (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canStartFinanceCreateFlow()) return;

  await router.push({
    name: getAddRouteName(kind),
    query: { revisionOf: String(record.id) },
  });

  notifications.push(
    `Revision draft opened for ${record.quoteNumber}.`,
    "success",
    2500,
  );
};

const openDocumentDuplicateDraft = async (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (!canStartFinanceCreateFlow()) return;

  await router.push({
    name: getAddRouteName(kind),
    query: { duplicateOf: String(record.id) },
  });

  notifications.push(
    `Duplicate draft opened for ${record.quoteNumber}.`,
    "success",
    2500,
  );
};

const duplicateDocumentRecord = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  void openDocumentDuplicateDraft(kind, record);
};

const reviseDocumentRecord = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  void openDocumentRevisionDraft(kind, record);
};

const convertQuotationToProforma = (
  record: DealDocumentPanelRecord,
  selectedProducts = record.record.purchasedProducts || [],
) => {
  if (!canCreateDocumentSource("proforma")) {
    notifications.push(
      "Proformas are configured for external attachments.",
      "warning",
      3000,
    );

    return null;
  }

  if (!canConvertQuotationRecord(record)) {
    notifications.push("Quotation cannot be converted.", "warning", 3000);

    return null;
  }

  const total = getQuotationGrandTotal(selectedProducts as never);
  const created = proformasStore.addProforma({
    ...record.record,
    convertedInvoiceId: null,
    purchasedProducts: selectedProducts,
    quotation: {
      ...record.record.quotation,
      id: 0,
      quoteNumber: "",
      quotationStatus: "Not Paid",
      balance: total,
      total,
    },
  } as never);

  if (!created) {
    notifications.push(FINANCE_APPROVAL_CONVERSION_MESSAGE, "error", 3500);

    return null;
  }

  quotationsStore.updateQuotation(record.id, {
    ...record.record,
    quotation: {
      ...record.record.quotation,
      convertedProformaId: created?.quotation.id ?? null,
      quotationStatus: "Converted",
    },
  } as never);

  notifications.push("Quotation converted to proforma.", "success", 2500);

  return created;
};

const convertProformaRecordToInvoice = (record: DealDocumentPanelRecord) => {
  if (!canCreateDocumentSource("invoice")) {
    notifications.push(
      "Invoices are configured for external attachments.",
      "warning",
      3000,
    );

    return null;
  }

  if (!canConvertFinanceDocument(record.record as any)) {
    notifications.push(FINANCE_APPROVAL_CONVERSION_MESSAGE, "error", 3500);

    return null;
  }

  if (isDocumentConversionBlocked(record)) return null;

  const created = invoicesStore.addInvoice({
    ...record.record,
    quotation: {
      ...record.record.quotation,
      id: 0,
      quoteNumber: "",
      quotationStatus: "Not Paid",
      balance: record.total,
    },
  } as never);

  if (!created) {
    notifications.push(FINANCE_APPROVAL_CONVERSION_MESSAGE, "error", 3500);

    return null;
  }

  proformasStore.updateProforma(record.id, {
    ...record.record,
    convertedInvoiceId: created?.quotation.id ?? null,
  } as never);

  notifications.push("Proforma converted to invoice.", "success", 2500);

  return created?.quotation.id ?? null;
};

const toDealDocumentPanelRecord = (
  record: DealDocumentContainer,
): DealDocumentPanelRecord => ({
  balance: getDealDocumentBalance(record),
  dueDate: record.quotation.dueDate,
  id: record.quotation.id,
  issuedDate: record.quotation.issuedDate,
  periodPhase: resolveDocumentPeriodPhase(record),
  quoteNumber: record.quotation.quoteNumber,
  record,
  status: record.quotation.quotationStatus,
  total: getDealDocumentTotal(record),
});

const convertDocumentToInvoice = (
  kind: Extract<DealPreviewKind, "quotation" | "proforma">,
  record: DealDocumentPanelRecord,
) => {
  if (!canStartFinanceCreateFlow()) return null;

  if (kind === "proforma") return convertProformaRecordToInvoice(record);

  const createdProforma = convertQuotationToProforma(record);
  if (!createdProforma) return null;

  const createdInvoiceId = convertProformaRecordToInvoice(
    toDealDocumentPanelRecord(createdProforma),
  );

  if (createdInvoiceId) {
    quotationsStore.updateQuotation(record.id, {
      ...record.record,
      quotation: {
        ...record.record.quotation,
        convertedInvoiceId: Number(createdInvoiceId),
        convertedProformaId: Number(createdProforma.quotation.id),
        quotationStatus: "Converted",
      },
    } as never);
  }

  return createdInvoiceId;
};

const performQuotationConversion = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  record: DealDocumentPanelRecord,
  selectedProducts = record.record.purchasedProducts || [],
) => {
  if (!selectedProducts.length) {
    notifications.push("Select at least one line to convert.", "warning", 2500);

    return null;
  }

  const createdProforma = convertQuotationToProforma(record, selectedProducts);
  if (!createdProforma || kind === "proforma")
    return createdProforma?.quotation.id ?? null;

  const createdInvoiceId = convertProformaRecordToInvoice(
    toDealDocumentPanelRecord(createdProforma),
  );

  if (createdInvoiceId) {
    quotationsStore.updateQuotation(record.id, {
      ...record.record,
      quotation: {
        ...record.record.quotation,
        convertedInvoiceId: Number(createdInvoiceId),
        convertedProformaId: Number(createdProforma.quotation.id),
        quotationStatus: "Converted",
      },
    } as never);
  }

  return createdInvoiceId;
};

const closeQuotationConversionDialog = () => {
  quotationConversionDialogVisible.value = false;
  pendingQuotationConversionRecord.value = null;
  pendingQuotationConversionKind.value = null;
  selectedQuotationConversionOptionKeys.value = [];
  selectedQuotationConversionPeriodKeys.value = {};
};

const openQuotationConversionFlow = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  record: DealDocumentPanelRecord,
) => {
  const products = getQuotationConversionProductsForRecord(record);
  if (hasDealDocumentPhaseOrPeriodLines(products, props.deal.items || [])) {
    const options = getQuotationConversionOptionsForRecord(record);

    pendingQuotationConversionRecord.value = record;
    pendingQuotationConversionKind.value = kind;
    initializeQuotationConversionSelection(options);
    quotationConversionDialogVisible.value = true;

    return;
  }

  performQuotationConversion(kind, record, products);
};

const requestQuotationConversion = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  record: DealDocumentPanelRecord,
) => {
  if (!canStartFinanceCreateFlow()) return;

  if (!canConvertFinanceDocument(record.record as any)) {
    notifications.push(FINANCE_APPROVAL_CONVERSION_MESSAGE, "error", 3500);

    return;
  }

  if (isDocumentConversionBlocked(record)) {
    notifications.push("Quotation cannot be converted.", "warning", 3000);

    return;
  }

  openQuotationConversionFlow(kind, record);
};

const confirmQuotationConversion = () => {
  const record = pendingQuotationConversionRecord.value;
  const kind = pendingQuotationConversionKind.value;
  if (!record || !kind) return;

  performQuotationConversion(
    kind,
    record,
    selectedQuotationConversionProducts.value,
  );
  closeQuotationConversionDialog();
};

const selectedPaymentRecord = computed(() => {
  const target = selectedPaymentDocument.value;
  if (!target) return null;

  const source =
    target.kind === "proforma"
      ? dealProformaRecords.value
      : dealInvoiceRecords.value;

  return (
    source.find((record) => String(record.id) === String(target.id)) ?? null
  );
});

const selectedPaymentBalance = computed(() =>
  Math.max(0, Number(selectedPaymentRecord.value?.balance || 0)),
);

const getConvertedInvoiceLabel = (record: DealDocumentPanelRecord) => {
  const convertedInvoiceId =
    record.record.convertedInvoiceId ??
    (record.record.quotation as { convertedInvoiceId?: number | string | null })
      .convertedInvoiceId ??
    null;
  if (convertedInvoiceId === null || convertedInvoiceId === undefined)
    return "";

  const invoice = invoicesStore.byId(convertedInvoiceId) as any;

  return invoice?.quotation?.quoteNumber || `INV #${convertedInvoiceId}`;
};

const openDocumentPayment = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  record: DealDocumentPanelRecord,
) => {
  if (!canUseFinanceUpdate.value) {
    notifyFinanceDenied(financeUpdateReason.value);
    return;
  }

  if (kind === "proforma" && isDocumentConverted(record)) {
    const invoiceLabel = getConvertedInvoiceLabel(record);

    notifications.push(
      invoiceLabel
        ? `This proforma was converted to ${invoiceLabel}. Record payment on the invoice.`
        : "This proforma was converted to an invoice. Record payment on the invoice.",
      "warning",
      3500,
    );
    return;
  }

  if (!canRecordInvoicePayment(record.record as any)) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  selectedPaymentDocument.value = { id: record.id, kind };
  invoicePaymentDrawerOpen.value = true;
};

const openDocumentPaymentFromPanel = (
  kind: DealPreviewKind,
  record: DealDocumentPanelRecord,
) => {
  if (kind !== "proforma" && kind !== "invoice") return;

  openDocumentPayment(kind, record);
};

const saveInvoicePayment = (payment: InvoicePaymentInput) => {
  const target = selectedPaymentDocument.value;
  if (!target) return;
  if (!canUseFinanceUpdate.value) {
    notifyFinanceDenied(financeUpdateReason.value);
    return;
  }
  const paymentRecord = selectedPaymentRecord.value;
  if (!paymentRecord || !canRecordInvoicePayment(paymentRecord.record as any)) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  if (target.kind === "proforma" && isDocumentConverted(paymentRecord)) {
    const invoiceLabel = getConvertedInvoiceLabel(paymentRecord);

    notifications.push(
      invoiceLabel
        ? `This proforma was converted to ${invoiceLabel}. Record payment on the invoice.`
        : "This proforma was converted to an invoice. Record payment on the invoice.",
      "warning",
      3500,
    );
    return;
  }

  const paymentTargetId =
    target.kind === "proforma"
      ? convertProformaRecordToInvoice(paymentRecord)
      : target.id;

  if (!paymentTargetId) return;

  const updated = invoicesStore.recordPayment(paymentTargetId, payment);
  const latestPayment = updated?.payments?.at(-1);

  if (!updated) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  if (updated && latestPayment) {
    receiptsStore.addReceiptFromLinkedPayment({
      documentType: "invoice",
      documentId: updated.quotation.id,
      documentNumber: updated.quotation.quoteNumber,
      payment: latestPayment,
      client: updated.quotation.client,
      avatar: updated.quotation.avatar,
    });
  }

  notifications.push("Payment recorded.", "success", 2500);
  selectedPaymentDocument.value = null;
  invoicePaymentDrawerOpen.value = false;
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

const quotationUsageBySelectionKey = computed(() => {
  const usage = new Map<string, number>();

  quotationsStore.items.forEach((record) => {
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

const buildDocumentUsageSignature = (record: {
  purchasedProducts?: Array<{
    dealSelectionKey?: string | null;
    billingPeriod?: DealBillingPeriod | null;
    billingPeriodKey?: string | null;
  }>;
}) =>
  (record.purchasedProducts || [])
    .map((product) =>
      buildDealDocumentUsageKey(
        resolveProductSelectionKey(product),
        resolveStoredBillingPeriodKey(product),
      ),
    )
    .filter((key): key is string => Boolean(key))
    .sort();

const findMatchingProformaRecordForInvoiceDraft = (
  selectedItems: DealDocumentSelectableItem[],
  selectedBillingPeriods?: DealBillingPeriod[] | null,
  selectedBillingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null,
) => {
  const draft = buildDealDocumentDraftRecord("invoice", {
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
    nextId: nextIdForDocument("invoice"),
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    selectedItems,
  });

  const targetSignature = buildDocumentUsageSignature(draft);
  if (!targetSignature.length) return null;

  return (
    dealProformaRecords.value.find((record) => {
      if (isDocumentConverted(record)) return false;

      const recordSignature = buildDocumentUsageSignature(record.record);

      return (
        recordSignature.length === targetSignature.length &&
        recordSignature.every(
          (value, index) => value === targetSignature[index],
        )
      );
    }) ?? null
  );
};

const closeInvoiceConversionDialog = () => {
  invoiceConversionDialogVisible.value = false;
  pendingInvoiceConversionRecord.value = null;
};

const confirmInvoiceConversion = async () => {
  const matchingProforma = pendingInvoiceConversionRecord.value;
  if (!matchingProforma) return;

  const createdInvoiceId = convertProformaRecordToInvoice(matchingProforma);

  closeInvoiceConversionDialog();
  resetDocumentWorkflowState();

  if (createdInvoiceId) {
    await router.push(`/apps/invoice/preview/${createdInvoiceId}`);
  }
};

const getDocumentUsage = (
  selectionKey?: string | null,
  billingPeriodKey?: string | null,
) => {
  const usageKey = buildDealDocumentUsageKey(selectionKey, billingPeriodKey);
  if (!usageKey)
    return { invoiceCount: 0, proformaCount: 0, quotationCount: 0 };

  return {
    invoiceCount: invoiceUsageBySelectionKey.value.get(usageKey) ?? 0,
    proformaCount: proformaUsageBySelectionKey.value.get(usageKey) ?? 0,
    quotationCount: quotationUsageBySelectionKey.value.get(usageKey) ?? 0,
  };
};

const INVOICED_ITEM_LOCK_MESSAGE =
  "This item has been invoiced and can no longer be edited or deleted.";

const getInvoiceUsageCountForSelection = (selectionKey?: string | null) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  if (!normalizedSelectionKey) return 0;

  return Array.from(invoiceUsageBySelectionKey.value.entries()).reduce(
    (count, [usageKey, usageCount]) => {
      if (
        usageKey === normalizedSelectionKey ||
        usageKey.startsWith(`${normalizedSelectionKey}::`) ||
        usageKey.startsWith(`${normalizedSelectionKey}-`)
      ) {
        return count + usageCount;
      }

      return count;
    },
    0,
  );
};

const isSelectionInvoiced = (selectionKey?: string | null) =>
  getInvoiceUsageCountForSelection(selectionKey) > 0;

const getItemSelectionKey = (item: { id?: number | string | null }) =>
  item.id === null || item.id === undefined ? "" : `item-${item.id}`;

const isDealItemInvoiced = (item: { id?: number | string | null }) =>
  isSelectionInvoiced(getItemSelectionKey(item));

const notifyInvoicedItemLocked = () =>
  notifications.push(INVOICED_ITEM_LOCK_MESSAGE, "warning", 3000);

const normalizeQuotedMatchText = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const getSelectionParentKey = (selectionKey?: string | null) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  const match = normalizedSelectionKey.match(/^(item-\d+)/i);

  return match?.[1] ?? "";
};

const doesQuotationProductMatchSelectableItem = (
  product: {
    catalogueItemId?: string | null;
    dealSelectionKey?: string | null;
    title?: string | null;
  },
  item: DealDocumentSelectableItem,
) => {
  const itemSelectionKey = String(item.selectionKey ?? "").trim();
  const productSelectionKey = resolveProductSelectionKey(product);
  const itemParentKey = getSelectionParentKey(itemSelectionKey);
  const productParentKey = getSelectionParentKey(productSelectionKey);

  if (itemSelectionKey && productSelectionKey) {
    if (itemSelectionKey === productSelectionKey) return true;
    if (itemParentKey && productSelectionKey === itemParentKey) return true;
    if (productParentKey && itemSelectionKey === productParentKey) return true;
    if (itemSelectionKey.startsWith(`${productSelectionKey}-`)) return true;
    if (productSelectionKey.startsWith(`${itemSelectionKey}-`)) return true;
  }

  const productTitle = normalizeQuotedMatchText(product.title);
  const itemTitle = normalizeQuotedMatchText(item.name);
  const sameTitle = Boolean(
    productTitle && itemTitle && productTitle === itemTitle,
  );
  const sameCatalogueItem =
    Boolean(item.catalogueItemId) &&
    String(item.catalogueItemId) === String(product.catalogueItemId ?? "");

  if (sameCatalogueItem && sameTitle) return true;

  const itemMode = resolveDealDocumentBillingModeForItem(item);
  const itemHasPhaseOrPeriodScope =
    itemMode === "contractual-stage" ||
    itemMode === "retainer-period" ||
    itemMode === "recurrent-period" ||
    Number(item.retainerPeriods ?? 0) > 0 ||
    Number(item.recurrentPeriods ?? 0) > 0;

  if (itemHasPhaseOrPeriodScope && (sameCatalogueItem || sameTitle)) {
    return true;
  }

  return false;
};

const isSelectionAlreadyQuoted = (selectionKey?: string | null) => {
  const normalizedSelectionKey = String(selectionKey ?? "").trim();
  const usage = getDocumentUsage(
    normalizedSelectionKey,
    resolveSelectableItemBillingPeriodKey(normalizedSelectionKey),
  );
  if (usage.quotationCount > 0) return true;

  if (getDocumentUsage(normalizedSelectionKey, "").quotationCount > 0)
    return true;

  const parentMatch = normalizedSelectionKey.match(/^(item-\d+)-/i);
  if (parentMatch?.[1]) {
    return getDocumentUsage(parentMatch[1], "").quotationCount > 0;
  }

  return false;
};

const isSelectableItemAlreadyQuoted = (item: DealDocumentSelectableItem) => {
  if (isSelectionAlreadyQuoted(item.selectionKey)) return true;

  return quotationsStore.items.some((record) => {
    if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
      return false;

    return record.purchasedProducts.some((product) =>
      doesQuotationProductMatchSelectableItem(product, item),
    );
  });
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

const getAvailableSelectablePeriodCount = (item: DealDocumentSelectableItem) => {
  const itemMode = resolveDealDocumentBillingModeForItem(item);
  const periods =
    itemMode === "retainer-period"
      ? buildRetainerBillingPeriods(item)
      : itemMode === "recurrent-period"
        ? buildRecurrentBillingPeriods(item)
        : [];

  if (!periods.length) return 0;

  return periods.filter(
    (period) => !getPeriodSelectionConflicts([item], period).length,
  ).length;
};

const hasAvailableSelectablePeriods = (item: DealDocumentSelectableItem) => {
  const itemMode = resolveDealDocumentBillingModeForItem(item);
  if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
    return true;

  return getAvailableSelectablePeriodCount(item) > 0;
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

const allAvailableBillingPeriodsSelected = computed(
  () =>
    Boolean(availableRetainerBillingPeriods.value.length) &&
    availableRetainerBillingPeriods.value.every((period) =>
      selectedRecurrentBillingPeriodKeys.value.includes(period.key),
    ),
);

const selectAllAvailableBillingPeriods = () => {
  selectedRecurrentBillingPeriodKeys.value =
    availableRetainerBillingPeriods.value.map((period) => period.key);
};

const clearSelectedBillingPeriods = () => {
  selectedRecurrentBillingPeriodKeys.value = [];
};

const toggleAllAvailableBillingPeriods = () => {
  if (allAvailableBillingPeriodsSelected.value) {
    clearSelectedBillingPeriods();
    return;
  }

  selectAllAvailableBillingPeriods();
};

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

  return !isPeriodDrivenParentDealItem(item) || sectionIndex === 0;
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

const shouldRenderPeriodTimeline = (item: DealItemWithPlan) =>
  item.derivedSections.length > 1 &&
  item.derivedSections.every((section) => Boolean(section.billingPeriod));

type PeriodTimelineSectionStatus =
  | "not-invoiced"
  | "proforma"
  | "invoiced"
  | "paid"
  | "overdue"
  | "missed";

const getPeriodTimelineStatusLabel = (status: PeriodTimelineSectionStatus) => {
  switch (status) {
    case "paid":
      return "Invoiced - Paid";
    case "overdue":
      return "Invoiced - Overdue";
    case "missed":
      return "Missed period";
    case "proforma":
      return "Proforma";
    case "invoiced":
      return "Invoiced";
    default:
      return "No proforma or invoice";
  }
};

const isInvoiceStoreRecordPaid = (record: any) =>
  normalizeDocumentStatus(record?.quotation?.quotationStatus) === "paid" ||
  Number(record?.quotation?.balance ?? record?.quotation?.total ?? 0) <= 0;

const isInvoiceStoreRecordOverdue = (record: any) => {
  if (isInvoiceStoreRecordPaid(record)) return false;

  const dueDate = parseIsoDateValue(record?.quotation?.dueDate);
  if (!dueDate) return false;

  dueDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
};

const resolvePeriodTimelineDocumentStatus = (
  hasProforma: boolean,
  hasInvoice: boolean,
  matchingInvoices: any[],
): PeriodTimelineSectionStatus => {
  if (!hasInvoice) return hasProforma ? "proforma" : "not-invoiced";
  if (!matchingInvoices.length) return "invoiced";
  if (matchingInvoices.every(isInvoiceStoreRecordPaid)) return "paid";
  if (matchingInvoices.some(isInvoiceStoreRecordOverdue)) return "overdue";

  return "invoiced";
};

const getPeriodTimelineSectionStatusClass = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) =>
  `period-timeline__step--${getResolvedPeriodTimelineSectionStatus(parentItem, section)}`;

const getPeriodStepLabel = (index: number) => `P${index + 1}`;

const getActivePeriodSectionIndex = (item: DealItemWithPlan) =>
  item.derivedSections.findIndex(
    (section) =>
      activePeriodActionPanel.value?.itemId === item.id &&
      activePeriodActionPanel.value?.sectionId === section.id,
  );

const getPeriodActionPanelArrowLeft = (item: DealItemWithPlan) => {
  const sectionIndex = getActivePeriodSectionIndex(item);
  if (sectionIndex < 0 || !item.derivedSections.length) return "50%";

  return `${((sectionIndex + 0.5) / item.derivedSections.length) * 100}%`;
};

const togglePeriodActionPanel = (
  item: DealItemWithPlan,
  section: DerivedSection,
) => {
  const isActive =
    activePeriodActionPanel.value?.itemId === item.id &&
    activePeriodActionPanel.value?.sectionId === section.id;

  activePeriodActionPanel.value = isActive
    ? null
    : {
        itemId: item.id,
        sectionId: section.id,
      };
};

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
  if (!selectionKey) return "No proforma or invoice";

  const billingPeriodKey = resolveSelectableItemBillingPeriodKey(selectionKey);
  const usageKey = buildDealDocumentUsageKey(selectionKey, billingPeriodKey);
  if (!usageKey) return "No proforma or invoice";

  const usage = getDocumentUsage(selectionKey, billingPeriodKey);

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

  return getPeriodTimelineStatusLabel(
    resolvePeriodTimelineDocumentStatus(
      usage.proformaCount > 0,
      usage.invoiceCount > 0,
      matchingInvoices,
    ),
  );
};

const getPeriodTimelineSectionStatus = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
): PeriodTimelineSectionStatus => {
  if (!section.billingPeriod) return "not-invoiced";

  const periodDrivenSectionBillingKey = isPeriodDrivenParentDealItem(parentItem)
    ? getDealBillingPeriodKey(section.billingPeriod)
    : "";

  if (periodDrivenSectionBillingKey) {
    const usage = getDocumentUsage(
      `item-${parentItem.id}`,
      periodDrivenSectionBillingKey,
    );

    const matchingInvoices = invoicesStore.items.filter((record) => {
      if (String(record.quotation.dealId ?? "") !== String(props.deal.id))
        return false;

      return record.purchasedProducts.some((product) => {
        const billingKey = resolveStoredBillingPeriodKey(product);
        const selectionKey = resolveProductSelectionKey(product);

        return (
          billingKey === periodDrivenSectionBillingKey &&
          selectionKey === `item-${parentItem.id}`
        );
      });
    });

    return resolvePeriodTimelineDocumentStatus(
      usage.proformaCount > 0,
      usage.invoiceCount > 0,
      matchingInvoices,
    );
  }

  const usageByGoal = section.goals.map((goal) =>
    getGoalDocumentUsage(parentItem, goal, section.billingPeriod),
  );

  const hasInvoice = usageByGoal.some((usage) => usage.invoiceCount > 0);
  const hasProforma = usageByGoal.some((usage) => usage.proformaCount > 0);
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

  return resolvePeriodTimelineDocumentStatus(
    hasProforma,
    hasInvoice,
    matchingInvoices,
  );
};

const getResolvedPeriodTimelineSectionStatus = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
): PeriodTimelineSectionStatus => {
  const baseStatus = getPeriodTimelineSectionStatus(parentItem, section);

  if (
    baseStatus !== "not-invoiced" ||
    !isPeriodDrivenParentDealItem(parentItem)
  )
    return baseStatus;

  const sectionIndex = parentItem.derivedSections.findIndex(
    (candidate) => candidate.id === section.id,
  );

  if (sectionIndex < 0 || sectionIndex >= parentItem.derivedSections.length - 1)
    return baseStatus;

  const laterSectionHasInvoice = parentItem.derivedSections
    .slice(sectionIndex + 1)
    .some(
      (candidate) =>
        getPeriodTimelineSectionStatus(parentItem, candidate) === "invoiced" ||
        getPeriodTimelineSectionStatus(parentItem, candidate) === "proforma" ||
        getPeriodTimelineSectionStatus(parentItem, candidate) === "paid" ||
        getPeriodTimelineSectionStatus(parentItem, candidate) === "overdue",
    );

  return laterSectionHasInvoice ? "missed" : baseStatus;
};

const getSectionInvoiceState = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  return getPeriodTimelineStatusLabel(
    getResolvedPeriodTimelineSectionStatus(parentItem, section),
  );
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
        (!section.billingPeriod || isPeriodDrivenParentDealItem(parentItem)),
      ),
    );

const getSectionDocumentTargetItems = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const sectionItems = getSectionSelectableItems(parentItem, section);

  if (!section.billingPeriod || !isPeriodDrivenParentDealItem(parentItem)) {
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

const getSectionDocumentUsageKeys = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) =>
  new Set(
    getSectionDocumentTargetItems(parentItem, section)
      .map((item) =>
        buildDealDocumentUsageKey(
          item.selectionKey,
          resolveGoalBillingPeriodKey(item, section.billingPeriod),
        ),
      )
      .filter((key): key is string => Boolean(key)),
  );

const getSectionDocumentReference = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const usageKeys = getSectionDocumentUsageKeys(parentItem, section);
  if (!usageKeys.size) return null;

  const records =
    kind === "proforma" ? dealProformaRecords.value : dealInvoiceRecords.value;

  return (
    records.find((record) =>
      (record.record.purchasedProducts ?? []).some((product) => {
        const usageKey = buildDealDocumentUsageKey(
          resolveProductSelectionKey(product),
          resolveStoredBillingPeriodKey(product),
        );

        return Boolean(usageKey) && usageKeys.has(usageKey);
      }),
    ) ?? null
  );
};

const getSectionDocumentReferenceLabel = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  const record = getSectionDocumentReference(kind, parentItem, section);
  if (!record) return "";

  return `${kind === "proforma" ? "PF" : "INV"} #${record.quoteNumber}`;
};

const jumpToSectionDocumentReference = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  void jumpToDocumentSummaryRecord(
    kind,
    getSectionDocumentReference(kind, parentItem, section),
  );
};

const getGoalDocumentUsageKeys = (
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  billingPeriod?: DealBillingPeriod | null,
) => {
  const selectableItem = findGoalSelectableItem(parentItem, goal);
  if (!selectableItem) return new Set<string>();

  const usageKey = buildDealDocumentUsageKey(
    selectableItem.selectionKey,
    resolveGoalBillingPeriodKey(selectableItem, billingPeriod),
  );

  return new Set(usageKey ? [usageKey] : []);
};

const getGoalDocumentReference = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  billingPeriod?: DealBillingPeriod | null,
) => {
  const usageKeys = getGoalDocumentUsageKeys(parentItem, goal, billingPeriod);
  if (!usageKeys.size) return null;

  const records =
    kind === "proforma" ? dealProformaRecords.value : dealInvoiceRecords.value;

  return (
    records.find((record) =>
      (record.record.purchasedProducts ?? []).some((product) => {
        const usageKey = buildDealDocumentUsageKey(
          resolveProductSelectionKey(product),
          resolveStoredBillingPeriodKey(product),
        );

        return Boolean(usageKey) && usageKeys.has(usageKey);
      }),
    ) ?? null
  );
};

const getGoalDocumentReferenceLabel = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  billingPeriod?: DealBillingPeriod | null,
) => {
  const record = getGoalDocumentReference(kind, parentItem, goal, billingPeriod);
  if (!record) return "";

  return `${kind === "proforma" ? "PF" : "INV"} #${record.quoteNumber}`;
};

const jumpToGoalDocumentReference = (
  kind: Extract<DealPreviewKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  billingPeriod?: DealBillingPeriod | null,
) => {
  void jumpToDocumentSummaryRecord(
    kind,
    getGoalDocumentReference(kind, parentItem, goal, billingPeriod),
  );
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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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

  const availableItems = normalizedItems.filter(hasAvailableSelectablePeriods);

  if (selectedDocumentParentItemId.value) {
    return availableItems.filter(
      (item) => String(item.id) === selectedDocumentParentItemId.value,
    );
  }

  return availableItems;
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

const phaseDialogIsRecurrentService = computed(() =>
  isRecurrentCatalogueType(getItemById(phaseDraft.parentItemId)?.catalogueType),
);

const phaseDialogIsRetainerService = computed(() =>
  isRetainerCatalogueType(getItemById(phaseDraft.parentItemId)?.catalogueType),
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
  pendingQuotationConversionRecord.value = null;
  pendingQuotationConversionKind.value = null;
  selectedQuotationConversionOptionKeys.value = [];
  selectedQuotationConversionPeriodKeys.value = {};
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

const formatHeaderMoney = (value?: number | null) =>
  value === null || value === undefined ? "--" : formatDealMoney(value);

const formatHeaderDiscount = (value?: string | null) =>
  value && value.trim() ? value : "--";

const formatHeaderTax = (value?: boolean | null) =>
  value === null || value === undefined ? "--" : formatTaxApplicable(value);

const getSectionDateFields = (
  parentItem: DealItemWithPlan,
  section?: DerivedSection | null,
) => {
  if (section?.billingPeriod) {
    const startDate = formatDocumentDate(section.billingPeriod.startDate);
    const endDate = formatDocumentDate(section.billingPeriod.endDate);

    return [
      { label: "Start date", value: startDate },
      {
        label: "End date",
        value:
          startDate !== "--" && endDate === startDate
            ? "same as start"
            : endDate,
      },
    ];
  }

  return getItemDateFields(parentItem);
};

const getSharedGoalDiscountLabel = (goals: DerivedGoal[]) => {
  const labels = goals.map((goal) => formatGoalDiscount(goal) || "--");
  const [firstLabel] = labels;

  return labels.length && labels.every((label) => label === firstLabel)
    ? firstLabel
    : "--";
};

const getSharedGoalTaxValue = (goals: DerivedGoal[]) => {
  const values = goals.map((goal) => goal.taxApplicable);
  const [firstValue] = values;

  return values.length && values.every((value) => value === firstValue)
    ? firstValue
    : null;
};

const getSectionHeaderPrice = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => {
  if (section.price !== null && section.price !== undefined)
    return section.price;

  if (section.billingPeriod) {
    const [targetItem] = getSectionDocumentTargetItems(parentItem, section);
    if (targetItem) {
      return (
        getStoredBillingPeriodPrice(targetItem, section.billingPeriod) ??
        targetItem.unitPrice ??
        null
      );
    }
  }

  return parentItem.unitPrice ?? null;
};

const getSectionHeaderMetrics = (
  parentItem: DealItemWithPlan,
  section: DerivedSection,
) => [
  {
    label: "Price",
    value: formatHeaderMoney(getSectionHeaderPrice(parentItem, section)),
  },
  {
    label: "Discount",
    value: formatHeaderDiscount(
      parentItem.discountPercent === null ||
        parentItem.discountPercent === undefined
        ? getSharedGoalDiscountLabel(section.goals)
        : formatPercent(parentItem.discountPercent),
    ),
  },
  {
    label: "TAX",
    value: formatHeaderTax(
      parentItem.taxApplicable === null ||
        parentItem.taxApplicable === undefined
        ? getSharedGoalTaxValue(section.goals)
        : parentItem.taxApplicable,
    ),
  },
];

const getContractualPhaseHeaderMetrics = (goal: DerivedGoal) => [
  { label: "Qty", value: String(goal.quantity ?? "--") },
  { label: "Price", value: formatHeaderMoney(goal.price) },
  {
    label: "Discount",
    value: formatHeaderDiscount(formatGoalDiscount(goal)),
  },
  { label: "TAX", value: formatHeaderTax(goal.taxApplicable) },
];

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
  if (!canCreateDocumentSource(kind)) {
    notifications.push(
      "This document type is configured for external attachments.",
      "warning",
      3000,
    );

    return;
  }

  if (!selectedItems.length) {
    notifications.push("This deal has no billable items yet", "warning", 2500);

    return;
  }

  if (kind === "invoice") {
    const matchingProforma = findMatchingProformaRecordForInvoiceDraft(
      selectedItems,
      selectedBillingPeriods,
      selectedBillingPeriodAssignments,
    );

    if (matchingProforma) {
      pendingInvoiceConversionRecord.value = matchingProforma;
      invoiceConversionDialogVisible.value = true;
      return;
    }

    const proformaDraft = buildDealDocumentDraftRecord("proforma", {
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
      nextId: nextIdForDocument("proforma"),
      resolveCatalogueRecord: (id, typeHint) =>
        cataloguesStore.recordById(id, typeHint),
      selectedItems,
    });
    const createdProforma = proformasStore.addProforma(proformaDraft);
    const createdInvoiceId = createdProforma
      ? convertProformaRecordToInvoice(
          toDealDocumentPanelRecord(createdProforma),
        )
      : null;

    resetDocumentWorkflowState();

    if (createdInvoiceId) {
      await router.push(`/apps/invoice/preview/${createdInvoiceId}`);
    }

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

const finishQuotationConversionFromSelection = (
  selectedItems: DealDocumentSelectableItem[],
  selectedBillingPeriods?: DealBillingPeriod[] | null,
  selectedBillingPeriodAssignments?: Record<string, DealBillingPeriod[]> | null,
) => {
  const record = pendingQuotationConversionRecord.value;
  const kind = pendingQuotationConversionKind.value;
  if (!record || !kind || !selectedItems.length) return;

  const draft = buildDealDocumentDraftRecord("proforma", {
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
    nextId: nextIdForDocument("proforma"),
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    selectedItems,
  });

  performQuotationConversion(kind, record, draft.purchasedProducts);
  resetDocumentWorkflowState();
};

const openGoalDocumentPage = async (
  kind: Extract<DealDocumentKind, "proforma" | "invoice">,
  parentItem: DealItemWithPlan,
  goal: DerivedGoal,
  preferredPeriod?: DealBillingPeriod | null,
) => {
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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

    if (
      pendingQuotationConversionRecord.value &&
      pendingQuotationConversionKind.value
    ) {
      finishQuotationConversionFromSelection(
        items,
        nextBillingPeriods,
        billingPeriodAssignments,
      );

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

const alreadyQuotedDialogVisibleItems = computed(() =>
  alreadyQuotedDialogItems.value.slice(0, 5),
);

const alreadyQuotedDialogRemainingCount = computed(() =>
  Math.max(alreadyQuotedDialogItems.value.length - 5, 0),
);

const closeAlreadyQuotedDialog = (confirmed: boolean) => {
  alreadyQuotedDialogVisible.value = false;
  alreadyQuotedDialogResolver.value?.(confirmed);
  alreadyQuotedDialogResolver.value = null;
  alreadyQuotedDialogItems.value = [];
};

const confirmAlreadyQuotedSelection = async (
  kind: DealDocumentKind,
  items: DealDocumentSelectableItem[],
) => {
  if (kind !== "quotation") return true;

  const alreadyQuotedItems = items.filter((item) =>
    isSelectableItemAlreadyQuoted(item),
  );
  if (!alreadyQuotedItems.length) return true;

  alreadyQuotedDialogItems.value = alreadyQuotedItems;
  alreadyQuotedDialogVisible.value = true;

  return new Promise<boolean>((resolve) => {
    alreadyQuotedDialogResolver.value = resolve;
  });
};

const confirmSelectedDocumentItems = async () => {
  if (!selectedDocumentKind.value || !selectedDocumentItems.value.length)
    return;

  const kind = selectedDocumentKind.value;
  const items = [...selectedDocumentItems.value];

  if (!(await confirmAlreadyQuotedSelection(kind, items))) return;

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

  if (
    pendingQuotationConversionRecord.value &&
    pendingQuotationConversionKind.value
  ) {
    finishQuotationConversionFromSelection(items);

    return;
  }

  await saveAndNavigateDocumentDraft(kind, items);
};

const openDocumentPage = async (kind: DealDocumentKind) => {
  if (!canStartFinanceCreateFlow()) return;

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
    if (!(await confirmAlreadyQuotedSelection(kind, selectedItems))) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canStartFinanceCreateFlow()) return;

  if (!isSingleModeRetainerPanelFlow.value) {
    await openDocumentPage(kind);

    return;
  }

  const parentItem = getSingleRetainerParentItem();
  if (!parentItem) return;

  await openRetainerDocumentPage(kind, parentItem);
};

const openPanelExternalDocumentFlow = (kind: DealPreviewKind) => {
  if (!canStartFinanceCreateFlow()) return;

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
  if (!canAttachDocumentSource(kind)) {
    notifications.push(
      "This document type is configured for internal creation.",
      "warning",
      3000,
    );

    return;
  }

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
        quotationStatus: (documentStatus as QuotationStatus | null) ?? "Active",
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

    const isRetainerChild = isRetainerCatalogueType(item.catalogueType);
    const isRecurrentChild = isRecurrentCatalogueType(item.catalogueType);
    const isParentPeriodDrivenChild = isRetainerChild || isRecurrentChild;

    const nextPhase: DealCustomPhase = {
      id: phaseDraft.customPhaseId ?? `${Date.now()}`,
      name: phaseDraft.name.trim(),
      category: isParentPeriodDrivenChild
        ? null
        : phaseDraft.category.trim() || null,
      quantity: isRecurrentChild
        ? Number(item.quantity || 1)
        : Number(phaseDraft.quantity || 1),
      price: isParentPeriodDrivenChild ? 0 : Number(phaseDraft.price || 0),
      discountPercent: isParentPeriodDrivenChild
        ? 0
        : Number(phaseDraft.discountPercent || 0),
      taxApplicable: isParentPeriodDrivenChild
        ? (item.taxApplicable ?? null)
        : phaseDraft.taxApplicable,
      note: isRetainerChild ? null : phaseDraft.note.trim() || null,
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
  const selectableItem = findGoalSelectableItem(parentItem, goal);
  if (isSelectionInvoiced(selectableItem?.selectionKey)) {
    notifyInvoicedItemLocked();

    return;
  }

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
  dueAt: string | null;
  notes: string;
  collaborators: ToDo["collaborators"];
  important: boolean;
  status: Status;
  relatedTo: ToDo["relatedTo"];
  isImported: boolean;
  sourceLabel: string | null;
}

const dealTodos = computed<DealTodo[]>(
  () =>
    (todosStore.items || []).filter((todo) => {
      if (!todo?.relatedTo) return false;

      return isValidSalesTaskRelation(todo.relatedTo);
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
    ? props.deal.salesTasks
        .filter(
          (task) =>
            task.sourceItemId === null || task.sourceItemId === undefined,
        )
        .map((task) =>
          cloneDealSalesTaskTemplate({
            ...task,
            relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
          }),
        )
    : [];

  const legacyManualSalesTasks = dealTodos.value
    .filter((todo) => {
      if (todo.source?.type === "deal-sales-task") return false;

      const milestoneId = String(todo.milestoneId ?? "").trim();
      const goalId = String(todo.goalId ?? "").trim();

      return !milestoneId && !goalId;
    })
    .map((todo, index) =>
      cloneDealSalesTaskTemplate({
        id: nextDealSalesTaskId(storedSalesTasks) + index,
        title: todo.title,
        collaborators: normalizeSalesTaskCollaborators(todo.collaborators),
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
        relatedTo: normalizeSalesTaskRelatedTo(todo.relatedTo),
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

  return [...storedSalesTasks, ...legacyManualSalesTasks];
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
      dueAt: todo.dueAt ?? null,
      startTrigger: todo.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: todo.notes || "",
      collaborators: normalizeSalesTaskCollaborators(todo.collaborators),
      important: Boolean(todo.important),
      status: (todo.status as Status) || "pending",
      relatedTo: normalizeSalesTaskRelatedTo(todo.relatedTo),
      isImported: todo.source?.type === "deal-sales-task",
      sourceLabel:
        todo.source?.type === "deal-sales-task"
          ? "From item sales task template"
          : null,
    })),
    ...fallbackTasks.map((task) => ({
      id: task.id,
      title: task.title,
      afterWhen: task.afterWhen ?? null,
      dueAt: null,
      startTrigger: task.startTrigger ?? {
        type: "time",
        goalId: null,
        taskId: null,
      },
      notes: task.notes || "",
      collaborators: normalizeSalesTaskCollaborators(task.collaborators),
      important: Boolean(task.important),
      status: (task.status as Status) || "pending",
      relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
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

const statusOptions: { title: string; value: Status }[] = [
  { title: "Pending", value: "pending" },
  { title: "In Progress", value: "in_progress" },
  { title: "For Review", value: "for_review" },
  { title: "Completed", value: "completed" },
];

const taskStatusClass = (status?: Status) => ({
  "text-primary": status === "in_progress",
  "text-warning": status === "for_review",
  "text-medium-emphasis": !status || status === "pending",
  "text-success": status === "completed",
});

const formatTaskDueDate = (task: DealSalesTaskRow) => {
  if (task.dueAt) return formatSystemDate(task.dueAt);
  if (task.afterWhen) return formatTaskAfterWhen(task.afterWhen);

  return "Immediately";
};

const salesTaskRelationLabel = (task: DealSalesTaskRow) => {
  if (task.relatedTo?.type === "job") {
    const linkedJob = buildLinkedJobRelatedTo();
    const reference =
      task.relatedTo.name?.trim() ||
      linkedJob?.name?.trim() ||
      (task.relatedTo.id ? `Job #${task.relatedTo.id}` : "Job");

    return `Linked job: ${reference}`;
  }

  return `Deal: ${props.deal.code || `Deal #${props.deal.id}`}`;
};

const isManualSalesTodo = (taskId: number | string) => {
  const todo = todosStore.byId(taskId) as DealTodo | undefined;
  if (!todo || !isValidSalesTaskRelation(todo.relatedTo)) return false;

  return (
    !String(todo.milestoneId ?? "").trim() && !String(todo.goalId ?? "").trim()
  );
};

const updateSalesTaskTemplate = (
  taskId: number | string,
  patch: Partial<DealSalesTaskTemplate>,
) => {
  if (!canUseTaskUpdate.value) {
    notifications.push(taskUpdateReason.value, "warning", 3000);
    return;
  }

  const nextSalesTasks = buildEditableSalesTasks().map((task) =>
    String(task.id) === String(taskId)
      ? cloneDealSalesTaskTemplate({
          ...task,
          ...patch,
          relatedTo: normalizeSalesTaskRelatedTo(
            patch.relatedTo ?? task.relatedTo,
          ),
        })
      : cloneDealSalesTaskTemplate({
          ...task,
          relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
        }),
  );

  dealsStore.updateDeal(
    props.deal.id,
    { salesTasks: nextSalesTasks },
    { system: true },
  );
};

const updateSalesTaskStatus = (task: DealSalesTaskRow, status: Status) => {
  if (!canUseTaskUpdate.value) {
    notifications.push(taskUpdateReason.value, "warning", 3000);
    return;
  }

  if (isManualSalesTodo(task.id)) {
    todosStore.updateTodo(task.id, {
      status,
      relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
    });
    return;
  }

  updateSalesTaskTemplate(task.id, {
    status,
    relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
  });
};

const toggleSalesTaskImportant = (task: DealSalesTaskRow) => {
  if (!canUseTaskUpdate.value) {
    notifications.push(taskUpdateReason.value, "warning", 3000);
    return;
  }

  const important = !task.important;

  if (isManualSalesTodo(task.id)) {
    todosStore.updateTodo(task.id, {
      important,
      relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
    });
    return;
  }

  updateSalesTaskTemplate(task.id, {
    important,
    relatedTo: normalizeSalesTaskRelatedTo(task.relatedTo),
  });
};

const openTaskDeleteConfirmation = (task: DealSalesTaskRow) => {
  if (!canUseTaskDelete.value) {
    notifications.push(taskDeleteReason.value, "warning", 3000);
    return;
  }

  pendingDeleteTask.value = task;
};

const closeTaskDeleteConfirmation = () => {
  pendingDeleteTask.value = null;
};

const confirmTaskDelete = () => {
  const task = pendingDeleteTask.value;
  if (!task) return;

  emit("delete-task", task.id);
  closeTaskDeleteConfirmation();
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

const openAddTask = () => {
  if (!canUseTaskCreate.value) {
    notifications.push(taskCreateReason.value, "warning", 3000);
    return;
  }

  emit("open-add-task", {
    initial: {
      relatedTo: buildDealRelatedTo(),
      status: "pending",
    },
  });
};

const openEditTask = (taskId: number | string) => {
  if (!canUseTaskUpdate.value) {
    notifications.push(taskUpdateReason.value, "warning", 3000);
    return;
  }

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

          <VMenu :disabled="!canUseDealUpdate">
            <template #activator="{ props: menuProps }">
              <VTooltip
                :text="canUseDealUpdate ? 'Add item' : dealUpdateReason"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <span v-bind="tooltipProps" class="d-inline-flex">
                    <VBtn
                      v-bind="menuProps"
                      prepend-icon="tabler-plus"
                      :disabled="!canUseDealUpdate"
                    >
                      Add Item
                    </VBtn>
                  </span>
                </template>
              </VTooltip>
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
              <div
                class="item-card-shell"
                @click.stop="canUseDealUpdate ? openEditItem(item) : undefined"
              >
                <div class="item-card-content flex-grow-1 min-w-0">
                  <div class="item-card-main">
                    <div class="item-card-header">
                      <div class="item-card-header__main">
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
                        </div>

                        <div
                          v-if="getItemDateFields(item).length"
                          class="item-card-date-row text-body-2"
                        >
                          <template
                            v-for="field in getItemDateFields(item)"
                            :key="field.label"
                          >
                            <span class="item-card-date-row__group">
                              {{ field.label }}:
                              <strong>{{ field.value }}</strong>
                            </span>
                          </template>
                        </div>

                        <div class="item-card-inline-metrics">
                          <template v-if="!isContractualParentDealItem(item)">
                            <span class="item-card-inline-metrics__group">
                              {{ getItemDisplayMetric(item).label }}:
                              <strong>{{
                                getItemDisplayMetric(item).value
                              }}</strong>
                            </span>
                            <span
                              class="item-card-row-separator"
                              aria-hidden="true"
                            >
                              |
                            </span>
                          </template>
                          <span class="item-card-inline-metrics__group">
                            Price:
                            <strong>{{
                              formatDealMoney(itemHeaderPrice(item))
                            }}</strong>
                          </span>
                          <span
                            class="item-card-row-separator"
                            aria-hidden="true"
                          >
                            |
                          </span>
                          <span class="item-card-inline-metrics__group">
                            Amount:
                            <strong>{{
                              formatDealMoney(itemHeaderAmount(item))
                            }}</strong>
                          </span>
                        </div>
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

                </div>

                <div
                  v-if="item.actionsEnabled"
                  class="milestone-actions"
                  @click.stop
                >
                  <VMenu :disabled="!canUseDealUpdate">
                    <template #activator="{ props: menuProps }">
                      <VTooltip
                        :text="canUseDealUpdate ? 'Item actions' : dealUpdateReason"
                        location="top"
                      >
                        <template #activator="{ props: tooltipProps }">
                          <span v-bind="tooltipProps" class="d-inline-flex">
                            <VBtn
                              v-bind="menuProps"
                              icon
                              variant="text"
                              size="x-small"
                              :disabled="!canUseDealUpdate"
                            >
                              <VIcon icon="tabler-dots-vertical" size="18" />
                            </VBtn>
                          </span>
                        </template>
                      </VTooltip>
                    </template>
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
                            v-if="canCreateDocumentSource('proforma')"
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
                            v-if="canCreateDocumentSource('invoice')"
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
                            v-if="canAttachDocumentSource('quotation')"
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
                            v-if="canAttachDocumentSource('proforma')"
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
                            v-if="canAttachDocumentSource('invoice')"
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
                  v-if="shouldRenderPeriodTimeline(item)"
                  class="period-timeline"
                >
                  <div
                    v-if="item.derivedSections[0]?.goals.length"
                    class="period-timeline__services"
                  >
                    <div class="period-timeline__services-title">
                      {{
                        item.derivedSections[0]?.goalTypePlural ||
                        "Period Services"
                      }}
                    </div>
                    <div class="period-timeline__services-list">
                      <VCard
                        v-for="goal in item.derivedSections[0].goals"
                        :key="goal.id"
                        variant="flat"
                        class="goal-panel goal-panel--static period-timeline__service-row"
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
                                    </div>
                                  </template>
                                </VTooltip>
                                <span
                                  class="item-card-row-separator"
                                  aria-hidden="true"
                                >
                                  |
                                </span>
                                <VChip
                                  color="primary"
                                  size="x-small"
                                  variant="plain"
                                  class="item-type-chip item-type-chip--phase"
                                >
                                  {{ goal.typeLabel }}
                                </VChip>
                              </div>
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
                  </div>

                  <div
                    class="period-timeline__steps"
                    :style="{
                      '--period-count': item.derivedSections.length,
                    }"
                  >
                    <div
                      v-for="(section, sectionIndex) in item.derivedSections"
                      :key="section.id"
                      class="period-timeline__step"
                      :class="
                        getPeriodTimelineSectionStatusClass(item, section)
                      "
                    >
                      <button
                        type="button"
                        class="period-timeline__button"
                        :aria-expanded="
                          activePeriodActionPanel?.itemId === item.id &&
                          activePeriodActionPanel?.sectionId === section.id
                        "
                        @click.stop="togglePeriodActionPanel(item, section)"
                      >
                        <span class="period-timeline__segment" />
                        <span class="period-timeline__button-content">
                          <span class="period-timeline__dot" />
                          <span class="period-timeline__label">
                            {{ getPeriodStepLabel(sectionIndex) }}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <template
                    v-for="activeSection in item.derivedSections.filter(
                      (section) =>
                        activePeriodActionPanel?.itemId === item.id &&
                        activePeriodActionPanel?.sectionId === section.id,
                    )"
                    :key="`period-action-panel-${activeSection.id}`"
                  >
                    <VList
                      class="period-action-panel"
                      :style="{
                        '--period-panel-arrow-left':
                          getPeriodActionPanelArrowLeft(item),
                      }"
                    >
                      <div class="period-action-panel__header">
                        <div class="period-action-panel__info">
                          <div class="period-action-panel__info-title">
                            Period {{ getActivePeriodSectionIndex(item) + 1 }}
                          </div>
                          <div
                            v-if="
                              getSectionDateFields(item, activeSection).length
                            "
                            class="item-card-date-row text-body-2"
                          >
                            <template
                              v-for="field in getSectionDateFields(
                                item,
                                activeSection,
                              )"
                              :key="field.label"
                            >
                              <span class="item-card-date-row__group">
                                {{ field.label }}:
                                <strong>{{ field.value }}</strong>
                              </span>
                            </template>
                          </div>
                          <div class="item-card-inline-metrics">
                            <template
                              v-for="(
                                metric, metricIndex
                              ) in getSectionHeaderMetrics(
                                item,
                                activeSection,
                              )"
                              :key="metric.label"
                            >
                              <span
                                v-if="metricIndex > 0"
                                class="item-card-row-separator"
                                aria-hidden="true"
                              >
                                |
                              </span>
                              <span class="item-card-inline-metrics__group">
                                {{ metric.label }}:
                                <strong>{{ metric.value }}</strong>
                              </span>
                            </template>
                          </div>
                          <div class="period-action-panel__info-status">
                            {{
                              getSectionInvoiceState(item, activeSection) ||
                              "No proforma or invoice"
                            }}
                          </div>
                          <div class="period-action-panel__documents">
                            <button
                              v-if="
                                getSectionDocumentReference(
                                  'proforma',
                                  item,
                                  activeSection,
                                )
                              "
                              type="button"
                              class="period-action-panel__doc-link"
                              @click.stop="
                                jumpToSectionDocumentReference(
                                  'proforma',
                                  item,
                                  activeSection,
                                )
                              "
                            >
                              {{
                                getSectionDocumentReferenceLabel(
                                  'proforma',
                                  item,
                                  activeSection,
                                )
                              }}
                            </button>
                            <button
                              v-if="
                                getSectionDocumentReference(
                                  'invoice',
                                  item,
                                  activeSection,
                                )
                              "
                              type="button"
                              class="period-action-panel__doc-link"
                              @click.stop="
                                jumpToSectionDocumentReference(
                                  'invoice',
                                  item,
                                  activeSection,
                                )
                              "
                            >
                              {{
                                getSectionDocumentReferenceLabel(
                                  'invoice',
                                  item,
                                  activeSection,
                                )
                              }}
                            </button>
                          </div>
                        </div>
                        <div class="period-action-panel__primary-actions">
                          <VTooltip text="Create Proforma">
                            <template #activator="{ props: tooltipProps }">
                              <VBtn
                                v-if="canCreateDocumentSource('proforma')"
                                v-bind="tooltipProps"
                                icon
                                variant="tonal"
                                color="secondary"
                                size="small"
                                :disabled="
                                  !canUseFinanceCreate ||
                                  isSectionDocumentActionDisabled(
                                    'proforma',
                                    item,
                                    activeSection,
                                  )
                                "
                                aria-label="Create Proforma"
                                @click="
                                  openSectionDocumentPage(
                                    'proforma',
                                    item,
                                    activeSection,
                                  )
                                "
                              >
                                <VIcon
                                  icon="tabler-file-certificate"
                                  size="18"
                                />
                              </VBtn>
                            </template>
                          </VTooltip>
                          <VTooltip text="Create Invoice">
                            <template #activator="{ props: tooltipProps }">
                              <VBtn
                                v-if="canCreateDocumentSource('invoice')"
                                v-bind="tooltipProps"
                                icon
                                variant="tonal"
                                color="secondary"
                                size="small"
                                :disabled="
                                  !canUseFinanceCreate ||
                                  isSectionDocumentActionDisabled(
                                    'invoice',
                                    item,
                                    activeSection,
                                  )
                                "
                                aria-label="Create Invoice"
                                @click="
                                  openSectionDocumentPage(
                                    'invoice',
                                    item,
                                    activeSection,
                                  )
                                "
                              >
                                <VIcon icon="tabler-file-invoice" size="18" />
                              </VBtn>
                            </template>
                          </VTooltip>
                        </div>
                      </div>
                      <VDivider />
                      <VListItem
                        v-if="canAttachDocumentSource('proforma')"
                        :disabled="
                          isSectionDocumentActionDisabled(
                            'proforma',
                            item,
                            activeSection,
                          )
                        "
                        @click="
                          openSectionExternalDocumentDialog(
                            'proforma',
                            item,
                            activeSection,
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
                        v-if="canAttachDocumentSource('invoice')"
                        :disabled="
                          isSectionDocumentActionDisabled(
                            'invoice',
                            item,
                            activeSection,
                          )
                        "
                        @click="
                          openSectionExternalDocumentDialog(
                            'invoice',
                            item,
                            activeSection,
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
                    </VList>
                  </template>
                </div>

                <div
                  v-else-if="
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
                          <span
                            class="item-card-row-separator"
                            aria-hidden="true"
                          >
                            |
                          </span>
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
                                  v-if="canCreateDocumentSource('proforma')"
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
                                  v-if="canCreateDocumentSource('invoice')"
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
                                  v-if="canAttachDocumentSource('proforma')"
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
                                  v-if="canAttachDocumentSource('invoice')"
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
                        variant="flat"
                        class="goal-panel goal-panel--static goal-panel--contractual-phase"
                      >
                        <div class="phase-card-shell">
                          <div class="phase-card-main flex-grow-1 min-w-0">
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
                                    </div>
                                  </template>
                                </VTooltip>
                                <span
                                  class="item-card-row-separator"
                                  aria-hidden="true"
                                >
                                  |
                                </span>
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

                              <div
                                class="item-card-inline-metrics"
                              >
                                <template
                                  v-for="(
                                    metric, metricIndex
                                  ) in getContractualPhaseHeaderMetrics(goal)"
                                  :key="metric.label"
                                >
                                  <span
                                    v-if="metricIndex > 0"
                                    class="item-card-row-separator"
                                    aria-hidden="true"
                                  >
                                    |
                                  </span>
                                  <span class="item-card-inline-metrics__group">
                                    {{ metric.label }}:
                                    <strong>{{ metric.value }}</strong>
                                  </span>
                                </template>
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
                                getGoalDocumentReference(
                                  'proforma',
                                  item,
                                  goal,
                                  section.billingPeriod,
                                ) ||
                                getGoalDocumentReference(
                                  'invoice',
                                  item,
                                  goal,
                                  section.billingPeriod,
                                )
                              "
                              class="period-action-panel__documents"
                            >
                              <button
                                v-if="
                                  getGoalDocumentReference(
                                    'proforma',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                "
                                type="button"
                                class="period-action-panel__doc-link"
                                @click.stop="
                                  jumpToGoalDocumentReference(
                                    'proforma',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                "
                              >
                                {{
                                  getGoalDocumentReferenceLabel(
                                    'proforma',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                }}
                              </button>
                              <button
                                v-if="
                                  getGoalDocumentReference(
                                    'invoice',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                "
                                type="button"
                                class="period-action-panel__doc-link"
                                @click.stop="
                                  jumpToGoalDocumentReference(
                                    'invoice',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                "
                              >
                                {{
                                  getGoalDocumentReferenceLabel(
                                    'invoice',
                                    item,
                                    goal,
                                    section.billingPeriod,
                                  )
                                }}
                              </button>
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
                                      v-if="canCreateDocumentSource('proforma')"
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
                                      v-if="canCreateDocumentSource('invoice')"
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
                                      v-if="canAttachDocumentSource('proforma')"
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
                                      v-if="canAttachDocumentSource('invoice')"
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
          <div class="items-overview-card__actions">
            <VMenu
              v-if="canAttachAnyDocumentSource()"
              :disabled="!canUseFinanceCreate"
            >
              <template #activator="{ props: menuProps }">
                <VTooltip
                  :text="canUseFinanceCreate ? 'Attach document' : financeCreateReason"
                  location="top"
                >
                  <template #activator="{ props: tooltipProps }">
                    <span v-bind="tooltipProps" class="d-inline-flex">
                      <VBtn
                        v-bind="menuProps"
                        icon
                        variant="tonal"
                        color="secondary"
                        size="small"
                        class="items-overview__card-create"
                        aria-label="Attach document"
                        :disabled="!canUseFinanceCreate"
                      >
                        <VIcon icon="tabler-paperclip" size="17" />
                      </VBtn>
                    </span>
                  </template>
                </VTooltip>
              </template>
                <VList density="compact">
                  <VListItem
                    v-if="canAttachDocumentSource('quotation')"
                    :disabled="
                      isRetainerPanelDocumentActionDisabled('quotation')
                    "
                    @click="openPanelExternalDocumentFlow('quotation')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-paperclip" />
                    </template>
                    <VListItemTitle>Attach Quotation</VListItemTitle>
                  </VListItem>
                  <VListItem
                    v-if="canAttachDocumentSource('proforma')"
                    :disabled="
                      isRetainerPanelDocumentActionDisabled('proforma')
                    "
                    @click="openPanelExternalDocumentFlow('proforma')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-paperclip" />
                    </template>
                    <VListItemTitle>Attach Proforma</VListItemTitle>
                  </VListItem>
                  <VListItem
                    v-if="canAttachDocumentSource('invoice')"
                    :disabled="isRetainerPanelDocumentActionDisabled('invoice')"
                    @click="openPanelExternalDocumentFlow('invoice')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-paperclip" />
                    </template>
                    <VListItemTitle>Attach Invoice</VListItemTitle>
                  </VListItem>
                </VList>
            </VMenu>
            <VMenu
              v-if="canCreateAnyDocumentSource()"
              :disabled="!canUseFinanceCreate"
            >
              <template #activator="{ props: menuProps }">
                <VTooltip
                  :text="canUseFinanceCreate ? 'Create document' : financeCreateReason"
                  location="top"
                >
                  <template #activator="{ props: tooltipProps }">
                    <span v-bind="tooltipProps" class="d-inline-flex">
                      <VBtn
                        v-bind="menuProps"
                        icon
                        variant="tonal"
                        color="secondary"
                        size="small"
                        class="items-overview__card-create"
                        aria-label="Create document"
                        :disabled="!canUseFinanceCreate"
                      >
                        <VIcon icon="tabler-plus" size="18" />
                      </VBtn>
                    </span>
                  </template>
                </VTooltip>
              </template>
                <VList density="compact">
                  <VListItem
                    v-if="canCreateDocumentSource('quotation')"
                    :disabled="
                      isRetainerPanelDocumentActionDisabled('quotation')
                    "
                    @click="openPanelDocumentPage('quotation')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-file-text" />
                    </template>
                    <VListItemTitle>Create Quotation</VListItemTitle>
                  </VListItem>
                  <VListItem
                    v-if="canCreateDocumentSource('proforma')"
                    :disabled="
                      isRetainerPanelDocumentActionDisabled('proforma')
                    "
                    @click="openPanelDocumentPage('proforma')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-file-dollar" />
                    </template>
                    <VListItemTitle>Create Proforma</VListItemTitle>
                  </VListItem>
                  <VListItem
                    v-if="canCreateDocumentSource('invoice')"
                    :disabled="isRetainerPanelDocumentActionDisabled('invoice')"
                    @click="openPanelDocumentPage('invoice')"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-file-invoice" />
                    </template>
                    <VListItemTitle>Create Invoice</VListItemTitle>
                  </VListItem>
                </VList>
            </VMenu>
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
          </div>
        </template>
      </VCardItem>
      <VCardText class="items-overview-card__content">
        <div class="items-overview">
          <div v-if="!isItemsOverviewCollapsed" class="items-overview__body">
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
                      {{ panel.title }}
                      <span
                        class="item-card-row-separator"
                        aria-hidden="true"
                      >
                        |
                      </span>
                      <span class="items-overview__preview-meta">
                        {{ panel.summary }}
                      </span>
                    </strong>

                    <div class="items-overview__preview-summary-side">
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
                    <template v-if="panel.records.length">
                      <div class="items-overview__preview-table" role="table">
                        <div
                          class="items-overview__preview-table-head"
                          role="row"
                        >
                          <span role="columnheader">Date</span>
                          <span role="columnheader">{{
                            panel.numberHeader
                          }}</span>
                          <span role="columnheader">Phase / Period</span>
                          <span role="columnheader">Amount</span>
                          <span role="columnheader" aria-label="Actions"></span>
                        </div>

                        <div
                          v-for="record in panel.records"
                          :key="`${panel.key}-${record.id}`"
                          :id="getDocumentSummaryRowId(panel.key, record)"
                          class="items-overview__preview-table-row"
                          :class="{
                            'items-overview__preview-table-row--highlight':
                              highlightedDocumentRowKey ===
                              getDocumentSummaryRowKey(panel.key, record),
                          }"
                          role="row"
                        >
                          <span role="cell">{{
                            formatDocumentDate(record.issuedDate)
                          }}</span>
                          <button
                            type="button"
                            class="items-overview__doc-link"
                            role="cell"
                            @click="openQuickDocumentPreview(panel.key, record)"
                          >
                            {{ record.quoteNumber }}
                          </button>
                          <span role="cell">{{ record.periodPhase }}</span>
                          <strong role="cell">{{
                            formatMoney(record.total)
                          }}</strong>
                          <span class="items-overview__actions" role="cell">
                            <VBtn
                              icon
                              variant="text"
                              size="small"
                              aria-label="Document actions"
                            >
                              <VIcon icon="tabler-dots-vertical" size="18" />
                              <VMenu activator="parent">
                                <VList density="compact">
                                  <VListItem
                                    :disabled="
                                      !canUseFinanceUpdate ||
                                      Boolean(getDocumentLockReason(panel.key, record))
                                    "
                                    @click="openDocumentEdit(panel.key, record)"
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-pencil" />
                                    </template>
                                    <VListItemTitle>Edit</VListItemTitle>
                                  </VListItem>
                                  <VListItem
                                    :disabled="
                                      !canUseFinanceCreate ||
                                      Boolean(getDocumentLockReason(panel.key, record))
                                    "
                                    @click="
                                      reviseDocumentRecord(panel.key, record)
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-refresh" />
                                    </template>
                                    <VListItemTitle>Revise</VListItemTitle>
                                  </VListItem>
                                  <VListItem
                                    :disabled="!canUseFinanceCreate"
                                    @click="
                                      duplicateDocumentRecord(panel.key, record)
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-copy" />
                                    </template>
                                    <VListItemTitle>Duplicate</VListItemTitle>
                                  </VListItem>
                                  <VListItem
                                    :disabled="
                                      !canUseFinanceUpdate ||
                                      getApprovalAction(panel.key, record).disabled
                                    "
                                    @click="requestApproval(panel.key, record)"
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-checklist" />
                                    </template>
                                    <VListItemTitle>
                                      {{
                                        getApprovalAction(panel.key, record)
                                          .title
                                      }}
                                    </VListItemTitle>
                                  </VListItem>
                                  <VListItem
                                    v-if="
                                      panel.key === 'quotation' &&
                                      canCreateDocumentSource('proforma')
                                    "
                                    :disabled="
                                      !canUseFinanceCreate ||
                                      isDocumentConversionBlocked(record)
                                    "
                                    @click="
                                      requestQuotationConversion(
                                        'proforma',
                                        record,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-file-dollar" />
                                    </template>
                                    <VListItemTitle
                                      >Convert to Proforma</VListItemTitle
                                    >
                                  </VListItem>
                                  <VListItem
                                    v-if="
                                      panel.key === 'quotation' &&
                                      canCreateDocumentSource('invoice')
                                    "
                                    :disabled="
                                      !canUseFinanceCreate ||
                                      isDocumentConversionBlocked(record)
                                    "
                                    @click="
                                      requestQuotationConversion(
                                        'invoice',
                                        record,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-file-invoice" />
                                    </template>
                                    <VListItemTitle
                                      >Convert to Tax invoice</VListItemTitle
                                    >
                                  </VListItem>
                                  <VListItem
                                    v-if="
                                      panel.key === 'proforma' &&
                                      canCreateDocumentSource('invoice')
                                    "
                                    :disabled="
                                      !canUseFinanceCreate ||
                                      isDocumentConverted(record)
                                    "
                                    @click="
                                      convertDocumentToInvoice(
                                        'proforma',
                                        record,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-file-invoice" />
                                    </template>
                                    <VListItemTitle
                                      >Convert to Tax invoice</VListItemTitle
                                    >
                                  </VListItem>
                                  <VListItem
                                    v-if="canPayDocument(panel.key, record)"
                                    :disabled="!canUseFinanceUpdate"
                                    @click="
                                      openDocumentPaymentFromPanel(
                                        panel.key,
                                        record,
                                      )
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-cash" />
                                    </template>
                                    <VListItemTitle>Pay</VListItemTitle>
                                  </VListItem>
                                  <VListItem :disabled="!canUseDocumentShare">
                                    <template #prepend>
                                      <VIcon icon="tabler-share" />
                                    </template>
                                    <VListItemTitle>Share</VListItemTitle>
                                    <template #append>
                                      <VIcon
                                        icon="tabler-chevron-right"
                                        size="16"
                                      />
                                    </template>
                                    <VMenu
                                      activator="parent"
                                      location="end"
                                      open-on-hover
                                      :disabled="!canUseDocumentShare"
                                    >
                                      <VList density="compact">
                                        <VListItem
                                          @click="
                                            openDocumentPreviewAction(
                                              panel.key,
                                              record,
                                              'download',
                                            )
                                          "
                                        >
                                          <template #prepend>
                                            <VIcon icon="tabler-download" />
                                          </template>
                                          <VListItemTitle
                                            >Download</VListItemTitle
                                          >
                                        </VListItem>
                                        <VListItem
                                          @click="
                                            openDocumentPreviewAction(
                                              panel.key,
                                              record,
                                              'print',
                                            )
                                          "
                                        >
                                          <template #prepend>
                                            <VIcon icon="tabler-printer" />
                                          </template>
                                          <VListItemTitle>Print</VListItemTitle>
                                        </VListItem>
                                        <VListItem
                                          @click="
                                            openDocumentEmailDialog(
                                              panel.key,
                                              record,
                                            )
                                          "
                                        >
                                          <template #prepend>
                                            <VIcon icon="tabler-mail" />
                                          </template>
                                          <VListItemTitle>Email</VListItemTitle>
                                        </VListItem>
                                      </VList>
                                    </VMenu>
                                  </VListItem>
                                  <VListItem
                                    class="text-error"
                                    :disabled="
                                      !canUseFinanceDelete ||
                                      Boolean(getDocumentLockReason(panel.key, record))
                                    "
                                    @click="
                                      deleteDocumentRecord(panel.key, record)
                                    "
                                  >
                                    <template #prepend>
                                      <VIcon icon="tabler-trash" />
                                    </template>
                                    <VListItemTitle>Delete</VListItemTitle>
                                  </VListItem>
                                </VList>
                              </VMenu>
                            </VBtn>
                          </span>
                        </div>
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
      <VDialog v-model="externalDocumentDialogVisible" max-width="560">
        <DialogCloseBtn @click="externalDocumentDialogVisible = false" />
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
                <VCol cols="12">
                  <AppDateTimePicker
                    v-model="externalDocumentForm.date"
                    label="Date"
                    placeholder="Select date"
                    clearable
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12">
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

                <VCol cols="12">
                  <AppTextField
                    v-model="externalDocumentForm.amount"
                    type="number"
                    min="0"
                    label="Amount"
                    placeholder="0"
                    :rules="[positiveAmountValidator]"
                  />
                </VCol>

                <VCol cols="12">
                  <AppSelect
                    v-model="externalDocumentForm.status"
                    label="Status"
                    :items="externalDocumentStatusOptions"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol v-if="requiresExternalPaidAmount" cols="12">
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

      <VDialog v-model="quotationConversionDialogVisible" max-width="760">
        <DialogCloseBtn @click="closeQuotationConversionDialog" />
        <VCard>
          <VCardItem>
            <VCardTitle> Select Lines to Convert </VCardTitle>
            <VCardSubtitle>
              {{ pendingQuotationConversionRecord?.quoteNumber }}
            </VCardSubtitle>
          </VCardItem>

          <VCardText>
            <VAlert type="info" variant="tonal" class="mb-4">
              Select the items, phases, or periods to convert.
            </VAlert>

            <div class="d-flex flex-column gap-3">
              <div
                v-for="option in quotationConversionOptions"
                :key="option.key"
                class="border rounded-lg pa-4 bg-var-theme-background"
              >
                <div class="d-flex align-start gap-3">
                  <VCheckbox
                    v-model="selectedQuotationConversionOptionKeys"
                    :value="option.key"
                    density="compact"
                    hide-details
                    class="mt-0"
                  />

                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex flex-wrap align-center gap-2 mb-1">
                      <strong>{{ option.title }}</strong>
                      <VChip
                        size="x-small"
                        label
                        color="primary"
                        variant="tonal"
                      >
                        {{ getConversionOptionTypeLabel(option) }}
                      </VChip>
                      <span class="ms-auto font-weight-medium">
                        {{ getConversionOptionTotal(option) }}
                      </span>
                    </div>

                    <div class="text-caption text-medium-emphasis mb-2">
                      Discount {{ getConversionLineDiscount(option.product) }} -
                      {{ getConversionLineTaxStatus(option.product) }}
                    </div>

                    <VSelect
                      v-if="option.periods.length"
                      v-model="
                        selectedQuotationConversionPeriodKeys[option.key]
                      "
                      :items="
                        option.periods.map((period) => ({
                          title: period.label,
                          value: period.key,
                        }))
                      "
                      :label="
                        option.kind === 'recurrent-period'
                          ? 'Recurrent Periods'
                          : 'Retainer Periods'
                      "
                      chips
                      multiple
                      density="compact"
                      hide-details
                    />

                    <div v-else class="text-caption text-medium-emphasis">
                      Qty {{ option.product.hours ?? 1 }} -
                      {{ getConversionLineContext(option.product) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="text-end font-weight-medium mt-4">
              Selected total:
              {{ formatMoney(selectedQuotationConversionTotal) }}
            </div>
          </VCardText>

          <DialogActionBar
            cancel-text="Cancel"
            :save-text="
              pendingQuotationConversionKind === 'invoice'
                ? 'Convert to Invoice'
                : 'Convert to Proforma'
            "
            :save-disabled="!selectedQuotationConversionProducts.length"
            @cancel="closeQuotationConversionDialog"
            @save="confirmQuotationConversion"
          />
        </VCard>
      </VDialog>

      <VDialog v-model="invoiceConversionDialogVisible" max-width="520">
        <DialogCloseBtn @click="closeInvoiceConversionDialog" />
        <VCard>
          <VCardItem>
            <VCardTitle>Convert Proforma to Invoice</VCardTitle>
          </VCardItem>

          <VCardText>
            <p class="text-body-1 mb-2">
              This period or phase already has a proforma.
            </p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Convert
              <strong>{{ pendingInvoiceConversionRecord?.quoteNumber }}</strong>
              to an invoice instead of creating a new invoice draft.
            </p>
          </VCardText>

          <VCardText class="pt-0">
            <div class="d-flex justify-end flex-wrap gap-3">
              <VBtn
                variant="tonal"
                color="secondary"
                @click="closeInvoiceConversionDialog"
              >
                Cancel
              </VBtn>
              <VBtn color="primary" @click="confirmInvoiceConversion">
                Convert to Invoice
              </VBtn>
            </div>
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

          <VTooltip
            :text="canUseTaskCreate ? 'Add task' : taskCreateReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  prepend-icon="tabler-plus"
                  :disabled="!canUseTaskCreate"
                  @click="openAddTask"
                >
                  Add Task
                </VBtn>
              </span>
            </template>
          </VTooltip>
        </div>

        <div v-if="salesTasks.length" class="sales-task-list">
          <div class="sales-task-list__header">
            <span></span>
            <span>Task</span>
            <span>Due</span>
            <span>Assigned</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <div
            v-for="task in salesTasks"
            :key="task.id"
            class="sales-task-row"
            @click="canUseTaskUpdate ? openEditTask(task.id) : undefined"
          >
            <div class="sales-task-row__star">
              <VTooltip
                :text="canUseTaskUpdate ? 'Toggle important' : taskUpdateReason"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <span v-bind="tooltipProps" class="d-inline-flex">
                    <VBtn
                      icon
                      variant="text"
                      size="small"
                      :disabled="!canUseTaskUpdate"
                      @click.stop="toggleSalesTaskImportant(task)"
                    >
                      <VIcon
                        :icon="task.important ? 'tabler-star-filled' : 'tabler-star'"
                        color="warning"
                        size="20"
                      />
                    </VBtn>
                  </span>
                </template>
              </VTooltip>
            </div>

            <div class="sales-task-row__main">
              <VTooltip :text="task.title" location="top">
                <template #activator="{ props: tooltipProps }">
                  <h6 v-bind="tooltipProps" class="text-base mb-0">
                    {{ task.title }}
                  </h6>
                </template>
              </VTooltip>
              <div class="text-sm text-medium-emphasis truncate-title">
                {{
                  task.notes ||
                  formatTaskStart(task.afterWhen, task.startTrigger)
                }}
              </div>
              <div class="d-flex align-center flex-wrap gap-2 text-xs mt-1">
                <span class="text-medium-emphasis">
                  {{ salesTaskRelationLabel(task) }}
                </span>
                <span v-if="task.sourceLabel" class="text-info">
                  {{ task.sourceLabel }}
                </span>
              </div>
            </div>

            <div class="sales-task-row__due text-body-2">
              {{ formatTaskDueDate(task) }}
            </div>

            <div class="sales-task-row__assigned">
              <div
                v-if="task.collaborators?.length"
                class="v-avatar-group demo-avatar-group"
              >
                <VAvatar
                  v-for="collaborator in task.collaborators.slice(0, 3)"
                  :key="collaborator.id"
                  :size="32"
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
                  v-if="task.collaborators.length > 3"
                  :size="32"
                  color="secondary"
                >
                  +{{ task.collaborators.length - 3 }}
                </VAvatar>
              </div>
              <span v-else class="text-medium-emphasis">-</span>
            </div>

            <div class="sales-task-row__status">
              <VMenu location="bottom start" :disabled="!canUseTaskUpdate">
                <template #activator="{ props: menuProps }">
                  <VTooltip
                    :text="canUseTaskUpdate ? 'Change status' : taskUpdateReason"
                    location="top"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <span v-bind="tooltipProps" class="d-inline-flex">
                        <VBtn
                          v-bind="menuProps"
                          variant="text"
                          size="small"
                          class="status-trigger px-0 text-none"
                          :class="taskStatusClass(task.status)"
                          :disabled="!canUseTaskUpdate"
                          @click.stop
                        >
                          <span class="text-body-2">
                            {{ todoStatusLabel(task.status) }}
                          </span>
                          <VIcon icon="tabler-chevron-down" size="16" class="ms-1" />
                        </VBtn>
                      </span>
                    </template>
                  </VTooltip>
                </template>

                <VList density="compact" min-width="180">
                  <VListItem
                    v-for="option in statusOptions"
                    :key="option.value"
                    :active="task.status === option.value"
                    @click.stop="updateSalesTaskStatus(task, option.value)"
                  >
                    <template #prepend>
                      <VIcon
                        icon="tabler-check"
                        size="16"
                        :class="
                          task.status === option.value
                            ? 'text-primary'
                            : 'opacity-0'
                        "
                      />
                    </template>

                    <VListItemTitle :class="taskStatusClass(option.value)">
                      {{ option.title }}
                    </VListItemTitle>
                  </VListItem>
                </VList>
              </VMenu>
            </div>

            <div class="sales-task-row__actions">
              <IconBtn
                :disabled="!canUseTaskUpdate"
                @click.stop="canUseTaskUpdate ? openEditTask(task.id) : undefined"
              >
                <VIcon icon="tabler-edit" />
              </IconBtn>
              <VTooltip
                v-if="!canUseTaskUpdate"
                activator="parent"
                location="top"
              >
                {{ taskUpdateReason }}
              </VTooltip>
              <IconBtn
                :disabled="!canUseTaskDelete"
                @click.stop="openTaskDeleteConfirmation(task)"
              >
                <VIcon icon="tabler-trash" color="error" />
              </IconBtn>
              <VTooltip
                v-if="!canUseTaskDelete"
                activator="parent"
                location="top"
              >
                {{ taskDeleteReason }}
              </VTooltip>
            </div>
          </div>
        </div>

        <div v-else class="text-body-2 text-medium-emphasis empty-tasks">
          No sales tasks linked to this deal yet.
        </div>
      </VCardText>
    </VCard>
  </div>

  <VDialog
    :model-value="Boolean(pendingDeleteTask)"
    max-width="460"
    @update:model-value="
      (value) => {
        if (!value) closeTaskDeleteConfirmation();
      }
    "
  >
    <DialogCloseBtn @click="closeTaskDeleteConfirmation" />
    <VCard>
      <VCardTitle>Delete task</VCardTitle>
      <VCardText>
        Delete <strong>{{ pendingDeleteTask?.title || "this task" }}</strong>?
        This cannot be undone.
      </VCardText>
      <VCardActions class="justify-end">
        <VBtn variant="text" color="secondary" @click="closeTaskDeleteConfirmation">
          Cancel
        </VBtn>
        <VBtn color="error" variant="tonal" @click="confirmTaskDelete">
          Delete
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="addItemDialogVisible" :max-width="addItemDialogMaxWidth">
    <DialogCloseBtn @click="addItemDialogVisible = false" />
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add Item</h5>

        <VForm
          ref="addItemFormRef"
          class="deal-item-modal-form"
          @submit.prevent="saveSelectedCatalogueItem"
        >
          <VRow class="deal-item-modal-layout">
            <VCol cols="12" md="8" class="deal-item-modal-main">
              <VRow>
                <VCol cols="12">
                  <AppCombobox
                    v-model="selectedCatalogueItemName"
                    label="Name"
                    placeholder="Select catalogue item or edit the name"
                    :items="catalogueItemLabels"
                    :rules="[
                      requiredValidator,
                      () =>
                        Boolean(selectedCatalogueItem?.id) ||
                        'Select catalogue item from list',
                    ]"
                    clearable
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="addItemDraft.price"
                    type="number"
                    min="0"
                    label="Price"
                    placeholder="0"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-if="addItemRequiresRecurrentTerm"
                    v-model="addItemDraft.recurrentPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else-if="addItemRequiresRetainerTerm"
                    v-model="addItemDraft.retainerPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else
                    v-model="addItemDraft.quantity"
                    type="number"
                    min="1"
                    label="Qty"
                    placeholder="1"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="addItemDraft.discountPercent"
                    type="number"
                    min="0"
                    label="Discount %"
                    placeholder="0"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <div class="d-flex flex-column gap-2">
                    <span class="text-sm text-medium-emphasis">
                      {{
                        addItemDraft.taxApplicable ? "Taxable" : "Non Taxable"
                      }}
                    </span>
                    <VSwitch
                      v-model="addItemDraft.taxApplicable"
                      inset
                      hide-details
                      color="primary"
                    />
                  </div>
                </VCol>

                <template v-if="addItemRequiresRecurrentTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="addItemDraft.recurrentStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods:
                      {{ addItemRecurrentBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>

                <template v-if="addItemRequiresRetainerTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="addItemDraft.retainerStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods: {{ addItemBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>
              </VRow>
            </VCol>

            <VCol cols="12" md="4" class="deal-item-modal-note-col">
              <AppTextarea
                v-model="addItemDraft.note"
                class="deal-item-modal-note"
                label="Note"
                placeholder="Short note"
                rows="4"
                auto-grow
              />
            </VCol>

            <VCol
              v-if="addProducedProductRecord && addProducedCustomization"
              cols="12"
              class="deal-item-modal-customization-col"
            >
              <DealProducedCustomizationForm
                v-model="addProducedCustomization"
                :record="addProducedProductRecord"
              />
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

  <VDialog v-model="editLineDialogVisible" :max-width="editItemDialogMaxWidth">
    <DialogCloseBtn @click="editLineDialogVisible = false" />
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Edit {{ editLine.title || "Item" }}</h5>

        <VForm
          ref="editLineFormRef"
          class="deal-item-modal-form"
          @submit.prevent="saveEditedLine"
        >
          <VRow class="deal-item-modal-layout">
            <VCol
              cols="12"
              :md="editLine.canEditInfo ? 8 : 12"
              class="deal-item-modal-main"
            >
              <VRow>
                <VCol v-if="editLine.canEditInfo" cols="12">
                  <AppTextField
                    v-model="editLine.name"
                    label="Name"
                    placeholder="Item name"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol v-if="editLine.canEditPrice" cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="editLine.unitPrice"
                    type="number"
                    min="0"
                    label="Price"
                    placeholder="0"
                  />
                </VCol>

                <VCol
                  v-if="editLine.canEditQuantity || editLineUsesPeriodQuantity"
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <AppTextField
                    v-if="editLineRequiresRecurrentTerm"
                    v-model="editLine.recurrentPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else-if="editLineRequiresRetainerTerm"
                    v-model="editLine.retainerPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else
                    v-model="editLine.quantity"
                    type="number"
                    min="0"
                    label="Qty"
                    placeholder="1"
                  />
                </VCol>

                <VCol v-if="editLine.canEditDiscount" cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="editLine.discountPercent"
                    type="number"
                    min="0"
                    label="Discount %"
                    placeholder="0"
                  />
                </VCol>

                <VCol v-if="editLine.canEditTax" cols="12" sm="6" md="3">
                  <div class="d-flex flex-column gap-2">
                    <span class="text-sm text-medium-emphasis">
                      {{ editLine.taxApplicable ? "Taxable" : "Non Taxable" }}
                    </span>
                    <VSwitch
                      v-model="editLine.taxApplicable"
                      inset
                      hide-details
                      color="primary"
                    />
                  </div>
                </VCol>

                <template v-if="editLineRequiresRecurrentTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="editLine.recurrentStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods:
                      {{ editLineRecurrentBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>

                <template v-if="editLineRequiresRetainerTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="editLine.retainerStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods: {{ editLineBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>
              </VRow>
            </VCol>

            <VCol
              v-if="editLine.canEditInfo"
              cols="12"
              md="4"
              class="deal-item-modal-note-col"
            >
              <AppTextarea
                v-model="editLine.note"
                class="deal-item-modal-note"
                label="Note"
                placeholder="Short note"
                rows="4"
                auto-grow
              />
            </VCol>

            <VCol
              v-if="editProducedProductRecord && editProducedCustomization"
              cols="12"
              class="deal-item-modal-customization-col"
            >
              <DealProducedCustomizationForm
                v-model="editProducedCustomization"
                :record="editProducedProductRecord"
              />
            </VCol>

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
    <DialogCloseBtn @click="phaseDialogVisible = false" />
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">
          {{ phaseDialogTitle }}
        </h5>

        <VForm ref="phaseFormRef" @submit.prevent="savePhase">
          <VRow>
            <VCol cols="12" :md="phaseDialogIsRecurrentService ? 12 : 8">
              <AppTextField
                v-model="phaseDraft.name"
                :label="
                  phaseDialogIsRecurrentService || phaseDialogIsRetainerService
                    ? 'Name'
                    : 'Phase Name'
                "
                :placeholder="
                  phaseDialogIsRecurrentService || phaseDialogIsRetainerService
                    ? 'Service name'
                    : 'Phase name'
                "
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol
              v-if="
                !phaseDialogIsRecurrentService && !phaseDialogIsRetainerService
              "
              cols="12"
              md="4"
            >
              <AppTextField
                v-model="phaseDraft.category"
                label="Category"
                placeholder="Category"
              />
            </VCol>

            <VCol
              v-if="
                !phaseDialogIsRecurrentService && !phaseDialogIsRetainerService
              "
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="phaseDraft.price"
                type="number"
                min="0"
                label="Price"
                placeholder="0"
              />
            </VCol>

            <VCol v-if="phaseDialogIsRetainerService" cols="12" md="4">
              <AppTextField
                v-model="phaseDraft.quantity"
                type="number"
                min="0"
                label="Quantity"
                placeholder="1"
              />
            </VCol>

            <VCol
              v-if="
                !phaseDialogIsRecurrentService && !phaseDialogIsRetainerService
              "
              cols="12"
              md="3"
            >
              <AppTextField
                v-model="phaseDraft.discountPercent"
                type="number"
                min="0"
                label="Discount %"
                placeholder="0"
              />
            </VCol>

            <VCol
              v-if="
                !phaseDialogIsRecurrentService && !phaseDialogIsRetainerService
              "
              cols="12"
              md="3"
            >
              <div class="d-flex flex-column gap-2">
                <span class="text-sm text-medium-emphasis">
                  {{ phaseDraft.taxApplicable ? "Taxable" : "Non Taxable" }}
                </span>
                <VSwitch
                  v-model="phaseDraft.taxApplicable"
                  inset
                  hide-details
                  color="primary"
                />
              </div>
            </VCol>

            <VCol v-if="!phaseDialogIsRetainerService" cols="12">
              <AppTextarea
                v-model="phaseDraft.note"
                :label="phaseDialogIsRecurrentService ? 'Description' : 'Note'"
                :placeholder="
                  phaseDialogIsRecurrentService
                    ? 'Service description'
                    : 'Short note'
                "
                :rows="phaseDialogIsRecurrentService ? 4 : 2"
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
    <DialogCloseBtn @click="billingModeDialogVisible = false" />
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
    <DialogCloseBtn @click="billingPeriodDialogVisible = false" />
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
            <div
              v-if="isMultiPeriodBillingSelection"
              class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3"
            >
              <div class="text-sm text-medium-emphasis">
                {{ selectedRecurrentBillingPeriods.length }} of
                {{ availableRetainerBillingPeriods.length }} available selected
              </div>
              <div class="d-flex flex-wrap gap-2">
                <VBtn
                  size="small"
                  variant="tonal"
                  color="primary"
                  :disabled="!availableRetainerBillingPeriods.length"
                  @click="toggleAllAvailableBillingPeriods"
                >
                  {{
                    allAvailableBillingPeriodsSelected
                      ? "Deselect all"
                      : "Select all"
                  }}
                </VBtn>
                <VBtn
                  size="small"
                  variant="text"
                  :disabled="!selectedRecurrentBillingPeriods.length"
                  @click="clearSelectedBillingPeriods"
                >
                  Clear
                </VBtn>
              </div>
            </div>

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
    <DialogCloseBtn @click="selectionDialogVisible = false" />
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

                  <VChip
                    v-if="isSelectableItemAlreadyQuoted(item)"
                    size="x-small"
                    label
                    color="warning"
                    variant="tonal"
                  >
                    Already quoted
                  </VChip>
                </div>

                <div class="text-sm text-medium-emphasis mb-1">
                  {{ getSelectableItemPriceSummary(item) }}
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

                <div
                  v-else-if="
                    selectedDocumentKind === 'quotation' &&
                    isSelectableItemAlreadyQuoted(item)
                  "
                  class="text-sm text-warning mb-1"
                >
                  This item is already quoted. You can continue and create
                  another quotation.
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

  <VDialog v-model="alreadyQuotedDialogVisible" max-width="520" persistent>
    <DialogCloseBtn @click="closeAlreadyQuotedDialog(false)" />
    <VCard>
      <VCardItem>
        <VCardTitle>Items already quoted</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          These selected items already exist on a quotation. You can continue
          and create another quotation, or cancel and adjust the selection.
        </div>

        <VList density="compact" class="border rounded">
          <VListItem
            v-for="item in alreadyQuotedDialogVisibleItems"
            :key="item.selectionKey"
          >
            <template #prepend>
              <VIcon icon="tabler-file-text" color="warning" />
            </template>
            <VListItemTitle>{{ item.name }}</VListItemTitle>
            <VListItemSubtitle v-if="item.parentName">
              Parent: {{ item.parentName }}
            </VListItemSubtitle>
          </VListItem>

          <VListItem v-if="alreadyQuotedDialogRemainingCount > 0">
            <template #prepend>
              <VIcon icon="tabler-dots" color="secondary" />
            </template>
            <VListItemTitle>
              {{ alreadyQuotedDialogRemainingCount }} more item{{
                alreadyQuotedDialogRemainingCount === 1 ? "" : "s"
              }}
            </VListItemTitle>
          </VListItem>
        </VList>
      </VCardText>

      <VCardActions class="pt-2 px-6 pb-6">
        <DialogActionBar
          save-text="Continue"
          cancel-text="Cancel"
          @save="closeAlreadyQuotedDialog(true)"
          @cancel="closeAlreadyQuotedDialog(false)"
        />
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="createItemTypeDialogVisible" max-width="920">
    <DialogCloseBtn @click="createItemTypeDialogVisible = false" />
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

  <VDialog v-model="createDraftItemDialogVisible" max-width="880">
    <DialogCloseBtn @click="createDraftItemDialogVisible = false" />
    <VCard>
      <VCardText>
        <h5 class="text-h5 mb-4">Add {{ selectedCreateItemType || "Item" }}</h5>

        <VForm
          ref="createDraftItemFormRef"
          class="deal-item-modal-form"
          @submit.prevent="saveCreatedDraftItem"
        >
          <VRow class="deal-item-modal-layout">
            <VCol cols="12" md="8" class="deal-item-modal-main">
              <VRow>
                <VCol cols="12">
                  <AppTextField
                    v-model="createDraftItem.name"
                    label="Name"
                    placeholder="Item name"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="createDraftItem.price"
                    type="number"
                    min="0"
                    label="Price"
                    placeholder="0"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-if="createDraftItemRequiresRecurrentTerm"
                    v-model="createDraftItem.recurrentPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else-if="createDraftItemRequiresRetainerTerm"
                    v-model="createDraftItem.retainerPeriods"
                    type="number"
                    min="1"
                    label="Periods"
                    placeholder="12"
                    :rules="[requiredValidator, positiveWholeNumberValidator]"
                  />
                  <AppTextField
                    v-else
                    v-model="createDraftItem.quantity"
                    type="number"
                    min="1"
                    label="Qty"
                    placeholder="1"
                    :rules="[requiredValidator]"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <AppTextField
                    v-model="createDraftItem.discountPercent"
                    type="number"
                    min="0"
                    label="Discount %"
                    placeholder="0"
                  />
                </VCol>

                <VCol cols="12" sm="6" md="3">
                  <div class="d-flex flex-column gap-2">
                    <span class="text-sm text-medium-emphasis">
                      {{
                        createDraftItem.taxApplicable
                          ? "Taxable"
                          : "Non Taxable"
                      }}
                    </span>
                    <VSwitch
                      v-model="createDraftItem.taxApplicable"
                      inset
                      hide-details
                      color="primary"
                    />
                  </div>
                </VCol>

                <template v-if="createDraftItemRequiresRecurrentTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="createDraftItem.recurrentStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods:
                      {{ createDraftItemRecurrentBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>

                <template v-if="createDraftItemRequiresRetainerTerm">
                  <VCol cols="12" md="6">
                    <AppDateTimePicker
                      v-model="createDraftItem.retainerStartDate"
                      label="Start Date"
                      :config="{ dateFormat: 'Y-m-d' }"
                      :rules="[requiredValidator]"
                    />
                  </VCol>

                  <VCol cols="12" md="6">
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

                  <VCol cols="12">
                    <VAlert variant="tonal" color="primary">
                      Billable periods:
                      {{ createDraftItemBillablePeriods ?? "--" }}
                    </VAlert>
                  </VCol>
                </template>
              </VRow>
            </VCol>

            <VCol cols="12" md="4" class="deal-item-modal-note-col">
              <AppTextarea
                v-model="createDraftItem.note"
                class="deal-item-modal-note"
                label="Note"
                placeholder="Short note"
                rows="4"
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

  <InvoiceAddPaymentDrawer
    v-model:is-drawer-open="invoicePaymentDrawerOpen"
    :current-balance="selectedPaymentBalance"
    :default-payment-method="selectedPaymentRecord?.record.paymentMethod"
    :document-label="selectedPaymentRecord?.quoteNumber"
    @submit="saveInvoicePayment"
  />

  <EmailDialog
    ref="emailDialogRef"
    v-model:is-dialog-visible="isSendDocumentDialogOpen"
    @close="closeDocumentEmailDialog"
    @send="onDocumentEmailSend"
  />
</template>

<style scoped>
.deal-item-modal-form {
  min-block-size: 100%;
}

.deal-item-modal-layout {
  align-items: stretch;
}

.deal-item-modal-main,
.deal-item-modal-note-col {
  display: flex;
  flex-direction: column;
}

.deal-item-modal-customization-col {
  margin-block-start: 0.75rem;
}

.deal-item-modal-main > :deep(.v-row) {
  align-content: flex-start;
}

.deal-item-modal-note-col :deep(.v-input),
.deal-item-modal-note-col :deep(.v-input__control),
.deal-item-modal-note-col :deep(.v-field) {
  flex: 1 1 auto;
  block-size: 100%;
}

.deal-item-modal-note :deep(textarea) {
  min-block-size: 100%;
  resize: vertical;
}

@media (max-width: 959px) {
  .deal-item-modal-note :deep(textarea) {
    min-block-size: 7rem;
  }
}

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
  background: rgba(var(--v-theme-surface), 0.12) !important;
  padding-block: 0.65rem;
  padding-inline: 0.8rem;
}

.goal-panel--contractual-phase {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
  background: rgba(var(--v-theme-surface), 0.12) !important;
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
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08) !important;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface), 0.12) !important;
  box-shadow: none !important;
}

.goal-section-panel--grouped .goal-panels {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.12);
  padding-block: 0.6rem;
  padding-inline: 0.7rem;
}

.goal-section-panel--grouped .goal-panel--static {
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
}

.period-timeline {
  position: relative;
  inline-size: 100%;
  padding-block: 0.3rem 0.15rem;
}

.period-timeline__services {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.12);
  gap: 0.45rem;
  margin-block-end: 0.9rem;
  padding-block: 0.6rem;
  padding-inline: 0.7rem;
}

.period-timeline__services-title {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.period-timeline__services-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.period-timeline__service-row {
  background: rgba(var(--v-theme-surface), 0.12) !important;
  inline-size: 100%;
  padding-block: 0.65rem;
  padding-inline: 0.75rem;
}

.period-timeline__steps {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(var(--period-count), minmax(0, 1fr));
}

.period-timeline__step {
  min-inline-size: 0;
}

.period-timeline__button {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  font: inherit;
  inline-size: 100%;
  min-inline-size: 0;
}

.period-timeline__segment {
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.18);
  block-size: 0.28rem;
  inline-size: 100%;
  transition: background 0.2s ease;
}

.period-timeline__button-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  inline-size: 100%;
  min-inline-size: 0;
  margin-block-start: 0.45rem;
}

.period-timeline__dot {
  border: 2px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface));
  block-size: 0.68rem;
  inline-size: 0.68rem;
}

.period-timeline__label {
  overflow: hidden;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  max-inline-size: 100%;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.period-timeline__step--invoiced .period-timeline__button {
  color: rgb(var(--v-theme-primary));
}

.period-timeline__step--invoiced .period-timeline__segment {
  background: rgb(var(--v-theme-primary));
}

.period-timeline__step--invoiced .period-timeline__dot {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.period-timeline__step--proforma .period-timeline__button {
  color: rgb(var(--v-theme-info));
}

.period-timeline__step--proforma .period-timeline__segment {
  background: rgb(var(--v-theme-info));
}

.period-timeline__step--proforma .period-timeline__dot {
  border-color: rgb(var(--v-theme-info));
  background: rgb(var(--v-theme-info));
}

.period-timeline__step--paid .period-timeline__button {
  color: rgb(var(--v-theme-success));
}

.period-timeline__step--paid .period-timeline__segment {
  background: rgb(var(--v-theme-success));
}

.period-timeline__step--paid .period-timeline__dot {
  border-color: rgb(var(--v-theme-success));
  background: rgb(var(--v-theme-success));
}

.period-timeline__step--overdue .period-timeline__button {
  color: rgb(var(--v-theme-error));
}

.period-timeline__step--overdue .period-timeline__segment {
  background: rgb(var(--v-theme-error));
}

.period-timeline__step--overdue .period-timeline__dot {
  border-color: rgb(var(--v-theme-error));
  background: rgb(var(--v-theme-error));
}

.period-timeline__step--missed .period-timeline__button {
  color: rgb(var(--v-theme-warning));
}

.period-timeline__step--missed .period-timeline__segment {
  background: rgb(var(--v-theme-warning));
}

.period-timeline__step--missed .period-timeline__dot {
  border-color: rgb(var(--v-theme-warning));
  background: rgb(var(--v-theme-warning));
}

.period-action-panel {
  overflow: visible;
  position: relative;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  inline-size: 100%;
  margin-block-start: 0.85rem;
}

.period-action-panel::before {
  position: absolute;
  z-index: 2;
  border-inline: 0.56rem solid transparent;
  border-block-end: 0.56rem solid rgba(var(--v-theme-on-surface), 0.16);
  content: "";
  inset-block-start: -0.56rem;
  inset-inline-start: var(--period-panel-arrow-left, 50%);
  transform: translateX(-50%);
}

.period-action-panel::after {
  position: absolute;
  z-index: 3;
  border-inline: 0.46rem solid transparent;
  border-block-end: 0.46rem solid rgb(var(--v-theme-surface));
  content: "";
  inset-block-start: -0.44rem;
  inset-inline-start: var(--period-panel-arrow-left, 50%);
  transform: translateX(-50%);
}

.period-action-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  padding-block: 0.65rem 0.55rem;
  padding-inline: 1rem;
}

.period-action-panel__info {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.period-action-panel__info-title {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.period-action-panel__dates {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.82rem;
  gap: 0.35rem;
  line-height: 1.35;
  margin-block-start: 0.2rem;
}

.period-action-panel__dates span {
  white-space: nowrap;
}

.period-action-panel__dates strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
}

.period-action-panel__date-separator {
  color: rgb(var(--v-theme-primary));
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
}

.period-action-panel__info-status {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.82rem;
  line-height: 1.35;
  margin-block-start: 0.2rem;
}

.period-action-panel__documents {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-block-start: 0.3rem;
}

.period-action-panel__doc-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.35;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.period-action-panel__primary-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
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

.item-card-content {
  display: block;
}

.item-card-main {
  min-inline-size: 0;
}

.phase-card-shell {
  padding-block: 0.125rem;
}

.phase-card-main {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.item-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-inline-size: 0;
}

.goal-panel--contractual-phase .item-card-header {
  align-items: flex-start;
  flex-direction: column;
  justify-content: flex-start;
}

.goal-panel--contractual-phase .item-card-inline-metrics {
  margin-block-start: 0.35rem;
}

.item-card-header__main {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.item-card-title-row {
  display: flex;
  overflow: hidden;
  flex-wrap: nowrap;
  align-items: baseline;
  gap: 0.35rem;
  inline-size: 100%;
  min-inline-size: 0;
}

.item-card-row-separator {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.item-card-title {
  flex: 0 1 auto;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.25;
  min-inline-size: 0;
}

.item-card-title--phase {
  font-size: 0.9rem;
}

.item-type-chip {
  background: transparent !important;
  box-shadow: none !important;
  gap: 0.4rem;
  margin-inline-start: 0.2rem;
  min-block-size: auto;
  opacity: 1 !important;
  padding-inline-start: 0;
}

.item-type-chip :deep(.v-chip__underlay) {
  display: none;
}

.item-type-chip:hover {
  opacity: 1 !important;
}

.item-type-chip--phase {
  margin-inline-start: 0;
}

.item-card-inline-metrics,
.item-card-date-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.875rem;
  gap: 0.35rem;
  line-height: 1.4;
}

.item-card-inline-metrics {
  margin-block-start: 0.35rem;
}

.item-card-date-row {
  align-items: flex-start;
  flex-direction: column;
  margin-block-start: 0.35rem;
}

.item-card-inline-metrics__group,
.item-card-date-row__group {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.875rem;
  font-weight: 400;
  gap: 0.25rem;
  line-height: 1.4;
  white-space: nowrap;
}

.item-card-inline-metrics__group strong,
.item-card-date-row__group strong {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
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

.items-overview-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.items-overview__card-create {
  background: rgba(var(--v-theme-on-surface), 0.07);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
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
.items-overview__card-create:hover {
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

.conversion-line-description {
  white-space: pre-line;
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
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.92rem;
  font-weight: 600;
  gap: 0.25rem;
  line-height: 1.2;
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
  grid-template-columns:
    minmax(6rem, 0.9fr)
    minmax(7rem, 1fr)
    minmax(0, 1.4fr)
    minmax(5rem, 0.8fr)
    2.25rem;
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
  font: inherit;
  inline-size: 100%;
  padding-block: 0.72rem;
  padding-inline: 0.8rem;
  text-align: start;
}

.items-overview__preview-table-row:hover {
  background: rgba(var(--v-theme-primary), 0.04);
}

.items-overview__preview-table-row--highlight,
.items-overview__preview-table-row--highlight:hover {
  background: rgba(var(--v-theme-warning), 0.18);
  box-shadow: inset 3px 0 rgb(var(--v-theme-warning));
}

.items-overview__doc-link {
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(var(--v-theme-primary), 0.96);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items-overview__actions {
  display: inline-flex;
  gap: 0.1rem;
  justify-content: flex-end;
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
  .items-overview__preview-table-head,
  .items-overview__preview-table-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 2rem;
  }

  .items-overview__preview-table-head span:nth-child(3),
  .items-overview__preview-table-head span:nth-child(4),
  .items-overview__preview-table-row span:nth-child(3),
  .items-overview__preview-table-row strong {
    display: none;
  }
}

.task-mono {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.sales-task-list {
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 6px;
}

.sales-task-list__header,
.sales-task-row {
  display: grid;
  align-items: center;
  grid-template-columns:
    3rem minmax(16rem, 1fr) minmax(7rem, 0.45fr) minmax(7rem, 0.45fr)
    minmax(7rem, 0.42fr) 5.5rem;
}

.sales-task-list__header {
  background: rgba(var(--v-theme-on-surface), 0.04);
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0;
  padding-block: 0.75rem;
  padding-inline: 0.5rem 1rem;
  text-transform: uppercase;
}

.sales-task-row {
  cursor: pointer;
  min-block-size: 4.5rem;
  padding-block: 0.625rem;
  padding-inline: 0.5rem 1rem;
}

.sales-task-row + .sales-task-row {
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.sales-task-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.035);
}

.sales-task-row__main {
  min-inline-size: 0;
}

.sales-task-row__due,
.sales-task-row__assigned,
.sales-task-row__status,
.sales-task-row__actions {
  display: flex;
  align-items: center;
  min-inline-size: 0;
}

.sales-task-row__assigned,
.sales-task-row__actions {
  justify-content: flex-start;
}

.sales-task-row__actions {
  gap: 0.25rem;
}

.status-trigger {
  justify-content: flex-start;
  min-inline-size: 0;
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

  .item-card-row-separator {
    display: none;
  }

  .product-metrics,
  .product-metrics--phase {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .items-summary {
    max-inline-size: 100%;
  }

  .sales-task-list__header {
    display: none;
  }

  .sales-task-row {
    grid-template-columns: 2.75rem minmax(0, 1fr);
    row-gap: 0.5rem;
  }

  .sales-task-row__due,
  .sales-task-row__assigned,
  .sales-task-row__status,
  .sales-task-row__actions {
    grid-column: 2;
  }

  .sales-task-row__actions {
    justify-content: flex-start;
  }
}
</style>
