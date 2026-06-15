<script setup lang="ts">
import roleIllustration from "@images/illustrations/standingGirlImg.png";
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
const currentAccount = computed(
  () =>
    accountsStore.userById(currentUserData()?.id) ??
    accountsStore.currentCenterUsers[0],
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

const currentRole = computed(() =>
  editingRoleId.value ? accountsStore.roleById(editingRoleId.value) : null,
);

const canEditRole = (role?: RoleRecord | null) =>
  !!role && canUpdateRoles.value;

const canRemoveRole = (role?: RoleRecord | null) =>
  !!role &&
  !role.system &&
  canDeleteRoles.value &&
  roleUsers(role).length === 0;

const makeCopyName = (name: string) => {
  const base = `${name} Copy`;
  let next = base;
  let suffix = 2;
  const names = new Set(
    roles.value.map((role) => role.name.trim().toLowerCase()),
  );
  while (names.has(next.toLowerCase())) {
    next = `${base} ${suffix}`;
    suffix += 1;
  }

  return next;
};

const openAddRole = () => {
  if (!canCreateRoles.value) {
    notifications.push("You do not have permission to create roles.", "error");
    return;
  }

  const template =
    roles.value.find((role) => role.name === "Admin") ?? roles.value[0];

  editingRoleId.value = null;
  draft.name = "";
  draft.permissions = clone(template?.permissions ?? []);
  isDialogVisible.value = true;
};

const openEditRole = (role: RoleRecord) => {
  if (!canEditRole(role)) {
    notifications.push("This role cannot be edited.", "error");
    return;
  }

  editingRoleId.value = role.id;
  draft.name = role.name;
  draft.permissions = clone(role.permissions);
  isDialogVisible.value = true;
};

const cloneRole = (role: RoleRecord) => {
  if (!canCreateRoles.value) {
    notifications.push("You do not have permission to create roles.", "error");
    return;
  }

  try {
    accountsStore.createRole({
      name: makeCopyName(role.name),
      permissions: clone(role.permissions),
    });
    notifications.push("Role copied", "success", 2500);
  } catch (error) {
    notifications.push(
      error instanceof Error ? error.message : "Unable to copy role",
      "error",
      3500,
    );
  }
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
  if (!canRemoveRole(role)) return;

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

const deleteTooltip = (role: RoleRecord) => {
  if (role.system) return "Default roles cannot be deleted";
  if (!canDeleteRoles.value) return "No permission to delete roles";
  if (roleUsers(role).length > 0) return "Assigned roles cannot be deleted";
  return "Delete role";
};
</script>

<template>
  <section>
    <VRow>
      <VCol cols="12">
        <h4 class="text-h4 mb-1">Roles List</h4>
        <p class="text-body-1 mb-0">
          A role provided access to predefined menus and features so that
          depending on assigned role an administrator can have access to what he
          need
        </p>
      </VCol>

      <VCol v-for="role in roles" :key="role.id" cols="12" sm="6" lg="4">
        <VCard>
          <VCardText class="role-card">
            <div class="d-flex align-center justify-space-between">
              <span class="text-body-1">
                Total {{ roleUsers(role).length }} users
              </span>

              <div class="v-avatar-group">
                <VAvatar
                  v-for="user in roleUsers(role).slice(0, 4)"
                  :key="user.id"
                  size="38"
                  :image="user.avatar || undefined"
                  :color="user.avatar ? undefined : 'primary'"
                  :variant="user.avatar ? undefined : 'tonal'"
                >
                  <span v-if="!user.avatar">{{ avatarText(user.fullName) }}</span>
                </VAvatar>
                <VAvatar v-if="roleUsers(role).length > 4" color="secondary">
                  +{{ roleUsers(role).length - 4 }}
                </VAvatar>
              </div>
            </div>

            <div class="d-flex align-end justify-space-between mt-8">
              <div>
                <h5 class="text-h5 mb-1">{{ role.name }}</h5>
                <VBtn
                  variant="text"
                  density="compact"
                  class="pa-0"
                  :disabled="!canEditRole(role)"
                  @click="openEditRole(role)"
                >
                  Edit Role
                </VBtn>
              </div>

              <div class="d-flex align-center">
                <IconBtn :disabled="!canCreateRoles" @click="cloneRole(role)">
                  <VIcon icon="tabler-copy" />
                  <VTooltip activator="parent">Copy role</VTooltip>
                </IconBtn>
                <IconBtn
                  :disabled="!canRemoveRole(role)"
                  @click="deleteRole(role)"
                >
                  <VIcon icon="tabler-trash" />
                  <VTooltip activator="parent">
                    {{ deleteTooltip(role) }}
                  </VTooltip>
                </IconBtn>
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="4">
        <VCard>
          <VCardText class="add-role-card">
            <img :src="roleIllustration" class="add-role-card__image" alt="" />

            <div class="add-role-card__copy">
              <VBtn
                :disabled="!canCreateRoles"
                class="mb-4"
                @click="openAddRole"
              >
                Add New Role
              </VBtn>
              <div class="text-body-1 text-medium-emphasis">
                Add new role,<br />
                if it doesn't exist.
              </div>
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

<style scoped>
.role-card {
  min-block-size: 154px;
}

.add-role-card {
  display: flex;
  min-block-size: 154px;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
}

.add-role-card__image {
  align-self: flex-end;
  block-size: 130px;
  inline-size: 42%;
  object-fit: contain;
  object-position: bottom left;
}

.add-role-card__copy {
  max-inline-size: 11rem;
  text-align: end;
}
</style>
