jest.mock("@/lib/api", () => ({ __esModule: true, default: { get: jest.fn() }, fmtINR: (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`, fmtDate: (value) => value, formatApiError: () => "error" }));

import fs from "fs";
import path from "path";
import { hasCustomerMonthlySummary, normalizeCustomerMonthlySummary } from "./Ledger";

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

  it("detects missing summary for fallback empty state", () => {
    expect(hasCustomerMonthlySummary({ transactions: [{ id: 1 }] })).toBe(false);
    const source = fs.readFileSync(path.join(__dirname, "Ledger.jsx"), "utf8");
    expect(source).toContain("Transactions are available, but the ledger response did not include monthly_summary or monthly_movement_summary data.");
    expect(source).toContain("Credit Sales");
    expect(source).toContain("Payments Received");
  });
});
