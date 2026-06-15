<script setup lang="ts">
import { useAccountsStore } from "@/stores/accounts";
import { useNotificationsStore } from "@/stores/notifications";
import { currentUserData } from "@/utils/currentAccount";
import type {
  PermissionAction,
  PermissionScope,
  RolePermission,
  RoleRecord,
} from "@/utils/accountRoles";
import type { VForm } from "vuetify/components/VForm";

const accountsStore = useAccountsStore();
const notifications = useNotificationsStore();
accountsStore.init();

const roles = computed(() => accountsStore.currentCenterRoles);
const currentAccount = computed(() =>
  accountsStore.userById(currentUserData()?.id) ?? accountsStore.currentCenterUsers[0],
);
const canCreateRoles = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "create"),
);
const canUpdateRoles = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "update"),
);
const canDeleteRoles = computed(() =>
  accountsStore.can(currentAccount.value, "usersRoles", "delete"),
);
const isDialogVisible = ref(false);
const editingRoleId = ref<string | null>(null);
const refForm = ref<VForm>();
const isFormValid = ref(false);

const draft = reactive({
  name: "",
  permissions: [] as RolePermission[],
});

const scopeOptions: Array<{ title: string; value: PermissionScope }> = [
  { title: "No Access", value: "none" },
  { title: "All", value: "all" },
  { title: "Owned + Team + Collab.", value: "owned_team_collab" },
  { title: "Owned + Collab.", value: "owned_collab" },
];

const actionOptions: Array<{ title: string; value: PermissionAction }> = [
  { title: "Create", value: "create" },
  { title: "Edit", value: "update" },
  { title: "Delete", value: "delete" },
  { title: "Approve", value: "approve" },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const requiredRoleName = (value: string) =>
  !!String(value ?? "").trim() || "Role name is required";

const avatarText = (name?: string | null) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const roleUsers = (role: RoleRecord) =>
  accountsStore.currentCenterUsers.filter((user) => user.roleId === role.id);

const permissionSummary = (role: RoleRecord) =>
  role.permissions
    .filter((permission) => permission.viewScope !== "none")
    .map((permission) => permission.moduleLabel);

const actionCount = (role: RoleRecord) =>
  role.permissions.reduce(
    (total, permission) => total + permission.actions.length,
    0,
  );

const currentRole = computed(() =>
  editingRoleId.value ? accountsStore.roleById(editingRoleId.value) : null,
);

const canModifyRole = (role?: RoleRecord | null) =>
  !!role &&
  role.name !== "Account Owner / Super Admin" &&
  canUpdateRoles.value;

const openAddRole = () => {
  if (!canCreateRoles.value) {
    notifications.push("You do not have permission to create roles.", "error");
    return;
  }

  const template =
    accountsStore.currentCenterRoles.find((role) => role.name === "Admin") ??
    accountsStore.currentCenterRoles[0];

  editingRoleId.value = null;
  draft.name = "";
  draft.permissions = clone(template?.permissions ?? []);
  isDialogVisible.value = true;
};

const openEditRole = (role: RoleRecord) => {
  if (!canModifyRole(role)) {
    notifications.push("This role cannot be edited.", "error");
    return;
  }

  editingRoleId.value = role.id;
  draft.name = role.name;
  draft.permissions = clone(role.permissions);
  isDialogVisible.value = true;
};

const closeDialog = () => {
  isDialogVisible.value = false;
  nextTick(() => refForm.value?.resetValidation());
};

const saveRole = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  try {
    const permissions = clone(draft.permissions).map((permission) => {
      const actions = new Set(permission.actions);
      if (permission.viewScope !== "none") actions.add("read");
      else actions.delete("read");

      return { ...permission, actions: Array.from(actions) };
    });

    if (editingRoleId.value) {
      accountsStore.updateRole(editingRoleId.value, {
        name: draft.name,
        permissions,
      });
      notifications.push("Role updated", "success", 2500);
    } else {
      accountsStore.createRole({ name: draft.name, permissions });
      notifications.push("Role created", "success", 2500);
    }
    closeDialog();
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to save role",
      "error",
      3500,
    );
  }
};

const deleteRole = (role: RoleRecord) => {
  if (!canDeleteRoles.value) {
    notifications.push("You do not have permission to delete roles.", "error");
    return;
  }

  try {
    accountsStore.deleteRole(role.id);
    notifications.push("Role deleted", "success", 2500);
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to delete role",
      "error",
      3500,
    );
  }
};
</script>

