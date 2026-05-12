<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import DialogActionBar from "@/components/DialogActionBar.vue";
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

const configStore = useConfigStore();
const contactsStore = useContactsStore();
const dealsStore = useDealsStore();
const employeesStore = useEmployeesStore();
const jobsStore = useJobsStore();

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

const buildEmptyDeal = (): Partial<DealProperties> => ({
  name: "",
  code: null,
  amount: null,
  projectCode: null,
  projectName: null,
  relatedTo: null,
  linkedJobId: null,
  salesman: null,
  type: typeOptions.value[0] || null,
  estimatedDeliveryDate: null,
  stage: stageOptions.value[0] || null,
  important: false,
  location: defaultLocation.value || null,
  collaborators: [],
  note: "",
  customFieldValues: buildDefaultCustomFieldValues(),
});

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
const showDetails = ref(false);

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
    showDetails.value = Boolean(props.deal);
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

const dialogDescription = computed(() =>
  props.deal
    ? "Update the deal information and save your changes."
    : "Capture the key information for a new deal record.",
);

const dialogModelValueUpdate = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

const setCustomFieldValue = (key: string, value: DealFieldValue) => {
  localDeal.value = {
    ...localDeal.value,
    customFieldValues: {
      ...(localDeal.value.customFieldValues || {}),
      [key]: value,
    },
  };
};

const getCustomFieldValue = (key: string) =>
  localDeal.value.customFieldValues?.[key] ?? null;

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

const onCancel = () => {
  localDeal.value = sanitiseDeal(props.deal ?? null);
  showDetails.value = Boolean(props.deal);
  emit("update:isDialogVisible", false);
};

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

  if (linkedJobProjectCodeWarning.value && typeof window !== "undefined") {
    const confirmed = window.confirm(
      `${linkedJobProjectCodeWarning.value} Continue saving this change?`,
    );

    if (!confirmed) return;
  }

  emit("submit", {
    ...localDeal.value,
    customFieldValues: buildDefaultCustomFieldValues(
      localDeal.value.customFieldValues,
    ),
  });
};

