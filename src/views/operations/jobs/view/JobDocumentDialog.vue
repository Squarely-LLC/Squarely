<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { getFileInfo, getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { computed, reactive, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  doc?: JobDocument | null;
  documentTypes?: string[];
  fileCategories?: readonly string[];
  autoFillNameFromType?: boolean;
  autoEnableExpiryReminderOnDate?: boolean;
}>();

const emits = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "save", payload: JobDocument): void;
}>();

type FormModel = Partial<JobDocument> & {
  expiryEnabled: boolean;
  fileAttachment?: File | null;
  linkUrl?: string | null;
  storedFileUrl?: string | null;
};

const ACCEPTED_EXT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];
const MAX_BYTES = 10 * 1024 * 1024;

const reminderOptions = [
  { title: "4 weeks before", value: 28 },
  { title: "3 weeks before", value: 21 },
  { title: "2 weeks before", value: 14 },
  { title: "2 days before", value: 2 },
  { title: "1 day before", value: 1 },
] as const;

const form = reactive<FormModel>({
  id: undefined,
  category: undefined,
  type: undefined,
  name: "",
  note: "",
  fileUrl: undefined,
  expiry: undefined,
  expiryReminder: false,
  expiryReminderOffsetDays: 14,
  expiryEnabled: false,
  fileAttachment: null,
  linkUrl: null,
  storedFileUrl: null,
});

const fileInputRef = ref<HTMLInputElement | null>(null);
const fileError = ref<string | null>(null);
const previewUrl = ref<string | null>(null);
const previewKind = ref<"image" | "pdf" | "file" | "none">("none");
const lastAutoFilledName = ref<string | null>(null);
const uploading = ref(false);

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emits("update:modelValue", value),
});

const documentTypeItems = computed(() =>
  (props.documentTypes || []).map((type) => ({ title: type, value: type })),
);

const hasAttachment = computed(
  () =>
    Boolean(form.fileAttachment) ||
    Boolean(form.storedFileUrl) ||
    Boolean(form.linkUrl),
);
const hasFileSource = computed(
  () => Boolean(form.fileAttachment) || Boolean(form.storedFileUrl),
);
const hasLinkSource = computed(() => Boolean(String(form.linkUrl || "").trim()));
const hasExactlyOneSource = computed(
  () => (hasFileSource.value || hasLinkSource.value) && !(hasFileSource.value && hasLinkSource.value),
);
const expiryDateRequired = computed(
  () => Boolean(form.expiryEnabled) && !form.expiry,
);

const isValid = computed(
  () =>
    Boolean(String(form.type || "").trim()) &&
    Boolean(String(form.name || "").trim()) &&
    hasExactlyOneSource.value &&
    !expiryDateRequired.value &&
    !fileError.value,
);

const previewLabel = computed(() => {
  if (form.fileAttachment) return form.fileAttachment.name;
  if ((form as any)._attachedName) return (form as any)._attachedName;
  if (form.linkUrl) return form.linkUrl;
  if (form.storedFileUrl) return form.name || "Attached file";
  return "No attachment selected";
});

