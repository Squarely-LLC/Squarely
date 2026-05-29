export type DealFieldValue = string | number | boolean | null;

export type DealBillingPeriodKind =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export interface DealBillingPeriod {
  kind: DealBillingPeriodKind;
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

import type { CatalogueSalesTask } from "@/plugins/fake-api/handlers/catalogues/types";
import type { JobDocument } from "@/plugins/fake-api/handlers/operations/jobs/types";

export interface DealItemOverride {
  name?: string | null;
  category?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  periodUnitPrices?: Record<string, number | null> | null;
  discountPercent?: number | null;
  taxApplicable?: boolean | null;
  note?: string | null;
}

export interface DealCustomPhase {
  id: string;
  name: string;
  category?: string | null;
  quantity?: number | null;
  price?: number | null;
  discountPercent?: number | null;
  taxApplicable?: boolean | null;
  note?: string | null;
}

export interface DealItem {
  id: number;
  name: string;
  itemTypeLabel?: string | null;
  category?: string | null;
  catalogueItemId?: string | null;
  catalogueType?: string | null;
  parentItemId?: number | null;
  sourceRelatedItemId?: number | null;
  removedPhaseIds?: number[] | null;
  customPhases?: DealCustomPhase[] | null;
  excludedRelatedItemIds?: number[] | null;
  generatedTaskIds?: Array<number | string> | null;
  subItemOverrides?: Record<string, DealItemOverride> | null;
  discountPercent?: number | null;
  taxApplicable?: boolean | null;
  quantity: number;
  recurrentStartDate?: string | null;
  recurrentEndDate?: string | null;
  recurrentPeriods?: number | null;
  recurrentBillablePeriods?: number | null;
  retainerStartDate?: string | null;
  retainerEndDate?: string | null;
  retainerPeriods?: number | null;
  retainerBillablePeriods?: number | null;
  unitPrice?: number | null;
  status?: string | null;
  note?: string | null;
}

export interface DealFinancialEntry {
  id: number;
  title: string;
  type: "quotation" | "invoice" | "payment" | "cost";
  amount: number;
  status?: string | null;
  dueDate?: string | null;
  createdAt: string;
}

export interface DealNote {
  id: string;
  body: string;
  createdAt: string;
  authorName?: string | null;
}

export type DealStageLifecycleEvent =
  | "deal-created"
  | "quotation-created"
  | "proforma-created"
  | "invoice-created"
  | "invoice-payment-updated";

export interface DealPendingStageTransition {
  targetStage: string;
  reason: string;
  event: DealStageLifecycleEvent;
  requestedAt: string;
}

export interface DealSalesTaskTemplate extends CatalogueSalesTask {
  sourceItemId?: number | null;
  sourceTaskId?: number | null;
}

export interface DealProperties {
  id: number;
  name: string;
  code?: string | null;
  amount?: number | null;
  projectCode?: string | null;
  projectName?: string | null;
  relatedTo?: number | null;
  linkedJobId?: number | null;
  salesman?: number | string | null;
  type?: string | null;
  estimatedDeliveryDate?: string | null;
  stage?: string | null;
  important: boolean;
  location?: string | null;
  collaborators: Array<number | string>;
  note?: string | null;
  customFieldValues: Record<string, DealFieldValue>;
  stageManuallyManaged?: boolean;
  pendingStageTransition?: DealPendingStageTransition | null;
  notes?: DealNote[];
  items: DealItem[];
  salesTasks?: DealSalesTaskTemplate[];
  documents: JobDocument[];
  financials: DealFinancialEntry[];
  createdAt: string;
  updatedAt: string;
}
