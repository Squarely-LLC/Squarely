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

export const useConfigStore = defineStore("appConfigurations", {
  state: () => ({
    configurations: seedDb.configurations as AppConfigurations,
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
        this.configurations = stored;
      } else {
        this.configurations = seedDb.configurations;
        saveToStorage(this.configurations);
      }
      this.initialized = true;
    },

    async fetchRemote() {
      try {
        const res = await fetch("/api/configurations");
        if (!res.ok) throw new Error("Failed to fetch configurations");
        const data = await res.json();
        this.configurations = data;
        saveToStorage(this.configurations);
        return this.configurations;
      } catch (error) {
        console.warn("fetchRemote error", error);
        return null;
      }
    },

    async saveRemote(patch: Partial<AppConfigurations>) {
      try {
        const res = await fetch("/api/configurations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Failed to save configurations");
        const data = await res.json();
        this.configurations = data;
        saveToStorage(this.configurations);
        return this.configurations;
      } catch (error) {
        console.warn("saveRemote error", error);
        return null;
      }
    },

    updateLocal(patch: Partial<AppConfigurations>) {
      this.configurations = { ...this.configurations, ...(patch || {}) };
      saveToStorage(this.configurations);
    },
  },
});

export default useConfigStore;
