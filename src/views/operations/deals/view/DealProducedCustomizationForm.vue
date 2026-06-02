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
      : (next.subItems.find((item) => item.subItemId === subItemId)?.[section] ??
          []);

  const target = sourceFields.find((field) => field.fieldId === targetField.fieldId);
  if (!target) return;

  target.value = normalizeFieldValue(targetField, nextValue);
  emit("update:modelValue", next);
};

const subItemCustomization = (subItem: CatalogueProducedProductSubItem) =>
  customization.value?.subItems.find((entry) => entry.subItemId === subItem.id) ??
  null;
</script>

<template>
  <VCard v-if="record && customization" variant="tonal" class="produced-customization-card">
    <VCardText class="produced-customization-card__body">
      <div class="text-h6 mb-4">Customization</div>

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
              :hint="field.description || undefined"
              persistent-hint
              @update:model-value="updateFieldValue($event, field, undefined, 'options')"
            />
            <AppTextField
              v-else-if="field.type === 'Number'"
              :model-value="field.value"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              type="number"
              @update:model-value="updateFieldValue($event, field, undefined, 'options')"
            />
            <AppTextarea
              v-else-if="field.type === 'Note'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              rows="3"
              auto-grow
              @update:model-value="updateFieldValue($event, field, undefined, 'options')"
            />
            <AppSelect
              v-else-if="field.type === 'Dropdown'"
              :model-value="typeof field.value === 'string' ? field.value : null"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              :items="fieldChoices(field)"
              item-title="title"
              item-value="value"
              clearable
              @update:model-value="updateFieldValue($event, field, undefined, 'options')"
            />
            <div v-else-if="field.type === 'Select Buttons'" class="produced-customization-chip-field">
              <div class="produced-customization-chip-field__label">{{ field.name }}</div>
              <div
                v-if="field.description"
                class="text-body-2 text-medium-emphasis mb-2"
              >
                {{ field.description }}
              </div>
              <VChipGroup
                :model-value="typeof field.value === 'string' ? field.value : null"
                selected-class="text-primary"
                @update:model-value="updateFieldValue($event, field, undefined, 'options')"
              >
                <VChip
                  v-for="choice in fieldChoices(field)"
                  :key="choice.value"
                  :value="choice.value"
                  filter
                  variant="outlined"
                  color="primary"
                >
                  {{ choice.title }}
                </VChip>
              </VChipGroup>
            </div>
            <AppCombobox
              v-else
              :model-value="Array.isArray(field.value) ? field.value : []"
              :label="field.name"
              :hint="field.description || 'Add image links or references'"
              persistent-hint
              :items="Array.isArray(field.value) ? field.value : []"
              multiple
              chips
              closable-chips
              clearable
              @update:model-value="updateFieldValue($event, field, undefined, 'options')"
            />
          </VCol>
        </VRow>
      </div>

      <div
        v-if="record.rawMaterials.length"
        class="produced-customization-section"
      >
        <div class="produced-customization-section__title">Raw Materials</div>
        <div class="produced-customization-materials">
          <div
            v-for="material in record.rawMaterials"
            :key="`root-material-${material.id}`"
            class="produced-customization-material"
          >
            <span>{{ material.name }}</span>
            <strong v-if="material.qty !== null && material.qty !== undefined">
              {{ material.qty }}
            </strong>
          </div>
        </div>
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
              :hint="field.description || undefined"
              persistent-hint
              @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
            />
            <AppTextField
              v-else-if="field.type === 'Number'"
              :model-value="field.value"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              type="number"
              @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
            />
            <AppTextarea
              v-else-if="field.type === 'Note'"
              :model-value="typeof field.value === 'string' ? field.value : ''"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              rows="3"
              auto-grow
              @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
            />
            <AppSelect
              v-else-if="field.type === 'Dropdown'"
              :model-value="typeof field.value === 'string' ? field.value : null"
              :label="field.name"
              :hint="field.description || undefined"
              persistent-hint
              :items="fieldChoices(field)"
              item-title="title"
              item-value="value"
              clearable
              @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
            />
            <div v-else-if="field.type === 'Select Buttons'" class="produced-customization-chip-field">
              <div class="produced-customization-chip-field__label">{{ field.name }}</div>
              <div
                v-if="field.description"
                class="text-body-2 text-medium-emphasis mb-2"
              >
                {{ field.description }}
              </div>
              <VChipGroup
                :model-value="typeof field.value === 'string' ? field.value : null"
                selected-class="text-primary"
                @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
              >
                <VChip
                  v-for="choice in fieldChoices(field)"
                  :key="choice.value"
                  :value="choice.value"
                  filter
                  variant="outlined"
                  color="primary"
                >
                  {{ choice.title }}
                </VChip>
              </VChipGroup>
            </div>
            <AppCombobox
              v-else
              :model-value="Array.isArray(field.value) ? field.value : []"
              :label="field.name"
              :hint="field.description || 'Add image links or references'"
              persistent-hint
              :items="Array.isArray(field.value) ? field.value : []"
              multiple
              chips
              closable-chips
              clearable
              @update:model-value="updateFieldValue($event, field, undefined, 'measurements')"
            />
          </VCol>
        </VRow>
      </div>

      <div
        v-if="record.subItems.length"
        class="produced-customization-section"
      >
        <div class="produced-customization-section__title">Sub Items</div>
        <div class="produced-customization-subitems">
          <VCard
            v-for="subItem in record.subItems"
            :key="`sub-item-${subItem.id}`"
            variant="outlined"
            class="produced-customization-subitem"
          >
            <VCardText>
              <div class="produced-customization-subitem__title">{{ subItem.name }}</div>

              <div
                v-if="subItemCustomization(subItem)?.options.length"
                class="produced-customization-subsection"
              >
                <div class="produced-customization-subsection__title">Options</div>
                <VRow>
                  <VCol
                    v-for="field in subItemCustomization(subItem)?.options || []"
                    :key="`sub-option-${subItem.id}-${field.fieldId}`"
                    cols="12"
                    md="6"
                  >
                    <AppTextField
                      v-if="field.type === 'Text'"
                      :model-value="typeof field.value === 'string' ? field.value : ''"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                    />
                    <AppTextField
                      v-else-if="field.type === 'Number'"
                      :model-value="field.value"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      type="number"
                      @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                    />
                    <AppTextarea
                      v-else-if="field.type === 'Note'"
                      :model-value="typeof field.value === 'string' ? field.value : ''"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      rows="3"
                      auto-grow
                      @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                    />
                    <AppSelect
                      v-else-if="field.type === 'Dropdown'"
                      :model-value="typeof field.value === 'string' ? field.value : null"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      :items="fieldChoices(field)"
                      item-title="title"
                      item-value="value"
                      clearable
                      @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                    />
                    <div v-else-if="field.type === 'Select Buttons'" class="produced-customization-chip-field">
                      <div class="produced-customization-chip-field__label">{{ field.name }}</div>
                      <div
                        v-if="field.description"
                        class="text-body-2 text-medium-emphasis mb-2"
                      >
                        {{ field.description }}
                      </div>
                      <VChipGroup
                        :model-value="typeof field.value === 'string' ? field.value : null"
                        selected-class="text-primary"
                        @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                      >
                        <VChip
                          v-for="choice in fieldChoices(field)"
                          :key="choice.value"
                          :value="choice.value"
                          filter
                          variant="outlined"
                          color="primary"
                        >
                          {{ choice.title }}
                        </VChip>
                      </VChipGroup>
                    </div>
                    <AppCombobox
                      v-else
                      :model-value="Array.isArray(field.value) ? field.value : []"
                      :label="field.name"
                      :hint="field.description || 'Add image links or references'"
                      persistent-hint
                      :items="Array.isArray(field.value) ? field.value : []"
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="updateFieldValue($event, field, subItem.id, 'options')"
                    />
                  </VCol>
                </VRow>
              </div>

              <div
                v-if="subItem.rawMaterials.length"
                class="produced-customization-subsection"
              >
                <div class="produced-customization-subsection__title">Raw Materials</div>
                <div class="produced-customization-materials">
                  <div
                    v-for="material in subItem.rawMaterials"
                    :key="`sub-material-${subItem.id}-${material.id}`"
                    class="produced-customization-material"
                  >
                    <span>{{ material.name }}</span>
                    <strong v-if="material.qty !== null && material.qty !== undefined">
                      {{ material.qty }}
                    </strong>
                  </div>
                </div>
              </div>

              <div
                v-if="subItemCustomization(subItem)?.measurements.length"
                class="produced-customization-subsection"
              >
                <div class="produced-customization-subsection__title">Measurements</div>
                <VRow>
                  <VCol
                    v-for="field in subItemCustomization(subItem)?.measurements || []"
                    :key="`sub-measurement-${subItem.id}-${field.fieldId}`"
                    cols="12"
                    md="6"
                  >
                    <AppTextField
                      v-if="field.type === 'Text'"
                      :model-value="typeof field.value === 'string' ? field.value : ''"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'measurements')
                      "
                    />
                    <AppTextField
                      v-else-if="field.type === 'Number'"
                      :model-value="field.value"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      type="number"
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'measurements')
                      "
                    />
                    <AppTextarea
                      v-else-if="field.type === 'Note'"
                      :model-value="typeof field.value === 'string' ? field.value : ''"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      rows="3"
                      auto-grow
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'measurements')
                      "
                    />
                    <AppSelect
                      v-else-if="field.type === 'Dropdown'"
                      :model-value="typeof field.value === 'string' ? field.value : null"
                      :label="field.name"
                      :hint="field.description || undefined"
                      persistent-hint
                      :items="fieldChoices(field)"
                      item-title="title"
                      item-value="value"
                      clearable
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'measurements')
                      "
                    />
                    <div v-else-if="field.type === 'Select Buttons'" class="produced-customization-chip-field">
                      <div class="produced-customization-chip-field__label">{{ field.name }}</div>
                      <div
                        v-if="field.description"
                        class="text-body-2 text-medium-emphasis mb-2"
                      >
                        {{ field.description }}
                      </div>
                      <VChipGroup
                        :model-value="typeof field.value === 'string' ? field.value : null"
                        selected-class="text-primary"
                        @update:model-value="
                          updateFieldValue($event, field, subItem.id, 'measurements')
                        "
                      >
                        <VChip
                          v-for="choice in fieldChoices(field)"
                          :key="choice.value"
                          :value="choice.value"
                          filter
                          variant="outlined"
                          color="primary"
                        >
                          {{ choice.title }}
                        </VChip>
                      </VChipGroup>
                    </div>
                    <AppCombobox
                      v-else
                      :model-value="Array.isArray(field.value) ? field.value : []"
                      :label="field.name"
                      :hint="field.description || 'Add image links or references'"
                      persistent-hint
                      :items="Array.isArray(field.value) ? field.value : []"
                      multiple
                      chips
                      closable-chips
                      clearable
                      @update:model-value="
                        updateFieldValue($event, field, subItem.id, 'measurements')
                      "
                    />
                  </VCol>
                </VRow>
              </div>
            </VCardText>
          </VCard>
        </div>
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.produced-customization-card__body {
  display: grid;
  gap: 1.25rem;
}

.produced-customization-section,
.produced-customization-subsection {
  display: grid;
  gap: 0.9rem;
}

.produced-customization-section__title,
.produced-customization-subsection__title,
.produced-customization-subitem__title,
.produced-customization-chip-field__label {
  font-size: 0.95rem;
  font-weight: 700;
}

.produced-customization-subitems {
  display: grid;
  gap: 1rem;
}

.produced-customization-subitem {
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  background: rgba(var(--v-theme-primary), 0.05);
}

.produced-customization-materials {
  display: grid;
  gap: 0.75rem;
}

.produced-customization-material {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.05);
  padding: 0.85rem 1rem;
}

.produced-customization-chip-field {
  display: grid;
  gap: 0.6rem;
}
</style>
