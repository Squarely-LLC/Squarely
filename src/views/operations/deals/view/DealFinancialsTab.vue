<script setup lang="ts">
import { computed, ref } from "vue";

import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import {
  buildDealDocumentDraftRecord,
  getBillableRootDealItems,
  getSelectableDealItems,
  isAutoBillableDealItem,
  saveDealDocumentDraft,
  type DealDocumentKind,
  type DealDocumentSelectableItem,
} from "@/utils/dealDocumentDraft";

const props = defineProps<{
  deal: DealProperties;
}>();

const router = useRouter();
const cataloguesStore = useCataloguesStore();
cataloguesStore.init();
const configStore = useConfigStore();
configStore.init();
const contactsStore = useContactsStore();
contactsStore.init();
const quotationsStore = useQuotationsStore();
quotationsStore.init();
const proformasStore = useProformasStore();
proformasStore.init();
const invoicesStore = useInvoicesStore();
invoicesStore.init();
const notifications = useNotificationsStore();

const rows = computed(() => props.deal.financials || []);
const dealItems = computed(() => props.deal.items || []);
const selectableItems = computed(() =>
  getSelectableDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const billableRootItems = computed(() =>
  getBillableRootDealItems(selectableItems.value),
);
const selectedDocumentKind = ref<DealDocumentKind | null>(null);
const selectedItemIds = ref<string[]>([]);
const selectionDialogVisible = ref(false);

const contact = computed(() => {
  if (!props.deal.relatedTo) return null;

  return contactsStore.byId(props.deal.relatedTo) ?? null;
});

const canAutoCreateBillingDocument = computed(
  () =>
    billableRootItems.value.length > 0 &&
    billableRootItems.value.every(isAutoBillableDealItem),
);

const selectedItems = computed(() => {
  const selected = new Set(selectedItemIds.value.map((value) => String(value)));

  return selectableItems.value.filter((item) =>
    selected.has(String(item.selectionKey)),
  );
});

const selectableGroups = computed(() => {
  const groups = new Map<
    string,
    {
      description: string;
      items: DealDocumentSelectableItem[];
      key: string;
      label: string;
    }
  >();

  for (const item of selectableItems.value) {
    const description =
      item.groupKey === "billable-root"
        ? "These rows drive quotation and direct invoice/proforma eligibility."
        : "Nested rows are available only through manual selection.";
    const existing = groups.get(item.groupKey);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(item.groupKey, {
      description,
      items: [item],
      key: item.groupKey,
      label: item.groupLabel,
    });
  }

  return Array.from(groups.values());
});

const headers = [
  { title: "Title", key: "title" },
  { title: "Type", key: "type", width: "140px" },
  { title: "Amount", key: "amount", width: "140px" },
  { title: "Status", key: "status", width: "140px" },
  { title: "Due", key: "dueDate", width: "140px" },
];

const totalQuoted = computed(() =>
  rows.value
    .filter((entry) => entry.type === "quotation" || entry.type === "invoice")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);

const totalPaid = computed(() =>
  rows.value
    .filter(
      (entry) =>
        entry.type === "payment" &&
        String(entry.status || "").toLowerCase() === "received",
    )
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
);

const balance = computed(() => totalQuoted.value - totalPaid.value);

const selectionDialogTitle = computed(() => {
  if (selectedDocumentKind.value === "invoice")
    return "Select Items for Invoice";
  if (selectedDocumentKind.value === "proforma")
    return "Select Items for Proforma";

  return "Select Items";
});

const selectionDialogHint = computed(
  () => "No rows are preselected. Choose only the rows you want billed.",
);

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString();

const formatItemType = (value?: string | null) => value || "Unknown";

const itemRowOffset = (item: DealDocumentSelectableItem) => {
  if (item.parentName && item.groupKey === "billable-root") return "16px";
  if (item.parentName) return "28px";

  return "0px";
};

const nextIdForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return quotationsStore.nextId();
  if (kind === "proforma") return proformasStore.nextId();

  return invoicesStore.nextId();
};

