export type FinanceApprovalStatus = "pending" | "approved" | "rejected";

export type FinanceApprovalRecord = {
  approvalMode?: string | null;
  approvalRequestedAt?: string | null;
  approvalStatus?: FinanceApprovalStatus | null;
  approvalApprovedAt?: string | null;
  approvalApprovedBy?: number | string | null;
  approvalRejectedAt?: string | null;
  approvalRejectedBy?: number | string | null;
};

export type FinanceRevisionRecord = {
  id?: number | string | null;
  parentQuotationId?: number | string | null;
  revisionLabel?: string | null;
  quoteNumber?: string | null;
  issuedDate?: string | null;
  quotationStatus?: string | null;
};

export const FINANCE_APPROVAL_CONVERSION_MESSAGE =
  "Approval required before conversion";
export const FINANCE_APPROVAL_PAYMENT_MESSAGE =
  "Approval required before payment";

export function requiresFinanceApproval(record: FinanceApprovalRecord | null | undefined) {
  return record?.approvalMode === "Request Approval";
}

export function normalizeFinanceApprovalStatus(
  record: FinanceApprovalRecord | null | undefined,
): FinanceApprovalStatus | null {
  if (!requiresFinanceApproval(record)) return null;

  if (record?.approvalStatus === "approved" || record?.approvalApprovedAt) {
    return "approved";
  }

  if (record?.approvalStatus === "rejected" || record?.approvalRejectedAt) {
    return "rejected";
  }

  return "pending";
}

export function canConvertFinanceDocument(record: FinanceApprovalRecord | null | undefined) {
  return !requiresFinanceApproval(record) || normalizeFinanceApprovalStatus(record) === "approved";
}

export function canRecordInvoicePayment(record: FinanceApprovalRecord | null | undefined) {
  return canConvertFinanceDocument(record);
}

export function normalizeFinanceApprovalFields<T extends FinanceApprovalRecord>(
  record: T,
): T {
  if (!requiresFinanceApproval(record)) {
    record.approvalStatus = null;
    record.approvalApprovedAt = null;
    record.approvalApprovedBy = null;
    record.approvalRejectedAt = null;
    record.approvalRejectedBy = null;

    return record;
  }

  record.approvalStatus = normalizeFinanceApprovalStatus(record) ?? "pending";

  if (record.approvalStatus === "approved") {
    record.approvalRejectedAt = null;
    record.approvalRejectedBy = null;
  } else if (record.approvalStatus === "rejected") {
    record.approvalApprovedAt = null;
    record.approvalApprovedBy = null;
  } else {
    record.approvalApprovedAt = null;
    record.approvalApprovedBy = null;
    record.approvalRejectedAt = null;
    record.approvalRejectedBy = null;
  }

  return record;
}

export function conversionNoteReferencesDocument(
  note: string | null | undefined,
  kind: "quotation" | "proforma",
  documentNumber: string | null | undefined,
) {
  const normalizedNote = String(note ?? "").toLowerCase();
  const normalizedNumber = String(documentNumber ?? "").trim().toLowerCase();

  return Boolean(
    normalizedNumber &&
      normalizedNote.includes(`converted from ${kind} ${normalizedNumber}`),
  );
}

const getRevisionOrder = (record: FinanceRevisionRecord) => {
  const labelMatch = record.revisionLabel?.match(/R(\d+)$/i);
  if (labelMatch?.[1]) return Number(labelMatch[1]);

  const numberMatch = record.quoteNumber?.match(/-R(\d+)$/i);
  if (numberMatch?.[1]) return Number(numberMatch[1]);

  return 0;
};

const compareRevisionRecordsNewestFirst = (
  a: FinanceRevisionRecord,
  b: FinanceRevisionRecord,
) => {
  const revisionDelta = getRevisionOrder(b) - getRevisionOrder(a);
  if (revisionDelta !== 0) return revisionDelta;

  const dateDelta =
    new Date(b.issuedDate ?? "").getTime() -
    new Date(a.issuedDate ?? "").getTime();
  if (Number.isFinite(dateDelta) && dateDelta !== 0) return dateDelta;

  return Number(b.id) - Number(a.id);
};

export function cancelOlderFinanceFamilyVersions<T extends FinanceRevisionRecord>(
  records: T[],
  approvedRecord: T,
  cancelRecord: (record: T) => void,
) {
  const approvedId = String(approvedRecord.id ?? "");
  if (!approvedId) return 0;

  const rootId = String(approvedRecord.parentQuotationId ?? approvedRecord.id);
  const family = records
    .filter((record) => {
      const recordId = String(record.id ?? "");
      const recordRootId = String(record.parentQuotationId ?? record.id);

      return recordId === rootId || recordRootId === rootId;
    })
    .sort(compareRevisionRecordsNewestFirst);

  const latest = family[0];
  if (!latest || String(latest.id ?? "") !== approvedId) return 0;

  const olderVersions = family.filter(
    (record) => String(record.id ?? "") !== approvedId,
  );

  olderVersions.forEach(cancelRecord);

  return olderVersions.length;
}
