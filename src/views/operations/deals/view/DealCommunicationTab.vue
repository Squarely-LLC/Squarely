<script setup lang="ts">
import type { ContactRef } from "@/data/schema";
import type { CatalogueContractualServiceRecord } from "@/plugins/fake-api/handlers/catalogues/types";
import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { useCataloguesStore } from "@/stores/catalogues";
import { useJobsStore } from "@/stores/jobs";
import { useTodos } from "@/stores/todos";
import { getDealContractualPhaseLines } from "@/utils/dealDocumentDraft";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, ref } from "vue";

type StageKey = "created" | "negotation" | "active" | "canceled" | "lost";

type NoteActivity = {
  id: string;
  title: string;
  body: string;
  date: string | null;
  stage: StageKey;
};

const props = defineProps<{
  deal: DealProperties;
  collaborators?: ContactRef[];
  hideFinancials?: boolean;
}>();

const cataloguesStore = useCataloguesStore();
const jobsStore = useJobsStore();
const todosStore = useTodos();

cataloguesStore.init();
jobsStore.init();
todosStore.init();

const EMAIL_THREAD_NOTE = "__deal_email_thread__";
const stageFilter = ref<"all" | StageKey>("all");

const stageOptions = [
  { key: "all", label: "All", color: "secondary" },
  { key: "created", label: "Created", color: "error" },
  { key: "negotation", label: "Negotation", color: "primary" },
  { key: "active", label: "Active / Won", color: "success" },
  { key: "canceled", label: "Canceled", color: "warning" },
  { key: "lost", label: "Lost", color: "error" },
] as const;

const timelineStageOptions = stageOptions.filter(
  (stage) => stage.key !== "all",
) as Array<{
  key: StageKey;
  label: string;
  color: string;
}>;

function normalizeStageBucket(value?: string | null): StageKey {
  const stage = String(value || "").trim().toLowerCase();

  if (!stage || stage === "pre-sale" || stage === "presale") return "created";
  if (stage.includes("cancel")) return "canceled";
  if (stage.includes("lost")) return "lost";
  if (stage.includes("active") || stage.includes("won")) return "active";
  if (stage.includes("negot")) return "negotation";

  return "created";
}

const currentStage = computed<StageKey>(() =>
  normalizeStageBucket(props.deal.stage),
);

function stageLabel(stage: StageKey) {
  return timelineStageOptions.find((option) => option.key === stage)?.label || "";
}

function stageIcon(stage: StageKey) {
  if (stage === "created") return "tabler-circle-plus";
  if (stage === "negotation") return "tabler-messages";
  if (stage === "active") return "tabler-trophy";
  if (stage === "canceled") return "tabler-ban";
  if (stage === "lost") return "tabler-circle-x";

  return "tabler-point";
}

function parseTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatDisplayDate(value?: string | null) {
  const time = parseTime(value);
  if (time === null) return "--";

  try {
    return formatSystemDate(time);
  } catch {
    return value || "--";
  }
}

function daysBetween(start?: string | null, end?: string | null) {
  const startTime = parseTime(start);
  const endTime = end ? parseTime(end) : Date.now();
  if (startTime === null || endTime === null) return null;

  return Math.max(
    0,
    Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000)),
  );
}

