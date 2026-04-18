<script setup lang="ts">
import { emailValidator } from "@/@core/utils/validators";
import type {
  ReceiptRecord,
  ReceiptSourceType,
} from "@/plugins/fake-api/handlers/apps/receipt/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

type ReceiptDocumentOption = {
  title: string;
  value: number;
  documentNumber: string;
  client: ReceiptRecord["receipt"]["client"];
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
  invoiceOptions: ReceiptDocumentOption[];
  proformaOptions: ReceiptDocumentOption[];
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: ReceiptDrawerSubmitPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

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

const receiptNumber = ref("");
const receivedDate = ref("");
const amount = ref<string | number>("");
const paymentMethod = ref("Cash");
const sourceType = ref<ReceiptSourceType>("invoice");
const linkedInvoiceId = ref<number | null>(null);
const linkedProformaId = ref<number | null>(null);
const clientName = ref("");
const clientEmail = ref("");
const clientAddress = ref("");
const clientCountry = ref("Lebanon");
const clientContact = ref("");
const note = ref("");
const attachment = ref<File | File[] | null>(null);

const receiptNumberError = ref<string | null>(null);
const receivedDateError = ref<string | null>(null);
const amountError = ref<string | null>(null);
const paymentMethodError = ref<string | null>(null);
const sourceTypeError = ref<string | null>(null);
const linkError = ref<string | null>(null);
const clientNameError = ref<string | null>(null);
const clientEmailError = ref<string | null>(null);
const attachmentError = ref<string | null>(null);

const drawerTitle = computed(() =>
  props.editingReceipt ? "Edit Receipt" : "Add Receipt",
);

const sourceTypeItems = [
  { title: "Invoice through Squarely", value: "invoice" },
  { title: "Proforma through Squarely", value: "proforma" },
  { title: "Without invoice or proforma", value: "manual" },
  { title: "Attachment only", value: "attachment" },
] satisfies { title: string; value: ReceiptSourceType }[];

const selectedAttachment = computed<File | null>(() => {
  const value = attachment.value;
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
});

const selectedInvoice = computed(
  () =>
    props.invoiceOptions.find(
      (option) => option.value === linkedInvoiceId.value,
    ) ?? null,
);
const selectedProforma = computed(
  () =>
    props.proformaOptions.find(
      (option) => option.value === linkedProformaId.value,
    ) ?? null,
);
const isLinkedSource = computed(
  () => sourceType.value === "invoice" || sourceType.value === "proforma",
);
const selectedLinkedOption = computed(() =>
  sourceType.value === "invoice"
    ? selectedInvoice.value
    : selectedProforma.value,
);
const clientFieldsReadonly = computed(() => isLinkedSource.value);

const resetValidation = () => {
  receiptNumberError.value = null;
  receivedDateError.value = null;
  amountError.value = null;
  paymentMethodError.value = null;
  sourceTypeError.value = null;
  linkError.value = null;
  clientNameError.value = null;
  clientEmailError.value = null;
  attachmentError.value = null;
};

const applyLinkedClient = () => {
  const linkedOption = selectedLinkedOption.value;
  if (!linkedOption) {
    if (!isLinkedSource.value) return;
    clientName.value = "";
    clientEmail.value = "";
    clientAddress.value = "";
    clientCountry.value = "Lebanon";
    clientContact.value = "";
    return;
  }

  clientName.value =
    linkedOption.client.name || linkedOption.client.company || "";
  clientEmail.value = linkedOption.client.companyEmail || "";
  clientAddress.value = linkedOption.client.address || "";
  clientCountry.value = linkedOption.client.country || "Lebanon";
  clientContact.value = linkedOption.client.contact || "";
};

const resetForm = () => {
  const editingReceipt = props.editingReceipt;

  if (editingReceipt) {
    receiptNumber.value = editingReceipt.receipt.receiptNumber;
    receivedDate.value = editingReceipt.receipt.receivedDate;
    amount.value = editingReceipt.receipt.amount;
    paymentMethod.value = editingReceipt.paymentMethod || "Cash";
    sourceType.value = editingReceipt.receipt.sourceType;
    linkedInvoiceId.value = editingReceipt.receipt.linkedInvoiceId;
    linkedProformaId.value = editingReceipt.receipt.linkedProformaId;
    clientName.value = editingReceipt.receipt.client.name;
    clientEmail.value = editingReceipt.receipt.client.companyEmail;
    clientAddress.value = editingReceipt.receipt.client.address;
    clientCountry.value = editingReceipt.receipt.client.country || "Lebanon";
    clientContact.value = editingReceipt.receipt.client.contact;
    note.value = editingReceipt.note || "";
    attachment.value = null;
    if (isLinkedSource.value) applyLinkedClient();
    resetValidation();
    return;
  }

  receiptNumber.value = "";
  receivedDate.value = new Date().toISOString().slice(0, 10);
  amount.value = "";
  paymentMethod.value = "Cash";
  sourceType.value = "invoice";
  linkedInvoiceId.value = null;
  linkedProformaId.value = null;
  clientName.value = "";
  clientEmail.value = "";
  clientAddress.value = "";
  clientCountry.value = "Lebanon";
  clientContact.value = "";
  note.value = "";
  attachment.value = null;
  resetValidation();
};

watch(
  () => [props.isDrawerOpen, props.editingReceipt] as const,
  ([isDrawerOpen]) => {
    if (!isDrawerOpen) return;
    resetForm();
  },
  { immediate: true },
);

watch(sourceType, () => {
  if (sourceType.value !== "invoice") linkedInvoiceId.value = null;
  if (sourceType.value !== "proforma") linkedProformaId.value = null;
  applyLinkedClient();
});

watch([linkedInvoiceId, linkedProformaId], () => {
  if (isLinkedSource.value) applyLinkedClient();
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

  receiptNumberError.value = receiptNumber.value.trim()
    ? null
    : "Receipt number is required";
  receivedDateError.value = receivedDate.value.trim()
    ? null
    : "Receipt date is required";
  amountError.value =
    numericAmount > 0 ? null : "Enter an amount greater than 0";
  paymentMethodError.value = paymentMethod.value.trim()
    ? null
    : "Select a payment method";
  sourceTypeError.value = sourceType.value ? null : "Select a source";
  linkError.value =
    sourceType.value === "invoice"
      ? linkedInvoiceId.value
        ? null
        : "Select the related invoice"
      : sourceType.value === "proforma"
        ? linkedProformaId.value
          ? null
          : "Select the related proforma"
        : null;
  clientNameError.value =
    sourceType.value === "manual" || sourceType.value === "attachment"
      ? clientName.value.trim()
        ? null
        : "Client name is required"
      : null;
  clientEmailError.value = trimmedEmail
    ? emailValidator(trimmedEmail) === true
      ? null
      : "Enter a valid email address"
    : null;
  attachmentError.value = validateAttachment() || null;

  if (
    receiptNumberError.value ||
    receivedDateError.value ||
    amountError.value ||
    paymentMethodError.value ||
    sourceTypeError.value ||
    linkError.value ||
    clientNameError.value ||
    clientEmailError.value ||
    attachmentError.value
  ) {
    return;
  }

  emit("update:isDrawerOpen", false);
  emit("submit", {
    id: props.editingReceipt?.receipt.id ?? null,
    receipt: {
      id: props.editingReceipt?.receipt.id ?? 0,
      receiptNumber: receiptNumber.value.trim(),
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
      status: props.editingReceipt?.receipt.status ?? "Recorded",
      sourceType: sourceType.value,
      linkedInvoiceId: linkedInvoiceId.value,
      linkedInvoiceNumber: selectedInvoice.value?.documentNumber ?? null,
      linkedProformaId: linkedProformaId.value,
      linkedProformaNumber: selectedProforma.value?.documentNumber ?? null,
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
  emit("update:isDrawerOpen", value);
};
</script>

<template>
  <VNavigationDrawer
    temporary
    location="end"
    :width="420"
    border="none"
    :model-value="props.isDrawerOpen"
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
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="receiptNumber"
                  label="Receipt #"
                  placeholder="RV-1001"
                  :error-messages="
                    receiptNumberError ? [receiptNumberError] : []
                  "
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppDateTimePicker
                  v-model="receivedDate"
                  label="Receipt Date"
                  placeholder="Select date"
                  :error-messages="receivedDateError ? [receivedDateError] : []"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="amount"
                  label="Amount Received"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :error-messages="amountError ? [amountError] : []"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppSelect
                  v-model="paymentMethod"
                  label="Payment Method"
                  :items="[
                    'Cash',
                    'Bank Transfer',
                    'Debit',
                    'Credit',
                    'PayPal',
                  ]"
                  :error-messages="
                    paymentMethodError ? [paymentMethodError] : []
                  "
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="sourceType"
                  label="Receipt Source"
                  :items="sourceTypeItems"
                  :error-messages="sourceTypeError ? [sourceTypeError] : []"
                />
              </VCol>

              <VCol v-if="sourceType === 'invoice'" cols="12">
                <AppSelect
                  v-model="linkedInvoiceId"
                  label="Invoice"
                  placeholder="Select invoice"
                  :items="invoiceOptions"
                  :error-messages="linkError ? [linkError] : []"
                />
              </VCol>

              <VCol v-if="sourceType === 'proforma'" cols="12">
                <AppSelect
                  v-model="linkedProformaId"
                  label="Proforma"
                  placeholder="Select proforma"
                  :items="proformaOptions"
                  :error-messages="linkError ? [linkError] : []"
                />
              </VCol>

              <VCol cols="12">
                <VAlert
                  v-if="sourceType === 'manual' || sourceType === 'attachment'"
                  color="warning"
                  variant="tonal"
                  border="start"
                >
                  This receipt will be flagged because it is not linked to a
                  Squarely invoice or proforma.
                </VAlert>

                <VAlert
                  v-else-if="clientFieldsReadonly"
                  color="info"
                  variant="tonal"
                  border="start"
                >
                  Client details are auto-filled from the selected document.
                </VAlert>
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="clientName"
                  label="Client"
                  :readonly="clientFieldsReadonly"
                  :error-messages="clientNameError ? [clientNameError] : []"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="clientEmail"
                  label="Client Email"
                  :readonly="clientFieldsReadonly"
                  :error-messages="clientEmailError ? [clientEmailError] : []"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="clientContact"
                  label="Client Contact"
                  :readonly="clientFieldsReadonly"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="clientCountry"
                  label="Country"
                  :readonly="clientFieldsReadonly"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="clientAddress"
                  label="Address"
                  :readonly="clientFieldsReadonly"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput
                  v-model="attachment"
                  label="Attachment"
                  placeholder="Upload attachment"
                  :accept="attachmentAccept"
                  show-size
                  clearable
                  :error-messages="attachmentError ? [attachmentError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="note"
                  label="Internal Note"
                  placeholder="Add an internal note"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">
                  {{ props.editingReceipt ? "Save Receipt" : "Create Receipt" }}
                </VBtn>
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
