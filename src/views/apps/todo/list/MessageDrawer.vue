<script setup lang="ts">
import type { ContactRef, Message } from "@/data/schema";
import { normalizeAuthorRef } from "@/utils/currentAccount";
import { formatSystemDate } from "@core/utils/formatters";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

/* --- Hard-align the "Actions" column left (header + body) --- */
function alignActionsColumnLeft() {
  const table = document.querySelector(
    ".v-data-table table"
  ) as HTMLElement | null;
  if (!table) return;

  // Header: last TH
  const ths = table.querySelectorAll("thead th");
  const lastTh = ths[ths.length - 1] as HTMLElement | undefined;
  if (lastTh) {
    lastTh.style.setProperty("text-align", "left", "important");
    const hc = lastTh.querySelector(
      ".v-data-table-header__content"
    ) as HTMLElement | null;
    if (hc) hc.style.setProperty("justify-content", "flex-start", "important");
  }

  // Body: last TD in every TR
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    const lastTd = tds[tds.length - 1] as HTMLElement | undefined;
    if (lastTd) lastTd.style.setProperty("text-align", "left", "important");
  });
}

let actionsAlignObserver: MutationObserver | null = null;
onMounted(() => {
  nextTick(() => {
    alignActionsColumnLeft();
    const tblRoot = document.querySelector(
      ".v-data-table"
    ) as HTMLElement | null;
    if (!tblRoot) return;
    actionsAlignObserver = new MutationObserver(() => alignActionsColumnLeft());
    actionsAlignObserver.observe(tblRoot, { subtree: true, childList: true });
  });
});
onBeforeUnmount(() => {
  actionsAlignObserver?.disconnect();
  actionsAlignObserver = null;
});

type ToDo = { id: number | string; messages?: Message[] | undefined };

const props = defineProps<{
  isDrawerOpen: boolean;
  todo: ToDo | null | undefined;
  author?: ContactRef;
}>();

const emit = defineEmits<{
  (e: "update:isDrawerOpen", v: boolean): void;
  (
    e: "send",
    v: {
      id: number | string;
      body: string;
      author?: ContactRef;
      messageId?: number | string;
    }
  ): void;
  (
    e: "edit-message",
    v: { id: number | string; messageId: number | string; body: string }
  ): void;
  (
    e: "toggle-read",
    v: { id: number | string; messageId: number | string; isRead: boolean }
  ): void;
}>();

/* ===== Local state (mirrors parent, supports optimistic updates) ===== */
const localList = ref<Message[]>([]);
const message = ref("");

function readPropMessages(): Message[] {
  return props.todo?.messages
    ? props.todo.messages.map((message) => ({
        ...message,
        author: normalizeAuthorRef(message.author) as ContactRef,
      }))
    : [];
}

const messagesSignature = computed(() =>
  (props.todo?.messages ?? [])
    .map((message) =>
      [
        message.id,
        message.body,
        message.isRead ? 1 : 0,
        message.editedAt ?? "",
      ].join(":"),
    )
    .join("|"),
);

// Reconcile from the parent when ids or editable fields change.
function reconcileFromParent() {
  const src = readPropMessages();
  if (
    localList.value.length !== src.length ||
    localList.value.some((message, index) => {
      const next = src[index];
      return (
        !next ||
        String(message.id) !== String(next.id) ||
        message.body !== next.body ||
        Boolean(message.isRead) !== Boolean(next.isRead) ||
        (message.editedAt ?? null) !== (next.editedAt ?? null)
      );
    })
  ) {
    localList.value = src;
  }
}

watch(
  () => [props.isDrawerOpen, props.todo?.id, messagesSignature.value],
  () => props.isDrawerOpen && reconcileFromParent(),
  { immediate: true }
);

/* ===== Actions ===== */
function close() {
  emit("update:isDrawerOpen", false);
  message.value = "";
  cancelEditing();
}

function send() {
  const body = message.value.trim();
  if (!body || !props.todo) return;
  const optimisticId = `msg-${Date.now()}`;

  // 1) Optimistic append → instant UI
  const optimistic: Message = {
    id: optimisticId,
    author: normalizeAuthorRef(props.author) as ContactRef,
    body,
    createdAt: new Date().toISOString(),
    isRead: true,
    editedAt: null,
  };
  localList.value = [...localList.value, optimistic];
  message.value = "";
  scrollToBottom();

  // 2) Notify parent to persist (parent will push a real message and our watchers will reconcile)
  emit("send", {
    id: props.todo.id,
    body,
    author: props.author,
    messageId: optimisticId,
  });
}

