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
  (e: "open-add-task"): void;
  (e: "open-add-email"): void;
  (e: "open-add-meeting"): void;
  (e: "open-add-call"): void;
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

      <div class="summary-actions mt-4">
        <VTooltip text="Task" location="top">
          <template #activator="{ props: tooltipProps }">
            <VBtn
              v-bind="tooltipProps"
              color="primary"
              variant="flat"
              rounded="lg"
              class="summary-action-btn"
              aria-label="Add task"
              @click="emit('open-add-task')"
            >
              <VIcon icon="tabler-checkbox" />
            </VBtn>
          </template>
        </VTooltip>

        <VTooltip text="Email" location="top">
          <template #activator="{ props: tooltipProps }">
            <VBtn
              v-bind="tooltipProps"
              color="primary"
              variant="flat"
              rounded="lg"
              class="summary-action-btn"
              aria-label="Add email"
              @click="emit('open-add-email')"
            >
              <VIcon icon="tabler-mail" />
            </VBtn>
          </template>
        </VTooltip>

        <VTooltip text="Meeting" location="top">
          <template #activator="{ props: tooltipProps }">
            <VBtn
              v-bind="tooltipProps"
              color="primary"
              variant="flat"
              rounded="lg"
              class="summary-action-btn"
              aria-label="Add meeting"
              @click="emit('open-add-meeting')"
            >
              <VIcon icon="tabler-calendar-plus" />
            </VBtn>
          </template>
        </VTooltip>

        <VTooltip text="Call" location="top">
          <template #activator="{ props: tooltipProps }">
            <VBtn
              v-bind="tooltipProps"
              color="primary"
              variant="flat"
              rounded="lg"
              class="summary-action-btn"
              aria-label="Add call"
              @click="emit('open-add-call')"
            >
              <VIcon icon="tabler-phone-call" />
            </VBtn>
          </template>
        </VTooltip>
      </div>
    </VCardText>

    <VCardText>
      <h5 class="text-h5">Details</h5>

      <VDivider class="my-4" />

      <div class="d-flex gap-2 mb-4 flex-wrap">
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

      <VList class="py-0 card-list">
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
            <span class="detail-row__value">{{
              formatAmount(dealAmount)
            }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Calculated Value:</span>
            <span class="detail-row__value">{{ formatAmount(dealValue) }}</span>
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
      <VBtn aria-label="Edit deal" @click="emit('edit')" class="mb-2">
        Edit
      </VBtn>
    </VCardText>
  </VCard>

  <VCardText v-if="!hoverMode" class="d-flex flex-column align-center pb-2">
    <VBtn aria-label="Execute deal" variant="elevated" @click="emit('execute')">
      <VIcon left>tabler-play</VIcon>
      Execute Deal
    </VBtn>
  </VCardText>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}

.summary-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  inline-size: fit-content;
  margin-inline: auto;
}

.summary-action-btn {
  padding: 0;
  border-radius: 0.75rem;
  block-size: 2.5rem;
  box-shadow: 0 10px 24px rgba(var(--v-theme-primary), 0.2);
  min-inline-size: 2.5rem;
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
  .summary-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .summary-action-btn {
    box-shadow: 0 10px 20px rgba(var(--v-theme-primary), 0.18);
  }

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
