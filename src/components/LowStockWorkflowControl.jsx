import React, { useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

export const LOW_STOCK_STATUSES = ["Low Stock", "Reordered", "Abandoned", "Restocked"];

const styles = {
  "Low Stock": "border-amber-300 bg-amber-100 text-red-700",
  Reordered: "border-blue-300 bg-blue-100 text-blue-800",
  Abandoned: "border-slate-400 bg-slate-800 text-white",
  Restocked: "border-emerald-300 bg-emerald-100 text-emerald-800",
};

export const getLowStockStatus = (item) => {
  const raw = String(item?.low_stock_status || "Low Stock").trim().toLowerCase().replace(/[_-]+/g, " ");
  return LOW_STOCK_STATUSES.find((status) => status.toLowerCase() === raw) || "Low Stock";
};

const endpointUnavailable = (error) => [404, 405, 501].includes(error?.response?.status);

export default function LowStockWorkflowControl({ item, onUpdated, compact = false }) {
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const status = getLowStockStatus(item);
  const medicineId = item?.medicine_id || item?.id;

  const updateStatus = async (event) => {
    event.stopPropagation();
    const nextStatus = event.target.value;
    if (nextStatus === status || !medicineId) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/medicines/${medicineId}/low-stock-status`, {
        low_stock_status: nextStatus,
      });
      onUpdated?.({ ...item, ...(data || {}), low_stock_status: nextStatus });
      toast.success(`Low-stock workflow updated to ${nextStatus}`);
    } catch (error) {
      if (endpointUnavailable(error)) {
        setReadOnly(true);
        toast.error("Low-stock workflow updates are not supported by this backend.");
      } else {
        toast.error(`Could not update low-stock workflow: ${formatApiError(error)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (readOnly || !medicineId) {
    return <div className={compact ? "text-right" : ""}><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${styles[status]}`}>{status}</span><p className="mt-1 text-[10px] text-slate-500">Read-only · backend endpoint unavailable</p></div>;
  }

  return <select aria-label="Low-stock workflow status" value={status} disabled={saving} onClick={(event) => event.stopPropagation()} onChange={updateStatus} className={`rounded-lg border px-2 py-1.5 text-xs font-bold disabled:opacity-60 ${styles[status]}`}>{LOW_STOCK_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}
