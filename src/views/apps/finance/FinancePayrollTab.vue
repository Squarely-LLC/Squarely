<script setup lang="ts">
import type { ContactRef, Message } from "@/data/schema";
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
  type PayrollPaymentStatus,
} from "@/stores/payrolls";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { getSignedInAuthorRef } from "@/utils/currentAccount";
import { saveFile } from "@/utils/fileStore";
import AddAdditionsDrawer from "@/views/apps/hr/view/AddAdditionsDrawer.vue";
import AddDeductionDrawer from "@/views/apps/hr/view/AddDeductionDrawer.vue";
import MessageDrawer from "@/views/apps/todo/list/MessageDrawer.vue";
import { computed, nextTick, ref, watch } from "vue";

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
  groupEmployeeCount: number;
  isGenerated: boolean;
};

type PendingPayrollRequest = {
  employeeId: number | string;
  employeeName: string;
  requestId: number | string;
  requestType: string;
  amount: number;
  managerIds: Array<number | string>;
};

const employeesStore = useEmployeesStore();
const payrollsStore = usePayrollsStore();
const systemNotificationsStore = useSystemNotificationsStore();
const notifications = useNotificationsStore();

employeesStore.init();
payrollsStore.init();
systemNotificationsStore.init();

const now = new Date();
const selectedPeriodKey = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
);
const payrollSearchQuery = ref("");
const selectedPayrollStatus = ref<PayrollPaymentStatus | null>(null);
const payrollSortBy = ref<keyof PayrollTableRow>("periodKey");
const payrollSortDirection = ref<"asc" | "desc">("desc");
const expandedGroups = ref<string[]>([]);
const isPendingRequestsDialogOpen = ref(false);
const pendingRequestsForDialog = ref<PendingPayrollRequest[]>([]);
const selectedPayRow = ref<PayrollTableRow | null>(null);
const selectedMessageRow = ref<PayrollTableRow | null>(null);
const isPaymentDrawerOpen = ref(false);
const isMessageDrawerOpen = ref(false);
const isAdditionDrawerOpen = ref(false);
const isDeductionDrawerOpen = ref(false);
const adjustmentRow = ref<PayrollTableRow | null>(null);
const paymentDate = ref(new Date().toISOString().slice(0, 10));
const paymentMethod = ref("Cash");
const paymentAmount = ref<number | string>("");
const paymentAttachment = ref<File | null>(null);

const currentAuthor = computed<ContactRef>(() => getSignedInAuthorRef());

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

const getRequestAmount = (request: EmployeeRequest) => {
  if (request.type === "Leave") return Number(request.deductionAmount || 0);
  if (request.type === "Addition" || request.type === "Deduction")
    return Number(request.amount || 0);

  return 0;
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

const resolveEmployeeAvatar = (
  employee: EmployeeProperties | null | undefined,
  fallback?: string,
) => fallback || employee?.picture || "";

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
  const netPay = baseSalary + additionsTotal - deductionsTotal;

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeNumber: employee.number || String(employee.id),
    employeeAvatar: resolveEmployeeAvatar(employee),
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
    netPay,
    payments: [],
    paidAmount: 0,
    balance: netPay,
    paymentStatus: "Not Paid",
    status: "Not Paid",
    note: "",
    messages: [],
  };
};

const selectedPeriodLabel = computed(() =>
  getPeriodLabel(selectedPeriodKey.value),
);

const activeEmployeesForSelectedPeriod = computed(() =>
  employeesStore.all.filter((employee) =>
    isEmployeeActiveForPeriod(employee, selectedPeriodKey.value),
  ),
);

const selectedPeriodLines = computed(() =>
  activeEmployeesForSelectedPeriod.value
    .map((employee) => buildPayrollLine(employee, selectedPeriodKey.value))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName)),
);

const selectedPeriodTotals = computed(() => ({
  employeeCount: selectedPeriodLines.value.length,
  totalBaseSalary: selectedPeriodLines.value.reduce(
    (sum, line) => sum + line.baseSalary,
    0,
  ),
  totalAdditions: selectedPeriodLines.value.reduce(
    (sum, line) => sum + line.additionsTotal,
    0,
  ),
  totalDeductions: selectedPeriodLines.value.reduce(
    (sum, line) => sum + line.deductionsTotal,
    0,
  ),
  totalNetPay: selectedPeriodLines.value.reduce((sum, line) => sum + line.netPay, 0),
}));

