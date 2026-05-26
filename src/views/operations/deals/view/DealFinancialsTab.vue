<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import type {
  DealBillingPeriod,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import {
  buildCustomBillingPeriod,
  buildDealDocumentDraftRecord,
  buildMonthlyBillingPeriod,
  buildQuarterlyBillingPeriod,
  buildYearlyBillingPeriod,
  filterDealDocumentItemsByBillingMode,
  getBillableRootDealItems,
  getDealBillingPeriodKey,
  getDealBillingPeriodLabel,
  getDealBillingPeriodMonthValue,
  getQuotationTopLevelDealItems,
  getSelectableDealItems,
  resolveDealDocumentBillingMode,
  resolveDealDocumentBillingModeForItem,
  saveDealDocumentDraft,
  type DealDocumentBillingMode,
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
const dealsStore = useDealsStore();
dealsStore.init();
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
  getBillableRootDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const quotationItems = computed(() =>
  getQuotationTopLevelDealItems(dealItems.value, (id, typeHint) =>
    cataloguesStore.recordById(id, typeHint),
  ),
);
const selectedDocumentKind = ref<DealDocumentKind | null>(null);
const billingModeDialogVisible = ref(false);
const billingPeriodDialogVisible = ref(false);
const selectedBillingMode = ref<DealDocumentBillingMode | null>(null);
const billingPeriod = ref<DealBillingPeriod>(buildMonthlyBillingPeriod());
const billingPeriodKind = ref<DealBillingPeriod["kind"]>(
  billingPeriod.value.kind,
);
const billingPeriodMonthValue = ref(
  getDealBillingPeriodMonthValue(billingPeriod.value),
);
const defaultBillingYearValue = () => String(new Date().getFullYear());
const defaultBillingQuarterValue = () => {
  const today = new Date();

  return `Q${Math.floor(today.getMonth() / 3) + 1}`;
};
const defaultBillingCustomDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
const billingPeriodQuarterYearValue = ref(defaultBillingYearValue());
const billingPeriodQuarterValue = ref(defaultBillingQuarterValue());
const billingPeriodYearValue = ref(defaultBillingYearValue());
const billingPeriodCustomStartDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomEndDate = ref(defaultBillingCustomDateValue());
const billingPeriodCustomLabel = ref("");
const billingPeriodKindOptions = [
  { title: "Month", value: "monthly" },
  { title: "Quarter", value: "quarterly" },
  { title: "Year", value: "yearly" },
  { title: "Custom", value: "custom" },
] as const;
const billingQuarterOptions = [
  { title: "Q1", value: "Q1" },
  { title: "Q2", value: "Q2" },
  { title: "Q3", value: "Q3" },
  { title: "Q4", value: "Q4" },
] as const;

const syncBillingPeriodDraft = (
  period: DealBillingPeriod = billingPeriod.value,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  const startDate = String(period.startDate || defaultBillingCustomDateValue());
  const endDate = String(period.endDate || startDate);
  const quarterMatch = periodKey.match(/^(\d{4})-q([1-4])$/);
  const yearMatch = periodKey.match(/^(\d{4})$/);
  const startDateMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fallbackYear = startDateMatch?.[1] || defaultBillingYearValue();
  const fallbackQuarter = startDateMatch
    ? `Q${Math.floor((Number(startDateMatch[2]) - 1) / 3) + 1}`
    : defaultBillingQuarterValue();

  billingPeriodKind.value = period.kind;
  billingPeriodMonthValue.value = getDealBillingPeriodMonthValue(period);
  billingPeriodQuarterYearValue.value = quarterMatch?.[1] || fallbackYear;
  billingPeriodQuarterValue.value = quarterMatch
    ? `Q${quarterMatch[2]}`
    : fallbackQuarter;
  billingPeriodYearValue.value = yearMatch?.[1] || fallbackYear;
  billingPeriodCustomStartDate.value = startDate;
  billingPeriodCustomEndDate.value = endDate;
  billingPeriodCustomLabel.value =
    period.kind === "custom" ? getDealBillingPeriodLabel(period) : "";
};

const billingPeriodPreview = computed(() => {
  if (billingPeriodKind.value === "quarterly") {
    return buildQuarterlyBillingPeriod(
      `${billingPeriodQuarterYearValue.value}-${billingPeriodQuarterValue.value}`,
    );
  }

  if (billingPeriodKind.value === "yearly") {
    return buildYearlyBillingPeriod(billingPeriodYearValue.value);
  }

  if (billingPeriodKind.value === "custom") {
    return buildCustomBillingPeriod({
      endDate: billingPeriodCustomEndDate.value,
      label: billingPeriodCustomLabel.value,
      startDate: billingPeriodCustomStartDate.value,
    });
  }

  return buildMonthlyBillingPeriod(billingPeriodMonthValue.value);
});

syncBillingPeriodDraft();
const pendingDocumentItems = ref<DealDocumentSelectableItem[]>([]);
const billingPeriodPrices = reactive<Record<string, number>>({});
const selectedItemIds = ref<string[]>([]);
const selectionDialogVisible = ref(false);

const commitBillingPeriod = () => {
  billingPeriod.value = billingPeriodPreview.value;
  syncBillingPeriodDraft(billingPeriod.value);

  return billingPeriod.value;
};

const contact = computed(() => {
  if (!props.deal.relatedTo) return null;

  return contactsStore.byId(props.deal.relatedTo) ?? null;
});

const canAutoCreateBillingDocument = computed(
  () => billingMode.value === "simple-root",
);

const billingMode = computed<DealDocumentBillingMode>(() =>
  resolveDealDocumentBillingMode(billableRootItems.value),
);

const effectiveBillingMode = computed<DealDocumentBillingMode>(
  () => selectedBillingMode.value ?? billingMode.value,
);

const selectedItems = computed(() => {
  const selected = new Set(selectedItemIds.value.map((value) => String(value)));

  return filteredSelectableItems.value.filter((item) =>
    selected.has(String(item.selectionKey)),
  );
});

const filteredSelectableItems = computed(() =>
  filterDealDocumentItemsByBillingMode(
    selectableItems.value,
    effectiveBillingMode.value,
  ),
);

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

  for (const item of filteredSelectableItems.value) {
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
  if (selectedDocumentKind.value === "invoice") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Invoice";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Lines for Invoice";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Lines for Invoice";

    return "Select Items for Invoice";
  }

  if (selectedDocumentKind.value === "proforma") {
    if (effectiveBillingMode.value === "contractual-stage")
      return "Select Stages for Proforma";
    if (effectiveBillingMode.value === "retainer-period")
      return "Select Retainer Lines for Proforma";
    if (effectiveBillingMode.value === "recurrent-period")
      return "Select Recurrent Lines for Proforma";

    return "Select Items for Proforma";
  }

  return "Select Items";
});