const toggleDetails = () => {
  showDetails.value = !showDetails.value;
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
            <VCol cols="12" md="6">
              <AppSelect
                v-model="localDeal.relatedTo"
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
                        <VImg v-if="item.raw.avatar" :src="item.raw.avatar" />
                        <span v-else class="text-caption font-weight-bold">
                          {{ avatarText(item.raw.title) }}
                        </span>
                      </VAvatar>
                    </template>
                  </VListItem>
                </template>
              </AppSelect>
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
              <AppSelect
                v-model="localDeal.stage"
                label="Stage"
                placeholder="Select Stage"
                :items="stageOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppTextField
                v-model="localDeal.location"
                label="Location"
                placeholder="City, Country"
              />
            </VCol>

            <VCol cols="12" md="6">
              <div
                class="deal-important-spacer mb-1 text-body-2"
                aria-hidden="true"
              >
                Important
              </div>

              <AppTextField
                model-value=""
                placeholder="Important"
                persistent-placeholder
                readonly
                class="deal-important-input"
                @click="localDeal.important = !localDeal.important"
              >
                <template #append-inner>
                  <VBtn
                    class="deal-important-trigger"
                    :color="localDeal.important ? 'warning' : 'secondary'"
                    variant="text"
                    icon
                    @click.stop="localDeal.important = !localDeal.important"
                  >
                    <VIcon
                      :icon="
                        localDeal.important
                          ? 'tabler-star-filled'
                          : 'tabler-star'
                      "
                      size="20"
                    />
                  </VBtn>
                </template>
              </AppTextField>
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="localDeal.note"
                label="Note"
                placeholder="Short note"
                auto-grow
                rows="1"
              />
            </VCol>

            <VCol cols="12" class="detail-toggle-col">
              <button
                type="button"
                class="detail-toggle-line"
                :aria-label="
                  showDetails ? 'Hide extra details' : 'Show more details'
                "
                @click="toggleDetails"
              >
                <span class="detail-toggle-line__track" />
                <span class="detail-toggle-line__icon">
                  <VIcon
                    :icon="showDetails ? 'tabler-minus' : 'tabler-plus'"
                    size="16"
                  />
                </span>
              </button>
            </VCol>

            <template v-if="showDetails">
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
                          item.raw.avatar
                            ? null
                            : 'text-white font-weight-medium'
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

              <template
                v-for="field in customFieldDefinitions"
                :key="field.key"
              >
                <VCol cols="12" md="6">
                  <AppTextField
                    v-if="field.type === 'text'"
                    :model-value="String(getCustomFieldValue(field.key) ?? '')"
                    :label="field.label"
                    @update:model-value="
                      setCustomFieldValue(field.key, String($event ?? ''))
                    "
                  />

                  <AppTextField
                    v-else-if="field.type === 'number'"
                    :model-value="getCustomFieldValue(field.key)"
                    :label="field.label"
                    type="number"
                    @update:model-value="
                      setCustomFieldValue(
                        field.key,
                        $event === '' ? null : Number($event),
                      )
                    "
                  />

                  <AppDateTimePicker
                    v-else-if="field.type === 'date'"
                    :model-value="String(getCustomFieldValue(field.key) ?? '')"
                    :label="field.label"
                    clearable
                    @update:model-value="
                      setCustomFieldValue(
                        field.key,
                        $event ? String($event) : null,
                      )
                    "
                  />

                  <AppSelect
                    v-else-if="field.type === 'select'"
                    :model-value="getCustomFieldValue(field.key)"
                    :label="field.label"
                    :items="field.options || []"
                    clearable
                    clear-icon="tabler-x"
                    @update:model-value="
                      setCustomFieldValue(
                        field.key,
                        $event ? String($event) : null,
                      )
                    "
                  />

                  <div
                    v-else-if="field.type === 'boolean'"
                    class="d-flex align-center justify-space-between rounded border pa-3 deal-custom-boolean"
                  >
                    <div class="text-body-1 font-weight-medium">
                      {{ field.label }}
                    </div>

                    <VSwitch
                      :model-value="Boolean(getCustomFieldValue(field.key))"
                      inset
                      hide-details
                      density="compact"
                      class="ma-0"
                      @update:model-value="
                        setCustomFieldValue(field.key, Boolean($event))
                      "
                    />
                  </div>

                  <AppTextarea
                    v-else
                    :model-value="String(getCustomFieldValue(field.key) ?? '')"
                    :label="field.label"
                    auto-grow
                    rows="2"
                    @update:model-value="
                      setCustomFieldValue(field.key, String($event ?? ''))
                    "
                  />
                </VCol>
              </template>
            </template>

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
</template>

<style scoped>
.deal-important-spacer {
  line-height: 19px;
  visibility: hidden;
}

.deal-important-trigger {
  padding: 0 !important;
  block-size: 24px !important;
  inline-size: 24px !important;
  min-inline-size: 24px !important;
}

.deal-important-input :deep(input) {
  color: transparent;
  cursor: pointer;
  user-select: none;
}

.deal-important-input {
  cursor: pointer;
}

.deal-form-grid {
  row-gap: 0.25rem;
}

.deal-form-grid > .v-col {
  padding-block: 0.5rem;
}

.detail-toggle-col {
  padding-block-start: 0.25rem;
}

.deal-custom-boolean {
  min-block-size: 56px;
}

.detail-toggle-line {
  display: flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  gap: 0.75rem;
  inline-size: 100%;
}

.detail-toggle-line__track {
  flex: 1 1 auto;
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 58%, transparent);
  block-size: 1px;
}

.detail-toggle-line__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid
    color-mix(in srgb, rgb(var(--v-theme-primary)) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
  block-size: 28px;
  inline-size: 28px;
}

.detail-toggle-line:hover .detail-toggle-line__track,
.detail-toggle-line:hover .detail-toggle-line__icon {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 18%, transparent);
}

.detail-toggle-line:hover .detail-toggle-line__track {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 82%, transparent);
}
</style>
