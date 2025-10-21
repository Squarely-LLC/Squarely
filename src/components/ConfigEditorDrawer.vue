<script setup lang="ts">
import type { LegalConfig } from "@/plugins/fake-api/handlers/config/types";
import { ref, watch } from "vue";

defineProps<{ isOpen: boolean; initial?: LegalConfig }>();
const emit = defineEmits(["update:isOpen", "save"]);

const props = defineProps<{ isOpen: boolean; initial?: LegalConfig }>();

const drawerOpen = ref(props.isOpen);

watch(
  () => props.isOpen,
  (val) => {
    drawerOpen.value = val;
  }
);

watch(drawerOpen, (val) => emit("update:isOpen", val));

const form = ref<LegalConfig>({ ...(props.initial || {}) });

watch(
  () => props.initial,
  (val) => {
    form.value = { ...(val || {}) };
  }
);

function save() {
  emit("save", form.value);
  drawerOpen.value = false;
}

function cancel() {
  drawerOpen.value = false;
}
</script>

<template>
  <v-navigation-drawer v-model="drawerOpen" absolute right temporary>
    <v-card>
      <v-card-title>Edit Legal Configuration</v-card-title>
      <v-card-text>
        <AppTextField v-model="form.companyName" label="Company Name" />
        <AppTextField v-model="form.crn" label="CRN" />
        <AppTextField v-model="form.address" label="Address" />
        <AppTextField v-model="form.country" label="Country" />
        <AppTextField v-model="form.city" label="City" />
        <AppTextField v-model="form.number" label="Phone" />
        <AppTextField v-model="form.email" label="Email" />
        <AppTextField v-model="form.website" label="Website" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-navigation-drawer>
</template>
