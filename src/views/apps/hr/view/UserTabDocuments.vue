<script setup lang="ts">
import type {
  EmployeeDocument,
  EmployeeProperties,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import { useTodos } from "@/stores/todos";
import { deleteFile, getFileObjectUrl } from "@/utils/fileStore";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import type { PropType } from "vue";
import { computed, defineComponent, reactive, ref, watch } from "vue";
import UserDocumentDialog from "./UserDocumentDialog.vue";

const props = defineProps<{ user: EmployeeProperties | null }>();

const emit = defineEmits<{
  (
    e: "open-add-todo",
    payload: {
      initial: Record<string, any>;
      collaborators: Array<{
        id: number | string;
        name: string;
        avatarUrl?: string | null;
      }>;
    },
  ): void;
}>();

const employeesStore = useEmployeesStore();
employeesStore.init();

const AutoOpenGroups = defineComponent({
  name: "AutoOpenGroups",
  props: {
    groupedItems: {
      type: Array as PropType<ReadonlyArray<any>>,
      required: true,
    },
    toggleGroup: {
      type: Function as PropType<(group: any) => void>,
      required: true,
    },
    isGroupOpen: {
      type: Function as PropType<(group: any) => boolean>,
      required: true,
    },
  },
  setup(props) {
    type GroupEntry = {
      id?: string;
      type?: string;
      items?: unknown[];
    } & Record<string, unknown>;

    const autoOpened = new Set<string>();

    const expandGroups = (
      entries: unknown[],
      present: Set<string> = new Set<string>(),
    ) => {
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const group = entry as GroupEntry;
        if (group.type === "group") {
          const groupId = typeof group.id === "string" ? group.id : undefined;
          if (groupId) present.add(groupId);
          if (
            groupId &&
            !autoOpened.has(groupId) &&
            !props.isGroupOpen(group)
          ) {
            props.toggleGroup(group);
            autoOpened.add(groupId);
          } else if (groupId && props.isGroupOpen(group)) {
            autoOpened.add(groupId);
          }
          if (Array.isArray(group.items) && group.items.length) {
            expandGroups(group.items, present);
          }
        }
      }
      return present;
    };

    watch(
      () => props.groupedItems,
      (items) => {
        if (!Array.isArray(items)) return;
        const present = expandGroups(items);
        for (const id of Array.from(autoOpened)) {
          if (!present.has(id)) autoOpened.delete(id);
        }
      },
      { immediate: true, deep: true },
    );

    return () => null;
  },
});

// UI state
const selectedType = ref<string>("");
const selectedStatus = ref<string>("");
const searchQuery = ref("");
const itemsPerPage = ref<number>(25);
const page = ref(1);

const configStore = useConfigStore();
configStore.init();

const documentTypes = computed(() => {
  return (
    configStore.configurations?.crm?.documentTypes || [
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
    ]
  );
});

const isDocumentRenewable = computed(() => {
  const renewable = configStore.configurations?.crm?.documentRenewable;
  return renewable === "yes" || renewable === true;
});

const fileCategories = ["JPG", "PNG", "PDF", "EXCEL", "WORD"] as const;

