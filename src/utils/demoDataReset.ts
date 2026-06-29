export const DEMO_DATA_VERSION_KEY = "app.demo-data.version";
export const DEMO_DATA_VERSION = "2026-06-29-stable-local-demo-v1";

const DEMO_STORAGE_PREFIXES = [
  "app.account-roles.",
  "app.catalogue-tables.",
  "app.contacts.",
  "app.credit-notes.",
  "app.deals.",
  "app.debit-notes.",
  "app.employees.",
  "app.expenses.",
  "app.invoices.",
  "app.invoice.",
  "app.jobs.",
  "app.meetings.",
  "app.meetings.seeded.",
  "app.payment-vouchers.",
  "app.people.",
  "app.proformas.",
  "app.proforma.",
  "app.quotations.",
  "app.quotation.",
  "app.receipts.",
  "app.siteSurveys.",
  "app.siteSurveys.seeded.",
  "app.snaglists.",
  "app.snaglists.seeded.",
  "app.system-notifications.",
  "app.todos.",
] as const;

const DEMO_STORAGE_KEYS = [
  "squarely.finance-approval-decisions.v1",
  "squarely.user-created.quotations.v1",
] as const;

const shouldResetKey = (key: string) =>
  key !== DEMO_DATA_VERSION_KEY &&
  (DEMO_STORAGE_KEYS.includes(key as (typeof DEMO_STORAGE_KEYS)[number]) ||
    DEMO_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)));

export const ensureCleanDemoDataVersion = () => {
  if (typeof window === "undefined") return false;

  const currentVersion = window.localStorage.getItem(DEMO_DATA_VERSION_KEY);
  if (currentVersion === DEMO_DATA_VERSION) return false;

  Object.keys(window.localStorage).forEach((key) => {
    if (shouldResetKey(key)) window.localStorage.removeItem(key);
  });

  window.localStorage.setItem(DEMO_DATA_VERSION_KEY, DEMO_DATA_VERSION);

  return true;
};
