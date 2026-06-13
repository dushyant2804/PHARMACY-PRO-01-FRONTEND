import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const ALL_FINANCIAL_YEARS = "all";

const getCurrentIndianFinancialYear = () => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

const getTransactionDate = (transaction) =>
  transaction.date || transaction.transaction_date || transaction.created_at;

const getLedgerTxnDate = (transaction) => {
  const isOpeningBalance =
    String(transaction?.type || "").toLowerCase() === "opening_balance" ||
    Boolean(transaction?.is_opening_balance || transaction?.opening_balance);

  return isOpeningBalance
    ? transaction.opening_balance_date || transaction.date || transaction.transaction_date || transaction.created_at
    : transaction.transaction_date || transaction.date || transaction.opening_balance_date || transaction.created_at;
};

const getTransactionMonth = (transaction) => {
  const date = getTransactionDate(transaction);
  return date ? String(date).slice(0, 7) : "";
};

const getTransactionKind = (transaction) => String(transaction?.type || "").toLowerCase();

const getTransactionMode = (transaction) => transaction?.payment_mode || transaction?.mode;

const getTransactionTypeLabel = (transaction) =>
  transaction?.display_type || transaction?.type || "-";

const getCleanFieldValue = (value) => String(value || "").trim();

const getFirstAvailableValue = (values) =>
  values.map(getCleanFieldValue).find(Boolean) || "-";

const isOpeningBalanceTransaction = (transaction) =>
  getTransactionKind(transaction) === "opening_balance" ||
  Boolean(transaction?.is_opening_balance || transaction?.opening_balance);

const isPurchaseTransaction = (transaction) =>
  isOpeningBalanceTransaction(transaction) || getTransactionKind(transaction).includes("purchase");

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
const getPurchaseOrderId = (transaction) => transaction.purchase_order_id || transaction.po_id;

const isEditableDistributorTransaction = (transaction) => {
  const kind = getTransactionKind(transaction);
  return ["opening_balance", "payment", "purchase", "manual", "manual_payment", "manual_purchase", "adjustment", "payment_adjustment"].includes(kind);
};

const getReferenceNotes = (transaction) =>
  isOpeningBalanceTransaction(transaction) ? "Opening Balance" : (transaction.reference || transaction.notes || "—");

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

const getDistributorTotalBalance = (distributor) => {
  if (!distributor) return null;
  const balance = distributor.current_balance ?? distributor.outstanding_balance;
  return balance === undefined || balance === null ? null : Number(balance || 0);
};


const BILL_STATUS_DISPLAY = {
  cleared: {
    label: "Cleared",
    rowClassName: "",
    badgeClassName: "border-emerald-100 bg-emerald-50 text-emerald-700"
  },
  oldest_due: {
    label: "Oldest Due",
    rowClassName: "bg-red-50/70",
    badgeClassName: "border-red-200 bg-red-100 text-red-700"
  },
  later_due: {
    label: "Due",
    rowClassName: "bg-amber-50/80",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-700"
  }
};

const getBillStatusDisplay = (transaction) => {
  const status = getCleanFieldValue(transaction?.bill_status).toLowerCase();
  return BILL_STATUS_DISPLAY[status] || null;
};

const hasFieldValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const getBillWiseInfo = (transaction) => {
  const fields = [
    { label: "Bill Amount", value: transaction?.bill_amount },
    { label: "Paid", value: transaction?.paid_amount },
    { label: "Due", value: transaction?.due_amount }
  ];

  return fields.filter((field) => hasFieldValue(field.value));
};

const getAdjustedAgainstItems = (transaction) =>
  Array.isArray(transaction?.adjusted_against)
    ? transaction.adjusted_against.filter((item) => item && hasFieldValue(item.amount))
    : [];

