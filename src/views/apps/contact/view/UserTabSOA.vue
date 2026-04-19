<script setup lang="ts">
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useCreditNotesStore } from "@/stores/creditNotes";
import { useDebitNotesStore } from "@/stores/debitNotes";
import { useExpensesStore } from "@/stores/expenses";
import { useInvoicesStore } from "@/stores/invoices";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { formatSystemDate } from "@core/utils/formatters";

type SoaEntry = {
  id: string;
  date: string;
  type: "Invoice" | "Receipt" | "Credit Note" | "Debit Note" | "Purchase" | "Payment";
  reference: string;
  debit: number;
  credit: number;
  amount: number;
};

const props = defineProps<{ user: ContactProperties | null }>();

const invoicesStore = useInvoicesStore();
const receiptsStore = useReceiptsStore();
const expensesStore = useExpensesStore();
const debitNotesStore = useDebitNotesStore();
const creditNotesStore = useCreditNotesStore();
const proformasStore = useProformasStore();

invoicesStore.init();
receiptsStore.init();
expensesStore.init();
debitNotesStore.init();
creditNotesStore.init();
proformasStore.init();

const hideZeroRows = ref(true);

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
  if (props.user?.class === "Client") return true;
  return (
    matchingInvoices.value.length > 0 ||
    matchingReceipts.value.length > 0 ||
    matchingDebitNotes.value.length > 0 ||
    matchingCreditNotes.value.length > 0
  );
});

const hasSupplierRole = computed(() => {
  if (props.user?.class === "Supplier") return true;
  return matchingExpenses.value.length > 0;
});

const showCustomerCard = computed(
  () => hasCustomerRole.value || !hasSupplierRole.value,
);
const showSupplierCard = computed(
  () => hasSupplierRole.value || !hasCustomerRole.value,
);

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

const ledgerRows = computed(() => {
  const rows: SoaEntry[] = [];

  matchingInvoices.value.forEach((record) => {
    const amount = Math.max(0, Number(record.quotation.total) || 0);
    rows.push({
      id: `invoice-${record.quotation.id}`,
      date: record.quotation.issuedDate,
      type: "Invoice",
      reference: record.quotation.quoteNumber,
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
      debit: 0,
      credit: amount,
      amount,
    });

    (record.payments ?? []).forEach((payment) => {
      const paymentAmount = Math.max(0, Number(payment.amount) || 0);
      rows.push({
        id: `expense-payment-${payment.id}`,
        date: payment.date,
        type: "Payment",
        reference: payment.voucherNumber || record.expense.billNumber,
        debit: paymentAmount,
        credit: 0,
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

  let runningBalance = 0;

  return rows
    .map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return {
        ...entry,
        balance: runningBalance,
      };
    })
    .filter((entry) => !hideZeroRows.value || entry.amount > 0);
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
            <span>Outstanding</span>
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
            <span>Outstanding</span>
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
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3">
          <h6 class="text-h6 mb-0">Statement Of Account</h6>
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
              <th>Description</th>
              <th>Reference</th>
              <th class="text-end">Debit</th>
              <th class="text-end">Credit</th>
              <th class="text-end">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in ledgerRows" :key="row.id">
              <td>{{ formatSystemDate(row.date) }}</td>
              <td>{{ row.type }}</td>
              <td>{{ row.reference }}</td>
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
                ${{ row.balance.toLocaleString() }}
              </td>
            </tr>
            <tr v-if="!ledgerRows.length">
              <td colspan="6" class="text-center text-medium-emphasis py-6">
                No statement lines found for this contact.
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCard>
    </VCol>
  </VRow>
</template>

<style scoped>
.soa-kpi-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-block-start: 0.5rem;
}
</style>
