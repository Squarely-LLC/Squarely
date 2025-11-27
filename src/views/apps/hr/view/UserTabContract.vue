<script lang="ts" setup>
// ==================== IMPORTS ====================
import type {
  EmployeeContract,
  EmployeePosition,
  EmployeeProperties,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useConfigStore } from "@/stores/config";
import type { EmployeeSalaryRecord } from "@/stores/employees";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import { computed, ref } from "vue";
import AddNewContractDialog from "./AddNewContractDialog.vue";
import AddPositionDialog from "./AddPositionDialog.vue";
import AddSalaryRaiseDialog from "./AddSalaryRaiseDialog.vue";
import TerminateContractDialog from "./TerminateContractDialog.vue";

// ==================== PROPS & STORES ====================
interface Props {
  userData: EmployeeProperties;
}

const props = defineProps<Props>();

const configStore = useConfigStore();
configStore.init();

const employeesStore = useEmployeesStore();
employeesStore.init();

const notifications = useNotificationsStore();

// ==================== STATE ====================
const isAddContractDialogVisible = ref(false);
const isTerminateDialogVisible = ref(false);
const isAddPositionDialogVisible = ref(false);
const isAddSalaryDialogVisible = ref(false);
const confirmDeletePositionVisible = ref(false);
const confirmDeleteSalaryVisible = ref(false);
const selectedContractId = ref<number | null>(null);
const selectedPositionId = ref<number | null>(null);
const selectedSalaryId = ref<number | null>(null);
const deletePositionCandidateId = ref<number | null>(null);
const deleteSalaryCandidateId = ref<number | null>(null);

const localEmployment = ref({
  department: props.userData.employment?.department || null,
});

// ==================== COMPUTED PROPERTIES ====================
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

const allPositions = computed(() => {
  const positions = props.userData.employment?.positions || [];

  // Sort positions by starting date (most recent first)
  return [...positions].sort((a, b) => {
    const dateA = new Date(a.startingDate).getTime();
    const dateB = new Date(b.startingDate).getTime();
    return dateB - dateA; // descending order
  });
});

const currentPositionId = computed(() => {
  // The first position in the sorted list is the current one
  return allPositions.value[0]?.id || null;
});

const allSalaries = computed(() => {
  const salaries = props.userData.salary?.history || [];

  // Sort salaries by date (most recent first)
  return [...salaries].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // descending order
  });
});

const currentSalaryId = computed(() => {
  // The first salary in the sorted list is the current one
  return allSalaries.value[0]?.id || null;
});

