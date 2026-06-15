/* stylelint-disable @stylistic/no-eol-whitespace */ /* stylelint-disable
@stylistic/no-eol-whitespace */
<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";
import { useConfigStore } from "@/stores/config";
import { getFileInfo, saveFile } from "@/utils/fileStore";
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

const configStore = useConfigStore();
configStore.init();

const isDocumentRenewable = computed(() => {
  const renewable = configStore.configurations?.crm?.documentRenewable;
  return renewable === "yes";
});

type FormModel = Partial<JobDocument> & {
  linkUrl?: string | undefined;
  fileAttachment?: File | undefined;
  fileUrlBlob?: string | undefined;
};

const form = reactive<FormModel>({
  id: undefined,
  category: undefined,
  type: undefined,
  name: "",
  expiry: undefined,
  expiryReminder: false,
  note: "",
  fileUrl: undefined,
  // helper fields (not part of final payload)
  linkUrl: undefined,
  fileAttachment: undefined,
  fileUrlBlob: undefined,
});

const fileError = ref<string | null>(null);

const ACCEPTED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const fileInputRef = ref<HTMLInputElement | null>(null);

// unified getter/setter: expose string for the UI. When a file is selected we show the filename.
const fileOrLink = computed<string | null>({
  get() {
    if (form.fileAttachment) {
      const f = form.fileAttachment as File;
      return `${f.name} (${formatBytes(f.size)})`;
    }
    // if we have an idb pointer stored in fileUrlBlob, show the friendly name+size instead of the raw id
    if (form.fileUrlBlob && String(form.fileUrlBlob).startsWith("idb:")) {
      const name = (form as any)._attachedName || form.name || null;
      const size = (form as any)._attachedSize || null;
      return size ? `${name} (${formatBytes(size)})` : name;
    }
    if (form.linkUrl) return form.linkUrl;
    return null;
  },
  set(v: string | null) {
    if (!v) {
      form.linkUrl = undefined;
      clearFile();
      return;
    }
    // If there's no attached file (and no stored blob), only allow links with acceptable extensions.
    const hasAttached = !!form.fileAttachment || !!form.fileUrlBlob;
    if (!hasAttached) {
      if (!isAcceptableLink(v)) {
        fileError.value = `Links must point to files with these extensions: ${ACCEPTED_EXT.join(
          ", ",
        )}`;
        // do not set the link if invalid
        return;
      }
    }
    // accept link (in edit mode we allow replacing stored/attached file by a link)
    fileError.value = null;
    form.linkUrl = v;
    clearFile();
  },
});

function onHiddenFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files && input.files[0];
  if (!f) return;
  // validate accept list by extension
  const name = f.name.toLowerCase();
  const okExt = ACCEPTED_EXT.some((ext) => name.endsWith(ext));
  if (!okExt) {
    fileError.value = `Unsupported file type. Allowed: ${ACCEPTED_EXT.join(
      ",",
    )}`;
    // clear any previous file
    clearFile();
    input.value = "";
    return;
  }

  // validate size
  if (f.size > MAX_BYTES) {
    fileError.value = `File is too large. Max allowed is ${formatBytes(
      MAX_BYTES,
    )}.`;
    clearFile();
    input.value = "";
    return;
  }

  fileError.value = null;
  // set fileAttachment directly; watcher will handle blob URL and inferring category
  form.fileAttachment = f;
  form.linkUrl = undefined;
  // reset input to allow selecting same file again later
  input.value = "";
}

