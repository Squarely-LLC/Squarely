<script setup lang="ts">
import { emailValidator } from "@/@core/utils/validators";
import type {
  ReceiptRecord,
  ReceiptSourceType,
} from "@/plugins/fake-api/handlers/apps/receipt/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

export type ReceiptClientOption = {
  title: string;
  value: string;
  client: ReceiptRecord["receipt"]["client"];
};

export type ReceiptDocumentOption = {
  title: string;
  value: string;
  documentId: number;
  documentType: "invoice" | "proforma";
  documentNumber: string;
  clientKey: string;
  client: ReceiptRecord["receipt"]["client"];
  amount: number;
  balance: number | null;
  allocatedAmount: number;
  paymentMethod: string;
};

export type ReceiptDrawerSubmitPayload = {
  id: number | null;
  receipt: ReceiptRecord["receipt"];
  paymentMethod: string;
  note: string;
  attachment: File | null;
};

interface Props {
  isDrawerOpen: boolean;
  editingReceipt?: ReceiptRecord | null;
  clientOptions: ReceiptClientOption[];
  invoiceOptions: ReceiptDocumentOption[];
  proformaOptions: ReceiptDocumentOption[];
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: ReceiptDrawerSubmitPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const drawerOpen = ref<boolean>(props.isDrawerOpen ?? false);

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
const paymentMethodOptions = ["Bank", "Card", "Credit"];

const normalisePaymentMethod = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() || "";

  if (normalized === "bank" || normalized === "bank transfer") {
    return "Bank";
  }

  if (
    normalized === "card" ||
    normalized === "credit card" ||
    normalized === "debit"
  ) {
    return "Card";
  }

  if (normalized === "credit") {
    return "Credit";
  }

  return "Bank";
};

const receivedDate = ref("");
const amount = ref<string | number>("");
const paymentMethod = ref("Bank");
const selectedClientKey = ref("");
const relatedDocumentKey = ref<string | null>(null);
const clientName = ref("");
const clientEmail = ref("");
const clientAddress = ref("");
const clientCountry = ref("Lebanon");
const clientContact = ref("");
const note = ref("");
const attachment = ref<File | File[] | null>(null);

const receivedDateError = ref<string | null>(null);
const amountError = ref<string | null>(null);
const paymentMethodError = ref<string | null>(null);
const clientError = ref<string | null>(null);
const clientEmailError = ref<string | null>(null);
const attachmentError = ref<string | null>(null);

const drawerTitle = computed(() =>
  props.editingReceipt ? "Edit Receipt" : "Add Receipt",
);

const selectedAttachment = computed<File | null>(() => {
  const value = attachment.value;
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
});

const baseDocumentOptions = computed(() => [
  ...props.invoiceOptions,
  ...props.proformaOptions,
]);

const editingClientOption = computed<ReceiptClientOption | null>(() => {
  const editingReceipt = props.editingReceipt;
  if (!editingReceipt) return null;

  const client = editingReceipt.receipt.client;
  const key = `${client.name.trim().toLowerCase()}::${client.companyEmail.trim().toLowerCase()}`;
  if (props.clientOptions.some((option) => option.value === key)) return null;

  return {
    title: client.name || client.company || client.companyEmail || "Client",
    value: key,
    client,
  };
});

const availableClientOptions = computed(() =>
  editingClientOption.value
    ? [editingClientOption.value, ...props.clientOptions]
    : props.clientOptions,
);

const selectedClient = computed(
  () =>
    availableClientOptions.value.find(
      (option) => option.value === selectedClientKey.value,
    ) ?? null,
);

const availableRelatedOptions = computed(() =>
  selectedClientKey.value
    ? baseDocumentOptions.value.filter(
        (option) => option.clientKey === selectedClientKey.value,
      )
    : [],
);

const selectedRelatedDocument = computed(
  () =>
    baseDocumentOptions.value.find(
      (option) => option.value === relatedDocumentKey.value,
    ) ?? null,
);

const inferredSourceType = computed<ReceiptSourceType>(() => {
  if (selectedRelatedDocument.value?.documentType === "invoice")
    return "invoice";
  if (selectedRelatedDocument.value?.documentType === "proforma")
    return "proforma";
  if (selectedAttachment.value) return "attachment";
  return "manual";
});

const editingReceiptAdjustment = computed(() => {
  const currentReceipt = props.editingReceipt?.receipt;
  const relatedDocument = selectedRelatedDocument.value;
  if (!currentReceipt || !relatedDocument) return 0;

  const matchesInvoice =
    relatedDocument.documentType === "invoice" &&
    currentReceipt.linkedInvoiceId === relatedDocument.documentId;
  const matchesProforma =
    relatedDocument.documentType === "proforma" &&
    currentReceipt.linkedProformaId === relatedDocument.documentId;

  return matchesInvoice || matchesProforma ? currentReceipt.amount : 0;
});

