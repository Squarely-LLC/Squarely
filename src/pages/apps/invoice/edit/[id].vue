<script lang="ts" setup>
import { requiredValidator, urlValidator } from "@/@core/utils/validators";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import {
  applyInvoicePayment,
  cloneInvoiceRecord,
  getInvoiceOutstandingBalance,
  useInvoicesStore,
  type InvoicePaymentInput,
} from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useReceiptsStore } from "@/stores/receipts";
import {
  FINANCE_APPROVAL_PAYMENT_MESSAGE,
  canRecordInvoicePayment,
} from "@/utils/financeApproval";
import { getFileObjectUrl, getFileRecord, saveFile } from "@/utils/fileStore";
import {
  clearInvoicePreviewDraft,
  loadInvoicePreviewDraft,
  saveInvoicePreviewDraft,
} from "@/utils/invoicePreviewDraft";
import {
  buildQuotationPaymentDetails,
  formatCurrencyAmount,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
} from "@/utils/quotationConfig";
import { createQuotationPdfFile } from "@/utils/quotationPdf";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";
import { openWhatsAppIntent } from "@/utils/shareToWhatsApp";
import { shareWithSystem } from "@/utils/shareWithSystem";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import InvoiceAddPaymentDrawer from "@/views/apps/invoice/InvoiceAddPaymentDrawer.vue";
import InvoiceEditable from "@/views/apps/invoice/InvoiceEditable.vue";
import type { InvoiceData, PurchasedProduct } from "@/views/apps/invoice/types";

const route = useRoute("apps-invoice-edit-id");
const router = useRouter();
const configStore = useConfigStore();
configStore.init();
const employeesStore = useEmployeesStore();
employeesStore.init();
const notifications = useNotificationsStore();
const invoicesStore = useInvoicesStore();
const receiptsStore = useReceiptsStore();
invoicesStore.init();
receiptsStore.init();

const previewDraft = loadInvoicePreviewDraft();
const sourceRecord =
  previewDraft?.source === "edit" &&
  String(previewDraft.quotation.quotation.id) === String(route.params.id)
    ? previewDraft.quotation
    : invoicesStore.byId(route.params.id);
const quotationData = ref<InvoiceData | null>(
  sourceRecord ? cloneInvoiceRecord(sourceRecord) : null,
);
const isExternalQuotation = computed(
  () => quotationData.value?.quotation.source === "external",
);
const selectedExternalAttachment = ref<File | null>(null);
const externalEditError = ref("");
const externalStatusOptions = ["Not Paid", "Partially Paid", "Paid"];
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
const allowedAttachmentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];
const maxAttachmentSizeBytes = 10 * 1024 * 1024;

const addProduct = (value: PurchasedProduct) => {
  quotationData.value?.purchasedProducts.push(value);
};

const removeProduct = (id: number) => {
  quotationData.value?.purchasedProducts.splice(id, 1);
};

const isAddPaymentSidebarActive = ref(false);
const isEmailDialogVisible = ref(false);
const emailDialogRef = ref<any | null>(null);
const previewActionFrame = ref<HTMLIFrameElement | null>(null);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];
const approvalModes = ["Automatic", "Request Approval"] as const;
const creditCardPaymentLinkError = ref<string | null>(null);
const approvalError = ref<string | null>(null);
const dealOptions = computed(() => {
  const options = new Map<number, { title: string; value: number }>();

  for (const record of invoicesStore.all) {
    const quotation = record.quotation;
    if (!quotation.dealId) continue;

    options.set(quotation.dealId, {
      title: `Deal ${quotation.dealId} - ${quotation.client.name}`,
      value: quotation.dealId,
    });
  }

  return Array.from(options.values());
});
const employeeOptions = computed(() =>
  employeesStore.all.map((employee) => ({
    title: employee.fullName,
    value: employee.id,
  })),
);
const companyAddressLines = computed(() =>
  getQuotationCompanyAddressLines(configStore.legal),
);
const companyContactLines = computed(() =>
  getQuotationCompanyContactLines(configStore.legal),
);
const externalAttachmentName = computed(
  () =>
    selectedExternalAttachment.value?.name ||
    quotationData.value?.quotation.attachmentName ||
    "",
);
const externalAttachmentExtension = computed(() => {
  const match = externalAttachmentName.value
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
});
const externalAttachmentPreviewUrl = ref("");
const externalAttachmentPreviewMimeType = ref("");
const isImageExternalAttachment = computed(
  () =>
    externalAttachmentPreviewMimeType.value.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
      externalAttachmentExtension.value,
    ),
);
const isPdfExternalAttachment = computed(
  () =>
    externalAttachmentPreviewMimeType.value === "application/pdf" ||
    externalAttachmentExtension.value === "pdf",
);
const currentQuotationBalance = computed(() =>
  quotationData.value ? getInvoiceOutstandingBalance(quotationData.value) : 0,
);

