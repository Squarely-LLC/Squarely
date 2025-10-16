<!-- Contacts page -->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";

import type {
  ContactConnection,
  ContactProperties,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";
import AddNewUserDialog from "@/views/apps/contact/list/AddNewUserDialog.vue";
import ContactEditDialog from "@/views/apps/contact/list/ContactEditDialog.vue";

type SortKey = "user" | "status" | "category" | "channel" | "createdAt";
type SortVal = { key: SortKey; order: "asc" | "desc" };

const searchQuery = ref("");
const selectedRole = ref<string | undefined>();
const selectedPlan = ref<string | undefined>();
const selectedStatus = ref<string | undefined>();

const sortOptions: { title: string; value: SortVal }[] = [
  { title: "Name (A-Z)", value: { key: "user", order: "asc" } },
  { title: "Name (Z-A)", value: { key: "user", order: "desc" } },
  {
    title: "Recently Added",
    value: { key: "createdAt", order: "desc" },
  },
];

const selectedSort = ref<SortVal | undefined>(sortOptions[2].value);

const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<string | undefined>(selectedSort.value?.key);
const orderBy = ref<"asc" | "desc" | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

const headers = [
  { title: "Name", key: "user" },
  { title: "Type", key: "class" },
  { title: "Number", key: "number" },
  { title: "Connections", key: "connections", sortable: false },
  { title: "Status", key: "status" },

  { title: "Actions", key: "actions", sortable: false },
];

const roleFilter = computed(() =>
  selectedRole.value ? selectedRole.value : undefined
);
const planFilter = computed(() =>
  selectedPlan.value ? selectedPlan.value : undefined
);
const statusFilter = computed(() => {
  if (!selectedStatus.value) return undefined;
  if (selectedStatus.value === "Cold") return "Dormant";
  return selectedStatus.value;
});

const contactsStore = useContactsStore();
contactsStore.init();

watch(selectedSort, (val) => {
  if (!val) {
    sortBy.value = undefined;
    orderBy.value = undefined;
  } else {
    sortBy.value = val.key;
    orderBy.value = val.order;
  }
  page.value = 1;
});

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (contact: ContactProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const haystacks = [contact.fullName, contact.email, contact.number]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase());

    const numberQuery = query.replace(/\D/g, "");
    const hasMatch =
      haystacks.some((value) => value.includes(query)) ||
      (numberQuery &&
        contact.number &&
        contact.number.toString().replace(/\D/g, "").includes(numberQuery));

    if (!hasMatch) return false;
  }

  if (selectedRole.value && contact.class !== selectedRole.value) return false;
  if (selectedPlan.value && contact.category !== selectedPlan.value)
    return false;

  const mappedStatus = statusFilter.value;
  if (mappedStatus && contact.status !== mappedStatus) return false;

  return true;
};

const normalizeSortValue = (contact: ContactProperties, key?: string) => {
  switch (key) {
    case "user":
      return contact.fullName?.toLowerCase() ?? "";
    case "status":
      return contact.status ?? "";
    case "category":
      return contact.category ?? "";
    case "channel":
      return contact.channel ?? "";
    case "number":
      return (contact.number ?? "").toString().replace(/\D/g, "");
    case "createdAt":
      return contact.createdAt ?? "";
    default:
      return contact.createdAt ?? "";
  }
};

const compareContacts = (a: ContactProperties, b: ContactProperties) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  if (!Number.isNaN(Number(aValue)) && !Number.isNaN(Number(bValue))) {
    const diff = Number(aValue) - Number(bValue);
    return order === "asc" ? diff : -diff;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredContacts = computed<ContactProperties[]>(() => {
  return contactsStore.all
    .map((stored) => cloneContact(stored))
    .filter((contact): contact is ContactProperties => {
      if (!contact) return false;
      if (contact.id === null || contact.id === undefined) return false;
      return matchesFilters(contact);
    });
});

const sortedContacts = computed<ContactProperties[]>(() => {
  const items = [...filteredContacts.value];
  if (items.length > 1) items.sort(compareContacts);
  return items;
});

const displayedContacts = computed<ContactProperties[]>(() => {
  const results = sortedContacts.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;

  return results.slice(start, end);
});

const totalContacts = computed(() => sortedContacts.value.length);

const connectionDirectory = computed(() => {
  const map = new Map<
    string,
    Pick<
      ContactProperties,
      "id" | "fullName" | "picture" | "status" | "channel" | "class"
    >
  >();

  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(String(contact.id), {
      id: contact.id,
      fullName: contact.fullName,
      picture: contact.picture,
      status: contact.status,
      channel: contact.channel,
      class: contact.class,
    });
  });

  return map;
});

