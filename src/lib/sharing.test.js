import { getDistributorBalanceLabel, invoiceShareMessage, ledgerShareMessage, patientShareMessage, whatsappUrl } from "./sharing";

jest.mock("./api", () => ({
  fmtDate: (value) => String(value || "—"),
  fmtINR: (value) => `₹${Number(value || 0)}`
}));

test("invoice share message excludes internal accounting fields", () => {
  const message = invoiceShareMessage({ invoice_no: "INV-1", total: 120, purchase_cost: 50, profit: 70, margin: 58 });
  expect(message).toContain("INV-1");
  expect(message.toLowerCase()).not.toMatch(/purchase cost|profit|margin/);
});

test("WhatsApp URL requires a phone and only prepares a message", () => {
  expect(whatsappUrl("", "Hello")).toBe("");
  expect(whatsappUrl("+91 98765 43210", "Hello")).toContain("https://wa.me/919876543210?text=Hello");
});

test("patient and ledger messages are polite summaries", () => {
  expect(patientShareMessage({ name: "Asha", medicine_name: "Medicine A" })).toMatch(/friendly reminder/i);
  expect(ledgerShareMessage({ type: "customer", entity: { name: "Asha" }, balance: 50 })).toMatch(/polite reminder/i);
  expect(ledgerShareMessage({ type: "distributor", entity: { name: "Supplier" }, balance: 50 })).toMatch(/payable/i);
});

test("distributor balance labels distinguish payable, receivable, and settled balances", () => {
  expect(getDistributorBalanceLabel(500)).toBe("Payable");
  expect(getDistributorBalanceLabel(0)).toBe("Settled");
  expect(getDistributorBalanceLabel(-500)).toBe("Receivable");
});

test("distributor ledger WhatsApp messages label payable, receivable, and settled balances", () => {
  expect(ledgerShareMessage({ type: "distributor", entity: { name: "Supplier" }, balance: 500 })).toContain("Current Payable Balance: ₹500");
  expect(ledgerShareMessage({ type: "distributor", entity: { name: "Supplier" }, balance: 0 })).toContain("Current Settled Balance: ₹0");
  expect(ledgerShareMessage({ type: "distributor", entity: { name: "Supplier" }, balance: -500 })).toContain("Current Receivable Balance: ₹-500");
});