const revokeExternalAttachmentPreview = () => {
  if (externalAttachmentPreviewUrl.value) {
    URL.revokeObjectURL(externalAttachmentPreviewUrl.value);
    externalAttachmentPreviewUrl.value = "";
  }

  externalAttachmentPreviewMimeType.value = "";
};

watch(
  () =>
    [
      selectedExternalAttachment.value,
      quotationData.value?.quotation.attachmentFileKey,
    ] as const,
  async ([selectedFile, attachmentFileKey]) => {
    revokeExternalAttachmentPreview();

    if (selectedFile) {
      externalAttachmentPreviewUrl.value = URL.createObjectURL(selectedFile);
      externalAttachmentPreviewMimeType.value = selectedFile.type || "";
      return;
    }

    if (!attachmentFileKey) return;

    const [objectUrl, record] = await Promise.all([
      getFileObjectUrl(attachmentFileKey).catch(() => null),
      getFileRecord(attachmentFileKey).catch(() => null),
    ]);

    if (!objectUrl && !record) return;

    externalAttachmentPreviewUrl.value = objectUrl || "";
    externalAttachmentPreviewMimeType.value = record?.blob.type || "";
  },
  { immediate: true },
);

const validateExternalAttachment = (
  file = selectedExternalAttachment.value,
) => {
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
  const currentQuotation = quotationData.value;
  if (!currentQuotation) return;

  externalEditError.value = "";

  const quoteNumber = currentQuotation.quotation.quoteNumber.trim();
  const issuedDate = currentQuotation.quotation.issuedDate?.trim();
  const dueDate = currentQuotation.quotation.dueDate?.trim() || issuedDate;
  const contactName = currentQuotation.quotation.client.name.trim();
  const contactEmail = currentQuotation.quotation.client.companyEmail.trim();
  const amount = Number(currentQuotation.quotation.total);

  if (!quoteNumber || !issuedDate || !dueDate || !Number.isFinite(amount)) {
    externalEditError.value =
      "Quote number, issue date, due date, and amount are required.";
    return;
  }

  const attachmentValidationError = validateExternalAttachment();
  if (attachmentValidationError) {
    externalEditError.value = attachmentValidationError;
    return;
  }

  const updatedQuotation = cloneInvoiceRecord(currentQuotation);
  const attachmentFile = selectedExternalAttachment.value;

  if (attachmentFile) {
    try {
      updatedQuotation.quotation.attachmentFileKey =
        await saveFile(attachmentFile);
      updatedQuotation.quotation.attachmentName = attachmentFile.name;
    } catch {
      externalEditError.value =
        "Attachment could not be saved locally for preview.";
      return;
    }
  }

  updatedQuotation.quotation.quoteNumber = quoteNumber;
  updatedQuotation.quotation.issuedDate = issuedDate;
  updatedQuotation.quotation.dueDate = dueDate;
  updatedQuotation.quotation.total = amount;
  updatedQuotation.quotation.client.name = contactName;
  updatedQuotation.quotation.client.companyEmail = contactEmail;
  updatedQuotation.quotation.client.company =
    contactName || contactEmail || updatedQuotation.quotation.client.company;
  updatedQuotation.quotation.service = "Imported invoice";
  updatedQuotation.quotation.linkedRecordType = updatedQuotation.quotation
    .dealId
    ? "deal"
    : null;
  updatedQuotation.quotation.source = "external";
  updatedQuotation.purchasedProducts = [
    {
      title: "Imported invoice amount",
      cost: amount,
      hours: 1,
      description: "Imported from another system.",
    },
  ];
  updatedQuotation.paymentDetails = buildQuotationPaymentDetails(
    amount,
    configStore.legal,
    configStore.financial,
  );
  updatedQuotation.note = updatedQuotation.quotation.dealId
    ? "Imported invoice linked to an existing record."
    : "Imported invoice without linked deal or contract.";
  updatedQuotation.quotation.balance =
    getInvoiceOutstandingBalance(updatedQuotation);
  updatedQuotation.paymentDetails.totalDue = formatCurrencyAmount(
    updatedQuotation.quotation.balance,
    configStore.financial,
  );

  const savedQuotation = invoicesStore.updateInvoice(
    updatedQuotation.quotation.id,
    updatedQuotation,
  );
  if (!savedQuotation) return;

  selectedExternalAttachment.value = null;
  notifications.push(
    `Invoice ${savedQuotation.quotation.quoteNumber} updated successfully.`,
    "success",
    3500,
  );
  clearInvoicePreviewDraft();
  await router.push({
    name: "apps-invoice-preview-id",
    params: { id: savedQuotation.quotation.id },
  });
};

