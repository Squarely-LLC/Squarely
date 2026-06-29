<script setup lang="ts">
import { useContactsStore } from "@/stores/contacts";
import { useConfigStore } from "@/stores/config";
import type { CreditNoteRecord } from "@/stores/creditNotes";
import { useCreditNotesStore } from "@/stores/creditNotes";
import type { DebitNoteRecord } from "@/stores/debitNotes";
import { useDebitNotesStore } from "@/stores/debitNotes";
import { useExpensesStore } from "@/stores/expenses";
import type { ExpensePaymentInput } from "@/stores/expenses";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { usePaymentVouchersStore } from "@/stores/paymentVouchers";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { saveFile } from "@/utils/fileStore";
import type {
  ExpenseDrawerSubmitPayload,
  ExpenseSupplierOption,
} from "@/views/apps/expense/ExpenseUpsertDrawer.vue";
import ExpensePaymentDrawer from "@/views/apps/expense/ExpensePaymentDrawer.vue";
import ExpenseUpsertDrawer from "@/views/apps/expense/ExpenseUpsertDrawer.vue";
import type {
  ReceiptClientOption,
  ReceiptDocumentOption,
  ReceiptDrawerSubmitPayload,
} from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import ReceiptUpsertDrawer from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import FinanceExpensesTab from "@/views/apps/finance/FinanceExpensesTab.vue";
import FinanceCreditNotesTab from "@/views/apps/finance/FinanceCreditNotesTab.vue";
import CreditNoteUpsertDrawer, {
  type CreditNoteDrawerSubmitPayload,
} from "@/views/apps/finance/CreditNoteUpsertDrawer.vue";
import DebitNoteUpsertDrawer, {
  type DebitNoteDrawerSubmitPayload,
  type DebitNoteInvoiceOption,
} from "@/views/apps/finance/DebitNoteUpsertDrawer.vue";
import FinanceDebitNotesTab from "@/views/apps/finance/FinanceDebitNotesTab.vue";
import FinanceInvoicesTab from "@/views/apps/finance/FinanceInvoicesTab.vue";
import FinancePayrollTab from "@/views/apps/finance/FinancePayrollTab.vue";
import FinanceProformasTab from "@/views/apps/finance/FinanceProformasTab.vue";
import FinanceQuotationsTab from "@/views/apps/finance/FinanceQuotationsTab.vue";
import FinanceReceiptsTab from "@/views/apps/finance/FinanceReceiptsTab.vue";

const route = useRoute();
const router = useRouter();
const contactsStore = useContactsStore();
const configStore = useConfigStore();
const creditNotesStore = useCreditNotesStore();
const debitNotesStore = useDebitNotesStore();
const expensesStore = useExpensesStore();
const invoicesStore = useInvoicesStore();
const paymentVouchersStore = usePaymentVouchersStore();
const proformasStore = useProformasStore();
const receiptsStore = useReceiptsStore();
const notifications = useNotificationsStore();

contactsStore.init();
configStore.init();
creditNotesStore.init();
debitNotesStore.init();
expensesStore.init();
invoicesStore.init();
paymentVouchersStore.init();
proformasStore.init();
receiptsStore.init();

const tabsData = [
  {
    icon: "tabler-file-text",
    title: "Quotations",
    key: "quotations",
    description: "Manage customer quotations and draft pricing proposals.",
  },
  {
    icon: "tabler-file-dollar",
    title: "Pro-forma",
    key: "pro-forma",
    description: "Prepare and review pro-forma documents before invoicing.",
  },
  {
    icon: "tabler-file-invoice",
    title: "Invoice",
    key: "invoice",
    description: "Track issued invoices, statuses, and payment follow-up.",
  },
  {
    icon: "tabler-receipt-2",
    title: "Receipt",
    key: "receipt",
    description: "Review receipt records and confirmed incoming payments.",
  },
  {
    icon: "tabler-credit-card-pay",
    title: "Expenses",
    key: "expenses",
    description: "Monitor company spending, reimbursements, and cost items.",
  },
  {
    icon: "tabler-users-group",
    title: "Payroll",
    key: "payroll",
    description: "Handle payroll cycles, payouts, and salary-related records.",
  },
  {
    icon: "tabler-file-delta",
    title: "Debit Note",
    key: "debit-note",
    description: "Create and manage debit note adjustments and references.",
  },
  {
    icon: "tabler-file-minus",
    title: "Credit Note",
    key: "credit-note",
    description: "Track issued credit notes and billing corrections.",
  },
  {
    icon: "tabler-arrows-exchange",
    title: "Transfers",
    key: "transfers",
    description: "View internal transfers and movement of financial balances.",
  },
  {
    icon: "tabler-wallet",
    title: "Advances hr",
    key: "advances-hr",
    description: "Manage HR-related employee advances and recovery tracking.",
  },
] as const;

