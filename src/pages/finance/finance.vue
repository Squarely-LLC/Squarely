<script setup lang="ts">
import { useContactsStore } from "@/stores/contacts";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useReceiptsStore } from "@/stores/receipts";
import { saveFile } from "@/utils/fileStore";
import type {
  ReceiptClientOption,
  ReceiptDocumentOption,
  ReceiptDrawerSubmitPayload,
} from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import ReceiptUpsertDrawer from "@/views/apps/receipt/ReceiptUpsertDrawer.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import FinanceInvoicesTab from "@/views/apps/finance/FinanceInvoicesTab.vue";
import FinanceProformasTab from "@/views/apps/finance/FinanceProformasTab.vue";
import FinanceQuotationsTab from "@/views/apps/finance/FinanceQuotationsTab.vue";
import FinanceReceiptsTab from "@/views/apps/finance/FinanceReceiptsTab.vue";

const route = useRoute();
const router = useRouter();
const contactsStore = useContactsStore();
const invoicesStore = useInvoicesStore();
const proformasStore = useProformasStore();
const receiptsStore = useReceiptsStore();
const notifications = useNotificationsStore();

contactsStore.init();
invoicesStore.init();
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
const isReceiptDrawerOpen = ref(false);
const editingReceiptId = ref<number | null>(null);
const receiptCreationMode = ref<"squarely" | "attachment">("squarely");

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
          <FinanceReceiptsTab
            v-else-if="tabItem.key === 'receipt'"
            @create-receipt="openCreateReceiptDrawer"
            @edit-receipt="openEditReceiptDrawer"
          />

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
