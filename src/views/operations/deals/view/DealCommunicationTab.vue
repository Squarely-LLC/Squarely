<script setup lang="ts">
import type { ContactRef } from "@/data/schema";
import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { useTodos } from "@/stores/todos";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

type StageKey = "created" | "negotation" | "active" | "canceled" | "lost";

type ActivityItem = {
  id: string;
  kind:
    | "task"
    | "email"
    | "meeting"
    | "call"
    | "deal"
    | "delivery"
    | "item"
    | "document"
    | "financial"
    | "note";
  title: string;
  body: string;
  date: string | null | undefined;
  meta?: string;
  stage: StageKey;
  duration?: number | null;
  meetingId?: number | string;
  rawType?: string;
  linkedTo: ContactRef[];
};

const props = defineProps<{
  deal: DealProperties;
  collaborators?: ContactRef[];
  hideFinancials?: boolean;
}>();

const todosStore = useTodos();
const router = useRouter();
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

function stageColor(stage: StageKey) {
  return timelineStageOptions.find((option) => option.key === stage)?.color || "primary";
}

function stageIcon(stage: StageKey) {
  if (stage === "created") return "tabler-circle-plus";
  if (stage === "negotation") return "tabler-messages";
  if (stage === "active") return "tabler-trophy";
  if (stage === "canceled") return "tabler-ban";
  if (stage === "lost") return "tabler-circle-x";

  return "tabler-point";
}

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

function formatDisplayDate(value?: string | null) {
  if (!value) return "--";

  try {
    return formatSystemDate(new Date(value).getTime());
  } catch {
    return value;
  }
}

function timeAgo(iso?: string | null) {
  if (!iso) return "";

  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = now - then;
    const absMins = Math.round(Math.abs(diff) / 60000);

    if (diff >= 0) {
      if (absMins < 1) return "just now";
      if (absMins < 60) return `${absMins} min${absMins > 1 ? "s" : ""} ago`;

      const hours = Math.round(absMins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

      const days = Math.round(hours / 24);
      if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

      return formatDisplayDate(iso);
    }

    if (absMins < 60) return `in ${absMins} min${absMins > 1 ? "s" : ""}`;

    const hours = Math.round(absMins / 60);
    if (hours < 24) return `in ${hours} hour${hours > 1 ? "s" : ""}`;

    const days = Math.round(hours / 24);
    if (days < 7) return `in ${days} day${days > 1 ? "s" : ""}`;

    return `on ${formatDisplayDate(iso)}`;
  } catch {
    return String(iso);
  }
}

function formatDuration(mins?: number | null) {
  if (!mins && mins !== 0) return "";

  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function linkedParticipants(item: any): ContactRef[] {
  if (!item || !Array.isArray(item.linkedTo)) return [];

  return item.linkedTo.filter((linked: any) => linked?.type !== "deal");
}

function taskStatusLabel(status?: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "for_review") return "For Review";
  if (status === "completed") return "Completed";

  return "Pending";
}

function labelColorName(kind: ActivityItem["kind"], rawType?: string) {
  if (kind === "task") return "warning";
  if (kind === "email") return "primary";
  if (kind === "call") return "info";
  if (kind === "deal") return "primary";
  if (kind === "delivery") return "info";
  if (kind === "item") return "success";
  if (kind === "document") return "secondary";
  if (kind === "financial") return "warning";
  if (kind === "note") return "secondary";
  if (rawType === "Sales") return "success";

  return "success";
}

function labelText(kind: ActivityItem["kind"]) {
  if (kind === "task") return "Task";
  if (kind === "email") return "Email";
  if (kind === "call") return "Call";
  if (kind === "deal") return "Deal";
  if (kind === "delivery") return "Delivery";
  if (kind === "item") return "Item";
  if (kind === "document") return "Document";
  if (kind === "financial") return "Financial";
  if (kind === "note") return "Note";

  return "Meeting";
}

function activityStage(value?: string | null) {
  return normalizeStageBucket(value || props.deal.stage);
}

const noteActivities = computed<ActivityItem[]>(() =>
  (props.deal.notes || []).map((note) => ({
    id: `note-${note.id}`,
    kind: "note",
    title: note.authorName || "Note",
    body: note.body || "",
    date: note.createdAt || null,
    meta: stageLabel(normalizeStageBucket(note.stage || props.deal.stage)),
    stage: normalizeStageBucket(note.stage || props.deal.stage),
    linkedTo: [],
  })),
);