/* ===== Helpers ===== */
const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
const authorName = (message: Message) => message.author?.name || "User";
const authorAvatar = (message: Message) => {
  const author = message.author;

  return author && "avatarUrl" in author ? author.avatarUrl ?? undefined : undefined;
};
const fmtDate = (iso?: string) => {
  if (!iso) return "";
  return formatSystemDate(iso);
};
const isOwnMessage = (message: Message) =>
  String(message.author?.id ?? "") === String(props.author?.id ?? "");
const editingMessageId = ref<number | string | null>(null);
const editingBody = ref("");

function startEditing(message: Message) {
  editingMessageId.value = message.id;
  editingBody.value = message.body;
}

function cancelEditing() {
  editingMessageId.value = null;
  editingBody.value = "";
}

function saveEdit() {
  if (!props.todo || editingMessageId.value == null) return;
  const body = editingBody.value.trim();
  if (!body) return;

  localList.value = localList.value.map((message) =>
    String(message.id) === String(editingMessageId.value)
      ? {
          ...message,
          body,
          editedAt: new Date().toISOString(),
        }
      : message,
  );

  emit("edit-message", {
    id: props.todo.id,
    messageId: editingMessageId.value,
    body,
  });
  cancelEditing();
}

function toggleRead(message: Message) {
  if (!props.todo) return;
  const nextIsRead = !Boolean(message.isRead);
  localList.value = localList.value.map((entry) =>
    String(entry.id) === String(message.id)
      ? { ...entry, isRead: nextIsRead }
      : entry,
  );
  emit("toggle-read", {
    id: props.todo.id,
    messageId: message.id,
    isRead: nextIsRead,
  });
}

/* ===== Sticky composer height → dynamic padding for the scroller ===== */
const composerRef = ref<HTMLElement | null>(null);
const spacerH = ref(180);
let ro: ResizeObserver | null = null;

async function measureComposer() {
  await nextTick();
  const el = composerRef.value;
  if (!el) return;
  spacerH.value = Math.ceil(el.getBoundingClientRect().height + 12);
}

onMounted(() => {
  measureComposer();
  ro = new ResizeObserver(measureComposer);
  if (composerRef.value) ro.observe(composerRef.value);
  window.addEventListener("resize", measureComposer);
});
onBeforeUnmount(() => {
  if (ro && composerRef.value) ro.unobserve(composerRef.value);
  window.removeEventListener("resize", measureComposer);
});
watch(
  () => props.isDrawerOpen,
  (v) => v && measureComposer()
);

/* ===== Auto-scroll to newest message when list changes / opens ===== */
async function scrollToBottom() {
  await nextTick();
  const scroller = document.querySelector(".history .ps") as HTMLElement | null;
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}
watch(localList, () => scrollToBottom(), { deep: true });
watch(
  () => props.isDrawerOpen,
  (v) => v && scrollToBottom()
);

/* ===== Derived ===== */
const list = computed(() => localList.value);
const drawerKey = computed(() => `${props.todo?.id ?? "none"}`);
const canToggleRead = (message: Message) => !isOwnMessage(message);
</script>

