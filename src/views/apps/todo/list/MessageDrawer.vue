<script setup lang="ts">
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

/* Types */
type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};
type Message = {
  id: number | string;
  author?: ContactRef;
  body: string;
  createdAt: string;
};
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
    v: { id: number | string; body: string; author?: ContactRef }
  ): void;
}>();

/* ===== Local state (mirrors parent, supports optimistic updates) ===== */
const localList = ref<Message[]>([]);
const message = ref("");

function readPropMessages(): Message[] {
  return props.todo?.messages ? [...props.todo.messages] : [];
}

// Reconcile from the parent only when it actually changed (length or last id)
function reconcileFromParent() {
  const src = readPropMessages();
  const a = localList.value;
  const aLen = a.length;
  const sLen = src.length;
  const aLast = aLen ? a[aLen - 1]?.id : undefined;
  const sLast = sLen ? src[sLen - 1]?.id : undefined;

  if (aLen !== sLen || aLast !== sLast) {
    localList.value = src;
  }
}

// Initial + when opening + when parent grows
watch(
  () => [props.isDrawerOpen, props.todo?.id, props.todo?.messages?.length],
  () => {
    if (props.isDrawerOpen) reconcileFromParent();
  },
  { immediate: true }
);

// Also track last message id explicitly (covers same-length but different content)
watch(
  () =>
    (props.todo?.messages &&
      props.todo.messages[props.todo.messages.length - 1]?.id) ??
    null,
  () => props.isDrawerOpen && reconcileFromParent()
);

/* ===== Actions ===== */
function close() {
  emit("update:isDrawerOpen", false);
  message.value = "";
}

function send() {
  const body = message.value.trim();
  if (!body || !props.todo) return;

  // 1) Optimistic append → instant UI
  const optimistic: Message = {
    id: `temp-${Date.now()}`,
    author: props.author,
    body,
    createdAt: new Date().toISOString(),
  };
  localList.value = [...localList.value, optimistic];
  message.value = "";
  scrollToBottom();

  // 2) Notify parent to persist (parent will push a real message and our watchers will reconcile)
  emit("send", { id: props.todo.id, body, author: props.author });
}

/* ===== Helpers ===== */
const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
const fmtDate = (iso?: string) => {
  if (!iso) return "";
  return formatSystemDate(iso);
};

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
                          <template v-if="m.author?.avatarUrl">
                            <VImg :src="m.author?.avatarUrl" />
                          </template>
                          <template v-else>
                            <span class="text-xxs font-weight-bold">{{
                              initials(m.author?.name)
                            }}</span>
                          </template>
                        </VAvatar>
                        <strong class="text-body-2">{{
                          m.author?.name || "test@squarely.app"
                        }}</strong>
                      </div>
                      <span class="text-caption text-medium-emphasis">{{
                        fmtDate(m.createdAt)
                      }}</span>
                    </div>
                    <div class="text-body-2">{{ m.body }}</div>
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
