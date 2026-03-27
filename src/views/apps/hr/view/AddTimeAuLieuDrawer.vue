<script setup lang="ts">
import { requiredValidator } from "@/@core/utils/validators";
import { computed, nextTick, ref, watch } from "vue";
import { PerfectScrollbar } from "vue3-perfect-scrollbar";
import type { VForm } from "vuetify/components/VForm";

type TimeAuLieuPayload = {
  numberOfDays: string;
  date: string | null;
  relatedType: string;
  relatedId: string;
  note: string;
};

const props = withDefaults(
  defineProps<{
    timeAuLieuData?: TimeAuLieuPayload | null;
    isDrawerOpen: boolean;
  }>(),
  {
    timeAuLieuData: null,
  }
);

const emit = defineEmits<{
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "close"): void;
  (e: "submit", payload: TimeAuLieuPayload): void;
}>();

const refForm = ref<VForm>();
const isFormValid = ref(false);

const relatedTypeOptions = [
  { title: "Not Linked", value: "not-linked" },
  { title: "Leave", value: "leave" },
  { title: "Overtime", value: "overtime" },
  { title: "Project", value: "project" },
];

const emptyForm = (): TimeAuLieuPayload => {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return {
    numberOfDays: "1",
    date: todayISO,
    relatedType: "not-linked",
    relatedId: "",
    note: "",
  };
};

const form = ref<TimeAuLieuPayload>(emptyForm());
const pickerRenderKey = ref(0);

const toIsoDateString = (value: any): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const drawerTitle = computed(() =>
  props.timeAuLieuData ? "Edit Time au Lieu" : "Add Time au Lieu"
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

const hydrateForm = (payload?: TimeAuLieuPayload | null) => {
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
      hydrateForm(props.timeAuLieuData);
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
  () => props.timeAuLieuData,
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
  if (val && props.timeAuLieuData) {
    hydrateForm(props.timeAuLieuData);
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

  const payload: TimeAuLieuPayload = {
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
                <AppTextField
                  v-model="form.numberOfDays"
                  label="Nb. of Days"
                  placeholder="1"
                  type="number"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12">
                <AppDateTimePicker
                  :key="`date-${pickerRenderKey}`"
                  v-model="form.date"
                  label="Date"
                  placeholder="November 28, 2025"
                  :rules="[requiredValidator]"
                  :config="datePickerConfig"
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="form.relatedType"
                  :items="relatedTypeOptions"
                  label="Related To"
                  placeholder="Not Linked"
                  clearable
                />
              </VCol>

              <VCol cols="12">
                <AppSelect
                  v-model="form.relatedId"
                  :items="[]"
                  label="Select.."
                  placeholder="Select related item"
                  clearable
                  :disabled="form.relatedType === 'not-linked'"
                />
              </VCol>

              <VCol cols="12">
                <AppTextField
                  v-model="form.note"
                  label="Note"
                  placeholder="Enter note"
                  textarea
                  rows="4"
                />
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