<template>
  <VNavigationDrawer
    :key="drawerKey"
    data-allow-mismatch
    temporary
    location="end"
    :width="400"
    :model-value="isDrawerOpen"
    class="drawer-root"
    @update:model-value="(v) => emit('update:isDrawerOpen', v)"
  >
    <!-- Header -->
    <div class="d-flex align-center justify-space-between px-5 py-4">
      <h6 class="text-subtitle-1 m-0">Write your message</h6>
      <VBtn icon variant="text" @click="close"><VIcon icon="tabler-x" /></VBtn>
    </div>
    <VDivider />

    <!-- Body -->
    <div class="drawer-body">
      <!-- History (only scroller) -->
      <div class="history">
        <PerfectScrollbar
          :key="drawerKey"
          :options="{ wheelPropagation: false }"
          class="h-100"
        >
          <div class="history-inner" :style="{ paddingBottom: spacerH + 'px' }">
            <VCard flat>
              <VCardText class="pt-4">
                <div v-if="list.length" class="d-flex flex-column gap-3">
                  <div
                    v-for="m in list"
                    :key="m.id"
                    class="pa-3 rounded-lg history-item"
                  >
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="d-flex align-center gap-3">
                        <VAvatar size="28" color="primary">
                          <template v-if="authorAvatar(m)">
                            <VImg :src="authorAvatar(m)" />
                          </template>
                          <template v-else>
                            <span class="text-xxs font-weight-bold">{{
                              initials(authorName(m))
                            }}</span>
                          </template>
                        </VAvatar>
                        <strong class="text-body-2">{{
                          authorName(m)
                        }}</strong>
                      </div>
                      <div class="d-flex align-center gap-2">
                        <VChip
                          size="x-small"
                          :color="m.isRead ? 'success' : 'warning'"
                          variant="tonal"
                        >
                          {{ m.isRead ? "Read" : "Unread" }}
                        </VChip>
                        <span class="text-caption text-medium-emphasis">{{
                          fmtDate(m.createdAt)
                        }}</span>
                      </div>
                    </div>
                    <div class="d-flex align-start justify-space-between gap-3">
                      <div v-if="editingMessageId === m.id" class="flex-grow-1">
                        <AppTextarea
                          v-model="editingBody"
                          rows="2"
                          auto-grow
                          placeholder="Edit comment..."
                        />
                      </div>
                      <div v-else class="text-body-2 flex-grow-1">
                        {{ m.body }}
                        <span
                          v-if="m.editedAt"
                          class="text-caption text-medium-emphasis ms-1"
                        >
                          (edited)
                        </span>
                      </div>
                      <div class="message-actions">
                        <IconBtn v-if="canToggleRead(m)" @click="toggleRead(m)">
                          <VIcon
                            :icon="m.isRead ? 'tabler-mail' : 'tabler-mail-opened'"
                            :color="m.isRead ? 'error' : 'primary'"
                          />
                          <VTooltip activator="parent" location="top">
                            {{ m.isRead ? "Mark as unread" : "Mark as read" }}
                          </VTooltip>
                        </IconBtn>
                        <template v-if="isOwnMessage(m)">
                          <IconBtn
                            v-if="editingMessageId !== m.id"
                            @click="startEditing(m)"
                          >
                            <VIcon icon="tabler-pencil" />
                            <VTooltip activator="parent" location="top">
                              Edit comment
                            </VTooltip>
                          </IconBtn>
                          <template v-else>
                            <IconBtn @click="saveEdit">
                              <VIcon icon="tabler-check" />
                              <VTooltip activator="parent" location="top">
                                Save edit
                              </VTooltip>
                            </IconBtn>
                            <IconBtn @click="cancelEditing">
                              <VIcon icon="tabler-x" />
                              <VTooltip activator="parent" location="top">
                                Cancel edit
                              </VTooltip>
                            </IconBtn>
                          </template>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-medium-emphasis">No messages yet.</div>
              </VCardText>
            </VCard>
          </div>
        </PerfectScrollbar>
      </div>

      <VDivider class="mt-2" />

      <!-- Composer -->
      <div class="composer" ref="composerRef">
        <VCard flat>
          <VCardText class="pb-2">
            <div class="mb-1 text-caption">Message</div>
            <AppTextarea
              v-model="message"
              rows="3"
              max-rows="6"
              placeholder="Type your message…"
              auto-grow
            />
          </VCardText>
          <VCardActions class="px-6 pb-6 pt-0 d-flex justify-end gap-3">
            <VBtn variant="flat" color="primary" @click="send">Send</VBtn>
          </VCardActions>
        </VCard>
      </div>
    </div>
  </VNavigationDrawer>
</template>

<style scoped>
/* Layout */
.drawer-root {
  display: flex;
  flex-direction: column;
  block-size: 100%;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.history {
  flex: 1 1 auto;
  min-block-size: 0;
}

/* Sticky composer stays visible; history scrolls underneath */
.composer {
  position: sticky;
  z-index: 2;
  background: inherit;
  inset-block-end: 0;
  padding-block-end: env(safe-area-inset-bottom);
}

/* Cards */
.history-item {
  border: 1px solid rgba(255, 255, 255, 8%);
  border-radius: 12px;
  background: rgba(255, 255, 255, 6%);
}

.message-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.25rem;
}

/* Compact actions */
:deep(.v-card-actions) {
  padding-block-start: 0;
}

/* Force the last column (Actions) to align left in header + body */
:deep(.v-data-table thead th:last-child .v-data-table-header__content) {
  justify-content: flex-start !important;
}

:deep(.v-data-table thead th:last-child),
:deep(.v-data-table tbody td:last-child),
:deep(.v-data-table tfoot td:last-child) {
  text-align: start !important;
}

/* Ensure the icon group starts at the left edge of the cell */
.actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}
</style>
