<script setup lang="ts">
import type { DealProperties } from "@/plugins/fake-api/handlers/operations/deals/types";
import { useTodos } from "@/stores/todos";
import { formatSystemDate } from "@core/utils/formatters";
import { computed, ref } from "vue";

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
    | "financial";
  title: string;
  body: string;
  date: string | null | undefined;
  meta?: string;
  duration?: number | null;
  rawType?: string;
  linkedTo: Array<{
    id?: number | string;
    name?: string;
    avatarUrl?: string | null;
    type?: string;
  }>;
};

const props = defineProps<{
  deal: DealProperties;
  hideFinancials?: boolean;
}>();

const todosStore = useTodos();
todosStore.init();

const EMAIL_THREAD_NOTE = "__deal_email_thread__";
const activityFilter = ref("");
const activityTypeFilter = ref<
  "all" | "updates" | "task" | "email" | "meeting" | "document" | "financial"
>("all");

const activityTypeOptions = [
  { title: "All", value: "all" },
  { title: "Updates", value: "updates" },
  { title: "Tasks", value: "task" },
  { title: "Emails", value: "email" },
  { title: "Meetings", value: "meeting" },
  { title: "Documents", value: "document" },
  { title: "Financials", value: "financial" },
] as const;

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

      return formatSystemDate(then);
    }

    if (absMins < 60) return `in ${absMins} min${absMins > 1 ? "s" : ""}`;

    const hours = Math.round(absMins / 60);
    if (hours < 24) return `in ${hours} hour${hours > 1 ? "s" : ""}`;

    const days = Math.round(hours / 24);
    if (days < 7) return `in ${days} day${days > 1 ? "s" : ""}`;

    return `on ${formatSystemDate(then)}`;
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

function linkedParticipants(item: any) {
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

  return "Meeting";
}

