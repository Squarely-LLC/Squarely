<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import { ref } from "vue";
import type { VForm } from "vuetify/components/VForm";
import { requiredValidator } from "../../../../@core/utils/validators";

interface Props {
  isDialogVisible: boolean;
}

interface Emit {
  (e: "submit", value: TerminationData): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

interface TerminationData {
  noticePeriod: string | null;
  terminationType: string | null;
  note: string;
  lastDayAtWork: string | null;
  lastPayrollPeriod: string | null;
  file?: File | null;
  attachmentLink: string;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const isFormValid = ref(false);
const refForm = ref<VForm | undefined>();

const localTermination = ref<TerminationData>({
  noticePeriod: null,
  terminationType: null,
  note: "",
  lastDayAtWork: null,
  lastPayrollPeriod: null,
  file: null,
  attachmentLink: "",
});

const terminationTypeOptions = [
  "Resignation",
  "Termination",
  "Retirement",
  "End of Contract",
  "Mutual Agreement",
];

const lastPayrollPeriodOptions = [
  "January - 2025",
  "February - 2025",
  "March - 2025",
  "April - 2025",
  "May - 2025",
  "June - 2025",
  "July - 2025",
  "August - 2025",
  "September - 2025",
  "October - 2025",
  "November - 2025",
  "December - 2025",
];

const onFormSubmit = async () => {
  const valid = await refForm.value?.validate();
  if (valid?.valid) {
    emit("submit", { ...localTermination.value });
    emit("update:isDialogVisible", false);
    resetForm();
  }
};

const resetForm = () => {
  localTermination.value = {
    noticePeriod: null,
    terminationType: null,
    note: "",
    lastDayAtWork: null,
    lastPayrollPeriod: null,
    file: null,
    attachmentLink: "",
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
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 600"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard style="overflow: visible">
      <VCardText style="overflow: visible">
        <h4 class="text-h5 text-center mb-2">Terminate Contract</h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to terminate the contract.
        </p>
        <VForm
          ref="refForm"
          v-model="isFormValid"
          @submit.prevent="onFormSubmit"
        >
          <VRow>
            <!-- Notice Period -->
            <VCol cols="12">
              <AppDateTimePicker
                v-model="localTermination.noticePeriod"
                label="Notice Period"
                placeholder="YYYY-MM-DD"
                :config="{
                  enableTime: false,
                  dateFormat: 'Y-m-d',
                }"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Termination Type -->
            <VCol cols="12">
              <AppSelect
                v-model="localTermination.terminationType"
                label="Termination Type"
                placeholder="Select Type"
                :items="terminationTypeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Note -->
            <VCol cols="12">
              <AppTextarea
                v-model="localTermination.note"
                label="Note"
                placeholder="Add any additional notes about the termination..."
                rows="4"
              />
            </VCol>

            <!-- Last Day at Work -->
            <VCol cols="12">
              <AppDateTimePicker
                v-model="localTermination.lastDayAtWork"
                label="Last Day at Work"
                placeholder="YYYY-MM-DD"
                :config="{
                  enableTime: false,
                  dateFormat: 'Y-m-d',
                }"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Last Payroll Period -->
            <VCol cols="12">
              <AppSelect
                v-model="localTermination.lastPayrollPeriod"
                label="Last Payroll Period"
                placeholder="Select last Payoll Period"
                :items="lastPayrollPeriodOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- File Upload -->
            <VCol cols="12">
              <VFileInput
                v-model="localTermination.file"
                label="File"
                placeholder="Choose File"
                prepend-icon=""
                prepend-inner-icon="tabler-paperclip"
              />
            </VCol>

            <!-- Attachment Link -->
            <VCol cols="12">
              <AppTextField
                v-model="localTermination.attachmentLink"
                label="Attachment Link"
                placeholder="https://docs.google.com/"
              />
            </VCol>
          </VRow>
        </VForm>
      </VCardText>

      <VCardText>
        <DialogActionBar
          save-text="Terminate Contract"
          save-type="submit"
          save-color="error"
          save-variant="flat"
          @save="onFormSubmit"
          @cancel="onFormReset"
        />
      </VCardText>
    </VCard>
  </VDialog>
</template>
