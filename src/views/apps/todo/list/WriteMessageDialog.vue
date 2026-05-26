<script setup lang="ts">
import { formatSystemDate } from "@core/utils/formatters";
import { computed, ref } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

/* ---- Types (reuse your shapes) ---- */
type Priority = "low" | "normal" | "high";
type Status = "pending" | "in_progress" | "for_review" | "completed";
type ContactRef = {
  id: number | string;
  name: string;
  avatarUrl?: string | null;
};
type Activity = {
  id: number | string;
  author?: ContactRef;
  body: string;
  createdAt: string;
};
type ToDo = {
  id: number | string;
  activities?: Activity[];
};

type Props = {
  modelValue: boolean;
  todo: ToDo | null;
  /** optional; if omitted we’ll show “Someone” */
  author?: ContactRef;
};
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (
    e: "send",
    payload: { id: number | string; body: string; author?: ContactRef }
  ): void;
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const message = ref("");

function close() {
  open.value = false;
  message.value = "";
}

function onSend() {
  const body = message.value.trim();
  if (!body || !props.todo) return;
  emit("send", { id: props.todo.id, body, author: props.author });
  message.value = "";
  open.value = false;
}

/* tiny helpers */
const fmtDate = (iso?: string) => {
  if (!iso) return "";
  return formatSystemDate(iso);
};
const initials = (n?: string) =>
  n ? (n.trim().match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() : "?";
</script>

<template>
  <VDialog v-model="open" max-width="520">
    <DialogCloseBtn @click="open = false" />
    <VCard>
      <!-- Header -->
      <div class="d-flex align-center justify-space-between px-5 py-4">
        <h6 class="text-subtitle-1 m-0">Write your message</h6>
        <VBtn icon variant="text" @click="close"
          ><VIcon icon="tabler-x"
        /></VBtn>
      </div>

      <!-- History -->
      <VCardText class="pt-0 pb-2">
        <PerfectScrollbar
          :options="{ wheelPropagation: false }"
          style="max-block-size: 52vh"
        >
          <div
            v-if="props.todo?.activities?.length"
            class="d-flex flex-column gap-3"
          >
            <div
              v-for="a in props.todo!.activities"
              :key="a.id"
              class="pa-3 rounded message-card"
            >
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-3">
                  <VAvatar size="28" color="primary">
                    <template v-if="a.author?.avatarUrl"
                      ><VImg :src="a.author!.avatarUrl"
                    /></template>
                    <template v-else
                      ><span class="text-caption font-weight-bold">{{
                        initials(a.author?.name || "Someone")
                      }}</span></template
                    >
                  </VAvatar>
                  <strong class="text-body-2">{{
                    a.author?.name || "Someone"
                  }}</strong>
                </div>
                <span class="text-disabled text-caption">{{
                  fmtDate(a.createdAt)
                }}</span>
              </div>
              <div class="text-body-2">{{ a.body }}</div>
            </div>
          </div>

          <div v-else class="text-medium-emphasis">No messages yet.</div>
        </PerfectScrollbar>
      </VCardText>

      <!-- Composer -->
      <VCardText class="pt-2">
        <div class="mb-2 text-caption">MESSAGE</div>
        <AppTextarea
          v-model="message"
          rows="3"
          placeholder="Type here…"
          auto-grow
        />
      </VCardText>

      <VCardActions class="px-5 pb-5 pt-1">
        <VBtn :disabled="!message.trim()" @click="onSend">Send</VBtn>
        <VBtn variant="tonal" color="secondary" class="ms-3" @click="close"
          >Cancel</VBtn
        >
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.message-card {
  border: 1px solid rgba(255, 255, 255, 8%);
  border-radius: 10px;
  background: rgba(255, 255, 255, 6%);
}
</style>
