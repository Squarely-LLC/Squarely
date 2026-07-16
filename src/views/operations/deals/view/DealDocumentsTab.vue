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

const props = defineProps<{
  canCreateTask?: boolean;
  canUpdateDeal?: boolean;
  dealId: number | string;
  dealUpdateDisabledReason?: string;
  hideFinancials?: boolean;
  taskCreateDisabledReason?: string;
}>();
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

type LinkedFinanceDocumentKind = NonNullable<
  DealDocumentRow["linkedRecordKind"]
>;

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
const searchQuery = ref("");
const itemsPerPage = ref<number>(25);
const page = ref(1);
const sortBy = ref<Array<{ key: string; order?: "asc" | "desc" }>>([]);

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

const fileCategories = ["JPG", "PNG", "PDF", "EXCEL", "WORD"] as const;
const tableHeaders = [
  { title: "Name", key: "name", width: "46%" },
  { title: "Expiry", key: "expiry", width: "18%" },
  { title: "Type", key: "type", width: "16%" },
  { title: "Actions", key: "actions", sortable: false, width: "20%" },
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

function expiryClass(doc: JobDocument | DealDocumentRow) {
  const status = docStatus(doc);
  if (status === "Expired") return "text-error";
  if (status === "Expiring") return "text-warning";
  return "text-medium-emphasis";
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
  kind: LinkedFinanceDocumentKind,
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

const defaultDisabledReason =
  "You do not have permission to perform this action.";
const dealUpdateReason = computed(
  () => props.dealUpdateDisabledReason || defaultDisabledReason,
);
const taskCreateReason = computed(
  () => props.taskCreateDisabledReason || defaultDisabledReason,
);
const hiddenFinancialReason = "Financials are hidden for this role.";
const canMutateDocuments = computed(() => Boolean(props.canUpdateDeal));
const canCreateDocumentTodo = computed(() => Boolean(props.canCreateTask));
const isLinkedFinanceDocument = (doc: JobDocument | DealDocumentRow) =>
  Boolean((doc as DealDocumentRow).linkedRecordKind);
const canShareDocument = (doc: JobDocument | DealDocumentRow) =>
  !(props.hideFinancials && isLinkedFinanceDocument(doc));
const shareDisabledReason = (doc: JobDocument | DealDocumentRow) =>
  props.hideFinancials && isLinkedFinanceDocument(doc)
    ? hiddenFinancialReason
    : defaultDisabledReason;

const notifyDenied = (message: string) => {
  notifications.push(message, "warning", 3000);
};

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
    if (!q) return true;
    return (
      (d.name || "").toString().toLowerCase().includes(q) ||
      (d.note || "").toString().toLowerCase().includes(q) ||
      (String(d.type) || "").toLowerCase().includes(q)
    );
  });
});

const getExpirySortTime = (doc: JobDocument | DealDocumentRow) => {
  if (!doc.expiry) return null;

  const time = new Date(String(doc.expiry)).getTime();
  return Number.isNaN(time) ? null : time;
};

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const sorted = computed(() => {
  const rows = [...filtered.value];
  const activeSort = sortBy.value[0];
  if (!activeSort?.key) return rows;

  const direction = activeSort.order === "desc" ? -1 : 1;

  return rows.sort((left, right) => {
    if (activeSort.key === "expiry") {
      const leftTime = getExpirySortTime(left);
      const rightTime = getExpirySortTime(right);

      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;

      return (leftTime - rightTime) * direction;
    }

    if (activeSort.key === "name")
      return compareText(left.name, right.name) * direction;

    if (activeSort.key === "type")
      return compareText(left.type, right.type) * direction;

    return 0;
  });
});

