import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Download,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  CreditCard,
  Receipt,
  Wallet,
  CheckCircle2,
  CalendarDays,
  IndianRupee,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { getDistributorBalanceLabel, ledgerShareMessage, whatsappUrl } from "@/lib/sharing";
import {
  ALL_FINANCIAL_YEARS,
  getDistributorLedgerParams,
  normalizeFinancialYear
} from "@/lib/ledger";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

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

const getCustomerMonthlySummarySource = (payload) =>
  payload?.monthly_summary ||
  payload?.monthly_movement_summary ||
  payload?.customer_monthly_summary ||
  payload?.customer_monthly_movement_summary ||
  payload?.summary?.monthly_summary ||
  payload?.summary?.monthly_movement_summary ||
  [];

const toLedgerNumber = (value) => Number(value || 0);

const getTransactionChoices = (type) => {
  if (type === "distributor") {
    return [
      {
        value: "purchase",
        title: "Purchase",
        description: "Record goods purchased from this distributor",
        icon: ShoppingCart,
        iconWrapper: "bg-red-100 text-red-600",
        selectedBorder: "border-red-500",
        selectedBackground: "bg-red-50",
        accent: "text-red-700",
      },
      {
        value: "payment",
        title: "Payment",
        description: "Record payment made to this distributor",
        icon: CreditCard,
        iconWrapper: "bg-emerald-100 text-emerald-600",
        selectedBorder: "border-emerald-500",
        selectedBackground: "bg-emerald-50",
        accent: "text-emerald-700",
      },
    ];
  }

  return [
    {
      value: "sale",
      title: "Sale / Due",
      description: "Record a credit sale made to this customer",
      icon: Receipt,
      iconWrapper: "bg-blue-100 text-blue-600",
      selectedBorder: "border-blue-500",
      selectedBackground: "bg-blue-50",
      accent: "text-blue-700",
    },
    {
      value: "payment",
      title: "Payment Received",
      description: "Record money received from this customer",
      icon: Wallet,
      iconWrapper: "bg-emerald-100 text-emerald-600",
      selectedBorder: "border-emerald-500",
      selectedBackground: "bg-emerald-50",
      accent: "text-emerald-700",
    },
  ];
};

export const normalizeCustomerMonthlySummary = (payload) => {
  const source = getCustomerMonthlySummarySource(payload);
  const rows = Array.isArray(source)
    ? source
    : source && typeof source === "object"
      ? Object.entries(source).map(([month, value]) => ({ month, ...(value && typeof value === "object" ? value : { net_movement: value }) }))
      : [];

  return rows.map((row) => ({
    month: row.month || row.period || row.label || row.date || "—",
    creditSales: toLedgerNumber(row.credit_sales ?? row.creditSales ?? row.sales ?? row.total_sales ?? row.debit ?? row.debits),
    paymentsReceived: toLedgerNumber(row.payments_received ?? row.paymentsReceived ?? row.payment_received ?? row.payments ?? row.total_payments ?? row.credit ?? row.credits),
    netMovement: toLedgerNumber(row.net_movement ?? row.netMovement ?? row.movement ?? row.net ?? (toLedgerNumber(row.credit_sales ?? row.sales ?? row.total_sales ?? row.debit ?? row.debits) - toLedgerNumber(row.payments_received ?? row.payments ?? row.total_payments ?? row.credit ?? row.credits))),
    closingBalance: toLedgerNumber(row.closing_balance ?? row.closingBalance ?? row.balance ?? row.running_balance ?? row.outstanding_balance),
  }));
};

export const hasCustomerMonthlySummary = (payload) => normalizeCustomerMonthlySummary(payload).length > 0;

export const hasNonZeroCustomerMonthlySummary = (payload) =>
  normalizeCustomerMonthlySummary(payload).some((row) =>
    [row.creditSales, row.paymentsReceived, row.netMovement, row.closingBalance].some((value) => Number(value || 0) !== 0)
  );

