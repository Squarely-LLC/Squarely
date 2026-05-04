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
import { useEmployeesStore } from "@/stores/employees";
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
const employeesStore = useEmployeesStore();

configStore.init();
contactsStore.init();
employeesStore.init();

const stageOptions = computed(
  () => configStore.configurations?.deals?.dealStages || [],
);
const typeOptions = computed(
  () => configStore.configurations?.deals?.salesType || [],
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

const collaboratorOptions = computed(() =>
  employeesStore.all.map((employee) => ({
    title: employee.fullName,
    value: employee.id,
    avatar: employee.picture || null,
  })),
);

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
    location: raw.location || defaultLocation.value || null,
    customFieldValues: buildDefaultCustomFieldValues(raw.customFieldValues),
  };
};

const localDeal = ref<Partial<DealProperties>>(buildEmptyDeal());
const showDetails = ref(false);

const primaryCustomField = computed<DealCustomFieldDefinition | null>(() => {
  const occasionField = customFieldDefinitions.value.find((field) =>
    `${field.key} ${field.label}`.match(/occation|occasion/i),
  );

  return occasionField || null;
});

const remainingCustomFields = computed(() => {
  if (!primaryCustomField.value) return customFieldDefinitions.value;

  return customFieldDefinitions.value.filter(
    (field) => field.key !== primaryCustomField.value?.key,
  );
});

