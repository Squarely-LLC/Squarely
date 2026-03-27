<!-- Contacts page (your original, with tiny additions only) -->
<!-- stylelint-disable @stylistic/declaration-block-trailing-semicolon -->
<script setup lang="ts">
import UserInfoEditDialog from "@/components/dialogs/UserInfoEditDialog.vue";
import AddNewUserDrawer from "@/views/apps/user/list/AddNewUserDrawer.vue";
import UserInfoAddDialog from "@/views/apps/user/list/UserInfoAddDialog.vue";
import type { UserProperties } from "@db/apps/users/types";
import { computed, ref, watch } from "vue";

// 👉 Filters / controls
const searchQuery = ref("");
const selectedRole = ref<any>();
const selectedPlan = ref<any>();
const selectedStatus = ref<any>();
const isUserInfoAddDialogVisible = ref(false);
// --- Sort dropdown options ---
type SortVal = { key: string; order: "asc" | "desc" };
const sortOptions = [
  { title: "Name (A–Z)", value: { key: "user", order: "asc" } as SortVal },
  { title: "Name (Z–A)", value: { key: "user", order: "desc" } as SortVal },
  // Use createdAt if available on your API. If not, replace key with 'id'.
  {
    title: "Recently Added",
    value: { key: "createdAt", order: "desc" } as SortVal,
  },
];
const selectedSort = ref<SortVal | undefined>(sortOptions[2].value);

// 👉 Data table options
const itemsPerPage = ref(15);
const page = ref(1);
const sortBy = ref<string | undefined>(selectedSort.value?.key);
const orderBy = ref<"asc" | "desc" | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

// Keep table/server in sync when dropdown changes
watch(selectedSort, (val) => {
  if (!val) {
    sortBy.value = undefined;
    orderBy.value = undefined;
  } else {
    sortBy.value = val.key;
    orderBy.value = val.order;
  }
  page.value = 1;
  fetchUsers();
});

