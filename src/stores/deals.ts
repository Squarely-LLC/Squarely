import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "@/plugins/fake-api/handlers/operations/deals/db";
import type {
  DealCustomPhase,
  DealFieldValue,
  DealFinancialEntry,
  DealItem,
  DealProperties,
  DealSalesTaskTemplate,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useConfigStore } from "@/stores/config";
import { useTodos } from "@/stores/todos";

const STORAGE_KEY = "app.deals.v3";
const DEFAULT_DEAL_PREFIX = "DL-";

function cloneDeal(deal: DealProperties): DealProperties {
  const raw = toRaw(deal) as DealProperties;

  try {
    return JSON.parse(JSON.stringify(raw)) as DealProperties;
  } catch (error) {
    return {
      ...raw,
      collaborators: Array.isArray(raw.collaborators)
        ? [...raw.collaborators]
        : [],
      customFieldValues: { ...(raw.customFieldValues || {}) },
      items: Array.isArray(raw.items)
        ? raw.items.map((item) => ({ ...item }))
        : [],
      documents: Array.isArray(raw.documents)
        ? raw.documents.map((document) => ({ ...document }))
        : [],
      financials: Array.isArray(raw.financials)
        ? raw.financials.map((entry) => ({ ...entry }))
        : [],
    };
  }
}

function cloneDealsArray(deals: DealProperties[]) {
  return deals.map((deal) => cloneDeal(deal));
}

function loadFromStorage(): DealProperties[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? (parsed as DealProperties[]) : null;
  } catch (error) {
    console.warn("Failed to load deals from storage:", error);

    return null;
  }
}

function saveToStorage(deals: DealProperties[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
  } catch (error) {
    console.warn("Failed to save deals to storage:", error);
  }
}

