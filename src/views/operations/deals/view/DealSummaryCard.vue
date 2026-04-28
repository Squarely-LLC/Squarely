<script setup lang="ts">
import { computed } from 'vue'

import type { DealProperties } from '@/plugins/fake-api/handlers/operations/deals/types'

interface Props {
  deal: DealProperties
  linkedToName: string
  collaboratorNames: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit'): void
}>()

const formatDate = (value?: string | null) => {
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

const financialTotal = computed(() =>
  (props.deal.financials || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
)

const itemCount = computed(() => props.deal.items?.length || 0)

const noteText = computed(() => props.deal.note?.trim() || 'No notes available')
</script>

<template>
  <VCard>
    <VCardText class="text-center pt-12">
      <VAvatar
        rounded
        :size="100"
        :color="deal.important ? 'warning' : 'primary'"
        variant="tonal"
      >
        <span class="text-5xl font-weight-medium">
          {{ deal.code || '--' }}
        </span>
      </VAvatar>

      <h5 class="text-h5 mt-4">
        {{ deal.code }}
      </h5>

      <div class="d-flex justify-center gap-2 mt-2 flex-wrap">
        <VChip label size="small" color="info" variant="text">
          {{ deal.stage || '--' }}
        </VChip>

        <VChip label size="small" color="primary" variant="text">
          {{ deal.type || '--' }}
        </VChip>

        <VChip
          label
          size="small"
          :color="deal.important ? 'warning' : 'secondary'"
          variant="text"
        >
          {{ deal.important ? 'Important' : 'Standard' }}
        </VChip>
      </div>
    </VCardText>

    <VCardText>
      <h5 class="text-h5">Details</h5>

      <VDivider class="my-4" />

      <VList class="py-0 card-list">
        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Deal Code:
              <div class="d-inline-block text-body-1">
                {{ deal.code || '--' }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Linked To:
              <div class="d-inline-block text-body-1">
                {{ linkedToName }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Delivery:
              <div class="d-inline-block text-body-1">
                {{ formatDate(deal.estimatedDeliveryDate) }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Location:
              <div class="d-inline-block text-body-1">
                {{ deal.location || '--' }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Items:
              <div class="d-inline-block text-body-1">
                {{ itemCount }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Financial Total:
              <div class="d-inline-block text-body-1">
                {{ financialTotal.toLocaleString() }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Collaborators:
              <div class="d-inline-block text-body-1 text-wrap">
                {{ collaboratorNames.length ? collaboratorNames.join(', ') : '--' }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Notes:
              <div class="d-inline-block text-body-1 text-wrap">
                {{ noteText }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCardText>

    <VCardText class="d-flex justify-center pb-6">
      <VBtn @click="emit('edit')">
        Edit
      </VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}
</style>
