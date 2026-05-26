<script setup lang="ts">
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useCreditNotesStore } from "@/stores/creditNotes";
import { useDebitNotesStore } from "@/stores/debitNotes";
import { useExpensesStore } from "@/stores/expenses";
import { useInvoicesStore } from "@/stores/invoices";
import { usePaymentVouchersStore } from "@/stores/paymentVouchers";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { formatSystemDate } from "@core/utils/formatters";

type SoaEntry = {
  id: string;
  date: string;
  type: "Invoice" | "Receipt" | "Credit Note" | "Debit Note" | "Purchase" | "Payment";
  reference: string;
  side: "customer" | "supplier";
  debit: number;
  credit: number;
  amount: number;
  balance?: number;
};

type SoaViewMode = "all" | "customer" | "supplier";

const props = defineProps<{ user: ContactProperties | null }>();

const invoicesStore = useInvoicesStore();
const receiptsStore = useReceiptsStore();
const expensesStore = useExpensesStore();
const debitNotesStore = useDebitNotesStore();
const creditNotesStore = useCreditNotesStore();
const proformasStore = useProformasStore();
const paymentVouchersStore = usePaymentVouchersStore();

invoicesStore.init();
receiptsStore.init();
expensesStore.init();
debitNotesStore.init();
creditNotesStore.init();
proformasStore.init();
paymentVouchersStore.init();

const hideZeroRows = ref(true);
const statementSearch = ref("");
const statementViewMode = ref<SoaViewMode>("all");
const statementPage = ref(1);
const statementItemsPerPage = ref(10);
const statementItemsPerPageOptions = [
  { title: "10", value: 10 },
  { title: "25", value: 25 },
  { title: "50", value: 50 },
  { title: "All", value: -1 },
];
const isVoucherDialogOpen = ref(false);
const selectedVoucherNumber = ref("");

const matchText = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const contactName = computed(() => matchText(props.user?.fullName));
const contactEmail = computed(() => matchText(props.user?.email));
const contactId = computed(() => Number(props.user?.id) || null);

const isMatchingContact = (name?: string | null, email?: string | null) => {
  const normalizedName = matchText(name);
  const normalizedEmail = matchText(email);

  if (!contactName.value && !contactEmail.value) return false;
  if (contactEmail.value && normalizedEmail && contactEmail.value === normalizedEmail) {
    return true;
  }
  if (contactName.value && normalizedName && contactName.value === normalizedName) {
    return true;
  }

  return false;
};

const matchingInvoices = computed(() =>
  invoicesStore.all.filter((record) => {
    if (record.quotation.parentQuotationId) return false;
    return isMatchingContact(
      record.quotation.client.name || record.quotation.client.company,
      record.quotation.client.companyEmail,
    );
  }),
);

const matchingInvoiceIdSet = computed(
  () => new Set(matchingInvoices.value.map((record) => Number(record.quotation.id))),
);

const matchingReceipts = computed(() =>
  receiptsStore.all.filter((record) =>
    isMatchingContact(
      record.receipt.client.name || record.receipt.client.company,
      record.receipt.client.companyEmail,
    ),
  ),
);

const matchingExpenses = computed(() =>
  expensesStore.all.filter((record) =>
    (contactId.value !== null &&
      Number(record.expense.supplier.id) === Number(contactId.value)) ||
    isMatchingContact(record.expense.supplier.name, record.expense.supplier.email || ""),
  ),
);

const matchingDebitNotes = computed(() =>
  debitNotesStore.all.filter(
    (note) =>
      matchingInvoiceIdSet.value.has(Number(note.linkedInvoiceId)) ||
      isMatchingContact(note.clientName, ""),
  ),
);

const matchingCreditNotes = computed(() =>
  creditNotesStore.all.filter(
    (note) =>
      matchingInvoiceIdSet.value.has(Number(note.linkedInvoiceId)) ||
      isMatchingContact(note.clientName, ""),
  ),
);

