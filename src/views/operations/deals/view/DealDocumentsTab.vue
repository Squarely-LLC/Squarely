<script setup lang="ts">
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { useDealsStore } from "@/stores/deals";
import { useInvoicesStore } from "@/stores/invoices";
import { useNotificationsStore } from "@/stores/notifications";
import { useProformasStore } from "@/stores/proformas";
import { useQuotationsStore } from "@/stores/quotations";
import { useTodos } from "@/stores/todos";
import { deleteFile, getFileObjectUrl } from "@/utils/fileStore";
import { shareToWhatsApp } from "@/utils/shareToWhatsApp";
import EmailDialog from "@/views/apps/email/EmailDialog.vue";
import JobDocumentDialog from "@/views/operations/jobs/view/JobDocumentDialog.vue";
import { formatSystemDate } from "@core/utils/formatters";
import type { PropType } from "vue";
import { computed, defineComponent, nextTick, reactive, ref, watch } from "vue";
import { useTheme } from "vuetify";

const props = defineProps<{ dealId: number | string }>();
const theme = useTheme();

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

const dealsStore = useDealsStore();
dealsStore.init();
const quotationsStore = useQuotationsStore();
const proformasStore = useProformasStore();
const invoicesStore = useInvoicesStore();

quotationsStore.init();
proformasStore.init();
invoicesStore.init();

type DealDocumentRow = JobDocument & {
  isReadonly?: boolean;
  linkedRecordId?: number | string;
  linkedRecordKind?: "quotation" | "proforma" | "invoice";
};

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
  return renewable === "yes";
});

const fileCategories = ["JPG", "PNG", "PDF", "EXCEL", "WORD"] as const;
const tableHeaders = [
  { title: "Name", key: "name", width: "56%" },
  { title: "Type", key: "type", width: "14%" },
  { title: "Category", key: "category", width: "15%" },
  { title: "Actions", key: "actions", sortable: false, width: "15%" },
] as const;
const groupHeaderStyle = computed(() => ({
  backgroundColor: theme.current.value.dark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.08)",
  borderTop: theme.current.value.dark
    ? "1px solid rgba(255, 255, 255, 0.14)"
    : "1px solid rgba(0, 0, 0, 0.12)",
  borderBottom: theme.current.value.dark
    ? "1px solid rgba(255, 255, 255, 0.14)"
    : "1px solid rgba(0, 0, 0, 0.12)",
  paddingBlock: "14px",
  paddingInlineStart: "24px",
}));

