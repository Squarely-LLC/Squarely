<script setup lang="ts">
import {
  emailValidator,
  requiredValidator,
  urlValidator,
} from "@/@core/utils/validators";
import type { LegalConfig } from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { deleteFile, getFileObjectUrl, saveFile } from "@/utils/fileStore";
import { City, Country } from "country-state-city";
import { computed, onMounted, ref, watch } from "vue";

const file = ref<File | null>(null);
const selectedName = ref<string>("");
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
const nativeInput = ref<HTMLInputElement | null>(null);
const logoFileError = ref<string>("");
const companyError = ref<string>("");

const COMPANY_FIELDS = [
  "companyName",
  "crn",
  "country",
  "city",
  "address",
  "number",
  "email",
  "website",
] as const;
type CompanyField = (typeof COMPANY_FIELDS)[number];
type CompanyForm = Partial<Pick<LegalConfig, CompanyField>>;

const company = ref<CompanyForm>({});
const lastSavedCompany = ref<CompanyForm>({});
const originalLogoName = ref<string>("");
// Country/city helpers (reused from contact edit dialog)
const countrySearch = ref("");
const citySearch = ref("");

const countries = (Country.getAllCountries() ?? [])
  .map((c: any) => ({ code: c.isoCode as string, label: c.name as string }))
  .filter((c: any) => c.code && c.label)
  .sort((a: any, b: any) => a.label.localeCompare(b.label));

const cityOptions = ref<string[]>([]);

const updateCitiesForCountry = (countryKey?: string | null) => {
  const key = (countryKey ?? "").toString().trim();
  if (!key) {
    cityOptions.value = [];
    return;
  }

  // try matching by ISO code first, then by label
  const matched =
    countries.find((c) => c.code.toLowerCase() === key.toLowerCase()) ||
    countries.find((c) => c.label.toLowerCase() === key.toLowerCase());

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

  // If we already have a city value, ensure it's selectable
  const existingCity = (company.value?.city as string) || "";
  if (existingCity) {
    const exists = cityOptions.value.find(
      (c) => c.toLowerCase() === existingCity.toLowerCase()
    );
    if (!exists) cityOptions.value = [existingCity, ...cityOptions.value];
  }
};

const onCountryKeydown = (e: KeyboardEvent) => {
  if (e.key !== "Tab") return;
  const q = (countrySearch.value ?? "").toString().trim().toLowerCase();
  if (!q) return;
  const match = countries.find(
    (c) =>
      c.label.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q)
  );
  if (match) company.value.country = match.label;
};

const onCityKeydown = (e: KeyboardEvent) => {
  if (e.key !== "Tab") return;
  const q = (citySearch.value ?? "").toString().trim().toLowerCase();
  if (!q) return;
  const match = cityOptions.value.find(
    (s) => s.toLowerCase().startsWith(q) || s.toLowerCase().includes(q)
  );
  if (match) company.value.city = match;
};
const savingCompany = ref(false);

const store = useConfigStore();
store.init();

// notifications
import { useNotificationsStore } from "@/stores/notifications";
const notifications = useNotificationsStore();

const pickCompanyFields = (source?: LegalConfig | null): CompanyForm => {
  const picked: CompanyForm = {};
  if (!source) return picked;
  COMPANY_FIELDS.forEach((key) => {
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  });
  return picked;
};

const cloneCompany = (source: CompanyForm = {}): CompanyForm => {
  const clone: CompanyForm = {};
  COMPANY_FIELDS.forEach((key) => {
    const value = source[key];
    if (value !== undefined) clone[key] = value;
  });
  return clone;
};

const buildCompanyPayload = (): CompanyForm => {
  const payload: CompanyForm = {};
  COMPANY_FIELDS.forEach((key) => {
    const value = company.value?.[key];
    if (value !== undefined) payload[key] = value;
  });
  return payload;
};

const syncCompanyFromStore = () => {
  const snapshot = pickCompanyFields(store.legal);
  lastSavedCompany.value = cloneCompany(snapshot);
  company.value = cloneCompany(snapshot);
  updateCitiesForCountry(company.value?.country);
};

// computed helpers for enabling/disabling logo actions
const hasLogo = computed(() => Boolean(store.legal?.logo));
const isSameFileSelected = computed(() => {
  return !!(
    file.value &&
    originalLogoName.value &&
    file.value.name === originalLogoName.value
  );
});
const canSaveLogo = computed(
  () => !!file.value && !isSameFileSelected.value && !logoFileError.value
);
const canRemoveLogo = computed(() => !!hasLogo.value && !saving.value);

