<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import { saveFile } from "@/utils/fileStore";
import {
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  formatCurrencyAmount,
} from "@/utils/quotationConfig";
import {
  type DealQuotationConversionOption,
  buildDealQuotationConversionOptions,
  buildDealQuotationConversionProducts,
  hasDealDocumentPhaseOrPeriodLines,
  resolveStoredBillingPeriodKey,
} from "@/utils/dealDocumentDraft";
import {
  getLineDiscountAmount,
  getLineTotal,
  getQuotationGrandTotal,
} from "@/utils/quotationPricing";
import {
  isDocumentSourceExternal,
  isDocumentSourceInternal,
} from "@/utils/documentSourceModes";
import {
  FINANCE_APPROVAL_CONVERSION_MESSAGE,
  canConvertFinanceDocument,
  normalizeFinanceApprovalStatus,
} from "@/utils/financeApproval";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import { avatarText, formatSystemDate } from "@core/utils/formatters";
import type {
  Quotation,
  QuotationRecord,
  QuotationStatus,
} from "@db/apps/quotation/types";
import type { VForm } from "vuetify/components/VForm";

const searchQuery = ref("");
const selectedStatus = ref<QuotationStatus | null>(null);
const selectedRows = ref<string[]>([]);
const userData = useCookie<Record<string, unknown> | null | undefined>(
  "userData",
);
const isCreateMenuOpen = ref(false);
const isExternalQuotationDialogOpen = ref(false);
const isDeleteQuotationDialogOpen = ref(false);
const isSendQuotationDialogOpen = ref(false);
const quotationConversionDialogVisible = ref(false);
const expanded = ref<string[]>([]);
const previewActionFrame = ref<HTMLIFrameElement | null>(null);
const isPreviewActionFrameReady = ref(false);
const pendingPreviewAction = ref<{
  quotationId: number;
  action: "print" | "download";
} | null>(null);
const router = useRouter();
const pendingEmailQuotationId = ref<number | null>(null);
const emailDialogRef = ref<any | null>(null);
const pendingQuotationConversionId = ref<number | null>(null);
const pendingQuotationConversionKind = ref<"proforma" | "invoice" | null>(null);
const selectedQuotationConversionOptionKeys = ref<string[]>([]);
const selectedQuotationConversionPeriodKeys = ref<Record<string, string[]>>({});

type LinkedDocumentRef = {
  id: number;
  number: string;
};

type ConvertedDocumentLookup = {
  note: string;
  quotation: {
    quoteNumber: string;
    total: number;
    client: {
      name: string;
    };
  };
};

type DealContractOption = {
  title: string;
  value: string;
  recordType: "deal" | "contract";
  contactName: string;
  contactEmail: string;
};

type ExternalQuotationForm = {
  date: string | null;
  quoteNumber: string;
  amount: number | null;
  linkedRecord: string | null;
  status: QuotationStatus | null;
  attachment: File | File[] | null;
};

const quotationsStore = useQuotationsStore();
quotationsStore.init();
const proformasStore = useProformasStore();
proformasStore.init();
const invoicesStore = useInvoicesStore();
invoicesStore.init();

const configStore = useConfigStore();
configStore.init();
const canCreateQuotationSource = computed(() =>
  isDocumentSourceInternal(configStore.financial, "quotation"),
);
const canAttachQuotationSource = computed(() =>
  isDocumentSourceExternal(configStore.financial, "quotation"),
);
const canCreateProformaSource = computed(() =>
  isDocumentSourceInternal(configStore.financial, "proforma"),
);
const canCreateInvoiceSource = computed(() =>
  isDocumentSourceInternal(configStore.financial, "invoice"),
);

const contactsStore = useContactsStore();
contactsStore.init();
const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const dealsStore = useDealsStore();
dealsStore.init();
const notifications = useNotificationsStore();

const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();

const currentUserRole = computed(() =>
  String(userData.value?.role ?? "")
    .trim()
    .toLowerCase(),
);

const canSelectRows = computed(() => currentUserRole.value === "auditor");

const pushFinanceSuccess = (message: string) => {
  notifications.push(message, "success", 3500);
};

const pushFinanceWarning = (message: string) => {
  notifications.push(message, "warning", 3500);
};

const CONVERTED_LOCK_MESSAGE =
  "This document is converted and locked. Create a revision instead.";
const REVISION_LOCK_MESSAGE =
  "Older revisions cannot be edited or deleted. Use the latest revision.";
