<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useExpensesStore } from "@/stores/expenses";
import { useNotificationsStore } from "@/stores/notifications";
import { usePaymentVouchersStore } from "@/stores/paymentVouchers";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";

interface Emit {
  (e: "create-expense"): void;
  (e: "edit-expense", expenseId: number): void;
  (e: "pay-expense", expenseId: number): void;
}

const emit = defineEmits<Emit>();

const router = useRouter();
const expensesStore = useExpensesStore();
const paymentVouchersStore = usePaymentVouchersStore();
const notifications = useNotificationsStore();

expensesStore.init();
paymentVouchersStore.init();

const previewActionFrame = ref<HTMLIFrameElement | null>(null);
const isPreviewActionFrameReady = ref(false);
const loadedPreviewExpenseId = ref<number | null>(null);
const pendingPreviewAction = ref<{
  expenseId: number;
  action: "print" | "download";
} | null>(null);

const searchQuery = ref("");
const selectedStatus = ref<
  "Open" | "Paid" | "Flagged" | "Partially Paid" | null
>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();
const isDeleteExpenseDialogOpen = ref(false);
const pendingDeleteExpenseId = ref<number | null>(null);
const isEmailDialogOpen = ref(false);
const pendingEmailExpenseId = ref<number | null>(null);
const emailDialogRef = ref<any | null>(null);
const isVoucherDialogOpen = ref(false);
const voucherDialogBillNumber = ref("");

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
const emailExpenseRecord = computed(() =>
  pendingEmailExpenseId.value === null
    ? null
    : expensesStore.byId(pendingEmailExpenseId.value),
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
  if (status === "Partially Paid") return "info";
  return "primary";
};

const openCreateExpenseDrawer = () => {
  emit("create-expense");
};

const openEditExpenseDrawer = (expenseId: number) => {
  emit("edit-expense", expenseId);
};

const openPayExpenseDrawer = (expenseId: number) => {
  emit("pay-expense", expenseId);
};

const ensurePreviewActionFrame = () => {
  if (!previewActionFrame.value) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.insetInlineStart = "-2000px";
    iframe.style.insetBlockStart = "0";
    iframe.style.inlineSize = "1280px";
    iframe.style.blockSize = "1800px";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
    previewActionFrame.value = iframe;
  }
};

const sendPreviewAction = (expenseId: number, action: "print" | "download") => {
  if (!previewActionFrame.value?.contentWindow) return;

  previewActionFrame.value.contentWindow.postMessage(
    {
      type: "expense-preview-action",
      payload: { action },
    },
    window.location.origin,
  );

  notifications.push(
    `${action === "download" ? "Download" : "Print"} started for bill ${expensesStore.byId(expenseId)?.expense.billNumber || expenseId}.`,
    "success",
    3500,
  );
};

const flushPendingPreviewAction = () => {
  const pendingAction = pendingPreviewAction.value;
  if (!pendingAction || !isPreviewActionFrameReady.value) return;
  if (loadedPreviewExpenseId.value !== pendingAction.expenseId) return;

  sendPreviewAction(pendingAction.expenseId, pendingAction.action);
  pendingPreviewAction.value = null;
};

const handlePreviewActionFrameMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "expense-preview-ready") return;

  isPreviewActionFrameReady.value = true;
  loadedPreviewExpenseId.value = Number(event.data?.expenseId || 0) || null;
  flushPendingPreviewAction();
};

const openExpensePreview = (
  expenseId: number,
  action?: "print" | "download" | "email",
) => {
  if (action === "print" || action === "download") {
    ensurePreviewActionFrame();
    if (!previewActionFrame.value) return;

    pendingPreviewAction.value = { expenseId, action };

    const resolved = router.resolve({
      path: `/apps/expense/preview/${expenseId}`,
      query: { embedded: "1" },
    });

    if (previewActionFrame.value.src !== resolved.href) {
      isPreviewActionFrameReady.value = false;
      loadedPreviewExpenseId.value = null;
      previewActionFrame.value.src = resolved.href;
      return;
    }

    flushPendingPreviewAction();
    return;
  }

  const resolved = router.resolve({
    path: `/apps/expense/preview/${expenseId}`,
    query: action === "email" ? { email: "1" } : {},
  });

  window.open(resolved.href, "_blank", "noopener,noreferrer");
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

const expenseEmailDraft = computed(() => {
  const expense = emailExpenseRecord.value?.expense;
  if (!expense) {
    return { to: "", subject: "", message: "", attachments: [] };
  }

  return {
    to: expense.supplier.email?.trim() || "",
    subject: `Bill ${expense.billNumber}`,
    message: `Dear ${expense.supplier.name || "there"},

Please find bill ${expense.billNumber} attached.

Amount: $${expense.amount.toLocaleString()}

Thank you,
Squarely`.trim(),
    attachments: [{ name: `${expense.billNumber}.pdf` }],
  };
});

const openExpenseEmailDialog = (expenseId: number) => {
  pendingEmailExpenseId.value = expenseId;
  isEmailDialogOpen.value = true;
  nextTick(() => {
    emailDialogRef.value?.openWith?.(expenseEmailDraft.value);
  });
};

const closeExpenseEmailDialog = () => {
  isEmailDialogOpen.value = false;
  pendingEmailExpenseId.value = null;
};

const onExpenseEmailSend = (payload: any) => {
  const recipients = Array.isArray(payload?.to)
    ? payload.to.filter(Boolean)
    : payload?.to
      ? [String(payload.to)]
      : [];
  const subject = String(payload?.subject || "(no subject)");
  notifications.push(
    `Email sent${recipients.length ? ` to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}` : ""}: ${subject}`,
    "success",
    3500,
  );
  closeExpenseEmailDialog();
};

