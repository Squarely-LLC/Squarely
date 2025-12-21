<script setup lang="ts">
import { useContactsStore } from "@/stores/contacts";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, ref } from "vue";

interface Props {
  isDialogVisible: boolean;
  existingStakeholderIds?: Array<number | string>;
}

interface Emit {
  (e: "update:isDialogVisible", val: boolean): void;
  (
    e: "add-stakeholder",
    payload: { contactId: number | string; role?: string }
  ): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const dialogVisibleUpdate = (val: boolean) => {
  emit("update:isDialogVisible", val);
};

const contactsStore = useContactsStore();
const notificationsStore = useNotificationsStore();

const availableContacts = computed(() => {
  const all = contactsStore.all || [];

  const excludeIds = new Set(
    (props.existingStakeholderIds || []).map((id) => String(id))
  );

  return all
    .filter((contact) => !excludeIds.has(String(contact.id)))
    .map((contact) => ({
      id: contact.id,
      avatar: contact.picture || "",
      name: contact.fullName,
      email: contact.email || "",
      company: (contact as any).company || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectedContactId = ref<number | string | null>(null);
const stakeholderRole = ref("");

const addStakeholder = () => {
  if (!selectedContactId.value) return;

  emit("add-stakeholder", {
    contactId: selectedContactId.value,
    role: stakeholderRole.value || undefined,
  });

  emit("update:isDialogVisible", false);
  selectedContactId.value = null;
  stakeholderRole.value = "";
  notificationsStore.push("Stakeholder added", "success", 2500);
};

const avatarInitials = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    :width="$vuetify.display.smAndDown ? '600' : 600"
    @update:model-value="dialogVisibleUpdate"
  >
    <DialogCloseBtn @click="$emit('update:isDialogVisible', false)" />

    <VCard class="pa-2 pa-sm-10">
      <VCardText>
        <h4 class="text-h4 text-center mb-2">Add Stakeholder</h4>
        <p class="text-body-1 text-center mb-6">
          Select a contact to add as a stakeholder
        </p>

        <div class="d-flex flex-column gap-3">
          <AppAutocomplete
            label="Select Contact"
            :items="availableContacts"
            item-title="name"
            item-value="id"
            v-model="selectedContactId"
            placeholder="Search for contact..."
          >
            <template #item="{ props: listItemProp, item }">
              <VListItem v-bind="listItemProp">
                <template #prepend>
                  <VAvatar
                    size="30"
                    :color="item.raw.avatar ? undefined : 'primary'"
                    :variant="!item.raw.avatar ? 'tonal' : undefined"
                  >
                    <template v-if="item.raw.avatar">
                      <VImg :src="item.raw.avatar" />
                    </template>
                    <template v-else>
                      <span class="font-weight-medium">{{
                        avatarInitials(item.raw.name)
                      }}</span>
                    </template>
                  </VAvatar>
                </template>

                <VListItemSubtitle class="text-body-2">
                  {{ item.raw.email }}
                </VListItemSubtitle>
              </VListItem>
            </template>
          </AppAutocomplete>

          <AppTextField
            v-model="stakeholderRole"
            label="Role (optional)"
            placeholder="e.g., Project Sponsor, Client Representative"
          />
        </div>

        <div class="d-flex justify-center gap-3 mt-6">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="$emit('update:isDialogVisible', false)"
          >
            Cancel
          </VBtn>
          <VBtn
            @click="addStakeholder"
            prepend-icon="tabler-user-plus"
            :disabled="!selectedContactId"
          >
            Add Stakeholder
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