const getQuotationLabel = (quotationId: number) => {
  return (
    quotationsStore.byId(quotationId)?.quotation.quoteNumber ||
    `quotation #${quotationId}`
  );
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const headers = [
  { title: "#", key: "id" },
  { title: "Client", key: "client" },
  { title: "Issued Date", key: "date" },
  { title: "Total", key: "total" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const allQuotationRecords = computed(() => quotationsStore.all);
const allQuotationVersions = computed(() =>
  allQuotationRecords.value.map((record) => record.quotation),
);

const getQuotationRootKey = (quotation: Quotation) =>
  String(quotation.parentQuotationId ?? quotation.id);

const getQuotationRevisionOrder = (quotation: Quotation) => {
  const labelMatch = quotation.revisionLabel?.match(/R(\d+)$/i);
  if (labelMatch?.[1]) return Number(labelMatch[1]);

  const quoteMatch = quotation.quoteNumber.match(/-R(\d+)$/i);
  if (quoteMatch?.[1]) return Number(quoteMatch[1]);

  return 0;
};

const compareQuotationsNewestFirst = (a: Quotation, b: Quotation) => {
  const revisionDelta = getQuotationRevisionOrder(b) - getQuotationRevisionOrder(a);
  if (revisionDelta !== 0) return revisionDelta;

  const dateDelta =
    new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime();
  if (dateDelta !== 0) return dateDelta;

  return Number(b.id) - Number(a.id);
};

const quotationFamilyMap = computed(() => {
  const map = new Map<string, Quotation[]>();

  for (const quotation of allQuotationVersions.value) {
    const rootKey = getQuotationRootKey(quotation);
    const existing = map.get(rootKey) ?? [];
    existing.push(quotation);
    map.set(rootKey, existing);
  }

  for (const [rootKey, family] of map.entries()) {
    map.set(rootKey, [...family].sort(compareQuotationsNewestFirst));
  }

  return map;
});

const allQuotations = computed(() =>
  Array.from(quotationFamilyMap.value.values())
    .map((family) => family[0])
    .filter((quotation): quotation is Quotation => Boolean(quotation)),
);

const ensurePreviewActionFrame = () => {
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

  if (!previewActionFrame.value.src) {
    const preloadQuotationId = allQuotations.value[0]?.id;
    if (!preloadQuotationId) return;

    const routeLocation = router.resolve({
      name: "apps-quotation-preview-id",
      params: { id: preloadQuotationId },
      query: { embedded: "1" },
    });

    previewActionFrame.value.src = routeLocation.href;
  }
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

const sendPreviewAction = (
  quotationId: number,
  action: "print" | "download",
) => {
  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord || !previewActionFrame.value?.contentWindow) return;

  previewActionFrame.value.contentWindow.postMessage(
    {
      type: "quotation-preview-action",
      payload: {
        action,
        quotation: cloneQuotationRecord(quotationRecord),
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

  sendPreviewAction(pendingAction.quotationId, pendingAction.action);
  pushFinanceSuccess(
    `${pendingAction.action === "download" ? "Download" : "Print"} started for ${getQuotationLabel(pendingAction.quotationId)}.`,
  );
  pendingPreviewAction.value = null;
};

const handlePreviewActionFrameMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "quotation-preview-ready") return;

  isPreviewActionFrameReady.value = true;
  flushPendingPreviewAction();
};

onMounted(() => {
  window.addEventListener("message", handlePreviewActionFrameMessage);
  ensurePreviewActionFrame();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionFrameMessage);

  if (previewActionFrame.value?.parentNode) {
    previewActionFrame.value.parentNode.removeChild(previewActionFrame.value);
  }

  previewActionFrame.value = null;
  isPreviewActionFrameReady.value = false;
});

watch(
  () => allQuotations.value[0]?.id,
  () => {
    ensurePreviewActionFrame();
  },
  { immediate: true },
);
const revisionMap = computed(() => {
  const map = new Map<string, Quotation[]>();

  for (const family of quotationFamilyMap.value.values()) {
    const latest = family[0];
    if (!latest) continue;

    map.set(
      String(latest.id),
      family
        .filter((quotation) => String(quotation.id) !== String(latest.id))
        .sort(compareQuotationsNewestFirst),
    );
  }

  return map;
});

const resolveConvertedDocumentSourceQuotationId = (
  record: ConvertedDocumentLookup,
  convertedTo: "invoice" | "proforma",
) => {
  const noteMatch = record.note?.match(/Converted from quotation\s+QT-(\d+)/i);
  if (noteMatch?.[1]) return Number(noteMatch[1]);

  const quoteMatch = record.quotation.quoteNumber
    ?.trim()
    .match(/^(?:INV|PF)-(\d+)$/i);
  if (!quoteMatch?.[1]) return null;

  const quotationId = Number(quoteMatch[1]);
  const sourceQuotation = quotationsStore.byId(quotationId)?.quotation;
  if (!sourceQuotation) return null;

  const matchesSourceQuotation =
    sourceQuotation.quotationStatus === "Converted" &&
    sourceQuotation.client.name === record.quotation.client.name &&
    Number(sourceQuotation.total || 0) === Number(record.quotation.total || 0);

  return matchesSourceQuotation ? quotationId : null;
};

const linkedInvoicesMap = computed(() => {
  const map = new Map<number, LinkedDocumentRef[]>();

  for (const record of invoicesStore.all) {
    const sourceQuotationId = resolveConvertedDocumentSourceQuotationId(
      record,
      "invoice",
    );
    if (!sourceQuotationId) continue;

    const existing = map.get(sourceQuotationId) ?? [];
    existing.push({
      id: record.quotation.id,
      number: record.quotation.quoteNumber,
    });
    map.set(sourceQuotationId, existing);
  }

  return map;
});

const linkedProformasMap = computed(() => {
  const map = new Map<number, LinkedDocumentRef[]>();

  for (const record of proformasStore.all) {
    const sourceQuotationId = resolveConvertedDocumentSourceQuotationId(
      record,
      "proforma",
    );
    if (!sourceQuotationId) continue;

    const existing = map.get(sourceQuotationId) ?? [];
    existing.push({
      id: record.quotation.id,
      number: record.quotation.quoteNumber,
    });
    map.set(sourceQuotationId, existing);
  }

  return map;
});

const getLinkedInvoices = (quotationId: number) =>
  linkedInvoicesMap.value.get(quotationId) ?? [];

const getLinkedProformas = (quotationId: number) =>
  linkedProformasMap.value.get(quotationId) ?? [];

const filteredQuotations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  let records = allQuotations.value.filter((quotation) => {
    const family = getQuotationFamily(quotation);
    const matchesQuery = !query || family.some((familyMember) => {
      const client = familyMember.client as Quotation["client"] & {
        company?: string | null;
      };
      const searchText = [
        familyMember.id,
        familyMember.quoteNumber,
        familyMember.service,
        client.name,
        client.company,
        client.companyEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(query);
    });

    const matchesStatus =
      !selectedStatus.value ||
      family.some(
        (familyMember) =>
          familyMember.quotationStatus === selectedStatus.value,
      );

    return matchesQuery && matchesStatus;
  });

  if (sortBy.value) {
    records = [...records].sort((a, b) => {
      if (sortBy.value === "client") {
        return orderBy.value === "asc"
          ? a.client.name.localeCompare(b.client.name)
          : b.client.name.localeCompare(a.client.name);
      }

      if (sortBy.value === "id") {
        return orderBy.value === "asc" ? a.id - b.id : b.id - a.id;
      }

      if (sortBy.value === "total") {
        return orderBy.value === "asc" ? a.total - b.total : b.total - a.total;
      }

      if (sortBy.value === "date") {
        return orderBy.value === "asc"
          ? new Date(a.issuedDate).getTime() - new Date(b.issuedDate).getTime()
          : new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime();
      }

      return 0;
    });
  }

  return records;
});

const totalQuotations = computed(() => filteredQuotations.value.length);
const paginatedQuotations = computed(() => {
  if (itemsPerPage.value === -1) return filteredQuotations.value;

  const start = (page.value - 1) * itemsPerPage.value;
  return filteredQuotations.value.slice(start, start + itemsPerPage.value);
});

const hasRevisions = (quotation: Quotation) =>
  (revisionMap.value.get(getQuotationRowKey(quotation)) ?? []).length > 0;

const getRevisionCount = (quotation: Quotation) =>
  (revisionMap.value.get(getQuotationRowKey(quotation)) ?? []).length;

const getQuotationFamily = (quotation: Quotation) => {
  return quotationFamilyMap.value.get(getQuotationRootKey(quotation)) ?? [quotation];
};

const isOlderQuotationRevision = (quotation: Quotation) => {
  const family = getQuotationFamily(quotation);
  if (family.length <= 1) return false;

  const latest = family[0];

  return Boolean(latest) && String(latest.id) !== String(quotation.id);
};

const getQuotationLockReason = (quotation?: Quotation | null) => {
  if (!quotation) return "";
  if (quotation.quotationStatus === "Converted") return CONVERTED_LOCK_MESSAGE;
  if (isOlderQuotationRevision(quotation)) return REVISION_LOCK_MESSAGE;

  return "";
};

const openQuotationEditDraft = (quotationId: number) => {
  const quotation = quotationsStore.byId(quotationId)?.quotation;
  const lockReason = getQuotationLockReason(quotation);
  if (lockReason) {
    pushFinanceWarning(lockReason);
    return;
  }

  router.push({ name: "apps-quotation-edit-id", params: { id: quotationId } });
};

const getQuotationRowKey = (quotation: Quotation) => String(quotation.id);

const isExpanded = (quotation: Quotation) =>
  expanded.value.includes(getQuotationRowKey(quotation));

const toggleRow = (quotation: Quotation) => {
  const id = getQuotationRowKey(quotation);
  expanded.value = isExpanded(quotation)
    ? expanded.value.filter((value) => value !== id)
    : [...expanded.value, id];
};

const getRevisions = (quotationId: number | string) =>
  [...(revisionMap.value.get(String(quotationId)) ?? [])];

const getContactId = (quotation: Quotation) => {
  const clientName = quotation.client.name.trim().toLowerCase();
  const clientEmail = quotation.client.companyEmail.trim().toLowerCase();

  const byEmail = clientEmail
    ? contactsStore.all.find(
        (contact) => contact.email.trim().toLowerCase() === clientEmail,
      )
    : null;
  if (byEmail) return byEmail.id;

  const byName = clientName
    ? contactsStore.all.find(
        (contact) => contact.fullName.trim().toLowerCase() === clientName,
      )
    : null;

  return byName?.id ?? null;
};

const getMatchedContact = (quotation: Quotation) => {
  const clientName = quotation.client.name.trim().toLowerCase();
  const clientEmail = quotation.client.companyEmail.trim().toLowerCase();

  return (
    (clientEmail
      ? contactsStore.all.find(
          (contact) => contact.email.trim().toLowerCase() === clientEmail,
        )
      : null) ??
    (clientName
      ? contactsStore.all.find(
          (contact) => contact.fullName.trim().toLowerCase() === clientName,
        )
      : null) ??
    null
  );
};

const getQuotationAvatar = (quotation: Quotation) =>
  getMatchedContact(quotation)?.picture || quotation.avatar || "";

const getContactRouteId = (quotation: Quotation) =>
  getContactId(quotation) ?? 0;

const dealContractOptions = computed<DealContractOption[]>(() => {
  const options = new Map<string, DealContractOption>();

  for (const quotation of allQuotations.value) {
    if (!quotation.dealId) continue;

    options.set(String(quotation.dealId), {
      title: `${
        quotation.linkedRecordType === "contract" ? "Contract" : "Deal"
      } ${quotation.dealId} - ${quotation.client.name}`,
      value: String(quotation.dealId),
      recordType: quotation.linkedRecordType ?? "deal",
      contactName: quotation.client.name,
      contactEmail: quotation.client.companyEmail,
    });
  }

  return Array.from(options.values());
});

const emptyExternalQuotationForm = (): ExternalQuotationForm => ({
  date: null,
  quoteNumber: "",
  amount: null,
  linkedRecord: null,
  status: "Active",
  attachment: null,
});

const externalQuotationForm = ref<ExternalQuotationForm>(
  emptyExternalQuotationForm(),
);
const externalQuotationFormRef = ref<VForm>();
const isExternalQuotationFormValid = ref(false);
const externalQuotationError = ref("");
const externalQuotationSuccess = ref("");
const allowedAttachmentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];
const allowedAttachmentExtensions = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
];
const attachmentAccept = allowedAttachmentExtensions.join(",");
const maxAttachmentSizeBytes = 10 * 1024 * 1024;

