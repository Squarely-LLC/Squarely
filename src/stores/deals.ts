import { defineStore } from "pinia";
import { toRaw } from "vue";

import { db } from "@/plugins/fake-api/handlers/operations/deals/db";
import type {
  DealCustomPhase,
  DealFieldValue,
  DealFinancialEntry,
  DealItem,
  DealNote,
  DealPendingStageTransition,
  DealProperties,
  DealSalesTaskTemplate,
  DealStageLifecycleEvent,
} from "@/plugins/fake-api/handlers/operations/deals/types";
import { useConfigStore } from "@/stores/config";
import { useTodos } from "@/stores/todos";

const STORAGE_KEY = "app.deals.v5";
const DEFAULT_DEAL_PREFIX = "DL";
const DEFAULT_DEAL_STAGES = ["Pre-Sale", "Negotation", "Active", "Closed"];

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
      notes: Array.isArray(raw.notes)
        ? raw.notes.map((note) => ({ ...note }))
        : [],
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

  return formatDealCode(dealPrefix, nextSequence);
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

  return formatDealCode(prefix, sequence);
}

function formatDealCode(prefix: string, sequence: number) {
  return `${prefix}${String(sequence).padStart(2, "0")}`;
}

function normalizeCustomFieldValues(
  values: Record<string, DealFieldValue> | undefined | null,
): Record<string, DealFieldValue> {
  if (!values || typeof values !== "object") return {};

  return Object.fromEntries(Object.entries(values));
}

function normalizeString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();

  return trimmed || null;
}

function normalizeDateString(value: unknown): string | null {
  return normalizeString(value);
}

function normalizeStageList(values: unknown): string[] {
  if (!Array.isArray(values)) return [...DEFAULT_DEAL_STAGES];

  const stages = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return stages.length ? stages : [...DEFAULT_DEAL_STAGES];
}

function resolveDealStageOptions() {
  const configStore = useConfigStore();
  configStore.init();

  return normalizeStageList(configStore.configurations?.deals?.dealStages);
}

function findConfiguredStage(stageName: string) {
  const safeStageName = String(stageName ?? "").trim().toLowerCase();
  if (!safeStageName) return null;

  return (
    resolveDealStageOptions().find(
      (stage) => stage.trim().toLowerCase() === safeStageName,
    ) ?? null
  );
}

function resolveCanonicalStage(
  stageName: "Pre-Sale" | "Negotation" | "Active" | "Closed",
) {
  return (
    findConfiguredStage(stageName) ??
    (stageName === "Pre-Sale" ? resolveDealStageOptions()[0] ?? stageName : stageName)
  );
}

function resolveStageIndex(stage: string | null | undefined) {
  const safeStage = String(stage ?? "").trim().toLowerCase();
  if (!safeStage) return -1;

  return resolveDealStageOptions().findIndex(
    (option) => option.trim().toLowerCase() === safeStage,
  );
}

function shouldPromoteLifecycleStage(
  currentStage: string | null | undefined,
  targetStage: string,
) {
  const targetIndex = resolveStageIndex(targetStage);
  if (targetIndex === -1) return true;

  const currentIndex = resolveStageIndex(currentStage);
  if (currentIndex === -1) return true;

  return targetIndex > currentIndex;
}

function normalizePendingStageTransition(
  value: DealPendingStageTransition | null | undefined,
): DealPendingStageTransition | null {
  if (!value || typeof value !== "object") return null;

  const targetStage = normalizeString(value.targetStage);
  const reason = normalizeString(value.reason);
  const requestedAt = normalizeString(value.requestedAt);
  const event = String(value.event ?? "").trim() as DealStageLifecycleEvent;
  const validEvent =
    event === "deal-created" ||
    event === "quotation-created" ||
    event === "quotation-canceled" ||
    event === "proforma-created" ||
    event === "invoice-created" ||
    event === "invoice-payment-updated";

  if (!targetStage || !reason || !requestedAt || !validEvent) return null;

  return {
    targetStage,
    reason,
    event,
    requestedAt,
  };
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAmount(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCollaborators(
  collaborators: DealProperties["collaborators"] | undefined | null,
): DealProperties["collaborators"] {
  if (!Array.isArray(collaborators)) return [];

  return collaborators
    .map((value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("contact:")) return trimmed;

        const numeric = Number(trimmed);

        return Number.isFinite(numeric) ? numeric : trimmed;
      }

      const numeric = Number(value);

      return Number.isFinite(numeric) ? numeric : null;
    })
    .filter(
      (value): value is number | string =>
        value !== null && value !== undefined && value !== "",
    );
}