// Company Information: dirty/validation helpers
const normalizeVal = (v: unknown) => (v == null ? "" : String(v));
const isCompanyDirty = computed(() => {
  return COMPANY_FIELDS.some(
    (key) =>
      normalizeVal(company.value?.[key]) !==
      normalizeVal(lastSavedCompany.value?.[key])
  );
});
const companyRequiredValid = computed(() => {
  const name = normalizeVal(company.value?.companyName).trim();
  const country = normalizeVal(company.value?.country).trim();
  return !!name && !!country;
});
const canSaveCompany = computed(
  () =>
    isCompanyDirty.value && companyRequiredValid.value && !savingCompany.value
);
const canCancelCompany = computed(
  () => isCompanyDirty.value && !savingCompany.value
);

watch(
  () => company.value.country,
  (val) => {
    updateCitiesForCountry(val);
  },
  { immediate: true }
);

onMounted(async () => {
  // load existing logo if present
  const existing = store.legal?.logo;
  if (existing && String(existing).startsWith("idb:")) {
    const key = String(existing).slice(4).split("|")[0];
    const url = await getFileObjectUrl(key).catch(() => null);
    previewUrl.value = url || `data:image/svg+xml;utf8,${placeholderSvg}`;
    // extract filename from pointer if present (idb:key|name)
    const parts = String(existing).split("|");
    if (parts[1]) {
      try {
        selectedName.value = decodeURIComponent(parts[1]);
        originalLogoName.value = selectedName.value;
      } catch {
        selectedName.value = parts[1];
        originalLogoName.value = selectedName.value;
      }
    }
  } else if (existing) {
    previewUrl.value =
      String(existing) || `data:image/svg+xml;utf8,${placeholderSvg}`;
    // try to infer a filename from a URL-like existing value
    try {
      const maybeUrl = String(existing);
      // if it's an idb pointer this will be skipped; for data: URLs this may throw
      if (!maybeUrl.startsWith("data:")) {
        const parsed = new URL(maybeUrl);
        const last = parsed.pathname.split("/").pop();
        if (last) selectedName.value = decodeURIComponent(last);
        if (last) originalLogoName.value = selectedName.value;
      }
    } catch {}
  }
  // initialize editable company info from store
  syncCompanyFromStore();
});

watch(file, async (f) => {
  if (!f) return;
  try {
    const url = URL.createObjectURL(f);
    previewUrl.value = url;
    selectedName.value = f.name;
  } catch {}
});

function openFileDialog() {
  // open the hidden native file input so the user can pick an image
  nativeInput.value?.click();
}

function onNativeFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] || null;
  if (!f) return;
  if (!f.type.startsWith("image/")) {
    logoFileError.value = "Only image files are allowed.";
    // clear native input to avoid stale selection
    input.value = "";
    return;
  }
  logoFileError.value = "";
  file.value = f;
}

async function onFileChange() {
  // v-file-input updates `file` automatically via v-model
  // validate v-file-input's selected file
  const f = file.value;
  if (!f) return;
  if (!f.type.startsWith("image/")) {
    logoFileError.value = "Only image files are allowed.";
    file.value = null;
    // also clear native input if present
    if (nativeInput.value) nativeInput.value = "" as any;
    return;
  }
  logoFileError.value = "";
}

