<script setup lang="ts">
import type { JobProperties } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { computed } from "vue";

type ContactDirectoryEntry = {
  name: string;
  picture: string | null;
  type?: string | null;
  connections?: Array<{
    contactId: number;
    contactName: string;
    isPrimary: boolean;
    relation: string;
    picture?: string;
  }>;
};

interface Props {
  job: JobProperties;
  contactDirectory: Map<number, ContactDirectoryEntry>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "addStakeholder"): void;
  (e: "removeStakeholder", stakeholderId: number): void;
  (
    e: "todo",
    contact: { id: number; name: string; avatar: string | null }
  ): void;
  (
    e: "meeting",
    contact: { id: number; name: string; avatar: string | null }
  ): void;
  (
    e: "email",
    contact: { id: number; name: string; avatar: string | null }
  ): void;
  (
    e: "call",
    contact: { id: number; name: string; avatar: string | null }
  ): void;
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

const decoratedStakeholders = computed(() => {
  const rows: Array<{
    id: number | string;
    contactId: number | null;
    name: string;
    role: string;
    avatar: string | null;
    derived: boolean;
  }> = [];
  const explicitContactIds = new Set<string>();

  if (Array.isArray(props.job.stakeholders)) {
    props.job.stakeholders.forEach((stakeholder) => {
      if (stakeholder.contactId !== null && stakeholder.contactId !== undefined)
        explicitContactIds.add(String(stakeholder.contactId));

      const contact = stakeholder.contactId
        ? props.contactDirectory.get(Number(stakeholder.contactId))
        : null;
      const name = contact?.name || "Unassigned";

      rows.push({
        id: stakeholder.id,
        contactId: stakeholder.contactId,
        name,
        role: stakeholder.role || "--",
        avatar: contact?.picture || null,
        derived: false,
      });
    });
  }

  const relatedContact = props.job.relatedTo
    ? props.contactDirectory.get(Number(props.job.relatedTo))
    : null;

  if (relatedContact?.type === "Entity") {
    (relatedContact.connections || []).forEach((connection) => {
      const contactId = Number(connection.contactId);
      if (!Number.isFinite(contactId)) return;
      if (explicitContactIds.has(String(contactId))) return;

      const contact = props.contactDirectory.get(contactId);
      if (!contact) return;

      explicitContactIds.add(String(contactId));
      rows.push({
        id: `derived-${contactId}`,
        contactId,
        name: contact.name || connection.contactName || "Unassigned",
        role: connection.relation || "Related Contact",
        avatar: contact.picture || connection.picture || null,
        derived: true,
      });
    });
  }

  return rows;
});

const handleRemove = (stakeholder: (typeof decoratedStakeholders.value)[0]) => {
  if (stakeholder.derived || typeof stakeholder.id !== "number") return;
  emit("removeStakeholder", stakeholder.id);
};

const handleTodo = (stakeholder: (typeof decoratedStakeholders.value)[0]) => {
  if (!stakeholder.contactId) return;
  emit("todo", {
    id: stakeholder.contactId,
    name: stakeholder.name,
    avatar: stakeholder.avatar,
  });
};

const handleMeeting = (
  stakeholder: (typeof decoratedStakeholders.value)[0]
) => {
  if (!stakeholder.contactId) return;
  emit("meeting", {
    id: stakeholder.contactId,
    name: stakeholder.name,
    avatar: stakeholder.avatar,
  });
};

const handleEmail = (stakeholder: (typeof decoratedStakeholders.value)[0]) => {
  if (!stakeholder.contactId) return;
  emit("email", {
    id: stakeholder.contactId,
    name: stakeholder.name,
    avatar: stakeholder.avatar,
  });
};

const handleCall = (stakeholder: (typeof decoratedStakeholders.value)[0]) => {
  if (!stakeholder.contactId) return;
  emit("call", {
    id: stakeholder.contactId,
    name: stakeholder.name,
    avatar: stakeholder.avatar,
  });
};

</script>

<template>
  <VCard title="Stakeholders">
    <template #append>
      <div>
        <VBtn icon variant="text" @click="emit('addStakeholder')">
          <VIcon icon="tabler-user-plus" color="secondary" />
          <VTooltip activator="parent" location="top">
            Add Stakeholder
          </VTooltip>
        </VBtn>
      </div>
    </template>
    <VCardText>
      <VList class="card-list">
        <template v-if="decoratedStakeholders.length > 0">
          <VListItem
            v-for="stakeholder in decoratedStakeholders"
            :key="stakeholder.id"
          >
            <template #prepend>
              <VAvatar
                class="me-3"
                size="38"
                :color="!stakeholder.avatar ? 'primary' : undefined"
                :variant="!stakeholder.avatar ? 'tonal' : undefined"
              >
                <VImg v-if="stakeholder.avatar" :src="stakeholder.avatar" />
                <span v-else class="text-m font-weight-medium">{{
                  avatarText(stakeholder.name)
                }}</span>
              </VAvatar>
            </template>

            <VListItemTitle class="font-weight-medium d-flex align-center">
              <span>{{ stakeholder.name }}</span>
              <VChip
                v-if="stakeholder.derived"
                class="ms-2"
                color="secondary"
                label
                size="x-small"
                variant="tonal"
              >
                Related
              </VChip>
            </VListItemTitle>
            <VListItemSubtitle>{{ stakeholder.role }}</VListItemSubtitle>

            <template #append>
              <div class="d-flex align-center">
                <VBtn
                  v-if="!stakeholder.derived"
                  icon
                  variant="text"
                  color="medium-emphasis"
                  @click="handleRemove(stakeholder)"
                >
                  <VIcon icon="tabler-trash" />
                  <VTooltip activator="parent" location="top">
                    Remove
                  </VTooltip>
                </VBtn>

                <VBtn
                  icon
                  variant="text"
                  color="medium-emphasis"
                  :disabled="!stakeholder.contactId"
                >
                  <VIcon icon="tabler-send-2" />
                  <VMenu activator="parent">
                    <VList>
                      <VListItem link @click.prevent="handleTodo(stakeholder)">
                        <template #prepend>
                          <VIcon icon="tabler-notes" />
                        </template>
                        <VListItemTitle>Task</VListItemTitle>
                      </VListItem>

                      <VListItem @click.prevent="handleMeeting(stakeholder)">
                        <template #prepend>
                          <VIcon icon="tabler-calendar-plus" />
                        </template>
                        <VListItemTitle>Meeting</VListItemTitle>
                      </VListItem>

                      <VListItem @click.prevent="handleEmail(stakeholder)">
                        <template #prepend>
                          <VIcon icon="tabler-mail" />
                        </template>
                        <VListItemTitle>Email</VListItemTitle>
                      </VListItem>

                      <VListItem @click.prevent="handleCall(stakeholder)">
                        <template #prepend>
                          <VIcon icon="tabler-phone" />
                        </template>
                        <VListItemTitle>Call</VListItemTitle>
                      </VListItem>
                    </VList>
                  </VMenu>
                </VBtn>
              </div>
            </template>
          </VListItem>
        </template>

        <VListItem v-else>
          <VListItemTitle class="text-center w-100 text-medium-emphasis">
            No stakeholders assigned yet.
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCardText>
  </VCard>
</template>

<style scoped>
.card-list {
  --v-card-list-gap: 0.75rem;
}

.connection-highlight {
  animation: highlightFade 2s ease-out;
}

@keyframes highlightFade {
  0% {
    background-color: rgba(var(--v-theme-primary), 0.12);
  }

  100% {
    background-color: transparent;
  }
}
</style>
