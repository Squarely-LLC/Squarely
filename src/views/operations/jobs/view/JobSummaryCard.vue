<script setup lang="ts">
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { formatSystemDate } from "@core/utils/formatters";
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
const formatDate = (value?: string | null) => {
  if (!value) return "--";
  try {
    return formatSystemDate(value);
  } catch (error) {
    console.warn("Failed to format job date", error);
    return value;
  }
};
const formattedStartDate = computed(() => formatDate(props.job.startDate));
const formattedEndDate = computed(() => formatDate(props.job.endDate));
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
      ? (props.contactDirectory.get(numericId) ?? null)
      : null;
    const fallbackName = `Collaborator ${index + 1}`;
    return {
      id: Number.isFinite(numericId) ? numericId : index,
      name: entry?.name || fallbackName,
      avatar: entry?.picture || null,
    };
  });
});
const noteText = computed(() => props.job.note?.trim() || "No notes available");
const collaboratorNames = computed(() => {
  if (!decoratedCollaborators.value.length) return "--";
  return decoratedCollaborators.value
    .map((collaborator) => collaborator.name)
    .join(", ");
});
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
        <VChip label size="small" color="info" variant="text">
          {{ job.stage }}
        </VChip>

        <VChip label size="small" color="primary" variant="text">
          {{ job.type }}
        </VChip>

        <VChip label size="small" :color="resolveFlagColor(job.flag)" variant="text">
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
              Project Name:
              <div class="d-inline-block text-body-1">
                {{ job.name }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

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

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              End Date:
              <div class="d-inline-block text-body-1">
                {{ formattedEndDate }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Related To:
              <div class="d-inline-block text-body-1">
                {{ relatedContact?.name || "--" }}
              </div>
            </h6>
          </VListItemTitle>
        </VListItem>

        <VListItem>
          <VListItemTitle>
            <h6 class="text-h6">
              Collaborators:
              <div class="d-inline-block text-body-1 text-wrap">
                {{ collaboratorNames }}
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

    <VCardText class="d-flex justify-center gap-4 pb-6">
      <VBtn @click="emit('edit')">Edit</VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.5rem;
}
</style>
