<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { ContactProperties } from "@/plugins/fake-api/handlers/apps/contact/types";
import type { DealCustomFieldDefinition } from "@/plugins/fake-api/handlers/config/types";
import type {
  DealFieldValue,
  DealProperties,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useConfigStore } from "@/stores/config";
import { useContactsStore } from "@/stores/contacts";
import { useDealsStore } from "@/stores/deals";
import { useEmployeesStore } from "@/stores/employees";
import { useJobsStore } from "@/stores/jobs";
import { useNotificationsStore } from "@/stores/notifications";
import AddNewUserDialog from "@/views/apps/contact/list/AddNewUserDialog.vue";
import { City, Country } from "country-state-city";
import { computed, nextTick, ref, toRaw, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";

interface Props {
  deal?: DealProperties | null;
  error?: string | null;
  isDialogVisible: boolean;
  loading?: boolean;
}

interface Emit {
  (e: "submit", value: Partial<DealProperties>): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  deal: null,
  error: null,
  loading: false,
});

const emit = defineEmits<Emit>();

const refForm = ref<VForm>();
const isFormValid = ref(false);
const isAddContactDialogVisible = ref(false);
const locationCountrySearch = ref("");
const locationCitySearch = ref("");
const selectedLocationCountry = ref("");
const selectedLocationCity = ref("");
const locationCityOptions = ref<string[]>([]);
const userData = useCookie<any>("userData");
const isProjectCodeConfirmDialogVisible = ref(false);
const pendingSubmitPayload = ref<Partial<DealProperties> | null>(null);

const configStore = useConfigStore();
const contactsStore = useContactsStore();
const dealsStore = useDealsStore();
const employeesStore = useEmployeesStore();
const jobsStore = useJobsStore();
const notificationsStore = useNotificationsStore();

configStore.init();
contactsStore.init();
dealsStore.init();
employeesStore.init();
jobsStore.init();

const stageOptions = computed(
  () => configStore.configurations?.deals?.dealStages || [],
);
const typeOptions = computed(
  () => configStore.configurations?.deals?.salesType || [],
);
const typeLabel = computed(
  () =>
    String(
      configStore.configurations?.deals?.fieldLabels?.type ?? "Type",
    ).trim() || "Type",
);

const defaultLocation = computed(() => {
  const city = String(configStore.configurations?.legal?.city ?? "").trim();
  const country = String(
    configStore.configurations?.legal?.country ?? "",
  ).trim();

  return [city, country].filter(Boolean).join(", ");
});

const locationCountryOptions = (Country.getAllCountries() ?? [])
  .map((country: any) => ({
    code: String(country.isoCode ?? ""),
    label: String(country.name ?? ""),
  }))
  .filter((country) => country.code && country.label)
  .sort((left, right) => left.label.localeCompare(right.label));

const findCountryOption = (countryKey?: string | null) => {
  const key = String(countryKey ?? "").trim().toLowerCase();
  if (!key) return null;

  return (
    locationCountryOptions.find(
      (country) => country.code.toLowerCase() === key,
    ) ||
    locationCountryOptions.find(
      (country) => country.label.toLowerCase() === key,
    ) ||
    null
  );
};

const composeLocation = () =>
  [selectedLocationCity.value, selectedLocationCountry.value]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");

const updateLocationCitiesForCountry = (countryKey?: string | null) => {
  const matched = findCountryOption(countryKey);
  if (!matched) {
    locationCityOptions.value = [];
    return;
  }

  try {
    const uniqueCities = new Map<string, string>();

    (City.getCitiesOfCountry(matched.code) || [])
      .map((city: any) => String(city.name ?? "").trim())
      .filter(Boolean)
      .forEach((city) => {
        const key = city.toLowerCase();
        if (!uniqueCities.has(key)) uniqueCities.set(key, city);
      });

    locationCityOptions.value = [...uniqueCities.values()].sort((left, right) =>
      left.localeCompare(right),
    );
  } catch {
    locationCityOptions.value = [];
  }

  const city = selectedLocationCity.value.trim();
  if (
    city &&
    !locationCityOptions.value.some(
      (option) => option.toLowerCase() === city.toLowerCase(),
    )
  ) {
    locationCityOptions.value = [city, ...locationCityOptions.value];
  }
};