function close() {
  emits("update:modelValue", false);
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function inferCategoryFromFilename(name?: string | null) {
  const lower = String(name || "").toLowerCase().split(/[?#]/)[0];
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "EXCEL";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "WORD";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPG";
  if (lower.endsWith(".png")) return "PNG";
  return undefined;
}

function isAcceptableLink(url?: string | null) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return false;
  if (/^data:|^blob:|^idb:/i.test(trimmed)) return true;

  try {
    const parsed = new URL(trimmed, window.location.href);
    const lower = parsed.pathname.toLowerCase();
    return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
  } catch {
    const lower = trimmed.toLowerCase().split(/[?#]/)[0];
    return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
  }
}

function getPreviewKind(source?: string | null, file?: File | null) {
  const type = file?.type || "";
  const name = file?.name || source || "";
  const lower = name.toLowerCase().split(/[?#]/)[0];

  if (type.startsWith("image/") || /\.(jpg|jpeg|png)$/.test(lower))
    return "image";
  if (type === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (source || file) return "file";
  return "none";
}

function revokePreviewUrl() {
  if (previewUrl.value?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(previewUrl.value);
    } catch {}
  }
  previewUrl.value = null;
  previewKind.value = "none";
}

async function refreshPreview() {
  revokePreviewUrl();

  if (form.fileAttachment) {
    previewUrl.value = URL.createObjectURL(form.fileAttachment);
    previewKind.value = getPreviewKind(previewUrl.value, form.fileAttachment);
    return;
  }

  const source = String(form.storedFileUrl || form.linkUrl || "").trim();
  if (!source) return;

  previewKind.value = getPreviewKind(source);

  if (source.startsWith("idb:")) {
    const without = source.slice(4);
    const [key] = without.split("|");
    previewUrl.value = key ? await getFileObjectUrl(key) : null;
    return;
  }

  if (source.startsWith("/")) {
    previewUrl.value = window.location.origin + source;
    return;
  }

  previewUrl.value = source;
}

function clearFile() {
  form.fileAttachment = null;
  form.storedFileUrl = null;
  try {
    (form as any)._attachedName = undefined;
    (form as any)._attachedSize = undefined;
  } catch {}
  refreshPreview();
}

function clearLink() {
  form.linkUrl = null;
  fileError.value = null;
  refreshPreview();
}

function triggerFilePicker() {
  if (hasLinkSource.value) return;
  fileInputRef.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!file) return;

  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXT.some((ext) => lower.endsWith(ext))) {
    fileError.value = `Unsupported file type. Allowed: ${ACCEPTED_EXT.join(", ")}`;
    input.value = "";
    return;
  }

  if (file.size > MAX_BYTES) {
    fileError.value = `File is too large. Max allowed is ${formatBytes(MAX_BYTES)}.`;
    input.value = "";
    return;
  }

  fileError.value = null;
  form.fileAttachment = file;
  form.storedFileUrl = null;
  form.linkUrl = null;
  const inferred = inferCategoryFromFilename(file.name);
  if (inferred) form.category = inferred;
  input.value = "";
  refreshPreview();
}

function validateLink() {
  const value = String(form.linkUrl || "").trim();
  if (!value) {
    fileError.value = null;
    refreshPreview();
    return;
  }

  if (!isAcceptableLink(value)) {
    fileError.value = `Links must point to files with these extensions: ${ACCEPTED_EXT.join(", ")}`;
    refreshPreview();
    return;
  }

  fileError.value = null;
  clearFile();
  form.linkUrl = value;
  const inferred = inferCategoryFromFilename(value);
  if (inferred) form.category = inferred;
  refreshPreview();
}

function resetForm() {
  revokePreviewUrl();
  Object.assign(form, {
    id: undefined,
    category: undefined,
    type: undefined,
    name: "",
    note: "",
    fileUrl: undefined,
    expiry: undefined,
    expiryReminder: false,
    expiryReminderOffsetDays: 14,
    expiryEnabled: false,
    fileAttachment: null,
    linkUrl: null,
    storedFileUrl: null,
  });
  lastAutoFilledName.value = null;
  fileError.value = null;
}

function populateForm(document: JobDocument | null | undefined) {
  if (!document) {
    resetForm();
    return;
  }

  resetForm();
  Object.assign(form, {
    ...document,
    expiryEnabled: Boolean(document.expiry),
    expiryReminder: Boolean(document.expiry),
    expiryReminderOffsetDays: document.expiryReminderOffsetDays ?? 14,
  });

  if (document.fileUrl?.startsWith("idb:")) {
    form.storedFileUrl = document.fileUrl;
    const without = document.fileUrl.slice(4);
    const [key, encodedName] = without.split("|");
    const name = encodedName ? decodeURIComponent(encodedName) : document.name;
    (form as any)._attachedName = name;
    try {
      getFileInfo(key).then((info) => {
        if (info) (form as any)._attachedSize = info.size;
      });
    } catch {}
  } else {
    form.linkUrl = document.fileUrl || null;
  }

  refreshPreview();
}

watch(
  () => props.doc,
  (document) => populateForm(document),
  { immediate: true },
);

watch(open, (isOpen) => {
  if (isOpen) populateForm(props.doc);
  else resetForm();
});

watch(
  () => form.type,
  (type) => {
    if (!props.autoFillNameFromType) return;

    const nextName = String(type ?? "").trim();
    if (!nextName) return;

    const currentName = String(form.name ?? "").trim();
    const canAutoFill =
      !currentName ||
      (!!lastAutoFilledName.value && currentName === lastAutoFilledName.value);

    if (!canAutoFill) return;

    form.name = nextName;
    lastAutoFilledName.value = nextName;
  },
);

watch(
  () => form.expiryEnabled,
  (enabled) => {
    if (!enabled) {
      form.expiry = undefined;
      form.expiryReminder = false;
      form.expiryReminderOffsetDays = null;
      return;
    }

    form.expiryReminderOffsetDays = form.expiryReminderOffsetDays ?? 14;
    form.expiryReminder = Boolean(form.expiry);
  },
);

watch(
  () => form.expiry,
  (expiry) => {
    if (!form.expiryEnabled) return;
    form.expiryReminder = Boolean(expiry);
    form.expiryReminderOffsetDays = expiry
      ? (form.expiryReminderOffsetDays ?? 14)
      : null;
  },
);

function openPreview() {
  if (!previewUrl.value) return;
  const link = document.createElement("a");
  link.href = previewUrl.value;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function save() {
  if (!hasExactlyOneSource.value) {
    fileError.value = hasFileSource.value && hasLinkSource.value
      ? "Choose either an attachment or a link, not both."
      : "Attachment or link is required.";
    return;
  }

  if (expiryDateRequired.value) return;

  if (form.linkUrl && !isAcceptableLink(form.linkUrl)) {
    fileError.value = `Links must point to files with these extensions: ${ACCEPTED_EXT.join(", ")}`;
    return;
  }

  if (!isValid.value) return;

  const expiryEnabled = Boolean(form.expiryEnabled && form.expiry);
  const payload: JobDocument = {
    id: Number(form.id ?? Date.now()),
    category: form.category || undefined,
    type: form.type || undefined,
    name: String(form.name || "").trim(),
    note: String(form.note || "").trim() || undefined,
    fileUrl: form.storedFileUrl || form.linkUrl || undefined,
    expiry: expiryEnabled ? form.expiry || undefined : undefined,
    expiryReminder: expiryEnabled,
    expiryReminderOffsetDays: expiryEnabled
      ? (form.expiryReminderOffsetDays ?? 14)
      : null,
    createdAt: form.createdAt || new Date().toISOString(),
  };

  if (form.fileAttachment) {
    try {
      uploading.value = true;
      const key = await saveFile(form.fileAttachment);
      payload.fileUrl = `idb:${key}|${encodeURIComponent(form.fileAttachment.name)}`;
    } finally {
      uploading.value = false;
    }
  }

  emits("save", payload);
  close();
}
</script>

<template>
  <VDialog
    v-model="open"
    :width="$vuetify.display?.smAndDown ? 'auto' : 720"
    @update:model-value="(value) => emits('update:modelValue', value)"
  >
    <DialogCloseBtn @click="open = false" />

    <VCard class="job-document-dialog pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">
          {{ doc ? "Edit Document" : "Add Document" }}
        </h4>

        <VRow>
          <VCol cols="12">
            <AppSelect
              v-model="form.type"
              :items="documentTypeItems"
              item-title="title"
              item-value="value"
              label="Type"
            />
          </VCol>

          <VCol cols="12">
            <AppTextField v-model="form.name" label="Name" />
          </VCol>

          <VCol cols="12">
            <AppTextarea v-model="form.note" label="Note" rows="1" auto-grow />
          </VCol>

          <VCol cols="12">
            <label class="document-field-label">Attachment</label>
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              class="d-none"
              @change="onFileChange"
            />
            <div class="document-upload-row">
              <VBtn
                variant="tonal"
                prepend-icon="tabler-paperclip"
                :disabled="hasLinkSource"
                @click="triggerFilePicker"
              >
                Choose file
              </VBtn>
              <div class="document-upload-row__text">
                <template v-if="form.fileAttachment">
                  {{ form.fileAttachment.name }}
                  <span>({{ formatBytes(form.fileAttachment.size) }})</span>
                </template>
                <template v-else-if="form.storedFileUrl">
                  {{ previewLabel }}
                  <span v-if="(form as any)._attachedSize">
                    ({{ formatBytes((form as any)._attachedSize) }})
                  </span>
                </template>
                <template v-else>No file selected</template>
              </div>
              <VBtn
                v-if="form.fileAttachment || form.storedFileUrl"
                variant="text"
                color="error"
                @click="clearFile"
              >
                Remove
              </VBtn>
            </div>
          </VCol>

          <VCol cols="12">
            <AppTextField
              v-model="form.linkUrl"
              label="Link"
              placeholder="https://example.com/document.pdf"
              clearable
              :disabled="hasFileSource"
              @blur="validateLink"
              @click:clear="clearLink"
            />
            <div
              v-if="hasFileSource"
              class="text-sm text-medium-emphasis mt-2"
            >
              Remove the attachment to use a link instead.
            </div>
          </VCol>

          <VCol cols="12">
            <div v-if="fileError" class="text-error text-sm mb-3">
              {{ fileError }}
            </div>
            <div
              v-else-if="!hasAttachment"
              class="text-sm text-medium-emphasis mb-3"
            >
              Attachment or link is required.
            </div>

            <div class="document-preview">
              <template v-if="previewKind === 'image' && previewUrl">
                <VImg
                  :src="previewUrl"
                  class="document-preview__media"
                  cover
                />
              </template>
              <template v-else-if="previewKind === 'pdf' && previewUrl">
                <iframe
                  :src="previewUrl"
                  class="document-preview__pdf"
                  title="Document preview"
                />
              </template>
              <template v-else>
                <div class="document-preview__placeholder">
                  <VIcon
                    :icon="hasAttachment ? 'tabler-file-description' : 'tabler-file-plus'"
                    size="36"
                  />
                  <div class="document-preview__title">
                    {{ previewLabel }}
                  </div>
                  <VBtn
                    v-if="previewUrl"
                    size="small"
                    variant="tonal"
                    prepend-icon="tabler-eye"
                    @click="openPreview"
                  >
                    Open preview
                  </VBtn>
                </div>
              </template>
            </div>
          </VCol>

          <VCol cols="12">
            <VSwitch
              v-model="form.expiryEnabled"
              label="Expiry"
              color="primary"
              hide-details
            />
          </VCol>

          <template v-if="form.expiryEnabled">
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="form.expiry"
                type="date"
                label="Expiry date"
                format="YYYY-MM-DD"
                placeholder="Select date"
              />
              <div
                v-if="expiryDateRequired"
                class="text-error text-sm mt-2"
              >
                Expiry date is required.
              </div>
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="form.expiryReminderOffsetDays"
                :items="reminderOptions"
                item-title="title"
                item-value="value"
                label="Reminder"
              />
            </VCol>
          </template>
        </VRow>
      </VCardText>

      <VCardActions>
        <DialogActionBar
          :save-text="uploading ? 'Uploading...' : 'Save'"
          :save-disabled="!isValid || uploading"
          @save="save"
          @cancel="open = false"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.job-document-dialog {
  padding: 0.25rem;
}

.document-field-label {
  display: block;
  margin-block-end: 0.5rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.document-upload-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.document-upload-row__text {
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-preview {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.6);
}

.document-preview__media,
.document-preview__pdf {
  display: block;
  border: 0;
  block-size: 18rem;
  inline-size: 100%;
}

.document-preview__placeholder {
  display: flex;
  min-block-size: 10rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
}

.document-preview__title {
  max-inline-size: 100%;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .document-upload-row {
    align-items: stretch;
    flex-direction: column;
  }

  .document-upload-row__text {
    white-space: normal;
  }
}
</style>
