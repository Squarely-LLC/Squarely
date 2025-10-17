<script setup lang="ts">
import avatar1 from "@images/avatars/avatar-1.png";
import avatar2 from "@images/avatars/avatar-2.png";
import avatar3 from "@images/avatars/avatar-3.png";
import avatar4 from "@images/avatars/avatar-4.png";
import avatar5 from "@images/avatars/avatar-5.png";
import avatar6 from "@images/avatars/avatar-6.png";
import avatar7 from "@images/avatars/avatar-7.png";
import avatar8 from "@images/avatars/avatar-8.png";

interface Props {
  isDialogVisible: boolean;
  // optional: id of the contact we're adding connections for — used to exclude self
  currentContactId?: number | string;
  // optional: list of already connected contact ids to exclude from the selector
  existingConnections?: Array<number | string>;
}

interface Emit {
  (e: "update:isDialogVisible", val: boolean): void;
  (
    e: "add-connection",
    payload: { contactId: number | string; relation?: string }
  ): void;
}

const props = defineProps<Props>();

const emit = defineEmits<Emit>();

const dialogVisibleUpdate = (val: boolean) => {
  emit("update:isDialogVisible", val);
};

type Permission = "Owner" | "Can Edit" | "Can Comment" | "Can View";

interface Member {
  avatar: string;
  name: string;
  email: string;
  permission: Permission;
}

const membersList: Member[] = [
  {
    avatar: avatar1,
    name: "Lester Palmer",
    email: "jerrod98@gmail.com",
    permission: "Can Edit",
  },
  {
    avatar: avatar2,
    name: "Mattie Blair",
    email: "prudence.boehm@yahoo.com",
    permission: "Owner",
  },
  {
    avatar: avatar3,
    name: "Marvin Wheeler",
    email: "rumet@jujpejah.net",
    permission: "Can Comment",
  },
  {
    avatar: avatar4,
    name: "Nannie Ford",
    email: "negza@nuv.io",
    permission: "Can View",
  },
  {
    avatar: avatar5,
    name: "Julian Murphy",
    email: "lunebame@umdomgu.net",
    permission: "Can Edit",
  },
  {
    avatar: avatar6,
    name: "Sophie Gilbert",
    email: "ha@sugit.gov",
    permission: "Can View",
  },
  {
    avatar: avatar7,
    name: "Chris Watkins",
    email: "zokap@mak.org",
    permission: "Can Comment",
  },
  {
    avatar: avatar8,
    name: "Adelaide Nichols",
    email: "ujinomu@jigo.com",
    permission: "Can Edit",
  },
];

// Use contacts store when available to present real contacts (exclude self and already connected)
import { useContactsStore } from "@/stores/contacts";
import { computed } from "vue";
import { useDisplay } from "vuetify";

const contactsStore = useContactsStore();

// Vuetify display composable (replaces $vuetify.display usage)
const display = useDisplay();

const availableMembers = computed(() => {
  // If store isn't initialized or has no items, fallback to static membersList
  const all =
    contactsStore.items && contactsStore.items.length
      ? contactsStore.items
      : null;
  if (!all) return membersList;

  const excludeIds = new Set(
    (props.existingConnections || []).map((id) => String(id))
  );
  if (props.currentContactId) excludeIds.add(String(props.currentContactId));

  // map ContactProperties -> Member shape
  return all
    .filter((c) => !excludeIds.has(String(c.id)))
    .map((c) => ({
      id: c.id,
      avatar: c.picture || "",
      name: c.fullName,
      email: c.email || "",
      permission: "Can View" as Permission,
    }));
});

import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useNotificationsStore } from "@/stores/notifications";
import AddNewUserDialog from "@/views/apps/contact/list/AddNewUserDialog.vue";
import { ref } from "vue";

// currently selected member id from autocomplete
const selectedMemberId = ref<number | string | null>(null);

// relation input
const relation = ref("");

// Add-new-contact dialog state
const isAddNewUserDialogVisible = ref(false);

// When AddNewUserDialog submits a new contact, add it to the store and select it
const onAddNewUserSubmit = (payload: Partial<ContactProperties>) => {
  // add to store and receive the normalized contact back (with id)
  const created = contactsStore.addContact(payload);

  // select the newly created contact in the autocomplete
  selectedMemberId.value = created.id;

  // close the add-new dialog
  isAddNewUserDialogVisible.value = false;
  // notify user
  useNotificationsStore().push("Contact created", "success", 3000);
};

const addConnection = () => {
  if (!selectedMemberId.value) return;
  emit("add-connection", {
    contactId: selectedMemberId.value,
    relation: relation.value || undefined,
  });
  emit("update:isDialogVisible", false);
  // reset local state
  selectedMemberId.value = null;
  relation.value = "";
  useNotificationsStore().push("Connection added", "success", 2500);
};

// helper to render initials for names without avatar
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
    <!-- 👉 Dialog close btn -->
    <DialogCloseBtn @click="$emit('update:isDialogVisible', false)" />

    <VCard class="share-project-dialog pa-2 pa-sm-10">
      <VCardText>
        <h4 class="text-h4 text-center mb-2">Add Connection</h4>
        <p class="text-body-1 text-center mb-6"></p>

        <div class="d-flex align-center gap-3 autocomplete-add-wrap">
          <div class="autocomplete-grow">
            <AppAutocomplete
              label="Add Connection"
              :items="availableMembers"
              item-title="name"
              item-value="id"
              v-model="selectedMemberId"
              placeholder="Add contact connection..."
            >
              <template #item="{ props: listItemProp, item }">
                <VListItem v-bind="listItemProp">
                  <template #prepend>
                    <VAvatar
                      size="30"
                      :color="item.raw.avatar ? undefined : 'primary'"
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

                  <VListItemSubtitle class="text-body-2">{{
                    item.raw.email
                  }}</VListItemSubtitle>
                </VListItem>
              </template>
            </AppAutocomplete>
          </div>
        </div>

        <VBtn
          variant="text"
          color="primary"
          @click="isAddNewUserDialogVisible = true"
        >
          <VIcon start icon="tabler-plus" /> Add New Contact
          <VTooltip activator="parent" location="top">Add new contact</VTooltip>
        </VBtn>

        <AppTextField
          class="mt-3"
          v-model="relation"
          label="Relation"
          placeholder="Relation/Position"
        />

        <div
          class="d-flex align-center justify-center justify-sm-space-between flex-wrap gap-3 mt-6"
        >
          <div class="d-flex gap-2">
            <VBtn
              @click="addConnection"
              class="text-capitalize"
              prepend-icon="tabler-link"
              :disabled="!selectedMemberId"
            >
              Add Connection
            </VBtn>
          </div>
        </div>

        <!-- Add new contact dialog (when user can't find the contact) -->
        <AddNewUserDialog
          v-model:is-dialog-visible="isAddNewUserDialogVisible"
          @submit="onAddNewUserSubmit"
        />
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style lang="scss">
.share-project-dialog {
  .card-list {
    --v-card-list-gap: 1rem;
  }
}
</style>

<style scoped>
.autocomplete-add-wrap {
  align-items: center;
}

.autocomplete-grow {
  flex: 1 1 auto;
}
</style>
