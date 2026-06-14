<script setup lang="ts">
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import { useQuotationsStore } from "@/stores/quotations";
import { createPdfFileFromElement } from "@/utils/domPdf";
import { getFileObjectUrl, getFileRecord } from "@/utils/fileStore";
import {
    buildQuotationPaymentDetails,
    formatCurrencyAmount,
    getQuotationCompanyAddressLines,
    getQuotationCompanyContactLines,
    getVatSummary,
    resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import { createQuotationPdfFile } from "@/utils/quotationPdf";
import { loadQuotationPreviewDraft } from "@/utils/quotationPreviewDraft";
import {
    getLineTotal,
    getLineDiscountAmount,
    getQuotationDiscountTotal,
    getQuotationGrandTotal,
    getQuotationSubtotal,
} from "@/utils/quotationPricing";
import { normalizeRichText } from "@/utils/richText";
import { openWhatsAppIntent, shareToWhatsApp } from "@/utils/shareToWhatsApp";
import { shareWithSystem } from "@/utils/shareWithSystem";
import { formatSystemDate } from "@core/utils/formatters";

import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import type { QuotationRecord } from "@db/apps/quotation/types";

const route = useRoute("apps-quotation-preview-id");
const isEmbeddedActionFrame = route.query.embedded === "1";
const isQuickPreview = route.query.quickPreview === "1";
const QUICK_PREVIEW_BODY_CLASS = "document-quick-preview";
const configStore = useConfigStore();
const notifications = useNotificationsStore();
const quotationsStore = useQuotationsStore();

if (!isEmbeddedActionFrame) {
  configStore.init();
  quotationsStore.init();
}

type EmbeddedPreviewPayload = {
  action: "print" | "download";
  quotation: QuotationRecord;
  legal: AppConfigurations["legal"];
  financial: AppConfigurations["financial"];
};

const embeddedPreviewPayload = ref<EmbeddedPreviewPayload | null>(null);
const draftPreviewState = ref(loadQuotationPreviewDraft());

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
    quotationsStore.byId(route.params.id),
);
const canReturnToEditor = computed(() => Boolean(draftPreview.value));
const editRoute = computed(() => {
  if (draftPreview.value?.source === "add") {
    return {
      name: "apps-quotation-add" as const,
      query: { restoreDraft: "1" },
    };
  }

  return {
    name: "apps-quotation-edit-id" as const,
    params: { id: route.params.id },
  };
});
const quotation = computed(() => quotationRecord.value?.quotation ?? null);
const legalConfiguration = computed(
  () => embeddedPreviewPayload.value?.legal ?? configStore.legal,
);
const legalTaxRegistration = computed(() =>
  String(
    (
      legalConfiguration.value as {
        trn?: string | null;
      } | null
    )?.trn ?? "",
  ).trim(),
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
const vatRateLabel = computed(() =>
  financialConfiguration.value?.vat?.enabled ? "VAT" : "VAT",
);
const renderedNote = computed(() =>
  normalizeRichText(quotationRecord.value?.note),
);

const isSendPaymentSidebarVisible = ref(false);
const hasExecutedAutoAction = ref(false);
const emailDialogRef = ref<any | null>(null);
const quotationPdfTarget = ref<any | null>(null);

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
    subject: `Quotation ${quoteNumber} from ${companyName.value}`,
    message: `Dear ${clientName},

Please find ${quoteNumber} attached.

Quotation amount: ${total}
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
            name: quoteNumber ? `${quoteNumber}.pdf` : "Quotation Attached",
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

const onQuotationEmailSend = () => {
  if (!quotation.value) return;

  quotationsStore.markQuotationSent(quotation.value.id);
};

const shareQuotationOnWhatsApp = async () => {
  const currentQuotation = quotation.value;
  if (!currentQuotation) return;

  const externalAttachmentFile = buildExternalAttachmentFile();
  if (isExternalDocument.value && externalAttachmentFile) {
    await shareToWhatsApp({
      file: externalAttachmentFile,
      text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
    });
    return;
  }

  await openWhatsAppIntent({
    url: window.location.href,
    text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
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
      text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
    });
    return;
  }

  const pdfFile = createCurrentQuotationPdfFile();
  if (!currentQuotation || !pdfFile) return;

  await shareWithSystem({
    file: pdfFile,
    title: pdfFile.name,
    text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
  });
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
  if (event.data?.type !== "quotation-preview-action") return;

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
  if (isQuickPreview) document.body.classList.add(QUICK_PREVIEW_BODY_CLASS);
  if (!isEmbeddedActionFrame) return;

  window.addEventListener("message", handleEmbeddedPreviewMessage);
  window.parent?.postMessage(
    { type: "quotation-preview-ready" },
    window.location.origin,
  );
});

onBeforeUnmount(() => {
  document.body.classList.remove(QUICK_PREVIEW_BODY_CLASS);
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
    <VRow class="preview-layout" :class="{ 'preview-layout--quick': isQuickPreview }">
      <VCol cols="12" :md="isQuickPreview ? 12 : 9">
        <VCard
          ref="quotationPdfTarget"
          class="quotation-preview-wrapper pa-6 pa-sm-12"
          :class="{ 'quotation-preview-wrapper--quick': isQuickPreview }"
        >
          <div
            v-if="!isExternalDocument"
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
                <div v-if="legalTaxRegistration" class="text-body-2 mt-1">
                  TRN: {{ legalTaxRegistration }}
                </div>
              </div>
            </div>

            <div>
              <h6 class="font-weight-medium text-lg mb-6">
                Quotation {{ quotation.quoteNumber }}
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
            <VRow class="print-row mb-6">
              <VCol cols="12" md="6" class="recipient-payment-col">
                <h6 class="text-h6 mb-4">Quotation To:</h6>
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
              <VCol cols="12" md="6" class="recipient-payment-col">
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

            <div class="quotation-preview-table text-high-emphasis mb-6" role="table">
              <div class="quotation-preview-table__row quotation-preview-table__row--head" role="row">
                <div class="quotation-preview-table__cell text-center" role="columnheader">NO.</div>
                <div class="quotation-preview-table__cell" role="columnheader">ITEM</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">QTY</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">UNIT<br />PRICE</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">DISC</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">TAXABLE<br />AMOUNT</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">{{ vatRateLabel }}</div>
                <div class="quotation-preview-table__cell text-center" role="columnheader">AMOUNT</div>
              </div>

              <div
                v-for="(item, index) in purchasedProducts"
                :key="`${item.title}-${index}`"
                class="quotation-preview-table__row"
                role="row"
              >
                <div class="quotation-preview-table__cell text-center" role="cell">{{ index + 1 }}</div>
                <div class="quotation-preview-table__cell quotation-item-cell" role="cell">{{ item.title }}</div>
                <div class="quotation-preview-table__cell text-center" role="cell">{{ item.hours }}</div>
                <div class="quotation-preview-table__cell text-center" role="cell">
                  {{ formatCurrencyAmount(item.cost, financialConfiguration) }}
                </div>
                <div class="quotation-preview-table__cell text-center" role="cell">
                  {{
                    formatCurrencyAmount(
                      getLineDiscountAmount(item),
                      financialConfiguration,
                    )
                  }}
                </div>
                <div class="quotation-preview-table__cell text-center" role="cell">
                  {{ formatCurrencyAmount(getLineTotal(item), financialConfiguration) }}
                </div>
                <div class="quotation-preview-table__cell text-center" role="cell">-</div>
                <div class="quotation-preview-table__cell text-center" role="cell">
                  {{ formatCurrencyAmount(getLineTotal(item), financialConfiguration) }}
                </div>
              </div>
            </div>

            <div class="d-flex justify-end flex-column flex-sm-row print-row">
              <div>
                <table class="w-100">
                  <tbody>
                    <tr>
                      <td class="pe-16">Subtotal:</td>
                      <td
                        :class="
                          $vuetify.locale.isRtl ? 'text-start' : 'text-end'
                        "
                      >
                        <h6 class="text-base font-weight-medium">
                          {{
                            formatCurrencyAmount(
                              subtotal,
                              financialConfiguration,
                            )
                          }}
                        </h6>
                      </td>
                    </tr>
                    <tr>
                      <td class="pe-16">Discount:</td>
                      <td
                        :class="
                          $vuetify.locale.isRtl ? 'text-start' : 'text-end'
                        "
                      >
                        <h6 class="text-base font-weight-medium">
                          {{
                            formatCurrencyAmount(
                              discountTotal,
                              financialConfiguration,
                            )
                          }}
                        </h6>
                      </td>
                    </tr>
                    <tr>
                      <td class="pe-16">{{ vatSummary.label }}:</td>
                      <td
                        :class="
                          $vuetify.locale.isRtl ? 'text-start' : 'text-end'
                        "
                      >
                        <h6 class="text-base font-weight-medium">
                          {{ vatSummary.value }}
                        </h6>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <VDivider class="my-2" />

                <table class="w-100">
                  <tbody>
                    <tr>
                      <td class="pe-16">Total:</td>
                      <td
                        :class="
                          $vuetify.locale.isRtl ? 'text-start' : 'text-end'
                        "
                      >
                        <h6 class="text-base font-weight-medium">
                          {{
                            formatCurrencyAmount(
                              grandTotal,
                              financialConfiguration,
                            )
                          }}
                        </h6>
                      </td>
                    </tr>
                    <tr v-if="quotationRecord?.totalFx?.trim()">
                      <td class="pe-16">Total FX:</td>
                      <td
                        :class="
                          $vuetify.locale.isRtl ? 'text-start' : 'text-end'
                        "
                      >
                        <h6 class="text-base font-weight-medium">
                          {{ quotationRecord.totalFx }}
                        </h6>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
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

      <VCol v-if="!isQuickPreview" cols="12" md="3" class="d-print-none">
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
          </VCardText>
        </VCard>

        <VCard v-if="isExternalDocument" class="mt-4">
          <VCardText>
            <div class="d-flex flex-column gap-3">
              <div>
                <p class="text-overline mb-1">Imported Attachment</p>
                <h6 class="text-h6 mb-0">Preview from another system</h6>
              </div>

              <VBtn
                v-if="hasExternalAttachment"
                block
                variant="tonal"
                color="secondary"
                @click="downloadExternalAttachment"
              >
                Download attachment
              </VBtn>

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
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isSendPaymentSidebarVisible"
      @send="onQuotationEmailSend"
    />
  </section>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Quotation with ID {{ route.params.id }} not found!
    </VAlert>
  </section>
</template>

<style lang="scss">
.preview-layout--quick {
  margin: 0;
}

.quotation-preview-wrapper--quick {
  padding: 1.25rem !important;
  box-shadow: none !important;
}

body.document-quick-preview {
  background: transparent !important;
}

body.document-quick-preview .product-buy-now,
body.document-quick-preview .v-navigation-drawer,
body.document-quick-preview .layout-vertical-nav,
body.document-quick-preview .app-customizer-toggler,
body.document-quick-preview .layout-footer,
body.document-quick-preview .layout-navbar,
body.document-quick-preview .layout-navbar-and-nav-container,
body.document-quick-preview .vue-devtools__anchor {
  display: none !important;
}

body.document-quick-preview .layout-content-wrapper {
  padding-block-start: 0 !important;
  padding-inline-start: 0 !important;
}

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
  display: block;
  inline-size: calc(100% + 6rem);
  margin-inline: -2rem -4rem;

  table {
    table-layout: fixed;
  }

  th:nth-child(1),
  td:nth-child(1) {
    inline-size: 5%;
  }

  th:nth-child(2),
  td:nth-child(2) {
    inline-size: 24%;
  }

  th:nth-child(3),
  td:nth-child(3) {
    inline-size: 8%;
  }

  th:nth-child(4),
  td:nth-child(4) {
    inline-size: 12%;
  }

  th:nth-child(5),
  td:nth-child(5) {
    inline-size: 8%;
  }

  th:nth-child(6),
  td:nth-child(6) {
    inline-size: 14%;
  }

  th:nth-child(7),
  td:nth-child(7) {
    inline-size: 5%;
  }

  th:nth-child(8),
  td:nth-child(8) {
    inline-size: 14%;
  }

  th:nth-child(9),
  td:nth-child(9) {
    inline-size: 12%;
  }

  &.v-table .v-table__wrapper table thead tr th {
    border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)) !important;
  }
}

.quotation-item-cell,
.quotation-description-cell {
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.quotation-preview-table {
  border-radius: 0;
}

.quotation-preview-table :deep(.v-table__wrapper) {
  inline-size: 100%;
  overflow: visible;
}

.quotation-preview-table :deep(table) {
  border-collapse: collapse;
  inline-size: 100%;
  min-inline-size: 100%;
  table-layout: fixed;
  width: 100%;
}

.quotation-preview-table :deep(th),
.quotation-preview-table :deep(td) {
  border-inline: 0;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.24);
  border-color: rgba(var(--v-border-color), 0.22);
  font-size: 0.78rem;
  padding: 0.6rem 0.35rem;
  vertical-align: middle;
}

.quotation-preview-table :deep(thead th) {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.24);
  background: rgba(var(--v-theme-surface), 0.18);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1.15;
  padding-block: 0.55rem;
  white-space: nowrap;
}

.quotation-preview-table :deep(thead th:last-child),
.quotation-preview-table :deep(tbody td:last-child) {
  position: relative;
}

.quotation-preview-table :deep(thead th:last-child::before) {
  position: absolute;
  border-block-start: 1px solid rgba(var(--v-border-color), 0.24);
  content: "";
  inset-block-start: -1px;
  inset-inline-end: -6rem;
  inline-size: 6rem;
}

.quotation-preview-table :deep(thead th:last-child::after),
.quotation-preview-table :deep(tbody td:last-child::after) {
  position: absolute;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.24);
  content: "";
  inset-block-end: -1px;
  inset-inline-end: -6rem;
  inline-size: 6rem;
}

.quotation-preview-table :deep(tfoot td) {
  background: rgba(var(--v-theme-surface), 0.1);
}

.quotation-preview-table :deep(tbody tr:last-child td) {
  border-block-end: 1px solid rgba(var(--v-border-color), 0.24);
}

.quotation-preview-table :deep(td:not(:nth-child(2))) {
  white-space: nowrap;
}

.quotation-preview-table__heading {
  display: inline-block;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
}

.quotation-preview-table__summary-row td {
  white-space: nowrap;
}

.quotation-preview-table :deep(.quotation-preview-table__fill-cell) {
  padding: 0;
}

.quotation-preview-table {
  display: block;
  inline-size: 100%;
  margin-inline: 0;
}

.quotation-preview-table__row {
  display: grid;
  align-items: center;
  border-block-end: 1px solid rgba(var(--v-border-color), 0.24);
  grid-template-columns: 5% 36% 8% 11% 8% 14% 5% 13%;
  min-inline-size: 100%;
}

.quotation-preview-table__row--head {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.24);
  background: rgba(var(--v-theme-surface), 0.18);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1.15;
}

.quotation-preview-table__cell {
  padding: 0.6rem 0.35rem;
  font-size: 0.875rem;
  min-inline-size: 0;
}

.quotation-preview-table__row--head .quotation-preview-table__cell {
  padding-block: 0.55rem;
  font-size: 0.78rem;
  font-weight: 800;
}

.quotation-preview-table__cell:not(.quotation-item-cell) {
  overflow-wrap: normal;
  white-space: nowrap;
}

.quotation-preview-table__fill-cell {
  padding: 0;
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
