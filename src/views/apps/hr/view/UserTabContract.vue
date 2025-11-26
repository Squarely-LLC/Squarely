<script lang="ts" setup>
import type {
  EmployeeContract,
  EmployeeProperties,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useConfigStore } from "@/stores/config";
import { useEmployeesStore } from "@/stores/employees";
import { computed, ref } from "vue";
import AddNewContractDialog from "./AddNewContractDialog.vue";
import TerminateContractDialog from "./TerminateContractDialog.vue";

interface Props {
  userData: EmployeeProperties;
}

const props = defineProps<Props>();

const configStore = useConfigStore();
configStore.init();

const employeesStore = useEmployeesStore();
employeesStore.init();

const isAddContractDialogVisible = ref(false);
const isTerminateDialogVisible = ref(false);
const selectedContractId = ref<number | null>(null);

const localEmployment = ref({
  department: props.userData.employment?.department || null,
});

// Get all contracts (support both old single contract and new contracts array)
const allContracts = computed(() => {
  const contracts: EmployeeContract[] = [];

  // Add contracts from contracts array
  if (props.userData.employment?.contracts) {
    contracts.push(...props.userData.employment.contracts);
  }

  // Add old single contract if exists and not already in contracts array
  if (props.userData.employment?.contract) {
    const existsInArray = contracts.some(
      (c) => c.startDate === props.userData.employment?.contract?.startDate
    );
    if (!existsInArray) {
      contracts.push(props.userData.employment.contract);
    }
  }

  // Sort by createdAt descending (newest first)
  return contracts.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
});

const activeContract = computed(() =>
  allContracts.value.find((c) => c.status !== "Terminated")
);

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

const onContractSubmit = (contract: EmployeeContract) => {
  const currentContracts = props.userData.employment?.contracts || [];
  const newContractId =
    currentContracts.length > 0
      ? Math.max(...currentContracts.map((c) => c.id || 0)) + 1
      : 1;

  const newContract: EmployeeContract = {
    ...contract,
    id: newContractId,
    status: "Active",
    createdAt: new Date().toISOString(),
  };

  // Update the employee with the new contract and set status to Active
  employeesStore.updateEmployee(props.userData.id, {
    status: "Active",
    employment: {
      ...props.userData.employment,
      contracts: [...currentContracts, newContract],
    },
  });
};

const saveDepartmentChanges = () => {
  employeesStore.updateEmployee(props.userData.id, {
    employment: {
      ...props.userData.employment,
      department: localEmployment.value.department || undefined,
    },
  });
};

const discardChanges = () => {
  localEmployment.value.department =
    props.userData.employment?.department || null;
};

const editContract = (contractId: number) => {
  selectedContractId.value = contractId;
  isAddContractDialogVisible.value = true;
};

const terminateContract = (contractId: number) => {
  selectedContractId.value = contractId;
  isTerminateDialogVisible.value = true;
};

const selectedContract = computed(
  () =>
    allContracts.value.find((c) => c.id === selectedContractId.value) || null
);