function normalizeSalesman(
  salesman: DealProperties["salesman"] | undefined | null,
  collaborators?: DealProperties["collaborators"] | undefined | null,
) {
  const normalizedCollaborators = normalizeCollaborators(collaborators);

  if (salesman === null || salesman === undefined || salesman === "")
    return normalizedCollaborators[0] ?? null;

  if (typeof salesman === "string") {
    const trimmed = salesman.trim();
    if (!trimmed) return normalizedCollaborators[0] ?? null;
    if (trimmed.startsWith("contact:")) return trimmed;

    const numeric = Number(trimmed);

    return Number.isFinite(numeric) ? numeric : trimmed;
  }

  const numeric = Number(salesman);

  return Number.isFinite(numeric)
    ? numeric
    : (normalizedCollaborators[0] ?? null);
}

function normalizeItems(items: DealItem[] | undefined | null): DealItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map(({ generatedTaskIds: _generatedTaskIds, ...item }, index) => ({
      ...item,
      id: normalizeNullableNumber(item.id) ?? index + 1,
      name: normalizeString(item.name) || "Untitled item",
      category: normalizeString(item.category),
      catalogueItemId: normalizeString(item.catalogueItemId),
      catalogueType: normalizeString(item.catalogueType),
      itemTypeLabel:
        normalizeString(item.itemTypeLabel) || normalizeString(item.catalogueType),
      parentItemId: normalizeNullableNumber(item.parentItemId),
      sourceRelatedItemId: normalizeNullableNumber(item.sourceRelatedItemId),
      quantity: normalizeAmount(item.quantity) ?? 1,
      unitPrice: normalizeAmount(item.unitPrice),
      discountPercent: normalizeAmount(item.discountPercent) ?? 0,
      taxApplicable:
        item.taxApplicable === null || item.taxApplicable === undefined
          ? null
          : Boolean(item.taxApplicable),
      recurrentStartDate: normalizeDateString(item.recurrentStartDate),
      recurrentEndDate: normalizeDateString(item.recurrentEndDate),
      recurrentPeriods: normalizeNullableNumber(item.recurrentPeriods),
      recurrentBillablePeriods: normalizeNullableNumber(
        item.recurrentBillablePeriods,
      ),
      retainerStartDate: normalizeDateString(item.retainerStartDate),
      retainerEndDate: normalizeDateString(item.retainerEndDate),
      retainerPeriods: normalizeNullableNumber(item.retainerPeriods),
      retainerBillablePeriods: normalizeNullableNumber(
        item.retainerBillablePeriods,
      ),
      status: normalizeString(item.status),
      note: normalizeString(item.note),
      customPhases: Array.isArray(item.customPhases)
        ? item.customPhases.map((phase: DealCustomPhase) => ({
            ...phase,
            id: String(phase.id ?? "").trim(),
            name: normalizeString(phase.name) || "Untitled phase",
            category: normalizeString(phase.category),
            quantity: normalizeAmount(phase.quantity),
            price: normalizeAmount(phase.price),
            discountPercent: normalizeAmount(phase.discountPercent),
            taxApplicable:
              phase.taxApplicable === null || phase.taxApplicable === undefined
                ? null
                : Boolean(phase.taxApplicable),
            note: normalizeString(phase.note),
          }))
        : null,
      removedPhaseIds: Array.isArray(item.removedPhaseIds)
        ? item.removedPhaseIds
            .map((value) => Number(value))
            .filter(Number.isFinite)
        : null,
      excludedRelatedItemIds: Array.isArray(item.excludedRelatedItemIds)
        ? item.excludedRelatedItemIds
            .map((value) => Number(value))
            .filter(Number.isFinite)
        : null,
      subItemOverrides: item.subItemOverrides
        ? Object.fromEntries(
            Object.entries(item.subItemOverrides).map(([key, value]) => [
              key,
              {
                ...value,
                name: normalizeString(value?.name),
                category: normalizeString(value?.category),
                quantity: normalizeAmount(value?.quantity),
                unitPrice: normalizeAmount(value?.unitPrice),
                discountPercent: normalizeAmount(value?.discountPercent),
                taxApplicable:
                  value?.taxApplicable === null ||
                  value?.taxApplicable === undefined
                    ? null
                    : Boolean(value.taxApplicable),
                note: normalizeString(value?.note),
                periodUnitPrices: value?.periodUnitPrices
                  ? Object.fromEntries(
                      Object.entries(value.periodUnitPrices).map(
                        ([periodKey, periodPrice]) => [
                          periodKey,
                          normalizeAmount(periodPrice),
                        ],
                      ),
                    )
                  : null,
              },
            ]),
          )
        : null,
    }))
    .filter((item) => item.name);
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

  const createdAt =
    normalizeString(deal.createdAt) ||
    normalizeString(seedMatch?.createdAt) ||
    new Date().toISOString();

  return {
    ...deal,
    code: migratedCode,
    name: migratedName || deal.name,
    amount:
      normalizeAmount(deal.amount) ??
      normalizeAmount(seedMatch?.amount) ??
      normalizeAmount(quotationAmount),
    projectCode:
      normalizeString(deal.projectCode) ||
      normalizeString(seedMatch?.projectCode),
    projectName:
      normalizeString(deal.projectName) ||
      normalizeString(seedMatch?.projectName),
    relatedTo: normalizeNullableNumber(deal.relatedTo),
    linkedJobId: normalizeNullableNumber(deal.linkedJobId),
    salesman: normalizeSalesman(deal.salesman, deal.collaborators),
    type: normalizeString(deal.type),
    estimatedDeliveryDate: normalizeDateString(deal.estimatedDeliveryDate),
    stage: normalizeString(deal.stage),
    important: Boolean(deal.important),
    location: normalizeString(deal.location),
    collaborators: normalizeCollaborators(deal.collaborators),
    note: normalizeString(deal.note),
    customFieldValues: normalizeCustomFieldValues(deal.customFieldValues),
    stageManuallyManaged: Boolean(deal.stageManuallyManaged),
    pendingStageTransition: normalizePendingStageTransition(
      deal.pendingStageTransition,
    ),
    createdAt,
    updatedAt:
      normalizeString(deal.updatedAt) ||
      normalizeString(seedMatch?.updatedAt) ||
      createdAt,
  };
}

