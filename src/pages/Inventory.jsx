import React, { useCallback, useEffect, useState } from "react";

import api, { fmtINR, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const getAvailableQty = (item) =>
  Number(
    item?.available_stock ??
      item?.available_units ??
      item?.available_quantity ??
      item?.quantity_units ??
      item?.total_stock ??
      0
  );

const normalizeExpiryStatus = (status) => {
  const value = String(status || "").toLowerCase().replace(/[ -]/g, "_");

  if (["expired", "expiry_expired"].includes(value)) return "expired";
  if (["expiring_soon", "critical", "warning", "near_expiry"].includes(value)) {
    return "expiring_soon";
  }

  return "normal";
};

const getExpiryStatus = (expiry, backendStatus) => {
  const normalizedBackendStatus = normalizeExpiryStatus(backendStatus);
  if (normalizedBackendStatus !== "normal") return normalizedBackendStatus;
  if (!expiry) return "normal";

  const [mm, yy] = expiry.split("/");
  if (!mm || !yy) return "normal";

  const month = Number(mm);
  const year = Number(`20${yy}`);

  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return "normal";
  }

  const expiryMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysToExpiry = Math.ceil(
    (expiryMonthEnd.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= 90) return "expiring_soon";

  return "normal";
};

function DetailItem({ label, value, valueClassName = "" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className={`mt-1 truncate text-sm font-semibold text-slate-800 ${valueClassName}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function SectionCard({ eyebrow, title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
          {eyebrow}
        </div>
        <h3 className="mt-1 text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function Inventory() {
  const [meds, setMeds] = useState([]);
  const [thresholdValue, setThresholdValue] = useState("");
  const [soldUnitsValue, setSoldUnitsValue] = useState("");
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async (selectedId) => {
    try {
      const { data } = await api.get("/medicines", { params: { search } });
      const nextMeds = Array.isArray(data) ? data : [];

      setMeds(nextMeds);
      if (selectedId) {
        const refreshedSelection = nextMeds.find((medicine) => medicine.id === selectedId);
        if (refreshedSelection) setSelected(refreshedSelection);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = (medicine) => {
    setSelected(medicine);
    setThresholdValue(medicine.low_stock_threshold ?? "");
    setSoldUnitsValue(medicine.sold_units ?? medicine.sold_quantity ?? "");
    setDetailsOpen(true);
  };

  const saveMedicine = async () => {
    if (!selected || isSaving) return;

    setIsSaving(true);
    try {
      await Promise.all([
        api.put(`/medicines/${selected.id}/threshold`, {
          low_stock_threshold: thresholdValue === "" ? null : Number(thresholdValue),
        }),
        api.put(`/medicines/${selected.id}/sold`, {
          sold_units: soldUnitsValue === "" ? 0 : Number(soldUnitsValue),
        }),
      ]);

      setSelected((current) =>
        current
          ? {
              ...current,
              low_stock_threshold: thresholdValue === "" ? null : Number(thresholdValue),
              sold_units: soldUnitsValue === "" ? 0 : Number(soldUnitsValue),
            }
          : current
      );
      toast.success("Medicine saved successfully");
      await load(selected.id);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMedicine = async () => {
    if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;

    try {
      await api.delete(`/medicines/${selected.id}`);
      setMeds((current) => current.filter((medicine) => medicine.id !== selected.id));
      setDetailsOpen(false);
      toast.success("Medicine deleted");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const query = search.trim().toLowerCase();
  const visibleMeds = query
    ? meds.filter((medicine) =>
        [medicine.name, medicine.manufacturer, medicine.category].some((value) =>
          String(value || "").toLowerCase().includes(query)
        )
      )
    : meds;

  return (
    <div
      className={`min-w-0 space-y-6 transition-[margin] duration-300 ease-out ${
        detailsOpen ? "md:mr-[55vw] xl:mr-[460px]" : ""
      }`}
    >
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      <Input
        placeholder="Search medicine..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="overflow-x-auto rounded-sm border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Medicine</th>
              <th className="p-3 text-left">Manufacturer</th>
              <th className="p-3 text-right">Total Stock</th>
              <th className="p-3 text-center">Batches</th>
              <th className="p-3 text-center">Category</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {visibleMeds.map((medicine) => {
              const low =
                medicine.low_stock_threshold !== null &&
                medicine.low_stock_threshold !== undefined &&
                getAvailableQty(medicine) <= medicine.low_stock_threshold;
              const batchStatus = (medicine.batches || []).map((batch) =>
                getExpiryStatus(batch.expiry_date, batch.expiry_status)
              );
              const expiryStatus = batchStatus.includes("expired")
                ? "expired"
                : batchStatus.includes("expiring_soon")
                ? "expiring_soon"
                : "normal";
              const isSelected = detailsOpen && selected?.id === medicine.id;

              return (
                <tr
                  key={medicine.id}
                  tabIndex={0}
                  onClick={() => openDetails(medicine)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") openDetails(medicine);
                  }}
                  className={`cursor-pointer border-t transition-colors hover:bg-emerald-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
                    isSelected
                      ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                      : expiryStatus === "expired"
                      ? "bg-red-50"
                      : expiryStatus === "expiring_soon"
                      ? "bg-orange-50"
                      : ""
                  }`}
                >
                  <td className="p-3 font-medium">{medicine.name}</td>
                  <td className="p-3 text-slate-600">{medicine.manufacturer || "-"}</td>
                  <td className={`p-3 text-right font-semibold ${low ? "text-red-600" : ""}`}>
                    {getAvailableQty(medicine)}
                  </td>
                  <td className="p-3 text-center">{medicine.batches?.length || 0}</td>
                  <td className="p-3 text-center">{medicine.category || "-"}</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetails(medicine);
                      }}
                      className="mx-auto flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      <Eye className="h-4 w-4" /> Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <button
            type="button"
            aria-label="Close medicine details"
            onClick={() => setDetailsOpen(false)}
            className={`fixed inset-0 z-40 bg-slate-950/15 transition-opacity duration-300 md:hidden ${
              detailsOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <aside
            aria-label="Medicine details inspector"
            aria-hidden={!detailsOpen}
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-700/20 bg-slate-50/95 shadow-[-20px_0_55px_-28px_rgba(15,23,42,0.65)] backdrop-blur-sm transition-transform duration-300 ease-out md:w-[55vw] xl:w-[460px] ${
              detailsOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
            }`}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-sm">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                  <Boxes className="h-3.5 w-3.5" /> Inventory inspector
                </div>
                <h2 className="mt-2 truncate text-lg font-bold">Medicine Details</h2>
                <p className="mt-0.5 truncate text-xs text-slate-400">Review batches and stock controls</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close inspector</span>
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-28 sm:p-5 sm:pb-28">
              <SectionCard eyebrow="Medicine summary" title={selected.name} className="border-t-2 border-t-emerald-600">
                <p className="-mt-2 mb-4 text-xs text-slate-500">{selected.manufacturer || "Manufacturer not set"}</p>
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
                  <DetailItem label="Category" value={selected.category || "—"} />
                  <DetailItem
                    label="Total stock"
                    value={getAvailableQty(selected)}
                    valueClassName="text-emerald-700"
                  />
                </div>
              </SectionCard>

              <SectionCard eyebrow={`${selected.batches?.length || 0} recorded`} title="Batch Details">
                <div className="space-y-3">
                  {(selected.batches || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No batch details available.
                    </div>
                  )}

                  {(selected.batches || []).map((batch, index) => {
                    const status = getExpiryStatus(batch.expiry_date, batch.expiry_status);
                    const isExpired = status === "expired";
                    const isNearExpiry = status === "expiring_soon";
                    const isEmptyBatch = getAvailableQty(batch) === 0;

                    return (
                      <div
                        key={batch.id || batch.batch_no || index}
                        className={`rounded-lg border p-3 ${
                          isExpired
                            ? "border-red-200 bg-red-50/70"
                            : isNearExpiry
                            ? "border-amber-200 bg-amber-50/70"
                            : "border-slate-200 bg-slate-50/80"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Batch</div>
                            <div className={`truncate font-bold ${isEmptyBatch ? "text-red-700" : "text-slate-900"}`}>
                              {batch.batch_no || "—"}
                            </div>
                          </div>
                          {(isExpired || isNearExpiry || isEmptyBatch) && (
                            <div className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                              isExpired || isEmptyBatch ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              <AlertTriangle className="h-3 w-3" />
                              {isExpired ? "Expired" : isEmptyBatch ? "Empty" : "Expiring soon"}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <DetailItem label="Expiry" value={batch.expiry_date || "—"} />
                          <DetailItem label="Pack size" value={batch.pack_size || "—"} />
                          <DetailItem label="Distributor" value={batch.distributor_name || "—"} />
                          <DetailItem label="Available qty" value={getAvailableQty(batch)} valueClassName={isEmptyBatch ? "text-red-700" : "text-emerald-700"} />
                          <DetailItem label="Purchase rate" value={fmtINR(batch.purchase_price || 0)} />
                          <DetailItem label="MRP" value={fmtINR(batch.mrp || 0)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard eyebrow="Stock management" title="Inventory Controls" className="border-t-2 border-t-amber-500">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700">Low Stock Threshold</span>
                    <Input
                      type="number"
                      min="0"
                      value={thresholdValue}
                      onChange={(event) => setThresholdValue(event.target.value)}
                      className="border-slate-300 bg-white focus-visible:ring-emerald-600"
                    />
                    <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">Alert when available stock reaches this level.</span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700">Sold Quantity</span>
                    <Input
                      type="number"
                      min="0"
                      value={soldUnitsValue}
                      onChange={(event) => setSoldUnitsValue(event.target.value)}
                      className="border-slate-300 bg-white focus-visible:ring-emerald-600"
                    />
                    <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">Recorded sold units for this medicine.</span>
                  </label>
                </div>
              </SectionCard>
            </div>

            <footer className="sticky bottom-0 z-10 grid grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.6)] backdrop-blur sm:px-4">
              <button
                type="button"
                onClick={() => toast.info("Inventory edit panel coming next 😄")}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-xs font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm"
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="truncate">Edit Medicine</span>
              </button>
              <button
                type="button"
                onClick={saveMedicine}
                disabled={isSaving}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-2 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
              >
                <Save className="h-4 w-4 shrink-0" />
                <span className="truncate">{isSaving ? "Saving..." : "Save Medicine"}</span>
              </button>
              <button
                type="button"
                onClick={deleteMedicine}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-2.5 text-xs font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 sm:text-sm"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Delete Medicine</span>
              </button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