const generatedForSelectedPeriod = computed(() =>
  payrollsStore.byPeriod(selectedPeriodKey.value),
);

const getPendingPayrollRequests = (periodKey: string): PendingPayrollRequest[] =>
  employeesStore.all
    .filter((employee) => isEmployeeActiveForPeriod(employee, periodKey))
    .flatMap((employee) =>
      (employee.requests ?? [])
        .filter((request) => {
          if (String(request.status).toLowerCase() !== "pending") return false;
          if (getRequestPeriodKey(request) !== periodKey) return false;
          if (request.type === "Addition" || request.type === "Deduction")
            return getRequestAmount(request) > 0;
          if (request.type === "Leave")
            return Boolean(request.deductible) && getRequestAmount(request) > 0;

          return false;
        })
        .map((request) => ({
          employeeId: employee.id,
          employeeName: employee.fullName,
          requestId: request.id,
          requestType: getRequestLabel(request),
          amount: getRequestAmount(request),
          managerIds: employee.employment?.reportToIds ?? [],
        })),
    );

const hasManagerNotification = (
  managerId: number | string,
  request: PendingPayrollRequest,
  periodKey: string,
) =>
  systemNotificationsStore.items.some(
    (notification) =>
      notification.type === "payroll-approval" &&
      String(notification.recipientEmployeeId) === String(managerId) &&
      notification.target?.entityType === "payroll-request" &&
      String(notification.target?.entityId) ===
        `${periodKey}:${request.employeeId}:${request.requestId}`,
  );

const notifyManagersForPendingRequests = (
  requests: PendingPayrollRequest[],
  periodKey: string,
) => {
  requests.forEach((request) => {
    request.managerIds.forEach((managerId) => {
      if (hasManagerNotification(managerId, request, periodKey)) return;

      systemNotificationsStore.addNotification({
        recipientEmployeeId: managerId,
        type: "payroll-approval",
        title: `Payroll approval needed - ${getPeriodLabel(periodKey)}`,
        body: `${request.employeeName} has a pending ${request.requestType} request for ${formatMoney(request.amount)}. Manager action is required before payroll generation.`,
        target: {
          entityType: "payroll-request",
          entityId: `${periodKey}:${request.employeeId}:${request.requestId}`,
          path: "/dashboards/analytics",
          query: {
            panel: "need-approval",
            type: "hr-request",
            employeeId: request.employeeId,
            requestId: request.requestId,
            period: periodKey,
          },
        },
      });
    });
  });
};

const canGeneratePayroll = computed(
  () => selectedPeriodLines.value.length > 0 && !generatedForSelectedPeriod.value,
);

const generatePayroll = () => {
  if (generatedForSelectedPeriod.value) {
    notifications.push("Payroll period already generated.", "warning", 3500);
    return;
  }

  if (!selectedPeriodLines.value.length) {
    notifications.push("No active employees found for this period.", "warning", 3500);
    return;
  }

  const pendingRequests = getPendingPayrollRequests(selectedPeriodKey.value);
  if (pendingRequests.length) {
    notifyManagersForPendingRequests(pendingRequests, selectedPeriodKey.value);
    pendingRequestsForDialog.value = pendingRequests;
    isPendingRequestsDialogOpen.value = true;
    notifications.push(
      "Pending payroll requests must be approved before generation.",
      "warning",
      4000,
    );
    return;
  }

  const generated = payrollsStore.generatePayroll({
    periodKey: selectedPeriodKey.value,
    periodLabel: selectedPeriodLabel.value,
    employeeCount: selectedPeriodTotals.value.employeeCount,
    totalBaseSalary: selectedPeriodTotals.value.totalBaseSalary,
    totalAdditions: selectedPeriodTotals.value.totalAdditions,
    totalDeductions: selectedPeriodTotals.value.totalDeductions,
    totalNetPay: selectedPeriodTotals.value.totalNetPay,
    lines: selectedPeriodLines.value,
  });

  if (!generated) {
    notifications.push("Payroll period already generated.", "warning", 3500);
    return;
  }

  expandedGroups.value = [generated.periodKey];
  notifications.push(`${generated.periodLabel} payroll generated.`, "success", 3500);
};

