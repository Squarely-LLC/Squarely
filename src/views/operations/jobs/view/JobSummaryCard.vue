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
      <h5 class="text-h5 mt-4 mb-1">{{ job.name }}</h5>
      <p class="text-body-2 text-medium-emphasis mb-0">
        {{ job.code || "No code" }}
      </p>
      <div class="d-flex justify-center gap-2 flex-wrap mt-4">
        <VChip color="info" label size="small" variant="tonal">
          {{ job.stage }}
        </VChip>
        <VChip color="primary" label size="small" variant="tonal">
          {{ job.type }}
        </VChip>
        <VChip :color="resolveFlagColor(job.flag)" label size="small">
          {{ job.flag }}
        </VChip>
      </div>
    </VCardText>
    <VDivider />
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
        <VListItem>
          <VListItemTitle>
            <div class="d-flex align-center gap-2 flex-wrap">
              <h6 class="text-h6 mb-0">Related Contact:</h6>
              <template v-if="relatedContact">
                <VAvatar v-if="relatedContact.picture" size="32" class="me-1">
                  <VImg :src="relatedContact.picture || ''" />
                </VAvatar>
                <VAvatar
                  v-else
                  size="32"
                  color="secondary"
                  variant="tonal"
                  class="me-1 font-weight-medium"
                >
                  <span>{{ avatarText(relatedContact.name) }}</span>
                </VAvatar>
                <div class="d-inline-block text-body-1 text-high-emphasis">
                  {{ relatedContact.name }}
                </div>
              </template>
              <div
                v-else
                class="d-inline-block text-body-1 text-medium-emphasis"
              >
                --
              </div>
            </div>
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCardText>
    <VDivider />
    <VCardText class="d-flex justify-center gap-4 pb-6">
      <VBtn @click="emit('edit')">Edit</VBtn>
      <VBtn variant="tonal" color="error" @click="emit('delete')">Delete</VBtn>
    </VCardText>
    <VDivider />
    <VCardText>
      <h6 class="text-h6 mb-3">Collaborators</h6>
      <div class="d-flex justify-center gap-3 flex-wrap align-center">
        <div
          v-if="collaboratorCount"
          class="v-avatar-group demo-avatar-group justify-center"
        >
          <VAvatar
            v-for="collaborator in decoratedCollaborators.slice(0, 3)"
            :key="`job-collaborator-${collaborator.id}`"
            :size="42"
            :variant="!collaborator.avatar ? 'tonal' : undefined"
            :color="!collaborator.avatar ? 'primary' : undefined"
            :class="
              !collaborator.avatar ? 'text-white font-weight-medium' : undefined
            "
          >
            <template v-if="collaborator.avatar">
              <VImg :src="collaborator.avatar" />
            </template>
            <template v-else>
              <span>{{ avatarText(collaborator.name) }}</span>
            </template>
            <VTooltip activator="parent" location="top">
              {{ collaborator.name }}
            </VTooltip>
          </VAvatar>
          <VAvatar
            v-if="collaboratorCount > 3"
            color="secondary"
            :size="42"
            class="font-weight-medium text-white"
          >
            +{{ collaboratorCount - 3 }}
            <VTooltip activator="parent" location="top">
              {{
                decoratedCollaborators
                  .slice(3)
                  .map((collaborator) => collaborator.name)
                  .join(", ")
              }}
            </VTooltip>
          </VAvatar>
        </div>
        <span v-else class="text-body-2 text-medium-emphasis">
          No collaborators assigned yet.
        </span>
      </div>
    </VCardText>
    <VDivider />
    <VCardText>
      <h6 class="text-h6 mb-2">Notes</h6>
      <p class="text-body-2 text-medium-emphasis mb-0">{{ noteText }}</p>
    </VCardText>
  </VCard>
</template>