const selectedAttachment = computed<File | null>(() => {
  const value = externalQuotationForm.value.attachment;
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
});

const hasLinkedDealOrContract = computed(
  () => !!externalQuotationForm.value.linkedRecord,
);
const selectedLinkedOption = computed(
  () =>
    dealContractOptions.value.find(
      (option) => option.value === externalQuotationForm.value.linkedRecord,
    ) || null,
);

const positiveAmountValidator = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "This field is required";
  }

  return Number(value) > 0 || "Amount must be greater than 0";
};

const uniqueQuotationNumberValidator = (value: unknown) => {
  const quoteNumber = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!quoteNumber) return true;

  const exists = quotationsStore.all.some(
    (record) =>
      record.quotation.quoteNumber.trim().toLowerCase() === quoteNumber,
  );

  return exists ? "Quotation number already exists" : true;
};

const attachmentValidator = () => {
  return validateExternalAttachment() || true;
};

const resolveStatusVariantAndIcon = (status: string) => {
  if (status === "Active")
    return { variant: "warning", icon: "tabler-clock-hour-4" };
  if (status === "Sent") return { variant: "info", icon: "tabler-send" };
  if (status === "Approval")
    return { variant: "success", icon: "tabler-check" };
  if (status === "Lost") return { variant: "error", icon: "tabler-x" };
  if (status === "Canceled")
    return { variant: "secondary", icon: "tabler-ban" };
  if (status === "Converted")
    return { variant: "primary", icon: "tabler-file-invoice" };

  return { variant: "secondary", icon: "tabler-x" };
};

const resolveStatusLabel = (status: string) => {
  return status;
};

const resolveApprovalStatusDisplay = (quotation: Quotation) => {
  const record = allQuotationRecords.value.find(
    (entry) => String(entry.quotation.id) === String(quotation.id),
  );

  if (record?.approvalMode === "Request Approval") {
    const approvalStatus = normalizeFinanceApprovalStatus(record);

    if (approvalStatus === "approved")
      return { label: "Approved", variant: "success" };
    if (approvalStatus === "rejected")
      return { label: "Declined", variant: "error" };

    return { label: "Approval Requested", variant: "warning" };
  }

  return {
    label: resolveStatusLabel(quotation.quotationStatus),
    variant: resolveStatusVariantAndIcon(quotation.quotationStatus).variant,
  };
};

const normalizeQuotationStatus = (status?: string | null) =>
  String(status ?? "")
    .trim()
    .toLowerCase();

const isQuotationClosedForConversion = (status?: string | null) =>
  ["converted", "lost", "canceled", "cancelled"].includes(
    normalizeQuotationStatus(status),
  );

const isQuotationConversionBlocked = (record: QuotationRecord | null) =>
  !record ||
  isQuotationClosedForConversion(record.quotation.quotationStatus) ||
  !canConvertFinanceDocument(record);

const notifyQuotationConversionBlocked = (record: QuotationRecord | null) => {
  if (record && !canConvertFinanceDocument(record)) {
    pushFinanceWarning(FINANCE_APPROVAL_CONVERSION_MESSAGE);
    return;
  }

  pushFinanceWarning("Quotation cannot be converted.");
};

const pendingQuotationConversionRecord = computed(() =>
  pendingQuotationConversionId.value === null
    ? null
    : quotationsStore.byId(pendingQuotationConversionId.value),
);

const getQuotationLinkedDeal = (quotationRecord: QuotationRecord | null) =>
  quotationRecord?.quotation.dealId
    ? dealsStore.byId(quotationRecord.quotation.dealId)
    : null;

const getQuotationConversionProductsForRecord = (
  quotationRecord: QuotationRecord,
) =>
  buildDealQuotationConversionProducts({
    deal: getQuotationLinkedDeal(quotationRecord),
    products: quotationRecord.purchasedProducts,
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
  });