type ConnectionDisplay = ContactConnection & {
  displayName: string;
  avatar?: string | null;
  displayStatus?: ContactProperties["status"];
  displayChannel?: ContactProperties["channel"];
  displayClass?: ContactProperties["class"];
};

const decorateConnections = (
  connections: ContactConnection[] | undefined | null
): ConnectionDisplay[] => {
  if (!Array.isArray(connections) || !connections.length) return [];

  const directory = connectionDirectory.value;

  return connections.map((connection) => {
    const entry = directory.get(String(connection.contactId));
    return {
      ...connection,
      displayName: entry?.fullName ?? connection.contactName,
      avatar: entry?.picture ?? connection.picture ?? null,
      displayStatus: entry?.status,
      displayChannel: entry?.channel,
      displayClass: entry?.class,
    };
  });
};
const roles = [
  { title: "All", value: "" },
  { title: "Client", value: "Client" },
  { title: "Contact", value: "Contact" },
  { title: "Lead", value: "Lead" },
  { title: "Supplier", value: "Supplier" },
  { title: "Owner", value: "Owner" },
];
const plans = [
  { title: "All", value: "" },
  { title: "General", value: "General" },
  { title: "Real Estate", value: "Real Estate" },
  { title: "VIP", value: "VIP" },
];

const statusOptions = [
  { title: "All", value: "" },
  { title: "Cold", value: "Cold" },
  { title: "Active", value: "Active" },
  { title: "Lost", value: "Lost" },
];

