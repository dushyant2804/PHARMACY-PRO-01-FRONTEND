import {
  getDistributorDocumentNumber,
  getLedgerTxnDate,
  getReferenceNotes,
  getTransactionTypeLabel,
  isOpeningBalanceTransaction,
  isPurchaseTransaction
} from "./ledgerUtils";

const openingBalanceFixture = {
  id: 1,
  type: "payment",
  transaction_type: "opening_balance",
  display_type: "Payment",
  reference: "Adjusted Against INV-1",
  notes: "Cash",
  receipt_number: "R-001",
  payment_mode: "upi",
  transaction_date: "2026-04-02",
  date: "2026-04-03",
  opening_balance_date: "2026-04-01",
  amount: 500,
  running_balance: 500
};

const paymentFixture = {
  id: 2,
  type: "payment",
  notes: "Supplier payment",
  receipt_number: "R-002",
  payment_mode: "cash",
  date: "2026-04-05",
  amount: 200
};

const purchaseFixture = {
  id: 3,
  type: "purchase",
  reference_number: "INV-002",
  date: "2026-04-06",
  amount: 700
};

describe("distributor ledger opening balance display helpers", () => {
  it("identifies opening balance rows without treating them as payment or purchase display rows", () => {
    expect(isOpeningBalanceTransaction(openingBalanceFixture)).toBe(true);
    expect(getTransactionTypeLabel(openingBalanceFixture)).toBe("Opening Balance");
    expect(getReferenceNotes(openingBalanceFixture)).toBe("Opening Balance");
    expect(getDistributorDocumentNumber(openingBalanceFixture)).toBe("—");
    expect(isPurchaseTransaction(openingBalanceFixture)).toBe(false);
  });

  it("preserves normal payment and purchase classification for monthly summaries", () => {
    const ledger = [openingBalanceFixture, paymentFixture, purchaseFixture];
    const monthlyRows = ledger.filter((transaction) => !isOpeningBalanceTransaction(transaction) && String(transaction.date || transaction.transaction_date || transaction.created_at || "").slice(0, 7) === "2026-04");

    expect(monthlyRows.filter((transaction) => transaction.type === "payment")).toEqual([paymentFixture]);
    expect(monthlyRows.filter((transaction) => transaction.type === "purchase")).toEqual([purchaseFixture]);
  });

  it("uses transaction date priority before opening balance date", () => {
    expect(getLedgerTxnDate(openingBalanceFixture)).toBe("2026-04-02");
  });
});
