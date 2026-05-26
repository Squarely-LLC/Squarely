<script setup lang="ts">
import EditableChipList from "@/components/EditableChipList.vue";
import type {
  DealCustomFieldDefinition,
  DealCustomFieldType,
} from "@/plugins/fake-api/handlers/config/types";
import { useConfigStore } from "@/stores/config";
import { useDealsStore } from "@/stores/deals";
import { useNotificationsStore } from "@/stores/notifications";
import { onMounted, ref } from "vue";

const store = useConfigStore();
store.init();
const notifications = useNotificationsStore();

const salesType = ref<string[]>([]);
const dealStages = ref<string[]>([]);
const customFields = ref<DealCustomFieldDefinition[]>([]);
const dealPrefix = ref("DL");
const typeLabel = ref("Type");

const isSavingSalesType = ref(false);
const isSavingDealStages = ref(false);
const isSavingCustomFields = ref(false);
const isSavingDealPrefix = ref(false);
const isSavingTypeLabel = ref(false);

const notifyWarn = (message: string) =>
  notifications.push(message, "warning", 2000);
const notifyError = (message: string) =>
  notifications.push(message, "error", 2000);

const formatEntry = (value?: string | null) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const cleanEntries = (values?: (string | null | undefined)[]) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => formatEntry(value ?? ""))
    .filter((value) => value.length);
};