const setLocationFromDeal = (location?: string | null) => {
  const parts = String(location ?? defaultLocation.value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const possibleCountry = parts.length > 1 ? parts.at(-1) : "";
  const matchedCountry = findCountryOption(possibleCountry);

  selectedLocationCountry.value = matchedCountry?.label ?? possibleCountry ?? "";
  selectedLocationCity.value = parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] ?? "";
  locationCountrySearch.value = selectedLocationCountry.value;
  locationCitySearch.value = selectedLocationCity.value;
  updateLocationCitiesForCountry(selectedLocationCountry.value);
  localDeal.value.location = composeLocation() || null;
};

const onLocationCountryKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Tab") return;

  const query = locationCountrySearch.value.trim().toLowerCase();
  if (!query) return;

  const match = locationCountryOptions.find(
    (country) =>
      country.label.toLowerCase().startsWith(query) ||
      country.label.toLowerCase().includes(query),
  );

  if (!match) return;

  selectedLocationCountry.value = match.label;
  locationCountrySearch.value = match.label;
};

const onLocationCityKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Tab") return;

  const query = locationCitySearch.value.trim().toLowerCase();
  if (!query) return;

  const match = locationCityOptions.value.find(
    (city) =>
      city.toLowerCase().startsWith(query) || city.toLowerCase().includes(query),
  );

  if (!match) return;

  selectedLocationCity.value = match;
  locationCitySearch.value = match;
};

const locationCountryFilter = (_value: unknown, query: string, item: any) => {
  const safeQuery = String(query ?? "").trim().toLowerCase();
  if (!safeQuery) return true;

  const label = String(item?.raw?.label ?? "").toLowerCase();
  const code = String(item?.raw?.code ?? "").toLowerCase();

  return label.includes(safeQuery) || code.includes(safeQuery);
};

const customFieldDefinitions = computed<DealCustomFieldDefinition[]>(() => {
  const configured = configStore.configurations?.deals?.customFields;
  if (Array.isArray(configured) && configured.length) return configured;

  const labels = configStore.configurations?.deals?.fieldLabels || {};

  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    type: "text",
  }));
});

const contactOptions = computed(() =>
  contactsStore.all.map((contact) => ({
    title: contact.fullName,
    value: contact.id,
    avatar: contact.picture || null,
  })),
);

const salesmanOptions = computed(() =>
  [
    ...contactsStore.all
      .filter((contact) => contact.worksInSales)
      .map((contact) => ({
        title: contact.fullName,
        value: `contact:${contact.id}`,
        avatar: contact.picture || null,
      })),
    ...employeesStore.all
      .filter((employee) => employee.employment?.isSalesTeamMember)
      .map((employee) => ({
        title: employee.fullName,
        value: employee.id,
        avatar: employee.picture || null,
      })),
  ].sort((left, right) => left.title.localeCompare(right.title)),
);

const allCollaboratorOptions = computed(() =>
  [
    ...contactsStore.all.map((contact) => ({
      title: contact.fullName,
      value: `contact:${contact.id}`,
      avatar: contact.picture || null,
    })),
    ...employeesStore.all.map((employee) => ({
      title: employee.fullName,
      value: employee.id,
      avatar: employee.picture || null,
    })),
  ].sort((left, right) => left.title.localeCompare(right.title)),
);

const currentUserDisplayName = computed(() =>
  String(
    userData.value?.fullName ||
      userData.value?.username ||
      userData.value?.email ||
      "",
  )
    .trim()
    .toLowerCase(),
);

const defaultCreatorValue = computed(() => {
  const displayName = currentUserDisplayName.value;
  const matchSalesman = salesmanOptions.value.find(
    (option) => option.title.trim().toLowerCase() === displayName,
  );
  if (matchSalesman) return matchSalesman.value;

  const matchCollaborator = allCollaboratorOptions.value.find(
    (option) => option.title.trim().toLowerCase() === displayName,
  );
  if (matchCollaborator) return matchCollaborator.value;

  return (
    salesmanOptions.value[0]?.value ?? allCollaboratorOptions.value[0]?.value ?? null
  );
});

const selectedSalesman = computed({
  get: () => localDeal.value.salesman ?? null,
  set: (value: number | string | null) => {
    localDeal.value.salesman =
      value === null || value === undefined || value === "" ? null : value;
  },
});

