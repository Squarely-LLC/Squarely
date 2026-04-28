<script setup lang="ts">
import { computed } from "vue";

import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";

const props = defineProps<{
  deal: DealProperties;
}>();

const rows = computed(() => props.deal.financials || []);

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

const formatMoney = (value?: number | null) =>
  Number(value || 0).toLocaleString();

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
          >
            <VIcon>tabler-file-text</VIcon>
            +Quotation
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            class="d-flex align-center gap-2"
          >
            <VIcon>tabler-file-certificate</VIcon>
            +Proforma
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            class="d-flex align-center gap-2"
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
</template>
