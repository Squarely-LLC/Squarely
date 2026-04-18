<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { saveFile } from "@/utils/fileStore";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import type { ReceiptDrawerSubmitPayload } from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import ReceiptUpsertDrawer from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import { formatSystemDate } from "@core/utils/formatters";

const router = useRouter();
const receiptsStore = useReceiptsStore();
const invoicesStore = useInvoicesStore();
const proformasStore = useProformasStore();
const notifications = useNotificationsStore();

receiptsStore.init();
invoicesStore.init();
proformasStore.init();

const searchQuery = ref("");
const selectedStatus = ref<"Recorded" | "Flagged" | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();

const isReceiptDrawerOpen = ref(false);
const editingReceiptId = ref<number | null>(null);
const isDeleteReceiptDialogOpen = ref(false);
const pendingDeleteReceiptId = ref<number | null>(null);
const isEmailDialogOpen = ref(false);
const pendingEmailReceiptId = ref<number | null>(null);
const emailDialogRef = ref<any | null>(null);

const headers = [
  { title: "Client", key: "client" },
  { title: "#", key: "id" },
  { title: "Source", key: "source" },
  { title: "Amount", key: "amount" },
  { title: "Received Date", key: "date" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const receiptRecords = computed(() => receiptsStore.all);
const editingReceipt = computed(() =>
  editingReceiptId.value === null
    ? null
    : receiptsStore.byId(editingReceiptId.value),
);
const pendingDeleteReceipt = computed(() =>
  pendingDeleteReceiptId.value === null
    ? null
    : receiptsStore.byId(pendingDeleteReceiptId.value),
);
const emailReceiptRecord = computed(() =>
  pendingEmailReceiptId.value === null
    ? null
    : receiptsStore.byId(pendingEmailReceiptId.value),
);

const invoiceOptions = computed(() =>
  invoicesStore.all
    .map((record) => record.quotation)
    .filter((quotation) => !quotation.parentQuotationId)
    .map((quotation) => ({
      title: `${quotation.quoteNumber} - ${quotation.client.name}`,
      value: quotation.id,
      documentNumber: quotation.quoteNumber,
      client: quotation.client,
    })),
);

const proformaOptions = computed(() =>
  proformasStore.all
    .map((record) => record.quotation)
    .filter((quotation) => !quotation.parentQuotationId)
    .map((quotation) => ({
      title: `${quotation.quoteNumber} - ${quotation.client.name}`,
      value: quotation.id,
      documentNumber: quotation.quoteNumber,
      client: quotation.client,
    })),
);

const resolveSourceLabel = (sourceType: string) => {
  if (sourceType === "invoice") return "Invoice";
  if (sourceType === "proforma") return "Proforma";
  if (sourceType === "attachment") return "Attachment only";
  return "Unlinked";
};

const sourceChipColor = (sourceType: string) => {
  if (sourceType === "invoice") return "primary";
  if (sourceType === "proforma") return "info";
  return "warning";
};

const statusChipColor = (status: string) =>
  status === "Flagged" ? "warning" : "success";

const filteredReceipts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  let records = receiptRecords.value.filter((record) => {
    const receipt = record.receipt;
    const relatedDocumentNumber =
      receipt.linkedInvoiceNumber || receipt.linkedProformaNumber || "";

    const matchesQuery =
      !query ||
      receipt.client.name.toLowerCase().includes(query) ||
      receipt.client.companyEmail.toLowerCase().includes(query) ||
      receipt.receiptNumber.toLowerCase().includes(query) ||
      relatedDocumentNumber.toLowerCase().includes(query);

    const matchesStatus =
      !selectedStatus.value || receipt.status === selectedStatus.value;

    return matchesQuery && matchesStatus;
  });

  if (sortBy.value) {
    records = [...records].sort((left, right) => {
      const isDescending = orderBy.value === "desc";
      const leftReceipt = left.receipt;
      const rightReceipt = right.receipt;

      const fieldMap = {
        client: leftReceipt.client.name.localeCompare(rightReceipt.client.name),
        id: leftReceipt.receiptNumber.localeCompare(rightReceipt.receiptNumber),
        amount: leftReceipt.amount - rightReceipt.amount,
        date:
          new Date(leftReceipt.receivedDate).getTime() -
          new Date(rightReceipt.receivedDate).getTime(),
        source: resolveSourceLabel(leftReceipt.sourceType).localeCompare(
          resolveSourceLabel(rightReceipt.sourceType),
        ),
      } as Record<string, number>;

      return (fieldMap[sortBy.value] || 0) * (isDescending ? -1 : 1);
    });
  }

  return records;
});

