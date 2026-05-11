import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookOpen, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Autocomplete from "@/components/Autocomplete";
import { useNavigate } from "react-router-dom";

const today = () => new Date().toISOString().slice(0, 10);

const emptyEntry = {
  medicine_id: "", medicine_name: "", quantity: 1, unit_type: "unit",
  total_amount: "", customer_name: "", payment_status: "paid", notes: "",
};

export default function DailySales() {
  const navigate = useNavigate();
  const [meds, setMeds] = useState([]);
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyEntry);
  const [saving, setSaving] = useState(false);

  const load = async (d = date) => {
    setLoading(true); setError(null);
    try {
      const [list, sum] = await Promise.all([
        api.get("/daily-sales", { params: { date: d } }).catch(() => ({ data: [] })),
        api.get("/daily-sales/summary", { params: { date: d } }).catch(() => ({ data: { total: 0, paid: 0, pending: 0, count: 0 } })),
      ]);
      setEntries(Array.isArray(list.data) ? list.data : []);
      setSummary(sum.data || { total: 0, paid: 0, pending: 0, count: 0 });
    } catch (e) {
      setError("Failed to load daily sales");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/medicines").then((r) => setMeds(Array.isArray(r.data) ? r.data : [])).catch(() => setMeds([]));
    load(date);
    // eslint-disable-next-line
  }, []);

  useEffect(() => { load(date); /* eslint-disable-next-line */ }, [date]);

  const selectedMed = useMemo(
    () => meds.find((m) => m.id === form.medicine_id),
    [form.medicine_id, meds]
  );

  // Auto-fill total amount when medicine, qty or unit_type changes (only if user hasn't manually overridden)
  const [autoTotal, setAutoTotal] = useState(true);
  useEffect(() => {
    if (!autoTotal || !selectedMed) return;
    const upb = Math.max(selectedMed.units_per_box || 1, 1);
    const unitPrice = selectedMed.mrp * (form.unit_type === "box" ? upb : 1);
    const computed = +(unitPrice * Number(form.quantity || 0)).toFixed(2);
    setForm((f) => ({ ...f, total_amount: computed }));
    // eslint-disable-next-line
  }, [form.medicine_id, form.quantity, form.unit_type, autoTotal]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.medicine_id) return toast.error("Pick a medicine");
    if (!form.quantity || Number(form.quantity) <= 0) return toast.error("Quantity must be > 0");
    if (!form.total_amount || Number(form.total_amount) <= 0) return toast.error("Total amount required");
    setSaving(true);
    try {
      await api.post("/daily-sales", {
        medicine_id: form.medicine_id,
        quantity: Number(form.quantity),
        unit_type: form.unit_type,
        total_amount: Number(form.total_amount),
        customer_name: form.customer_name,
        payment_status: form.payment_status,
        notes: form.notes,
        sale_date: date,
      });
      toast.success("Sale recorded");
      setForm({ ...emptyEntry });
      setAutoTotal(true);
      // refresh meds and entries
      const m = await api.get("/medicines");
      setMeds(Array.isArray(m.data) ? m.data : []);
      load(date);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this entry? Stock will be restored.")) return;
    try {
      await api.delete(`/daily-sales/${id}`);
      toast.success("Entry deleted, stock restored");
      const m = await api.get("/medicines");
      setMeds(Array.isArray(m.data) ? m.data : []);
      load(date);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const upb = selectedMed ? Math.max(selectedMed.units_per_box || 1, 1) : 1;

  return (
    <div className="space-y-6" data-testid="daily-sales-page">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/")} className="rounded-sm" data-testid="ds-back-btn">
          <ArrowLeft className="w-4 h-4 mr-1" />Dashboard
        </Button>
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Quick Log</div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />Daily Sales Book
          </h1>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card rounded-sm">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Today</div>
          <div className="font-heading text-2xl font-bold font-mono-nums mt-1">{fmtINR(summary.total)}</div>
          <div className="text-xs text-slate-500 mt-1">{summary.count} entries</div>
        </div>
        <div className="kpi-card rounded-sm">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Paid</div>
          <div className="font-heading text-2xl font-bold font-mono-nums text-emerald-600 mt-1">{fmtINR(summary.paid)}</div>
        </div>
        <div className="kpi-card rounded-sm">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Pending</div>
          <div className="font-heading text-2xl font-bold font-mono-nums text-amber-600 mt-1">{fmtINR(summary.pending)}</div>
        </div>
        <div className="kpi-card rounded-sm">
          <Label className="text-xs uppercase font-semibold text-slate-500">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-sm mt-1" data-testid="ds-date" />
        </div>
      </div>

      {/* Quick entry */}
      <div className="bg-white border border-slate-200 rounded-sm p-4">
        <div className="font-heading font-semibold mb-3">New Entry</div>
        <form onSubmit={submit} className="grid md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-3">
            <Label className="text-xs uppercase font-semibold text-slate-600">Medicine *</Label>
            <Autocomplete
              value={form.medicine_name}
              onChange={(text, item) => {
                setForm({ ...form, medicine_name: text, medicine_id: item?.id || "" });
                setAutoTotal(true);
              }}
              options={meds.map((m) => ({ id: m.id, label: `${m.name} · ${m.batch_no} · stk ${m.quantity}`, value: m.name }))}
              placeholder="Search…"
              className="rounded-sm mt-1 h-9"
              testId="ds-medicine"
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase font-semibold text-slate-600">Type</Label>
            <Select value={form.unit_type} onValueChange={(v) => { setForm({ ...form, unit_type: v }); setAutoTotal(true); }}>
              <SelectTrigger className="rounded-sm mt-1 h-9" data-testid="ds-unit-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="box" disabled={upb <= 1}>Box ({upb}u)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Label className="text-xs uppercase font-semibold text-slate-600">Qty</Label>
            <Input type="number" min="1" value={form.quantity}
              onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setAutoTotal(true); }}
              className="rounded-sm mt-1 h-9" data-testid="ds-qty" required />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase font-semibold text-slate-600">Total ₹</Label>
            <Input type="number" step="0.01" value={form.total_amount}
              onChange={(e) => { setForm({ ...form, total_amount: e.target.value }); setAutoTotal(false); }}
              className="rounded-sm mt-1 h-9 font-mono-nums" data-testid="ds-amount" required />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase font-semibold text-slate-600">Customer</Label>
            <Input value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="Walk-in"
              className="rounded-sm mt-1 h-9" data-testid="ds-customer" />
          </div>
          <div className="md:col-span-1">
            <Label className="text-xs uppercase font-semibold text-slate-600">Status</Label>
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
              <SelectTrigger className="rounded-sm mt-1 h-9" data-testid="ds-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Button type="submit" disabled={saving} className="rounded-sm bg-blue-600 hover:bg-blue-700 w-full h-9" data-testid="ds-save">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Log */}
      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-heading font-semibold">Log — {date}</div>
          <Button variant="ghost" size="sm" onClick={() => load(date)} className="rounded-sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-slate-500" data-testid="ds-empty">No data available for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Time</th><th>Medicine</th><th>Type</th>
                <th className="text-right">Qty</th><th className="text-right">Amount</th>
                <th>Customer</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono-nums text-xs">{new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="font-medium">{e.medicine_name}<div className="text-xs text-slate-500 font-mono">{e.batch_no}</div></td>
                    <td className="uppercase text-xs tracking-wider">{e.unit_type}</td>
                    <td className="num-cell">{e.quantity}</td>
                    <td className="num-cell font-semibold">{fmtINR(e.total_amount)}</td>
                    <td>{e.customer_name}</td>
                    <td>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm ${
                        e.payment_status === "paid" ? "badge-otc" : "badge-sch-h1"
                      }`}>{e.payment_status}</span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => remove(e.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
