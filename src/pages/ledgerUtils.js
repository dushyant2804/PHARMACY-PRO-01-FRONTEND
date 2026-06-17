export const getLedgerTxnDate = (transaction) =>
  transaction?.transaction_date || transaction?.date || transaction?.opening_balance_date || transaction?.created_at;

export const getTransactionKind = (transaction) => String(transaction?.type || "").toLowerCase();

const getCleanFieldValue = (value) => String(value || "").trim();
const getFirstAvailableValue = (values) => values.map(getCleanFieldValue).find(Boolean) || "-";

export const isOpeningBalanceTransaction = (transaction) => {
  const type = String(transaction?.type || "").toLowerCase();
  const transactionType = String(transaction?.transaction_type || "").toLowerCase();
  const displayType = String(transaction?.display_type || "").trim().toLowerCase();
  const reference = String(transaction?.reference || transaction?.reference_number || "").toLowerCase();
  const note = String(transaction?.note || transaction?.notes || "").toLowerCase();

  return type === "opening_balance" ||
    transactionType === "opening_balance" ||
    displayType === "opening balance" ||
    Boolean(transaction?.is_opening_balance || transaction?.opening_balance) ||
    reference.includes("opening balance") ||
    note.includes("opening balance");
};

export const getTransactionTypeLabel = (transaction) =>
  isOpeningBalanceTransaction(transaction) ? "Opening Balance" : (transaction?.display_type || transaction?.type || "-");

export const isPurchaseTransaction = (transaction) =>
  !isOpeningBalanceTransaction(transaction) && getTransactionKind(transaction).includes("purchase");

export const getDistributorDocumentNumber = (transaction) => {
  if (isOpeningBalanceTransaction(transaction)) return "—";

  if (isPurchaseTransaction(transaction)) {
    return getFirstAvailableValue([
      transaction.invoice_number,
      transaction.bill_number,
      transaction.reference_number
    ]);
  }

  return getFirstAvailableValue([transaction.receipt_number, transaction.reference_number]);
};

export const getReferenceNotes = (transaction) =>
  isOpeningBalanceTransaction(transaction) ? "Opening Balance" : (transaction.reference || transaction.notes || "—");
