import { database as invoiceDatabase } from "@/plugins/fake-api/handlers/apps/invoice/db";
import { database as proformaDatabase } from "@/plugins/fake-api/handlers/apps/proforma/db";
import type { ReceiptRecord } from "@/plugins/fake-api/handlers/apps/receipt/types";

const year = new Date().getFullYear();

const buildInvoiceReceipt = (
  id: number,
  invoiceId: number,
  amount: number,
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

const buildProformaReceipt = (
  id: number,
  proformaId: number,
  amount: number,
): ReceiptRecord => {
  const proformaRecord = proformaDatabase.find(
    (record) => record.quotation.id === proformaId,
  );

  if (!proformaRecord) {
    throw new Error(`Missing proforma seed for receipt ${id}`);
  }

  return {
    receipt: {
      id,
      receiptNumber: `RV-${id}`,
      issuedDate: `${year}-04-${String((id % 7) + 10).padStart(2, "0")}`,
      receivedDate: `${year}-04-${String((id % 7) + 10).padStart(2, "0")}`,
      client: { ...proformaRecord.quotation.client },
      amount,
      avatar: proformaRecord.quotation.avatar || "",
      status: "Recorded",
      sourceType: "proforma",
      linkedInvoiceId: null,
      linkedInvoiceNumber: null,
      linkedProformaId: proformaRecord.quotation.id,
      linkedProformaNumber: proformaRecord.quotation.quoteNumber,
      attachmentName: null,
      attachmentFileKey: null,
    },
    paymentMethod: proformaRecord.paymentMethod || "Cash",
    note: "Receipt generated from a Squarely proforma.",
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
  buildInvoiceReceipt(9101, 6301, 2100),
  buildProformaReceipt(9102, 6201, 3200),
  buildFlaggedReceipt(),
];
