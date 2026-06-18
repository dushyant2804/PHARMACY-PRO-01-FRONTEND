export const ALL_FINANCIAL_YEARS = "All";

export function normalizeFinancialYear(financialYear) {
  const value = String(financialYear ?? "").trim();
  return !value || value.toLowerCase() === "all" ? ALL_FINANCIAL_YEARS : value;
}

export function getDistributorLedgerParams(financialYear) {
  return { financial_year: normalizeFinancialYear(financialYear) };
}