const communicationActivities = computed<ActivityItem[]>(() => {
  const stage = currentStage.value;
  const tasks: ActivityItem[] = dealTaskTodos.value.map((todo: any) => ({
    id: `task-${todo.id}`,
    kind: "task",
    title: todo.title || "Task",
    body: todo.notes || "",
    date: todo.updatedAt || todo.createdAt || todo.dueAt || null,
    meta: taskStatusLabel(todo.status),
    stage,
    linkedTo: Array.isArray(todo.collaborators) ? todo.collaborators : [],
  }));

  const emails: ActivityItem[] = dealTodos.value.flatMap((todo: any) =>
    Array.isArray(todo.messages)
      ? todo.messages.map((message: any, index: number) => ({
          id: `email-${todo.id}-${message.id ?? index}`,
          kind: "email" as const,
          title: message.author?.name
            ? `Email from ${message.author.name}`
            : "Email",
          body: message.body || "",
          date: message.createdAt || todo.updatedAt || todo.createdAt || null,
          meta: todo.title || "Email thread",
          stage,
          linkedTo: Array.isArray(todo.collaborators) ? todo.collaborators : [],
        }))
      : [],
  );

  const meetings: ActivityItem[] = dealMeetings.value.map((meeting: any) => {
    const isCall =
      meeting?.type === "Brief" ||
      String(meeting?.location || "")
        .toLowerCase()
        .includes("phone");

    return {
      id: `${isCall ? "call" : "meeting"}-${meeting.id}`,
      kind: isCall ? "call" : "meeting",
      title: meeting.subject || (isCall ? "Call" : "Meeting"),
      body: meeting.agenda || meeting.note || "",
      date: meeting.startAt || meeting.createdAt || null,
      duration: meeting.duration,
      meetingId: meeting.id,
      rawType: meeting.type,
      stage,
      linkedTo: linkedParticipants(meeting),
    };
  });

  return [...tasks, ...emails, ...meetings];
});

const timelineActivities = computed<ActivityItem[]>(() => {
  const dealReference = props.deal.code || `Deal #${props.deal.id}`;

  return [
    {
      id: `deal-${props.deal.id}`,
      kind: "deal",
      title: "Deal created",
      body: dealReference,
      date: props.deal.createdAt || null,
      meta: props.deal.stage || "",
      stage: "created" as const,
      linkedTo: [],
    },
    ...(props.deal.estimatedDeliveryDate
      ? [
          {
            id: `delivery-${props.deal.id}`,
            kind: "delivery" as const,
            title: "Expected close date",
            body: props.deal.estimatedDeliveryDate,
            date: props.deal.estimatedDeliveryDate,
            meta: "Delivery target",
            stage: currentStage.value,
            linkedTo: [],
          },
        ]
      : []),
    ...(props.deal.items || []).map((item) => ({
      id: `item-${item.id}`,
      kind: "item" as const,
      title: `Item added: ${item.name}`,
      body: (item as any).note || "",
      date: (item as any).createdAt || props.deal.createdAt || null,
      meta: item.status || item.catalogueType || "",
      stage: activityStage(item.status || item.catalogueType),
      linkedTo: [],
    })),
    ...(props.deal.documents || []).map((document) => ({
      id: `document-${document.id}`,
      kind: "document" as const,
      title: `Document linked: ${document.name}`,
      body: document.note || "",
      date: document.createdAt || props.deal.createdAt || null,
      meta: document.type || "",
      stage: activityStage((document as any).status || document.type),
      linkedTo: [],
    })),
    ...(props.deal.financials || []).map((entry) => ({
      id: `financial-${entry.id}`,
      kind: "financial" as const,
      title: entry.title || "Financial entry",
      body: (entry as any).note || "",
      date: entry.createdAt || null,
      meta: props.hideFinancials
        ? `${entry.type} - Hidden`
        : `${entry.type} - ${Number(entry.amount || 0).toLocaleString()}`,
      stage: activityStage(entry.status || entry.type),
      linkedTo: [],
    })),
  ];
});

const allActivities = computed(() =>
  [
    ...timelineActivities.value,
    ...communicationActivities.value,
    ...noteActivities.value,
  ].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;

    return bTime - aTime;
  }),
);

const preSaleSummary = computed(() => {
  const calls = communicationActivities.value.filter(
    (activity) => activity.kind === "call",
  );
  const meetings = communicationActivities.value.filter(
    (activity) => activity.kind === "meeting",
  );

  return {
    tasks: dealTaskTodos.value,
    calls,
    meetings,
  };
});

const visibleStageSections = computed(() =>
  timelineStageOptions
    .filter((stage) => stageFilter.value === "all" || stage.key === stageFilter.value)
    .map((stage) => ({
      ...stage,
      activities: allActivities.value.filter((activity) => activity.stage === stage.key),
    })),
);

const hasAnyActivities = computed(
  () =>
    allActivities.value.length > 0 ||
    Boolean(props.deal.createdAt) ||
    Boolean((props.collaborators || []).length),
);

function activityTimeLabel(date?: string | null) {
  return timeAgo(date);
}

function activityDateTooltip(date?: string | null) {
  return formatDisplayDate(date);
}

