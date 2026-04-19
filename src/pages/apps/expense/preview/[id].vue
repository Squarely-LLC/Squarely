<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { useExpensesStore } from "@/stores/expenses";
import { useNotificationsStore } from "@/stores/notifications";
import { createPdfFileFromElement } from "@/utils/domPdf";
import { getFileObjectUrl, getFileRecord } from "@/utils/fileStore";
import {
  formatCurrencyAmount,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
  resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const expensesStore = useExpensesStore();
const notifications = useNotificationsStore();

configStore.init();
expensesStore.init();

const isEmbeddedActionFrame = route.query.embedded === "1";
const expensePdfTarget = ref<HTMLElement | null>(null);
const companyLogoUrl = ref("");
const attachmentPreviewUrl = ref("");
const attachmentPreviewMimeType = ref("");
const attachmentPreviewBlob = ref<Blob | null>(null);
const attachmentPreviewFrame = ref<HTMLIFrameElement | null>(null);
const isEmailDialogOpen = ref(false);
const emailDialogRef = ref<any | null>(null);
const hasExecutedAutoAction = ref(false);

const expenseRecord = computed(() => expensesStore.byId(String(route.params.id)));
const expense = computed(() => expenseRecord.value?.expense ?? null);
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
const hasAttachment = computed(() => Boolean(expense.value?.attachmentFileKey));
const isFlaggedExpense = computed(() => expense.value?.status === "Flagged");
const attachmentName = computed(
  () => expense.value?.attachmentName?.trim() || "attachment",
);
const attachmentExtension = computed(() => {
  const match = attachmentName.value.toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match?.[1] || "";
});
const isImageAttachment = computed(
  () =>
    attachmentPreviewMimeType.value.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
      attachmentExtension.value,
    ),
);
const isPdfAttachment = computed(
  () =>
    attachmentPreviewMimeType.value === "application/pdf" ||
    attachmentExtension.value === "pdf",
);

const expenseEmailDraft = computed(() => {
  if (!expense.value) {
    return { to: "", subject: "", message: "", attachments: [] };
  }

  return {
    to: expense.value.supplier.email?.trim() || "",
    subject: `Bill ${expense.value.billNumber}`,
    message: `Dear ${expense.value.supplier.name || "there"},

Please find bill ${expense.value.billNumber} attached.

Amount: ${formatCurrencyAmount(expense.value.amount, financialConfiguration.value)}

Thank you,
${companyName.value}`.trim(),
    attachments: [{ name: `${expense.value.billNumber}.pdf` }],
  };
});

const revokeAttachmentPreview = () => {
  if (attachmentPreviewUrl.value) {
    URL.revokeObjectURL(attachmentPreviewUrl.value);
    attachmentPreviewUrl.value = "";
  }

  attachmentPreviewBlob.value = null;
  attachmentPreviewMimeType.value = "";
};

