import type { InvoiceRecord } from "@/plugins/fake-api/handlers/apps/invoice/types";
import type { ProformaRecord } from "@/plugins/fake-api/handlers/apps/proforma/types";
import type { QuotationRecord } from "@/plugins/fake-api/handlers/apps/quotation/types";
import { useSystemNotificationsStore } from "@/stores/systemNotifications";
import { normalizeFinanceApprovalStatus } from "@/utils/financeApproval";

export type FinanceApprovalDocumentKind = "quotation" | "proforma" | "invoice";

type FinanceApprovalDocument = QuotationRecord | ProformaRecord | InvoiceRecord;
type FinanceApprovalDecisionStatus = "approved" | "rejected";
type FinanceApprovalAuthorRef = {
  id?: number | string | null;
  accountId?: number | string | null;
  employeeId?: number | string | null;
  personId?: number | string | null;
  name?: string | null;
} | null;

const routeNameForKind = (kind: FinanceApprovalDocumentKind) =>
  kind === "quotation"
    ? "apps-quotation-preview-id"
    : kind === "proforma"
      ? "apps-proforma-preview-id"
      : "apps-invoice-preview-id";

const labelForKind = (kind: FinanceApprovalDocumentKind) =>
  kind === "quotation" ? "Quotation" : kind === "proforma" ? "Proforma" : "Invoice";

const normalizeId = (value: unknown) => String(value ?? "").trim();
const idsMatch = (left: unknown, right: unknown) =>
  normalizeId(left) !== "" && normalizeId(left) === normalizeId(right);

const sameApprover = (
  record: FinanceApprovalDocument,
  previousRecord: FinanceApprovalDocument | null | undefined,
) =>
  Boolean(previousRecord) &&
    normalizeId(record.approverEmployeeId) ===
    normalizeId(previousRecord?.approverEmployeeId);

const recordId = (record: FinanceApprovalDocument) => record.quotation.id;
const recordNumber = (record: FinanceApprovalDocument) =>
  record.quotation.quoteNumber || `#${record.quotation.id}`;

const resolveRequesterId = (record: FinanceApprovalDocument) => {
  const looseRecord = record as FinanceApprovalDocument & {
    createdBy?: FinanceApprovalAuthorRef;
    createdById?: number | string | null;
    requestedBy?: FinanceApprovalAuthorRef | number | string | null;
    requestedById?: number | string | null;
    requestedByEmployeeId?: number | string | null;
  };
  const createdBy = looseRecord.createdBy;
  const requestedBy =
    typeof looseRecord.requestedBy === "object" ? looseRecord.requestedBy : null;

  return (
    looseRecord.requestedByEmployeeId ??
    requestedBy?.employeeId ??
    requestedBy?.personId ??
    requestedBy?.id ??
    looseRecord.requestedById ??
    looseRecord.createdById ??
    createdBy?.employeeId ??
    createdBy?.personId ??
    createdBy?.id ??
    createdBy?.accountId ??
    null
  );
};

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

export function dismissFinanceApprovalRequestNotifications(
  kind: FinanceApprovalDocumentKind,
  record: FinanceApprovalDocument,
) {
  const notificationsStore = useSystemNotificationsStore();
  notificationsStore.init();

  const id = recordId(record);
  const routeName = routeNameForKind(kind);
  const approverId = record.approverEmployeeId;
  const ids = notificationsStore.items
    .filter((notification) => {
      if (notification.type !== "finance-approval") return false;
      if (!idsMatch(notification.recipientEmployeeId, approverId)) return false;

      const target = notification.target;
      if (!target) return false;

      return (
        target.entityType === kind &&
        idsMatch(target.entityId, id) &&
        target.routeName === routeName
      );
    })
    .map((notification) => notification.id);

  if (ids.length) notificationsStore.removeMany(ids);

  return ids.length;
}

export function notifyFinanceApprovalDecision(
  kind: FinanceApprovalDocumentKind,
  record: FinanceApprovalDocument,
  decision: FinanceApprovalDecisionStatus,
) {
  const requesterId = resolveRequesterId(record);
  if (requesterId === null || requesterId === undefined || requesterId === "")
    return false;

  const notificationsStore = useSystemNotificationsStore();
  notificationsStore.init();

  const label = labelForKind(kind);
  const number = recordNumber(record);
  const approved = decision === "approved";

  notificationsStore.addNotification({
    recipientEmployeeId: requesterId,
    title: `${label} ${approved ? "approved" : "declined"}: ${number}`,
    body: `${label} ${number} was ${approved ? "approved" : "declined"} by the approver.`,
    type: "finance-approval-decision",
    target: {
      entityType: kind,
      entityId: recordId(record),
      routeName: routeNameForKind(kind),
      params: { id: recordId(record) },
    },
  });

  return true;
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
  const number = recordNumber(record);
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
      entityId: recordId(record),
      routeName: routeNameForKind(kind),
      params: { id: recordId(record) },
    },
  });

  return true;
}
