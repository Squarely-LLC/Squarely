<script setup lang="ts">
import { computed, nextTick, ref, watch, withDefaults } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type LeavePayload = {
  typeId: string;
  startDate: string | Date | null;
  returnDate: string | Date | null;
  deductible: boolean;
  reason: string;
  file: File | null;
  attachLink: string;
  requestedDays?: number;
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

const emptyForm = (): LeavePayload => ({
  typeId: "",
  startDate: null,
  returnDate: null,
  deductible: false,
  reason: "",
  file: null,
  attachLink: "",
});

const form = ref<LeavePayload>(emptyForm());

const drawerTitle = computed(() =>
  props.leaveData ? "Edit Leave" : "Add Leave"
);

const requestedDays = computed(() => {
  const s = form.value.startDate ? new Date(form.value.startDate) : null;
  const e = form.value.returnDate ? new Date(form.value.returnDate) : null;
  if (!s || !e) return 0;
  // normalize to start of day
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
});

const remainingDays = computed(() => props.availableDays - requestedDays.value);

const hydrateForm = (payload?: LeavePayload | null) => {
  form.value = {
    ...emptyForm(),
    ...(payload ? { ...payload } : {}),
  };
};

const resetForm = () => {
  hydrateForm();
  refForm.value?.reset();
  refForm.value?.resetValidation();
};

watch(
  () => props.isDrawerOpen,
  (v) => {
    if (v) hydrateForm(props.leaveData);
    else nextTick(() => resetForm());
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
                  clearable
                />
              </VCol>

              <VCol cols="12" md="6">
                <AppDateTimePicker
                  v-model="form.startDate"
                  label="Start Date"
                  :config="{ enableTime: false, dateFormat: 'F j, Y' }"
                />
              </VCol>
              <VCol cols="12" md="6">
                <AppDateTimePicker
                  v-model="form.returnDate"
                  label="Return Date"
                  :config="{ enableTime: false, dateFormat: 'F j, Y' }"
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

              <VDivider />

              <VCol cols="12">
                <AppTextField
                  v-model="form.reason"
                  label="Reason"
                  textarea
                  rows="4"
                />
              </VCol>

              <VCol cols="12">
                <VFileInput v-model="form.file" label="Attach File" show-size />
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
