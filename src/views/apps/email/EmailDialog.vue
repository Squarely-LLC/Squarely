<script lang="ts" setup>
import { useContactsStore } from "@/stores/contacts";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{ isDialogVisible?: boolean }>(), {
  isDialogVisible: false,
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "send", payload: any): void;
  (e: "update:isDialogVisible", val: boolean): void;
}>();

function dialogVisibleUpdate(val: boolean) {
  emit("update:isDialogVisible", val);
  if (!val) {
    // preserve backward-compatible close event for listeners
    try {
      emit("close");
    } catch {}
  }
}

const content = ref("");

// support multiple recipients (array of emails or single string)
const to = ref<string | Array<string>>([]);

// normalized recipients array (always an array of non-empty strings)
const recipients = computed(() =>
  Array.isArray(to.value)
    ? to.value.filter(Boolean).map((s) => String(s))
    : to.value
    ? [String(to.value)]
    : []
);

// search input for the autocomplete (we watch this to support comma/semicolon separated entries)
const autocompleteSearch = ref("");

// when user types or pastes comma/semicolon-separated addresses into the search input,
// split them into individual recipients and append to `to` so tags are created.
watch(autocompleteSearch, (val) => {
  try {
    if (!val) return;
    // if the typed value already contains delimiters, commit immediately
    if (/[,;\n]/.test(val)) {
      commitSearchIfHasDelimited();
    }
  } catch (e) {
    /* ignore */
  }
});

function commitSearchIfHasDelimited() {
  try {
    const val = String(autocompleteSearch.value || "");
    if (!val) return;
    const parts = val
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    if (!Array.isArray(to.value)) {
      to.value = to.value ? [String(to.value)] : [];
    }
    to.value = [...(Array.isArray(to.value) ? to.value : []), ...parts];
    // clear the search input so VAutocomplete doesn't keep fragments
    autocompleteSearch.value = "";
  } catch (e) {
    /* ignore */
  }
}

function onAutocompleteKeydown(e: KeyboardEvent) {
  try {
    // if there's nothing typed, don't interfere
    if (!autocompleteSearch.value || !autocompleteSearch.value.trim()) return;
    if (e.key === "Enter" || e.key === "Tab") {
      // always commit what's typed as an address (single or multiple),
      // prevent default so the autocomplete doesn't swallow it
      e.preventDefault();
      commitSearchIfHasDelimited();
    }
  } catch (err) {
    /* ignore */
  }
}

function onAutocompleteBlur() {
  // When the autocomplete loses focus, commit anything typed (even single address)
  try {
    if (autocompleteSearch.value && autocompleteSearch.value.trim()) {
      commitSearchIfHasDelimited();
    }
  } catch (e) {
    /* ignore */
  }
}

function onAutocompletePaste(e: ClipboardEvent) {
  try {
    const text = e.clipboardData?.getData("text") || "";
    if (!text) return;
    // always handle pasted text: merge with current search and commit
    e.preventDefault();
    const combined = ((autocompleteSearch.value || "") + text).trim();
    autocompleteSearch.value = combined;
    commitSearchIfHasDelimited();
  } catch (err) {
    /* ignore */
  }
}

// reference to the AppAutocomplete component so we can find its internal input
const autocompleteRef = ref<any | null>(null);
let _attachedInput: HTMLInputElement | null = null;

function attachInputHandlers() {
  try {
    const root =
      autocompleteRef.value?._.el ||
      autocompleteRef.value?.$el ||
      autocompleteRef.value;
    if (!root) return;
    const input = (root as HTMLElement).querySelector("input");
    if (!input || _attachedInput === input) return;
    detachInputHandlers();
    input.addEventListener(
      "keydown",
      onAutocompleteKeydown as EventListener,
      true
    );
    input.addEventListener("paste", onAutocompletePaste as EventListener, true);
    input.addEventListener("blur", onAutocompleteBlur as EventListener, true);
    _attachedInput = input as HTMLInputElement;
  } catch (e) {
    /* ignore */
  }
}

