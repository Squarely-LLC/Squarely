<script setup lang="ts">
import { computed, defineEmits, defineProps, ref } from "vue";
import { useContactsStore } from "../../../../stores/contacts";

const props = defineProps({
  user: { type: Object as () => any, required: false },
  modelValue: { type: Boolean, default: false },
});

// empty headers and records — table intentionally has no data
const headers = [
  { title: "Record Type", key: "type" },
  { title: "Date", key: "createdAt" },

  { title: "Actions", key: "actions", sortable: false },
];

// use canonical contacts store and compute records for the passed user
const contactsStore = useContactsStore();
contactsStore.init?.();

const contactId = computed(() => {
  if (!props.user) return null;
  return (props.user as any).id ?? props.user;
});

const RECORDS_API_DISABLED_KEY = "app.contacts.records.api.disabled";

const recordsList = computed(() => {
  const id = contactId.value;
  if (id == null) return [] as any[];
  const contact = contactsStore.byId?.(id as any) ?? null;
  return (
    contact && Array.isArray((contact as any).records)
      ? (contact as any).records
      : []
  ) as any[];
});

let recordsApiUnavailable =
  typeof window !== "undefined" &&
  window.localStorage.getItem(RECORDS_API_DISABLED_KEY) === "1";

const disableRecordsApi = () => {
  recordsApiUnavailable = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECORDS_API_DISABLED_KEY, "1");
    } catch (err) {
      console.warn("Failed to persist records API disable flag", err);
    }
  }
};

const emit = defineEmits<{
  (e: "open-add-record"): void;
  (e: "edit-record", record: any): void;
}>();

const itemsPerPage = ref(10);
const page = ref(1);
const searchQuery = ref("");
// delete confirm dialog state
const isConfirmDeleteVisible = ref(false);
const deleteCandidate = ref<any | null>(null);
const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

// simple filtering of records by title/type
const filteredRecords = computed(() => {
  const q = normalizedSearch.value;
  if (!q) return recordsList.value;
  return recordsList.value.filter((r: any) => {
    const hay = [r.title, r.type, r.body]
      .filter(Boolean)
      .map((v: any) => String(v).toLowerCase());
    return hay.some((h: string) => h.includes(q));
  });
});

const totalItems = computed(() => filteredRecords.value.length);
const paged = computed(() => {
  if (itemsPerPage.value === -1) return filteredRecords.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return filteredRecords.value.slice(start, start + itemsPerPage.value);
});

function updateItemsPerPage(val: any) {
  const n = Number(val);
  itemsPerPage.value = Number.isFinite(n) ? n : itemsPerPage.value;
}

function openAddRecordDrawer() {
  emit("open-add-record");
}

function viewRecord(record: any) {
  // placeholder: show in console for now
  console.log("View record", record);
}

function editRecord(record: any) {
  emit("edit-record", record);
}

function printRecord(record: any) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<pre>${JSON.stringify(record, null, 2)}</pre>`);
  w.print();
}

async function deleteRecord(record: any) {
  const id = contactId.value;
  if (id == null) return;

  // If the record doesn't exist on this contact locally, remove it locally and skip showing dialog
  const existsOnThisContact = recordsList.value.some(
    (r: any) => String(r.id) === String(record.id)
  );
  if (!existsOnThisContact) {
    // remove from any contact that matches the record id
    contactsStore.items.forEach((c: any) => {
      if (
        Array.isArray(c.records) &&
        c.records.some((r: any) => String(r.id) === String(record.id))
      ) {
        contactsStore.removeRecord(c.id, record.id);
      }
    });
    return;
  }

  // otherwise show delete confirmation dialog
  deleteCandidate.value = record;
  isConfirmDeleteVisible.value = true;
}

async function performRemoveConfirmed() {
  const record = deleteCandidate.value;
  if (!record) return;
  const id = contactId.value;
  if (id == null) return;

  if (recordsApiUnavailable) {
    contactsStore.removeRecord(id as any, record.id);
    deleteCandidate.value = null;
    isConfirmDeleteVisible.value = false;
    return;
  }

  try {
    const response = await fetch(
      `/api/apps/contacts/${id}/records/${record.id}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      contactsStore.removeRecord(id as any, record.id);
    } else if (response.status === 404) {
      disableRecordsApi();
      contactsStore.removeRecord(id as any, record.id);
    } else {
      const text = await response.text();
      console.warn("Failed to delete record", response.status, text);
      alert("Failed to delete record: " + (text || response.statusText));
    }
  } catch (err) {
    console.warn("Error deleting record", err);
    alert("Network error deleting record");
    disableRecordsApi();
    contactsStore.removeRecord(id as any, record.id);
  } finally {
    deleteCandidate.value = null;
    isConfirmDeleteVisible.value = false;
  }
}

function cancelRemove() {
  deleteCandidate.value = null;
  isConfirmDeleteVisible.value = false;
}

