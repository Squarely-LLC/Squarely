<script setup lang="ts">
import { onMounted, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";

import AddRecordDrawer from "@/views/apps/contact/view/AddRecordDrawer.vue";
import EditRecordDrawer from "@/views/apps/contact/view/EditRecordDrawer.vue";
import UserBioPanel from "@/views/apps/contact/view/UserBioPanel.vue";
import UserTabAccount from "@/views/apps/contact/view/UserTabAccount.vue";
import UserTabDocuments from "@/views/apps/contact/view/UserTabDocuments.vue";
import UserTabNotifications from "@/views/apps/contact/view/UserTabNotifications.vue";
import UserTabRecords from "@/views/apps/contact/view/UserTabRecords.vue";

const route = useRoute("apps-contact-view-id");
const router = useRouter();
const contactsStore = useContactsStore();
contactsStore.init();

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

const contact = ref<ContactProperties | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const resolveContact = () => {
  loading.value = true;
  const found = contactsStore.byId(route.params.id);

  if (found) {
    contact.value = cloneContact(found);
    error.value = null;
  } else {
    contact.value = null;
    error.value = "Contact not found.";
  }

  loading.value = false;
};

const userTab = ref<number | null>(null);

// stable keys for tabs used in the URL query param (order must match `tabs`)
const tabKeys = ["account", "documents", "records", "notifications"] as const;

const tabs = [
  { icon: "tabler-users", title: "Account" },
  { icon: "tabler-folder", title: "Documents" },
  { icon: "tabler-file-text", title: "Records" },

  { icon: "tabler-bell", title: "Notifications" },
] as const;

const userTabRecordsRef = ref<InstanceType<typeof UserTabRecords> | null>(null);
const isAddRecordDrawerOpen = ref(false);
const addRecordInitial = ref<any | null>(null);
const isEditRecordDrawerOpen = ref(false);
const editRecordInitial = ref<any | null>(null);

function handleAddRecordRequest() {
  addRecordInitial.value = null;
  isAddRecordDrawerOpen.value = true;
}

async function handleAddRecordSave(payload: any) {
  if (!userTabRecordsRef.value) return;
  try {
    await userTabRecordsRef.value.handleSaveRecord(payload);
  } finally {
    isAddRecordDrawerOpen.value = false;
    addRecordInitial.value = null;
  }
}

function handleAddRecordDrawerUpdate(val: boolean) {
  isAddRecordDrawerOpen.value = val;
  if (!val) addRecordInitial.value = null;
}

function handleEditRecordRequest(record: any) {
  editRecordInitial.value = record;
  isEditRecordDrawerOpen.value = true;
}

async function handleEditRecordSave(payload: any) {
  if (!userTabRecordsRef.value) return;
  try {
    await userTabRecordsRef.value.handleSaveRecord(payload);
  } finally {
    isEditRecordDrawerOpen.value = false;
    editRecordInitial.value = null;
  }
}

function handleEditRecordDrawerUpdate(val: boolean) {
  isEditRecordDrawerOpen.value = val;
  if (!val) editRecordInitial.value = null;
}

const setTabFromQuery = () => {
  try {
    const q = String(route.query.tab || tabKeys[0]);
    const idx = (tabKeys as readonly string[]).indexOf(q);
    userTab.value = idx === -1 ? 0 : idx;
  } catch (e) {
    userTab.value = 0;
  }
};

onMounted(() => {
  resolveContact();
  setTabFromQuery();
});
watch(() => route.params.id, resolveContact);
watch(
  () => contactsStore.byId(route.params.id),
  (value) => {
    if (!value) {
      contact.value = null;
      error.value = "Contact not found.";
      return;
    }
    contact.value = cloneContact(value);
    error.value = null;
  }
);

// keep userTab in sync with the route query param
watch(
  () => route.query.tab,
  () => {
    setTabFromQuery();
  }
);

// update the route when the user changes tabs
watch(
  () => userTab.value,
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
  <VRow v-if="contact">
    <VCol cols="12" md="5" lg="4">
      <UserBioPanel :user-data="contact" />
    </VCol>

    <VCol cols="12" md="7" lg="8">
      <VTabs v-model="userTab" class="v-tabs-pill">
        <VTab v-for="tab in tabs" :key="tab.icon">
          <VIcon :size="18" :icon="tab.icon" class="me-1" />
          <span>{{ tab.title }}</span>
        </VTab>
      </VTabs>

      <VWindow
        v-model="userTab"
        class="mt-6 disable-tab-transition"
        :touch="false"
      >
        <VWindowItem>
          <UserTabAccount :user="contact" />
        </VWindowItem>

        <VWindowItem>
          <UserTabDocuments :user="contact" />
        </VWindowItem>

        <VWindowItem>
          <UserTabRecords
            ref="userTabRecordsRef"
            :user="contact"
            @open-add-record="handleAddRecordRequest"
            @edit-record="handleEditRecordRequest"
          />
        </VWindowItem>

        <VWindowItem>
          <UserTabNotifications />
        </VWindowItem>
      </VWindow>
    </VCol>
  </VRow>
  <div v-else>
    <VAlert type="error" variant="tonal">
      Contact with ID {{ route.params.id }} not found!
    </VAlert>
  </div>

  <AddRecordDrawer
    :isDrawerOpen="isAddRecordDrawerOpen"
    :initial="addRecordInitial"
    @update:isDrawerOpen="handleAddRecordDrawerUpdate"
    @save="handleAddRecordSave"
  />

  <EditRecordDrawer
    :isDrawerOpen="isEditRecordDrawerOpen"
    :initial="editRecordInitial"
    @update:isDrawerOpen="handleEditRecordDrawerUpdate"
    @save="handleEditRecordSave"
  />
</template>
