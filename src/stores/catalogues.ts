import { defineStore } from "pinia";
import { toRaw } from "vue";

import type { ToDoStep } from "@/data/schema";
import { db } from "@/plugins/fake-api/handlers/catalogues/db";
import {
  authorizeRecord,
  filterReadableResources,
  requireCurrentUserPermission,
} from "@/utils/authorization";
import type {
  CatalogueActiveState,
  CatalogueItem,
  CatalogueItemType,
  CatalogueJobConfigGoal,
  CatalogueJobConfigMilestone,
  CatalogueJobConfigTask,
  CatalogueRecord,
  CatalogueRecordInput,
  CatalogueTableKey,
  CatalogueTables,
} from "@/plugins/fake-api/handlers/catalogues/types";

const STORAGE_KEY = "app.catalogue-tables.v4";
const DEFAULT_TYPE: CatalogueItemType = "Product";
const GENERATED_SKU_PATTERN = /^[A-Z]{3}\d{3}$/;

const tableKeyByType: Record<CatalogueItemType, CatalogueTableKey> = {
  Product: "products",
  "Produced Product": "producedProducts",
  Rental: "rentals",
  "Onetime Service": "onetimeServices",
  "Contractual Service": "contractualServices",
  "Retainer Service": "retainerServices",
  "Reccurent Service": "reccurentServices",
};

const skuPrefixByType: Record<CatalogueItemType, string> = {
  Rental: "RTL",
  "Contractual Service": "CTS",
  "Retainer Service": "RTS",
  "Reccurent Service": "RCS",
  Product: "PRD",
  "Produced Product": "PRP",
  "Onetime Service": "OTS",
};

function cloneRecord<T extends CatalogueRecord>(record: T): T {
  const raw = toRaw(record) as T;
  const cloned =
    typeof structuredClone === "function"
      ? structuredClone(raw)
      : (JSON.parse(JSON.stringify(raw)) as T);

  return {
    ...cloned,
    image: cloned.image ?? null,
    bestPrice: cloned.bestPrice ?? null,
    chargeTax: cloned.chargeTax ?? true,
    description: cloned.description ?? "",
  };
}

function cloneTable<T extends CatalogueRecord>(table: T[]): T[] {
  return table.map((record) => cloneRecord(record));
}

function cloneTables(tables: CatalogueTables): CatalogueTables {
  return {
    products: cloneTable(tables.products),
    producedProducts: cloneTable(tables.producedProducts),
    rentals: cloneTable(tables.rentals),
    onetimeServices: cloneTable(tables.onetimeServices),
    contractualServices: cloneTable(tables.contractualServices),
    retainerServices: cloneTable(tables.retainerServices),
    reccurentServices: cloneTable(tables.reccurentServices),
  };
}

function loadFromStorage(): CatalogueTables | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const tables = parsed as Partial<CatalogueTables>;
    if (
      !Array.isArray(tables.products) ||
      !Array.isArray(tables.producedProducts) ||
      !Array.isArray(tables.rentals) ||
      !Array.isArray(tables.onetimeServices) ||
      !Array.isArray(tables.contractualServices) ||
      !Array.isArray(tables.retainerServices) ||
      !Array.isArray(tables.reccurentServices)
    ) {
      return null;
    }

    return tables as CatalogueTables;
  } catch (error) {
    console.warn("Failed to load catalogue tables from storage:", error);
    return null;
  }
}

function saveToStorage(tables: CatalogueTables) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    console.warn("Failed to save catalogue tables to storage:", error);
  }
}

function seedTables() {
  return cloneTables(db.tables);
}

function getTableKeyForType(type?: string | null): CatalogueTableKey {
  return (
    tableKeyByType[(type?.trim() as CatalogueItemType) || DEFAULT_TYPE] ||
    "products"
  );
}

function normalizeQty(type: CatalogueItemType, qty?: number | null) {
  if (type === "Product") {
    return Number.isFinite(Number(qty)) ? Number(qty) : 0;
  }

  return null;
}

