<script setup lang="ts">
import { emailValidator, requiredValidator } from "@/@core/utils/validators";
import { useAccountsStore } from "@/stores/accounts";
import { useDealsStore } from "@/stores/deals";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { currentUserData } from "@/utils/currentAccount";
import type { AccountStatus, AccountUserRecord } from "@/utils/accountRoles";
import type { VForm } from "vuetify/components/VForm";

const accountsStore = useAccountsStore();
const notifications = useNotificationsStore();
const todosStore = useTodos();
const dealsStore = useDealsStore();
const jobsStore = useJobsStore();

accountsStore.init();
todosStore.init();
dealsStore.init();
jobsStore.init();

const searchQuery = ref("");
const selectedRole = ref<string | null>(null);
const selectedStatus = ref<AccountStatus | null>(null);
const itemsPerPage = ref(10);
const page = ref(1);
const sortBy = ref<any[]>([]);
const selectedRows = ref<number[]>([]);
const isUserDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
const editingUserId = ref<number | null>(null);
const deleteCandidate = ref<AccountUserRecord | null>(null);
const refForm = ref<VForm>();
const isFormValid = ref(false);
const revealedPasswords = ref(new Set<number>());
const dialogPasswordVisible = ref(false);

const currentAccount = computed(
  () =>
    accountsStore.userById(currentUserData()?.id) ??
    accountsStore.currentCenterUsers[0],
);
const canCreateUsers = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "create"),
);
const canUpdateUsers = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "update"),
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
  { title: "Temporary Password", key: "temporaryPassword", sortable: false },
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
          String(value ?? "").toLowerCase().includes(query),
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

const editingUser = computed(() =>
  editingUserId.value ? accountsStore.userById(editingUserId.value) : null,
);

const resolveUserStatusVariant = (status: string) => {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "inactive") return "secondary";
  return "primary";
};

const defaultRoleId = () =>
  roleOptions.value[1]?.value ?? roleOptions.value[0]?.value ?? "";

const resetDraft = () => {
  draft.fullName = "";
  draft.email = "";
  draft.roleId = defaultRoleId();
  draft.status = "active";
  draft.password = "";
  dialogPasswordVisible.value = false;
};

const openAddUser = () => {
  if (!canCreateUsers.value) {
    notifications.push("You do not have permission to create users.", "error");
    return;
  }
  editingUserId.value = null;
  resetDraft();
  isUserDialogVisible.value = true;
};

const openEditUser = (user: AccountUserRecord) => {
  if (!canUpdateUsers.value) {
    notifications.push("You do not have permission to edit users.", "error");
    return;
  }

  editingUserId.value = Number(user.id);
  draft.fullName = user.fullName;
  draft.email = user.email;
  draft.roleId = user.roleId;
  draft.status = user.status;
  draft.password = "";
  dialogPasswordVisible.value = false;
  isUserDialogVisible.value = true;
};

const closeUserDialog = () => {
  isUserDialogVisible.value = false;
  nextTick(() => refForm.value?.resetValidation());
};

const copyText = async (value: string, message = "Copied") => {
  if (!value) return;
  try {
    await navigator.clipboard?.writeText(value);
    notifications.push(message, "success", 2000);
  } catch {
    notifications.push("Unable to copy", "error", 2500);
  }
};

const togglePassword = (id: number) => {
  const next = new Set(revealedPasswords.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  revealedPasswords.value = next;
};

const maskedPassword = (user: AccountUserRecord) =>
  user.temporaryPassword && revealedPasswords.value.has(Number(user.id))
    ? user.password
    : "••••••••";

const saveUser = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  try {
    if (editingUser.value) {
      accountsStore.updateUser(editingUser.value.id, {
        fullName: draft.fullName,
        email: draft.email,
        roleId: draft.roleId,
        status: draft.status,
        password: draft.password || undefined,
        temporaryPassword: draft.password ? true : undefined,
      });
      notifications.push("User updated", "success", 2500);
    } else {
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
    }
    closeUserDialog();
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to save user",
      "error",
      4000,
    );
  }
};

const idMatches = (value: unknown, user: AccountUserRecord) => {
  const candidates = [
    user.id,
    user.employeeId,
    user.personId,
    user.email,
    user.fullName,
  ]
    .filter((entry) => entry !== undefined && entry !== null && entry !== "")
    .map((entry) => String(entry).toLowerCase());

  if (value && typeof value === "object") {
    const raw = value as any;
    return [raw.id, raw.employeeId, raw.personId, raw.email, raw.name].some(
      (entry) =>
        entry !== undefined &&
        entry !== null &&
        candidates.includes(String(entry).toLowerCase()),
    );
  }

  return candidates.includes(String(value ?? "").toLowerCase());
};

const linkedDataWarnings = (user: AccountUserRecord) => {
  const warnings: string[] = [];

  if (user.employeeId || user.personId)
    warnings.push("Linked HR employee/person record");

  if (
    todosStore.all.some(
      (todo) =>
        todo.collaborators?.some((entry) => idMatches(entry, user)) ||
        todo.steps?.some((step) =>
          step.collaborators?.some((entry) => idMatches(entry, user)),
        ) ||
        todo.messages?.some((message) => idMatches(message.author, user)) ||
        todo.activities?.some((activity) => idMatches(activity.author, user)),
    )
  )
    warnings.push("Task assignment, messages, or activity");

  if (
    dealsStore.all.some(
      (deal) =>
        idMatches(deal.salesman, user) ||
        deal.collaborators?.some((entry) => idMatches(entry, user)),
    )
  )
    warnings.push("Deal collaborator or salesman usage");

  if (
    jobsStore.all.some((job) =>
      job.collaborators?.some((entry) => idMatches(entry, user)),
    )
  )
    warnings.push("Job collaborator usage");

  if (
    accountsStore.users.some((entry) => idMatches(entry.createdBy, user))
  )
    warnings.push("Created user account references");

  return warnings;
};

