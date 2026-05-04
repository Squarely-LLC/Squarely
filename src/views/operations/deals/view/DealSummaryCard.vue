<script setup lang="ts">
import { computed } from "vue";

import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { getDealGrandTotal } from "@/utils/dealValue";

interface Props {
  deal: DealProperties;
  linkedToName: string;
  collaboratorNames: string[];
  hoverMode?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "execute"): void;
}>();

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

const projectLabel = computed(
  () => props.deal.projectCode?.trim() || props.deal.projectName?.trim() || "",
);

const dealAmount = computed(() => props.deal.amount ?? null);
const dealValue = computed(() => getDealGrandTotal(props.deal));

const itemCount = computed(() => props.deal.items?.length || 0);

const noteText = computed(
  () => props.deal.note?.trim() || "No notes available",
);

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "--";

  return Number(value).toLocaleString();
};
</script>

<template>
  <VCard>
    <VCardText class="text-center pt-12">
      <VAvatar
        rounded
        :size="100"
        :color="deal.important ? 'warning' : 'primary'"
        variant="tonal"
      >
        <span class="text-5xl font-weight-medium">
          {{ deal.code || "--" }}
        </span>
      </VAvatar>

      <h5 class="text-h5 mt-4">
        {{ deal.code }}
      </h5>

      <div class="d-flex justify-center gap-2 mt-2 flex-wrap">
        <VChip label size="small" color="info" variant="text">
          {{ deal.stage || "--" }}
        </VChip>

        <VChip label size="small" color="primary" variant="text">
          {{ deal.type || "--" }}
        </VChip>

        <VChip
          label
          size="small"
          :color="deal.important ? 'warning' : 'secondary'"
          variant="text"
        >
          {{ deal.important ? "Important" : "Standard" }}
        </VChip>
      </div>
    </VCardText>

    <VCardText>
      <h5 class="text-h5">Details</h5>

      <VDivider class="my-4" />

      <VList class="py-0 card-list">
        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Deal Code:</span>
            <span class="detail-row__value">{{ deal.code || "--" }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Linked To:</span>
            <span class="detail-row__value">{{ linkedToName }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem v-if="projectLabel">
          <VListItemTitle class="detail-row detail-row--stacked">
            <span class="detail-row__label">Project:</span>
            <span class="detail-row__value detail-row__value--wrap">{{
              projectLabel
            }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Location:</span>
            <span class="detail-row__value">{{ deal.location || "--" }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Items:</span>
            <span class="detail-row__value">{{ itemCount }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Deal Amount:</span>
            <span class="detail-row__value">{{ formatAmount(dealAmount) }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Calculated Value:</span>
            <span class="detail-row__value">{{
              formatAmount(dealValue)
            }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row detail-row--stacked">
            <span class="detail-row__label">Collaborators:</span>
            <span class="detail-row__value detail-row__value--wrap">
              {{
                collaboratorNames.length ? collaboratorNames.join(", ") : "--"
              }}
            </span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row detail-row--stacked">
            <span class="detail-row__label">Notes:</span>
            <span class="detail-row__value detail-row__value--wrap">
              {{ noteText }}
            </span>
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCardText>

    <VCardText v-if="!hoverMode" class="d-flex flex-column align-center pb-6">
      <VBtn @click="emit('edit')" class="mb-2"> Edit </VBtn>
    </VCardText>
  </VCard>

  <VCardText v-if="!hoverMode" class="d-flex flex-column align-center pb-2">
    <VBtn variant="elevated" @click="emit('execute')">
      <VIcon left>tabler-play</VIcon>
      Execute Deal
    </VBtn>
  </VCardText>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  min-inline-size: 0;
}

.detail-row--stacked {
  display: block;
}

.detail-row__label {
  color: rgb(var(--v-theme-on-surface));
  font-size: 1rem;
  font-weight: 600;
}

.detail-row__value {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 1rem;
  min-inline-size: 0;
}

.detail-row__value--wrap {
  display: block;
  margin-block-start: 0.25rem;
  overflow-wrap: anywhere;
  white-space: normal;
}

@media (max-width: 960px) {
  .detail-row {
    display: block;
  }

  .detail-row__value {
    display: block;
    margin-block-start: 0.25rem;
    overflow-wrap: anywhere;
    white-space: normal;
  }
}
</style>
