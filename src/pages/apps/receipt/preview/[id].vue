<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { createPdfFileFromElement } from "@/utils/domPdf";
import { getFileObjectUrl, getFileRecord, saveFile } from "@/utils/fileStore";
import {
  formatCurrencyAmount,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
  resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import type {
  ReceiptClientOption,
  ReceiptDocumentOption,
  ReceiptDrawerSubmitPayload,
} from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import ReceiptUpsertDrawer from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import { formatSystemDate } from "@core/utils/formatters";

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const contactsStore = useContactsStore();
const invoicesStore = useInvoicesStore();
const proformasStore = useProformasStore();
const receiptsStore = useReceiptsStore();
const notifications = useNotificationsStore();

configStore.init();
contactsStore.init();
invoicesStore.init();
proformasStore.init();
receiptsStore.init();

const receiptPdfTarget = ref<HTMLElement | null>(null);
const companyLogoUrl = ref("");
const externalAttachmentBlob = ref<Blob | null>(null);
const externalAttachmentUrl = ref("");
const externalAttachmentMimeType = ref("");
const isReceiptDrawerOpen = ref(false);
const isEmailDialogOpen = ref(false);
const isDeleteDialogOpen = ref(false);
const emailDialogRef = ref<any | null>(null);
const hasExecutedAutoAction = ref(false);
const isEmbeddedActionFrame = route.query.embedded === "1";
const attachmentPreviewFrame = ref<HTMLIFrameElement | null>(null);

const receiptRecord = computed(() =>
  receiptsStore.byId(String(route.params.id)),
);
const receipt = computed(() => receiptRecord.value?.receipt ?? null);
const legalConfiguration = computed(() => configStore.legal);
const financialConfiguration = computed(() => configStore.financial);
const companyName = computed(
  () => legalConfiguration.value?.companyName?.trim() || "Squarely",
);
const companyAddressLines = computed(() =>
  getQuotationCompanyAddressLines(legalConfiguration.value),
);
const companyContactLines = computed(() =>
  getQuotationCompanyContactLines(legalConfiguration.value),
);
const relatedDocument = computed(() => {
  if (!receipt.value) return null;

  if (receipt.value.linkedInvoiceId) {
    return {
      label: "Invoice",
      number: receipt.value.linkedInvoiceNumber,
      to: `/apps/invoice/preview/${receipt.value.linkedInvoiceId}`,
    };
  }

  if (receipt.value.linkedProformaId) {
    return {
      label: "Proforma",
      number: receipt.value.linkedProformaNumber,
      to: `/apps/proforma/preview/${receipt.value.linkedProformaId}`,
    };
  }

  return null;
});
const sourceLabel = computed(() => {
  if (!receipt.value) return "";
  if (receipt.value.sourceType === "invoice") return "Invoice through Squarely";
  if (receipt.value.sourceType === "proforma")
    return "Proforma through Squarely";
  if (receipt.value.sourceType === "attachment") return "Attachment only";
  return "Without invoice or proforma";
});
const isFlaggedReceipt = computed(() => receipt.value?.status === "Flagged");
const hasAttachment = computed(() => Boolean(receipt.value?.attachmentFileKey));
const externalAttachmentName = computed(
  () => receipt.value?.attachmentName?.trim() || "attachment",
);
const externalAttachmentExtension = computed(() => {
  const match = externalAttachmentName.value
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
});
const isImageAttachment = computed(
  () =>
    externalAttachmentMimeType.value.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
      externalAttachmentExtension.value,
    ),
);
const isPdfAttachment = computed(
  () =>
    externalAttachmentMimeType.value === "application/pdf" ||
    externalAttachmentExtension.value === "pdf",
);
const createClientKey = (name: string, email: string) =>
  `${name.trim().toLowerCase()}::${email.trim().toLowerCase()}`;

