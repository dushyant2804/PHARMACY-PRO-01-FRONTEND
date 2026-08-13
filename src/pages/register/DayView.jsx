import React, { useEffect, useState } from "react";
import RegisterHeader from "./components/RegisterHeader";
import StatusBadge from "./components/StatusBadge";
import ExpenseTable from "./components/ExpenseTable";
import NotesPanel from "./components/NotesPanel";
import UnlockDialog from "./UnlockDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Lock,
  AlertTriangle,
  Save,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/api";
import {
  getDayDetail,
  saveDayEntry,
  deleteDayEntry,
  saveExpense,
  addNote,
  updateNote,
  deleteNote,
  getMonthLabel,
  resolveMonthStatus,
  formatRegisterError,
} from "@/lib/register";

const emptySales = {
  cash_sales: "",
  upi_sales: "",
  card_sales: "",
  credit_sales: "",
};

export default function DayView({
  financialYear,
  monthKey,
  date,
  monthStatus,
  onBack,
  onBackToMonths,
  onBackToDashboard,
}) {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(emptySales);

  const [saving, setSaving] = useState(false);
  const [deletingSales, setDeletingSales] = useState(false);

  const [editingSales, setEditingSales] = useState(false);

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
  useEffect(() => {
    load();
  }, [financialYear, monthKey, date]);

  const hasSalesEntry =
    day &&
    (
      day.cashSales != null ||
      day.upiSales != null ||
      day.cardSales != null ||
      day.creditSales != null ||
      day.grossSales != null
    );

  const startSalesEdit = () => {
    if (!editable) return;

    setForm({
      cash_sales: day?.cashSales ?? "",
      upi_sales: day?.upiSales ?? "",
      card_sales: day?.cardSales ?? "",
      credit_sales: day?.creditSales ?? "",
    });

    setEditingSales(true);
  };

  const cancelSalesEdit = () => {
    setForm({
      cash_sales: day?.cashSales ?? "",
      upi_sales: day?.upiSales ?? "",
      card_sales: day?.cardSales ?? "",
      credit_sales: day?.creditSales ?? "",
    });

    setEditingSales(false);
  };

  const submitSales = async (event) => {
    event.preventDefault();

    if (!editable) return;

    setSaving(true);

    try {
      await saveDayEntry(financialYear, monthKey, date, {
        cash_sales: Number(form.cash_sales || 0),
        upi_sales: Number(form.upi_sales || 0),
        card_sales: Number(form.card_sales || 0),
        credit_sales: Number(form.credit_sales || 0),
      });

      toast.success("Day entry saved");
      setEditingSales(false);
      await load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSales = async () => {
    if (!editable || deletingSales) return;

    const confirmed = window.confirm(
      `Delete the sales entry for ${fmtDate(date)}?\n\nThis will remove the entire sales entry for this day.`
    );

    if (!confirmed) return;

    setDeletingSales(true);

    try {
      await deleteDayEntry(financialYear, monthKey, date);

      toast.success("Day sales entry deleted");

      setEditingSales(false);

      await load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setDeletingSales(false);
    }
  };

  const handleAddExpense = async (expense) => {
    setExpenseSaving(true);

    try {
      await saveExpense(financialYear, monthKey, date, expense);

      toast.success("Expense added");

      await load();
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleAddNote = async (text) => {
    setNoteSaving(true);

    try {
      await addNote(financialYear, monthKey, {
        entryDate: date,
        text,
      });

      toast.success("Note added");

      await load();
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
    <div
      className="mx-auto max-w-4xl space-y-5"
      data-testid="register-day-page"
    >
      <RegisterHeader
        crumbs={[
          {
            label: `FY ${financialYear}`,
            onClick: onBackToMonths,
          },
          {
            label: monthLabel,
            onClick: onBack,
          },
          {
            label: fmtDate(date),
          },
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
            <span className="font-semibold">
              This register is closed.
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="rounded-sm"
            onClick={() => setUnlockOpen(true)}
            data-testid="register-unlock-btn"
          >
            Unlock
          </Button>
        </div>
      )}

      {/* SALES */}
      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-heading font-semibold text-slate-800">
            Sales
          </h2>

          {hasSalesEntry && editable && !editingSales && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-sm"
                onClick={startSalesEdit}
                disabled={deletingSales}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-sm text-red-600 hover:text-red-700"
                onClick={handleDeleteSales}
                disabled={deletingSales}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deletingSales ? "Deleting…" : "Delete"}
              </Button>
            </div>
          )}
        </div>

        <form
          onSubmit={submitSales}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            ["cash_sales", "Cash Sales"],
            ["upi_sales", "UPI Sales"],
            ["card_sales", "Card Sales"],
            ["credit_sales", "Credit Sales"],
          ].map(([field, fieldLabel]) => (
            <div key={field}>
              <Label className="text-xs font-semibold uppercase text-slate-600">
                {fieldLabel} ₹
              </Label>

              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!editable || (!editingSales && hasSalesEntry)}
                value={form[field]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [field]: e.target.value,
                  })
                }
                className="mt-1 rounded-sm"
              />
            </div>
          ))}

          {editable && (!hasSalesEntry || editingSales) && (
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button
                type="submit"
                disabled={saving}
                className="rounded-sm bg-slate-800 hover:bg-slate-900"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save day entry"}
              </Button>

              {editingSales && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-sm"
                  onClick={cancelSalesEdit}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </form>
      </section>

      {/* EXPENSES */}
      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 font-heading font-semibold text-slate-800">
          Expenses
        </h2>

        <ExpenseTable
          expenses={day?.expenses || []}
          editable={editable}
          onAdd={handleAddExpense}
          saving={expenseSaving}
          financialYear={financialYear}
          monthKey={monthKey}
          date={date}
          onChanged={load}
        />
      </section>

      {/* NOTES */}
      <section className="rounded-sm border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 font-heading font-semibold text-slate-800">
          Notes
        </h2>

        <NotesPanel
          notes={day?.notes || []}
          editable={editable}
          onAdd={handleAddNote}
          saving={noteSaving}
          financialYear={financialYear}
          monthKey={monthKey}
          onChanged={load}
        />
      </section>

      {loading && (
        <p className="text-center text-sm text-slate-400">
          Loading day entry…
        </p>
      )}

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
