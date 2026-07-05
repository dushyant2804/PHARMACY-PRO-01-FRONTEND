import { getInventoryLots } from "./Inventory";

describe("Inventory details lot rendering contract", () => {
  it("can display multiple distributors and multiple batches for one medicine without collapsing them", () => {
    const lots = getInventoryLots({
      name: "Amoxicillin",
      stock_lots: [
        {
          distributor_id: "dist-a",
          distributor_name: "Health Distributors",
          batches: [
            { lot_id: "lot-a1", batch_no: "A-001", available_stock: 5 },
            { lot_id: "lot-a2", batch_no: "A-002", available_stock: 7 },
          ],
        },
        {
          distributor_id: "dist-b",
          distributor_name: "Care Supply",
          batches: [
            { lot_id: "lot-b1", batch_no: "B-001", available_stock: 3 },
            { lot_id: "lot-b2", batch_no: "B-002", available_stock: 4 },
          ],
        },
      ],
    });

    expect(lots).toHaveLength(4);
    expect(lots.map((lot) => `${lot.distributor_name}:${lot.batch_no}`)).toEqual([
      "Health Distributors:A-001",
      "Health Distributors:A-002",
      "Care Supply:B-001",
      "Care Supply:B-002",
    ]);
  });
});
