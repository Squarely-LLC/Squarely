<script setup lang="ts">
import type {
  ContactDocument,
  ContactProperties,
} from "@/plugins/fake-api/handlers/apps/contact/types";
import { useContactsStore } from "@/stores/contacts";
import { getFileObjectUrl } from "@/utils/fileStore";
import { computed, reactive, ref, watch } from "vue";
import UserDocumentDialog from "./UserDocumentDialog.vue";

const props = defineProps<{ user: ContactProperties | null }>();

const contactsStore = useContactsStore();
contactsStore.init();

// UI state
const selectedType = ref<string>("");
const selectedStatus = ref<string>("");
const searchQuery = ref("");
const itemsPerPage = ref<number>(25);
const page = ref(1);

const documentTypes: string[] = [
  "Contract",
  "Passport",
  "Visa",
  "ID Card",
  "Labor Card",
  "Health Card",
  "Insurance Card",
  "Residency Card",
  "Other",
  "Tax Registration",
  "Trade License",
  "VAT Certificate",
  "VAT ,License",
  "Tax License",
  "Payslip",
  "Reimbursements Invoice",
  "Bank Details",
  "SOPs",
  "Proposals",
];

const fileCategories = ["JPG", "PNG", "PDF", "EXCEL", "WORD"] as const;

function docStatus(doc: ContactDocument) {
  if (!doc.expiry) return "Active";
  try {
    const now = Date.now();
    const ex = new Date(String(doc.expiry)).getTime();
    if (isNaN(ex)) return "Active";
    if (ex < now) return "Expired";
    const days = (ex - now) / (1000 * 60 * 60 * 24);
    if (days <= 30) return "Expiring";
    return "Active";
  } catch {
    return "Active";
  }
}

const docsList = computed<ContactDocument[]>(() => {
  // prefer the authoritative source from the contacts store for the
  // contact's documents so UI updates immediately after store mutations.
  const fromStore = props.user ? contactsStore.byId(props.user.id) : null;
  const docs =
    localDocs.value ?? fromStore?.documents ?? props.user?.documents ?? [];
  return (Array.isArray(docs) ? docs.slice().reverse() : []).slice();
});

// local copy of documents to show immediate updates before parent prop refresh
const localDocs = ref<ContactDocument[] | null>(null);

const filtered = computed(() => {
  const q = (searchQuery.value || "").toString().toLowerCase().trim();
  return docsList.value.filter((d) => {
    if (selectedType.value && String(d.type) !== String(selectedType.value))
      return false;
    if (selectedStatus.value && docStatus(d) !== selectedStatus.value)
      return false;
    if (!q) return true;
    return (
      (d.name || "").toString().toLowerCase().includes(q) ||
      (d.note || "").toString().toLowerCase().includes(q) ||
      (String(d.type) || "").toLowerCase().includes(q)
    );
  });
});

const totalItems = computed(() => filtered.value.length);
const paged = computed(() => {
  if (itemsPerPage.value === -1) return filtered.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return filtered.value.slice(start, start + itemsPerPage.value);
});

const isDialogVisible = ref(false);
const editing = ref<ContactDocument | null>(null);
const dialogOpen = ref(false);
const dialogDoc = ref<ContactDocument | null>(null);

const form = reactive<Partial<ContactDocument>>({
  id: undefined,
  category: undefined,
  type: undefined,
  name: "",
  expiry: undefined,
  expiryReminder: false,
  note: "",
  fileUrl: "",
});

function openAdd() {
  editing.value = null;
  dialogDoc.value = null;
  dialogOpen.value = true;
}

watch(itemsPerPage, () => (page.value = 1));

const updateItemsPerPage = (value: number | string) => {
  itemsPerPage.value = Number(value);
  page.value = 1;
};

function openEdit(d: ContactDocument) {
  editing.value = d;
  dialogDoc.value = d;
  dialogOpen.value = true;
}

