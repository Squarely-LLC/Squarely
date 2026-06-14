import { database as invoiceDatabase } from "@/plugins/fake-api/handlers/apps/invoice/db";
import type { ReceiptRecord } from "@/plugins/fake-api/handlers/apps/receipt/types";

const year = new Date().getFullYear();

const buildInvoiceReceipt = (
  id: number,
  invoiceId: number,
  amount: number,
  linkedPaymentId: string | null = null,
): ReceiptRecord => {
  const invoiceRecord = invoiceDatabase.find(
    (record) => record.quotation.id === invoiceId,
  );

  if (!invoiceRecord) {
    throw new Error(`Missing invoice seed for receipt ${id}`);
  }

  return {
    receipt: {
      id,
      receiptNumber: `RV-${id}`,
      issuedDate: `${year}-04-0${(id % 7) + 1}`,
      receivedDate: `${year}-04-0${(id % 7) + 1}`,
      linkedPaymentId,
      client: { ...invoiceRecord.quotation.client },
      amount,
      avatar: invoiceRecord.quotation.avatar || "",
      status: "Recorded",
      sourceType: "invoice",
      linkedInvoiceId: invoiceRecord.quotation.id,
      linkedInvoiceNumber: invoiceRecord.quotation.quoteNumber,
      linkedProformaId: null,
      linkedProformaNumber: null,
      attachmentName: null,
      attachmentFileKey: null,
    },
    paymentMethod: invoiceRecord.paymentMethod || "Cash",
    note: "Receipt generated from a Squarely invoice.",
  };
};

const buildFlaggedReceipt = (): ReceiptRecord => ({
  receipt: {
    id: 9103,
    receiptNumber: "RV-9103",
    issuedDate: `${year}-04-18`,
    receivedDate: `${year}-04-18`,
    client: {
      address: "Beirut Digital District",
      company: "Walk-in Client",
      companyEmail: "accounts@walkin-client.example",
      country: "Lebanon",
      contact: "+961 70 000 000",
      name: "Walk-in Client",
    },
    amount: 850,
    avatar: "",
    status: "Flagged",
    sourceType: "manual",
    linkedPaymentId: null,
    linkedInvoiceId: null,
    linkedInvoiceNumber: null,
    linkedProformaId: null,
    linkedProformaNumber: null,
    attachmentName: "cash-counter-slip.pdf",
    attachmentFileKey: null,
  },
  paymentMethod: "Cash",
  note: "Receipt recorded without a linked Squarely invoice or proforma.",
});

export const database: ReceiptRecord[] = [
  buildInvoiceReceipt(9101, 6301, 2100, "inv-pay-6301-1"),
  buildInvoiceReceipt(9102, 6302, 3200, "inv-pay-6302-1"),
  buildInvoiceReceipt(9104, 6401, 900, "inv-pay-6401-1"),
  buildFlaggedReceipt(),
];
