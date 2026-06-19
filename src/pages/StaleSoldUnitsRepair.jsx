import React, { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import api, { fmtDate, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const STALE_SOLD_UNITS_CONFIRMATION =
  "Only clear this if you have verified that these sold units are stale and not backed by a real invoice. This action will restore stock for this batch.";

const FIELD_ALIASES = {
  medicine: ["medicine", "medicine_name", "medicineName", "name"],
  medicineId: ["medicine_id", "medicineId", "id"],
  batchNo: ["batch_no", "batchNo", "batch", "batch_number", "batchNumber"],
  expiry: ["expiry", "expiry_date", "expiryDate", "expires_at", "expiresAt"],
  purchasedUnits: ["purchased_units", "purchasedUnits", "purchase_units", "total_purchased_units"],
  soldUnits: ["sold_units", "soldUnits", "stale_sold_units", "staleSoldUnits"],
  currentStock: ["current_stock", "currentStock", "stock", "stock_units"],
  stockAfterClear: ["stock_after_clear", "stockAfterClear", "restored_stock", "stockAfterRepair"],
  reason: ["reason", "repair_reason", "message"],
};

function pick(row, aliases, fallback = "—") {
  const key = aliases.find((alias) => row?.[alias] !== undefined && row?.[alias] !== null && row?.[alias] !== "");
  return key ? row[key] : fallback;
}

export function normalizeStaleSoldUnit(row) {
  const currentStock = pick(row, FIELD_ALIASES.currentStock, 0);
  const soldUnits = pick(row, FIELD_ALIASES.soldUnits, 0);
  return {
    medicine: pick(row, FIELD_ALIASES.medicine),
    medicine_id: pick(row, FIELD_ALIASES.medicineId, null),
    batch_no: pick(row, FIELD_ALIASES.batchNo, ""),
    expiry: pick(row, FIELD_ALIASES.expiry, null),
    purchased_units: Number(pick(row, FIELD_ALIASES.purchasedUnits, 0) || 0),
    sold_units: Number(soldUnits || 0),
    current_stock: Number(currentStock || 0),
    stock_after_clear: Number(pick(row, FIELD_ALIASES.stockAfterClear, Number(currentStock || 0) + Number(soldUnits || 0)) || 0),
    reason: pick(row, FIELD_ALIASES.reason),
  };
}

export function normalizeStaleSoldUnitsResponse(data) {
  const rows = Array.isArray(data) ? data : data?.items || data?.rows || data?.stale_sold_units || data?.results || [];
  return Array.isArray(rows) ? rows.map(normalizeStaleSoldUnit) : [];
}

export default function StaleSoldUnitsRepair() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingKey, setClearingKey] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/inventory/stale-sold-units");
      setRows(normalizeStaleSoldUnitsResponse(data));
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") loadRows();
  }, [loadRows, user?.role]);

  if (user?.role !== "admin") return <Navigate to="/settings" replace />;

  const clearRow = async (row) => {
    if (!window.confirm(STALE_SOLD_UNITS_CONFIRMATION)) return;
    const key = `${row.medicine_id}-${row.batch_no}`;
    setClearingKey(key);
    try {
      await api.post("/admin/inventory/stale-sold-units/clear", {
        medicine_id: row.medicine_id,
        batch_no: row.batch_no,
        confirm: true,
      });
      toast.success("Stale sold units cleared and stock restored");
      await loadRows();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setClearingKey(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="stale-sold-units-repair-page">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Settings → Admin Tools</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">Temporary Sold Units Repair</h1>
          <p className="mt-2 max-w-3xl rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Temporary repair tool — remove after inventory cleanup is completed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-sm"><Link to="/settings">Back to Settings</Link></Button>
          <Button onClick={loadRows} disabled={loading} className="rounded-sm bg-blue-600 hover:bg-blue-700"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-sm border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2 font-heading font-semibold"><ShieldAlert className="h-5 w-5 text-red-600" />Stale sold units candidates</div>
          <p className="mt-1 text-sm text-slate-600">Clear only batches verified as stale sold-unit records without a real invoice.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]" data-testid="stale-sold-units-table">
            <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Purchased Units</th><th>Sold Units</th><th>Current Stock</th><th>Stock After Clear</th><th>Reason</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="9" className="py-8 text-center text-slate-500">Loading stale sold units…</td></tr> : rows.length === 0 ? <tr><td colSpan="9" className="py-8 text-center text-slate-500">No stale sold units found.</td></tr> : rows.map((row) => {
                const key = `${row.medicine_id}-${row.batch_no}`;
                return <tr key={key}><td className="font-medium">{row.medicine}</td><td className="font-mono text-xs">{row.batch_no}</td><td>{fmtDate(row.expiry)}</td><td>{row.purchased_units}</td><td>{row.sold_units}</td><td>{row.current_stock}</td><td className="font-semibold text-emerald-700">{row.stock_after_clear}</td><td className="max-w-xs whitespace-normal text-sm text-slate-600">{row.reason}</td><td className="text-right"><Button type="button" size="sm" variant="destructive" disabled={clearingKey === key || row.medicine_id == null || !row.batch_no} onClick={() => clearRow(row)}>Clear Stale Sold Units</Button></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
