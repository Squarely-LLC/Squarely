<script setup lang="ts">
import type {
  DealNote,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { computed } from "vue";

const props = defineProps<{
  deal: DealProperties;
}>();

const sortedNotes = computed<DealNote[]>(() =>
  [...(props.deal.notes || [])].sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();

    return rightTime - leftTime;
  }),
);

const formatNoteDate = (value?: string | null) => {
  if (!value) return "--";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};
</script>

<template>
  <VCard>
    <VCardItem>
      <template #title>
        {{ `${deal.code || `Deal #${deal.id}`} Notes` }}
      </template>
    </VCardItem>

    <VCardText>
      <div v-if="!sortedNotes.length" class="deal-notes-empty">
        <VIcon icon="tabler-notes" size="36" class="mb-2" />
        <div class="text-subtitle-1">No notes yet</div>
      </div>

      <div v-else class="deal-notes-feed">
        <VCard
          v-for="note in sortedNotes"
          :key="note.id"
          variant="tonal"
          class="deal-note"
        >
          <VCardText>
            <div class="d-flex justify-space-between gap-3 flex-wrap mb-2">
              <div class="font-weight-medium">
                {{ note.authorName || "Note" }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatNoteDate(note.createdAt) }}
              </div>
            </div>

            <div class="text-body-2 deal-note__body">
              {{ note.body }}
            </div>
          </VCardText>
        </VCard>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.deal-notes-empty {
  display: flex;
  min-block-size: 16rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
}

.deal-notes-feed {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.deal-note {
  border-radius: 8px;
}

.deal-note__body {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
