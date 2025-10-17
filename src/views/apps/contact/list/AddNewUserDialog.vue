<script setup lang="ts">
import ctd from "country-telephone-data";
import "flag-icons/css/flag-icons.min.css";
import { nextTick, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import type { VForm } from "vuetify/components/VForm";
import {
  emailValidator,
  requiredValidator,
} from "../../../../@core/utils/validators";
import type { ContactProperties } from "../../../../plugins/fake-api/handlers/apps/contact/types";

interface Props {
  isDialogVisible: boolean;
}
interface Emit {
  (e: "submit", value: Partial<ContactProperties>): void;
  (e: "update:isDialogVisible", value: boolean): void;
}
const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const display = useDisplay();
const isFormValid = ref(false);
const refForm = ref<VForm | undefined>();

const localContact = ref<Partial<ContactProperties>>({
  fullName: "",
  class: "Contact",
  type: "Individual",
  category: "General",
  email: "",
  number: "",
  status: "Active",
});

const countrySearch = ref("");

const countryCustomFilter = (value: any, query: string, item: any) => {
  const q = (query ?? "").toString().trim().toLowerCase();
  if (!q) return true;
  const label = (item?.raw?.label ?? "").toLowerCase();
  const code = (item?.raw?.code ?? "").toLowerCase();
  const dial = (item?.raw?.dial ?? "").toLowerCase();
  const qNoPlus = q.replace("+", "");
  const dialNoPlus = dial.replace("+", "");
  return (
    label.includes(q) ||
    code.includes(q) ||
    dial.includes(q) ||
    dialNoPlus.includes(qNoPlus)
  );
};

const classOptions = ["Lead", "Client", "Supplier", "Contact", "Owner"];
const categoryOptions = ["General", "VIP", "Real Estate"];
const statusOptions = ["Active", "Dormant", "Potential", "Lost"];
const typeOptions = ["Entity", "Individual"];

// Build country options
const rawCountries =
  (ctd as any)?.allCountries ?? (ctd as any)?.default?.allCountries ?? null;

const countryOptions = (
  rawCountries
    ? (rawCountries as any[])
        .map((c: any) => ({
          code: (c.iso2 || "").toUpperCase(),
          label: c.name,
          dial: `+${c.dialCode ?? ""}`,
        }))
        .filter((c: any) => c.code && c.code.length === 2)
    : [
        { code: "LB", label: "Lebanon", dial: "+961" },
        { code: "US", label: "United States", dial: "+1" },
        { code: "GB", label: "United Kingdom", dial: "+44" },
        { code: "FR", label: "France", dial: "+33" },
        { code: "IN", label: "India", dial: "+91" },
      ]
).sort((a, b) => a.label.localeCompare(b.label)) as Array<{
  code: string;
  label: string;
  dial: string;
}>;

const LB_DEFAULT =
  countryOptions.find((c) => c.code === "LB") || countryOptions[0];
const selectedCountry = ref(LB_DEFAULT);

// always default to LB when dialog opens
watch(
  () => props.isDialogVisible,
  (open) => {
    if (open) selectedCountry.value = LB_DEFAULT;
  }
);

// (kept util if you ever want emoji flags)
const countryFlag = (cc: string) => {
  if (!cc) return "";
  const upper = cc.toUpperCase();
  if (upper.length !== 2) return "";
  return upper.replace(/./g, (ch) =>
    String.fromCodePoint(127397 + ch.charCodeAt(0))
  );
};

const dialogModelValueUpdate = (value: boolean) =>
  emit("update:isDialogVisible", value);

const resetForm = () => {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  localContact.value = {
    fullName: "",
    class: "Contact",
    type: "Individual",
    category: "General",
    email: "",
    number: "",
    status: "Active",
  };
  selectedCountry.value = LB_DEFAULT; // keep LB default
};

// 👉 accept digits only in phone field
const onPhoneInput = (val: string) => {
  localContact.value.number = (val || "").replace(/[^\d]/g, "");
};

// 👉 ensure dial code is saved into the same field on submit
const withDialAttached = (digitsOnly: string, countryDial: string) => {
  const dig = (digitsOnly || "").replace(/[^\d]/g, "");
  if (!dig) return countryDial; // just +code if empty
  return `${countryDial} ${dig}`;
};

import { useNotificationsStore } from "@/stores/notifications";

const notifications = useNotificationsStore();

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  localContact.value.number = withDialAttached(
    String(localContact.value.number ?? ""),
    selectedCountry.value.dial
  );

  emit("submit", { ...localContact.value });
  emit("update:isDialogVisible", false);
  // show a brief snackbar confirming creation
  notifications.push("Contact created", "success", 3000);
  nextTick(() => resetForm());
};