const totalItems = computed(() => sorted.value.length);
const paged = computed(() => {
  if (itemsPerPage.value === -1) return sorted.value;
  const start = (page.value - 1) * itemsPerPage.value;
  return sorted.value.slice(start, start + itemsPerPage.value);
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
  if (!canMutateDocuments.value) {
    notifyDenied(dealUpdateReason.value);
    return;
  }

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
  if (!canMutateDocuments.value) {
    notifyDenied(dealUpdateReason.value);
    return;
  }

  editing.value = d;
  dialogDoc.value = d;
  dialogOpen.value = true;
}

async function openPreview(d: JobDocument) {
  if (!d || !d.fileUrl) return;
  if (!canShareDocument(d)) {
    notifyDenied(shareDisabledReason(d));
    return;
  }

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
  if (!canMutateDocuments.value) {
    notifyDenied(dealUpdateReason.value);
    return;
  }

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
  if (!canMutateDocuments.value) {
    notifyDenied(dealUpdateReason.value);
    return;
  }

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
  if (!canCreateDocumentTodo.value) {
    notifyDenied(taskCreateReason.value);
    return;
  }

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
  if (!canShareDocument(_d)) {
    notifyDenied(shareDisabledReason(_d));
    return;
  }

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
  if (!canShareDocument(d)) {
    notifyDenied(shareDisabledReason(d));
    return;
  }

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
  if (!canMutateDocuments.value) {
    notifyDenied(dealUpdateReason.value);
    return;
  }

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
          <div class="documents-toolbar">
            <AppSelect
              :model-value="itemsPerPage"
              :items="[
                { value: 15, title: '15' },
                { value: 25, title: '25' },
                { value: 50, title: '50' },
                { value: 100, title: '100' },
                { value: -1, title: 'All' },
              ]"
              class="documents-toolbar__per-page"
              @update:model-value="updateItemsPerPage"
            />

            <AppSelect
              v-model="selectedType"
              placeholder="Filter Type"
              :items="[
                { title: 'All', value: '' },
                ...documentTypes.map((t: string) => ({ title: t, value: t })),
              ]"
              class="documents-toolbar__type"
              clearable
            />

            <AppTextField
              v-model="searchQuery"
              placeholder="Search Documents"
              class="documents-toolbar__search"
            />

            <VTooltip
              :text="canMutateDocuments ? 'Add document' : dealUpdateReason"
              location="top"
            >
              <template #activator="{ props: tooltipProps }">
                <span
                  v-bind="tooltipProps"
                  class="d-inline-flex documents-toolbar__add"
                >
                  <VBtn
                    prepend-icon="tabler-plus"
                    :disabled="!canMutateDocuments"
                    @click="openAdd"
                  >
                    Document
                  </VBtn>
                </span>
              </template>
            </VTooltip>
          </div>
        </VCardText>

        <VDivider />

        <VDataTableServer
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          v-model:sort-by="sortBy"
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
              <div class="document-cell__title">{{ item.name }}</div>
              <div class="text-sm text-medium-emphasis document-cell__meta">
                {{ item.note ? item.note : "" }}
              </div>
            </div>
          </template>

          <template #item.type="{ item }">
            <div class="document-cell document-cell--type">{{ item.type }}</div>
          </template>

          <template #item.expiry="{ item }">
            <div class="document-cell document-cell--expiry">
              <span v-if="item.expiry" :class="expiryClass(item)">
                {{ formatSystemDate(String(item.expiry)) }}
              </span>
              <span v-else class="text-medium-emphasis">-</span>
            </div>
          </template>

          <template #item.actions="{ item }">
            <div class="document-cell document-cell--actions">
              <IconBtn
                :disabled="!item.fileUrl || !canShareDocument(item)"
                @click="
                  item.fileUrl && canShareDocument(item)
                    ? openPreview(item)
                    : undefined
                "
              >
                <VIcon icon="tabler-eye" />
              </IconBtn>
              <VTooltip
                v-if="!item.fileUrl || !canShareDocument(item)"
                activator="parent"
                location="top"
              >
                {{
                  item.fileUrl
                    ? shareDisabledReason(item)
                    : "No preview available"
                }}
              </VTooltip>

              <IconBtn
                :disabled="isReadonlyDocument(item) || !canMutateDocuments"
                @click="
                  !isReadonlyDocument(item) && canMutateDocuments
                    ? openEdit(item)
                    : undefined
                "
              >
                <VIcon icon="tabler-edit" />
              </IconBtn>
              <VTooltip
                v-if="isReadonlyDocument(item) || !canMutateDocuments"
                activator="parent"
                location="top"
              >
                {{
                  isReadonlyDocument(item)
                    ? "Linked finance documents are edited from Finance."
                    : dealUpdateReason
                }}
              </VTooltip>

              <VBtn icon variant="text" color="medium-emphasis">
                <VIcon icon="tabler-dots-vertical" />
                <VMenu activator="parent">
                  <VList>
                    <VListItem
                      :disabled="!canShareDocument(item)"
                      @click.prevent="emailUserForDocument(item)"
                    >
                      <template #prepend>
                        <VIcon icon="tabler-mail" />
                      </template>
                      <VListItemTitle>Email</VListItemTitle>
                    </VListItem>

                    <VListItem
                      :disabled="!canShareDocument(item)"
                      @click.prevent="whatsappUserForDocument(item)"
                    >
                      <template #prepend>
                        <VIcon icon="tabler-brand-whatsapp" />
                      </template>
                      <VListItemTitle>WhatsApp</VListItemTitle>
                    </VListItem>

                    <VDivider />

                    <VListItem
                      :disabled="!canCreateDocumentTodo"
                      @click.prevent="createTodoForDocument(item)"
                    >
                      <template #prepend>
                        <VIcon icon="tabler-list-check" />
                      </template>
                      <VListItemTitle>Todo</VListItemTitle>
                    </VListItem>

                    <template v-if="!isReadonlyDocument(item)">
                      <VDivider />

                      <VListItem
                        :disabled="!canMutateDocuments"
                        @click.prevent="confirmRemoveDocument(item)"
                      >
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
      auto-fill-name-from-type
      auto-enable-expiry-reminder-on-date
      @save="onDialogSave"
    />
    <EmailDialog
      ref="emailDialogRef"
      v-model:is-dialog-visible="isEmailDialogVisible"
      @send="onEmailSend"
    />
    <VDialog v-model="isConfirmDeleteVisible" max-width="480">
      <DialogCloseBtn @click="isConfirmDeleteVisible = false" />
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
          <VBtn
            variant="tonal"
            color="error"
            :disabled="!canMutateDocuments"
            @click="performRemoveConfirmed"
          >
            Delete
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </VRow>
</template>

<style lang="scss" scoped>
.documents-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.documents-toolbar__per-page {
  flex: 0 0 6.25rem;
}

.documents-toolbar__type {
  flex: 0 1 13rem;
  min-inline-size: 12rem;
}

.documents-toolbar__search {
  flex: 1 1 16rem;
  min-inline-size: 14rem;
}

.documents-toolbar__add {
  flex: 0 0 auto;
}

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

  :deep(thead th) {
    padding-block: 18px 16px;
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
    inline-size: 46%;
  }

  :deep(thead th:nth-child(3)),
  :deep(tbody td:nth-child(3)) {
    inline-size: 18%;
  }

  :deep(thead th:nth-child(4)),
  :deep(tbody td:nth-child(4)) {
    inline-size: 16%;
  }

  :deep(thead th:nth-child(5)),
  :deep(tbody td:nth-child(5)) {
    inline-size: 20%;
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

.document-cell__title {
  color: rgb(var(--v-theme-on-surface));
}

.document-cell--type,
.document-cell--expiry {
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

</style>
