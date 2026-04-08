import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "@/plugins/fake-api/handlers/catalogues/db";
import type {
  CatalogueActiveState,
  CatalogueItem,
  CatalogueItemType,
  CatalogueJobConfigGoal,
  CatalogueJobConfigMilestone,
  CatalogueJobConfigTask,
  CatalogueRecordInput,
  CatalogueRecord,
  CatalogueTableKey,
  CatalogueTables,
} from "@/plugins/fake-api/handlers/catalogues/types";

const STORAGE_KEY = "app.catalogue-tables.v3";
const DEFAULT_TYPE: CatalogueItemType = "Product";

const tableKeyByType: Record<CatalogueItemType, CatalogueTableKey> = {
  Product: "products",
  "Produced Product": "producedProducts",
  Rental: "rentals",
  "Onetime Service": "onetimeServices",
  "Contractual Service": "contractualServices",
  "Retainer Service": "retainerServices",
  "Reccurent Service": "reccurentServices",
};

function cloneRecord<T extends CatalogueRecord>(record: T): T {
  const raw = toRaw(record) as T;
  return {
    ...raw,
    image: raw.image ?? null,
    bestPrice: raw.bestPrice ?? null,
    chargeTax: raw.chargeTax ?? true,
    description: raw.description ?? "",
  };
}

function cloneTable<T extends CatalogueRecord>(table: T[]): T[] {
  return table.map(record => cloneRecord(record));
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
  return tableKeyByType[(type?.trim() as CatalogueItemType) || DEFAULT_TYPE] || "products";
}

function normalizeQty(type: CatalogueItemType, qty?: number | null) {
  if (type === "Product" || type === "Produced Product" || type === "Rental") {
    return Number.isFinite(Number(qty)) ? Number(qty) : 0;
  }

  return null;
}

function normalizeJobTask(task: Partial<CatalogueJobConfigTask>, fallbackId: number) {
  return {
    id: Number.isFinite(Number(task.id)) ? Number(task.id) : fallbackId,
    title: String(task.title ?? "").trim(),
    dueAt: task.dueAt ?? null,
    manhours:
      task.manhours === null || task.manhours === undefined
        ? null
        : Number.isFinite(Number(task.manhours))
          ? Number(task.manhours)
          : null,
    notes: String(task.notes ?? "").trim(),
    status:
      task.status === "in_progress" ||
      task.status === "for_review" ||
      task.status === "completed"
        ? task.status
        : "pending",
    important: Boolean(task.important),
  } satisfies CatalogueJobConfigTask;
}

