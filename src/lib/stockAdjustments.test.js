import { getAvailableStock, getMedicineBatches, summarizeAdjustments, validateStockAdjustment } from "./stockAdjustments";

describe("stock adjustment helpers", () => {
  test.each([
    ["null batches", { id: 1, batches: null }],
    ["undefined batches", { id: 1 }],
    ["empty batches", { id: 1, batches: [] }],
  ])("returns no batches for %s", (_label, medicine) => {
    expect(getMedicineBatches(medicine)).toEqual([]);
  });

  test("ignores non-array and corrupt batch data", () => {
    expect(getMedicineBatches({ id: 1, batches: { batch_no: "BAD" } })).toEqual([]);
    expect(getMedicineBatches({ id: 1, batches: [null, undefined, "BAD", { batch_no: "GOOD" }] })).toEqual([
      { batch_no: "GOOD" },
    ]);
    expect(getAvailableStock({ available_stock: "corrupt" })).toBe(0);
  });
  test("normalizes available batch stock", () => {
    expect(getAvailableStock({ available_quantity: "12" })).toBe(12);
    expect(getAvailableStock({ available_stock: 4 })).toBe(4);
    expect(getAvailableStock({ available_stock: 0 })).toBe(0);
  });

  test("requires signed, non-zero, whole-number quantities", () => {
    const common = { date: "2026-06-12", medicine: { id: 1 }, batch: { available_stock: 8 }, adjustmentType: "correction" };
    expect(validateStockAdjustment({ ...common, quantity: "" }).quantity).toMatch(/non-zero/);
    expect(validateStockAdjustment({ ...common, quantity: "1.5" }).quantity).toMatch(/whole number/);
    expect(validateStockAdjustment({ ...common, quantity: "+3" })).toEqual({});
  });

  test("prevents a reduction larger than available stock", () => {
    const errors = validateStockAdjustment({
      date: "2026-06-12",
      medicine: { id: 1 },
      batch: { available_stock: 8 },
      adjustmentType: "damaged",
      quantity: "-9",
    });
    expect(errors.quantity).toBe("Cannot reduce more than the available stock (8).");
  });

  test("summarizes signed quantities by adjustment type", () => {
    expect(summarizeAdjustments([
      { adjustment_type: "damaged", quantity: -3 },
      { type: "expired", adjusted_quantity: -2 },
      { reason: "stock_correction", qty: 7 },
    ])).toEqual({ damaged: -3, expired: -2, correction: 7, total: 2 });
  });
});