const mergeClientOptions = (options: ReceiptClientOption[]) => {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

const getAllocatedReceiptAmount = (
  documentType: "invoice" | "proforma",
  documentId: number,
) =>
  receiptsStore.all
    .filter((record) =>
      documentType === "invoice"
        ? record.receipt.linkedInvoiceId === documentId
        : record.receipt.linkedProformaId === documentId,
    )
    .reduce((sum, record) => sum + Number(record.receipt.amount || 0), 0);

const mapDocumentOption = (
  record: (typeof invoicesStore.all)[number],
  documentType: "invoice" | "proforma",
): ReceiptDocumentOption => ({
  title: `${record.quotation.quoteNumber} | ${record.quotation.issuedDate} | $${Number(record.quotation.total || 0).toLocaleString()}`,
  value: `${documentType}:${record.quotation.id}`,
  documentId: record.quotation.id,
  documentType,
  documentNumber: record.quotation.quoteNumber,
  clientKey: createClientKey(
    record.quotation.client.name || record.quotation.client.company || "",
    record.quotation.client.companyEmail || "",
  ),
  client: record.quotation.client,
  amount: Number(record.quotation.total || 0),
  balance:
    record.quotation.balance === undefined || record.quotation.balance === null
      ? null
      : Number(record.quotation.balance),
  allocatedAmount: getAllocatedReceiptAmount(documentType, record.quotation.id),
  paymentMethod: record.paymentMethod || "Bank Transfer",
});

const invoiceOptions = computed<ReceiptDocumentOption[]>(() =>
  invoicesStore.all
    .filter((record) => !record.quotation.parentQuotationId)
    .map((record) => mapDocumentOption(record, "invoice")),
);
const proformaOptions = computed<ReceiptDocumentOption[]>(() =>
  proformasStore.all
    .filter((record) => !record.quotation.parentQuotationId)
    .map((record) => mapDocumentOption(record, "proforma")),
);

const clientOptions = computed<ReceiptClientOption[]>(() =>
  mergeClientOptions([
    ...contactsStore.all.map((contact) => ({
      title: contact.fullName,
      value: createClientKey(contact.fullName || "", contact.email || ""),
      client: {
        address: contact.address || "",
        company: contact.fullName || "",
        companyEmail: contact.email || "",
        country: contact.country || "Lebanon",
        contact: contact.number || "",
        name: contact.fullName || "",
      },
    })),
    ...invoiceOptions.value.map((option) => ({
      title:
        option.client.name || option.client.company || option.documentNumber,
      value: option.clientKey,
      client: option.client,
    })),
    ...proformaOptions.value.map((option) => ({
      title:
        option.client.name || option.client.company || option.documentNumber,
      value: option.clientKey,
      client: option.client,
    })),
  ]),
);

const revokeExternalAttachmentPreview = () => {
  if (externalAttachmentUrl.value) {
    URL.revokeObjectURL(externalAttachmentUrl.value);
    externalAttachmentUrl.value = "";
  }

  externalAttachmentBlob.value = null;
  externalAttachmentMimeType.value = "";
};

const buildExternalAttachmentFile = () => {
  if (!externalAttachmentBlob.value) return null;
  return new File(
    [externalAttachmentBlob.value],
    externalAttachmentName.value,
    {
      type:
        externalAttachmentMimeType.value || externalAttachmentBlob.value.type,
    },
  );
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

const downloadAttachment = () => {
  const externalFile = buildExternalAttachmentFile();
  if (!externalFile) return;
  downloadFile(externalFile);
};

const printExternalAttachment = async () => {
  if (!externalAttachmentUrl.value) return false;

  if (isPdfAttachment.value) {
    try {
      const previewWindow = attachmentPreviewFrame.value?.contentWindow;
      if (!previewWindow) return false;

      previewWindow.focus();
      previewWindow.print();
      return true;
    } catch {
      return false;
    }
  }

  if (isImageAttachment.value) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.insetInlineStart = "-2000px";
    iframe.style.insetBlockStart = "0";
    iframe.style.inlineSize = "1px";
    iframe.style.blockSize = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const didPrint = await new Promise<boolean>((resolve) => {
      iframe.onload = () => {
        try {
          const iframeDocument = iframe.contentDocument;
          if (!iframeDocument) {
            resolve(false);
            cleanup();
            return;
          }

          iframeDocument.open();
          iframeDocument.write(
            `<!doctype html><html><head><title>Print attachment</title><style>html,body{margin:0;padding:0;background:#fff;}img{display:block;max-width:100%;margin:0 auto;}</style></head><body><img id="print-image" src="${externalAttachmentUrl.value}" alt="${externalAttachmentName.value}"></body></html>`,
          );
          iframeDocument.close();

          const printImage = iframeDocument.getElementById(
            "print-image",
          ) as HTMLImageElement | null;

          if (!printImage) {
            resolve(false);
            cleanup();
            return;
          }

          const triggerPrint = () => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
              resolve(true);
            } catch {
              resolve(false);
            } finally {
              window.setTimeout(cleanup, 1000);
            }
          };

          if (printImage.complete) {
            window.setTimeout(triggerPrint, 100);
            return;
          }

          printImage.addEventListener("load", triggerPrint, { once: true });
          printImage.addEventListener(
            "error",
            () => {
              resolve(false);
              cleanup();
            },
            { once: true },
          );
        } catch {
          resolve(false);
          cleanup();
        }
      };

      document.body.appendChild(iframe);
      iframe.src = "about:blank";
    });

    return didPrint;
  }

  return false;
};

