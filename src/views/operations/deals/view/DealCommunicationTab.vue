<script setup lang="ts">
import { computed } from 'vue'

import { useTodos } from '@/stores/todos'

const props = defineProps<{
  dealId: number | string
  dealCode: string
}>()

const emit = defineEmits<{
  (e: 'open-add-meeting'): void
  (e: 'open-email'): void
}>()

const todosStore = useTodos()
todosStore.init()

const dealMeetings = computed(() => {
  const dealId = String(props.dealId)

  return (todosStore.meetings || [])
    .filter((meeting: any) =>
      meeting?.relatedTo
      && String(meeting.relatedTo.id) === dealId
      && (meeting.relatedTo.type ? meeting.relatedTo.type === 'deal' : true),
    )
    .sort((a: any, b: any) => {
      const aTime = a?.startAt ? new Date(a.startAt).getTime() : 0
      const bTime = b?.startAt ? new Date(b.startAt).getTime() : 0

      return bTime - aTime
    })
})

const timeAgo = (iso?: string) => {
  if (!iso)
    return ''

  try {
    const timestamp = new Date(iso).getTime()
    const diff = Date.now() - timestamp
    const hours = Math.round(diff / (1000 * 60 * 60))

    if (hours < 1)
      return 'just now'
    if (hours < 24)
      return `${hours}h ago`

    const days = Math.round(hours / 24)

    return `${days}d ago`
  }
  catch {
    return iso
  }
}
</script>

<template>
  <VCard :class="dealMeetings.length ? 'activity-card' : ''">
    <VCardItem>
      <VCardTitle>{{ dealCode }} Communication</VCardTitle>
      <template #append>
        <div class="d-flex gap-2">
          <VBtn
            variant="tonal"
            color="primary"
            prepend-icon="tabler-mail"
            @click="emit('open-email')"
          >
            Email
          </VBtn>

          <VBtn
            prepend-icon="tabler-calendar-plus"
            @click="emit('open-add-meeting')"
          >
            Meeting
          </VBtn>
        </div>
      </template>
    </VCardItem>

    <VDivider />

    <VCardText :class="dealMeetings.length ? 'activity-card__body' : ''">
      <div
        v-if="!dealMeetings.length"
        class="d-flex justify-center align-center py-12 text-medium-emphasis"
      >
        No communication activity yet.
      </div>

      <VTimeline
        v-else
        side="end"
        align="start"
        line-inset="8"
        truncate-line="start"
        density="compact"
      >
        <VTimelineItem
          v-for="meeting in dealMeetings"
          :key="meeting.id"
          dot-color="success"
          size="x-small"
        >
          <div class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2">
            <div class="d-flex align-center">
              <span class="app-timeline-title">{{ meeting.subject || 'Meeting' }}</span>
              <VChip
                size="small"
                class="timeline-chip"
                color="success"
                density="compact"
              >
                Meeting
              </VChip>
            </div>

            <span class="app-timeline-meta">
              {{ timeAgo(meeting.startAt || meeting.createdAt) }}
            </span>
          </div>

          <div
            v-if="meeting.note || meeting.notes"
            class="app-timeline-text mt-1"
          >
            {{ meeting.note || meeting.notes }}
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

.activity-card__body {
  overflow: auto;
  flex: 1 1 auto;
  padding-inline-end: 0.5rem;
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
