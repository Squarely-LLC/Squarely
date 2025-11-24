<!-- Contacts page -->
<script setup lang="ts">
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { computed, nextTick, ref, toRaw, watch } from "vue";

import type {
  ContactConnection,
  ContactProperties,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";
import AddNewUserDialog from "@/views/apps/hr/list/AddNewUserDialog.vue";
import ContactEditDialog from "@/views/apps/hr/list/ContactEditDialog.vue";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import AddMeetingDrawer from "@/views/apps/todo/list/AddMeetingDrawer.vue";
import AddNewToDoDrawer from "@/views/apps/todo/list/AddNewToDoDrawer.vue";

type SortKey = "user" | "status" | "category" | "channel" | "createdAt";
type SortVal = { key: SortKey; order: "asc" | "desc" };

const searchQuery = ref("");
const selectedRole = ref<string | undefined>();
const selectedPlan = ref<string | undefined>();
const selectedStatus = ref<string | undefined>();

const sortOptions: { title: string; value: SortVal }[] = [
  { title: "Name (A-Z)", value: { key: "user", order: "asc" } },
  { title: "Name (Z-A)", value: { key: "user", order: "desc" } },
  {
    title: "Recently Added",
    value: { key: "createdAt", order: "desc" },
  },
];

const selectedSort = ref<SortVal | undefined>(sortOptions[2].value);

const itemsPerPage = ref(13);
const page = ref(1);
const sortBy = ref<string | undefined>(selectedSort.value?.key);
const orderBy = ref<"asc" | "desc" | undefined>(selectedSort.value?.order);
const selectedRows = ref<number[]>([]);

const headers = [
  { title: "Name", key: "user" },
  { title: "Type", key: "class" },
  { title: "Number", key: "number" },
  { title: "Connections", key: "connections", sortable: false },
  { title: "Status", key: "status" },

  { title: "Actions", key: "actions", sortable: false },
];

const roleFilter = computed(() =>
  selectedRole.value ? selectedRole.value : undefined
);
const planFilter = computed(() =>
  selectedPlan.value ? selectedPlan.value : undefined
);
const statusFilter = computed(() => {
  if (!selectedStatus.value) return undefined;
  if (selectedStatus.value === "Cold") return "Dormant";
  return selectedStatus.value;
});

const contactsStore = useContactsStore();
contactsStore.init();

watch(selectedSort, (val) => {
  if (!val) {
    sortBy.value = undefined;
    orderBy.value = undefined;
  } else {
    sortBy.value = val.key;
    orderBy.value = val.order;
  }
  page.value = 1;
});

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const matchesFilters = (contact: ContactProperties) => {
  const query = normalizedSearch.value;
  if (query) {
    const haystacks = [contact.fullName, contact.email, contact.number]
      .filter(Boolean)
      .map((value) => value.toString().toLowerCase());

    const numberQuery = query.replace(/\D/g, "");
    const hasMatch =
      haystacks.some((value) => value.includes(query)) ||
      (numberQuery &&
        contact.number &&
        contact.number.toString().replace(/\D/g, "").includes(numberQuery));

    if (!hasMatch) return false;
  }

  if (selectedRole.value && contact.class !== selectedRole.value) return false;
  if (selectedPlan.value && contact.category !== selectedPlan.value)
    return false;

  const mappedStatus = statusFilter.value;
  if (mappedStatus && contact.status !== mappedStatus) return false;

  return true;
};

const normalizeSortValue = (contact: ContactProperties, key?: string) => {
  switch (key) {
    case "user":
      return contact.fullName?.toLowerCase() ?? "";
    case "status":
      return contact.status ?? "";
    case "category":
      return contact.category ?? "";
    case "channel":
      return contact.channel ?? "";
    case "number":
      return (contact.number ?? "").toString().replace(/\D/g, "");
    case "createdAt":
      return contact.createdAt ?? "";
    default:
      return contact.createdAt ?? "";
  }
};

const compareContacts = (a: ContactProperties, b: ContactProperties) => {
  const key = sortBy.value ?? "createdAt";
  const order = orderBy.value ?? "desc";

  const aValue = normalizeSortValue(a, key);
  const bValue = normalizeSortValue(b, key);

  if (key === "createdAt") {
    const aDate = aValue ? new Date(aValue).getTime() : 0;
    const bDate = bValue ? new Date(bValue).getTime() : 0;
    return order === "asc" ? aDate - bDate : bDate - aDate;
  }

  if (!Number.isNaN(Number(aValue)) && !Number.isNaN(Number(bValue))) {
    const diff = Number(aValue) - Number(bValue);
    return order === "asc" ? diff : -diff;
  }

  const diff = String(aValue).localeCompare(String(bValue));
  return order === "asc" ? diff : -diff;
};

const filteredContacts = computed<ContactProperties[]>(() => {
  return contactsStore.all
    .map((stored) => cloneContact(stored))
    .filter((contact): contact is ContactProperties => {
      if (!contact) return false;
      if (contact.id === null || contact.id === undefined) return false;
      return matchesFilters(contact);
    });
});

const sortedContacts = computed<ContactProperties[]>(() => {
  const items = [...filteredContacts.value];
  if (items.length > 1) items.sort(compareContacts);
  return items;
});

const displayedContacts = computed<ContactProperties[]>(() => {
  const results = sortedContacts.value;
  const start = (page.value - 1) * itemsPerPage.value;
  const end =
    itemsPerPage.value === -1 ? results.length : start + itemsPerPage.value;

  return results.slice(start, end);
});

const totalContacts = computed(() => sortedContacts.value.length);

const connectionDirectory = computed(() => {
  const map = new Map<
    string,
    Pick<
      ContactProperties,
      "id" | "fullName" | "picture" | "status" | "channel" | "class"
    >
  >();

  contactsStore.all.forEach((contact) => {
    if (contact?.id === null || contact?.id === undefined) return;
    map.set(String(contact.id), {
      id: contact.id,
      fullName: contact.fullName,
      picture: contact.picture,
      status: contact.status,
      channel: contact.channel,
      class: contact.class,
    });
  });

  return map;
});

type ConnectionDisplay = ContactConnection & {
  displayName: string;
  avatar?: string | null;
  displayStatus?: ContactProperties["status"];
  displayChannel?: ContactProperties["channel"];
  displayClass?: ContactProperties["class"];
};

const decorateConnections = (
  connections: ContactConnection[] | undefined | null
): ConnectionDisplay[] => {
  if (!Array.isArray(connections) || !connections.length) return [];

  const directory = connectionDirectory.value;
  // ensure primary connections come first so the first avatar is always the primary
  const primaries = connections.filter((c) => c.isPrimary);
  const others = connections.filter((c) => !c.isPrimary);
  const ordered = [...primaries, ...others];

  return ordered.map((connection) => {
    const entry = directory.get(String(connection.contactId));
    return {
      ...connection,
      displayName: entry?.fullName ?? connection.contactName,
      avatar: entry?.picture ?? connection.picture ?? null,
      displayStatus: entry?.status,
      displayChannel: entry?.channel,
      displayClass: entry?.class,
    };
  });
};
const roles = [
  { title: "All", value: "" },
  { title: "Client", value: "Client" },
  { title: "Contact", value: "Contact" },
  { title: "Lead", value: "Lead" },
  { title: "Supplier", value: "Supplier" },
  { title: "Owner", value: "Owner" },
];
const plans = [
  { title: "All", value: "" },
  { title: "General", value: "General" },
  { title: "Real Estate", value: "Real Estate" },
  { title: "VIP", value: "VIP" },
];

const statusOptions = [
  { title: "All", value: "" },
  { title: "Cold", value: "Cold" },
  { title: "Active", value: "Active" },
  { title: "Lost", value: "Lost" },
];

const resolveClassVariant = (contactClass: string) => {
  switch (contactClass) {
    case "Lead":
      return { color: "warning", icon: "tabler-target" };
    case "Client":
      return { color: "primary", icon: "tabler-briefcase" };
    case "Supplier":
      return { color: "info", icon: "tabler-truck" };
    case "Contact":
      return { color: "success", icon: "tabler-user" };
    case "Owner":
      return { color: "secondary", icon: "tabler-building" };
    default:
      return { color: "primary", icon: "tabler-user" };
  }
};

const resolveStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "success";
    case "Dormant":
      return "secondary";
    case "Potential":
      return "info";
    case "Lost":
      return "error";
    default:
      return "primary";
  }
};

