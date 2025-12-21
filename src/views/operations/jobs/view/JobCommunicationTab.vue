<script setup lang="ts">
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useJobsStore } from "@/stores/jobs";
import { useTodos } from "@/stores/todos";
import { computed } from "vue";

const props = defineProps<{ jobId: number | string }>();

const jobsStore = useJobsStore();
const todosStore = useTodos();
jobsStore.init();
todosStore.init();

const job = computed(() => jobsStore.byId(props.jobId));

const docsList = computed<JobDocument[]>(() => {
  const fromStore = job.value;
  const docs = fromStore?.documents ?? [];
  return (Array.isArray(docs) ? docs.slice().reverse() : []).slice();
});

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
}>();

function openAdd() {
  emit("open-add-meeting");
}
</script>

<template>
  <VRow>
    <!-- Three Cards Section -->
    <VCol cols="12">
      <VCard title="Min. of Meetings">
        <template #append>
          <VBtn variant="text" size="small" color="primary" @click="openAdd">
            Add Meeting
          </VBtn>
        </template>
        <VCardText>
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
                          <VAvatar v-bind="props" :size="32">
                            <VImg v-if="l.avatarUrl" :src="l.avatarUrl" />
                            <span v-else class="text-xs">{{
                              l.name?.charAt(0) || "?"
                            }}</span>
                          </VAvatar>
                        </template>
                        {{ l.name }}
                      </VTooltip>
                    </template>
                    <VAvatar
                      v-if="linkedParticipants(meeting).length > 4"
                      :size="32"
                      :color="
                        $vuetify.theme.current.dark ? '#373b50' : '#eeedf0'
                      "
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
      <VCard title="Site Surveys">
        <template #append>
          <VBtn variant="text" size="small" color="primary" @click="openAdd">
            Add Survey
          </VBtn>
        </template>
        <VCardText>
          <template
            v-if="
              docsList.filter(
                (d) => d.type === 'Drawings' || d.type === 'Specifications'
              ).length === 0
            "
          >
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
                v-for="doc in docsList
                  .filter(
                    (d) => d.type === 'Drawings' || d.type === 'Specifications'
                  )
                  .slice(0, 7)"
                :key="doc.id"
                dot-color="primary"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{ doc.name }}</span>
                    <VChip
                      size="small"
                      class="timeline-chip"
                      color="primary"
                      text-color="on-primary"
                      density="compact"
                    >
                      {{ doc.type }}
                    </VChip>
                  </div>
                  <span class="app-timeline-meta">{{
                    doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""
                  }}</span>
                </div>
                <div v-if="doc.note" class="app-timeline-text mt-1">
                  {{ doc.note }}
                </div>
                <div class="mt-2">
                  <VAvatar size="32" color="warning">
                    <span class="text-xs">TS</span>
                  </VAvatar>
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
          <VBtn variant="text" size="small" color="primary" @click="openAdd">
            Add Snag
          </VBtn>
        </template>
        <VCardText>
          <template
            v-if="
              docsList.filter((d) => d.type === 'Reports' || d.type === 'SOPs')
                .length === 0
            "
          >
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
                v-for="doc in docsList
                  .filter((d) => d.type === 'Reports' || d.type === 'SOPs')
                  .slice(0, 7)"
                :key="doc.id"
                dot-color="info"
                size="x-small"
              >
                <div
                  class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2"
                >
                  <div class="d-flex align-center">
                    <span class="app-timeline-title">{{ doc.name }}</span>
                    <VChip
                      size="small"
                      class="timeline-chip"
                      color="info"
                      text-color="on-info"
                      density="compact"
                    >
                      {{ doc.type }}
                    </VChip>
                  </div>
                  <span class="app-timeline-meta">{{
                    doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""
                  }}</span>
                </div>
                <div v-if="doc.note" class="app-timeline-text mt-1">
                  {{ doc.note }}
                </div>
                <div class="mt-2">
                  <VAvatar size="32" color="info">
                    <span class="text-xs">TC</span>
                  </VAvatar>
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
</style>
