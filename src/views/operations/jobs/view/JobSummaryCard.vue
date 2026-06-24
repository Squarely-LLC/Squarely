<script setup lang="ts">
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { jobStatusColorClass } from "@/utils/jobStatusColors";
import { formatSystemDate } from "@core/utils/formatters";
import { computed } from "vue";

type SummaryContact = {
  name: string;
  picture: string | null;
  email?: string | null;
  type?: string | null;
};

interface Props {
  job: JobProperties;
  contactDirectory: Map<number, SummaryContact>;
  employeeDirectory: Map<number, { name: string; picture: string | null }>;
  statusOptions?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  statusOptions: () => [
    "New",
    "Pending",
    "In Progress",
    "On Hold",
    "Completed",
    "Closed",
  ],
});

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "openAddTask"): void;
  (e: "openAddEmail"): void;
  (e: "openAddMeeting"): void;
  (e: "openAddCall"): void;
  (e: "openAddNote"): void;
  (e: "openCollaborators"): void;
}>();

const avatarText = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  try {
    return formatSystemDate(value);
  } catch (error) {
    console.warn("Failed to format job date", error);
    return value;
  }
};

const relatedContact = computed(() => {
  if (!props.job.relatedTo) return null;
  return props.contactDirectory.get(Number(props.job.relatedTo)) ?? null;
});

const displayIdentity = computed(() => {
  const contact = relatedContact.value;
  const name = contact?.name || props.job.name || "--";

  return {
    name,
    avatar: contact?.picture || props.job.avatar || null,
    fallbackIcon: contact?.type === "Entity" ? "tabler-building" : "tabler-user",
  };
});

const codeLine = computed(() => {
  const code = props.job.code?.trim() || "--";
  const order = props.job.jobOrderNumber?.trim() || `Job #${props.job.id}`;
  return `${code} | ${order}`;
});

const decoratedCollaborators = computed(() => {
  if (!Array.isArray(props.job.collaborators))
    return [] as Array<{
      id: number;
      name: string;
      avatar: string | null;
    }>;

  return props.job.collaborators.map((collaboratorId, index) => {
    const numericId = Number(collaboratorId);
    const entry = Number.isFinite(numericId)
      ? (props.employeeDirectory.get(numericId) ?? null)
      : null;

    return {
      id: Number.isFinite(numericId) ? numericId : index,
      name: entry?.name || `Collaborator ${index + 1}`,
      avatar: entry?.picture || null,
    };
  });
});

const timelineStatuses = computed(() =>
  props.statusOptions.filter((status) => String(status || "").trim()),
);

const currentStatusIndex = computed(() =>
  timelineStatuses.value.findIndex(
    (status) =>
      status.trim().toLowerCase() ===
      String(props.job.status || props.job.stage || "")
        .trim()
        .toLowerCase(),
  ),
);

const statusProgressPercent = computed(() => {
  if (timelineStatuses.value.length <= 1)
    return currentStatusIndex.value >= 0 ? 100 : 0;
  if (currentStatusIndex.value < 0) return 0;

  return (currentStatusIndex.value / (timelineStatuses.value.length - 1)) * 100;
});

const noteText = computed(() => props.job.note?.trim() || "No notes available");
</script>

