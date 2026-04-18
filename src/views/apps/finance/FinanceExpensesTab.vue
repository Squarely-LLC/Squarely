<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useExpensesStore } from "@/stores/expenses";
import { useNotificationsStore } from "@/stores/notifications";
import { formatSystemDate } from "@core/utils/formatters";

interface Emit {
  (e: "create-expense"): void;
  (e: "edit-expense", expenseId: number): void;
}

const emit = defineEmits<Emit>();

const expensesStore = useExpensesStore();
const notifications = useNotificationsStore();

expensesStore.init();

const searchQuery = ref("");
const selectedStatus = ref<"Open" | "Paid" | "Flagged" | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();
const isDeleteExpenseDialogOpen = ref(false);
const pendingDeleteExpenseId = ref<number | null>(null);

const headers = [
  { title: "#", key: "id" },
  { title: "Supplier", key: "supplier" },
  { title: "Date", key: "date" },
  { title: "Amount", key: "amount" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const expenseRecords = computed(() => expensesStore.all);
const pendingDeleteExpense = computed(() =>
  pendingDeleteExpenseId.value === null
    ? null
    : expensesStore.byId(pendingDeleteExpenseId.value),
);

const filteredExpenses = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  let records = expenseRecords.value.filter((record) => {
    const expense = record.expense;
    const matchesQuery =
      !query ||
      expense.supplier.name.toLowerCase().includes(query) ||
      expense.billNumber.toLowerCase().includes(query) ||
      expense.supplierInvoiceNumber.toLowerCase().includes(query) ||
      expense.category.toLowerCase().includes(query);

    const matchesStatus =
      !selectedStatus.value || expense.status === selectedStatus.value;

    return matchesQuery && matchesStatus;
  });

  if (sortBy.value) {
    records = [...records].sort((left, right) => {
      const isDescending = orderBy.value === "desc";
      const leftExpense = left.expense;
      const rightExpense = right.expense;
      const sortKey = sortBy.value ?? "";

      const fieldMap = {
        supplier: leftExpense.supplier.name.localeCompare(rightExpense.supplier.name),
        id: leftExpense.billNumber.localeCompare(rightExpense.billNumber),
        amount: leftExpense.amount - rightExpense.amount,
        date:
          new Date(leftExpense.billDate).getTime() -
          new Date(rightExpense.billDate).getTime(),
      } as Record<string, number>;

      return (fieldMap[sortKey] || 0) * (isDescending ? -1 : 1);
    });
  }

  return records;
});

const totalExpenses = computed(() => filteredExpenses.value.length);

const paginatedExpenses = computed(() => {
  if (itemsPerPage.value === -1)
    return filteredExpenses.value.map((entry) => entry.expense);

  const start = (page.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;

  return filteredExpenses.value.slice(start, end).map((entry) => entry.expense);
});

const statusChipColor = (status: string) => {
  if (status === "Flagged") return "warning";
  if (status === "Paid") return "success";
  return "primary";
};

const openCreateExpenseDrawer = () => {
  emit("create-expense");
};

const openEditExpenseDrawer = (expenseId: number) => {
  emit("edit-expense", expenseId);
};

const deleteDialogMessage = computed(() => {
  const expense = pendingDeleteExpense.value?.expense;
  if (!expense) return "";
  return `Are you sure you want to delete bill ${expense.billNumber}?`;
});

const openDeleteExpenseDialog = (expenseId: number) => {
  pendingDeleteExpenseId.value = expenseId;
  isDeleteExpenseDialogOpen.value = true;
};

const closeDeleteExpenseDialog = () => {
  isDeleteExpenseDialogOpen.value = false;
  pendingDeleteExpenseId.value = null;
};

const confirmDeleteExpense = () => {
  if (pendingDeleteExpenseId.value === null) return closeDeleteExpenseDialog();

  const expenseNumber =
    pendingDeleteExpense.value?.expense.billNumber || "Bill";
  expensesStore.removeExpense(pendingDeleteExpenseId.value);
  notifications.push(`${expenseNumber} deleted successfully.`, "success", 3500);
  closeDeleteExpenseDialog();
};

const computedMoreList = computed(() => {
  return (expenseId: number) => [
    {
      title: "Edit",
      value: "edit",
      prependIcon: "tabler-pencil",
      onClick: () => openEditExpenseDrawer(expenseId),
    },
    {
      title: "Delete",
      value: "delete",
      prependIcon: "tabler-trash",
      class: "text-error",
      onClick: () => openDeleteExpenseDialog(expenseId),
    },
  ];
});

watch([searchQuery, selectedStatus, itemsPerPage], () => {
  page.value = 1;
});

watch(totalExpenses, (value) => {
  const maxPage =
    itemsPerPage.value === -1
      ? 1
      : Math.max(1, Math.ceil(value / itemsPerPage.value));
  if (page.value > maxPage) page.value = maxPage;
});
</script>

<template>
  <section id="expense-list">
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
            <AppTextField v-model="searchQuery" placeholder="Search Bill" />
          </div>

          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Bill Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="['Open', 'Paid', 'Flagged']"
            />
          </div>

          <VBtn prepend-icon="tabler-plus" @click="openCreateExpenseDrawer">
            Add Bill
          </VBtn>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :items-length="totalExpenses"
        :headers="headers"
        :items="paginatedExpenses"
        item-value="id"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          {{ item.billNumber }}
        </template>

        <template #item.supplier="{ item }">
          <div class="d-flex flex-column">
            <span class="font-weight-medium">
              {{ item.supplier.name }}
            </span>
            <span class="text-sm text-disabled">
              {{ item.category || "Uncategorized" }}
            </span>
          </div>
        </template>

        <template #item.amount="{ item }">
          ${{ item.amount.toLocaleString() }}
        </template>

        <template #item.date="{ item }">
          {{ formatSystemDate(item.billDate) }}
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="statusChipColor(item.status)"
            label
            size="x-small"
            variant="tonal"
          >
            {{ item.status }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <MoreBtn
            :menu-list="computedMoreList(item.id)"
            item-props
            color="undefined"
          />
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalExpenses"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog v-model="isDeleteExpenseDialogOpen" max-width="440" persistent>
      <VCard>
        <VCardText class="pt-6">
          {{ deleteDialogMessage }}
        </VCardText>

        <VCardActions class="pt-2 px-6 pb-6">
          <DialogActionBar
            save-text="Delete"
            save-color="error"
            save-variant="tonal"
            cancel-text="Cancel"
            @save="confirmDeleteExpense"
            @cancel="closeDeleteExpenseDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#expense-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