async function openPreview(d: ContactDocument) {
  if (!d || !d.fileUrl) return;
  const raw = String(d.fileUrl || "").trim();

  // helper to open a URL in a new tab safely
  const openUrl = (url: string) => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      // fallback
      // eslint-disable-next-line no-console
      console.error(
        "openPreview: anchor open failed, falling back to window.open",
        err
      );
      window.open(url, "_blank");
    }
  };

  // If it's already a data URI, blob URI, or an absolute http(s) URL, open directly
  if (/^data:/.test(raw) || /^blob:/.test(raw) || /^https?:\/\//i.test(raw)) {
    try {
      // eslint-disable-next-line no-console
      console.log(
        "openPreview: detected direct URL, opening",
        raw.slice(0, 200)
      );
    } catch {}
    openUrl(raw);
    return;
  }

  // If it's an idb: pointer (idb:<key>|<encodedName>), fetch object URL and open
  if (/^idb:/.test(raw)) {
    try {
      const without = raw.slice(4);
      const [key] = without.split("|");
      // attempt to get an object URL from the file store
      const objUrl = await getFileObjectUrl(key);
      if (objUrl) {
        try {
          // eslint-disable-next-line no-console
          console.log("openPreview: opening idb object URL for key", key);
        } catch {}
        openUrl(objUrl);
        return;
      }
    } catch (err) {
      try {
        // eslint-disable-next-line no-console
        console.error("openPreview: failed to open idb pointer", err);
      } catch {}
    }
  }

  // If it looks like a relative URL (starts with /) try to open it
  if (/^\//.test(raw)) {
    const absolute = window.location.origin + raw;
    try {
      // eslint-disable-next-line no-console
      console.log(
        "openPreview: detected root-relative path, opening",
        absolute
      );
    } catch {}
    openUrl(absolute);
    return;
  }

  // Otherwise it's likely a plain filename or unsupported value. Open a small info page
  // instead of leaving the user with a blank tab.
  try {
    // eslint-disable-next-line no-console
    console.log(
      "openPreview: value looks like plain filename or unsupported URL",
      raw
    );
  } catch {}

  const w = window.open("about:blank", "_blank");
  if (!w) {
    try {
      // eslint-disable-next-line no-console
      console.warn("openPreview: window.open returned null (popup blocked?)");
    } catch {}
    return;
  }
  const safe = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Document preview</title>
        <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px;color:#222} .note{color:#666;margin-top:8px}</style>
      </head>
      <body>
        <h2>No preview available</h2>
        <div>
          The document "<strong>${safe(
            d.name || raw
          )}</strong>" does not provide a directly previewable URL.
        </div>
        <div class="note">Stored file identifier: <code>${safe(
          raw
        )}</code></div>
        <div class="note">To preview this document, attach a file or provide an absolute URL (https://...) when saving.</div>
      </body>
    </html>
  `;
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    try {
      // eslint-disable-next-line no-console
      console.log("openPreview: wrote info page to new window");
    } catch {}
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.error("openPreview: failed to write info page", err);
    } catch {}
  }
}

function saveDocument() {
  if (!props.user) return;
  const id = editing.value ? editing.value.id : Date.now();
  const payload: ContactDocument = {
    id: Number(id),
    category: (form.category as any) || undefined,
    type: (form.type as any) || undefined,
    name: form.name || "",
    expiry: form.expiry || undefined,
    expiryReminder: !!form.expiryReminder,
    note: form.note || undefined,
    fileUrl: form.fileUrl || undefined,
    createdAt: new Date().toISOString(),
  };

  const current = contactsStore.byId(props.user.id);
  if (!current) return;

  const existing = Array.isArray(current.documents)
    ? [...current.documents]
    : [];
  if (editing.value) {
    const idx = existing.findIndex((x) => x.id === editing.value!.id);
    if (idx !== -1) existing[idx] = payload;
  } else {
    existing.push(payload);
  }

  contactsStore.updateContact(props.user.id, { documents: existing });
  isDialogVisible.value = false;
}

function removeDocument(d: ContactDocument) {
  if (!props.user) return;
  const current = contactsStore.byId(props.user.id);
  if (!current) return;
  const existing = (current.documents || []).filter((x) => x.id !== d.id);
  contactsStore.updateContact(props.user.id, { documents: existing });
}

function onDialogSave(payload: ContactDocument) {
  try {
    // eslint-disable-next-line no-console
    console.log(
      "UserTabDocuments.onDialogSave called",
      payload,
      "props.user",
      props.user
    );
  } catch {}
  if (!props.user) {
    try {
      // eslint-disable-next-line no-console
      console.warn("UserTabDocuments.onDialogSave: no props.user, aborting");
    } catch {}
    return;
  }
  const current = contactsStore.byId(props.user.id);
  if (!current) return;
  const existing = Array.isArray(current.documents)
    ? [...current.documents]
    : [];
  if (editing.value) {
    const idx = existing.findIndex((x) => x.id === editing.value!.id);
    if (idx !== -1) existing[idx] = payload;
  } else {
    existing.push(payload);
  }
  contactsStore.updateContact(props.user.id, { documents: existing });
  // update local copy so the table reflects changes immediately
  localDocs.value = existing;
  try {
    // eslint-disable-next-line no-console
    console.log("UserTabDocuments: updated docs", existing.length, existing);
  } catch {}
  dialogOpen.value = false;
}

// reset localDocs when props.user changes (so we reflect upstream changes)
watch(
  () => props.user && props.user.documents,
  () => {
    localDocs.value = null;
  }
);
</script>

<template>
  <VRow>
    <VCol cols="12">
      <VCard>
        <VCardText>
          <VRow>
            <VCol cols="12" sm="3">
              <AppSelect
                v-model="selectedType"
                placeholder="Filter Type"
                :items="[{ title: 'All', value: '' }, ...documentTypes.map((t: string) => ({ title: t, value: t }))]"
                clearable
              />
            </VCol>

            <VCol cols="12" sm="3">
              <AppSelect
                v-model="selectedStatus"
                placeholder="Status"
                :items="[
                  { title: 'All', value: '' },
                  { title: 'Active', value: 'Active' },
                  { title: 'Expiring', value: 'Expiring' },
                  { title: 'Expired', value: 'Expired' },
                ]"
                clearable
              />
            </VCol>

            <VCol cols="12" sm="6">
              <AppTextField
                v-model="searchQuery"
                placeholder="Search Documents"
              />
            </VCol>

            <!-- Add button moved below next to the search bar -->
          </VRow>
        </VCardText>

        <VDivider />

        <VCardText class="d-flex flex-wrap gap-4">
          <div class="me-3 d-flex gap-3">
            <AppSelect
              :model-value="itemsPerPage"
              :items="[
                { value: 15, title: '15' },
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

          <div
            class="app-user-search-filter d-flex align-center flex-wrap gap-4"
          >
            <div class="d-flex align-center">
              <VBtn prepend-icon="tabler-plus" @click="openAdd"
                >Add Document</VBtn
              >
            </div>
          </div>
        </VCardText>

        <VDivider />

        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          :items="paged"
          :items-length="totalItems"
          item-value="id"
          :headers="[
            { title: '', key: 'select' },
            { title: 'Name', key: 'name' },
            { title: 'Type', key: 'type' },
            { title: 'Number', key: 'number' },
            { title: 'Expiry', key: 'expiry' },
            { title: 'Status', key: 'status' },
            { title: 'Actions', key: 'actions', sortable: false },
          ]"
          class="text-no-wrap"
        >
          <template #item.name="{ item }">
            <div>
              <a class="text-link">{{ item.name }}</a>
              <div class="text-sm text-medium-emphasis">
                {{
                  item.createdAt
                    ? new Date(String(item.createdAt)).toLocaleDateString()
                    : ""
                }}{{ item.note ? " | " + item.note : "" }}
              </div>
            </div>
          </template>

          <template #item.type="{ item }">{{ item.type }}</template>
          <template #item.number="{ item }">-</template>
          <template #item.expiry="{ item }">{{
            item.expiry
              ? new Date(String(item.expiry)).toLocaleDateString()
              : "-"
          }}</template>

          <template #item.status="{ item }">
            <VChip
              size="small"
              :color="
                docStatus(item) === 'Expired'
                  ? 'error'
                  : docStatus(item) === 'Expiring'
                  ? 'warning'
                  : 'success'
              "
              label
              >{{
                docStatus(item) === "Expiring"
                  ? "Expiring Soon"
                  : docStatus(item)
              }}</VChip
            >
          </template>

          <template #item.actions="{ item }">
            <IconBtn @click="openEdit(item)">
              <VIcon icon="tabler-edit" />
            </IconBtn>

            <IconBtn
              v-if="
                item.fileUrl &&
                (String(item.fileUrl).startsWith('data:') ||
                  String(item.fileUrl).startsWith('blob:') ||
                  String(item.fileUrl).startsWith('idb:') ||
                  /^https?:\/\//i.test(String(item.fileUrl)) ||
                  String(item.fileUrl).startsWith('/'))
              "
              @click="openPreview(item)"
              title="Preview"
            >
              <VIcon icon="tabler-eye" />
            </IconBtn>

            <VBtn icon variant="text" color="medium-emphasis">
              <VMenu activator="parent">
                <VList>
                  <VListItem @click="removeDocument(item)">
                    <template #prepend>
                      <VIcon icon="tabler-trash" color="error" />
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
              :total-items="totalItems"
            />
          </template>
        </VDataTableServer>
      </VCard>
    </VCol>

    <!-- Add/Edit Dialog Component -->
    <UserDocumentDialog
      v-model="dialogOpen"
      :doc="dialogDoc"
      :documentTypes="documentTypes"
      :fileCategories="fileCategories"
      @save="onDialogSave"
    />
  </VRow>
</template>

<style lang="scss" scoped>
.v-data-table table {
  border-collapse: collapse;
  inline-size: 100%;
}

.v-data-table th,
.v-data-table td {
  border-block-end: 1px solid rgb(255 255 255 / 2%);
  padding-block: 12px;
  padding-inline: 8px;
  text-align: start;
}

.text-link {
  color: var(--v-theme-primary);
  cursor: pointer;
}
</style>
