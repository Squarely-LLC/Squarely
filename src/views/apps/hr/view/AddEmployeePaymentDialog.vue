<script setup lang="ts">
import DialogActionBar from "@/components/DialogActionBar.vue";
import type { EmployeePaymentMethod } from "@/plugins/fake-api/handlers/apps/employees/types";
import { ref, watch } from "vue";
import type { VForm } from "vuetify/components/VForm";
import { requiredValidator } from "../../../../@core/utils/validators";

interface Props {
  isDialogVisible: boolean;
  paymentData?: EmployeePaymentMethod | null;
}

interface Emit {
  (e: "submit", value: EmployeePaymentMethod): void;
  (e: "update:isDialogVisible", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const isFormValid = ref(false);
const refForm = ref<VForm | undefined>();

const localPayment = ref<Partial<EmployeePaymentMethod>>({
  type: "Cash",
  bankName: "",
  branchName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swiftCode: "",
});

const paymentTypeOptions = ["Bank Transfer", "Cash"];

const onFormSubmit = async () => {
  const valid = await refForm.value?.validate();
  if (valid?.valid) {
    const submissionData = { ...localPayment.value } as EmployeePaymentMethod;

    // Preserve the id if editing
    if (props.paymentData?.id) {
      submissionData.id = props.paymentData.id;
    }

    emit("submit", submissionData);
    emit("update:isDialogVisible", false);
    resetForm();
  }
};

const resetForm = () => {
  localPayment.value = {
    type: "Cash",
    bankName: "",
    branchName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
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

// Watch for payment data changes to populate form in edit mode
watch(
  [() => props.paymentData, () => props.isDialogVisible],
  ([newPayment, isVisible]) => {
    if (isVisible && newPayment) {
      // Editing existing payment method
      localPayment.value = {
        type: newPayment.type || "Cash",
        bankName: newPayment.bankName || "",
        branchName: newPayment.branchName || "",
        accountName: newPayment.accountName || "",
        accountNumber: newPayment.accountNumber || "",
        iban: newPayment.iban || "",
        swiftCode: newPayment.swiftCode || "",
      };
    } else if (isVisible && !newPayment) {
      // Adding new payment method
      resetForm();
    }
  },
  { immediate: false }
);
</script>

<template>
  <VDialog
    :width="$vuetify.display.smAndDown ? 'auto' : 900"
    :model-value="isDialogVisible"
    @update:model-value="dialogModelValueUpdate"
  >
    <DialogCloseBtn @click="dialogModelValueUpdate(false)" />

    <VCard class="pa-sm-8 pa-4">
      <VCardText style="overflow: visible">
        <h4 class="text-h5 text-center mb-2">
          {{ paymentData ? "Edit Payment Method" : "Add Payment Method" }}
        </h4>
        <p class="text-body-2 text-center mb-6">
          Fill out the form below to
          {{
            paymentData
              ? "update the payment method details."
              : "add a new payment method."
          }}
        </p>
        <VForm
          ref="refForm"
          v-model="isFormValid"
          @submit.prevent="onFormSubmit"
        >
          <VRow>
            <!-- Payment Type -->
            <VCol cols="12">
              <AppSelect
                v-model="localPayment.type"
                label="Payment Type"
                placeholder="Select..."
                :items="paymentTypeOptions"
                :rules="[requiredValidator]"
              />
            </VCol>

            <!-- Bank Fields - Only show if payment type is Bank Transfer -->
            <template v-if="localPayment.type === 'Bank Transfer'">
              <!-- Bank Name -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.bankName"
                  label="Bank Name"
                  placeholder="Enter bank name"
                />
              </VCol>

              <!-- Branch Name -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.branchName"
                  label="Branch Name"
                  placeholder="Enter branch name"
                />
              </VCol>

              <!-- Account Name -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.accountName"
                  label="Account Name"
                  placeholder="Enter account name"
                />
              </VCol>

              <!-- Account Number -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.accountNumber"
                  label="Account Number"
                  placeholder="Enter account number"
                />
              </VCol>

              <!-- IBAN -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.iban"
                  label="IBAN"
                  placeholder="AE07 0331 2345 6789 0123 456"
                />
              </VCol>

              <!-- Swift Code -->
              <VCol cols="12" md="6">
                <AppTextField
                  v-model="localPayment.swiftCode"
                  label="Swift Code"
                  placeholder="EBILAEAD XXX"
                />
              </VCol>
            </template>
          </VRow>
        </VForm>
      </VCardText>

      <VCardText>
        <DialogActionBar
          :save-text="paymentData ? 'Update Payment Method' : 'Add Payment Method'"
          save-type="submit"
          @save="onFormSubmit"
          @cancel="onFormReset"
        />
      </VCardText>
    </VCard>
  </VDialog>
</template>
