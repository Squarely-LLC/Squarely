<script setup lang="ts">
import type {
  EmployeeContract,
  EmployeeProperties,
  EmployeeRequest,
  EmployeeSalaryRecord,
} from "@/plugins/fake-api/handlers/apps/employees/types";
import { useEmployeesStore } from "@/stores/employees";
import { useNotificationsStore } from "@/stores/notifications";
import {
  usePayrollsStore,
  type PayrollLine,
  type PayrollLineAdjustment,
} from "@/stores/payrolls";
import { computed, ref } from "vue";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type PeriodRange = {
  start: Date;
  end: Date;
};

type PayrollTableRow = PayrollLine & {
  rowId: string;
  periodKey: string;
  periodLabel: string;
  payrollNetTotal: number;
};

const employeesStore = useEmployeesStore();
const payrollsStore = usePayrollsStore();
const notifications = useNotificationsStore();

employeesStore.init();
payrollsStore.init();

const now = new Date();
const selectedPeriodKey = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
);
const payrollSearchQuery = ref("");
const selectedPayrollStatus = ref<"Paid" | "Not Paid" | null>(null);
const payrollSortBy = ref<keyof PayrollTableRow>("periodKey");
const payrollSortDirection = ref<"asc" | "desc">("desc");

const formatMoney = (amount: number) =>
  `$${Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;

const parseLegacyDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const legacy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const normalized = legacy
    ? `${legacy[3]}-${legacy[2]}-${legacy[1]}`
    : trimmed;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const periodKeyFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parsePeriodKey = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;

  const label = trimmed.match(/^([A-Za-z]+)\s*-\s*(\d{4})$/);
  if (label) {
    const monthIndex = MONTH_NAMES.findIndex(
      (month) => month.toLowerCase() === label[1].toLowerCase(),
    );

    if (monthIndex !== -1)
      return `${label[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  const parsedDate = parseLegacyDate(trimmed);

  return parsedDate ? periodKeyFromDate(parsedDate) : null;
};

const getPeriodLabel = (periodKey: string) => {
  const [year, month] = periodKey.split("-");
  const monthIndex = Number(month) - 1;

  return `${MONTH_NAMES[monthIndex] ?? month} - ${year}`;
};

const getPeriodRange = (periodKey: string): PeriodRange => {
  const [year, month] = periodKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return { start, end };
};

const isDateWithinPeriod = (date: Date | null, range: PeriodRange) =>
  !date || date <= range.end;

const isAfterPeriodStart = (date: Date | null, range: PeriodRange) =>
  !date || date >= range.start;

const periodOptions = computed(() => {
  const currentYear = now.getFullYear();
  const options: Array<{ title: string; value: string }> = [];

  for (let year = currentYear - 1; year <= currentYear + 1; year += 1) {
    MONTH_NAMES.forEach((month, index) => {
      const value = `${year}-${String(index + 1).padStart(2, "0")}`;
      options.push({ title: `${month} - ${year}`, value });
    });
  }

  return options.sort((left, right) => right.value.localeCompare(left.value));
});

const getEmployeeContracts = (employee: EmployeeProperties) => {
  const contracts = [...(employee.employment?.contracts ?? [])];
  const legacyContract = employee.employment?.contract;

  if (
    legacyContract &&
    !contracts.some((contract) => contract.id === legacyContract.id)
  )
    contracts.push(legacyContract);

  return contracts;
};

const isContractActiveForPeriod = (
  contract: EmployeeContract,
  range: PeriodRange,
) => {
  const status = String(contract.status || "Active").toLowerCase();
  if (status === "draft") return false;

  const startDate = parseLegacyDate(contract.startDate);
  const firstPayroll = parseLegacyDate(contract.firstPayroll);
  const lastDayAtWork = parseLegacyDate(contract.termination?.lastDayAtWork);
  const lastPayrollPeriod = parsePeriodKey(
    contract.termination?.lastPayrollPeriod,
  );

  if (!isDateWithinPeriod(startDate, range)) return false;
  if (!isDateWithinPeriod(firstPayroll, range)) return false;
  if (!isAfterPeriodStart(lastDayAtWork, range)) return false;
  if (
    lastPayrollPeriod &&
    lastPayrollPeriod < periodKeyFromDate(range.start)
  )
    return false;

  return status === "active" || status === "terminated";
};

const isEmployeeActiveForPeriod = (
  employee: EmployeeProperties,
  periodKey: string,
) => {
  if (String(employee.status || "").toLowerCase() !== "active") return false;

  const range = getPeriodRange(periodKey);
  const contracts = getEmployeeContracts(employee);

  if (contracts.length)
    return contracts.some((contract) => isContractActiveForPeriod(contract, range));

  const startDate = parseLegacyDate(employee.employment?.startDate);
  const endDate = parseLegacyDate(employee.employment?.endDate);

  return isDateWithinPeriod(startDate, range) && isAfterPeriodStart(endDate, range);
};

const getSalaryPeriodKey = (salary: EmployeeSalaryRecord) =>
  parsePeriodKey(salary.startingPeriod) ||
  (parseLegacyDate(salary.date)
    ? periodKeyFromDate(parseLegacyDate(salary.date) as Date)
    : null);

const getEffectiveSalary = (
  employee: EmployeeProperties,
  periodKey: string,
) => {
  const salaryHistory = employee.salary?.history ?? [];

  return [...salaryHistory]
    .filter((salary) => {
      const salaryPeriodKey = getSalaryPeriodKey(salary);

      return salaryPeriodKey ? salaryPeriodKey <= periodKey : false;
    })
    .sort((left, right) => {
      const leftKey = getSalaryPeriodKey(left) ?? "";
      const rightKey = getSalaryPeriodKey(right) ?? "";
      if (leftKey !== rightKey) return rightKey.localeCompare(leftKey);

      return (
        (parseLegacyDate(right.date)?.getTime() ?? 0) -
        (parseLegacyDate(left.date)?.getTime() ?? 0)
      );
    })[0];
};

const getRequestPeriodKey = (request: EmployeeRequest) => {
  if (request.type === "Addition" || request.type === "Deduction")
    return parsePeriodKey(request.period) || parsePeriodKey(request.date);

  if (request.type === "Leave")
    return parsePeriodKey(request.periodId) || parsePeriodKey(request.startDate);

  return null;
};

const getRequestLabel = (request: EmployeeRequest) => {
  if (request.type === "Addition") return request.additionType || "Addition";
  if (request.type === "Deduction") return request.deductionType || "Deduction";
  if (request.type === "Leave") return request.typeId || "Deductible leave";

  return request.type;
};

const getPayrollAdjustments = (
  employee: EmployeeProperties,
  periodKey: string,
) => {
  const additions: PayrollLineAdjustment[] = [];
  const deductions: PayrollLineAdjustment[] = [];

  (employee.requests ?? []).forEach((request) => {
    if (String(request.status).toLowerCase() !== "approved") return;
    if (getRequestPeriodKey(request) !== periodKey) return;

    if (request.type === "Addition") {
      const amount = Number(request.amount || 0);
      if (amount > 0)
        additions.push({
          id: request.id,
          type: "Addition",
          label: getRequestLabel(request),
          amount,
        });
    }

    if (request.type === "Deduction") {
      const amount = Number(request.amount || 0);
      if (amount > 0)
        deductions.push({
          id: request.id,
          type: "Deduction",
          label: getRequestLabel(request),
          amount,
        });
    }

    if (request.type === "Leave" && request.deductible) {
      const amount = Number(request.deductionAmount || 0);
      if (amount > 0)
        deductions.push({
          id: request.id,
          type: "Leave",
          label: getRequestLabel(request),
          amount,
        });
    }
  });

  return { additions, deductions };
};

const buildPayrollLine = (
  employee: EmployeeProperties,
  periodKey: string,
): PayrollLine => {
  const salary = getEffectiveSalary(employee, periodKey);
  const basicSalary = Number(salary?.basicSalary || 0);
  const transportation = Number(salary?.transportation || 0);
  const housing = Number(salary?.housing || 0);
  const allowance = Number(salary?.allowance || 0);
  const baseSalary = basicSalary + transportation + housing + allowance;
  const { additions, deductions } = getPayrollAdjustments(employee, periodKey);
  const additionsTotal = additions.reduce((sum, item) => sum + item.amount, 0);
  const deductionsTotal = deductions.reduce((sum, item) => sum + item.amount, 0);

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeNumber: employee.number || String(employee.id),
    employeeAvatar: employee.picture || "",
    department: employee.employment?.department || employee.department || "-",
    basicSalary,
    transportation,
    housing,
    allowance,
    baseSalary,
    additions,
    deductions,
    additionsTotal,
    deductionsTotal,
    netPay: baseSalary + additionsTotal - deductionsTotal,
    status: "Not Paid",
    note: "",
  };
};