function openActivity(activity: ActivityItem) {
  if ((activity.kind === "meeting" || activity.kind === "call") && activity.meetingId) {
    router.push({
      name: "apps-meetings-id-minutes",
      params: { id: activity.meetingId },
    });
  }
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
</script>

<template>
  <VCard class="activity-card">
    <VCardItem>
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
      <template v-if="!hasAnyActivities">
        <div class="activity-empty">
          <VIcon icon="tabler-timeline" size="36" class="mb-2" />
          <div class="text-subtitle-1">No activity yet</div>
        </div>
      </template>

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
                  {{ stage.activities.length }} timeline item{{ stage.activities.length === 1 ? "" : "s" }}
                </div>
              </div>
              <VChip size="small" :color="stage.color" label>
                {{ stage.label }}
              </VChip>
            </div>

            <VCard
              v-if="stage.key === 'created'"
              variant="tonal"
              class="activity-entry activity-entry--overview"
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
                    <strong>{{ preSaleSummary.tasks.length }}</strong>
                  </div>
                  <div>
                    <span>Calls</span>
                    <strong>{{ preSaleSummary.calls.length }}</strong>
                  </div>
                  <div>
                    <span>Meetings</span>
                    <strong>{{ preSaleSummary.meetings.length }}</strong>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <VCard
              v-for="activity in stage.activities"
              :key="activity.id"
              variant="tonal"
              class="activity-entry"
              :class="activity.kind === 'note' ? 'activity-entry--note' : ''"
            >
              <VCardText>
                <div class="activity-entry__header">
                  <div
                    class="activity-entry__main"
                    :class="activity.meetingId ? 'activity-clickable' : ''"
                    @click="openActivity(activity)"
                  >
                    <div class="activity-entry__title">{{ activity.title }}</div>
                    <VChip
                      size="small"
                      class="timeline-chip"
                      :color="labelColorName(activity.kind, activity.rawType)"
                      density="compact"
                    >
                      {{ labelText(activity.kind) }}
                    </VChip>
                  </div>

                  <VTooltip
                    v-if="activity.date"
                    :text="activityDateTooltip(activity.date)"
                    location="top"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <span v-bind="tooltipProps" class="activity-entry__time">
                        {{ activityTimeLabel(activity.date) }}
                      </span>
                    </template>
                  </VTooltip>
                </div>

                <div v-if="activity.meta" class="activity-entry__meta">
                  {{ activity.meta }}
                </div>

                <div v-if="activity.body" class="activity-entry__body">
                  {{ activity.body }}
                </div>

                <div
                  v-if="activity.duration || activity.linkedTo.length"
                  class="activity-entry__footer"
                >
                  <div v-if="activity.duration" class="activity-entry__meta">
                    <VIcon icon="tabler-stopwatch" size="16" class="me-1" />
                    {{ formatDuration(activity.duration) }}
                  </div>

                  <div v-if="activity.linkedTo.length" class="v-avatar-group">
                    <VTooltip
                      v-for="(linked, index) in activity.linkedTo.slice(0, 4)"
                      :key="linked.id || index"
                      :text="linked.name"
                      location="top"
                    >
                      <template #activator="{ props: tooltipProps }">
                        <VAvatar v-bind="tooltipProps" :size="30" color="primary">
                          <VImg v-if="linked.avatarUrl" :src="linked.avatarUrl" />
                          <span v-else class="text-xs font-weight-medium">
                            {{ initials(linked.name) }}
                          </span>
                        </VAvatar>
                      </template>
                    </VTooltip>
                    <VAvatar
                      v-if="activity.linkedTo.length > 4"
                      :size="30"
                      color="secondary"
                    >
                      +{{ activity.linkedTo.length - 4 }}
                    </VAvatar>
                  </div>
                </div>
              </VCardText>
            </VCard>

            <div
              v-if="
                !stage.activities.length &&
                stage.key !== 'created'
              "
              class="activity-stage-section__empty"
            >
              No activity in this stage yet.
            </div>
          </div>
        </VTimelineItem>
      </VTimeline>
    </VCardText>
  </VCard>
</template>

<style scoped>
.activity-card {
  display: flex;
  flex-direction: column;
  block-size: 39rem;
}

.activity-stage-filter {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-inline-size: 100%;
}

.activity-card__body {
  overflow: auto;
  flex: 1 1 auto;
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

.activity-empty {
  display: flex;
  min-block-size: 18rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
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
.activity-entry__main,
.activity-entry__footer,
.activity-collaborators {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.deal-stage-section__heading,
.activity-entry__header {
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
.activity-stage-section__empty,
.activity-entry__body,
.activity-overview-grid span,
.activity-count-grid span,
.activity-collaborators > span {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.activity-entry {
  border-radius: 8px;
}

.activity-entry--note {
  border-inline-start: 3px solid rgb(var(--v-theme-secondary));
}

.activity-entry__body {
  margin-block-start: 0.5rem;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.activity-entry__footer {
  justify-content: space-between;
  margin-block-start: 0.75rem;
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

.activity-clickable {
  cursor: pointer;
}

.timeline-chip {
  flex: 0 0 auto;
}

@media (max-width: 959px) {
  .activity-card {
    block-size: auto;
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
  .activity-entry__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