export default function Ledger() {
  const { type, id } = useParams(); // type: distributor | customer
  const [data, setData] = useState(null);
  const [distributorTotalBalance, setDistributorTotalBalance] = useState(null);
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState(type === "distributor" ? "payment" : "sale");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("all");
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(getCurrentIndianFinancialYear);
  const syncedBackendFinancialYearRef = useRef(false);
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
    notes: "",
    date: ""
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
    const config = type === "distributor" && selectedFinancialYear !== ALL_FINANCIAL_YEARS
      ? { params: { financial_year: selectedFinancialYear } }
      : undefined;
    const { data } = await api.get(`/ledger/${type}/${id}`, config);
    setData(data);

    if (type === "distributor") {
      const ledgerDistributorBalance = getDistributorTotalBalance(data.distributor);

      if (ledgerDistributorBalance !== null) {
        setDistributorTotalBalance(ledgerDistributorBalance);
      } else {
        try {
          const { data: distributors } = await api.get("/distributors");
          const matchingDistributor = Array.isArray(distributors)
            ? distributors.find((distributor) => String(distributor.id) === String(id))
            : null;
          const listDistributorBalance = getDistributorTotalBalance(matchingDistributor);

          if (listDistributorBalance !== null) {
            setDistributorTotalBalance(listDistributorBalance);
          } else if (selectedFinancialYear === ALL_FINANCIAL_YEARS) {
            setDistributorTotalBalance(Number(data.balance || 0));
          }
        } catch {
          if (selectedFinancialYear === ALL_FINANCIAL_YEARS) {
            setDistributorTotalBalance(Number(data.balance || 0));
          }
        }
      }
    }

    if (type === "distributor" && !syncedBackendFinancialYearRef.current) {
      syncedBackendFinancialYearRef.current = true;
      if (data.current_financial_year && data.current_financial_year !== selectedFinancialYear) {
        setSelectedFinancialYear(data.current_financial_year);
      }
    }
  };
  useEffect(() => {
    setData(null);
    setDistributorTotalBalance(null);
    if (type === "distributor") {
      syncedBackendFinancialYearRef.current = false;
      setSelectedFinancialYear(getCurrentIndianFinancialYear());
    }
  }, [type, id]);
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
  const ledgerTransactions = type === "distributor"
    ? transactions.filter((transaction) => {
        const query = ledgerSearch.trim().toLowerCase();
        const matchesType = ledgerTypeFilter === "all" || getTransactionKind(transaction) === ledgerTypeFilter;
        const matchesQuery = !query || [
          getTransactionTypeLabel(transaction),
          getReferenceNotes(transaction),
          getDistributorDocumentNumber(transaction),
          getTransactionMode(transaction)
        ].some((value) => String(value || "").toLowerCase().includes(query));
        return matchesType && matchesQuery;
      })
    : transactions;
  const newTransactionModeOptions = getNewTransactionModeOptions(type, txnType);
  const currentFinancialYear = data.current_financial_year || getCurrentIndianFinancialYear();
  const financialYearOptions = [
    ...new Set([
      currentFinancialYear,
      ...(data.available_financial_years || []).map(getCleanFieldValue).filter(Boolean)
    ])
  ];
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
    notes: transaction.notes || "",
    date: String(getLedgerTxnDate(transaction) || "").slice(0, 10)
  });
  setEditOpen(true);
};

