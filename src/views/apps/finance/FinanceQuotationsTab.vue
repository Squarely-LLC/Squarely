<script setup lang="ts">
import { emailValidator, requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
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
  contactName: string;
  contactEmail: string;
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

const contactsStore = useContactsStore();
contactsStore.init();
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
  { title: "Client", key: "client" },
  { title: "#", key: "id" },
  { title: "Total", key: "total" },
  { title: "Issued Date", key: "date" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const allQuotationRecords = computed(() => quotationsStore.all);
const allQuotations = computed(() =>
  allQuotationRecords.value
    .map((record) => record.quotation)
    .filter((quotation) => !quotation.parentQuotationId),
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
  const map = new Map<number, Quotation[]>();

  for (const record of allQuotationRecords.value) {
    const quotation = record.quotation;
    if (!quotation.parentQuotationId) continue;

    const existing = map.get(quotation.parentQuotationId) ?? [];
    existing.push(quotation);
    map.set(quotation.parentQuotationId, existing);
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

  const expectedStatus =
    convertedTo === "invoice"
      ? "Converted to Invoice"
      : "Converted to Proforma";

  const matchesSourceQuotation =
    sourceQuotation.quotationStatus === expectedStatus &&
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
    const matchesQuery =
      !query ||
      quotation.client.name.toLowerCase().includes(query) ||
      quotation.client.companyEmail.toLowerCase().includes(query) ||
      quotation.quoteNumber.toLowerCase().includes(query) ||
      quotation.service.toLowerCase().includes(query) ||
      String(quotation.id).includes(query);

    const matchesStatus =
      !selectedStatus.value ||
      quotation.quotationStatus === selectedStatus.value;

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
  (revisionMap.value.get(quotation.id) ?? []).length > 0;

const getRevisionCount = (quotation: Quotation) =>
  (revisionMap.value.get(quotation.id) ?? []).length;

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
  [...(revisionMap.value.get(Number(quotationId)) ?? [])].sort((a, b) => {
    const getRevisionOrder = (quotation: Quotation) => {
      const labelMatch = quotation.revisionLabel?.match(/R(\d+)$/i);
      if (labelMatch?.[1]) return Number(labelMatch[1]);

      const quoteMatch = quotation.quoteNumber.match(/-R(\d+)$/i);
      if (quoteMatch?.[1]) return Number(quoteMatch[1]);

      return quotation.id;
    };

    return getRevisionOrder(a) - getRevisionOrder(b);
  });

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
  contactName: "",
  contactEmail: "",
  status: "Pending",
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
const shouldAutoSelectContact = computed(
  () => selectedLinkedOption.value?.recordType === "deal",
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

const contactNameValidator = (value: unknown) => {
  if (shouldAutoSelectContact.value) return true;

  const email = externalQuotationForm.value.contactEmail.trim();
  if (!email) return true;

  return requiredValidator(value);
};

const contactEmailRules = computed(() => {
  const rules: Array<(value: unknown) => true | string> = [emailValidator];

  if (shouldAutoSelectContact.value) return rules;
  if (externalQuotationForm.value.contactName.trim())
    rules.unshift(requiredValidator);

  return rules;
});

const resolveStatusVariantAndIcon = (status: string) => {
  if (status === "Pending")
    return { variant: "warning", icon: "tabler-clock-hour-4" };
  if (status === "Approved")
    return { variant: "success", icon: "tabler-check" };
  if (status === "Lost") return { variant: "error", icon: "tabler-x" };
  if (status === "Converted to Invoice")
    return { variant: "primary", icon: "tabler-file-invoice" };
  if (status === "Converted to Proforma")
    return { variant: "info", icon: "tabler-file-dollar" };

  return { variant: "secondary", icon: "tabler-x" };
};

const resolveStatusLabel = (status: string) => {
  if (status === "Converted to Invoice") return "Invoice";
  if (status === "Converted to Proforma") return "Proforma";

  return status;
};

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

  const selectedOption =
    dealContractOptions.value.find((option) => option.value === linkedRecord) ||
    null;

  if (!selectedOption) {
    externalQuotationForm.value.contactName = "";
    externalQuotationForm.value.contactEmail = "";
    return;
  }

  if (selectedOption.recordType !== "deal") return;

  externalQuotationForm.value.contactName = selectedOption.contactName;
  externalQuotationForm.value.contactEmail = selectedOption.contactEmail;
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
          externalQuotationForm.value.contactName.trim() ||
          externalQuotationForm.value.contactEmail.trim() ||
          "",
        companyEmail: externalQuotationForm.value.contactEmail.trim(),
        country: "Lebanon",
        contact: "",
        name: externalQuotationForm.value.contactName.trim(),
      },
      service: "Imported quotation",
      total: Number(externalQuotationForm.value.amount),
      avatar: "",
      quotationStatus: externalQuotationForm.value.status ?? "Pending",
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

const convertQuotationToProforma = (quotationId: number) => {
  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord) return;

  if (quotationRecord.quotation.quotationStatus === "Converted to Proforma") {
    pushFinanceSuccess(
      `${quotationRecord.quotation.quoteNumber} is already converted to proforma.`,
    );
    return;
  }

  const created = proformasStore.addProforma({
    quotation: {
      issuedDate: quotationRecord.quotation.issuedDate,
      dueDate: quotationRecord.quotation.dueDate,
      client: quotationRecord.quotation.client,
      service: quotationRecord.quotation.service,
      total: quotationRecord.quotation.total,
      avatar: quotationRecord.quotation.avatar,
      quotationStatus: "Not Paid",
      balance: quotationRecord.quotation.total,
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
    purchasedProducts: quotationRecord.purchasedProducts,
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

  quotationsStore.updateQuotation(quotationId, {
    quotation: { quotationStatus: "Converted to Proforma" },
  });

  pushFinanceSuccess(
    `Converted ${quotationRecord.quotation.quoteNumber} to ${created?.quotation.quoteNumber || "a proforma"}.`,
  );
};

const convertQuotationToInvoice = (quotationId: number) => {
  const quotationRecord = quotationsStore.byId(quotationId);
  if (!quotationRecord) return;

  if (quotationRecord.quotation.quotationStatus === "Converted to Invoice") {
    pushFinanceSuccess(
      `${quotationRecord.quotation.quoteNumber} is already converted to invoice.`,
    );
    return;
  }

  const created = invoicesStore.addInvoice({
    quotation: {
      issuedDate: quotationRecord.quotation.issuedDate,
      dueDate: quotationRecord.quotation.dueDate,
      client: quotationRecord.quotation.client,
      service: quotationRecord.quotation.service,
      total: quotationRecord.quotation.total,
      avatar: quotationRecord.quotation.avatar,
      quotationStatus: "Not Paid",
      balance: quotationRecord.quotation.total,
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
    purchasedProducts: quotationRecord.purchasedProducts,
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

  quotationsStore.updateQuotation(quotationId, {
    quotation: { quotationStatus: "Converted to Invoice" },
  });

  pushFinanceSuccess(
    `Converted ${quotationRecord.quotation.quoteNumber} to ${created?.quotation.quoteNumber || "an invoice"}.`,
  );
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
    ...(() => {
      const quotationRecord = quotationsStore.byId(paramId);
      const quotationStatus =
        quotationRecord?.quotation.quotationStatus ?? null;

      return [
        {
          title: "Edit",
          value: "edit",
          prependIcon: "tabler-pencil",
          to: { name: "apps-quotation-edit-id", params: { id: paramId } },
        },
        {
          title: "Revise",
          value: "revise",
          prependIcon: "tabler-refresh",
          onClick: () => openRevisionDraft(paramId),
        },
        {
          title: "Convert to Proforma",
          value: "convert-to-proforma",
          prependIcon: "tabler-file-dollar",
          disabled: quotationStatus === "Converted to Proforma",
          onClick: () => convertQuotationToProforma(paramId),
        },
        {
          title: "Convert to Tax invoice",
          value: "convert-to-tax-invoice",
          prependIcon: "tabler-file-invoice",
          disabled: quotationStatus === "Converted to Invoice",
          onClick: () => convertQuotationToInvoice(paramId),
        },
      ];
    })(),
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
                'Pending',
                'Approved',
                'Lost',
                'Converted to Invoice',
                'Converted to Proforma',
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
                :to="{ name: 'apps-quotation-add' }"
                prepend-icon="tabler-building-estate"
              >
                From Squarely
              </VListItem>
              <VListItem
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
            :color="resolveStatusVariantAndIcon(item.quotationStatus).variant"
            label
            size="x-small"
            variant="tonal"
          >
            {{ resolveStatusLabel(item.quotationStatus) }}
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
                            resolveStatusVariantAndIcon(
                              revision.quotationStatus,
                            ).variant
                          "
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          {{ resolveStatusLabel(revision.quotationStatus) }}
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
    <VCard class="pa-sm-6 pa-4">
      <VCardTitle class="text-h5 pb-2">
        Import Quotation From Another System
      </VCardTitle>
      <VCardText class="text-body-1 text-medium-emphasis pb-6">
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

          <VCol cols="12">
            <VAlert
              v-if="!hasLinkedDealOrContract"
              color="warning"
              variant="tonal"
              border="start"
            >
              This quotation is not linked to a deal or contract.
            </VAlert>
          </VCol>

          <VCol cols="12" md="6">
            <AppTextField
              v-model="externalQuotationForm.contactName"
              label="Contact"
              :placeholder="
                shouldAutoSelectContact
                  ? 'Auto-selected from linked deal'
                  : 'Enter contact name'
              "
              :readonly="shouldAutoSelectContact"
              :rules="[contactNameValidator]"
            />
          </VCol>

          <VCol cols="12" md="6">
            <AppTextField
              v-model="externalQuotationForm.contactEmail"
              label="Contact Email"
              :placeholder="
                shouldAutoSelectContact
                  ? 'Auto-selected from linked deal'
                  : 'Enter contact email'
              "
              :readonly="shouldAutoSelectContact"
              :rules="contactEmailRules"
            />
          </VCol>

          <VCol cols="12">
            <VAlert
              v-if="shouldAutoSelectContact"
              color="info"
              variant="tonal"
              border="start"
            >
              Contact information was auto-selected from the linked deal and
              cannot be edited.
            </VAlert>
          </VCol>

          <VCol cols="12" md="6" class="quotation-form-field">
            <div class="quotation-form-control">
              <div class="quotation-form-label">Status</div>
              <AppSelect
                v-model="externalQuotationForm.status"
                placeholder="Select status"
                :rules="[requiredValidator]"
                :items="[
                  'Pending',
                  'Approved',
                  'Lost',
                  'Converted to Invoice',
                  'Converted to Proforma',
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
              <div class="quotation-form-help">
                Maximum file size: 10MB. Allowed types: PDF, DOC, DOCX, XLS,
                XLSX, PNG, JPG.
              </div>
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

      <VCardActions class="pt-6 px-0">
        <DialogActionBar
          save-text="Save Import"
          cancel-text="Cancel"
          @save="saveExternalQuotation"
          @cancel="closeExternalQuotationDialog"
        />
      </VCardActions>
    </VCard>
  </VDialog>

  <EmailDialog
    ref="emailDialogRef"
    v-model:is-dialog-visible="isSendQuotationDialogOpen"
    @close="closeQuotationEmailDialog"
    @send="onQuotationEmailSend"
  />

  <VDialog v-model="isDeleteQuotationDialogOpen" max-width="440" persistent>
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