const previewLines = computed(() =>
  employeesStore.all
    .filter((employee) =>
      isEmployeeActiveForPeriod(employee, selectedPeriodKey.value),
    )
    .map((employee) => buildPayrollLine(employee, selectedPeriodKey.value))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName)),
);

const previewTotals = computed(() => ({
  employeeCount: previewLines.value.length,
  totalBaseSalary: previewLines.value.reduce(
    (sum, line) => sum + line.baseSalary,
    0,
  ),
  totalAdditions: previewLines.value.reduce(
    (sum, line) => sum + line.additionsTotal,
    0,
  ),
  totalDeductions: previewLines.value.reduce(
    (sum, line) => sum + line.deductionsTotal,
    0,
  ),
  totalNetPay: previewLines.value.reduce((sum, line) => sum + line.netPay, 0),
}));

const selectedPeriodLabel = computed(() =>
  getPeriodLabel(selectedPeriodKey.value),
);

const generatedForSelectedPeriod = computed(() =>
  payrollsStore.byPeriod(selectedPeriodKey.value),
);

const canGeneratePayroll = computed(
  () => previewLines.value.length > 0 && !generatedForSelectedPeriod.value,
);

const generatePayroll = () => {
  if (generatedForSelectedPeriod.value) {
    notifications.push("Payroll period already generated.", "warning", 3500);
    return;
  }

  if (!previewLines.value.length) {
    notifications.push("No active employees found for this period.", "warning", 3500);
    return;
  }

  const generated = payrollsStore.generatePayroll({
    periodKey: selectedPeriodKey.value,
    periodLabel: selectedPeriodLabel.value,
    employeeCount: previewTotals.value.employeeCount,
    totalBaseSalary: previewTotals.value.totalBaseSalary,
    totalAdditions: previewTotals.value.totalAdditions,
    totalDeductions: previewTotals.value.totalDeductions,
    totalNetPay: previewTotals.value.totalNetPay,
    lines: previewLines.value,
  });

  if (!generated) {
    notifications.push("Payroll period already generated.", "warning", 3500);
    return;
  }

  notifications.push(`${generated.periodLabel} payroll generated.`, "success", 3500);
};

