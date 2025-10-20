<script setup lang="ts">
import { ref, toRaw, watch } from "vue";

import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";

interface Props {
  contact?: ContactProperties | null;
  isDialogVisible: boolean;
  loading?: boolean;
  error?: string | null;
}

interface Emit {
  (e: "submit", value: ContactProperties): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  contact: null,
  loading: false,
  error: null,
});

const emit = defineEmits<Emit>();

const sanitizeContact = (contact: ContactProperties | null) => {
  if (!contact) return null;

  const raw = toRaw(contact) as ContactProperties;

  return {
    ...raw,
    connections: Array.isArray(raw.connections)
      ? raw.connections.map((connection) => ({ ...toRaw(connection) }))
      : [],
    accounting: {
      taxId: raw.accounting?.taxId ?? "",
      crn: raw.accounting?.crn ?? "",
      vatNumber: raw.accounting?.vatNumber ?? "",
    },
  } satisfies ContactProperties;
};

const localContact = ref<ContactProperties | null>(
  sanitizeContact(props.contact)
);

watch(
  () => props.contact,
  (value) => {
    localContact.value = sanitizeContact(value);
  }
);

const classOptions = ["Lead", "Client", "Supplier", "Contact", "Owner"];
const categoryOptions = ["General", "VIP", "Real Estate"];
const statusOptions = ["Active", "Dormant", "Potential", "Lost"];
const typeOptions = ["Entity", "Individual"];
const channelOptions = [
  "Social Media",
  "Referral",
  "Direct Sales",
  "Website",
  "Email Campaigns",
];

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

const onSubmit = () => {
  if (!localContact.value) return;
  emit("submit", localContact.value);
};

const onReset = () => {
  localContact.value = sanitizeContact(props.contact);
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 720"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">Edit Contact</h4>
        <p class="text-body-2 text-center mb-6">
          Update the contact details below and save your changes.
        </p>

        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          density="comfortable"
        >
          {{ error }}
        </VAlert>

        <VForm v-if="localContact" @submit.prevent="onSubmit">
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.fullName"
                label="Full Name"
                placeholder="John Doe"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.email"
                label="Email"
                placeholder="john@example.com"
                :rules="[requiredValidator, emailValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.number"
                label="Phone Number"
                placeholder="+961 70 123 456"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.class"
                label="Class"
                placeholder="Select class"
                :items="classOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.type"
                label="Type"
                placeholder="Select type"
                :items="typeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.category"
                label="Category"
                placeholder="Select category"
                :items="categoryOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.status"
                label="Status"
                placeholder="Select status"
                :items="statusOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.channel"
                label="Channel"
                placeholder="Select channel"
                :items="channelOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.language"
                label="Language"
                placeholder="English"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.country"
                label="Country"
                placeholder="Lebanon"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.city"
                label="City"
                placeholder="Beirut"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="localContact.address"
                label="Address"
                placeholder="Street, building, floor"
              />
            </VCol>

            <VCol cols="12" md="6"> </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.accounting.taxId"
                label="Tax ID"
                placeholder="TAX-123456"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.accounting.crn"
                label="CRN"
                placeholder="CRN-9981"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.accounting.vatNumber"
                label="VAT Number"
                placeholder="VAT-112233"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="localContact.birthdate"
                label="Birthdate"
                placeholder="Select date"
                clearable
                :max="new Date().toISOString().split('T')[0]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <VSwitch
                v-model="localContact.worksInSales"
                label="Works in sales"
                color="primary"
              />
            </VCol>

            <VCol cols="12" class="d-flex flex-wrap justify-center gap-4 mt-4">
              <VBtn :loading="loading" type="submit">Save</VBtn>
              <VBtn variant="tonal" color="secondary" @click="onReset"
                >Cancel</VBtn
              >
            </VCol>
          </VRow>
        </VForm>

        <VAlert v-else type="warning" variant="tonal">
          Unable to load contact details.
        </VAlert>
      </VCardText>
    </VCard>
  </VDialog>
</template>
