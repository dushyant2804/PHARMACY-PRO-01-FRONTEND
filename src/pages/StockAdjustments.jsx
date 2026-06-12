import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ClipboardCheck,
  History,
  PackageCheck,
  SlidersHorizontal,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import Autocomplete from "@/components/Autocomplete";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import api, { fmtDate, formatApiError } from "@/lib/api";
import {
  adjustmentTypeLabel,
  getAvailableStock,
  getBatchId,
  getBatchNumber,
  getMedicineBatches,
  getMedicineId,
  getMedicineName,
  normalizeCollection,
  summarizeAdjustments,
  validateStockAdjustment,
} from "@/lib/stockAdjustments";

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const initialForm = () => ({
  date: today(),
  medicineName: "",
  medicine: null,
  batchKey: "",
  adjustmentType: "",
  quantity: "",
  notes: "",
  referenceNumber: "",
});

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red-600" role="alert">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{value > 0 ? `+${value}` : value}</p>
        </div>
        <div className="rounded-full bg-white/70 p-2.5"><Icon className="h-5 w-5" /></div>
      </div>
    </section>
  );
}

const historyQuantity = (row) => Number(firstDefined(row.quantity, row.adjusted_quantity, row.qty, 0));
const historyType = (row) => firstDefined(row.adjustment_type, row.type, row.reason, "");
const historyMedicine = (row) => firstDefined(row.medicine_name, row.medicine?.name, row.medicine, "—");
const historyBatch = (row) => firstDefined(row.batch_no, row.batch_number, row.batch?.batch_no, row.batch, "—");
const historyUser = (row) => firstDefined(row.user_name, row.created_by_name, row.user?.name, row.created_by, "—");
const historyDate = (row) => firstDefined(row.adjustment_date, row.date, row.created_at, row.createdAt);

