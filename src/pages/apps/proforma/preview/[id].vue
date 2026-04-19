<script setup lang="ts">
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import {
  applyProformaPayment,
  getProformaOutstandingBalance,
  useProformasStore,
  type ProformaPaymentInput,
} from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { createPdfFileFromElement } from "@/utils/domPdf";
import { getFileObjectUrl, getFileRecord } from "@/utils/fileStore";
import {
  loadProformaPreviewDraft,
  saveProformaPreviewDraft,
} from "@/utils/proformaPreviewDraft";
import {
  buildQuotationPaymentDetails,
  formatCurrencyAmount,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
  getVatSummary,
  resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import { createQuotationPdfFile } from "@/utils/quotationPdf";
import {
  getLineTotal,
  getQuotationDiscountTotal,
  getQuotationGrandTotal,
  getQuotationSubtotal,
} from "@/utils/quotationPricing";
import { normalizeRichText } from "@/utils/richText";
import { openWhatsAppIntent, shareToWhatsApp } from "@/utils/shareToWhatsApp";
import { shareWithSystem } from "@/utils/shareWithSystem";
import { formatSystemDate } from "@core/utils/formatters";

import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import ProformaAddPaymentDrawer from "@/views/apps/proforma/ProformaAddPaymentDrawer.vue";
import type { ProformaRecord } from "@db/apps/proforma/types";

const route = useRoute("apps-proforma-preview-id");
const isEmbeddedActionFrame = route.query.embedded === "1";
const configStore = useConfigStore();
const notifications = useNotificationsStore();
const proformasStore = useProformasStore();
const receiptsStore = useReceiptsStore();

if (!isEmbeddedActionFrame) {
  configStore.init();
  proformasStore.init();
  receiptsStore.init();
}

type EmbeddedPreviewPayload = {
  action: "print" | "download";
  quotation: ProformaRecord;
  legal: AppConfigurations["legal"];
  financial: AppConfigurations["financial"];
};

const embeddedPreviewPayload = ref<EmbeddedPreviewPayload | null>(null);
const draftPreviewState = ref(loadProformaPreviewDraft());

const draftPreview = computed(() => {
  if (isEmbeddedActionFrame) return null;
  if (route.query.draft !== "1") return null;

  const previewDraft = draftPreviewState.value;
  if (!previewDraft) return null;
  if (String(previewDraft.quotation.quotation.id) !== String(route.params.id)) {
    return null;
  }

  return previewDraft;
});
const quotationRecord = computed(
  () =>
    embeddedPreviewPayload.value?.quotation ??
    draftPreview.value?.quotation ??
    proformasStore.byId(route.params.id),
);
const canReturnToEditor = computed(() => Boolean(draftPreview.value));
const editRoute = computed(() => {
  if (draftPreview.value?.source === "add") {
    return {
      name: "apps-proforma-add" as const,
      query: { restoreDraft: "1" },
    };
  }

  return {
    name: "apps-proforma-edit-id" as const,
    params: { id: route.params.id },
  };
});
const quotation = computed(() => quotationRecord.value?.quotation ?? null);
const legalConfiguration = computed(
  () => embeddedPreviewPayload.value?.legal ?? configStore.legal,
);
const financialConfiguration = computed(
  () => embeddedPreviewPayload.value?.financial ?? configStore.financial,
);
const paymentMethod = computed(
  () => quotationRecord.value?.paymentMethod || "Bank Transfer",
);
const creditCardPaymentLink = computed(
  () => quotationRecord.value?.paymentLink?.trim() || "",
);
const showClientCompany = computed(() => {
  const clientName = quotation.value?.client.name.trim() || "";
  const clientCompany = quotation.value?.client.company.trim() || "";

  return Boolean(clientCompany) && clientCompany !== clientName;
});
const paymentDetails = computed(() => {
  if (!quotationRecord.value) return null;

  return {
    ...buildQuotationPaymentDetails(
      quotationRecord.value.quotation.total,
      legalConfiguration.value,
      financialConfiguration.value,
    ),
    ...quotationRecord.value.paymentDetails,
  };
});
const purchasedProducts = computed(
  () => quotationRecord.value?.purchasedProducts ?? [],
);
const isExternalDocument = computed(
  () => quotation.value?.source === "external",
);
const externalAttachmentBlob = ref<Blob | null>(null);
const externalAttachmentUrl = ref("");
const externalAttachmentMimeType = ref("");
const externalAttachmentName = computed(
  () => quotation.value?.attachmentName?.trim() || "",
);
const externalAttachmentExtension = computed(() => {
  const match = externalAttachmentName.value
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
});
const hasExternalAttachment = computed(() =>
  Boolean(externalAttachmentUrl.value),
);
const isImageExternalAttachment = computed(
  () =>
    externalAttachmentMimeType.value.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
      externalAttachmentExtension.value,
    ),
);
const isPdfExternalAttachment = computed(
  () =>
    externalAttachmentMimeType.value === "application/pdf" ||
    externalAttachmentExtension.value === "pdf",
);
const canPreviewExternalAttachmentInline = computed(
  () =>
    hasExternalAttachment.value &&
    (isImageExternalAttachment.value || isPdfExternalAttachment.value),
);
const externalAttachmentSummary = computed(() => {
  if (!quotation.value) return [];

  return [
    { label: "Status", value: quotation.value.quotationStatus },
    {
      label: "Imported file",
      value: externalAttachmentName.value || "No file attached",
    },
    {
      label: "Amount",
      value: formatCurrencyAmount(
        quotation.value.total,
        financialConfiguration.value,
      ),
    },
    { label: "Client", value: quotation.value.client.name || "-" },
    { label: "Email", value: quotation.value.client.companyEmail || "-" },
  ];
});
const companyLogoUrl = ref("");
const companyName = computed(
  () => legalConfiguration.value?.companyName?.trim() || "Squarely",
);
const companyAddressLines = computed(() =>
  getQuotationCompanyAddressLines(legalConfiguration.value),
);
const companyContactLines = computed(() =>
  getQuotationCompanyContactLines(legalConfiguration.value),
);
const vatSummary = computed(() => getVatSummary(financialConfiguration.value));
const renderedNote = computed(() =>
  normalizeRichText(quotationRecord.value?.note),
);

