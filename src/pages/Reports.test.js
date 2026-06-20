jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}` }));

import { buildExpiryRiskCards, normalizeMedicineRows } from "./Reports";

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
});