const currentAvailableAmount = computed(() => {
  const relatedDocument = selectedRelatedDocument.value;
  if (!relatedDocument) return null;

  const documentBalance = relatedDocument.balance ?? relatedDocument.amount;

  return Math.max(
    0,
    Number(documentBalance || 0) -
      Number(relatedDocument.allocatedAmount || 0) +
      editingReceiptAdjustment.value,
  );
});

const selectedBalanceText = computed(() => {
  const relatedDocument = selectedRelatedDocument.value;
  if (!relatedDocument) {
    return "Total Balance: select a related invoice or proforma.";
  }

  const balance = currentAvailableAmount.value ?? 0;
  return `Total Balance: Credit Amount: $${Number(balance || 0).toLocaleString()}`;
});

const isFlaggedState = computed(
  () =>
    inferredSourceType.value === "manual" ||
    inferredSourceType.value === "attachment",
);

const resetValidation = () => {
  receivedDateError.value = null;
  amountError.value = null;
  paymentMethodError.value = null;
  clientError.value = null;
  clientEmailError.value = null;
  attachmentError.value = null;
};

const applyClient = (client: ReceiptRecord["receipt"]["client"] | null) => {
  if (!client) {
    clientName.value = "";
    clientEmail.value = "";
    clientAddress.value = "";
    clientCountry.value = "Lebanon";
    clientContact.value = "";
    return;
  }

  clientName.value = client.name || client.company || "";
  clientEmail.value = client.companyEmail || "";
  clientAddress.value = client.address || "";
  clientCountry.value = client.country || "Lebanon";
  clientContact.value = client.contact || "";
};

const resetForm = () => {
  const editingReceipt = props.editingReceipt;

  if (editingReceipt) {
    receivedDate.value = editingReceipt.receipt.receivedDate;
    amount.value = editingReceipt.receipt.amount;
    paymentMethod.value = normalisePaymentMethod(editingReceipt.paymentMethod);
    selectedClientKey.value = `${editingReceipt.receipt.client.name.trim().toLowerCase()}::${editingReceipt.receipt.client.companyEmail.trim().toLowerCase()}`;
    relatedDocumentKey.value = editingReceipt.receipt.linkedInvoiceId
      ? `invoice:${editingReceipt.receipt.linkedInvoiceId}`
      : editingReceipt.receipt.linkedProformaId
        ? `proforma:${editingReceipt.receipt.linkedProformaId}`
        : null;
    applyClient(editingReceipt.receipt.client);
    note.value = editingReceipt.note || "";
    attachment.value = null;
    resetValidation();
    return;
  }

  receivedDate.value = new Date().toISOString().slice(0, 10);
  amount.value = "";
  paymentMethod.value = "Bank";
  selectedClientKey.value = "";
  relatedDocumentKey.value = null;
  applyClient(null);
  note.value = "";
  attachment.value = null;
  resetValidation();
};

watch(
  () => [props.isDrawerOpen, props.editingReceipt] as const,
  ([isDrawerOpen]) => {
    drawerOpen.value = !!isDrawerOpen;
    if (!isDrawerOpen) return;
    resetForm();
  },
  { immediate: true },
);

watch(drawerOpen, (value) => {
  emit("update:isDrawerOpen", value);
});

watch(selectedClientKey, (value) => {
  const relatedDocument = selectedRelatedDocument.value;
  if (relatedDocument && relatedDocument.clientKey !== value) {
    relatedDocumentKey.value = null;
  }

  if (!selectedRelatedDocument.value) {
    applyClient(selectedClient.value?.client ?? null);
    if (selectedClient.value && !note.value.trim()) {
      note.value = `Receipt from ${selectedClient.value.client.name || selectedClient.value.client.company}.`;
    }
  }
});

watch(relatedDocumentKey, () => {
  const relatedDocument = selectedRelatedDocument.value;
  if (!relatedDocument) {
    applyClient(selectedClient.value?.client ?? null);
    return;
  }

  if (selectedClientKey.value !== relatedDocument.clientKey) {
    selectedClientKey.value = relatedDocument.clientKey;
  }
  applyClient(relatedDocument.client);
  paymentMethod.value = normalisePaymentMethod(relatedDocument.paymentMethod);

  if (!amount.value || Number(amount.value) <= 0) {
    amount.value = currentAvailableAmount.value ?? relatedDocument.amount;
  }

  if (!note.value.trim()) {
    note.value = `Receipt from ${relatedDocument.client.name || relatedDocument.client.company}.`;
  }
});

