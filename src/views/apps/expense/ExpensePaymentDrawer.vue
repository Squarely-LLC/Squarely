<script setup lang="ts">
import type { Expense } from "@/plugins/fake-api/handlers/apps/expense/types";
import type { ExpensePaymentInput } from "@/stores/expenses";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

interface Props {
  isDrawerOpen: boolean;
  expenseDraft: Partial<Expense> | null;
  currentBalance: number;
  existingPayments?: Array<{
    id: string;
    voucherNumber: string;
    amount: number;
    date: string;
    method: string;
    note: string;
  }>;
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: ExpensePaymentInput): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const amountDue = ref("");
const paymentAmount = ref<string | number>("");
const paymentDate = ref("");
const paymentMethod = ref("");
const paymentNote = ref("");
const selectedPaymentId = ref("new");
const paymentAmountError = ref<string | null>(null);
const paymentDateError = ref<string | null>(null);
const paymentMethodError = ref<string | null>(null);

const paymentMethodOptions = ["Bank Transfer", "Cash", "Credit Card"];

const paymentOptions = computed(() => {
  const history = (props.existingPayments ?? []).map((payment) => ({
    title: `${payment.voucherNumber} | ${payment.date} | ${Number(payment.amount || 0).toLocaleString()}`,
    value: payment.id,
  }));

  return [{ title: "New Payment", value: "new" }, ...history];
});

const selectedExistingPayment = computed(() =>
  (props.existingPayments ?? []).find(
    (payment) => payment.id === selectedPaymentId.value,
  ) ?? null,
);

const editableAmountDue = computed(() =>
  selectedExistingPayment.value
    ? props.currentBalance + Math.max(0, Number(selectedExistingPayment.value.amount) || 0)
    : props.currentBalance,
);

const submitButtonLabel = computed(() =>
  selectedExistingPayment.value ? "Update Payment" : "Save Payment",
);

const normalisePaymentMethod = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() || "";

  if (normalized === "cash") return "Cash";
  if (normalized === "bank" || normalized === "bank transfer")
    return "Bank Transfer";
  if (
    normalized === "credit" ||
    normalized === "credit card" ||
    normalized === "card" ||
    normalized === "debit"
  ) {
    return "Credit Card";
  }

  return "Cash";
};

const resetForm = () => {
  const defaultPaymentForEdit =
    props.currentBalance <= 0 && (props.existingPayments?.length || 0) > 0
      ? props.existingPayments![props.existingPayments!.length - 1]?.id
      : "new";
  selectedPaymentId.value = defaultPaymentForEdit || "new";
  amountDue.value = editableAmountDue.value.toLocaleString();
  paymentAmount.value = editableAmountDue.value || "";
  paymentDate.value = new Date().toISOString().slice(0, 10);
  paymentMethod.value = normalisePaymentMethod(props.expenseDraft?.paymentMethod);
  paymentNote.value = "";
  paymentAmountError.value = null;
  paymentDateError.value = null;
  paymentMethodError.value = null;
};

watch(
  () => [props.isDrawerOpen, props.currentBalance, props.expenseDraft] as const,
  ([isDrawerOpen]) => {
    if (!isDrawerOpen) return;
    resetForm();
  },
  { immediate: true },
);

watch(
  () => selectedPaymentId.value,
  () => {
    const selectedPayment = selectedExistingPayment.value;

    if (selectedPayment) {
      amountDue.value = editableAmountDue.value.toLocaleString();
      paymentAmount.value = Number(selectedPayment.amount || 0);
      paymentDate.value = selectedPayment.date || new Date().toISOString().slice(0, 10);
      paymentMethod.value = normalisePaymentMethod(selectedPayment.method);
      paymentNote.value = selectedPayment.note || "";
    } else {
      amountDue.value = editableAmountDue.value.toLocaleString();
      paymentAmount.value = editableAmountDue.value || "";
      paymentDate.value = new Date().toISOString().slice(0, 10);
      paymentMethod.value = normalisePaymentMethod(props.expenseDraft?.paymentMethod);
      paymentNote.value = "";
    }

    paymentAmountError.value = null;
    paymentDateError.value = null;
    paymentMethodError.value = null;
  },
);