function docStatus(doc: JobDocument) {
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

const deal = computed(() => dealsStore.byId(props.dealId));

const buildStoredAttachmentUrl = (
  fileKey?: string | null,
  fileName?: string | null,
) => {
  const normalizedFileKey = String(fileKey ?? "").trim();

  if (!normalizedFileKey) return "";

  const normalizedFileName = String(fileName ?? "").trim();

  return normalizedFileName
    ? `idb:${normalizedFileKey}|${encodeURIComponent(normalizedFileName)}`
    : `idb:${normalizedFileKey}`;
};

const buildFinanceDocumentRows = <
  TRecord extends {
    note?: string | null;
    quotation: {
      attachmentFileKey?: string | null;
      attachmentName?: string | null;
      dealId?: number | null;
      id: number | string;
      issuedDate?: string | null;
      quoteNumber?: string | null;
      quotationStatus?: string | null;
      source?: string | null;
    };
  },
>(
  kind: DealDocumentRow["linkedRecordKind"],
  records: TRecord[],
): DealDocumentRow[] =>
  records
    .filter(
      (record) =>
        String(record.quotation.dealId ?? "") === String(props.dealId) &&
        (String(record.quotation.attachmentFileKey ?? "").trim() ||
          String(record.quotation.attachmentName ?? "").trim()),
    )
    .map((record, index) => {
      const quoteNumber = String(record.quotation.quoteNumber ?? "").trim();
      const attachmentName = String(
        record.quotation.attachmentName ?? "",
      ).trim();
      const fileUrl = buildStoredAttachmentUrl(
        record.quotation.attachmentFileKey,
        attachmentName,
      );
      const numericRecordId = Number(record.quotation.id);
      const fallbackId = index + 1;
      const stableId = Number.isFinite(numericRecordId)
        ? numericRecordId
        : fallbackId;
      const idBase = kind === "quotation" ? 1 : kind === "proforma" ? 2 : 3;

      return {
        category:
          record.quotation.source === "external"
            ? "External Attachment"
            : "Linked Attachment",
        createdAt:
          String(record.quotation.issuedDate ?? "").trim() || undefined,
        expiry: null,
        expiryReminder: false,
        fileUrl,
        id: -(idBase * 1000000 + stableId),
        isReadonly: true,
        linkedRecordId: record.quotation.id,
        linkedRecordKind: kind,
        name:
          attachmentName ||
          `${kind.toUpperCase()} ${quoteNumber || `#${record.quotation.id}`}`,
        note:
          [
            quoteNumber ? `Number: ${quoteNumber}` : "",
            record.quotation.quotationStatus
              ? `Status: ${record.quotation.quotationStatus}`
              : "",
            String(record.note ?? "").trim(),
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
        type:
          kind === "quotation"
            ? "Quotation"
            : kind === "proforma"
              ? "Proforma"
              : "Invoice",
      };
    });

const linkedFinanceDocs = computed<DealDocumentRow[]>(() => [
  ...buildFinanceDocumentRows("quotation", quotationsStore.items),
  ...buildFinanceDocumentRows("proforma", proformasStore.items),
  ...buildFinanceDocumentRows("invoice", invoicesStore.items),
]);

const isReadonlyDocument = (doc: JobDocument | DealDocumentRow) =>
  Boolean((doc as DealDocumentRow).isReadonly);

const docsList = computed<DealDocumentRow[]>(() => {
  const fromStore = deal.value;
  const docs = localDocs.value ?? fromStore?.documents ?? [];

  return [
    ...(Array.isArray(docs) ? docs.slice().reverse() : []),
    ...linkedFinanceDocs.value,
  ];
});

const localDocs = ref<JobDocument[] | null>(null);

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

const editing = ref<JobDocument | null>(null);
const dialogOpen = ref(false);
const dialogDoc = ref<JobDocument | null>(null);
const isConfirmDeleteVisible = ref(false);
const deleteCandidate = ref<JobDocument | null>(null);
const todosStore = useTodos();
todosStore.init();
const notifications = useNotificationsStore();

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
    isEmailDialogVisible.value = false;
  }
}

const form = reactive<Partial<JobDocument>>({
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

function openEdit(d: JobDocument) {
  if (isReadonlyDocument(d)) return;

  editing.value = d;
  dialogDoc.value = d;
  dialogOpen.value = true;
}

async function openPreview(d: JobDocument) {
  if (!d || !d.fileUrl) return;
  const raw = String(d.fileUrl || "").trim();

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
      console.error(
        "openPreview: anchor open failed, falling back to window.open",
        err,
      );
      window.open(url, "_blank");
    }
  };

  if (/^data:/.test(raw) || /^blob:/.test(raw) || /^https?:\/\//i.test(raw)) {
    openUrl(raw);
    return;
  }

  if (/^idb:/.test(raw)) {
    try {
      const without = raw.slice(4);
      const [key] = without.split("|");
      const objUrl = await getFileObjectUrl(key);
      if (objUrl) {
        openUrl(objUrl);
        return;
      }
    } catch {}
  }

  if (/^\//.test(raw)) {
    const absolute = window.location.origin + raw;
    openUrl(absolute);
    return;
  }

  const w = window.open("about:blank", "_blank");
  if (!w) return;
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
  } catch {}
}