const channelColor = (channel: string) => {
  switch (channel) {
    case "Direct Sales":
      return "primary";
    case "Referral":
      return "success";
    case "Social Media":
      return "info";
    case "Website":
      return "secondary";
    case "Email Campaigns":
      return "warning";
    default:
      return "primary";
  }
};

const avatarText = (name?: string | null) => {
  const safeName = (name ?? "").trim();
  if (!safeName) return "??";

  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || safeName.slice(0, 2).toUpperCase();
};

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

const isAddNewUserDrawerVisible = ref(false);
const isContactEditDialogVisible = ref(false);
const selectedContact = ref<ContactProperties | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const isConfirmDeleteVisible = ref(false);
const deleteCandidateId = ref<number | null>(null);
const deleteBlockingReasons = ref<string[]>([]);
const notifications = useNotificationsStore();

const addNewContact = (contact: Partial<ContactProperties>) => {
  // eslint-disable-next-line no-console
  console.log("addNewContact received:", JSON.parse(JSON.stringify(contact)));

  // The store expects a Partial<ContactProperties> for addContact.
  // Ensure we pass the payload through directly so the store assigns an id and defaults.
  contactsStore.addContact(contact);
  isAddNewUserDrawerVisible.value = false;
};

// Synchronous low-risk check for references to a contact id across todos, meetings and other contacts' connections
const findDeleteBlockingReasons = (id: number): string[] => {
  const reasons: string[] = [];
  try {
    const todosStore = useTodos();
    // ensure todos initialized
    todosStore.init();

    // check todos - top-level collaborators
    const referencingTodos = todosStore.items.filter(
      (t) =>
        Array.isArray(t.collaborators) &&
        t.collaborators.some((c) => Number(c.id) === Number(id))
    );
    if (referencingTodos.length) {
      reasons.push(
        `Referenced as a collaborator in ${referencingTodos.length} todo(s)`
      );
    }

    // check todo steps collaborators
    const stepRefs = todosStore.items
      .flatMap((t) => t.steps || [])
      .filter(
        (s) =>
          Array.isArray(s.collaborators) &&
          s.collaborators.some((c) => Number(c.id) === Number(id))
      );
    if (stepRefs.length) {
      reasons.push(
        `Referenced as a collaborator in ${stepRefs.length} todo step(s)`
      );
    }

    // check activities/messages authors
    const activityRefs = todosStore.items
      .flatMap((t) => t.activities || [])
      .filter((a) => a && a.author && Number(a.author.id) === Number(id));
    if (activityRefs.length) {
      reasons.push(`Author on ${activityRefs.length} activity item(s)`);
    }

    const messageRefs = todosStore.items
      .flatMap((t) => t.messages || [])
      .filter(
        (m) => m && m.author && Number((m.author as any).id) === Number(id)
      );
    if (messageRefs.length) {
      reasons.push(`Author on ${messageRefs.length} message(s)`);
    }

    // meetings: requestedBy, linkedTo (by id) and notes authors
    const meetingsStore = todosStore;
    const referencingMeetings = meetingsStore.meetings.filter((m) => {
      if (m.requestedBy && Number(m.requestedBy.id) === Number(id)) return true;
      if (
        Array.isArray(m.linkedTo) &&
        m.linkedTo.some((l) => Number(l.id) === Number(id))
      )
        return true;
      if (
        Array.isArray(m.notes) &&
        m.notes.some(
          (n: any) => n && n.author && Number(n.author.id) === Number(id)
        )
      )
        return true;
      return false;
    });
    if (referencingMeetings.length) {
      reasons.push(`Referenced in ${referencingMeetings.length} meeting(s)`);
    }

    // connections: referenced as connection.contactId in other contacts
    const referencedInConnections = contactsStore.all.filter(
      (c) =>
        Array.isArray(c.connections) &&
        c.connections.some((conn) => Number(conn.contactId) === Number(id))
    );
    if (referencedInConnections.length) {
      reasons.push(
        `Connected to ${referencedInConnections.length} other contact(s)`
      );
    }
  } catch (e) {
    // If anything goes wrong, be conservative and block deletion with a generic reason
    reasons.push(
      "Unable to guarantee safe deletion due to internal check failure"
    );
  }

  return reasons;
};