const validateAttachment = () => {
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

const onSubmit = () => {
  const numericAmount = Math.max(0, Number(amount.value) || 0);
  const trimmedEmail = clientEmail.value.trim();
  const sourceType = inferredSourceType.value;
  const availableAmount = currentAvailableAmount.value;

  receivedDateError.value = receivedDate.value.trim()
    ? null
    : "Receipt date is required";
  amountError.value =
    numericAmount > 0
      ? availableAmount !== null && numericAmount > availableAmount
        ? "Receipt amount cannot exceed the remaining balance after recorded receipts."
        : null
      : "Enter an amount greater than 0";
  paymentMethodError.value = paymentMethod.value.trim()
    ? null
    : "Select a payment method";
  clientError.value = clientName.value.trim() ? null : "Select a client";
  clientEmailError.value = trimmedEmail
    ? emailValidator(trimmedEmail) === true
      ? null
      : "Enter a valid email address"
    : null;
  attachmentError.value = validateAttachment() || null;

  if (
    receivedDateError.value ||
    amountError.value ||
    paymentMethodError.value ||
    clientError.value ||
    clientEmailError.value ||
    attachmentError.value
  ) {
    return;
  }

  emit("submit", {
    id: props.editingReceipt?.receipt.id ?? null,
    receipt: {
      id: props.editingReceipt?.receipt.id ?? 0,
      receiptNumber: props.editingReceipt?.receipt.receiptNumber ?? "",
      issuedDate: receivedDate.value,
      receivedDate: receivedDate.value,
      client: {
        address: clientAddress.value.trim(),
        company: clientName.value.trim(),
        companyEmail: trimmedEmail,
        country: clientCountry.value.trim() || "Lebanon",
        contact: clientContact.value.trim(),
        name: clientName.value.trim(),
      },
      amount: numericAmount,
      avatar: props.editingReceipt?.receipt.avatar ?? "",
      status: isFlaggedState.value ? "Flagged" : "Recorded",
      sourceType,
      linkedInvoiceId:
        selectedRelatedDocument.value?.documentType === "invoice"
          ? selectedRelatedDocument.value.documentId
          : null,
      linkedInvoiceNumber:
        selectedRelatedDocument.value?.documentType === "invoice"
          ? selectedRelatedDocument.value.documentNumber
          : null,
      linkedProformaId:
        selectedRelatedDocument.value?.documentType === "proforma"
          ? selectedRelatedDocument.value.documentId
          : null,
      linkedProformaNumber:
        selectedRelatedDocument.value?.documentType === "proforma"
          ? selectedRelatedDocument.value.documentNumber
          : null,
      attachmentName:
        selectedAttachment.value?.name ??
        props.editingReceipt?.receipt.attachmentName ??
        null,
      attachmentFileKey:
        props.editingReceipt?.receipt.attachmentFileKey ?? null,
    },
    paymentMethod: paymentMethod.value.trim(),
    note: note.value.trim(),
    attachment: selectedAttachment.value,
  });
};

const handleDrawerModelValueUpdate = (value: boolean) => {
  drawerOpen.value = value;
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="420"
    :scrim="true"
    border="none"
    style="z-index: 2000"
    :model-value="drawerOpen"
    class="scrollable-content"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection
      :title="drawerTitle"
      @cancel="$emit('update:isDrawerOpen', false)"
    />
    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppSelect
                  v-model="selectedClientKey"
                  label="Name"
                  placeholder="Select client"
                  :items="availableClientOptions"
                  :error-messages="clientError ? [clientError] : []"
                />
              </VCol>

              <VCol cols="12">
                <div class="text-body-2 text-medium-emphasis">
                  {{ selectedBalanceText }}
                </div>
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="relatedDocumentKey"
                  label="Payment Related To"
                  placeholder="Select invoice or proforma"
                  :items="availableRelatedOptions"
                  clearable
                  clear-icon="tabler-x"
                  :disabled="!selectedClientKey"
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  v-model="receivedDate"
                  label="Date"
                  placeholder="Select date"
                  :error-messages="receivedDateError ? [receivedDateError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="note"
                  label="Note"
                  placeholder="Receipt note"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="paymentMethod"
                  label="Select Payment Method"
                  placeholder="Select Payment Method"
                  :items="paymentMethodOptions"
                  :error-messages="
                    paymentMethodError ? [paymentMethodError] : []
                  "
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="amount"
                  label="Transfer Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :error-messages="amountError ? [amountError] : []"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput
                  v-model="attachment"
                  label="Attachment File"
                  placeholder="Choose file"
                  :accept="attachmentAccept"
                  show-size
                  clearable
                  :error-messages="attachmentError ? [attachmentError] : []"
                />
              </VCol>

              <VCol cols="12">
                <VAlert
                  v-if="isFlaggedState"
                  color="warning"
                  variant="tonal"
                  border="start"
                >
                  This receipt will be flagged unless it is linked to a Squarely
                  invoice or proforma.
                </VAlert>
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3"> Submit </VBtn>
                <VBtn
                  type="reset"
                  color="secondary"
                  variant="tonal"
                  @click="$emit('update:isDrawerOpen', false)"
                >
                  Cancel
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
