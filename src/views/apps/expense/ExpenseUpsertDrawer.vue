<script setup lang="ts">
import type { ExpenseRecord } from "@/plugins/fake-api/handlers/apps/expense/types";

export type ExpenseSupplierOption = {
  title: string;
  value: string;
  supplier: ExpenseRecord["expense"]["supplier"];
};

export type ExpenseDrawerSubmitPayload = {
  id: number | null;
  action: "save" | "pay";
  expense: ExpenseRecord["expense"];
  note: string;
  attachment: File | null;
};

interface Props {
  isDrawerOpen: boolean;
  editingExpense?: ExpenseRecord | null;
  supplierOptions: ExpenseSupplierOption[];
  categoryOptions: string[];
}

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "submit", value: ExpenseDrawerSubmitPayload): void;
  (e: "pay", value: ExpenseDrawerSubmitPayload): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const drawerOpen = ref(false);
const billDate = ref("");
const selectedSupplierKey = ref("");
const category = ref("");
const supplierInvoiceNumber = ref("");
const amount = ref<string | number>("");
const attachment = ref<File | File[] | null>(null);

const dateError = ref<string | null>(null);
const supplierError = ref<string | null>(null);
const categoryError = ref<string | null>(null);
const amountError = ref<string | null>(null);

const selectedAttachment = computed<File | null>(() => {
  const value = attachment.value;
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
});

const editingSupplierOption = computed<ExpenseSupplierOption | null>(() => {
  const supplier = props.editingExpense?.expense.supplier;
  if (!supplier?.name) return null;
  const supplierKey = supplier.id !== null ? String(supplier.id) : `manual:${supplier.name}`;
  if (props.supplierOptions.some((option) => option.value === supplierKey)) {
    return null;
  }

  return {
    title: supplier.name,
    value: supplierKey,
    supplier,
  };
});

const availableSupplierOptions = computed(() =>
  editingSupplierOption.value
    ? [editingSupplierOption.value, ...props.supplierOptions]
    : props.supplierOptions,
);

const selectedSupplier = computed(
  () =>
    availableSupplierOptions.value.find(
      (option) => option.value === selectedSupplierKey.value,
    ) ??
    null,
);

const hasAttachment = computed(
  () =>
    !!selectedAttachment.value ||
    !!props.editingExpense?.expense.attachmentFileKey ||
    !!props.editingExpense?.expense.attachmentName,
);
const existingPaidAmount = computed(() => {
  if (!props.editingExpense) return 0;

  const total = Math.max(0, Number(props.editingExpense.expense.amount) || 0);
  const balance = Math.max(0, Number(props.editingExpense.expense.balance) || 0);

  return Math.max(0, total - balance);
});

const generatedNote = computed(() => {
  const numericAmount = Math.max(0, Number(amount.value) || 0);
  const segments = [
    selectedSupplier.value?.supplier.name?.trim(),
    category.value.trim(),
    supplierInvoiceNumber.value.trim()
      ? `INV ${supplierInvoiceNumber.value.trim()}`
      : "",
    billDate.value.trim(),
    numericAmount > 0 ? `$${numericAmount.toLocaleString()}` : "",
  ].filter(Boolean);

  return segments.join(" | ");
});

const isFlagged = computed(
  () => !supplierInvoiceNumber.value.trim() || !hasAttachment.value,
);

const drawerTitle = computed(() =>
  props.editingExpense ? "Edit Bill details" : "Add Bill details",
);

const resetValidation = () => {
  dateError.value = null;
  supplierError.value = null;
  categoryError.value = null;
  amountError.value = null;
};

const resetForm = () => {
  const editingExpense = props.editingExpense;

  if (editingExpense) {
    billDate.value = editingExpense.expense.billDate;
    selectedSupplierKey.value =
      editingExpense.expense.supplier.id !== null
        ? String(editingExpense.expense.supplier.id)
        : editingExpense.expense.supplier.name
          ? `manual:${editingExpense.expense.supplier.name}`
          : "";
    category.value = editingExpense.expense.category || "";
    supplierInvoiceNumber.value = editingExpense.expense.supplierInvoiceNumber || "";
    amount.value = editingExpense.expense.amount || "";
    attachment.value = null;
    resetValidation();
    return;
  }

  billDate.value = new Date().toISOString().slice(0, 10);
  selectedSupplierKey.value = "";
  category.value = "";
  supplierInvoiceNumber.value = "";
  amount.value = "";
  attachment.value = null;
  resetValidation();
};

