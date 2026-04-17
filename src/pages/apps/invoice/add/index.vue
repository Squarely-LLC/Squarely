<script lang="ts" setup>
import { requiredValidator, urlValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type { Client } from "@/plugins/fake-api/handlers/apps/invoice/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useEmployeesStore } from "@/stores/employees";
import {
  cloneInvoiceRecord,
  getInvoiceOutstandingBalance,
  useInvoicesStore,
} from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import {
  clearInvoicePreviewDraft,
  loadInvoicePreviewDraft,
  saveInvoicePreviewDraft,
} from "@/utils/invoicePreviewDraft";
import {
  buildDocumentNote,
  buildQuotationPaymentDetails,
  buildQuotationSalesperson,
  buildQuotationThanksNote,
  formatCurrencyAmount,
  getDocumentSequencePrefix,
} from "@/utils/quotationConfig";
import { getQuotationGrandTotal } from "@/utils/quotationPricing";
import InvoiceEditable from "@/views/apps/invoice/InvoiceEditable.vue";
import type { InvoiceData, PurchasedProduct } from "@/views/apps/invoice/types";
import { onBeforeRouteLeave } from "vue-router";

const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
configStore.init();
const contactsStore = useContactsStore();
contactsStore.init();
const employeesStore = useEmployeesStore();
employeesStore.init();
const invoicesStore = useInvoicesStore();
invoicesStore.init();
const notifications = useNotificationsStore();

const mapContactToClient = (contact: ContactProperties): Client => ({
  address: contact.address?.trim() || "",
  company: contact.fullName.trim(),
  companyEmail: contact.email?.trim() || "",
  country: contact.country?.trim() || "Lebanon",
  contact: contact.number?.trim() || "",
  name: contact.fullName.trim(),
});

const buildDefaultClient = (): Client => {
  const firstContact = contactsStore.all.find((contact) =>
    contact.fullName?.trim(),
  );

  if (firstContact) return mapContactToClient(firstContact);

  return {
    address: "",
    company: "",
    companyEmail: "",
    country: "Lebanon",
    contact: "",
    name: "",
  };
};

const buildBlankQuotation = (): InvoiceData => {
  const id = invoicesStore.nextId();

  return {
    quotation: {
      id,
      quoteNumber: `${getDocumentSequencePrefix("invoice")}${id}`,
      issuedDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      client: buildDefaultClient(),
      service: "Architectural services",
      total: 0,
      avatar: "",
      quotationStatus: "Not Paid",
      balance: 0,
      dealId: null,
      linkedRecordType: null,
      source: "squarely",
      attachmentName: null,
      parentQuotationId: null,
      isRevision: false,
      revisionLabel: null,
    },
    paymentDetails: buildQuotationPaymentDetails(
      0,
      configStore.legal,
      configStore.financial,
    ),
    payments: [],
    purchasedProducts: [
      {
        catalogueItemId: null,
        title: "",
        cost: 0,
        hours: 1,
        discountType: "none",
        discountValue: 0,
        description: "",
      },
    ],
    note: buildDocumentNote(configStore.financial, "invoice", 7),
    showClientNote: configStore.financial?.invoicing?.showNotes ?? true,
    totalFx: null,
    paymentMethod: "Bank Transfer",
    paymentLink: null,
    approvalMode: "Automatic",
    approverEmployeeId: null,
    salesperson: buildQuotationSalesperson(configStore.legal),
    thanksNote: buildQuotationThanksNote(configStore.legal),
  };
};

const getBaseQuoteNumber = (quoteNumber: string) =>
  quoteNumber.trim().replace(/(?:-R\d+)+$/i, "");

const buildRevisionDraft = (parentId: number): InvoiceData => {
  const sourceRecord = invoicesStore.byId(parentId);
  if (!sourceRecord) return buildBlankQuotation();

  const rootQuotationId =
    sourceRecord.quotation.parentQuotationId ?? sourceRecord.quotation.id;
  const baseQuoteNumberForLookup = getBaseQuoteNumber(
    sourceRecord.quotation.quoteNumber,
  );
  const revisionPattern = new RegExp(
    `^${baseQuoteNumberForLookup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-R(\\d+)$`,
    "i",
  );
  const maxExistingNumber = invoicesStore.all.reduce((max, record) => {
    const match = record.quotation.quoteNumber.match(revisionPattern);
    return match?.[1] ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const revisionNumber = maxExistingNumber + 1;
  const revisionLabel = `R${revisionNumber}`;
  const revisionId = invoicesStore.nextId();
  const baseQuoteNumber = getBaseQuoteNumber(
    sourceRecord.quotation.quoteNumber,
  );
  const revisionQuoteNumber = `${baseQuoteNumber}-${revisionLabel}`;
  const revisionDraft = cloneInvoiceRecord(sourceRecord);

  revisionDraft.quotation.id = revisionId;
  revisionDraft.quotation.quoteNumber = revisionQuoteNumber;
  revisionDraft.quotation.parentQuotationId = rootQuotationId;
  revisionDraft.quotation.isRevision = true;
  revisionDraft.quotation.revisionLabel = revisionLabel;
  revisionDraft.quotation.issuedDate = new Date().toISOString().slice(0, 10);
  revisionDraft.quotation.dueDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  revisionDraft.quotation.quotationStatus = "Not Paid";
  revisionDraft.note = `${sourceRecord.note}\n${revisionLabel} draft created from ${baseQuoteNumber}.`;

  return revisionDraft;
};

const buildInitialQuotation = (): InvoiceData => {
  const previewDraft = loadInvoicePreviewDraft();
  if (previewDraft?.source === "add") {
    return cloneInvoiceRecord(previewDraft.quotation);
  }

  const revisionOf = Number(route.query.revisionOf);

  if (Number.isFinite(revisionOf) && revisionOf > 0) {
    return buildRevisionDraft(revisionOf);
  }

  return buildBlankQuotation();
};

const quotationData = ref<InvoiceData>(buildInitialQuotation());
const initialDraftSnapshot = ref("");
const paymentTerms = ref(true);
const paymentStub = ref(false);
const paymentMethods = ["Bank Transfer", "Cash", "Credit Card"];
const approvalModes = ["Automatic", "Request Approval"] as const;
const creditCardPaymentLinkError = ref<string | null>(null);
const approvalError = ref<string | null>(null);
const isLeaveDialogVisible = ref(false);
const pendingNavigationTarget = ref<Parameters<typeof router.push>[0] | null>(
  null,
);
const bypassUnsavedWarning = ref(false);

const buildDraftSnapshot = (draft: InvoiceData) =>
  JSON.stringify(cloneInvoiceRecord(draft));

initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);

const hasUnsavedChanges = computed(
  () => buildDraftSnapshot(quotationData.value) !== initialDraftSnapshot.value,
);
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

watch(
  () => route.query.revisionOf,
  () => {
    quotationData.value = buildInitialQuotation();
    initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);
  },
);

watch(
  () => quotationData.value.paymentMethod,
  (paymentMethod) => {
    if (paymentMethod !== "Credit Card") {
      quotationData.value.paymentLink = null;
      creditCardPaymentLinkError.value = null;
    }
  },
);

watch(
  () => quotationData.value.approvalMode,
  (approvalMode) => {
    if (approvalMode !== "Request Approval") {
      quotationData.value.approverEmployeeId = null;
      approvalError.value = null;
    }
  },
);

watch(
  () => quotationData.value.paymentLink,
  (paymentLink) => {
    if (quotationData.value.paymentMethod !== "Credit Card") {
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
  if (quotationData.value.paymentMethod !== "Credit Card") {
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
  if (quotationData.value.approvalMode !== "Request Approval") {
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

const addProduct = (value: PurchasedProduct) => {
  quotationData.value.purchasedProducts.push(value);
};

const removeProduct = (id: number) => {
  quotationData.value.purchasedProducts.splice(id, 1);
};

const requestLeave = (target: Parameters<typeof router.push>[0]) => {
  if (!hasUnsavedChanges.value) {
    router.push(target);
    return;
  }

  pendingNavigationTarget.value = target;
  isLeaveDialogVisible.value = true;
};

const cancelLeave = () => {
  pendingNavigationTarget.value = null;
  isLeaveDialogVisible.value = false;
};

const confirmLeave = async () => {
  const target = pendingNavigationTarget.value;

  pendingNavigationTarget.value = null;
  isLeaveDialogVisible.value = false;
  if (!target) return;

  bypassUnsavedWarning.value = true;
  await router.push(target);
};

const saveQuotation = () => {
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

  const created = invoicesStore.addInvoice(
    cloneInvoiceRecord(quotationData.value),
  );
  if (!created) return;

  notifications.push(
    `Invoice ${created.quotation.quoteNumber} saved successfully.`,
    "success",
    3500,
  );

  clearInvoicePreviewDraft();
  initialDraftSnapshot.value = buildDraftSnapshot(quotationData.value);
  bypassUnsavedWarning.value = true;
  router.push({
    name: "apps-invoice-preview-id",
    params: { id: created.quotation.id },
  });
};

const openPreview = async () => {
  if (!validateCreditCardPaymentLink()) return;
  if (!validateApprovalSelection()) return;

  const previewDraft = cloneInvoiceRecord(quotationData.value);
  const total = getQuotationGrandTotal(previewDraft.purchasedProducts);

  previewDraft.quotation.total = total;
  previewDraft.paymentDetails = buildQuotationPaymentDetails(
    total,
    configStore.legal,
    configStore.financial,
  );
  previewDraft.quotation.balance = getInvoiceOutstandingBalance(previewDraft);
  previewDraft.paymentDetails.totalDue = formatCurrencyAmount(
    previewDraft.quotation.balance,
    configStore.financial,
  );
  previewDraft.paymentLink =
    previewDraft.paymentMethod === "Credit Card"
      ? previewDraft.paymentLink?.trim() || null
      : null;
  previewDraft.quotation.linkedRecordType = previewDraft.quotation.dealId
    ? "deal"
    : null;
  previewDraft.approverEmployeeId =
    previewDraft.approvalMode === "Request Approval"
      ? (previewDraft.approverEmployeeId ?? null)
      : null;

  saveInvoicePreviewDraft({
    source: "add",
    quotation: previewDraft,
  });

  bypassUnsavedWarning.value = true;
  await router.push({
    name: "apps-invoice-preview-id",
    params: { id: previewDraft.quotation.id },
    query: { draft: "1", source: "add" },
  });
};

onBeforeRouteLeave((to) => {
  if (bypassUnsavedWarning.value) {
    bypassUnsavedWarning.value = false;
    return true;
  }

  if (!hasUnsavedChanges.value) return true;

  pendingNavigationTarget.value = to.fullPath;
  isLeaveDialogVisible.value = true;
  return false;
});

const onBeforeWindowUnload = (event: BeforeUnloadEvent) => {
  if (!hasUnsavedChanges.value) return;

  event.preventDefault();
  event.returnValue = "";
};

onMounted(() => {
  window.addEventListener("beforeunload", onBeforeWindowUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeWindowUnload);
});
</script>

<template>
  <VRow>
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
          <VBtn
            block
            color="secondary"
            variant="tonal"
            class="mb-4"
            @click="openPreview"
          >
            Preview
          </VBtn>

          <VBtn
            block
            color="secondary"
            variant="tonal"
            class="mb-4"
            @click="requestLeave({ name: 'apps-invoice-list' })"
            >Back to List</VBtn
          >

          <VBtn block @click="saveQuotation">Save</VBtn>
        </VCardText>
      </VCard>

      <AppSelect
        id="payment-method"
        v-model="quotationData.paymentMethod"
        :items="paymentMethods"
        label="Accept Payment Via"
        class="mb-6"
      />

      <AppTextField
        id="total-fx"
        v-model="quotationData.totalFx"
        label="Total FX"
        placeholder="Enter total FX"
        class="mb-6"
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
        class="mb-6"
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
  </VRow>

  <VDialog v-model="isLeaveDialogVisible" max-width="440" persistent>
    <VCard>
      <VCardText class="pt-6">
        You have unsaved changes in this invoice. Leave this page without
        saving?
      </VCardText>

      <VCardActions class="pt-2 px-6 pb-6">
        <DialogActionBar
          save-text="Leave"
          save-color="error"
          save-variant="tonal"
          cancel-text="Stay"
          @save="confirmLeave"
          @cancel="cancelLeave"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>
