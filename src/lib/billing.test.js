import { getFifoBatch, getMedicineStock, getNearestExpiry, isLowStock, searchMedicines } from "./billing";

const medicines = [
  { id: 1, name: "Paracetamol 500", barcode: "12345", batch_no: "P-1" },
  { id: 2, name: "Para Plus", barcode: "99999", batch_no: "P-2" },
  { id: 3, name: "Zinc", barcode: "PARA-3", batch_no: "Z-1" },
];

describe("billing helpers", () => {
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

  test("ranks exact barcode and name-prefix matches first", () => {
    expect(searchMedicines(medicines, "12345")[0].id).toBe(1);
    expect(searchMedicines(medicines, "para").map(({ id }) => id)).toEqual([1, 2, 3]);
  });
});