function detachInputHandlers() {
  try {
    if (!_attachedInput) return;
    _attachedInput.removeEventListener(
      "keydown",
      onAutocompleteKeydown as EventListener,
      true
    );
    _attachedInput.removeEventListener(
      "paste",
      onAutocompletePaste as EventListener,
      true
    );
    _attachedInput.removeEventListener(
      "blur",
      onAutocompleteBlur as EventListener,
      true
    );
    _attachedInput = null;
  } catch (e) {
    /* ignore */
  }
}

onMounted(() => {
  // try attach immediately and also schedule a brief retry in case the inner input is not yet mounted
  attachInputHandlers();
  setTimeout(attachInputHandlers, 50);
});

onBeforeUnmount(() => {
  detachInputHandlers();
});
const subject = ref("");
const message = ref("");

const cc = ref("");
const bcc = ref("");
const isEmailCc = ref(false);
const isEmailBcc = ref(false);
// attachments: { name: string, url?: string, id?: string }
type Attachment = {
  name: string;
  url?: string; // object URL or remote URL
  id?: string; // storage id or original identifier
  file?: File; // when added via file input
};

const attachments = ref<Array<Attachment>>([]);
const createdObjectUrls = new Set<string>();

// contacts for autocomplete
const contactsStore = useContactsStore();
try {
  contactsStore.init();
} catch {}

const contactEmailOptions = computed(() => {
  try {
    return (contactsStore.all || [])
      .filter((c: any) => c && c.email)
      .map((c: any) => ({
        title: `${c.fullName || c.email} <${c.email}>`,
        value: String(c.email),
      }));
  } catch {
    return [];
  }
});

// helper to add a File as an attachment and create an object URL
function addFileAttachment(file: File) {
  const url = URL.createObjectURL(file);
  createdObjectUrls.add(url);
  attachments.value.push({ name: file.name, url, file });
}

function removeAttachment(index: number) {
  const att = attachments.value[index];
  if (!att) return;
  if (att.url && createdObjectUrls.has(att.url)) {
    try {
      URL.revokeObjectURL(att.url);
    } catch {}
    createdObjectUrls.delete(att.url);
  }
  attachments.value.splice(index, 1);
}

