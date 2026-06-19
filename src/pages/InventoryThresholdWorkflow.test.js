const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Inventory popup restores locked low-stock threshold control without status workflow actions", () => {
  const inventory = read("src/pages/Inventory.jsx");

  expect(inventory).toContain("Low Stock Threshold");
  expect(inventory).toContain(
    'data-testid="inventory-low-stock-threshold-section"',
  );
  expect(inventory).toContain("Set Threshold");
  expect(inventory).toContain('data-testid="locked-low-stock-threshold"');
  expect(inventory).toContain('data-testid="threshold-lock-indicator"');
  expect(inventory).toContain("Unlock Threshold");
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