const downloadReceipt = async () => {
  if (receipt.value?.sourceType === "attachment" && hasAttachment.value) {
    downloadAttachment();
    return;
  }

  if (!receipt.value) return;

  await nextTick();

  const targetElement = (receiptPdfTarget.value?.$el ??
    receiptPdfTarget.value) as HTMLElement | null;
  if (!targetElement) return;

  const pdfFile = await createPdfFileFromElement(
    targetElement,
    `${receipt.value.receiptNumber}.pdf`,
  );
  downloadFile(pdfFile);
};

const printReceipt = async () => {
  if (receipt.value?.sourceType === "attachment" && hasAttachment.value) {
    const didPrintAttachment = await printExternalAttachment();
    if (!didPrintAttachment) {
      notifications.push(
        "Attachment preview is not printable for this file type. Download the file instead.",
        "warning",
        4000,
      );
    }
    return;
  }

  await nextTick();
  window.print();
};

const handleEmbeddedPreviewMessage = async (event: MessageEvent) => {
  if (!isEmbeddedActionFrame) return;
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "receipt-preview-action") return;

  const action = event.data?.payload?.action;

  if (action === "download") {
    await downloadReceipt();
    return;
  }

  if (action === "print") {
    await printReceipt();
  }
};

const openReceiptEmailDialog = () => {
  isEmailDialogOpen.value = true;
  nextTick(() => {
    emailDialogRef.value?.openWith?.(receiptEmailDraft.value);
  });
};

const receiptEmailDraft = computed(() => {
  if (!receipt.value) {
    return { to: "", subject: "", message: "", attachments: [] };
  }

  const attachments = [{ name: `${receipt.value.receiptNumber}.pdf` }];
  const externalFile = buildExternalAttachmentFile();
  if (externalFile) {
    attachments.push({ name: externalFile.name, file: externalFile });
  }

  return {
    to: receipt.value.client.companyEmail?.trim() || "",
    subject: `Receipt ${receipt.value.receiptNumber}`,
    message: `Dear ${receipt.value.client.name || "there"},

Please find receipt ${receipt.value.receiptNumber} attached.

Amount received: ${formatCurrencyAmount(receipt.value.amount, financialConfiguration.value)}

Thank you,
${companyName.value}`.trim(),
    attachments,
  };
});

const onReceiptEmailSend = (payload: any) => {
  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  notifications.push(
    `Receipt email sent${recipients.length ? ` to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}` : ""}.`,
    "success",
    3500,
  );
  isEmailDialogOpen.value = false;
};

const saveReceipt = async (payload: ReceiptDrawerSubmitPayload) => {
  if (!receipt.value || !payload.id) return;

  let attachmentFileKey = payload.receipt.attachmentFileKey;

  if (payload.attachment) {
    attachmentFileKey = await saveFile(payload.attachment);
  }

  receiptsStore.updateReceipt(payload.id, {
    receipt: {
      ...payload.receipt,
      id: receipt.value.id,
      attachmentName:
        payload.attachment?.name ?? payload.receipt.attachmentName ?? null,
      attachmentFileKey: attachmentFileKey ?? null,
    },
    paymentMethod: payload.paymentMethod,
    note: payload.note,
  });
  notifications.push("Receipt updated successfully.", "success", 3500);
  isReceiptDrawerOpen.value = false;
};

const deleteReceipt = () => {
  if (!receipt.value) return;
  const receiptNumber = receipt.value.receiptNumber;
  receiptsStore.removeReceipt(receipt.value.id);
  notifications.push(`${receiptNumber} deleted successfully.`, "success", 3500);
  router.push("/finance/finance?tab=receipt");
};

watch(
  () => legalConfiguration.value?.logo,
  async (logo) => {
    companyLogoUrl.value = await resolveQuotationLogoUrl(logo);
  },
  { immediate: true },
);

