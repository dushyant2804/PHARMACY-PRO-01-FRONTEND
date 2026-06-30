const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Inventory popup keeps low-stock threshold compact in Medicine Details header", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain('title="Medicine Details"');
  expect(inventory).toContain("headerAction={renderThresholdControl()}");
  expect(inventory).toContain(
    'data-testid="inventory-low-stock-threshold-section"',
  );
  expect(inventory).toContain("Threshold:");
  expect(inventory).toContain('className="h-8 w-20 bg-white px-2 text-sm"');
  expect(inventory).toContain('"set-threshold-button"');
  expect(inventory).toContain('"save-threshold-button"');
  expect(inventory).toContain('data-testid="locked-low-stock-threshold"');
  expect(inventory).toContain('data-testid="threshold-lock-indicator"');
  expect(inventory).toContain('data-testid="unlock-threshold-button"');
  expect(
    inventory.indexOf("headerAction={renderThresholdControl()}"),
  ).toBeLessThan(inventory.indexOf('title="Stock Lot Details"'));
  expect(inventory).not.toContain('title="Low Stock Threshold"');
  expect(inventory).not.toContain('eyebrow="Low stock control"');
});

test("Inventory threshold privacy unlock and relock workflow is preserved", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain('data-testid="threshold-unlock-modal"');
  expect(inventory).toContain('data-testid="privacy-password-input"');
  expect(inventory).toContain("/low-stock-threshold/unlock");
  expect(inventory).toContain("Low stock threshold saved and locked.");
  expect(inventory).not.toContain("LowStockWorkflowControl");
  expect(inventory).not.toContain("Reordered");
  expect(inventory).not.toContain("Abandoned");
  expect(inventory).not.toContain("Restocked");
});

test("Settings exposes admin-only masked Privacy Password update form", () => {
  const settings = read("src/pages/Settings.jsx");

  expect(settings).toContain('user?.role === "admin"');
  expect(settings).toContain("Admin Privacy Password");
  expect(settings).toContain('type="password"');
  expect(settings).toContain("/settings/privacy-password");
  expect(settings).toMatch(/Existing passwords are never\s+displayed/);
});

test("Dashboard low-stock workflow remains limited to Reordered and Abandoned", () => {
  const dashboard = read("src/pages/Dashboard.jsx");
  const workflow = read("src/components/LowStockWorkflowControl.jsx");

  expect(dashboard).toContain("LowStockWorkflowControl");
  expect(workflow).toContain(
    'export const LOW_STOCK_ACTION_STATUSES = ["Reordered", "Abandoned"]',
  );
  expect(workflow).not.toContain("Restocked");
});

test("Inventory table uses backend medicine rows and backend lot counts", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain(
    'api.get("/medicines", { params: { search: debouncedSearch } })',
  );
  expect(inventory).toContain(
    'const nextMeds = Array.isArray(data) ? data : []',
  );
  expect(inventory).toContain('{visibleMeds.map((medicine) => {');
  expect(inventory).toContain(
    '<th className="p-3 text-center">Stock Lots</th>',
  );
  expect(inventory).toContain('{getInventoryLotCount(medicine)}');
  expect(inventory).toMatch(
    /medicine\?\.lot_count[\s\S]*medicine\?\.batch_count/,
  );
  expect(inventory).not.toContain("reduce((");
  expect(inventory).not.toContain("new Map(");
});

test("Inventory details render backend stock lots separately with distributor names", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain("api.get(`/medicines/${medicine.id}`)");
  expect(inventory).toContain("medicine?.stock_lots");
  expect(inventory).toContain("medicine?.lots");
  expect(inventory).toContain("medicine?.batches");
  expect(inventory).toContain("getInventoryLots(selected).map((batch, index) =>");
  expect(inventory).toContain("getDistributorName(batch)");
  expect(inventory).toContain("getBatchNumber(batch)");
  expect(inventory).toContain("value={getAvailableQty(batch)}");
  expect(inventory).toContain("label=\"Distributor\"");
  expect(inventory).toContain("label=\"Purchase rate\"");
  expect(inventory).toContain("label=\"MRP\"");
});

test("Inventory details do not merge same-batch lots on the frontend", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain(
    'lots.filter((lot) => lot && typeof lot === "object")',
  );
  expect(inventory).toContain('batch.lot_id');
  expect(inventory).toContain('batch.distributor_id || getDistributorName(batch)');
  expect(inventory).not.toMatch(/groupBy|mergeLots|mergeBatches|combinedQty|sumByBatch/);
});