watch(
  () =>
    [props.isDialogVisible, props.deal, customFieldDefinitions.value] as const,
  ([visible]) => {
    if (!visible) return;

    localDeal.value = sanitiseDeal(props.deal ?? null);
    showDetails.value = Boolean(props.deal);

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

const onCancel = () => {
  localDeal.value = sanitiseDeal(props.deal ?? null);
  showDetails.value = Boolean(props.deal);
  emit("update:isDialogVisible", false);
};

const onSubmit = async () => {
  const { valid } = (await refForm.value?.validate()) ?? { valid: true };
  if (!valid) return;

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
              <AppTextField
                v-model="localDeal.name"
                label="Name"
                placeholder="Enter deal name"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="localDeal.estimatedDeliveryDate"
                label="Delivery Date"
                placeholder="YYYY-MM-DD"
                clearable
              />
            </VCol>

            <VCol cols="12" md="6">
              <AppSelect
                v-model="localDeal.collaborators"
                label="Salesmen"
                placeholder="Select salesmen"
                :items="collaboratorOptions"
                item-title="title"
                item-value="value"
                multiple
                chips
                clearable
                clear-icon="tabler-x"
              >
                <template #selection="{ item, index }">
                  <VChip
                    v-if="index < 4"
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
                    v-else-if="index === 4"
                    class="text-caption text-medium-emphasis"
                  >
                    +{{ (localDeal.collaborators?.length || 0) - index }}
                  </span>
                </template>
              </AppSelect>
            </VCol>

            <VCol cols="12" md="3">
              <AppTextField
                :model-value="localDeal.amount ?? ''"
                label="Amount"
                placeholder="Enter amount"
                type="number"
                @update:model-value="
                  localDeal.amount =
                    $event === '' || $event === null ? null : Number($event)
                "
              />
            </VCol>

            <VCol cols="12" md="3">
              <AppSelect
                v-model="localDeal.stage"
                label="Stage"
                placeholder="Select Stage"
                :items="stageOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <VCol cols="12" class="detail-toggle-col" v-if="!showDetails">
              <VBtn block variant="tonal" @click="toggleDetails">
                Show More Details
              </VBtn>
            </VCol>

            <template v-if="showDetails">
              <VCol cols="12" class="sketch-separator">
                <VDivider />
              </VCol>

              <VCol v-if="primaryCustomField" cols="12" md="6">
                <AppTextField
                  v-if="primaryCustomField?.type === 'text'"
                  :model-value="
                    String(getCustomFieldValue(primaryCustomField.key) ?? '')
                  "
                  :label="primaryCustomField.label"
                  @update:model-value="
                    setCustomFieldValue(
                      primaryCustomField.key,
                      String($event ?? ''),
                    )
                  "
                />

                <AppTextField
                  v-else-if="primaryCustomField?.type === 'number'"
                  :model-value="getCustomFieldValue(primaryCustomField.key)"
                  :label="primaryCustomField.label"
                  type="number"
                  @update:model-value="
                    setCustomFieldValue(
                      primaryCustomField.key,
                      $event === '' ? null : Number($event),
                    )
                  "
                />

                <AppDateTimePicker
                  v-else-if="primaryCustomField?.type === 'date'"
                  :model-value="
                    String(getCustomFieldValue(primaryCustomField.key) ?? '')
                  "
                  :label="primaryCustomField.label"
                  clearable
                  @update:model-value="
                    setCustomFieldValue(
                      primaryCustomField.key,
                      $event ? String($event) : null,
                    )
                  "
                />

                <AppSelect
                  v-else-if="primaryCustomField?.type === 'select'"
                  :model-value="getCustomFieldValue(primaryCustomField.key)"
                  :label="primaryCustomField.label"
                  :items="primaryCustomField.options || []"
                  clearable
                  clear-icon="tabler-x"
                  @update:model-value="
                    setCustomFieldValue(
                      primaryCustomField.key,
                      $event ? String($event) : null,
                    )
                  "
                />

                <div
                  v-else-if="primaryCustomField?.type === 'boolean'"
                  class="d-flex align-center justify-space-between rounded border pa-3"
                >
                  <div class="text-body-1 font-weight-medium">
                    {{ primaryCustomField.label }}
                  </div>

                  <VSwitch
                    :model-value="
                      Boolean(getCustomFieldValue(primaryCustomField.key))
                    "
                    inset
                    hide-details
                    density="compact"
                    class="ma-0"
                    @update:model-value="
                      setCustomFieldValue(
                        primaryCustomField.key,
                        Boolean($event),
                      )
                    "
                  />
                </div>

                <AppTextarea
                  v-else-if="primaryCustomField"
                  :model-value="
                    String(getCustomFieldValue(primaryCustomField.key) ?? '')
                  "
                  :label="primaryCustomField.label"
                  auto-grow
                  rows="2"
                  @update:model-value="
                    setCustomFieldValue(
                      primaryCustomField.key,
                      String($event ?? ''),
                    )
                  "
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppSelect
                  v-model="localDeal.relatedTo"
                  label="Linked to"
                  placeholder="Select Contact"
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
                <AppTextField
                  v-model="localDeal.projectName"
                  label="Project Name"
                  placeholder="Enter project name"
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
                <AppTextField
                  v-model="localDeal.projectCode"
                  label="Project Code"
                  placeholder="Enter project code"
                />
              </VCol>

              <VCol cols="12" class="sketch-separator">
                <VDivider />
              </VCol>

              <VCol cols="12" md="6">
                <AppSelect
                  v-model="localDeal.type"
                  label="Type"
                  placeholder="Select Type"
                  :items="typeOptions"
                  :rules="[requiredValidator]"
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

              <VCol
                cols="12"
                class="sketch-separator"
                v-if="remainingCustomFields.length"
              >
                <VDivider />
              </VCol>

              <template v-for="field in remainingCustomFields" :key="field.key">
                <VCol cols="12" md="6" class="additional-field-col">
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
                    class="d-flex align-center justify-space-between rounded border pa-3"
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

              <VCol cols="12" class="sketch-separator">
                <VDivider />
              </VCol>

              <VCol cols="12">
                <AppTextarea
                  v-model="localDeal.note"
                  label="Notes"
                  placeholder="Short note"
                  auto-grow
                  rows="1"
                />
              </VCol>
            </template>

            <VCol cols="12" class="detail-toggle-col" v-if="showDetails">
              <VBtn block variant="text" @click="toggleDetails">
                Hide Extra Details
              </VBtn>
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

.sketch-separator {
  padding-block: 0;
}

.deal-form-grid {
  row-gap: 0.25rem;
}

.deal-form-grid > .v-col {
  padding-block: 0.5rem;
}

.deal-form-grid :deep(.v-divider) {
  opacity: 0.52;
}

.detail-toggle-col {
  padding-block-start: 0.25rem;
}

.additional-field-col {
  align-self: stretch;
}
</style>
