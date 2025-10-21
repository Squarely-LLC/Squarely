<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { deleteFile, getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { onMounted, ref, watch } from "vue";

const file = ref<File | null>(null);
const placeholderSvg = encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='400' height='240' viewBox='0 0 400 240'>
    <rect width='100%' height='100%' fill='#f5f5f5' />
    <g fill='#cfcfcf'>
      <rect x='24' y='30' width='120' height='80' rx='8' />
      <rect x='160' y='30' width='216' height='32' rx='6' />
      <rect x='160' y='76' width='216' height='18' rx='4' />
      <rect x='160' y='102' width='216' height='18' rx='4' />
    </g>
  </svg>
`);

const previewUrl = ref<string>(`data:image/svg+xml;utf8,${placeholderSvg}`);
const saving = ref(false);

const store = useConfigStore();
store.init();

onMounted(async () => {
  // load existing logo if present
  const existing = store.legal?.logo;
  if (existing && String(existing).startsWith("idb:")) {
    const key = String(existing).slice(4).split("|")[0];
    const url = await getFileObjectUrl(key).catch(() => null);
    previewUrl.value = url || `data:image/svg+xml;utf8,${placeholderSvg}`;
  } else if (existing) {
    previewUrl.value =
      String(existing) || `data:image/svg+xml;utf8,${placeholderSvg}`;
  }
});

watch(file, async (f) => {
  if (!f) return;
  try {
    const url = URL.createObjectURL(f);
    previewUrl.value = url;
  } catch {}
});

async function onFileChange() {
  // v-file-input updates `file` automatically via v-model
}

async function saveLogo() {
  if (!file.value) return;
  saving.value = true;
  try {
    const key = await saveFile(file.value);
    const name = encodeURIComponent(file.value.name);
    const pointer = `idb:${key}|${name}`;
    // persist via API/store
    await store.saveRemote({
      legal: { ...(store.legal || {}), logo: pointer },
    });
    // refresh preview from idb
    const url = await getFileObjectUrl(key).catch(() => null);
    previewUrl.value = url || `data:image/svg+xml;utf8,${placeholderSvg}`;
    file.value = null;
  } finally {
    saving.value = false;
  }
}

async function removeLogo() {
  const existing = store.legal?.logo;
  if (existing && String(existing).startsWith("idb:")) {
    const key = String(existing).slice(4).split("|")[0];
    try {
      await deleteFile(key);
    } catch {}
  }
  await store.saveRemote({ legal: { ...(store.legal || {}), logo: "" } });
  previewUrl.value = `data:image/svg+xml;utf8,${placeholderSvg}`;
}
</script>

<template>
  <VCard title="Company Logo" class="mb-6">
    <VCardText>
      <VRow>
        <VCol cols="12" md="3" class="logo-block">
          <div>
            <img :src="previewUrl" alt="logo preview" class="logo-preview" />
          </div>
        </VCol>

        <VCol cols="12" md="9" class="controls-block">
          <div class="d-flex flex-column align-start">
            <v-file-input
              class="w-100"
              v-model="file"
              accept="image/*"
              label="Upload logo"
              show-size
              @change="onFileChange"
            />

            <div class="d-flex gap-x-2 mt-4 ms-5 ms-8">
              <VBtn color="error" variant="tonal" @click="removeLogo"
                >Remove</VBtn
              >
              <VBtn color="primary" @click="saveLogo" :loading="saving"
                >Save Logo</VBtn
              >
            </div>
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>

<style scoped>
.logo-preview {
  padding: 8px;
  border: 1px solid #eeeeee1e;
  max-block-size: 120px;
  max-inline-size: 200px;
  object-fit: contain;
}

@media (max-width: 959px) {
  .controls-block {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    inline-size: 100vw;
    text-align: center;
  }

  .logo-block {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .controls-block .v-file-input,
  .controls-block .v-input {
    inline-size: 100% !important;
    max-inline-size: 320px;
  }

  /* Remove left spacing on small screens so buttons align center */
  .controls-block .ms-5 {
    margin-inline-start: 0 !important;
  }
}
</style>
