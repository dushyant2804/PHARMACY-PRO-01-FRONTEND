import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CalendarCheck2, IndianRupee, LockKeyhole, RefreshCw, Save, Scale, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtINR, formatApiError } from "@/lib/api";
import {
  EMPTY_CLOSING,
  calculateClosing,
  createDailyClosing,
  getDailyClosing,
  getMismatchStatus,
  listDailyClosings,
  updateDailyClosing,
} from "@/lib/dailyClosing";

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const amountFields = [
  ["cash_sales", "Cash sales", "Cash received from sales"],
  ["upi_sales", "UPI sales", "UPI / QR collections"],
  ["card_sales", "Card sales", "Debit and credit cards"],
  ["credit_sales", "Credit sales", "Sales pending collection"],
  ["expenses", "Expenses", "Cash paid out today"],
  ["counted_cash", "Counted cash", "Physical cash in drawer"],
];

const statusStyle = {
  balanced: "border-emerald-200 bg-emerald-50 text-emerald-700",
  shortage: "border-red-200 bg-red-50 text-red-700",
  excess: "border-amber-200 bg-amber-50 text-amber-700",
};

function MismatchBadge({ mismatch }) {
  const status = getMismatchStatus(mismatch);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle[status]}`}>
      {status}
    </span>
  );
}

export default function DailyClosing() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(() => ({ ...EMPTY_CLOSING, closing_date: today() }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const calculations = useMemo(() => calculateClosing(form), [form]);
  const selectedRecord = records.find((record) => record.closing_date === form.closing_date);
  const isLocked = Boolean(selectedRecord?.locked || form.locked);
  const mismatchStatus = getMismatchStatus(calculations.mismatch);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const loadClosings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loadedRecords = await listDailyClosings();
      setRecords(loadedRecords);
      setForm((current) => {
        const matching = loadedRecords.find((record) => record.closing_date === current.closing_date);
        const hasUnsavedInput = amountFields.some(([field]) => current[field] !== "") || Boolean(current.notes) || current.lock_day;
        return matching && !hasUnsavedInput ? { ...matching, lock_day: matching.locked } : current;
      });
    } catch (requestError) {
      const message = formatApiError(requestError);
      setError(message);
      toast.error(`Daily closing history unavailable: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClosings();
  }, [loadClosings]);

  const selectDate = async (closingDate) => {
    const record = records.find((item) => item.closing_date === closingDate);
    if (record) {
      setForm({ ...record, lock_day: record.locked });
      return;
    }

    try {
      const loaded = await getDailyClosing(closingDate);
      setRecords((current) => [loaded, ...current.filter((item) => item.closing_date !== loaded.closing_date)]);
      setForm({ ...loaded, lock_day: loaded.locked });
    } catch (requestError) {
      if (requestError?.response?.status === 404) {
        setForm({ ...EMPTY_CLOSING, closing_date: closingDate });
        return;
      }
      toast.error(`Could not load that closing: ${formatApiError(requestError)}`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLocked) return;

    setSaving(true);
    try {
      const saved = selectedRecord?.id
        ? await updateDailyClosing(selectedRecord.id, form)
        : await createDailyClosing(form);
      setRecords((current) => [saved, ...current.filter((record) => record.closing_date !== saved.closing_date)]
        .sort((a, b) => b.closing_date.localeCompare(a.closing_date)));
      setForm({ ...saved, lock_day: saved.locked });
      setError("");
      toast.success(form.lock_day ? "Day closed and locked" : "Daily closing saved");
    } catch (requestError) {
      toast.error(`Could not save daily closing: ${formatApiError(requestError)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="daily-closing-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-900">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="h-6 w-6 text-emerald-600" />
            <h1 className="font-heading text-2xl font-bold text-slate-900">Daily Closing</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Reconcile collections, expenses, and cash before ending the day.</p>
        </div>
        {isLocked && (
          <div className="inline-flex items-center gap-2 self-start rounded-sm border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
            <LockKeyhole className="h-4 w-4" /> Day locked
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-slate-500"><span>Expected total</span><IndianRupee className="h-4 w-4" /></div>
          <div className="mt-2 font-heading text-2xl font-bold font-mono-nums text-slate-900">{fmtINR(calculations.expectedTotal)}</div>
          <div className="mt-1 text-xs text-slate-400">All sales minus expenses</div>
        </div>
        <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-slate-500"><span>Expected cash</span><WalletCards className="h-4 w-4" /></div>
          <div className="mt-2 font-heading text-2xl font-bold font-mono-nums text-slate-900">{fmtINR(calculations.expectedCash)}</div>
          <div className="mt-1 text-xs text-slate-400">Cash sales minus expenses</div>
        </div>
        <div className={`rounded-sm border bg-white p-4 shadow-sm ${statusStyle[mismatchStatus]}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest"><span>Cash mismatch</span><Scale className="h-4 w-4" /></div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="font-heading text-2xl font-bold font-mono-nums">{fmtINR(calculations.mismatch)}</div>
            <MismatchBadge mismatch={calculations.mismatch} />
          </div>
          <div className="mt-1 text-xs opacity-70">Counted cash minus expected cash</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="font-heading font-semibold text-slate-900">Closing details</div>
          <div className="text-xs text-slate-500">Save a draft, or lock the day after confirming the final count.</div>
        </div>
        <fieldset className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="closing-date" className="text-xs font-semibold uppercase text-slate-600">Closing date</Label>
            <Input id="closing-date" type="date" value={form.closing_date} max={today()} onChange={(event) => selectDate(event.target.value)} className="mt-1 rounded-sm" required />
          </div>
          {amountFields.map(([field, label, hint]) => (
            <div key={field}>
              <Label htmlFor={field} className="text-xs font-semibold uppercase text-slate-600">{label} ₹</Label>
              <Input id={field} data-testid={`closing-${field}`} type="number" min="0" step="0.01" value={form[field]} onChange={(event) => updateField(field, event.target.value)} placeholder="0.00" className="mt-1 rounded-sm font-mono-nums" disabled={isLocked} required />
              <div className="mt-1 text-[11px] text-slate-400">{hint}</div>
            </div>
          ))}
          <div className="md:col-span-2 lg:col-span-3">
            <Label htmlFor="closing-notes" className="text-xs font-semibold uppercase text-slate-600">Notes</Label>
            <Textarea id="closing-notes" disabled={isLocked} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Explain a mismatch, cash movement, or handover detail…" className="mt-1 min-h-20 rounded-sm" />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-sm border border-slate-200 bg-slate-50 p-3 md:col-span-2 lg:col-span-3">
            <div>
              <Label htmlFor="lock-day" className="font-semibold text-slate-900">Lock day after saving</Label>
              <p className="text-xs text-slate-500">Locked closing records cannot be edited, protecting the final handover.</p>
            </div>
            <Switch id="lock-day" disabled={isLocked} checked={Boolean(form.lock_day)} onCheckedChange={(checked) => updateField("lock_day", checked)} />
          </div>
        </fieldset>
        <div className="flex justify-end border-t border-slate-200 px-4 py-3">
          <Button type="submit" disabled={isLocked || saving} className="rounded-sm bg-emerald-700 hover:bg-emerald-800" data-testid="save-daily-closing">
            {form.lock_day ? <LockKeyhole className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving…" : form.lock_day ? "Save & lock day" : "Save closing"}
          </Button>
        </div>
      </form>

      <div className="rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="font-heading font-semibold text-slate-900">Daily closing history</div>
          <div className="text-xs text-slate-500">Select an unlocked day to review or update its closing.</div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading closing history…</div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Closing history could not be loaded. Your current form entries have been preserved.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => loadClosings()} className="rounded-sm">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No closing records yet. Complete today’s closing above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead><tr><th>Date</th><th className="text-right">Gross sales</th><th className="text-right">Expenses</th><th className="text-right">Expected total</th><th className="text-right">Counted cash</th><th className="text-right">Mismatch</th><th>Status</th><th>Day</th></tr></thead>
              <tbody>{records.map((record) => (
                <tr key={record.closing_date} onClick={() => selectDate(record.closing_date)} className="cursor-pointer hover:bg-slate-50">
                  <td className="font-medium">{fmtDate(`${record.closing_date}T00:00:00`)}</td>
                  <td className="num-cell">{fmtINR(record.grossSales)}</td>
                  <td className="num-cell">{fmtINR(record.expenses)}</td>
                  <td className="num-cell font-semibold">{fmtINR(record.expectedTotal)}</td>
                  <td className="num-cell">{fmtINR(record.counted_cash)}</td>
                  <td className="num-cell font-semibold">{fmtINR(record.mismatch)}</td>
                  <td><MismatchBadge mismatch={record.mismatch} /></td>
                  <td>{record.locked ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600"><LockKeyhole className="h-3.5 w-3.5" /> Locked</span> : <span className="text-xs font-semibold text-blue-600">Draft</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