function sanitizeDeals(deals: DealProperties[]) {
  return deals.map((deal) => ({
    ...applyDealFieldMigrations(deal),
    items: normalizeItems(deal.items),
    salesTasks: normalizeSalesTasks(deal.salesTasks),
    documents: normalizeDocuments(deal.documents),
    financials: normalizeFinancials(deal.financials),
    notes: normalizeNotes(deal.notes),
  }));
}

function normalizeDocuments(
  documents: DealProperties["documents"] | undefined | null,
) {
  if (!Array.isArray(documents)) return [];

  return documents
    .map((document, index) => ({
      ...document,
      id: normalizeNullableNumber(document.id) ?? index + 1,
      category: normalizeString(document.category) || undefined,
      type: normalizeString(document.type) || undefined,
      name: normalizeString(document.name) || "Untitled document",
      expiry: normalizeDateString(document.expiry),
      expiryReminder: Boolean(document.expiryReminder),
      note: normalizeString(document.note) || undefined,
      fileUrl: normalizeString(document.fileUrl) || undefined,
      createdAt: normalizeString(document.createdAt) || new Date().toISOString(),
    }))
    .filter((document) => document.name);
}

function normalizeFinancials(
  financials: DealFinancialEntry[] | undefined | null,
): DealFinancialEntry[] {
  if (!Array.isArray(financials)) return [];

  return financials.map((entry, index) => ({
    ...entry,
    id: normalizeNullableNumber(entry.id) ?? index + 1,
    title: normalizeString(entry.title) || "Untitled entry",
    type:
      entry.type === "invoice" ||
      entry.type === "payment" ||
      entry.type === "cost"
        ? entry.type
        : "quotation",
    amount: normalizeAmount(entry.amount) ?? 0,
    status: normalizeString(entry.status),
    dueDate: normalizeDateString(entry.dueDate),
    createdAt: normalizeString(entry.createdAt) || new Date().toISOString(),
  }));
}