const isAddPaymentSidebarVisible = ref(false);
const isSendPaymentSidebarVisible = ref(false);
const hasExecutedAutoAction = ref(false);
const emailDialogRef = ref<any | null>(null);
const quotationPdfTarget = ref<any | null>(null);
const currentQuotationBalance = computed(() =>
  quotationRecord.value
    ? getProformaOutstandingBalance(quotationRecord.value)
    : 0,
);

const buildExternalAttachmentFile = () => {
  if (!isExternalDocument.value || !externalAttachmentBlob.value) return null;

  return new File(
    [externalAttachmentBlob.value],
    externalAttachmentName.value || "attachment",
    {
      type:
        externalAttachmentMimeType.value ||
        externalAttachmentBlob.value.type ||
        "application/octet-stream",
    },
  );
};

const printExternalAttachment = async () => {
  if (!externalAttachmentUrl.value) return false;

  if (!isImageExternalAttachment.value && !isPdfExternalAttachment.value) {
    notifications.push(
      "This attachment cannot be printed here. Download the original file instead.",
      "error",
      4000,
    );
    return false;
  }

  const iframe = document.createElement("iframe");
  iframe.src = externalAttachmentUrl.value;
  iframe.style.position = "fixed";
  iframe.style.inlineSize = "0";
  iframe.style.blockSize = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error("Failed to load attachment"));
    });

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) throw new Error("No print window available");

    iframeWindow.focus();
    iframeWindow.print();
    return true;
  } catch {
    iframe.remove();
    const printWindow = window.open(
      externalAttachmentUrl.value,
      "_blank",
      "noopener",
    );
    if (!printWindow) {
      notifications.push(
        "Unable to open the attached file for printing.",
        "error",
        4000,
      );
      return false;
    }

    notifications.push(
      "Opened the original attachment in a new tab for printing.",
      "info",
      3500,
    );
    return true;
  } finally {
    window.setTimeout(() => {
      iframe.remove();
    }, 1000);
  }
};

