import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const getTransactionDate = (transaction) =>
  transaction.date || transaction.transaction_date || transaction.created_at;

const getTransactionMonth = (transaction) => {
  const date = getTransactionDate(transaction);
  return date ? String(date).slice(0, 7) : "";
};

const getTransactionKind = (transaction) => String(transaction?.type || "").toLowerCase();

const getTransactionDisplayKind = (transaction) =>
  String(transaction?.display_type || transaction?.type || "").toLowerCase();

const getDueStatus = (transaction) => String(transaction?.due_status || "").toLowerCase();

const getTransactionMode = (transaction) => transaction?.payment_mode || transaction?.mode;

const getTransactionTypeLabel = (transaction) =>
  transaction?.display_type || transaction?.type || "-";

const getCleanFieldValue = (value) => String(value || "").trim();

const getFirstAvailableValue = (values) =>
  values.map(getCleanFieldValue).find(Boolean) || "-";

const isOpeningBalanceTransaction = (transaction) =>
  getTransactionKind(transaction) === "opening_balance" ||
  Boolean(transaction?.is_opening_balance || transaction?.opening_balance);

const isBroughtForwardTransaction = (transaction) =>
  getTransactionKind(transaction) === "brought_forward" ||
  getTransactionDisplayKind(transaction) === "brought_forward" ||
  getDueStatus(transaction) === "brought_forward";

const isPurchaseTransaction = (transaction) =>
  isOpeningBalanceTransaction(transaction) || getTransactionKind(transaction).includes("purchase");

const hasBillWiseAmounts = (transaction) =>
  [transaction?.bill_amount, transaction?.paid_amount, transaction?.due_amount].some(
    (value) => value !== undefined && value !== null
  );

const getDistributorDocumentNumber = (transaction) => {
  if (isPurchaseTransaction(transaction)) {
    return getFirstAvailableValue([
      transaction.invoice_number,
      transaction.bill_number,
      transaction.reference_number
    ]);
  }

  return getFirstAvailableValue([transaction.receipt_number, transaction.reference_number]);
};

const isEditableDistributorTransaction = (transaction) => {
  if (isBroughtForwardTransaction(transaction)) return false;

  const kind = getTransactionKind(transaction);
  return ["opening_balance", "payment", "purchase", "manual", "manual_payment", "manual_purchase", "adjustment", "payment_adjustment"].includes(kind);
};

const getReferenceNotes = (transaction) => {
  if (isOpeningBalanceTransaction(transaction)) return "Opening Balance";
  if (isBroughtForwardTransaction(transaction)) {
    return transaction.description || transaction.reference || transaction.notes || "B/F from previous FY";
  }

  return transaction.reference || transaction.notes || "—";
};

const dueStatusStyles = {
  cleared: {
    label: "Cleared",
    row: "",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    amount: "text-slate-800"
  },
  oldest_due: {
    label: "Oldest Due",
    row: "bg-red-50 text-red-900",
    badge: "bg-red-100 text-red-700 border-red-200",
    amount: "text-red-700"
  },
  later_due: {
    label: "Due",
    row: "bg-amber-50 text-amber-900",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    amount: "text-amber-700"
  },
  payment: {
    label: "Payment",
    row: "bg-emerald-50 text-emerald-900",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    amount: "text-emerald-700"
  },
  brought_forward: {
    label: "B/F",
    row: "bg-blue-50 text-blue-900",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    amount: "text-blue-700"
  }
};

const getTransactionDueStatus = (transaction) => {
  if (isBroughtForwardTransaction(transaction)) return "brought_forward";

  const dueStatus = getDueStatus(transaction);
  if (dueStatus) return dueStatus;

  if (getTransactionKind(transaction) === "payment") return "payment";

  return "";
};

const getDueStatusStyle = (transaction) =>
  dueStatusStyles[getTransactionDueStatus(transaction)] || null;

const formatFinancialYearLabel = (financialYear) =>
  financialYear === "all" ? "All" : `FY ${financialYear}`;