const getQuotationConversionOptionsForRecord = (
  quotationRecord: QuotationRecord,
) =>
  buildDealQuotationConversionOptions({
    deal: getQuotationLinkedDeal(quotationRecord),
    products: quotationRecord.purchasedProducts,
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
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
  getQuotationGrandTotal(selectedQuotationConversionProducts.value),
);

const getQuotationLinkedDealItems = (quotationRecord: QuotationRecord | null) =>
  getQuotationLinkedDeal(quotationRecord)?.items || [];

const hasQuotationPhaseOrPeriodLines = (quotationRecord: QuotationRecord) =>
  hasDealDocumentPhaseOrPeriodLines(
    getQuotationConversionProductsForRecord(quotationRecord),
    getQuotationLinkedDealItems(quotationRecord),
  );

const getConversionLineContext = (
  product: QuotationRecord["purchasedProducts"][number],
) => {
  if (product.billingPeriod)
    return product.billingPeriod.label || "Billing period";

  const billingPeriodKey = resolveStoredBillingPeriodKey(product);
  if (billingPeriodKey) return billingPeriodKey;

  const selectionKey = String(product.dealSelectionKey ?? "");
  if (selectionKey.includes("phase")) return "Phase";
  if (selectionKey.includes("retainer")) return "Retainer period";
  if (selectionKey.includes("recurrent")) return "Recurrent period";

  return "--";
};

const getConversionLineDiscount = (
  product: QuotationRecord["purchasedProducts"][number],
) =>
  formatCurrencyAmount(getLineDiscountAmount(product), configStore.financial);

const getConversionLineTotal = (
  product: QuotationRecord["purchasedProducts"][number],
) => formatCurrencyAmount(getLineTotal(product), configStore.financial);

const getConversionOptionTypeLabel = (
  option: DealQuotationConversionOption,
) => {
  if (option.kind === "phase") return "Phase";
  if (option.kind === "retainer-period") return "Retainer";
  if (option.kind === "recurrent-period") return "Recurrent";

  return "Item";
};

const getConversionOptionTotal = (option: DealQuotationConversionOption) => {
  if (!option.periods.length) return getConversionLineTotal(option.product);

  const selectedPeriods = new Set(
    selectedQuotationConversionPeriodKeys.value[option.key] || [],
  );
  const products = option.periods
    .filter((period) => selectedPeriods.has(period.key))
    .map((period) => period.product);

  return formatCurrencyAmount(
    getQuotationGrandTotal(products),
    configStore.financial,
  );
};

const getConversionLineTaxStatus = (
  product: QuotationRecord["purchasedProducts"][number],
) => (product.taxApplicable === false ? "VAT not applied" : "VAT applicable");

const openExternalQuotationDialog = () => {
  isCreateMenuOpen.value = false;
  isExternalQuotationFormValid.value = false;
  externalQuotationError.value = "";
  externalQuotationSuccess.value = "";
  externalQuotationForm.value = emptyExternalQuotationForm();
  isExternalQuotationDialogOpen.value = true;
  nextTick(() => {
    externalQuotationFormRef.value?.resetValidation();
  });
};

const closeExternalQuotationDialog = () => {
  isExternalQuotationDialogOpen.value = false;
  isExternalQuotationFormValid.value = false;
  externalQuotationError.value = "";
  externalQuotationSuccess.value = "";
  externalQuotationForm.value = emptyExternalQuotationForm();
  nextTick(() => {
    externalQuotationFormRef.value?.resetValidation();
  });
};

const handleLinkedRecordChange = (value: string | null) => {
  const linkedRecord = value ? String(value) : null;
  externalQuotationForm.value.linkedRecord = linkedRecord;
};

const validateExternalAttachment = () => {
  const file = selectedAttachment.value;

  if (!file) return "";

  const fileName = file.name.toLowerCase();
  const hasAllowedExtension = allowedAttachmentExtensions.some((extension) =>
    fileName.endsWith(extension),
  );
  const hasAllowedMimeType = allowedAttachmentTypes.includes(file.type);

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return "Attachment type is not allowed. Use PDF, Word, Excel, PNG, or JPG files only.";
  }

  if (file.size > maxAttachmentSizeBytes) {
    return "Attachment must be 10MB or smaller.";
  }

  return "";
};

const saveExternalQuotation = async () => {
  externalQuotationError.value = "";
  externalQuotationSuccess.value = "";

  const { valid } = (await externalQuotationFormRef.value?.validate()) ?? {
    valid: true,
  };

  if (!valid) {
    externalQuotationError.value = "Fix the highlighted fields before saving.";
    return;
  }

  const attachmentValidationError = validateExternalAttachment();

  if (attachmentValidationError) {
    externalQuotationError.value = attachmentValidationError;
    return;
  }

  const attachmentFile = selectedAttachment.value;
  let attachmentFileKey: string | null = null;

  if (attachmentFile) {
    try {
      attachmentFileKey = await saveFile(attachmentFile);
    } catch {
      externalQuotationError.value =
        "Attachment could not be saved locally for preview.";
      return;
    }
  }

  quotationsStore.addQuotation({
    quotation: {
      quoteNumber: externalQuotationForm.value.quoteNumber.trim(),
      issuedDate: externalQuotationForm.value.date!,
      dueDate: externalQuotationForm.value.date!,
      client: {
        address: "",
        company:
          selectedLinkedOption.value?.contactName.trim() ||
          selectedLinkedOption.value?.contactEmail.trim() ||
          "",
        companyEmail: selectedLinkedOption.value?.contactEmail.trim() || "",
        country: "Lebanon",
        contact: "",
        name: selectedLinkedOption.value?.contactName.trim() || "",
      },
      service: "Imported quotation",
      total: Number(externalQuotationForm.value.amount),
      avatar: "",
      quotationStatus: externalQuotationForm.value.status ?? "Active",
      balance: 0,
      dealId: selectedLinkedOption.value
        ? Number(selectedLinkedOption.value.value)
        : null,
      linkedRecordType: selectedLinkedOption.value?.recordType ?? null,
      source: "external",
      attachmentName: attachmentFile?.name ?? null,
      attachmentFileKey,
    },
    purchasedProducts: [
      {
        title: "Imported quotation amount",
        cost: Number(externalQuotationForm.value.amount),
        hours: 1,
        description: "Imported from another system.",
      },
    ],
    paymentDetails: buildQuotationPaymentDetails(
      Number(externalQuotationForm.value.amount || 0),
      configStore.legal,
      configStore.financial,
    ),
    note: selectedLinkedOption.value
      ? "Imported quotation linked to an existing record."
      : "Imported quotation without linked deal or contract.",
    paymentMethod: "Bank Transfer",
    salesperson: buildQuotationSalesperson(configStore.legal),
    thanksNote: buildQuotationThanksNote(configStore.legal),
  });

  externalQuotationSuccess.value = hasLinkedDealOrContract.value
    ? "Quotation import draft captured and linked to the selected deal/contract."
    : "Quotation import draft captured. This quotation is flagged because it is not linked to a deal or contract.";

  pushFinanceSuccess(externalQuotationSuccess.value);

  closeExternalQuotationDialog();
};

