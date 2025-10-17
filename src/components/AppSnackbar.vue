<template>
  <div>
    <transition-group name="list" tag="div">
      <div v-for="note in notes" :key="note.id" class="app-snackbar-wrapper">
        <VSnackbar
          v-model:model-value="noteVisible[note.id]"
          :color="note.color"
          :timeout="note.timeout"
          location="bottom"
        >
          {{ note.message }}
        </VSnackbar>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useNotificationsStore } from "@/stores/notifications";
import { computed, reactive, watchEffect } from "vue";

const store = useNotificationsStore();

const notes = computed(() => store.items);

// track visibility flags per-note so v-model works
const noteVisible: Record<number, boolean> = reactive({});

watchEffect(() => {
  for (const note of store.items) {
    if (!(note.id in noteVisible)) {
      noteVisible[note.id] = true;
      // auto-remove after timeout + small buffer
      const timeout = note.timeout ?? 3000;
      setTimeout(() => {
        noteVisible[note.id] = false;
        // allow the hide animation to run then remove from store
        setTimeout(() => store.remove(note.id), 250);
      }, timeout);
    }
  }
});
</script>

<style scoped>
.app-snackbar-wrapper {
  margin-block-end: 6px;
}
</style>
