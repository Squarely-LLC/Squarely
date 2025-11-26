<script lang="ts" setup>
import type { EmployeeProperties } from "@/plugins/fake-api/handlers/apps/employees/types";
import { useConfigStore } from "@/stores/config";
import { computed, ref } from "vue";

interface Props {
  userData: EmployeeProperties;
}

const props = defineProps<Props>();

const configStore = useConfigStore();
configStore.init();

const localContract = ref({
  salaryPaid: props.userData.employment?.contract?.salaryPaid || null,
  employmentType: props.userData.employment?.contract?.employmentType || null,
  startDate: props.userData.employment?.contract?.startDate || null,
  probationEndDate:
    props.userData.employment?.contract?.probationEndDate || null,
  firstPayroll: props.userData.employment?.contract?.firstPayroll || null,
  note: props.userData.employment?.contract?.note || "",
});

const localEmployment = ref({
  department: props.userData.employment?.department || null,
});

const departmentOptions = computed(() => {
  const departments = configStore.configurations?.hr?.departments;
  if (!departments || departments.length === 0) {
    console.error("HR departments not configured in config store");
    return [];
  }
  return departments;
});

const salaryPaidOptions = ["Monthly", "Weekly"];

const employmentTypeOptions = [
  "Full-Time",
  "Part-Time",
  "Contract",
  "Freelance",
  "Intern",
];
</script>

<template>
  <VCard class="user-tab-notification" title="Employment">
    <VCardText>
      <VAlert
        v-if="!departmentOptions.length"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        HR departments are not configured. Please configure departments in the
        system settings.
      </VAlert>
      <VRow>
        <VCol cols="12" md="12">
          <AppSelect
            v-model="localEmployment.department"
            label="Department"
            placeholder="Select Department"
            :items="departmentOptions"
            :disabled="!departmentOptions.length"
          />
        </VCol>

        <VDivider />

        <!-- show alert here -->
        <VCol v-if="!props.userData.employment?.contract" cols="12">
          <VAlert type="warning" variant="tonal" class="mb-4">
            This employee doesn't have a contract yet. Create a new contract to
            proceed.
          </VAlert>

          <VBtn color="primary">Hire</VBtn>
        </VCol>

        <template v-else>
          <!-- Existing contract fields go here -->
        </template>
      </VRow>
    </VCardText>

    <VCardText class="d-flex flex-wrap gap-4">
      <VBtn>Save changes</VBtn>
      <VBtn color="secondary" variant="tonal"> Discard </VBtn>
    </VCardText>
  </VCard>
</template>