const confirmDeleteCandidate = (id: number) => {
  deleteCandidateId.value = id;
  deleteBlockingReasons.value = findDeleteBlockingReasons(id);
  isConfirmDeleteVisible.value = true;
};

const performDelete = () => {
  const id = deleteCandidateId.value;
  if (id === null) return;
  // double-check before deleting
  const reasons = findDeleteBlockingReasons(id);
  if (reasons.length) {
    deleteBlockingReasons.value = reasons;
    // keep dialog open and prevent deletion
    return;
  }

  contactsStore.removeContact(id);
  const index = selectedRows.value.findIndex((row) => row === id);
  if (index !== -1) selectedRows.value.splice(index, 1);

  // notify success
  notifications.push("Contact deleted", "success", 3500);

  // reset dialog state
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
  isConfirmDeleteVisible.value = false;
};

const cancelDelete = () => {
  isConfirmDeleteVisible.value = false;
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
};

// Remove references to a contact across todos, meetings and other contacts, then delete
const cleanupAndDelete = () => {
  const id = deleteCandidateId.value;
  if (id === null) return;

  const todosStore = useTodos();
  try {
    todosStore.init();
  } catch (e) {
    // continue — init might be a no-op
  }

  // Remove from top-level collaborators
  todosStore.items = todosStore.items.map((t) => {
    const collaborators = (t.collaborators || []).filter(
      (c) => Number(c.id) !== Number(id)
    );

    // steps
    const steps = (t.steps || []).map((s) => ({
      ...s,
      collaborators: (s.collaborators || []).filter(
        (c) => Number(c.id) !== Number(id)
      ),
    }));

    // activities: remove those authored by the contact
    const activities = (t.activities || []).filter(
      (a) => !(a && a.author && Number(a.author.id) === Number(id))
    );

    // messages: remove authored messages
    const messages = (t.messages || []).filter(
      (m) =>
        !(m && (m.author as any) && Number((m.author as any).id) === Number(id))
    );

    return { ...t, collaborators, steps, activities, messages };
  });

  // Meetings: remove linkedTo and requestedBy and notes authored by contact
  todosStore.meetings = todosStore.meetings.map((m) => {
    const requestedBy =
      m.requestedBy && Number(m.requestedBy.id) === Number(id)
        ? null
        : m.requestedBy;
    const linkedTo = (m.linkedTo || []).filter(
      (l) => Number(l.id) !== Number(id)
    );
    const notes = (m.notes || []).filter(
      (n: any) => !(n && n.author && Number(n.author.id) === Number(id))
    );
    return { ...m, requestedBy, linkedTo, notes };
  });

  // Remove connections pointing to this contact
  contactsStore.items = contactsStore.items.map((c) => {
    const connections = (c.connections || []).filter(
      (conn) => Number(conn.contactId) !== Number(id)
    );
    return { ...c, connections };
  });

  // Finally delete the contact
  contactsStore.removeContact(id);
  const idx = selectedRows.value.findIndex((row) => row === id);
  if (idx !== -1) selectedRows.value.splice(idx, 1);

  notifications.push("References removed and contact deleted", "success", 3500);

  // reset dialog
  deleteCandidateId.value = null;
  deleteBlockingReasons.value = [];
  isConfirmDeleteVisible.value = false;
};