const routeNameForDocument = (kind: DealDocumentKind) => {
  if (kind === "quotation") return "apps-quotation-add";
  if (kind === "proforma") return "apps-proforma-add";

  return "apps-invoice-add";
};

const saveAndNavigateToDraft = async (
  kind: DealDocumentKind,
  itemsToSend = billableRootItems.value,
) => {
  if (!itemsToSend.length) {
    notifications.push("This deal has no billable items yet", "warning", 2500);
    return;
  }

  const draft = buildDealDocumentDraftRecord(kind, {
    contact: contact.value,
    deal: props.deal,
    financial: configStore.financial,
    legal: configStore.legal,
    nextId: nextIdForDocument(kind),
    resolveCatalogueRecord: (id, typeHint) =>
      cataloguesStore.recordById(id, typeHint),
    selectedItems: itemsToSend,
  });

  saveDealDocumentDraft(kind, draft);

  await router.push({
    name: routeNameForDocument(kind),
    query: { dealDraft: "1" },
  });
};

const openSelectionDialog = (kind: DealDocumentKind) => {
  selectedDocumentKind.value = kind;
  selectedItemIds.value = [];
  selectionDialogVisible.value = true;
};

const handleCreateQuotation = async () => {
  await saveAndNavigateToDraft("quotation", billableRootItems.value);
};

const handleCreateBillingDocument = async (kind: "invoice" | "proforma") => {
  if (canAutoCreateBillingDocument.value) {
    await saveAndNavigateToDraft(kind, billableRootItems.value);
    return;
  }

  openSelectionDialog(kind);
};

const confirmSelectedItems = async () => {
  if (!selectedDocumentKind.value || !selectedItems.value.length) return;

  const kind = selectedDocumentKind.value;

  selectionDialogVisible.value = false;
  await saveAndNavigateToDraft(kind, selectedItems.value);
};

const closeSelectionDialog = () => {
  selectionDialogVisible.value = false;
  selectedDocumentKind.value = null;
  selectedItemIds.value = [];
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};
</script>