const selectedContact = computed(() => {
  const contactId = Number(localDeal.value.relatedTo ?? NaN);
  if (!Number.isFinite(contactId)) return null;

  return contactsStore.byId(contactId) ?? null;
});

const onAddContactSubmit = (payload: Partial<ContactProperties>) => {
  const created = contactsStore.addContact({
    ...payload,
    class: "Lead",
  });

  localDeal.value.relatedTo = created.id;
  isAddContactDialogVisible.value = false;
  notificationsStore.push("Lead contact created", "success", 3000);
};

const buildInitials = (value?: string | null) => {
  const safe = String(value ?? "").trim();
  if (!safe) return "";

  return safe
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
};

const buildGeneratedProjectCode = () => {
  const contactCode = buildInitials(selectedContact.value?.fullName);
  const typeCode = buildInitials(localDeal.value.type);
  const parts = [contactCode, typeCode].filter(Boolean);

  return parts.length ? parts.join("-") : null;
};

const selectedLinkedJob = computed(() => {
  const linkedJobId = Number(localDeal.value.linkedJobId ?? NaN);
  if (!Number.isFinite(linkedJobId)) return null;

  return jobsStore.byId(linkedJobId) ?? null;
});

const linkedJobOptions = computed(() => {
  const contactId = Number(localDeal.value.relatedTo ?? NaN);
  if (!Number.isFinite(contactId)) return [];

  const currentDealId = props.deal?.id ?? null;
  const reservedJobIds = new Set(
    dealsStore.all
      .filter((deal) => {
        if (currentDealId !== null && String(deal.id) === String(currentDealId))
          return false;

        return Number(deal.relatedTo) === contactId && deal.linkedJobId;
      })
      .map((deal) => Number(deal.linkedJobId))
      .filter(Number.isFinite),
  );

  return jobsStore.all
    .filter((job) => Number(job.relatedTo) === contactId)
    .filter(
      (job) =>
        !reservedJobIds.has(Number(job.id)) ||
        Number(localDeal.value.linkedJobId) === Number(job.id),
    )
    .map((job) => ({
      title: job.code?.trim() ? `${job.code} - ${job.name}` : job.name,
      value: job.id,
      subtitle: job.location || null,
    }));
});

const lastAutoProjectCode = ref<string | null>(null);

