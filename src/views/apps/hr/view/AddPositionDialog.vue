<script setup lang="ts">
import type { EmployeePosition } from "@/stores/employees";
import { ref, watch } from "vue";

interface Props {
  isDialogVisible: boolean;
  positionData?: EmployeePosition | null;
}

interface Emit {
  (e: "update:isDialogVisible", value: boolean): void;
  (e: "submit", position: Omit<EmployeePosition, "id" | "createdAt">): void;
}

const props = withDefaults(defineProps<Props>(), {
  positionData: null,
});

const emit = defineEmits<Emit>();

const formRef = ref();
const formData = ref({
  position: "",
  startingDate: "",
  note: "",
});

const resetForm = () => {
  formData.value = {
    position: "",
    startingDate: "",
    note: "",
  };
  formRef.value?.resetValidation();
};

// Watch for dialog visibility and position data changes
watch(
  () => props.isDialogVisible,
  (newVal) => {
    if (newVal) {
      if (props.positionData) {
        // Edit mode
        formData.value = {
          position: props.positionData.position || "",
          startingDate: props.positionData.startingDate || "",
          note: props.positionData.note || "",
        };
      } else {
        // Add mode
        resetForm();
      }
    }
  }
);

const dialogModelValueUpdate = (val: boolean) => {
  emit("update:isDialogVisible", val);
  if (!val) resetForm();
};

const onSubmit = async () => {
  const { valid } = await formRef.value?.validate();

  if (!valid) return;

  emit("submit", {
    position: formData.value.position,
    startingDate: formData.value.startingDate,
    note: formData.value.note || undefined,
  });

  emit("update:isDialogVisible", false);
  resetForm();
};

const onFormReset = () => {
  resetForm();
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />
    <VCard style="overflow: visible">
      <VCardText style="overflow: visible">
        <h4 class="text-h5 text-center mb-2">
          {{ props.positionData ? "Edit Position" : "Add New Position" }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to
          {{ props.positionData ? "edit the position" : "add a new position" }}.
        </p>

        <VForm ref="formRef" @submit.prevent="onSubmit">
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="formData.position"
                label="Position"
                placeholder="Enter the new position"
                :rules="[(v: string) => !!v || 'Position is required']"
              />
            </VCol>

            <VCol cols="12">
              <AppDateTimePicker
                v-model="formData.startingDate"
                label="Starting Date"
                placeholder="November 26, 2025"
                :config="{
                  dateFormat: 'Y-m-d',
                  altFormat: 'F j, Y',
                  altInput: true,
                }"
              />
            </VCol>

            <VCol cols="12">
              <AppTextarea
                v-model="formData.note"
                label="Note"
                placeholder="Add any additional notes"
                rows="3"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VCardText class="d-flex justify-end gap-3">
        <VBtn color="secondary" variant="tonal" @click="onFormReset">
          Cancel
        </VBtn>
        <VBtn type="submit" @click="onSubmit"> Submit </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>