<template>
  <VRow>
    <VCol cols="12" md="4">
      <VCard>
        <VCardText>
          <div class="text-sm text-medium-emphasis mb-1">Quoted</div>
          <div class="text-h5">
            {{ formatMoney(totalQuoted) }}
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12" md="4">
      <VCard>
        <VCardText>
          <div class="text-sm text-medium-emphasis mb-1">Received</div>
          <div class="text-h5">
            {{ formatMoney(totalPaid) }}
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12" md="4">
      <VCard>
        <VCardText>
          <div class="text-sm text-medium-emphasis mb-1">Balance</div>
          <div class="text-h5">
            {{ formatMoney(balance) }}
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard>
        <div class="d-flex gap-2 pa-4 pb-0 justify-end">
          <VBtn
            color="primary"
            variant="elevated"
            class="d-flex align-center gap-2"
            :disabled="!billableRootItems.length"
            @click="handleCreateQuotation"
          >
            <VIcon>tabler-file-text</VIcon>
            +Quotation
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            class="d-flex align-center gap-2"
            :disabled="!selectableItems.length"
            @click="handleCreateBillingDocument('proforma')"
          >
            <VIcon>tabler-file-certificate</VIcon>
            +Proforma
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            class="d-flex align-center gap-2"
            :disabled="!selectableItems.length"
            @click="handleCreateBillingDocument('invoice')"
          >
            <VIcon>tabler-file-invoice</VIcon>
            +Invoice
          </VBtn>
        </div>
        <VCardItem>
          <VCardTitle>Financials</VCardTitle>
        </VCardItem>
        <VDivider />

        <VDataTable
          v-if="rows.length"
          :items="rows"
          :headers="headers"
          class="text-no-wrap"
        >
          <template #item.type="{ item }">
            <VChip size="small" label color="primary">
              {{ item.type }}
            </VChip>
          </template>

          <template #item.amount="{ item }">
            {{ formatMoney(item.amount) }}
          </template>

          <template #item.status="{ item }">
            <VChip
              size="small"
              label
              :color="
                String(item.status || '').toLowerCase() === 'received'
                  ? 'success'
                  : 'warning'
              "
            >
              {{ item.status || "--" }}
            </VChip>
          </template>

          <template #item.dueDate="{ item }">
            {{ formatDate(item.dueDate) }}
          </template>
        </VDataTable>

        <VCardText v-else class="text-center py-12 text-medium-emphasis">
          No financial records linked to this deal yet.
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <VDialog v-model="selectionDialogVisible" max-width="760">
    <VCard>
      <VCardItem>
        <VCardTitle>{{ selectionDialogTitle }}</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          Select one or more items to include in this document.
        </div>

        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogHint }}
        </div>

        <div v-if="selectableItems.length" class="d-flex flex-column gap-3">
          <div
            v-for="group in selectableGroups"
            :key="group.key"
            class="d-flex flex-column gap-3"
          >
            <div>
              <div class="text-subtitle-2 font-weight-medium">
                {{ group.label }}
              </div>
              <div class="text-sm text-medium-emphasis">
                {{ group.description }}
              </div>
            </div>

            <label
              v-for="item in group.items"
              :key="item.selectionKey"
              class="border rounded pa-3 d-flex align-start gap-3"
              :style="{ marginInlineStart: itemRowOffset(item) }"
            >
              <VCheckbox
                v-model="selectedItemIds"
                :value="item.selectionKey"
                color="primary"
                hide-details
                class="mt-0 pt-0"
              />

              <div class="flex-grow-1 min-w-0">
                <div class="d-flex flex-wrap align-center gap-2 mb-1">
                  <div class="text-body-1 font-weight-medium">
                    {{ item.name }}
                  </div>

                  <VChip size="x-small" label color="primary" variant="tonal">
                    {{ formatItemType(item.catalogueType) }}
                  </VChip>

                  <VChip
                    v-if="item.parentName"
                    size="x-small"
                    label
                    color="secondary"
                    variant="tonal"
                  >
                    Parent: {{ item.parentName }}
                  </VChip>

                  <VChip
                    v-if="item.isBillableRoot && item.isAutoBillable"
                    size="x-small"
                    label
                    color="success"
                    variant="tonal"
                  >
                    Auto-flow eligible
                  </VChip>

                  <VChip
                    v-else-if="item.isBillableRoot"
                    size="x-small"
                    label
                    color="warning"
                    variant="tonal"
                  >
                    Selection flow
                  </VChip>

                  <VChip
                    v-if="item.expansionSummary"
                    size="x-small"
                    label
                    color="info"
                    variant="tonal"
                  >
                    {{ item.expansionSummary }}
                  </VChip>
                </div>

                <div class="text-sm text-medium-emphasis mb-1">
                  Qty {{ item.quantity || 1 }}
                  <span
                    v-if="
                      item.unitPrice !== null && item.unitPrice !== undefined
                    "
                  >
                    · Price {{ formatMoney(item.unitPrice) }}
                  </span>
                  <span v-if="item.discountPercent">
                    · Discount {{ item.discountPercent }}%
                  </span>
                </div>

                <div v-if="item.hint" class="text-sm text-medium-emphasis mb-1">
                  {{ item.hint }}
                </div>

                <div v-if="item.note" class="text-sm text-medium-emphasis">
                  {{ item.note }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div v-else class="text-medium-emphasis">No items available.</div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="closeSelectionDialog">Cancel</VBtn>
        <VBtn
          color="primary"
          :disabled="!selectedItems.length"
          @click="confirmSelectedItems"
        >
          Continue
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
