import {
  calculateDiscountAmount,
  focusMedicineSearch,
  getBarcodeAutoAddMatch,
  getEffectiveDiscountPct,
  getExactBarcodeMatches,
  getFifoBatch,
  getInvoiceDateError,
  getItemTotal,
  getMedicineStock,
  getNearestExpiry,
  getQuickAddQuantity,
  getTodayDateInputValue,
  isDiscountValid,
  isLowStock,
  searchMedicines,
  toInvoiceItem,
  withInvoiceDate,
} from "./billing";

const medicines = [
  { id: 1, name: "Paracetamol 500", barcode: "12345", batch_no: "P-1" },
  { id: 2, name: "Para Plus", barcode: "99999", batch_no: "P-2" },
  { id: 3, name: "Zinc", barcode: "PARA-3", batch_no: "Z-1" },
];

describe("billing helpers", () => {
  test("defaults the invoice date to today's local date", () => {
    const localDate = new Date(2026, 5, 12, 23, 30);

    expect(getTodayDateInputValue(localDate)).toBe("2026-06-12");
  });

  test("adds a selected backdated invoice date to the creation payload", () => {
    expect(withInvoiceDate({ customer_name: "Walk-in" }, "2025-12-31")).toEqual({
      customer_name: "Walk-in",
      invoice_date: "2025-12-31",
    });
  });

  test("rejects future invoice dates while allowing today and past dates", () => {
    expect(getInvoiceDateError("2026-06-13", "2026-06-12")).toBe(
      "Invoice date cannot be in the future",
    );
    expect(getInvoiceDateError("2026-06-12", "2026-06-12")).toBe("");
    expect(getInvoiceDateError("2025-12-31", "2026-06-12")).toBe("");
  });

  test("normalizes available medicine stock and low-stock thresholds", () => {
    const medicine = { available_units: 4, low_stock_threshold: 5 };
    expect(getMedicineStock(medicine)).toBe(4);
    expect(isLowStock(medicine)).toBe(true);
  });

  test("selects the available batch with the nearest expiry for FIFO", () => {
    const medicine = {
      expiry_date: "12/29",
      batches: [
        { batch_no: "late", expiry_date: "10/28", available_stock: 5 },
        { batch_no: "empty", expiry_date: "01/27", available_stock: 0 },
        { batch_no: "first", expiry_date: "06/27", available_stock: 2 },
      ],
    };
    expect(getFifoBatch(medicine).batch_no).toBe("first");
    expect(getNearestExpiry(medicine)).toBe("06/27");
  });

  test("auto-adds only a single exact barcode match", () => {
    expect(getBarcodeAutoAddMatch(medicines, " 12345 ")).toBe(medicines[0]);
    expect(
      getBarcodeAutoAddMatch(
        [...medicines, { id: 4, barcode: "12345" }],
        "12345",
      ),
    ).toBeNull();
    expect(getExactBarcodeMatches(medicines, "missing")).toEqual([]);
  });

  test("prioritizes an exact barcode over an exact medicine name", () => {
    const results = searchMedicines(
      [...medicines, { id: 4, name: "12345", barcode: "name-only" }],
      "12345",
    );

    expect(results.map(({ id }) => id).slice(0, 2)).toEqual([1, 4]);
    expect(searchMedicines(medicines, "para").map(({ id }) => id)).toEqual([
      1, 2, 3,
    ]);
  });

  test("returns focus to medicine search after add", () => {
    const focus = jest.fn();
    const schedule = jest.fn((callback) => callback());

    focusMedicineSearch({ current: { focus } }, schedule);

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  test("preserves the current quantity for barcode quick-add", () => {
    expect(getQuickAddQuantity("4")).toBe(4);
    expect(getQuickAddQuantity(0)).toBe(1);
  });

  test("calculates percentage discounts and the row total", () => {
    const item = {
      mrp: 200,
      quantity: 2,
      unit_type: "unit",
      discount_type: "pct",
      discount_value: 10,
    };
    expect(calculateDiscountAmount(400, "pct", 10)).toBe(40);
    expect(getItemTotal(item)).toBe(360);
  });

  test("calculates fixed amount discounts", () => {
    const item = {
      mrp: 200,
      quantity: 2,
      unit_type: "unit",
      discount_type: "amt",
      discount_value: 75,
    };
    expect(calculateDiscountAmount(400, "amt", 75)).toBe(75);
    expect(getItemTotal(item)).toBe(325);
  });

  test("converts amount discounts to percentage for the invoice payload", () => {
    expect(getEffectiveDiscountPct(400, "amt", 50)).toBe(12.5);
    expect(
      toInvoiceItem({
        medicine_id: 1,
        mrp: 200,
        quantity: 2,
        discount_type: "amt",
        discount_value: 50,
        stock: 8,
        low_stock: false,
      }),
    ).toMatchObject({ medicine_id: 1, discount_pct: 12.5, quantity: 2 });
  });

  test("rejects invalid amount discounts", () => {
    expect(isDiscountValid(100, "amt", 100.01)).toBe(false);
    expect(isDiscountValid(100, "amt", -1)).toBe(false);
    expect(isDiscountValid(100, "amt", 100)).toBe(true);
    expect(isDiscountValid(100, "pct", 100.01)).toBe(false);
  });
});