watch(
  () => receipt.value?.attachmentFileKey,
  async (fileKey) => {
    revokeExternalAttachmentPreview();
    if (!fileKey) return;

    const [objectUrl, record] = await Promise.all([
      getFileObjectUrl(fileKey).catch(() => null),
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
  () =>
    [
      route.query.print,
      route.query.download,
      route.query.email,
      receipt.value?.id,
    ] as const,
  async ([print, download, email, receiptId]) => {
    if (!receiptId || hasExecutedAutoAction.value) return;

    if (email === "1") {
      hasExecutedAutoAction.value = true;
      openReceiptEmailDialog();
      return;
    }

    if (download === "1") {
      hasExecutedAutoAction.value = true;
      await downloadReceipt();
      return;
    }

    if (print === "1") {
      hasExecutedAutoAction.value = true;
      await printReceipt();
    }
  },
  { immediate: true },
);

watch(
  () =>
    [
      receipt.value?.id,
      receipt.value?.sourceType,
      receipt.value?.attachmentFileKey,
      externalAttachmentUrl.value,
      !!externalAttachmentBlob.value,
    ] as const,
  async ([
    receiptId,
    sourceType,
    attachmentFileKey,
    attachmentUrl,
    hasBlob,
  ]) => {
    if (!isEmbeddedActionFrame || !receiptId) return;

    const needsAttachmentLoad =
      sourceType === "attachment" && Boolean(attachmentFileKey);

    if (needsAttachmentLoad && !attachmentUrl && !hasBlob) return;

    await nextTick();

    window.parent?.postMessage(
      {
        type: "receipt-preview-ready",
        receiptId,
      },
      window.location.origin,
    );
  },
  { immediate: true },
);

onMounted(() => {
  if (!isEmbeddedActionFrame) return;
  window.addEventListener("message", handleEmbeddedPreviewMessage);
});

onBeforeUnmount(() => {
  revokeExternalAttachmentPreview();
  if (isEmbeddedActionFrame) {
    window.removeEventListener("message", handleEmbeddedPreviewMessage);
  }
});
</script>

<template>
  <section v-if="receipt" id="receipt-preview">
    <VRow>
      <VCol cols="12" md="9">
        <VCard ref="receiptPdfTarget">
          <VCardText class="pa-8 pa-md-10">
            <div
              class="d-flex justify-space-between align-start flex-wrap gap-6 mb-8"
            >
              <div class="d-flex flex-column align-start gap-2">
                <img
                  v-if="companyLogoUrl"
                  :src="companyLogoUrl"
                  :alt="companyName"
                  class="receipt-company-logo mb-2"
                />
                <div class="text-body-2 mb-1">{{ companyName }}</div>
                <div
                  v-for="line in companyAddressLines"
                  :key="'address-' + line"
                  class="text-body-2"
                >
                  {{ line }}
                </div>
                <div
                  v-for="line in companyContactLines"
                  :key="'contact-' + line"
                  class="text-body-2"
                >
                  {{ line }}
                </div>
              </div>

              <div class="text-md-end">
                <div class="text-overline mb-2">Receipt</div>
                <h3 class="text-h3 mb-1">
                  {{ receipt.receiptNumber }}
                </h3>
                <div class="text-body-2">
                  Issued {{ formatSystemDate(receipt.issuedDate) }}
                </div>
                <div class="text-body-2">
                  Received {{ formatSystemDate(receipt.receivedDate) }}
                </div>
              </div>
            </div>

            <VAlert
              v-if="isFlaggedReceipt"
              color="warning"
              variant="tonal"
              border="start"
              class="mb-8"
            >
              This receipt is flagged because it is not linked to a Squarely
              invoice or proforma.
            </VAlert>

            <VRow class="mb-8">
              <VCol cols="12" md="6">
                <div class="text-overline mb-2">Receipt To</div>
                <h5 class="text-h5 mb-1">
                  {{ receipt.client.name }}
                </h5>
                <div
                  v-if="receipt.client.companyEmail"
                  class="text-body-2 mb-1"
                >
                  {{ receipt.client.companyEmail }}
                </div>
                <div v-if="receipt.client.contact" class="text-body-2 mb-1">
                  {{ receipt.client.contact }}
                </div>
                <div v-if="receipt.client.address" class="text-body-2 mb-1">
                  {{ receipt.client.address }}
                </div>
                <div v-if="receipt.client.country" class="text-body-2">
                  {{ receipt.client.country }}
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <VCard variant="tonal" color="primary">
                  <VCardText>
                    <div class="text-overline mb-2">Receipt Summary</div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Source</span>
                      <span class="font-weight-medium">{{ sourceLabel }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Payment Method</span>
                      <span class="font-weight-medium">{{
                        receiptRecord?.paymentMethod
                      }}</span>
                    </div>
                    <div class="d-flex justify-space-between">
                      <span>Amount Received</span>
                      <span class="font-weight-bold">
                        {{
                          formatCurrencyAmount(
                            receipt.amount,
                            financialConfiguration,
                          )
                        }}
                      </span>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>

            <VCard variant="outlined" class="mb-8">
              <VCardText>
                <div class="text-overline mb-3">Related Document</div>
                <div v-if="relatedDocument" class="d-flex flex-column gap-1">
                  <span class="text-body-2">{{ relatedDocument.label }}</span>
                  <RouterLink :to="relatedDocument.to">
                    {{ relatedDocument.label }} #{{ relatedDocument.number }}
                  </RouterLink>
                </div>
                <div v-else class="text-warning">
                  No linked invoice or proforma.
                </div>
              </VCardText>
            </VCard>

            <VCard variant="outlined">
              <VCardText>
                <div class="text-overline mb-3">Internal Note</div>
                <p class="mb-0 text-body-2">
                  {{ receiptRecord?.note || "No internal note added." }}
                </p>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>

        <VCard v-if="hasAttachment" class="mt-6">
          <VCardItem>
            <template #title> Attached File </template>
            <template #append>
              <VBtn
                variant="text"
                prepend-icon="tabler-download"
                @click="downloadAttachment"
              >
                Download Attachment
              </VBtn>
            </template>
          </VCardItem>
          <VCardText>
            <div class="text-body-2 mb-4">
              {{ externalAttachmentName }}
            </div>

            <iframe
              ref="attachmentPreviewFrame"
              v-if="externalAttachmentUrl && isPdfAttachment"
              :src="externalAttachmentUrl"
              class="receipt-attachment-frame"
              title="Receipt attachment preview"
            />

            <img
              v-else-if="externalAttachmentUrl && isImageAttachment"
              :src="externalAttachmentUrl"
              :alt="externalAttachmentName"
              class="receipt-attachment-image"
            />

            <VAlert v-else type="info" variant="tonal">
              Attachment preview is not available for this file type.
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="3" class="d-print-none">
        <VCard>
          <VCardText class="d-flex flex-column gap-3">
            <VBtn
              block
              prepend-icon="tabler-pencil"
              @click="isReceiptDrawerOpen = true"
            >
              Edit
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-printer"
              variant="tonal"
              @click="printReceipt"
            >
              Print
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-mail"
              variant="tonal"
              @click="openReceiptEmailDialog"
            >
              Email
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-download"
              variant="tonal"
              @click="downloadReceipt"
            >
              Download
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-trash"
              color="error"
              variant="tonal"
              @click="isDeleteDialogOpen = true"
            >
              Delete
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <ReceiptUpsertDrawer
      v-model:is-drawer-open="isReceiptDrawerOpen"
      :editing-receipt="receiptRecord"
      :client-options="clientOptions"
      :invoice-options="invoiceOptions"
      :proforma-options="proformaOptions"
      @submit="saveReceipt"
    />

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogOpen"
      @close="isEmailDialogOpen = false"
      @send="onReceiptEmailSend"
    />

    <VDialog v-model="isDeleteDialogOpen" max-width="420" persistent>
      <VCard>
        <VCardText class="pt-6">
          Are you sure you want to delete receipt {{ receipt.receiptNumber }}?
        </VCardText>
        <VCardActions class="justify-end px-6 pb-6 pt-2">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isDeleteDialogOpen = false"
          >
            Cancel
          </VBtn>
          <VBtn color="error" variant="tonal" @click="deleteReceipt">
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>

  <VCard v-else>
    <VCardText class="py-10 text-center"> Receipt not found. </VCardText>
  </VCard>
</template>

<style lang="scss">
#receipt-preview {
  .receipt-company-logo {
    display: block;
    flex: 0 0 auto;
    inline-size: auto;
    max-block-size: 4.5rem;
    max-inline-size: 9rem;
    object-fit: contain;
    object-position: left center;
  }

  .receipt-attachment-frame {
    border: 0;
    inline-size: 100%;
    min-block-size: 42rem;
  }

  .receipt-attachment-image {
    display: block;
    inline-size: 100%;
    max-block-size: 42rem;
    object-fit: contain;
  }
}

@media print {
  #receipt-preview {
    .v-card {
      box-shadow: none !important;
    }
  }
}
</style>