function normalizeJobTask(
  task: Partial<CatalogueJobConfigTask>,
  fallbackId: number,
) {
  const legacyTask = task as Partial<CatalogueJobConfigTask> & {
    dueAt?: string | null;
  };

  return {
    id: Number.isFinite(Number(task.id)) ? Number(task.id) : fallbackId,
    title: String(task.title ?? "").trim(),
    collaborators: Array.isArray(task.collaborators)
      ? task.collaborators.map((collaborator) => ({
          id: collaborator.id,
          name: String(collaborator.name ?? "").trim(),
          avatarUrl: collaborator.avatarUrl ?? null,
        }))
      : [],
    afterWhen: task.afterWhen ?? legacyTask.dueAt ?? null,
    startTrigger: task.startTrigger
      ? {
          type:
            task.startTrigger.type === "goal" ||
            task.startTrigger.type === "task"
              ? task.startTrigger.type
              : "time",
          goalId: task.startTrigger.goalId ?? null,
          taskId: task.startTrigger.taskId ?? null,
        }
      : null,
    manhours:
      task.manhours === null || task.manhours === undefined
        ? null
        : Number.isFinite(Number(task.manhours))
          ? Number(task.manhours)
          : null,
    estimatedMinutes:
      (task as any).estimatedMinutes === null ||
      (task as any).estimatedMinutes === undefined
        ? Number.isFinite(Number(task.manhours))
          ? Math.max(0, Math.round(Number(task.manhours) * 60))
          : null
        : Number.isFinite(Number((task as any).estimatedMinutes))
          ? Math.max(0, Number((task as any).estimatedMinutes))
          : null,
    notes: String(task.notes ?? "").trim(),
    status:
      task.status === "in_progress" ||
      task.status === "for_review" ||
      task.status === "completed"
        ? task.status
        : "pending",
    important: Boolean(task.important),
    attachment: task.attachment
      ? {
          type: task.attachment.type,
          name: String(task.attachment.name ?? "").trim(),
          url: task.attachment.url ?? null,
          fileKey: task.attachment.fileKey ?? null,
        }
      : null,
    relatedTo: task.relatedTo
      ? {
          id: task.relatedTo.id,
          name: String(task.relatedTo.name ?? "").trim(),
          type: String(task.relatedTo.type ?? "").trim(),
        }
      : null,
    steps: Array.isArray(task.steps)
      ? task.steps.map(
          (step, index) =>
            ({
              id: Number.isFinite(Number(step.id))
                ? Number(step.id)
                : index + 1,
              title: String(step.title ?? "").trim(),
              collaborators: Array.isArray(step.collaborators)
                ? step.collaborators.map((collaborator) => ({
                    id: collaborator.id,
                    name: String(collaborator.name ?? "").trim(),
                    avatarUrl: collaborator.avatarUrl ?? null,
                  }))
                : [],
              dueAt: String(step.dueAt ?? "").trim(),
              priority:
                step.priority === "low" ||
                step.priority === "high" ||
                step.priority === "normal"
                  ? step.priority
                  : undefined,
              status:
                step.status === "in_progress" ||
                step.status === "for_review" ||
                step.status === "completed"
                  ? step.status
                  : "pending",
              notes: String(step.notes ?? "").trim(),
              createdAt:
                String(step.createdAt ?? "").trim() || new Date().toISOString(),
              updatedAt:
                String(step.updatedAt ?? "").trim() || new Date().toISOString(),
            }) satisfies ToDoStep,
        )
      : [],
  } satisfies CatalogueJobConfigTask;
}

function normalizeSalesTask(
  task: Partial<CatalogueJobConfigTask>,
  fallbackId: number,
) {
  return normalizeJobTask(task, fallbackId);
}

function normalizeRelativeSchedule(
  value?: string | null,
  legacyValue?: string | null,
) {
  const nextValue = value ?? legacyValue ?? null;

  return nextValue === undefined ? null : nextValue;
}