async function saveLogo() {
  if (!file.value) return;
  saving.value = true;
  try {
    // capture original name before we clear the file ref
    const originalName = file.value.name;
    const key = await saveFile(file.value);
    const name = encodeURIComponent(originalName);
    const pointer = `idb:${key}|${name}`;
    // persist via API/store — only patch the logo field
    const res = await store.saveRemote({
      legal: { logo: pointer },
    });
    if (res) {
      notifications.push("Company logo saved", "success", 3000);
    } else {
      notifications.push("Failed to save company logo", "error", 3000);
    }
    // refresh preview from idb
    const url = await getFileObjectUrl(key).catch(() => null);
    previewUrl.value = url || `data:image/svg+xml;utf8,${placeholderSvg}`;
    selectedName.value = originalName;
    // keep track of the saved filename so saving the same file is disabled
    originalLogoName.value = originalName;
    file.value = null;
    // clear native input so same file can be re-selected later
    if (nativeInput.value) nativeInput.value.value = "";
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
  // Only clear the logo field on the legal section
  try {
    const res = await store.saveRemote({
      legal: { logo: "" },
    });
    if (res) notifications.push("Company logo removed", "error", 3000);
    else notifications.push("Failed to remove company logo", "error", 3000);
  } catch (e) {
    notifications.push("Failed to remove company logo", "error", 3000);
  }
  previewUrl.value = `data:image/svg+xml;utf8,${placeholderSvg}`;
  selectedName.value = "";
  originalLogoName.value = "";
  if (nativeInput.value) nativeInput.value.value = "";
}

function resetCompany() {
  company.value = cloneCompany(lastSavedCompany.value);
  updateCitiesForCountry(company.value?.country);
  companyError.value = "";
}

async function saveCompany() {
  // basic validation
  if (!company.value.companyName || !company.value.country) {
    // this is minimal UI feedback — could be replaced with form validation
    companyError.value = "Company Name and Country are required.";
    return;
  }
  companyError.value = "";
  savingCompany.value = true;
  try {
    // Send only the fields managed by this card; server/store merge preserves the rest
    const payload = buildCompanyPayload();
    const res = await store.saveRemote({ legal: payload });
    if (res) {
      const snapshot = pickCompanyFields(res.legal as LegalConfig | null);
      lastSavedCompany.value = cloneCompany(snapshot);
      company.value = cloneCompany(snapshot);
      updateCitiesForCountry(company.value?.country);
      companyError.value = "";
      notifications.push("Company information saved", "success", 3000);
    } else {
      notifications.push("Failed to save company information", "error", 3000);
    }
  } catch (e) {
    notifications.push("Failed to save company information", "error", 3000);
  } finally {
    savingCompany.value = false;
  }
}
</script>

<template>
  <VCard title="Company Logo" class="mb-6">
    <VCardText>
      <VRow>
        <div class="ms-3 mt-1 logo-tip">
          <small>
            Tip: For best results use a logo at least 200×120 px (ideal 400×240
            px). SVG/PNG with a transparent background works best.
          </small>
        </div>
        <VCol cols="12" md="3" class="logo-block">
          <div>
            <img
              :src="previewUrl"
              alt="logo preview"
              class="logo-preview"
              @dblclick="openFileDialog"
            />
            <!-- hidden native input used to open file dialog on dblclick -->
            <input
              ref="nativeInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="onNativeFileChange"
            />
          </div>
        </VCol>

        <VCol cols="12" md="9" class="controls-block">
          <v-file-input
            class="w-100"
            v-model="file"
            accept="image/*"
            label="Upload logo"
            show-size
            @change="onFileChange"
          />

          <div class="ms-8 mt-2 filename-caption" v-if="selectedName">
            <small>Selected file: {{ selectedName }}</small>
          </div>

          <div class="ms-5 mt-2 file-error" v-if="logoFileError">
            <small style="color: #d32f2f">{{ logoFileError }}</small>
          </div>
        </VCol>

        <VCol cols="12">
          <div class="d-flex gap-x-2 mt-4 ms-5 ms-8">
            <template v-if="canRemoveLogo">
              <VBtn color="error" variant="tonal" @click="removeLogo"
                >Remove</VBtn
              >
            </template>
            <template v-else>
              <!-- placeholder when remove not allowed to keep spacing -->
              <div style="inline-size: 96px"></div>
            </template>

            <template v-if="canSaveLogo">
              <VBtn color="primary" @click="saveLogo" :loading="saving"
                >Save Logo</VBtn
              >
            </template>
            <template v-else>
              <!-- placeholder when save not allowed to keep spacing -->
              <div style="inline-size: 96px"></div>
            </template>
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>

  <VCard title="Company Information" class="mb-6">
    <VCardText>
      <VRow>
        <VCol cols="12" md="6">
          <AppTextField
            :rules="[requiredValidator]"
            v-model="company.companyName"
            label="Company Name*"
          />
        </VCol>

        <VCol cols="12" md="6">
          <AppTextField v-model="company.crn" label="CRN" placeholder="CRN" />
        </VCol>

        <VCol cols="12" md="6">
          <VAutocomplete
            v-model="company.country"
            :items="countries"
            item-title="label"
            item-value="label"
            :return-object="false"
            v-model:search="countrySearch"
            label="Country *"
            placeholder="Country"
            @keydown="onCountryKeydown"
            @update:model-value="(val) => updateCitiesForCountry(val)"
          />
        </VCol>

        <VCol cols="12" md="6">
          <VAutocomplete
            v-model="company.city"
            :items="cityOptions"
            :return-object="false"
            v-model:search="citySearch"
            label="City"
            placeholder="City"
            @keydown="onCityKeydown"
          />
        </VCol>

        <VCol cols="12" md="6">
          <AppTextarea
            v-model="company.address"
            label="Address"
            placeholder="Address"
            rows="1"
            auto-grow
          />
        </VCol>

        <VCol cols="12" md="6">
          <AppTextField
            v-model="company.number"
            label="Number"
            placeholder="Number"
          />
        </VCol>

        <VCol cols="12" md="6">
          <AppTextField
            :rules="[emailValidator]"
            v-model="company.email"
            label="Email"
            type="email"
            placeholder="Email"
          />
        </VCol>

        <VCol cols="12" md="6">
          <AppTextField
            :rules="[urlValidator]"
            v-model="company.website"
            label="Website"
            placeholder="Website"
          />
        </VCol>

        <VCol cols="12" md="12" class="mt-5 d-flex justify-end gap-x-4">
          <div class="me-auto" v-if="companyError">
            <small style="color: #d32f2f">{{ companyError }}</small>
          </div>

          <VBtn
            color="error"
            variant="tonal"
            @click="resetCompany"
            :disabled="!canCancelCompany"
          >
            Discard
          </VBtn>
          <VBtn
            color="primary"
            @click="saveCompany"
            :loading="savingCompany"
            :disabled="!canSaveCompany"
          >
            Save
          </VBtn>
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
