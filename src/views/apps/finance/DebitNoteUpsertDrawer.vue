<script setup lang="ts">
import type { DebitNoteRecord } from "@/stores/debitNotes";

export type DebitNoteInvoiceOption = {
  title: string;
  value: string;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  total: number;
};

export type DebitNoteDrawerSubmitPayload = {
  id: number | null;
  linkedInvoiceId: number;
  linkedInvoiceNumber: string;
  clientName: string;
  issuedDate: string;
  amount: number;
  reason: string;
  note: string;
  status: "Draft" | "Issued" | "Voided";
};

interface Props {
  isDrawerOpen: boolean;
  editingNote?: DebitNoteRecord | null;
  invoiceOptions: DebitNoteInvoiceOption[];
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: DebitNoteDrawerSubmitPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const linkedInvoice = ref("");
const issuedDate = ref("");
const amount = ref<string | number>("");
const reason = ref("");
const internalNote = ref("");
const status = ref<"Draft" | "Issued" | "Voided">("Draft");

const invoiceError = ref<string | null>(null);
const dateError = ref<string | null>(null);
const amountError = ref<string | null>(null);

const selectedInvoice = computed(
  () => props.invoiceOptions.find((option) => option.value === linkedInvoice.value) ?? null,
);

const resetValidation = () => {
  invoiceError.value = null;
  dateError.value = null;
  amountError.value = null;
};

const resetForm = () => {
  if (props.editingNote) {
    linkedInvoice.value = String(props.editingNote.linkedInvoiceId);
    issuedDate.value = props.editingNote.issuedDate;
    amount.value = props.editingNote.amount;
    reason.value = props.editingNote.reason;
    internalNote.value = props.editingNote.note;
    status.value = props.editingNote.status;
    resetValidation();
    return;
  }

  linkedInvoice.value = "";
  issuedDate.value = new Date().toISOString().slice(0, 10);
  amount.value = "";
  reason.value = "";
  internalNote.value = "";
  status.value = "Draft";
  resetValidation();
};

watch(
  () => [props.isDrawerOpen, props.editingNote] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    resetForm();
  },
  { immediate: true },
);

const validate = () => {
  const numericAmount = Math.max(0, Number(amount.value) || 0);
  invoiceError.value = selectedInvoice.value ? null : "Select an invoice";
  dateError.value = issuedDate.value?.trim() ? null : "Date is required";
  amountError.value =
    numericAmount > 0
      ? selectedInvoice.value && numericAmount > selectedInvoice.value.total
        ? "Amount cannot exceed invoice total"
        : null
      : "Enter an amount greater than 0";

  return !(invoiceError.value || dateError.value || amountError.value);
};

const submit = () => {
  if (!validate() || !selectedInvoice.value) return;

  emit("submit", {
    id: props.editingNote?.id ?? null,
    linkedInvoiceId: selectedInvoice.value.invoiceId,
    linkedInvoiceNumber: selectedInvoice.value.invoiceNumber,
    clientName: selectedInvoice.value.clientName,
    issuedDate: issuedDate.value,
    amount: Math.max(0, Number(amount.value) || 0),
    reason: reason.value.trim(),
    note: internalNote.value.trim(),
    status: status.value,
  });
};
</script>

<template>
  <VNavigationDrawer
    temporary
    location="end"
    :width="440"
    border="none"
    :scrim="true"
    style="z-index: 2000"
    :model-value="props.isDrawerOpen"
    class="scrollable-content"
    @update:model-value="$emit('update:isDrawerOpen', $event)"
  >
    <AppDrawerHeaderSection
      :title="props.editingNote ? 'Edit Debit Note' : 'Add Debit Note'"
      @cancel="$emit('update:isDrawerOpen', false)"
    />
    <VDivider />
    <VCard flat>
      <VCardText>
        <VRow>
          <VCol cols="12">
            <AppSelect
              v-model="linkedInvoice"
              label="Invoice"
              placeholder="Select linked invoice"
              :items="props.invoiceOptions"
              :error-messages="invoiceError ? [invoiceError] : []"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppDateTimePicker
              v-model="issuedDate"
              label="Date"
              placeholder="Select date"
              :error-messages="dateError ? [dateError] : []"
            />
          </VCol>
          <VCol cols="12" md="6">
            <AppSelect
              v-model="status"
              label="Status"
              :items="['Draft', 'Issued', 'Voided']"
            />
          </VCol>
          <VCol cols="12">
            <AppTextField
              v-model="amount"
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              :error-messages="amountError ? [amountError] : []"
            />
          </VCol>
          <VCol cols="12">
            <AppTextField
              v-model="reason"
              label="Reason"
              placeholder="Adjustment reason"
            />
          </VCol>
          <VCol cols="12">
            <AppTextarea
              v-model="internalNote"
              label="Internal Note"
              placeholder="Optional internal note"
            />
          </VCol>
          <VCol cols="12">
            <VBtn class="me-3" @click="submit">
              {{ props.editingNote ? "Update" : "Save" }}
            </VBtn>
            <VBtn
              color="secondary"
              variant="tonal"
              @click="$emit('update:isDrawerOpen', false)"
            >
              Cancel
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
  </VNavigationDrawer>
</template>