const quotationEmailDraft = computed(() => {
  const currentQuotation = quotationData.value?.quotation;
  const companyName = configStore.legal?.companyName?.trim() || "Squarely";
  const to = currentQuotation?.client.companyEmail?.trim() || "";
  const clientName = currentQuotation?.client.name?.trim() || "there";
  const quoteNumber = currentQuotation?.quoteNumber?.trim() || "quotation";
  const total = formatCurrencyAmount(
    currentQuotation?.total,
    configStore.financial,
  );
  const expiryDate = currentQuotation?.dueDate?.trim() || "";

  return {
    to,
    subject: `Invoice ${quoteNumber} from ${companyName}`,
    message: `Dear ${clientName},

Please find invoice ${quoteNumber} attached.

Invoice amount: ${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName}`.trim(),
    attachments: [
      {
        name: quoteNumber ? `${quoteNumber}.pdf` : "Invoice Attached",
      },
    ],
  };
});

const buildPreviewQuotationDraft = () => {
  if (!quotationData.value) return null;
  if (!validateCreditCardPaymentLink()) return null;
  if (!validateApprovalSelection()) return null;

  const previewQuotation = cloneInvoiceRecord(quotationData.value);
  const total = getQuotationGrandTotal(previewQuotation.purchasedProducts);

  previewQuotation.quotation.total = total;
  previewQuotation.paymentDetails = buildQuotationPaymentDetails(
    total,
    configStore.legal,
    configStore.financial,
  );
  previewQuotation.paymentDetails.totalDue =
    quotationData.value?.paymentDetails.totalDue ||
    previewQuotation.paymentDetails.totalDue;
  previewQuotation.paymentLink =
    previewQuotation.paymentMethod === "Credit Card"
      ? previewQuotation.paymentLink?.trim() || null
      : null;
  previewQuotation.quotation.linkedRecordType = previewQuotation.quotation
    .dealId
    ? "deal"
    : null;
  previewQuotation.approverEmployeeId =
    previewQuotation.approvalMode === "Request Approval"
      ? (previewQuotation.approverEmployeeId ?? null)
      : null;
  previewQuotation.quotation.balance =
    getInvoiceOutstandingBalance(previewQuotation);
  previewQuotation.paymentDetails.totalDue = formatCurrencyAmount(
    previewQuotation.quotation.balance,
    configStore.financial,
  );

  return previewQuotation;
};