<template>
  <VCard>
    <VCardText class="text-center pt-12">
      <VAvatar
        rounded
        :size="100"
        :color="displayIdentity.avatar ? undefined : 'primary'"
        variant="tonal"
      >
        <VImg v-if="displayIdentity.avatar" :src="displayIdentity.avatar" />
        <VIcon
          v-else-if="relatedContact"
          :icon="displayIdentity.fallbackIcon"
          size="48"
        />
        <span v-else class="text-5xl font-weight-medium">
          {{ avatarText(displayIdentity.name) }}
        </span>
      </VAvatar>

      <h5 class="text-h5 mt-4 text-truncate">
        {{ displayIdentity.name }}
      </h5>

      <div class="job-code-line mt-1">
        {{ codeLine }}
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
              @click="emit('openAddTask')"
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
              @click="emit('openAddEmail')"
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
              @click="emit('openAddMeeting')"
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
              @click="emit('openAddCall')"
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
              @click="emit('openAddNote')"
            >
              <VIcon icon="tabler-notes" />
            </VBtn>
          </template>
        </VTooltip>
      </div>

      <div v-if="timelineStatuses.length" class="status-timeline mt-6">
        <div class="status-timeline__track">
          <div
            class="status-timeline__progress"
            :class="jobStatusColorClass(job.status || job.stage)"
            :style="{ inlineSize: `${statusProgressPercent}%` }"
          />
        </div>

        <div
          class="status-timeline__steps"
          :style="{ gridTemplateColumns: `repeat(${timelineStatuses.length}, minmax(0, 1fr))` }"
        >
          <div
            v-for="(status, index) in timelineStatuses"
            :key="status"
            class="status-timeline__step"
            :class="{
              'status-timeline__step--complete':
                currentStatusIndex >= 0 && index < currentStatusIndex,
              'status-timeline__step--current': index === currentStatusIndex,
              [jobStatusColorClass(job.status || job.stage)]:
                currentStatusIndex >= 0 && index <= currentStatusIndex,
            }"
          >
            <span class="status-timeline__dot" />
            <span class="status-timeline__label">{{ status }}</span>
          </div>
        </div>
      </div>
    </VCardText>

    <VCardText>
      <VDivider class="my-4" />

      <VList class="py-0 card-list">
        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Project Name:</span>
            <span class="detail-row__value">{{ job.name || "--" }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Created Date:</span>
            <span class="detail-row__value">{{ formatDate(job.startDate) }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Delivery Date:</span>
            <span class="detail-row__value">{{ formatDate(job.endDate) }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row">
            <span class="detail-row__label">Type:</span>
            <span class="detail-row__value">{{ job.type || "--" }}</span>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle class="detail-row detail-row--stacked">
            <span class="detail-row__label">Collaborators:</span>
            <div class="summary-collaborators mt-2">
              <div
                v-if="decoratedCollaborators.length"
                class="v-avatar-group summary-collaborators__avatars"
              >
                <VTooltip
                  v-for="collaborator in decoratedCollaborators.slice(0, 5)"
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
                        v-if="collaborator.avatar"
                        :src="collaborator.avatar"
                      />
                      <span v-else class="text-xs font-weight-bold">
                        {{ avatarText(collaborator.name) }}
                      </span>
                    </VAvatar>
                  </template>
                  {{ collaborator.name }}
                </VTooltip>

                <VAvatar
                  v-if="decoratedCollaborators.length > 5"
                  size="34"
                  color="secondary"
                  variant="tonal"
                >
                  +{{ decoratedCollaborators.length - 5 }}
                </VAvatar>
              </div>

              <span v-else class="detail-row__value">No collaborators</span>

              <VTooltip text="Add collaborators" location="top">
                <template #activator="{ props: tooltipProps }">
                  <VBtn
                    v-bind="tooltipProps"
                    icon
                    size="small"
                    color="secondary"
                    variant="tonal"
                    aria-label="Add collaborators"
                    @click="emit('openCollaborators')"
                  >
                    <VIcon icon="tabler-plus" size="18" />
                  </VBtn>
                </template>
              </VTooltip>
            </div>
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

    <VCardText class="d-flex flex-column align-center pb-6">
      <VBtn aria-label="Edit job" variant="tonal" @click="emit('edit')">
        Edit
      </VBtn>
    </VCardText>
  </VCard>
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
  box-shadow: none;
  min-inline-size: 2.5rem;
}

.job-code-line {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.status-timeline {
  inline-size: 100%;
  padding-block-end: 0.15rem;
}

.status-timeline__track {
  overflow: hidden;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.1);
  block-size: 4px;
}

.status-timeline__progress {
  border-radius: inherit;
  background: var(--job-status-color, rgb(var(--v-theme-primary)));
  block-size: 100%;
  transition: inline-size 0.2s ease;
}

.status-timeline__steps {
  display: grid;
  gap: 0.2rem;
  margin-block-start: 0.65rem;
  inline-size: 100%;
}

.status-timeline__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  gap: 0.35rem;
  min-inline-size: 0;
}

.status-timeline__dot {
  border: 2px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 999px;
  background: rgb(var(--v-theme-surface));
  block-size: 0.7rem;
  inline-size: 0.7rem;
}

.status-timeline__label {
  overflow: visible;
  font-size: clamp(0.52rem, 1.8vw, 0.68rem);
  font-weight: 600;
  line-height: 1.2;
  max-inline-size: 100%;
  text-align: center;
  white-space: normal;
  word-break: normal;
}

.status-timeline__step--complete,
.status-timeline__step--current {
  color: var(--job-status-color, rgb(var(--v-theme-primary)));
}

.status-timeline__step--complete .status-timeline__dot,
.status-timeline__step--current .status-timeline__dot {
  border-color: var(--job-status-color, rgb(var(--v-theme-primary)));
  background: var(--job-status-color, rgb(var(--v-theme-primary)));
}

.job-status-color--teal {
  --job-status-color: #009688;
}

.job-status-color--purple {
  --job-status-color: #9c27b0;
}

.job-status-color--primary {
  --job-status-color: rgb(var(--v-theme-primary));
}

.job-status-color--success {
  --job-status-color: rgb(var(--v-theme-success));
}

.job-status-color--secondary {
  --job-status-color: rgb(var(--v-theme-secondary));
}

.job-status-color--default {
  --job-status-color: rgb(var(--v-theme-primary));
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
