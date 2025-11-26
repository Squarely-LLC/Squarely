<script setup lang="ts">
import type { EmployeeContract } from "@/plugins/fake-api/handlers/apps/employees/types";
import { ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
import { requiredValidator } from "../../../../@core/utils/validators";

interface Props {
  isDialogVisible: boolean;
  contractData?: EmployeeContract | null;
}

interface Emit {
  (e: "submit", value: EmployeeContract): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const isFormValid = ref(false);
const refForm = ref<VForm | undefined>();

const localContract = ref<EmployeeContract>({
  salaryPaid: "Monthly",
  employmentType: null,
  startDate: null,
  probationEndDate: null,
  firstPayroll: null,
  note: "",
});

const salaryPaidOptions = ["Monthly", "Weekly"];

const employmentTypeOptions = [
  "Full-Time",
  "Part-Time",
  "Contract",
  "Freelance",
  "Intern",
];

const onFormSubmit = async () => {
  const valid = await refForm.value?.validate();
  if (valid?.valid) {
    emit("submit", { ...localContract.value });
    emit("update:isDialogVisible", false);
    resetForm();
  }
};

const resetForm = () => {
  localContract.value = {
    salaryPaid: "Monthly",
    employmentType: null,
    startDate: null,
    probationEndDate: null,
    firstPayroll: null,
    note: "",
  };
  refForm.value?.reset();
  refForm.value?.resetValidation();
};

const onFormReset = () => {
  resetForm();
  emit("update:isDialogVisible", false);
};

const dialogModelValueUpdate = (val: boolean) => {
  emit("update:isDialogVisible", val);
  if (!val) {
    resetForm();
  }
};

// Watch for contract data changes to populate form in edit mode
watch(
  () => props.contractData,
  (newContract) => {
    if (newContract) {
      localContract.value = {
        salaryPaid: newContract.salaryPaid || "Monthly",
        employmentType: newContract.employmentType || null,
        startDate: newContract.startDate || null,
        probationEndDate: newContract.probationEndDate || null,
        firstPayroll: newContract.firstPayroll || null,
        note: newContract.note || "",
      };
    }
  },
  { immediate: true }
);
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 900"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard :title="contractData ? 'Edit Contract' : 'Create New Contract'">
      <VCardText>
        <VForm
          ref="refForm"
          v-model="isFormValid"
          @submit.prevent="onFormSubmit"
        >
          <VRow>
            <!-- Salary Paid -->
            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContract.salaryPaid"
                label="Salary Paid"
                placeholder="Select Frequency"
                :items="salaryPaidOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Employment Type -->
            <VCol cols="12" md="6">
              <AppSelect
                v-model="localContract.employmentType"
                label="Employment Type"
                placeholder="Select Type"
                :items="employmentTypeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Start Date -->
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="localContract.startDate"
                label="Start Date"
                placeholder="DD-MM-YYYY"
                :config="{
                  enableTime: false,
                  dateFormat: 'd-m-Y',
                }"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Probation End Date -->
            <VCol cols="12" md="6">
              <AppDateTimePicker
                v-model="localContract.probationEndDate"
                label="Probation End Date"
                placeholder="DD-MM-YYYY"
                :config="{
                  enableTime: false,
                  dateFormat: 'd-m-Y',
                }"
              />
            </VCol>

            <!-- First Payroll -->
            <VCol cols="12" md="12">
              <AppDateTimePicker
                v-model="localContract.firstPayroll"
                label="First Payroll"
                placeholder="December - 2025"
                :config="{
                  enableTime: false,
                  dateFormat: 'F - Y',
                }"
              />
            </VCol>

            <!-- Note -->
            <VCol cols="12">
              <AppTextarea
                v-model="localContract.note"
                label="Note"
                placeholder="Add any additional notes about the contract..."
                rows="4"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VCardText class="d-flex justify-end flex-wrap gap-3">
        <VBtn variant="tonal" color="secondary" @click="onFormReset">
          Cancel
        </VBtn>
        <VBtn type="submit" @click="onFormSubmit">
          {{ contractData ? "Update Contract" : "Create Contract" }}
        </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>