const deleteCandidateName = computed(() => {
  const id = deleteCandidateId.value;
  if (id === null) return "";
  const c = contactsStore.byId(id);
  return c?.fullName ?? String(id);
});

const fetchContactDetails = (id: number | string) => {
  loading.value = true;
  error.value = null;

  const contact = contactsStore.byId(id);
  if (!contact) {
    selectedContact.value = null;
    error.value = "Contact not found";
  } else {
    selectedContact.value = cloneContact(contact);
  }

  loading.value = false;
};

const openEditDialog = (id: number | string) => {
  fetchContactDetails(id);
  if (selectedContact.value) {
    isContactEditDialogVisible.value = true;
  }
};

const addTodoDrawerRef = ref<any | null>(null);
const isAddTodoDrawerVisible = ref(false);

const addMeetingRef = ref<any | null>(null);
const isAddMeetingOpen = ref(false);

const composeDialogRef = ref<any | null>(null);
const isComposeDialogVisible = ref(false);

const contactsOptions = computed(() =>
  contactsStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  }))
);

const openAddTodoDrawerForContact = (contact: ContactProperties) => {
  try {
    const initial = {
      title: `Follow up: ${contact.fullName ?? ""}`,
      collaborators: [
        {
          id: contact.id,
          name: contact.fullName,
          avatarUrl: contact.picture ?? null,
        },
      ],
    } as any;

    if (addTodoDrawerRef.value?.openWith) {
      addTodoDrawerRef.value.openWith(initial);
    } else {
      isAddTodoDrawerVisible.value = true;
      nextTick(() => {
        try {
          addTodoDrawerRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open todo drawer:", e);
  }
};

const openAddMeetingForContact = (contact: ContactProperties) => {
  try {
    const initial = {
      title: `Meeting: ${contact.fullName ?? ""}`,
      initialStart: new Date(),
      contacts: contactsOptions.value,
      notes: `Scheduled from contacts list: ${contact.fullName ?? ""}`,
      linkedTo: [
        {
          id: contact.id,
          name: contact.fullName,
          avatarUrl: contact.picture ?? null,
        },
      ],
    } as any;

    if (addMeetingRef.value?.openWith) {
      addMeetingRef.value.openWith(initial);
    } else {
      isAddMeetingOpen.value = true;
      nextTick(() => {
        try {
          addMeetingRef.value?.openWith?.(initial);
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error("Failed to open meeting drawer:", e);
  }
};

const openComposeForContact = (contact: ContactProperties) => {
  try {
    const toAddress = contact.email || "";
    const initial = {
      to: toAddress ? [toAddress] : [],
      subject: `Hello ${contact.fullName ?? ""}`,
      message: `Hi ${contact.fullName ?? ""},\n\n`,
    } as any;

    isComposeDialogVisible.value = true;
    nextTick(() => {
      try {
        composeDialogRef.value?.openWith?.(initial);
      } catch (e) {
        /* ignore */
      }
    });
  } catch (e) {
    console.error("Failed to open compose dialog:", e);
  }
};

const handleAction = (action: string, item: ContactProperties) => {
  // Fallback placeholder for actions not yet implemented
  notifications.push(`${action} for ${item.fullName}`, "info", 3000);
};

const onMeetingCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addMeeting && todos.addMeeting(payload);
    notifications.push("Meeting created", "success", 3500);
  } catch (e) {
    notifications.push("Meeting created", "success", 3500);
  } finally {
    isAddMeetingOpen.value = false;
  }
};

const onTodoCreated = (payload: any) => {
  try {
    const todos = useTodos();
    try {
      todos.init();
    } catch {}
    todos.addTodo && todos.addTodo(payload);
    notifications.push("To Do created", "success", 3500);
  } catch (e) {
    console.error("onTodoCreated failed:", e);
    notifications.push("To Do created", "success", 3500);
  } finally {
    isAddTodoDrawerVisible.value = false;
  }
};

const saveEditedContact = (payload: ContactProperties) => {
  loading.value = true;
  error.value = null;

  const updated = contactsStore.updateContact(payload.id, payload);
  if (!updated) {
    error.value = "Failed to save contact";
    loading.value = false;
    return;
  }

  // notify and close
  notifications.push(`${payload.fullName} updated`, "success", 3000);
  isContactEditDialogVisible.value = false;
  selectedContact.value = null;
  loading.value = false;
};

const updateOptions = (options: any) => {
  sortBy.value = options.sortBy?.[0]?.key;
  orderBy.value = options.sortBy?.[0]?.order;

  // keep dropdown visually in sync with header clicks
  const found = sortOptions.find(
    (opt) => opt.value.key === sortBy.value && opt.value.order === orderBy.value
  );
  selectedSort.value = found?.value;
};

// Called from the template when the items-per-page selector changes.
const updateItemsPerPage = (value: number | string) => {
  itemsPerPage.value = Number(value);
};
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardItem class="pb-4">
        <VCardTitle>Contacts</VCardTitle>
      </VCardItem>

      <VCardText>
        <VRow>
          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedRole"
              placeholder="Select Role"
              :items="roles"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedPlan"
              placeholder="Select Category"
              :items="plans"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedStatus"
              placeholder="Select Status"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>

          <VCol cols="12" sm="3">
            <AppSelect
              v-model="selectedSort"
              placeholder="Sort By"
              :items="sortOptions"
              item-title="title"
              item-value="value"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDivider />

      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 13, title: '13' },
              { value: 25, title: '25' },
              { value: 50, title: '50' },
              { value: 100, title: '100' },
              { value: -1, title: 'All' },
            ]"
            style="inline-size: 6.25rem"
            @update:model-value="updateItemsPerPage"
          />
        </div>

        <VSpacer />

        <div class="app-user-search-filter d-flex align-center flex-wrap gap-4">
          <div style="inline-size: 15.625rem">
            <AppTextField v-model="searchQuery" placeholder="Search Contacts" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn
            prepend-icon="tabler-plus"
            @click="isAddNewUserDrawerVisible = true"
          >
            Add New Contact
          </VBtn>
        </div>
      </VCardText>
      <VDivider />
      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:model-value="selectedRows"
        v-model:page="page"
        :items="displayedContacts"
        :items-length="totalContacts"
        item-value="id"
        :headers="headers"
        class="text-no-wrap"
        :sort-by="sortBy ? [{ key: sortBy, order: orderBy }] : []"
        @update:options="updateOptions"
      >
        <template #item.user="{ item }">
          <div class="d-flex align-center gap-x-4 pb-2 pt-2">
            <template v-if="item.id !== null && item.id !== undefined">
              <RouterLink
                :to="{ name: 'apps-hr-view-id', params: { id: item.id } }"
                class="d-inline-block"
              >
                <VAvatar
                  size="40"
                  :variant="!item.picture ? 'tonal' : undefined"
                  :color="
                    !item.picture
                      ? resolveClassVariant(item.class).color
                      : undefined
                  "
                >
                  <VImg v-if="item.picture" :src="item.picture" />
                  <span v-else>{{ avatarText(item.fullName) }}</span>
                </VAvatar>
              </RouterLink>
            </template>
            <template v-else>
              <VAvatar
                size="40"
                :variant="!item.picture ? 'tonal' : undefined"
                :color="
                  !item.picture
                    ? resolveClassVariant(item.class).color
                    : undefined
                "
              >
                <VImg v-if="item.picture" :src="item.picture" />
                <span v-else>{{ avatarText(item.fullName) }}</span>
              </VAvatar>
            </template>
            <div class="d-flex flex-column">
              <h6 class="text-base d-flex align-center gap-1">
                <VIcon
                  :icon="
                    item.type === 'Entity'
                      ? 'tabler-building-skyscraper'
                      : 'tabler-user'
                  "
                  size="16"
                  :color="item.type === 'Entity' ? 'warning' : 'primary'"
                />
                <template v-if="item.id !== null && item.id !== undefined">
                  <RouterLink
                    :to="{
                      name: 'apps-hr-view-id',
                      params: { id: item.id },
                    }"
                    class="font-weight-medium text-link"
                  >
                    {{ item.fullName }}
                  </RouterLink>
                </template>
                <template v-else>
                  <span class="font-weight-medium text-high-emphasis">
                    {{ item.fullName }}
                  </span>
                </template>
              </h6>
              <div class="text-sm">
                {{ item.email }}
              </div>
            </div>
          </div>
        </template>

        <template #item.class="{ item }">
          <VChip
            :color="resolveClassVariant(item.class).color"
            size="small"
            variant="tonal"
            class="text-capitalize"
          >
            {{ item.class }}
          </VChip>
        </template>

        <template #item.number="{ item }">
          <a class="text-body-1" :href="`tel:${item.number}`">{{
            item.number
          }}</a>
        </template>

        <template #item.connections="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              v-if="decorateConnections(item.connections).length"
              class="v-avatar-group demo-avatar-group"
            >
              <template
                v-for="connection in decorateConnections(
                  item.connections
                ).slice(0, 3)"
                :key="`${item.id}-${connection.contactId}`"
              >
                <template
                  v-if="
                    connection.contactId !== null &&
                    connection.contactId !== undefined
                  "
                >
                  <RouterLink
                    :to="{
                      name: 'apps-hr-view-id',
                      params: { id: connection.contactId },
                    }"
                    class="d-inline-block"
                  >
                    <VAvatar
                      :size="40"
                      :color="connection.avatar ? undefined : 'primary'"
                      :class="[
                        connection.avatar
                          ? null
                          : 'text-white font-weight-medium',
                        connection.isPrimary ? 'contact-primary-border' : null,
                      ]"
                    >
                      <template v-if="connection.avatar">
                        <VImg :src="connection.avatar" />
                      </template>
                      <template v-else>
                        <span>{{ avatarText(connection.displayName) }}</span>
                      </template>

                      <VTooltip activator="parent" location="top">
                        <div class="d-flex flex-column gap-1">
                          <span class="font-weight-medium">
                            {{ connection.displayName }}
                          </span>

                          <span
                            v-if="connection.isPrimary"
                            class="text-body-2 text-medium-emphasis"
                          >
                            <span class="text-primary">(Primary)</span>
                          </span>
                        </div>
                      </VTooltip>
                    </VAvatar>
                  </RouterLink>
                </template>
                <template v-else>
                  <VAvatar
                    :size="40"
                    :color="connection.avatar ? undefined : 'primary'"
                    :class="[
                      connection.avatar
                        ? null
                        : 'text-white font-weight-medium',
                      connection.isPrimary ? 'contact-primary-border' : null,
                    ]"
                  >
                    <template v-if="connection.avatar">
                      <VImg :src="connection.avatar" />
                    </template>
                    <template v-else>
                      <span>{{ avatarText(connection.displayName) }}</span>
                    </template>

                    <VTooltip activator="parent" location="top">
                      <div class="d-flex flex-column gap-1">
                        <span class="font-weight-medium">
                          {{ connection.displayName }}
                        </span>

                        <span
                          v-if="connection.isPrimary"
                          class="text-body-2 text-medium-emphasis"
                        >
                          <span class="text-primary">(Primary)</span>
                        </span>
                      </div>
                    </VTooltip>
                  </VAvatar>
                </template>
              </template>

              <VAvatar
                v-if="decorateConnections(item.connections).length > 3"
                color="secondary"
                :size="40"
                class="font-weight-medium text-white"
              >
                +{{ decorateConnections(item.connections).length - 3 }}
                <VTooltip activator="parent" location="top">
                  {{
                    decorateConnections(item.connections)
                      .slice(3)
                      .map((connection) => connection.displayName)
                      .join(", ")
                  }}
                </VTooltip>
              </VAvatar>
            </div>
            <span v-else class="text-medium-emphasis">-</span>
          </div>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="resolveStatusColor(item.status)"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <template #item.channel="{ item }">
          <VChip
            :color="channelColor(item.channel)"
            size="small"
            variant="tonal"
          >
            {{ item.channel }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <IconBtn @click="openEditDialog(item.id)" :disabled="loading">
            <VIcon icon="tabler-edit" />
          </IconBtn>

          <VBtn icon variant="text" color="medium-emphasis">
            <VIcon icon="tabler-dots-vertical" />
            <VMenu activator="parent">
              <VList>
                <VListItem @click="openAddTodoDrawerForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-list-check" />
                  </template>
                  <VListItemTitle>To Do</VListItemTitle>
                </VListItem>

                <VListItem @click="openAddMeetingForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-calendar" />
                  </template>
                  <VListItemTitle>Meeting</VListItemTitle>
                </VListItem>

                <VListItem @click="openComposeForContact(item)">
                  <template #prepend>
                    <VIcon icon="tabler-mail" />
                  </template>
                  <VListItemTitle>Email</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Call', item)">
                  <template #prepend>
                    <VIcon icon="tabler-phone" />
                  </template>
                  <VListItemTitle>Call</VListItemTitle>
                </VListItem>
                <VDivider />
                <VListItem @click="handleAction('Deals', item)">
                  <template #prepend>
                    <VIcon icon="tabler-file-invoice" />
                  </template>
                  <VListItemTitle>Deals</VListItemTitle>
                </VListItem>

                <VListItem @click="handleAction('Purchases', item)">
                  <template #prepend>
                    <VIcon icon="tabler-shopping-cart" />
                  </template>
                  <VListItemTitle>Purchases</VListItemTitle>
                </VListItem>

                <VDivider />

                <VListItem @click="confirmDeleteCandidate(item.id)">
                  <template #prepend>
                    <VIcon color="error" icon="tabler-trash" />
                  </template>
                  <VListItemTitle>Delete</VListItemTitle>
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalContacts"
          />
        </template>
      </VDataTableServer>
    </VCard>

    <AddNewUserDialog
      v-model:is-dialog-visible="isAddNewUserDrawerVisible"
      @submit="addNewContact"
    />

    <ContactEditDialog
      v-if="isContactEditDialogVisible && selectedContact"
      v-model:is-dialog-visible="isContactEditDialogVisible"
      :contact="selectedContact"
      :loading="loading"
      :error="error"
      @submit="saveEditedContact"
    />

    <!-- To Do / Meeting / Email components wired for quick-create from contact list -->
    <AddNewToDoDrawer
      ref="addTodoDrawerRef"
      v-model:is-drawer-open="isAddTodoDrawerVisible"
      :collaborators-options="[]"
      @userData="onTodoCreated"
    />

    <AddMeetingDrawer
      ref="addMeetingRef"
      v-model="isAddMeetingOpen"
      :contacts="contactsOptions"
      @save="onMeetingCreated"
    />

    <EmailDialog
      ref="composeDialogRef"
      v-model:is-dialog-visible="isComposeDialogVisible"
      @send="
        (payload) => {
          try {
            const recipients = Array.isArray(payload?.to)
              ? payload.to
              : payload?.to
              ? [String(payload.to)]
              : [];
            notifications.push(
              `Email sent to ${recipients.length} recipient(s)`,
              'success',
              3500
            );
          } catch (e) {
            notifications.push('Email sent', 'success', 3500);
          }
        }
      "
    />

    <VDialog v-model="isConfirmDeleteVisible" max-width="540">
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete contact</VCardTitle>
        <VCardText>
          <div v-if="deleteBlockingReasons.length">
            <p>
              This contact cannot be deleted because it is referenced elsewhere:
            </p>
            <ul>
              <li v-for="(r, idx) in deleteBlockingReasons" :key="idx">
                {{ r }}
              </li>
            </ul>
            <p class="mt-5">
              Please review these references before deleting the contact.
            </p>
          </div>
          <div v-else>
            <p>
              Are you sure you want to permanently delete
              <strong>{{ deleteCandidateName }}</strong
              >?
            </p>
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" color="secondary" @click="cancelDelete">
            Cancel
          </VBtn>
          <VBtn
            v-if="deleteBlockingReasons.length"
            variant="tonal"
            color="error"
            @click="cleanupAndDelete"
          >
            Remove references & Delete
          </VBtn>
          <VBtn
            v-if="!deleteBlockingReasons.length"
            variant="tonal"
            color="error"
            @click="performDelete"
          >
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>
<style scoped>
.contact-primary-border {
  --primary-border-color: rgb(var(--v-theme-primary));

  position: relative;
}

.contact-primary-border::after {
  position: absolute;
  border: 2px solid var(--primary-border-color);
  border-radius: inherit;
  content: "";
  inset: -2px;
  pointer-events: none;
}
</style>