const adjustmentSummary = (items: PayrollLineAdjustment[]) =>
  items.length
    ? items.map((item) => `${item.label}: ${formatMoney(item.amount)}`).join(", ")
    : "-";

const payrollRows = computed<PayrollTableRow[]>(() =>
  payrollsStore.all.flatMap((payroll) =>
    payroll.lines.map((line) => ({
      ...line,
      rowId: `${payroll.periodKey}-${line.employeeId}`,
      periodKey: payroll.periodKey,
      periodLabel: payroll.periodLabel,
      payrollNetTotal: payroll.totalNetPay,
      status: line.status === "Paid" ? "Paid" : "Not Paid",
    })),
  ),
);

const getSortableValue = (
  row: PayrollTableRow,
  key: keyof PayrollTableRow,
): string | number => {
  if (
    key === "baseSalary" ||
    key === "additionsTotal" ||
    key === "deductionsTotal" ||
    key === "netPay" ||
    key === "payrollNetTotal"
  )
    return Number(row[key] || 0);

  return String(row[key] ?? "").toLowerCase();
};

const sortPayrollBy = (key: keyof PayrollTableRow) => {
  if (payrollSortBy.value === key) {
    payrollSortDirection.value =
      payrollSortDirection.value === "asc" ? "desc" : "asc";
    return;
  }

  payrollSortBy.value = key;
  payrollSortDirection.value = key === "employeeName" ? "asc" : "desc";
};

