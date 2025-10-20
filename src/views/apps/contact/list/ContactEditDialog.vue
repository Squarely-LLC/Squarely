<script setup lang="ts">
import ctd from "country-telephone-data";
import "flag-icons/css/flag-icons.min.css";
import { ref, toRaw, watch } from "vue";
import { Country, City } from "country-state-city";

import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";

type CountryOption = {
  code: string;
  label: string;
  dial: string;
};

const countrySearch = ref("");

// build countries list from country-state-city (ISO code + label)
const countries = (
  Country.getAllCountries() ?? []
).map((c: any) => ({ code: c.isoCode as string, label: c.name as string }))
  .filter((c: any) => c.code && c.label)
  .sort((a: any, b: any) => a.label.localeCompare(b.label));

// reactive city options (strings)
const cityOptions = ref<string[]>([]);

const updateCitiesForCountry = (countryLabel?: string | null) => {
  const label = (countryLabel ?? "").toString().trim();
  if (!label) {
    cityOptions.value = [];
    return;
  }

  const matched = countries.find((c) => c.label.toLowerCase() === label.toLowerCase());
  if (!matched) {
    cityOptions.value = [];
    return;
  }

  try {
    const cities = City.getCitiesOfCountry(matched.code) || [];
    cityOptions.value = (cities as any[])
      .map((x) => x.name)
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));
  } catch (e) {
    cityOptions.value = [];
  }
};

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

const rawCountries =
  (ctd as any)?.allCountries ?? (ctd as any)?.default?.allCountries ?? null;

const countryOptions: CountryOption[] = (
  rawCountries
    ? (rawCountries as any[])
        .map((c: any) => ({
          code: (c.iso2 || "").toUpperCase(),
          label: c.name,
          dial: `+${c.dialCode ?? ""}`,
        }))
        .filter((c: CountryOption) => c.code && c.code.length === 2)
    : [
        { code: "LB", label: "Lebanon", dial: "+961" },
        { code: "US", label: "United States", dial: "+1" },
        { code: "GB", label: "United Kingdom", dial: "+44" },
        { code: "FR", label: "France", dial: "+33" },
        { code: "IN", label: "India", dial: "+91" },
      ]
).sort((a, b) => a.label.localeCompare(b.label));

const LB_DEFAULT =
  (countryOptions.find((c) => c.code === "LB") as CountryOption) ||
  countryOptions[0];

const digitsOnly = (val: string) => (val || "").replace(/[^\d]/g, "");

const countryOptionsByDialLength = [...countryOptions].sort(
  (a, b) => digitsOnly(b.dial).length - digitsOnly(a.dial).length
);

const splitNumberByDial = (rawNumber: string | null | undefined) => {
  const trimmed = (rawNumber || "").trim();
  const digits = digitsOnly(trimmed);
  if (!trimmed) return { digits: "", country: LB_DEFAULT };
  const match =
    countryOptionsByDialLength.find((option) => {
      const dialDigits = digitsOnly(option.dial);
      return trimmed.startsWith(option.dial) || digits.startsWith(dialDigits);
    }) ?? LB_DEFAULT;
  const dialDigits = digitsOnly(match.dial);
  const digitsWithoutDial = digits.startsWith(dialDigits)
    ? digits.slice(dialDigits.length)
    : digits;
  return { digits: digitsWithoutDial, country: match };
};

const withDialAttached = (digitsValue: string, countryDial: string) => {
  const dig = digitsOnly(digitsValue);
  if (!dig) return countryDial;
  return `${countryDial} ${dig}`;
};

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

const initialPhoneMeta = splitNumberByDial(props.contact?.number ?? "");
const selectedCountry = ref<CountryOption>(initialPhoneMeta.country);

const sanitizeContact = (contact: ContactProperties | null) => {
  if (!contact) return null;

  const raw = toRaw(contact) as ContactProperties;
  const { digits } = splitNumberByDial(raw.number ?? "");

  return {
    ...raw,
    number: digits,
    connections: Array.isArray(raw.connections)
      ? raw.connections.map((connection) => ({ ...toRaw(connection) }))
      : [],
    accounting: {
      taxId: raw.accounting?.taxId ?? "",
      crn: raw.accounting?.crn ?? "",
      vatNumber: raw.accounting?.vatNumber ?? "",
    },
  } as ContactProperties;
};