const adjustmentSummary = (items: PayrollLineAdjustment[]) =>
  items.length
    ? items.map((item) => `${item.label}: ${formatMoney(item.amount)}`).join(", ")
    : "-";

const generatedRows = computed<PayrollTableRow[]>(() =>
  payrollsStore.all.flatMap((payroll) =>
    payroll.lines.map((line) => {
      const currentEmployee = employeesStore.byId(line.employeeId);

      return {
        ...line,
        employeeAvatar: resolveEmployeeAvatar(currentEmployee, line.employeeAvatar),
        rowId: `${payroll.periodKey}-${line.employeeId}`,
        periodKey: payroll.periodKey,
        periodLabel: payroll.periodLabel,
        payrollNetTotal: payroll.totalNetPay,
        groupEmployeeCount: payroll.employeeCount,
        paymentStatus: line.paymentStatus,
        status: line.paymentStatus,
        isGenerated: true,
      };
    }),
  ),
);

const selectedUngeneratedRows = computed<PayrollTableRow[]>(() =>
  generatedForSelectedPeriod.value
    ? []
    : selectedPeriodLines.value.map((line) => ({
        ...line,
        rowId: `${selectedPeriodKey.value}-${line.employeeId}`,
        periodKey: selectedPeriodKey.value,
        periodLabel: selectedPeriodLabel.value,
        payrollNetTotal: selectedPeriodTotals.value.totalNetPay,
        groupEmployeeCount: selectedPeriodTotals.value.employeeCount,
        paymentStatus: "Not Paid",
        status: "Not Paid",
        isGenerated: false,
      })),
);

const payrollRows = computed<PayrollTableRow[]>(() => [
  ...selectedUngeneratedRows.value,
  ...generatedRows.value,
]);

const getSortableValue = (
  row: PayrollTableRow,
  key: keyof PayrollTableRow,
): string | number => {
  if (
    key === "baseSalary" ||
    key === "additionsTotal" ||
    key === "deductionsTotal" ||
    key === "netPay" ||
    key === "payrollNetTotal" ||
    key === "paidAmount" ||
    key === "balance"
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
        !selectedPayrollStatus.value ||
        row.paymentStatus === selectedPayrollStatus.value;
      const adjustmentText = [...row.additions, ...row.deductions]
        .map((item) => item.label)
        .join(" ");
      const haystack = [
        row.employeeName,
        row.employeeNumber,
        row.department,
        row.periodLabel,
        row.paymentStatus,
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
      employeeCount: number;
      isGenerated: boolean;
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
      employeeCount: row.groupEmployeeCount,
      isGenerated: row.isGenerated,
      rows: [row],
    });
  });

  return [...groups.values()].sort((left, right) =>
    right.periodKey.localeCompare(left.periodKey),
  );
});

watch(
  groupedPayrollRows,
  (groups) => {
    if (!groups.length) return;
    const current = groups.find((group) => group.periodKey === selectedPeriodKey.value);
    const fallback = current ?? groups[0];
    if (fallback && !expandedGroups.value.length)
      expandedGroups.value = [fallback.periodKey];
  },
  { immediate: true },
);

const isGroupExpanded = (periodKey: string) =>
  expandedGroups.value.includes(periodKey);

const toggleGroup = (periodKey: string) => {
  expandedGroups.value = isGroupExpanded(periodKey)
    ? expandedGroups.value.filter((key) => key !== periodKey)
    : [...expandedGroups.value, periodKey];
};

const statusChipColor = (status?: PayrollPaymentStatus) =>
  status === "Paid"
    ? "success"
    : status === "Partially Paid"
      ? "info"
      : "warning";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const getUnreadMessageCount = (row: PayrollTableRow) =>
  (row.messages ?? []).filter(
    (message) =>
      !message.isRead &&
      String(message.author?.id ?? "") !== String(currentAuthor.value.id),
  ).length;

const openPaymentDrawer = (row: PayrollTableRow) => {
  if (!row.isGenerated) {
    notifications.push("Generate payroll before recording payment.", "warning", 3500);
    return;
  }

  selectedPayRow.value = row;
  paymentDate.value = new Date().toISOString().slice(0, 10);
  paymentMethod.value = "Cash";
  paymentAmount.value = row.balance;
  paymentAttachment.value = null;
  isPaymentDrawerOpen.value = true;
};

