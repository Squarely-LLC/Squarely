<script setup lang="ts">
import { PerfectScrollbar } from "vue3-perfect-scrollbar";

import type { VForm } from "vuetify/components/VForm";

import type { CustomInputContent } from "@core/types";
import type { UserProperties } from "@db/apps/users/types";

const checkboxContent: CustomInputContent[] = [
  {
    title: "Task 1",

    desc: "This is task 1, it's completed",
    value: "discount",
  },
  {
    title: "Task 2",

    desc: "This is task 2.",
    value: "updates",
  },
  {
    title: "Task 3",

    desc: "This is task 3.",
    value: "task3",
  },
];

const selectedCheckbox = ref(["discount"]);

interface Emit {
  (e: "update:isDrawerOpen", value: boolean): void;
  (e: "userData", value: UserProperties): void;
}

const isActive = ref(["notifications"]);

interface Props {
  isDrawerOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<Emit>();

const isFormValid = ref(false);
const refForm = ref<VForm>();
const fullName = ref("");
const userName = ref("");
const email = ref("");
const company = ref("");
const country = ref();
const contact = ref("");
const role = ref();
const plan = ref();
const status = ref();

// 👉 drawer close
const closeNavigationDrawer = () => {
  emit("update:isDrawerOpen", false);

  nextTick(() => {
    refForm.value?.reset();
    refForm.value?.resetValidation();
  });
};

const onSubmit = () => {
  refForm.value?.validate().then(({ valid }) => {
    if (valid) {
      emit("userData", {
        id: 0,
        fullName: fullName.value,
        company: company.value,
        role: role.value,
        country: country.value,
        contact: contact.value,
        email: email.value,
        currentPlan: plan.value,
        status: status.value,
        avatar: "",
        billing: "Auto Debit",
      });
      emit("update:isDrawerOpen", false);
      nextTick(() => {
        refForm.value?.reset();
        refForm.value?.resetValidation();
      });
    }
  });
};

const handleDrawerModelValueUpdate = (val: boolean) => {
  emit("update:isDrawerOpen", val);
};
</script>

<template>
  <VNavigationDrawer
    data-allow-mismatch
    temporary
    :width="400"
    location="end"
    class="scrollable-content"
    :model-value="props.isDrawerOpen"
    @update:model-value="handleDrawerModelValueUpdate"
  >
    <!-- 👉 Title -->
    <AppDrawerHeaderSection title="Tasks" @cancel="closeNavigationDrawer" />

    <VDivider />

    <PerfectScrollbar :options="{ wheelPropagation: false }">
      <VCard flat>
        <VCardText>
          <!-- 👉 Form -->
          <VForm ref="refForm" v-model="isFormValid" @submit.prevent="onSubmit">
            <CustomCheckboxes
              v-model:selected-checkbox="selectedCheckbox"
              :checkbox-content="checkboxContent"
              :grid-column="{ sm: '12', cols: '12' }"
            />
          </VForm>
        </VCardText>
      </VCard>
    </PerfectScrollbar>
  </VNavigationDrawer>
</template>