const hasCustomerRole = computed(() => {
  if (props.user?.class === "Client" || props.user?.roles?.includes("client")) {
    return true;
  }
  return (
    matchingInvoices.value.length > 0 ||
    matchingReceipts.value.length > 0 ||
    matchingDebitNotes.value.length > 0 ||
    matchingCreditNotes.value.length > 0
  );
});

const hasSupplierRole = computed(() => {
  if (
    props.user?.class === "Supplier" ||
    props.user?.roles?.includes("supplier")
  ) {
    return true;
  }
  return matchingExpenses.value.length > 0;
});

const showCustomerCard = computed(
  () => hasCustomerRole.value || !hasSupplierRole.value,
);
const showSupplierCard = computed(
  () => hasSupplierRole.value || !hasCustomerRole.value,
);

const statementViewOptions = computed(() => {
  const options: Array<{ title: string; value: SoaViewMode }> = [
    { title: "All", value: "all" },
  ];

  if (hasCustomerRole.value) {
    options.push({ title: "Customer Only", value: "customer" });
  }
  if (hasSupplierRole.value) {
    options.push({ title: "Supplier Only", value: "supplier" });
  }

  return options;
});

const kpis = computed(() => {
  const invoiced = matchingInvoices.value.reduce(
    (sum, record) => sum + Math.max(0, Number(record.quotation.total) || 0),
    0,
  );
  const received = matchingReceipts.value.reduce(
    (sum, record) => sum + Math.max(0, Number(record.receipt.amount) || 0),
    0,
  );
  const purchase = matchingExpenses.value.reduce(
    (sum, record) => sum + Math.max(0, Number(record.expense.amount) || 0),
    0,
  );
  const paid = matchingExpenses.value.reduce(
    (sum, record) =>
      sum +
      (record.payments ?? []).reduce(
        (inner, payment) => inner + Math.max(0, Number(payment.amount) || 0),
        0,
      ),
    0,
  );
  const unbilledRevenue = Math.max(
    0,
    proformasStore.all
      .filter((record) => !record.quotation.parentQuotationId)
      .filter((record) =>
        isMatchingContact(
          record.quotation.client.name || record.quotation.client.company,
          record.quotation.client.companyEmail,
        ),
      )
      .reduce(
        (sum, record) => sum + Math.max(0, Number(record.quotation.total) || 0),
        0,
      ) - invoiced,
  );

  const customerCredits = matchingCreditNotes.value.reduce(
    (sum, note) => sum + Math.max(0, Number(note.amount) || 0),
    0,
  );
  const customerDebits = matchingDebitNotes.value.reduce(
    (sum, note) => sum + Math.max(0, Number(note.amount) || 0),
    0,
  );
  const customerAdjustments = customerDebits - customerCredits;
  const outstandingCustomer =
    invoiced + customerAdjustments - received;
  const outstandingSupplier = purchase - paid;

  return {
    invoiced,
    received,
    customerAdjustments,
    outstandingCustomer,
    purchase,
    paid,
    outstandingSupplier,
    unbilledRevenue,
    netPosition: outstandingCustomer - outstandingSupplier,
  };
});

const formatSignedMoney = (value: number) =>
  `${value > 0 ? "+" : ""}$${value.toLocaleString()}`;

const customerBalanceLabel = computed(() =>
  kpis.value.outstandingCustomer < 0 ? "Customer Credit" : "Net Balance",
);

const supplierBalanceLabel = computed(() =>
  kpis.value.outstandingSupplier < 0 ? "Supplier Advance" : "Net Balance",
);

const selectedVoucher = computed(() =>
  paymentVouchersStore.all.find(
    (voucher) => voucher.voucherNumber === selectedVoucherNumber.value,
  ) ?? null,
);

const findVoucherByNumber = (voucherNumber: string) =>
  paymentVouchersStore.all.find(
    (voucher) => voucher.voucherNumber === voucherNumber,
  ) ?? null;

const openVoucherDialog = (voucherNumber: string) => {
  const voucher = findVoucherByNumber(voucherNumber);
  if (!voucher) return;
  selectedVoucherNumber.value = voucher.voucherNumber;
  isVoucherDialogOpen.value = true;
};

