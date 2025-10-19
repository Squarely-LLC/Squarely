<script setup lang="ts">
import type { ContactDocument } from "@/plugins/fake-api/handlers/apps/contact/types";
import { saveFile } from "@/utils/fileStore";
import { computed, reactive, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  doc?: ContactDocument | null;
  documentTypes?: string[];
  fileCategories?: readonly string[];
}>();

const emits = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "save", payload: ContactDocument): void;
}>();

type FormModel = Partial<ContactDocument> & {
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
    if (form.fileAttachment) return (form.fileAttachment as File).name;
    if (form.linkUrl) return form.linkUrl;
    return null;
  },
  set(v: string | null) {
    if (!v) {
      form.linkUrl = undefined;
      clearFile();
      return;
    }
    // treat setter text always as a link
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
      ","
    )}`;
    // clear any previous file
    clearFile();
    input.value = "";
    return;
  }

  // validate size
  if (f.size > MAX_BYTES) {
    fileError.value = `File is too large. Max allowed is ${formatBytes(
      MAX_BYTES
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

// UI: expansion panel state for expiry (null = closed, 0 = opened)
const expiryExpanded = ref<number | null>(null);

watch(
  () => props.doc,
  (d) => {
    if (d) {
      Object.assign(form, { ...d });
      // populate helper fields when editing an existing doc
      // If stored fileUrl is a blob: or data: URI, treat it as a file blob for preview
      if (
        d.fileUrl &&
        (String(d.fileUrl).startsWith("blob:") ||
          String(d.fileUrl).startsWith("data:"))
      ) {
        form.fileUrlBlob = String(d.fileUrl);
        form.linkUrl = undefined;
      } else {
        form.linkUrl = d.fileUrl;
        form.fileUrlBlob = undefined;
      }
      // open expiry panel when editing a doc that already has an expiry
      expiryExpanded.value = d.expiry ? 0 : null;
    } else {
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
    }
  },
  { immediate: true }
);

function close() {
  emits("update:modelValue", false);
}

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emits("update:modelValue", v),
});

// validation
const isValid = computed(() => {
  return !!form.name && !!form.type;
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
  const payload: ContactDocument = {
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

  emits("save", payload);
  // debug log: emitted payload
  try {
    // eslint-disable-next-line no-console
    console.log("UserDocumentDialog: emitting save", payload);
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
  }
);

function clearFile() {
  if (form.fileUrlBlob) {
    try {
      URL.revokeObjectURL(form.fileUrlBlob);
    } catch {}
  }
  form.fileAttachment = undefined;
  form.fileUrlBlob = undefined;
}

// ensure mutual exclusivity: when linkUrl is set, clear file; when fileAttachment is set, clear linkUrl
watch(
  () => form.linkUrl,
  (v) => {
    if (v) {
      clearFile();
      // infer category from link extension
      const inferred = inferCategoryFromFilename(v);
      if (inferred) form.category = inferred as any;
    }
  }
);

watch(
  () => form.fileAttachment,
  (v) => {
    if (v) {
      form.linkUrl = undefined;
    }
  }
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

          <VCol cols="12">
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
                  <!-- avoid rendering whole data URI; show a friendly label -->
                  {{ form.name || "Attached file" }}
                  <span class="text-xs text-muted">(preview available)</span>
                </template>
                <VBtn small variant="text" color="error" @click="clearFile"
                  >Remove</VBtn
                >
              </div>
              <div v-if="fileError" class="text-error text-sm mt-2">
                {{ fileError }}
              </div>
            </div>
          </VCol>

          <VCol cols="12">
            <VTextField v-model="form.note" label="Note" />
          </VCol>
        </VRow>
      </VCardText>

      <VCardActions>
        <VSpacer />
        <VBtn color="error" variant="tonal" @click="open = false">Cancel</VBtn>
        <VBtn
          color="primary"
          variant="tonal"
          :disabled="!isValid || uploading || !!fileError"
          @click="save"
        >
          <span v-if="uploading">Uploading...</span>
          <span v-else>Save</span>
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
/* Small component-specific styles can go here */
.user-document-dialog {
  padding: 0.25rem;
}
</style>