const selectedSalary = computed(
  () => allSalaries.value.find((s) => s.id === selectedSalaryId.value) || null
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

// ==================== CONTRACT FUNCTIONS ====================
const onContractSubmit = (contract: EmployeeContract) => {
  const currentContracts = props.userData.employment?.contracts || [];

  if (selectedContractId.value) {
    // Edit existing contract
    const updatedContracts = currentContracts.map((c) =>
      c.id === selectedContractId.value ? { ...c, ...contract } : c
    );

    employeesStore.updateEmployee(props.userData.id, {
      employment: {
        ...props.userData.employment,
        contracts: updatedContracts,
      },
    });

    notifications.push("Contract updated successfully", "success", 3500);
  } else {
    // Add new contract
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

    notifications.push("Contract added successfully", "success", 3500);
  }

  selectedContractId.value = null;
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

const openAddContractDialog = () => {
  selectedContractId.value = null;
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

const selectedPosition = computed(
  () =>
    allPositions.value.find((p) => p.id === selectedPositionId.value) || null
);

// ==================== POSITION FUNCTIONS ====================
const onPositionSubmit = (
  position: Omit<EmployeePosition, "id" | "createdAt">
) => {
  const currentPositions = props.userData.employment?.positions || [];

  if (selectedPositionId.value) {
    // Edit existing position
    const updatedPositions = currentPositions.map((p) =>
      p.id === selectedPositionId.value ? { ...p, ...position } : p
    );

    employeesStore.updateEmployee(props.userData.id, {
      employment: {
        ...props.userData.employment,
        positions: updatedPositions,
      },
    });

    notifications.push("Position updated successfully", "success", 3500);
  } else {
    // Add new position
    const newPositionId =
      currentPositions.length > 0
        ? Math.max(...currentPositions.map((p) => p.id || 0)) + 1
        : 1;

    const newPosition: EmployeePosition = {
      ...position,
      id: newPositionId,
      createdAt: new Date().toISOString(),
    };

    employeesStore.updateEmployee(props.userData.id, {
      employment: {
        ...props.userData.employment,
        positions: [...currentPositions, newPosition],
      },
    });

    notifications.push("Position added successfully", "success", 3500);
  }

  selectedPositionId.value = null;
};

const editPosition = (positionId: number) => {
  selectedPositionId.value = positionId;
  isAddPositionDialogVisible.value = true;
};

const deletePosition = (positionId: number) => {
  deletePositionCandidateId.value = positionId;
  confirmDeletePositionVisible.value = true;
};

const performDeletePosition = () => {
  const positionId = deletePositionCandidateId.value;
  if (positionId === null) return;

  const currentPositions = props.userData.employment?.positions || [];
  const updatedPositions = currentPositions.filter((p) => p.id !== positionId);

  employeesStore.updateEmployee(props.userData.id, {
    employment: {
      ...props.userData.employment,
      positions: updatedPositions,
    },
  });

  notifications.push("Position deleted successfully", "success", 3500);
  confirmDeletePositionVisible.value = false;
  deletePositionCandidateId.value = null;
};

const cancelDeletePosition = () => {
  confirmDeletePositionVisible.value = false;
  deletePositionCandidateId.value = null;
};

const openAddPositionDialog = () => {
  selectedPositionId.value = null;
  isAddPositionDialogVisible.value = true;
};

// ==================== SALARY FUNCTIONS ====================
const onSalarySubmit = (
  salary: Omit<EmployeeSalaryRecord, "id" | "createdAt">
) => {
  const currentSalaries = props.userData.salary?.history || [];

  if (selectedSalaryId.value) {
    // Edit existing salary
    const updatedSalaries = currentSalaries.map((s) =>
      s.id === selectedSalaryId.value ? { ...s, ...salary } : s
    );

    employeesStore.updateEmployee(props.userData.id, {
      salary: {
        currency: props.userData.salary?.currency || "USD",
        history: updatedSalaries,
      },
    });

    notifications.push("Salary updated successfully", "success", 3500);
  } else {
    // Add new salary
    const newSalaryId =
      currentSalaries.length > 0
        ? Math.max(...currentSalaries.map((s) => s.id || 0)) + 1
        : 1;

    const newSalary: EmployeeSalaryRecord = {
      ...salary,
      id: newSalaryId,
      createdAt: new Date().toISOString(),
    };

    employeesStore.updateEmployee(props.userData.id, {
      salary: {
        currency: props.userData.salary?.currency || "USD",
        history: [...currentSalaries, newSalary],
      },
    });

    notifications.push("Salary added successfully", "success", 3500);
  }

  selectedSalaryId.value = null;
};

const editSalary = (salaryId: number) => {
  selectedSalaryId.value = salaryId;
  isAddSalaryDialogVisible.value = true;
};

const deleteSalary = (salaryId: number) => {
  deleteSalaryCandidateId.value = salaryId;
  confirmDeleteSalaryVisible.value = true;
};

const performDeleteSalary = () => {
  const salaryId = deleteSalaryCandidateId.value;
  if (salaryId === null) return;

  const currentSalaries = props.userData.salary?.history || [];
  const updatedSalaries = currentSalaries.filter((s) => s.id !== salaryId);

  employeesStore.updateEmployee(props.userData.id, {
    salary: {
      currency: props.userData.salary?.currency || "USD",
      history: updatedSalaries,
    },
  });

  notifications.push("Salary deleted successfully", "success", 3500);
  confirmDeleteSalaryVisible.value = false;
  deleteSalaryCandidateId.value = null;
};

const cancelDeleteSalary = () => {
  confirmDeleteSalaryVisible.value = false;
  deleteSalaryCandidateId.value = null;
};

const openAddSalaryDialog = () => {
  selectedSalaryId.value = null;
  isAddSalaryDialogVisible.value = true;
};

// ==================== TERMINATION FUNCTION ====================
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

  notifications.push("Contract terminated successfully", "success", 3500);
  selectedContractId.value = null;
};
</script>

<!-- ==================== TEMPLATE ==================== -->
<template>
  <!-- ========== EMPLOYMENT CARD ========== -->
  <VCard class="user-tab-notification mb-6" title="Employment">
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
            <VBtn size="small" @click="openAddContractDialog">
              <VIcon start icon="tabler-contract" />
              Hire
            </VBtn>
          </div>
        </VCol>

        <template v-else>
          <VCol cols="12">
            <VExpansionPanels
              variant="accordion"
              class="expansion-panels-width-border"
            >
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
              <VBtn size="small" @click="openAddContractDialog">
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

  <!-- ========== POSITIONS CARD ========== -->
  <VRow>
    <VCol cols="12" md="6">
      <VCard class="mb-6">
        <template #title>
          <div class="d-flex align-center justify-space-between">
            <span>Positions</span>
            <VBtn
              size="small"
              variant="tonal"
              prepend-icon="tabler-plus"
              @click="openAddPositionDialog"
            >
              Position
            </VBtn>
          </div>
        </template>

        <VCardText>
          <!-- Show alert if no positions -->
          <div v-if="allPositions.length === 0" color="info" variant="tonal">
            No positions yet. Add a new position to keep track of employee
            roles.
          </div>

          <!-- Show positions list -->
          <div v-else class="d-flex flex-column gap-2">
            <div
              v-for="position in allPositions"
              :key="position.id"
              class="d-flex align-center justify-space-between pa-3 rounded"
              :style="
                position.id === currentPositionId
                  ? 'background-color: rgba(var(--v-theme-success), 0.16);'
                  : 'border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));'
              "
            >
              <div class="flex-grow-1">
                <span
                  class="text-body-2 font-weight-medium"
                  :class="
                    position.id === currentPositionId ? 'text-success' : ''
                  "
                  >{{ position.position }}</span
                >
                <span class="text-caption text-medium-emphasis ms-2">
                  • {{ position.startingDate || "Not specified" }}
                </span>
                <span
                  v-if="position.note"
                  class="text-caption text-medium-emphasis ms-2"
                >
                  • {{ position.note }}
                </span>
              </div>

              <VBtn size="x-small" variant="text" icon color="default">
                <VIcon icon="tabler-dots-vertical" />
                <VMenu activator="parent">
                  <VList>
                    <VListItem @click="editPosition(position.id!)">
                      <template #prepend>
                        <VIcon icon="tabler-edit" />
                      </template>
                      <VListItemTitle>Edit</VListItemTitle>
                    </VListItem>
                    <VListItem @click="deletePosition(position.id!)">
                      <template #prepend>
                        <VIcon color="error" icon="tabler-trash" />
                      </template>
                      <VListItemTitle>Delete</VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>

    <!-- ========== SALARY CARD ========== -->
    <VCol cols="12" md="6">
      <VCard class="mb-6">
        <template #title>
          <div class="d-flex align-center justify-space-between">
            <span>Salary</span>
            <VBtn
              size="small"
              variant="tonal"
              prepend-icon="tabler-plus"
              @click="openAddSalaryDialog"
            >
              Salary
            </VBtn>
          </div>
        </template>

        <VCardText>
          <!-- Show alert if no salaries -->
          <div v-if="allSalaries.length === 0" color="info" variant="tonal">
            No salary records yet. Add a salary to keep track of employee
            compensation.
          </div>

          <!-- Show salary list -->
          <div v-else class="d-flex flex-column gap-2">
            <div
              v-for="salary in allSalaries"
              :key="salary.id"
              class="pa-3 rounded position-relative"
              :style="
                salary.id === currentSalaryId
                  ? 'background-color: rgba(var(--v-theme-success), 0.16);'
                  : 'border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));'
              "
            >
              <VBtn
                size="x-small"
                variant="text"
                icon
                color="default"
                style="
                  position: absolute;
                  inset-block-start: 8px;
                  inset-inline-end: 8px;
                "
              >
                <VIcon icon="tabler-dots-vertical" />
                <VMenu activator="parent">
                  <VList>
                    <VListItem @click="editSalary(salary.id!)">
                      <template #prepend>
                        <VIcon icon="tabler-edit" />
                      </template>
                      <VListItemTitle>Edit</VListItemTitle>
                    </VListItem>
                    <VListItem @click="deleteSalary(salary.id!)">
                      <template #prepend>
                        <VIcon color="error" icon="tabler-trash" />
                      </template>
                      <VListItemTitle>Delete</VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>

              <div class="flex-grow-1">
                <div
                  class="text-body-1 font-weight-bold mb-2"
                  :class="salary.id === currentSalaryId ? 'text-success' : ''"
                >
                  {{ salary.startingPeriod?.toUpperCase() || "NOT SPECIFIED" }}
                  | NET TO PAY:
                  {{
                    (
                      salary.basicSalary +
                      salary.transportation +
                      salary.housing +
                      salary.allowance
                    ).toLocaleString()
                  }}
                </div>
                <div class="text-caption mb-1">
                  Date:
                  <span class="text-medium-emphasis">{{
                    salary.date || "Not specified"
                  }}</span>
                </div>
                <div class="text-caption">
                  ALLOWANCE:
                  <span class="text-medium-emphasis">{{
                    salary.allowance.toLocaleString()
                  }}</span>
                </div>
                <div class="text-caption">
                  HOUSING:
                  <span class="text-medium-emphasis">{{
                    salary.housing.toLocaleString()
                  }}</span>
                </div>
                <div class="text-caption">
                  TRANSPORTATION:
                  <span class="text-medium-emphasis">{{
                    salary.transportation.toLocaleString()
                  }}</span>
                </div>
                <div class="text-caption">
                  BASIC SALARY:
                  <span class="text-medium-emphasis">{{
                    salary.basicSalary.toLocaleString()
                  }}</span>
                </div>
                <div v-if="salary.note" class="text-caption mt-2">
                  Note:
                  <span class="text-medium-emphasis">{{ salary.note }}</span>
                </div>
              </div>
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>

  <!-- ==================== DIALOGS ==================== -->
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

  <!-- Add Position Dialog -->
  <AddPositionDialog
    v-model:is-dialog-visible="isAddPositionDialogVisible"
    :position-data="selectedPosition"
    @submit="onPositionSubmit"
  />

  <!-- Add Salary Dialog -->
  <AddSalaryRaiseDialog
    v-model:is-dialog-visible="isAddSalaryDialogVisible"
    :salary-data="selectedSalary"
    @submit="onSalarySubmit"
  />

  <!-- Confirm Delete Position Dialog -->
  <VDialog v-model="confirmDeletePositionVisible" persistent max-width="540">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Delete position</VCardTitle>
      <VCardText> Are you sure you want to delete this position? </VCardText>
      <VCardActions>
        <VBtn variant="text" @click="cancelDeletePosition"> Cancel </VBtn>
        <VBtn color="error" variant="tonal" @click="performDeletePosition">
          Delete
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Confirm Delete Salary Dialog -->
  <VDialog v-model="confirmDeleteSalaryVisible" persistent max-width="540">
    <VCard class="pa-sm-8 pa-4">
      <VCardTitle>Delete salary</VCardTitle>
      <VCardText>
        Are you sure you want to delete this salary record?
      </VCardText>
      <VCardActions>
        <VBtn variant="text" @click="cancelDeleteSalary"> Cancel </VBtn>
        <VBtn color="error" variant="tonal" @click="performDeleteSalary">
          Delete
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