function normalizeJobGoal(
  goal: Partial<CatalogueJobConfigGoal>,
  fallbackId: number,
) {
  const tasks = Array.isArray(goal.tasks) ? goal.tasks : [];
  const normalizedAfterWhen = normalizeRelativeSchedule(
    goal.afterWhen,
    goal.dueDate,
  );

  return {
    id: Number.isFinite(Number(goal.id)) ? Number(goal.id) : fallbackId,
    milestoneId: Number.isFinite(Number(goal.milestoneId))
      ? Number(goal.milestoneId)
      : 0,
    phaseId:
      goal.phaseId === null || goal.phaseId === undefined
        ? null
        : Number.isFinite(Number(goal.phaseId))
          ? Number(goal.phaseId)
          : null,
    retainerServiceId:
      goal.retainerServiceId === null || goal.retainerServiceId === undefined
        ? null
        : Number.isFinite(Number(goal.retainerServiceId))
          ? Number(goal.retainerServiceId)
          : null,
    reccurentServiceId:
      goal.reccurentServiceId === null || goal.reccurentServiceId === undefined
        ? null
        : Number.isFinite(Number(goal.reccurentServiceId))
          ? Number(goal.reccurentServiceId)
          : null,
    name: String(goal.name ?? "").trim(),
    afterWhen: normalizedAfterWhen,
    startTrigger: goal.startTrigger
      ? {
          type: goal.startTrigger.type === "goal" ? "goal" : "time",
          goalId: goal.startTrigger.goalId ?? null,
          taskId: null,
        }
      : null,
    dueDate: normalizedAfterWhen,
    priority:
      goal.priority === "Low" || goal.priority === "High"
        ? goal.priority
        : "Normal",
    note: String(goal.note ?? "").trim(),
    tasks: tasks.map((task, index) => normalizeJobTask(task, index + 1)),
  } satisfies CatalogueJobConfigGoal;
}

function normalizeJobMilestone(
  milestone: Partial<CatalogueJobConfigMilestone>,
  fallbackId: number,
) {
  const tasks = Array.isArray(milestone.tasks) ? milestone.tasks : [];
  const goals = Array.isArray(milestone.goals) ? milestone.goals : [];
  const normalizedAfterWhen = normalizeRelativeSchedule(
    milestone.afterWhen,
    milestone.dueDate,
  );

  return {
    id: Number.isFinite(Number(milestone.id))
      ? Number(milestone.id)
      : fallbackId,
    name: String(milestone.name ?? "").trim(),
    afterWhen: normalizedAfterWhen,
    dueDate: normalizedAfterWhen,
    priority:
      milestone.priority === "Low" || milestone.priority === "High"
        ? milestone.priority
        : "Normal",
    note: String(milestone.note ?? "").trim(),
    tasks: tasks.map((task, index) => normalizeJobTask(task, index + 1)),
    goals: goals.map((goal, index) => normalizeJobGoal(goal, index + 1)),
  } satisfies CatalogueJobConfigMilestone;
}

