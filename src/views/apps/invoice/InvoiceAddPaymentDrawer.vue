<script setup lang="ts">
import type { InvoicePaymentInput } from "@/stores/invoices";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: InvoicePaymentInput): void;
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
const documentLabel = computed(() => props.documentLabel?.trim() || "Invoice");
const balanceLabel = computed(() => `${documentLabel.value} Balance`);
const summaryBalance = computed(() => quotationBalance.value || "0");
const paymentMethodOptions = [
  { title: "Cash", value: "Cash", icon: "tabler-cash" },
  { title: "Bank", value: "Bank Transfer", icon: "tabler-building-bank" },
  { title: "Card", value: "Credit Card", icon: "tabler-credit-card" },
  { title: "Cheque", value: "Cheque", icon: "tabler-file-dollar" },
];

const normalisePaymentMethod = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() || "";

  if (normalized === "cash") return "Cash";
  if (normalized === "bank" || normalized === "bank transfer")
    return "Bank Transfer";
  if (normalized === "cheque" || normalized === "check") return "Cheque";
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
      title="Add Receipt"
      @cancel="$emit('update:isDrawerOpen', false)"
    />
    <VDivider />
    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <div class="receipt-summary-card">
                  <div>
                    <div class="text-caption text-medium-emphasis">
                      {{ balanceLabel }}
                    </div>
                    <div class="text-h6 font-weight-medium">
                      {{ summaryBalance }}
                    </div>
                  </div>
                </div>
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
                <div class="text-subtitle-2 mb-2">Payment Method</div>
                <VBtnToggle
                  id="Quotation-payment-method"
                  v-model="paymentMethod"
                  class="payment-method-toggle"
                  mandatory
                  divided
                >
                  <VTooltip
                    v-for="option in paymentMethodOptions"
                    :key="option.value"
                    :text="option.title"
                    location="top"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <VBtn
                        v-bind="tooltipProps"
                        :value="option.value"
                        :aria-label="option.title"
                      >
                        <VIcon :icon="option.icon" />
                      </VBtn>
                    </template>
                  </VTooltip>
                </VBtnToggle>
                <div
                  v-if="paymentMethodError"
                  class="text-error text-caption mt-1"
                >
                  {{ paymentMethodError }}
                </div>
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

<style scoped>
.payment-method-toggle {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  inline-size: 100%;
}

.payment-method-toggle :deep(.v-btn) {
  min-inline-size: 0;
}

.receipt-summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background: rgba(var(--v-theme-surface), 0.35);
  padding: 0.9rem 1rem;
}
</style>
