<script setup lang="ts">
import { formatSystemDate } from "@core/utils/formatters";
import { useTodos } from "@/stores/todos";
import { computed } from "vue";

const props = defineProps<{ dealId: number | string; dealCode: string }>();

const emit = defineEmits<{
  "open-add-task": [];
  "open-add-email": [];
  "open-add-meeting": [];
  "open-add-call": [];
}>();

const todosStore = useTodos();

todosStore.init();

const EMAIL_THREAD_NOTE = "__deal_email_thread__";

const dealTodos = computed(() => {
  const id = props.dealId;
  if (!id) return [] as any[];
  const dealIdStr = String(id);

  return (todosStore.items || []).filter((todo: any) => {
    const relatedMatch =
      todo?.relatedTo &&
      String(todo.relatedTo.id) === dealIdStr &&
      (todo.relatedTo.type ? todo.relatedTo.type === "deal" : true);

    return relatedMatch;
  });
});

const dealTaskTodos = computed(() =>
  dealTodos.value.filter((todo: any) => todo?.notes !== EMAIL_THREAD_NOTE),
);

const dealMeetings = computed(() => {
  const id = props.dealId;
  if (!id) return [] as any[];
  const dealIdStr = String(id);

  return (todosStore.meetings || []).filter((meeting: any) => {
    const relatedMatch =
      meeting?.relatedTo &&
      String(meeting.relatedTo.id) === dealIdStr &&
      (meeting.relatedTo.type ? meeting.relatedTo.type === "deal" : true);

    return relatedMatch;
  });
});

function timeAgo(iso?: string) {
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
    return iso;
  }
}

function formatDuration(mins?: number) {
  if (!mins && mins !== 0) return "";

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return h ? `${h}h ${m}m` : `${m}m`;
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

function labelColorName(kind: string, rawType?: string) {
  if (kind === "task") return "warning";
  if (kind === "email") return "primary";
  if (kind === "call") return "info";
  if (rawType === "Sales") return "success";
  return "success";
}

function labelText(kind: string) {
  if (kind === "task") return "Task";
  if (kind === "email") return "Email";
  if (kind === "call") return "Call";
  return "Meeting";
}

const communicationActivities = computed(() => {
  const tasks = dealTaskTodos.value.map((todo: any) => ({
    id: `task-${todo.id}`,
    kind: "task",
    title: todo.title || "Task",
    body: todo.notes || "",
    date: todo.updatedAt || todo.createdAt || todo.dueAt,
    meta: taskStatusLabel(todo.status),
    linkedTo: todo.collaborators || [],
  }));

  const emails = dealTodos.value.flatMap((todo: any) =>
    Array.isArray(todo.messages)
      ? todo.messages.map((message: any, index: number) => ({
          id: `email-${todo.id}-${message.id ?? index}`,
          kind: "email",
          title: message.author?.name
            ? `Email from ${message.author.name}`
            : "Email",
          body: message.body || "",
          date: message.createdAt || todo.updatedAt || todo.createdAt,
          meta: todo.title || "Email thread",
          linkedTo: todo.collaborators || [],
        }))
      : [],
  );

  const meetings = dealMeetings.value.map((meeting: any) => {
    const isCall =
      meeting?.type === "Brief" ||
      String(meeting?.location || "").toLowerCase().includes("phone");

    return {
      id: `${isCall ? "call" : "meeting"}-${meeting.id}`,
      kind: isCall ? "call" : "meeting",
      title: meeting.subject || (isCall ? "Call" : "Meeting"),
      body: meeting.agenda || meeting.note || "",
      date: meeting.startAt || meeting.createdAt,
      duration: meeting.duration,
      rawType: meeting.type,
      linkedTo: linkedParticipants(meeting),
    };
  });

  return [...tasks, ...emails, ...meetings].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;

    return bTime - aTime;
  });
});

const hasAnyActivities = computed(
  () => communicationActivities.value.length > 0,
);

function openAddTask() {
  emit("open-add-task");
}

function openAddEmail() {
  emit("open-add-email");
}

function openAddMeeting() {
  emit("open-add-meeting");
}

function openAddCall() {
  emit("open-add-call");
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard
        :title="`${dealCode || 'Deal'} Communication Timeline`"
        :class="hasAnyActivities ? 'activity-card' : ''"
      >
        <template #append>
          <VBtn icon variant="text" color="primary">
            <VIcon icon="tabler-plus" />
            <VTooltip activator="parent" location="top">Add</VTooltip>
            <VMenu activator="parent">
              <VList>
                <VListItem @click="openAddTask">
                  <template #prepend>
                    <VIcon icon="tabler-checkbox" />
                  </template>
                  <VListItemTitle>Task</VListItemTitle>
                </VListItem>
                <VListItem @click="openAddEmail">
                  <template #prepend>
                    <VIcon icon="tabler-mail" />
                  </template>
                  <VListItemTitle>Email</VListItemTitle>
                </VListItem>
                <VListItem @click="openAddMeeting">
                  <template #prepend>
                    <VIcon icon="tabler-calendar-plus" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>
                <VListItem @click="openAddCall">
                  <template #prepend>
                    <VIcon icon="tabler-phone-call" />
                  </template>
                  <VListItemTitle>Call</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <VCardText :class="hasAnyActivities ? 'activity-card__body' : ''">
          <template v-if="!hasAnyActivities">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No communication activity yet</div>
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
                v-for="activity in communicationActivities"
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

                  <span class="app-timeline-meta">{{
                    timeAgo(activity.date)
                  }}</span>
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
                            <VImg v-if="linked.avatarUrl" :src="linked.avatarUrl" />
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
</style>
