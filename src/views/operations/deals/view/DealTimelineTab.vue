<script setup lang="ts">
import { computed } from 'vue'

import type { DealProperties } from '@/plugins/fake-api/handlers/operations/deals/types'
import { useTodos } from '@/stores/todos'

const props = defineProps<{
  deal: DealProperties
}>()

const todosStore = useTodos()
todosStore.init()

const formatDate = (value?: string | null) => {
  if (!value)
    return '--'

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  }
  catch {
    return value
  }
}

const timelineEntries = computed(() => {
  const baseEntries = [
    {
      id: `created-${props.deal.id}`,
      title: 'Deal created',
      body: props.deal.code || `Deal #${props.deal.id}`,
      date: props.deal.createdAt,
      color: 'primary',
    },
    props.deal.estimatedDeliveryDate
      ? {
          id: `delivery-${props.deal.id}`,
          title: 'Estimated delivery date',
          body: props.deal.estimatedDeliveryDate,
          date: props.deal.estimatedDeliveryDate,
          color: 'info',
        }
      : null,
    ...(props.deal.items || []).map(item => ({
      id: `item-${item.id}`,
      title: `Item added: ${item.name}`,
      body: item.note || item.status || '',
      date: props.deal.createdAt,
      color: 'success',
    })),
    ...(props.deal.documents || []).map(document => ({
      id: `document-${document.id}`,
      title: `Document linked: ${document.name}`,
      body: document.note || document.type || '',
      date: document.createdAt || props.deal.createdAt,
      color: 'secondary',
    })),
    ...(props.deal.financials || []).map(entry => ({
      id: `financial-${entry.id}`,
      title: `${entry.title}`,
      body: `${entry.type} - ${entry.amount.toLocaleString()}`,
      date: entry.createdAt,
      color: 'warning',
    })),
    ...((todosStore.meetings || []).filter((meeting: any) =>
      meeting?.relatedTo
      && String(meeting.relatedTo.id) === String(props.deal.id)
      && (meeting.relatedTo.type ? meeting.relatedTo.type === 'deal' : true),
    )).map((meeting: any) => ({
      id: `meeting-${meeting.id}`,
      title: meeting.subject || 'Meeting scheduled',
      body: meeting.agenda || meeting.note || '',
      date: meeting.startAt || meeting.createdAt,
      color: 'success',
    })),
  ].filter(Boolean) as Array<{
    id: string
    title: string
    body: string
    date: string
    color: string
  }>

  return baseEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Timeline</VCardTitle>
    </VCardItem>

    <VDivider />

    <VCardText>
      <VTimeline
        v-if="timelineEntries.length"
        side="end"
        align="start"
        line-inset="8"
        truncate-line="start"
        density="compact"
      >
        <VTimelineItem
          v-for="entry in timelineEntries"
          :key="entry.id"
          :dot-color="entry.color"
          size="x-small"
        >
          <div class="d-flex justify-space-between align-center gap-2 flex-wrap mb-2">
            <span class="font-weight-medium">{{ entry.title }}</span>
            <span class="text-sm text-medium-emphasis">{{ formatDate(entry.date) }}</span>
          </div>
          <div
            v-if="entry.body"
            class="text-sm text-medium-emphasis"
          >
            {{ entry.body }}
          </div>
        </VTimelineItem>
      </VTimeline>

      <div
        v-else
        class="text-center py-12 text-medium-emphasis"
      >
        No timeline events available yet.
      </div>
    </VCardText>
  </VCard>
</template>
