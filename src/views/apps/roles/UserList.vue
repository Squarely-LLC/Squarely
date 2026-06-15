<script setup lang="ts">
import { emailValidator, requiredValidator } from "@/@core/utils/validators";
import { useAccountsStore } from "@/stores/accounts";
import { useNotificationsStore } from "@/stores/notifications";
import { currentUserData } from "@/utils/currentAccount";
import type { AccountStatus } from "@/utils/accountRoles";
import type { VForm } from "vuetify/components/VForm";

const accountsStore = useAccountsStore();
const notifications = useNotificationsStore();
accountsStore.init();

const searchQuery = ref("");
const selectedRole = ref<string | null>(null);
const selectedStatus = ref<AccountStatus | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<any[]>([]);
const selectedRows = ref<number[]>([]);
const isAddUserDialogVisible = ref(false);
const refForm = ref<VForm>();
const isFormValid = ref(false);
const currentAccount = computed(() =>
  accountsStore.userById(currentUserData()?.id) ?? accountsStore.currentCenterUsers[0],
);
const canCreateUsers = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "create"),
);
const canDeleteUsers = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "delete"),
);

const draft = reactive({
  fullName: "",
  email: "",
  roleId: "",
  status: "active" as AccountStatus,
  password: "",
});

const roleOptions = computed(() =>
  accountsStore.currentCenterRoles.map((role) => ({
    title: role.name,
    value: role.id,
  })),
);

const statusOptions = [
  { title: "Active", value: "active" },
  { title: "Pending", value: "pending" },
  { title: "Inactive", value: "inactive" },
];

const headers = [
  { title: "User", key: "user" },
  { title: "Role", key: "role" },
  { title: "Status", key: "status" },
  { title: "Password", key: "temporaryPassword", sortable: false },
  { title: "Actions", key: "actions", sortable: false },
];

const avatarText = (name?: string | null) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const decoratedUsers = computed(() =>
  accountsStore.currentCenterUsers.map((user) => ({
    ...user,
    roleName: accountsStore.roleById(user.roleId)?.name ?? user.roleId,
  })),
);

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return decoratedUsers.value.filter((user) => {
    const matchesQuery = query
      ? [user.fullName, user.email, user.roleName].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        )
      : true;
    const matchesRole = selectedRole.value
      ? user.roleId === selectedRole.value
      : true;
    const matchesStatus = selectedStatus.value
      ? user.status === selectedStatus.value
      : true;

    return matchesQuery && matchesRole && matchesStatus;
  });
});

const displayedUsers = computed(() => {
  const items = [...filteredUsers.value];
  const sort = sortBy.value?.[0];
  if (sort?.key) {
    items.sort((left, right) => {
      const a = String((left as any)[sort.key] ?? "");
      const b = String((right as any)[sort.key] ?? "");
      return sort.order === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    });
  }

  const start = (page.value - 1) * itemsPerPage.value;
  return itemsPerPage.value === -1
    ? items
    : items.slice(start, start + itemsPerPage.value);
});

const resolveUserStatusVariant = (status: string) => {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "inactive") return "secondary";
  return "primary";
};

const resetDraft = () => {
  draft.fullName = "";
  draft.email = "";
  draft.roleId =
    roleOptions.value[1]?.value ?? roleOptions.value[0]?.value ?? "";
  draft.status = "active";
  draft.password = "";
};

const openAddUser = () => {
  if (!canCreateUsers.value) {
    notifications.push("You do not have permission to create users.", "error");
    return;
  }
  resetDraft();
  isAddUserDialogVisible.value = true;
};

const closeAddUser = () => {
  isAddUserDialogVisible.value = false;
  nextTick(() => {
    refForm.value?.resetValidation();
  });
};

const saveUser = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  try {
    const created = accountsStore.createUser({
      ...draft,
      password: draft.password || undefined,
      temporaryPassword: true,
    });
    notifications.push(
      `User created. Temporary password: ${created.password}`,
      "success",
      6000,
    );
    closeAddUser();
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to create user",
      "error",
      4000,
    );
  }
};

