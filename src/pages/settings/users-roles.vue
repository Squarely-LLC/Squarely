<script setup lang="ts">
import RoleCards from "@/views/apps/roles/RoleCards.vue";
import UserList from "@/views/apps/roles/UserList.vue";

definePage({
  meta: {
    action: "read",
    subject: "usersRoles",
  },
});

const activeTab = ref("roles");

const tabs = [
  { title: "Roles", value: "roles", icon: "tabler-lock-access" },
  { title: "Users", value: "users", icon: "tabler-users" },
];
</script>

<template>
  <VRow>
    <VCol cols="12">
      <h4 class="text-h4 mb-1">Users & Roles</h4>
      <p class="text-body-1 mb-0">
        Manage user accounts and role permissions for the current center.
      </p>
    </VCol>

    <VCol cols="12">
      <VTabs v-model="activeTab" class="v-tabs-pill">
        <VTab v-for="tab in tabs" :key="tab.value" :value="tab.value">
          <VIcon :icon="tab.icon" size="20" start />
          {{ tab.title }}
        </VTab>
      </VTabs>
    </VCol>

    <VCol cols="12">
      <VWindow
        v-model="activeTab"
        class="disable-tab-transition"
        :touch="false"
      >
        <VWindowItem value="roles">
          <RoleCards />
        </VWindowItem>

        <VWindowItem value="users">
          <UserList />
        </VWindowItem>
      </VWindow>
    </VCol>
  </VRow>
</template>
