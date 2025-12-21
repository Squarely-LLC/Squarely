<script setup lang="ts">
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useSiteSurveys } from "@/stores/siteSurveys";
import { useSnaglists } from "@/stores/snaglists";
import { useTodos } from "@/stores/todos";
import { computed } from "vue";

const props = defineProps<{ jobId: number | string }>();

const jobsStore = useJobsStore();
const todosStore = useTodos();
jobsStore.init();
todosStore.init();
const siteSurveysStore = useSiteSurveys();
siteSurveysStore.init();
const snaglistsStore = useSnaglists();
snaglistsStore.init();

const job = computed(() => jobsStore.byId(props.jobId));

const docsList = computed<JobDocument[]>(() => {
  const fromStore = job.value;
  const docs = fromStore?.documents ?? [];
  return (Array.isArray(docs) ? docs.slice().reverse() : []).slice();
});

const hasMeetings = computed(() => (jobMeetings.value?.length || 0) > 0);
const hasSurveys = computed(() => (jobSiteSurveys.value?.length || 0) > 0);
const hasSnags = computed(() => (jobSnaglists.value?.length || 0) > 0);

// Meetings linked to this job (relatedTo.id = jobId)
const jobMeetings = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);
  return (todosStore.meetings || []).filter((m: any) => {
    const relatedMatch =
      m?.relatedTo &&
      String(m.relatedTo.id) === jobIdStr &&
      (m.relatedTo.type ? m.relatedTo.type === "job" : true);
    return relatedMatch;
  });
});

// Site surveys linked to this job (relatedTo.id = jobId)
const jobSiteSurveys = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);
  return (siteSurveysStore.all || []).filter((s: any) => {
    const relatedMatch =
      s?.relatedTo &&
      String(s.relatedTo.id) === jobIdStr &&
      (s.relatedTo.type ? s.relatedTo.type === "job" : true);
    return relatedMatch;
  });
});

// Snaglists linked to this job (relatedTo.id = jobId)
const jobSnaglists = computed(() => {
  const id = props.jobId;
  if (!id) return [] as any[];
  const jobIdStr = String(id);
  return (snaglistsStore.all || []).filter((s: any) => {
    const relatedMatch =
      s?.relatedTo &&
      String(s.relatedTo.id) === jobIdStr &&
      (s.relatedTo.type ? s.relatedTo.type === "job" : true);
    return relatedMatch;
  });
});