const deleteUser = (id: number) => {
  if (!canDeleteUsers.value) {
    notifications.push("You do not have permission to delete users.", "error");
    return;
  }

  try {
    accountsStore.deleteUser(id);
    selectedRows.value = selectedRows.value.filter((row) => row !== id);
    notifications.push("User deleted", "success", 2500);
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to delete user",
      "error",
      3500,
    );
  }
};
</script>

<template>
  <section>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="d-flex gap-2 align-center">
          <p class="text-body-1 mb-0">Show</p>
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 5.5rem"
            @update:model-value="itemsPerPage = Number($event)"
          />
        </div>

        <VSpacer />

        <div class="d-flex align-center flex-wrap gap-4">
          <AppTextField
            v-model="searchQuery"
            placeholder="Search users"
            style="inline-size: 15.625rem"
          />

          <AppSelect
            v-model="selectedRole"
            placeholder="Select Role"
            :items="roleOptions"
            clearable
            clear-icon="tabler-x"
            style="inline-size: 13rem"
          />

          <AppSelect
            v-model="selectedStatus"
            placeholder="Select Status"
            :items="statusOptions"
            clearable
            clear-icon="tabler-x"
            style="inline-size: 10rem"
          />

          <VBtn
            prepend-icon="tabler-plus"
            :disabled="!canCreateUsers"
            @click="openAddUser"
          >
            Add User
          </VBtn>
        </div>
      </VCardText>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        v-model:sort-by="sortBy"
        :items="displayedUsers"
        :items-length="filteredUsers.length"
        :headers="headers"
        class="text-no-wrap"
        show-select
      >
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4">
            <VAvatar
              size="34"
              :variant="!item.avatar ? 'tonal' : undefined"
              :color="!item.avatar ? 'primary' : undefined"
            >
              <VImg v-if="item.avatar" :src="item.avatar" />
              <span v-else>{{ avatarText(item.fullName) }}</span>
            </VAvatar>
            <div class="d-flex flex-column">
              <h6 class="text-base font-weight-medium">
                {{ item.fullName }}
              </h6>
              <div class="text-sm">{{ item.email }}</div>
            </div>
          </div>
        </template>

        <template #item.role="{ item }">
          <VChip size="small" variant="tonal">
            {{ item.roleName }}
          </VChip>
        </template>

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

        <template #item.temporaryPassword="{ item }">
          <VChip
            :color="item.temporaryPassword ? 'warning' : 'success'"
            size="small"
            variant="tonal"
          >
            {{ item.temporaryPassword ? "Temporary" : "Set" }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn
            :disabled="item.isMaster || !canDeleteUsers"
            @click="deleteUser(item.id)"
          >
            <VIcon icon="tabler-trash" />
            <VTooltip activator="parent">
              {{
                item.isMaster
                  ? "Master account cannot be deleted"
                  : !canDeleteUsers
                    ? "No permission to delete users"
                    : "Delete"
              }}
            </VTooltip>
          </IconBtn>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="filteredUsers.length"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog v-model="isAddUserDialogVisible" max-width="560">
      <DialogCloseBtn @click="closeAddUser" />
      <VCard class="pa-sm-8 pa-5">
        <VCardTitle>Add User</VCardTitle>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="saveUser">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="draft.fullName"
                  label="Name"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12">
                <AppTextField
                  v-model="draft.email"
                  label="Email"
                  :rules="[requiredValidator, emailValidator]"
                />
              </VCol>
              <VCol cols="12">
                <AppSelect
                  v-model="draft.roleId"
                  label="Role"
                  :items="roleOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppSelect
                  v-model="draft.status"
                  label="Status"
                  :items="statusOptions"
                  :rules="[requiredValidator]"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="draft.password"
                  label="Temporary Password"
                  placeholder="Auto-generate if empty"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="closeAddUser">
            Cancel
          </VBtn>
          <VBtn color="primary" @click="saveUser">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