function formatDays(days: number | null) {
  if (days === null) return "No time recorded yet";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function initials(name?: string | null) {
  return (
    name
      ?.match(/\b\w/g)
      ?.slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

const linkedJob = computed(() => {
  const linkedJobId = props.deal.linkedJobId;
  if (linkedJobId === null || linkedJobId === undefined) return null;

  return jobsStore.byId(linkedJobId) ?? null;
});

const dealTodos = computed(() => {
  const dealId = String(props.deal.id ?? "").trim();
  const linkedJobId = String(props.deal.linkedJobId ?? "").trim();
  if (!dealId) return [] as any[];

  return (todosStore.items || []).filter((todo: any) => {
    if (!todo?.relatedTo) return false;

    const matchesDeal =
      String(todo.relatedTo.id) === dealId &&
      (todo.relatedTo.type ? todo.relatedTo.type === "deal" : true);
    const matchesLinkedJob =
      Boolean(linkedJobId) &&
      String(todo.relatedTo.id) === linkedJobId &&
      todo.relatedTo.type === "job";

    return matchesDeal || matchesLinkedJob;
  });
});

const dealTaskTodos = computed(() =>
  dealTodos.value.filter((todo: any) => todo?.notes !== EMAIL_THREAD_NOTE),
);

const dealMeetings = computed(() => {
  const dealId = String(props.deal.id ?? "").trim();
  if (!dealId) return [] as any[];

  return (todosStore.meetings || []).filter((meeting: any) => {
    return (
      meeting?.relatedTo &&
      String(meeting.relatedTo.id) === dealId &&
      (meeting.relatedTo.type ? meeting.relatedTo.type === "deal" : true)
    );
  });
});

const callCount = computed(
  () =>
    dealMeetings.value.filter(
      (meeting: any) =>
        meeting?.type === "Brief" ||
        String(meeting?.location || "")
          .toLowerCase()
          .includes("phone"),
    ).length,
);

const meetingCount = computed(
  () => Math.max(0, dealMeetings.value.length - callCount.value),
);

const rootItems = computed(() =>
  (props.deal.items || []).filter(
    (item) => item.parentItemId === null || item.parentItemId === undefined,
  ),
);

const phaseCount = computed(() =>
  rootItems.value.reduce((count, item) => {
    if (item.catalogueType !== "Contractual Service" || !item.catalogueItemId)
      return count;

    const record = cataloguesStore.recordById(
      item.catalogueItemId,
      item.catalogueType,
    ) as CatalogueContractualServiceRecord | null;
    if (!record || record.type !== "Contractual Service") return count;

    return count + getDealContractualPhaseLines(item, record).length;
  }, 0),
);

function positiveCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

const periodCount = computed(() =>
  rootItems.value.reduce(
    (count, item) =>
      count +
      positiveCount(item.retainerPeriods) +
      positiveCount(item.recurrentPeriods),
    0,
  ),
);

const stageHistory = computed(() => {
  const entries = Array.isArray(props.deal.stageHistory)
    ? props.deal.stageHistory
        .map((entry) => ({
          stage: normalizeStageBucket(entry.stage),
          enteredAt: entry.enteredAt,
        }))
        .filter((entry) => parseTime(entry.enteredAt) !== null)
    : [];

  if (!entries.length && props.deal.createdAt) {
    entries.push({
      stage: "created" as const,
      enteredAt: props.deal.createdAt,
    });
  }

  return entries.sort(
    (left, right) =>
      (parseTime(left.enteredAt) ?? 0) - (parseTime(right.enteredAt) ?? 0),
  );
});

function stageEntry(stage: StageKey) {
  return stageHistory.value.find((entry) => entry.stage === stage) ?? null;
}

function nextStageEntry(stage: StageKey) {
  const startIndex = stageHistory.value.findIndex(
    (entry) => entry.stage === stage,
  );
  if (startIndex === -1) return null;

  return (
    stageHistory.value
      .slice(startIndex + 1)
      .find((entry) => entry.stage !== stage) ?? null
  );
}

function stageDurationDays(stage: StageKey) {
  const entry = stageEntry(stage);
  if (!entry) return null;

  return daysBetween(entry.enteredAt, nextStageEntry(stage)?.enteredAt);
}

const activeConvertedAt = computed(
  () =>
    stageEntry("active")?.enteredAt ||
    linkedJob.value?.createdAt ||
    linkedJob.value?.startDate ||
    null,
);

const activeDays = computed(() => daysBetween(activeConvertedAt.value));

const jobTasks = computed(() => {
  const jobId = linkedJob.value?.id;
  if (jobId === null || jobId === undefined) return [] as any[];

  return (todosStore.items || []).filter(
    (todo: any) =>
      todo.relatedTo &&
      String(todo.relatedTo.id) === String(jobId) &&
      (todo.relatedTo.type ? todo.relatedTo.type === "job" : true),
  );
});

const jobProgress = computed(() => {
  if (jobTasks.value.length) {
    const completed = jobTasks.value.filter(
      (task: any) => task.status === "completed",
    ).length;

    return Math.round((completed / jobTasks.value.length) * 100);
  }

  const job = linkedJob.value;
  if (!job) return 0;
  if (job.status === "Completed" || job.status === "Closed") return 100;
  if (job.status === "In Progress" || job.stage === "Project | In Progress")
    return 50;
  if (job.startDate && job.endDate) {
    const total = (parseTime(job.endDate) ?? 0) - (parseTime(job.startDate) ?? 0);
    const elapsed = Date.now() - (parseTime(job.startDate) ?? Date.now());
    if (total > 0) return Math.min(99, Math.max(0, Math.round((elapsed / total) * 100)));
  }

  return 0;
});

const noteActivities = computed<NoteActivity[]>(() =>
  (props.deal.notes || []).map((note) => ({
    id: `note-${note.id}`,
    title: note.authorName || "Note",
    body: note.body || "",
    date: note.createdAt || null,
    stage: normalizeStageBucket(note.stage || props.deal.stage),
  })),
);

const visibleStageSections = computed(() =>
  timelineStageOptions
    .filter((stage) => stageFilter.value === "all" || stage.key === stageFilter.value)
    .map((stage) => ({
      ...stage,
      notes: noteActivities.value.filter((note) => note.stage === stage.key),
    })),
);

function jobReference() {
  const job = linkedJob.value;
  if (!job) return "--";

  return job.jobOrderNumber || job.code || `Job #${job.id}`;
}
</script>

<template>
  <VCard class="activity-card">
    <VCardItem class="activity-card__header">
      <template #title>
        {{ `${deal.code || `Deal #${deal.id}`} Activity` }}
      </template>

      <template #append>
        <VBtnToggle
          v-model="stageFilter"
          class="activity-stage-filter"
          color="primary"
          density="compact"
          mandatory
          divided
        >
          <VBtn
            v-for="stage in stageOptions"
            :key="stage.key"
            :value="stage.key"
            size="small"
          >
            {{ stage.label }}
          </VBtn>
        </VBtnToggle>
      </template>
    </VCardItem>

    <VCardText class="activity-card__body">
      <VTimeline
        align="start"
        justify="center"
        line-inset="19"
        truncate-line="start"
        density="compact"
        class="deal-stage-timeline"
      >
        <VTimelineItem
          v-for="stage in visibleStageSections"
          :key="stage.key"
          size="small"
          fill-dot
        >
          <template #icon>
            <div class="v-timeline-avatar-wrapper rounded-circle">
              <VAvatar
                size="32"
                :color="stage.color"
                variant="tonal"
              >
                <VIcon
                  :icon="stageIcon(stage.key)"
                  size="20"
                />
              </VAvatar>
            </div>
          </template>

          <div class="deal-stage-section">
            <div class="deal-stage-section__heading">
              <div>
                <div class="deal-stage-section__title">{{ stage.label }}</div>
                <div class="deal-stage-section__meta">
                  {{ stage.notes.length }} note{{ stage.notes.length === 1 ? "" : "s" }}
                </div>
              </div>
              <VChip size="small" :color="stage.color" label>
                {{ stage.label }}
              </VChip>
            </div>

            <VCard
              v-if="stage.key === 'created'"
              variant="tonal"
              class="activity-entry"
            >
              <VCardText>
                <div class="activity-entry__title">Created overview</div>
                <div class="activity-overview-grid">
                  <div>
                    <span>Date created</span>
                    <strong>{{ formatDisplayDate(deal.createdAt) }}</strong>
                  </div>
                  <div>
                    <span>Expected close date</span>
                    <strong>{{ formatDisplayDate(deal.estimatedDeliveryDate) }}</strong>
                  </div>
                </div>

                <div class="activity-stage-mini mt-4">
                  <div
                    v-for="timelineStage in timelineStageOptions"
                    :key="timelineStage.key"
                    class="activity-stage-mini__step"
                    :class="{
                      'activity-stage-mini__step--active':
                        timelineStage.key === currentStage,
                    }"
                  >
                    <span
                      class="activity-stage-mini__dot"
                      :class="`bg-${timelineStage.color}`"
                    />
                    <span>{{ timelineStage.label }}</span>
                  </div>
                </div>

                <div class="activity-collaborators mt-4">
                  <span>Collaborators</span>
                  <div v-if="collaborators?.length" class="v-avatar-group">
                    <VTooltip
                      v-for="collaborator in collaborators.slice(0, 5)"
                      :key="collaborator.id"
                      :text="collaborator.name"
                      location="top"
                    >
                      <template #activator="{ props: tooltipProps }">
                        <VAvatar v-bind="tooltipProps" :size="32" color="primary">
                          <VImg
                            v-if="collaborator.avatarUrl"
                            :src="collaborator.avatarUrl"
                          />
                          <span v-else class="text-xs font-weight-medium">
                            {{ initials(collaborator.name) }}
                          </span>
                        </VAvatar>
                      </template>
                    </VTooltip>
                    <VAvatar
                      v-if="collaborators.length > 5"
                      :size="32"
                      color="secondary"
                    >
                      +{{ collaborators.length - 5 }}
                    </VAvatar>
                  </div>
                  <strong v-else>--</strong>
                </div>
              </VCardText>
            </VCard>

            <VCard
              v-if="stage.key === 'created'"
              variant="tonal"
              class="activity-entry"
            >
              <VCardText>
                <div class="activity-entry__title">Pre-sale activities</div>
                <div class="activity-count-grid">
                  <div>
                    <span>Tasks</span>
                    <strong>{{ dealTaskTodos.length }}</strong>
                  </div>
                  <div>
                    <span>Calls</span>
                    <strong>{{ callCount }}</strong>
                  </div>
                  <div>
                    <span>Meetings</span>
                    <strong>{{ meetingCount }}</strong>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VCard
              v-if="stage.key === 'negotation'"
              variant="tonal"
              class="activity-entry"
            >
              <VCardText>
                <div class="activity-entry__title">Negotation summary</div>
                <div class="activity-count-grid">
                  <div>
                    <span>Items</span>
                    <strong>{{ rootItems.length }}</strong>
                  </div>
                  <div v-if="phaseCount">
                    <span>Phases</span>
                    <strong>{{ phaseCount }}</strong>
                  </div>
                  <div v-if="periodCount">
                    <span>Periods</span>
                    <strong>{{ periodCount }}</strong>
                  </div>
                  <div>
                    <span>Tasks</span>
                    <strong>{{ dealTaskTodos.length }}</strong>
                  </div>
                  <div>
                    <span>Calls</span>
                    <strong>{{ callCount }}</strong>
                  </div>
                  <div>
                    <span>Meetings</span>
                    <strong>{{ meetingCount }}</strong>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VCard
              v-if="stage.key === 'active'"
              variant="tonal"
              class="activity-entry"
            >
              <VCardText>
                <div class="activity-entry__header">
                  <div class="activity-entry__title">Active work summary</div>
                  <VChip size="small" color="success" label>
                    {{ jobReference() }}
                  </VChip>
                </div>

                <div class="activity-count-grid mt-3">
                  <div>
                    <span>Items</span>
                    <strong>{{ rootItems.length }}</strong>
                  </div>
                  <div>
                    <span>Active for</span>
                    <strong>{{ formatDays(activeDays) }}</strong>
                  </div>
                  <div v-if="phaseCount">
                    <span>Phases</span>
                    <strong>{{ phaseCount }}</strong>
                  </div>
                  <div v-if="periodCount">
                    <span>Periods</span>
                    <strong>{{ periodCount }}</strong>
                  </div>
                  <div>
                    <span>Estimated end date</span>
                    <strong>{{ formatDisplayDate(linkedJob?.endDate || deal.estimatedDeliveryDate) }}</strong>
                  </div>
                </div>

                <div class="activity-progress mt-4">
                  <div class="activity-progress__label">
                    <span>Job progress</span>
                    <strong>{{ jobProgress }}%</strong>
                  </div>
                  <VProgressLinear
                    :model-value="jobProgress"
                    color="success"
                    height="8"
                    rounded
                  />
                </div>
              </VCardText>
            </VCard>

            <VCard variant="tonal" class="activity-entry activity-entry--duration">
              <VCardText>
                <template v-if="stage.key === 'active'">
                  <div class="activity-entry__title">
                    Converted to active on {{ formatDisplayDate(activeConvertedAt) }}
                  </div>
                  <div class="activity-entry__meta mt-1">
                    Days since: {{ formatDays(activeDays) }}
                  </div>
                </template>
                <template v-else>
                  <div class="activity-entry__title">Time in phase</div>
                  <div class="activity-entry__meta mt-1">
                    Days spent in this phase:
                    {{ formatDays(stageDurationDays(stage.key)) }}
                  </div>
                </template>
              </VCardText>
            </VCard>

            <VCard
              v-for="note in stage.notes"
              :key="note.id"
              variant="tonal"
              class="activity-entry activity-entry--note"
            >
              <VCardText>
                <div class="activity-entry__header">
                  <div class="activity-entry__title">{{ note.title }}</div>
                  <span class="activity-entry__time">
                    {{ formatDisplayDate(note.date) }}
                  </span>
                </div>

                <div class="activity-entry__body">
                  {{ note.body }}
                </div>
              </VCardText>
            </VCard>
          </div>
        </VTimelineItem>
      </VTimeline>
    </VCardText>
  </VCard>
</template>

<style scoped>
.activity-card {
  display: flex;
  min-block-size: 42rem;
  block-size: calc(100vh - 10rem);
  flex-direction: column;
}

.activity-card__header {
  flex: 0 0 auto;
}

.activity-stage-filter {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-inline-size: 100%;
}

.activity-card__body {
  overflow: auto;
  flex: 1 1 auto;
  min-block-size: 0;
  padding-inline-end: 0.5rem;
  scrollbar-color: rgba(0 0 0 / 12%) transparent;
  scrollbar-width: thin;
}

.activity-card__body::-webkit-scrollbar {
  block-size: 10px;
  inline-size: 10px;
}

.activity-card__body::-webkit-scrollbar-track {
  background: transparent;
}

.activity-card__body::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
  background-color: rgba(0 0 0 / 12%);
}

.activity-card__body::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0 0 0 / 18%);
}

.deal-stage-timeline {
  min-block-size: 0;
}

.v-timeline-avatar-wrapper {
  background-color: rgb(var(--v-theme-surface));
}

.deal-stage-section {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding-block-end: 1rem;
}

.deal-stage-section__heading,
.activity-entry__header,
.activity-collaborators,
.activity-progress__label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.deal-stage-section__heading,
.activity-entry__header,
.activity-progress__label {
  justify-content: space-between;
}

.deal-stage-section__title,
.activity-entry__title {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-weight: 500;
}

.deal-stage-section__meta,
.activity-entry__meta,
.activity-entry__time,
.activity-entry__body,
.activity-overview-grid span,
.activity-count-grid span,
.activity-collaborators > span,
.activity-progress__label span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.activity-entry {
  border-radius: 8px;
}

.activity-entry--note {
  border-inline-start: 3px solid rgb(var(--v-theme-secondary));
}

.activity-entry--duration {
  background-color: rgba(var(--v-theme-surface), 0.72);
}

.activity-entry__body {
  margin-block-start: 0.5rem;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.activity-overview-grid,
.activity-count-grid {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.activity-count-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.activity-overview-grid > div,
.activity-count-grid > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.activity-stage-mini {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.activity-stage-mini__step {
  display: flex;
  min-inline-size: 0;
  align-items: center;
  gap: 0.375rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.activity-stage-mini__step--active {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.activity-stage-mini__dot {
  display: inline-block;
  flex: 0 0 auto;
  border-radius: 50%;
  block-size: 0.5rem;
  inline-size: 0.5rem;
}

@media (max-width: 959px) {
  .activity-card {
    block-size: auto;
    min-block-size: 36rem;
  }

  .activity-stage-filter {
    justify-content: flex-start;
    margin-block-start: 0.75rem;
  }

  .activity-overview-grid,
  .activity-count-grid,
  .activity-stage-mini {
    grid-template-columns: 1fr;
  }

  .deal-stage-section__heading,
  .activity-entry__header,
  .activity-progress__label {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