const onSubmit = () => {
  const amount = Math.max(0, Number(paymentAmount.value) || 0);
  const maxAllowedAmount = Math.max(0, Number(editableAmountDue.value) || 0);

  paymentAmountError.value =
    amount > 0
      ? amount > maxAllowedAmount
        ? "Payment cannot exceed the remaining amount due"
        : null
      : "Enter an amount greater than 0";
  paymentDateError.value = paymentDate.value?.trim()
    ? null
    : "Select a payment date";
  paymentMethodError.value = paymentMethod.value?.trim()
    ? null
    : "Select a payment method";

  if (
    paymentAmountError.value ||
    paymentDateError.value ||
    paymentMethodError.value
  ) {
    return;
  }

  emit("submit", {
    paymentId: selectedExistingPayment.value?.id || null,
    amount,
    date: paymentDate.value,
    method: paymentMethod.value,
    note: paymentNote.value,
  });
  emit("update:isDrawerOpen", false);
};

const handleDrawerModelValueUpdate = (value: boolean) => {
  emit("update:isDrawerOpen", value);
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="420"
    border="none"
    :model-value="props.isDrawerOpen"
    class="scrollable-content"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection
      title="Pay Bill"
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
                  v-model="selectedPaymentId"
                  label="Payment Entry"
                  :items="paymentOptions"
                  placeholder="Select payment entry"
                />
              </VCol>

              <VCol cols="12">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Supplier</div>
                  <div class="pay-static-field__value">
                    {{ props.expenseDraft?.supplier?.name || "-" }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Bill #</div>
                  <div class="pay-static-field__value">
                    {{ props.expenseDraft?.billNumber || "New Bill" }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Bill Date</div>
                  <div class="pay-static-field__value">
                    {{ props.expenseDraft?.billDate || "-" }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Category</div>
                  <div class="pay-static-field__value">
                    {{ props.expenseDraft?.category || "-" }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12" md="6">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">SUPP INV #</div>
                  <div class="pay-static-field__value">
                    {{ props.expenseDraft?.supplierInvoiceNumber || "-" }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Bill Amount</div>
                  <div class="pay-static-field__value">
                    {{ Number(props.expenseDraft?.amount || 0).toLocaleString() }}
                  </div>
                </div>
              </VCol>

              <VCol cols="12">
                <div class="pay-static-field">
                  <div class="pay-static-field__label">Amount Due</div>
                  <div class="pay-static-field__value">{{ amountDue }}</div>
                </div>
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="paymentAmount"
                  label="Amount To Be Paid"
                  type="number"
                  min="0"
                  step="0.01"
                  :error-messages="paymentAmountError ? [paymentAmountError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  v-model="paymentDate"
                  label="Payment Date"
                  placeholder="Select Date"
                  :error-messages="paymentDateError ? [paymentDateError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="paymentMethod"
                  label="Payment Method"
                  placeholder="Select Payment Method"
                  :items="paymentMethodOptions"
                  :error-messages="paymentMethodError ? [paymentMethodError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="paymentNote"
                  label="Internal Payment Note"
                  placeholder="Internal Payment Note"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3"> {{ submitButtonLabel }} </VBtn>
                <VBtn
                  type="button"
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

<style scoped>
.pay-static-field {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  padding: 0.625rem 0.75rem;
}

.pay-static-field__label {
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-block-end: 0.25rem;
}

.pay-static-field__value {
  color: rgba(var(--v-theme-on-surface), 0.95);
  font-size: 0.95rem;
  font-weight: 600;
  word-break: break-word;
}
</style>
