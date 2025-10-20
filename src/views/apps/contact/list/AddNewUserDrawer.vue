<script setup lang="ts">
import { nextTick, ref } from "vue";

import { emailValidator, requiredValidator } from "@/@core/utils/validators";
import type { ContactProperties } from "@db/apps/contact/types";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "userData", value: ContactProperties): void;
}

interface Props {
  isDrawerOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const isFormValid = ref(false);
const refForm = ref<VForm>();

const fullName = ref("");
const email = ref("");
const number = ref("");
const contactClass = ref<ContactProperties["class"] | undefined>();
const contactType = ref<ContactProperties["type"] | undefined>();
const category = ref<ContactProperties["category"] | undefined>();
const status = ref<ContactProperties["status"] | undefined>();
const channel = ref<ContactProperties["channel"] | undefined>();
const country = ref("");
const city = ref("");
const language = ref("");
const address = ref("");
const birthdate = ref<string | null>(null);
const worksInSales = ref(false);
const taxId = ref("");
const crn = ref("");
const vatNumber = ref("");

const resetForm = () => {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  contactClass.value = undefined;
  contactType.value = undefined;
  category.value = undefined;
  status.value = undefined;
  channel.value = undefined;
  country.value = "";
  city.value = "";
  language.value = "";
  address.value = "";
  birthdate.value = null;
  worksInSales.value = false;
  taxId.value = "";
  crn.value = "";
  vatNumber.value = "";
};

const closeNavigationDrawer = () => {
  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
};

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  emit("userData", {
    id: 0,
    fullName: fullName.value.trim(),
    class: contactClass.value!,
    type: contactType.value!,
    category: category.value!,
    email: email.value.trim(),
    number: number.value.trim(),
    status: status.value!,
    picture: undefined,
    connections: [],
    accounting: {
      taxId: taxId.value || undefined,
      crn: crn.value || undefined,
      vatNumber: vatNumber.value || undefined,
    },
    address: address.value || undefined,
    country: country.value || undefined,
    city: city.value || undefined,
    language: language.value || undefined,
    channel: channel.value!,
    birthdate: birthdate.value || undefined,
    worksInSales: worksInSales.value,
    createdAt: new Date().toISOString(),
  });

  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
};

const handleDrawerModelValueUpdate = (val: boolean) => {
  emit("update:isDrawerOpen", val);
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="420"
    location="end"
    class="scrollable-content"
    :model-value="props.isDrawerOpen"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection
      title="Add New Contact"
      @cancel="closeNavigationDrawer"
    />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppTextField
                  v-model="fullName"
                  :rules="[requiredValidator]"
                  label="Full Name"
                  placeholder="John Doe"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="email"
                  :rules="[requiredValidator, emailValidator]"
                  label="Email"
                  placeholder="jane.doe@example.com"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="number"
                  :rules="[requiredValidator]"
                  label="Phone Number"
                  placeholder="+961 70 123 456"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="contactClass"
                  :rules="[requiredValidator]"
                  label="Class"
                  placeholder="Select class"
                  :items="['Lead', 'Client', 'Supplier', 'Contact', 'Owner']"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="contactType"
                  :rules="[requiredValidator]"
                  label="Type"
                  placeholder="Select type"
                  :items="['Entity', 'Individual']"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="category"
                  :rules="[requiredValidator]"
                  label="Category"
                  placeholder="Select category"
                  :items="['General', 'VIP', 'Real Estate']"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="status"
                  :rules="[requiredValidator]"
                  label="Status"
                  placeholder="Select status"
                  :items="['Active', 'Dormant', 'Potential', 'Lost']"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="channel"
                  :rules="[requiredValidator]"
                  label="Primary Channel"
                  placeholder="Select channel"
                  :items="[
                    'Social Media',
                    'Referral',
                    'Direct Sales',
                    'Website',
                    'Email Campaigns',
                  ]"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="country"
                  label="Country"
                  placeholder="Select country"
                  clearable
                  :items="[
                    'Lebanon',
                    'United Arab Emirates',
                    'Qatar',
                    'United Kingdom',
                  ]"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="city"
                  label="City"
                  placeholder="Beirut"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="address"
                  label="Address"
                  placeholder="Street, building, floor"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="language"
                  label="Language"
                  placeholder="Arabic"
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  v-model="birthdate"
                  label="Birthdate"
                  placeholder="Select date"
                  clearable
                  :max="new Date().toISOString().split('T')[0]"
                />
              </VCol>

              <VCol cols="12">
                <VSwitch
                  v-model="worksInSales"
                  label="Works in sales"
                  color="primary"
                />
              </VCol>

              <VCol cols="12" md="4">
                <AppTextField
                  v-model="taxId"
                  label="Tax ID"
                  placeholder="TAX-123456"
                />
              </VCol>
              <VCol cols="12" md="4">
                <AppTextField
                  v-model="crn"
                  label="CRN"
                  placeholder="CRN-9981"
                />
              </VCol>
              <VCol cols="12" md="4">
                <AppTextField
                  v-model="vatNumber"
                  label="VAT Number"
                  placeholder="VAT-112233"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">Submit</VBtn>
                <VBtn
                  variant="tonal"
                  color="error"
                  @click="closeNavigationDrawer"
                >
                  Cancel
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
