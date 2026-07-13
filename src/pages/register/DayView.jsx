import React, { useEffect, useState } from "react";
import RegisterHeader from "./components/RegisterHeader";
import StatusBadge from "./components/StatusBadge";
import ExpenseTable from "./components/ExpenseTable";
import NotesPanel from "./components/NotesPanel";
import UnlockDialog from "./UnlockDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/api";
import {
  getDayDetail,
  saveDayEntry,
  saveExpense,
  addNote,
  getMonthLabel,
  resolveMonthStatus,
  formatRegisterError,
} from "@/lib/register";

const emptySales = { cash_sales: "", upi_sales: "", card_sales: "", credit_sales: "" };

export default function DayView({ financialYear, monthKey, date, monthStatus, onBack, onBackToMonths, onBackToDashboard }) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptySales);
  const [saving, setSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const status = resolveMonthStatus(monthKey, monthStatus);
  const editable = status === "open" || status === "unlocked";
  const monthLabel = getMonthLabel(monthKey);

  const load = () => {
    setLoading(true);
    setError(null);
    return getDayDetail(financialYear, monthKey, date)
      .then((data) => {
        setDay(data);
        setForm({
          cash_sales: data.cashSales ?? "",
          upi_sales: data.upiSales ?? "",
          card_sales: data.cardSales ?? "",
          credit_sales: data.creditSales ?? "",
        });
      })
      .catch((err) => setError(formatRegisterError(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [financialYear, monthKey, date]);

  const submitSales = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveDayEntry(financialYear, monthKey, date, {
        cash_sales: Number(form.cash_sales || 0),
        upi_sales: Number(form.upi_sales || 0),
        card_sales: Number(form.card_sales || 0),
        credit_sales: Number(form.credit_sales || 0),
      });
      toast.success("Day entry saved");
      load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (expense) => {
    setExpenseSaving(true);
    try {
      await saveExpense(financialYear, monthKey, date, expense);
      toast.success("Expense added");
      load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleAddNote = async (text) => {
    setNoteSaving(true);
    try {
      await addNote(financialYear, monthKey, { entryDate: date, text });
      toast.success("Note added");
      load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="register-day-page">
      <RegisterHeader
        crumbs={[
          { label: `FY ${financialYear}`, onClick: onBackToMonths },
          { label: monthLabel, onClick: onBack },
          { label: fmtDate(date) },
        ]}
        onBackToDashboard={onBackToDashboard}
        actions={<StatusBadge status={status} />}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!editable && (
        <div className="flex flex-col gap-3 rounded-sm border border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Lock className="h-4 w-4" />
            <span className="font-semibold">This register is closed.</span>
          </div>
          <Button size="sm" variant="outline" className="rounded-sm" onClick={() => setUnlockOpen(true)} data-testid="register-unlock-btn">
            Unlock
          </Button>
        </div>
      )}

      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 font-heading font-semibold text-slate-800">Sales</h2>
        <form onSubmit={submitSales} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["cash_sales", "Cash Sales"],
            ["upi_sales", "UPI Sales"],
            ["card_sales", "Card Sales"],
            ["credit_sales", "Credit Sales"],
          ].map(([field, fieldLabel]) => (
            <div key={field}>
              <Label className="text-xs font-semibold uppercase text-slate-600">{fieldLabel} ₹</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!editable}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="mt-1 rounded-sm"
              />
            </div>
          ))}
          {editable && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={saving} className="w-full rounded-sm bg-slate-800 hover:bg-slate-900 sm:w-auto">
                <Save className="mr-2 h-4 w-4" />Save day entry
              </Button>
            </div>
          )}
        </form>
      </section>

      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 font-heading font-semibold text-slate-800">Expenses</h2>
        <ExpenseTable expenses={day?.expenses || []} editable={editable} onAdd={handleAddExpense} saving={expenseSaving} />
      </section>

      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 font-heading font-semibold text-slate-800">Notes</h2>
        <NotesPanel notes={day?.notes || []} editable={editable} onAdd={handleAddNote} saving={noteSaving} />
      </section>

      {loading && <p className="text-center text-sm text-slate-400">Loading day entry…</p>}

      <UnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        financialYear={financialYear}
        monthKey={monthKey}
        monthLabel={monthLabel}
        onUnlocked={load}
      />
    </div>
  );
}
