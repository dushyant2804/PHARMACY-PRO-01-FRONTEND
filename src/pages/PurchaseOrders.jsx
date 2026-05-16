import React, { useEffect, useState } from "react";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";

const emptyItem = {
  name: "", batch_no: "", expiry_date: "", manufacturer: "",
  category: "OTC", quantity: 1, purchase_price: 0, mrp: 0, gst_rate: 12,
};

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [pos, setPos] = useState([]);
  const [dists, setDists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [distId, setDistId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [packSize, setPackSize] = useState(1);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...emptyItem }]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [poRes, dRes] = await Promise.all([
        api.get("/purchase-orders").catch(() => ({ data: [] })),
        api.get("/distributors").catch(() => ({ data: [] })),
      ]);
      setPos(Array.isArray(poRes.data) ? poRes.data : []);
      setDists(Array.isArray(dRes.data) ? dRes.data : []);
    } catch (e) {
      setError("Failed to load purchases");
      setPos([]);
      setDists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
  const handleKeyDown = (e) => {
    const tag = document.activeElement.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA"
    ) {
      return;
    }

    // F6 → Open Purchase Order dialog
    if (e.key === "F6") {
      e.preventDefault();
      setOpen(true);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);

  const updateItem = (i, k, v) => {
    const c = [...items]; c[i] = { ...c[i], [k]: v }; setItems(c);
  };
  const addRow = () => setItems([...items, { ...emptyItem }]);
  const removeRow = (i) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);

  const total = items.reduce(
    (s, i) => s + Number(i.purchase_price || 0) * Number(i.quantity || 0),
    0
  );

  const submit = async (e) => {
    e.preventDefault();
    const d = dists.find((x) => x.id === distId);
    if (!d) return toast.error("Select a distributor");
    const validItems = items.filter((i) => i.name?.trim() && i.batch_no?.trim() && i.expiry_date);
    if (validItems.length === 0) return toast.error("Add at least one item with name, batch & expiry");

    try {
      await api.post("/purchase-orders", {
        distributor_id: d.id,
        distributor_name: d.name,
        invoice_ref: invoiceRef || "",
        notes: notes || "",
        items: validItems.map((i) => ({
          name: i.name.trim(),
          batch_no: i.batch_no.trim(),
          expiry_date: i.expiry_date,
          manufacturer: i.manufacturer || "",
          category: i.category || "OTC",
          quantity: Number(i.quantity) || 0,
          purchase_price: Number(i.purchase_price) || 0,
          mrp: Number(i.mrp) || 0,
          gst_rate: Number(i.gst_rate) || 0,
        })),
      });
      toast.success("Purchase order created");
      setOpen(false);
      setItems([{ ...emptyItem }]); setDistId(""); setInvoiceRef(""); setNotes("");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const PageHeader = (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="rounded-sm"
          data-testid="po-back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />Dashboard
        </Button>
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Procurement</div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">Purchase Orders</h1>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={load} className="rounded-sm" data-testid="po-refresh">
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
        <Button
          onClick={() => setOpen(true)}
          disabled={dists.length === 0}
          className="rounded-sm bg-blue-600 hover:bg-blue-700"
          data-testid="new-po-btn"
        >
          <Plus className="w-4 h-4 mr-2" />New PO
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="purchase-orders-page">
      {PageHeader}

      {dists.length === 0 && !loading && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            No distributors added yet.{" "}
            <Link to="/distributors" className="underline font-semibold">Add a distributor</Link> before creating a purchase order.
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-sm p-10 text-center text-slate-500">
          Loading purchases…
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-sm p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <div className="font-heading font-semibold text-red-800">Failed to load purchases</div>
          <p className="text-sm text-red-700 mt-1">Something went wrong while fetching data.</p>
          <Button onClick={load} variant="outline" className="rounded-sm mt-3" data-testid="po-retry">
            <RefreshCw className="w-4 h-4 mr-2" />Retry
          </Button>
        </div>
      ) : pos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-12 text-center" data-testid="po-empty-state">
          <div className="font-heading text-lg font-semibold text-slate-900">No purchases yet</div>
          <p className="text-sm text-slate-500 mt-1">Record stock you receive from distributors to keep inventory & ledgers in sync.</p>
          <Button
            onClick={() => setOpen(true)}
            disabled={dists.length === 0}
            className="rounded-sm bg-blue-600 hover:bg-blue-700 mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />Create your first PO
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO #</th><th>Date</th><th>Distributor</th><th>Invoice Ref</th>
                <th className="text-right">Items</th><th className="text-right">Total</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => {
                if (!p || typeof p !== "object") return null;
                const items = Array.isArray(p.items) ? p.items : [];
                return (
                  <tr key={p.id || Math.random()}>
                    <td className="font-mono-nums font-semibold">{p.po_no || "—"}</td>
                    <td className="font-mono-nums text-xs">{fmtDate(p.created_at)}</td>
                    <td>{p.distributor_name || "—"}</td>
                    <td className="font-mono text-xs">{p.invoice_ref || "—"}</td>
                    <td className="num-cell">{items.length}</td>
                    <td className="num-cell font-semibold">{fmtINR(p.total || 0)}</td>
                    <td>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm ${
                        p.status === "received" ? "badge-otc" : "badge-sch-h1"
                      }`}>{p.status || "pending"}</span>
                    </td>
                    <td className="text-right">
                      {p.id && (
                        <Link to={`/purchase-orders/${p.id}`} className="text-blue-600 text-xs hover:underline">
                          View →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">New Purchase Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Distributor *</Label>
                <Select value={distId} onValueChange={setDistId}>
                  <SelectTrigger className="rounded-sm mt-1" data-testid="po-distributor">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dists.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Supplier Invoice #</Label>
                <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} className="rounded-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-sm mt-1" />
              </div>
            </div>

            <div className="border border-slate-200 rounded-sm overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine *</th><th>Batch *</th><th>Expiry *</th><th>Mfr</th><th>Category</th>
                    <th className="text-right">Qty</th><th className="text-right">Purchase ₹</th>
                    <th className="text-right">MRP ₹</th><th className="text-right">GST%</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td><Input value={it.name} onChange={(e) => updateItem(i, "name", e.target.value)} required className="h-8 rounded-sm" data-testid={`po-item-name-${i}`} /></td>
                      <td><Input value={it.batch_no} onChange={(e) => updateItem(i, "batch_no", e.target.value)} required className="h-8 rounded-sm w-24" /></td>
                      <td><Input type="date" value={it.expiry_date} onChange={(e) => updateItem(i, "expiry_date", e.target.value)} required className="h-8 rounded-sm w-36" /></td>
                      <td><Input value={it.manufacturer} onChange={(e) => updateItem(i, "manufacturer", e.target.value)} className="h-8 rounded-sm w-28" /></td>
                      <td>
                        <Select value={it.category} onValueChange={(v) => updateItem(i, "category", v)}>
                          <SelectTrigger className="h-8 rounded-sm w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td><Input type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="h-8 w-20 text-right rounded-sm" /></td>
                      <td><Input type="number" step="0.01" value={it.purchase_price} onChange={(e) => updateItem(i, "purchase_price", e.target.value)} className="h-8 w-24 text-right rounded-sm" /></td>
                      <td><Input type="number" step="0.01" value={it.mrp} onChange={(e) => updateItem(i, "mrp", e.target.value)} className="h-8 w-24 text-right rounded-sm" /></td>
                      <td><Input type="number" value={it.gst_rate} onChange={(e) => updateItem(i, "gst_rate", e.target.value)} className="h-8 w-16 text-right rounded-sm" /></td>
                      <td>
                        <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-red-600" disabled={items.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 flex justify-between items-center border-t border-slate-200">
                <Button type="button" onClick={addRow} variant="outline" className="rounded-sm" size="sm">
                  <Plus className="w-3 h-3 mr-1" />Add Row
                </Button>
                <div className="font-heading font-bold text-lg font-mono-nums">Total: {fmtINR(total)}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancel</Button>
              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="save-po">Create PO</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
