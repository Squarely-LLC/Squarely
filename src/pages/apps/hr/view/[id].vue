<script setup lang="ts">
import { onMounted, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";

import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";

import AddRecordDrawer from "@/views/apps/hr/view/AddRecordDrawer.vue";
import EditRecordDrawer from "@/views/apps/hr/view/EditRecordDrawer.vue";
import UserBioPanel from "@/views/apps/hr/view/UserBioPanel.vue";
import UserTabAccount from "@/views/apps/hr/view/UserTabAccount.vue";
import UserTabDocuments from "@/views/apps/hr/view/UserTabDocuments.vue";
import UserTabNotifications from "@/views/apps/hr/view/UserTabNotifications.vue";
import UserTabRecords from "@/views/apps/hr/view/UserTabRecords.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";

const route = useRoute("apps-hr-view-id");
const router = useRouter();
const employeesStore = useEmployeesStore();
employeesStore.init();

const cloneContact = (contact: EmployeeProperties | null | undefined) => {
  if (!contact) return contact ?? null;

  const raw = toRaw(contact) as EmployeeProperties;

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
    return JSON.parse(JSON.stringify(raw)) as EmployeeProperties;
  } catch (error) {
    console.warn("Failed to clone contact payload:", error);
    return { ...raw };
  }
};

const contact = ref<EmployeeProperties | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const resolveContact = () => {
  loading.value = true;
  const found = employeesStore.byId(route.params.id);

  if (found) {
    contact.value = cloneContact(found);
    error.value = null;
  } else {
    contact.value = null;
    error.value = "Employee not found.";
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

const userTabDocumentsRef =
  ref<InstanceType<typeof UserTabDocuments> | null>(null);
const userTabRecordsRef = ref<InstanceType<typeof UserTabRecords> | null>(null);
const addTodoDrawerRef =
  ref<InstanceType<typeof AddNewToDoDrawer> | null>(null);
const isAddTodoDrawerOpen = ref(false);
const addTodoInitial = ref<any | null>(null);
const addTodoCollaborators = ref<
  Array<{ id: number | string; name: string; avatarUrl?: string | null }>
>([]);
const isAddRecordDrawerOpen = ref(false);
const addRecordInitial = ref<any | null>(null);
const isEditRecordDrawerOpen = ref(false);
const editRecordInitial = ref<any | null>(null);

function handleAddTodoRequest(payload: {
  initial: Record<string, any>;
  collaborators: Array<{
    id: number | string;
    name: string;
    avatarUrl?: string | null;
  }>;
}) {
  addTodoInitial.value = payload?.initial ?? null;
  addTodoCollaborators.value = Array.isArray(payload?.collaborators)
    ? [...payload.collaborators]
    : [];
  isAddTodoDrawerOpen.value = true;
  try {
    addTodoDrawerRef.value?.openWith(payload?.initial);
  } catch (error) {
    // fallback: rely on v-model toggle
  }
}

async function handleAddTodoSave(payload: any) {
  if (!userTabDocumentsRef.value) return;
  await userTabDocumentsRef.value.handleAddTodoSaved(payload);
  isAddTodoDrawerOpen.value = false;
  addTodoInitial.value = null;
}

function handleAddTodoDrawerUpdate(val: boolean) {
  isAddTodoDrawerOpen.value = val;
  if (!val) {
    addTodoInitial.value = null;
    addTodoCollaborators.value = [];
  }
}

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
  () => employeesStore.byId(route.params.id),
  (value) => {
    if (!value) {
      contact.value = null;
      error.value = "Employee not found.";
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
          <UserTabDocuments
            ref="userTabDocumentsRef"
            :user="contact"
            @open-add-todo="handleAddTodoRequest"
          />
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
      Employee with ID {{ route.params.id }} not found!
    </VAlert>
  </div>

  <AddNewToDoDrawer
    ref="addTodoDrawerRef"
    :isDrawerOpen="isAddTodoDrawerOpen"
    :collaborators-options="addTodoCollaborators"
    :initial="addTodoInitial"
    :autofocus-due="true"
    @update:isDrawerOpen="handleAddTodoDrawerUpdate"
    @user-data="handleAddTodoSave"
  />

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