// cleanup on unmount
onBeforeUnmount(() => {
  for (const url of createdObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  createdObjectUrls.clear();
});

const resetValues = () => {
  to.value = subject.value = message.value = "";
};

// Allow parent to prefill fields programmatically before showing
function openWith(initial?: {
  to?: string;
  subject?: string;
  message?: string;
  cc?: string;
  bcc?: string;
  showCc?: boolean;
  showBcc?: boolean;
  attachments?: Array<{ name: string; url?: string; id?: string }>;
}) {
  if (!initial) return;
  // normalize incoming 'to' to an array when provided
  if (initial.to === undefined || initial.to === null) {
    // leave as-is
  } else if (Array.isArray(initial.to)) {
    to.value = initial.to.slice();
  } else {
    // may be a single string
    to.value = String(initial.to).trim() ? [String(initial.to).trim()] : [];
  }
  subject.value = initial.subject ?? subject.value;
  message.value = initial.message ?? message.value;
  cc.value = initial.cc ?? cc.value;
  bcc.value = initial.bcc ?? bcc.value;
  isEmailCc.value = !!initial.showCc;
  isEmailBcc.value = !!initial.showBcc;
  if (Array.isArray(initial.attachments)) {
    // convert incoming attachments to our Attachment shape; do not create object URLs here
    attachments.value = initial.attachments.map((a) => ({
      name: a.name as string,
      url: a.url as string | undefined,
      id: a.id as string | undefined,
    }));
  } else {
    // No attachments provided in the initial payload: clear any previous attachments
    // Revoke any object URLs we created for local files
    for (const url of createdObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    createdObjectUrls.clear();
    attachments.value = [];
  }
}

defineExpose({ openWith });

function onFileInput(e: Event) {
  try {
    const input = e.target as HTMLInputElement;
    if (!input || !input.files) return;
    const files = Array.from(input.files);
    for (const f of files) addFileAttachment(f);
    // reset input so same file can be selected again if needed
    input.value = "";
  } catch (err) {
    /* ignore */
  }
}

function openFilePicker() {
  try {
    const el = document.getElementById(
      "email-attach-input"
    ) as HTMLInputElement | null;
    el?.click();
  } catch {}
}

function clearDraft() {
  // revoke created object URLs
  for (const url of createdObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  createdObjectUrls.clear();
  // clear attachments and fields
  attachments.value = [];
  content.value = "";
  resetValues();
  isEmailCc.value = false;
  isEmailBcc.value = false;
}

function onSend() {
  // emit send payload and clear draft
  try {
    const payload = {
      to: recipients.value,
      cc: cc.value,
      bcc: bcc.value,
      subject: subject.value,
      message: content.value || message.value,
      attachments: attachments.value.map((a) => ({
        name: a.name,
        url: a.url,
        id: a.id,
        file: a.file,
      })),
    };
    emit("send", payload);
  } catch (e) {
    /* ignore */
  }
  clearDraft();
  // close after send (emit update and close for compatibility)
  try {
    emit("update:isDialogVisible", false);
  } catch {}
  try {
    emit("close");
  } catch {}
}

function onDiscard() {
  clearDraft();
  try {
    emit("update:isDialogVisible", false);
  } catch {}
  try {
    emit("close");
  } catch {}
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    @update:model-value="dialogVisibleUpdate"
    attach="body"
    content-class="email-compose-dialog__content"
  >
    <VCard class="email-compose-dialog" elevation="10">
      <VCardItem class="py-3 px-6">
        <div class="d-flex align-center">
          <h5 class="text-h5">Compose Mail</h5>
          <VSpacer />

          <div class="d-flex align-center gap-x-2">
            <IconBtn
              size="small"
              icon="tabler-x"
              @click="dialogVisibleUpdate(false)"
            />
          </div>
        </div>
      </VCardItem>

      <div class="px-1 pe-6 py-1">
        <AppAutocomplete
          v-model="to"
          v-model:search-input="autocompleteSearch"
          :items="contactEmailOptions"
          item-title="title"
          item-value="value"
          placeholder="To"
          clearable
          multiple
          chips
          tags
          @keydown="onAutocompleteKeydown"
          @blur="onAutocompleteBlur"
          @paste="onAutocompletePaste"
        >
          <template #prepend-inner>
            <div class="text-base font-weight-medium text-disabled">To:</div>
          </template>
          <template #append>
            <span class="cursor-pointer">
              <span @click="isEmailCc = !isEmailCc">Cc</span>
              <span> | </span>
              <span @click="isEmailBcc = !isEmailBcc">Bcc</span>
            </span>
          </template>
        </AppAutocomplete>
      </div>

      <VExpandTransition>
        <div v-if="isEmailCc">
          <VDivider />

          <div class="px-1 pe-6 py-1">
            <VTextField v-model="cc" density="compact">
              <template #prepend-inner>
                <div class="text-disabled font-weight-medium">Cc:</div>
              </template>
            </VTextField>
          </div>
        </div>
      </VExpandTransition>

      <VExpandTransition>
        <div v-if="isEmailBcc">
          <VDivider />

          <div class="px-1 pe-6 py-1">
            <VTextField v-model="bcc" density="compact">
              <template #prepend-inner>
                <div class="text-disabled font-weight-medium">Bcc:</div>
              </template>
            </VTextField>
          </div>
        </div>
      </VExpandTransition>

      <VDivider />
      <div class="px-1 pe-6 py-1">
        <VTextField v-model="subject" density="compact">
          <template #prepend-inner>
            <div class="text-base font-weight-medium text-disabled">
              Subject:
            </div>
          </template>
        </VTextField>
      </div>

      <VDivider />

      <!-- 👉 Tiptap Editor  -->
      <TiptapEditor v-model="content" placeholder="Message" />

      <div class="px-6 py-2">
        <div v-if="attachments.length" class="mb-3">
          <div class="text-sm text-medium-emphasis mb-2">Attachments</div>
          <VList dense>
            <VListItem v-for="(att, idx) in attachments" :key="idx">
              <template #prepend>
                <VIcon icon="tabler-paperclip" />
              </template>
              <VListItemTitle>
                <a
                  v-if="att.url"
                  :href="att.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ att.name }}</a
                >
                <span v-else>{{ att.name }}</span>
              </VListItemTitle>
              <VListItemSubtitle v-if="att.id">{{ att.id }}</VListItemSubtitle>

              <template #append>
                <VBtn icon size="small" @click.prevent="removeAttachment(idx)">
                  <VIcon icon="tabler-x" />
                </VBtn>
              </template>
            </VListItem>
          </VList>
        </div>

        <div class="d-flex align-center px-6 py-4">
          <VBtn
            color="primary"
            class="me-4"
            append-icon="tabler-send"
            :disabled="recipients.length === 0"
            @click="onSend"
          >
            send
          </VBtn>

          <!-- hidden file input -->
          <input
            id="email-attach-input"
            type="file"
            style="display: none"
            multiple
            @change="onFileInput"
          />

          <IconBtn size="small" @click.prevent="openFilePicker">
            <VIcon icon="tabler-paperclip" />
          </IconBtn>

          <VSpacer />

          <IconBtn size="small" @click.prevent="onDiscard">
            <VIcon icon="tabler-trash" />
          </IconBtn>
        </div>
      </div>
    </VCard>
  </VDialog>
</template>

<style lang="scss">
@use "@core/scss/base/mixins";

/* stylelint-disable */
.v-card.email-compose-dialog {
  z-index: 910 !important;
  inline-size: min(840px, 90vw);
  max-inline-size: 90vw;
  border-radius: 8px;

  @include mixins.elevation(18);

  .v-field--prepended {
    padding-inline-start: 20px;
  }

  .v-field__prepend-inner {
    align-items: center;
    padding: 0;
  }

  .v-card-item {
    background-color: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
  }

  .v-textarea .v-field {
    --v-field-padding-start: 20px;
  }

  .v-field__outline {
    display: none;
  }

  .v-input {
    .v-field__prepend-inner {
      display: flex;
      align-items: center;
      padding-block-start: 0;
    }
  }

  .app-text-field {
    .v-field__input {
      padding-block-start: 6px;
    }

    .v-field--focused {
      box-shadow: none !important;
    }
  }

  @media (max-width: 600px) {
    inset-block-end: 0;
    inset-inline-start: 0;
    inset-inline-end: 0;
    inline-size: 100vw;
    max-inline-size: 100vw;
    border-radius: 8px 8px 0 0;
  }
}

/* Position the dialog wrapper attached to body so it sits bottom-right */
.email-compose-dialog__content {
  position: fixed !important;
  right: 16px !important;
  bottom: 16px !important;
  left: auto !important;
  top: auto !important;
  margin: 0 !important;
  z-index: 910 !important;
  display: block !important;
  width: auto !important;
  max-width: calc(100% - 32px) !important;
  transform: none !important;
  pointer-events: auto !important;
}

@media (max-width: 600px) {
  .email-compose-dialog__content {
    right: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    top: auto !important;
    inline-size: 100vw !important;
    max-inline-size: 100vw !important;
    border-radius: 8px 8px 0 0 !important;
  }
}

/* position the dialog content (the wrapper generated by VDialog) */
.email-compose-dialog__content {
  position: fixed !important;
  inset-block-end: 16px !important;
  inset-inline-end: 16px !important;
  z-index: 910 !important;
  display: block !important;
}

@media (max-width: 600px) {
  .email-compose-dialog__content {
    inset-block-end: 0 !important;
    inset-inline-start: 0 !important;
    inset-inline-end: 0 !important;
    inline-size: 100vw !important;
    max-inline-size: 100vw !important;
    border-radius: 8px 8px 0 0 !important;
  }
}
/* stylelint-enable */

.email-compose-dialog {
  .ProseMirror {
    p {
      margin-block-end: 0;
    }

    padding: 1.5rem;
    block-size: 100px;
    overflow-y: auto;
    padding-block: 0.5rem;

    &:focus-visible {
      outline: none;
    }

    p.is-editor-empty:first-child::before {
      block-size: 0;
      color: #adb5bd;
      content: attr(data-placeholder);
      float: inline-start;
      pointer-events: none;
    }

    ul,
    ol {
      padding-inline: 1.125rem;
    }

    &-focused {
      outline: none;
    }
  }
}
</style>