function normalizeJobGoal(goal: Partial<CatalogueJobConfigGoal>, fallbackId: number) {
  const tasks = Array.isArray(goal.tasks) ? goal.tasks : [];

  return {
    id: Number.isFinite(Number(goal.id)) ? Number(goal.id) : fallbackId,
    milestoneId: Number.isFinite(Number(goal.milestoneId))
      ? Number(goal.milestoneId)
      : 0,
    name: String(goal.name ?? "").trim(),
    dueDate: goal.dueDate ?? null,
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

  return {
    id: Number.isFinite(Number(milestone.id)) ? Number(milestone.id) : fallbackId,
    name: String(milestone.name ?? "").trim(),
    dueDate: milestone.dueDate ?? null,
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
    activeState: (payload.activeState?.trim() as CatalogueActiveState) || "Active",
    sku: payload.sku?.trim() || `CAT-${assignedId.toUpperCase()}`,
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
    const salesTasks = Array.isArray(payload.salesTasks) ? payload.salesTasks : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      relatedItems: relatedItems.map((item, index) => ({
        id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
        name: String(item.name ?? "").trim(),
        category: String(item.category ?? "").trim(),
        description: String(item.description ?? "").trim(),
      })),
      salesTasks: salesTasks.map((task, index) => ({
        id: Number.isFinite(Number(task.id)) ? Number(task.id) : index + 1,
        title: String(task.title ?? "").trim(),
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
    const salesTasks = Array.isArray(payload.salesTasks) ? payload.salesTasks : [];
    const milestones = Array.isArray(payload.jobConfiguration?.milestones)
      ? payload.jobConfiguration.milestones
      : [];

    return {
      ...base,
      phases: phases.map((phase, index) => ({
        id: Number.isFinite(Number(phase.id)) ? Number(phase.id) : index + 1,
        name: String(phase.name ?? "").trim(),
        description: String(phase.description ?? "").trim(),
      })),
      salesTasks: salesTasks.map((task, index) => ({
        id: Number.isFinite(Number(task.id)) ? Number(task.id) : index + 1,
        title: String(task.title ?? "").trim(),
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

function nextRecordId(table: CatalogueRecord[], prefix: string) {
  const numbers = table
    .map(record => {
      const match = String(record.id).match(/(\d+)$/);
      return match ? Number(match[1]) : NaN;
    })
    .filter(value => Number.isFinite(value) && value > 0);

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

function duplicateNameRoot(name: string) {
  return name.replace(/ - Copy(?: \d+)?$/i, "").trim();
}

function duplicateSkuRoot(sku: string) {
  return sku.replace(/-COPY(?:-\d+)?$/i, "").trim();
}

function nextDuplicateName(items: CatalogueItem[], originalName: string) {
  const root = duplicateNameRoot(originalName);
  const taken = new Set(items.map(item => item.name.trim().toLowerCase()));
  const firstCopy = `${root} - Copy`;

  if (!taken.has(firstCopy.toLowerCase())) return firstCopy;

  let counter = 2;
  while (taken.has(`${root} - Copy ${counter}`.toLowerCase())) counter += 1;

  return `${root} - Copy ${counter}`;
}

function nextDuplicateSku(items: CatalogueItem[], originalSku: string) {
  const root = duplicateSkuRoot(originalSku);
  const baseSku = `${root}-COPY`;
  const taken = new Set(items.map(item => item.sku.trim().toLowerCase()));

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
    ...tables.products.map(record => toCatalogueItem("products", record)),
    ...tables.producedProducts.map(record =>
      toCatalogueItem("producedProducts", record),
    ),
    ...tables.rentals.map(record => toCatalogueItem("rentals", record)),
    ...tables.onetimeServices.map(record =>
      toCatalogueItem("onetimeServices", record),
    ),
    ...tables.contractualServices.map(record =>
      toCatalogueItem("contractualServices", record),
    ),
    ...tables.retainerServices.map(record =>
      toCatalogueItem("retainerServices", record),
    ),
    ...tables.reccurentServices.map(record =>
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
    const index = tables[typedKey].findIndex(record => record.id === sourceId);
    return index === -1 ? null : { tableKey: typedKey, index };
  }

  if (typeHint) {
    const hintedKey = getTableKeyForType(typeHint);
    const hintedIndex = tables[hintedKey].findIndex(record => record.id === id);
    if (hintedIndex !== -1) return { tableKey: hintedKey, index: hintedIndex };
  }

  const keys = Object.keys(tables) as CatalogueTableKey[];
  for (const tableKey of keys) {
    const index = tables[tableKey].findIndex(record => record.id === id);
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
    all: state => flattenTables(state.tables),
    byId: state => (id: string, typeHint?: string | null) => {
      const target = resolveTarget(state.tables, id, typeHint);
      if (!target) return null;
      return toCatalogueItem(
        target.tableKey,
        state.tables[target.tableKey][target.index],
      );
    },
    recordById: state => (id: string, typeHint?: string | null) => {
      const target = resolveTarget(state.tables, id, typeHint);
      if (!target) return null;

      return cloneRecord(state.tables[target.tableKey][target.index]);
    },
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const stored = loadFromStorage();
      this.tables = stored ? cloneTables(stored) : seedTables();
      if (!stored) saveToStorage(this.tables);
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
      const tableKey = getTableKeyForType(payload.type);
      const id =
        payload.sourceId?.trim() ||
        (payload.id && !String(payload.id).includes(":")
          ? String(payload.id)
          : nextIdForTable(this.tables, tableKey));
      const normalized = normalizeRecord(payload, tableKey, id);

      this.tables[tableKey].unshift(normalized as never);

      return toCatalogueItem(tableKey, normalized);
    },
    addProduct(payload: CatalogueRecordInput) {
      return this.addItem(payload);
    },
    updateItem(id: string, patch: CatalogueRecordInput) {
      const target = resolveTarget(this.tables, id, patch.type);
      if (!target) return null;

      const current = this.tables[target.tableKey][target.index];
      const nextTableKey = getTableKeyForType(patch.type ?? current.type);
      const normalized = normalizeRecord(
        { ...cloneRecord(current), ...patch, sourceId: current.id } as CatalogueRecordInput,
        nextTableKey,
        current.id,
      );

      if (nextTableKey === target.tableKey) {
        this.tables[target.tableKey].splice(target.index, 1, normalized as never);
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
