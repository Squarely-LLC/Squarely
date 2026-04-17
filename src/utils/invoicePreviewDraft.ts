import type { InvoiceRecord } from "@/plugins/fake-api/handlers/apps/invoice/types";

const PREVIEW_DRAFT_KEY = "app.invoice.preview-draft.v1";

export type InvoicePreviewDraftSource = "add" | "edit";

export interface InvoicePreviewDraftPayload {
  source: InvoicePreviewDraftSource;
  quotation: InvoiceRecord;
}

export function saveInvoicePreviewDraft(payload: InvoicePreviewDraftPayload) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(PREVIEW_DRAFT_KEY, JSON.stringify(payload));
}

export function loadInvoicePreviewDraft(): InvoicePreviewDraftPayload | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PREVIEW_DRAFT_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as InvoicePreviewDraftPayload;
  } catch {
    return null;
  }
}

export function clearInvoicePreviewDraft() {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(PREVIEW_DRAFT_KEY);
}