export default function StockAdjustments() {
  const [medicines, setMedicines] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [medicinesResult, historyResult] = await Promise.allSettled([
        api.get("/medicines"),
        api.get("/stock-adjustments"),
      ]);

      if (medicinesResult.status === "fulfilled") {
        setMedicines(normalizeCollection(medicinesResult.value.data));
      } else {
        toast.error(`Could not load medicines: ${formatApiError(medicinesResult.reason)}`);
      }

      if (historyResult.status === "fulfilled") {
        setHistory(normalizeCollection(historyResult.value.data));
      } else {
        toast.error(`Could not load adjustment history: ${formatApiError(historyResult.reason)}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const batches = useMemo(() => {
    const medicineBatches = getMedicineBatches(form.medicine);
    return Array.isArray(medicineBatches) ? medicineBatches : [];
  }, [form.medicine]);
  const selectedBatch = useMemo(
    () => (Array.isArray(batches)
      ? batches.find((batch) => String(getBatchId(batch)) === form.batchKey) || null
      : null),
    [batches, form.batchKey]
  );
  const summary = useMemo(() => summarizeAdjustments(history), [history]);
  const projectedStock = selectedBatch && form.quantity !== "" && Number.isFinite(Number(form.quantity))
    ? getAvailableStock(selectedBatch) + Number(form.quantity)
    : null;

  const medicineOptions = (Array.isArray(medicines) ? medicines : [])
    .filter((medicine) => medicine && typeof medicine === "object")
    .map((medicine) => ({
      id: getMedicineId(medicine),
      value: getMedicineName(medicine),
      label: `${getMedicineName(medicine)}${medicine.manufacturer ? ` · ${medicine.manufacturer}` : ""}`,
      medicine,
    }));

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleMedicineChange = (value, option) => {
    const medicine = option?.medicine || null;
    setForm((current) => ({
      ...current,
      medicineName: medicine ? getMedicineName(medicine) : value,
      medicine,
      batchKey: "",
    }));
    setErrors((current) => ({ ...current, medicine: undefined, batch: undefined }));
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateStockAdjustment({
      date: form.date,
      medicine: form.medicine,
      batch: selectedBatch,
      adjustmentType: form.adjustmentType,
      quantity: form.quantity,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Review the highlighted fields before submitting.");
      return;
    }

    const payload = {
      adjustment_date: form.date,
      medicine_id: getMedicineId(form.medicine),
      batch_id: selectedBatch?.id || selectedBatch?.batch_id || undefined,
      batch_no: getBatchNumber(selectedBatch),
      adjustment_type: form.adjustmentType,
      quantity: Number(form.quantity),
      notes: form.notes.trim() || null,
      reference_number: form.referenceNumber.trim() || null,
    };

    setSubmitting(true);
    try {
      await api.post("/stock-adjustments", payload);
      toast.success(`${payload.quantity > 0 ? "Added" : "Reduced"} ${Math.abs(payload.quantity)} units successfully`);
      setForm(initialForm());
      setErrors({});
      await loadData();
    } catch (error) {
      const message = formatApiError(error);
      setErrors((current) => ({ ...current, submit: message }));
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="stock-adjustments-page">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            <SlidersHorizontal className="h-4 w-4" /> Inventory control
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Stock Adjustments</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Record auditable inventory corrections by batch. Positive quantities add stock; negative quantities reduce it.
          </p>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Damaged" value={summary.damaged} icon={ShieldAlert} tone="red" />
        <SummaryCard label="Expired" value={summary.expired} icon={AlertCircle} tone="amber" />
        <SummaryCard label="Corrections" value={summary.correction} icon={ClipboardCheck} tone="blue" />
        <SummaryCard label="Total adjusted qty" value={summary.total} icon={PackageCheck} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={submitAdjustment} noValidate className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-950">New adjustment</h2>
            <p className="mt-1 text-xs text-slate-500">Every submission is recorded in adjustment history.</p>
          </div>

          <div className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Date <span className="text-red-500">*</span></span>
              <Input type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} className={errors.date ? "border-red-400 focus-visible:ring-red-500" : ""} />
              <FieldError>{errors.date}</FieldError>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Medicine <span className="text-red-500">*</span></span>
              <Autocomplete value={form.medicineName} onChange={handleMedicineChange} options={medicineOptions} placeholder="Search and select medicine" className={errors.medicine ? "border-red-400 focus-visible:ring-red-500" : ""} testId="adjustment-medicine" />
              <FieldError>{errors.medicine}</FieldError>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Batch <span className="text-red-500">*</span></span>
              <select value={form.batchKey} onChange={(event) => { updateField("batchKey", event.target.value); setErrors((current) => ({ ...current, batch: undefined })); }} disabled={!form.medicine} className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.batch ? "border-red-400" : "border-slate-300"}`}>
                <option value="">{form.medicine ? "Select a batch" : "Select medicine first"}</option>
                {Array.isArray(batches) && batches.map((batch) => (
                  <option key={getBatchId(batch)} value={String(getBatchId(batch))}>
                    {getBatchNumber(batch)} · {getAvailableStock(batch)} available{batch.expiry_date ? ` · Exp ${batch.expiry_date}` : ""}
                  </option>
                ))}
              </select>
              {form.medicine && (!Array.isArray(batches) || batches.length === 0) && (
                <p className="mt-1.5 text-xs font-medium text-slate-500" role="status">No sellable batches available</p>
              )}
              <FieldError>{errors.batch}</FieldError>
            </label>

            {selectedBatch && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" data-testid="selected-batch-stock">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Available stock</p>
                    <p className="mt-1 text-2xl font-black text-emerald-950">{getAvailableStock(selectedBatch)}</p>
                  </div>
                  {projectedStock !== null && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">After adjustment</p>
                      <p className={`mt-1 text-lg font-black ${projectedStock < 0 ? "text-red-700" : "text-emerald-950"}`}>{projectedStock}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Adjustment type <span className="text-red-500">*</span></span>
                <select value={form.adjustmentType} onChange={(event) => updateField("adjustmentType", event.target.value)} className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${errors.adjustmentType ? "border-red-400" : "border-slate-300"}`}>
                  <option value="">Select type</option>
                  <option value="damaged">Damaged</option>
                  <option value="expired">Expired</option>
                  <option value="correction">Correction</option>
                  <option value="stock_count">Stock count</option>
                  <option value="received">Received</option>
                  <option value="return">Return</option>
                  <option value="other">Other</option>
                </select>
                <FieldError>{errors.adjustmentType}</FieldError>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Quantity <span className="text-red-500">*</span></span>
                <Input type="number" step="1" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} placeholder="e.g. -5 or +10" className={errors.quantity ? "border-red-400 focus-visible:ring-red-500" : ""} />
                <FieldError>{errors.quantity}</FieldError>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-700"><ArrowUpRight className="h-4 w-4" /> Positive adds stock</div>
              <div className="flex items-center gap-2 font-semibold text-red-700"><ArrowDownRight className="h-4 w-4" /> Negative reduces stock</div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Reference number</span>
              <Input value={form.referenceNumber} onChange={(event) => updateField("referenceNumber", event.target.value)} placeholder="Optional document or ticket number" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Notes</span>
              <Textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Explain why this adjustment is needed" rows={3} />
            </label>

            {errors.submit && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{errors.submit}</div>}

            <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
              <Save className="h-4 w-4" /> {submitting ? "Saving adjustment..." : "Save adjustment"}
            </button>
          </div>
        </form>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2"><History className="h-4 w-4 text-emerald-700" /><h2 className="font-bold text-slate-950">Adjustment history</h2></div>
              <p className="mt-1 text-xs text-slate-500">Signed quantities show the exact stock movement.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{history.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Medicine</th><th className="p-3 text-left">Batch</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">User</th><th className="p-3 text-left">Notes</th></tr>
              </thead>
              <tbody>
                {history.map((row, index) => {
                  const quantity = historyQuantity(row);
                  return (
                    <tr key={row.id || row.adjustment_id || index} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                      <td className="whitespace-nowrap p-3 text-slate-600">{fmtDate(historyDate(row))}</td>
                      <td className="p-3 font-bold text-slate-900">{historyMedicine(row)}</td>
                      <td className="p-3"><span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{historyBatch(row)}</span></td>
                      <td className={`p-3 text-right font-black tabular-nums ${quantity > 0 ? "text-emerald-700" : quantity < 0 ? "text-red-700" : "text-slate-500"}`}>{quantity > 0 ? `+${quantity}` : quantity}</td>
                      <td className="p-3 text-slate-700">{adjustmentTypeLabel(historyType(row))}</td>
                      <td className="p-3 text-slate-600">{historyUser(row)}</td>
                      <td className="max-w-[260px] p-3 text-slate-600"><span className="line-clamp-2">{row.notes || "—"}</span></td>
                    </tr>
                  );
                })}
                {!loading && history.length === 0 && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-500">No stock adjustments recorded yet.</td></tr>}
                {loading && <tr><td colSpan="7" className="p-12 text-center text-sm text-slate-500">Loading stock adjustments…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