const onTerminationSubmit = (terminationData: any) => {
  const currentContracts = props.userData.employment?.contracts || [];
  const updatedContracts = currentContracts.map((c) => {
    if (c.id === selectedContractId.value) {
      return {
        ...c,
        status: "Terminated" as const,
        termination: {
          noticePeriod: terminationData.noticePeriod,
          terminationType: terminationData.terminationType,
          note: terminationData.note,
          lastDayAtWork: terminationData.lastDayAtWork,
          lastPayrollPeriod: terminationData.lastPayrollPeriod,
          fileUrl: terminationData.file
            ? URL.createObjectURL(terminationData.file)
            : undefined,
          attachmentLink: terminationData.attachmentLink,
          terminatedAt: new Date().toISOString(),
        },
      };
    }
    return c;
  });

  // Check if there are any active contracts remaining
  const hasActiveContract = updatedContracts.some(
    (c) => c.status !== "Terminated"
  );

  // Update employee with new contracts and status
  employeesStore.updateEmployee(props.userData.id, {
    status: hasActiveContract ? "Active" : "Not Hired",
    employment: {
      ...props.userData.employment,
      contracts: updatedContracts,
    },
  });

  selectedContractId.value = null;
};
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

        <VCol cols="12">
          <h5 class="text-h5">Contract</h5>
        </VCol>

        <!-- show alert here -->
        <VCol v-if="allContracts.length === 0" cols="12">
          <VAlert color="warning" variant="tonal" class="mb-4">
            This employee doesn't have a contract yet. Create a new contract to
            proceed.
          </VAlert>
          <div class="d-flex justify-end">
            <VBtn size="small" @click="isAddContractDialogVisible = true">
              <VIcon start icon="tabler-contract" />
              Hire
            </VBtn>
          </div>
        </VCol>

        <template v-else>
          <VCol cols="12">
            <VExpansionPanels>
              <VExpansionPanel
                v-for="contract in allContracts"
                :key="contract.id"
              >
                <VExpansionPanelTitle>
                  <div class="d-flex align-center gap-3 w-100">
                    <!-- Status Indicator -->
                    <div
                      :class="[
                        'rounded-circle',
                        contract.status === 'Terminated'
                          ? 'bg-error'
                          : 'bg-success',
                      ]"
                      :style="{
                        inlineSize: '12px',
                        blockSize: '12px',
                        minInlineSize: '12px',
                      }"
                    />

                    <!-- Contract Info -->
                    <div class="flex-grow-1">
                      <div class="font-weight-medium">
                        {{ contract.employmentType || "Contract" }} -
                        {{ contract.salaryPaid || "N/A" }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        Started: {{ contract.startDate || "Not specified" }}
                        <span v-if="contract.status === 'Terminated'">
                          | Terminated:
                          {{
                            contract.termination?.terminatedAt
                              ? new Date(
                                  contract.termination.terminatedAt
                                ).toLocaleDateString()
                              : "N/A"
                          }}
                        </span>
                      </div>
                    </div>

                    <!-- Status Badge -->
                    <VChip
                      :color="
                        contract.status === 'Terminated' ? 'error' : 'success'
                      "
                      size="small"
                      variant="tonal"
                    >
                      {{ contract.status || "Active" }}
                    </VChip>

                    <!-- Action Buttons -->
                    <div
                      v-if="contract.status !== 'Terminated'"
                      class="d-flex gap-2"
                      @click.stop
                    >
                      <VBtn
                        size="x-small"
                        variant="text"
                        icon
                        @click="editContract(contract.id!)"
                      >
                        <VIcon icon="tabler-edit" size="20" />
                        <VTooltip activator="parent" location="top">
                          Edit Contract
                        </VTooltip>
                      </VBtn>
                      <VBtn
                        size="x-small"
                        variant="text"
                        icon
                        color="error"
                        @click="terminateContract(contract.id!)"
                      >
                        <VIcon icon="tabler-ban" size="20" />
                        <VTooltip activator="parent" location="top">
                          Terminate Contract
                        </VTooltip>
                      </VBtn>
                    </div>
                  </div>
                </VExpansionPanelTitle>

                <VExpansionPanelText>
                  <VCard variant="outlined" class="pa-4">
                    <VRow>
                      <!-- Contract Details -->
                      <VCol cols="12" md="6">
                        <div class="mb-4">
                          <p class="text-caption text-medium-emphasis mb-1">
                            Salary Paid
                          </p>
                          <p class="text-body-1 font-weight-medium">
                            {{ contract.salaryPaid || "Not specified" }}
                          </p>
                        </div>
                      </VCol>

                      <VCol cols="12" md="6">
                        <div class="mb-4">
                          <p class="text-caption text-medium-emphasis mb-1">
                            Employment Type
                          </p>
                          <p class="text-body-1 font-weight-medium">
                            {{ contract.employmentType || "Not specified" }}
                          </p>
                        </div>
                      </VCol>

                      <VCol cols="12" md="6">
                        <div class="mb-4">
                          <p class="text-caption text-medium-emphasis mb-1">
                            Start Date
                          </p>
                          <p class="text-body-1 font-weight-medium">
                            {{ contract.startDate || "Not specified" }}
                          </p>
                        </div>
                      </VCol>

                      <VCol cols="12" md="6">
                        <div class="mb-4">
                          <p class="text-caption text-medium-emphasis mb-1">
                            Probation End Date
                          </p>
                          <p class="text-body-1 font-weight-medium">
                            {{ contract.probationEndDate || "Not specified" }}
                          </p>
                        </div>
                      </VCol>

                      <VCol cols="12" md="6">
                        <div class="mb-4">
                          <p class="text-caption text-medium-emphasis mb-1">
                            First Payroll
                          </p>
                          <p class="text-body-1 font-weight-medium">
                            {{ contract.firstPayroll || "Not specified" }}
                          </p>
                        </div>
                      </VCol>

                      <VCol cols="12">
                        <VDivider class="my-2" />
                      </VCol>

                      <VCol cols="12">
                        <div>
                          <p class="text-caption text-medium-emphasis mb-1">
                            Note
                          </p>
                          <p class="text-body-2">
                            {{ contract.note || "No additional notes" }}
                          </p>
                        </div>
                      </VCol>

                      <!-- Termination Details if Terminated -->
                      <template
                        v-if="
                          contract.status === 'Terminated' &&
                          contract.termination
                        "
                      >
                        <VCol cols="12">
                          <VDivider class="my-2" />
                        </VCol>

                        <VCol cols="12">
                          <h6 class="text-h6 mb-3">Termination Details</h6>
                        </VCol>

                        <VCol cols="12" md="6">
                          <div class="mb-4">
                            <p class="text-caption text-medium-emphasis mb-1">
                              Termination Type
                            </p>
                            <p class="text-body-1 font-weight-medium">
                              {{
                                contract.termination.terminationType ||
                                "Not specified"
                              }}
                            </p>
                          </div>
                        </VCol>

                        <VCol cols="12" md="6">
                          <div class="mb-4">
                            <p class="text-caption text-medium-emphasis mb-1">
                              Last Day at Work
                            </p>
                            <p class="text-body-1 font-weight-medium">
                              {{
                                contract.termination.lastDayAtWork ||
                                "Not specified"
                              }}
                            </p>
                          </div>
                        </VCol>

                        <VCol v-if="contract.termination.note" cols="12">
                          <div>
                            <p class="text-caption text-medium-emphasis mb-1">
                              Termination Note
                            </p>
                            <p class="text-body-2">
                              {{ contract.termination.note }}
                            </p>
                          </div>
                        </VCol>
                      </template>

                      <VCol cols="12">
                        <div class="d-flex justify-end gap-3 mt-4">
                          <VBtn
                            v-if="contract.status !== 'Terminated'"
                            size="small"
                            variant="tonal"
                            @click="editContract(contract.id!)"
                          >
                            <VIcon start icon="tabler-edit" />
                            Edit Contract
                          </VBtn>
                          <VBtn
                            v-if="contract.status !== 'Terminated'"
                            size="small"
                            variant="tonal"
                            color="error"
                            @click="terminateContract(contract.id!)"
                          >
                            <VIcon start icon="tabler-ban" />
                            Terminate
                          </VBtn>
                        </div>
                      </VCol>
                    </VRow>
                  </VCard>
                </VExpansionPanelText>
              </VExpansionPanel>
            </VExpansionPanels>

            <!-- Add New Contract Button -->
            <div v-if="!activeContract" class="d-flex justify-end mt-4">
              <VBtn size="small" @click="isAddContractDialogVisible = true">
                <VIcon start icon="tabler-contract" />
                Add New Contract
              </VBtn>
            </div>
          </VCol>
        </template>
      </VRow>
    </VCardText>

    <VCardText v-if="localEmployment.department" class="d-flex flex-wrap gap-4">
      <VBtn @click="saveDepartmentChanges">Save changes</VBtn>
      <VBtn color="secondary" variant="tonal" @click="discardChanges">
        Discard
      </VBtn>
    </VCardText>
  </VCard>

  <!-- Add New Contract Dialog -->
  <AddNewContractDialog
    v-model:is-dialog-visible="isAddContractDialogVisible"
    :contract-data="selectedContract"
    @submit="onContractSubmit"
  />

  <!-- Terminate Contract Dialog -->
  <TerminateContractDialog
    v-model:is-dialog-visible="isTerminateDialogVisible"
    @submit="onTerminationSubmit"
  />
</template>