const recordQuotationPayment = (payment: InvoicePaymentInput) => {
  if (!quotationData.value) return;
  if (!canRecordInvoicePayment(quotationData.value)) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  quotationData.value = applyInvoicePayment(quotationData.value, payment);
  notifications.push(
    `Payment of ${formatCurrencyAmount(payment.amount, configStore.financial)} added successfully.`,
    "success",
    3500,
  );
};

const openAddPaymentDrawer = () => {
  if (!quotationData.value) return;
  if (!canRecordInvoicePayment(quotationData.value)) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  isAddPaymentSidebarActive.value = true;
};

const createDraftQuotationPdfFile = (previewQuotation: InvoiceData) =>
  createQuotationPdfFile({
    quotationRecord: previewQuotation,
    companyName: configStore.legal?.companyName?.trim() || "Squarely",
    companyAddressLines: companyAddressLines.value,
    companyContactLines: companyContactLines.value,
    documentLabel: "Invoice",
    recipientLabel: "Invoice To",
  });

const ensurePreviewActionFrame = () => {
  if (previewActionFrame.value) return previewActionFrame.value;

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

  return iframe;
};

const triggerDraftPreviewAction = (action: "print" | "download") => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveInvoicePreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const iframe = ensurePreviewActionFrame();
  const routeLocation = router.resolve({
    name: "apps-invoice-preview-id",
    params: { id: previewQuotation.quotation.id },
    query: {
      draft: "1",
      source: "edit",
      [action]: "1",
      trigger: `${Date.now()}`,
    },
  });

  iframe.src = routeLocation.href;
};

const openQuotationEmailDialog = () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveInvoicePreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });
  isEmailDialogVisible.value = true;

  nextTick(() => {
    emailDialogRef.value?.openWith?.(quotationEmailDraft.value);
  });
};

const shareQuotationOnWhatsApp = async () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveInvoicePreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const routeLocation = router.resolve({
    name: "apps-invoice-preview-id",
    params: { id: previewQuotation.quotation.id },
    query: { draft: "1", source: "edit" },
  });

  await openWhatsAppIntent({
    url: `${window.location.origin}${routeLocation.href}`,
    text: `Invoice ${previewQuotation.quotation.quoteNumber} for ${previewQuotation.quotation.client.name}`,
  });
};

const shareQuotationWithOthers = async () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveInvoicePreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const pdfFile = createDraftQuotationPdfFile(previewQuotation);

  await shareWithSystem({
    file: pdfFile,
    title: pdfFile.name,
    text: `Invoice ${previewQuotation.quotation.quoteNumber} for ${previewQuotation.quotation.client.name}`,
  });
};

watch(
  () => quotationData.value?.paymentMethod,
  (paymentMethod) => {
    if (quotationData.value && paymentMethod !== "Credit Card") {
      quotationData.value.paymentLink = null;
      creditCardPaymentLinkError.value = null;
    }
  },
);

watch(
  () => quotationData.value?.approvalMode,
  (approvalMode) => {
    if (quotationData.value && approvalMode !== "Request Approval") {
      quotationData.value.approverEmployeeId = null;
      approvalError.value = null;
    }
  },
);

watch(
  () => quotationData.value?.paymentLink,
  (paymentLink) => {
    if (
      !quotationData.value ||
      quotationData.value.paymentMethod !== "Credit Card"
    ) {
      creditCardPaymentLinkError.value = null;
      return;
    }

    const requiredResult = requiredValidator(paymentLink);
    if (requiredResult !== true) {
      creditCardPaymentLinkError.value = String(requiredResult);
      return;
    }

    const urlResult = urlValidator(paymentLink);
    creditCardPaymentLinkError.value =
      urlResult === true ? null : String(urlResult);
  },
);

const validateCreditCardPaymentLink = () => {
  if (
    !quotationData.value ||
    quotationData.value.paymentMethod !== "Credit Card"
  ) {
    creditCardPaymentLinkError.value = null;
    return true;
  }

  const requiredResult = requiredValidator(quotationData.value.paymentLink);
  if (requiredResult !== true) {
    creditCardPaymentLinkError.value = String(requiredResult);
    return false;
  }

  const urlResult = urlValidator(quotationData.value.paymentLink);
  if (urlResult !== true) {
    creditCardPaymentLinkError.value = String(urlResult);
    return false;
  }

  creditCardPaymentLinkError.value = null;
  return true;
};

