import type { Meeting } from "@/data/schema";
import { SeedSnaglists } from "@/data/seed-snaglists";
import { defineStore } from "pinia";

const STORAGE_KEY = "app.snaglists.v1";
const STORAGE_KEY_SEEDED = "app.snaglists.seeded.v1";

function loadFromStorage(): Meeting[] | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveToStorage(items: Meeting[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(STORAGE_KEY_SEEDED, "1");
}

export const useSnaglists = defineStore("snaglists", {
  state: () => ({
    snags: [] as Meeting[],
    initialized: false,
  }),
  getters: {
    all: (s) => s.snags,
  },
  actions: {
    init() {
      if (this.initialized) return;

      const seeded = localStorage.getItem(STORAGE_KEY_SEEDED) === "1";
      const stored = loadFromStorage();
      this.snags =
        seeded && Array.isArray(stored) && stored.length > 0
          ? stored
          : [...SeedSnaglists];

      this.initialized = true;

      this.$subscribe(
        (_mutation, state) => {
          saveToStorage(state.snags);
        },
        { detached: true }
      );
    },

    addSnag(snag: Partial<Meeting>) {
      const now = new Date().toISOString();
      const nextId = (this.snags.at(-1)?.id as number | undefined)
        ? Number(this.snags.at(-1)!.id) + 1
        : 1;

      const startAt = snag.startAt || now;
      const duration =
        typeof snag.duration === "number" ? snag.duration : 30;

      const newSnag: Meeting = {
        id: nextId,
        subject: snag.subject || "Untitled snaglist",
        startAt,
        duration,
        endAt: startAt,
        type: (snag.type as Meeting["type"]) || "Operation",
        linkedTo: (snag.linkedTo as any) || [],
        relatedTo: (snag as any).relatedTo || null,
        location: snag.location || "",
        note: snag.note || "",
        attachments: snag.attachments || [],
        requestedBy: (snag.requestedBy as any) || null,
        notes: Array.isArray((snag as any).notes)
          ? (snag as any).notes
          : [],
        summary: (snag as any).summary,
        createdAt: now,
        updatedAt: now,
      };

      this.snags.unshift(newSnag);
      return newSnag;
    },
  },
});
