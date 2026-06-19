import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export const LOW_STOCK_ACTION_STATUSES = ["Reordered", "Abandoned"];
export const LOW_STOCK_STATUSES = ["Low Stock", ...LOW_STOCK_ACTION_STATUSES];

const styles = {
  "Low Stock": "border-amber-300 bg-amber-100 text-red-700",
  Reordered: "border-blue-300 bg-blue-100 text-blue-800",
  Abandoned: "border-slate-400 bg-slate-800 text-white",
};

export const getLowStockStatus = (item) => {
  const raw = String(item?.low_stock_status || item?.status || "Low Stock").trim().toLowerCase().replace(/[_-]+/g, " ");
  return LOW_STOCK_STATUSES.find((status) => status.toLowerCase() === raw) || "Low Stock";
};

const endpointUnavailable = (error) => [404, 405, 501].includes(error?.response?.status);

export default function LowStockWorkflowControl({ item, onUpdated, compact = false }) {
  const [saving, setSaving] = useState(false);
  const status = getLowStockStatus(item);
  const medicineId = item?.medicine_id || item?.id;

  const updateStatus = async (event) => {
    event.stopPropagation();
    const nextStatus = event.target.value;
    if (!LOW_STOCK_ACTION_STATUSES.includes(nextStatus) || nextStatus === status || !medicineId) return;
    setSaving(true);
    try {
      const normalizedStatus = nextStatus.toLowerCase();
      const { data } = await api.patch(`/api/dashboard/low-stock/${medicineId}/status`, {
        status: normalizedStatus,
      });
      onUpdated?.({ ...item, ...(data || {}), low_stock_status: nextStatus, status_locked: true });
      toast.success(`Low-stock workflow updated to ${nextStatus}`);
    } catch (error) {
      if (endpointUnavailable(error)) {
        toast.error("Dashboard low-stock status updates are not supported by this backend.");
      } else {
        toast.error(`Could not update low-stock workflow: ${formatApiError(error)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!medicineId || item?.status_locked) {
    return <div className={compact ? "text-right" : ""}><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${styles[status]}`}>{status}</span>{item?.status_locked && <p className="mt-1 text-[10px] text-slate-500">Locked after dashboard action</p>}</div>;
  }

  return <select aria-label="Dashboard low-stock status" defaultValue="" disabled={saving} onClick={(event) => event.stopPropagation()} onChange={updateStatus} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60"><option value="" disabled>Choose action</option>{LOW_STOCK_ACTION_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}
