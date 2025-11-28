<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import { computed, nextTick, ref, watch, withDefaults } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type LeavePayload = {
  typeId: string;
  startDate: string | null;
  returnDate: string | null;
  deductible: boolean;
  reason: string;
  file: File | null;
  attachLink: string;
  requestedDays?: number;
  period?: string;
  periodId?: string;
  deductionAmount?: string;
};

const props = withDefaults(
  defineProps<{
    employeeName?: string;
    availableDays?: number;
    leaveData?: LeavePayload | null;
    isDrawerOpen: boolean;
  }>(),
  {
    employeeName: "",
    availableDays: 0,
    leaveData: null,
  }
);

const emit = defineEmits<{
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "close"): void;
  (e: "submit", payload: LeavePayload): void;
}>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const typeOptions = [
  { title: "Vacation", value: "vacation" },
  { title: "Sick Leave", value: "sick-leave" },
  { title: "Parental Leave", value: "parental-leave" },
];

const emptyForm = (): LeavePayload => {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return {
    typeId: "",
    startDate: todayISO,
    returnDate: null,
    deductible: false,
    reason: "",
    file: null,
    attachLink: "",
    periodId: "",
    deductionAmount: "",
  };
};

const form = ref<LeavePayload>(emptyForm());
const pickerRenderKey = ref(0);

const toIsoDateString = (value: any): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const drawerTitle = computed(() =>
  props.leaveData ? "Edit Leave" : "Add Leave"
);

const requestedDays = computed(() => {
  const s = form.value.startDate
    ? new Date(String(form.value.startDate))
    : null;
  const e = form.value.returnDate
    ? new Date(String(form.value.returnDate))
    : null;
  if (!s || !e) return 0;
  // normalize to start of day
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
});

const remainingDays = computed(() => props.availableDays - requestedDays.value);

const datePickerConfig = computed(() => ({
  enableTime: false,
  dateFormat: "Y-m-d", // model stays ISO-like
  altInput: true,
  altFormat: "F j, Y",
  allowInput: true,
  position: "auto",
  positionElement: undefined,
  onReady: (selectedDates: any, dateStr: any, instance: any) => {
    // Ensure calendar is positioned relative to drawer, not body scroll
    if (instance.calendarContainer) {
      instance.calendarContainer.style.position = "fixed";
    }
  },
}));

const periodLabel = computed(() => {
  const start = form.value.startDate
    ? new Date(String(form.value.startDate))
    : null;
  const end = form.value.returnDate
    ? new Date(String(form.value.returnDate))
    : null;
  if (
    start &&
    end &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime())
  ) {
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameYear && !sameMonth) {
      const startLabel = start.toLocaleDateString("en-US", {
        month: "short",
      });
      const endLabel = end.toLocaleDateString("en-US", {
        month: "short",
      });
      return `${startLabel}-${endLabel} ${start.getFullYear()}`;
    }
    const startLabel = start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const endLabel = end.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }
  if (start && !Number.isNaN(start.getTime())) {
    return start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return undefined;
});

const hydrateForm = (payload?: LeavePayload | null) => {
  form.value = {
    ...emptyForm(),
    ...(payload
      ? {
          ...payload,
          startDate: toIsoDateString(payload.startDate),
          returnDate: toIsoDateString(payload.returnDate),
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
      hydrateForm(props.leaveData);
      pickerRenderKey.value++; // force fresh flatpickr instances per open
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
  () => props.leaveData,
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
  if (val && props.leaveData) {
    hydrateForm(props.leaveData);
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
  if (!form.value.typeId) return;
  if (!form.value.startDate || !form.value.returnDate) return;

  const payload: LeavePayload = {
    ...form.value,
    requestedDays: requestedDays.value,
    // derive period from start/end to keep table aligned
    ...(periodLabel.value ? { period: periodLabel.value } : {}),
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
                  v-model="form.typeId"
                  :items="typeOptions"
                  label="Type"
                  placeholder="Select Type"
                  :rules="[requiredValidator]"
                  clearable
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppDateTimePicker
                  :key="`start-${pickerRenderKey}`"
                  v-model="form.startDate"
                  label="Start Date"
                  placeholder="Select start date"
                  :rules="[requiredValidator]"
                  :config="datePickerConfig"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppDateTimePicker
                  :key="`return-${pickerRenderKey}`"
                  v-model="form.returnDate"
                  label="Return Date"
                  placeholder="Select return date"
                  :rules="[requiredValidator]"
                  :config="datePickerConfig"
                />
              </VCol>

              <VCol cols="12">
                <div class="d-flex align-center justify-space-between">
                  <div>
                    Available:
                    <span class="text-medium-emphasis">{{
                      props.availableDays
                    }}</span>
                  </div>
                  <div>
                    Requested:
                    <span class="text-medium-emphasis">{{
                      requestedDays
                    }}</span>
                  </div>
                  <div>
                    Remaining:
                    <span :class="{ 'text-error': remainingDays < 0 }">{{
                      remainingDays
                    }}</span>
                  </div>
                </div>
              </VCol>

              <VCol cols="12">
                <div class="d-flex align-center gap-3">
                  <span>Deductible</span>
                  <VSwitch v-model="form.deductible" />
                </div>
              </VCol>

              <template v-if="form.deductible">
                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="form.periodId"
                    label="Period ID"
                    placeholder="December - 2025"
                  />
                </VCol>

                <VCol cols="12" md="6">
                  <AppTextField
                    v-model="form.deductionAmount"
                    label="Deduction Amount"
                    placeholder="Enter amount"
                    type="number"
                  />
                </VCol>
              </template>

              <VDivider />

              <VCol cols="12">
                <AppTextField
                  v-model="form.reason"
                  label="Reason"
                  placeholder="Enter reason for leave"
                  :rules="[requiredValidator]"
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
                  placeholder="https://"
                />
              </VCol>

              <VCol cols="12">
                <VBtn type="submit" class="me-3">Save</VBtn>
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
.text-error {
  color: var(--v-theme-error) !important;
}
</style>