const totalReceipts = computed(() => filteredReceipts.value.length);

const paginatedReceipts = computed(() => {
  if (itemsPerPage.value === -1)
    return filteredReceipts.value.map((entry) => entry.receipt);

  const start = (page.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;

  return filteredReceipts.value.slice(start, end).map((entry) => entry.receipt);
});

const openCreateReceiptDrawer = () => {
  editingReceiptId.value = null;
  isReceiptDrawerOpen.value = true;
};

const openEditReceiptDrawer = (receiptId: number) => {
  editingReceiptId.value = receiptId;
  isReceiptDrawerOpen.value = true;
};

const closeReceiptDrawer = () => {
  isReceiptDrawerOpen.value = false;
  editingReceiptId.value = null;
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

const openReceiptPreview = (
  receiptId: number,
  action?: "print" | "download" | "email",
) => {
  const resolved = router.resolve({
    path: `/apps/receipt/preview/${receiptId}`,
    query:
      action === "print"
        ? { print: "1" }
        : action === "download"
          ? { download: "1" }
          : action === "email"
            ? { email: "1" }
            : {},
  });

  window.open(resolved.href, "_blank", "noopener,noreferrer");
};

const deleteDialogMessage = computed(() => {
  const receipt = pendingDeleteReceipt.value?.receipt;
  if (!receipt) return "";
  return `Are you sure you want to delete receipt ${receipt.receiptNumber}?`;
});

const openDeleteReceiptDialog = (receiptId: number) => {
  pendingDeleteReceiptId.value = receiptId;
  isDeleteReceiptDialogOpen.value = true;
};

const closeDeleteReceiptDialog = () => {
  isDeleteReceiptDialogOpen.value = false;
  pendingDeleteReceiptId.value = null;
};

const confirmDeleteReceipt = () => {
  if (pendingDeleteReceiptId.value === null) return closeDeleteReceiptDialog();

  const receiptNumber =
    pendingDeleteReceipt.value?.receipt.receiptNumber || "Receipt";
  receiptsStore.removeReceipt(pendingDeleteReceiptId.value);
  notifications.push(`${receiptNumber} deleted successfully.`, "success", 3500);
  closeDeleteReceiptDialog();
};

const receiptEmailDraft = computed(() => {
  const receipt = emailReceiptRecord.value?.receipt;
  if (!receipt) {
    return { to: "", subject: "", message: "", attachments: [] };
  }

  return {
    to: receipt.client.companyEmail?.trim() || "",
    subject: `Receipt ${receipt.receiptNumber}`,
    message: `Dear ${receipt.client.name || "there"},

Please find receipt ${receipt.receiptNumber} attached.

Amount received: $${receipt.amount.toLocaleString()}

Thank you,
Squarely`.trim(),
    attachments: [{ name: `${receipt.receiptNumber}.pdf` }],
  };
});

const openReceiptEmailDialog = (receiptId: number) => {
  pendingEmailReceiptId.value = receiptId;
  isEmailDialogOpen.value = true;
  nextTick(() => {
    emailDialogRef.value?.openWith?.(receiptEmailDraft.value);
  });
};

const closeReceiptEmailDialog = () => {
  isEmailDialogOpen.value = false;
  pendingEmailReceiptId.value = null;
};

const onReceiptEmailSend = (payload: any) => {
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
  closeReceiptEmailDialog();
};

const computedMoreList = computed(() => {
  return (receiptId: number) => [
    {
      title: "Edit",
      value: "edit",
      prependIcon: "tabler-pencil",
      onClick: () => openEditReceiptDrawer(receiptId),
    },
    {
      title: "Print",
      value: "print",
      prependIcon: "tabler-printer",
      onClick: () => openReceiptPreview(receiptId, "print"),
    },
    {
      title: "Email",
      value: "email",
      prependIcon: "tabler-mail",
      onClick: () => openReceiptEmailDialog(receiptId),
    },
    {
      title: "Download",
      value: "download",
      prependIcon: "tabler-download",
      onClick: () => openReceiptPreview(receiptId, "download"),
    },
    {
      title: "Delete",
      value: "delete",
      prependIcon: "tabler-trash",
      class: "text-error",
      onClick: () => openDeleteReceiptDialog(receiptId),
    },
  ];
});

watch([searchQuery, selectedStatus, itemsPerPage], () => {
  page.value = 1;
});

watch(totalReceipts, (value) => {
  const maxPage =
    itemsPerPage.value === -1
      ? 1
      : Math.max(1, Math.ceil(value / itemsPerPage.value));
  if (page.value > maxPage) page.value = maxPage;
});
</script>

<template>
  <section id="receipt-list">
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
            <AppTextField v-model="searchQuery" placeholder="Search Receipt" />
          </div>

          <div class="quotation-list-filter">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Receipt Status"
              clearable
              clear-icon="tabler-x"
              single-line
              :items="['Recorded', 'Flagged']"
            />
          </div>

          <VBtn prepend-icon="tabler-plus" @click="openCreateReceiptDrawer">
            Add Receipt
          </VBtn>
        </div>
      </VCardText>
      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :items-length="totalReceipts"
        :headers="headers"
        :items="paginatedReceipts"
        item-value="id"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.id="{ item }">
          <RouterLink :to="`/apps/receipt/preview/${item.id}`">
            {{ item.receiptNumber }}
          </RouterLink>
        </template>

        <template #item.client="{ item }">
          <div class="d-flex flex-column">
            <RouterLink
              :to="`/apps/receipt/preview/${item.id}`"
              class="text-link font-weight-medium"
            >
              {{ item.client.name }}
            </RouterLink>

            <RouterLink
              v-if="item.linkedInvoiceId"
              :to="`/apps/invoice/preview/${item.linkedInvoiceId}`"
              class="text-sm text-link"
            >
              Invoice #{{ item.linkedInvoiceNumber }}
            </RouterLink>

            <RouterLink
              v-else-if="item.linkedProformaId"
              :to="`/apps/proforma/preview/${item.linkedProformaId}`"
              class="text-sm text-link"
            >
              Proforma #{{ item.linkedProformaNumber }}
            </RouterLink>

            <span v-else class="text-sm text-warning">
              No linked invoice / proforma
            </span>
          </div>
        </template>

        <template #item.source="{ item }">
          <VChip
            :color="sourceChipColor(item.sourceType)"
            label
            size="x-small"
            variant="tonal"
          >
            {{ resolveSourceLabel(item.sourceType) }}
          </VChip>
        </template>

        <template #item.amount="{ item }">
          ${{ item.amount.toLocaleString() }}
        </template>

        <template #item.date="{ item }">
          {{ formatSystemDate(item.receivedDate) }}
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
            :total-items="totalReceipts"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <ReceiptUpsertDrawer
      v-model:is-drawer-open="isReceiptDrawerOpen"
      :editing-receipt="editingReceipt"
      :invoice-options="invoiceOptions"
      :proforma-options="proformaOptions"
      @submit="saveReceipt"
    />

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogOpen"
      @close="closeReceiptEmailDialog"
      @send="onReceiptEmailSend"
    />

    <VDialog v-model="isDeleteReceiptDialogOpen" max-width="440" persistent>
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
            @save="confirmDeleteReceipt"
            @cancel="closeDeleteReceiptDialog"
          />
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#receipt-list {
  .quotation-list-toolbar {
    justify-content: flex-end;
  }

  .quotation-list-filter {
    inline-size: 12rem;
  }
}
</style>
