<script setup lang="ts">
import type { ProfileTab } from "@db/pages/profile/types";
import About from "./About.vue";
import ActivityTimeline from "./ActivityTimeline.vue";
import Connection from "./Connection.vue";
import ProjectList from "./ProjectList.vue";
import Teams from "./Teams.vue";

const userData = useCookie<any>("userData");
const profileTabData = ref<ProfileTab>();

const buildProfileData = (): ProfileTab =>
  ({
    about: [
      {
        property: "Full Name",
        value: userData.value?.fullName || userData.value?.username || "User",
        icon: "tabler-user",
      },
      {
        property: "Role",
        value: userData.value?.role || "User",
        icon: "tabler-shield",
      },
      {
        property: "Status",
        value: userData.value?.status || "active",
        icon: "tabler-circle-check",
      },
    ],
    contacts: [
      {
        property: "Email",
        value: userData.value?.email || "--",
        icon: "tabler-mail",
      },
      {
        property: "Employee",
        value: userData.value?.employeeId || userData.value?.personId || "--",
        icon: "tabler-id",
      },
    ],
    teams: [
      {
        property: "Center",
        value: userData.value?.centerId || "--",
      },
    ],
    overview: [
      {
        property: "Temporary Password",
        value: userData.value?.temporaryPassword ? "Yes" : "No",
        icon: "tabler-key",
      },
    ],
    connections: [],
    teamsTech: [],
  }) as unknown as ProfileTab;

const fetchAboutData = async () => {
  profileTabData.value = buildProfileData();
};

watch(userData, fetchAboutData, { immediate: true, deep: true });
</script>

<template>
  <VRow v-if="profileTabData">
    <VCol md="4" cols="12">
      <About :data="profileTabData" />
    </VCol>

    <VCol cols="12" md="8">
      <VRow>
        <VCol cols="12">
          <ActivityTimeline />
        </VCol>

        <VCol cols="12" md="6">
          <Connection :connections-data="profileTabData.connections" />
        </VCol>

        <VCol cols="12" md="6">
          <Teams :teams-data="profileTabData.teamsTech" />
        </VCol>

        <VCol cols="12">
          <ProjectList />
        </VCol>
      </VRow>
    </VCol>
  </VRow>
</template>
