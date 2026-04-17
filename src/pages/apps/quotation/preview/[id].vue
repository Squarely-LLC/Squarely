<script setup lang="ts">
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useNotificationsStore } from "@/stores/notifications";
import {
  applyQuotationPayment,
  getQuotationOutstandingBalance,
  useQuotationsStore,
  type QuotationPaymentInput,
} from "@/stores/quotations";
import { createPdfFileFromElement } from "@/utils/domPdf";
import {
  buildQuotationPaymentDetails,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
  resolveQuotationLogoUrl,
} from "@/utils/quotationConfig";
import { createQuotationPdfFile } from "@/utils/quotationPdf";
import {
  loadQuotationPreviewDraft,
  saveQuotationPreviewDraft,
} from "@/utils/quotationPreviewDraft";
import {
  getLineTotal,
  getQuotationDiscountTotal,
  getQuotationGrandTotal,
  getQuotationSubtotal,
} from "@/utils/quotationPricing";
import { openWhatsAppIntent } from "@/utils/shareToWhatsApp";
import { shareWithSystem } from "@/utils/shareWithSystem";
import { formatSystemDate } from "@core/utils/formatters";

import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import QuotationAddPaymentDrawer from "@/views/apps/quotation/QuotationAddPaymentDrawer.vue";
import type { QuotationRecord } from "@db/apps/quotation/types";

const route = useRoute("apps-quotation-preview-id");
const isEmbeddedActionFrame = route.query.embedded === "1";
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
    return { name: "apps-quotation-add" as const };
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

const isAddPaymentSidebarVisible = ref(false);
const isSendPaymentSidebarVisible = ref(false);
const hasExecutedAutoAction = ref(false);
const emailDialogRef = ref<any | null>(null);
const quotationPdfTarget = ref<any | null>(null);
const currentQuotationBalance = computed(() =>
  quotationRecord.value
    ? getQuotationOutstandingBalance(quotationRecord.value)
    : 0,
);

const printQuotation = () => {
  window.print();
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
  const total = Number(currentQuotation?.total || 0).toLocaleString();
  const expiryDate = currentQuotation?.dueDate?.trim() || "";

  return {
    to,
    subject: `Quotation ${quoteNumber} from ${companyName.value}`,
    message: `Dear ${clientName},

Please find ${quoteNumber} attached.

Quotation amount: $${total}
${expiryDate ? `Expiry date: ${expiryDate}` : ""}

Thank you,
${companyName.value}`.trim(),
    attachments: [
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

const shareQuotationOnWhatsApp = async () => {
  const currentQuotation = quotation.value;
  if (!currentQuotation) return;

  await openWhatsAppIntent({
    url: window.location.href,
    text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
  });
};

const shareQuotationWithOthers = async () => {
  const currentQuotation = quotation.value;
  const pdfFile = createCurrentQuotationPdfFile();
  if (!currentQuotation || !pdfFile) return;

  await shareWithSystem({
    file: pdfFile,
    title: pdfFile.name,
    text: `Quotation ${currentQuotation.quoteNumber} for ${currentQuotation.client.name}`,
  });
};

const recordQuotationPayment = (payment: QuotationPaymentInput) => {
  const currentRecord = quotationRecord.value;
  if (!currentRecord) return;

  const updatedRecord = applyQuotationPayment(currentRecord, payment);

  if (draftPreview.value) {
    const updatedDraft = {
      source: draftPreview.value.source,
      quotation: updatedRecord,
    };

    draftPreviewState.value = updatedDraft;
    saveQuotationPreviewDraft(updatedDraft);
    notifications.push(
      `Payment of $${payment.amount.toLocaleString()} added successfully.`,
      "success",
      3500,
    );
    return;
  }

  quotationsStore.updateQuotation(updatedRecord.quotation.id, updatedRecord);
  notifications.push(
    `Payment of $${payment.amount.toLocaleString()} added successfully.`,
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

  window.print();
};

onMounted(() => {
  if (!isEmbeddedActionFrame) return;

  window.addEventListener("message", handleEmbeddedPreviewMessage);
  window.parent?.postMessage(
    { type: "quotation-preview-ready" },
    window.location.origin,
  );
});

onBeforeUnmount(() => {
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
        window.print();
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
              <div class="quotation-company-brand mb-6">
                <img
                  v-if="companyLogoUrl"
                  :src="companyLogoUrl"
                  :alt="companyName"
                  class="quotation-company-logo"
                />
                <h6 class="app-logo-title quotation-company-title">
                  {{ companyName }}
                </h6>
              </div>

              <h6
                v-for="(line, index) in companyAddressLines"
                :key="`address-${index}`"
                class="text-h6 font-weight-regular"
              >
                {{ line }}
              </h6>
              <h6
                v-for="(line, index) in companyContactLines"
                :key="`contact-${index}`"
                class="text-h6 font-weight-regular"
              >
                {{ line }}
              </h6>
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

          <VRow class="print-row mb-6">
            <VCol class="text-no-wrap">
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

            <VCol class="text-no-wrap">
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
                <td class="text-center">${{ item.cost }}</td>
                <td class="text-center">${{ getLineTotal(item) }}</td>
              </tr>
            </tbody>
          </VTable>

          <div class="d-flex justify-end flex-column flex-sm-row print-row">
            <div>
              <table class="w-100">
                <tbody>
                  <tr>
                    <td class="pe-16">Subtotal:</td>
                    <td
                      :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'"
                    >
                      <h6 class="text-base font-weight-medium">
                        ${{ subtotal.toLocaleString() }}
                      </h6>
                    </td>
                  </tr>
                  <tr>
                    <td class="pe-16">Discount:</td>
                    <td
                      :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'"
                    >
                      <h6 class="text-base font-weight-medium">
                        ${{ discountTotal.toLocaleString() }}
                      </h6>
                    </td>
                  </tr>
                  <tr>
                    <td class="pe-16">VAT:</td>
                    <td
                      :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'"
                    >
                      <h6 class="text-base font-weight-medium">Included</h6>
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
                      :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'"
                    >
                      <h6 class="text-base font-weight-medium">
                        ${{ grandTotal.toLocaleString() }}
                      </h6>
                    </td>
                  </tr>
                  <tr v-if="quotationRecord?.totalFx?.trim()">
                    <td class="pe-16">Total FX:</td>
                    <td
                      :class="$vuetify.locale.isRtl ? 'text-start' : 'text-end'"
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

          <template v-if="quotationRecord?.showClientNote">
            <VDivider class="my-6 border-dashed" />

            <p class="mb-0">
              <span class="text-high-emphasis font-weight-medium me-1">
                Client Note:
              </span>
              <span>{{ quotationRecord?.note }}</span>
            </p>
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
              Add Payment
            </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <QuotationAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarVisible"
      :current-balance="currentQuotationBalance"
      :default-payment-method="quotationRecord?.paymentMethod"
      @submit="recordQuotationPayment"
    />

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isSendPaymentSidebarVisible"
    />
  </section>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Quotation with ID {{ route.params.id }} not found!
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