const handleEditSave = async (e) => {
  e.preventDefault();
  if (!editingTransaction) return;

  setSavingEdit(true);
  try {
    const editingIsOpeningBalance = type === "distributor" && isOpeningBalanceTransaction(editingTransaction);
    const payload = editingIsOpeningBalance
      ? {
          invoice_number: editForm.invoice_number,
          bill_number: editForm.bill_number,
          receipt_number: editForm.receipt_number,
          reference_number: editForm.reference_number,
          notes: editForm.notes
        }
      : isPurchaseTransaction(editingTransaction)
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

const handleDelete = async (transaction) => {
  if (isOpeningBalanceTransaction(transaction)) return;

  try {
    const endpoint =
      type === "distributor"
        ? `/ledger/distributor/${id}/transaction/${transaction.id}`
        : `/ledger/customer/${id}/transaction/${transaction.id}`;

    await api.delete(endpoint);

    toast.success("Transaction deleted");
    load(); // refresh data
  } catch (e) {
    toast.error(formatApiError(e));
  }
};

  const editingIsOpeningBalance = type === "distributor" && editingTransaction && isOpeningBalanceTransaction(editingTransaction);
  const editingIsPurchase = editingTransaction && isPurchaseTransaction(editingTransaction);
  const editingDate = editingIsOpeningBalance
    ? editForm.date
    : editingTransaction
      ? String((type === "distributor" ? getLedgerTxnDate(editingTransaction) : getTransactionDate(editingTransaction)) || "").slice(0, 10)
      : "";
  const displayedBalance = type === "distributor"
    ? distributorTotalBalance ?? getDistributorTotalBalance(entity) ?? (selectedFinancialYear === ALL_FINANCIAL_YEARS ? Number(data.balance || 0) : 0)
    : data.balance;
  const isDistributorSpecificFinancialYear = type === "distributor" && selectedFinancialYear !== ALL_FINANCIAL_YEARS;
  const broughtForwardBalance = Number(data.brought_forward_balance || 0);
  const showBroughtForwardBox = isDistributorSpecificFinancialYear && broughtForwardBalance !== 0;
  const broughtForwardFromFinancialYear = getCleanFieldValue(data.brought_forward_from_financial_year) || "previous FY";
  const isClosedFinancialYear = data.is_financial_year_closed === true;
  const showClosingBalanceBox = isDistributorSpecificFinancialYear && data.is_financial_year_closed !== undefined && data.is_financial_year_closed !== null;
  const closingBalanceTitle = isClosedFinancialYear
    ? `Balance C/F to FY ${getCleanFieldValue(data.carried_forward_to_financial_year) || "next FY"}`
    : "Current Balance Till Date";
  const closingBalanceValue = isClosedFinancialYear
    ? data.carried_forward_balance || 0
    : data.balance_till_date || 0;
  const ledgerSummaryTitle = selectedFinancialYear === ALL_FINANCIAL_YEARS
    ? "All Ledger Summary"
    : `FY ${selectedFinancialYear} Summary`;
  const ledgerSummaryAdjustments = Number(data.total_adjustments || 0);
  const ledgerSummaryItems = [
    {
      label: "Total Purchase",
      value: data.total_purchases || 0,
      valueClassName: "text-red-600"
    },
    {
      label: "Total Payment",
      value: data.total_paid || 0,
      valueClassName: "text-emerald-600"
    },
    ...(ledgerSummaryAdjustments
      ? [{
          label: "Total Adjustments",
          value: ledgerSummaryAdjustments,
          valueClassName: ledgerSummaryAdjustments > 0 ? "text-blue-600" : "text-slate-700"
        }]
      : []),
    {
      label: "Balance for Selected Period",
      value: data.balance || 0,
      valueClassName: Number(data.balance || 0) > 0 ? "text-red-600" : "text-emerald-600"
    }
  ];
  
  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">{type} ledger</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{entity.name}</h1>
          {entity.phone && <div className="text-sm text-slate-500 mt-1">{entity.phone}</div>}
        </div>
        <div className="text-right space-y-2">

  <div>

    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
      Balance
    </div>

    <div
      className={`font-heading text-3xl font-bold font-mono-nums ${
        displayedBalance > 0
          ? "text-red-600"
          : "text-emerald-600"
      }`}
    >
      {fmtINR(displayedBalance)}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Button onClick={() => setOpen(true)} className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-txn">
          <Plus className="w-4 h-4 mr-2" />Add Transaction
        </Button>

        {type === "distributor" && (
          <div className="w-full sm:w-[220px]">
            <Label className="text-xs uppercase font-semibold text-slate-600">
              Financial Year
            </Label>
            <Select value={selectedFinancialYear} onValueChange={setSelectedFinancialYear}>
              <SelectTrigger className="rounded-sm mt-1 bg-white" data-testid="financial-year-filter">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {financialYearOptions.map((financialYear) => (
                  <SelectItem key={financialYear} value={financialYear}>
                    {financialYear === currentFinancialYear ? `${financialYear} (Current FY)` : financialYear}
                  </SelectItem>
                ))}
                <SelectItem value={ALL_FINANCIAL_YEARS}>All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

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
                      <div className="text-xs text-slate-500">{fmtDate(getLedgerTxnDate(transaction))}</div>
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
                        {fmtDate(getLedgerTxnDate(transaction))} • {(getTransactionMode(transaction) || "-").toUpperCase()}
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

      {showBroughtForwardBox && (
        <div className="rounded-sm border border-blue-100 bg-blue-50/60 px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] font-semibold text-blue-700">
                B/F from FY {broughtForwardFromFinancialYear}
              </div>
              <div className="mt-1 text-sm text-slate-600">Opening Balance</div>
            </div>
            <div className={`font-heading text-xl sm:text-2xl font-bold font-mono-nums ${broughtForwardBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {fmtINR(broughtForwardBalance)}
            </div>
          </div>
        </div>
      )}

      {type === "distributor" && (
        <div className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search reference, invoice, notes, or payment mode" className="rounded-sm pl-9" />
          </div>
          <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
            <SelectTrigger className="w-full rounded-sm sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transaction types</SelectItem>
              <SelectItem value="purchase">Purchases</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
              <SelectItem value="opening_balance">Opening balance</SelectItem>
              <SelectItem value="adjustment">Adjustments</SelectItem>
            </SelectContent>
          </Select>
          {/* TODO: Add export/print when a supported distributor-ledger endpoint is available. */}
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
            {ledgerTransactions.map((t) => {
              const isDistributorLedger = type === "distributor";
              const isDistributorPurchase = isDistributorLedger && isPurchaseTransaction(t);
              const billStatusDisplay = isDistributorPurchase ? getBillStatusDisplay(t) : null;
              const billWiseInfo = isDistributorPurchase ? getBillWiseInfo(t) : [];
              const adjustedAgainstItems = isDistributorLedger ? getAdjustedAgainstItems(t) : [];

              return (
                <tr key={t.id} className={billStatusDisplay?.rowClassName || undefined}>
                  <td className="font-mono-nums text-xs">
                    {(() => {
                      const displayDate = type === "distributor" ? getLedgerTxnDate(t) : getTransactionDate(t);
                      return displayDate ? fmtDate(displayDate) : "—";
                    })()}
                  </td>
                  <td className="uppercase text-xs tracking-wider font-semibold">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getTransactionKind(t) === "payment" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : isDistributorPurchase ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{getTransactionTypeLabel(t)}</span>
                      {billStatusDisplay && (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${billStatusDisplay.badgeClassName}`}>
                          {billStatusDisplay.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>{getReferenceNotes(t)}</div>

                    {billWiseInfo.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {billWiseInfo.map((field) => (
                          <div key={field.label}>
                            <span className="font-semibold">{field.label}:</span> {fmtINR(field.value)}
                          </div>
                        ))}
                      </div>
                    )}

                    {adjustedAgainstItems.length > 0 && (
                      <div className="mt-2 text-xs text-slate-600">
                        <div className="font-semibold text-slate-700">Adjusted Against:</div>
                        <div className="mt-1 space-y-0.5">
                          {adjustedAgainstItems.map((item, index) => {
                            const invoiceRef = getFirstAvailableValue([item.invoice_no, item.transaction_id]);

                            return (
                              <div key={`${invoiceRef}-${index}`} className="font-mono-nums">
                                {invoiceRef} {fmtINR(item.amount)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  {type === "distributor" && <td className="text-sm font-medium">{getPurchaseOrderId(t) ? <Link to={`/purchase-orders/${getPurchaseOrderId(t)}`} className="text-blue-600 hover:underline">{getDistributorDocumentNumber(t)}</Link> : getDistributorDocumentNumber(t)}</td>}
                  <td className="text-xs uppercase">{getTransactionMode(t) || "—"}</td>
                  <td className={`num-cell font-semibold ${getTransactionKind(t) === "payment" ? "text-emerald-600" : "text-slate-800"}`}>
                    {getTransactionKind(t) === "payment" ? "−" : Number(t.amount || 0) < 0 ? "" : "+"}{fmtINR(t.amount)}
                  </td>
                  <td className={`num-cell font-bold ${Number(t.running_balance || 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmtINR(t.running_balance)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      {type === "distributor" && isEditableDistributorTransaction(t) && (
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
                      {!isOpeningBalanceTransaction(t) && (
                        <button
                          onClick={() => handleDelete(t)}
                          className="text-red-600 text-xs hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {type === "distributor" && (
        <div className="bg-white border border-slate-200 rounded-sm p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
            <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
              Ledger closing note
            </div>
            <h2 className="font-heading text-2xl font-bold text-slate-900">{ledgerSummaryTitle}</h2>
            <p className="text-sm text-slate-500">
              Totals are from the currently loaded distributor ledger response.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ledgerSummaryItems.map((item) => (
              <div key={item.label} className="rounded-sm border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                  {item.label}
                </div>
                <div className={`mt-2 text-xl sm:text-2xl font-bold font-mono-nums break-words ${item.valueClassName}`}>
                  {fmtINR(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showClosingBalanceBox && (
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
                {isClosedFinancialYear ? "Closing Separator" : "Running Balance"}
              </div>
              <div className="mt-1 font-heading text-lg font-bold text-slate-900">
                {closingBalanceTitle}
              </div>
            </div>
            <div className={`font-heading text-xl sm:text-2xl font-bold font-mono-nums ${Number(closingBalanceValue || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {fmtINR(closingBalanceValue)}
            </div>
          </div>
        </div>
      )}


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle className="font-heading">Edit Transaction Details</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-3">
            <div className="rounded-sm bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              {editingIsOpeningBalance
                ? "Amount, date, and transaction type are locked. Update invoice, bill, receipt, reference, and notes only."
                : editingIsPurchase
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
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
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

            {editingIsOpeningBalance ? (
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
                    Notes
                  </Label>
                  <Input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="rounded-sm mt-1"
                  />
                </div>
              </>
            ) : editingIsPurchase ? (
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
