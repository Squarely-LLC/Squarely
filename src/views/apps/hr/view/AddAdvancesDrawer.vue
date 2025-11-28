<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import { computed, nextTick, ref, watch, withDefaults } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type AdvancePayload = {
  advanceType: string;
  date: string | null;
  amount: string;
  payBackInMonths: string;
  startOfPaymentPeriod: string;
  notes: string;
  file: File | null;
  attachLink: string;
};

const props = withDefaults(
  defineProps<{
    advanceData?: AdvancePayload | null;
    isDrawerOpen: boolean;
  }>(),
  {
    advanceData: null,
  }
);

const emit = defineEmits<{
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "close"): void;
  (e: "submit", payload: AdvancePayload): void;
}>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const advanceTypeOptions = [
  { title: "Salary Advance", value: "salary-advance" },
  { title: "Emergency", value: "emergency" },
  { title: "Personal", value: "personal" },
  { title: "Other", value: "other" },
];

const emptyForm = (): AdvancePayload => {
  return {
    advanceType: "",
    date: null,
    amount: "",
    payBackInMonths: "",
    startOfPaymentPeriod: "",
    notes: "",
    file: null,
    attachLink: "",
  };
};

const form = ref<AdvancePayload>(emptyForm());
const pickerRenderKey = ref(0);

const toIsoDateString = (value: any): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const drawerTitle = computed(() =>
  props.advanceData ? "Edit Advance" : "Add Advance"
);

const datePickerConfig = computed(() => ({
  enableTime: false,
  dateFormat: "Y-m-d",
  altInput: true,
  altFormat: "F j, Y",
  allowInput: true,
  position: "auto",
  positionElement: undefined,
  onReady: (selectedDates: any, dateStr: any, instance: any) => {
    if (instance.calendarContainer) {
      instance.calendarContainer.style.position = "fixed";
    }
  },
}));

const hydrateForm = (payload?: AdvancePayload | null) => {
  form.value = {
    ...emptyForm(),
    ...(payload
      ? {
          ...payload,
          date: toIsoDateString(payload.date),
        }
      : {}),
  };
};

const resetForm = () => {
  hydrateForm();
  refForm.value?.reset();
  refForm.value?.resetValidation();
  pickerRenderKey.value++;
};

watch(
  () => props.isDrawerOpen,
  (v) => {
    if (v) {
      hydrateForm(props.advanceData);
      pickerRenderKey.value++;
      nextTick(() => {
        refForm.value?.resetValidation();
      });
    } else {
      nextTick(() => resetForm());
    }
  },
  { immediate: true }
);

watch(
  () => props.advanceData,
  (payload) => {
    if (props.isDrawerOpen) hydrateForm(payload);
  }
);

function handleDrawerModelValueUpdate(val: boolean) {
  emit("update:isDrawerOpen", val);
  if (!val) {
    emit("close");
    nextTick(() => resetForm());
  }
  if (val && props.advanceData) {
    hydrateForm(props.advanceData);
  }
}

function closeDrawer() {
  emit("update:isDrawerOpen", false);
  emit("close");
  nextTick(() => resetForm());
}

async function onSubmit() {
  const { valid } = await (refForm.value?.validate() ??
    Promise.resolve({ valid: true }));
  if (!valid) return;

  const payload: AdvancePayload = {
    ...form.value,
  };

  emit("submit", payload);
  emit("update:isDrawerOpen", false);
  nextTick(() => resetForm());
}
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    location="end"
    :width="400"
    :scrim="false"
    class="scrollable-content"
    style="z-index: 2000"
    :model-value="props.isDrawerOpen"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <AppDrawerHeaderSection :title="drawerTitle" @cancel="closeDrawer" />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <VRow>
              <VCol cols="12">
                <AppSelect
                  v-model="form.advanceType"
                  :items="advanceTypeOptions"
                  label="Advance Type"
                  placeholder="Select Type"
                  :rules="[requiredValidator]"
                  clearable
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  :key="`date-${pickerRenderKey}`"
                  v-model="form.date"
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  :rules="[requiredValidator]"
                  :config="datePickerConfig"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="form.amount"
                  label="Amount"
                  placeholder="0"
                  type="number"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppTextField
                  v-model="form.payBackInMonths"
                  label="Pay Back in Months"
                  placeholder="0"
                  type="number"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="form.startOfPaymentPeriod"
                  label="Start of Payment Period"
                  placeholder="December - 2025"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="form.notes"
                  label="Notes"
                  placeholder="Enter notes"
                  textarea
                  rows="4"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput
                  v-model="form.file"
                  label="Attach File"
                  placeholder="Choose a file"
                  show-size
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="form.attachLink"
                  label="Attach Link"
                  placeholder="https://docs.google.com/"
                />
                <p class="text-caption text-disabled mt-1">
                  Paste the file URL from any external drive.
                </p>
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">Submit</VBtn>
                <VBtn
                  type="button"
                  variant="tonal"
                  color="error"
                  @click="closeDrawer"
                >
                  Cancel
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>

<style scoped>
.text-caption {
  font-size: 0.75rem;
}
</style>