export default function Ledger() {
  const { type, id } = useParams(); // type: distributor | customer
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState(type === "distributor" ? "payment" : "sale");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue());
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("all");
  const [selectedFinancialYear, setSelectedFinancialYear] = useState(getCurrentIndianFinancialYear);
  const syncedBackendFinancialYearRef = useRef(false);
  const loadRequestRef = useRef(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
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
    const requestId = ++loadRequestRef.current;
    setData(null);
    setLoadError("");
    setLoading(true);

    const config = type === "distributor"
      ? { params: getDistributorLedgerParams(selectedFinancialYear) }
      : undefined;
    try {
      const response = await api.get(`/ledger/${type}/${id}`, config);
      if (requestId !== loadRequestRef.current) return;

      const nextData = response.data;
      setData(nextData);

      if (type === "distributor" && !syncedBackendFinancialYearRef.current) {
        syncedBackendFinancialYearRef.current = true;
        if (nextData.current_financial_year && nextData.current_financial_year !== selectedFinancialYear) {
          setSelectedFinancialYear(nextData.current_financial_year);
        }
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(formatApiError(error));
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  };
  useEffect(() => {
    loadRequestRef.current += 1;
    setData(null);
    setLoadError("");
    setLoading(true);
    if (type === "distributor") {
      syncedBackendFinancialYearRef.current = false;
      setSelectedFinancialYear(getCurrentIndianFinancialYear());
    }
  }, [type, id]);
  // `load` intentionally follows the current route and selected FY values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [type, id, selectedFinancialYear]);

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

  if (loading) return <div className="text-slate-500">Loading…</div>;
  if (loadError) {
    return (
      <div className="rounded-sm border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
        <div className="font-semibold">Unable to load ledger</div>
        <div className="mt-1 text-sm">{loadError}</div>
        <Button variant="outline" size="sm" className="mt-3 rounded-sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) return <div className="text-slate-500">No ledger data was returned.</div>;
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
    : transactions.filter((transaction) => {
        const query = ledgerSearch.trim().toLowerCase();
        const matchesType = ledgerTypeFilter === "all" || getTransactionKind(transaction) === ledgerTypeFilter;
        const matchesQuery = !query || [getTransactionTypeLabel(transaction), getReferenceNotes(transaction), transaction.invoice_number, transaction.invoice_id, transaction.reference_number, getTransactionMode(transaction)].some((value) => String(value || "").toLowerCase().includes(query));
        return matchesType && matchesQuery;
      });
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
  const customerMonthlySummary = normalizeCustomerMonthlySummary(data);
  const showCustomerMonthlySummary = type === "customer" && hasNonZeroCustomerMonthlySummary(data);

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

const downloadLedger = async () => {
  setExporting(true);
  try {
    const response = await api.get(`/ledger/${type}/${id}/export`, {
      params: type === "distributor" ? getDistributorLedgerParams(selectedFinancialYear) : undefined,
      responseType: "blob"
    });
    const contentType = response.headers["content-type"] || "application/octet-stream";
    const extension = contentType.includes("pdf") ? "pdf" : contentType.includes("csv") ? "csv" : "txt";
    const url = URL.createObjectURL(new Blob([response.data], { type: contentType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-ledger-${entity.name || id}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger downloaded");
  } catch (error) {
    toast.error("Ledger export is not available from the server.");
  } finally {
    setExporting(false);
  }
};

  const editingIsOpeningBalance = type === "distributor" && editingTransaction && isOpeningBalanceTransaction(editingTransaction);
  const editingIsPurchase = editingTransaction && isPurchaseTransaction(editingTransaction);
  const editingDate = editingIsOpeningBalance
    ? editForm.date
    : editingTransaction
      ? String((type === "distributor" ? getLedgerTxnDate(editingTransaction) : getTransactionDate(editingTransaction)) || "").slice(0, 10)
      : "";
  const displayedBalance = Number(data.balance || 0);
  const distributorBalanceLabel = getDistributorBalanceLabel(displayedBalance);
  const ledgerWhatsappUrl = whatsappUrl(entity.phone, ledgerShareMessage({ type, entity, balance: displayedBalance, transactions }));
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
        ? distributorBalanceLabel
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" className="rounded-sm" onClick={downloadLedger} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" />{exporting ? "Exporting…" : "Export"}
          </Button>
          <a href={ledgerWhatsappUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!ledgerWhatsappUrl} title={ledgerWhatsappUrl ? "Share ledger summary on WhatsApp" : "Phone number required"}>
            <Button variant="outline" size="sm" className="rounded-sm" disabled={!ledgerWhatsappUrl}>
              <MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp
            </Button>
          </a>
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
            <Select
              value={normalizeFinancialYear(selectedFinancialYear)}
              onValueChange={(value) => setSelectedFinancialYear(normalizeFinancialYear(value))}
            >
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


      {showCustomerMonthlySummary && (
        <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-4" data-testid="customer-monthly-summary">
          <div>
            <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Monthly summary</div>
            <h2 className="font-heading text-2xl font-bold">Customer movement</h2>
            <p className="text-sm text-slate-500">Credit sales, payments received, and closing balances from the customer ledger API response.</p>
          </div>
          <div className="overflow-x-auto rounded-sm border border-slate-100">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Credit Sales</th>
                  <th className="text-right">Payments Received</th>
                  <th className="text-right">Net Movement</th>
                  <th className="text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody>
                {customerMonthlySummary.map((row) => (
                  <tr key={row.month}>
                    <td className="font-semibold text-slate-800">{row.month}</td>
                    <td className="num-cell font-semibold text-red-600">{fmtINR(row.creditSales)}</td>
                    <td className="num-cell font-semibold text-emerald-600">{fmtINR(row.paymentsReceived)}</td>
                    <td className={`num-cell font-bold ${row.netMovement > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtINR(row.netMovement)}</td>
                    <td className={`num-cell font-bold ${row.closingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>{fmtINR(row.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {(type === "distributor" || type === "customer") && (
        <div className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder={type === "customer" ? "Search invoice, reference, notes, or payment mode" : "Search reference, invoice, notes, or payment mode"} className="rounded-sm pl-9" />
          </div>
          <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
            <SelectTrigger className="w-full rounded-sm sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transaction types</SelectItem>
              {type === "distributor" ? <SelectItem value="purchase">Purchases</SelectItem> : <SelectItem value="sale">Sales</SelectItem>}
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
                    {type === "customer" && (t.invoice_id || t.invoice?.id) && <Link to={`/invoices/${t.invoice_id || t.invoice.id}`} className="mt-1 inline-flex text-xs font-semibold text-blue-600 hover:underline">View invoice {t.invoice_number || t.invoice_reference || "detail"}</Link>}
                    {type === "customer" && !(t.invoice_id || t.invoice?.id) && (t.invoice_number || t.invoice_reference) && <div className="mt-1 text-xs text-slate-500">Invoice: <span className="font-mono font-medium text-slate-700">{t.invoice_number || t.invoice_reference}</span></div>}

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
  <DialogContent
    className="
      w-[calc(100vw-2rem)]
      max-w-2xl
      max-h-[90vh]
      overflow-y-auto
      rounded-xl
      border
      border-slate-200
      bg-white
      p-0
      shadow-2xl
    "
  >
    {/* HEADER */}
    <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-900">
          New Transaction
        </DialogTitle>

        <p className="mt-1 text-sm text-slate-500">
          {type === "customer" ? "Customer" : "Distributor"}:{" "}
          <span className="font-semibold text-slate-700">
            {entity.name}
          </span>
        </p>
      </DialogHeader>
    </div>

    <form onSubmit={submit} className="px-5 py-5 sm:px-6 sm:py-6">

      {/* =========================================================
          TRANSACTION TYPE
          ========================================================= */}
      {(type === "distributor" || type === "customer") && (
        <section>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
            Transaction Type
          </Label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {getTransactionChoices(type).map((choice) => {
              const selected = txnType === choice.value;

              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() =>
                    handleTransactionTypeChange(choice.value)
                  }
                  className={`
                    h-11 rounded-lg border px-3
                    text-sm font-bold uppercase tracking-wide
                    transition-all
                    ${
                      selected
                        ? `${choice.selectedBorder} ${choice.selectedBackground} ${choice.accent} shadow-sm`
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                >
                  {choice.title}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================
          DATE + REFERENCE
          ========================================================= */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">

        {/* DATE */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Date
          </Label>

          <Input
            type="date"
            required
            value={form.date}
            onChange={(e) =>
              setForm({
                ...form,
                date: e.target.value,
              })
            }
            className="
              mt-2
              h-11
              rounded-lg
              border-slate-200
              bg-slate-50
              focus:bg-white
            "
          />
        </div>

        {/* REFERENCE / INVOICE / RECEIPT */}
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {type === "distributor" && txnType === "purchase"
              ? "Invoice No."
              : type === "distributor" && txnType === "payment"
                ? "Receipt No."
                : "Reference No."}
          </Label>

          <Input
            value={
              type === "distributor" && txnType === "purchase"
                ? form.invoice_number || ""
                : type === "distributor" && txnType === "payment"
                  ? form.receipt_number || ""
                  : form.reference_number || ""
            }
            onChange={(e) => {
              const value = e.target.value;

              if (
                type === "distributor" &&
                txnType === "purchase"
              ) {
                setForm({
                  ...form,
                  invoice_number: value,
                  reference_number: value,
                });
              } else if (
                type === "distributor" &&
                txnType === "payment"
              ) {
                setForm({
                  ...form,
                  receipt_number: value,
                  reference_number: value,
                });
              } else {
                setForm({
                  ...form,
                  reference_number: value,
                });
              }
            }}
            placeholder={
              type === "distributor" && txnType === "purchase"
                ? "Invoice / Bill No."
                : type === "distributor" && txnType === "payment"
                  ? "Receipt No."
                  : "Reference No."
            }
            className="
              mt-2
              h-11
              rounded-lg
              border-slate-200
              bg-slate-50
              focus:bg-white
            "
          />
        </div>
      </div>

      {/* =========================================================
          AMOUNT
          ========================================================= */}
      <div className="mt-5">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Amount
        </Label>

        <div className="relative mt-2">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
            ₹
          </span>

          <Input
            type="number"
            step="0.01"
            min="0"
            required
            value={form.amount}
            onChange={(e) =>
              setForm({
                ...form,
                amount: e.target.value,
              })
            }
            placeholder="0.00"
            className="
              h-14
              rounded-lg
              border-slate-200
              bg-slate-50
              pl-10
              text-xl
              font-semibold
              focus:bg-white
            "
          />
        </div>
      </div>

      {/* =========================================================
          PAYMENT MODE
          ========================================================= */}
      <div className="mt-5">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Payment Mode
        </Label>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">

          {(
            type === "distributor" && txnType === "purchase"
              ? [
                  ...newTransactionModeOptions,
                  {
                    value: "credit",
                    label: "Credit",
                  },
                ]
              : type === "customer" && txnType === "sale"
                ? [
                    ...newTransactionModeOptions,
                    {
                      value: "credit",
                      label: "Credit",
                    },
                  ]
                : newTransactionModeOptions
          ).map((option) => {
            const selected = form.mode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    mode: option.value,
                  })
                }
                className={`
                  h-10 rounded-lg border px-3
                  text-sm font-semibold
                  transition-all
                  ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }
                `}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* CREDIT EXPLANATION */}
        {form.mode === "credit" && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {type === "distributor" && txnType === "purchase"
              ? "This purchase will be recorded as payable to the distributor."
              : "This sale will be recorded as due from the customer."}
          </div>
        )}
      </div>

      {/* =========================================================
          NOTE
          ========================================================= */}
      <div className="mt-5">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Note
        </Label>

        <textarea
          value={form.notes || ""}
          onChange={(e) =>
            setForm({
              ...form,
              notes: e.target.value,
            })
          }
          placeholder="Add a note, cheque number, or any useful detail..."
          rows={3}
          className="
            mt-2
            w-full
            resize-none
            rounded-lg
            border
            border-slate-200
            bg-slate-50
            px-3
            py-2.5
            text-sm
            outline-none
            transition
            placeholder:text-slate-400
            focus:border-blue-500
            focus:bg-white
            focus:ring-1
            focus:ring-blue-500
          "
        />
      </div>

      {/* =========================================================
          FOOTER
          ========================================================= */}
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="h-10 rounded-lg px-5"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="
            h-10
            rounded-lg
            bg-blue-600
            px-6
            font-semibold
            text-white
            hover:bg-blue-700
          "
          data-testid="save-txn"
        >
          Save Entry
        </Button>
      </div>

    </form>
  </DialogContent>
</Dialog>
    </div>
  );
}