const getNewTransactionModeOptions = (type, txnType) => {
  if (type === "distributor" && txnType === "purchase") {
    return [
      { value: "cash", label: "Cash" },
      { value: "upi", label: "UPI" },
      { value: "credit", label: "Credit" }
    ];
  }

  return [
    { value: "cash", label: "Cash" },
    { value: "upi", label: "UPI" },
    { value: "card", label: "Card" },
    { value: "bank", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" }
  ];
};


export default function Ledger() {
  const { type, id } = useParams(); // type: distributor | customer
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState(type === "distributor" ? "payment" : "sale");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [selectedFinancialYear, setSelectedFinancialYear] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    receipt_number: "",
    reference_number: "",
    invoice_number: "",
    bill_number: "",
    payment_mode: "cash",
    mode: "cash",
    notes: ""
  });
  const [form, setForm] = useState({
    amount: "",
    mode: "cash",
    notes: "",
    date: "",
    receipt_number: "",
    reference_number: "",
    invoice_number: ""
  });

  const load = async () => {
    const config =
      type === "distributor" && selectedFinancialYear !== "all"
        ? { params: { financial_year: selectedFinancialYear } }
        : undefined;
    const { data } = await api.get(`/ledger/${type}/${id}`, config);
    setData(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, id, selectedFinancialYear]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = type === "distributor"
        ? `/ledger/distributor/${id}/${txnType}`
        : `/ledger/customer/${id}/${txnType}`;
      const payload = {
       amount: Number(form.amount),
       mode: form.mode,
       notes: form.notes,
       date: form.date
     };

      if (type === "distributor" && txnType === "payment") {
        payload.receipt_number = form.receipt_number;
      }
      if (type === "distributor" && txnType === "purchase") {
        payload.invoice_number = form.invoice_number;
        payload.reference_number = form.invoice_number || form.reference_number;
      }

      await api.post(endpoint, payload);
      toast.success("Entry added");
      setOpen(false);
      setForm({ amount: "", mode: "cash", notes: "", date: "", receipt_number: "", reference_number: "", invoice_number: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!data) return <div className="text-slate-500">Loading…</div>;
  const entity = type === "distributor" ? data.distributor : data.customer;
  const transactions = data.transactions || [];
  const ledgerTransactions = transactions;
  const availableFinancialYears = type === "distributor"
    ? Array.from(new Set(data.available_financial_years || []))
    : [];
  const selectedFinancialYearLabel = formatFinancialYearLabel(data.financial_year || selectedFinancialYear);
  const newTransactionModeOptions = getNewTransactionModeOptions(type, txnType);
  const monthlyTransactions = transactions.filter(
    (transaction) => getTransactionMonth(transaction) === selectedMonth
  );
  const monthlyPurchases = monthlyTransactions.filter(
    (transaction) => getTransactionKind(transaction) === "purchase"
  );
  const monthlyPayments = monthlyTransactions.filter(
    (transaction) => getTransactionKind(transaction) === "payment"
  );
  const monthlyPurchaseTotal = monthlyPurchases.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );
  const monthlyPaymentTotal = monthlyPayments.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );
  const monthlyNetMovement = monthlyPurchaseTotal - monthlyPaymentTotal;

  const handleTransactionTypeChange = (value) => {
    setTxnType(value);
    const nextModeOptions = getNewTransactionModeOptions(type, value);
    if (!nextModeOptions.some((option) => option.value === form.mode)) {
      setForm({ ...form, mode: nextModeOptions[0]?.value || "cash" });
    }
  };

const openEditDialog = (transaction) => {
  setEditingTransaction(transaction);
  const paymentMode = getTransactionMode(transaction) || "cash";

  setEditForm({
    receipt_number: transaction.receipt_number || "",
    invoice_number: transaction.invoice_number || "",
    bill_number: transaction.bill_number || "",
    reference_number: transaction.reference_number || "",
    payment_mode: paymentMode,
    mode: paymentMode,
    notes: transaction.notes || ""
  });
  setEditOpen(true);
};

const handleEditSave = async (e) => {
  e.preventDefault();
  if (!editingTransaction) return;

  setSavingEdit(true);
  try {
    const payload = isPurchaseTransaction(editingTransaction)
      ? {
          invoice_number: editForm.invoice_number,
          bill_number: editForm.bill_number,
          reference_number: editForm.reference_number,
          notes: editForm.notes
        }
      : {
          receipt_number: editForm.receipt_number,
          reference_number: editForm.reference_number,
          payment_mode: editForm.payment_mode || editForm.mode,
          notes: editForm.notes
        };

    await api.patch(`/distributor-transactions/${editingTransaction.id}`, payload);
    toast.success("Transaction updated");
    setEditOpen(false);
    setEditingTransaction(null);
    await load();
  } catch (e) {
    toast.error(formatApiError(e));
  } finally {
    setSavingEdit(false);
  }
};