const printQuotation = async () => {
  if (isExternalDocument.value && hasExternalAttachment.value) {
    await printExternalAttachment();
    return;
  }

  window.print();
};

const waitForAttachmentAvailability = (timeoutMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });

const resolveExternalAttachmentUrl = async (fileKey: string) => {
  const attempts = [0, 150, 400];

  for (const delay of attempts) {
    if (delay) await waitForAttachmentAvailability(delay);

    const objectUrl = await getFileObjectUrl(fileKey).catch(() => null);
    if (objectUrl) return objectUrl;
  }

  return null;
};

const revokeExternalAttachmentPreview = () => {
  if (externalAttachmentUrl.value) {
    URL.revokeObjectURL(externalAttachmentUrl.value);
    externalAttachmentUrl.value = "";
  }

  externalAttachmentBlob.value = null;
  externalAttachmentMimeType.value = "";
};

const downloadExternalAttachment = () => {
  if (!externalAttachmentUrl.value) return;

  const anchor = document.createElement("a");
  anchor.href = externalAttachmentUrl.value;
  anchor.download = externalAttachmentName.value || "attachment";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const createCurrentQuotationPdfFile = () => {
  const currentRecord = quotationRecord.value;
  if (!currentRecord) return null;

  return createQuotationPdfFile({
    quotationRecord: currentRecord,
    companyName: companyName.value,
    companyAddressLines: companyAddressLines.value,
    companyContactLines: companyContactLines.value,
    documentLabel: "Proforma",
    recipientLabel: "Proforma To",
  });
};

const downloadFile = (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};

const downloadQuotation = async () => {
  if (isExternalDocument.value && hasExternalAttachment.value) {
    downloadExternalAttachment();
    return;
  }

  await nextTick();

  const quoteNumber = quotation.value?.quoteNumber?.trim() || "quotation";
  const targetElement = (quotationPdfTarget.value?.$el ??
    quotationPdfTarget.value) as HTMLElement | null;

  if (targetElement) {
    try {
      const pdfFile = await createPdfFileFromElement(
        targetElement,
        `${quoteNumber}.pdf`,
      );
      downloadFile(pdfFile);
      return;
    } catch {
      // Fall back to the text-based PDF renderer if DOM capture fails.
    }
  }

  const fallbackPdfFile = createCurrentQuotationPdfFile();
  if (!fallbackPdfFile) return;
  downloadFile(fallbackPdfFile);
};

const quotationEmailDraft = computed(() => {
  const currentQuotation = quotation.value;
  const to = currentQuotation?.client.companyEmail?.trim() || "";
  const clientName = currentQuotation?.client.name?.trim() || "there";
  const quoteNumber = currentQuotation?.quoteNumber?.trim() || "quotation";
  const total = formatCurrencyAmount(
    currentQuotation?.total,
    financialConfiguration.value,
  );
  const expiryDate = currentQuotation?.dueDate?.trim() || "";
  const externalAttachmentFile = buildExternalAttachmentFile();

  return {
    to,
    subject: `Proforma ${quoteNumber} from ${companyName.value}`,
    message: `Dear ${clientName},

Please find proforma ${quoteNumber} attached.

Proforma amount: ${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName.value}`.trim(),
    attachments: externalAttachmentFile
      ? [
          {
            name: externalAttachmentFile.name,
            file: externalAttachmentFile,
          },
        ]
      : [
          {
            name: quoteNumber ? `${quoteNumber}.pdf` : "Proforma Attached",
          },
        ],
  };
});

const openQuotationEmailDialog = () => {
  isSendPaymentSidebarVisible.value = true;

  nextTick(() => {
    emailDialogRef.value?.openWith?.(quotationEmailDraft.value);
  });
};

const shareQuotationOnWhatsApp = async () => {
  const currentQuotation = quotation.value;
  if (!currentQuotation) return;

  const externalAttachmentFile = buildExternalAttachmentFile();
  if (isExternalDocument.value && externalAttachmentFile) {
    await shareToWhatsApp({
      file: externalAttachmentFile,
      text: `Proforma ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
    });
    return;
  }

  await openWhatsAppIntent({
    url: window.location.href,
    text: `Proforma ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
  });
};

const shareQuotationWithOthers = async () => {
  const currentQuotation = quotation.value;
  const externalAttachmentFile = buildExternalAttachmentFile();
  if (currentQuotation && isExternalDocument.value && externalAttachmentFile) {
    const file = externalAttachmentFile;

    await shareWithSystem({
      file,
      title: file.name,
      text: `Proforma ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
    });
    return;
  }

  const pdfFile = createCurrentQuotationPdfFile();
  if (!currentQuotation || !pdfFile) return;

  await shareWithSystem({
    file: pdfFile,
    title: pdfFile.name,
    text: `Proforma ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
  });
};

const recordQuotationPayment = (payment: ProformaPaymentInput) => {
  const currentRecord = quotationRecord.value;
  if (!currentRecord) return;

  const updatedRecord = applyProformaPayment(currentRecord, payment);

  if (draftPreview.value) {
    const updatedDraft = {
      source: draftPreview.value.source,
      quotation: updatedRecord,
    };

    draftPreviewState.value = updatedDraft;
    saveProformaPreviewDraft(updatedDraft);
    notifications.push(
      `Payment of ${formatCurrencyAmount(payment.amount, financialConfiguration.value)} added successfully.`,
      "success",
      3500,
    );
    return;
  }

  proformasStore.updateProforma(updatedRecord.quotation.id, updatedRecord);
  const recordedPayment = updatedRecord.payments.at(-1);
  if (recordedPayment) {
    receiptsStore.addReceiptFromLinkedPayment({
      documentType: "proforma",
      documentId: updatedRecord.quotation.id,
      documentNumber: updatedRecord.quotation.quoteNumber,
      client: updatedRecord.quotation.client,
      avatar: updatedRecord.quotation.avatar,
      payment: recordedPayment,
    });
  }
  notifications.push(
    `Payment of ${formatCurrencyAmount(payment.amount, financialConfiguration.value)} added successfully.`,
    "success",
    3500,
  );
};

const subtotal = computed(() => getQuotationSubtotal(purchasedProducts.value));
const discountTotal = computed(() =>
  getQuotationDiscountTotal(purchasedProducts.value),
);
const grandTotal = computed(() =>
  getQuotationGrandTotal(purchasedProducts.value),
);

watch(
  () => [isExternalDocument.value, quotation.value?.attachmentFileKey] as const,
  async ([isExternal, fileKey]) => {
    revokeExternalAttachmentPreview();
    if (!isExternal || !fileKey) return;

    const [objectUrl, record] = await Promise.all([
      resolveExternalAttachmentUrl(fileKey),
      getFileRecord(fileKey).catch(() => null),
    ]);

    if (!objectUrl && !record) return;

    externalAttachmentUrl.value = objectUrl || "";
    externalAttachmentBlob.value = record?.blob ?? null;
    externalAttachmentMimeType.value = record?.blob.type || "";
  },
  { immediate: true },
);

watch(
  () => legalConfiguration.value?.logo,
  async (logo) => {
    companyLogoUrl.value = await resolveQuotationLogoUrl(logo);
  },
  { immediate: true },
);

const handleEmbeddedPreviewMessage = async (event: MessageEvent) => {
  if (!isEmbeddedActionFrame) return;
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "proforma-preview-action") return;

  const payload = event.data.payload as EmbeddedPreviewPayload | undefined;
  if (!payload?.quotation) return;

  embeddedPreviewPayload.value = payload;
  await nextTick();

  if (payload.action === "download") {
    await downloadQuotation();
    return;
  }

  await printQuotation();
};

onMounted(() => {
  if (!isEmbeddedActionFrame) return;

  window.addEventListener("message", handleEmbeddedPreviewMessage);
  window.parent?.postMessage(
    { type: "proforma-preview-ready" },
    window.location.origin,
  );
});

onBeforeUnmount(() => {
  revokeExternalAttachmentPreview();
  if (!isEmbeddedActionFrame) return;

  window.removeEventListener("message", handleEmbeddedPreviewMessage);
});

if (!isEmbeddedActionFrame) {
  watch(
    () =>
      [
        route.query.print,
        route.query.download,
        route.query.email,
        quotation.value?.id,
      ] as const,
    async ([print, download, email, quotationId]) => {
      if (!quotationId || hasExecutedAutoAction.value) return;

      if (email === "1") {
        hasExecutedAutoAction.value = true;
        openQuotationEmailDialog();
        return;
      }

      if (download === "1") {
        hasExecutedAutoAction.value = true;
        await downloadQuotation();
        return;
      }

      if (print === "1") {
        hasExecutedAutoAction.value = true;
        await nextTick();
        await printQuotation();
      }
    },
    { immediate: true },
  );
}
</script>

<template>
  <section v-if="quotation && paymentDetails">
    <VRow>
      <VCol cols="12" md="9">
        <VCard
          ref="quotationPdfTarget"
          class="quotation-preview-wrapper pa-6 pa-sm-12"
        >
          <div
            class="quotation-header-preview d-flex flex-wrap justify-space-between flex-column flex-sm-row print-row bg-var-theme-background gap-6 rounded pa-6 mb-6"
          >
            <div>
              <div
                class="quotation-company-brand mb-6 d-flex flex-column align-start gap-1"
              >
                <img
                  v-if="companyLogoUrl"
                  :src="companyLogoUrl"
                  :alt="companyName"
                  class="quotation-company-logo mb-2"
                />
                <div v-if="companyName" class="text-body-2 mb-1">
                  {{ companyName }}
                </div>
                <div
                  v-for="(line, index) in companyAddressLines"
                  :key="`address-${index}`"
                  class="text-body-2"
                >
                  {{ line }}
                </div>
                <div
                  v-for="(line, index) in companyContactLines"
                  :key="`contact-${index}`"
                  class="text-body-2"
                >
                  {{ line }}
                </div>
                <div v-if="legalConfiguration?.trn" class="text-body-2 mt-1">
                  TRN: {{ legalConfiguration.trn }}
                </div>
              </div>
            </div>

            <div>
              <h6 class="font-weight-medium text-lg mb-6">
                Proforma {{ quotation.quoteNumber }}
              </h6>

              <h6 class="text-h6 font-weight-regular">
                <span>Date Issued: </span>
                <span>{{ formatSystemDate(quotation.issuedDate) }}</span>
              </h6>

              <h6 class="text-h6 font-weight-regular">
                <span>Expiry Date: </span>
                <span>{{ formatSystemDate(quotation.dueDate) }}</span>
              </h6>
            </div>
          </div>

          <template v-if="isExternalDocument">
            <VSheet border rounded class="external-document-summary mb-6 pa-4">
              <div
                class="d-flex align-center justify-space-between flex-wrap gap-3 mb-4"
              >
                <div>
                  <p class="text-overline mb-1">Imported Attachment</p>
                  <h6 class="text-h6 mb-0">Preview from another system</h6>
                </div>

                <VBtn
                  v-if="hasExternalAttachment"
                  variant="tonal"
                  color="secondary"
                  @click="downloadExternalAttachment"
                >
                  Download attachment
                </VBtn>
              </div>

              <div class="external-document-grid">
                <div
                  v-for="item in externalAttachmentSummary"
                  :key="item.label"
                  class="external-document-item"
                >
                  <p class="external-document-label">{{ item.label }}</p>
                  <p class="external-document-value mb-0">{{ item.value }}</p>
                </div>
              </div>
            </VSheet>

            <div class="external-document-preview mb-6">
              <img
                v-if="isImageExternalAttachment && externalAttachmentUrl"
                :src="externalAttachmentUrl"
                :alt="externalAttachmentName || quotation.quoteNumber"
                class="external-document-image"
              />

              <iframe
                v-else-if="isPdfExternalAttachment && externalAttachmentUrl"
                :src="externalAttachmentUrl"
                class="external-document-frame"
                title="Imported attachment preview"
              />

              <VAlert
                v-else-if="hasExternalAttachment"
                type="info"
                variant="tonal"
                class="ma-4"
              >
                This file type does not support inline preview here. Download
                the attachment to inspect it.
              </VAlert>

              <VAlert v-else type="warning" variant="tonal" class="ma-4">
                No uploaded attachment is available for preview.
              </VAlert>
            </div>
          </template>

          <template v-else>
            <VRow class="print-row mb-6 recipient-payment-row">
              <VCol cols="6" class="recipient-payment-col">
                <h6 class="text-h6 mb-4">Proforma To:</h6>

                <p class="mb-0">{{ quotation.client.name }}</p>
                <p v-if="showClientCompany" class="mb-0">
                  {{ quotation.client.company }}
                </p>
                <p class="mb-0">
                  {{ quotation.client.address }}, {{ quotation.client.country }}
                </p>
                <p class="mb-0">{{ quotation.client.contact }}</p>
                <p class="mb-0">{{ quotation.client.companyEmail }}</p>
              </VCol>

              <VCol cols="6" class="recipient-payment-col">
                <h6 class="text-h6 mb-4">Payment Details:</h6>
                <template v-if="paymentMethod === 'Bank Transfer'">
                  <table>
                    <tbody>
                      <tr>
                        <td class="pe-4">Bank Name:</td>
                        <td>{{ paymentDetails.bankName }}</td>
                      </tr>
                      <tr>
                        <td class="pe-4">Country:</td>
                        <td>{{ paymentDetails.country }}</td>
                      </tr>
                      <tr>
                        <td class="pe-4">IBAN:</td>
                        <td>{{ paymentDetails.iban }}</td>
                      </tr>
                      <tr>
                        <td class="pe-4">SWIFT Code:</td>
                        <td>{{ paymentDetails.swiftCode }}</td>
                      </tr>
                    </tbody>
                  </table>
                </template>

                <template v-else-if="paymentMethod === 'Cash'">
                  <p class="mb-0">Cash</p>
                </template>

                <template v-else>
                  <p class="mb-2">Credit card payment link</p>
                  <p class="mb-0 text-wrap">
                    <a
                      v-if="creditCardPaymentLink"
                      :href="creditCardPaymentLink"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ creditCardPaymentLink }}
                    </a>
                    <span v-else>No payment link added yet.</span>
                  </p>
                </template>
              </VCol>
            </VRow>

            <VTable
              class="quotation-preview-table border text-high-emphasis overflow-hidden mb-6"
            >
              <thead>
                <tr>
                  <th scope="col">ITEM</th>
                  <th scope="col">DESCRIPTION</th>
                  <th scope="col" class="text-center">QUANTITY</th>
                  <th scope="col" class="text-center">PRICE</th>
                  <th scope="col" class="text-center">TOTAL</th>
                </tr>
              </thead>

              <tbody class="text-base">
                <tr
                  v-for="(item, index) in purchasedProducts"
                  :key="`${item.title}-${index}`"
                >
                  <td class="quotation-item-cell">{{ item.title }}</td>
                  <td class="quotation-description-cell">
                    {{ item.description }}
                  </td>
                  <td class="text-center">{{ item.hours }}</td>
                  <td class="text-center">
                    {{
                      formatCurrencyAmount(item.cost, financialConfiguration)
                    }}
                  </td>
                  <td class="text-center">
                    {{
                      formatCurrencyAmount(
                        getLineTotal(item),
                        financialConfiguration,
                      )
                    }}
                  </td>
                </tr>
              </tbody>
            </VTable>

            <div class="d-flex justify-end flex-column flex-sm-row print-row">
              <div
                class="quotation-company-brand mb-0 d-flex flex-column align-start gap-0"
              ></div>
            </div>
          </template>

          <template v-if="quotationRecord?.showClientNote && renderedNote">
            <VDivider class="my-6 border-dashed" />

            <div class="terms-preview">
              <span class="text-high-emphasis font-weight-medium me-1">
                Terms and Notes:
              </span>
              <div class="terms-preview__content" v-html="renderedNote" />
            </div>
          </template>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" class="d-print-none">
        <VCard>
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
                    @click="downloadQuotation"
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
                    @click="printQuotation"
                  >
                    <VIcon icon="tabler-printer" />
                  </VBtn>
                </template>
              </VTooltip>
            </div>

            <VBtn
              v-if="canReturnToEditor"
              block
              color="secondary"
              variant="tonal"
              class="mb-4"
              :to="editRoute"
            >
              Back
            </VBtn>

            <div class="d-flex flex-wrap gap-4">
              <VBtn
                color="secondary"
                variant="tonal"
                class="mb-4 flex-grow-1"
                :to="editRoute"
              >
                Edit
              </VBtn>
            </div>

            <VBtn
              block
              prepend-icon="tabler-currency-dollar"
              color="success"
              @click="isAddPaymentSidebarVisible = true"
            >
              Add Receipt
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <ProformaAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarVisible"
      :current-balance="currentQuotationBalance"
      :default-payment-method="quotationRecord?.paymentMethod"
      document-label="Proforma"
      @submit="recordQuotationPayment"
    />

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isSendPaymentSidebarVisible"
    />
  </section>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Proforma with ID {{ route.params.id }} not found!
    </VAlert>
  </section>
