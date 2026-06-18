// The distributor ledger endpoint historically uses the lowercase `all`
// sentinel. Keep one canonical value so the dropdown, ledger load, and export
// requests cannot diverge on casing.
export const ALL_FINANCIAL_YEARS = "all";

export function normalizeFinancialYear(financialYear) {
  const value = String(financialYear ?? "").trim();
  return !value || value.toLowerCase() === "all" ? ALL_FINANCIAL_YEARS : value;
}

export function getDistributorLedgerParams(financialYear) {
  return { financial_year: normalizeFinancialYear(financialYear) };
}
