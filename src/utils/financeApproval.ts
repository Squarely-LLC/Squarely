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

export const FINANCE_APPROVAL_CONVERSION_MESSAGE =
  "Approval required before conversion";

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