<template>
  <section>
    <div class="d-flex justify-end mb-4">
      <VBtn
        prepend-icon="tabler-plus"
        :disabled="!canCreateRoles"
        @click="openAddRole"
      >
        Add Role
      </VBtn>
    </div>

    <VRow>
      <VCol v-for="role in roles" :key="role.id" cols="12" sm="6" lg="4">
        <VCard>
          <VCardText class="d-flex align-center pb-4">
            <div class="text-body-1">
              Total {{ roleUsers(role).length }} users
            </div>

            <VSpacer />

            <div class="v-avatar-group">
              <VAvatar
                v-for="user in roleUsers(role).slice(0, 3)"
                :key="user.id"
                size="38"
                :image="user.avatar || undefined"
                :color="user.avatar ? undefined : 'primary'"
                :variant="user.avatar ? undefined : 'tonal'"
              >
                <span v-if="!user.avatar">{{ avatarText(user.fullName) }}</span>
              </VAvatar>

              <VAvatar v-if="roleUsers(role).length > 3" color="secondary">
                +{{ roleUsers(role).length - 3 }}
              </VAvatar>
            </div>
          </VCardText>

          <VCardText>
            <div class="d-flex justify-space-between align-start gap-4">
              <div>
                <h5 class="text-h5">
                  {{ role.name }}
                </h5>
                <div class="text-body-2 text-medium-emphasis">
                  {{ actionCount(role) }} allowed actions
                </div>
              </div>

              <VChip
                v-if="role.name.includes('Super Admin')"
                color="primary"
                size="small"
              >
                Master
              </VChip>
            </div>

            <div class="d-flex flex-wrap gap-2 mt-4">
              <VChip
                v-for="module in permissionSummary(role).slice(0, 5)"
                :key="module"
                size="small"
                variant="tonal"
              >
                {{ module }}
              </VChip>
              <VChip
                v-if="permissionSummary(role).length > 5"
                size="small"
                color="secondary"
                variant="tonal"
              >
                +{{ permissionSummary(role).length - 5 }}
              </VChip>
            </div>

            <div class="d-flex gap-2 mt-6">
              <VBtn
                size="small"
                variant="tonal"
                :disabled="!canModifyRole(role)"
                @click="openEditRole(role)"
              >
                Edit Role
              </VBtn>
              <IconBtn
                :disabled="
                  role.name === 'Account Owner / Super Admin' ||
                  !canDeleteRoles ||
                  roleUsers(role).length > 0
                "
                @click="deleteRole(role)"
              >
                <VIcon icon="tabler-trash" />
                <VTooltip activator="parent">
                  {{
                    role.name === "Account Owner / Super Admin"
                      ? "Master role cannot be deleted"
                      : !canDeleteRoles
                        ? "No permission to delete roles"
                      : roleUsers(role).length > 0
                        ? "Assigned roles cannot be deleted"
                        : "Delete role"
                  }}
                </VTooltip>
              </IconBtn>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="isDialogVisible" max-width="900">
      <DialogCloseBtn @click="closeDialog" />
      <VCard class="pa-sm-6 pa-4">
        <VCardTitle>
          {{ currentRole ? "Edit Role" : "Add Role" }}
        </VCardTitle>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="saveRole">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="draft.name"
                  label="Role Name"
                  :rules="[requiredRoleName]"
                />
              </VCol>

              <VCol cols="12">
                <div class="d-flex flex-column gap-3">
                  <div
                    v-for="permission in draft.permissions"
                    :key="permission.module"
                    class="border rounded pa-3"
                  >
                    <VRow align="center">
                      <VCol cols="12" md="3">
                        <div class="font-weight-medium">
                          {{ permission.moduleLabel }}
                        </div>
                        <VCheckbox
                          v-model="permission.restrictedToModule"
                          label="Restricted to module"
                          density="compact"
                          hide-details
                        />
                        <VCheckbox
                          v-model="permission.hideFinancials"
                          label="Hide financials"
                          density="compact"
                          hide-details
                        />
                      </VCol>
                      <VCol cols="12" md="3">
                        <AppSelect
                          v-model="permission.viewScope"
                          label="View Scope"
                          :items="scopeOptions"
                        />
                      </VCol>
                      <VCol cols="12" md="6">
                        <AppSelect
                          v-model="permission.actions"
                          label="Actions"
                          :items="actionOptions"
                          multiple
                          chips
                          clearable
                          clear-icon="tabler-x"
                        />
                      </VCol>
                    </VRow>
                  </div>
                </div>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="closeDialog">
            Cancel
          </VBtn>
          <VBtn color="primary" @click="saveRole">Save</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
