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
  editDisabledReason?: string;
  canAddTask?: boolean;
  taskDisabledReason?: string;
  canAddEmail?: boolean;
  emailDisabledReason?: string;
  canAddMeeting?: boolean;
  meetingDisabledReason?: string;
  canAddCall?: boolean;
  callDisabledReason?: string;
  canAddNote?: boolean;
  noteDisabledReason?: string;
  hideFinancials?: boolean;
  workActionLabel?: string;
  workActionState?: "start" | "update" | "in_progress";
  workActionDisabled?: boolean;
  workActionDisabledReason?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "edit"): void;
  (e: "execute"): void;
  (e: "work-action"): void;
  (e: "toggle-important"): void;
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

const defaultDisabledReason = "You do not have permission to perform this action.";

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

const normalizeStageKey = (stage?: string | null) => {
  const normalized = String(stage ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "closed") return "lost";
  if (normalized.includes("negotiat") || normalized.includes("negotat"))
    return "negotiation";
  if (normalized.includes("pre") && normalized.includes("sale"))
    return "pre-sale";
  if (normalized === "active" || normalized === "lost") return normalized;

  return normalized;
};

const findStageLabel = (key: "pre-sale" | "negotiation") =>
  (props.stageOptions || []).find((stage) => normalizeStageKey(stage) === key);

const currentStageKey = computed(() => normalizeStageKey(props.deal.stage));

const timelineStages = computed(() => {
  const finalStage = currentStageKey.value === "lost" ? "Lost" : "Active";

  return [
    findStageLabel("pre-sale") || "Pre-Sale",
    findStageLabel("negotiation") || "Negotation",
    finalStage,
  ];
});