const closePaymentDrawer = () => {
  isPaymentDrawerOpen.value = false;
  selectedPayRow.value = null;
  paymentAttachment.value = null;
};

const savePayment = async () => {
  const row = selectedPayRow.value;
  if (!row) return;

  const amount = Math.max(0, Number(paymentAmount.value || 0));
  if (amount <= 0) {
    notifications.push("Enter a payment amount.", "warning", 3500);
    return;
  }
  if (amount > row.balance) {
    notifications.push("Payment cannot exceed remaining balance.", "warning", 3500);
    return;
  }

  const attachmentFileKey = paymentAttachment.value
    ? await saveFile(paymentAttachment.value)
    : null;
  const updated = payrollsStore.recordLinePayment(row.periodKey, row.employeeId, {
    amount,
    paymentDate: paymentDate.value,
    paymentMethod: paymentMethod.value,
    attachmentFileKey,
    attachmentName: paymentAttachment.value?.name ?? null,
  });

  if (!updated) {
    notifications.push("Unable to record payment.", "error", 3500);
    return;
  }

  notifications.push("Payroll payment recorded.", "success", 3500);
  closePaymentDrawer();
};

const openAdditionDrawer = (row: PayrollTableRow) => {
  adjustmentRow.value = row;
  isAdditionDrawerOpen.value = true;
};

const openDeductionDrawer = (row: PayrollTableRow) => {
  adjustmentRow.value = row;
  isDeductionDrawerOpen.value = true;
};

const closeAdjustmentDrawers = () => {
  isAdditionDrawerOpen.value = false;
  isDeductionDrawerOpen.value = false;
  adjustmentRow.value = null;
};

const createManagerNotificationsForRequest = (
  employee: EmployeeProperties,
  requestId: number | string,
  label: string,
  amount: number,
  periodKey: string,
) => {
  const pending: PendingPayrollRequest = {
    employeeId: employee.id,
    employeeName: employee.fullName,
    requestId,
    requestType: label,
    amount,
    managerIds: employee.employment?.reportToIds ?? [],
  };
  notifyManagersForPendingRequests([pending], periodKey);
};

const submitAddition = (payload: any) => {
  const row = adjustmentRow.value;
  const employee = row ? employeesStore.byId(row.employeeId) : null;
  if (!row || !employee) return;

  const created = employeesStore.addRequest(employee.id, {
    type: "Addition",
    additionType: payload.additionType,
    date: payload.date || new Date().toISOString().slice(0, 10),
    amount: Number(payload.amount || 0),
    period: row.periodLabel,
    relatedType: payload.relatedType || "not-linked",
    relatedId: payload.relatedId || "",
    notes: payload.notes || "",
    attachmentLink: payload.attachLink || "",
    status: "pending",
  });

  if (created)
    createManagerNotificationsForRequest(
      employee,
      created.id,
      payload.additionType || "Addition",
      Number(payload.amount || 0),
      row.periodKey,
    );

  notifications.push("Addition request sent for manager approval.", "success", 3500);
  closeAdjustmentDrawers();
};

const submitDeduction = (payload: any) => {
  const row = adjustmentRow.value;
  const employee = row ? employeesStore.byId(row.employeeId) : null;
  if (!row || !employee) return;

  const created = employeesStore.addRequest(employee.id, {
    type: "Deduction",
    deductionType: payload.deductionType,
    date: payload.date || new Date().toISOString().slice(0, 10),
    amount: Number(payload.amount || 0),
    period: row.periodLabel,
    notes: payload.notes || "",
    attachmentLink: payload.attachLink || "",
    status: "pending",
  });

  if (created)
    createManagerNotificationsForRequest(
      employee,
      created.id,
      payload.deductionType || "Deduction",
      Number(payload.amount || 0),
      row.periodKey,
    );

  notifications.push("Deduction request sent for manager approval.", "success", 3500);
  closeAdjustmentDrawers();
};

const openMessageDrawer = (row: PayrollTableRow) => {
  if (!row.isGenerated) {
    notifications.push("Generate payroll before adding payroll notes.", "warning", 3500);
    return;
  }

  selectedMessageRow.value = row;
  isMessageDrawerOpen.value = true;
};

