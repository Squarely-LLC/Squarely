import seedConfigDb from "@/plugins/fake-api/handlers/config/db";
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import type {
  BankDetailsItem,
  FinancialConfig,
  LegalConfig,
} from "@/plugins/fake-api/handlers/config/types";
import { getFileObjectUrl } from "@/utils/fileStore";

const CONFIG_STORAGE_KEY = "app.configurations.v1";
type DocumentConfigKind = "quotation" | "proforma" | "invoice";

function resolveSequenceYearTokens(value: string) {
  const currentYear = String(new Date().getFullYear());
  return value.replace(/YYYY/g, currentYear);
}

export function loadActiveAppConfigurations(): AppConfigurations {
  if (typeof window === "undefined") return seedConfigDb.configurations;

  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return seedConfigDb.configurations;

    return JSON.parse(raw) as AppConfigurations;
  } catch {
    return seedConfigDb.configurations;
  }
}

export function getPrimaryBankDetails(
  financial?: FinancialConfig | null,
): BankDetailsItem | null {
  const bankDetails = financial?.bankDetails ?? [];

  return bankDetails.find((item) => item.enabled) ?? bankDetails[0] ?? null;
}

export function getDocumentSequencePrefix(
  documentKind: DocumentConfigKind,
  config?: AppConfigurations | null,
) {
  const activeConfig = config ?? loadActiveAppConfigurations();

  if (documentKind === "quotation") {
    return resolveSequenceYearTokens(
      activeConfig.deals?.quotationStartsSeq?.trim() || "QT-",
    );
  }

  if (documentKind === "proforma") {
    return resolveSequenceYearTokens(
      activeConfig.deals?.proformaStartSeq?.trim() || "PF-",
    );
  }

  return resolveSequenceYearTokens(
    activeConfig.financial?.invoiceSequence?.trim() || "INV-",
  );
}

export function getConfiguredCurrencySymbol(
  financial?: FinancialConfig | null,
) {
  const configuredCurrency = financial?.currency?.trim() || "";
  const symbolInParens = configuredCurrency.match(
    /\([^()]*?([^()\s]{1,5})\)\s*$/,
  );

  if (symbolInParens?.[1]) return symbolInParens[1];

  const explicitSymbol = configuredCurrency.match(/[$€£¥₹₦₵₨₫₴₱₪₭₮₡₲₸₼₽₺₴]/);
  if (explicitSymbol?.[0]) return explicitSymbol[0];

  return "$";
}

export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  financial?: FinancialConfig | null,
) {
  return `${getConfiguredCurrencySymbol(financial)}${Number(amount || 0).toLocaleString()}`;
}

export function getVatSummary(financial?: FinancialConfig | null) {
  return {
    label: "VAT",
    value: financial?.vat?.enabled ? "Included" : "Not Applied",
  };
}

export function buildQuotationPaymentDetails(
  total: number,
  legal?: LegalConfig | null,
  financial?: FinancialConfig | null,
) {
  const bank = getPrimaryBankDetails(financial);

  return {
    totalDue: formatCurrencyAmount(total, financial),
    bankName: bank?.bankName?.trim() || "",
    country: legal?.country?.trim() || "",
    iban: bank?.iban?.trim() || "",
    swiftCode: bank?.swiftCode?.trim() || "",
  };
}

export function buildDocumentNote(
  financial?: FinancialConfig | null,
  documentKind: DocumentConfigKind = "quotation",
  fallbackDays = 7,
) {
  const configuredNote =
    documentKind === "invoice"
      ? financial?.invoicing?.notesOnInvoice?.trim()
      : documentKind === "proforma"
        ? financial?.invoicing?.noteOnProforma?.trim()
        : financial?.invoicing?.noteOnQuotation?.trim();

  if (configuredNote) return configuredNote;

  if (documentKind === "invoice") {
    return `Payment due within ${fallbackDays} days.`;
  }

  return `Pricing is valid for ${fallbackDays} days from the issue date.`;
}

export function buildQuotationNote(
  financial?: FinancialConfig | null,
  fallbackDays = 7,
) {
  return buildDocumentNote(financial, "quotation", fallbackDays);
}

export function buildProformaNote(
  financial?: FinancialConfig | null,
  fallbackDays = 7,
) {
  return buildDocumentNote(financial, "proforma", fallbackDays);
}

export function buildQuotationSalesperson(legal?: LegalConfig | null) {
  return legal?.companyName?.trim() || "Squarely Team";
}

export function buildQuotationThanksNote(legal?: LegalConfig | null) {
  const companyName = legal?.companyName?.trim();
  return companyName
    ? `Thank you for considering ${companyName}.`
    : "Thank you for considering Squarely.";
}

export function getQuotationCompanyAddressLines(legal?: LegalConfig | null) {
  const address = legal?.address?.trim() || "";
  const cityCountry = [legal?.city?.trim(), legal?.country?.trim()]
    .filter(Boolean)
    .join(", ");

  return [address, cityCountry].filter(Boolean);
}

export function getQuotationCompanyContactLines(legal?: LegalConfig | null) {
  return [legal?.number?.trim() || "", legal?.email?.trim() || ""].filter(
    Boolean,
  );
}

export async function resolveQuotationLogoUrl(logo?: string | null) {
  const normalized = String(logo ?? "").trim();
  if (!normalized) return "";

  if (normalized.startsWith("idb:")) {
    const key = normalized.slice(4).split("|")[0];
    return (await getFileObjectUrl(key)) || "";
  }

  return normalized;
}