const openRevisionDraft = async (quotationId: number) => {
  await router.push({
    name: "apps-quotation-add",
    query: { revisionOf: String(quotationId) },
  });

  pushFinanceSuccess(
    `Revision draft opened for ${getQuotationLabel(quotationId)}.`,
  );
};

const openDuplicateDraft = async (quotationId: number) => {
  await router.push({
    name: "apps-quotation-add",
    query: { duplicateOf: String(quotationId) },
  });

  pushFinanceSuccess(
    `Duplicate draft opened for ${getQuotationLabel(quotationId)}.`,
  );
};

const createProformaFromQuotation = (
  quotationRecord: QuotationRecord,
  selectedProducts = quotationRecord.purchasedProducts,
) => {
  const total = getQuotationGrandTotal(selectedProducts);

  return proformasStore.addProforma({
    quotation: {
      issuedDate: quotationRecord.quotation.issuedDate,
      dueDate: quotationRecord.quotation.dueDate,
      client: quotationRecord.quotation.client,
      service: quotationRecord.quotation.service,
      total,
      avatar: quotationRecord.quotation.avatar,
      quotationStatus: "Not Paid",
      balance: total,
      dealId: quotationRecord.quotation.dealId,
      linkedRecordType: quotationRecord.quotation.linkedRecordType,
      source: quotationRecord.quotation.source,
      attachmentName: quotationRecord.quotation.attachmentName,
      attachmentFileKey: quotationRecord.quotation.attachmentFileKey,
      parentQuotationId: null,
      isRevision: false,
      revisionLabel: null,
    },
    paymentDetails: quotationRecord.paymentDetails,
    purchasedProducts: selectedProducts,
    note: [
      quotationRecord.note?.trim(),
      `Converted from quotation ${quotationRecord.quotation.quoteNumber}.`,
    ]
      .filter(Boolean)
      .join("\n"),
    showClientNote: quotationRecord.showClientNote,
    totalFx: quotationRecord.totalFx,
    paymentMethod: quotationRecord.paymentMethod,
    paymentLink: quotationRecord.paymentLink,
    approvalMode: quotationRecord.approvalMode,
    approverEmployeeId: quotationRecord.approverEmployeeId,
    salesperson: quotationRecord.salesperson,
    thanksNote: quotationRecord.thanksNote,
  });
};

const createInvoiceFromProforma = (
  proformaRecord: ReturnType<typeof proformasStore.addProforma>,
) => {
  if (!proformaRecord) return null;

  const created = invoicesStore.addInvoice({
    ...proformaRecord,
    quotation: {
      ...proformaRecord.quotation,
      id: 0,
      quoteNumber: "",
      quotationStatus: "Not Paid",
      balance: proformaRecord.quotation.total,
    },
  });

  proformasStore.updateProforma(proformaRecord.quotation.id, {
    convertedInvoiceId: created?.quotation.id ?? null,
  });

  return created;
};

const performQuotationConversion = (
  quotationId: number,
  kind: "proforma" | "invoice",
  selectedProducts?: QuotationRecord["purchasedProducts"],
) => {
  if (kind === "proforma" && !canCreateProformaSource.value) {
    pushFinanceWarning("Proformas are configured for external attachments.");

    return null;
  }

  if (kind === "invoice" && !canCreateInvoiceSource.value) {
    pushFinanceWarning("Invoices are configured for external attachments.");

    return null;
  }

  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord) return null;

  if (isQuotationConversionBlocked(quotationRecord)) {
    notifyQuotationConversionBlocked(quotationRecord);
    return null;
  }

  const products = selectedProducts?.length
    ? selectedProducts
    : quotationRecord.purchasedProducts;
  if (!products.length) {
    pushFinanceWarning("Select at least one line to convert.");

    return null;
  }

  const createdProforma = createProformaFromQuotation(
    quotationRecord,
    products,
  );

  if (!createdProforma) {
    pushFinanceWarning(FINANCE_APPROVAL_CONVERSION_MESSAGE);
    return null;
  }

  const createdInvoice =
    kind === "invoice" ? createInvoiceFromProforma(createdProforma) : null;

  if (kind === "invoice" && !createdInvoice) {
    pushFinanceWarning(FINANCE_APPROVAL_CONVERSION_MESSAGE);
    return null;
  }

  quotationsStore.updateQuotation(quotationId, {
    quotation: {
      convertedProformaId: createdProforma?.quotation.id ?? null,
      convertedInvoiceId: createdInvoice?.quotation.id ?? null,
      quotationStatus: "Converted",
    },
  });

  pushFinanceSuccess(
    kind === "invoice"
      ? `Converted ${quotationRecord.quotation.quoteNumber} to ${createdInvoice?.quotation.quoteNumber || "an invoice"}.`
      : `Converted ${quotationRecord.quotation.quoteNumber} to ${createdProforma?.quotation.quoteNumber || "a proforma"}.`,
  );

  return kind === "invoice" ? createdInvoice : createdProforma;
};

const openQuotationConversionFlow = (
  quotationId: number,
  kind: "proforma" | "invoice",
) => {
  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord) return;

  if (isQuotationConversionBlocked(quotationRecord)) {
    notifyQuotationConversionBlocked(quotationRecord);
    return;
  }

  if (hasQuotationPhaseOrPeriodLines(quotationRecord)) {
    const options = getQuotationConversionOptionsForRecord(quotationRecord);
    pendingQuotationConversionId.value = quotationId;
    pendingQuotationConversionKind.value = kind;
    initializeQuotationConversionSelection(options);
    quotationConversionDialogVisible.value = true;

    return;
  }

  performQuotationConversion(quotationId, kind);
};

const requestQuotationConversion = (
  quotationId: number,
  kind: "proforma" | "invoice",
) => {
  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord) return;

  if (isQuotationConversionBlocked(quotationRecord)) {
    notifyQuotationConversionBlocked(quotationRecord);
    return;
  }

  openQuotationConversionFlow(quotationId, kind);
};

const convertQuotationToProforma = (quotationId: number) => {
  requestQuotationConversion(quotationId, "proforma");
};

const convertQuotationToInvoice = (quotationId: number) => {
  requestQuotationConversion(quotationId, "invoice");
};

const closeQuotationConversionDialog = () => {
  quotationConversionDialogVisible.value = false;
  pendingQuotationConversionId.value = null;
  pendingQuotationConversionKind.value = null;
  selectedQuotationConversionOptionKeys.value = [];
  selectedQuotationConversionPeriodKeys.value = {};
};

const confirmQuotationConversion = () => {
  const quotationId = pendingQuotationConversionId.value;
  const kind = pendingQuotationConversionKind.value;
  if (quotationId === null || !kind) return;

  performQuotationConversion(
    quotationId,
    kind,
    selectedQuotationConversionProducts.value,
  );
  closeQuotationConversionDialog();
};

const pendingDeleteQuotationId = ref<number | null>(null);