const currentStageIndex = computed(() => {
  if (currentStageKey.value === "lost" || currentStageKey.value === "active")
    return 2;
  if (currentStageKey.value === "negotiation") return 1;
  if (currentStageKey.value === "pre-sale") return 0;

  return -1;
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
      <VCardText class="text-center pt-4">
        <div class="summary-card-header">
          <VBtn
            variant="text"
            color="secondary"
            class="summary-back-btn"
            @click="emit('back')"
          >
            <VIcon start icon="tabler-chevron-left" />
            Back to deals table
          </VBtn>

          <VTooltip
            :text="canEdit ? (deal.important ? 'Remove favorite' : 'Favorite') : editDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  icon
                  variant="text"
                  :color="deal.important ? 'warning' : 'secondary'"
                  aria-label="Toggle favorite"
                  :disabled="!canEdit"
                  @click="canEdit ? emit('toggle-important') : undefined"
                >
                  <VIcon
                    :icon="deal.important ? 'tabler-star-filled' : 'tabler-star'"
                  />
                </VBtn>
              </span>
            </template>
          </VTooltip>
        </div>

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
          <VTooltip
            :text="canAddTask ? 'Task' : taskDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  color="secondary"
                  variant="tonal"
                  rounded="lg"
                  class="summary-action-btn"
                  aria-label="Add task"
                  :disabled="!canAddTask"
                  @click="canAddTask ? emit('open-add-task') : undefined"
                >
                  <VIcon icon="tabler-checkbox" />
                </VBtn>
              </span>
            </template>
          </VTooltip>

          <VTooltip
            :text="canAddEmail ? 'Email' : emailDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  color="secondary"
                  variant="tonal"
                  rounded="lg"
                  class="summary-action-btn"
                  aria-label="Add email"
                  :disabled="!canAddEmail"
                  @click="canAddEmail ? emit('open-add-email') : undefined"
                >
                  <VIcon icon="tabler-mail" />
                </VBtn>
              </span>
            </template>
          </VTooltip>

          <VTooltip
            :text="canAddMeeting ? 'Meeting' : meetingDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  color="secondary"
                  variant="tonal"
                  rounded="lg"
                  class="summary-action-btn"
                  aria-label="Add meeting"
                  :disabled="!canAddMeeting"
                  @click="canAddMeeting ? emit('open-add-meeting') : undefined"
                >
                  <VIcon icon="tabler-calendar-plus" />
                </VBtn>
              </span>
            </template>
          </VTooltip>

          <VTooltip
            :text="canAddCall ? 'Call' : callDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  color="secondary"
                  variant="tonal"
                  rounded="lg"
                  class="summary-action-btn"
                  aria-label="Add call"
                  :disabled="!canAddCall"
                  @click="canAddCall ? emit('open-add-call') : undefined"
                >
                  <VIcon icon="tabler-phone-call" />
                </VBtn>
              </span>
            </template>
          </VTooltip>

          <VTooltip
            :text="canAddNote ? 'Notes' : noteDisabledReason || defaultDisabledReason"
            location="top"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="d-inline-flex">
                <VBtn
                  color="secondary"
                  variant="tonal"
                  rounded="lg"
                  class="summary-action-btn"
                  aria-label="Add note"
                  :disabled="!canAddNote"
                  @click="canAddNote ? emit('open-add-note') : undefined"
                >
                  <VIcon icon="tabler-notes" />
                </VBtn>
              </span>
            </template>
          </VTooltip>
        </div>

        <div v-if="timelineStages.length" class="stage-timeline mt-6">
          <div
            class="stage-timeline__segments"
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
              <span class="stage-timeline__bar" />
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

          <VDivider class="my-3" />

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

                <VTooltip
                  :text="canEdit ? 'Add collaborators' : editDisabledReason || defaultDisabledReason"
                  location="top"
                >
                  <template #activator="{ props: tooltipProps }">
                    <span v-bind="tooltipProps" class="d-inline-flex">
                      <VBtn
                        icon
                        size="small"
                        color="secondary"
                        variant="tonal"
                        aria-label="Add collaborators"
                        :disabled="!canEdit"
                        @click="canEdit ? emit('open-collaborators') : undefined"
                      >
                        <VIcon icon="tabler-plus" size="18" />
                      </VBtn>
                    </span>
                  </template>
                </VTooltip>
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

      <VDivider class="mx-6" />

      <VCardText class="summary-bottom-actions">
        <VTooltip
          :text="canEdit ? 'Edit deal' : editDisabledReason || defaultDisabledReason"
          location="top"
        >
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" class="d-inline-flex flex-grow-1">
              <VBtn
                aria-label="Edit deal"
                variant="tonal"
                :disabled="!canEdit"
                block
                @click="canEdit ? emit('edit') : undefined"
              >
                Edit
              </VBtn>
            </span>
          </template>
        </VTooltip>

        <VTooltip
          :text="workActionDisabled ? workActionDisabledReason || defaultDisabledReason : workActionLabel || 'Start Work'"
          location="top"
        >
          <template #activator="{ props: tooltipProps }">
            <span v-bind="tooltipProps" class="d-inline-flex flex-grow-1">
              <VBtn
                aria-label="Work action"
                :variant="workActionState === 'in_progress' ? 'flat' : 'tonal'"
                :color="workActionState === 'update' ? 'warning' : workActionState === 'in_progress' ? 'secondary' : 'primary'"
                :disabled="workActionDisabled"
                block
                class="summary-work-btn"
                :class="{ 'summary-work-btn--progress': workActionState === 'in_progress' }"
                @click="!workActionDisabled ? emit('work-action') : undefined"
              >
                {{ workActionLabel || "Start Work" }}
              </VBtn>
            </span>
          </template>
        </VTooltip>
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

.summary-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-block-end: 1.75rem;
  min-inline-size: 0;
}

.summary-back-btn {
  padding-inline-start: 0;
  min-inline-size: 0;
}

.summary-action-btn {
  padding: 0;
  border-radius: 0.75rem;
  block-size: 2.5rem;
  box-shadow: none;
  min-inline-size: 2.5rem;
}

.summary-bottom-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block-end: 1.5rem;
}

.summary-work-btn--progress {
  color: rgb(var(--v-theme-primary)) !important;
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

.stage-timeline__segments {
  display: grid;
  gap: 0.45rem;
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

.stage-timeline__bar {
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  block-size: 0.35rem;
  inline-size: 100%;
  transition: background-color 0.2s ease;
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

.stage-timeline__step--complete .stage-timeline__bar,
.stage-timeline__step--current .stage-timeline__bar {
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
  .summary-card-header {
    align-items: flex-start;
  }

  .summary-back-btn {
    white-space: normal;
  }

  .summary-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .summary-bottom-actions {
    flex-direction: column;
    align-items: stretch;
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
