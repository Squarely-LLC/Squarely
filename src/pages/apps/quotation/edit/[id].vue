<script lang="ts" setup>
import { requiredValidator, urlValidator } from "@/@core/utils/validators";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import { cloneQuotationRecord, useQuotationsStore } from "@/stores/quotations";
import {
  buildQuotationPaymentDetails,
  getQuotationCompanyAddressLines,
  getQuotationCompanyContactLines,
} from "@/utils/quotationConfig";
import { createQuotationPdfFile } from "@/utils/quotationPdf";
import {
  clearQuotationPreviewDraft,
  loadQuotationPreviewDraft,
  saveQuotationPreviewDraft,
} from "@/utils/quotationPreviewDraft";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";
import { openWhatsAppIntent } from "@/utils/shareToWhatsApp";
import { shareWithSystem } from "@/utils/shareWithSystem";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import QuotationAddPaymentDrawer from "@/views/apps/quotation/QuotationAddPaymentDrawer.vue";
import QuotationEditable from "@/views/apps/quotation/QuotationEditable.vue";
import type {
  PurchasedProduct,
  QuotationData,
} from "@/views/apps/quotation/types";

const route = useRoute("apps-quotation-edit-id");
const router = useRouter();
const configStore = useConfigStore();
configStore.init();
const employeesStore = useEmployeesStore();
employeesStore.init();
const quotationsStore = useQuotationsStore();
quotationsStore.init();

const previewDraft = loadQuotationPreviewDraft();
const sourceRecord =
  previewDraft?.source === "edit" &&
  String(previewDraft.quotation.quotation.id) === String(route.params.id)
    ? previewDraft.quotation
    : quotationsStore.byId(route.params.id);
const quotationData = ref<QuotationData | null>(
  sourceRecord ? cloneQuotationRecord(sourceRecord) : null,
);

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
const paymentTerms = ref(true);
const paymentStub = ref(false);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];
const approvalModes = ["Automatic", "Request Approval"] as const;
const creditCardPaymentLinkError = ref<string | null>(null);
const approvalError = ref<string | null>(null);
const dealOptions = computed(() => {
  const options = new Map<number, { title: string; value: number }>();

  for (const record of quotationsStore.all) {
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

const quotationEmailDraft = computed(() => {
  const currentQuotation = quotationData.value?.quotation;
  const companyName = configStore.legal?.companyName?.trim() || "Squarely";
  const to = currentQuotation?.client.companyEmail?.trim() || "";
  const clientName = currentQuotation?.client.name?.trim() || "there";
  const quoteNumber = currentQuotation?.quoteNumber?.trim() || "quotation";
  const total = Number(currentQuotation?.total || 0).toLocaleString();
  const expiryDate = currentQuotation?.dueDate?.trim() || "";

  return {
    to,
    subject: `Quotation ${quoteNumber} from ${companyName}`,
    message: `Dear ${clientName},

Please find ${quoteNumber} attached.

Quotation amount: $${total}
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

const buildPreviewQuotationDraft = () => {
  if (!quotationData.value) return null;
  if (!validateCreditCardPaymentLink()) return null;
  if (!validateApprovalSelection()) return null;

  const previewQuotation = cloneQuotationRecord(quotationData.value);
  const total = getQuotationGrandTotal(previewQuotation.purchasedProducts);

  previewQuotation.quotation.total = total;
  previewQuotation.paymentDetails = buildQuotationPaymentDetails(
    total,
    configStore.legal,
    configStore.financial,
  );
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

  return previewQuotation;
};

const createDraftQuotationPdfFile = (previewQuotation: QuotationData) =>
  createQuotationPdfFile({
    quotationRecord: previewQuotation,
    companyName: configStore.legal?.companyName?.trim() || "Squarely",
    companyAddressLines: companyAddressLines.value,
    companyContactLines: companyContactLines.value,
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

  saveQuotationPreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const iframe = ensurePreviewActionFrame();
  const routeLocation = router.resolve({
    name: "apps-quotation-preview-id",
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

  saveQuotationPreviewDraft({
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

  saveQuotationPreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const routeLocation = router.resolve({
    name: "apps-quotation-preview-id",
    params: { id: previewQuotation.quotation.id },
    query: { draft: "1", source: "edit" },
  });

  await openWhatsAppIntent({
    url: `${window.location.origin}${routeLocation.href}`,
    text: `Quotation ${previewQuotation.quotation.quoteNumber} for ${previewQuotation.quotation.client.name}`,
  });
};

const shareQuotationWithOthers = async () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveQuotationPreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  const pdfFile = createDraftQuotationPdfFile(previewQuotation);

  await shareWithSystem({
    file: pdfFile,
    title: pdfFile.name,
    text: `Quotation ${previewQuotation.quotation.quoteNumber} for ${previewQuotation.quotation.client.name}`,
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

  quotationsStore.updateQuotation(
    quotationData.value.quotation.id,
    cloneQuotationRecord(quotationData.value),
  );

  clearQuotationPreviewDraft();
  router.push({
    name: "apps-quotation-preview-id",
    params: { id: quotationData.value.quotation.id },
  });
};

const openPreview = async () => {
  const previewQuotation = buildPreviewQuotationDraft();
  if (!previewQuotation) return;

  saveQuotationPreviewDraft({
    source: "edit",
    quotation: previewQuotation,
  });

  await router.push({
    name: "apps-quotation-preview-id",
    params: { id: previewQuotation.quotation.id },
    query: { draft: "1", source: "edit" },
  });
};

onBeforeUnmount(() => {
  if (previewActionFrame.value?.parentNode) {
    previewActionFrame.value.parentNode.removeChild(previewActionFrame.value);
  }

  previewActionFrame.value = null;
});
</script>

<template>
  <VRow v-if="quotationData?.quotation">
    <VCol cols="12" md="9">
      <QuotationEditable
        :data="quotationData"
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
            @click="isAddPaymentSidebarActive = true"
          >
            Add Payment
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
        <VLabel for="payment-terms">Payment Terms</VLabel>
        <div>
          <VSwitch id="payment-terms" v-model="paymentTerms" />
        </div>
      </div>

      <div class="d-flex align-center justify-space-between">
        <VLabel for="client-notes">Client Notes</VLabel>
        <div>
          <VSwitch id="client-notes" v-model="quotationData.showClientNote" />
        </div>
      </div>

      <div class="d-flex align-center justify-space-between">
        <VLabel for="payment-stub">Payment Stub</VLabel>
        <div>
          <VSwitch id="payment-stub" v-model="paymentStub" />
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
    <QuotationAddPaymentDrawer
      v-model:is-drawer-open="isAddPaymentSidebarActive"
    />
  </VRow>

  <section v-else>
    <VAlert type="error" variant="tonal">
      Quotation with ID {{ route.params.id }} not found!
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
</style>
