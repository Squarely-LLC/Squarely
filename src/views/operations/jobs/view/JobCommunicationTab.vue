<script setup lang="ts">
import { formatSystemDate } from "@core/utils/formatters";
import { useJobsStore } from "@/stores/jobs";
import { useSiteSurveys } from "@/stores/siteSurveys";
import { useSnaglists } from "@/stores/snaglists";
import { useTodos } from "@/stores/todos";
import { computed } from "vue";
import { useRouter } from "vue-router";

const props = defineProps<{ jobId: number | string }>();

const emit = defineEmits<{
  "open-add-meeting": [];
  "open-add-survey": [];
  "open-add-snag": [];
}>();

type ActivityItem = {
  id: string;
  kind: "meeting" | "survey" | "snag";
  title: string;
  body: string;
  date?: string | null;
  duration?: number | null;
  meetingId?: number | string;
  linkedTo: any[];
};

const jobsStore = useJobsStore();
const todosStore = useTodos();
const router = useRouter();
const siteSurveysStore = useSiteSurveys();
const snaglistsStore = useSnaglists();

jobsStore.init();
todosStore.init();
siteSurveysStore.init();
snaglistsStore.init();

const job = computed(() => jobsStore.byId(props.jobId));

const jobMeetings = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);

  return (todosStore.meetings || []).filter((meeting: any) => {
    const relatedMatch =
      meeting?.relatedTo &&
      String(meeting.relatedTo.id) === jobIdStr &&
      (meeting.relatedTo.type ? meeting.relatedTo.type === "job" : true);

    return relatedMatch;
  });
});

const jobSiteSurveys = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);

  return (siteSurveysStore.all || []).filter((survey: any) => {
    const relatedMatch =
      survey?.relatedTo &&
      String(survey.relatedTo.id) === jobIdStr &&
      (survey.relatedTo.type ? survey.relatedTo.type === "job" : true);

    return relatedMatch;
  });
});

const jobSnaglists = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);

  return (snaglistsStore.all || []).filter((snag: any) => {
    const relatedMatch =
      snag?.relatedTo &&
      String(snag.relatedTo.id) === jobIdStr &&
      (snag.relatedTo.type ? snag.relatedTo.type === "job" : true);

    return relatedMatch;
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

  return item.linkedTo.filter((linked: any) => linked?.type !== "job");
}

function labelColorName(kind: string) {
  if (kind === "meeting") return "success";
  if (kind === "survey") return "primary";
  return "info";
}

function labelText(kind: string) {
  if (kind === "meeting") return "Meeting";
  if (kind === "survey") return "Survey";
  return "Snaglist";
}

const communicationActivities = computed<ActivityItem[]>(() => {
  const meetings: ActivityItem[] = jobMeetings.value.map((meeting: any) => ({
    id: `meeting-${meeting.id}`,
    kind: "meeting",
    title: meeting.subject || "Meeting",
    body: meeting.agenda || meeting.note || "",
    date: meeting.startAt || meeting.createdAt,
    duration: meeting.duration,
    meetingId: meeting.id,
    linkedTo: linkedParticipants(meeting),
  }));

  const surveys: ActivityItem[] = jobSiteSurveys.value.map((survey: any) => ({
    id: `survey-${survey.id}`,
    kind: "survey",
    title: survey.subject || "Site Survey",
    body: survey.note || "",
    date: survey.startAt || survey.createdAt,
    duration: survey.duration,
    linkedTo: linkedParticipants(survey),
  }));

  const snags: ActivityItem[] = jobSnaglists.value.map((snag: any) => ({
    id: `snag-${snag.id}`,
    kind: "snag",
    title: snag.subject || "Snaglist",
    body: snag.note || "",
    date: snag.startAt || snag.createdAt,
    duration: snag.duration,
    linkedTo: linkedParticipants(snag),
  }));

  return [...meetings, ...surveys, ...snags].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;

    return bTime - aTime;
  });
});

const hasAnyActivities = computed(
  () => communicationActivities.value.length > 0,
);

function openAddMeeting() {
  emit("open-add-meeting");
}

function openAddSurvey() {
  emit("open-add-survey");
}

function openAddSnag() {
  emit("open-add-snag");
}

function openActivity(activity: any) {
  if (activity?.kind === "meeting" && activity.meetingId) {
    router.push({
      name: "apps-meetings-id-minutes",
      params: { id: activity.meetingId },
    });
  }
}
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard
        :title="`${job?.name || 'Job'} Communication Timeline`"
        :class="hasAnyActivities ? 'activity-card' : ''"
      >
        <template #append>
          <VBtn icon variant="text" color="primary">
            <VIcon icon="tabler-plus" />
            <VTooltip activator="parent" location="top">Add</VTooltip>
            <VMenu activator="parent">
              <VList>
                <VListItem @click="openAddMeeting">
                  <template #prepend>
                    <VIcon icon="tabler-calendar-plus" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>
                <VListItem @click="openAddSurvey">
                  <template #prepend>
                    <VIcon icon="tabler-clipboard-text" />
                  </template>
                  <VListItemTitle>Survey</VListItemTitle>
                </VListItem>
                <VListItem @click="openAddSnag">
                  <template #prepend>
                    <VIcon icon="tabler-list-details" />
                  </template>
                  <VListItemTitle>Snaglist</VListItemTitle>
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
                :dot-color="labelColorName(activity.kind)"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div
                    class="d-flex align-center"
                    :class="activity.meetingId ? 'activity-clickable' : ''"
                    @click="openActivity(activity)"
                  >
                    <span class="app-timeline-title">{{ activity.title }}</span>
                    <VChip
                      size="small"
                      class="timeline-chip"
                      :color="labelColorName(activity.kind)"
                      density="compact"
                    >
                      {{ labelText(activity.kind) }}
                    </VChip>
                  </div>

                  <span class="app-timeline-meta">{{
                    timeAgo(activity.date)
                  }}</span>
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

.activity-clickable {
  cursor: pointer;
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