const ledgerRows = computed(() => {
  const rows: SoaEntry[] = [];

  matchingInvoices.value.forEach((record) => {
    const amount = Math.max(0, Number(record.quotation.total) || 0);
    rows.push({
      id: `invoice-${record.quotation.id}`,
      date: record.quotation.issuedDate,
      type: "Invoice",
      reference: record.quotation.quoteNumber,
      side: "customer",
      debit: amount,
      credit: 0,
      amount,
    });
  });

  matchingReceipts.value.forEach((record) => {
    const amount = Math.max(0, Number(record.receipt.amount) || 0);
    rows.push({
      id: `receipt-${record.receipt.id}`,
      date: record.receipt.receivedDate,
      type: "Receipt",
      reference: record.receipt.receiptNumber,
      side: "customer",
      debit: 0,
      credit: amount,
      amount,
    });
  });

  matchingCreditNotes.value.forEach((note) => {
    const amount = Math.max(0, Number(note.amount) || 0);
    rows.push({
      id: `credit-note-${note.id}`,
      date: note.issuedDate,
      type: "Credit Note",
      reference: note.noteNumber,
      side: "customer",
      debit: 0,
      credit: amount,
      amount,
    });
  });

  matchingDebitNotes.value.forEach((note) => {
    const amount = Math.max(0, Number(note.amount) || 0);
    rows.push({
      id: `debit-note-${note.id}`,
      date: note.issuedDate,
      type: "Debit Note",
      reference: note.noteNumber,
      side: "customer",
      debit: amount,
      credit: 0,
      amount,
    });
  });

  matchingExpenses.value.forEach((record) => {
    const amount = Math.max(0, Number(record.expense.amount) || 0);
    rows.push({
      id: `expense-${record.expense.id}`,
      date: record.expense.billDate,
      type: "Purchase",
      reference: record.expense.billNumber,
      side: "supplier",
      debit: amount,
      credit: 0,
      amount,
    });

    (record.payments ?? []).forEach((payment) => {
      const paymentAmount = Math.max(0, Number(payment.amount) || 0);
      rows.push({
        id: `expense-payment-${payment.id}`,
        date: payment.date,
        type: "Payment",
        reference: payment.voucherNumber || record.expense.billNumber,
        side: "supplier",
        debit: 0,
        credit: paymentAmount,
        amount: paymentAmount,
      });
    });
  });

  rows.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });

  return rows;
});

const scopedLedgerRows = computed(() => {
  const scoped =
    statementViewMode.value === "all"
      ? ledgerRows.value
      : ledgerRows.value.filter((entry) => entry.side === statementViewMode.value);

  let runningBalance = 0;
  return scoped.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return {
      ...entry,
      balance: runningBalance,
    };
  });
});

