<script setup lang="ts">
import type { ProformaPaymentInput } from "@/stores/proformas";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: ProformaPaymentInput): void;
}

interface Props {
  isDrawerOpen: boolean;
  currentBalance: number;
  defaultPaymentMethod?: string | null;
  documentLabel?: string;
}
const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const quotationBalance = ref("");
const paymentAmount = ref<string | number>("");
const paymentDate = ref("");
const paymentMethod = ref("");
const paymentNote = ref("");
const paymentAmountError = ref<string | null>(null);
const paymentDateError = ref<string | null>(null);
const paymentMethodError = ref<string | null>(null);
const documentLabel = computed(() => props.documentLabel?.trim() || "Proforma");
const balanceLabel = computed(() => `${documentLabel.value} Balance`);
const paymentMethodOptions = ["Bank Transfer", "Cash", "Credit Card"];

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

  return "Bank Transfer";
};

const resetForm = () => {
  quotationBalance.value = props.currentBalance.toLocaleString();
  paymentAmount.value = "";
  paymentDate.value = new Date().toISOString().slice(0, 10);
  paymentMethod.value = normalisePaymentMethod(props.defaultPaymentMethod);
  paymentNote.value = "";
  paymentAmountError.value = null;
  paymentDateError.value = null;
  paymentMethodError.value = null;
};

watch(
  () =>
    [
      props.isDrawerOpen,
      props.currentBalance,
      props.defaultPaymentMethod,
    ] as const,
  ([isDrawerOpen]) => {
    if (!isDrawerOpen) return;
    resetForm();
  },
  { immediate: true },
);

const onSubmit = () => {
  const amount = Math.max(0, Number(paymentAmount.value) || 0);

  paymentAmountError.value =
    amount > 0
      ? amount > props.currentBalance
        ? "Payment cannot exceed the remaining balance"
        : null
      : "Enter a payment amount greater than 0";
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

  emit("update:isDrawerOpen", false);
  emit("submit", {
    amount,
    date: paymentDate.value,
    method: paymentMethod.value,
    note: paymentNote.value,
  });
};

const handleDrawerModelValueUpdate = (val: boolean) => {
  emit("update:isDrawerOpen", val);
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="400"
    border="none"
    :model-value="props.isDrawerOpen"
    class="scrollable-content"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <!-- 👉 Header -->
    <AppDrawerHeaderSection
      title="Add Payment"
      @cancel="$emit('update:isDrawerOpen', false)"
    />
    <VDivider />
    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  id="Quotation-balance"
                  v-model="quotationBalance"
                  :label="balanceLabel"
                  readonly
                  placeholder="$99"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  id="payment-amount"
                  v-model="paymentAmount"
                  label="Payment Amount"
                  type="number"
                  placeholder="$99"
                  :error-messages="
                    paymentAmountError ? [paymentAmountError] : []
                  "
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  id="Quotation-payment-date"
                  v-model="paymentDate"
                  label="Payment Date"
                  placeholder="Select Date"
                  :error-messages="paymentDateError ? [paymentDateError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  id="Quotation-payment-method"
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
                <AppTextarea
                  id="Quotation-payment-note"
                  v-model="paymentNote"
                  label="Internal Payment Note"
                  placeholder="Internal Payment Note"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3"> Save Payment </VBtn>

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