</template>

<style lang="scss">
.quotation-company-brand {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.quotation-company-logo {
  max-block-size: 72px;
  max-inline-size: 160px;
  object-fit: contain;
}

.quotation-company-title {
  margin: 0;
  line-height: 1.2;
}

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

.quotation-preview-table {
  --v-table-header-color: var(--v-theme-surface);

  table {
    table-layout: fixed;
  }

  th:nth-child(1),
  td:nth-child(1) {
    inline-size: 30%;
  }

  th:nth-child(2),
  td:nth-child(2) {
    inline-size: 34%;
  }

  th:nth-child(3),
  td:nth-child(3),
  th:nth-child(4),
  td:nth-child(4),
  th:nth-child(5),
  td:nth-child(5) {
    inline-size: 12%;
  }

  &.v-table .v-table__wrapper table thead tr th {
    border-block-end: 1px solid
      rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  }
}

.quotation-item-cell,
.quotation-description-cell {
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.terms-preview__content p:last-child {
  margin-block-end: 0;
}

.external-document-summary {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.external-document-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.external-document-label {
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  margin-block-end: 0.25rem;
  text-transform: uppercase;
}

.external-document-value {
  overflow-wrap: anywhere;
}

.external-document-preview {
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.5);
  min-block-size: 360px;
}

.external-document-image {
  display: block;
  max-block-size: 720px;
  max-inline-size: 100%;
  object-fit: contain;
}

.external-document-frame {
  border: 0;
  background: #fff;
  inline-size: 100%;
  min-block-size: 720px;
}

@media print {
  .v-theme--dark {
    --v-theme-surface: 255, 255, 255;
    --v-theme-on-surface: 47, 43, 61;
    --v-theme-on-background: 47, 43, 61;
  }

  body {
    background: none !important;
  }

  .quotation-header-preview,
  .quotation-preview-wrapper {
    padding: 0 !important;
  }

  .product-buy-now,
  .v-navigation-drawer,
  .layout-vertical-nav,
  .app-customizer-toggler,
  .layout-footer,
  .layout-navbar,
  .layout-navbar-and-nav-container,
  .vue-devtools__anchor {
    display: none;
  }

  .v-card {
    box-shadow: none !important;

    .print-row {
      flex-direction: row !important;
    }
  }

  .layout-content-wrapper {
    padding-inline-start: 0 !important;
  }

  .v-table__wrapper {
    overflow: hidden !important;
  }
}
</style>