const selectionDialogHint = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage") {
    return "Contractual deals bill at stage level. Choose only the stages you want billed in this document.";
  }

  if (effectiveBillingMode.value === "retainer-period") {
    return `Retainer billing uses the selected period. Choose only the service lines you want billed for ${getDealBillingPeriodLabel(billingPeriod.value)}.`;
  }

  if (effectiveBillingMode.value === "recurrent-period") {
    return `Recurrent billing uses the selected period. Choose only the service lines you want billed for ${getDealBillingPeriodLabel(billingPeriod.value)}.`;
  }

  if (effectiveBillingMode.value === "mixed-manual") {
    return "This deal mixes billing modes. Pick a billing basis first, then choose only the rows you want billed.";
  }

  return "No rows are preselected. Choose only the rows you want billed.";
});

const selectionDialogIntro = computed(() => {
  if (effectiveBillingMode.value === "contractual-stage") {
    return "Select one or more contractual stages to include in this document.";
  }

  if (effectiveBillingMode.value === "retainer-period") {
    return "Select one or more retainer lines to include in this document.";
  }

  if (effectiveBillingMode.value === "recurrent-period") {
    return "Select one or more recurrent lines to include in this document.";
  }

  return "Select one or more items to include in this document.";
});

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString();

const billingModeOptions = computed(() => {
  const availableModes = Array.from(
    new Set(
      billableRootItems.value
        .map((item) => resolveDealDocumentBillingModeForItem(item))
        .filter((mode) => mode !== "empty" && mode !== "mixed-manual"),
    ),
  ) as DealDocumentBillingMode[];

  return availableModes.map((mode) => ({
    description:
      mode === "simple-root"
        ? "Bill directly from simple top-level items."
        : mode === "contractual-stage"
          ? "Bill by contractual stages."
          : mode === "retainer-period"
            ? "Bill retainer services for a selected period."
            : "Bill recurrent services for a selected period.",
    title:
      mode === "simple-root"
        ? "Simple items"
        : mode === "contractual-stage"
          ? "Contractual stages"
          : mode === "retainer-period"
            ? "Retainer period"
            : "Recurrent period",
    value: mode,
  }));
});

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

