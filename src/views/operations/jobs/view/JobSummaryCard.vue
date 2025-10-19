<script setup lang="ts">
import { computed } from "vue";

import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";

interface Props {
  job: JobProperties;
  contactDirectory: Map<number, { name: string }>;
}

const props = defineProps<Props>();

const relatedContactName = computed(() => {
  if (!props.job.relatedTo) return "--";
  return props.contactDirectory.get(Number(props.job.relatedTo))?.name ?? "--";
});

const collaboratorNames = computed(() => {
  if (!Array.isArray(props.job.collaborators) || !props.job.collaborators.length)
    return [] as string[];
  return props.job.collaborators
    .map((id) => props.contactDirectory.get(Number(id))?.name ?? null)
    .filter((value): value is string => Boolean(value));
});

const formattedStartDate = computed(() => {
  if (!props.job.startDate) return "--";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(props.job.startDate));
  } catch (error) {
    console.warn("Failed to format job start date", error);
    return props.job.startDate;
  }
});
</script>

<template>
  <VCard>
    <VCardText class="d-flex flex-column gap-4">
      <div>
        <h5 class="text-h5 mb-1">{{ job.name }}</h5>
        <p class="text-body-2 mb-0 text-medium-emphasis">
          {{ job.code || "No code" }}
        </p>
      </div>

      <div class="d-flex flex-wrap gap-3">
        <VChip color="info" label size="small">{{ job.stage }}</VChip>
        <VChip color="primary" label size="small">{{ job.type }}</VChip>
        <VChip
          :color="job.flag === 'High' ? 'error' : job.flag === 'Low' ? 'secondary' : 'primary'"
          label
          size="small"
        >
          {{ job.flag }}
        </VChip>
      </div>

      <div class="d-flex flex-column gap-2">
        <div class="d-flex align-center gap-3">
          <VIcon icon="tabler-calendar" size="18" class="text-medium-emphasis" />
          <span class="text-body-2">{{ formattedStartDate }}</span>
        </div>
        <div class="d-flex align-center gap-3">
          <VIcon icon="tabler-map-pin" size="18" class="text-medium-emphasis" />
          <span class="text-body-2">{{ job.location || '--' }}</span>
        </div>
        <div class="d-flex align-center gap-3">
          <VIcon icon="tabler-user" size="18" class="text-medium-emphasis" />
          <span class="text-body-2">Related: {{ relatedContactName }}</span>
        </div>
      </div>

      <div>
        <p class="text-overline mb-1">Collaborators</p>
        <p class="text-body-2 text-medium-emphasis mb-0">
          <span v-if="collaboratorNames.length">
            {{ collaboratorNames.join(", ") }}
          </span>
          <span v-else>No collaborators</span>
        </p>
      </div>

      <div>
        <p class="text-overline mb-1">Notes</p>
        <p class="text-body-2 text-medium-emphasis mb-0">
          {{ job.note || 'No notes available' }}
        </p>
      </div>
    </VCardText>
  </VCard>
</template>
