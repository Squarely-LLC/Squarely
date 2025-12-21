<script setup lang="ts">
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { computed } from "vue";
interface Props {
  job: JobProperties;
  contactDirectory: Map<number, { name: string; picture: string | null }>;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "edit"): void;
  (e: "delete"): void;
}>();
const avatarText = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || safeName.slice(0, 2).toUpperCase();
};
const resolveFlagColor = (flag: JobProperties["flag"]) => {
  switch (flag) {
    case "High":
      return "error";
    case "Low":
      return "secondary";
    case "Normal":
    default:
      return "primary";
  }
};
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
const relatedContact = computed(() => {
  if (!props.job.relatedTo) return null;
  return props.contactDirectory.get(Number(props.job.relatedTo)) ?? null;
});
const decoratedCollaborators = computed(() => {
  if (!Array.isArray(props.job.collaborators))
    return [] as Array<{
      id: number;
      name: string;
      avatar: string | null;
    }>;
  return props.job.collaborators.map((collaboratorId, index) => {
    const numericId = Number(collaboratorId);
    const entry = Number.isFinite(numericId)
      ? props.contactDirectory.get(numericId) ?? null
      : null;
    const fallbackName = `Collaborator ${index + 1}`;
    return {
      id: Number.isFinite(numericId) ? numericId : index,
      name: entry?.name || fallbackName,
      avatar: entry?.picture || null,
    };
  });
});
const collaboratorCount = computed(() => decoratedCollaborators.value.length);
const noteText = computed(() => props.job.note?.trim() || "No notes available");
</script>
<template>
  <VCard>
    <VCardText class="text-center pt-12">
      <VAvatar
        rounded
        :size="100"
        :variant="!job.avatar ? 'tonal' : undefined"
        :color="!job.avatar ? resolveFlagColor(job.flag) : undefined"
      >
        <VImg v-if="job.avatar" :src="job.avatar" />
        <span v-else class="text-5xl font-weight-medium">
          {{ avatarText(job.name) }}
        </span>
      </VAvatar>

      <h5 class="text-h5 mt-4">
        {{ job.name }}
      </h5>

      <div class="d-flex justify-center gap-2 mt-2">
        <VChip label size="small" color="info" variant="tonal">
          {{ job.stage }}
        </VChip>

        <VChip label size="small" color="primary" variant="tonal">
          {{ job.type }}
        </VChip>

        <VChip label size="small" :color="resolveFlagColor(job.flag)">
          {{ job.flag }}
        </VChip>
      </div>
    </VCardText>

    <VCardText>
      <h5 class="text-h5">Details</h5>

      <VDivider class="my-4" />
      <VList class="py-0 card-list details-list">
        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Code:
              <div class="d-inline-block text-body-1">
                {{ job.code || "--" }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Start Date:
              <div class="d-inline-block text-body-1">
                {{ formattedStartDate }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Location:
              <div class="d-inline-block text-body-1">
                {{ job.location || "--" }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem v-if="relatedContact">
          <VListItemTitle>
            <h6 class="text-h6">
              Related To:
              <div class="d-inline-block text-body-1">
                {{ relatedContact.name }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCardText>

    <VCardText class="d-flex justify-center gap-4 pb-6">
      <VBtn variant="tonal" color="error" @click="emit('delete')">Delete</VBtn>
    </VCardText>
  </VCard>
</template>