function triggerFilePicker() {
  fileInputRef.value?.click();
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function isAcceptableLink(url?: string | null) {
  if (!url) return false;
  const trimmed = String(url).trim();
  // allow data/blob/idb pointers as they are handled elsewhere
  if (/^data:/.test(trimmed) || /^blob:/.test(trimmed) || /^idb:/.test(trimmed))
    return true;
  // allow relative root paths
  try {
    const parsed = new URL(trimmed, window.location.href);
    const pathname = parsed.pathname || "";
    const lower = pathname.toLowerCase();
    return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
  } catch {
    // if URL parsing fails, fallback to simple string check
    const lower = trimmed.toLowerCase();
    return ACCEPTED_EXT.some((ext) => lower.split(/[?#]/)[0].endsWith(ext));
  }
}

// UI: expansion panel state for expiry (null = closed, 0 = opened)
const expiryExpanded = ref<number | null>(null);
const lastAutoFilledName = ref<string | null>(null);

function resetForm() {
  Object.assign(form, {
    id: undefined,
    category: undefined,
    type: undefined,
    name: "",
    expiry: undefined,
    expiryReminder: false,
    note: "",
    fileUrl: undefined,
    linkUrl: undefined,
    fileAttachment: undefined,
    fileUrlBlob: undefined,
  });
  expiryExpanded.value = null;
  lastAutoFilledName.value = null;
  fileError.value = null;
}

function populateForm(d: JobDocument | null | undefined) {
  if (!d) {
    resetForm();
    return;
  }
  Object.assign(form, { ...d });
  lastAutoFilledName.value = null;
  // populate helper fields when editing an existing doc
  // prioritize idb: pointers (persisted files) so we show friendly name+size
  if (d.fileUrl && String(d.fileUrl).startsWith("idb:")) {
    form.linkUrl = undefined;
    form.fileUrlBlob = undefined;
    const without = String(d.fileUrl).slice(4);
    const [key, encodedName] = without.split("|");
    if (encodedName) {
      const name = decodeURIComponent(encodedName || "");
      try {
        getFileInfo(key).then((info) => {
          if (info) {
            form.fileUrlBlob = `idb:${key}`;
            (form as any)._attachedName = name;
            (form as any)._attachedSize = info.size;
          }
        });
      } catch {}
    }
  } else if (
    d.fileUrl &&
    (String(d.fileUrl).startsWith("blob:") ||
      String(d.fileUrl).startsWith("data:"))
  ) {
    // blob or data URI
    form.fileUrlBlob = String(d.fileUrl);
    form.linkUrl = undefined;
  } else {
    form.linkUrl = d.fileUrl;
    form.fileUrlBlob = undefined;
  }
  // open expiry panel when editing a doc that already has an expiry
  expiryExpanded.value = d.expiry ? 0 : null;
}

// ensure form is populated when dialog opens and reset when no doc provided
watch(
  () => props.doc,
  (d) => populateForm(d),
  { immediate: true },
);

// When dialog is opened, we'll populate/reset the form — watch moved lower where `open` is defined.

function close() {
  emits("update:modelValue", false);
}

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emits("update:modelValue", v),
});

// When dialog is opened, always populate the form from props.doc (or reset for add).
watch(open, (isOpen) => {
  if (isOpen) {
    populateForm(props.doc);
  } else {
    // on close: reset the form for a clean add state. This keeps the dialog predictable
    // when reopened for add and prevents stale data when switching between edits.
    resetForm();
  }
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
  () => form.expiry,
  (expiry) => {
    if (!props.autoEnableExpiryReminderOnDate) return;

    form.expiryReminder = Boolean(expiry);
  },
);

// validation: require category, name and an attachment (fileAttachment or stored blob or link)
const hasAttachment = computed(() => {
  return !!form.fileAttachment || !!form.fileUrlBlob || !!form.linkUrl;
});

const isValid = computed(() => {
  return !!form.name && !!form.category && hasAttachment.value;
});

const uploading = ref(false);

// fake upload helper - simulates async upload and returns a URL
async function uploadFile(file: File): Promise<string> {
  uploading.value = true;
  // simulate delay
  await new Promise((r) => setTimeout(r, 700));
  // In a real app you'd POST the file and return the server URL. Here we return a fake http URL.
  const fakeUrl = `https://cdn.example.test/${Date.now()}-${file.name}`;
  uploading.value = false;
  return fakeUrl;
}

async function save() {
  // Basic payload normalize
  const payload: JobDocument = {
    id: Number(form.id ?? Date.now()),
    category: (form.category as any) || undefined,
    type: (form.type as any) || undefined,
    name: form.name || "",
    expiry:
      expiryExpanded.value !== null ? form.expiry || undefined : undefined,
    expiryReminder:
      expiryExpanded.value !== null ? !!form.expiryReminder : false,
    note: form.note || undefined,
    fileUrl: (form.fileUrlBlob ?? form.linkUrl) || undefined,
    createdAt: new Date().toISOString(),
  };

  // if there's a fileAttachment, save it to IndexedDB and store a pointer
  if (form.fileAttachment) {
    try {
      uploading.value = true;
      const key = await saveFile(form.fileAttachment as File);
      // store pointer in the form: idb:<key>|<encodedName>
      const name = encodeURIComponent((form.fileAttachment as File).name);
      payload.fileUrl = `idb:${key}|${name}`;
    } finally {
      uploading.value = false;
    }
  }

  // if link is present, ensure it's acceptable before saving
  if (!form.fileAttachment && form.linkUrl) {
    if (!isAcceptableLink(form.linkUrl)) {
      fileError.value = `Links must point to files with these extensions: ${ACCEPTED_EXT.join(
        ", ",
      )}`;
      return;
    }
  }

  emits("save", payload);
  // debug log: emitted payload
  try {
    // eslint-disable-next-line no-console
    console.log("JobDocumentDialog: emitting save", payload);
  } catch {}
  close();
}

// helper: map filename extension to category
function inferCategoryFromFilename(name?: string | null) {
  if (!name) return undefined;
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "PDF";
  if (n.endsWith(".xls") || n.endsWith(".xlsx")) return "EXCEL";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "WORD";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "JPG";
  if (n.endsWith(".png")) return "PNG";
  return undefined;
}

const showFileInput = computed(() => {
  // show file input when no linkUrl provided
  return !form.linkUrl;
});

const showLinkInput = computed(() => {
  // show link input when no fileAttachment selected
  return !form.fileAttachment && !form.fileUrlBlob;
});

const attachedName = computed(() => {
  return (form as any)._attachedName || form.name || null;
});

const attachedSize = computed<number | null>(() => {
  return (form as any)._attachedSize ?? null;
});

// when VFileInput updates form.fileAttachment create blob URL and infer category
watch(
  () => form.fileAttachment,
  (f) => {
    if (!f) return;
    try {
      if (form.fileUrlBlob) URL.revokeObjectURL(form.fileUrlBlob);
    } catch {}
    form.fileUrlBlob = URL.createObjectURL(f as File);
    const inferred = inferCategoryFromFilename((f as File).name);
    if (inferred) form.category = inferred as any;
    // clear link when file is attached
    form.linkUrl = undefined;
  },
);

function clearFile() {
  if (form.fileUrlBlob) {
    try {
      URL.revokeObjectURL(form.fileUrlBlob);
    } catch {}
  }
  form.fileAttachment = undefined;
  form.fileUrlBlob = undefined;
  // clear helper fields
  try {
    (form as any)._attachedSize = undefined;
    (form as any)._attachedName = undefined;
  } catch {}
}

// ensure mutual exclusivity: when linkUrl is set, clear file; when fileAttachment is set, clear linkUrl
watch(
  () => form.linkUrl,
  (v) => {
    if (v) {
      clearFile();
      // validate that link matches accepted file types
      if (!isAcceptableLink(v)) {
        fileError.value = `Links must point to files with these extensions: ${ACCEPTED_EXT.join(
          ", ",
        )}`;
      } else {
        fileError.value = null;
        // infer category from link extension
        const inferred = inferCategoryFromFilename(v);
        if (inferred) form.category = inferred as any;
      }
    }
  },
);

watch(
  () => form.fileAttachment,
  (v) => {
    if (v) {
      form.linkUrl = undefined;
    }
  },
);
</script>

<template>
  <VDialog
    :width="$vuetify.display?.smAndDown ? 'auto' : 640"
    v-model="open"
    @update:model-value="(v) => emits('update:modelValue', v)"
  >
    <DialogCloseBtn @click="open = false" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">
          {{ doc ? "Edit Document" : "Add Document" }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          Provide document details below.
        </p>

        <VRow>
          <VCol cols="12" md="12">
            <AppSelect
              v-model="form.type"
              :items="
                (props.documentTypes || []).map((t) => ({ title: t, value: t }))
              "
              item-title="title"
              item-value="value"
              placeholder="Type"
            />
          </VCol>

          <!-- Category is inferred from file/link and hidden from manual selection -->

          <VCol cols="12">
            <AppTextField v-model="form.name" label="Name" />
          </VCol>

          <VCol v-if="isDocumentRenewable" cols="12">
            <label class="d-block mb-2">Expiry</label>
            <VExpansionPanels v-model="expiryExpanded">
              <VExpansionPanel>
                <VExpansionPanelTitle>Expiry settings</VExpansionPanelTitle>
                <VExpansionPanelText>
                  <AppDateTimePicker
                    v-model="form.expiry"
                    type="date"
                    label="Expiry Date"
                    format="YYYY-MM-DD"
                    placeholder="Select date"
                  />
                  <div class="mt-2">
                    <VSwitch
                      v-model="form.expiryReminder"
                      label="Set reminder for expiry"
                    />
                  </div>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>
          </VCol>

          <VCol cols="12">
            <div>
              <label class="d-block mb-2">Attachment</label>
              <div class="d-flex gap-3 align-center">
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    inline-size: 100%;
                    /* stylelint-disable-next-line @stylistic/no-eol-whitespace */
                  "
                >
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    style="display: none"
                    @change="onHiddenFileChange"
                  />

                  <VTextField
                    v-model="fileOrLink"
                    label="Attachment (paste link or attach file)"
                    clearable
                    @click:clear="
                      () => {
                        form.linkUrl = undefined;
                        clearFile();
                      }
                    "
                  >
                    <template #append>
                      <VBtn icon variant="text" @click="triggerFilePicker">
                        <VIcon icon="tabler-paperclip" />
                      </VBtn>
                    </template>
                  </VTextField>
                </div>
              </div>
              <div
                v-if="form.fileAttachment || form.fileUrlBlob"
                class="text-sm text-medium-emphasis mt-2"
              >
                Selected:
                <template v-if="form.fileAttachment">
                  {{ form.fileAttachment.name }}
                  <span>({{ formatBytes(form.fileAttachment.size) }})</span>
                </template>
                <template v-else>
                  <!-- show attached name and size for idb-stored files or friendly label -->
                  {{ attachedName || "Attached file" }}
                  <span v-if="attachedSize"
                    >({{ formatBytes(attachedSize) }})</span
                  >
                  <span class="text-xs text-muted">(preview available)</span>
                </template>
                <VBtn small variant="text" color="error" @click="clearFile"
                  >Remove</VBtn
                >
              </div>
              <div v-if="fileError" class="text-error text-sm mt-2">
                {{ fileError }}
              </div>
              <div
                v-else-if="!hasAttachment"
                class="text-sm text-medium-emphasis mt-2"
              >
                Attachment is required.
              </div>
            </div>
          </VCol>

          <VCol cols="12">
            <VTextField v-model="form.note" label="Note" />
          </VCol>
        </VRow>
      </VCardText>

      <VCardActions>
        <DialogActionBar
          :save-text="uploading ? 'Uploading...' : 'Save'"
          :save-disabled="!isValid || uploading || !!fileError"
          @save="save"
          @cancel="open = false"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
/* Small component-specific styles can go here */
.job-document-dialog {
  padding: 0.25rem;
}
</style>