async function handleSaveRecord(payload: any) {
  const id = contactId.value;
  if (id == null) return;

  const upsertLocalRecord = (record: any) => {
    if (!record) return;
    const normalized = {
      ...record,
      id:
        record.id ??
        payload?.id ??
        Date.now(), /* fallback id to keep record addressable locally */
    };
    const exists = recordsList.value.some(
      (r: any) => String(r.id) === String(normalized.id)
    );
    if (exists) contactsStore.updateRecord(id as any, normalized);
    else contactsStore.addRecord(id as any, normalized);
    return normalized.id;
  };

  if (recordsApiUnavailable) {
    upsertLocalRecord(payload);
    return;
  }

  try {
    let response: Response;

    // If payload has an id and it exists in the contact's records, treat as update (PUT)
    const payloadId = payload?.id ?? null;
    const existsLocally = payloadId
      ? recordsList.value.some((r: any) => String(r.id) === String(payloadId))
      : false;

    const baseRequestInit: RequestInit = {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };

    if (payloadId && existsLocally) {
      response = await fetch(`/api/apps/contacts/${id}/records/${payloadId}`, {
        ...baseRequestInit,
        method: "PUT",
      });
      if (response.status === 404) {
        // server does not know this record id (likely client-generated). Fall back to local update.
        disableRecordsApi();
        upsertLocalRecord(payload);
        return;
      }
    } else {
      response = await fetch(`/api/apps/contacts/${id}/records`, {
        ...baseRequestInit,
        method: "POST",
      });
    }

    if (response.status === 404) {
      // record not found on mock API -- sync local store instead of failing
      upsertLocalRecord(payload);
      disableRecordsApi();
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      console.warn("Failed to save record", response.status, text);
      alert("Failed to save record: " + (text || response.statusText));
      if (response.status >= 400) disableRecordsApi();
      return;
    }

    const data = await response.json();

    // Prefer handling single record payloads when available (avoid replacing
    // the whole records array). If API returned `record`, add/update that
    // single record. If API returned only `contact.records`, merge server
    // records with existing ones to avoid erasing local records that might
    // not be present in the response.
    if (data?.record) {
      upsertLocalRecord(data.record);
    } else if (data?.contact) {
      const serverRecords = Array.isArray(data.contact.records)
        ? data.contact.records
        : [];
      const existing = recordsList.value ?? [];
      const serverIds = new Set(serverRecords.map((r: any) => String(r.id)));
      // Keep server records first (newest-first) then append any existing
      // records that the server response didn't include.
      const merged = [
        ...serverRecords,
        ...existing.filter((r: any) => !serverIds.has(String(r.id))),
      ];
      contactsStore.updateContact(id as any, { records: merged });
    } else {
      upsertLocalRecord(payload);
    }
  } catch (err) {
    console.warn("Error saving record", err);
    alert("Network error saving record");
    disableRecordsApi();
    upsertLocalRecord(payload);
  }
}

defineExpose({ handleSaveRecord });
</script>

<template>
  <section>
    <VCard class="mb-6">
      <VCardText class="d-flex flex-wrap gap-4">
        <div class="me-3 d-flex gap-3">
          <AppSelect
            :model-value="itemsPerPage"
            :items="[
              { value: 10, title: '10' },
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
            <AppTextField v-model="searchQuery" placeholder="Search Records" />
          </div>

          <VBtn variant="tonal" color="secondary" prepend-icon="tabler-upload">
            Export
          </VBtn>

          <VBtn prepend-icon="tabler-plus" @click="openAddRecordDrawer"
            >Record</VBtn
          >
        </div>
      </VCardText>
      <VDivider />
      <VDataTableServer
        :items="filteredRecords"
        :headers="headers"
        :items-length="filteredRecords.length"
        :multi-sort="false"
        class="text-no-wrap"
      >
        <template #item="{ item }">
          <tr>
            <td>
              {{
                item.category === "Event Management"
                  ? item.meta?.eventType || item.type
                  : item.title || item.type
              }}
            </td>
            <td>
              {{
                item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"
              }}
            </td>
            <td>
              <IconBtn @click.stop="editRecord(item)">
                <VIcon icon="tabler-edit" />
              </IconBtn>

              <IconBtn @click.stop="printRecord(item)">
                <VIcon icon="tabler-printer" />
              </IconBtn>

              <IconBtn @click.stop="deleteRecord(item)">
                <VIcon color="error" icon="tabler-trash" />
              </IconBtn>
            </td>
          </tr>
        </template>

        <template #bottom>
          <TablePagination
            v-model:page="page"
            :items-per-page="itemsPerPage"
            :total-items="totalItems"
          />
        </template>
      </VDataTableServer>
    </VCard>
  </section>
  <VDialog v-model="isConfirmDeleteVisible" max-width="480">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Delete record</VCardTitle>
      <VCardText>
        <div v-if="deleteCandidate">
          Are you sure you want to permanently delete
          <strong>{{ deleteCandidate.title || deleteCandidate.id }}</strong>
          ?
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" color="secondary" @click="cancelRemove"
          >Cancel</VBtn
        >
        <VBtn variant="tonal" color="error" @click="performRemoveConfirmed"
          >Delete</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>
</template>
