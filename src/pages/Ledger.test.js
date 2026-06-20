jest.mock("react-router-dom", () => ({ Link: "a", useParams: () => ({ type: "customer", id: "1" }) }), { virtual: true });

jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`, fmtDate: (value) => value, formatApiError: () => "error" }));

import fs from "fs";
import path from "path";
import { hasCustomerMonthlySummary, hasNonZeroCustomerMonthlySummary, normalizeCustomerMonthlySummary } from "./Ledger";

describe("customer ledger monthly summary", () => {
  it("normalizes monthly_summary rows for customer ledgers", () => {
    expect(normalizeCustomerMonthlySummary({ monthly_summary: [{ month: "2026-06", credit_sales: 1000, payments_received: 400, closing_balance: 600 }] })).toEqual([
      { month: "2026-06", creditSales: 1000, paymentsReceived: 400, netMovement: 600, closingBalance: 600 },
    ]);
  });

  it("normalizes monthly_movement_summary object responses", () => {
    expect(normalizeCustomerMonthlySummary({ monthly_movement_summary: { "2026-05": { sales: 800, payments: 300, balance: 500 } } })).toEqual([
      { month: "2026-05", creditSales: 800, paymentsReceived: 300, netMovement: 500, closingBalance: 500 },
    ]);
  });

  it("shows customer movement only for non-zero monthly summary data", () => {
    expect(hasCustomerMonthlySummary({ transactions: [{ id: 1 }] })).toBe(false);
    expect(hasNonZeroCustomerMonthlySummary({ monthly_summary: [{ month: "2026-06", credit_sales: 0, payments_received: 0, net_movement: 0, closing_balance: 0 }] })).toBe(false);
    expect(hasNonZeroCustomerMonthlySummary({ monthly_summary: [{ month: "2026-06", credit_sales: 1, payments_received: 0, net_movement: 1, closing_balance: 1 }] })).toBe(true);
    const source = fs.readFileSync(path.join(__dirname, "Ledger.jsx"), "utf8");
    expect(source).toContain("showCustomerMonthlySummary &&");
    expect(source).not.toContain("No monthly summary is available for this customer yet.");
    expect(source).toContain("Credit Sales");
    expect(source).toContain("Payments Received");
  });
});