const validateApprovalSelection = () => {
  if (
    !quotationData.value ||
    quotationData.value.approvalMode !== "Request Approval"
  ) {
    approvalError.value = null;
    return true;
  }

  if (
    quotationData.value.approverEmployeeId === null ||
    quotationData.value.approverEmployeeId === undefined ||
    quotationData.value.approverEmployeeId === ""
  ) {
    approvalError.value = "Please select an approver";
    return false;
  }

  approvalError.value = null;
  return true;
};

const saveQuotation = () => {
  if (!quotationData.value) return;
  if (!validateCreditCardPaymentLink()) return;
  if (!validateApprovalSelection()) return;

  const total = getQuotationGrandTotal(quotationData.value.purchasedProducts);

  quotationData.value.quotation.total = total;
  quotationData.value.paymentDetails = buildQuotationPaymentDetails(
    total,
    configStore.legal,
    configStore.financial,
  );
  quotationData.value.quotation.balance = getInvoiceOutstandingBalance(
    quotationData.value,
  );
  quotationData.value.paymentDetails.totalDue = formatCurrencyAmount(
    quotationData.value.quotation.balance,
    configStore.financial,
  );
  quotationData.value.paymentLink =
    quotationData.value.paymentMethod === "Credit Card"
      ? quotationData.value.paymentLink?.trim() || null
      : null;
  quotationData.value.quotation.linkedRecordType = quotationData.value.quotation
    .dealId
    ? "deal"
    : null;
  quotationData.value.approverEmployeeId =
    quotationData.value.approvalMode === "Request Approval"
      ? (quotationData.value.approverEmployeeId ?? null)
      : null;
  const originalPaymentIds = new Set(
    (sourceRecord?.payments ?? []).map((payment) => payment.id),
  );
  const hasNewPayments = quotationData.value.payments.some(
    (payment) => !originalPaymentIds.has(payment.id),
  );

  if (hasNewPayments && !canRecordInvoicePayment(quotationData.value)) {
    notifications.push(FINANCE_APPROVAL_PAYMENT_MESSAGE, "warning", 3500);
    return;
  }

  const updatedQuotation = invoicesStore.updateInvoice(
    quotationData.value.quotation.id,
    cloneInvoiceRecord(quotationData.value),
  );
  if (!updatedQuotation) return;

  updatedQuotation.payments
    .filter((payment) => !originalPaymentIds.has(payment.id))
    .forEach((payment) => {
      receiptsStore.addReceiptFromLinkedPayment({
        documentType: "invoice",
        documentId: updatedQuotation.quotation.id,
        documentNumber: updatedQuotation.quotation.quoteNumber,
        client: updatedQuotation.quotation.client,
        avatar: updatedQuotation.quotation.avatar,
        payment,
      });
    });

  notifications.push(
    `Invoice ${updatedQuotation.quotation.quoteNumber} updated successfully.`,
    "success",
    3500,
  );

  clearInvoicePreviewDraft();
  router.push({
    name: "apps-invoice-preview-id",
    params: { id: quotationData.value.quotation.id },
  });
};

const openPreview = async () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveInvoicePreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  await router.push({
    name: "apps-invoice-preview-id",
    params: { id: previewQuotation.quotation.id },
    query: { draft: "1", source: "edit" },
  });
};

onBeforeUnmount(() => {
  revokeExternalAttachmentPreview();
  if (previewActionFrame.value?.parentNode) {
    previewActionFrame.value.parentNode.removeChild(previewActionFrame.value);
  }

  previewActionFrame.value = null;
});
</script>

