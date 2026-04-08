export type CatalogueActiveState = string;
export type CatalogueItemType =
  | "Onetime Service"
  | "Product"
  | "Contractual Service"
  | "Retainer Service"
  | "Reccurent Service"
  | "Produced Product"
  | "Rental";

export interface CatalogueBaseRecord {
  id: string;
  name: string;
  brand?: string | null;
  category: string;
  activeState: CatalogueActiveState;
  sku: string;
  image?: string | null;
  createdAt: string;
}

export interface CatalogueInventoryRecord extends CatalogueBaseRecord {
  qty: number;
}

export interface CatalogueServiceRecord extends CatalogueBaseRecord {
  qty?: number | null;
}

export interface CatalogueRelatedItem {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface CatalogueSalesTask {
  id: number;
  title: string;
}

export type CatalogueJobConfigPriority = "Low" | "Normal" | "High";

export type CatalogueJobConfigTaskStatus =
  | "pending"
  | "in_progress"
  | "for_review"
  | "completed";

export interface CatalogueJobConfigTask {
  id: number;
  title: string;
  dueAt: string | null;
  manhours: number | null;
  notes: string;
  status: CatalogueJobConfigTaskStatus;
  important: boolean;
}

export interface CatalogueJobConfigGoal {
  id: number;
  milestoneId: number;
  name: string;
  dueDate: string | null;
  priority: CatalogueJobConfigPriority;
  note: string;
  tasks: CatalogueJobConfigTask[];
}

export interface CatalogueJobConfigMilestone {
  id: number;
  name: string;
  dueDate: string | null;
  priority: CatalogueJobConfigPriority;
  note: string;
  tasks: CatalogueJobConfigTask[];
  goals: CatalogueJobConfigGoal[];
}

export interface CatalogueJobConfiguration {
  milestones: CatalogueJobConfigMilestone[];
}

export interface CatalogueProductRecord extends CatalogueInventoryRecord {
  type: "Product";
}

export interface CatalogueProducedProductRecord extends CatalogueInventoryRecord {
  type: "Produced Product";
}

export interface CatalogueRentalRecord extends CatalogueInventoryRecord {
  type: "Rental";
}

export interface CatalogueOnetimeServiceRecord extends CatalogueServiceRecord {
  type: "Onetime Service";
  description: string;
  relatedItems: CatalogueRelatedItem[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueContractualServiceRecord extends CatalogueServiceRecord {
  type: "Contractual Service";
}

export interface CatalogueRetainerServiceRecord extends CatalogueServiceRecord {
  type: "Retainer Service";
}

export interface CatalogueReccurentServiceRecord extends CatalogueServiceRecord {
  type: "Reccurent Service";
}

export type CatalogueRecord =
  | CatalogueProductRecord
  | CatalogueProducedProductRecord
  | CatalogueRentalRecord
  | CatalogueOnetimeServiceRecord
  | CatalogueContractualServiceRecord
  | CatalogueRetainerServiceRecord
  | CatalogueReccurentServiceRecord;

export interface CatalogueItem {
  id: string;
  sourceId: string;
  sourceTable: CatalogueTableKey;
  name: string;
  brand?: string | null;
  category: string;
  type: CatalogueItemType;
  activeState: CatalogueActiveState;
  sku: string;
  qty: number | null;
  image?: string | null;
  createdAt: string;
}

export type CatalogueRecordInput = Partial<CatalogueItem> &
  Partial<CatalogueOnetimeServiceRecord>;

export interface CatalogueTables {
  products: CatalogueProductRecord[];
  producedProducts: CatalogueProducedProductRecord[];
  rentals: CatalogueRentalRecord[];
  onetimeServices: CatalogueOnetimeServiceRecord[];
  contractualServices: CatalogueContractualServiceRecord[];
  retainerServices: CatalogueRetainerServiceRecord[];
  reccurentServices: CatalogueReccurentServiceRecord[];
}

export type CatalogueTableKey = keyof CatalogueTables;
