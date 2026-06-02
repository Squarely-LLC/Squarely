<script setup lang="ts">
import type {
  CatalogueProducedProductRecord,
  CatalogueProducedProductSubItem,
} from "@/plugins/fake-api/handlers/catalogues/types";
import type {
  DealProducedCustomization,
  DealProducedCustomizationField,
  DealProducedCustomizationSubItem,
  DealProducedCustomizationValue,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { computed } from "vue";

const props = defineProps<{
  modelValue: DealProducedCustomization | null;
  record: CatalogueProducedProductRecord | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: DealProducedCustomization | null): void;
}>();

const customization = computed(() => props.modelValue);

const cloneField = (
  field: DealProducedCustomizationField,
): DealProducedCustomizationField => ({
  ...field,
  values: Array.isArray(field.values) ? [...field.values] : [],
  value: Array.isArray(field.value) ? [...field.value] : field.value,
});

const cloneSubItem = (
  subItem: DealProducedCustomizationSubItem,
): DealProducedCustomizationSubItem => ({
  ...subItem,
  options: subItem.options.map(cloneField),
  measurements: subItem.measurements.map(cloneField),
});

const cloneCustomization = (
  value: DealProducedCustomization | null,
): DealProducedCustomization | null =>
  value
    ? {
        options: value.options.map(cloneField),
        measurements: value.measurements.map(cloneField),
        subItems: value.subItems.map(cloneSubItem),
      }
    : null;