const communicationActivities = computed<ActivityItem[]>(() => {
  const tasks: ActivityItem[] = dealTaskTodos.value.map((todo: any) => ({
    id: `task-${todo.id}`,
    kind: "task",
    title: todo.title || "Task",
    body: todo.notes || "",
    date: todo.updatedAt || todo.createdAt || todo.dueAt || null,
    meta: taskStatusLabel(todo.status),
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
      rawType: meeting.type,
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
      linkedTo: [],
    },
    ...(props.deal.estimatedDeliveryDate
      ? [
          {
            id: `delivery-${props.deal.id}`,
            kind: "delivery" as const,
            title: "Estimated delivery date",
            body: props.deal.estimatedDeliveryDate,
            date: props.deal.estimatedDeliveryDate,
            meta: "Delivery target",
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
      linkedTo: [],
    })),
    ...(props.deal.documents || []).map((document) => ({
      id: `document-${document.id}`,
      kind: "document" as const,
      title: `Document linked: ${document.name}`,
      body: document.note || "",
      date: document.createdAt || props.deal.createdAt || null,
      meta: document.type || "",
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
      linkedTo: [],
    })),
  ];
});

const allActivities = computed(() => {
  return [...timelineActivities.value, ...communicationActivities.value].sort(
    (a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;

      return bTime - aTime;
    },
  );
});

const filteredActivities = computed(() => {
  const typeFilter = activityTypeFilter.value;
  const query = activityFilter.value.trim().toLowerCase();

  return allActivities.value.filter((activity) => {
    const matchesType =
      typeFilter === "all"
        ? true
        : typeFilter === "updates"
          ? ["deal", "delivery", "item"].includes(activity.kind)
          : typeFilter === "meeting"
            ? activity.kind === "meeting" || activity.kind === "call"
            : activity.kind === typeFilter;

    if (!matchesType) return false;
    if (!query) return true;

    const haystack = [
      activity.title,
      activity.body,
      activity.meta,
      labelText(activity.kind),
      ...activity.linkedTo.map((linked) => linked?.name || ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

const hasAnyActivities = computed(() => allActivities.value.length > 0);
const hasFilteredActivities = computed(
  () => filteredActivities.value.length > 0,
);

function activityTimeLabel(date?: string | null) {
  return timeAgo(date);
}

function activityDateTooltip(date?: string | null) {
  if (!date) return "";

  try {
    return formatSystemDate(new Date(date).getTime());
  } catch {
    return date;
  }
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard :class="hasAnyActivities ? 'activity-card' : ''">
        <VCardItem>
          <template #title>
            {{ `${deal.code || `Deal #${deal.id}`} Activity` }}
          </template>

          <template #append>
            <div class="activity-card__toolbar">
              <AppTextField
                v-model="activityFilter"
                class="activity-card__search"
                prepend-inner-icon="tabler-search"
                placeholder="Search activity"
                density="compact"
                hide-details
              />

              <AppSelect
                v-model="activityTypeFilter"
                class="activity-card__filter"
                :items="activityTypeOptions"
                item-title="title"
                item-value="value"
                density="compact"
                hide-details
              />
            </div>
          </template>
        </VCardItem>

        <VCardText :class="hasAnyActivities ? 'activity-card__body' : ''">
          <template v-if="!hasAnyActivities">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No activity yet</div>
            </div>
          </template>

          <template v-else-if="!hasFilteredActivities">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No matching activity found</div>
            </div>
          </template>

          <template v-else>
            <VTimeline
              side="end"
              align="start"
              line-inset="8"
              truncate-line="start"
              density="compact"
            >
              <VTimelineItem
                v-for="activity in filteredActivities"
                :key="activity.id"
                :dot-color="labelColorName(activity.kind, activity.rawType)"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{ activity.title }}</span>
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
                      <span v-bind="tooltipProps" class="app-timeline-meta">{{
                        activityTimeLabel(activity.date)
                      }}</span>
                    </template>
                  </VTooltip>
                </div>

                <div v-if="activity.meta" class="app-timeline-meta mb-1">
                  {{ activity.meta }}
                </div>

                <div v-if="activity.body" class="app-timeline-text mt-1">
                  {{ activity.body }}
                </div>

                <div
                  v-if="activity.duration || activity.linkedTo.length"
                  class="mt-2"
                >
                  <div
                    v-if="activity.duration"
                    class="d-flex gap-3 align-center flex-wrap mb-2"
                  >
                    <div class="text-sm text-medium-emphasis">
                      <VIcon icon="tabler-stopwatch" size="16" class="me-1" />
                      {{ formatDuration(activity.duration) }}
                    </div>
                  </div>

                  <div v-if="activity.linkedTo.length" class="v-avatar-group">
                    <template
                      v-for="(linked, index) in activity.linkedTo.slice(0, 4)"
                      :key="linked.id || index"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props: tooltipProps }">
                          <VAvatar
                            v-bind="tooltipProps"
                            :size="32"
                            color="primary"
                          >
                            <VImg
                              v-if="linked.avatarUrl"
                              :src="linked.avatarUrl"
                            />
                            <span v-else class="text-xs font-weight-medium">{{
                              (linked.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "?"
                            }}</span>
                          </VAvatar>
                        </template>
                        {{ linked.name }}
                      </VTooltip>
                    </template>

                    <VAvatar
                      v-if="activity.linkedTo.length > 4"
                      :size="32"
                      color="secondary"
                    >
                      +{{ activity.linkedTo.length - 4 }}
                    </VAvatar>
                  </div>
                </div>
              </VTimelineItem>
            </VTimeline>
          </template>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style scoped>
.activity-card {
  display: flex;
  flex-direction: column;
  block-size: 39rem;
}

.activity-card__toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  inline-size: min(100%, 34rem);
}

.activity-card__search {
  flex: 1 1 15rem;
  min-inline-size: 0;
}

.activity-card__filter {
  flex: 0 0 11rem;
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

.activity-card__body .v-timeline {
  min-block-size: 0;
}

.timeline-chip {
  margin-inline-start: 8px;
}

.app-timeline-title {
  font-weight: 500;
}

.app-timeline-meta {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
}

.app-timeline-text {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
}

@media (max-width: 959px) {
  .activity-card__toolbar {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .activity-card__search,
  .activity-card__filter {
    flex-basis: 100%;
  }
}
</style>
