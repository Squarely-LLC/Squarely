export type ExpenseStatus = "Open" | "Paid" | "Flagged" | "Partially Paid";

export interface ExpensePaymentEntry {
  id: string;
  voucherNumber: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  createdAt: string;
  balanceBefore: number;
  balanceAfter: number;
}

export interface ExpenseSupplier {
  id: number | null;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Expense {
  id: number;
  billNumber: string;
  billDate: string;
  supplier: ExpenseSupplier;
  category: string;
  supplierInvoiceNumber: string;
  amount: number;
  balance: number;
  status: ExpenseStatus;
  attachmentName?: string | null;
  attachmentFileKey?: string | null;
  paidAt?: string | null;
  avatar?: string | null;
  paymentMethod?: string | null;
}

export interface ExpenseRecord {
  expense: Expense;
  payments?: ExpensePaymentEntry[];
  note: string;
}
