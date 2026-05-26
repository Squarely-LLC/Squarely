<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useNotificationsStore } from "@/stores/notifications";
import { useReceiptsStore } from "@/stores/receipts";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";

interface Emit {
  (e: "create-receipt", mode: "squarely" | "attachment"): void;
  (e: "edit-receipt", receiptId: number): void;
}

const emit = defineEmits<Emit>();

const router = useRouter();
const receiptsStore = useReceiptsStore();
const notifications = useNotificationsStore();

receiptsStore.init();

const previewActionFrame = ref<HTMLIFrameElement | null>(null);
const isPreviewActionFrameReady = ref(false);
const loadedPreviewReceiptId = ref<number | null>(null);
const pendingPreviewAction = ref<{
  receiptId: number;
  action: "print" | "download";
} | null>(null);

const searchQuery = ref("");
const selectedStatus = ref<"Recorded" | "Flagged" | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<string>();
const orderBy = ref<string>();

const isDeleteReceiptDialogOpen = ref(false);
const pendingDeleteReceiptId = ref<number | null>(null);
const isEmailDialogOpen = ref(false);
const pendingEmailReceiptId = ref<number | null>(null);
const emailDialogRef = ref<any | null>(null);
const isCreateMenuOpen = ref(false);

const headers = [
  { title: "#", key: "id" },
  { title: "Client", key: "client" },
  { title: "Received Date", key: "date" },
  { title: "Amount", key: "amount" },
  { title: "Status", key: "status", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy[0]?.key;
  orderBy.value = options.sortBy[0]?.order;
};

const receiptRecords = computed(() => receiptsStore.all);
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
      const sortKey = sortBy.value ?? "";

      const fieldMap = {
        client: leftReceipt.client.name.localeCompare(rightReceipt.client.name),
        id: leftReceipt.receiptNumber.localeCompare(rightReceipt.receiptNumber),
        amount: leftReceipt.amount - rightReceipt.amount,
        date:
          new Date(leftReceipt.receivedDate).getTime() -
          new Date(rightReceipt.receivedDate).getTime(),
      } as Record<string, number>;

      return (fieldMap[sortKey] || 0) * (isDescending ? -1 : 1);
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

const openCreateReceiptDrawer = (mode: "squarely" | "attachment") => {
  isCreateMenuOpen.value = false;
  emit("create-receipt", mode);
};

const openEditReceiptDrawer = (receiptId: number) => {
  emit("edit-receipt", receiptId);
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

const sendPreviewAction = (receiptId: number, action: "print" | "download") => {
  if (!previewActionFrame.value?.contentWindow) return;

  previewActionFrame.value.contentWindow.postMessage(
    {
      type: "receipt-preview-action",
      payload: { action },
    },
    window.location.origin,
  );

  notifications.push(
    `${action === "download" ? "Download" : "Print"} started for receipt ${receiptsStore.byId(receiptId)?.receipt.receiptNumber || receiptId}.`,
    "success",
    3500,
  );
};

const flushPendingPreviewAction = () => {
  const pendingAction = pendingPreviewAction.value;
  if (!pendingAction || !isPreviewActionFrameReady.value) return;
  if (loadedPreviewReceiptId.value !== pendingAction.receiptId) return;

  sendPreviewAction(pendingAction.receiptId, pendingAction.action);
  pendingPreviewAction.value = null;
};

const handlePreviewActionFrameMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== "receipt-preview-ready") return;

  isPreviewActionFrameReady.value = true;
  loadedPreviewReceiptId.value = Number(event.data?.receiptId || 0) || null;
  flushPendingPreviewAction();
};

const openReceiptPreview = (
  receiptId: number,
  action?: "print" | "download" | "email",
) => {
  if (action === "print" || action === "download") {
    ensurePreviewActionFrame();
    if (!previewActionFrame.value) return;

    pendingPreviewAction.value = { receiptId, action };

    const resolved = router.resolve({
      path: `/apps/receipt/preview/${receiptId}`,
      query: { embedded: "1" },
    });

    if (previewActionFrame.value.src !== resolved.href) {
      isPreviewActionFrameReady.value = false;
      loadedPreviewReceiptId.value = null;
      previewActionFrame.value.src = resolved.href;
      return;
    }

    flushPendingPreviewAction();
    return;
  }

  const resolved = router.resolve({
    path: `/apps/receipt/preview/${receiptId}`,
    query: action === "email" ? { email: "1" } : {},
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

onMounted(() => {
  window.addEventListener("message", handlePreviewActionFrameMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handlePreviewActionFrameMessage);
  previewActionFrame.value?.remove();
  previewActionFrame.value = null;
  isPreviewActionFrameReady.value = false;
  loadedPreviewReceiptId.value = null;
  pendingPreviewAction.value = null;
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

          <VMenu v-model="isCreateMenuOpen">
            <template #activator="{ props }">
              <VBtn v-bind="props" prepend-icon="tabler-plus">
                Add Receipt
              </VBtn>
            </template>

            <VList>
              <VListItem
                prepend-icon="tabler-building-estate"
                @click="openCreateReceiptDrawer('squarely')"
              >
                From Squarely
              </VListItem>
              <VListItem
                prepend-icon="tabler-paperclip"
                @click="openCreateReceiptDrawer('attachment')"
              >
                Attachment from another system
              </VListItem>
            </VList>
          </VMenu>
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

    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogOpen"
      @close="closeReceiptEmailDialog"
      @send="onReceiptEmailSend"
    />

    <VDialog v-model="isDeleteReceiptDialogOpen" max-width="440" persistent>
      <DialogCloseBtn @click="isDeleteReceiptDialogOpen = false" />
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