const filteredLedgerRows = computed(() => {
  const query = statementSearch.value.trim().toLowerCase();

  return scopedLedgerRows.value.filter((entry) => {
    if (hideZeroRows.value && entry.amount <= 0) return false;
    if (!query) return true;

    const haystack = [
      entry.type,
      entry.reference,
      entry.side,
      formatSystemDate(entry.date),
      String(entry.debit),
      String(entry.credit),
      String(entry.balance ?? 0),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

const totalStatementRows = computed(() => filteredLedgerRows.value.length);

const totalStatementPages = computed(() => {
  if (statementItemsPerPage.value === -1) return 1;
  return Math.max(
    1,
    Math.ceil(totalStatementRows.value / statementItemsPerPage.value),
  );
});

watch(
  [statementSearch, statementViewMode, hideZeroRows, statementItemsPerPage],
  () => {
    statementPage.value = 1;
  },
);

watch(totalStatementPages, (pages) => {
  if (statementPage.value > pages) {
    statementPage.value = pages;
  }
});

watch(statementViewOptions, (options) => {
  if (!options.some((option) => option.value === statementViewMode.value)) {
    statementViewMode.value = options[0]?.value ?? "all";
  }
});

const paginatedLedgerRows = computed(() => {
  if (statementItemsPerPage.value === -1) return filteredLedgerRows.value;

  const start = (statementPage.value - 1) * statementItemsPerPage.value;
  const end = start + statementItemsPerPage.value;
  return filteredLedgerRows.value.slice(start, end);
});

const statementRangeStart = computed(() => {
  if (!totalStatementRows.value) return 0;
  if (statementItemsPerPage.value === -1) return 1;
  return (statementPage.value - 1) * statementItemsPerPage.value + 1;
});

const statementRangeEnd = computed(() => {
  if (!totalStatementRows.value) return 0;
  if (statementItemsPerPage.value === -1) return totalStatementRows.value;
  return Math.min(
    totalStatementRows.value,
    statementPage.value * statementItemsPerPage.value,
  );
});

const statementNetBalance = computed(() => {
  if (!scopedLedgerRows.value.length) return 0;
  return Number(scopedLedgerRows.value[scopedLedgerRows.value.length - 1]?.balance || 0);
});

const statementNetLabel = computed(() => {
  if (statementNetBalance.value > 0) return "Amount contact owes us";
  if (statementNetBalance.value < 0) return "Amount we owe this contact";
  return "Net position";
});
</script>

<template>
  <VRow>
    <VCol v-if="showCustomerCard" cols="12" :md="showSupplierCard ? 6 : 12">
      <VCard>
        <VCardText>
          <div class="text-overline">Customer</div>
          <div class="soa-kpi-row">
            <span>Invoices</span>
            <strong>${{ kpis.invoiced.toLocaleString() }}</strong>
          </div>
          <div class="soa-kpi-row">
            <span>Adjustments</span>
            <strong
              :class="
                kpis.customerAdjustments > 0
                  ? 'text-error'
                  : kpis.customerAdjustments < 0
                    ? 'text-success'
                    : ''
              "
            >
              {{ formatSignedMoney(kpis.customerAdjustments) }}
            </strong>
          </div>
          <div class="soa-kpi-row">
            <span>Received</span>
            <strong>${{ kpis.received.toLocaleString() }}</strong>
          </div>
          <div class="soa-kpi-row">
            <span>{{ customerBalanceLabel }}</span>
            <strong
              :class="
                kpis.outstandingCustomer > 0
                  ? 'text-success'
                  : kpis.outstandingCustomer < 0
                    ? 'text-error'
                    : ''
              "
            >
              ${{ kpis.outstandingCustomer.toLocaleString() }}
            </strong>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol v-if="showSupplierCard" cols="12" :md="showCustomerCard ? 6 : 12">
      <VCard>
        <VCardText>
          <div class="text-overline">Supplier</div>
          <div class="soa-kpi-row">
            <span>Purchased</span>
            <strong>${{ kpis.purchase.toLocaleString() }}</strong>
          </div>
          <div class="soa-kpi-row">
            <span>Paid</span>
            <strong>${{ kpis.paid.toLocaleString() }}</strong>
          </div>
          <div class="soa-kpi-row">
            <span>{{ supplierBalanceLabel }}</span>
            <strong
              :class="
                kpis.outstandingSupplier > 0
                  ? 'text-error'
                  : kpis.outstandingSupplier < 0
                    ? 'text-success'
                    : ''
              "
            >
              ${{ kpis.outstandingSupplier.toLocaleString() }}
            </strong>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard>
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3 pb-2">
          <h6 class="text-h6 mb-0">Statement Of Account</h6>
        </VCardText>
        <VCardText class="pt-0">
          <div class="soa-table-tools">
            <VTextField
              v-model="statementSearch"
              density="compact"
              label="Search Statement"
              prepend-inner-icon="tabler-search"
              variant="outlined"
              hide-details
              class="soa-tool soa-tool-search"
            />
            <VSelect
              v-model="statementViewMode"
              :items="statementViewOptions"
              density="compact"
              label="View"
              item-title="title"
              item-value="value"
              variant="outlined"
              hide-details
              class="soa-tool"
            />
            <VSelect
              v-model="statementItemsPerPage"
              :items="statementItemsPerPageOptions"
              density="compact"
              label="Rows"
              item-title="title"
              item-value="value"
              variant="outlined"
              hide-details
              class="soa-tool"
            />
          </div>
          <VSwitch
            v-model="hideZeroRows"
            inset
            color="primary"
            label="Hide zero-value lines"
          />
        </VCardText>
        <VDivider />
        <VTable class="text-no-wrap">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Description</th>
              <th>Reference</th>
              <th class="text-end">Debit</th>
              <th class="text-end">Credit</th>
              <th class="text-end">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginatedLedgerRows" :key="row.id">
              <td>{{ formatSystemDate(row.date) }}</td>
              <td class="text-capitalize">{{ row.side }}</td>
              <td>{{ row.type }}</td>
              <td>
                <VBtn
                  v-if="row.type === 'Payment' && findVoucherByNumber(row.reference)"
                  variant="text"
                  density="compact"
                  class="px-0 text-none"
                  @click="openVoucherDialog(row.reference)"
                >
                  {{ row.reference }}
                </VBtn>
                <span v-else>{{ row.reference }}</span>
              </td>
              <td class="text-end">${{ row.debit.toLocaleString() }}</td>
              <td class="text-end">${{ row.credit.toLocaleString() }}</td>
              <td
                class="text-end"
                :class="
                  row.balance > 0
                    ? 'text-success'
                    : row.balance < 0
                      ? 'text-error'
                      : ''
                "
              >
                ${{ (row.balance ?? 0).toLocaleString() }}
              </td>
            </tr>
            <tr v-if="!paginatedLedgerRows.length">
              <td colspan="7" class="text-center text-medium-emphasis py-6">
                No statement lines found for this contact.
              </td>
            </tr>
          </tbody>
        </VTable>
        <VDivider />
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3">
          <span class="text-medium-emphasis text-sm">
            Showing {{ statementRangeStart }} to {{ statementRangeEnd }} of
            {{ totalStatementRows }} entries
          </span>
          <VPagination
            v-model="statementPage"
            :length="totalStatementPages"
            :total-visible="5"
            density="comfortable"
          />
        </VCardText>
        <VDivider />
        <VCardText class="d-flex align-center justify-end">
          <div class="soa-net-balance">
            <span class="text-medium-emphasis">{{ statementNetLabel }}</span>
            <strong
              :class="
                statementNetBalance > 0
                  ? 'text-success'
                  : statementNetBalance < 0
                    ? 'text-error'
                    : ''
              "
            >
              ${{ Math.abs(statementNetBalance).toLocaleString() }}
            </strong>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <VDialog v-model="isVoucherDialogOpen" max-width="520">
    <DialogCloseBtn @click="isVoucherDialogOpen = false" />
    <VCard>
      <VCardTitle>Payment Voucher</VCardTitle>
      <VCardText v-if="selectedVoucher">
        <div class="soa-kpi-row">
          <span>Voucher #</span>
          <strong>{{ selectedVoucher.voucherNumber }}</strong>
        </div>
        <div class="soa-kpi-row">
          <span>Bill #</span>
          <strong>{{ selectedVoucher.billNumber }}</strong>
        </div>
        <div class="soa-kpi-row">
          <span>Supplier</span>
          <strong>{{ selectedVoucher.supplierName }}</strong>
        </div>
        <div class="soa-kpi-row">
          <span>Date</span>
          <strong>{{ formatSystemDate(selectedVoucher.date) }}</strong>
        </div>
        <div class="soa-kpi-row">
          <span>Amount</span>
          <strong>${{ selectedVoucher.amount.toLocaleString() }}</strong>
        </div>
        <div class="soa-kpi-row">
          <span>Method</span>
          <strong>{{ selectedVoucher.paymentMethod }}</strong>
        </div>
      </VCardText>
      <VCardText v-else>
        Voucher not found.
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="tonal" @click="isVoucherDialogOpen = false">Close</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.soa-kpi-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-block-start: 0.5rem;
}

.soa-table-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-block-end: 0.75rem;
}

.soa-tool {
  max-inline-size: 180px;
  min-inline-size: 140px;
}

.soa-tool-search {
  flex: 1 1 260px;
  max-inline-size: 420px;
}

.soa-net-balance {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}
</style>
