import type { ProformaRecord } from "@/plugins/fake-api/handlers/apps/proforma/types";

const PREVIEW_DRAFT_KEY = "app.proforma.preview-draft.v1";

export type ProformaPreviewDraftSource = "add" | "edit";

export interface ProformaPreviewDraftPayload {
  source: ProformaPreviewDraftSource;
  quotation: ProformaRecord;
}

export function saveProformaPreviewDraft(payload: ProformaPreviewDraftPayload) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(payload));
}

export function loadProformaPreviewDraft(): ProformaPreviewDraftPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PREVIEW_DRAFT_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as ProformaPreviewDraftPayload;
  } catch {
    return null;
  }
}

export function clearProformaPreviewDraft() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(PREVIEW_DRAFT_KEY);
}