<template>
  <VRow v-if="quotationData?.quotation && isExternalQuotation">
    <VCol cols="12" md="8">
      <VCard>
        <VCardItem>
          <VCardTitle>Edit Imported Invoice</VCardTitle>
          <VCardSubtitle>
            Update the imported file and basic document fields without using the
            full Squarely builder.
          </VCardSubtitle>
        </VCardItem>

        <VCardText>
          <VAlert
            v-if="externalEditError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ externalEditError }}
          </VAlert>

          <VRow>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.quoteNumber"
                label="Invoice Number"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="quotationData.quotation.quotationStatus"
                :items="externalStatusOptions"
                label="Status"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.issuedDate"
                type="date"
                label="Issued Date"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.dueDate"
                type="date"
                label="Due Date"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.client.name"
                label="Contact Name"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.client.companyEmail"
                label="Contact Email"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="quotationData.quotation.total"
                type="number"
                label="Amount"
                min="0"
                step="0.01"
              />
            </VCol>
            <VCol cols="12" md="6">
              <AppSelect
                v-model="quotationData.quotation.dealId"
                :items="dealOptions"
                label="Deal"
                clearable
              />
            </VCol>
            <VCol cols="12">
              <VFileInput
                v-model="selectedExternalAttachment"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                label="Replace Uploaded File"
                prepend-icon="tabler-paperclip"
                show-size
              />
            </VCol>
            <VCol cols="12">
              <VAlert type="info" variant="tonal">
                Current attachment:
                {{ externalAttachmentName || "No attachment uploaded" }}
              </VAlert>
            </VCol>

            <VCol cols="12" v-if="externalAttachmentPreviewUrl">
              <VCard variant="tonal" color="info">
                <VCardItem>
                  <VCardTitle>Attachment Preview</VCardTitle>
                </VCardItem>

                <VCardText>
                  <img
                    v-if="isImageExternalAttachment"
                    :src="externalAttachmentPreviewUrl"
                    :alt="
                      externalAttachmentName ||
                      quotationData.quotation.quoteNumber
                    "
                    class="external-attachment-preview"
                  />

                  <iframe
                    v-else-if="isPdfExternalAttachment"
                    :src="externalAttachmentPreviewUrl"
                    class="external-attachment-preview external-attachment-preview--pdf"
                    title="Attachment preview"
                  />

                  <div v-else class="text-body-2 text-medium-emphasis">
                    This file type does not support inline preview here. Save
                    and open the preview page to download or share the full
                    file.
                  </div>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VCol>
    <VCol cols="12" md="4">
      <VCard>
        <VCardText>
          <VBtn
            block
            color="secondary"
            variant="tonal"
            class="mb-4"
            :to="{
              name: 'apps-invoice-preview-id',
              params: { id: quotationData.quotation.id },
            }"
          >
            Preview Saved Version
          </VBtn>
          <VBtn block @click="saveExternalQuotation">Save Changes</VBtn>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <VRow v-else-if="quotationData?.quotation">
    <VCol cols="12" md="9">
      <InvoiceEditable
        :data="quotationData"
        document-label="Invoice"
        @push="addProduct"
        @remove="removeProduct"
      />
    </VCol>

    <VCol cols="12" md="3">
      <VCard class="mb-8">
        <VCardText>
          <div class="quotation-action-row mb-4">
            <VTooltip text="Email" location="top">
              <template #activator="{ props: tooltipProps }">
                <VBtn
                  v-bind="tooltipProps"
                  variant="tonal"
                  color="secondary"
                  class="quotation-action-btn"
                  @click="openQuotationEmailDialog"
                >
                  <VIcon icon="tabler-mail" />
                </VBtn>
              </template>
            </VTooltip>

            <VTooltip text="Download PDF" location="top">
              <template #activator="{ props: tooltipProps }">
                <VBtn
                  v-bind="tooltipProps"
                  variant="tonal"
                  color="secondary"
                  class="quotation-action-btn"
                  @click="triggerDraftPreviewAction('download')"
                >
                  <VIcon icon="tabler-download" />
                </VBtn>
              </template>
            </VTooltip>

            <VTooltip text="Share on WhatsApp" location="top">
              <template #activator="{ props: tooltipProps }">
                <VBtn
                  v-bind="tooltipProps"
                  variant="tonal"
                  color="secondary"
                  class="quotation-action-btn"
                  @click="shareQuotationOnWhatsApp"
                >
                  <VIcon icon="tabler-brand-whatsapp" />
                </VBtn>
              </template>
            </VTooltip>

            <VTooltip text="Others" location="top">
              <template #activator="{ props: tooltipProps }">
                <VBtn
                  v-bind="tooltipProps"
                  variant="tonal"
                  color="secondary"
                  class="quotation-action-btn"
                  @click="shareQuotationWithOthers"
                >
                  <VIcon icon="tabler-dots" />
                </VBtn>
              </template>
            </VTooltip>

            <VTooltip text="Print" location="top">
              <template #activator="{ props: tooltipProps }">
                <VBtn
                  v-bind="tooltipProps"
                  variant="tonal"
                  color="secondary"
                  class="quotation-action-btn"
                  @click="triggerDraftPreviewAction('print')"
                >
                  <VIcon icon="tabler-printer" />
                </VBtn>
              </template>
            </VTooltip>
          </div>

          <div class="d-flex flex-wrap gap-4">
            <VBtn
              color="secondary"
              variant="tonal"
              class="flex-grow-1"
              @click="openPreview"
            >
              Preview
            </VBtn>

            <VBtn class="mb-4 flex-grow-1" @click="saveQuotation">Save</VBtn>
          </div>

          <VBtn
            block
            color="success"
            prepend-icon="tabler-currency-dollar"
            @click="openAddPaymentDrawer"
          >
            Add Receipt
          </VBtn>
        </VCardText>
      </VCard>

      <AppSelect
        id="payment-method"
        v-model="quotationData.paymentMethod"
        :items="paymentMethods"
        label="Accept Payment Via"
        class="mb-4"
      />

      <AppTextField
        id="total-fx"
        v-model="quotationData.totalFx"
        label="Total FX"
        placeholder="Enter total FX"
        class="mb-4"
      />

      <AppTextField
        v-if="quotationData.paymentMethod === 'Credit Card'"
        id="payment-link"
        v-model="quotationData.paymentLink"
        label="Credit Card Payment Link"
        placeholder="https://"
        :rules="[requiredValidator, urlValidator]"
        :error-messages="
          creditCardPaymentLinkError ? [creditCardPaymentLinkError] : []
        "
        class="mb-4"
      />

      <div class="d-flex align-center justify-space-between">
        <VLabel for="terms-and-notes">Terms and Notes</VLabel>
        <div>
          <VSwitch
            id="terms-and-notes"
            v-model="quotationData.showClientNote"
          />
        </div>
      </div>

      <AppSelect
        id="deal-id"
        v-model="quotationData.quotation.dealId"
        :items="dealOptions"
        label="Deal"
        placeholder="Select deal"
        clearable
        class="mt-4"
      />

      <AppSelect
        id="approval-mode"
        v-model="quotationData.approvalMode"
        :items="approvalModes"
        label="Approval"
        class="mt-4"
      />

      <AppSelect
        v-if="quotationData.approvalMode === 'Request Approval'"
        id="approver-employee"
        v-model="quotationData.approverEmployeeId"
        :items="employeeOptions"
        label="Approver"
        placeholder="Select employee"
        :error-messages="approvalError ? [approvalError] : []"
        class="mt-4"
      />
    </VCol>

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogVisible"
    />
    <InvoiceAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarActive"
      :current-balance="currentQuotationBalance"
      :default-payment-method="quotationData?.paymentMethod"
      document-label="Invoice"
      @submit="recordQuotationPayment"
    />
  </VRow>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Invoice with ID {{ route.params.id }} not found!
    </VAlert>
  </section>
</template>

<style scoped>
.quotation-action-btn {
  padding: 0;
  block-size: 44px;
  inline-size: 100%;
  min-inline-size: 0;
}

.quotation-action-row {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.external-attachment-preview {
  display: block;
  border-radius: 8px;
  inline-size: 100%;
  max-block-size: 32rem;
  object-fit: contain;
}

.external-attachment-preview--pdf {
  min-block-size: 32rem;
}
</style>
