import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Trash2, AlertTriangle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { isRestricted } from "@/lib/categories";
import BarcodeScanner from "@/components/BarcodeScanner";
import Autocomplete from "@/components/Autocomplete";

export default function Billing() {
  const navigate = useNavigate();
  const [meds, setMeds] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ id: "", name: "Walk-in", phone: "", gstin: "" });
  const [referringDoctor, setReferringDoctor] = useState("");
  const [billDiscType, setBillDiscType] = useState("none"); // none | pct | amt
  const [billDiscValue, setBillDiscValue] = useState("");
  const [payment, setPayment] = useState({ mode: "cash", paid: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    api.get("/medicines").then((r) => setMeds(Array.isArray(r.data) ? r.data : [])).catch(() => setMeds([]));
    api.get("/customers").then((r) => setCustomers(Array.isArray(r.data) ? r.data : [])).catch(() => setCustomers([]));
    api.get("/doctors").then((r) => setDoctors(Array.isArray(r.data) ? r.data : [])).catch(() => setDoctors([]));
  }, []);
  useEffect(() => {
  const handleKeyDown = (e) => {
    const tag = document.activeElement.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA"
    ) {
      return;
    }

    // F1 → New Bill
    if (e.key === "F1") {
      e.preventDefault();

      // Reset bill / open fresh bill
      newBill();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);

  const filtered = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    return meds
      .filter((m) => m.name.toLowerCase().includes(s) || (m.barcode && m.barcode.includes(search)))
      .slice(0, 8);
  }, [search, meds]);

  const addToCart = (m) => {
    if (m.quantity <= 0) return toast.error("Out of stock");
    const exists = cart.find((c) => c.medicine_id === m.id);
    if (exists) {
      const needed = (exists.quantity + 1) * (exists.unit_type === "box" ? exists.units_per_box : 1);
      if (needed > m.quantity) return toast.error("Insufficient stock");
      setCart(cart.map((c) => c.medicine_id === m.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        medicine_id: m.id, name: m.name, batch_no: m.batch_no, expiry_date: m.expiry_date,
        quantity: 1, mrp: m.mrp, discount_pct: 0, gst_rate: m.gst_rate || 12, category: m.category,
        stock: m.quantity, unit_type: "unit", units_per_box: Math.max(m.units_per_box || 1, 1),
      }]);
    }
    setSearch("");
  };

  const updateItem = (i, key, val) => {
    const c = [...cart];
    c[i] = { ...c[i], [key]: val };
    // when toggling box/unit, validate qty against stock
    if (key === "unit_type") {
      const upb = c[i].units_per_box || 1;
      const maxQty = key === "unit_type" && val === "box" ? Math.floor(c[i].stock / upb) : c[i].stock;
      if (c[i].quantity > maxQty) c[i].quantity = Math.max(maxQty, 1);
    }
    setCart(c);
  };
  const removeItem = (i) => setCart(cart.filter((_, idx) => idx !== i));

  const totals = useMemo(() => {
    let raw = 0;
    const lines = cart.map((it) => {
      const upb = it.units_per_box || 1;
      const unitPrice = it.mrp * (it.unit_type === "box" ? upb : 1);
      const base = unitPrice * it.quantity;
      const disc = base * (Number(it.discount_pct || 0) / 100);
      const taxable = base - disc;
      raw += taxable;
      return { taxable, gst_rate: Number(it.gst_rate || 0) };
    });
    let billDisc = 0;
    if (billDiscType === "amt") billDisc = Math.min(Number(billDiscValue || 0), raw);
    else if (billDiscType === "pct") billDisc = raw * (Math.min(Number(billDiscValue || 0), 100) / 100);
    const afterDisc = Math.max(raw - billDisc, 0);

    let sub = 0, gst = 0;
    for (const l of lines) {
      const share = raw > 0 ? l.taxable / raw : 0;
      const after = l.taxable - billDisc * share;
      const g = after - after / (1 + l.gst_rate / 100);
      gst += g;
      sub += after - g;
    }
    return {
      sub: +sub.toFixed(2),
      gst: +gst.toFixed(2),
      bill_disc: +billDisc.toFixed(2),
      raw: +raw.toFixed(2),
      total: +(sub + gst).toFixed(2),
    };
  }, [cart, billDiscType, billDiscValue]);

  const hasScheduleH = cart.some((c) => c.category === "Schedule H" || c.category === "Schedule H1");

  const submit = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setSaving(true);
    try {
      const payload = {
        customer_id: customer.id || null,
        customer_name: customer.name || "Walk-in",
        customer_phone: customer.phone,
        customer_gstin: customer.gstin,
        referring_doctor: referringDoctor,
        items: cart.map(({ stock, ...rest }) => ({
          ...rest,
          quantity: Number(rest.quantity),
          discount_pct: Number(rest.discount_pct || 0),
          units_per_box: Math.max(Number(rest.units_per_box || 1), 1),
          unit_type: rest.unit_type || "unit",
        })),
        payment_mode: payment.mode,
        paid_amount: payment.mode === "credit" ? Number(payment.paid || 0) : (Number(payment.paid) || totals.total),
        bill_discount_amount: billDiscType === "amt" ? Number(billDiscValue || 0) : 0,
        bill_discount_pct: billDiscType === "pct" ? Number(billDiscValue || 0) : 0,
        notes,
      };
      const { data } = await api.post("/invoices", payload);
      toast.success(`Invoice ${data.invoice_no} created`);
      navigate(`/invoices/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="billing-page">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Point of sale</div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">New Bill</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="bg-white border border-slate-200 rounded-sm p-4 relative">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search medicine or scan barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-24 rounded-sm h-11"
                data-testid="billing-search"
              />
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 hover:bg-blue-50 rounded-sm"
                data-testid="billing-scan-btn"
              >
                <ScanLine className="w-4 h-4" />Scan
              </button>
            </div>
            {filtered.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 bg-white border border-slate-200 shadow-lg rounded-sm z-10 max-h-80 overflow-y-auto">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addToCart(m)}
                    className="w-full px-3 py-2 flex justify-between hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
                    data-testid={`med-option-${m.id}`}
                  >
                    <div>
                      <div className="font-medium text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{m.batch_no} · {m.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-nums text-sm">{fmtINR(m.mrp)}</div>
                      <div className="text-xs text-slate-500">Stock: {m.quantity}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasScheduleH && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3 flex gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="text-red-800">
                <strong className="font-semibold">Schedule H/H1 warning:</strong> Prescription required. Record doctor's details & verify before dispensing.
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="px-4 py-3 border-b border-slate-200 font-heading font-semibold">Items ({cart.length})</div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr>
                  <th>Medicine</th><th>Type</th>
                  <th className="text-right">Qty</th><th className="text-right">Rate</th>
                  <th className="text-right">Disc %</th><th className="text-right">Total</th><th></th>
                </tr></thead>
                <tbody>
                  {cart.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-500">No items yet. Search above to add.</td></tr>}
                  {cart.map((it, i) => {
                    const upb = it.units_per_box || 1;
                    const unitPrice = it.mrp * (it.unit_type === "box" ? upb : 1);
                    const lt = unitPrice * it.quantity * (1 - (it.discount_pct || 0) / 100);
                    const maxQty = it.unit_type === "box" ? Math.floor(it.stock / upb) : it.stock;
                    return (
                      <tr key={i}>
                        <td>
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{it.batch_no} · stock {it.stock} units</div>
                        </td>
                        <td>
                          <Select value={it.unit_type} onValueChange={(v) => updateItem(i, "unit_type", v)}>
                            <SelectTrigger className="h-8 w-24 rounded-sm" data-testid={`item-unit-type-${i}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unit">Unit</SelectItem>
                              <SelectItem value="box" disabled={upb <= 1}>Box ({upb}u)</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="num-cell">
                          <Input type="number" min={1} max={maxQty} value={it.quantity}
                            onChange={(e) => updateItem(i, "quantity", Math.max(1, Math.min(maxQty || 1, Number(e.target.value))))}
                            className="w-20 h-8 text-right rounded-sm" />
                        </td>
                        <td className="num-cell text-xs">
                          {fmtINR(unitPrice)}<br/>
                          <span className="text-slate-400">/{it.unit_type === "box" ? "box" : "unit"}</span>
                        </td>
                        <td className="num-cell">
                          <Input type="number" value={it.discount_pct}
                            onChange={(e) => updateItem(i, "discount_pct", e.target.value)}
                            className="w-16 h-8 text-right rounded-sm" />
                        </td>
                        <td className="num-cell font-semibold">{fmtINR(lt)}</td>
                        <td><button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: customer + payment */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <div className="font-heading font-semibold">Customer</div>
            <Select value={customer.id || "walkin"} onValueChange={(v) => {
              if (v === "walkin") setCustomer({ id: "", name: "Walk-in", phone: "", gstin: "" });
              else {
                const c = customers.find((x) => x.id === v);
                if (c) setCustomer({ id: c.id, name: c.name, phone: c.phone, gstin: c.gstin });
              }
            }}>
              <SelectTrigger className="rounded-sm" data-testid="customer-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">Walk-in (cash)</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="rounded-sm" />
            <Input placeholder="Phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="rounded-sm" />
            <Input placeholder="GSTIN (optional)" value={customer.gstin} onChange={(e) => setCustomer({ ...customer, gstin: e.target.value })} className="rounded-sm" />

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Referring Doctor</Label>
              <Autocomplete
                value={referringDoctor}
                onChange={(t) => setReferringDoctor(t)}
                options={doctors.map((d) => ({ id: d.name, label: d.name, value: d.name }))}
                placeholder="Dr. name (optional)"
                className="rounded-sm mt-1"
                testId="referring-doctor"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <div className="font-heading font-semibold">Bill Discount</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "none", l: "None" },
                { v: "pct", l: "%" },
                { v: "amt", l: "₹" },
              ].map((o) => (
                <button key={o.v} type="button"
                  onClick={() => { setBillDiscType(o.v); if (o.v === "none") setBillDiscValue(""); }}
                  className={`py-2 text-xs font-semibold uppercase tracking-wider rounded-sm border ${
                    billDiscType === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                  data-testid={`bill-disc-${o.v}`}>
                  {o.l}
                </button>
              ))}
            </div>
            {billDiscType !== "none" && (
              <Input type="number" min="0" step="0.01"
                placeholder={billDiscType === "pct" ? "Discount %" : "Discount ₹"}
                value={billDiscValue}
                onChange={(e) => setBillDiscValue(e.target.value)}
                className="rounded-sm"
                data-testid="bill-disc-value" />
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <div className="font-heading font-semibold">Payment</div>
            <div className="grid grid-cols-2 gap-2">
              {["cash", "upi", "card", "credit"].map((m) => (
                <button key={m}
                  onClick={() => setPayment({ ...payment, mode: m })}
                  className={`py-2 text-sm font-medium rounded-sm border uppercase tracking-wider text-xs ${
                    payment.mode === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                  data-testid={`pay-${m}`}>
                  {m}
                </button>
              ))}
            </div>
            {payment.mode === "credit" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Paid now (optional)</Label>
                <Input type="number" value={payment.paid} onChange={(e) => setPayment({ ...payment, paid: e.target.value })} className="rounded-sm mt-1" />
              </div>
            )}
            <Textarea placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-sm" rows={2} />
          </div>

          <div className="bg-slate-900 text-white rounded-sm p-5 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Subtotal</span><span className="font-mono-nums">{fmtINR(totals.sub)}</span></div>
            {totals.bill_disc > 0 && (
              <div className="flex justify-between text-sm text-emerald-400"><span>Bill discount</span><span className="font-mono-nums">−{fmtINR(totals.bill_disc)}</span></div>
            )}
            <div className="flex justify-between text-sm"><span className="text-slate-400">GST</span><span className="font-mono-nums">{fmtINR(totals.gst)}</span></div>
            <div className="border-t border-slate-700 pt-2 flex justify-between">
              <span className="font-heading font-semibold text-lg">Total</span>
              <span className="font-heading font-bold text-2xl font-mono-nums" data-testid="total-amount">{fmtINR(totals.total)}</span>
            </div>
            <Button
              onClick={submit}
              disabled={saving || cart.length === 0}
              className="w-full rounded-sm bg-blue-600 hover:bg-blue-700 h-11 mt-3 font-semibold"
              data-testid="submit-invoice"
            >
              {saving ? "Creating…" : "Create Invoice →"}
            </Button>
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={async (code) => {
          setScanOpen(false);
          try {
            const { data } = await api.get(`/medicines/lookup/${encodeURIComponent(code)}`);
            addToCart(data);
            toast.success(`Added: ${data.name}`);
          } catch {
            toast.error(`No medicine found for barcode ${code}`);
          }
        }}
      />
    </div>
  );
}