const localContact = ref<ContactProperties | null>(
  sanitizeContact(props.contact)
);

// Stepper state
const currentStep = ref(0);
const numberedSteps = [
  { title: "Contact Details", icon: "tabler-user" },
  { title: "Additional Info", icon: "tabler-user-plus" },
  { title: "Legal", icon: "tabler-file-description" },
];

watch(
  () => props.contact,
  (value) => {
    localContact.value = sanitizeContact(value);
    selectedCountry.value = splitNumberByDial(value?.number ?? "").country;
    countrySearch.value = "";
    // populate cities dropdown based on loaded contact country
    updateCitiesForCountry(localContact.value?.country);
  }
);

// Reset localContact when the dialog is closed so edits are not preserved between openings
watch(
  () => props.isDialogVisible,
  (open) => {
    if (!open) {
      localContact.value = sanitizeContact(props.contact);
      selectedCountry.value = splitNumberByDial(
        props.contact?.number ?? ""
      ).country;
      countrySearch.value = "";
      updateCitiesForCountry(localContact.value?.country);
      // ensure the stepper resets to the first tab when dialog is closed
      currentStep.value = 0;
    }
  }
);

// watch for country changes in the Additional Info field and update cities
watch(
  () => localContact.value?.country,
  (c) => {
    updateCitiesForCountry(c);
    // if selected city is not available in new list, clear it
    if (localContact.value && localContact.value.city) {
      if (!cityOptions.value.includes(localContact.value.city)) {
        localContact.value.city = "";
      }
    }
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

// simple validators
const requiredValidator = (v: any) =>
  (v !== null && v !== undefined && String(v).trim() !== "") || "Required";
const emailValidator = (v: any) =>
  !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) || "Invalid email";

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

/**
 * Keep digits-only input while editing.
 */
const onPhoneInput = (val: string) => {
  if (!localContact.value) return;
  localContact.value.number = digitsOnly(val);
};

/**
 * Save the contact. If `closeAfter` is true the dialog will be closed after saving.
 * When saving mid-step we keep the dialog open so the user can continue editing.
 */
const saveContact = (closeAfter = false) => {
  if (!localContact.value) return;

  const payload: ContactProperties = {
    ...localContact.value,
    number: withDialAttached(
      String(localContact.value.number ?? ""),
      selectedCountry.value.dial
    ),
  };

  emit("submit", payload);
  if (closeAfter) emit("update:isDialogVisible", false);
};

const onReset = () => {
  localContact.value = sanitizeContact(props.contact);
  selectedCountry.value = splitNumberByDial(
    props.contact?.number ?? ""
  ).country;
  countrySearch.value = "";
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 820"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard>
      <VCardText>
        <!-- 👉 Stepper: compact on small screens, full on larger -->
        <div
          v-if="$vuetify.display.smAndDown"
          class="d-flex align-center justify-space-between px-2"
        >
          <VBtn
            icon
            variant="text"
            :disabled="currentStep === 0"
            @click="currentStep = Math.max(0, currentStep - 1)"
          >
            <VIcon icon="tabler-arrow-left" />
          </VBtn>

          <div class="text-subtitle-1 text-center">
            {{ numberedSteps[currentStep]?.title }}
          </div>

          <VBtn
            icon
            variant="text"
            :disabled="currentStep === numberedSteps.length - 1"
            @click="
              currentStep = Math.min(numberedSteps.length - 1, currentStep + 1)
            "
          >
            <VIcon icon="tabler-arrow-right" />
          </VBtn>
        </div>

        <div v-else>
          <AppStepper
            v-model:current-step="currentStep"
            :items="numberedSteps"
            icon-size="24"
            class="stepper-icon-step-bg"
          />
        </div>
      </VCardText>

      <VDivider />

      <VCardText>
        <!-- 👉 stepper content -->
        <VForm v-if="localContact" @submit.prevent="() => saveContact(true)">
          <VWindow v-model="currentStep" class="disable-tab-transition">
            <!-- Account Details -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Contact Details</h6>
                  <p class="mb-0">Enter the contact account details</p>
                </VCol>

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
                  <label class="v-label mb-1 text-body-2">Number</label>

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
                                    'fi-' +
                                      (item?.raw?.code || '').toLowerCase(),
                                  ]"
                                ></span>
                              </span>
                              <span class="dial ml-2">{{
                                item?.raw?.dial
                              }}</span>
                            </div>
                          </template>

                          <template #item="{ item, props }">
                            <VListItem v-bind="props" class="country-item">
                              <template #prepend>
                                <span class="flag">
                                  <span
                                    :class="[
                                      'fi',
                                      'fi-' +
                                        (item?.raw?.code || '').toLowerCase(),
                                    ]"
                                  ></span>
                                </span>
                              </template>

                              <template #append>
                                <span class="dial ml-3">{{
                                  item?.raw?.dial
                                }}</span>
                              </template>
                            </VListItem>
                          </template>
                        </VAutocomplete>
                      </VCol>

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
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.status"
                    label="Status"
                    placeholder="Select status"
                    :items="statusOptions"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <VSwitch
                    class="mt-5"
                    v-model="localContact.worksInSales"
                    label="Works in sales?"
                    color="primary"
                  />
                </VCol>
              </VRow>
            </VWindowItem>

            <!-- Additional Info -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Additional Info</h6>
                  <p class="mb-0">Setup additional contact information</p>
                </VCol>

                <VCol cols="12" md="6">
                  <VAutocomplete
                    v-model="localContact.country"
                    :items="countries"
                    item-title="label"
                    item-value="label"
                    :return-object="false"
                    v-model:search="countrySearch"
                    :menu-props="{ maxHeight: 360 }"
                    single-line
                    label="Country"
                    placeholder="Country"
                  >
                    <template #item="{ item, props }">
                      <VListItem v-bind="props">{{ item?.raw?.label }}</VListItem>
                    </template>
                  </VAutocomplete>
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.city"
                    label="City"
                    placeholder="Select city"
                    :items="cityOptions"
                  />
                </VCol>

                <VCol cols="12">
                  <AppTextField
                    v-model="localContact.address"
                    label="Address"
                    placeholder="Street, building, floor"
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
                  <AppDateTimePicker
                    v-model="localContact.birthdate"
                    label="Birthdate"
                    placeholder="Select date"
                    clearable
                    :max="new Date().toISOString().split('T')[0]"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="localContact.channel"
                    label="Channel"
                    placeholder="Select channel"
                    :items="channelOptions"
                  />
                </VCol>
              </VRow>
            </VWindowItem>

            <!-- Legal -->
            <VWindowItem>
              <VRow>
                <VCol cols="12">
                  <h6 class="text-h6 font-weight-medium">Legal</h6>
                  <p class="mb-0">Legal and tax information</p>
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="localContact.accounting.taxId"
                    label="Tax ID"
                    placeholder="TAX-123456"
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
                  <AppTextField
                    v-model="localContact.accounting.crn"
                    label="CRN"
                    placeholder="CRN-9981"
                  />
                </VCol>
              </VRow>
            </VWindowItem>
          </VWindow>

          <div class="d-flex flex-wrap align-center mt-8">
            <VBtn
              color="secondary"
              variant="tonal"
              :disabled="currentStep === 0"
              @click="currentStep--"
            >
              <VIcon icon="tabler-arrow-left" start class="flip-in-rtl" />
              Previous
            </VBtn>

            <VSpacer />

            <!-- right grouped buttons: Save and Next stick together -->
            <div class="d-flex align-center gap-2">
              <VBtn
                color="primary"
                @click.prevent="
                  () => saveContact(numberedSteps.length - 1 === currentStep)
                "
              >
                Save
              </VBtn>

              <VBtn
                variant="tonal"
                v-if="numberedSteps.length - 1 !== currentStep"
                @click="currentStep++"
              >
                Next
                <VIcon icon="tabler-arrow-right" end class="flip-in-rtl" />
              </VBtn>
            </div>
          </div>
        </VForm>

        <VAlert v-else type="warning" variant="tonal">
          Unable to load contact details.
        </VAlert>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.country-phone-inline {
  display: flex;
  align-items: center;
  gap: 2px;
}

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

.country-select :deep(.v-field__control),
.country-select :deep(.v-field__input) {
  block-size: 40px;
}

.phone-input {
  flex: 1;
}
</style>