const selectionNeedsBillingPeriod = (items: DealDocumentSelectableItem[]) =>
  items.some((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);

    return itemMode === "retainer-period" || itemMode === "recurrent-period";
  });

const pendingBillingPeriodItems = computed(() =>
  pendingDocumentItems.value.filter((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);

    return itemMode === "retainer-period" || itemMode === "recurrent-period";
  }),
);

const getOverrideKeyFromSelectionKey = (selectionKey: string) => {
  const match = selectionKey.match(/^item-\d+-(.+)$/);

  return match?.[1] ?? null;
};

const getStoredBillingPeriodPrice = (
  item: DealDocumentSelectableItem,
  period: DealBillingPeriod,
) => {
  const overrideKey = getOverrideKeyFromSelectionKey(item.selectionKey);
  const periodKey = getDealBillingPeriodKey(period);
  if (!overrideKey || !periodKey) return null;

  const value =
    item.subItemOverrides?.[overrideKey]?.periodUnitPrices?.[periodKey];
  if (value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
};

const resetBillingPeriodPrices = () => {
  Object.keys(billingPeriodPrices).forEach((key) => {
    delete billingPeriodPrices[key];
  });
};

const initializeBillingPeriodPrices = (
  items: DealDocumentSelectableItem[],
  period = billingPeriod.value,
) => {
  resetBillingPeriodPrices();

  items.forEach((item) => {
    billingPeriodPrices[item.selectionKey] = Number(
      getStoredBillingPeriodPrice(item, period) ?? item.unitPrice ?? 0,
    );
  });
};

const applyBillingPeriodPricing = (
  items: DealDocumentSelectableItem[],
  period: DealBillingPeriod,
) => {
  const periodKey = getDealBillingPeriodKey(period);
  if (!periodKey) return items;

  const updatedPrices = new Map<string, number>();

  items.forEach((item) => {
    const itemMode = resolveDealDocumentBillingModeForItem(item);
    if (itemMode !== "retainer-period" && itemMode !== "recurrent-period")
      return;

    const numeric = Number(billingPeriodPrices[item.selectionKey]);
    updatedPrices.set(
      item.selectionKey,
      Number.isFinite(numeric) ? numeric : 0,
    );
  });

  if (!updatedPrices.size) return items;

  const nextItems = (props.deal.items || []).map((item) => {
    const nextOverrides = { ...(item.subItemOverrides || {}) };
    let hasChanges = false;

    Object.keys(nextOverrides).forEach((overrideKey) => {
      const selectionKey = `item-${item.id}-${overrideKey}`;
      const nextPrice = updatedPrices.get(selectionKey);
      if (nextPrice === undefined) return;

      const currentOverride = nextOverrides[overrideKey] || {};
      nextOverrides[overrideKey] = {
        ...currentOverride,
        unitPrice: nextPrice,
        periodUnitPrices: {
          ...(currentOverride.periodUnitPrices || {}),
          [periodKey]: nextPrice,
        },
      };
      hasChanges = true;
    });

    return hasChanges
      ? {
          ...item,
          subItemOverrides: nextOverrides,
        }
      : item;
  });

  dealsStore.updateDeal(props.deal.id, { items: nextItems });

  return items.map((item) => {
    const nextPrice = updatedPrices.get(item.selectionKey);
    if (nextPrice === undefined) return item;

    return {
      ...item,
      unitPrice: nextPrice,
    };
  });
};

const resetDocumentWorkflowState = () => {
  billingModeDialogVisible.value = false;
  billingPeriodDialogVisible.value = false;
  selectionDialogVisible.value = false;
  pendingDocumentItems.value = [];
  resetBillingPeriodPrices();
  selectedBillingMode.value = null;
  selectedDocumentKind.value = null;
  selectedItemIds.value = [];
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
    billingPeriod: selectionNeedsBillingPeriod(itemsToSend)
      ? billingPeriod.value
      : null,
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

  resetDocumentWorkflowState();
};

const openSelectionDialog = (
  kind: DealDocumentKind,
  mode: DealDocumentBillingMode = billingMode.value,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  selectedItemIds.value = [];
  selectionDialogVisible.value = true;
};

const openBillingPeriodDialog = (
  kind: DealDocumentKind,
  mode: Extract<
    DealDocumentBillingMode,
    "retainer-period" | "recurrent-period"
  >,
) => {
  selectedDocumentKind.value = kind;
  selectedBillingMode.value = mode;
  syncBillingPeriodDraft();
  initializeBillingPeriodPrices(pendingBillingPeriodItems.value);
  billingPeriodDialogVisible.value = true;
};

const confirmBillingPeriod = () => {
  if (!selectedDocumentKind.value) return;

  const nextBillingPeriod = commitBillingPeriod();
  if (!getDealBillingPeriodKey(nextBillingPeriod)) {
    notifications.push("Select a billing period first", "warning", 2500);
    return;
  }

  billingPeriodDialogVisible.value = false;

  if (pendingDocumentItems.value.length) {
    const kind = selectedDocumentKind.value;
    const items = applyBillingPeriodPricing(
      [...pendingDocumentItems.value],
      nextBillingPeriod,
    );

    pendingDocumentItems.value = [];
    void saveAndNavigateToDraft(kind, items);
    return;
  }

  openSelectionDialog(selectedDocumentKind.value, effectiveBillingMode.value);
};

const closeBillingPeriodDialog = () => {
  billingPeriodDialogVisible.value = false;
  if (!selectionDialogVisible.value) {
    resetDocumentWorkflowState();
  }
};

const confirmBillingModeSelection = () => {
  if (!selectedDocumentKind.value || !selectedBillingMode.value) {
    notifications.push("Choose a billing basis first", "warning", 2500);
    return;
  }

  billingModeDialogVisible.value = false;

  openSelectionDialog(selectedDocumentKind.value, selectedBillingMode.value);
};

const closeBillingModeDialog = () => {
  billingModeDialogVisible.value = false;
  if (!selectionDialogVisible.value && !billingPeriodDialogVisible.value) {
    selectedBillingMode.value = null;
    selectedDocumentKind.value = null;
  }
};

const handleCreateQuotation = async () => {
  await saveAndNavigateToDraft("quotation", quotationItems.value);
};

const handleCreateBillingDocument = async (kind: "invoice" | "proforma") => {
  if (canAutoCreateBillingDocument.value) {
    await saveAndNavigateToDraft(kind, billableRootItems.value);
    return;
  }

  if (billingMode.value === "contractual-stage") {
    openSelectionDialog(kind, "contractual-stage");
    return;
  }

  if (billingMode.value === "retainer-period") {
    openSelectionDialog(kind, "retainer-period");
    return;
  }

  if (billingMode.value === "recurrent-period") {
    openSelectionDialog(kind, "recurrent-period");
    return;
  }

  selectedDocumentKind.value = kind;
  selectedBillingMode.value = billingModeOptions.value[0]?.value ?? null;
  billingModeDialogVisible.value = true;
};

const confirmSelectedItems = async () => {
  if (!selectedDocumentKind.value || !selectedItems.value.length) return;

  const kind = selectedDocumentKind.value;
  const items = [...selectedItems.value];

  if (selectionNeedsBillingPeriod(items)) {
    pendingDocumentItems.value = items;
    initializeBillingPeriodPrices(
      items.filter((item) => {
        const itemMode = resolveDealDocumentBillingModeForItem(item);

        return (
          itemMode === "retainer-period" || itemMode === "recurrent-period"
        );
      }),
    );
    selectionDialogVisible.value = false;
    billingPeriodDialogVisible.value = true;
    return;
  }

  selectionDialogVisible.value = false;
  await saveAndNavigateToDraft(kind, items);
};

const closeSelectionDialog = () => {
  selectionDialogVisible.value = false;
  if (!billingModeDialogVisible.value && !billingPeriodDialogVisible.value) {
    resetDocumentWorkflowState();
    return;
  }
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
            :disabled="!quotationItems.length"
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

  <VDialog v-model="billingModeDialogVisible" max-width="560">
    <DialogCloseBtn @click="billingModeDialogVisible = false" />
    <VCard>
      <VCardItem>
        <VCardTitle>Choose Billing Basis</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          This deal mixes billing modes. Choose how you want to build this
          document.
        </div>

        <VRadioGroup v-model="selectedBillingMode" color="primary">
          <VRadio
            v-for="option in billingModeOptions"
            :key="option.value"
            :value="option.value"
          >
            <template #label>
              <div>
                <div class="text-body-1 font-weight-medium">
                  {{ option.title }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ option.description }}
                </div>
              </div>
            </template>
          </VRadio>
        </VRadioGroup>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="closeBillingModeDialog">Cancel</VBtn>
        <VBtn color="primary" @click="confirmBillingModeSelection"
          >Continue</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="billingPeriodDialogVisible" max-width="640">
    <DialogCloseBtn @click="billingPeriodDialogVisible = false" />
    <VCard>
      <VCardItem>
        <VCardTitle>Select Billing Period</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText class="d-flex flex-column gap-4">
        <div class="text-sm text-medium-emphasis">
          Enter the billing period and explicit prices for the selected
          period-based lines.
        </div>

        <div class="rounded border pa-4 bg-var-theme-background">
          <VRow>
            <VCol cols="12" md="6">
              <VSelect
                v-model="billingPeriodKind"
                label="Period Type"
                :items="billingPeriodKindOptions"
              />
            </VCol>

            <VCol cols="12" md="6">
              <VTextField
                v-if="billingPeriodKind === 'monthly'"
                v-model="billingPeriodMonthValue"
                type="month"
                label="Billing Month"
                autofocus
              />

              <VTextField
                v-else-if="billingPeriodKind === 'quarterly'"
                v-model="billingPeriodQuarterYearValue"
                type="number"
                min="2000"
                label="Billing Year"
              />

              <VTextField
                v-else-if="billingPeriodKind === 'yearly'"
                v-model="billingPeriodYearValue"
                type="number"
                min="2000"
                label="Billing Year"
              />

              <VTextField
                v-else
                v-model="billingPeriodCustomStartDate"
                type="date"
                label="Start Date"
              />
            </VCol>
          </VRow>

          <VRow v-if="billingPeriodKind === 'quarterly'">
            <VCol cols="12" md="6" offset-md="6">
              <VSelect
                v-model="billingPeriodQuarterValue"
                label="Billing Quarter"
                :items="billingQuarterOptions"
              />
            </VCol>
          </VRow>

          <VRow v-else-if="billingPeriodKind === 'custom'">
            <VCol cols="12" md="6">
              <VTextField
                v-model="billingPeriodCustomEndDate"
                type="date"
                label="End Date"
              />
            </VCol>

            <VCol cols="12">
              <VTextField
                v-model="billingPeriodCustomLabel"
                label="Custom Label"
                placeholder="Optional"
              />
            </VCol>
          </VRow>
        </div>

        <div class="rounded border pa-3 bg-var-theme-background">
          <div class="text-xs text-medium-emphasis mb-1">Selected period</div>
          <div class="text-body-1 font-weight-medium">
            {{ billingPeriodPreview.label }}
          </div>
        </div>

        <div
          v-if="pendingBillingPeriodItems.length"
          class="d-flex flex-column gap-3 mt-4"
        >
          <div
            v-for="item in pendingBillingPeriodItems"
            :key="item.selectionKey"
            class="border rounded-lg pa-4 bg-var-theme-background"
          >
            <div class="text-body-1 font-weight-medium mb-1">
              {{ item.name }}
            </div>
            <div class="text-sm text-medium-emphasis mb-3">
              Set the explicit billed amount for this period.
            </div>

            <VTextField
              v-model.number="billingPeriodPrices[item.selectionKey]"
              type="number"
              min="0"
              step="0.01"
              label="Period Price"
            />
          </div>
        </div>
      </VCardText>

      <VDivider />

      <VCardActions class="justify-end pa-4">
        <VBtn variant="text" @click="closeBillingPeriodDialog">Cancel</VBtn>
        <VBtn color="primary" @click="confirmBillingPeriod">Continue</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <VDialog v-model="selectionDialogVisible" max-width="760">
    <DialogCloseBtn @click="selectionDialogVisible = false" />
    <VCard>
      <VCardItem>
        <VCardTitle>{{ selectionDialogTitle }}</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis mb-4">
          {{ selectionDialogIntro }}
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
