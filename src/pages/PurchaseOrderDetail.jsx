import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { categoryBadgeClass } from "@/lib/categories";

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data || null);
    } catch (e) {
      setError(e?.response?.status === 404 ? "Purchase order not found" : "Failed to load purchase order");
      setPo(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const receive = async () => {
    if (!window.confirm("Mark as received? This will add stock to inventory and record a purchase in the distributor ledger.")) return;
    setReceiving(true);
    try {
      await api.post(`/purchase-orders/${id}/receive`);
      toast.success("Stock received and inventory updated");
      load();
    } catch (e) { toast.error(formatApiError(e)); } finally { setReceiving(false); }
  };

  const Header = (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")} className="rounded-sm" data-testid="back-to-po-list">
        <ArrowLeft className="w-4 h-4 mr-1" />Back
      </Button>
      <Link to="/" className="text-xs text-slate-500 hover:text-slate-900 uppercase tracking-wider">Dashboard</Link>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4" data-testid="po-detail">
        {Header}
        <div className="bg-white border border-slate-200 rounded-sm p-10 text-center text-slate-500">Loading…</div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="space-y-4" data-testid="po-detail">
        {Header}
        <div className="bg-red-50 border border-red-200 rounded-sm p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <div className="font-heading font-semibold text-red-800">{error || "Purchase order not available"}</div>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={load} variant="outline" className="rounded-sm">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
            <Button onClick={() => navigate("/purchase-orders")} className="rounded-sm bg-blue-600 hover:bg-blue-700">
              Back to list
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const items = Array.isArray(po.items) ? po.items : [];

  return (
    <div className="space-y-4" data-testid="po-detail">
      {Header}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Purchase Order</div>
          <h1 className="font-heading text-3xl font-bold font-mono-nums">{po.po_no || "—"}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {po.distributor_name || "Unknown"} · {fmtDate(po.created_at)}
            {po.invoice_ref && <span> · Invoice: <span className="font-mono">{po.invoice_ref}</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-sm ${
            po.status === "received" ? "badge-otc" : "badge-sch-h1"
          }`}>{po.status || "pending"}</span>
          {po.status !== "received" && (
            <Button onClick={receive} disabled={receiving} className="rounded-sm bg-emerald-600 hover:bg-emerald-700" data-testid="receive-po">
              <CheckCircle className="w-4 h-4 mr-2" />{receiving ? "Receiving…" : "Receive Stock (GRN)"}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th><th>Batch</th><th>Expiry</th><th>Category</th>
              <th className="text-right">Qty</th><th className="text-right">Purchase</th>
              <th className="text-right">MRP</th><th className="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-slate-500">No items in this PO.</td></tr>
            )}
            {items.map((it, i) => (
              <tr key={i}>
                <td className="font-medium">
                  {it?.name || "—"}
                  {it?.manufacturer && <div className="text-xs text-slate-500">{it.manufacturer}</div>}
                </td>
                <td className="font-mono-nums text-xs">{it?.batch_no || "—"}</td>
                <td className="font-mono-nums text-xs">{it?.expiry_date || "—"}</td>
                <td>
                  <span className={`${categoryBadgeClass(it?.category)} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm`}>
                    {it?.category || "—"}
                  </span>
                </td>
                <td className="num-cell">{it?.quantity ?? 0}</td>
                <td className="num-cell">{fmtINR(it?.purchase_price || 0)}</td>
                <td className="num-cell">{fmtINR(it?.mrp || 0)}</td>
                <td className="num-cell font-semibold">
                  {fmtINR((it?.purchase_price || 0) * (it?.quantity || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 flex justify-end">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total</div>
            <div className="font-heading text-2xl font-bold font-mono-nums">{fmtINR(po.total || 0)}</div>
          </div>
        </div>
      </div>

      {po.notes && <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm text-sm text-slate-700">{po.notes}</div>}
    </div>
  );
}