const payrollMessageTodo = computed(() =>
  selectedMessageRow.value
    ? {
        id: selectedMessageRow.value.rowId,
        messages: selectedMessageRow.value.messages ?? [],
      }
    : null,
);

const onMessageSend = (payload: {
  body: string;
  author?: ContactRef;
  messageId?: number | string;
}) => {
  const row = selectedMessageRow.value;
  if (!row) return;

  const message: Message = {
    id: payload.messageId ?? `msg-${Date.now()}`,
    author: payload.author ?? currentAuthor.value,
    body: payload.body,
    createdAt: new Date().toISOString(),
    isRead: true,
    editedAt: null,
  };

  payrollsStore.addLineMessage(row.periodKey, row.employeeId, message);
  nextTick(() => {
    const refreshed = payrollRows.value.find((entry) => entry.rowId === row.rowId);
    if (refreshed) selectedMessageRow.value = refreshed;
  });
};

const onMessageEdit = (payload: {
  messageId: number | string;
  body: string;
}) => {
  const row = selectedMessageRow.value;
  if (!row) return;

  payrollsStore.editLineMessage(
    row.periodKey,
    row.employeeId,
    payload.messageId,
    payload.body,
  );
};

const onMessageReadStateChange = (payload: {
  messageId: number | string;
  isRead: boolean;
}) => {
  const row = selectedMessageRow.value;
  if (!row) return;

  payrollsStore.toggleLineMessageRead(
    row.periodKey,
    row.employeeId,
    payload.messageId,
    payload.isRead,
  );
};

