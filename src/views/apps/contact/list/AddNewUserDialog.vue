<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { useConfigStore } from "@/stores/config";
import { resolveContactRequirement } from "@/utils/crmContactRequirement";
import ctd from "country-telephone-data";
import "flag-icons/css/flag-icons.min.css";
import { computed, nextTick, ref, watch } from "vue";
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
const configStore = useConfigStore();
configStore.init();

const defaultContactType = computed(() => {
  const configType =
    configStore.configurations?.crm?.DefaultContactType || "Individual";
  // Map "Organization" from config to "Entity" used in the form
  return configType === "Organization" ? "Entity" : configType;
});

const localContact = ref<Partial<ContactProperties>>({
  fullName: "",
  class: "Lead",
  type: defaultContactType.value,
  category: "General",
  email: "",
  number: "",
  status: "Cold",
  accounting: {
    vatNumber: "",
    taxId: "",
  },
  address: "",
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

const typeOptions = ["Entity", "Individual"];

const categoryOptions = computed(() => {
  const crmConfig = configStore.configurations?.crm;
  const contactType = String(localContact.value.type ?? "");

  let categories: string[] = [];
  if (contactType === "Entity" || contactType === "Organization") {
    categories = crmConfig?.organizationCategories || ["General"];
  } else {
    categories = crmConfig?.individualCategories || ["General"];
  }

  // Sort alphabetically but keep "General" at the top
  const sorted = [...categories].sort((a, b) => a.localeCompare(b));
  const generalIndex = sorted.findIndex((cat) => cat === "General");
  if (generalIndex > 0) {
    sorted.splice(generalIndex, 1);
    sorted.unshift("General");
  }

  return sorted;
});

const isEntityContact = computed(
  () =>
    String(localContact.value.type ?? "") === "Entity" ||
    String(localContact.value.type ?? "") === "Organization",
);

const activeContactRequirement = computed(() => {
  const crmConfig = configStore.configurations?.crm;
  const contactType = String(localContact.value.type ?? "");
  const isEntity = contactType === "Entity" || contactType === "Organization";

  return resolveContactRequirement(
    isEntity ? crmConfig?.organization : crmConfig?.individual,
  );
});

const eitherContactValidator = () =>
  String(localContact.value.email ?? "").trim() ||
  String(localContact.value.number ?? "").trim() ||
  "Enter phone or email";

// Conditional validators based on contact type and configuration
const emailRules = computed(() => {
  const requirement = activeContactRequirement.value;

  if (requirement === "email" || requirement === "both")
    return [requiredValidator, emailValidator];
  if (requirement === "either") return [eitherContactValidator, emailValidator];

  return [emailValidator];
});

const phoneRules = computed(() => {
  const requirement = activeContactRequirement.value;

  if (requirement === "phone" || requirement === "both")
    return [requiredValidator];
  if (requirement === "either") return [eitherContactValidator];

  return [];
});

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

// always default to LB and correct contact type when dialog opens
watch(
  () => props.isDialogVisible,
  (open) => {
    if (open) {
      selectedCountry.value = LB_DEFAULT;
      const computedType = defaultContactType.value;
      console.log(
        "Dialog opened - Setting contact type to:",
        computedType,
        "Config value:",
        configStore.configurations?.crm?.DefaultContactType,
      );
      localContact.value.type = computedType;
      localContact.value.class = "Lead";
      localContact.value.status = "Cold";
    }
  },
  { flush: "post" },
);

// Update category when contact type changes
watch(
  () => localContact.value.type,
  () => {
    const options = categoryOptions.value;
    if (
      options.length > 0 &&
      !options.includes(localContact.value.category || "")
    ) {
      localContact.value.category = options[0];
    }

    if (isEntityContact.value) {
      localContact.value.accounting ||= {};
      return;
    }

    localContact.value.accounting = {
      vatNumber: "",
      taxId: "",
    };
    localContact.value.address = "";
  },
);

// (kept util if you ever want emoji flags)
const countryFlag = (cc: string) => {
  if (!cc) return "";
  const upper = cc.toUpperCase();
  if (upper.length !== 2) return "";
  return upper.replace(/./g, (ch) =>
    String.fromCodePoint(127397 + ch.charCodeAt(0)),
  );
};

const dialogModelValueUpdate = (value: boolean) =>
  emit("update:isDialogVisible", value);

const resetForm = () => {
  refForm.value?.reset();
  refForm.value?.resetValidation();
  localContact.value = {
    fullName: "",
    class: "Lead",
    type: defaultContactType.value,
    category: categoryOptions.value[0] || "General",
    email: "",
    number: "",
    status: "Cold",
    accounting: {
      vatNumber: "",
      taxId: "",
    },
    address: "",
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
    selectedCountry.value.dial,
  );
  localContact.value.class = "Lead";
  localContact.value.status = "Cold";
  if (!isEntityContact.value) {
    localContact.value.accounting = {
      vatNumber: "",
      taxId: "",
    };
    localContact.value.address = "";
  }

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
    :width="$vuetify.display.smAndDown ? 'auto' : 520"
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
            <VCol cols="12">
              <AppTextField
                v-model="localContact.fullName"
                :rules="[requiredValidator]"
                label="Full Name"
                placeholder="John Doe"
              />
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="localContact.category"
                :rules="[requiredValidator]"
                label="Category"
                placeholder="Select category"
                :items="categoryOptions"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="localContact.email"
                :rules="emailRules"
                label="Email"
                placeholder="jane.doe@example.com"
              />
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="localContact.type"
                :rules="[requiredValidator]"
                label="Type"
                placeholder="Select type"
                :items="typeOptions"
              />
            </VCol>

            <template v-if="isEntityContact">
              <VCol cols="12">
                <AppTextField
                  v-model="localContact.accounting.vatNumber"
                  label="VAT Number"
                  placeholder="Enter VAT number"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="localContact.accounting.taxId"
                  label="TRN Number"
                  placeholder="Enter TRN number"
                />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="localContact.address"
                  auto-grow
                  rows="2"
                  label="Address"
                  placeholder="Enter address"
                />
              </VCol>
            </template>

            <VCol cols="12">
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

                  <!-- digits-only phone field with conditional validation -->
                  <VCol cols="12" md="7" class="phone-input">
                    <AppTextField
                      v-model="localContact.number"
                      :rules="phoneRules"
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

            <VCol cols="12" class="mt-4">
              <DialogActionBar
                save-text="Submit"
                save-type="submit"
                @save="() => undefined"
                @cancel="onReset"
              />
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