const filteredPayrollRows = computed(() => {
  const query = payrollSearchQuery.value.trim().toLowerCase();

  return payrollRows.value
    .filter((row) => {
      const matchesStatus =
        !selectedPayrollStatus.value || row.status === selectedPayrollStatus.value;
      const adjustmentText = [...row.additions, ...row.deductions]
        .map((item) => item.label)
        .join(" ");
      const haystack = [
        row.employeeName,
        row.employeeNumber,
        row.department,
        row.periodLabel,
        row.status,
        adjustmentText,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || haystack.includes(query));
    })
    .sort((left, right) => {
      const leftValue = getSortableValue(left, payrollSortBy.value);
      const rightValue = getSortableValue(right, payrollSortBy.value);
      const direction = payrollSortDirection.value === "asc" ? 1 : -1;

      if (typeof leftValue === "number" && typeof rightValue === "number")
        return (leftValue - rightValue) * direction;

      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
});

const groupedPayrollRows = computed(() => {
  const groups = new Map<
    string,
    {
      periodKey: string;
      periodLabel: string;
      payrollNetTotal: number;
      rows: PayrollTableRow[];
    }
  >();

  filteredPayrollRows.value.forEach((row) => {
    const existing = groups.get(row.periodKey);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    groups.set(row.periodKey, {
      periodKey: row.periodKey,
      periodLabel: row.periodLabel,
      payrollNetTotal: row.payrollNetTotal,
      rows: [row],
    });
  });

  return [...groups.values()].sort((left, right) =>
    right.periodKey.localeCompare(left.periodKey),
  );
});

const statusChipColor = (status?: PayrollLine["status"]) =>
  status === "Paid" ? "success" : "warning";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const markPayrollRowPaid = (row: PayrollTableRow) => {
  const updated = payrollsStore.updateLineStatus(
    row.periodKey,
    row.employeeId,
    "Paid",
  );

  if (!updated) {
    notifications.push("Unable to mark payroll row as paid.", "error", 3500);
    return;
  }

  notifications.push(`${row.employeeName} marked as paid.`, "success", 3500);
};

const showPayrollAdjustments = (
  row: PayrollTableRow,
  kind: "additions" | "deductions",
) => {
  const items = kind === "additions" ? row.additions : row.deductions;
  const label = kind === "additions" ? "Additions" : "Deductions";

  notifications.push(
    `${label}: ${adjustmentSummary(items)}`,
    items.length ? "success" : "info",
    4500,
  );
};

const showPayrollNotes = (row: PayrollTableRow) => {
  notifications.push(row.note || "No payroll notes for this row.", "info", 3500);
};

const payrollActions = (row: PayrollTableRow) => [
  {
    title: "Pay",
    value: "pay",
    prependIcon: "tabler-cash",
    disabled: row.status === "Paid",
    onClick: () => markPayrollRowPaid(row),
  },
  {
    title: "Additions",
    value: "additions",
    prependIcon: "tabler-plus",
    onClick: () => showPayrollAdjustments(row, "additions"),
  },
  {
    title: "Deductions",
    value: "deductions",
    prependIcon: "tabler-minus",
    onClick: () => showPayrollAdjustments(row, "deductions"),
  },
  {
    title: "Notes",
    value: "notes",
    prependIcon: "tabler-notes",
    onClick: () => showPayrollNotes(row),
  },
];
</script>

<template>
  <section id="finance-payroll">
    <VCard>
      <VCardText class="d-flex flex-wrap align-center gap-4">
        <div class="payroll-period-control">
          <AppSelect
            v-model="selectedPeriodKey"
            label="Payroll Period"
            :items="periodOptions"
          />
        </div>

        <VSpacer />

        <VBtn
          prepend-icon="tabler-calculator"
          :disabled="!canGeneratePayroll"
          @click="generatePayroll"
        >
          Generate Payroll
        </VBtn>
      </VCardText>

      <VDivider />

      <VCardText>
        <VAlert
          v-if="generatedForSelectedPeriod"
          type="info"
          variant="tonal"
          class="mb-5"
        >
          {{ selectedPeriodLabel }} payroll was already generated.
        </VAlert>

        <VRow class="mb-4">
          <VCol cols="12" sm="6" lg="3">
            <div class="payroll-metric">
              <span class="text-sm text-disabled">Employees</span>
              <strong>{{ previewTotals.employeeCount }}</strong>
            </div>
          </VCol>
          <VCol cols="12" sm="6" lg="3">
            <div class="payroll-metric">
              <span class="text-sm text-disabled">Additions</span>
              <strong>{{ formatMoney(previewTotals.totalAdditions) }}</strong>
            </div>
          </VCol>
          <VCol cols="12" sm="6" lg="3">
            <div class="payroll-metric">
              <span class="text-sm text-disabled">Deductions</span>
              <strong>{{ formatMoney(previewTotals.totalDeductions) }}</strong>
            </div>
          </VCol>
          <VCol cols="12" sm="6" lg="3">
            <div class="payroll-metric">
              <span class="text-sm text-disabled">Net Payroll</span>
              <strong>{{ formatMoney(previewTotals.totalNetPay) }}</strong>
            </div>
          </VCol>
        </VRow>

        <div class="text-h6 mb-3">
          Preview - {{ selectedPeriodLabel }}
        </div>

        <VTable class="payroll-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th class="text-end">Base Salary</th>
              <th class="text-end">Additions</th>
              <th class="text-end">Deductions</th>
              <th class="text-end">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in previewLines" :key="line.employeeId">
              <td>
                <div class="font-weight-medium">
                  {{ line.employeeName }}
                </div>
                <div class="text-sm text-disabled">
                  {{ line.employeeNumber }}
                </div>
              </td>
              <td>{{ line.department }}</td>
              <td class="text-end">{{ formatMoney(line.baseSalary) }}</td>
              <td class="text-end">
                <VTooltip :text="adjustmentSummary(line.additions)">
                  <template #activator="{ props }">
                    <span v-bind="props">{{ formatMoney(line.additionsTotal) }}</span>
                  </template>
                </VTooltip>
              </td>
              <td class="text-end">
                <VTooltip :text="adjustmentSummary(line.deductions)">
                  <template #activator="{ props }">
                    <span v-bind="props">{{ formatMoney(line.deductionsTotal) }}</span>
                  </template>
                </VTooltip>
              </td>
              <td class="text-end font-weight-medium">
                {{ formatMoney(line.netPay) }}
              </td>
            </tr>
            <tr v-if="!previewLines.length">
              <td colspan="6" class="text-center text-disabled py-8">
                No active employees for this period.
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>

    <VCard class="mt-6">
      <VCardText class="d-flex flex-wrap align-center gap-4">
        <div class="text-h6">Generated payrolls</div>

        <VSpacer />

        <div class="payroll-list-filter">
          <AppTextField
            v-model="payrollSearchQuery"
            placeholder="Search Payroll"
            clearable
            clear-icon="tabler-x"
          />
        </div>

        <div class="payroll-list-filter">
          <AppSelect
            v-model="selectedPayrollStatus"
            placeholder="Payment Status"
            clearable
            clear-icon="tabler-x"
            :items="['Paid', 'Not Paid']"
          />
        </div>
      </VCardText>

      <VDivider />

      <VCardText class="pa-0">
        <VTable v-if="payrollRows.length" class="payroll-table payroll-generated-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  class="payroll-sort-button"
                  @click="sortPayrollBy('employeeName')"
                >
                  Employee
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">
                <button
                  type="button"
                  class="payroll-sort-button justify-end"
                  @click="sortPayrollBy('baseSalary')"
                >
                  Total Salary
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">
                <button
                  type="button"
                  class="payroll-sort-button justify-end"
                  @click="sortPayrollBy('additionsTotal')"
                >
                  Additions
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">
                <button
                  type="button"
                  class="payroll-sort-button justify-end"
                  @click="sortPayrollBy('deductionsTotal')"
                >
                  Deductions
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">
                <button
                  type="button"
                  class="payroll-sort-button justify-end"
                  @click="sortPayrollBy('netPay')"
                >
                  Net to Pay
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th>
                <button
                  type="button"
                  class="payroll-sort-button"
                  @click="sortPayrollBy('status')"
                >
                  Status
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="group in groupedPayrollRows"
              :key="group.periodKey"
            >
              <tr class="payroll-group-row">
                <td colspan="7">
                  <div class="payroll-group-header">
                    <span>{{ group.periodLabel }}</span>
                    <strong>
                      Net generated payroll:
                      {{ formatMoney(group.payrollNetTotal) }}
                    </strong>
                  </div>
                </td>
              </tr>

              <tr v-for="row in group.rows" :key="row.rowId">
                <td>
                  <div class="d-flex align-center gap-3">
                    <VAvatar size="34" color="primary" variant="tonal">
                      <VImg
                        v-if="row.employeeAvatar"
                        :src="row.employeeAvatar"
                        :alt="row.employeeName"
                      />
                      <span v-else>{{ getInitials(row.employeeName) }}</span>
                    </VAvatar>

                    <div>
                      <div class="font-weight-medium">
                        {{ row.employeeName }}
                      </div>
                      <div class="text-sm text-disabled">
                        {{ row.employeeNumber }} - {{ row.department }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-end">{{ formatMoney(row.baseSalary) }}</td>
                <td class="text-end">
                  <VTooltip :text="adjustmentSummary(row.additions)">
                    <template #activator="{ props }">
                      <span v-bind="props">{{ formatMoney(row.additionsTotal) }}</span>
                    </template>
                  </VTooltip>
                </td>
                <td class="text-end">
                  <VTooltip :text="adjustmentSummary(row.deductions)">
                    <template #activator="{ props }">
                      <span v-bind="props">
                        {{ formatMoney(row.deductionsTotal) }}
                      </span>
                    </template>
                  </VTooltip>
                </td>
                <td class="text-end font-weight-medium">
                  {{ formatMoney(row.netPay) }}
                </td>
                <td>
                  <VChip
                    :color="statusChipColor(row.status)"
                    label
                    size="x-small"
                    variant="tonal"
                  >
                    {{ row.status }}
                  </VChip>
                </td>
                <td class="text-end">
                  <MoreBtn
                    :menu-list="payrollActions(row)"
                    item-props
                    color="undefined"
                  />
                </td>
              </tr>
            </template>

            <tr v-if="!groupedPayrollRows.length">
              <td colspan="7" class="text-center text-disabled py-8">
                No payroll rows match the current filters.
              </td>
            </tr>
          </tbody>
        </VTable>

        <VAlert v-else type="info" variant="tonal" class="ma-5">
          No payrolls generated yet.
        </VAlert>
      </VCardText>
    </VCard>
  </section>
</template>

<style lang="scss">
#finance-payroll {
  .payroll-period-control {
    inline-size: 14rem;
  }

  .payroll-metric {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 0.875rem 1rem;

    strong {
      display: block;
      margin-block-start: 0.25rem;
      font-size: 1.125rem;
    }
  }

  .payroll-table {
    th {
      white-space: nowrap;
    }

    td {
      vertical-align: middle;
    }
  }

  .payroll-run-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    inline-size: 100%;
  }

  .payroll-run-totals {
    display: flex;
    align-items: center;
    gap: 1rem;
    white-space: nowrap;
  }

  @media (max-width: 960px) {
    .payroll-run-title,
    .payroll-run-totals {
      align-items: flex-start;
      flex-direction: column;
    }
  }
}
</style>