const pendingDeleteQuotation = computed(() => {
  if (pendingDeleteQuotationId.value === null) return null;

  return (
    quotationsStore.byId(pendingDeleteQuotationId.value)?.quotation ?? null
  );
});

const pendingDeleteRevisionCount = computed(() => {
  const quotation = pendingDeleteQuotation.value;
  if (!quotation || quotation.parentQuotationId) return 0;

  return quotationsStore.revisionsByParent(quotation.id).length;
});

const deleteDialogMessage = computed(() => {
  const quotation = pendingDeleteQuotation.value;
  if (!quotation) return "";

  if (quotation.parentQuotationId) {
    return `Are you sure you want to delete revision ${quotation.quoteNumber}?`;
  }

  if (pendingDeleteRevisionCount.value > 0) {
    return `Are you sure you want to delete ${quotation.quoteNumber} and its ${pendingDeleteRevisionCount.value} revision${pendingDeleteRevisionCount.value === 1 ? "" : "s"}?`;
  }

  return `Are you sure you want to delete quotation ${quotation.quoteNumber}?`;
});

const closeDeleteQuotationDialog = () => {
  isDeleteQuotationDialogOpen.value = false;
  pendingDeleteQuotationId.value = null;
};

const deleteQuotation = (quotationId: number) => {
  const record = quotationsStore.byId(quotationId);
  if (!record) return;

  const lockReason = getQuotationLockReason(record.quotation);
  if (lockReason) {
    pushFinanceWarning(lockReason);
    return;
  }

  pendingDeleteQuotationId.value = quotationId;
  isDeleteQuotationDialogOpen.value = true;
};

const confirmDeleteQuotation = () => {
  const quotation = pendingDeleteQuotation.value;
  if (!quotation) {
    closeDeleteQuotationDialog();
    return;
  }

  quotationsStore.removeQuotation(quotation.id);
  expanded.value = expanded.value.filter(
    (value) => value !== String(quotation.id),
  );
  pushFinanceSuccess(`${quotation.quoteNumber} deleted successfully.`);
  closeDeleteQuotationDialog();
};

const emailQuotationRecord = computed<QuotationRecord | null>(() => {
  if (pendingEmailQuotationId.value === null) return null;
  return quotationsStore.byId(pendingEmailQuotationId.value) ?? null;
});

const quotationEmailDraft = computed(() => {
  const quotation = emailQuotationRecord.value?.quotation;
  const companyName = configStore.legal?.companyName?.trim() || "Squarely";
  const to = quotation?.client.companyEmail?.trim() || "";
  const clientName = quotation?.client.name?.trim() || "there";
  const quoteNumber = quotation?.quoteNumber?.trim() || "quotation";
  const total = formatCurrencyAmount(quotation?.total, configStore.financial);
  const expiryDate = quotation?.dueDate?.trim() || "";

  return {
    to,
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    message: `Dear ${clientName},

Please find ${quoteNumber} attached.

Quotation amount: ${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName}`.trim(),
    attachments: [
      {
        name: quoteNumber ? `${quoteNumber}.pdf` : "Quotation Attached",
      },
    ],
  };
});

const openQuotationPreviewWindow = (
  quotationId: number,
  action: "print" | "download",
) => {
  ensurePreviewActionFrame();
  pendingPreviewAction.value = { quotationId, action };

  if (!isPreviewActionFrameReady.value) return;

  flushPendingPreviewAction();
};

const openQuotationEmailDialog = (quotationId: number) => {
  pendingEmailQuotationId.value = quotationId;
  isSendQuotationDialogOpen.value = true;

  nextTick(() => {
    emailDialogRef.value?.openWith?.(quotationEmailDraft.value);
  });
};

const closeQuotationEmailDialog = () => {
  isSendQuotationDialogOpen.value = false;
  pendingEmailQuotationId.value = null;
};

const onQuotationEmailSend = (payload: any) => {
  const quotationId = pendingEmailQuotationId.value;
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

  if (quotationId !== null) {
    quotationsStore.markQuotationSent(quotationId);
  }

  closeQuotationEmailDialog();
};

const getRevisionDisplayLabel = (revision: Quotation, index: number) => {
  if (revision.revisionLabel?.trim()) return revision.revisionLabel.trim();

  const revisionMatch = revision.quoteNumber.match(/-R(\d+)$/i);
  if (revisionMatch?.[1]) return `R${revisionMatch[1]}`;

  return `R${index + 1}`;
};

const computedMoreList = computed(() => {
  return (paramId: number) => [
    {
      title: "Edit",
      value: "edit",
      prependIcon: "tabler-pencil",
      onClick: () => openQuotationEditDraft(paramId),
    },
    {
      title: "Revise",
      value: "revise",
      prependIcon: "tabler-refresh",
      onClick: () => openRevisionDraft(paramId),
    },
    {
      title: "Duplicate",
      value: "duplicate",
      prependIcon: "tabler-copy",
      onClick: () => openDuplicateDraft(paramId),
    },
    ...(canCreateProformaSource.value
      ? [
          {
            title: "Convert to Proforma",
            value: "convert-to-proforma",
            prependIcon: "tabler-file-dollar",
            disabled: isQuotationConversionBlocked(
              quotationsStore.byId(paramId),
            ),
            onClick: () => convertQuotationToProforma(paramId),
          },
        ]
      : []),
    ...(canCreateInvoiceSource.value
      ? [
          {
            title: "Convert to Tax invoice",
            value: "convert-to-tax-invoice",
            prependIcon: "tabler-file-invoice",
            disabled: isQuotationConversionBlocked(
              quotationsStore.byId(paramId),
            ),
            onClick: () => convertQuotationToInvoice(paramId),
          },
        ]
      : []),
    {
      title: "Share",
      value: "share",
      prependIcon: "tabler-share",
      children: [
        {
          title: "Download",
          value: "download",
          prependIcon: "tabler-download",
          onClick: () => openQuotationPreviewWindow(paramId, "download"),
        },
        {
          title: "Print",
          value: "print",
          prependIcon: "tabler-printer",
          onClick: () => openQuotationPreviewWindow(paramId, "print"),
        },
        {
          title: "Email",
          value: "email",
          prependIcon: "tabler-mail",
          onClick: () => openQuotationEmailDialog(paramId),
        },
      ],
    },
    {
      title: "Delete",
      value: "delete",
      prependIcon: "tabler-trash",
      class: "text-error",
      onClick: () => deleteQuotation(paramId),
    },
  ];
});

const revisionMenuList = computed(() => {
  return (paramId: number) => [
    {
      title: "Preview",
      value: "preview",
      prependIcon: "tabler-eye",
      to: { name: "apps-quotation-preview-id", params: { id: paramId } },
    },
    {
      title: "Delete",
      value: "delete",
      prependIcon: "tabler-trash",
      class: "text-error",
      onClick: () => deleteQuotation(paramId),
    },
  ];
});

watch(canSelectRows, (value) => {
  if (!value) selectedRows.value = [];
});

watch(isSendQuotationDialogOpen, (isOpen) => {
  if (!isOpen) pendingEmailQuotationId.value = null;
});