function removeDocument(d: JobDocument) {
  if (isReadonlyDocument(d)) return;

  const currentDeal = dealsStore.byId(props.dealId);
  if (!currentDeal) return;

  try {
    const raw = String(d.fileUrl || "").trim();
    if (raw.startsWith("idb:")) {
      const without = raw.slice(4);
      const [key] = without.split("|");
      if (key) {
        deleteFile(key).catch((err) => {
          console.warn("Failed to delete idb file for key", key, err);
        });
      }
    }
  } catch {}

  const existing = (currentDeal.documents || []).filter((x) => x.id !== d.id);
  const updatedDeal = dealsStore.updateDeal(currentDeal.id, {
    documents: existing,
  });

  localDocs.value = updatedDeal?.documents ?? existing;
}

function confirmRemoveDocument(d: JobDocument) {
  if (isReadonlyDocument(d)) return;

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

function createTodoForDocument(d: JobDocument) {
  openAddTodoDrawerForDocument(d);
}

function openAddTodoDrawerForDocument(d: JobDocument) {
  const initial: any = {
    title: `Review document: ${d.name || "Untitled"}`,
    collaborators: [],
    notes: `Created from document: ${d.name || String(d.id)}`,
    dueAt: new Date().toISOString(),
    priority: "normal",
    status: "pending",
  };
  emit("open-add-todo", {
    initial,
    collaborators: [],
  });
}

function onAddTodoSaved(payload: any) {
  try {
    const created = todosStore.addTodo(payload);
    try {
      const rawTitle =
        (created && created.title) || payload?.title || "Untitled";
      const safeTitle =
        String(rawTitle).length > 60
          ? String(rawTitle).slice(0, 57) + "..."
          : String(rawTitle);
      notifications.push(`To-do '${safeTitle}' created`, "success", 3000);
    } catch {}
  } catch (e) {}
}

function emailUserForDocument(_d: JobDocument) {
  openEmailForDocument(_d).catch(() => {
    notifications.push("Failed to open email", "error", 2500);
  });
}

async function openEmailForDocument(d: JobDocument) {
  if (!deal.value) return;

  const to = "";
  const subject = `Document: ${d.name || d.id || "Document"}`;
  const message = `Hi,\n\nPlease find the document '${
    d.name || d.id
  }' attached for ${deal.value.code || `Deal #${deal.value.id}`}.\n\nRegards,`;

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
        attachments.push({ name: d.name || raw, id: raw });
      }
    }
  } catch (e) {}

  isEmailDialogVisible.value = true;
  await nextTick();
  try {
    emailDialogRef.value?.openWith?.({
      to,
      subject,
      message,
      attachments,
    });
  } catch (e) {}
}

