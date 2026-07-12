import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, CircleDollarSign, RefreshCw, ReceiptText, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const today = () => new Date().toISOString().slice(0, 10);
const emptyTotals = { cash_amount: "", upi_amount: "", pending_amount: "", notes: "" };
const emptyExpense = { category: "", amount: "", notes: "" };
const number = (value) => Number(value || 0);

export default function DailySales() {
  const navigate = useNavigate();
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalsForm, setTotalsForm] = useState(emptyTotals);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [totalsSaving, setTotalsSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);

  const load = async (selectedDate = date) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, expensesResponse] = await Promise.all([
        api.get("/daily-sales/summary", { params: { date: selectedDate } }).catch(() => ({ data: {} })),
        api.get("/expenses", { params: { date: selectedDate } }).catch(() => ({ data: [] })),
      ]);
      setSummary(summaryResponse.data || {});
      setExpenses(Array.isArray(expensesResponse.data) ? expensesResponse.data : []);
    } catch (e) {
      setError("Failed to load the daily register");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(date); }, [date]);

  const totals = useMemo(() => {
    const outstanding = number(summary.pending ?? summary.outstanding ?? summary.credit_sales);
    const gross = number(summary.total ?? summary.gross_sales);
    const collected = number(summary.paid ?? summary.collected ?? (gross - outstanding));
    const expenseTotal = expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
    return { gross, collected, outstanding, expenseTotal, net: gross - expenseTotal };
  }, [summary, expenses]);

  const submitTotals = async (event) => {
    event.preventDefault();
    const cash = number(totalsForm.cash_amount);
    const upi = number(totalsForm.upi_amount);
    const pending = number(totalsForm.pending_amount);
    if (cash + upi + pending <= 0) return toast.error("Enter at least one sales total");
    setTotalsSaving(true);
    try {
      await api.post("/daily-sales", { date, cash_amount: cash, upi_amount: upi, pending_amount: pending, notes: totalsForm.notes });
      toast.success("Daily totals saved");
      setTotalsForm(emptyTotals);
      await load(date);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setTotalsSaving(false); }
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    if (!expenseForm.category.trim()) return toast.error("Expense category required");
    if (number(expenseForm.amount) <= 0) return toast.error("Expense amount required");
    setExpenseSaving(true);
    try {
      await api.post("/expenses", { date, category: expenseForm.category, amount: number(expenseForm.amount), notes: expenseForm.notes });
      toast.success("Expense added");
      setExpenseForm(emptyExpense);
      load(date);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setExpenseSaving(false); }
  };

  const cards = [
    ["Gross Sales", totals.gross, "text-slate-900"],
    ["Paid / Collected", totals.collected, "text-emerald-600"],
    ["Outstanding", totals.outstanding, "text-amber-600"],
    ["Expenses", totals.expenseTotal, "text-red-600"],
    ["Estimated Net Profit", totals.net, totals.net < 0 ? "text-red-600" : "text-blue-700"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="daily-sales-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="rounded-sm"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Button>
          <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Business register</p><h1 className="flex items-center gap-2 font-heading text-2xl font-bold md:text-3xl"><BookOpen className="h-6 w-6 text-blue-600" />Daily Sales</h1></div>
        </div>
        <div className="w-full sm:w-48"><Label className="text-xs font-semibold uppercase text-slate-500">Register date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded-sm" data-testid="ds-date" /></div>
      </header>

      <div className="rounded-sm border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <strong>Summary register only.</strong> Daily Sales records summarized business totals only and does not change inventory. Use Billing for actual medicine sales and Stock Adjustments for stock correction.
      </div>

      <section aria-label="Daily sales summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(([label, value, color]) => <div key={label} className="kpi-card rounded-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 font-heading text-xl font-bold font-mono-nums sm:text-2xl ${color}`}>{fmtINR(value)}</p></div>)}
      </section>

      {error && <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 text-emerald-600" /><div><h2 className="font-heading font-semibold">Daily business totals</h2><p className="text-sm text-slate-500">Save summarized totals for the selected date. Past-date entries are historical records and never affect inventory.</p></div></div>
        <form onSubmit={submitTotals} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['cash_amount', 'Cash Sales'], ['upi_amount', 'UPI Sales'], ['pending_amount', 'Outstanding / Credit Sales']].map(([field, label]) => <div key={field}><Label className="text-xs font-semibold uppercase text-slate-600">{label} ₹</Label><Input type="number" min="0" step="0.01" value={totalsForm[field]} onChange={(e) => setTotalsForm({ ...totalsForm, [field]: e.target.value })} className="mt-1 rounded-sm" /></div>)}
          <div><Label className="text-xs font-semibold uppercase text-slate-600">Notes</Label><Input value={totalsForm.notes} onChange={(e) => setTotalsForm({ ...totalsForm, notes: e.target.value })} placeholder="Optional register note" className="mt-1 rounded-sm" /></div>
          <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={totalsSaving} className="w-full rounded-sm bg-slate-800 hover:bg-slate-900 sm:w-auto"><WalletCards className="mr-2 h-4 w-4" />Save summarized totals</Button></div>
        </form>
      </section>

      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3"><div className="flex gap-3"><ReceiptText className="mt-0.5 h-5 w-5 text-red-600" /><div><h2 className="font-heading font-semibold">Expenses</h2><p className="text-sm text-slate-500">Track operating expenses for the selected date.</p></div></div><Button variant="ghost" size="sm" onClick={() => load(date)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></div>
        <form onSubmit={submitExpense} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label className="text-xs font-semibold uppercase text-slate-600">Category</Label><Input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} placeholder="Rent, delivery, utilities…" className="mt-1 rounded-sm" /></div>
          <div><Label className="text-xs font-semibold uppercase text-slate-600">Amount ₹</Label><Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="mt-1 rounded-sm" /></div>
          <div><Label className="text-xs font-semibold uppercase text-slate-600">Notes</Label><Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Optional details" className="mt-1 rounded-sm" /></div>
          <div className="flex items-end"><Button type="submit" disabled={expenseSaving} className="w-full rounded-sm bg-red-600 hover:bg-red-700">Add expense</Button></div>
        </form>
        <div className="mt-5 border-t border-slate-100 pt-4">
          {loading ? <p className="text-sm text-slate-500">Loading expenses…</p> : expenses.length === 0 ? <p className="text-sm text-slate-500">No expenses recorded for this date.</p> : <div className="space-y-2">{expenses.map((expense, index) => <div key={expense.id || index} className="flex items-start justify-between gap-4 rounded-sm bg-slate-50 px-3 py-2 text-sm"><div><p className="font-medium text-slate-800">{expense.category}</p>{expense.notes && <p className="text-xs text-slate-500">{expense.notes}</p>}</div><p className="font-semibold font-mono-nums text-red-600">{fmtINR(expense.amount)}</p></div>)}</div>}
        </div>
      </section>
    </div>
  );
}