const activeTab = ref<number | null>(null);
const isExpenseDrawerOpen = ref(false);
const isExpensePaymentDrawerOpen = ref(false);
const isReceiptDrawerOpen = ref(false);
const isDebitNoteDrawerOpen = ref(false);
const isCreditNoteDrawerOpen = ref(false);
const editingExpenseId = ref<number | null>(null);
const editingReceiptId = ref<number | null>(null);
const editingDebitNoteId = ref<number | null>(null);
const editingCreditNoteId = ref<number | null>(null);
const receiptCreationMode = ref<"squarely" | "attachment">("squarely");
const pendingExpensePaymentPayload = ref<ExpenseDrawerSubmitPayload | null>(null);
const allowExpensePaymentEditing = ref(true);
const pendingExpensePayments = ref<
  Array<{
    id: string;
    voucherNumber: string;
    amount: number;
    date: string;
    method: string;
    note: string;
  }>
>([]);

const createClientKey = (name: string, email: string) =>
  `${name.trim().toLowerCase()}::${email.trim().toLowerCase()}`;

const mergeClientOptions = (options: ReceiptClientOption[]) => {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

const getAllocatedReceiptAmount = (
  documentType: "invoice" | "proforma",
  documentId: number,
) =>
  receiptsStore.all
    .filter((record) =>
      documentType === "invoice"
        ? record.receipt.linkedInvoiceId === documentId
        : record.receipt.linkedProformaId === documentId,
    )
    .reduce((sum, record) => sum + Number(record.receipt.amount || 0), 0);

const mapDocumentOption = (
  record: (typeof invoicesStore.all)[number],
  documentType: "invoice" | "proforma",
): ReceiptDocumentOption => ({
  title: `${record.quotation.quoteNumber} | ${record.quotation.issuedDate} | $${Number(record.quotation.total || 0).toLocaleString()}`,
  value: `${documentType}:${record.quotation.id}`,
  documentId: record.quotation.id,
  documentType,
  documentNumber: record.quotation.quoteNumber,
  clientKey: createClientKey(
    record.quotation.client.name || record.quotation.client.company || "",
    record.quotation.client.companyEmail || "",
  ),
  client: record.quotation.client,
  amount: Number(record.quotation.total || 0),
  balance:
    record.quotation.balance === undefined || record.quotation.balance === null
      ? null
      : Number(record.quotation.balance),
  allocatedAmount: getAllocatedReceiptAmount(documentType, record.quotation.id),
  paymentMethod: record.paymentMethod || "Bank Transfer",
});

const editingReceipt = computed(() =>
  editingReceiptId.value === null
    ? null
    : receiptsStore.byId(editingReceiptId.value),
);
const editingExpense = computed(() =>
  editingExpenseId.value === null
    ? null
    : expensesStore.byId(editingExpenseId.value),
);
const editingDebitNote = computed<DebitNoteRecord | null>(() =>
  editingDebitNoteId.value === null
    ? null
    : debitNotesStore.byId(editingDebitNoteId.value),
);
const editingCreditNote = computed<CreditNoteRecord | null>(() =>
  editingCreditNoteId.value === null
    ? null
    : creditNotesStore.byId(editingCreditNoteId.value),
);

const invoiceOptions = computed<ReceiptDocumentOption[]>(() =>
  invoicesStore.all
    .filter((record) => !record.quotation.parentQuotationId)
    .map((record) => mapDocumentOption(record, "invoice")),
);

const proformaOptions = computed<ReceiptDocumentOption[]>(() =>
  proformasStore.all
    .filter((record) => !record.quotation.parentQuotationId)
    .map((record) => mapDocumentOption(record, "proforma")),
);

const noteInvoiceOptions = computed<DebitNoteInvoiceOption[]>(() =>
  invoicesStore.all
    .filter((record) => !record.quotation.parentQuotationId)
    .map((record) => ({
      title: `${record.quotation.quoteNumber} | ${record.quotation.client.name} | $${record.quotation.total.toLocaleString()}`,
      value: String(record.quotation.id),
      invoiceId: record.quotation.id,
      invoiceNumber: record.quotation.quoteNumber,
      clientName: record.quotation.client.name || "-",
      total: Number(record.quotation.total || 0),
    })),
);

const clientOptions = computed<ReceiptClientOption[]>(() => {
  const contactOptions = contactsStore.all.map((contact) => ({
    title: contact.fullName,
    value: createClientKey(contact.fullName || "", contact.email || ""),
    client: {
      address: contact.address || "",
      company: contact.fullName || "",
      companyEmail: contact.email || "",
      country: contact.country || "Lebanon",
      contact: contact.number || "",
      name: contact.fullName || "",
    },
  }));
  const documentClients = [
    ...invoiceOptions.value,
    ...proformaOptions.value,
  ].map((option) => ({
    title: option.client.name || option.client.company || option.documentNumber,
    value: option.clientKey,
    client: option.client,
  }));

  return mergeClientOptions([...contactOptions, ...documentClients]);
});

const expenseSupplierOptions = computed<ExpenseSupplierOption[]>(() =>
  contactsStore.all.map((contact) => ({
    title: contact.fullName,
    value: String(contact.id),
    supplier: {
      id: Number(contact.id) || null,
      name: contact.fullName || "",
      email: contact.email || "",
      phone: contact.number || "",
      address: contact.address || "",
    },
  })),
);

const expenseCategoryOptions = computed(
  () => configStore.financial?.expenseCategories ?? [],
);

const openCreateExpenseDrawer = () => {
  editingExpenseId.value = null;
  isExpenseDrawerOpen.value = true;
};

const openEditExpenseDrawer = (expenseId: number) => {
  editingExpenseId.value = expenseId;
  isExpenseDrawerOpen.value = true;
};

const openPayExpenseDrawer = (expenseId: number) => {
  const existingExpense = expensesStore.byId(expenseId);
  if (!existingExpense) return;

  allowExpensePaymentEditing.value = true;
  pendingExpensePaymentPayload.value = {
    id: existingExpense.expense.id,
    action: "save",
    expense: {
      ...existingExpense.expense,
    },
    note: existingExpense.note,
    attachment: null,
  };
  pendingExpensePayments.value = [...(existingExpense.payments ?? [])];
  isExpensePaymentDrawerOpen.value = true;
};

const openCreateReceiptDrawer = (mode: "squarely" | "attachment") => {
  editingReceiptId.value = null;
  receiptCreationMode.value = mode;
  isReceiptDrawerOpen.value = true;
};

const openEditReceiptDrawer = (receiptId: number) => {
  editingReceiptId.value = receiptId;
  receiptCreationMode.value = "squarely";
  isReceiptDrawerOpen.value = true;
};

const closeReceiptDrawer = () => {
  isReceiptDrawerOpen.value = false;
  editingReceiptId.value = null;
  receiptCreationMode.value = "squarely";
};

const closeExpenseDrawer = () => {
  isExpenseDrawerOpen.value = false;
  editingExpenseId.value = null;
};

const openCreateDebitNoteDrawer = () => {
  editingDebitNoteId.value = null;
  isDebitNoteDrawerOpen.value = true;
};

const openEditDebitNoteDrawer = (noteId: number) => {
  editingDebitNoteId.value = noteId;
  isDebitNoteDrawerOpen.value = true;
};

const closeDebitNoteDrawer = () => {
  isDebitNoteDrawerOpen.value = false;
  editingDebitNoteId.value = null;
};

const toDebitNotePayload = (
  payload: DebitNoteDrawerSubmitPayload,
): Partial<DebitNoteRecord> => ({
  linkedInvoiceId: payload.linkedInvoiceId,
  linkedInvoiceNumber: payload.linkedInvoiceNumber,
  clientName: payload.clientName,
  issuedDate: payload.issuedDate,
  amount: payload.amount,
  reason: payload.reason,
  note: payload.note,
  status: payload.status,
});

const saveDebitNote = (payload: DebitNoteDrawerSubmitPayload) => {
  const notePayload = toDebitNotePayload(payload);

  if (payload.id) {
    debitNotesStore.updateNote(payload.id, notePayload);
    notifications.push("Debit note updated successfully.", "success", 3500);
  } else {
    debitNotesStore.addNote(notePayload);
    notifications.push("Debit note created successfully.", "success", 3500);
  }

  closeDebitNoteDrawer();
};

const openCreateCreditNoteDrawer = () => {
  editingCreditNoteId.value = null;
  isCreditNoteDrawerOpen.value = true;
};

const openEditCreditNoteDrawer = (noteId: number) => {
  editingCreditNoteId.value = noteId;
  isCreditNoteDrawerOpen.value = true;
};

const closeCreditNoteDrawer = () => {
  isCreditNoteDrawerOpen.value = false;
  editingCreditNoteId.value = null;
};

const toCreditNotePayload = (
  payload: CreditNoteDrawerSubmitPayload,
): Partial<CreditNoteRecord> => ({
  linkedInvoiceId: payload.linkedInvoiceId,
  linkedInvoiceNumber: payload.linkedInvoiceNumber,
  clientName: payload.clientName,
  issuedDate: payload.issuedDate,
  amount: payload.amount,
  reason: payload.reason,
  note: payload.note,
  status: payload.status,
});

const saveCreditNote = (payload: CreditNoteDrawerSubmitPayload) => {
  const notePayload = toCreditNotePayload(payload);

  if (payload.id) {
    creditNotesStore.updateNote(payload.id, notePayload);
    notifications.push("Credit note updated successfully.", "success", 3500);
  } else {
    creditNotesStore.addNote(notePayload);
    notifications.push("Credit note created successfully.", "success", 3500);
  }

  closeCreditNoteDrawer();
};

const closeExpensePaymentDrawer = () => {
  isExpensePaymentDrawerOpen.value = false;
  allowExpensePaymentEditing.value = true;
  pendingExpensePaymentPayload.value = null;
  pendingExpensePayments.value = [];
};

const persistExpenseDraft = async (payload: ExpenseDrawerSubmitPayload) => {
  let attachmentFileKey = payload.expense.attachmentFileKey;

  if (payload.attachment) {
    attachmentFileKey = await saveFile(payload.attachment);
  }

  const nextPayload = {
    expense: {
      ...payload.expense,
      attachmentName:
        payload.attachment?.name ?? payload.expense.attachmentName ?? null,
      attachmentFileKey: attachmentFileKey ?? null,
    },
    note: payload.note,
  };

  if (payload.id) {
    return expensesStore.updateExpense(payload.id, nextPayload);
  }

  return expensesStore.addExpense(nextPayload);
};

const saveExpense = async (payload: ExpenseDrawerSubmitPayload) => {
  const savedExpense = await persistExpenseDraft(payload);

  notifications.push(
    payload.id ? "Bill updated successfully." : "Bill created successfully.",
    "success",
    3500,
  );

  closeExpenseDrawer();
  return savedExpense;
};

const openExpensePaymentDrawerFromDraft = (payload: ExpenseDrawerSubmitPayload) => {
  allowExpensePaymentEditing.value = false;
  pendingExpensePaymentPayload.value = payload;
  pendingExpensePayments.value = [];
  isExpensePaymentDrawerOpen.value = true;
};

const saveExpensePayment = async (
  payment: ExpensePaymentInput,
  draftPayloadOverride?: ExpenseDrawerSubmitPayload | null,
) => {
  const draftPayload =
    draftPayloadOverride ?? pendingExpensePaymentPayload.value;
  if (!draftPayload) return;

  const savedExpenseRecord = await persistExpenseDraft(draftPayload);
  if (!savedExpenseRecord) {
    notifications.push("Unable to save the bill before payment.", "error", 3500);
    return;
  }

  const nextVoucherNumber = `PV-${Date.now()}`;
  const isEditingExistingPayment = !!payment.paymentId?.trim();
  const updatedExpenseRecord = isEditingExistingPayment
    ? expensesStore.updatePayment(savedExpenseRecord.expense.id, payment)
    : expensesStore.addPayment(savedExpenseRecord.expense.id, {
        ...payment,
        voucherNumber: nextVoucherNumber,
      });

  if (!updatedExpenseRecord) {
    notifications.push("Unable to record payment.", "error", 3500);
    return;
  }
  const latestPayment = isEditingExistingPayment
    ? updatedExpenseRecord.payments?.find(
        (entry) => entry.id === payment.paymentId?.trim(),
      ) ?? null
    : updatedExpenseRecord.payments?.at(-1) ?? null;
  if (!latestPayment) {
    notifications.push("Unable to record payment.", "error", 3500);
    return;
  }

  paymentVouchersStore.addVoucher({
    voucherNumber: latestPayment.voucherNumber,
    billId: updatedExpenseRecord.expense.id,
    billNumber: updatedExpenseRecord.expense.billNumber,
    supplierName: updatedExpenseRecord.expense.supplier.name,
    amount: latestPayment.amount,
    date: latestPayment.date,
    paymentMethod: latestPayment.method,
    paymentNote: latestPayment.note,
    linkedPaymentId: latestPayment.id,
  });

  notifications.push(
    isEditingExistingPayment
      ? `${updatedExpenseRecord.expense.billNumber} payment updated. Voucher ${latestPayment.voucherNumber} synced.`
      : `${updatedExpenseRecord.expense.billNumber} payment recorded. Voucher ${latestPayment.voucherNumber} created.`,
    "success",
    4000,
  );

  closeExpenseDrawer();
  closeExpensePaymentDrawer();
};

const saveReceipt = async (payload: ReceiptDrawerSubmitPayload) => {
  let attachmentFileKey = payload.receipt.attachmentFileKey;

  if (payload.attachment) {
    attachmentFileKey = await saveFile(payload.attachment);
  }

  const nextPayload = {
    receipt: {
      ...payload.receipt,
      attachmentName:
        payload.attachment?.name ?? payload.receipt.attachmentName ?? null,
      attachmentFileKey: attachmentFileKey ?? null,
    },
    paymentMethod: payload.paymentMethod,
    note: payload.note,
  };

  if (payload.id) {
    receiptsStore.updateReceipt(payload.id, nextPayload);
    notifications.push("Receipt updated successfully.", "success", 3500);
  } else {
    receiptsStore.addReceipt(nextPayload);
    notifications.push("Receipt created successfully.", "success", 3500);
  }

  closeReceiptDrawer();
};

const setTabFromQuery = () => {
  try {
    const queryTab = String(route.query.tab || tabsData[0].key);
    const index = tabsData.findIndex((tab) => tab.key === queryTab);

    activeTab.value = index === -1 ? 0 : index;
  } catch {
    activeTab.value = 0;
  }
};

onMounted(() => {
  setTabFromQuery();
});

watch(
  () => route.query.tab,
  () => {
    setTabFromQuery();
  },
);

watch(
  () => activeTab.value,
  (value) => {
    if (value == null) return;

    const key = tabsData[value]?.key || tabsData[0].key;

    if (String(route.query.tab) === key) return;

    try {
      router.replace({
        name: route.name as string,
        params: route.params,
        query: { ...(route.query || {}), tab: key },
      });
    } catch {
      // Ignore route replacement failures.
    }
  },
);
</script>

<template>
  <VRow>
    <VCol cols="12" md="3" lg="2">
      <h5 class="text-h5 mb-4">Finance</h5>

      <VTabs
        v-model="activeTab"
        direction="vertical"
        class="finance-tabs v-tabs-pill disable-tab-transition"
      >
        <VTab
          v-for="tabItem in tabsData"
          :key="tabItem.key"
          :prepend-icon="tabItem.icon"
          class="finance-tab-item"
        >
          {{ tabItem.title }}
        </VTab>
      </VTabs>
    </VCol>

    <VCol cols="12" md="9" lg="10">
      <VWindow
        v-model="activeTab"
        class="disable-tab-transition"
        :touch="false"
      >
        <VWindowItem v-for="tabItem in tabsData" :key="tabItem.key">
          <FinanceQuotationsTab v-if="tabItem.key === 'quotations'" />
          <FinanceProformasTab v-else-if="tabItem.key === 'pro-forma'" />
          <FinanceInvoicesTab v-else-if="tabItem.key === 'invoice'" />
          <FinanceExpensesTab
            v-else-if="tabItem.key === 'expenses'"
            @create-expense="openCreateExpenseDrawer"
            @edit-expense="openEditExpenseDrawer"
            @pay-expense="openPayExpenseDrawer"
          />
          <FinanceDebitNotesTab
            v-else-if="tabItem.key === 'debit-note'"
            @create-debit-note="openCreateDebitNoteDrawer"
            @edit-debit-note="openEditDebitNoteDrawer"
          />
          <FinanceCreditNotesTab
            v-else-if="tabItem.key === 'credit-note'"
            @create-credit-note="openCreateCreditNoteDrawer"
            @edit-credit-note="openEditCreditNoteDrawer"
          />
          <FinanceReceiptsTab
            v-else-if="tabItem.key === 'receipt'"
            @create-receipt="openCreateReceiptDrawer"
            @edit-receipt="openEditReceiptDrawer"
          />
          <FinancePayrollTab v-else-if="tabItem.key === 'payroll'" />

          <VCard v-else>
            <VCardText class="pa-6">
              <div class="d-flex align-center mb-3">
                <VIcon :icon="tabItem.icon" size="22" class="me-2" />
                <h6 class="text-h6 mb-0">
                  {{ tabItem.title }}
                </h6>
              </div>

              <p class="text-body-1 mb-0">
                {{ tabItem.description }}
              </p>
            </VCardText>
          </VCard>
        </VWindowItem>
      </VWindow>
    </VCol>
  </VRow>

  <ReceiptUpsertDrawer
    v-model:is-drawer-open="isReceiptDrawerOpen"
    :editing-receipt="editingReceipt"
    :creation-mode="receiptCreationMode"
    :client-options="clientOptions"
    :invoice-options="invoiceOptions"
    :proforma-options="proformaOptions"
    @submit="saveReceipt"
  />

  <ExpenseUpsertDrawer
    v-model:is-drawer-open="isExpenseDrawerOpen"
    :editing-expense="editingExpense"
    :supplier-options="expenseSupplierOptions"
    :category-options="expenseCategoryOptions"
    @submit="saveExpense"
    @pay="openExpensePaymentDrawerFromDraft"
  />

  <ExpensePaymentDrawer
    v-model:is-drawer-open="isExpensePaymentDrawerOpen"
    :expense-draft="pendingExpensePaymentPayload?.expense ?? null"
    :current-balance="Number(pendingExpensePaymentPayload?.expense.balance ?? pendingExpensePaymentPayload?.expense.amount ?? 0) || 0"
    :allow-edit-payments="allowExpensePaymentEditing"
    :existing-payments="pendingExpensePayments"
    @submit="saveExpensePayment($event, pendingExpensePaymentPayload)"
    @update:is-drawer-open="$event ? (isExpensePaymentDrawerOpen = true) : closeExpensePaymentDrawer()"
  />

  <DebitNoteUpsertDrawer
    v-model:is-drawer-open="isDebitNoteDrawerOpen"
    :editing-note="editingDebitNote"
    :invoice-options="noteInvoiceOptions"
    @submit="saveDebitNote"
  />

  <CreditNoteUpsertDrawer
    v-model:is-drawer-open="isCreditNoteDrawerOpen"
    :editing-note="editingCreditNote"
    :invoice-options="noteInvoiceOptions"
    @submit="saveCreditNote"
  />
</template>

<style lang="scss">
.finance-tabs {
  inline-size: 100%;
  max-inline-size: 14rem;
}

.finance-tab-item {
  justify-content: flex-start;
  min-block-size: 2.5rem;
  padding-inline: 0.75rem;
}

.finance-tab-item :deep(.v-tab__slider) {
  display: none;
}

.finance-tab-item :deep(.v-icon) {
  margin-inline-end: 0.5rem;
}
</style>