const normalizeFieldKey = (value?: string | null) => {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const formatFieldOptions = (options?: string[]) => cleanEntries(options || []);

const sanitizeCustomField = (
  field: Partial<DealCustomFieldDefinition>,
): DealCustomFieldDefinition => {
  const type = (field.type || "text") as DealCustomFieldType;
  const key = normalizeFieldKey(
    field.key || field.label || `field_${Date.now()}`,
  );
  const label = formatEntry(field.label || field.key || "Field");
  const options =
    type === "select" ? formatFieldOptions(field.options) : undefined;

  return {
    key,
    label,
    type,
    options,
    defaultValue: field.defaultValue ?? (type === "boolean" ? false : ""),
  };
};

const loadData = () => {
  const deals = store.configurations.deals || {};
  dealPrefix.value = String(deals.dealPrefix ?? "DL").trim() || "DL";
  typeLabel.value = String(deals.fieldLabels?.type ?? "Type").trim() || "Type";
  salesType.value = cleanEntries(deals.salesType || []);
  dealStages.value = cleanEntries(deals.dealStages || []);

  const configuredCustomFields = Array.isArray(deals.customFields)
    ? deals.customFields
    : Object.entries(deals.fieldLabels || {})
        .filter(([key]) => key !== "type")
        .map(([key, label]) => ({
          key,
          label,
          type: "text" as DealCustomFieldType,
        }));

  customFields.value = configuredCustomFields.map((field) =>
    sanitizeCustomField(field),
  );
};

onMounted(loadData);

const saveDealPrefix = async () => {
  const cleaned = String(dealPrefix.value ?? "").trim() || "DL";

  isSavingDealPrefix.value = true;
  const res = await store.saveRemote({
    deals: {
      ...(store.configurations.deals || {}),
      dealPrefix: cleaned,
    },
  } as any);
  isSavingDealPrefix.value = false;

  if (res) {
    const dealsStore = useDealsStore();
    dealsStore.init();
    dealsStore.syncCodePrefix();
    dealPrefix.value = cleaned;
    notifications.push("Deal prefix saved", "success", 2000);
  } else {
    notifications.push("Failed to save deal prefix", "error", 3000);
    loadData();
  }
};

const saveTypeLabel = async () => {
  const cleaned = formatEntry(typeLabel.value || "") || "Type";

  isSavingTypeLabel.value = true;
  const res = await store.saveRemote({
    deals: {
      ...(store.configurations.deals || {}),
      fieldLabels: {
        ...(store.configurations.deals?.fieldLabels || {}),
        type: cleaned,
      },
    },
  } as any);
  isSavingTypeLabel.value = false;

  if (res) {
    typeLabel.value = cleaned;
    notifications.push("Type label saved", "success", 2000);
  } else {
    notifications.push("Failed to save type label", "error", 3000);
    loadData();
  }
};

type SavePayload = { values: string[]; action: "update" | "delete" };

type ListSaverOptions = {
  state: typeof salesType;
  loading: typeof isSavingSalesType;
  successMessage: string;
  failureMessage: string;
  payloadBuilder: (cleaned: string[]) => any;
};

const makeListSaver = (options: ListSaverOptions) => {
  return async (payload: SavePayload) => {
    const cleaned = cleanEntries(payload.values);
    options.loading.value = true;
    const res = !!(await store.saveRemote(options.payloadBuilder(cleaned)));
    options.loading.value = false;
    if (res) {
      options.state.value = cleaned;
      if (payload.action !== "delete")
        notifications.push(options.successMessage, "success", 2000);
    } else {
      notifications.push(options.failureMessage, "error", 3000);
      loadData();
    }
  };
};

const saveSalesType = makeListSaver({
  state: salesType,
  loading: isSavingSalesType,
  successMessage: "Sales type saved",
  failureMessage: "Failed to save sales type",
  payloadBuilder: (cleaned) => ({
    deals: { ...(store.configurations.deals || {}), salesType: cleaned },
  }),
});

const saveDealStages = makeListSaver({
  state: dealStages,
  loading: isSavingDealStages,
  successMessage: "Deal stages saved",
  failureMessage: "Failed to save deal stages",
  payloadBuilder: (cleaned) => ({
    deals: { ...(store.configurations.deals || {}), dealStages: cleaned },
  }),
});

const buildFieldLabels = (fields: DealCustomFieldDefinition[]) => {
  return {
    ...(store.configurations.deals?.fieldLabels || {}),
    ...Object.fromEntries(fields.map((field) => [field.key, field.label])),
    type: formatEntry(typeLabel.value || "") || "Type",
  };
};

const saveCustomFields = async () => {
  const sanitizedFields = customFields.value
    .map((field) => sanitizeCustomField(field))
    .filter((field) => field.key && field.label);

  const uniqueKeys = new Set(sanitizedFields.map((field) => field.key));
  if (uniqueKeys.size !== sanitizedFields.length) {
    notifications.push("Custom field keys must be unique", "warning", 2500);
    return;
  }

  isSavingCustomFields.value = true;
  const res = await store.saveRemote({
    deals: {
      ...(store.configurations.deals || {}),
      customFields: sanitizedFields,
      fieldLabels: buildFieldLabels(sanitizedFields),
    },
  } as any);
  isSavingCustomFields.value = false;

  if (res) {
    customFields.value = sanitizedFields;
    notifications.push("Custom fields saved", "success", 2000);
  } else {
    notifications.push("Failed to save custom fields", "error", 3000);
    loadData();
  }
};

const addCustomField = () => {
  customFields.value = [
    ...customFields.value,
    sanitizeCustomField({
      key: `field_${customFields.value.length + 1}`,
      label: `Field ${customFields.value.length + 1}`,
      type: "text",
    }),
  ];
};

const updateCustomField = (
  index: number,
  patch: Partial<DealCustomFieldDefinition>,
) => {
  const next = [...customFields.value];
  const current = next[index];

  next[index] = {
    ...current,
    ...patch,
  };

  if (patch.label) next[index].key = normalizeFieldKey(patch.label);

  if (patch.type && patch.type !== "select") next[index].options = undefined;

  customFields.value = next;
};

const updateCustomFieldOptions = (index: number, payload: SavePayload) => {
  const next = [...customFields.value];
  next[index] = {
    ...next[index],
    options: cleanEntries(payload.values),
  };
  customFields.value = next;
};

const removeCustomField = (index: number) => {
  customFields.value = customFields.value.filter(
    (_, fieldIndex) => fieldIndex !== index,
  );
};
</script>

<template>
  <VCard class="mb-6" title="Deal Options">
    <VCardText>
      <VRow class="mb-2">
        <VCol cols="12" md="8">
          <AppTextField
            v-model="dealPrefix"
            label="Deal prefix"
            placeholder="DL"
            @keyup.enter="saveDealPrefix"
          />
        </VCol>

        <VCol cols="12" md="4" class="d-flex align-end">
          <VBtn
            block
            color="primary"
            :loading="isSavingDealPrefix"
            :disabled="isSavingDealPrefix"
            @click="saveDealPrefix"
          >
            Save deal prefix
          </VBtn>
        </VCol>
      </VRow>

      <VRow class="mb-2">
        <VCol cols="12" md="8">
          <AppTextField
            v-model="typeLabel"
            label="Type field label"
            placeholder="Type"
            @keyup.enter="saveTypeLabel"
          />
        </VCol>

        <VCol cols="12" md="4" class="d-flex align-end">
          <VBtn
            block
            color="primary"
            :loading="isSavingTypeLabel"
            :disabled="isSavingTypeLabel"
            @click="saveTypeLabel"
          >
            Save type label
          </VBtn>
        </VCol>
      </VRow>

      <div class="mb-4">
        <EditableChipList
          label="Sales type"
          :items="salesType"
          :loading="isSavingSalesType"
          placeholder="Add sales types"
          @save="saveSalesType"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>

      <div class="mb-4">
        <EditableChipList
          label="Deal stage"
          :items="dealStages"
          :loading="isSavingDealStages"
          placeholder="Add deal stages"
          @save="saveDealStages"
          @warn="notifyWarn"
          @error="notifyError"
        />
      </div>
    </VCardText>
  </VCard>

  <VCard title="Deal Custom Fields">
    <VCardText>
      <div class="d-flex justify-space-between align-center mb-4">
        <div>
          <h6 class="text-h6">Additional Deal Fields</h6>
          <p class="text-body-2 mb-0">
            Configure extra fields that appear on the deals page.
          </p>
        </div>

        <VBtn
          prepend-icon="tabler-plus"
          variant="tonal"
          @click="addCustomField"
        >
          Add Field
        </VBtn>
      </div>

      <div
        v-for="(field, index) in customFields"
        :key="field.key || index"
        class="custom-field-card mb-4"
      >
        <VRow>
          <VCol cols="12" md="6">
            <AppTextField
              :model-value="field.label"
              label="Field label"
              placeholder="Deal Amount"
              @update:model-value="
                updateCustomField(index, { label: String($event || '') })
              "
            />
          </VCol>

          <VCol cols="12" md="3">
            <AppSelect
              :model-value="field.type"
              label="Field type"
              :items="[
                'text',
                'number',
                'date',
                'select',
                'boolean',
                'textarea',
              ]"
              @update:model-value="
                updateCustomField(index, {
                  type: $event as DealCustomFieldType,
                })
              "
            />
          </VCol>

          <VCol cols="12" md="3" class="d-flex align-end">
            <VBtn
              color="error"
              variant="tonal"
              prepend-icon="tabler-trash"
              @click="removeCustomField(index)"
            >
              Remove
            </VBtn>
          </VCol>

          <VCol v-if="field.type === 'select'" cols="12">
            <EditableChipList
              label="Select options"
              :items="field.options || []"
              placeholder="Add options"
              @save="updateCustomFieldOptions(index, $event)"
              @warn="notifyWarn"
              @error="notifyError"
            />
          </VCol>
        </VRow>
      </div>

      <div class="d-flex justify-end">
        <VBtn
          color="primary"
          :loading="isSavingCustomFields"
          :disabled="isSavingCustomFields"
          @click="saveCustomFields"
        >
          Save custom fields
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.custom-field-card {
  padding: 1rem;
  border-radius: 0.5rem;
  background-color: rgba(var(--v-theme-background), 0.35);
}
</style>