async function whatsappUserForDocument(d: JobDocument) {
  const notifications = useNotificationsStore();

  let url: string | undefined = undefined;
  if (d && d.fileUrl) {
    const raw = String(d.fileUrl || "").trim();
    if (/^https?:\/\//.test(raw)) url = raw;
    else if (/^\//.test(raw)) url = window.location.origin + raw;
    else url = raw;
  }

  try {
    if (url) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
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
      } catch (err) {}
    }

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

function onDialogSave(payload: JobDocument) {
  const currentDeal = dealsStore.byId(props.dealId);
  if (!currentDeal) return;

  const existing = Array.isArray(currentDeal.documents)
    ? [...currentDeal.documents]
    : [];

  if (editing.value) {
    const idx = existing.findIndex((x) => x.id === editing.value!.id);
    if (idx !== -1) existing[idx] = payload;
  } else {
    existing.push(payload);
  }

  const updatedDeal = dealsStore.updateDeal(currentDeal.id, {
    documents: existing,
  });

  localDocs.value = updatedDeal?.documents ?? existing;
  notifications.push("Document saved", "success", 2500);
  dialogOpen.value = false;
}

watch(
  () => deal.value && deal.value.documents,
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
          :headers="tableHeaders"
          :group-by="[{ key: 'type' }]"
          class="document-table"
        >
          <template #body.prepend="{ groupedItems, toggleGroup, isGroupOpen }">
            <AutoOpenGroups
              :grouped-items="groupedItems"
              :toggle-group="toggleGroup"
              :is-group-open="isGroupOpen"
            />
          </template>

          <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
            <tr class="document-group-header">
              <td :colspan="columns.length" :style="groupHeaderStyle">
                <button
                  type="button"
                  class="document-group-toggle"
                  @click="toggleGroup(item)"
                >
                  <VIcon
                    :icon="
                      isGroupOpen(item)
                        ? 'tabler-chevron-down'
                        : 'tabler-chevron-right'
                    "
                    size="18"
                  />
                  <span>
                    {{ item.value }} ({{ item.items?.length ?? 0 }})
                  </span>
                </button>
              </td>
            </tr>
          </template>

          <template #item.name="{ item }">
            <div class="document-cell document-cell--name">
              <a class="text-link">{{ item.name }}</a>
              <div
                v-if="isDocumentRenewable"
                class="text-sm text-medium-emphasis document-cell__meta"
              >
                {{
                  item.expiry
                    ? "Expiry: " + formatSystemDate(String(item.expiry))
                    : ""
                }}
              </div>
              <div class="text-sm text-medium-emphasis document-cell__meta">
                {{ item.note ? item.note : "" }}
              </div>
            </div>
          </template>

          <template #item.type="{ item }">
            <div class="document-cell document-cell--type">{{ item.type }}</div>
          </template>

          <template #item.category="{ item }">
            <div class="document-cell document-cell--category">
              {{ item.category || "-" }}
            </div>
          </template>

          <template #item.number="{ item }">-</template>
          <template #item.expiry="{ item }">{{
            item.expiry ? formatSystemDate(String(item.expiry)) : "-"
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
            <div class="document-cell document-cell--actions">
              <IconBtn
                :disabled="isReadonlyDocument(item)"
                @click="openEdit(item)"
              >
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

                    <template v-if="!isReadonlyDocument(item)">
                      <VDivider />

                      <VListItem @click.prevent="confirmRemoveDocument(item)">
                        <template #prepend>
                          <VIcon icon="tabler-trash" color="error" />
                        </template>
                        <VListItemTitle>Delete</VListItemTitle>
                      </VListItem>
                    </template>
                  </VList>
                </VMenu>
              </VBtn>
            </div>
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

    <JobDocumentDialog
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
        <VCardActions class="justify-space-between">
          <VBtn variant="tonal" color="secondary" @click="cancelRemove">
            Cancel
          </VBtn>
          <VBtn variant="tonal" color="error" @click="performRemoveConfirmed">
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VRow>
</template>

<style lang="scss" scoped>
.document-table {
  :deep(table) {
    border-collapse: collapse;
    inline-size: 100%;
    table-layout: fixed;
  }

  :deep(th),
  :deep(td) {
    border-block-end: 1px solid rgb(255 255 255 / 2%);
    padding-block: 12px;
    padding-inline: 8px;
    text-align: start;
    vertical-align: top;
  }

  :deep(thead tr th:first-child) {
    display: none;
  }

  :deep(tbody tr:not(.document-group-header) > td:first-child) {
    display: none;
  }

  :deep(tbody tr:not(.document-group-header) > td) {
    padding-block: 18px !important;
  }

  :deep(thead th:nth-child(2)),
  :deep(tbody td:nth-child(2)) {
    inline-size: 56%;
  }

  :deep(thead th:nth-child(3)),
  :deep(tbody td:nth-child(3)) {
    inline-size: 14%;
  }

  :deep(thead th:nth-child(4)),
  :deep(tbody td:nth-child(4)) {
    inline-size: 15%;
  }

  :deep(thead th:nth-child(5)),
  :deep(tbody td:nth-child(5)) {
    inline-size: 15%;
  }
}

.document-group-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  gap: 8px;
}

.document-cell {
  min-inline-size: 0;
}

.document-cell--name {
  overflow-wrap: anywhere;
  white-space: normal;
}

.document-cell--type,
.document-cell--category {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-cell--actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  white-space: nowrap;
}

.document-cell__meta {
  padding: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.text-link {
  color: var(--v-theme-primary);
  cursor: pointer;
}
</style>
