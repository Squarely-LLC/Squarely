<script setup lang="ts">
import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import ctd from "country-telephone-data";
import "flag-icons/css/flag-icons.min.css";
import { ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
import {
  emailValidator,
  requiredValidator,
} from "../../../../@core/utils/validators";

interface Props {
  isDialogVisible: boolean;
}
interface Emit {
  (e: "submit", value: Partial<EmployeeProperties>): void;
  (e: "update:isDialogVisible", value: boolean): void;
}
const props = defineProps<Props>();
const emit = defineEmits<Emit>();
// ref to the AppDateTimePicker component so we can focus/open its input
const duePickerRef = ref<any>(null);

const employeesStore = useEmployeesStore();
employeesStore.init?.();
const isFormValid = ref(false);
const refForm = ref<VForm | undefined>();

const getCurrentDate = () => {
  const now = new Date();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  return `${month} ${day}, ${year}`; // Format: "November 26, 2025"
};

const localContact = ref<Partial<EmployeeProperties>>({
  fullName: "",
  email: "",
  number: "",
  status: "Not Hired",
  birthdate: "",
  address: "",
  employment: { startDate: getCurrentDate() },
});
const gender = ref<"Female" | "Male">("Male");

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

const dialogModelValueUpdate = (value: boolean) =>
  emit("update:isDialogVisible", value);

const resetForm = () => {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  localContact.value = {
    fullName: "",
    email: "",
    number: "",
    status: "Not Hired",
    birthdate: "",
    address: "",
    employment: { startDate: getCurrentDate() },
  };
  gender.value = "Male";
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

  const dial = selectedCountry.value?.dial ?? "";
  const numberWithDial = withDialAttached(
    localContact.value.number ?? "",
    dial
  );

  // Convert startDate to ISO format if it's a Date object or formatted string
  let startDateISO: string | undefined;
  const rawStartDate = localContact.value.employment?.startDate;

  if (rawStartDate) {
    const dateObj =
      typeof rawStartDate === "string"
        ? new Date(rawStartDate)
        : (rawStartDate as Date);
    if (!isNaN(dateObj.getTime())) {
      startDateISO = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
    }
  }

  emit("submit", {
    ...localContact.value,
    number: numberWithDial,
    birthdate: localContact.value.birthdate || undefined,
    address: localContact.value.address || undefined,
    gender: gender.value,
    employment: {
      ...(localContact.value.employment ?? {}),
      startDate: startDateISO,
    },
  });

  notifications.push("Employee created", "success", 3000);

  // Reset form
  localContact.value = {
    fullName: "",
    email: "",
    number: "",
    status: "Not Hired",
    birthdate: "",
    address: "",
    employment: { startDate: getCurrentDate() },
  };
  gender.value = "Male";
  refForm.value?.resetValidation();
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
      <VCardText style="overflow: visible">
        <h4 class="text-h5 text-center mb-2">Add New Employee</h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to add a new employee.
        </p>

        <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
          <VRow>
            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.fullName"
                :rules="[requiredValidator]"
                label="Name"
                placeholder="John Doe"
                required
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localContact.email"
                :rules="[(val: string) => !val || emailValidator(val)]"
                label="Email"
                placeholder="name@example.com"
                type="email"
              />
            </VCol>

            <VCol cols="12" md="6">
              <label class="v-label mb-1 text-body-2">Number *</label>

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

                  <VCol cols="12" md="7" class="phone-input">
                    <AppTextField
                      v-model="localContact.number"
                      :rules="[requiredValidator]"
                      placeholder="+961 71 123 456"
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
              <AppDateTimePicker
                ref="duePickerRef"
                v-model="localContact.birthdate"
                :rules="[requiredValidator]"
                label="Date of Birth"
                placeholder="Select date"
                :config="{ enableTime: false, dateFormat: 'Y-m-d' }"
              />
            </VCol>

            <VCol cols="12">
              <VRadioGroup v-model="gender" inline>
                <template #label>
                  <label class="v-label text-body-2">Gender</label>
                </template>
                <VRadio label="Male" value="Male" />
                <VRadio label="Female" value="Female" />
              </VRadioGroup>
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="localContact.address"
                label="Address"
                placeholder="12, Business Park"
                auto-grow
                rows="2"
              />
            </VCol>

            <VCol cols="12">
              <AppDateTimePicker
                ref="duePickerRef"
                v-model="localContact.employment!.startDate"
                :rules="[requiredValidator]"
                label="Joining Date"
                placeholder="Select joining date"
                :config="{ enableTime: false, dateFormat: 'F j, Y' }"
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
