jest.mock("./api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

import api from "./api";
import {
  calculateClosing,
  createDailyClosing,
  getDailyClosing,
  getMismatchStatus,
  listDailyClosings,
  normalizeClosing,
  updateDailyClosing,
} from "./dailyClosing";

beforeEach(() => jest.clearAllMocks());

test("calculates expected totals and cash mismatch", () => {
  expect(calculateClosing({ cash_sales: 1000, upi_sales: 500, card_sales: 250, credit_sales: 100, expenses: 200, counted_cash: 775 }))
    .toEqual({ grossSales: 1850, openingCash: 0, collectedAmount: 1750, outstanding: 100, expectedCash: 800, expectedTotal: 1650, mismatch: -25 });
});

test.each([[0, "balanced"], [-10, "shortage"], [10, "excess"]])("maps %s to the %s badge", (mismatch, status) => {
  expect(getMismatchStatus(mismatch)).toBe(status);
});

test("normalizes backend calculations, imported totals, and lock fields", () => {
  expect(normalizeClosing({ id: "c1", date: "2026-06-12", cash_sales: 100, expenses: 20, counted_cash: 80, collected_amount: 125, outstanding_amount: 15, expected_cash: 90, expected_total: 140, is_locked: true }))
    .toMatchObject({ id: "c1", closing_date: "2026-06-12", expectedTotal: 140, expectedCash: 90, collectedAmount: 125, outstanding: 15, mismatch: 0, locked: true, lock_day: true });
});

test("lists and loads daily closings through the authenticated API client", async () => {
  api.get.mockResolvedValueOnce({ data: { items: [{ id: "c1", closing_date: "2026-06-12" }] } });
  api.get.mockResolvedValueOnce({ data: { id: "c1", closing_date: "2026-06-12" } });

  await expect(listDailyClosings()).resolves.toHaveLength(1);
  await expect(getDailyClosing("2026-06-12")).resolves.toMatchObject({ id: "c1" });
  expect(api.get).toHaveBeenNthCalledWith(1, "/daily-closings");
  expect(api.get).toHaveBeenNthCalledWith(2, "/daily-closings/2026-06-12");
});

test("creates and updates closings with numeric payloads", async () => {
  api.post.mockResolvedValue({ data: { id: "c1", closing_date: "2026-06-12" } });
  api.put.mockResolvedValue({ data: { id: "c1", closing_date: "2026-06-12" } });
  const form = { closing_date: "2026-06-12", cash_sales: "100.50", counted_cash: "100.50", lock_day: true };

  await createDailyClosing(form);
  await updateDailyClosing("c1", form);

  expect(api.post).toHaveBeenCalledWith("/daily-closings", expect.objectContaining({ cash_sales: 100.5, lock_day: true }));
  expect(api.put).toHaveBeenCalledWith("/daily-closings/c1", expect.objectContaining({ counted_cash: 100.5 }));
});
