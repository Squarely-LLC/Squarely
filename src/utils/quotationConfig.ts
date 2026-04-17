import seedConfigDb from "@/plugins/fake-api/handlers/config/db";
import type AppConfigurations from "@/plugins/fake-api/handlers/config/types";
import type {
  BankDetailsItem,
  FinancialConfig,
  LegalConfig,
} from "@/plugins/fake-api/handlers/config/types";
import { getFileObjectUrl } from "@/utils/fileStore";

const CONFIG_STORAGE_KEY = "app.configurations.v1";

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

export function buildQuotationPaymentDetails(
  total: number,
  legal?: LegalConfig | null,
  financial?: FinancialConfig | null,
) {
  const bank = getPrimaryBankDetails(financial);

  return {
    totalDue: `$${Number(total || 0).toLocaleString()}`,
    bankName: bank?.bankName?.trim() || "",
    country: legal?.country?.trim() || "",
    iban: bank?.iban?.trim() || "",
    swiftCode: bank?.swiftCode?.trim() || "",
  };
}

export function buildQuotationNote(
  financial?: FinancialConfig | null,
  fallbackDays = 7,
) {
  return (
    financial?.invoicing?.noteOnQuotation?.trim() ||
    `Pricing is valid for ${fallbackDays} days from the issue date.`
  );
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