const handleDelete = async (txnId) => {
  try {
    const endpoint =
      type === "distributor"
        ? `/ledger/distributor/${id}/transaction/${txnId}`
        : `/ledger/customer/${id}/transaction/${txnId}`;

    await api.delete(endpoint);

    toast.success("Transaction deleted");
    load(); // refresh data
  } catch (e) {
    toast.error(formatApiError(e));
  }
};

  const editingIsPurchase = editingTransaction && isPurchaseTransaction(editingTransaction);
  const editingDate = editingTransaction ? String(getTransactionDate(editingTransaction) || "").slice(0, 10) : "";
  
  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">{type} ledger</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{entity.name}</h1>
          {entity.phone && <div className="text-sm text-slate-500 mt-1">{entity.phone}</div>}
        </div>
        <div className="md:text-right space-y-2">

  <div>

    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
      Balance
    </div>

    <div
      className={`font-heading text-3xl font-bold font-mono-nums ${
        data.balance > 0
          ? "text-red-600"
          : "text-emerald-600"
      }`}
    >
      {fmtINR(data.balance)}
    </div>

    <div className="text-xs text-slate-500">
      {type === "distributor"
        ? "Payable"
        : "Receivable"}
    </div>
 
    {type === "distributor" && (
  <div className="mt-3 space-y-1 text-sm">

    <div className="flex justify-between gap-6">
      <span className="text-slate-500">
        Total Purchases
      </span>

      <span className="font-semibold text-red-600">
        {fmtINR(data.total_purchases || 0)}
      </span>
    </div>

    <div className="flex justify-between gap-6">
      <span className="text-slate-500">
        Total Paid
      </span>

      <span className="font-semibold text-emerald-600">
        {fmtINR(data.total_paid || 0)}
      </span>
    </div>

  </div>
)}

  </div>
      </div>
      </div>

      <Button onClick={() => setOpen(true)} className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-txn">
        <Plus className="w-4 h-4 mr-2" />Add Transaction
      </Button>

      {type === "distributor" && (
        <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
                Financial year ledger
              </div>
              <h2 className="font-heading text-2xl font-bold">{selectedFinancialYearLabel}</h2>
              {data.financial_year_start && data.financial_year_end && (
                <p className="text-sm text-slate-500">
                  {fmtDate(data.financial_year_start)} to {fmtDate(data.financial_year_end)}
                </p>
              )}
            </div>

            <div className="w-full lg:w-[240px]">
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Financial Year
              </Label>
              <Select value={selectedFinancialYear} onValueChange={setSelectedFinancialYear}>
                <SelectTrigger className="rounded-sm mt-1">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {availableFinancialYears.map((financialYear) => (
                    <SelectItem key={financialYear} value={financialYear}>
                      {formatFinancialYearLabel(financialYear)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-600 font-semibold">
                Opening Balance
              </div>
              <div className="mt-1 text-xl font-bold text-slate-800 font-mono-nums break-words">
                {fmtINR(data.opening_balance || 0)}
              </div>
            </div>

            <div className="rounded-sm border border-blue-100 bg-blue-50 p-4">
              <div className="text-xs uppercase tracking-wider text-blue-700 font-semibold">
                Brought Forward
              </div>
              <div className="mt-1 text-xl font-bold text-blue-700 font-mono-nums break-words">
                {fmtINR(data.brought_forward_balance || 0)}
              </div>
            </div>

            <div className="rounded-sm border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-slate-600 font-semibold">
                Closing Balance
              </div>
              <div className={`mt-1 text-xl font-bold font-mono-nums break-words ${
                Number(data.closing_balance ?? data.balance ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
              }`}>
                {fmtINR(data.closing_balance ?? data.balance ?? 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {type === "distributor" && (
        <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
                Monthly summary
              </div>
              <h2 className="font-heading text-2xl font-bold">Distributor movement</h2>
              <p className="text-sm text-slate-500">
                Purchases and payments for the selected month
              </p>
            </div>
            <div className="w-full md:w-[220px]">
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Month
              </Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-sm mt-1"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-sm border border-red-100 bg-red-50 p-4">
              <div className="text-xs uppercase tracking-wider text-red-700 font-semibold">
                Total purchases
              </div>
              <div className="mt-1 text-2xl font-bold text-red-600 font-mono-nums">
                {fmtINR(monthlyPurchaseTotal)}
              </div>
            </div>

            <div className="rounded-sm border border-emerald-100 bg-emerald-50 p-4">
              <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
                Total payments
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-600 font-mono-nums">
                {fmtINR(monthlyPaymentTotal)}
              </div>
            </div>

            <div className="rounded-sm border border-blue-100 bg-blue-50 p-4">
              <div className="text-xs uppercase tracking-wider text-blue-700 font-semibold">
                Net movement
              </div>
              <div className={`mt-1 text-2xl font-bold font-mono-nums ${
                monthlyNetMovement > 0 ? "text-red-600" : "text-emerald-600"
              }`}>
                {fmtINR(monthlyNetMovement)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Purchases minus payments
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border rounded-sm overflow-hidden">
              <div className="bg-red-50 text-red-700 text-xs uppercase tracking-wider font-semibold p-3">
                Purchase
              </div>
              <div className="divide-y max-h-[260px] overflow-auto">
                {monthlyPurchases.length ? monthlyPurchases.map((transaction) => (
                  <div key={transaction.id} className="p-3 flex justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{transaction.reference || transaction.notes || "Purchase"}</div>
                      <div className="text-xs text-slate-500">{fmtDate(getTransactionDate(transaction))}</div>
                    </div>
                    <div className="font-semibold text-red-600 font-mono-nums">
                      +{fmtINR(transaction.amount)}
                    </div>
                  </div>
                )) : (
                  <div className="p-3 text-sm text-slate-500">No purchases this month.</div>
                )}
              </div>
            </div>

            <div className="border rounded-sm overflow-hidden">
              <div className="bg-emerald-50 text-emerald-700 text-xs uppercase tracking-wider font-semibold p-3">
                Payment
              </div>
              <div className="divide-y max-h-[260px] overflow-auto">
                {monthlyPayments.length ? monthlyPayments.map((transaction) => (
                  <div key={transaction.id} className="p-3 flex justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{transaction.reference || transaction.notes || "Payment"}</div>
                      <div className="text-xs text-slate-500">
                        {fmtDate(getTransactionDate(transaction))} • {(getTransactionMode(transaction) || "-").toUpperCase()}
                      </div>
                    </div>
                    <div className="font-semibold text-emerald-600 font-mono-nums">
                      −{fmtINR(transaction.amount)}
                    </div>
                  </div>
                )) : (
                  <div className="p-3 text-sm text-slate-500">No payments this month.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
             <th>Date</th>
             <th>Type</th>
             <th>Reference / Notes</th>
             {type === "distributor" && <th>Receipt / Invoice No.</th>}
             <th>Mode</th>
             <th className="text-right">Amount</th>
             <th className="text-right">Running Balance</th>
             <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ledgerTransactions.length === 0 && <tr><td colSpan={type === "distributor" ? 8 : 7} className="text-center py-8 text-slate-500">No transactions yet.</td></tr>}
            {ledgerTransactions.map((t, index) => {
              const dueStyle = type === "distributor" ? getDueStatusStyle(t) : null;
              const amountClass = dueStyle?.amount || (getTransactionKind(t) === "payment" ? "text-emerald-600" : "text-slate-800");
              const canEdit = type === "distributor" && isEditableDistributorTransaction(t);
              const canDelete = !isOpeningBalanceTransaction(t) && !isBroughtForwardTransaction(t);

              return (
                <tr key={t.id || `${getTransactionKind(t)}-${index}`} className={dueStyle?.row || ""}>
                  <td className="font-mono-nums text-xs whitespace-normal">{getTransactionDate(t) ? fmtDate(getTransactionDate(t)) : "—"}</td>
                  <td className="space-y-1">
                    <div className="uppercase text-xs tracking-wider font-semibold">{getTransactionTypeLabel(t)}</div>
                    {dueStyle && (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${dueStyle.badge}`}>
                        {dueStyle.label}
                      </span>
                    )}
                  </td>
                  <td className="min-w-[160px] whitespace-normal">{getReferenceNotes(t)}</td>
                  {type === "distributor" && <td className="text-sm font-medium whitespace-normal">{getDistributorDocumentNumber(t)}</td>}
                  <td className="text-xs uppercase whitespace-normal">{getTransactionMode(t) || "—"}</td>
                  <td className={`num-cell font-semibold align-top ${amountClass}`}>
                    <div>{getTransactionKind(t) === "payment" ? "−" : Number(t.amount || 0) < 0 ? "" : "+"}{fmtINR(t.amount)}</div>
                    {type === "distributor" && isPurchaseTransaction(t) && hasBillWiseAmounts(t) && (
                      <div className="mt-2 inline-grid gap-1 rounded-sm bg-white/70 p-2 text-left text-[0.7rem] font-medium text-slate-600 shadow-sm sm:min-w-[150px]">
                        {t.bill_amount !== undefined && t.bill_amount !== null && (
                          <div className="flex justify-between gap-2">
                            <span>Bill Amount</span>
                            <span className="font-mono-nums text-slate-800">{fmtINR(t.bill_amount)}</span>
                          </div>
                        )}
                        {t.paid_amount !== undefined && t.paid_amount !== null && (
                          <div className="flex justify-between gap-2">
                            <span>Paid</span>
                            <span className="font-mono-nums text-emerald-700">{fmtINR(t.paid_amount)}</span>
                          </div>
                        )}
                        {t.due_amount !== undefined && t.due_amount !== null && (
                          <div className="flex justify-between gap-2">
                            <span>Due</span>
                            <span className="font-mono-nums text-red-700">{fmtINR(t.due_amount)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="num-cell align-top">{fmtINR(t.running_balance)}</td>
                  <td className="align-top">
                    <div className="flex flex-wrap items-center gap-3">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditDialog(t)}
                          className="inline-flex items-center gap-1 text-blue-600 text-xs hover:underline"
                          aria-label={`Edit transaction ${t.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-600 text-xs hover:underline"
                        >
                          Delete
                        </button>
                      )}
                      {!canEdit && !canDelete && <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle className="font-heading">Edit Transaction Details</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-3">
            <div className="rounded-sm bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              {editingIsPurchase
                ? "Amount, date, and transaction type are locked. Update invoice, bill, reference, and notes only."
                : "Amount, date, and transaction type are locked. Update receipt, reference, payment mode, and notes only."}
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Transaction Type
              </Label>
              <Input
                value={editingTransaction ? getTransactionTypeLabel(editingTransaction) : ""}
                disabled
                className="rounded-sm mt-1 bg-slate-100"
              />
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Transaction Date
              </Label>
              <Input
                type="date"
                value={editingDate}
                disabled
                className="rounded-sm mt-1 bg-slate-100"
              />
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Amount
              </Label>
              <Input
                value={editingTransaction ? fmtINR(editingTransaction.amount) : ""}
                disabled
                className="rounded-sm mt-1 bg-slate-100"
              />
            </div>

            {editingIsPurchase ? (
              <>
                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Invoice Number
                  </Label>
                  <Input
                    value={editForm.invoice_number}
                    onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Bill Number
                  </Label>
                  <Input
                    value={editForm.bill_number}
                    onChange={(e) => setEditForm({ ...editForm, bill_number: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Reference Number
                  </Label>
                  <Input
                    value={editForm.reference_number}
                    onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Notes
                  </Label>
                  <Input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Receipt Number
                  </Label>
                  <Input
                    value={editForm.receipt_number}
                    onChange={(e) => setEditForm({ ...editForm, receipt_number: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Reference Number
                  </Label>
                  <Input
                    value={editForm.reference_number}
                    onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Payment Mode
                  </Label>
                  <Select
                    value={editForm.payment_mode || editForm.mode}
                    onValueChange={(v) => setEditForm({ ...editForm, payment_mode: v, mode: v })}
                  >
                    <SelectTrigger className="rounded-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Notes
                  </Label>
                  <Input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
                Cancel
              </Button>

              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle className="font-heading">New Transaction</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {(type === "distributor" || type === "customer") && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">
                  Transaction Type
                </Label>

                <Select value={txnType} onValueChange={handleTransactionTypeChange}>
                  <SelectTrigger className="rounded-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {type === "distributor" ? (
                      <>
                        <SelectItem value="purchase">Purchase (+)</SelectItem>
                        <SelectItem value="payment">
                          Payment to supplier (−)
                        </SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="sale">Sale / Due (+)</SelectItem>
                        <SelectItem value="payment">
                          Payment Received (−)
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Date
              </Label>

              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-sm mt-1"
              />
            </div>

            {type === "distributor" && txnType === "payment" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">
                  Receipt Number
                </Label>

                <Input
                  value={form.receipt_number}
                  onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
            )}

            {type === "distributor" && txnType === "purchase" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">
                  Invoice / Bill Number
                </Label>

                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm({ ...form, invoice_number: e.target.value, reference_number: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Amount
              </Label>

              <Input
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="rounded-sm mt-1"
              />
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Mode
              </Label>

              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger className="rounded-sm mt-1">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {newTransactionModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Notes / Reference
              </Label>

              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-sm mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="save-txn">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