const avatarText = (name?: string | null) => {
  const safe = (name || "").trim();
  if (!safe) return "??";

  return safe
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getDefaultFieldValue = (
  field: DealCustomFieldDefinition,
): DealFieldValue => {
  if (field.defaultValue !== undefined) return field.defaultValue;

  if (field.type === "boolean") return false;

  if (field.type === "number") return null;

  return "";
};

const buildDefaultCustomFieldValues = (
  current?: Record<string, DealFieldValue> | null,
) => {
  const nextValues: Record<string, DealFieldValue> = {};

  customFieldDefinitions.value.forEach((field) => {
    nextValues[field.key] = current?.[field.key] ?? getDefaultFieldValue(field);
  });

  return nextValues;
};

const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const buildEmptyDeal = (): Partial<DealProperties> => {
  const creator = defaultCreatorValue.value;

  return {
    name: "",
    code: null,
    amount: null,
    projectCode: null,
    projectName: null,
    relatedTo: null,
    linkedJobId: null,
    salesman: creator,
    type: typeOptions.value[0] || null,
    estimatedDeliveryDate: getTodayDateValue(),
    stage: stageOptions.value[0] || null,
    important: false,
    location: defaultLocation.value || null,
    collaborators: creator ? [creator] : [],
    note: "",
    customFieldValues: buildDefaultCustomFieldValues(),
  };
};

const sanitiseDeal = (deal: DealProperties | null): Partial<DealProperties> => {
  if (!deal) return buildEmptyDeal();

  const raw = toRaw(deal) as DealProperties;

  return {
    ...raw,
    name: raw.name || "",
    amount: raw.amount ?? null,
    collaborators: Array.isArray(raw.collaborators)
      ? [...raw.collaborators]
      : [],
    projectCode: raw.projectCode || null,
    projectName: raw.projectName || null,
    linkedJobId: raw.linkedJobId ?? null,
    salesman: raw.salesman ?? raw.collaborators?.[0] ?? null,
    location: raw.location || defaultLocation.value || null,
    customFieldValues: buildDefaultCustomFieldValues(raw.customFieldValues),
  };
};

const localDeal = ref<Partial<DealProperties>>(buildEmptyDeal());

const hasLinkedJob = computed(() => {
  const linkedJobId = Number(localDeal.value.linkedJobId ?? NaN);

  return Number.isFinite(linkedJobId);
});

const hasProjectCodeChanged = computed(() => {
  if (!props.deal) return false;

  const originalProjectCode = String(props.deal.projectCode ?? "").trim();
  const currentProjectCode = String(localDeal.value.projectCode ?? "").trim();

  return currentProjectCode !== originalProjectCode;
});

const linkedJobProjectCodeWarning = computed(() => {
  if (!hasLinkedJob.value || !hasProjectCodeChanged.value) return null;

  const linkedJobCode = String(selectedLinkedJob.value?.code ?? "").trim();

  return linkedJobCode
    ? `This deal is linked to job ${linkedJobCode}. Changing the deal project code will not update the linked job code automatically.`
    : "This deal is linked to a job. Changing the deal project code will not update the linked job code automatically.";
});

watch(
  () =>
    [props.isDialogVisible, props.deal, customFieldDefinitions.value] as const,
  ([visible]) => {
    if (!visible) return;

    localDeal.value = sanitiseDeal(props.deal ?? null);
    setLocationFromDeal(localDeal.value.location);
    lastAutoProjectCode.value =
      localDeal.value.projectCode ===
      (selectedLinkedJob.value?.code?.trim() || buildGeneratedProjectCode())
        ? (localDeal.value.projectCode ?? null)
        : null;

    nextTick(() => {
      refForm.value?.resetValidation();
    });
  },
  { deep: true },
);

const dialogTitle = computed(() => (props.deal ? "Edit Deal" : "Add New Deal"));
const isEditingDeal = computed(() => Boolean(props.deal));

const dialogDescription = computed(() =>
  props.deal
    ? "Update the deal information and save your changes."
    : "Capture the key information for a new deal record.",
);

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

const syncProjectCode = () => {
  const autoCode =
    selectedLinkedJob.value?.code?.trim() || buildGeneratedProjectCode();
  const currentCode = String(localDeal.value.projectCode ?? "").trim() || null;
  const previousAutoCode = lastAutoProjectCode.value;

  if (!currentCode || currentCode === previousAutoCode) {
    localDeal.value.projectCode = autoCode;
  }

  lastAutoProjectCode.value = autoCode;
};

watch(
  () => [
    localDeal.value.relatedTo,
    localDeal.value.type,
    localDeal.value.linkedJobId,
  ],
  ([nextRelatedTo]) => {
    const hasLinkedJob = linkedJobOptions.value.some(
      (job) => String(job.value) === String(localDeal.value.linkedJobId),
    );

    if (!hasLinkedJob) {
      localDeal.value.linkedJobId = null;
    }

    if (!nextRelatedTo) {
      localDeal.value.linkedJobId = null;
    }

    syncProjectCode();
  },
);

watch(selectedLocationCountry, (country) => {
  const matched = findCountryOption(country);
  const normalizedCountry = matched?.label ?? String(country ?? "").trim();

  if (normalizedCountry !== selectedLocationCountry.value) {
    selectedLocationCountry.value = normalizedCountry;
    return;
  }

  updateLocationCitiesForCountry(normalizedCountry);
  localDeal.value.location = composeLocation() || null;
});

watch(selectedLocationCity, () => {
  localDeal.value.location = composeLocation() || null;
});

const onCancel = () => {
  localDeal.value = sanitiseDeal(props.deal ?? null);
  setLocationFromDeal(localDeal.value.location);
  emit("update:isDialogVisible", false);
};

const buildSubmitPayload = (): Partial<DealProperties> => ({
  ...localDeal.value,
  location: composeLocation() || null,
  customFieldValues: buildDefaultCustomFieldValues(
    localDeal.value.customFieldValues,
  ),
});

const closeProjectCodeConfirmDialog = () => {
  isProjectCodeConfirmDialogVisible.value = false;
  pendingSubmitPayload.value = null;
};

const confirmProjectCodeSubmit = () => {
  if (!pendingSubmitPayload.value) return;

  emit("submit", pendingSubmitPayload.value);
  closeProjectCodeConfirmDialog();
};

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  const payload = buildSubmitPayload();

  if (linkedJobProjectCodeWarning.value) {
    pendingSubmitPayload.value = payload;
    isProjectCodeConfirmDialogVisible.value = true;

    return;
  }

  emit("submit", payload);
};
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 760"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText>
        <h4 class="text-h5 text-center mb-2">
          {{ dialogTitle }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          {{ dialogDescription }}
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

        <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
          <VRow class="deal-form-grid">
            <VCol cols="12">
              <div class="deal-top-field-pair">
                <div class="contact-select-row">
                  <AppSelect
                    v-model="localDeal.relatedTo"
                    class="contact-select"
                    label="Contact Name"
                    placeholder="Select contact"
                    :items="contactOptions"
                    item-title="title"
                    item-value="value"
                    :rules="[requiredValidator]"
                    clearable
                    clear-icon="tabler-x"
                  >
                    <template #item="{ item, props: itemProps }">
                      <VListItem v-bind="itemProps">
                        <template #prepend>
                          <VAvatar
                            size="28"
                            :color="item.raw.avatar ? undefined : 'primary'"
                            :class="
                              item.raw.avatar
                                ? null
                                : 'text-white font-weight-medium'
                            "
                          >
                            <VImg
                              v-if="item.raw.avatar"
                              :src="item.raw.avatar"
                            />
                            <span v-else class="text-caption font-weight-bold">
                              {{ avatarText(item.raw.title) }}
                            </span>
                          </VAvatar>
                        </template>
                      </VListItem>
                    </template>
                  </AppSelect>

                  <VBtn
                    icon
                    variant="tonal"
                    color="primary"
                    class="contact-add-btn"
                    @click="isAddContactDialogVisible = true"
                  >
                    <VIcon icon="tabler-plus" />
                    <VTooltip activator="parent" location="top">
                      Add New Contact
                    </VTooltip>
                  </VBtn>
                </div>

                <AppDateTimePicker
                  v-model="localDeal.estimatedDeliveryDate"
                  label="Date"
                  :config="{
                    altInput: true,
                    altFormat: 'd/M/y',
                    dateFormat: 'Y-m-d',
                  }"
                  clearable
                />
              </div>
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localDeal.type"
                :label="typeLabel"
                placeholder="Select type"
                :items="typeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localDeal.stage"
                label="Stage"
                placeholder="Select Stage"
                :items="stageOptions"
                :rules="[requiredValidator]"
                :disabled="!isEditingDeal"
              />

              <div
                v-if="!isEditingDeal"
                class="text-caption text-medium-emphasis mt-2"
              >
                New deals always start in Pre-Sale. You can change the stage
                after creation.
              </div>
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="selectedSalesman"
                label="Salesman"
                placeholder="Select salesman"
                :items="salesmanOptions"
                item-title="title"
                item-value="value"
                clearable
                clear-icon="tabler-x"
                :messages="
                  salesmanOptions.length
                    ? undefined
                    : 'No sales contacts or employees are available.'
                "
              >
                <template #selection="{ item }">
                  <div class="d-flex align-center gap-2 py-1">
                    <VAvatar
                      size="22"
                      :color="item.raw.avatar ? undefined : 'primary'"
                      :class="
                        item.raw.avatar ? null : 'text-white font-weight-medium'
                      "
                    >
                      <VImg v-if="item.raw.avatar" :src="item.raw.avatar" />
                      <span v-else class="text-xxs font-weight-bold">
                        {{ avatarText(item.raw.title) }}
                      </span>
                    </VAvatar>
                    <span class="text-truncate">{{ item.raw.title }}</span>
                  </div>
                </template>
              </AppSelect>
            </VCol>

            <VCol cols="12" md="6">
              <div class="location-field-pair">
                <AppAutocomplete
                  v-model="selectedLocationCountry"
                  v-model:search="locationCountrySearch"
                  label="Country"
                  placeholder="Select country"
                  :items="locationCountryOptions"
                  item-title="label"
                  item-value="label"
                  clearable
                  clear-icon="tabler-x"
                  :custom-filter="locationCountryFilter"
                  @keydown="onLocationCountryKeydown"
                />

                <AppAutocomplete
                  v-model="selectedLocationCity"
                  v-model:search="locationCitySearch"
                  label="City"
                  placeholder="Select city"
                  :items="locationCityOptions"
                  clearable
                  clear-icon="tabler-x"
                  :disabled="!selectedLocationCountry"
                  @keydown="onLocationCityKeydown"
                />
              </div>
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localDeal.projectCode"
                label="Project Code"
                placeholder="Generated from linked job or contact and type"
              />

              <VAlert
                v-if="linkedJobProjectCodeWarning"
                type="warning"
                variant="tonal"
                density="comfortable"
                class="mt-3"
              >
                {{ linkedJobProjectCodeWarning }}
              </VAlert>
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localDeal.linkedJobId"
                label="Linked To"
                placeholder="Select job"
                :items="linkedJobOptions"
                item-title="title"
                item-value="value"
                clearable
                clear-icon="tabler-x"
                :disabled="!localDeal.relatedTo"
                :messages="
                  localDeal.relatedTo && !linkedJobOptions.length
                    ? 'No available jobs for this contact.'
                    : undefined
                "
              />
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="localDeal.note"
                auto-grow
                rows="2"
                label="Note"
                placeholder="Short note"
              />
            </VCol>

            <VCol cols="12">
              <AppSelect
                v-model="localDeal.collaborators"
                label="Collaborators"
                placeholder="Select collaborators"
                :items="allCollaboratorOptions"
                item-title="title"
                item-value="value"
                multiple
                chips
                clearable
                clear-icon="tabler-x"
              >
                <template #selection="{ item, index }">
                  <VChip
                    v-if="index < 3"
                    class="me-1 mb-1"
                    size="small"
                    variant="elevated"
                  >
                    <VAvatar
                      size="20"
                      start
                      class="me-2"
                      :color="item.raw.avatar ? undefined : 'primary'"
                      :class="
                        item.raw.avatar ? null : 'text-white font-weight-medium'
                      "
                    >
                      <VImg v-if="item.raw.avatar" :src="item.raw.avatar" />
                      <span v-else class="text-xxs font-weight-bold">
                        {{ avatarText(item.raw.title) }}
                      </span>
                    </VAvatar>
                    <span class="text-truncate">{{ item.raw.title }}</span>
                  </VChip>

                  <span
                    v-else-if="index === 3"
                    class="text-caption text-medium-emphasis"
                  >
                    +{{ (localDeal.collaborators?.length || 0) - index }}
                  </span>
                </template>
              </AppSelect>
            </VCol>

            <VCol cols="12" class="mt-4">
              <DialogActionBar
                save-type="submit"
                :save-loading="loading"
                @save="() => undefined"
                @cancel="onCancel"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <AddNewUserDialog
    v-model:is-dialog-visible="isAddContactDialogVisible"
    @submit="onAddContactSubmit"
  />

  <VDialog v-model="isProjectCodeConfirmDialogVisible" max-width="480" persistent>
    <DialogCloseBtn @click="closeProjectCodeConfirmDialog" />
    <VCard>
      <VCardItem>
        <VCardTitle>Confirm project code change</VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <div class="text-sm text-medium-emphasis">
          {{ linkedJobProjectCodeWarning }} Continue saving this change?
        </div>
      </VCardText>

      <VCardActions class="pt-2 px-6 pb-6">
        <DialogActionBar
          save-text="Continue"
          cancel-text="Cancel"
          @save="confirmProjectCodeSubmit"
          @cancel="closeProjectCodeConfirmDialog"
        />
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.deal-form-grid {
  row-gap: 0.25rem;
}

.deal-form-grid > .v-col {
  padding-block: 0.5rem;
}

.deal-top-field-pair {
  display: grid;
  align-items: start;
  gap: 1.25rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.contact-select-row {
  display: grid;
  align-items: end;
  gap: 0.5rem;
  grid-template-columns: minmax(0, 1fr) 40px;
}

.contact-select {
  min-inline-size: 0;
}

.contact-add-btn {
  padding: 0 !important;
  border-radius: 10px !important;
  block-size: 40px !important;
  inline-size: 40px !important;
  min-inline-size: 40px !important;
}

.location-field-pair {
  display: grid;
  align-items: start;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 599.98px) {
  .deal-top-field-pair {
    grid-template-columns: 1fr;
  }

  .location-field-pair {
    grid-template-columns: 1fr;
  }
}
</style>