// Headers
const headers = [
  { title: "Name", key: "user" },
  { title: "Number", key: "contact" },
  { title: "Connections", key: "connection" },

  { title: "Status", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];

// 👉 Fetching users
const { data: usersData, execute: fetchUsers } = await useApi<any>(
  createUrl("/apps/users", {
    query: {
      q: searchQuery,
      status: selectedStatus,
      sort: selectedSort, // kept if your backend also reads this; otherwise remove
      plan: selectedPlan,
      role: selectedRole,
      itemsPerPage,
      page,
      sortBy,
      orderBy,
    },
  })
);

// Safe fallbacks for initial render
const users = computed((): UserProperties[] => usersData.value?.users ?? []);
const totalUsers = computed(() => usersData.value?.totalUsers ?? 0);

// 👉 search filters
const roles = [
  { title: "All", value: "" },
  { title: "Client", value: "Client" },
  { title: "Contact", value: "Contact" },
  { title: "Lead", value: "maintainer" },
  { title: "Supplier", value: "subscriber" },
];

const plans = [
  { title: "All", value: "" },
  { title: "General", value: "company" },
  { title: "Real Estate", value: "enterprise" },
  { title: "VIP", value: "team" },
];

const status = [
  { title: "Cold", value: "pending" },
  { title: "Active", value: "active" },
  { title: "Lost", value: "inactive" },
];

// 👉 Keep server in sync when other filters/pagination change
watch(
  [
    searchQuery,
    selectedRole,
    selectedPlan,
    selectedStatus,
    itemsPerPage,
    page,
    sortBy,
    orderBy,
  ],
  () => fetchUsers()
);

// Update data table options (header clicks)
const updateOptions = (options: any) => {
  sortBy.value = options.sortBy?.[0]?.key;
  orderBy.value = options.sortBy?.[0]?.order;

  // keep dropdown visually in sync with header clicks
  const found = sortOptions.find(
    (o) => o.value.key === sortBy.value && o.value.order === orderBy.value
  );
  selectedSort.value = found?.value;
};

const resolveUserRoleVariant = (role: string) => {
  const roleLowerCase = role.toLowerCase();
  if (roleLowerCase === "subscriber")
    return { color: "success", icon: "tabler-user" };
  if (roleLowerCase === "author")
    return { color: "error", icon: "tabler-device-desktop" };
  if (roleLowerCase === "maintainer")
    return { color: "info", icon: "tabler-chart-pie" };
  if (roleLowerCase === "editor")
    return { color: "warning", icon: "tabler-edit" };
  if (roleLowerCase === "admin")
    return { color: "primary", icon: "tabler-crown" };
  return { color: "primary", icon: "tabler-user" };
};

const resolveUserStatusVariant = (stat: string) => {
  const statLowerCase = stat.toLowerCase();
  if (statLowerCase === "pending") return "warning";
  if (statLowerCase === "active") return "success";
  if (statLowerCase === "inactive") return "secondary";
  return "primary";
};

const isAddNewUserDrawerVisible = ref(false);

// 👉 Add new user
const addNewUser = async (userData: UserProperties) => {
  await $api("/apps/users", {
    method: "POST",
    body: userData,
  });
  fetchUsers();
};

// 👉 Delete user
const deleteUser = async (id: number) => {
  await $api(`/apps/users/${id}`, { method: "DELETE" });
  const index = selectedRows.value.findIndex((row) => row === id);
  if (index !== -1) selectedRows.value.splice(index, 1);
  fetchUsers();
};

const widgetData = ref([
  {
    title: "Session",
    value: "21,459",
    change: 29,
    desc: "Total Users",
    icon: "tabler-users",
    iconColor: "primary",
  },
  {
    title: "Paid Users",
    value: "4,567",
    change: 18,
    desc: "Last Week Analytics",
    icon: "tabler-user-plus",
    iconColor: "error",
  },
  {
    title: "Active Users",
    value: "19,860",
    change: -14,
    desc: "Last Week Analytics",
    icon: "tabler-user-check",
    iconColor: "success",
  },
  {
    title: "Pending Users",
    value: "237",
    change: 42,
    desc: "Last Week Analytics",
    icon: "tabler-user-search",
    iconColor: "warning",
  },
]);

/* ==================== EDIT DIALOG (minimal additions) ==================== */
const isUserInfoEditDialogVisible = ref(false); // ADDED
const selectedUser = ref<any>(undefined); // ADDED (undefined to avoid null crash in dialog)
const loading = ref(false); // ADDED
const error = ref<string | null>(null); // ADDED

// ADDED — unwrap `useApi` result safely and only open dialog once data exists
const fetchUserData = async (userId: string | number) => {
  try {
    loading.value = true;
    error.value = null;

    const api = await useApi<any>(`/apps/users/${userId}`);
    const raw = api?.data?.value ?? api?.data ?? null;

    if (!raw) {
      console.warn(`No data returned for user ${userId}`);
      selectedUser.value = undefined;
      return;
    }

    // Ensure fullName for your dialog (it uses fullName to split names)
    if (!raw.fullName) {
      const first = raw.firstName ?? "";
      const last = raw.lastName ?? "";
      raw.fullName = [first, last].filter(Boolean).join(" ").trim();
    }

    selectedUser.value = raw;
  } catch (err) {
    console.error("Failed to fetch user:", err);
    error.value = "Failed to load user data";
    selectedUser.value = undefined;
  } finally {
    loading.value = false;
  }
};

// ADDED — fetch first, then open only when we have data
const openEditDialog = async (id: number | string) => {
  await fetchUserData(id);
  if (selectedUser.value) {
    isUserInfoEditDialogVisible.value = true;
  } else {
    console.error("User data is empty or invalid — dialog not opened.");
  }
};

// ADDED — keep your save path intact (dialog emits `submit`)
const saveEditedUser = async (payload: any) => {
  try {
    loading.value = true;
    await $api(`/apps/users/${payload.id}`, { method: "PUT", body: payload });
    isUserInfoEditDialogVisible.value = false;
    selectedUser.value = undefined;
    await fetchUsers();
  } catch (err) {
    console.error(err);
    error.value = "Failed to save user data";
  } finally {
    loading.value = false;
  }
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
          <!-- 👉 Select Role -->
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedRole"
              placeholder="Select Role"
              :items="roles"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <!-- 👉 Select Plan -->
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedPlan"
              placeholder="Select Category"
              :items="plans"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <!-- 👉 Select Status -->
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="status"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <!-- 👉 Sort By (A–Z, Z–A, Recently Added) -->
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
              clearable
              clear-icon="tabler-x"
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
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="itemsPerPage = parseInt($event, 10)"
          />
        </div>

        <VSpacer />

        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <!-- 👉 Search  -->
          <div style="inline-size: 15.625rem">
            <AppTextField v-model="searchQuery" placeholder="Search Contacts" />
          </div>

          <!-- 👉 Export button -->
          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <!-- 👉 Add user button -->
          <VBtn
            prepend-icon="tabler-plus"
            @click="isUserInfoAddDialogVisible = !isUserInfoAddDialogVisible"
          >
            Add New Contact
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <!-- SECTION datatable -->
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="users"
        item-value="id"
        :items-length="totalUsers"
        :headers="headers"
        class="text-no-wrap"
        :sort-by="sortBy ? [{ key: sortBy, order: orderBy }] : []"
        @update:options="updateOptions"
      >
        <!-- User -->
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4">
            <VAvatar
              size="34"
              :variant="!item.avatar ? 'tonal' : undefined"
              :color="
                !item.avatar
                  ? resolveUserRoleVariant(item.role).color
                  : undefined
              "
            >
              <VImg v-if="item.avatar" :src="item.avatar" />
              <span v-else>{{ avatarText(item.fullName) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <h6 class="text-base">
                <RouterLink
                  :to="{ name: 'apps-user-view-id', params: { id: item.id } }"
                  class="font-weight-medium text-link"
                >
                  {{ item.fullName }}
                </RouterLink>
              </h6>
              <div class="text-sm">
                {{ item.email }}
              </div>
            </div>
          </div>
        </template>

        <!-- 👉 Role -->
        <template #item.contact="{ item }">
          <div class="d-flex align-center gap-x-2">
            <div class="text-capitalize text-high-emphasis text-body-1">
              <a href="tel:+96170123456">+ {{ item.contact }}</a>
            </div>
          </div>
        </template>

        <!-- 👉 Role -->
        <template #item.role="{ item }">
          <div class="d-flex align-center gap-x-2">
            <VIcon
              :size="22"
              :icon="resolveUserRoleVariant(item.role).icon"
              :color="resolveUserRoleVariant(item.role).color"
            />
            <div class="text-capitalize text-high-emphasis text-body-1">
              <a href="tel:+96170123456">+ {{ item.contact }}</a>
            </div>
          </div>
        </template>

        <!-- Plan -->
        <template #item.plan="{ item }">
          <div class="text-body-1 text-high-emphasis text-capitalize">
            {{ item.currentPlan }}
          </div>
        </template>

        <!-- Status -->
        <template #item.status="{ item }">
          <VChip
            :color="resolveUserStatusVariant(item.status)"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <IconBtn>
            <!-- CHANGED: open dialog (instead of redirect) -->
            <VIcon icon="tabler-edit" @click="openEditDialog(item.id)" />
          </IconBtn>

          <VBtn icon variant="text" color="medium-emphasis">
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem link>
                  <template #prepend>
                    <VIcon icon="tabler-notes" />
                  </template>
                  <VListItemTitle>Task</VListItemTitle>
                </VListItem>

                <VListItem @click="deleteUser(item.id)">
                  <template #prepend>
                    <VIcon icon="tabler-calendar-plus" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>

                <VListItem>
                  <template #prepend>
                    <VIcon icon="tabler-mail" />
                  </template>
                  <VListItemTitle>Email</VListItemTitle>
                </VListItem>

                <VListItem>
                  <template #prepend>
                    <VIcon icon="tabler-phone" />
                  </template>
                  <VListItemTitle>Call</VListItemTitle>
                </VListItem>
                <VDivider />
                <VListItem>
                  <template #prepend>
                    <VIcon icon="tabler-notebook" />
                  </template>
                  <VListItemTitle>Notes</VListItemTitle>
                </VListItem>
                <VListItem>
                  <template #prepend>
                    <VIcon icon="tabler-contract" />
                  </template>
                  <VListItemTitle>Deals</VListItemTitle>
                </VListItem>
                <VListItem>
                  <template #prepend>
                    <VIcon icon="tabler-moneybag" />
                  </template>
                  <VListItemTitle>Purchases</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <!-- pagination -->
        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalUsers"
          />
        </template>
      </VDataTableServer>
      <!-- SECTION -->
    </VCard>

    <!-- 👉 Add New User -->
    <AddNewUserDrawer
      v-model:is-drawer-open="isAddNewUserDrawerVisible"
      @user-data="addNewUser"
    />

    <UserInfoAddDialog
      v-model:is-dialog-visible="isUserInfoAddDialogVisible"
      @user-data="addNewUser"
    />

    <!-- 👉 Edit User (mount only when data is ready) -->
    <UserInfoEditDialog
      v-if="isUserInfoEditDialogVisible && selectedUser"
      v-model:is-dialog-visible="isUserInfoEditDialogVisible"
      :user-data="selectedUser"
      @submit="saveEditedUser"
    />
  </section>
</template>