const fieldChoices = (field: DealProducedCustomizationField) =>
  (Array.isArray(field.values) ? field.values : [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((value) => ({ title: value, value }));

const switchFieldValue = (field: DealProducedCustomizationField) => {
  const firstChoice = String(field.values?.[0] ?? "").trim();

  return firstChoice || "Yes";
};

const isSwitchEnabled = (field: DealProducedCustomizationField) =>
  String(field.value ?? "").trim() === switchFieldValue(field);

const normalizeFieldValue = (
  field: DealProducedCustomizationField,
  value: DealProducedCustomizationValue,
): DealProducedCustomizationValue => {
  if (field.type === "Pictures") {
    return Array.isArray(value)
      ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
  }

  if (field.type === "Number") {
    if (value === null || value === undefined || value === "") return null;

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return null;
  return String(value);
};

const updateFieldValue = (
  nextValue: DealProducedCustomizationValue,
  targetField: DealProducedCustomizationField,
  subItemId?: number,
  section: "options" | "measurements" = "options",
) => {
  const next = cloneCustomization(customization.value);
  if (!next) return;

  const sourceFields =
    subItemId === undefined
      ? next[section]
      : (next.subItems.find((item) => item.subItemId === subItemId)?.[
          section
        ] ?? []);

  const target = sourceFields.find(
    (field) => field.fieldId === targetField.fieldId,
  );
  if (!target) return;

  target.value = normalizeFieldValue(targetField, nextValue);
  emit("update:modelValue", next);
};

const subItemCustomization = (subItem: CatalogueProducedProductSubItem) =>
  customization.value?.subItems.find(
    (entry) => entry.subItemId === subItem.id,
  ) ?? null;

const rawMaterials = computed(() => {
  if (!props.record) return [];

  return [
    ...(Array.isArray(props.record.rawMaterials)
      ? props.record.rawMaterials
      : []),
    ...(Array.isArray(props.record.subItems)
      ? props.record.subItems
      : []
    ).flatMap((subItem) =>
      (Array.isArray(subItem.rawMaterials) ? subItem.rawMaterials : []).map(
        (material) => ({
          ...material,
          id: `sub-item-${subItem.id}-${material.id}`,
        }),
      ),
    ),
  ];
});
</script>

<template>
  <VCard
    v-if="record && customization"
    variant="tonal"
    class="produced-customization-card"
  >
    <VCardText class="produced-customization-card__body">
      <div
        v-if="customization.options.length"
        class="produced-customization-section"
      >
        <div class="produced-customization-section__title">Options</div>
        <VRow>
          <VCol
            v-for="field in customization.options"
            :key="`root-option-${field.fieldId}`"
            cols="12"
            md="6"
          >
            <AppTextField
              v-if="field.type === 'Text'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              @update:model-value="
                updateFieldValue($event, field, undefined, 'options')
              "
            />
            <AppTextField
              v-else-if="field.type === 'Number'"
              :model-value="field.value"
              :label="field.name"
              type="number"
              @update:model-value="
                updateFieldValue($event, field, undefined, 'options')
              "
            />
            <AppTextarea
              v-else-if="field.type === 'Note'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              rows="3"
              auto-grow
              @update:model-value="
                updateFieldValue($event, field, undefined, 'options')
              "
            />
            <AppSelect
              v-else-if="field.type === 'Dropdown'"
              :model-value="
                typeof field.value === 'string' ? field.value : null
              "
              :label="field.name"
              :items="fieldChoices(field)"
              item-title="title"
              item-value="value"
              clearable
              @update:model-value="
                updateFieldValue($event, field, undefined, 'options')
              "
            />
            <div
              v-else-if="field.type === 'Select Buttons'"
              class="produced-customization-switch-field"
            >
              <div class="produced-customization-switch-field__label">
                {{ field.name }}
              </div>
              <VSwitch
                :model-value="isSwitchEnabled(field)"
                inset
                hide-details
                color="primary"
                @update:model-value="
                  updateFieldValue(
                    $event ? switchFieldValue(field) : null,
                    field,
                    undefined,
                    'options',
                  )
                "
              />
            </div>
            <AppCombobox
              v-else
              :model-value="Array.isArray(field.value) ? field.value : []"
              :label="field.name"
              :items="Array.isArray(field.value) ? field.value : []"
              multiple
              chips
              closable-chips
              clearable
              @update:model-value="
                updateFieldValue($event, field, undefined, 'options')
              "
            />
          </VCol>
        </VRow>
      </div>

      <div
        v-if="customization.measurements.length"
        class="produced-customization-section"
      >
        <div class="produced-customization-section__title">Measurements</div>
        <VRow>
          <VCol
            v-for="field in customization.measurements"
            :key="`root-measurement-${field.fieldId}`"
            cols="12"
            md="6"
          >
            <AppTextField
              v-if="field.type === 'Text'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              @update:model-value="
                updateFieldValue($event, field, undefined, 'measurements')
              "
            />
            <AppTextField
              v-else-if="field.type === 'Number'"
              :model-value="field.value"
              :label="field.name"
              type="number"
              @update:model-value="
                updateFieldValue($event, field, undefined, 'measurements')
              "
            />
            <AppTextarea
              v-else-if="field.type === 'Note'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              rows="3"
              auto-grow
              @update:model-value="
                updateFieldValue($event, field, undefined, 'measurements')
              "
            />
            <AppSelect
              v-else-if="field.type === 'Dropdown'"
              :model-value="
                typeof field.value === 'string' ? field.value : null
              "
              :label="field.name"
              :items="fieldChoices(field)"
              item-title="title"
              item-value="value"
              clearable
              @update:model-value="
                updateFieldValue($event, field, undefined, 'measurements')
              "
            />
            <div
              v-else-if="field.type === 'Select Buttons'"
              class="produced-customization-switch-field"
            >
              <div class="produced-customization-switch-field__label">
                {{ field.name }}
              </div>
              <VSwitch
                :model-value="isSwitchEnabled(field)"
                inset
                hide-details
                color="primary"
                @update:model-value="
                  updateFieldValue(
                    $event ? switchFieldValue(field) : null,
                    field,
                    undefined,
                    'measurements',
                  )
                "
              />
            </div>
            <AppCombobox
              v-else
              :model-value="Array.isArray(field.value) ? field.value : []"
              :label="field.name"
              :items="Array.isArray(field.value) ? field.value : []"
              multiple
              chips
              closable-chips
              clearable
              @update:model-value="
                updateFieldValue($event, field, undefined, 'measurements')
              "
            />
          </VCol>
        </VRow>
      </div>

      <div v-if="record.subItems.length" class="produced-customization-section">
        <div class="produced-customization-section__title">Sub Items</div>
        <div class="produced-customization-subitems">
          <VCard
            v-for="subItem in record.subItems"
            :key="`sub-item-${subItem.id}`"
            variant="outlined"
            class="produced-customization-subitem"
          >
            <VCardText>
              <div class="produced-customization-subitem__title">
                {{ subItem.name }}
              </div>

              <div
                v-if="subItemCustomization(subItem)?.options.length"
                class="produced-customization-subsection"
              >
                <div class="produced-customization-subsection__title">
                  Options
                </div>
                <VRow>
                  <VCol
                    v-for="field in subItemCustomization(subItem)?.options ||
                    []"
                    :key="`sub-option-${subItem.id}-${field.fieldId}`"
                    cols="12"
                    md="6"
                  >
                    <AppTextField
                      v-if="field.type === 'Text'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : ''
                      "
                      :label="field.name"
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'options')
                      "
                    />
                    <AppTextField
                      v-else-if="field.type === 'Number'"
                      :model-value="field.value"
                      :label="field.name"
                      type="number"
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'options')
                      "
                    />
                    <AppTextarea
                      v-else-if="field.type === 'Note'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : ''
                      "
                      :label="field.name"
                      rows="3"
                      auto-grow
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'options')
                      "
                    />
                    <AppSelect
                      v-else-if="field.type === 'Dropdown'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : null
                      "
                      :label="field.name"
                      :items="fieldChoices(field)"
                      item-title="title"
                      item-value="value"
                      clearable
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'options')
                      "
                    />
                    <div
                      v-else-if="field.type === 'Select Buttons'"
                      class="produced-customization-switch-field"
                    >
                      <div class="produced-customization-switch-field__label">
                        {{ field.name }}
                      </div>
                      <VSwitch
                        :model-value="isSwitchEnabled(field)"
                        inset
                        hide-details
                        color="primary"
                        @update:model-value="
                          updateFieldValue(
                            $event ? switchFieldValue(field) : null,
                            field,
                            subItem.id,
                            'options',
                          )
                        "
                      />
                    </div>
                    <AppCombobox
                      v-else
                      :model-value="
                        Array.isArray(field.value) ? field.value : []
                      "
                      :label="field.name"
                      :items="Array.isArray(field.value) ? field.value : []"
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'options')
                      "
                    />
                  </VCol>
                </VRow>
              </div>

              <div
                v-if="subItemCustomization(subItem)?.measurements.length"
                class="produced-customization-subsection"
              >
                <div class="produced-customization-subsection__title">
                  Measurements
                </div>
                <VRow>
                  <VCol
                    v-for="field in subItemCustomization(subItem)
                      ?.measurements || []"
                    :key="`sub-measurement-${subItem.id}-${field.fieldId}`"
                    cols="12"
                    md="6"
                  >
                    <AppTextField
                      v-if="field.type === 'Text'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : ''
                      "
                      :label="field.name"
                      @update:model-value="
                        updateFieldValue(
                          $event,
                          field,
                          subItem.id,
                          'measurements',
                        )
                      "
                    />
                    <AppTextField
                      v-else-if="field.type === 'Number'"
                      :model-value="field.value"
                      :label="field.name"
                      type="number"
                      @update:model-value="
                        updateFieldValue(
                          $event,
                          field,
                          subItem.id,
                          'measurements',
                        )
                      "
                    />
                    <AppTextarea
                      v-else-if="field.type === 'Note'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : ''
                      "
                      :label="field.name"
                      rows="3"
                      auto-grow
                      @update:model-value="
                        updateFieldValue(
                          $event,
                          field,
                          subItem.id,
                          'measurements',
                        )
                      "
                    />
                    <AppSelect
                      v-else-if="field.type === 'Dropdown'"
                      :model-value="
                        typeof field.value === 'string' ? field.value : null
                      "
                      :label="field.name"
                      :items="fieldChoices(field)"
                      item-title="title"
                      item-value="value"
                      clearable
                      @update:model-value="
                        updateFieldValue(
                          $event,
                          field,
                          subItem.id,
                          'measurements',
                        )
                      "
                    />
                    <div
                      v-else-if="field.type === 'Select Buttons'"
                      class="produced-customization-switch-field"
                    >
                      <div class="produced-customization-switch-field__label">
                        {{ field.name }}
                      </div>
                      <VSwitch
                        :model-value="isSwitchEnabled(field)"
                        inset
                        hide-details
                        color="primary"
                        @update:model-value="
                          updateFieldValue(
                            $event ? switchFieldValue(field) : null,
                            field,
                            subItem.id,
                            'measurements',
                          )
                        "
                      />
                    </div>
                    <AppCombobox
                      v-else
                      :model-value="
                        Array.isArray(field.value) ? field.value : []
                      "
                      :label="field.name"
                      :items="Array.isArray(field.value) ? field.value : []"
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="
                        updateFieldValue(
                          $event,
                          field,
                          subItem.id,
                          'measurements',
                        )
                      "
                    />
                  </VCol>
                </VRow>
              </div>
            </VCardText>
          </VCard>
        </div>
      </div>

      <div v-if="rawMaterials.length" class="produced-customization-section">
        <div class="produced-customization-section__title">Raw Materials</div>
        <div class="produced-customization-material-chips">
          <VChip
            v-for="material in rawMaterials"
            :key="material.id"
            size="small"
            variant="outlined"
          >
            {{ material.name }}
            <template
              v-if="material.qty !== null && material.qty !== undefined"
            >
              x{{ material.qty }}
            </template>
          </VChip>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.produced-customization-card__body {
  display: grid;
  gap: 1rem;
}

.produced-customization-section,
.produced-customization-subsection {
  display: grid;
  gap: 0.75rem;
}

.produced-customization-section__title,
.produced-customization-subsection__title,
.produced-customization-subitem__title {
  font-size: 0.95rem;
  font-weight: 700;
}

.produced-customization-subitems {
  display: grid;
  gap: 0.85rem;
}

.produced-customization-subitem {
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  background: rgba(var(--v-theme-primary), 0.05);
}

.produced-customization-material-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.produced-customization-switch-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.produced-customization-switch-field__label {
  font-size: 0.95rem;
  font-weight: 500;
}
</style>
>
