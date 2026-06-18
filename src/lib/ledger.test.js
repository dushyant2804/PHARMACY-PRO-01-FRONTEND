import {
  ALL_FINANCIAL_YEARS,
  getDistributorLedgerParams,
  normalizeFinancialYear
} from "./ledger";

describe("distributor ledger financial year normalization", () => {
  test.each(["all", "All", "ALL", " all ", "", null, undefined])(
    "normalizes %p to the backend all sentinel",
    (financialYear) => {
      expect(normalizeFinancialYear(financialYear)).toBe(ALL_FINANCIAL_YEARS);
      expect(getDistributorLedgerParams(financialYear)).toEqual({
        financial_year: "all"
      });
    }
  );

  test("preserves a specific financial year", () => {
    expect(getDistributorLedgerParams("2025-26")).toEqual({
      financial_year: "2025-26"
    });
    expect(getDistributorLedgerParams("2026-27")).toEqual({
      financial_year: "2026-27"
    });
  });

  test("does not reinterpret an invalid financial year as All", () => {
    expect(getDistributorLedgerParams("not-a-financial-year")).toEqual({
      financial_year: "not-a-financial-year"
    });
  });
});
