import { db as seedDb } from "@/plugins/fake-api/handlers/config/db";
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import { defineStore } from "pinia";

const STORAGE_KEY = "app.configurations.v1";

function loadFromStorage(): AppConfigurations | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppConfigurations;
  } catch (error) {
    console.warn("Failed to load configurations from storage:", error);
    return null;
  }
}

function saveToStorage(cfg: AppConfigurations) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (error) {
    console.warn("Failed to save configurations to storage:", error);
  }
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const mergeSection = <T>(current: T, incoming: T): T => {
  if (isPlainObject(current) && isPlainObject(incoming)) {
    return { ...(current as any), ...(incoming as any) };
  }
  return incoming;
};

const normalizeConfigurations = (
  cfg: AppConfigurations | null | undefined,
): AppConfigurations => {
  const next = (cfg || seedDb.configurations) as AppConfigurations;
  const rawDealPrefix = String(next.deals?.dealPrefix ?? "DL").trim() || "DL";
  const dealPrefix = rawDealPrefix === "DL-" ? "DL" : rawDealPrefix;
  const legacyDealStages = [
    "Under Review",
    "Negotiation",
    "In Progress",
    "High Priority",
    "Express Order",
    "On Hold",
    "Awaiting Payment",
    "Canceled",
    "Completed",
  ];
  const previousDefaultDealStages = [
    "Under Review",
    "Negotiation",
    "In Progress",
    "Awaiting Payment",
    "On Hold",
    "Completed",
  ];
  const defaultDealStages = ["Pre-Sale", "Negotation", "Active", "Closed"];
  const configuredDealStages = next.deals?.dealStages || [];
  const dealStages =
    (
      configuredDealStages.length === legacyDealStages.length &&
      configuredDealStages.every((stage, index) => stage === legacyDealStages[index])
    ) || (
      configuredDealStages.length === previousDefaultDealStages.length &&
      configuredDealStages.every(
        (stage, index) => stage === previousDefaultDealStages[index],
      )
    )
      ? defaultDealStages
      : configuredDealStages.length
        ? configuredDealStages
        : defaultDealStages;

  return {
    ...next,
    deals: {
      ...(next.deals || {}),
      dealPrefix,
      dealStages,
    },
  };
};

const normalizePatch = (
  current: AppConfigurations,
  patch: Partial<AppConfigurations>
): Partial<AppConfigurations> => {
  const normalized: Partial<AppConfigurations> = {};
  const entries = Object.entries(patch ?? {});
  for (const [key, value] of entries) {
    const sectionKey = key as keyof AppConfigurations;
    const currentSection = current?.[sectionKey];
    normalized[sectionKey] =
      value === undefined ? undefined : mergeSection(currentSection, value);
  }
  return normalized;
};

export const useConfigStore = defineStore("appConfigurations", {
  state: () => ({
    configurations: normalizeConfigurations(seedDb.configurations),
    initialized: false,
  }),
  getters: {
    all: (state) => state.configurations,
    legal: (state) => state.configurations.legal,
    financial: (state) => state.configurations.financial,
  },
  actions: {
    init(force = false) {
      if (this.initialized && !force) return;
      const stored = loadFromStorage();
      if (stored) {
        this.configurations = normalizeConfigurations(stored);
      } else {
        this.configurations = normalizeConfigurations(seedDb.configurations);
        saveToStorage(this.configurations);
      }
      this.initialized = true;
    },

    async fetchRemote() {
      try {
        const res = await fetch("/api/configurations");
        if (!res.ok) throw new Error("Failed to fetch configurations");
        const data = await res.json();
        this.configurations = normalizeConfigurations(data);
        saveToStorage(this.configurations);
        return this.configurations;
      } catch (error) {
        console.warn("fetchRemote error", error);
        return null;
      }
    },

    async saveRemote(patch: Partial<AppConfigurations>) {
      try {
        const payload = normalizePatch(this.configurations, patch || {});
        const res = await fetch("/api/configurations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save configurations");
        const data = normalizeConfigurations((await res.json()) as AppConfigurations);
        // Only update sections that were part of the payload to avoid
        // clobbering other in-memory edits from different tabs/views.
        const keys = Object.keys(payload || {}) as (keyof AppConfigurations)[];
        const next: AppConfigurations = {
          ...this.configurations,
        } as AppConfigurations;
        for (const k of keys) {
          (next as any)[k] = (data as any)[k];
        }
        this.configurations = next;
        saveToStorage(this.configurations);
        return this.configurations;
      } catch (error) {
        console.warn("saveRemote error", error);
        return null;
      }
    },

    updateLocal(patch: Partial<AppConfigurations>) {
      const merged = normalizePatch(this.configurations, patch || {});
      this.configurations = normalizeConfigurations({
        ...this.configurations,
        ...merged,
      });
      saveToStorage(this.configurations);
    },
  },
});

export default useConfigStore;
