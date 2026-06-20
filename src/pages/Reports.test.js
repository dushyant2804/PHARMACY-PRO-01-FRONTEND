jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}` }));

import fs from "fs";
import path from "path";
import { buildExpiryRiskCards, formatAgingDays, hasValues, normalizeMedicineRows } from "./Reports";

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
