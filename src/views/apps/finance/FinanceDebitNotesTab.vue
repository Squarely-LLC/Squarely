<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useDebitNotesStore } from "@/stores/debitNotes";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { formatSystemDate } from "@core/utils/formatters";

type InvoiceOption = {
  title: string;
  value: string;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  total: number;
};

const debitNotesStore = useDebitNotesStore();
const invoicesStore = useInvoicesStore();
const notifications = useNotificationsStore();
const router = useRouter();

debitNotesStore.init();
invoicesStore.init();

const searchQuery = ref("");
const selectedStatus = ref<"Draft" | "Issued" | "Voided" | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();

const isDrawerOpen = ref(false);
const editingNoteId = ref<number | null>(null);

const linkedInvoice = ref<string>("");
const issuedDate = ref("");
const amount = ref<string | number>("");
const reason = ref("");
const internalNote = ref("");
const status = ref<"Draft" | "Issued" | "Voided">("Draft");

const invoiceError = ref<string | null>(null);
const dateError = ref<string | null>(null);
const amountError = ref<string | null>(null);

const isDeleteDialogOpen = ref(false);
const pendingDeleteId = ref<number | null>(null);

const headers = [
  { title: "#", key: "id" },
  { title: "Invoice", key: "invoice" },
  { title: "Date", key: "date" },
  { title: "Amount", key: "amount" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const statusColor = (value: string) => {
  if (value === "Issued") return "success";
  if (value === "Voided") return "error";
  return "warning";
};

const invoiceOptions = computed<InvoiceOption[]>(() =>
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

const selectedInvoice = computed(
  () =>
    invoiceOptions.value.find((option) => option.value === linkedInvoice.value) ??
    null,
);

const notes = computed(() => debitNotesStore.all);
const editingNote = computed(() =>
  editingNoteId.value === null ? null : debitNotesStore.byId(editingNoteId.value),
);

const filteredNotes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let records = notes.value.filter((record) => {
    const matchesQuery =
      !query ||
      record.noteNumber.toLowerCase().includes(query) ||
      record.linkedInvoiceNumber.toLowerCase().includes(query) ||
      record.clientName.toLowerCase().includes(query) ||
      record.reason.toLowerCase().includes(query);
    const matchesStatus = !selectedStatus.value || record.status === selectedStatus.value;
    return matchesQuery && matchesStatus;
  });

  if (sortBy.value) {
    records = [...records].sort((left, right) => {
      const isDesc = orderBy.value === "desc";
      const field = sortBy.value ?? "";
      const map = {
        id: left.noteNumber.localeCompare(right.noteNumber),
        invoice: left.linkedInvoiceNumber.localeCompare(right.linkedInvoiceNumber),
        date: new Date(left.issuedDate).getTime() - new Date(right.issuedDate).getTime(),
        amount: left.amount - right.amount,
      } as Record<string, number>;

      return (map[field] || 0) * (isDesc ? -1 : 1);
    });
  }

  return records;
});

const totalNotes = computed(() => filteredNotes.value.length);
const paginatedNotes = computed(() => {
  if (itemsPerPage.value === -1) return filteredNotes.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return filteredNotes.value.slice(start, start + itemsPerPage.value);
});

const resetForm = () => {
  linkedInvoice.value = "";
  issuedDate.value = new Date().toISOString().slice(0, 10);
  amount.value = "";
  reason.value = "";
  internalNote.value = "";
  status.value = "Draft";
  invoiceError.value = null;
  dateError.value = null;
  amountError.value = null;
};

const openCreateDrawer = () => {
  editingNoteId.value = null;
  resetForm();
  isDrawerOpen.value = true;
};

const openEditDrawer = (id: number) => {
  const record = debitNotesStore.byId(id);
  if (!record) return;

  editingNoteId.value = id;
  linkedInvoice.value = String(record.linkedInvoiceId);
  issuedDate.value = record.issuedDate;
  amount.value = record.amount;
  reason.value = record.reason;
  internalNote.value = record.note;
  status.value = record.status;
  invoiceError.value = null;
  dateError.value = null;
  amountError.value = null;
  isDrawerOpen.value = true;
};

const validateForm = () => {
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

const submitNote = () => {
  if (!validateForm()) return;
  if (!selectedInvoice.value) return;

  const payload = {
    linkedInvoiceId: selectedInvoice.value.invoiceId,
    linkedInvoiceNumber: selectedInvoice.value.invoiceNumber,
    clientName: selectedInvoice.value.clientName,
    issuedDate: issuedDate.value,
    amount: Math.max(0, Number(amount.value) || 0),
    reason: reason.value.trim(),
    note: internalNote.value.trim(),
    status: status.value,
  };

  if (editingNoteId.value) {
    debitNotesStore.updateNote(editingNoteId.value, payload);
    notifications.push("Debit note updated successfully.", "success", 3500);
  } else {
    debitNotesStore.addNote(payload);
    notifications.push("Debit note created successfully.", "success", 3500);
  }

  isDrawerOpen.value = false;
  editingNoteId.value = null;
};

const openDeleteDialog = (id: number) => {
  pendingDeleteId.value = id;
  isDeleteDialogOpen.value = true;
};

const closeDeleteDialog = () => {
  pendingDeleteId.value = null;
  isDeleteDialogOpen.value = false;
};

const confirmDelete = () => {
  if (pendingDeleteId.value === null) return closeDeleteDialog();
  debitNotesStore.removeNote(pendingDeleteId.value);
  notifications.push("Debit note deleted successfully.", "success", 3500);
  closeDeleteDialog();
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const menuList = (id: number) => [
  {
    title: "Edit",
    value: "edit",
    prependIcon: "tabler-pencil",
    onClick: () => openEditDrawer(id),
  },
  {
    title: "Open Invoice",
    value: "open-invoice",
    prependIcon: "tabler-external-link",
    onClick: () => {
      const note = debitNotesStore.byId(id);
      if (!note) return;
      router.push(`/apps/invoice/preview/${note.linkedInvoiceId}`);
    },
  },
  {
    title: "Delete",
    value: "delete",
    prependIcon: "tabler-trash",
    class: "text-error",
    onClick: () => openDeleteDialog(id),
  },
];

watch([searchQuery, selectedStatus, itemsPerPage], () => {
  page.value = 1;
});

watch(totalNotes, (value) => {
  const maxPage =
    itemsPerPage.value === -1 ? 1 : Math.max(1, Math.ceil(value / itemsPerPage.value));
  if (page.value > maxPage) page.value = maxPage;
});
</script>

<template>
  <section id="debit-note-list">
    <VCard>
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="d-flex align-center gap-2">
          <span>Show</span>
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>

        <VSpacer />

        <div class="quotation-list-toolbar d-flex align-center flex-wrap gap-4">
          <div class="quotation-list-filter">
            <AppTextField v-model="searchQuery" placeholder="Search Debit Note" />
          </div>
          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="['Draft', 'Issued', 'Voided']"
            />
          </div>
          <VBtn prepend-icon="tabler-plus" @click="openCreateDrawer">Add Debit Note</VBtn>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :items-length="totalNotes"
        :headers="headers"
        :items="paginatedNotes"
        item-value="id"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          <VBtn
            variant="text"
            class="pa-0 text-none font-weight-medium"
            @click="openEditDrawer(item.id)"
          >
            {{ item.noteNumber }}
          </VBtn>
        </template>

        <template #item.invoice="{ item }">
          <div class="d-flex flex-column">
            <RouterLink :to="`/apps/invoice/preview/${item.linkedInvoiceId}`" class="text-link">
              {{ item.linkedInvoiceNumber }}
            </RouterLink>
            <span class="text-sm text-disabled">{{ item.clientName }}</span>
          </div>
        </template>

        <template #item.date="{ item }">{{ formatSystemDate(item.issuedDate) }}</template>
        <template #item.amount="{ item }">${{ item.amount.toLocaleString() }}</template>
        <template #item.status="{ item }">
          <VChip :color="statusColor(item.status)" size="x-small" variant="tonal" label>
            {{ item.status }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <MoreBtn :menu-list="menuList(item.id)" item-props color="undefined" />
        </template>
        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalNotes"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <VNavigationDrawer
      temporary
      location="end"
      :width="440"
      border="none"
      :scrim="true"
      style="z-index: 2000"
      :model-value="isDrawerOpen"
      class="scrollable-content"
      @update:model-value="isDrawerOpen = $event"
    >
      <AppDrawerHeaderSection
        :title="editingNote ? 'Edit Debit Note' : 'Add Debit Note'"
        @cancel="isDrawerOpen = false"
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
                :items="invoiceOptions"
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
              <VBtn class="me-3" @click="submitNote">
                {{ editingNote ? "Update" : "Save" }}
              </VBtn>
              <VBtn color="secondary" variant="tonal" @click="isDrawerOpen = false">
                Cancel
              </VBtn>
            </VCol>
          </VRow>
        </VCardText>
      </VCard>
    </VNavigationDrawer>

    <VDialog v-model="isDeleteDialogOpen" max-width="440" persistent>
      <VCard>
        <VCardText class="pt-6">
          Are you sure you want to delete this debit note?
        </VCardText>
        <VCardActions class="pt-2 px-6 pb-6">
          <DialogActionBar
            save-text="Delete"
            save-color="error"
            save-variant="tonal"
            cancel-text="Cancel"
            @save="confirmDelete"
            @cancel="closeDeleteDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#debit-note-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