function nextDealId(items: DealProperties[]) {
  const ids = items
    .map((deal) => Number(deal.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  return ids.length ? Math.max(...ids) + 1 : 1;
}

function extractDealSequence(code: string | null | undefined) {
  const trimmed = String(code ?? "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(\d+)$/);
  if (!match) return null;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;

  // Migrate legacy generated codes that previously started at 1001.
  if (numeric >= 1001) return numeric - 1000;

  return numeric;
}

function nextDealCode(items: DealProperties[]) {
  const dealPrefix = getDealPrefix();

  const nextSequence =
    items.reduce((maxValue, deal) => {
      const numeric = extractDealSequence(deal.code);
      if (numeric === null) return maxValue;

      return Number.isFinite(numeric) ? Math.max(maxValue, numeric) : maxValue;
    }, 0) + 1;

  return `${dealPrefix}${nextSequence}`;
}

function getDealPrefix() {
  const configStore = useConfigStore();
  configStore.init();

  return (
    String(
      configStore.configurations?.deals?.dealPrefix ?? DEFAULT_DEAL_PREFIX,
    ).trim() || DEFAULT_DEAL_PREFIX
  );
}

function applyPrefixToDealCode(
  code: string | null | undefined,
  prefix: string,
) {
  const trimmed = String(code ?? "").trim();
  if (!trimmed) return null;

  const sequence = extractDealSequence(trimmed);
  if (sequence === null) return trimmed;

  return `${prefix}${sequence}`;
}

function normalizeCustomFieldValues(
  values: Record<string, DealFieldValue> | undefined | null,
): Record<string, DealFieldValue> {
  if (!values || typeof values !== "object") return {};

  return Object.fromEntries(Object.entries(values));
}

function normalizeAmount(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeItems(items: DealItem[] | undefined | null): DealItem[] {
  if (!Array.isArray(items)) return [];

  return items.map(({ generatedTaskIds: _generatedTaskIds, ...item }) => ({
    ...item,
    customPhases: Array.isArray(item.customPhases)
      ? item.customPhases.map((phase: DealCustomPhase) => ({ ...phase }))
      : null,
    removedPhaseIds: Array.isArray(item.removedPhaseIds)
      ? item.removedPhaseIds
          .map((value) => Number(value))
          .filter(Number.isFinite)
      : null,
    subItemOverrides: item.subItemOverrides
      ? Object.fromEntries(
          Object.entries(item.subItemOverrides).map(([key, value]) => [
            key,
            {
              ...value,
              periodUnitPrices: value?.periodUnitPrices
                ? Object.fromEntries(Object.entries(value.periodUnitPrices))
                : null,
            },
          ]),
        )
      : null,
  }));
}

function normalizeSalesTasks(
  salesTasks: DealSalesTaskTemplate[] | undefined | null,
): DealSalesTaskTemplate[] {
  if (!Array.isArray(salesTasks)) return [];

  return salesTasks.map((task, index) => ({
    ...task,
    id: Number(task.id) > 0 ? Number(task.id) : index + 1,
    title: String(task.title ?? "").trim(),
    collaborators: Array.isArray(task.collaborators)
      ? task.collaborators.map((collaborator) => ({ ...collaborator }))
      : [],
    afterWhen: task.afterWhen ?? null,
    startTrigger: task.startTrigger
      ? {
          type: task.startTrigger.type,
          goalId: task.startTrigger.goalId ?? null,
          taskId: task.startTrigger.taskId ?? null,
        }
      : null,
    manhours: task.manhours ?? null,
    notes: String(task.notes ?? "").trim(),
    status:
      task.status === "in_progress" ||
      task.status === "for_review" ||
      task.status === "completed"
        ? task.status
        : "pending",
    important: Boolean(task.important),
    attachment: task.attachment ? { ...task.attachment } : null,
    relatedTo: task.relatedTo ? { ...task.relatedTo } : null,
    steps: Array.isArray(task.steps)
      ? task.steps.map((step, stepIndex) => ({
          ...step,
          id: step.id ?? stepIndex + 1,
          collaborators: Array.isArray(step.collaborators)
            ? step.collaborators.map((collaborator) => ({ ...collaborator }))
            : [],
        }))
      : [],
    sourceItemId: task.sourceItemId ?? null,
    sourceTaskId: task.sourceTaskId ?? null,
  }));
}

function collectLegacyGeneratedTaskIds(deals: DealProperties[]) {
  return deals.flatMap((deal) =>
    (deal.items || []).flatMap((item) => item.generatedTaskIds || []),
  );
}

const seedDealLookup = new Map(
  db.deals.flatMap((deal) => {
    const entries: Array<[string, DealProperties]> = [];

    if (deal.code) entries.push([`code:${String(deal.code)}`, deal]);

    entries.push([`id:${String(deal.id)}`, deal]);

    return entries;
  }),
);

function applyDealFieldMigrations(deal: DealProperties): DealProperties {
  const dealPrefix = getDealPrefix();
  const seedMatch =
    (deal.code ? seedDealLookup.get(`code:${String(deal.code)}`) : null) ??
    seedDealLookup.get(`id:${String(deal.id)}`) ??
    null;
  const quotationAmount = deal.financials?.find(
    (entry) => entry.type === "quotation",
  )?.amount;
  const originalCode = String(deal.code ?? seedMatch?.code ?? "").trim();
  const migratedCode = applyPrefixToDealCode(originalCode, dealPrefix);
  const currentName = String(deal.name ?? "").trim();
  const migratedName =
    !currentName ||
    currentName === originalCode ||
    currentName === String(seedMatch?.code ?? "").trim()
      ? migratedCode || currentName
      : currentName;

  return {
    ...deal,
    code: migratedCode,
    name: migratedName || deal.name,
    amount:
      normalizeAmount(deal.amount) ??
      normalizeAmount(seedMatch?.amount) ??
      normalizeAmount(quotationAmount),
    projectCode: deal.projectCode?.trim() || seedMatch?.projectCode || null,
    projectName: deal.projectName?.trim() || seedMatch?.projectName || null,
  };
}

function sanitizeDeals(deals: DealProperties[]) {
  return deals.map((deal) => ({
    ...applyDealFieldMigrations(deal),
    items: normalizeItems(deal.items),
    salesTasks: normalizeSalesTasks(deal.salesTasks),
    documents: normalizeDocuments(deal.documents),
    financials: normalizeFinancials(deal.financials),
  }));
}

function normalizeDocuments(
  documents: DealProperties["documents"] | undefined | null,
) {
  if (!Array.isArray(documents)) return [];

  return documents.map((document) => ({ ...document }));
}

function normalizeFinancials(
  financials: DealFinancialEntry[] | undefined | null,
): DealFinancialEntry[] {
  if (!Array.isArray(financials)) return [];

  return financials.map((entry) => ({ ...entry }));
}

function normaliseDeal(
  payload: Partial<DealProperties>,
  assignedId: number,
  generatedCode: string,
): DealProperties {
  const now = new Date().toISOString();
  const code = payload.code?.trim() || generatedCode;
  const name = String(payload.name ?? "").trim() || code;

  return {
    id: assignedId,
    name,
    code,
    amount: normalizeAmount(payload.amount),
    projectCode: payload.projectCode?.trim() || null,
    projectName: payload.projectName?.trim() || null,
    relatedTo: payload.relatedTo ?? null,
    type: payload.type?.trim() || null,
    estimatedDeliveryDate: payload.estimatedDeliveryDate || null,
    stage: payload.stage?.trim() || null,
    important: Boolean(payload.important),
    location: payload.location?.trim() || null,
    collaborators: Array.isArray(payload.collaborators)
      ? payload.collaborators
          .map((value) => Number(value))
          .filter(Number.isFinite)
      : [],
    note: payload.note?.trim() || null,
    customFieldValues: normalizeCustomFieldValues(payload.customFieldValues),
    items: normalizeItems(payload.items),
    salesTasks: normalizeSalesTasks(payload.salesTasks),
    documents: normalizeDocuments(payload.documents),
    financials: normalizeFinancials(payload.financials),
    createdAt: payload.createdAt || now,
  };
}

function mergeDeal(
  original: DealProperties,
  patch: Partial<DealProperties>,
): DealProperties {
  const mergedCode =
    patch.code === undefined ? original.code : patch.code?.trim() || null;

  return cloneDeal({
    ...original,
    ...patch,
    code: mergedCode,
    name:
      patch.name === undefined
        ? original.name
        : String(patch.name ?? "").trim() || mergedCode || original.name,
    amount:
      patch.amount === undefined
        ? normalizeAmount(original.amount)
        : normalizeAmount(patch.amount),
    projectCode:
      patch.projectCode === undefined
        ? original.projectCode
        : patch.projectCode?.trim() || null,
    projectName:
      patch.projectName === undefined
        ? original.projectName
        : patch.projectName?.trim() || null,
    type: patch.type === undefined ? original.type : patch.type?.trim() || null,
    stage:
      patch.stage === undefined ? original.stage : patch.stage?.trim() || null,
    location:
      patch.location === undefined
        ? original.location
        : patch.location?.trim() || null,
    note: patch.note === undefined ? original.note : patch.note?.trim() || null,
    collaborators: Array.isArray(patch.collaborators)
      ? patch.collaborators
          .map((value) => Number(value))
          .filter(Number.isFinite)
      : original.collaborators,
    customFieldValues:
      patch.customFieldValues === undefined
        ? { ...(original.customFieldValues || {}) }
        : normalizeCustomFieldValues(patch.customFieldValues),
    items:
      patch.items === undefined
        ? normalizeItems(original.items)
        : normalizeItems(patch.items),
    salesTasks:
      patch.salesTasks === undefined
        ? normalizeSalesTasks(original.salesTasks)
        : normalizeSalesTasks(patch.salesTasks),
    documents:
      patch.documents === undefined
        ? normalizeDocuments(original.documents)
        : normalizeDocuments(patch.documents),
    financials:
      patch.financials === undefined
        ? normalizeFinancials(original.financials)
        : normalizeFinancials(patch.financials),
  });
}

const seedDeals = () => cloneDealsArray(db.deals);

export const useDealsStore = defineStore("deals", {
  state: () => ({
    items: [] as DealProperties[],
    initialized: false,
  }),
  getters: {
    all: (state) => state.items,
    byId: (state) => (id: number | string) =>
      state.items.find((deal) => String(deal.id) === String(id)) ?? null,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;

      const configStore = useConfigStore();
      configStore.init();

      const stored = loadFromStorage();
      const sourceDeals = stored && stored.length ? stored : seedDeals();
      const legacyGeneratedTaskIds = collectLegacyGeneratedTaskIds(sourceDeals);
      this.items = sanitizeDeals(cloneDealsArray(sourceDeals));

      if (legacyGeneratedTaskIds.length) {
        const todosStore = useTodos();
        todosStore.init();
        legacyGeneratedTaskIds.forEach((taskId) =>
          todosStore.removeTodo(taskId),
        );
      }

      const todosStore = useTodos();
      todosStore.init();
      todosStore.syncDealReferences(this.items);

      saveToStorage(this.items);

      this.initialized = true;

      if (typeof window !== "undefined") {
        this.$subscribe(
          (_mutation, state) => {
            saveToStorage(cloneDealsArray(state.items));
          },
          { detached: true },
        );
      }
    },

    addDeal(payload: Partial<DealProperties>) {
      const incomingId =
        payload.id && Number(payload.id) > 0 ? Number(payload.id) : undefined;
      const id = incomingId ?? nextDealId(this.items);
      const normalised = normaliseDeal(payload, id, nextDealCode(this.items));

      this.items.unshift(normalised);

      return normalised;
    },

    updateDeal(id: number | string, patch: Partial<DealProperties>) {
      const index = this.items.findIndex(
        (deal) => String(deal.id) === String(id),
      );
      if (index === -1) return null;

      const updated = mergeDeal(this.items[index], patch);

      this.items.splice(index, 1, updated);

      return updated;
    },

    syncCodePrefix() {
      const nextItems = sanitizeDeals(cloneDealsArray(this.items));
      this.items = nextItems;

      const todosStore = useTodos();
      todosStore.init();
      todosStore.syncDealReferences(nextItems);

      return nextItems;
    },

    removeDeal(id: number | string) {
      const index = this.items.findIndex(
        (deal) => String(deal.id) === String(id),
      );
      if (index === -1) return;

      this.items.splice(index, 1);
    },

    replaceAll(deals: DealProperties[]) {
      this.items = cloneDealsArray(deals);
    },
  },
});