const payrollActions = (row: PayrollTableRow) => [
  {
    title: "Pay",
    icon: "tabler-cash",
    disabled: !row.isGenerated || row.paymentStatus === "Paid",
    onClick: () => openPaymentDrawer(row),
  },
  {
    title: "Additions",
    icon: "tabler-plus",
    onClick: () => openAdditionDrawer(row),
  },
  {
    title: "Deductions",
    icon: "tabler-minus",
    onClick: () => openDeductionDrawer(row),
  },
  {
    title: "Notes",
    icon: "tabler-message",
    disabled: !row.isGenerated,
    onClick: () => openMessageDrawer(row),
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
            :items="['Not Paid', 'Partially Paid', 'Paid']"
          />
        </div>

        <VBtn
          prepend-icon="tabler-calculator"
          :disabled="!canGeneratePayroll"
          @click="generatePayroll"
        >
          Generate Payroll
        </VBtn>
      </VCardText>

      <VDivider />

      <VCardText class="pa-0">
        <VTable v-if="payrollRows.length" class="payroll-table">
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
                  @click="sortPayrollBy('paymentStatus')"
                >
                  Status
                  <VIcon icon="tabler-arrows-sort" size="16" />
                </button>
              </th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groupedPayrollRows" :key="group.periodKey">
              <tr class="payroll-group-row" @click="toggleGroup(group.periodKey)">
                <td colspan="7">
                  <div class="payroll-group-header">
                    <div class="d-flex align-center gap-2">
                      <VIcon
                        :icon="
                          isGroupExpanded(group.periodKey)
                            ? 'tabler-chevron-down'
                            : 'tabler-chevron-right'
                        "
                        size="18"
                      />
                      <span>{{ group.periodLabel }}</span>
                      <VChip size="x-small" variant="tonal">
                        {{ group.isGenerated ? "Generated" : "Draft" }}
                      </VChip>
                    </div>
                    <div class="payroll-group-total">
                      <span>{{ group.employeeCount }} employees</span>
                      <strong>
                        Net generated payroll:
                        {{ formatMoney(group.payrollNetTotal) }}
                      </strong>
                    </div>
                  </div>
                </td>
              </tr>

              <template v-if="isGroupExpanded(group.periodKey)">
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
                        <span v-bind="props">
                          {{ formatMoney(row.additionsTotal) }}
                        </span>
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
                    <div v-if="row.isGenerated" class="text-xs text-disabled">
                      Balance {{ formatMoney(row.balance) }}
                    </div>
                  </td>
                  <td>
                    <VChip
                      :color="statusChipColor(row.paymentStatus)"
                      label
                      size="x-small"
                      variant="tonal"
                    >
                      {{ row.paymentStatus }}
                    </VChip>
                  </td>
                  <td class="text-end">
                    <VMenu>
                      <template #activator="{ props }">
                        <IconBtn v-bind="props">
                          <VIcon icon="tabler-dots-vertical" />
                        </IconBtn>
                      </template>

                      <VList>
                        <VListItem
                          v-for="action in payrollActions(row)"
                          :key="action.title"
                          :disabled="action.disabled"
                          @click="action.onClick"
                        >
                          <template #prepend>
                            <VBadge
                              v-if="action.title === 'Notes'"
                              :model-value="getUnreadMessageCount(row) > 0"
                              :content="getUnreadMessageCount(row)"
                              color="error"
                              location="top end"
                              overlap
                            >
                              <VIcon :icon="action.icon" />
                            </VBadge>
                            <VIcon v-else :icon="action.icon" />
                          </template>
                          <VListItemTitle>{{ action.title }}</VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </td>
                </tr>
              </template>
            </template>

            <tr v-if="!groupedPayrollRows.length">
              <td colspan="7" class="text-center text-disabled py-8">
                No payroll rows match the current filters.
              </td>
            </tr>
          </tbody>
        </VTable>

        <VAlert v-else type="info" variant="tonal" class="ma-5">
          No active employees for this payroll period.
        </VAlert>
      </VCardText>
    </VCard>

    <VNavigationDrawer
      v-model="isPaymentDrawerOpen"
      temporary
      location="end"
      :width="400"
      class="scrollable-content payroll-payment-drawer"
      style="z-index: 2000"
    >
      <AppDrawerHeaderSection title="Payroll Payment" @cancel="closePaymentDrawer" />
      <VDivider />

      <VCard v-if="selectedPayRow" flat>
        <VCardText>
          <h6 class="text-subtitle-1 mb-4">
            Name: {{ selectedPayRow.employeeName }}
          </h6>
          <h6 class="text-subtitle-1 mb-6">
            Period: {{ selectedPayRow.periodLabel }}
          </h6>

          <AppDateTimePicker v-model="paymentDate" label="Payment Date" />

          <div class="payroll-breakdown-title mt-5">Earnings</div>
          <div class="payroll-breakdown">
            <div><span>Salary</span><strong>{{ formatMoney(selectedPayRow.basicSalary) }}</strong></div>
            <div><span>Housing Allowance</span><strong>{{ formatMoney(selectedPayRow.housing) }}</strong></div>
            <div><span>Trans. Allowance</span><strong>{{ formatMoney(selectedPayRow.transportation) }}</strong></div>
            <div><span>Other Allowance</span><strong>{{ formatMoney(selectedPayRow.allowance) }}</strong></div>
            <div><span>Additions</span><strong>{{ formatMoney(selectedPayRow.additionsTotal) }}</strong></div>
            <div class="text-success"><span>Total Earnings</span><strong>{{ formatMoney(selectedPayRow.baseSalary + selectedPayRow.additionsTotal) }}</strong></div>
          </div>

          <div class="payroll-breakdown-title mt-5">Deductions</div>
          <div class="payroll-breakdown">
            <div><span>Leave</span><strong>{{ formatMoney(selectedPayRow.deductions.filter((item) => item.type === 'Leave').reduce((sum, item) => sum + item.amount, 0)) }}</strong></div>
            <div><span>Deductions</span><strong>{{ formatMoney(selectedPayRow.deductions.filter((item) => item.type === 'Deduction').reduce((sum, item) => sum + item.amount, 0)) }}</strong></div>
            <div><span>Advances</span><strong>{{ formatMoney(0) }}</strong></div>
            <div class="text-error"><span>Total Deductions</span><strong>{{ formatMoney(selectedPayRow.deductionsTotal) }}</strong></div>
          </div>

          <div class="mt-5 text-body-1">
            Net Salary: {{ formatMoney(selectedPayRow.netPay) }}
          </div>
          <div class="text-sm text-disabled">
            Remaining: {{ formatMoney(selectedPayRow.balance) }}
          </div>

          <VDivider class="my-5" />

          <AppSelect
            v-model="paymentMethod"
            label="Payment Method"
            :items="['Cash', 'Bank Transfer', 'Cheque']"
          />

          <AppTextField
            v-model="paymentAmount"
            class="mt-4"
            type="number"
            min="0"
            :max="selectedPayRow.balance"
            label="Amount"
          />

          <VDivider class="my-5" />

          <VFileInput
            v-model="paymentAttachment"
            label="Attachment File"
            placeholder="Choose File"
          />
        </VCardText>

        <VCardActions class="px-6 pb-6 justify-space-between">
          <VBtn color="primary" @click="savePayment">Pay</VBtn>
          <VBtn color="secondary" variant="tonal" @click="closePaymentDrawer">
            Cancel
          </VBtn>
        </VCardActions>
      </VCard>
    </VNavigationDrawer>

    <AddAdditionsDrawer
      v-model:is-drawer-open="isAdditionDrawerOpen"
      title-override="Add Addition"
      :addition-data="
        adjustmentRow
          ? {
              additionType: '',
              date: new Date().toISOString().slice(0, 10),
              amount: '',
              period: adjustmentRow.periodLabel,
              relatedType: 'not-linked',
              relatedId: '',
              notes: '',
              file: null,
              attachLink: '',
            }
          : null
      "
      @submit="submitAddition"
      @close="closeAdjustmentDrawers"
    />

    <AddDeductionDrawer
      v-model:is-drawer-open="isDeductionDrawerOpen"
      title-override="Add Deduction"
      :deduction-data="
        adjustmentRow
          ? {
              deductionType: '',
              date: new Date().toISOString().slice(0, 10),
              amount: '',
              period: adjustmentRow.periodLabel,
              notes: '',
              file: null,
              attachLink: '',
            }
          : null
      "
      @submit="submitDeduction"
      @close="closeAdjustmentDrawers"
    />

    <MessageDrawer
      v-model:is-drawer-open="isMessageDrawerOpen"
      :todo="payrollMessageTodo"
      :author="currentAuthor"
      @send="onMessageSend"
      @edit-message="onMessageEdit"
      @toggle-read="onMessageReadStateChange"
    />

    <VDialog v-model="isPendingRequestsDialogOpen" max-width="680">
      <DialogCloseBtn @click="isPendingRequestsDialogOpen = false" />
      <VCard>
        <VCardItem title="Pending manager approvals" />
        <VDivider />
        <VCardText>
          <p class="mb-4">
            Payroll cannot be generated until these requests are approved or
            declined.
          </p>
          <VTable density="compact">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Request</th>
                <th class="text-end">Amount</th>
                <th>Managers</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="request in pendingRequestsForDialog"
                :key="`${request.employeeId}-${request.requestId}`"
              >
                <td>{{ request.employeeName }}</td>
                <td>{{ request.requestType }}</td>
                <td class="text-end">{{ formatMoney(request.amount) }}</td>
                <td>{{ request.managerIds.join(", ") || "No manager" }}</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
        <VCardActions class="justify-end px-6 pb-6">
          <VBtn color="primary" @click="isPendingRequestsDialogOpen = false">
            Close
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </section>
</template>

<style lang="scss">
#finance-payroll {
  .payroll-period-control,
  .payroll-list-filter {
    inline-size: 14rem;
  }

  .payroll-table {
    th {
      white-space: nowrap;
    }

    td {
      vertical-align: middle;
    }
  }

  .payroll-sort-button {
    display: inline-flex;
    align-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    gap: 0.25rem;
    inline-size: 100%;
    padding: 0;
  }

  .justify-end {
    justify-content: flex-end;
  }

  .payroll-group-row {
    cursor: pointer;

    td {
      background: rgba(var(--v-theme-on-surface), 0.04);
    }
  }

  .payroll-group-header,
  .payroll-group-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .payroll-group-total {
    justify-content: flex-end;
  }

  .payroll-breakdown-title {
    color: rgba(var(--v-theme-primary), 0.8);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .payroll-breakdown {
    overflow: hidden;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;

    div {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 1rem;
    }

    div + div {
      border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    }
  }

  @media (max-width: 960px) {
    .payroll-group-header,
    .payroll-group-total {
      align-items: flex-start;
      flex-direction: column;
    }
  }
}
</style>
