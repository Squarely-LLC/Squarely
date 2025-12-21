import type { Meeting } from "@/data/schema";
import { SeedSiteSurveys } from "@/data/seed-site-surveys";
import { defineStore } from "pinia";

const STORAGE_KEY = "app.siteSurveys.v1";
const STORAGE_KEY_SEEDED = "app.siteSurveys.seeded.v1";

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

export const useSiteSurveys = defineStore("siteSurveys", {
  state: () => ({
    surveys: [] as Meeting[],
    initialized: false,
  }),
  getters: {
    all: (s) => s.surveys,
  },
  actions: {
    init() {
      if (this.initialized) return;

      const seeded = localStorage.getItem(STORAGE_KEY_SEEDED) === "1";
      const stored = loadFromStorage();
      this.surveys =
        seeded && Array.isArray(stored) && stored.length > 0
          ? stored
          : [...SeedSiteSurveys];

      this.initialized = true;

      this.$subscribe(
        (_mutation, state) => {
          saveToStorage(state.surveys);
        },
        { detached: true }
      );
    },

    addSurvey(survey: Partial<Meeting>) {
      const now = new Date().toISOString();
      const nextId = (this.surveys.at(-1)?.id as number | undefined)
        ? Number(this.surveys.at(-1)!.id) + 1
        : 1;

      const startAt = survey.startAt || now;
      const duration =
        typeof survey.duration === "number" ? survey.duration : 30;

      const newSurvey: Meeting = {
        id: nextId,
        subject: survey.subject || "Untitled site survey",
        startAt,
        duration,
        endAt: startAt, // can be recomputed by consumers
        type: (survey.type as Meeting["type"]) || "Operation",
        linkedTo: (survey.linkedTo as any) || [],
        relatedTo: (survey as any).relatedTo || null,
        location: survey.location || "",
        note: survey.note || "",
        attachments: survey.attachments || [],
        requestedBy: (survey.requestedBy as any) || null,
        notes: Array.isArray((survey as any).notes)
          ? (survey as any).notes
          : [],
        summary: (survey as any).summary,
        createdAt: now,
        updatedAt: now,
      };

      this.surveys.unshift(newSurvey);
      return newSurvey;
    },
  },
});
