<script setup lang="ts">
import SettingsCheckout from "@/views/apps/configuration/SettingsCheckout.vue";
import SettingsLegal from "@/views/apps/configuration/SettingsLegal.vue";
import SettingsLocations from "@/views/apps/configuration/SettingsLocations.vue";
import SettingsNotifications from "@/views/apps/configuration/SettingsNotifications.vue";
import SettingsPayment from "@/views/apps/configuration/SettingsPayment.vue";
import SettingsShippingAndDelivery from "@/views/apps/configuration/SettingsShippingAndDelivery.vue";

const tabsData = [
  { icon: "tabler-gavel", title: "Legal" },
  { icon: "tabler-credit-card", title: "Payments" },
  { icon: "tabler-shopping-cart", title: "Checkout" },
  { icon: "tabler-discount", title: "Shipping & Delivery" },
  { icon: "tabler-map-pin", title: "Location" },
  { icon: "tabler-bell-ringing", title: "Notifications" },
];

const activeTab = ref(null);
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
          <SettingsPayment />
        </VWindowItem>

        <VWindowItem>
          <SettingsCheckout />
        </VWindowItem>

        <VWindowItem>
          <SettingsShippingAndDelivery />
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
