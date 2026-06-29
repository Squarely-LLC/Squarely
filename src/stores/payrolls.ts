import type { Message } from "@/data/schema";
import { normalizeAuthorRef } from "@/utils/currentAccount";
import { defineStore } from "pinia";

export type PayrollPaymentStatus = "Not Paid" | "Partially Paid" | "Paid";

export type PayrollLineAdjustment = {
  id: number | string;
  type: "Addition" | "Deduction" | "Leave";
  label: string;
  amount: number;
};

export type PayrollLinePayment = {
  id: number | string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  attachmentFileKey?: string | null;
  attachmentName?: string | null;
  createdAt: string;
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
  payments: PayrollLinePayment[];
  paidAmount: number;
  balance: number;
  paymentStatus: PayrollPaymentStatus;
  status?: PayrollPaymentStatus;
  note?: string;
  messages: Message[];
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

const normalizePaymentStatus = (
  netPay: number,
  paidAmount: number,
): PayrollPaymentStatus => {
  if (paidAmount <= 0) return "Not Paid";
  if (paidAmount >= Math.max(0, Number(netPay || 0))) return "Paid";

  return "Partially Paid";
};

const normalizeMessage = (message: Message): Message => ({
  ...message,
  author: normalizeAuthorRef(message.author),
  body: message.body ?? "",
  createdAt: message.createdAt ?? new Date().toISOString(),
  isRead: Boolean(message.isRead),
  editedAt: message.editedAt ?? null,
});

const normalizePayrollLine = (line: Partial<PayrollLine>): PayrollLine => {
  const netPay = Number(line.netPay || 0);
  const payments = Array.isArray(line.payments)
    ? line.payments.map((payment) => ({
        id: payment.id,
        amount: Math.max(0, Number(payment.amount || 0)),
        paymentDate: payment.paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod: payment.paymentMethod || "Cash",
        attachmentFileKey: payment.attachmentFileKey ?? null,
        attachmentName: payment.attachmentName ?? null,
        createdAt: payment.createdAt || new Date().toISOString(),
      }))
    : [];
  const paidAmount = payments.length
    ? payments.reduce((sum, payment) => sum + payment.amount, 0)
    : line.status === "Paid" || line.paymentStatus === "Paid"
      ? netPay
      : Math.max(0, Number(line.paidAmount || 0));
  const normalizedPaidAmount = Math.min(Math.max(0, paidAmount), netPay);
  const balance = Math.max(0, netPay - normalizedPaidAmount);
  const paymentStatus = normalizePaymentStatus(netPay, normalizedPaidAmount);

  return {
    employeeId: line.employeeId ?? "",
    employeeName: line.employeeName || "Employee",
    employeeNumber: line.employeeNumber || String(line.employeeId ?? ""),
    employeeAvatar: line.employeeAvatar || "",
    department: line.department || "-",
    basicSalary: Number(line.basicSalary || 0),
    transportation: Number(line.transportation || 0),
    housing: Number(line.housing || 0),
    allowance: Number(line.allowance || 0),
    baseSalary: Number(line.baseSalary || 0),
    additions: Array.isArray(line.additions) ? line.additions : [],
    deductions: Array.isArray(line.deductions) ? line.deductions : [],
    additionsTotal: Number(line.additionsTotal || 0),
    deductionsTotal: Number(line.deductionsTotal || 0),
    netPay,
    payments,
    paidAmount: normalizedPaidAmount,
    balance,
    paymentStatus,
    status: paymentStatus,
    note: line.note || "",
    messages: Array.isArray(line.messages)
      ? line.messages.map((message) => normalizeMessage(message))
      : [],
  };
};

const normalizePayroll = (payroll: PayrollRun): PayrollRun => {
  const lines = (payroll.lines ?? []).map(normalizePayrollLine);

  return {
    ...payroll,
    employeeCount: lines.length,
    totalBaseSalary: Number(payroll.totalBaseSalary || 0),
    totalAdditions: Number(payroll.totalAdditions || 0),
    totalDeductions: Number(payroll.totalDeductions || 0),
    totalNetPay: Number(payroll.totalNetPay || 0),
    lines,
  };
};

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
    findLine(periodKey: string, employeeId: number | string) {
      const payroll = this.items.find((item) => item.periodKey === periodKey);
      if (!payroll) return null;

      const line = payroll.lines.find(
        (entry) => String(entry.employeeId) === String(employeeId),
      );

      return line ? { payroll, line } : null;
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
    recordLinePayment(
      periodKey: string,
      employeeId: number | string,
      payment: Omit<PayrollLinePayment, "id" | "createdAt">,
    ) {
      this.init();

      const found = this.findLine(periodKey, employeeId);
      if (!found) return null;

      const amount = Math.max(0, Number(payment.amount || 0));
      if (amount <= 0 || amount > found.line.balance) return null;

      found.line.payments.push({
        ...payment,
        amount,
        id: `pay-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      const normalized = normalizePayrollLine(found.line);
      Object.assign(found.line, normalized);
      this.persist();

      return clonePayroll(normalizePayroll(found.payroll));
    },
    updateLineStatus(
      periodKey: string,
      employeeId: number | string,
      status: PayrollPaymentStatus,
    ) {
      this.init();

      const found = this.findLine(periodKey, employeeId);
      if (!found) return null;

      found.line.payments =
        status === "Paid"
          ? [
              {
                id: `pay-${Date.now()}`,
                amount: found.line.netPay,
                paymentDate: new Date().toISOString().slice(0, 10),
                paymentMethod: "Cash",
                attachmentFileKey: null,
                attachmentName: null,
                createdAt: new Date().toISOString(),
              },
            ]
          : [];
      Object.assign(found.line, normalizePayrollLine(found.line));
      this.persist();

      return clonePayroll(normalizePayroll(found.payroll));
    },
    addLineMessage(
      periodKey: string,
      employeeId: number | string,
      message: Message,
    ) {
      this.init();

      const found = this.findLine(periodKey, employeeId);
      if (!found) return null;

      found.line.messages.push(normalizeMessage(message));
      this.persist();

      return clonePayroll(normalizePayroll(found.payroll));
    },
    editLineMessage(
      periodKey: string,
      employeeId: number | string,
      messageId: number | string,
      body: string,
    ) {
      this.init();

      const found = this.findLine(periodKey, employeeId);
      if (!found) return null;

      found.line.messages = found.line.messages.map((message) =>
        String(message.id) === String(messageId)
          ? { ...message, body, editedAt: new Date().toISOString() }
          : message,
      );
      this.persist();

      return clonePayroll(normalizePayroll(found.payroll));
    },
    toggleLineMessageRead(
      periodKey: string,
      employeeId: number | string,
      messageId: number | string,
      isRead: boolean,
    ) {
      this.init();

      const found = this.findLine(periodKey, employeeId);
      if (!found) return null;

      found.line.messages = found.line.messages.map((message) =>
        String(message.id) === String(messageId)
          ? { ...message, isRead }
          : message,
      );
      this.persist();

      return clonePayroll(normalizePayroll(found.payroll));
    },
  },
});