const onReset = () => {
  resetForm();
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 900"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">Add New Contact</h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to add a new contact.
        </p>

        <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.fullName"
                :rules="[requiredValidator]"
                label="Full Name"
                placeholder="John Doe"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.email"
                :rules="[requiredValidator, emailValidator]"
                label="Email"
                placeholder="jane.doe@example.com"
              />
            </VCol>

            <VCol cols="12" md="6">
              <label class="v-label mb-1 text-body-2">Number</label>

              <!-- tighter inline layout (8px gap) -->
              <div class="country-phone-inline">
                <VRow>
                  <VCol cols="12" md="5">
                    <VAutocomplete
                      v-model="selectedCountry"
                      class="country-select"
                      :items="countryOptions"
                      item-title="label"
                      item-value="code"
                      return-object
                      v-model:search="countrySearch"
                      :custom-filter="countryCustomFilter"
                      :menu-props="{ maxHeight: 360 }"
                      single-line
                    >
                      <template #selection="{ item }">
                        <div class="selection-item country-item">
                          <span class="flag">
                            <span
                              :class="[
                                'fi',
                                'fi-' + (item?.raw?.code || '').toLowerCase(),
                              ]"
                            ></span>
                          </span>
                          <span class="dial ml-2">{{ item?.raw?.dial }}</span>
                        </div>
                      </template>

                      <template #item="{ item, props }">
                        <VListItem v-bind="props" class="country-item">
                          <template #prepend>
                            <span class="flag">
                              <span
                                :class="[
                                  'fi',
                                  'fi-' + (item?.raw?.code || '').toLowerCase(),
                                ]"
                              ></span>
                            </span>
                          </template>

                          <template #append>
                            <span class="dial ml-3">{{ item?.raw?.dial }}</span>
                          </template>
                        </VListItem>
                      </template>
                    </VAutocomplete>
                  </VCol>

                  <!-- digits-only phone field (no validation rules besides required) -->
                  <VCol cols="12" md="7" class="phone-input">
                    <AppTextField
                      v-model="localContact.number"
                      :rules="[requiredValidator]"
                      placeholder="e.g. 71234567"
                      type="tel"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      @update:model-value="onPhoneInput"
                    />
                  </VCol>
                </VRow>
              </div>
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.class"
                :rules="[requiredValidator]"
                label="Class"
                placeholder="Select class"
                :items="classOptions"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.type"
                :rules="[requiredValidator]"
                label="Type"
                placeholder="Select type"
                :items="typeOptions"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.category"
                :rules="[requiredValidator]"
                label="Category"
                placeholder="Select category"
                :items="categoryOptions"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContact.status"
                :rules="[requiredValidator]"
                label="Status"
                placeholder="Select status"
                :items="statusOptions"
              />
            </VCol>

            <VCol cols="12" class="d-flex flex-wrap justify-center gap-4 mt-4">
              <VBtn type="submit">Submit</VBtn>
              <VBtn variant="tonal" color="secondary" @click="onReset"
                >Cancel</VBtn
              >
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
/* phone field closer to dropdown */
.country-phone-inline {
  display: flex;
  align-items: center;
  gap: 2px; /* adjust if you want even tighter */
}

/* Country select width */

.country-item {
  display: flex;
  align-items: center;
}

.country-item .flag {
  display: inline-flex;
  align-items: center;
}

.country-item .flag .fi {
  border-radius: 2px;
  block-size: 14px;
  inline-size: 20px;
}

.country-item .dial {
  font-weight: 600;
  min-inline-size: 54px;
  text-align: end;
}

.selection-item {
  min-inline-size: 72px;
}

/* match field height */
.country-select :deep(.v-field__control),
.country-select :deep(.v-field__input) {
  block-size: 40px;
}

/* phone input fills remaining space */
.phone-input {
  flex: 1;
}
</style>
