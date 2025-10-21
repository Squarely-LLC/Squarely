<script setup lang="ts">
import ConfigEditorDrawer from "@/components/ConfigEditorDrawer.vue";
import type { LegalConfig } from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { onMounted, ref } from "vue";

const store = useConfigStore();
const drawerOpen = ref(false);

onMounted(() => {
  store.init();
});

function openLegalEditor() {
  drawerOpen.value = true;
}

async function saveLegal(patch: Partial<LegalConfig>) {
  await store.saveRemote({ legal: patch });
}
</script>

<template>
  <div>
    <h2>Configurations</h2>
    <section>
      <h3>Legal</h3>
      <div>
        <p><strong>Company:</strong> {{ store.legal?.companyName || "—" }}</p>
        <p><strong>Email:</strong> {{ store.legal?.email || "—" }}</p>
        <p><strong>Website:</strong> {{ store.legal?.website || "—" }}</p>
        <v-btn small @click="openLegalEditor">Edit Legal</v-btn>
      </div>
    </section>

    <ConfigEditorDrawer
      v-model:isOpen="drawerOpen"
      :initial="store.legal"
      @save="saveLegal"
    />
  </div>
</template>