watch([searchQuery, selectedStatus, itemsPerPage], () => {
  page.value = 1;
});

watch(totalQuotations, (value) => {
  const maxPage =
    itemsPerPage.value === -1
      ? 1
      : Math.max(1, Math.ceil(value / itemsPerPage.value));
  if (page.value > maxPage) page.value = maxPage;
});
</script>

<template>
  <section v-if="allQuotations">
    <VCard id="quotation-list">
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="d-flex align-center gap-2">
          <span>Show</span>
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>

        <VSpacer />

        <div class="quotation-list-toolbar d-flex align-center flex-wrap gap-4">
          <div class="quotation-list-filter">
            <AppTextField
              v-model="searchQuery"
              placeholder="Search Quotation"
            />
          </div>

          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Quotation Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="[
                'Active',
                'Sent',
                'Approval',
                'Lost',
                'Canceled',
                'Converted',
              ]"
            />
          </div>

          <VMenu v-model="isCreateMenuOpen">
            <template #activator="{ props }">
              <VBtn v-bind="props" prepend-icon="tabler-plus">
                Create Quotation
              </VBtn>
            </template>

            <VList>
              <VListItem
                v-if="canCreateQuotationSource"
                :to="{ name: 'apps-quotation-add' }"
                prepend-icon="tabler-building-estate"
              >
                From Squarely
              </VListItem>
              <VListItem
                v-if="canAttachQuotationSource"
                prepend-icon="tabler-paperclip"
                @click="openExternalQuotationDialog"
              >
                Attachment from another system
              </VListItem>
            </VList>
          </VMenu>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:model-value="selectedRows"
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        v-model:expanded="expanded"
        :show-select="canSelectRows"
        :items-length="totalQuotations"
        :headers="headers"
        :items="paginatedQuotations"
        :item-value="getQuotationRowKey"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          <RouterLink
            :to="{ name: 'apps-quotation-preview-id', params: { id: item.id } }"
          >
            {{ item.quoteNumber }}
          </RouterLink>
        </template>

        <template #item.client="{ item }">
          <div class="d-flex align-center">
            <div class="quotation-chevron-slot">
              <VBtn
                v-if="hasRevisions(item)"
                icon
                variant="text"
                size="small"
                class="quotation-chevron-btn"
                @click.stop="toggleRow(item)"
              >
                <VIcon
                  :icon="
                    isExpanded(item)
                      ? 'tabler-chevron-up'
                      : 'tabler-chevron-down'
                  "
                  size="18"
                />
              </VBtn>
              <div
                v-else
                class="quotation-chevron-placeholder"
                aria-hidden="true"
              />
            </div>

            <RouterLink
              :to="{
                name: 'apps-quotation-preview-id',
                params: { id: item.id },
              }"
              class="me-3"
            >
              <VAvatar
                size="34"
                :color="
                  !getQuotationAvatar(item).length
                    ? resolveStatusVariantAndIcon(item.quotationStatus).variant
                    : undefined
                "
                :variant="
                  !getQuotationAvatar(item).length ? 'tonal' : undefined
                "
              >
                <VImg
                  v-if="getQuotationAvatar(item).length"
                  :src="getQuotationAvatar(item)"
                />
                <span v-else>{{ avatarText(item.client.name) }}</span>
              </VAvatar>
            </RouterLink>
            <div class="d-flex flex-column">
              <RouterLink
                :to="{
                  name: 'apps-quotation-preview-id',
                  params: { id: item.id },
                }"
                class="text-link font-weight-medium"
              >
                {{ item.client.name }}
              </RouterLink>
              <RouterLink
                v-if="item.dealId"
                :to="{ name: 'wizard-examples-create-deal' }"
                class="text-sm text-link"
              >
                Deal #{{ item.dealId }}
              </RouterLink>
              <div class="d-flex flex-wrap align-center gap-2 text-sm">
                <span v-if="!item.dealId" class="text-medium-emphasis">
                  No linked deal
                </span>
                <RouterLink
                  v-for="invoice in getLinkedInvoices(item.id)"
                  :key="`invoice-${item.id}-${invoice.id}`"
                  :to="{
                    name: 'apps-invoice-preview-id',
                    params: { id: invoice.id },
                  }"
                  class="text-link"
                >
                  INV {{ invoice.number }}
                </RouterLink>
                <RouterLink
                  v-for="proforma in getLinkedProformas(item.id)"
                  :key="`proforma-${item.id}-${proforma.id}`"
                  :to="{
                    name: 'apps-proforma-preview-id',
                    params: { id: proforma.id },
                  }"
                  class="text-link"
                >
                  Proforma {{ proforma.number }}
                </RouterLink>
              </div>
              <span
                v-if="hasRevisions(item)"
                class="text-sm text-medium-emphasis"
              >
                Revisions: {{ getRevisionCount(item) }}
              </span>
            </div>
          </div>
        </template>

        <template #item.total="{ item }"
          >${{ item.total.toLocaleString() }}</template
        >

        <template #item.date="{ item }">
          {{ formatSystemDate(item.issuedDate) }}
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="resolveApprovalStatusDisplay(item).variant"
            label
            size="x-small"
            variant="tonal"
          >
            {{ resolveApprovalStatusDisplay(item).label }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <MoreBtn
            :menu-list="computedMoreList(item.id)"
            item-props
            color="undefined"
          />
        </template>

        <template #expanded-row="{ item, columns }">
          <tr
            v-if="getRevisions(item.id).length"
            class="v-data-table__tr expanded-row"
          >
            <td :colspan="columns.length">
              <div class="quotation-expanded-inner">
                <div class="quotation-expanded-header mb-2">
                  <h6 class="text-h6 mb-0">Revisions</h6>
                </div>

                <div class="d-flex flex-column gap-2">
                  <div
                    v-for="(revision, revisionIndex) in getRevisions(item.id)"
                    :key="revision.id"
                    class="quotation-revision-card"
                  >
                    <div class="quotation-revision-main">
                      <div class="d-flex flex-column">
                        <RouterLink
                          :to="{
                            name: 'apps-quotation-preview-id',
                            params: { id: revision.id },
                          }"
                          class="text-link font-weight-medium"
                        >
                          {{ getRevisionDisplayLabel(revision, revisionIndex) }}
                        </RouterLink>
                        <span class="text-sm text-medium-emphasis">
                          {{ revision.quoteNumber }}
                        </span>
                      </div>

                      <div class="text-sm">
                        {{ formatSystemDate(revision.issuedDate) }}
                      </div>

                      <div class="text-sm">
                        ${{ revision.total.toLocaleString() }}
                      </div>

                      <div>
                        <VChip
                          :color="
                            resolveApprovalStatusDisplay(revision).variant
                          "
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          {{ resolveApprovalStatusDisplay(revision).label }}
                        </VChip>
                      </div>

                      <div class="quotation-revision-actions">
                        <MoreBtn
                          :menu-list="revisionMenuList(revision.id)"
                          item-props
                          color="undefined"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalQuotations"
          />
        </template>
      </VDataTableServer>
    </VCard>
  </section>

  <section v-else>
    <VCard>
      <VCardTitle>No Quotation Found</VCardTitle>
    </VCard>
  </section>

  <VDialog v-model="isExternalQuotationDialogOpen" max-width="760">
    <DialogCloseBtn @click="isExternalQuotationDialogOpen = false" />
    <VCard class="pa-sm-6 pa-4">
      <VCardTitle class="text-h5 px-0 pt-0 pb-2">
        Import Quotation From Another System
      </VCardTitle>
      <VCardText class="text-body-1 text-medium-emphasis px-0 pt-0 pb-6">
        Add the external quotation details and upload the source attachment.
      </VCardText>

      <VForm
        ref="externalQuotationFormRef"
        v-model="isExternalQuotationFormValid"
        @submit.prevent="saveExternalQuotation"
      >
        <VRow>
          <VCol cols="12" md="6">
            <AppDateTimePicker
              v-model="externalQuotationForm.date"
              label="Date"
              placeholder="Select date"
              :rules="[requiredValidator]"
            />
          </VCol>

          <VCol cols="12" md="6">
            <AppTextField
              v-model="externalQuotationForm.quoteNumber"
              label="Quote #"
              placeholder="Enter quote number"
              :rules="[requiredValidator, uniqueQuotationNumberValidator]"
            />
          </VCol>

          <VCol cols="12" md="6">
            <AppTextField
              :model-value="externalQuotationForm.amount"
              label="Amount"
              placeholder="Total amount including VAT"
              type="number"
              min="0"
              step="0.01"
              :rules="[positiveAmountValidator]"
              @update:model-value="
                externalQuotationForm.amount = $event ? Number($event) : null
              "
            />
          </VCol>

          <VCol cols="12" md="6">
            <AppSelect
              :model-value="externalQuotationForm.linkedRecord"
              label="Deal or Contract"
              placeholder="Select deal or contract"
              :items="dealContractOptions"
              clearable
              clear-icon="tabler-x"
              @update:model-value="handleLinkedRecordChange"
            />
          </VCol>

          <VCol cols="12" md="6" class="quotation-form-field">
            <div class="quotation-form-control">
              <div class="quotation-form-label">Status</div>
              <AppSelect
                v-model="externalQuotationForm.status"
                placeholder="Select status"
                :rules="[requiredValidator]"
                :items="[
                  'Active',
                  'Sent',
                  'Approval',
                  'Lost',
                  'Canceled',
                  'Converted',
                ]"
              />
            </div>
          </VCol>

          <VCol cols="12" md="6" class="quotation-form-field">
            <div
              class="quotation-form-control quotation-form-control--attachment"
            >
              <div class="quotation-form-label">Attachment</div>
              <VFileInput
                v-model="externalQuotationForm.attachment"
                class="quotation-attachment-input"
                placeholder="Upload quotation file"
                :accept="attachmentAccept"
                :rules="[attachmentValidator]"
                show-size
                clearable
              />
            </div>
          </VCol>

          <VCol cols="12">
            <VAlert
              v-if="externalQuotationError"
              color="error"
              variant="tonal"
              border="start"
            >
              {{ externalQuotationError }}
            </VAlert>

            <VAlert
              v-else-if="externalQuotationSuccess"
              color="success"
              variant="tonal"
              border="start"
            >
              {{ externalQuotationSuccess }}
            </VAlert>
          </VCol>
        </VRow>
      </VForm>

      <VCardActions class="pt-6 px-0 flex-column align-stretch">
        <VAlert
          v-if="!hasLinkedDealOrContract"
          color="warning"
          variant="tonal"
          border="start"
          class="mb-4"
        >
          This quotation is not linked to a deal or contract.
        </VAlert>
        <DialogActionBar
          save-text="Save"
          cancel-text="Cancel"
          @save="saveExternalQuotation"
          @cancel="closeExternalQuotationDialog"
        />
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="quotationConversionDialogVisible" max-width="760">
    <DialogCloseBtn @click="closeQuotationConversionDialog" />
    <VCard>
      <VCardItem>
        <VCardTitle>Select Lines to Convert</VCardTitle>
        <VCardSubtitle>
          {{ pendingQuotationConversionRecord?.quotation.quoteNumber }}
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
                  <VChip size="x-small" label color="primary" variant="tonal">
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
                  v-model="selectedQuotationConversionPeriodKeys[option.key]"
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
          {{
            formatCurrencyAmount(
              selectedQuotationConversionTotal,
              configStore.financial,
            )
          }}
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

  <EmailDialog
    ref="emailDialogRef"
    v-model:is-dialog-visible="isSendQuotationDialogOpen"
    @close="closeQuotationEmailDialog"
    @send="onQuotationEmailSend"
  />

  <VDialog v-model="isDeleteQuotationDialogOpen" max-width="440" persistent>
    <DialogCloseBtn @click="isDeleteQuotationDialogOpen = false" />
    <VCard>
      <VCardText class="pt-6">
        {{ deleteDialogMessage }}
      </VCardText>

      <VCardActions class="pt-2 px-6 pb-6">
        <DialogActionBar
          save-text="Delete"
          save-color="error"
          save-variant="tonal"
          cancel-text="Cancel"
          @save="confirmDeleteQuotation"
          @cancel="closeDeleteQuotationDialog"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style lang="scss">
