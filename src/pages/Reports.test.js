jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}` }));

import fs from "fs";
import path from "path";
import { buildExpiryRiskCards, formatAgingDays, hasValues, normalizeMedicineRows, normalizePurchaseReturnAnalytics, normalizeRecovery } from "./Reports";

describe("reports dashboard normalizers", () => {
  it("builds separate expiry risk cards from value-at-risk fields", () => {
    expect(buildExpiryRiskCards({
      expired_value_at_risk: 1200,
      expiring_30_value_at_risk: "900",
      expiring_31_90_value_at_risk: null,
    }, { expiring_31_90_value_at_risk: 500 })).toEqual([
      { label: "Expired Value", value: 1200 },
      { label: "0-30 Day Risk", value: 900 },
      { label: "31-90 Day Risk", value: 500 },
    ]);
  });

  it("normalizes medicine intelligence rows without inventing data", () => {
    expect(normalizeMedicineRows({ medicine_profit: [{
      medicine_name: "Paracetamol",
      total_sales: 2500,
      purchase_cost: 1700,
      gross_profit: 800,
      margin_percent: 32,
      units_sold: 50,
    }] }, ["medicine_profit"])).toEqual([expect.objectContaining({
      name: "Paracetamol",
      revenue: 2500,
      cost: 1700,
      profit: 800,
      margin: 32,
      units: 50,
    })]);
  });


  it("normalizes outstanding movement from supported monthly trend paths", () => {
    expect(normalizeRecovery({ monthly_outstanding_trend: [{ month: "Jan", customer_outstanding: 100, distributor_outstanding: 40 }] })).toEqual([
      { period: "Jan", customerOutstanding: 100, distributorOutstanding: 40 },
    ]);
    expect(normalizeRecovery({ monthly_outstanding_trends: [{ period: "Feb", customers: 125, distributors: 55 }] })).toEqual([
      { period: "Feb", customerOutstanding: 125, distributorOutstanding: 55 },
    ]);
    expect(normalizeRecovery({ outstanding_movement_chart: [{ label: "Mar", customer_receivables: 200, distributor_payables: 75 }] })).toEqual([
      { period: "Mar", customerOutstanding: 200, distributorOutstanding: 75 },
    ]);
  });

  it("keeps valid outstanding movement data visible and empty movement data hidden", () => {
    const rows = normalizeRecovery({ outstanding_movement_chart: [{ label: "Apr", customer_receivables: 10, distributor_payables: 0 }] });
    expect(hasValues(rows, ["customerOutstanding", "distributorOutstanding"])).toBe(true);
    expect(hasValues(normalizeRecovery({ monthly_outstanding_trend: [] }), ["customerOutstanding", "distributorOutstanding"])).toBe(false);
    expect(hasValues(normalizeRecovery({ monthly_outstanding_trend: [{ month: "May", customer_receivables: 0, distributor_payables: 0 }] }), ["customerOutstanding", "distributorOutstanding"])).toBe(false);
  });

  it("normalizes purchase return analytics from medicine report paths", () => {
    expect(normalizePurchaseReturnAnalytics({ medicine_wise_return_analytics: [{ medicine_name: "A", total_return_value: 500, total_returned_quantity: 5 }] })).toEqual([
      { name: "A", returnedQty: 5, value: 500, status: "Recorded" },
    ]);
    expect(normalizePurchaseReturnAnalytics({ returns_by_medicine: [{ medicine: "B", total_return_amount: 750, total_return_quantity: 3 }] })).toEqual([
      { name: "B", returnedQty: 3, value: 750, status: "Recorded" },
    ]);
    expect(normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "C", total_amount: 250, qty: 2, status: "Adjusted" }] })).toEqual([
      { name: "C", returnedQty: 2, value: 250, status: "Adjusted" },
    ]);
    expect(normalizePurchaseReturnAnalytics({ data: { by_medicine: { D: { total_return_value: 125, qty: 1 } } } })).toEqual([
      { name: "D", returnedQty: 1, value: 125, status: "Recorded" },
    ]);
  });

  it("keeps valid purchase return values visible and empty return values hidden", () => {
    const rows = normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "D", total_return_value: 100, total_quantity: 1 }] });
    expect(hasValues(rows, ["value"])).toBe(true);
    expect(hasValues(normalizePurchaseReturnAnalytics({ medicine_breakdown: [] }), ["value"])).toBe(false);
    expect(hasValues(normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "E", total_return_value: 0, total_quantity: 0 }] }), ["value"])).toBe(false);
  });

  it("formats aging values with day units", () => {
    expect(formatAgingDays({ aging_days: 0 })).toBe("0 days");
    expect(formatAgingDays({ age: 1 })).toBe("1 day");
    expect(formatAgingDays(57)).toBe("57 days");
  });

  it("uses numeric chart data checks so empty charts are suppressed", () => {
    expect(hasValues([{ sales: 0 }], ["sales"])).toBe(false);
    expect(hasValues([{ sales: 1250 }], ["sales"])).toBe(true);
  });

  it("keeps required report labels and removes fake action labels", () => {
    const source = fs.readFileSync(path.join(__dirname, "Reports.jsx"), "utf8");
    expect(source).toContain("Aging (days)");
    expect(source).toContain("Data not available currently.");
    expect(source).toContain("Expiry Risk Breakdown");
    expect(source).not.toContain("Recover / follow up");
    expect(source).not.toContain("Plan payment");
  });
});
