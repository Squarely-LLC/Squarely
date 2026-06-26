import type { ProformaRecord } from "@/plugins/fake-api/handlers/apps/proforma/types";
import type { QuotationRecord } from "@/plugins/fake-api/handlers/apps/quotation/types";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { normalizeFinanceApprovalStatus } from "@/utils/financeApproval";

export type FinanceApprovalDocumentKind = "quotation" | "proforma";

type FinanceApprovalDocument = QuotationRecord | ProformaRecord;

const routeNameForKind = (kind: FinanceApprovalDocumentKind) =>
  kind === "quotation" ? "apps-quotation-preview-id" : "apps-proforma-preview-id";

const labelForKind = (kind: FinanceApprovalDocumentKind) =>
  kind === "quotation" ? "Quotation" : "Proforma";

const normalizeId = (value: unknown) => String(value ?? "").trim();

const sameApprover = (
  record: FinanceApprovalDocument,
  previousRecord: FinanceApprovalDocument | null | undefined,
) =>
  Boolean(previousRecord) &&
  normalizeId(record.approverEmployeeId) ===
    normalizeId(previousRecord?.approverEmployeeId);

export function applyFinanceApprovalRequestFields(
  record: FinanceApprovalDocument,
  previousRecord?: FinanceApprovalDocument | null,
  requestedAt = new Date().toISOString(),
) {
  if (
    record.approvalMode !== "Request Approval" ||
    record.approverEmployeeId === null ||
    record.approverEmployeeId === undefined ||
    record.approverEmployeeId === ""
  ) {
    return false;
  }

  const previousStatus = normalizeFinanceApprovalStatus(previousRecord);
  const previousWasPending =
    previousStatus === "pending" &&
    Boolean(previousRecord?.approvalRequestedAt) &&
    sameApprover(record, previousRecord);

  if (!previousWasPending) {
    record.approvalRequestedAt = requestedAt;
    record.approvalStatus = "pending";
    record.approvalApprovedAt = null;
    record.approvalApprovedBy = null;
    record.approvalRejectedAt = null;
    record.approvalRejectedBy = null;
  }

  return !previousWasPending;
}

export function notifyFinanceApprovalRequest(
  kind: FinanceApprovalDocumentKind,
  record: FinanceApprovalDocument,
  options: {
    previousRecord?: FinanceApprovalDocument | null;
    force?: boolean;
    reminder?: boolean;
  } = {},
) {
  if (
    record.approvalMode !== "Request Approval" ||
    record.approverEmployeeId === null ||
    record.approverEmployeeId === undefined ||
    record.approverEmployeeId === ""
  ) {
    return false;
  }

  const previousWasPending =
    normalizeFinanceApprovalStatus(options.previousRecord) === "pending" &&
    Boolean(options.previousRecord?.approvalRequestedAt) &&
    sameApprover(record, options.previousRecord);

  if (!options.force && previousWasPending) return false;

  const notificationsStore = useSystemNotificationsStore();
  notificationsStore.init();

  const label = labelForKind(kind);
  const number = record.quotation.quoteNumber || `#${record.quotation.id}`;
  const clientName =
    record.quotation.client?.name ||
    record.quotation.client?.company ||
    "client";

  notificationsStore.addNotification({
    recipientEmployeeId: record.approverEmployeeId,
    title: `${label} approval ${options.reminder ? "reminder" : "request"}: ${number}`,
    body: `${label} ${number} for ${clientName} is waiting for approval.`,
    type: "finance-approval",
    target: {
      entityType: kind,
      entityId: record.quotation.id,
      routeName: routeNameForKind(kind),
      params: { id: record.quotation.id },
    },
  });

  return true;
}