function docStatus(doc: EmployeeDocument) {
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

const docsList = computed<EmployeeDocument[]>(() => {
  // prefer the authoritative source from the contacts store for the
  // contact's documents so UI updates immediately after store mutations.
  const fromStore = props.user ? employeesStore.byId(props.user.id) : null;
  const docs =
    localDocs.value ?? fromStore?.documents ?? props.user?.documents ?? [];
  return (Array.isArray(docs) ? docs.slice().reverse() : []).slice();
});

// local copy of documents to show immediate updates before parent prop refresh
const localDocs = ref<EmployeeDocument[] | null>(null);

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
const editing = ref<EmployeeDocument | null>(null);
const dialogOpen = ref(false);
const dialogDoc = ref<EmployeeDocument | null>(null);
// delete confirmation for individual documents
const isConfirmDeleteVisible = ref(false);
const deleteCandidate = ref<EmployeeDocument | null>(null);
const todosStore = useTodos();
todosStore.init();
const notifications = useNotificationsStore();

// Email dialog state
const isEmailDialogVisible = ref(false);
const emailDialogRef = ref<any | null>(null);

function onEmailSend(payload: any) {
  try {
    const recipients = Array.isArray(payload?.to)
      ? payload.to.filter(Boolean)
      : payload?.to
        ? [String(payload.to)]
        : [];
    const subject = String(payload?.subject || "(no subject)");
    const count = recipients.length;
    notifications.push(
      `Email sent${
        count ? ` to ${count} recipient${count > 1 ? "s" : ""}` : ""
      }: ${subject}`,
      "success",
      3500,
    );
  } catch (e) {
    try {
      notifications.push("Email sent", "success", 3500);
    } catch {}
  } finally {
    // close the dialog
    isEmailDialogVisible.value = false;
  }
}

const todoCollaboratorOptions = computed(() =>
  employeesStore.all.map((c) => ({
    id: c.id,
    name: c.fullName,
    avatarUrl: c.picture,
  })),
);

function openAddTodoDrawerForDocument(d: EmployeeDocument) {
  const initial: any = {
    title: `Review document: ${d.name || "Untitled"}`,
    collaborators: props.user
      ? [{ id: props.user.id, name: props.user.fullName }]
      : [],
    notes: `Created from document: ${d.name || String(d.id)}`,
    dueAt: new Date().toISOString(),
    priority: "normal",
    status: "pending",
  };
  emit("open-add-todo", {
    initial,
    collaborators: todoCollaboratorOptions.value,
  });
}

const form = reactive<Partial<EmployeeDocument>>({
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

function openEdit(d: EmployeeDocument) {
  editing.value = d;
  dialogDoc.value = d;
  dialogOpen.value = true;
}

async function openPreview(d: EmployeeDocument) {
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
        err,
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
        raw.slice(0, 200),
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
        absolute,
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
      raw,
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
            d.name || raw,
          )}</strong>" does not provide a directly previewable URL.
        </div>
        <div class="note">Stored file identifier: <code>${safe(
          raw,
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
  const payload: EmployeeDocument = {
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

  const current = employeesStore.byId(props.user.id);
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

  employeesStore.updateEmployee(props.user.id, { documents: existing });
  isDialogVisible.value = false;
}

function removeDocument(d: EmployeeDocument) {
  if (!props.user) return;
  const current = employeesStore.byId(props.user.id);
  if (!current) return;

  // if the doc references an idb: pointer, attempt to delete the stored blob
  try {
    const raw = String(d.fileUrl || "").trim();
    if (raw.startsWith("idb:")) {
      const without = raw.slice(4);
      const [key] = without.split("|");
      if (key) {
        // best-effort delete; don't block UI on failure
        deleteFile(key).catch((err) => {
          try {
            // eslint-disable-next-line no-console
            console.warn("Failed to delete idb file for key", key, err);
          } catch {}
        });
      }
    }
  } catch {}

  const existing = (current.documents || []).filter((x) => x.id !== d.id);
  employeesStore.updateEmployee(props.user.id, { documents: existing });
}

function confirmRemoveDocument(d: EmployeeDocument) {
  deleteCandidate.value = d;
  isConfirmDeleteVisible.value = true;
}

function performRemoveConfirmed() {
  if (!deleteCandidate.value) return;
  removeDocument(deleteCandidate.value);
  deleteCandidate.value = null;
  isConfirmDeleteVisible.value = false;
}

function cancelRemove() {
  deleteCandidate.value = null;
  isConfirmDeleteVisible.value = false;
}

function createTodoForDocument(d: EmployeeDocument) {
  // open the drawer prefilled instead of auto-saving
  openAddTodoDrawerForDocument(d);
}

function onAddTodoSaved(payload: any) {
  try {
    const created = todosStore.addTodo(payload);
    // notify user of success, include title (truncate to 60 chars)
    try {
      const rawTitle =
        (created && created.title) || payload?.title || "Untitled";
      const safeTitle =
        String(rawTitle).length > 60
          ? String(rawTitle).slice(0, 57) + "..."
          : String(rawTitle);
      notifications.push(`To-do '${safeTitle}' created`, "success", 3000);
    } catch {}
  } catch (e) {
    // ignore
  }
}

function emailUserForDocument(_d: EmployeeDocument) {
  // open compose dialog with prefilled recipient and optionally attach the document file
  openEmailForDocument(_d).catch(() => {
    // fallback: try mailto if dialog fail
    const mail = String(props.user?.email || "").trim();
    if (!mail) return;
    try {
      window.location.href = `mailto:${mail}`;
    } catch {}
  });
}

async function openEmailForDocument(d: EmployeeDocument) {
  if (!props.user) return;

  // When composing from a document we prefer an empty recipient so user can choose
  // who to send the document to explicitly.
  const to = "";
  const subject = `Document: ${d.name || d.id || "Document"}`;
  const message = `Hi ${
    props.user.fullName || ""
  },\n\nPlease find the document '${d.name || d.id}' attached.\n\nRegards,`;

  // build attachments array; try to resolve idb: pointers to object URLs
  const attachments: Array<{ name: string; url?: string; id?: string }> = [];
  try {
    const raw = String(d.fileUrl || "").trim();
    if (raw) {
      if (/^idb:/.test(raw)) {
        const without = raw.slice(4);
        const [key, encodedName] = without.split("|");
        const name = encodedName
          ? decodeURIComponent(encodedName)
          : d.name || key;
        let url: string | undefined;
        try {
          const got = await getFileObjectUrl(key);
          url = got ?? undefined;
        } catch (e) {
          url = undefined;
        }
        attachments.push({ name: name || String(d.name || key), url, id: key });
      } else if (
        /^https?:\/\//i.test(raw) ||
        /^blob:/.test(raw) ||
        /^data:/.test(raw)
      ) {
        attachments.push({
          name: d.name || raw.split("/").pop() || raw,
          url: raw,
        });
      } else if (/^\//.test(raw)) {
        const absolute = window.location.origin + raw;
        attachments.push({
          name: d.name || raw.split("/").pop() || raw,
          url: absolute,
        });
      } else {
        // plain identifier/filename - attach as info only (no URL)
        attachments.push({ name: d.name || raw, id: raw });
      }
    }
  } catch (e) {
    // ignore attachment resolution errors
  }

  // open dialog and prefill
  isEmailDialogVisible.value = true;
  await nextTick();
  try {
    emailDialogRef.value?.openWith?.({
      to,
      subject,
      message,
      attachments,
    });
  } catch (e) {
    // ignore
  }
}

import { shareToWhatsApp } from "@/utils/shareToWhatsApp";

async function whatsappUserForDocument(d: EmployeeDocument) {
  const notifications = useNotificationsStore();

  // prefer sharing the actual fileUrl if present
  let url: string | undefined = undefined;
  if (d && d.fileUrl) {
    const raw = String(d.fileUrl || "").trim();
    if (/^https?:\/\//.test(raw)) url = raw;
    else if (/^\//.test(raw)) url = window.location.origin + raw;
    else url = raw; // could be an id or other; best-effort
  }

  try {
    // If we have a direct URL, attempt to fetch as blob and convert to File for Web Share API
    if (url) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          // create a File so navigator.share can use it
          const filename =
            (d && d.name) || url.split("/").pop() || "attachment";
          const file = new File([blob], filename, {
            type: blob.type || "application/octet-stream",
          });
          await shareToWhatsApp({
            file,
            url,
            text: `Sharing document: ${d?.name || filename}`,
          });
          return;
        }
      } catch (err) {
        // ignore fetch errors and fall back to URL-only share
      }
    }

    // No fetchable file; open WhatsApp with URL or a message
    const text = d ? `Sharing document: ${d.name || d.id}` : "Sharing document";
    await shareToWhatsApp({ url, text });
  } catch (err: any) {
    notifications.push(
      "Failed to share to WhatsApp: " + String(err ?? "unknown"),
      "error",
      4000,
    );
  }
}

function onDialogSave(payload: EmployeeDocument) {
  try {
    // eslint-disable-next-line no-console
    console.log(
      "UserTabDocuments.onDialogSave called",
      payload,
      "props.user",
      props.user,
    );
  } catch {}
  if (!props.user) {
    try {
      // eslint-disable-next-line no-console
      console.warn("UserTabDocuments.onDialogSave: no props.user, aborting");
    } catch {}
    return;
  }
  const current = employeesStore.byId(props.user.id);
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
  employeesStore.updateEmployee(props.user.id, { documents: existing });
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
  },
);

defineExpose({ handleAddTodoSaved: onAddTodoSaved });
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
                :items="[
                  { title: 'All', value: '' },
                  ...documentTypes.map((t: string) => ({ title: t, value: t })),
                ]"
                clearable
              />
            </VCol>

            <VCol v-if="isDocumentRenewable" cols="12" sm="3">
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
              <VBtn prepend-icon="tabler-plus" @click="openAdd">Document</VBtn>
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

            { title: 'Category', key: 'category' },
            { title: 'Actions', key: 'actions', sortable: false },
          ]"
          :group-by="[{ key: 'category' }]"
          class="text-no-wrap"
        >
          <template #body.prepend="{ groupedItems, toggleGroup, isGroupOpen }">
            <AutoOpenGroups
              :grouped-items="groupedItems"
              :toggle-group="toggleGroup"
              :is-group-open="isGroupOpen"
            />
          </template>

          <template #item.name="{ item }">
            <div>
              <a class="text-link">{{ item.name }}</a>
              <div
                v-if="isDocumentRenewable"
                class="text-sm text-medium-emphasis"
              >
                {{
                  item.expiry
                    ? "Expiry: " +
                      new Date(String(item.expiry)).toLocaleDateString()
                    : ""
                }}
              </div>
              <div class="text-sm text-medium-emphasis">
                {{ item.note ? item.note : "" }}
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

            <VBtn icon variant="text" color="medium-emphasis">
              <VIcon icon="tabler-dots-vertical" />
              <VMenu activator="parent">
                <VList>
                  <VListItem
                    @click.prevent="openPreview(item)"
                    v-if="item.fileUrl"
                  >
                    <template #prepend>
                      <VIcon icon="tabler-eye" />
                    </template>
                    <VListItemTitle>View</VListItemTitle>
                  </VListItem>

                  <VListItem @click.prevent="emailUserForDocument(item)">
                    <template #prepend>
                      <VIcon icon="tabler-mail" />
                    </template>
                    <VListItemTitle>Email</VListItemTitle>
                  </VListItem>

                  <VListItem @click.prevent="whatsappUserForDocument(item)">
                    <template #prepend>
                      <VIcon icon="tabler-brand-whatsapp" />
                    </template>
                    <VListItemTitle>WhatsApp</VListItemTitle>
                  </VListItem>

                  <VDivider />

                  <VListItem @click.prevent="createTodoForDocument(item)">
                    <template #prepend>
                      <VIcon icon="tabler-list-check" />
                    </template>
                    <VListItemTitle>Todo</VListItemTitle>
                  </VListItem>

                  <VDivider />

                  <VListItem @click.prevent="confirmRemoveDocument(item)">
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
    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogVisible"
      @send="onEmailSend"
    />
    <VDialog v-model="isConfirmDeleteVisible" max-width="480">
      <VCard class="pa-sm-8 pa-4">
        <VCardTitle>Delete document</VCardTitle>
        <VCardText>
          <div v-if="deleteCandidate">
            Are you sure you want to permanently delete
            <strong>{{ deleteCandidate.name || deleteCandidate.id }}</strong>
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
