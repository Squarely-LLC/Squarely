import type { QuotationRecord } from "@/plugins/fake-api/handlers/apps/quotation/types";

const PREVIEW_DRAFT_KEY = "app.quotation.preview-draft.v1";

export type QuotationPreviewDraftSource = "add" | "edit";

export interface QuotationPreviewDraftPayload {
  source: QuotationPreviewDraftSource;
  quotation: QuotationRecord;
}

export function saveQuotationPreviewDraft(payload: QuotationPreviewDraftPayload) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(payload));
}

export function loadQuotationPreviewDraft(): QuotationPreviewDraftPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PREVIEW_DRAFT_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as QuotationPreviewDraftPayload;
  } catch {
    return null;
  }
}

export function clearQuotationPreviewDraft() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(PREVIEW_DRAFT_KEY);
}