#quotation-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}

:deep(.v-data-table .expanded-row > td) {
  background: rgba(var(--v-theme-surface), 0.2);
}

.quotation-chevron-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 2rem;
  margin-inline-end: 0.5rem;
}

.quotation-chevron-placeholder {
  block-size: 2rem;
  inline-size: 2rem;
}

.quotation-chevron-btn {
  min-inline-size: 2rem;
}

.quotation-expanded-inner {
  padding-block: 12px 16px;
  padding-inline: 4.75rem 16px;
}

.conversion-line-description {
  white-space: pre-line;
}

.quotation-expanded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quotation-revision-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.75rem;
  background: rgba(var(--v-theme-surface), 0.32);
}

.quotation-revision-main {
  display: grid;
  align-items: center;
  gap: 1rem;
  grid-template-columns: minmax(0, 2fr) 140px 120px 180px 56px;
  padding-block: 1rem;
  padding-inline: 1.25rem;
}

.quotation-revision-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .quotation-revision-main {
    grid-template-columns: 1fr;
  }

  .quotation-expanded-inner {
    padding-inline-start: 1rem;
  }
}

.quotation-form-field {
  display: flex;
  align-items: flex-start;
}

.quotation-form-control {
  inline-size: 100%;
}

.quotation-form-label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  font-weight: 500;
  margin-block-end: 0.375rem;
}

.quotation-form-help {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  line-height: 1.25rem;
  margin-block-start: 0.375rem;
}

.quotation-form-control--attachment :deep(.v-field) {
  min-block-size: 56px;
}

.quotation-attachment-input :deep(.v-field__prepend-inner) {
  display: none;
}
</style>