const resolveClassVariant = (contactClass: string) => {
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

const resolveStatusColor = (status: string) => {
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

const channelColor = (channel: string) => {
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

const cloneContact = (contact: ContactProperties | null | undefined) => {
  if (!contact) return contact ?? null;

  const raw = toRaw(contact) as ContactProperties;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(raw);
    } catch (error) {
      console.warn(
        "structuredClone failed for contact, falling back to JSON:",
        error
      );
    }
  }

  try {
    return JSON.parse(JSON.stringify(raw)) as ContactProperties;
  } catch (error) {
    console.warn("Failed to clone contact payload:", error);
    return { ...raw };
  }
};

const isAddNewUserDrawerVisible = ref(false);
const isContactEditDialogVisible = ref(false);
const selectedContact = ref<ContactProperties | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const addNewContact = (contact: ContactProperties) => {
  // debug: log incoming payload before storing
  // eslint-disable-next-line no-console
  console.log("addNewContact received:", JSON.parse(JSON.stringify(contact)));
  contactsStore.addContact(contact);
  isAddNewUserDrawerVisible.value = false;
};

const deleteContact = (id: number) => {
  contactsStore.removeContact(id);
  const index = selectedRows.value.findIndex((row) => row === id);
  if (index !== -1) selectedRows.value.splice(index, 1);
};

const fetchContactDetails = (id: number | string) => {
  loading.value = true;
  error.value = null;

  const contact = contactsStore.byId(id);
  if (!contact) {
    selectedContact.value = null;
    error.value = "Contact not found";
  } else {
    selectedContact.value = cloneContact(contact);
  }

  loading.value = false;
};

const openEditDialog = (id: number | string) => {
  fetchContactDetails(id);
  if (selectedContact.value) {
    isContactEditDialogVisible.value = true;
  }
};

const saveEditedContact = (payload: ContactProperties) => {
  loading.value = true;
  error.value = null;

  const updated = contactsStore.updateContact(payload.id, payload);
  if (!updated) {
    error.value = "Failed to save contact";
    loading.value = false;
    return;
  }

  isContactEditDialogVisible.value = false;
  selectedContact.value = null;
  loading.value = false;
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy?.[0]?.key;
  orderBy.value = options.sortBy?.[0]?.order;

  // keep dropdown visually in sync with header clicks
  const found = sortOptions.find(
    (opt) => opt.value.key === sortBy.value && opt.value.order === orderBy.value
  );
  selectedSort.value = found?.value;
};
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Contacts</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedRole"
              placeholder="Select Role"
              :items="roles"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedPlan"
              placeholder="Select Category"
              :items="plans"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 15, title: '15' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="(value) => (itemsPerPage = Number(value))"
          />
        </div>

        <VSpacer />

        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField v-model="searchQuery" placeholder="Search Contacts" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddNewUserDrawerVisible = true"
          >
            Add New Contact
          </VBtn>
        </div>
      </VCardText>
      <VDivider />
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedContacts"
        :items-length="totalContacts"
        item-value="id"
        :headers="headers"
        class="text-no-wrap"
        :sort-by="sortBy ? [{ key: sortBy, order: orderBy }] : []"
        @update:options="updateOptions"
      >
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4 pb-2 pt-2">
            <VAvatar
              size="40"
              :variant="!item.picture ? 'tonal' : undefined"
              :color="
                !item.picture
                  ? resolveClassVariant(item.class).color
                  : undefined
              "
            >
              <VImg v-if="item.picture" :src="item.picture" />
              <span v-else>{{ avatarText(item.fullName) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <h6 class="text-base d-flex align-center gap-1">
                <VIcon
                  :icon="
                    item.type === 'Entity'
                      ? 'tabler-building-skyscraper'
                      : 'tabler-user'
                  "
                  size="16"
                  :color="item.type === 'Entity' ? 'warning' : 'primary'"
                />
                <template v-if="item.id !== null && item.id !== undefined">
                  <RouterLink
                    :to="{
                      name: 'apps-contact-view-id',
                      params: { id: item.id },
                    }"
                    class="font-weight-medium text-link"
                  >
                    {{ item.fullName }}
                  </RouterLink>
                </template>
                <template v-else>
                  <span class="font-weight-medium text-high-emphasis">
                    {{ item.fullName }}
                  </span>
                </template>
              </h6>
              <div class="text-sm">
                {{ item.email }}
              </div>
            </div>
          </div>
        </template>

        <template #item.class="{ item }">
          <VChip
            :color="resolveClassVariant(item.class).color"
            size="small"
            variant="tonal"
            class="text-capitalize"
          >
            {{ item.class }}
          </VChip>
        </template>

        <template #item.number="{ item }">
          <a class="text-body-1" :href="`tel:${item.number}`">{{
            item.number
          }}</a>
        </template>

        <template #item.connections="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              v-if="decorateConnections(item.connections).length"
              class="v-avatar-group demo-avatar-group"
            >
              <VAvatar
                v-for="connection in decorateConnections(
                  item.connections
                ).slice(0, 3)"
                :key="`${item.id}-${connection.contactId}`"
                :size="40"
                :color="connection.avatar ? undefined : 'primary'"
                :class="[
                  connection.avatar ? null : 'text-white font-weight-medium',
                  connection.isPrimary ? 'contact-primary-border' : null,
                ]"
              >
                <template v-if="connection.avatar">
                  <VImg :src="connection.avatar" />
                </template>
                <template v-else>
                  <span>{{ avatarText(connection.displayName) }}</span>
                </template>

                <VTooltip activator="parent" location="top">
                  <div class="d-flex flex-column gap-1">
                    <span class="font-weight-medium">
                      {{ connection.displayName }}
                    </span>

                    <span
                      v-if="connection.isPrimary"
                      class="text-body-2 text-medium-emphasis"
                    >
                      <span class="text-primary">(Primary)</span>
                    </span>
                  </div>
                </VTooltip>
              </VAvatar>
            </div>
            <span v-else class="text-medium-emphasis">-</span>

            <VAvatar
              v-if="decorateConnections(item.connections).length > 3"
              color="secondary"
              :size="40"
              class="font-weight-medium text-white"
            >
              +{{ decorateConnections(item.connections).length - 3 }}
              <VTooltip activator="parent" location="top">
                {{
                  decorateConnections(item.connections)
                    .slice(3)
                    .map((connection) => connection.displayName)
                    .join(", ")
                }}
              </VTooltip>
            </VAvatar>
          </div>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="resolveStatusColor(item.status)"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <template #item.channel="{ item }">
          <VChip
            :color="channelColor(item.channel)"
            size="small"
            variant="tonal"
          >
            {{ item.channel }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="openEditDialog(item.id)" :disabled="loading">
            <VIcon icon="tabler-edit" />
          </IconBtn>

          <VBtn icon variant="text" color="medium-emphasis">
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem @click="deleteContact(item.id)">
                  <template #prepend>
                    <VIcon icon="tabler-trash" />
                  </template>
                  <VListItemTitle>Delete</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalContacts"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <AddNewUserDialog
      v-model:is-dialog-visible="isAddNewUserDrawerVisible"
      @submit="addNewContact"
    />

    <ContactEditDialog
      v-if="isContactEditDialogVisible && selectedContact"
      v-model:is-dialog-visible="isContactEditDialogVisible"
      :contact="selectedContact"
      :loading="loading"
      :error="error"
      @submit="saveEditedContact"
    />
  </section>
</template>
<style scoped>
.contact-primary-border {
  --primary-border-color: rgb(var(--v-theme-primary));

  position: relative;
}

.contact-primary-border::after {
  position: absolute;
  border: 2px solid var(--primary-border-color);
  border-radius: inherit;
  content: "";
  inset: -2px;
  pointer-events: none;
}
</style>