function normalizeNotes(notes: DealNote[] | undefined | null): DealNote[] {
  if (!Array.isArray(notes)) return [];

  return notes
    .map((note, index) => ({
      id:
        String(note.id ?? "").trim() ||
        `note-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      body: String(note.body ?? "").trim(),
      createdAt: note.createdAt || new Date().toISOString(),
      authorName: note.authorName ? String(note.authorName).trim() : null,
    }))
    .filter((note) => note.body);
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
    relatedTo: normalizeNullableNumber(payload.relatedTo),
    linkedJobId: normalizeNullableNumber(payload.linkedJobId),
    salesman: normalizeSalesman(payload.salesman, payload.collaborators),
    type: normalizeString(payload.type),
    estimatedDeliveryDate: normalizeDateString(payload.estimatedDeliveryDate),
    stage: normalizeString(payload.stage),
    important: Boolean(payload.important),
    location: normalizeString(payload.location),
    collaborators: normalizeCollaborators(payload.collaborators),
    note: normalizeString(payload.note),
    customFieldValues: normalizeCustomFieldValues(payload.customFieldValues),
    stageManuallyManaged: false,
    pendingStageTransition: null,
    notes: normalizeNotes(payload.notes),
    items: normalizeItems(payload.items),
    salesTasks: normalizeSalesTasks(payload.salesTasks),
    documents: normalizeDocuments(payload.documents),
    financials: normalizeFinancials(payload.financials),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
}

function mergeDeal(
  original: DealProperties,
  patch: Partial<DealProperties>,
): DealProperties {
  const mergedCode =
    patch.code === undefined ? original.code : patch.code?.trim() || null;

  const now = new Date().toISOString();

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
    linkedJobId:
      patch.linkedJobId === undefined
        ? (original.linkedJobId ?? null)
        : patch.linkedJobId === null
          ? null
          : Number(patch.linkedJobId),
    salesman:
      patch.salesman === undefined
        ? normalizeSalesman(original.salesman, original.collaborators)
        : normalizeSalesman(patch.salesman, patch.collaborators),
    type: patch.type === undefined ? original.type : patch.type?.trim() || null,
    stage:
      patch.stage === undefined ? original.stage : patch.stage?.trim() || null,
    location:
      patch.location === undefined
        ? original.location
        : patch.location?.trim() || null,
    note: patch.note === undefined ? original.note : patch.note?.trim() || null,
    collaborators:
      patch.collaborators === undefined
        ? normalizeCollaborators(original.collaborators)
        : normalizeCollaborators(patch.collaborators),
    customFieldValues:
      patch.customFieldValues === undefined
        ? { ...(original.customFieldValues || {}) }
        : normalizeCustomFieldValues(patch.customFieldValues),
    stageManuallyManaged:
      patch.stageManuallyManaged === undefined
        ? Boolean(original.stageManuallyManaged)
        : Boolean(patch.stageManuallyManaged),
    pendingStageTransition:
      patch.pendingStageTransition === undefined
        ? normalizePendingStageTransition(original.pendingStageTransition)
        : normalizePendingStageTransition(patch.pendingStageTransition),
    notes:
      patch.notes === undefined
        ? normalizeNotes(original.notes)
        : normalizeNotes(patch.notes),
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
    createdAt: normalizeString(original.createdAt) || now,
    updatedAt: now,
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
    latestPendingStageDeal: (state) => {
      const pendingDeals = state.items
        .filter((deal) => deal.pendingStageTransition)
        .sort((left, right) => {
          const leftTime = new Date(
            left.pendingStageTransition?.requestedAt || 0,
          ).getTime();
          const rightTime = new Date(
            right.pendingStageTransition?.requestedAt || 0,
          ).getTime();

          return rightTime - leftTime;
        });

      return pendingDeals[0] ?? null;
    },
  },
  actions: {
    persistItems() {
      saveToStorage(cloneDealsArray(this.items));
    },

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
      const normalised = normaliseDeal(
        {
          ...payload,
          stage: resolveCanonicalStage("Pre-Sale"),
          stageManuallyManaged: false,
          pendingStageTransition: null,
        },
        id,
        nextDealCode(this.items),
      );

      this.items.unshift(normalised);
      this.persistItems();

      return normalised;
    },

    updateDeal(id: number | string, patch: Partial<DealProperties>) {
      const index = this.items.findIndex(
        (deal) => String(deal.id) === String(id),
      );
      if (index === -1) return null;

      const updated = mergeDeal(this.items[index], patch);

      this.items.splice(index, 1, updated);
      this.persistItems();

      return updated;
    },

    updateDealStageManually(id: number | string, stage: string | null) {
      const normalizedStage = normalizeString(stage);
      if (!normalizedStage) return null;

      return this.updateDeal(id, {
        stage: normalizedStage,
        stageManuallyManaged: true,
        pendingStageTransition: null,
      });
    },

    triggerLifecycleStageTransition(
      id: number | string | null | undefined,
      targetStageName: "Negotation" | "Active" | "Closed",
      reason: string,
      event: DealStageLifecycleEvent,
    ) {
      if (id === null || id === undefined || id === "") return null;

      const currentDeal = this.byId(id);
      if (!currentDeal) return null;

      const targetStage = resolveCanonicalStage(targetStageName);
      if (!targetStage) return currentDeal;

      if (currentDeal.stageManuallyManaged) {
        if (currentDeal.stage === targetStage) return currentDeal;

        return this.updateDeal(id, {
          pendingStageTransition: {
            targetStage,
            reason,
            event,
            requestedAt: new Date().toISOString(),
          },
        });
      }

      if (!shouldPromoteLifecycleStage(currentDeal.stage, targetStage)) {
        return currentDeal;
      }

      return this.updateDeal(id, {
        stage: targetStage,
        stageManuallyManaged: false,
        pendingStageTransition: null,
      });
    },

    async reevaluateDealClosureFromInvoices(
      id: number | string | null | undefined,
    ) {
      if (id === null || id === undefined || id === "") return null;

      const currentDeal = this.byId(id);
      if (!currentDeal) return null;

      const { useInvoicesStore } = await import("@/stores/invoices");
      const invoicesStore = useInvoicesStore();
      invoicesStore.init();

      const linkedInvoices = invoicesStore.all.filter(
        (record) => String(record.quotation.dealId ?? "") === String(id),
      );

      if (!linkedInvoices.length) return currentDeal;

      const allInvoicesPaid = linkedInvoices.every(
        (record) => record.quotation.quotationStatus === "Paid",
      );

      if (!allInvoicesPaid) return currentDeal;

      return this.triggerLifecycleStageTransition(
        id,
        "Closed",
        "All invoices paid",
        "invoice-payment-updated",
      );
    },

    approvePendingStageTransition(id: number | string) {
      const currentDeal = this.byId(id);
      const pendingTransition = currentDeal?.pendingStageTransition;
      if (!currentDeal || !pendingTransition) return null;

      return this.updateDeal(id, {
        stage: pendingTransition.targetStage,
        stageManuallyManaged: false,
        pendingStageTransition: null,
      });
    },

    dismissPendingStageTransition(id: number | string) {
      const currentDeal = this.byId(id);
      if (!currentDeal?.pendingStageTransition) return null;

      return this.updateDeal(id, {
        pendingStageTransition: null,
        stageManuallyManaged: true,
      });
    },

    syncCodePrefix() {
      const nextItems = sanitizeDeals(cloneDealsArray(this.items));
      this.items = nextItems;
      this.persistItems();

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
      this.persistItems();
    },

    replaceAll(deals: DealProperties[]) {
      this.items = sanitizeDeals(cloneDealsArray(deals));
      this.persistItems();
    },
  },
});
