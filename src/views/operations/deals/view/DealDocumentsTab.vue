<script setup lang="ts">
import { computed } from 'vue'

import type { DealProperties } from '@/plugins/fake-api/handlers/operations/deals/types'

const props = defineProps<{
  deal: DealProperties
}>()

const rows = computed(() => props.deal.documents || [])

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type', width: '160px' },
  { title: 'Category', key: 'category', width: '140px' },
  { title: 'Created', key: 'createdAt', width: '160px' },
]

const formatDate = (value?: string) => {
  if (!value)
    return '--'

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value))
  }
  catch {
    return value
  }
}
</script>

<template>
  <VCard>
    <VCardItem>
      <VCardTitle>Documents</VCardTitle>
      <VCardSubtitle>
        {{ rows.length }} documents linked to this deal
      </VCardSubtitle>
    </VCardItem>

    <VDivider />

    <VDataTable
      v-if="rows.length"
      :items="rows"
      :headers="headers"
      class="text-no-wrap"
    >
      <template #item.name="{ item }">
        <div class="py-2">
          <div class="font-weight-medium">
            {{ item.name }}
          </div>
          <div
            v-if="item.note"
            class="text-sm text-medium-emphasis"
          >
            {{ item.note }}
          </div>
        </div>
      </template>

      <template #item.createdAt="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>
    </VDataTable>

    <VCardText
      v-else
      class="text-center py-12 text-medium-emphasis"
    >
      No documents linked to this deal yet.
    </VCardText>
  </VCard>
</template>
