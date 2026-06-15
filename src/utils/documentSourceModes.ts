import type {
  DocumentSourceMode,
  FinancialConfig,
} from "@/plugins/fake-api/handlers/config/types";

export type DealDocumentSourceKind = "quotation" | "proforma" | "invoice";

export type DocumentSourceModes = Record<
  DealDocumentSourceKind,
  DocumentSourceMode
>;

export const DEFAULT_DOCUMENT_SOURCE_MODES: DocumentSourceModes = {
  quotation: "internal",
  proforma: "internal",
  invoice: "internal",
};

const normalizeMode = (mode?: string | null): DocumentSourceMode =>
  mode === "external" ? "external" : "internal";

export const normalizeDocumentSourceModes = (
  modes?: Partial<DocumentSourceModes> | null,
): DocumentSourceModes => {
  const next: DocumentSourceModes = {
    quotation: normalizeMode(modes?.quotation),
    proforma: normalizeMode(modes?.proforma),
    invoice: normalizeMode(modes?.invoice),
  };

  if (next.quotation === "external") {
    next.proforma = "external";
    next.invoice = "external";
  } else if (next.proforma === "external") {
    next.invoice = "external";
  }

  return next;
};

export const getFinancialDocumentSourceModes = (
  financial?: FinancialConfig | null,
) => normalizeDocumentSourceModes(financial?.documentSourceModes);

export const isDocumentSourceInternal = (
  financial: FinancialConfig | null | undefined,
  kind: DealDocumentSourceKind,
) => getFinancialDocumentSourceModes(financial)[kind] === "internal";

export const isDocumentSourceExternal = (
  financial: FinancialConfig | null | undefined,
  kind: DealDocumentSourceKind,
) => getFinancialDocumentSourceModes(financial)[kind] === "external";
