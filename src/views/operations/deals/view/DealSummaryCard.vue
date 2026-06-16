<script setup lang="ts">
import { computed } from "vue";

import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { getDealGrandTotal } from "@/utils/dealValue";

type SummaryCollaborator = {
  id: number | string;
  name: string;
  avatarUrl: string | null;
  type: "contact" | "employee";
};

type SummaryContact = {
  name: string;
  avatarUrl: string | null;
  type?: string | null;
} | null;

interface Props {
  deal: DealProperties;
  linkedToName: string;
  salesmanName?: string;
  collaboratorNames: string[];
  collaborators?: SummaryCollaborator[];
  linkedContact?: SummaryContact;
  stageOptions?: string[];
  executionNotice?: string | null;
  hoverMode?: boolean;
  canEdit?: boolean;
  hideFinancials?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "execute"): void;
  (e: "open-add-task"): void;
  (e: "open-add-email"): void;
  (e: "open-add-meeting"): void;
  (e: "open-add-call"): void;
  (e: "open-add-note"): void;
  (e: "open-collaborators"): void;
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

const dealValue = computed(() => getDealGrandTotal(props.deal));

const noteText = computed(() => props.deal.note?.trim() || "");
const hasNotes = computed(() => Boolean(noteText.value));

const noteExcerpt = computed(() => {
  const text = noteText.value;
  if (text.length <= 160) return text;

  return `${text.slice(0, 160).trimEnd()}...`;
});

const formatAmount = (value?: number | null) => {
  if (props.hideFinancials) return "Hidden";
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "--";

  return Number(value).toLocaleString();
};

const avatarText = (name?: string | null) =>
  String(name || "")
    .match(/\b\w/g)
    ?.slice(0, 2)
    .join("")
    .toUpperCase() || "?";

const displayContact = computed(() => ({
  name: props.linkedContact?.name || props.linkedToName || "--",
  avatarUrl: props.linkedContact?.avatarUrl || null,
  type: props.linkedContact?.type || null,
}));

const fallbackContactIcon = computed(() =>
  displayContact.value.type === "Entity" ? "tabler-building" : "tabler-user",
);

const timelineStages = computed(() =>
  (props.stageOptions || []).filter((stage) => String(stage || "").trim()),
);

const currentStageIndex = computed(() =>
  timelineStages.value.findIndex(
    (stage) =>
      stage.trim().toLowerCase() ===
      String(props.deal.stage || "")
        .trim()
        .toLowerCase(),
  ),
);

const stageProgressPercent = computed(() => {
  if (timelineStages.value.length <= 1)
    return currentStageIndex.value >= 0 ? 100 : 0;
  if (currentStageIndex.value < 0) return 0;

  return (currentStageIndex.value / (timelineStages.value.length - 1)) * 100;
});
</script>

