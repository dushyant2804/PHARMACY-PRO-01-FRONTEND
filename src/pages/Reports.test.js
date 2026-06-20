jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}` }));

import fs from "fs";
import path from "path";
import { buildExpiryRiskCards, displayPurchaseReturnStatus, formatAgingDays, hasValues, normalizeMedicineRows, normalizePurchaseReturnAnalytics, normalizeRecovery } from "./Reports";

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


  it("normalizes outstanding movement only from distributor outstanding movement", () => {
    expect(normalizeRecovery({ distributor_outstanding_movement: [{ month: "Jan", distributor_outstanding: 40 }] })).toEqual([
      { period: "Jan", distributorOutstanding: 40 },
    ]);
    expect(normalizeRecovery({ distributor_outstanding_movement: [{ period: "Feb", balance: 55 }] })).toEqual([
      { period: "Feb", distributorOutstanding: 55 },
    ]);
  });

  it("ignores customer and mixed outstanding movement sources", () => {
    expect(normalizeRecovery({ monthly_outstanding_trend: [{ month: "Jan", customer_outstanding: 100, distributor_outstanding: 40 }] })).toEqual([]);
    expect(normalizeRecovery({ outstanding_movement_chart: [{ label: "Mar", customer_receivables: 200, distributor_payables: 75 }] })).toEqual([]);
    expect(normalizeRecovery({ customer_monthly_summary: [{ month: "Apr", customer_receivables: 10 }] })).toEqual([]);
  });

  it("keeps valid distributor outstanding movement visible and empty movement data hidden", () => {
    const rows = normalizeRecovery({ distributor_outstanding_movement: [{ label: "Apr", distributor_payables: 10 }] });
    expect(hasValues(rows, ["distributorOutstanding"])).toBe(true);
    expect(hasValues(normalizeRecovery({ distributor_outstanding_movement: [] }), ["distributorOutstanding"])).toBe(false);
    expect(hasValues(normalizeRecovery({ distributor_outstanding_movement: [{ month: "May", distributor_payables: 0 }] }), ["distributorOutstanding"])).toBe(false);
  });

  it("normalizes purchase return analytics from medicine report paths", () => {
    expect(normalizePurchaseReturnAnalytics({ medicine_wise_return_analytics: [{ medicine_name: "A", total_return_value: 500, total_returned_quantity: 5 }] })).toEqual([
      expect.objectContaining({ name: "A", returnedQty: 5, value: 500, status: "Credit Pending" }),
    ]);
    expect(normalizePurchaseReturnAnalytics({ returns_by_medicine: [{ medicine: "B", total_return_amount: 750, total_return_quantity: 3 }] })).toEqual([
      expect.objectContaining({ name: "B", returnedQty: 3, value: 750, status: "Credit Pending" }),
    ]);
    expect(normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "C", total_amount: 250, qty: 2, status: "Adjusted" }] })).toEqual([
      expect.objectContaining({ name: "C", returnedQty: 2, value: 250, status: "Ledger Adjusted" }),
    ]);
    expect(normalizePurchaseReturnAnalytics({ data: { by_medicine: { D: { total_return_value: 125, qty: 1 } } } })).toEqual([
      expect.objectContaining({ name: "D", returnedQty: 1, value: 125, status: "Credit Pending" }),
    ]);
  });

  it("keeps valid purchase return values visible and empty return values hidden", () => {
    const rows = normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "D", total_return_value: 100, total_quantity: 1 }] });
    expect(hasValues(rows, ["value"])).toBe(true);
    expect(hasValues(normalizePurchaseReturnAnalytics({ medicine_breakdown: [] }), ["value"])).toBe(false);
    expect(hasValues(normalizePurchaseReturnAnalytics({ medicine_breakdown: [{ name: "E", total_return_value: 0, total_quantity: 0 }] }), ["value"])).toBe(false);
  });


  it("displays friendly purchase return status labels and excludes deleted or voided rows", () => {
    expect(displayPurchaseReturnStatus("recorded")).toBe("Credit Pending");
    expect(displayPurchaseReturnStatus("settled")).toBe("Adjusted in Purchase");
    expect(displayPurchaseReturnStatus("ledger_adjusted")).toBe("Ledger Adjusted");
    expect(normalizePurchaseReturnAnalytics({ medicine_breakdown: [
      { name: "Active", total_return_value: 100, total_quantity: 1, status: "recorded" },
      { name: "Deleted", total_return_value: 100, total_quantity: 1, status: "deleted" },
      { name: "Voided", total_return_value: 100, total_quantity: 1, status: "voided" },
    ] })).toEqual([expect.objectContaining({ name: "Active", returnedQty: 1, value: 100, status: "Credit Pending" })]);
  });

  it("keeps only the purchase return analytics table friendly in the UI source", () => {
    const source = fs.readFileSync(path.join(__dirname, "Reports.jsx"), "utf8");
    expect(source).toContain("Return Value");
    expect(source).toContain("Credit Pending");
    expect(source).toContain("Adjusted in Purchase");
    expect(source).toContain("Distributor");
    expect(source).toContain("Return Date");
    expect(source).toContain("No purchase returns recorded yet.");
    expect(source).not.toContain("Purchase Return Value");
    expect(source).not.toContain("Purchase Return Status");
    expect(source).not.toContain("returnStatusRows");
    expect(source).not.toContain("labelFormatter");
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
