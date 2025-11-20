<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import SettingsCRM from "@/views/apps/configuration/SettingsCRM.vue";
import SettingsFinancial from "@/views/apps/configuration/SettingsFinancial.vue";
import SettingsHR from "@/views/apps/configuration/SettingsHR.vue";
import SettingsLegal from "@/views/apps/configuration/SettingsLegal.vue";
import SettingsLocations from "@/views/apps/configuration/SettingsLocations.vue";
import SettingsNotifications from "@/views/apps/configuration/SettingsNotifications.vue";

const route = useRoute();
const router = useRouter();

const tabsData = [
  { icon: "tabler-gavel", title: "Legal" },
  { icon: "tabler-currency-dollar", title: "Financial" },
  { icon: "tabler-man", title: "Human Ressources" },
  { icon: "tabler-hierarchy", title: "CRM" },
  { icon: "tabler-map-pin", title: "Location" },
  { icon: "tabler-bell-ringing", title: "Notifications" },
];

// stable keys for tabs used in the URL query param (order must match tabsData)
const tabKeys = [
  "legal",
  "financial",
  "HR",
  "CRM",
  "location",
  "notifications",
] as const;

const activeTab = ref<number | null>(null);

const setTabFromQuery = () => {
  try {
    const q = String(route.query.tab || tabKeys[0]);
    const idx = (tabKeys as readonly string[]).indexOf(q);
    activeTab.value = idx === -1 ? 0 : idx;
  } catch (e) {
    activeTab.value = 0;
  }
};

onMounted(() => {
  setTabFromQuery();
});

// keep activeTab in sync with the route query param
watch(
  () => route.query.tab,
  () => {
    setTabFromQuery();
  }
);

// update the route when the user changes tabs
watch(
  () => activeTab.value,
  (val) => {
    if (val == null) return;
    const key = (tabKeys as readonly string[])[val] || tabKeys[0];
    if (String(route.query.tab) === key) return;
    try {
      router.replace({
        name: route.name as any,
        params: route.params,
        query: { ...(route.query || {}), tab: key },
      });
    } catch (e) {
      // ignore router replace errors
    }
  }
);
</script>

<template>
  <VRow>
    <VCol cols="12" md="4">
      <h5 class="text-h5 mb-4">Configurations</h5>

      <VTabs
        v-model="activeTab"
        direction="vertical"
        class="v-tabs-pill disable-tab-transition"
      >
        <VTab
          v-for="(tabItem, index) in tabsData"
          :key="index"
          :prepend-icon="tabItem.icon"
        >
          {{ tabItem.title }}
        </VTab>
      </VTabs>
    </VCol>

    <VCol cols="12" md="8">
      <VWindow
        v-model="activeTab"
        class="disable-tab-transition"
        :touch="false"
      >
        <VWindowItem>
          <SettingsLegal />
        </VWindowItem>

        <VWindowItem>
          <SettingsFinancial />
        </VWindowItem>

        <VWindowItem>
          <SettingsHR />
        </VWindowItem>

        <VWindowItem>
          <SettingsCRM />
        </VWindowItem>

        <VWindowItem>
          <SettingsLocations />
        </VWindowItem>

        <VWindowItem>
          <SettingsNotifications />
        </VWindowItem>
      </VWindow>
    </VCol>
  </VRow>
</template>

<style lang="scss">
.my-class {
  padding: 1.25rem;
  border-radius: 0.375rem;
  background-color: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}
</style>