const computedMoreList = computed(() => {
  return (expenseId: number) => {
    const expenseRecord = expensesStore.byId(expenseId);
    const canPay = Math.max(0, Number(expenseRecord?.expense.balance) || 0) > 0;
    const hasPayments = (expenseRecord?.payments?.length || 0) > 0;
    const canPayOrEditPayment = canPay || hasPayments;

    const hasVouchers = paymentVouchersStore.byBillNumber(
      expenseRecord?.expense.billNumber || "",
    ).length > 0;

    return [
      {
        title: "Edit",
        value: "edit",
        prependIcon: "tabler-pencil",
        onClick: () => openEditExpenseDrawer(expenseId),
      },
      ...(canPayOrEditPayment
        ? [
            {
              title: canPay ? "Pay" : "Edit Payment",
              value: "pay",
              prependIcon: "tabler-credit-card-pay",
              onClick: () => openPayExpenseDrawer(expenseId),
            },
          ]
        : []),
      {
        title: "Print",
        value: "print",
        prependIcon: "tabler-printer",
        onClick: () => openExpensePreview(expenseId, "print"),
      },
      {
        title: "Email",
        value: "email",
        prependIcon: "tabler-mail",
        onClick: () => openExpenseEmailDialog(expenseId),
      },
      {
        title: "Download",
        value: "download",
        prependIcon: "tabler-download",
        onClick: () => openExpensePreview(expenseId, "download"),
      },
      ...(hasVouchers
        ? [
            {
              title: "View Vouchers",
              value: "vouchers",
              prependIcon: "tabler-file-invoice",
              onClick: () => openVoucherDialog(expenseId),
            },
          ]
        : []),
      {
        title: "Delete",
        value: "delete",
        prependIcon: "tabler-trash",
        class: "text-error",
        onClick: () => openDeleteExpenseDialog(expenseId),
      },
    ];
  };
});

const voucherDialogEntries = computed(() =>
  paymentVouchersStore.byBillNumber(voucherDialogBillNumber.value),
);

const openVoucherDialog = (expenseId: number) => {
  const expenseRecord = expensesStore.byId(expenseId);
  if (!expenseRecord) return;
  voucherDialogBillNumber.value = expenseRecord.expense.billNumber;
  isVoucherDialogOpen.value = true;
};

onMounted(() => {
  window.addEventListener("message", handlePreviewActionFrameMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionFrameMessage);
  previewActionFrame.value?.remove();
  previewActionFrame.value = null;
  isPreviewActionFrameReady.value = false;
  loadedPreviewExpenseId.value = null;
  pendingPreviewAction.value = null;
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
              :items="['Open', 'Partially Paid', 'Paid', 'Flagged']"
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
          <div class="expense-reference-cell">
            <RouterLink
              :to="`/apps/expense/preview/${item.id}`"
              class="expense-reference-primary"
            >
              {{ item.supplierInvoiceNumber || "-" }}
            </RouterLink>
            <RouterLink
              :to="`/apps/expense/preview/${item.id}`"
              class="expense-reference-secondary"
            >
              {{ item.billNumber }}
            </RouterLink>
          </div>
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

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogOpen"
      @close="closeExpenseEmailDialog"
      @send="onExpenseEmailSend"
    />

    <VDialog v-model="isDeleteExpenseDialogOpen" max-width="440" persistent>
      <DialogCloseBtn @click="isDeleteExpenseDialogOpen = false" />
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

    <VDialog v-model="isVoucherDialogOpen" max-width="620">
      <DialogCloseBtn @click="isVoucherDialogOpen = false" />
      <VCard>
        <VCardTitle>
          Payment Vouchers - {{ voucherDialogBillNumber || "-" }}
        </VCardTitle>
        <VCardText>
          <VTable class="text-no-wrap">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in voucherDialogEntries" :key="entry.id">
                <td>{{ entry.voucherNumber }}</td>
                <td>{{ formatSystemDate(entry.date) }}</td>
                <td>${{ entry.amount.toLocaleString() }}</td>
                <td>{{ entry.paymentMethod }}</td>
                <td>{{ entry.supplierName }}</td>
              </tr>
              <tr v-if="!voucherDialogEntries.length">
                <td colspan="5" class="text-center text-medium-emphasis py-5">
                  No vouchers linked to this bill.
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="tonal" @click="isVoucherDialogOpen = false">
            Close
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#expense-list {
  .expense-reference-cell {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .expense-reference-primary {
    font-size: 0.95rem;
    font-weight: 700;
  }

  .expense-reference-secondary {
    color: rgba(var(--v-theme-on-surface), 0.65);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