function formatDuration(mins?: number) {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function linkedParticipants(meeting: any) {
  if (!meeting || !Array.isArray(meeting.linkedTo)) return [];
  return meeting.linkedTo.filter((l: any) => l?.type !== "job");
}

const emit = defineEmits<{
  "open-add-meeting": [];
  "open-add-survey": [];
  "open-add-snag": [];
}>();

function openAdd() {
  emit("open-add-meeting");
}

function openAddSurvey() {
  emit("open-add-survey");
}

function openAddSnag() {
  emit("open-add-snag");
}
</script>

<template>
  <VRow>
    <!-- Three Cards Section -->
    <VCol cols="12">
      <VCard
        title="Minutes of Meetings"
        :class="hasMeetings ? 'meeting-card' : ''"
      >
        <template #append>
          <VBtn variant="text" color="primary" @click="openAdd">
            + Meeting
          </VBtn>
        </template>
        <VCardText :class="hasMeetings ? 'meeting-card__body' : ''">
          <template v-if="jobMeetings.length === 0">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No meetings yet</div>
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
                v-for="meeting in jobMeetings.slice(0, 7)"
                :key="meeting.id"
                dot-color="success"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{
                      meeting.subject || "Meeting"
                    }}</span>
                  </div>
                  <span class="app-timeline-meta">{{
                    meeting.startAt
                      ? new Date(meeting.startAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""
                  }}</span>
                </div>
                <div v-if="meeting.agenda" class="app-timeline-text mt-1">
                  {{ meeting.agenda }}
                </div>
                <div class="mt-2">
                  <div
                    v-if="meeting.duration"
                    class="d-flex gap-3 align-center flex-wrap mb-2"
                  >
                    <div class="text-sm text-medium-emphasis">
                      <VIcon icon="tabler-stopwatch" size="16" />
                      {{ formatDuration(meeting.duration) }}
                    </div>
                  </div>

                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in linkedParticipants(meeting).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32" color="primary">
                            <VImg v-if="l.avatarUrl" :src="l.avatarUrl" />
                            <span v-else class="text-xs font-weight-medium">{{
                              (l.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "?"
                            }}</span>
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="linkedParticipants(meeting).length > 4"
                      :size="32"
                      color="secondary"
                    >
                      +{{ linkedParticipants(meeting).length - 4 }}
                    </VAvatar>
                  </div>
                </div>
              </VTimelineItem>
            </VTimeline>
          </template>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard title="Site Surveys" :class="hasSurveys ? 'meeting-card' : ''">
        <template #append>
          <VBtn variant="text" color="primary" @click="openAddSurvey">
            + Survey
          </VBtn>
        </template>
        <VCardText :class="hasSurveys ? 'meeting-card__body' : ''">
          <template v-if="jobSiteSurveys.length === 0">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No surveys yet</div>
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
                v-for="survey in jobSiteSurveys.slice(0, 7)"
                :key="survey.id"
                dot-color="primary"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{
                      survey.subject || "Site Survey"
                    }}</span>
                  </div>
                  <span class="app-timeline-meta">{{
                    survey.startAt
                      ? new Date(survey.startAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""
                  }}</span>
                </div>
                <div v-if="survey.note" class="app-timeline-text mt-1">
                  {{ survey.note }}
                </div>
                <div class="mt-2">
                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in linkedParticipants(survey).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32" color="primary">
                            <VImg v-if="l.avatarUrl" :src="l.avatarUrl" />
                            <span v-else class="text-xs font-weight-medium">{{
                              (l.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "?"
                            }}</span>
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="linkedParticipants(survey).length > 4"
                      :size="32"
                      color="warning"
                    >
                      +{{ linkedParticipants(survey).length - 4 }}
                    </VAvatar>
                  </div>
                </div>
              </VTimelineItem>
            </VTimeline>
          </template>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard title="Snaglists">
        <template #append>
          <VBtn variant="text" color="primary" @click="openAddSnag">
            + Snag
          </VBtn>
        </template>
        <VCardText :class="hasSnags ? 'meeting-card__body' : ''">
          <template v-if="jobSnaglists.length === 0">
            <div class="d-flex justify-center align-center pa-6">
              <div class="text-subtitle-1">No snaglists yet</div>
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
                v-for="snag in jobSnaglists.slice(0, 7)"
                :key="snag.id"
                dot-color="info"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{
                      snag.subject || "Snaglist"
                    }}</span>
                  </div>
                  <span class="app-timeline-meta">{{
                    snag.startAt
                      ? new Date(snag.startAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""
                  }}</span>
                </div>
                <div v-if="snag.note" class="app-timeline-text mt-1">
                  {{ snag.note }}
                </div>
                <div class="mt-2">
                  <div class="v-avatar-group demo-avatar-group">
                    <template
                      v-for="(l, i) in linkedParticipants(snag).slice(0, 4)"
                      :key="l.id || i"
                    >
                      <VTooltip location="top">
                        <template #activator="{ props }">
                          <VAvatar v-bind="props" :size="32" color="primary">
                            <VImg v-if="l.avatarUrl" :src="l.avatarUrl" />
                            <span v-else class="text-xs font-weight-medium">{{
                              (l.name?.match(/\b\w/g) || [])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase() || "?"
                            }}</span>
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="linkedParticipants(snag).length > 4"
                      :size="32"
                      color="info"
                    >
                      +{{ linkedParticipants(snag).length - 4 }}
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

<style lang="scss" scoped>
.timeline-chip {
  margin-inline-start: 0.5rem;
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

.meeting-card {
  display: flex;
  flex-direction: column;
  max-block-size: 30rem;
}

.meeting-card__body {
  overflow: auto;
  flex: 1 1 auto;
  min-block-size: 0;
  padding-inline-end: 0.5rem;
  scrollbar-color: rgba(0 0 0 / 12%) transparent;
  scrollbar-width: thin;
}

.meeting-card__body::-webkit-scrollbar {
  block-size: 10px;
  inline-size: 10px;
}

.meeting-card__body::-webkit-scrollbar-track {
  background: transparent;
}

.meeting-card__body::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
  background-color: rgba(0 0 0 / 12%);
}

.meeting-card__body::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0 0 0 / 18%);
}

.meeting-card__body .v-timeline {
  min-block-size: 0;
}
</style>
