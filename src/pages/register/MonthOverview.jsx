import React, { useEffect, useState } from "react";
import RegisterHeader from "./components/RegisterHeader";
import SummaryCards from "./components/SummaryCards";
import DayCard from "./components/DayCard";
import StatusBadge from "./components/StatusBadge";
import NotesPanel from "./components/NotesPanel";
import UnlockDialog from "./UnlockDialog";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getMonthRegister,
  getDaysInMonth,
  formatDayLabel,
  getMonthLabel,
  resolveMonthStatus,
  addNote,
  updateNote,
  deleteNote,
  formatRegisterError,
} from "@/lib/register";

export default function MonthOverview({ financialYear, monthKey, onOpenDay, onBack, onBackToDashboard }) {
  const [monthRegister, setMonthRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    return getMonthRegister(financialYear, monthKey)
      .then(setMonthRegister)
      .catch((err) => setError(formatRegisterError(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [financialYear, monthKey]);

  const label = monthRegister?.label || getMonthLabel(monthKey);
  const status = resolveMonthStatus(monthKey, monthRegister?.status);
  const editable = status === "open" || status === "unlocked";
  const summary = monthRegister?.summary || {};
  const daysByDate = new Map((monthRegister?.days || []).map((d) => [d.date, d]));
  const dayDates = getDaysInMonth(monthKey);

  const handleAddNote = async (text) => {
    setNoteSaving(true);
    try {
      await addNote(financialYear, monthKey, { entryDate: null, text });
      toast.success("Note added");
      load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setNoteSaving(false);
    }
  };

  const handleEditNote = async (noteId, text) => {
  setNoteSaving(true);

  try {
    await updateNote(
      financialYear,
      monthKey,
      noteId,
      text
    );

    toast.success("Note updated");
    load();
  } catch (err) {
    toast.error(formatRegisterError(err));
  } finally {
    setNoteSaving(false);
  }
};

const handleDeleteNote = async (noteId) => {
  setNoteSaving(true);

  try {
    await deleteNote(
      financialYear,
      monthKey,
      noteId
    );

    toast.success("Note deleted");
    load();
  } catch (err) {
    toast.error(formatRegisterError(err));
  } finally {
    setNoteSaving(false);
  }
};

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="register-month-page">
      <RegisterHeader
        crumbs={[
          { label: `FY ${financialYear}`, onClick: onBack },
          { label },
        ]}
        onBackToDashboard={onBackToDashboard}
        actions={<StatusBadge status={status} />}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error} Day entries below reflect calendar structure only.</p>
        </div>
      )}

      {status === "closed" && (
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

      <SummaryCards
        items={[
          { label: "Gross Sales", value: summary.grossSales },
          { label: "Total Cash", value: summary.cashSales },
          { label: "Total UPI", value: summary.upiSales },
          { label: "Total Card", value: summary.cardSales },
          { label: "Total Credit", value: summary.creditSales, tone: "text-amber-600" },
          { label: "Total Expenses", value: summary.totalExpenses, tone: "text-red-600" },
          { label: "Net Collection", value: summary.netProfit, tone: "text-blue-700" },
          { label: "Average Daily Sales", value: summary.averageDailySales },
          { label: "Working Days", value: summary.workingDays, format: "number" },
          { label: "Highest Sales Day", value: summary.highestSalesDay?.amount },
          { label: "Highest Expense Day", value: summary.highestExpenseDay?.amount, tone: "text-red-600" },
        ]}
      />

      <section aria-label="Days in this month">
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-800">Days</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {dayDates.map((date) => (
            <DayCard
              key={date}
              dayNumber={formatDayLabel(date)}
              day={daysByDate.get(date)}
              onClick={() => onOpenDay(date, status)}
            />
          ))}
        </div>
      </section>

      <section aria-label="Month notes" className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold text-slate-800">Month notes</h2>
        <NotesPanel notes={monthRegister?.notes || []} editable={editable} onAdd={handleAddNote} saving={noteSaving} />
      </section>

      {loading && <p className="text-center text-sm text-slate-400">Loading month register…</p>}

      <UnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        financialYear={financialYear}
        monthKey={monthKey}
        monthLabel={label}
        onUnlocked={load}
      />
    </div>
  );
}