const deleteWarnings = computed(() =>
  deleteCandidate.value ? linkedDataWarnings(deleteCandidate.value) : [],
);

const openDeleteUser = (user: AccountUserRecord) => {
  if (!canDeleteUsers.value) {
    notifications.push("You do not have permission to delete users.", "error");
    return;
  }
  if (user.isMaster) {
    notifications.push("The master account cannot be deleted.", "error");
    return;
  }

  deleteCandidate.value = user;
  isDeleteDialogVisible.value = true;
};

const confirmDeleteUser = () => {
  if (!deleteCandidate.value) return;

  try {
    accountsStore.deleteUser(deleteCandidate.value.id);
    selectedRows.value = selectedRows.value.filter(
      (row) => row !== deleteCandidate.value?.id,
    );
    notifications.push("User deleted", "success", 2500);
    isDeleteDialogVisible.value = false;
    deleteCandidate.value = null;
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
          <div v-if="item.temporaryPassword" class="d-flex align-center gap-1">
            <code class="text-sm">{{ maskedPassword(item) }}</code>
            <IconBtn size="small" @click="togglePassword(Number(item.id))">
              <VIcon
                :icon="
                  revealedPasswords.has(Number(item.id)) ? 'tabler-eye-off' : 'tabler-eye'
                "
                size="18"
              />
              <VTooltip activator="parent">
                {{ revealedPasswords.has(Number(item.id)) ? "Hide" : "Reveal" }}
              </VTooltip>
            </IconBtn>
            <IconBtn
              size="small"
              @click="copyText(item.password, 'Temporary password copied')"
            >
              <VIcon icon="tabler-copy" size="18" />
              <VTooltip activator="parent">Copy temporary password</VTooltip>
            </IconBtn>
          </div>
          <VChip v-else color="success" size="small" variant="tonal">
            Set
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn :disabled="!canUpdateUsers" @click="openEditUser(item)">
            <VIcon icon="tabler-edit" />
            <VTooltip activator="parent">Edit user</VTooltip>
          </IconBtn>
          <IconBtn
            :disabled="item.isMaster || !canDeleteUsers"
            @click="openDeleteUser(item)"
          >
            <VIcon icon="tabler-trash" />
            <VTooltip activator="parent">
              {{
                item.isMaster
                  ? "Master account cannot be deleted"
                  : !canDeleteUsers
                    ? "No permission to delete users"
                    : "Delete user"
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

    <VDialog v-model="isUserDialogVisible" max-width="620">
      <DialogCloseBtn @click="closeUserDialog" />
      <VCard class="pa-sm-8 pa-5">
        <VCardTitle>{{ editingUser ? "Edit User" : "Add User" }}</VCardTitle>
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
                  :disabled="!!editingUser?.isMaster"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppSelect
                  v-model="draft.status"
                  label="Status"
                  :items="statusOptions"
                  :rules="[requiredValidator]"
                  :disabled="!!editingUser?.isMaster"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="draft.password"
                  :type="dialogPasswordVisible ? 'text' : 'password'"
                  :label="
                    editingUser
                      ? 'Reset Temporary Password'
                      : 'Temporary Password'
                  "
                  placeholder="Auto-generate if empty"
                  :append-inner-icon="
                    dialogPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'
                  "
                  @click:append-inner="
                    dialogPasswordVisible = !dialogPasswordVisible
                  "
                />
              </VCol>
              <VCol v-if="draft.password" cols="12">
                <VAlert color="warning" variant="tonal">
                  <div class="d-flex align-center justify-space-between gap-3">
                    <span>
                      Temporary password:
                      <code>{{
                        dialogPasswordVisible ? draft.password : "••••••••"
                      }}</code>
                    </span>
                    <VBtn
                      size="small"
                      variant="tonal"
                      prepend-icon="tabler-copy"
                      @click="copyText(draft.password, 'Temporary password copied')"
                    >
                      Copy
                    </VBtn>
                  </div>
                </VAlert>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="closeUserDialog">
            Cancel
          </VBtn>
          <VBtn color="primary" @click="saveUser">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="isDeleteDialogVisible" max-width="540">
      <DialogCloseBtn @click="isDeleteDialogVisible = false" />
      <VCard class="pa-sm-8 pa-5">
        <VCardTitle>Delete user</VCardTitle>
        <VCardText v-if="deleteCandidate">
          <p class="mb-4">
            Are you sure you want to delete
            <strong>{{ deleteCandidate.fullName }}</strong>?
          </p>
          <VAlert
            v-if="deleteWarnings.length"
            color="warning"
            variant="tonal"
            class="mb-0"
          >
            This account has linked data:
            <ul class="mt-2 mb-0 ps-4">
              <li v-for="warning in deleteWarnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
            The login account will be deleted, but linked people/HR data will
            remain.
          </VAlert>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            color="secondary"
            @click="isDeleteDialogVisible = false"
          >
            Cancel
          </VBtn>
          <VBtn variant="tonal" color="error" @click="confirmDeleteUser">
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