watch(
  () => [props.isDrawerOpen, props.editingExpense] as const,
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

const buildPayload = (): ExpenseDrawerSubmitPayload => {
  const numericAmount = Math.max(0, Number(amount.value) || 0);
  return {
    id: props.editingExpense?.expense.id ?? null,
    action: "save",
    expense: {
      id: props.editingExpense?.expense.id ?? 0,
      billNumber: props.editingExpense?.expense.billNumber ?? "",
      billDate: billDate.value,
      supplier: selectedSupplier.value?.supplier || {
        id: null,
        name: "",
        email: "",
        phone: "",
        address: "",
      },
      category: category.value.trim(),
      supplierInvoiceNumber: supplierInvoiceNumber.value.trim(),
      amount: numericAmount,
      balance: Math.max(0, numericAmount - existingPaidAmount.value),
      status: props.editingExpense?.expense.status ?? "Open",
      attachmentName:
        selectedAttachment.value?.name ??
        props.editingExpense?.expense.attachmentName ??
        null,
      attachmentFileKey: props.editingExpense?.expense.attachmentFileKey ?? null,
      paidAt: props.editingExpense?.expense.paidAt ?? null,
      avatar: props.editingExpense?.expense.avatar ?? null,
      paymentMethod: props.editingExpense?.expense.paymentMethod ?? "Cash",
    },
    note: generatedNote.value,
    attachment: selectedAttachment.value,
  };
};

const validateForm = () => {
  const numericAmount = Math.max(0, Number(amount.value) || 0);
  dateError.value = billDate.value.trim() ? null : "Date is required";
  supplierError.value = selectedSupplier.value ? null : "Supplier is required";
  categoryError.value = category.value.trim() ? null : "Category is required";
  amountError.value =
    numericAmount > 0 ? null : "Enter an amount greater than 0";

  return !(
    dateError.value ||
    supplierError.value ||
    categoryError.value ||
    amountError.value
  );
};

const submit = () => {
  if (!validateForm()) return;
  emit("submit", buildPayload());
};

const openPayDrawer = () => {
  if (!validateForm()) return;
  emit("pay", buildPayload());
};

const handleDrawerModelValueUpdate = (value: boolean) => {
  drawerOpen.value = value;
};
</script>

<template>
  <VNavigationDrawer
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

    <div class="expense-drawer-content">
      <VCard flat>
        <VCardText>
          <VForm @submit.prevent="submit">
            <VRow>
              <VCol cols="12">
                <AppDateTimePicker
                  v-model="billDate"
                  label="Date"
                  placeholder="Select date"
                  :error-messages="dateError ? [dateError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="selectedSupplierKey"
                  label="Supplier"
                  placeholder="Select supplier"
                  :items="availableSupplierOptions"
                  :error-messages="supplierError ? [supplierError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="category"
                  label="Category"
                  placeholder="Select category"
                  :items="categoryOptions"
                  :error-messages="categoryError ? [categoryError] : []"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="supplierInvoiceNumber"
                  label="SUPP INV #"
                  placeholder="Enter supplier invoice number"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  :model-value="generatedNote"
                  label="NOTE"
                  placeholder="Note will be generated automatically"
                  auto-grow
                  rows="2"
                  readonly
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="amount"
                  label="Amount (including VAT)"
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
                  label="Attachment"
                  placeholder="Choose file"
                  show-size
                  clearable
                />
              </VCol>

              <VCol cols="12">
                <VAlert
                  v-if="isFlagged"
                  color="warning"
                  variant="tonal"
                  border="start"
                >
                  This bill will be flagged if the attachment or the supplier
                  invoice number is missing.
                </VAlert>
              </VCol>

              <VCol cols="12">
                <div class="d-flex flex-wrap gap-3">
                  <VBtn type="submit">Save</VBtn>
                  <VBtn
                    type="button"
                    color="success"
                    variant="tonal"
                    @click="openPayDrawer"
                  >
                    Pay
                  </VBtn>
                  <VBtn
                    type="button"
                    color="secondary"
                    variant="tonal"
                    @click="$emit('update:isDrawerOpen', false)"
                  >
                    Cancel
                  </VBtn>
                </div>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>
  </VNavigationDrawer>
</template>

<style scoped>
.expense-drawer-content {
  block-size: calc(100% - 57px);
  overflow-y: auto;
}
</style>
