<script lang="ts" setup>
import type { EmployeeSalaryRecord } from "@/stores/employees";
import { ref, watch } from "vue";

interface Props {
  isDialogVisible: boolean;
  salaryData?: EmployeeSalaryRecord | null;
}

interface Emit {
  (e: "update:isDialogVisible", value: boolean): void;
  (e: "submit", value: Omit<EmployeeSalaryRecord, "id" | "createdAt">): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const formRef = ref();
const localSalaryData = ref<Omit<EmployeeSalaryRecord, "id" | "createdAt">>({
  basicSalary: 0,
  transportation: 0,
  housing: 0,
  allowance: 0,
  date: "",
  startingPeriod: "",
  note: "",
});

const resetForm = () => {
  localSalaryData.value = {
    basicSalary: 0,
    transportation: 0,
    housing: 0,
    allowance: 0,
    date: "",
    startingPeriod: "",
    note: "",
  };
};

// Watch for changes in salaryData prop
watch(
  () => props.salaryData,
  (newData) => {
    if (newData) {
      localSalaryData.value = {
        basicSalary: newData.basicSalary || 0,
        transportation: newData.transportation || 0,
        housing: newData.housing || 0,
        allowance: newData.allowance || 0,
        date: newData.date || "",
        startingPeriod: newData.startingPeriod || "",
        note: newData.note || "",
      };
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

const onSubmit = async () => {
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  emit("submit", localSalaryData.value);
  emit("update:isDialogVisible", false);
  resetForm();
};

const onCancel = () => {
  emit("update:isDialogVisible", false);
  resetForm();
};

const requiredRule = (v: any) => !!v || "This field is required";
const numberRule = (v: any) => v >= 0 || "Must be a positive number";

// Generate month options
const currentYear = new Date().getFullYear();
const monthOptions = [];
for (let year = currentYear - 5; year <= currentYear + 5; year++) {
  for (let month = 1; month <= 12; month++) {
    const monthName = new Date(year, month - 1).toLocaleString("default", {
      month: "long",
    });
    monthOptions.push(`${monthName} - ${year}`);
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600"
    @update:model-value="(val) => emit('update:isDialogVisible', val)"
  >
    <DialogCloseBtn @click="onCancel" />

    <VCard style="overflow: visible">
      <VCardText style="overflow: visible">
        <h4 class="text-h5 text-center mb-2">
          {{ props.salaryData ? "Edit Salary" : "Add New Salary" }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to
          {{ props.salaryData ? "edit the salary" : "add a new salary" }}.
        </p>

        <VForm ref="formRef" @submit.prevent="onSubmit">
          <VRow>
            <!-- Basic Salary -->
            <VCol cols="12">
              <AppTextField
                v-model.number="localSalaryData.basicSalary"
                label="Basic Salary"
                placeholder="Enter the raise amount only"
                type="number"
                :rules="[requiredRule, numberRule]"
              />
            </VCol>

            <!-- Transportation -->
            <VCol cols="12">
              <AppTextField
                v-model.number="localSalaryData.transportation"
                label="Transportation"
                placeholder="Enter the raise amount only"
                type="number"
                :rules="[numberRule]"
              />
            </VCol>

            <!-- Housing -->
            <VCol cols="12">
              <AppTextField
                v-model.number="localSalaryData.housing"
                label="Housing"
                placeholder="Enter the raise amount only"
                type="number"
                :rules="[numberRule]"
              />
            </VCol>

            <!-- Allowance -->
            <VCol cols="12">
              <AppTextField
                v-model.number="localSalaryData.allowance"
                label="Allowance"
                placeholder="Enter the raise amount only"
                type="number"
                :rules="[numberRule]"
              />
            </VCol>

            <!-- Date -->
            <VCol cols="12">
              <AppDateTimePicker
                v-model="localSalaryData.date"
                label="DATE"
                placeholder="DD-MM-YYYY"
                :config="{ dateFormat: 'd-m-Y' }"
                :rules="[requiredRule]"
              />
            </VCol>

            <!-- Starting Period -->
            <VCol cols="12">
              <AppSelect
                v-model="localSalaryData.startingPeriod"
                label="STARTING PERIOD"
                placeholder="Select period"
                :items="monthOptions"
                :rules="[requiredRule]"
              />
            </VCol>

            <!-- Note -->
            <VCol cols="12">
              <AppTextarea
                v-model="localSalaryData.note"
                label="NOTE"
                placeholder="Add any additional notes"
                rows="3"
              />
            </VCol>

            <!-- Form Actions -->
            <VCol cols="12" class="d-flex justify-center gap-4">
              <VBtn color="secondary" variant="tonal" @click="onCancel">
                Cancel
              </VBtn>
              <VBtn color="primary" type="submit">
                {{ props.salaryData ? "Update" : "Add" }}
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
