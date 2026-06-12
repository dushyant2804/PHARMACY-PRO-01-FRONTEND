import {
  BILLING_SHORTCUTS,
  getBillingShortcut,
  getNextCartRow,
  getSelectedRowAfterRemoval,
  removeCartRow,
} from "./billingKeyboard";

describe("pharmacy counter keyboard workflow", () => {
  test("registers every billing shortcut", () => {
    expect(BILLING_SHORTCUTS.map(({ keys, action }) => [keys, action])).toEqual(
      [
        ["F1", "newBill"],
        ["F2", "focusMedicineSearch"],
        ["F3", "focusCustomerSearch"],
        ["F4", "focusQuantity"],
        ["F6", "createInvoice"],
        ["Esc", "clearMedicineSearch"],
        ["Ctrl+Delete", "removeSelectedRow"],
      ],
    );
    expect(getBillingShortcut({ key: "F2" })).toBe("focusMedicineSearch");
    expect(getBillingShortcut({ key: "Delete", ctrlKey: true })).toBe(
      "removeSelectedRow",
    );
  });

  test("supports bounded keyboard row navigation", () => {
    expect(getNextCartRow(-1, "down", 3)).toBe(0);
    expect(getNextCartRow(0, "down", 3)).toBe(1);
    expect(getNextCartRow(2, "down", 3)).toBe(2);
    expect(getNextCartRow(2, "up", 3)).toBe(1);
    expect(getNextCartRow(0, "up", 3)).toBe(0);
  });

  test("maps Escape to clearing the current medicine search", () => {
    expect(getBillingShortcut({ key: "Escape" })).toBe("clearMedicineSearch");
  });

  test("deletes the selected cart row and selects the nearest remaining row", () => {
    expect(removeCartRow(["first", "selected", "last"], 1)).toEqual([
      "first",
      "last",
    ]);
    expect(getSelectedRowAfterRemoval(1, 3)).toBe(1);
    expect(getSelectedRowAfterRemoval(2, 3)).toBe(1);
    expect(getSelectedRowAfterRemoval(0, 1)).toBe(-1);
  });
});
