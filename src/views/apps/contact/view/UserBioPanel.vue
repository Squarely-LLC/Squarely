<script setup lang="ts">
import { computed, ref } from "vue";
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";

import ContactEditDialog from "@/views/apps/contact/list/ContactEditDialog.vue";

interface Props {
  userData: ContactProperties;
}

const props = defineProps<Props>();

const isContactEditDialogVisible = ref(false);

const classVariant = (contactClass: ContactProperties["class"]) => {
  switch (contactClass) {
    case "Lead":
      return { color: "warning", icon: "tabler-target" };
    case "Client":
      return { color: "primary", icon: "tabler-briefcase" };
    case "Supplier":
      return { color: "info", icon: "tabler-truck" };
    case "Contact":
      return { color: "success", icon: "tabler-user" };
    case "Owner":
      return { color: "secondary", icon: "tabler-building" };
    default:
      return { color: "primary", icon: "tabler-user" };
  }
};

const statusColor = (status: ContactProperties["status"]) => {
  switch (status) {
    case "Active":
      return "success";
    case "Dormant":
      return "secondary";
    case "Potential":
      return "info";
    case "Lost":
      return "error";
    default:
      return "primary";
  }
};

const channelColor = (channel: ContactProperties["channel"]) => {
  switch (channel) {
    case "Direct Sales":
      return "primary";
    case "Referral":
      return "success";
    case "Social Media":
      return "info";
    case "Website":
      return "secondary";
    case "Email Campaigns":
      return "warning";
    default:
      return "primary";
  }
};

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

const connectionList = computed(() => props.userData.connections ?? []);
const primaryConnections = computed(() =>
  connectionList.value.filter((connection) => connection.isPrimary)
);
const secondaryConnections = computed(() =>
  connectionList.value.filter((connection) => !connection.isPrimary)
);
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard>
        <VCardText class="text-center pt-12">
          <VAvatar
            rounded
            :size="100"
            :color="!props.userData.picture ? classVariant(props.userData.class).color : undefined"
            :variant="!props.userData.picture ? 'tonal' : undefined"
          >
            <VImg v-if="props.userData.picture" :src="props.userData.picture" />
            <span v-else class="text-5xl font-weight-medium">
              {{ avatarText(props.userData.fullName) }}
            </span>
          </VAvatar>

          <h5 class="text-h5 mt-4">
            {{ props.userData.fullName }}
          </h5>

          <div class="d-flex justify-center gap-2 mt-2">
            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="classVariant(props.userData.class).color"
              variant="tonal"
            >
              {{ props.userData.class }}
            </VChip>

            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="statusColor(props.userData.status)"
              variant="tonal"
            >
              {{ props.userData.status }}
            </VChip>

            <VChip
              label
              size="small"
              class="text-capitalize"
              :color="channelColor(props.userData.channel)"
              variant="tonal"
            >
              {{ props.userData.channel }}
            </VChip>
          </div>
        </VCardText>

        <VCardText>
          <VList class="py-0">
            <VListItem>
              <VListItemTitle>Email</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.email }}</VListItemSubtitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>Phone</VListItemTitle>
              <VListItemSubtitle>
                <a :href="`tel:${props.userData.number}`">{{ props.userData.number }}</a>
              </VListItemSubtitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>Type</VListItemTitle>
              <VListItemSubtitle class="text-capitalize">
                {{ props.userData.type }}
              </VListItemSubtitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>Category</VListItemTitle>
              <VListItemSubtitle class="text-capitalize">
                {{ props.userData.category }}
              </VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.language">
              <VListItemTitle>Language</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.language }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.country">
              <VListItemTitle>Country</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.country }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.city">
              <VListItemTitle>City</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.city }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.address">
              <VListItemTitle>Address</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.address }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.poBox">
              <VListItemTitle>PO Box</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.poBox }}</VListItemSubtitle>
            </VListItem>

            <VListItem>
              <VListItemTitle>Works in sales</VListItemTitle>
              <VListItemSubtitle>
                {{ props.userData.worksInSales ? "Yes" : "No" }}
              </VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.taxId">
              <VListItemTitle>Tax ID</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.accounting.taxId }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.crn">
              <VListItemTitle>CRN</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.accounting.crn }}</VListItemSubtitle>
            </VListItem>

            <VListItem v-if="props.userData.accounting?.vatNumber">
              <VListItemTitle>VAT Number</VListItemTitle>
              <VListItemSubtitle>{{ props.userData.accounting.vatNumber }}</VListItemSubtitle>
            </VListItem>
          </VList>
        </VCardText>

        <VCardText class="d-flex justify-center gap-4">
          <VBtn @click="isContactEditDialogVisible = true">Edit</VBtn>
          <VBtn variant="tonal" color="error">Suspend</VBtn>
        </VCardText>
      </VCard>
    </VCol>

    <VCol cols="12">
      <VCard title="Connections">
        <VCardText>
          <VList class="py-0">
            <template v-if="connectionList.length">
              <VSubheader inset v-if="primaryConnections.length">
                Primary
              </VSubheader>
              <VListItem
                v-for="connection in primaryConnections"
                :key="`primary-${connection.contactId}`"
              >
                <VListItemTitle>{{ connection.contactName }}</VListItemTitle>
                <VListItemSubtitle>{{ connection.relation }}</VListItemSubtitle>
              </VListItem>

              <VSubheader inset v-if="secondaryConnections.length">
                Secondary
              </VSubheader>
              <VListItem
                v-for="connection in secondaryConnections"
                :key="`secondary-${connection.contactId}`"
              >
                <VListItemTitle>{{ connection.contactName }}</VListItemTitle>
                <VListItemSubtitle>{{ connection.relation }}</VListItemSubtitle>
              </VListItem>
            </template>
            <VListItem v-else>
              <VListItemSubtitle>No recorded connections.</VListItemSubtitle>
            </VListItem>
          </VList>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <ContactEditDialog
    v-model:is-dialog-visible="isContactEditDialogVisible"
    :contact="props.userData"
  />
</template>