function normalizeRecord(
  payload: CatalogueRecordInput,
  tableKey: CatalogueTableKey,
  assignedId: string,
): CatalogueRecord {
  const now = new Date().toISOString();
  const type = (payload.type?.trim() as CatalogueItemType) || DEFAULT_TYPE;
  const legacyStatus = (payload as CatalogueItem & { status?: string }).status;
  const mappedType: CatalogueItemType =
    payload.type ??
    (legacyStatus === "Inactive"
      ? "Contractual Service"
      : legacyStatus === "Scheduled"
        ? "Retainer Service"
        : tableKey === "producedProducts"
          ? "Produced Product"
          : tableKey === "rentals"
            ? "Rental"
            : tableKey === "onetimeServices"
              ? "Onetime Service"
              : tableKey === "contractualServices"
                ? "Contractual Service"
                : tableKey === "retainerServices"
                  ? "Retainer Service"
                  : tableKey === "reccurentServices"
                    ? "Reccurent Service"
                    : DEFAULT_TYPE);

  const base = {
    id: assignedId,
    name: payload.name?.trim() || "Untitled Catalogue Item",
    category: payload.category?.trim() || "Uncategorized",
    type: mappedType,
    activeState:
      (payload.activeState?.trim() as CatalogueActiveState) || "Active",
    sku:
      payload.sku?.trim() ||
      nextSkuForType([payload as CatalogueRecordInput], mappedType),
    image: payload.image?.trim() || null,
    bestPrice:
      payload.bestPrice === null || payload.bestPrice === undefined
        ? null
        : Number.isFinite(Number(payload.bestPrice))
          ? Number(payload.bestPrice)
          : null,
    chargeTax:
      payload.chargeTax === undefined ? true : Boolean(payload.chargeTax),
    description: String(payload.description ?? "").trim(),
    createdAt: payload.createdAt || now,
  };

  const qty = normalizeQty(mappedType, payload.qty);

  if (mappedType === "Onetime Service") {
    const relatedItems = Array.isArray(payload.relatedItems)
      ? payload.relatedItems
      : [];
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      relatedItems: relatedItems.map((item, index) => ({
        id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
        name: String(item.name ?? "").trim(),
        category: String(item.category ?? "").trim(),
        price:
          item.price === null || item.price === undefined
            ? null
            : Number.isFinite(Number(item.price))
              ? Number(item.price)
              : null,
        chargeTax:
          item.chargeTax === undefined ? true : Boolean(item.chargeTax),
        description: String(item.description ?? "").trim(),
      })),
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (mappedType === "Contractual Service") {
    const phases = Array.isArray(payload.phases) ? payload.phases : [];
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      phases: phases.map((phase, index) => ({
        id: Number.isFinite(Number(phase.id)) ? Number(phase.id) : index + 1,
        name: String(phase.name ?? "").trim(),
        price:
          phase.price === null || phase.price === undefined
            ? null
            : Number.isFinite(Number(phase.price))
              ? Number(phase.price)
              : null,
      })),
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (mappedType === "Retainer Service") {
    const retainerServices = Array.isArray(payload.retainerServices)
      ? payload.retainerServices
      : [];
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];
    return {
      ...base,
      qty,
      retainerServices: retainerServices.map((service, index) => ({
        id: Number.isFinite(Number(service.id))
          ? Number(service.id)
          : index + 1,
        name: String(service.name ?? "").trim(),
        category: String(service.category ?? "").trim(),
        qty:
          service.qty === null || service.qty === undefined
            ? null
            : Number.isFinite(Number(service.qty))
              ? Number(service.qty)
              : null,
        description: String(service.description ?? "").trim(),
      })),
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (mappedType === "Reccurent Service") {
    const reccurentServices = Array.isArray(payload.reccurentServices)
      ? payload.reccurentServices
      : [];
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      qty,
      reccurentServices: reccurentServices.map((service, index) => ({
        id: Number.isFinite(Number(service.id))
          ? Number(service.id)
          : index + 1,
        name: String(service.name ?? "").trim(),
        category: String(service.category ?? "").trim(),
        description: String(service.description ?? "").trim(),
      })),
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (mappedType === "Produced Product") {
    const options = Array.isArray(payload.options) ? payload.options : [];
    const rawMaterials = Array.isArray(payload.rawMaterials)
      ? payload.rawMaterials
      : [];
    const measurements = Array.isArray(payload.measurements)
      ? payload.measurements
      : [];
    const subItems = Array.isArray(payload.subItems) ? payload.subItems : [];
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    const normalizeProducedField = (field: any, index: number) => ({
      id: Number.isFinite(Number(field.id)) ? Number(field.id) : index + 1,
      name: String(field.name ?? "").trim(),
      type:
        field.type === "Number" ||
        field.type === "Pictures" ||
        field.type === "Select Buttons" ||
        field.type === "Note" ||
        field.type === "Dropdown"
          ? field.type
          : "Text",
      description: String(field.description ?? "").trim(),
      values:
        field.type === "Dropdown" && Array.isArray(field.values)
          ? field.values
              .map((value: unknown) => String(value ?? "").trim())
              .filter(Boolean)
          : [],
    });

    const normalizeRawMaterial = (material: any, index: number) => ({
      id: Number.isFinite(Number(material.id))
        ? Number(material.id)
        : index + 1,
      name: String(material.name ?? "").trim(),
      qty:
        material.qty === null || material.qty === undefined
          ? null
          : Number.isFinite(Number(material.qty))
            ? Number(material.qty)
            : null,
    });

    return {
      ...base,
      options: options.map(normalizeProducedField),
      rawMaterials: rawMaterials.map(normalizeRawMaterial),
      measurements: measurements.map(normalizeProducedField),
      subItems: subItems.map((subItem, index) => ({
        id: Number.isFinite(Number(subItem.id))
          ? Number(subItem.id)
          : index + 1,
        name: String(subItem.name ?? "").trim(),
        options: Array.isArray(subItem.options)
          ? subItem.options.map(normalizeProducedField)
          : [],
        rawMaterials: Array.isArray(subItem.rawMaterials)
          ? subItem.rawMaterials.map(normalizeRawMaterial)
          : [],
        measurements: Array.isArray(subItem.measurements)
          ? subItem.measurements.map(normalizeProducedField)
          : [],
      })),
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (mappedType === "Product" || mappedType === "Rental") {
    const salesTasks = Array.isArray(payload.salesTasks)
      ? payload.salesTasks
      : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      qty: qty ?? 0,
      salesTasks: salesTasks.map((task, index) => ({
        ...normalizeSalesTask(task, index + 1),
      })),
      jobConfiguration: {
        milestones: milestones.map((milestone, index) =>
          normalizeJobMilestone(milestone, index + 1),
        ),
      },
    } as CatalogueRecord;
  }

  if (qty === null) {
    return base as CatalogueRecord;
  }

  return {
    ...base,
    qty,
  } as CatalogueRecord;
}

function migrateTables(tables: CatalogueTables): CatalogueTables {
  return {
    products: tables.products.map((record) =>
      normalizeRecord(record, "products", record.id),
    ) as CatalogueTables["products"],
    producedProducts: tables.producedProducts.map((record) =>
      normalizeRecord(record, "producedProducts", record.id),
    ) as CatalogueTables["producedProducts"],
    rentals: tables.rentals.map((record) =>
      normalizeRecord(record, "rentals", record.id),
    ) as CatalogueTables["rentals"],
    onetimeServices: tables.onetimeServices.map((record) =>
      normalizeRecord(record, "onetimeServices", record.id),
    ) as CatalogueTables["onetimeServices"],
    contractualServices: tables.contractualServices.map((record) =>
      normalizeRecord(record, "contractualServices", record.id),
    ) as CatalogueTables["contractualServices"],
    retainerServices: tables.retainerServices.map((record) =>
      normalizeRecord(record, "retainerServices", record.id),
    ) as CatalogueTables["retainerServices"],
    reccurentServices: tables.reccurentServices.map((record) =>
      normalizeRecord(record, "reccurentServices", record.id),
    ) as CatalogueTables["reccurentServices"],
  };
}

function extractSkuSequence(sku?: string | null) {
  const match = String(sku ?? "")
    .trim()
    .match(/(\d{3,})$/);
  return match ? Number(match[1]) : null;
}

function formatSku(type: CatalogueItemType, sequence: number) {
  return `${skuPrefixByType[type]}${String(sequence).padStart(3, "0")}`;
}

function nextSkuSequence(
  records: Array<
    Pick<CatalogueRecordInput, "sku"> | Pick<CatalogueRecord, "sku">
  >,
) {
  const sequences = records
    .map((record) => extractSkuSequence(record.sku))
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value) && value > 0,
    );

  return sequences.length ? Math.max(...sequences) + 1 : 1;
}

function nextSkuForType(
  records: Array<
    Pick<CatalogueRecordInput, "sku"> | Pick<CatalogueRecord, "sku">
  >,
  type: CatalogueItemType,
) {
  return formatSku(type, nextSkuSequence(records));
}

function isGeneratedCatalogueSku(sku?: string | null) {
  return GENERATED_SKU_PATTERN.test(String(sku ?? "").trim());
}

function nextRecordId(table: CatalogueRecord[], prefix: string) {
  const numbers = table
    .map((record) => {
      const match = String(record.id).match(/(\d+)$/);
      return match ? Number(match[1]) : NaN;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${prefix}-${next}`;
}

function nextIdForTable(tables: CatalogueTables, tableKey: CatalogueTableKey) {
  const prefixes: Record<CatalogueTableKey, string> = {
    products: "product",
    producedProducts: "produced-product",
    rentals: "rental",
    onetimeServices: "onetime-service",
    contractualServices: "contractual-service",
    retainerServices: "retainer-service",
    reccurentServices: "reccurent-service",
  };

  return nextRecordId(tables[tableKey], prefixes[tableKey]);
}

function nextIdForSku(tables: CatalogueTables, type: CatalogueItemType) {
  return nextSkuForType(flattenTables(tables), type);
}

function duplicateNameRoot(name: string) {
  return name.replace(/ - Copy(?: \d+)?$/i, "").trim();
}

function duplicateSkuRoot(sku: string) {
  return sku.replace(/-COPY(?:-\d+)?$/i, "").trim();
}

function nextDuplicateName(items: CatalogueItem[], originalName: string) {
  const root = duplicateNameRoot(originalName);
  const taken = new Set(items.map((item) => item.name.trim().toLowerCase()));
  const firstCopy = `${root} - Copy`;

  if (!taken.has(firstCopy.toLowerCase())) return firstCopy;

  let counter = 2;
  while (taken.has(`${root} - Copy ${counter}`.toLowerCase())) counter += 1;

  return `${root} - Copy ${counter}`;
}

function nextDuplicateSku(items: CatalogueItem[], originalSku: string) {
  const root = duplicateSkuRoot(originalSku);
  const baseSku = `${root}-COPY`;
  const taken = new Set(items.map((item) => item.sku.trim().toLowerCase()));

  if (!taken.has(baseSku.toLowerCase())) return baseSku;

  let counter = 2;
  while (taken.has(`${baseSku}-${counter}`.toLowerCase())) counter += 1;

  return `${baseSku}-${counter}`;
}

function toCatalogueItem(
  tableKey: CatalogueTableKey,
  record: CatalogueRecord,
): CatalogueItem {
  return {
    id: `${tableKey}:${record.id}`,
    sourceId: record.id,
    sourceTable: tableKey,
    name: record.name,
    category: record.category,
    type: record.type,
    activeState: record.activeState,
    sku: record.sku,
    qty: "qty" in record ? (record.qty ?? null) : null,
    image: record.image ?? null,
    bestPrice: record.bestPrice ?? null,
    chargeTax: record.chargeTax ?? true,
    description: record.description ?? "",
    createdAt: record.createdAt,
  };
}

function flattenTables(tables: CatalogueTables): CatalogueItem[] {
  return [
    ...tables.products.map((record) => toCatalogueItem("products", record)),
    ...tables.producedProducts.map((record) =>
      toCatalogueItem("producedProducts", record),
    ),
    ...tables.rentals.map((record) => toCatalogueItem("rentals", record)),
    ...tables.onetimeServices.map((record) =>
      toCatalogueItem("onetimeServices", record),
    ),
    ...tables.contractualServices.map((record) =>
      toCatalogueItem("contractualServices", record),
    ),
    ...tables.retainerServices.map((record) =>
      toCatalogueItem("retainerServices", record),
    ),
    ...tables.reccurentServices.map((record) =>
      toCatalogueItem("reccurentServices", record),
    ),
  ];
}

function resolveTarget(
  tables: CatalogueTables,
  id: string,
  typeHint?: string | null,
): { tableKey: CatalogueTableKey; index: number } | null {
  if (id.includes(":")) {
    const [tableKey, sourceId] = id.split(":");
    const typedKey = tableKey as CatalogueTableKey;
    if (!tables[typedKey]) return null;
    const index = tables[typedKey].findIndex(
      (record) => record.id === sourceId,
    );
    return index === -1 ? null : { tableKey: typedKey, index };
  }

  if (typeHint) {
    const hintedKey = getTableKeyForType(typeHint);
    const hintedIndex = tables[hintedKey].findIndex(
      (record) => record.id === id,
    );
    if (hintedIndex !== -1) return { tableKey: hintedKey, index: hintedIndex };
  }

  const keys = Object.keys(tables) as CatalogueTableKey[];
  for (const tableKey of keys) {
    const index = tables[tableKey].findIndex((record) => record.id === id);
    if (index !== -1) return { tableKey, index };
  }

  return null;
}

export const useCataloguesStore = defineStore("catalogues", {
  state: () => ({
    tables: seedTables() as CatalogueTables,
    initialized: false,
  }),
  getters: {
    all: (state) => filterReadableResources("catalogue", flattenTables(state.tables)),
    byId: (state) => (id: string, typeHint?: string | null) => {
      const target = resolveTarget(state.tables, id, typeHint);
      if (!target) return null;
      return authorizeRecord(
        "catalogue",
        toCatalogueItem(
          target.tableKey,
          state.tables[target.tableKey][target.index],
        ),
      );
    },
    recordById: (state) => (id: string, typeHint?: string | null) => {
      const target = resolveTarget(state.tables, id, typeHint);
      if (!target) return null;

      return authorizeRecord(
        "catalogue",
        cloneRecord(state.tables[target.tableKey][target.index]),
      );
    },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) {
        this.tables = migrateTables(cloneTables(this.tables));
        saveToStorage(this.tables);
        return;
      }

      const stored = loadFromStorage();
      this.tables = stored
        ? migrateTables(stored)
        : migrateTables(seedTables());
      saveToStorage(this.tables);
      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneTables(state.tables));
          },
          { detached: true },
        );
      }
    },
    addItem(payload: CatalogueRecordInput) {
      requireCurrentUserPermission("catalogue", "create");

      const tableKey = getTableKeyForType(payload.type);
      const itemType =
        (payload.type?.trim() as CatalogueItemType) || DEFAULT_TYPE;
      const id =
        payload.sourceId?.trim() ||
        (payload.id && !String(payload.id).includes(":")
          ? String(payload.id)
          : nextIdForTable(this.tables, tableKey));
      const normalized = normalizeRecord(
        {
          ...payload,
          sku: payload.sku?.trim() || nextIdForSku(this.tables, itemType),
        },
        tableKey,
        id,
      );

      this.tables[tableKey].unshift(normalized as never);

      return toCatalogueItem(tableKey, normalized);
    },
    addProduct(payload: CatalogueRecordInput) {
      return this.addItem(payload);
    },
    updateItem(id: string, patch: CatalogueRecordInput) {
      requireCurrentUserPermission("catalogue", "update");

      const target = resolveTarget(this.tables, id, patch.type);
      if (!target) return null;

      const current = this.tables[target.tableKey][target.index];
      const nextType =
        (patch.type?.trim() as CatalogueItemType) || current.type;
      const nextTableKey = getTableKeyForType(nextType);
      const shouldRegenerateSku =
        nextType !== current.type &&
        (!patch.sku?.trim() || isGeneratedCatalogueSku(current.sku));
      const nextSku = shouldRegenerateSku
        ? formatSku(
            nextType,
            extractSkuSequence(current.sku) ?? nextSkuSequence(this.all),
          )
        : (patch.sku ?? current.sku);
      const normalized = normalizeRecord(
        {
          ...cloneRecord(current),
          ...patch,
          type: nextType,
          sku: nextSku,
          sourceId: current.id,
        } as CatalogueRecordInput,
        nextTableKey,
        current.id,
      );

      if (nextTableKey === target.tableKey) {
        this.tables[target.tableKey].splice(
          target.index,
          1,
          normalized as never,
        );
      } else {
        this.tables[target.tableKey].splice(target.index, 1);
        this.tables[nextTableKey].unshift(normalized as never);
      }

      return toCatalogueItem(nextTableKey, normalized);
    },
    updateProduct(id: string, patch: CatalogueRecordInput) {
      return this.updateItem(id, patch);
    },
    removeItem(id: string, typeHint?: string | null) {
      requireCurrentUserPermission("catalogue", "delete");

      const target = resolveTarget(this.tables, id, typeHint);
      if (!target) return;
      this.tables[target.tableKey].splice(target.index, 1);
    },
    removeProduct(id: string, typeHint?: string | null) {
      this.removeItem(id, typeHint);
    },
    duplicateItem(id: string, typeHint?: string | null) {
      const target = resolveTarget(this.tables, id, typeHint);
      if (!target) return null;

      const original = this.tables[target.tableKey][target.index];
      const originalItem = toCatalogueItem(target.tableKey, original);

      return this.addItem({
        ...cloneRecord(original),
        id: undefined,
        sourceId: undefined,
        name: nextDuplicateName(this.all, originalItem.name),
        sku: nextDuplicateSku(this.all, originalItem.sku),
        createdAt: new Date().toISOString(),
      } as CatalogueRecordInput);
    },
    duplicateProduct(id: string, typeHint?: string | null) {
      return this.duplicateItem(id, typeHint);
    },
    replaceAll(items: CatalogueItem[]) {
      const next = seedTables();
      next.products = [];
      next.producedProducts = [];
      next.rentals = [];
      next.onetimeServices = [];
      next.contractualServices = [];
      next.retainerServices = [];
      next.reccurentServices = [];

      for (const item of items) {
        const tableKey = getTableKeyForType(item.type);
        const id = item.sourceId || nextIdForTable(next, tableKey);
        next[tableKey].push(
          normalizeRecord(item as CatalogueRecordInput, tableKey, id) as never,
        );
      }

      this.tables = next;
    },
  },
});
