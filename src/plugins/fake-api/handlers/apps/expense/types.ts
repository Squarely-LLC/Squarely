export type ExpenseStatus = "Open" | "Paid" | "Flagged";

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
  status: ExpenseStatus;
  attachmentName?: string | null;
  attachmentFileKey?: string | null;
  paidAt?: string | null;
  avatar?: string | null;
}

export interface ExpenseRecord {
  expense: Expense;
  note: string;
}