<template>
  <template v-if="hoverMode">
    <VCard>
      <VCardText class="pb-4">
        <div class="d-flex align-center justify-space-between gap-4 mb-4">
          <div class="min-inline-size-0">
            <div class="text-caption text-medium-emphasis mb-1">
              Deal Report
            </div>
            <h5 class="text-h5 text-truncate">
              {{ deal.code || "--" }}
            </h5>
          </div>

          <div class="d-flex gap-2 flex-wrap justify-end">
            <VChip label size="small" color="info" variant="tonal">
              {{ deal.stage || "--" }}
            </VChip>
            <VChip label size="small" color="primary" variant="tonal">
              {{ deal.type || "--" }}
            </VChip>
          </div>
        </div>

        <div class="hover-summary-grid">
          <div class="hover-summary-item">
            <span class="hover-summary-item__label">Contact</span>
            <span class="hover-summary-item__value">{{ linkedToName }}</span>
          </div>

          <div class="hover-summary-item">
            <span class="hover-summary-item__label">Project</span>
            <span class="hover-summary-item__value">{{
              projectLabel || "--"
            }}</span>
          </div>

          <div class="hover-summary-item">
            <span class="hover-summary-item__label">Date</span>
            <span class="hover-summary-item__value">{{
              formatDate(deal.estimatedDeliveryDate)
            }}</span>
          </div>

          <div class="hover-summary-item">
            <span class="hover-summary-item__label">Value</span>
            <span class="hover-summary-item__value">{{
              formatAmount(dealValue)
            }}</span>
          </div>

          <div class="hover-summary-item hover-summary-item--full">
            <span class="hover-summary-item__label">Collaborators</span>
            <span
              class="hover-summary-item__value hover-summary-item__value--wrap"
            >
              {{
                collaboratorNames.length ? collaboratorNames.join(", ") : "--"
              }}
            </span>
          </div>

          <div class="hover-summary-item hover-summary-item--full">
            <span class="hover-summary-item__label">Notes</span>
            <span
              class="hover-summary-item__value hover-summary-item__value--wrap"
            >
              {{ noteExcerpt }}
            </span>
          </div>
        </div>
      </VCardText>
    </VCard>
  </template>

  <template v-else>
    <VCard>
      <VCardText class="text-center pt-12">
        <VAvatar
          rounded
          :size="100"
          :color="displayContact.avatarUrl ? undefined : 'primary'"
          variant="tonal"
        >
          <VImg
            v-if="displayContact.avatarUrl"
            :src="displayContact.avatarUrl"
          />
          <VIcon v-else :icon="fallbackContactIcon" size="48" />
        </VAvatar>

        <h5 class="text-h5 mt-4 text-truncate">
          {{ displayContact.name }}
        </h5>

        <div class="contact-code-line mt-1">
          {{ projectLabel || "--" }} | {{ deal.code || `Deal #${deal.id}` }}
        </div>

        <div class="summary-actions mt-4">
          <VTooltip text="Task" location="top">
            <template #activator="{ props: tooltipProps }">
              <VBtn
                v-bind="tooltipProps"
                color="secondary"
                variant="tonal"
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
                color="secondary"
                variant="tonal"
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
                color="secondary"
                variant="tonal"
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
                color="secondary"
                variant="tonal"
                rounded="lg"
                class="summary-action-btn"
                aria-label="Add call"
                @click="emit('open-add-call')"
              >
                <VIcon icon="tabler-phone-call" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip text="Notes" location="top">
            <template #activator="{ props: tooltipProps }">
              <VBtn
                v-bind="tooltipProps"
                color="secondary"
                variant="tonal"
                rounded="lg"
                class="summary-action-btn"
                aria-label="Add note"
                @click="emit('open-add-note')"
              >
                <VIcon icon="tabler-notes" />
              </VBtn>
            </template>
          </VTooltip>
        </div>

        <div v-if="timelineStages.length" class="stage-timeline mt-6">
          <div class="stage-timeline__track">
            <div
              class="stage-timeline__progress"
              :style="{ inlineSize: `${stageProgressPercent}%` }"
            />
          </div>

          <div
            class="stage-timeline__steps"
            :style="{ gridTemplateColumns: `repeat(${timelineStages.length}, minmax(0, 1fr))` }"
          >
            <div
              v-for="(stage, index) in timelineStages"
              :key="stage"
              class="stage-timeline__step"
              :class="{
                'stage-timeline__step--complete':
                  currentStageIndex >= 0 && index < currentStageIndex,
                'stage-timeline__step--current': index === currentStageIndex,
              }"
            >
              <span class="stage-timeline__dot" />
              <span class="stage-timeline__label">{{ stage }}</span>
            </div>
          </div>
        </div>
      </VCardText>

      <VCardText>
        <VDivider class="my-4" />

        <VList class="py-0 card-list">
          <VListItem>
            <VListItemTitle class="detail-row">
              <span class="detail-row__label">Date:</span>
              <span class="detail-row__value">{{
                formatDate(deal.estimatedDeliveryDate)
              }}</span>
            </VListItemTitle>
          </VListItem>

          <VListItem>
            <VListItemTitle class="detail-row">
              <span class="detail-row__label">Type:</span>
              <span class="detail-row__value">{{ deal.type || "--" }}</span>
            </VListItemTitle>
          </VListItem>

          <VListItem>
            <VListItemTitle class="detail-row">
              <span class="detail-row__label">Salesman:</span>
              <span class="detail-row__value">{{
                salesmanName || "--"
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
            <VListItemTitle class="detail-row detail-row--stacked">
              <span class="detail-row__label">Collaborators:</span>
              <div class="summary-collaborators mt-2">
                <div
                  v-if="collaborators?.length"
                  class="v-avatar-group summary-collaborators__avatars"
                >
                  <VTooltip
                    v-for="collaborator in collaborators.slice(0, 5)"
                    :key="collaborator.id"
                    location="top"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <VAvatar
                        v-bind="tooltipProps"
                        size="34"
                        color="primary"
                        variant="tonal"
                      >
                        <VImg
                          v-if="collaborator.avatarUrl"
                          :src="collaborator.avatarUrl"
                        />
                        <span v-else class="text-xs font-weight-bold">
                          {{ avatarText(collaborator.name) }}
                        </span>
                      </VAvatar>
                    </template>
                    {{ collaborator.name }}
                  </VTooltip>

                  <VAvatar
                    v-if="collaborators.length > 5"
                    size="34"
                    color="secondary"
                    variant="tonal"
                  >
                    +{{ collaborators.length - 5 }}
                  </VAvatar>
                </div>

                <span v-else class="detail-row__value">No collaborators</span>

                <VBtn
                  v-if="canEdit"
                  icon
                  size="small"
                  color="secondary"
                  variant="tonal"
                  aria-label="Add collaborators"
                  @click="emit('open-collaborators')"
                >
                  <VIcon icon="tabler-plus" size="18" />
                </VBtn>
              </div>
            </VListItemTitle>
          </VListItem>

          <VListItem v-if="hasNotes">
            <VListItemTitle class="detail-row detail-row--stacked">
              <span class="detail-row__label">Notes:</span>
              <span class="detail-row__value detail-row__value--wrap">
                {{ noteText }}
              </span>
            </VListItemTitle>
          </VListItem>
        </VList>
      </VCardText>

      <VCardText class="d-flex flex-column align-center pb-6">
        <VBtn
          v-if="canEdit"
          aria-label="Edit deal"
          variant="tonal"
          @click="emit('edit')"
          class="mb-2"
        >
          Edit
        </VBtn>
      </VCardText>
    </VCard>

  </template>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}

.hover-summary-grid {
  display: grid;
  gap: 0.875rem 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.hover-summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-inline-size: 0;
}

.hover-summary-item--full {
  grid-column: 1 / -1;
}

.hover-summary-item__label {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.hover-summary-item__value {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
  font-weight: 500;
}

.hover-summary-item__value--wrap {
  overflow-wrap: anywhere;
  white-space: normal;
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
  box-shadow: none;
  min-inline-size: 2.5rem;
}

.contact-code-line {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.stage-timeline {
  inline-size: 100%;
  padding-block-end: 0.15rem;
}

.stage-timeline__track {
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  block-size: 4px;
}

.stage-timeline__progress {
  border-radius: inherit;
  background: rgb(var(--v-theme-primary));
  block-size: 100%;
  transition: inline-size 0.2s ease;
}

.stage-timeline__steps {
  display: grid;
  gap: 0.2rem;
  margin-block-start: 0.65rem;
  inline-size: 100%;
}

.stage-timeline__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  gap: 0.35rem;
  min-inline-size: 0;
}

.stage-timeline__dot {
  border: 2px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface));
  block-size: 0.7rem;
  inline-size: 0.7rem;
}

.stage-timeline__label {
  overflow: visible;
  font-size: clamp(0.52rem, 1.8vw, 0.68rem);
  font-weight: 600;
  line-height: 1.2;
  max-inline-size: 100%;
  text-align: center;
  white-space: normal;
  word-break: normal;
}

.stage-timeline__step--complete,
.stage-timeline__step--current {
  color: rgb(var(--v-theme-primary));
}

.stage-timeline__step--complete .stage-timeline__dot,
.stage-timeline__step--current .stage-timeline__dot {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}

.summary-collaborators {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.summary-collaborators__avatars {
  justify-content: flex-start;
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
    box-shadow: none;
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