const buildAttachmentFile = () => {
  if (!attachmentPreviewBlob.value) return null;

  return new File([attachmentPreviewBlob.value], attachmentName.value, {
    type: attachmentPreviewMimeType.value || attachmentPreviewBlob.value.type,
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

const downloadAttachment = () => {
  const file = buildAttachmentFile();
  if (!file) return;
  downloadFile(file);
};

const previewAttachment = () => {
  if (!attachmentPreviewUrl.value) {
    notifications.push("Attachment preview is unavailable.", "warning", 3000);
    return;
  }

  const previewWindow = window.open(
    attachmentPreviewUrl.value,
    "_blank",
    "noopener,noreferrer",
  );
  if (!previewWindow) {
    notifications.push(
      "Unable to open the attachment preview. Check your popup blocker.",
      "warning",
      3500,
    );
    return;
  }

  previewWindow.focus();
};

const triggerPdfDownload = async () => {
  if (!expense.value) return;

  await nextTick();

  const targetElement = (expensePdfTarget.value?.$el ??
    expensePdfTarget.value) as HTMLElement | null;
  if (!targetElement) return;

  const pdfFile = await createPdfFileFromElement(
    targetElement,
    `${expense.value.billNumber}.pdf`,
  );
  downloadFile(pdfFile);
};

const printExpense = async () => {
  await nextTick();
  window.print();
};

const openExpenseEmailDialog = () => {
  isEmailDialogOpen.value = true;
  nextTick(() => {
    emailDialogRef.value?.openWith?.(expenseEmailDraft.value);
  });
};

const onExpenseEmailSend = (payload: any) => {
  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  const subject = String(payload?.subject || "(no subject)");
  notifications.push(
    `Email sent${recipients.length ? ` to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}` : ""}: ${subject}`,
    "success",
    3500,
  );
  isEmailDialogOpen.value = false;
};

const editExpense = () => {
  router.push({ path: "/finance", query: { tab: "expenses" } });
};

const handleEmbeddedAction = async (action: "print" | "download") => {
  if (action === "print") {
    await printExpense();
    return;
  }

  await triggerPdfDownload();
};

const handlePreviewActionMessage = async (event: MessageEvent) => {
  if (!isEmbeddedActionFrame) return;
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "expense-preview-action") return;

  const action = event.data?.payload?.action;
  if (action !== "print" && action !== "download") return;
  if (hasExecutedAutoAction.value) return;

  hasExecutedAutoAction.value = true;
  await handleEmbeddedAction(action);
  window.setTimeout(() => {
    hasExecutedAutoAction.value = false;
  }, 250);
};

watch(
  () => legalConfiguration.value?.logo,
  async (logo) => {
    companyLogoUrl.value = await resolveQuotationLogoUrl(logo);
  },
  { immediate: true },
);

watch(
  () => expense.value?.attachmentFileKey,
  async (fileKey) => {
    revokeAttachmentPreview();

    if (!fileKey) return;

    const [objectUrl, fileRecord] = await Promise.all([
      getFileObjectUrl(fileKey).catch(() => null),
      getFileRecord(fileKey).catch(() => null),
    ]);

    if (!objectUrl || !fileRecord) return;

    attachmentPreviewUrl.value = objectUrl;
    attachmentPreviewBlob.value = fileRecord.blob;
    attachmentPreviewMimeType.value = fileRecord.blob.type || "";
  },
  { immediate: true },
);

onMounted(() => {
  if (isEmbeddedActionFrame) {
    window.addEventListener("message", handlePreviewActionMessage);
    window.parent.postMessage(
      {
        type: "expense-preview-ready",
        expenseId: expense.value?.id ?? null,
      },
      window.location.origin,
    );
    return;
  }

  if (route.query.email === "1") {
    openExpenseEmailDialog();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionMessage);
  revokeAttachmentPreview();
});
</script>

<template>
  <section v-if="expense" id="expense-preview">
    <VRow>
      <VCol cols="12" md="9">
        <VCard ref="expensePdfTarget">
          <VCardText class="pa-8 pa-md-10">
            <div
              class="d-flex justify-space-between align-start flex-wrap gap-6 mb-8"
            >
              <div class="d-flex flex-column align-start gap-2">
                <img
                  v-if="companyLogoUrl"
                  :src="companyLogoUrl"
                  :alt="companyName"
                  class="expense-company-logo mb-2"
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
                <div class="text-overline mb-2">Bill</div>
                <h3 class="text-h3 mb-1">
                  {{ expense.billNumber }}
                </h3>
                <div class="text-body-2">
                  Dated {{ formatSystemDate(expense.billDate) }}
                </div>
                <div class="text-body-2">
                  Paid {{
                    expense.paidAt ? formatSystemDate(expense.paidAt) : "-"
                  }}
                </div>
              </div>
            </div>

            <VAlert
              v-if="isFlaggedExpense"
              color="warning"
              variant="tonal"
              border="start"
              class="mb-8"
            >
              This bill is flagged because the attachment or supplier invoice
              number is missing.
            </VAlert>

            <VRow class="mb-8">
              <VCol cols="12" md="6">
                <div class="text-overline mb-2">Supplier</div>
                <h5 class="text-h5 mb-1">
                  {{ expense.supplier.name || "-" }}
                </h5>
                <div v-if="expense.supplier.email" class="text-body-2 mb-1">
                  {{ expense.supplier.email }}
                </div>
                <div v-if="expense.supplier.phone" class="text-body-2 mb-1">
                  {{ expense.supplier.phone }}
                </div>
                <div v-if="expense.supplier.address" class="text-body-2">
                  {{ expense.supplier.address }}
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <VCard variant="tonal" color="primary">
                  <VCardText>
                    <div class="text-overline mb-2">Bill Summary</div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Status</span>
                      <span class="font-weight-medium">{{ expense.status }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Category</span>
                      <span class="font-weight-medium">{{
                        expense.category || "-"
                      }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Supplier Invoice</span>
                      <span class="font-weight-medium">{{
                        expense.supplierInvoiceNumber || "-"
                      }}</span>
                    </div>
                    <div class="d-flex justify-space-between mb-2">
                      <span>Amount Due</span>
                      <span class="font-weight-medium">
                        {{
                          formatCurrencyAmount(
                            expense.balance,
                            financialConfiguration,
                          )
                        }}
                      </span>
                    </div>
                    <div class="d-flex justify-space-between">
                      <span>Total Amount</span>
                      <span class="font-weight-bold">
                        {{
                          formatCurrencyAmount(
                            expense.amount,
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
                <div class="text-overline mb-3">Bill Details</div>
                <div class="expense-detail-grid">
                  <div>
                    <div class="expense-detail-label">Bill #</div>
                    <div class="expense-detail-value">{{ expense.billNumber }}</div>
                  </div>
                  <div>
                    <div class="expense-detail-label">Bill Date</div>
                    <div class="expense-detail-value">
                      {{ formatSystemDate(expense.billDate) }}
                    </div>
                  </div>
                  <div>
                    <div class="expense-detail-label">Supplier Invoice</div>
                    <div class="expense-detail-value">
                      {{ expense.supplierInvoiceNumber || "-" }}
                    </div>
                  </div>
                  <div>
                    <div class="expense-detail-label">Paid At</div>
                    <div class="expense-detail-value">
                      {{ expense.paidAt ? formatSystemDate(expense.paidAt) : "-" }}
                    </div>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VCard variant="outlined">
              <VCardText>
                <div class="text-overline mb-3">Internal Note</div>
                <p class="mb-0 text-body-2">
                  {{ expenseRecord?.note || "No internal note added." }}
                </p>
              </VCardText>
            </VCard>
          </VCardText>
        </VCard>

        <VCard v-if="hasAttachment" class="mt-6">
          <VCardItem>
            <template #title> Attached File </template>
            <template #append>
              <div class="d-flex flex-wrap gap-2">
                <VBtn
                  variant="text"
                  prepend-icon="tabler-eye"
                  @click="previewAttachment"
                >
                  Preview Attachment
                </VBtn>
                <VBtn
                  variant="text"
                  prepend-icon="tabler-download"
                  @click="downloadAttachment"
                >
                  Download Attachment
                </VBtn>
              </div>
            </template>
          </VCardItem>
          <VCardText>
            <div class="text-body-2 mb-4">
              {{ attachmentName }}
            </div>

            <iframe
              v-if="attachmentPreviewUrl && isPdfAttachment"
              ref="attachmentPreviewFrame"
              :src="attachmentPreviewUrl"
              class="expense-attachment-frame"
              title="Expense attachment preview"
            />

            <img
              v-else-if="attachmentPreviewUrl && isImageAttachment"
              :src="attachmentPreviewUrl"
              :alt="attachmentName"
              class="expense-attachment-image"
            />

            <VAlert v-else type="info" variant="tonal">
              Attachment preview is not available for this file type.
            </VAlert>
          </VCardText>
        </VCard>
      </VCol>

      <VCol v-if="!isEmbeddedActionFrame" cols="12" md="3" class="d-print-none">
        <VCard>
          <VCardText class="d-flex flex-column gap-3">
            <VBtn block prepend-icon="tabler-arrow-left" @click="editExpense">
              Back To List
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-printer"
              variant="tonal"
              @click="printExpense"
            >
              Print
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-mail"
              variant="tonal"
              @click="openExpenseEmailDialog"
            >
              Email
            </VBtn>
            <VBtn
              block
              prepend-icon="tabler-download"
              variant="tonal"
              @click="triggerPdfDownload"
            >
              Download
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogOpen"
      @close="isEmailDialogOpen = false"
      @send="onExpenseEmailSend"
    />
  </section>

  <VCard v-else>
    <VCardText class="py-10 text-center"> Bill not found. </VCardText>
  </VCard>
</template>

<style lang="scss">
#expense-preview {
  .expense-company-logo {
    display: block;
    flex: 0 0 auto;
    inline-size: auto;
    max-block-size: 4.5rem;
    max-inline-size: 9rem;
    object-fit: contain;
    object-position: left center;
  }

  .expense-detail-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .expense-detail-label {
    color: rgba(var(--v-theme-on-surface), 0.68);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    margin-block-end: 0.25rem;
    text-transform: uppercase;
  }

  .expense-detail-value {
    overflow-wrap: anywhere;
  }

  .expense-attachment-frame {
    border: 0;
    inline-size: 100%;
    min-block-size: 42rem;
  }

  .expense-attachment-image {
    display: block;
    inline-size: 100%;
    max-block-size: 42rem;
    object-fit: contain;
  }
}

@media print {
  #expense-preview {
    .v-card {
      box-shadow: none !important;
    }
  }

  .v-theme--dark {
    --v-theme-surface: 255, 255, 255;
    --v-theme-on-surface: 47, 43, 61;
    --v-theme-on-background: 47, 43, 61;
  }

  body {
    background: none !important;
  }

  .v-navigation-drawer,
  .layout-vertical-nav,
  .app-customizer-toggler,
  .layout-footer,
  .layout-navbar,
  .layout-navbar-and-nav-container,
  .vue-devtools__anchor {
    display: none !important;
  }

  .layout-content-wrapper {
    padding-inline-start: 0 !important;
  }
}
</style>
