import { defineStore } from "pinia";

export type PayrollLineAdjustment = {
  id: number | string;
  type: "Addition" | "Deduction" | "Leave";
  label: string;
  amount: number;
};

export type PayrollLine = {
  employeeId: number | string;
  employeeName: string;
  employeeNumber: string;
  employeeAvatar?: string;
  department: string;
  basicSalary: number;
  transportation: number;
  housing: number;
  allowance: number;
  baseSalary: number;
  additions: PayrollLineAdjustment[];
  deductions: PayrollLineAdjustment[];
  additionsTotal: number;
  deductionsTotal: number;
  netPay: number;
  status?: "Paid" | "Not Paid";
  note?: string;
};

export type PayrollRun = {
  id: string;
  periodKey: string;
  periodLabel: string;
  generatedAt: string;
  employeeCount: number;
  totalBaseSalary: number;
  totalAdditions: number;
  totalDeductions: number;
  totalNetPay: number;
  lines: PayrollLine[];
};

const STORAGE_KEY = "app.payrolls.v1";

const clonePayroll = (payroll: PayrollRun): PayrollRun =>
  JSON.parse(JSON.stringify(payroll)) as PayrollRun;

const normalizePayrollLine = (line: PayrollLine): PayrollLine => ({
  ...line,
  employeeAvatar: line.employeeAvatar || "",
  status: line.status === "Paid" ? "Paid" : "Not Paid",
  note: line.note || "",
});

const normalizePayroll = (payroll: PayrollRun): PayrollRun => ({
  ...payroll,
  lines: (payroll.lines ?? []).map(normalizePayrollLine),
});

const readStoredPayrolls = (): PayrollRun[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is PayrollRun =>
        Boolean(entry?.periodKey && Array.isArray(entry.lines)),
      )
      .map(normalizePayroll)
      .map(clonePayroll);
  } catch {
    return [];
  }
};

export const usePayrollsStore = defineStore("payrolls", {
  state: () => ({
    items: [] as PayrollRun[],
    initialized: false,
  }),
  getters: {
    all: (state) =>
      [...state.items]
        .map(clonePayroll)
        .sort((a, b) => b.periodKey.localeCompare(a.periodKey)),
    byPeriod:
      (state) =>
      (periodKey: string): PayrollRun | null => {
        const payroll = state.items.find((item) => item.periodKey === periodKey);

        return payroll ? clonePayroll(payroll) : null;
      },
  },
  actions: {
    init() {
      if (this.initialized) return;

      this.items = readStoredPayrolls();
      this.initialized = true;
    },
    persist() {
      if (typeof window === "undefined") return;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    },
    generatePayroll(payload: Omit<PayrollRun, "id" | "generatedAt">) {
      this.init();

      if (this.items.some((item) => item.periodKey === payload.periodKey))
        return null;

      const payroll: PayrollRun = {
        ...normalizePayroll(clonePayroll(payload as PayrollRun)),
        id: `payroll-${payload.periodKey}`,
        generatedAt: new Date().toISOString(),
      };

      this.items = [payroll, ...this.items].sort((a, b) =>
        b.periodKey.localeCompare(a.periodKey),
      );
      this.persist();

      return clonePayroll(payroll);
    },
    updateLineStatus(
      periodKey: string,
      employeeId: number | string,
      status: PayrollLine["status"],
    ) {
      this.init();

      const payroll = this.items.find((item) => item.periodKey === periodKey);
      if (!payroll) return null;

      const line = payroll.lines.find(
        (entry) => String(entry.employeeId) === String(employeeId),
      );
      if (!line) return null;

      line.status = status === "Paid" ? "Paid" : "Not Paid";
      this.persist();

      return clonePayroll(normalizePayroll(payroll));
    },
  },
});
