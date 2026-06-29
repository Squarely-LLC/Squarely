import type { FinanceApprovalStatus } from "@/utils/financeApproval";

const FINANCE_APPROVAL_DECISIONS_KEY =
  "squarely.finance-approval-decisions.v1";

type FinanceApprovalDocumentKind = "quotation" | "proforma" | "invoice";

type FinanceApprovalDecision = {
  kind: FinanceApprovalDocumentKind;
  id: string;
  number: string;
  approvalStatus: Exclude<FinanceApprovalStatus, "pending">;
  approvalApprovedAt: string | null;
  approvalApprovedBy: number | string | null;
  approvalRejectedAt: string | null;
  approvalRejectedBy: number | string | null;
};

type FinanceApprovalRecordLike = {
  approvalMode?: string | null;
  approvalStatus?: FinanceApprovalStatus | null;
  approvalApprovedAt?: string | null;
  approvalApprovedBy?: number | string | null;
  approvalRejectedAt?: string | null;
  approvalRejectedBy?: number | string | null;
  quotation?: {
    id?: number | string | null;
    quoteNumber?: string | null;
  } | null;
};

const normalize = (value: unknown) => String(value ?? "").trim();

const decisionKey = (
  kind: FinanceApprovalDocumentKind,
  id: unknown,
  number: unknown,
) => `${kind}:${normalize(id)}:${normalize(number).toLowerCase()}`;

const loadDecisions = () => {
  if (typeof window === "undefined") return [] as FinanceApprovalDecision[];

  try {
    const raw = window.localStorage.getItem(FINANCE_APPROVAL_DECISIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as FinanceApprovalDecision[]) : [];
  } catch (error) {
    console.warn("Failed to load finance approval decisions:", error);
    return [];
  }
};

const saveDecisions = (decisions: FinanceApprovalDecision[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      FINANCE_APPROVAL_DECISIONS_KEY,
      JSON.stringify(decisions),
    );
  } catch (error) {
    console.warn("Failed to save finance approval decisions:", error);
  }
};

export const persistFinanceApprovalDecision = (
  kind: FinanceApprovalDocumentKind,
  record: FinanceApprovalRecordLike,
) => {
  if (record.approvalMode !== "Request Approval") return;
  if (record.approvalStatus !== "approved" && record.approvalStatus !== "rejected")
    return;

  const id = normalize(record.quotation?.id);
  const number = normalize(record.quotation?.quoteNumber);
  if (!id && !number) return;

  const nextDecision: FinanceApprovalDecision = {
    kind,
    id,
    number,
    approvalStatus: record.approvalStatus,
    approvalApprovedAt: record.approvalApprovedAt?.trim() || null,
    approvalApprovedBy: record.approvalApprovedBy ?? null,
    approvalRejectedAt: record.approvalRejectedAt?.trim() || null,
    approvalRejectedBy: record.approvalRejectedBy ?? null,
  };
  const nextKey = decisionKey(kind, id, number);
  const decisions = loadDecisions().filter(
    (decision) =>
      decisionKey(kind, decision.id, decision.number) !== nextKey &&
      !(
        decision.kind === kind &&
        ((id && decision.id === id) ||
          (number &&
            decision.number.trim().toLowerCase() === number.toLowerCase()))
      ),
  );

  saveDecisions([...decisions, nextDecision]);
};

export const applyStoredFinanceApprovalDecision = <
  T extends FinanceApprovalRecordLike,
>(
  kind: FinanceApprovalDocumentKind,
  record: T,
) => {
  if (record.approvalMode !== "Request Approval") return record;

  const id = normalize(record.quotation?.id);
  const number = normalize(record.quotation?.quoteNumber);
  const decision = loadDecisions().find(
    (entry) =>
      entry.kind === kind &&
      ((id && entry.id === id) ||
        (number && entry.number.trim().toLowerCase() === number.toLowerCase())),
  );

  if (!decision) return record;

  record.approvalStatus = decision.approvalStatus;
  record.approvalApprovedAt = decision.approvalApprovedAt;
  record.approvalApprovedBy = decision.approvalApprovedBy;
  record.approvalRejectedAt = decision.approvalRejectedAt;
  record.approvalRejectedBy = decision.approvalRejectedBy;

  if (decision.approvalStatus === "approved") {
    record.approvalRejectedAt = null;
    record.approvalRejectedBy = null;
  } else {
    record.approvalApprovedAt = null;
    record.approvalApprovedBy = null;
  }

  return record;
};
