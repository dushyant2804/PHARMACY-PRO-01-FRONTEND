const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("purchase returns cleanup and behavior", () => {
  const purchaseReturns = () => read("src/pages/PurchaseReturns.jsx");

  test("shows edit actions for ledger-adjusted and non-ledger-adjusted active returns", () => {
    const source = purchaseReturns();
    expect(source).toContain('if (["edit", "delete"].includes(action)) return !isVoided(item);');
    expect(source).toContain('actionAllowed(item, "edit")');
    expect(source).toContain('>Edit</Button>');
  });

  test("shows the ledger-adjusted edit warning", () => {
    expect(purchaseReturns()).toContain(
      "This return has a distributor ledger impact. Editing it will update the linked ledger transaction."
    );
  });

  test("replaces Void Return UI with Delete behavior and confirmation copy", () => {
    const source = purchaseReturns();
    expect(source).toContain(">Delete</Button>");
    expect(source).toContain("Delete Purchase Return");
    expect(source).toContain(
      "Deleting this purchase return will reverse its stock impact. If it was ledger-adjusted, the linked distributor ledger entry will also be removed or reversed. Continue?"
    );
    expect(source).not.toContain("Void Return");
    expect(source).not.toContain("voidReturn");
  });

  test("uses DELETE purchase-return API and refreshes after delete", () => {
    const source = purchaseReturns();
    expect(source).toContain("api.delete(`/purchase-returns/${item.id}`)");
    expect(source).toContain("await loadAll(page, appliedFilters);");
  });

  test("removes Temporary Sold Units Repair route, link, and component", () => {
    expect(read("src/App.js")).not.toContain("stale-sold-units");
    expect(read("src/pages/Settings.jsx")).not.toContain("Temporary Sold Units Repair");
    expect(fs.existsSync(path.join(root, "src/pages/StaleSoldUnitsRepair.jsx"))).toBe(false);
  });
});
