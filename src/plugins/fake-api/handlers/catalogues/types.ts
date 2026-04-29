export type CatalogueActiveState = string;
import type { ContactRef, ToDoAttachment, ToDoStep } from "@/data/schema";

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
  category: string;
  activeState: CatalogueActiveState;
  sku: string;
  image?: string | null;
  bestPrice: number | null;
  chargeTax: boolean;
  description: string;
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
  price: number | null;
  chargeTax: boolean;
  description: string;
}

export interface CatalogueRetainerLinkedService {
  id: number;
  name: string;
  category: string;
  qty: number | null;
  description: string;
}

export interface CatalogueReccurentLinkedService {
  id: number;
  name: string;
  category: string;
  description: string;
}

export type CatalogueProducedProductFieldType =
  | "Text"
  | "Number"
  | "Pictures"
  | "Select Buttons"
  | "Note"
  | "Dropdown";

export interface CatalogueProducedProductField {
  id: number;
  name: string;
  type: CatalogueProducedProductFieldType;
  description: string;
  values: string[];
}

export interface CatalogueProducedProductMaterial {
  id: number;
  name: string;
  qty: number | null;
}

export interface CatalogueProducedProductSubItem {
  id: number;
  name: string;
  options: CatalogueProducedProductField[];
  rawMaterials: CatalogueProducedProductMaterial[];
  measurements: CatalogueProducedProductField[];
}

export interface CataloguePhase {
  id: number;
  name: string;
  price: number | null;
}

export interface CatalogueTaskStartTrigger {
  type: "time" | "goal" | "task";
  goalId?: string | number | null;
  taskId?: string | number | null;
}

export interface CatalogueSalesTask {
  id: number;
  title: string;
  collaborators: ContactRef[];
  afterWhen: string | null;
  startTrigger?: CatalogueTaskStartTrigger | null;
  manhours: number | null;
  notes: string;
  status: CatalogueJobConfigTaskStatus;
  important: boolean;
  attachment?: ToDoAttachment | null;
  relatedTo?: { id: string | number; name: string; type: string } | null;
  steps: ToDoStep[];
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
  collaborators: ContactRef[];
  afterWhen: string | null;
  startTrigger?: CatalogueTaskStartTrigger | null;
  manhours: number | null;
  notes: string;
  status: CatalogueJobConfigTaskStatus;
  important: boolean;
  attachment?: ToDoAttachment | null;
  relatedTo?: { id: string | number; name: string; type: string } | null;
  steps: ToDoStep[];
}

export interface CatalogueJobConfigGoal {
  id: number;
  milestoneId: number;
  phaseId?: number | null;
  retainerServiceId?: number | null;
  reccurentServiceId?: number | null;
  name: string;
  afterWhen?: string | null;
  startTrigger?: CatalogueTaskStartTrigger | null;
  dueDate: string | null;
  priority: CatalogueJobConfigPriority;
  note: string;
  tasks: CatalogueJobConfigTask[];
}

export interface CatalogueJobConfigMilestone {
  id: number;
  name: string;
  afterWhen?: string | null;
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
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueProducedProductRecord extends CatalogueBaseRecord {
  type: "Produced Product";
  options: CatalogueProducedProductField[];
  rawMaterials: CatalogueProducedProductMaterial[];
  measurements: CatalogueProducedProductField[];
  subItems: CatalogueProducedProductSubItem[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueRentalRecord extends CatalogueInventoryRecord {
  type: "Rental";
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueOnetimeServiceRecord extends CatalogueServiceRecord {
  type: "Onetime Service";
  relatedItems: CatalogueRelatedItem[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueContractualServiceRecord extends CatalogueServiceRecord {
  type: "Contractual Service";
  phases: CataloguePhase[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueRetainerServiceRecord extends CatalogueServiceRecord {
  type: "Retainer Service";
  qty: number | null;
  retainerServices: CatalogueRetainerLinkedService[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
}

export interface CatalogueReccurentServiceRecord extends CatalogueServiceRecord {
  type: "Reccurent Service";
  qty: number | null;
  reccurentServices: CatalogueReccurentLinkedService[];
  salesTasks: CatalogueSalesTask[];
  jobConfiguration: CatalogueJobConfiguration;
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
  category: string;
  type: CatalogueItemType;
  activeState: CatalogueActiveState;
  sku: string;
  qty: number | null;
  image?: string | null;
  bestPrice: number | null;
  chargeTax: boolean;
  description: string;
  createdAt: string;
}

export interface CatalogueRecordInput extends Partial<CatalogueItem> {
  relatedItems?: CatalogueRelatedItem[];
  phases?: CataloguePhase[];
  retainerServices?: CatalogueRetainerLinkedService[];
  reccurentServices?: CatalogueReccurentLinkedService[];
  options?: CatalogueProducedProductField[];
  rawMaterials?: CatalogueProducedProductMaterial[];
  measurements?: CatalogueProducedProductField[];
  subItems?: CatalogueProducedProductSubItem[];
  salesTasks?: CatalogueSalesTask[];
  jobConfiguration?: CatalogueJobConfiguration;
}

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
