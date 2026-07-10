import React, { useCallback, useEffect, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLayout } from "@/contexts/LayoutContext";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useDebouncedValue from "@/hooks/useDebouncedValue";

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getAvailableQty = (item) =>
  Number(
    firstDefined(
      item?.available_stock,
      item?.available_units,
      item?.available_quantity,
      item?.quantity_units,
      item?.total_stock,
      item?.current_stock,
      item?.stock,
      item?.quantity,
      0,
    ),
  );

export const getInventoryLots = (medicine) => {
  const lots = firstDefined(
    medicine?.stock_lots,
    medicine?.stockLots,
    medicine?.lots,
    medicine?.inventory_lots,
    medicine?.batches,
    [],
  );

  if (!Array.isArray(lots)) return [];

  const activeLots = lots.filter((lot) => lot && typeof lot === "object");
  const normalizedLots = [];
  activeLots.forEach((lot) => {
    const nestedBatches = firstDefined(lot.batches, lot.stock_lots, lot.lots);
    if (Array.isArray(nestedBatches) && nestedBatches.length > 0) {
      nestedBatches.forEach((batch) => {
        if (!batch || typeof batch !== "object") return;
        normalizedLots.push({
          ...lot,
          ...batch,
          distributor_id: firstDefined(
            batch.distributor_id,
            lot.distributor_id,
          ),
          distributor_name: firstDefined(
            batch.distributor_name,
            batch.distributor,
            lot.distributor_name,
            lot.distributor,
            lot.supplier_name,
            lot.supplier,
          ),
        });
      });
      return;
    }

    normalizedLots.push(lot);
  });

  return normalizedLots;
};

export const getInventoryLotCount = (medicine) => {
  const backendCount = firstDefined(
    medicine?.lot_count,
    medicine?.stock_lot_count,
    medicine?.stockLotCount,
    medicine?.batch_count,
    medicine?.batchCount,
  );

  if (backendCount !== undefined) return Number(backendCount) || 0;
  return getInventoryLots(medicine).length;
};

const getBatchNumber = (lot) =>
  firstDefined(lot?.batch_no, lot?.batch_number, lot?.batchNo, lot?.batch, "—");
const getDistributorName = (lot) =>
  firstDefined(
    lot?.distributor_name,
    lot?.distributor,
    lot?.supplier_name,
    lot?.supplier,
    "—",
  );
const getExpiryDate = (lot) =>
  firstDefined(lot?.expiry_date, lot?.expiry, lot?.expiryDate, "—");
const getPurchaseRate = (lot) =>
  firstDefined(lot?.purchase_rate, lot?.purchase_price, lot?.rate, 0);
const getActualCost = (lot) =>
  firstDefined(lot?.actual_cost, 0);

const normalizeExpiryStatus = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .replace(/[ -]/g, "_");

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

  if (
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12
  ) {
    return "normal";
  }

  const expiryMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const daysToExpiry = Math.ceil(
    (expiryMonthEnd.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= 90) return "expiring_soon";

  return "normal";
};

const categoryStyles = {
  OTC: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  "SCHEDULE H": "bg-amber-100 text-amber-900 ring-amber-600/30",
  H: "bg-amber-100 text-amber-800 ring-amber-600/20",
  "SCHEDULE H1": "bg-red-900 text-white ring-red-950/30",
  H1: "bg-red-900 text-white ring-red-950/30",
  "SCHEDULE X": "bg-slate-950 text-white ring-slate-950/40",
  X: "bg-slate-950 text-white ring-slate-950/30",
  NRX: "bg-slate-950 text-white ring-slate-950/30",
  "SCHEDULE G": "bg-indigo-100 text-indigo-900 ring-indigo-600/30",
  G: "bg-purple-100 text-purple-800 ring-purple-600/20",
};

function CategoryBadge({ category }) {
  const key = String(category || "")
    .trim()
    .toUpperCase();
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ring-1 ring-inset ${categoryStyles[key] || "bg-slate-100 text-slate-700 ring-slate-500/20"}`}
    >
      {category || "Uncategorized"}
    </span>
  );
}

const normalizeHealth = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[ _-]/g, "");
const getHealthStatus = (item) => {
  const backend = normalizeHealth(
    item?.inventory_status ?? item?.stock_status ?? item?.status,
  );
  if (["expired"].includes(backend)) return "Expired";
  if (["soldout", "outofstock", "empty"].includes(backend)) return "Sold Out";
  if (["critical"].includes(backend)) return "Critical";
  if (["lowstock", "low"].includes(backend)) return "Low Stock";
  if (["healthy", "instock", "normal"].includes(backend)) return "Healthy";
  if (getExpiryStatus(item?.expiry_date, item?.expiry_status) === "expired")
    return "Expired";
  const stock = getAvailableQty(item);
  if (stock <= 0) return "Sold Out";
  const threshold = Number(item?.low_stock_threshold);
  if (
    item?.low_stock_threshold !== null &&
    item?.low_stock_threshold !== undefined &&
    Number.isFinite(threshold)
  ) {
    if (stock <= Math.max(1, Math.floor(threshold / 2))) return "Critical";
    if (stock <= threshold) return "Low Stock";
  }
  return "Healthy";
};

const healthStyles = {
  Healthy: "bg-emerald-100 text-emerald-800",
  "Low Stock": "bg-amber-100 text-amber-800",
  Critical: "bg-red-100 text-red-800",
  "Sold Out": "bg-slate-900 text-white",
  Expired: "bg-purple-100 text-purple-800",
};
function HealthBadge({ item }) {
  const status = getHealthStatus(item);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${healthStyles[status]}`}
    >
      {status}
    </span>
  );
}

function DetailItem({ label, value, valueClassName = "" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold text-slate-800 ${valueClassName}`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  children,
  className = "",
  headerAction = null,
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
            {eyebrow}
          </div>
          <h3 className="mt-1 truncate text-sm font-bold text-slate-900">
            {title}
          </h3>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function Inventory() {
  const [meds, setMeds] = useState([]);
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdUnlocked, setThresholdUnlocked] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [privacyPassword, setPrivacyPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const { setInspectorMode } = useLayout();
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setInspectorMode(detailsOpen);

    return () => setInspectorMode(false);
  }, [detailsOpen, setInspectorMode]);

  const load = useCallback(
    async (selectedId) => {
      try {
        const { data } = await api.get("/medicines", { params: { search: debouncedSearch } });
        const nextMeds = Array.isArray(data) ? data : [];

        setMeds(nextMeds);
        if (selectedId) {
          const refreshedSelection = nextMeds.find(
            (medicine) => medicine.id === selectedId,
          );
          if (refreshedSelection) setSelected(refreshedSelection);
        }
      } catch (e) {
        toast.error(formatApiError(e));
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openDetails = async (medicine) => {
    setSelected(medicine);
    setThresholdValue(medicine?.low_stock_threshold ?? "");
    setThresholdUnlocked(false);
    setUnlockOpen(false);
    setPrivacyPassword("");
    setDetailsOpen(true);

    try {
      const { data } = await api.get(`/medicines/${medicine.id}`);
      const detail = data?.medicine || data?.data || data;
      if (detail && typeof detail === "object") {
        setSelected((current) =>
          current?.id === medicine.id ? { ...current, ...detail } : current,
        );
      }
    } catch (e) {
      console.warn("Could not load medicine inventory details", e);
    }
  };

  const refreshSelectedMedicine = (updated) => {
    setSelected(updated);
    setThresholdValue(updated?.low_stock_threshold ?? "");
    setMeds((current) =>
      current.map((medicine) =>
        medicine.id === updated.id ? { ...medicine, ...updated } : medicine,
      ),
    );
  };

  const saveThreshold = async () => {
    if (!selected) return;
    const value = Number(thresholdValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid low stock threshold.");
      return;
    }

    setThresholdSaving(true);
    try {
      const payload = { low_stock_threshold: value, threshold: value };
      const { data } = await api.patch(
        `/medicines/${selected.id}/low-stock-threshold`,
        payload,
      );
      const updated = {
        ...selected,
        ...(data || {}),
        low_stock_threshold:
          data?.low_stock_threshold ?? data?.threshold ?? value,
      };
      refreshSelectedMedicine(updated);
      setThresholdUnlocked(false);
      toast.success("Low stock threshold saved and locked.");
      await load(selected.id);
    } catch (e) {
      toast.error(`Could not save low stock threshold: ${formatApiError(e)}`);
    } finally {
      setThresholdSaving(false);
    }
  };

  const unlockThreshold = async (event) => {
    event.preventDefault();
    if (!selected || !privacyPassword) return;

    setUnlocking(true);
    try {
      await api.post(`/medicines/${selected.id}/low-stock-threshold/unlock`, {
        privacy_password: privacyPassword,
      });
      setThresholdUnlocked(true);
      setUnlockOpen(false);
      setPrivacyPassword("");
      toast.success("Threshold unlocked. You can edit it now.");
    } catch (e) {
      toast.error(
        `Privacy password could not unlock threshold: ${formatApiError(e)}`,
      );
    } finally {
      setUnlocking(false);
    }
  };

  const renderThresholdControl = () => {
    if (!selected) return null;

    const thresholdMissing =
      selected.low_stock_threshold === null ||
      selected.low_stock_threshold === undefined;
    const inputId = thresholdMissing
      ? "low-stock-threshold"
      : "low-stock-threshold-edit";

    return (
      <div
        className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-xs sm:w-auto sm:justify-end"
        data-testid="inventory-low-stock-threshold-section"
      >
        <Label
          htmlFor={thresholdMissing || thresholdUnlocked ? inputId : undefined}
          className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-amber-800"
        >
          Threshold:
        </Label>
        {thresholdMissing || thresholdUnlocked ? (
          <>
            <Input
              id={inputId}
              data-testid={
                thresholdMissing
                  ? "low-stock-threshold-input"
                  : "low-stock-threshold-edit-input"
              }
              type="number"
              min="0"
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
              placeholder="10"
              aria-label="Low stock threshold"
              className="h-8 w-20 bg-white px-2 text-sm"
            />
            <Button
              type="button"
              onClick={saveThreshold}
              disabled={thresholdSaving}
              className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
              data-testid={
                thresholdMissing
                  ? "set-threshold-button"
                  : "save-threshold-button"
              }
            >
              {thresholdSaving
                ? "Saving..."
                : thresholdMissing
                  ? "Set"
                  : "Save"}
            </Button>
          </>
        ) : (
          <>
            <span
              className="text-sm font-extrabold text-slate-900"
              data-testid="locked-low-stock-threshold"
            >
              {selected.low_stock_threshold}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-600"
              data-testid="threshold-lock-indicator"
            >
              <Lock className="h-3 w-3" /> Locked
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnlockOpen(true)}
              className="h-8 px-3 text-xs"
              data-testid="unlock-threshold-button"
            >
              <Unlock className="mr-1 h-3.5 w-3.5" /> Unlock
            </Button>
          </>
        )}
      </div>
    );
  };

  const deleteMedicine = async () => {
    if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;

    try {
      await api.delete(`/medicines/${selected.id}`);
      setMeds((current) =>
        current.filter((medicine) => medicine.id !== selected.id),
      );
      setDetailsOpen(false);
      toast.success("Medicine deleted");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const query = debouncedSearch.trim().toLowerCase();
  const visibleMeds = query
    ? meds.filter((medicine) =>
        [
          medicine.name,
          medicine.manufacturer,
          medicine.category,
          ...(medicine.batches || []).map((batch) => batch.batch_no),
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        ),
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

      <div className="relative max-w-3xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-10"
          placeholder="Search medicine, batch, manufacturer, or category..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Medicine</th>
              <th className="p-3 text-left">Manufacturer</th>
              <th className="p-3 text-right">Total Stock</th>
              <th className="p-3 text-center">Stock Lots</th>
              <th className="p-3 text-center">Category</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {visibleMeds.map((medicine) => {
              const low =
                medicine.low_stock_threshold !== null &&
                medicine.low_stock_threshold !== undefined &&
                getAvailableQty(medicine) <= medicine.low_stock_threshold;
              const batchStatus = getInventoryLots(medicine).map((batch) =>
                getExpiryStatus(getExpiryDate(batch), batch.expiry_status),
              );

              let expiryStatus = "normal";

              if (
                batchStatus.length > 0 &&
                batchStatus.every((status) => status === "expired")
              ) {
                expiryStatus = "expired";
              } else if (
                batchStatus.length > 0 &&
                batchStatus.every(
                 (status) =>
                  status === "expired" || status === "expiring_soon"
                )
              ) {
                expiryStatus = "expiring_soon";
              }
              const isSelected = detailsOpen && selected?.id === medicine.id;

              return (
                <tr
                  key={medicine.id}
                  tabIndex={0}
                  onClick={() => openDetails(medicine)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      openDetails(medicine);
                  }}
                  className={`cursor-pointer border-t transition-colors hover:bg-emerald-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 ${
                    isSelected
                      ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                      : expiryStatus === "expired"
                        ? "border-l-4 border-l-red-700 bg-red-100 text-red-950"
                        : expiryStatus === "expiring_soon"
                          ? "border-l-4 border-l-orange-600 bg-orange-100 text-orange-950"
                          : ""
                  }`}
                >
                  <td className="p-3 font-medium">{medicine.name}</td>
                  <td className="p-3 text-slate-600">
                    {medicine.manufacturer || "-"}
                  </td>
                  <td
                    className={`p-3 text-right font-semibold ${low ? "text-red-600" : ""}`}
                  >
                    {getAvailableQty(medicine)}
                  </td>
                  <td className="p-3 text-center">
                    {getInventoryLotCount(medicine)}
                  </td>
                  <td className="p-3 text-center">
                    <CategoryBadge category={medicine.category} />
                  </td>
                  <td className="p-3 text-center">
                    <HealthBadge item={medicine} />
                  </td>
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
              detailsOpen
                ? "translate-x-0"
                : "pointer-events-none translate-x-full"
            }`}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-sm">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                  <Boxes className="h-3.5 w-3.5" /> Inventory inspector
                </div>
                <h2 className="mt-2 truncate text-lg font-bold">
                  Medicine Details
                </h2>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  Review stock lots and stock controls
                </p>
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
              <SectionCard
                eyebrow="Medicine summary"
                title="Medicine Details"
                className="border-t-2 border-t-emerald-600"
                headerAction={renderThresholdControl()}
              >
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3">
                  <DetailItem label="Medicine name" value={selected.name} />
                  <DetailItem
                    label="Manufacturer"
                    value={selected.manufacturer || "Manufacturer not set"}
                  />
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Category
                    </div>
                    <CategoryBadge category={selected.category} />
                  </div>
                  <DetailItem
                    label="Current stock"
                    value={getAvailableQty(selected)}
                    valueClassName={
                      getAvailableQty(selected) > 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }
                  />
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </div>
                    <HealthBadge item={selected} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                eyebrow={`${getInventoryLotCount(selected)} recorded`}
                title="Stock Lot Details"
              >
                <div className="space-y-3">
                  {getInventoryLots(selected).length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No stock lot details available.
                    </div>
                  )}

                  {getInventoryLots(selected).map((batch, index) => {
                    const status = getExpiryStatus(
                      getExpiryDate(batch),
                      batch.expiry_status,
                    );
                    const isExpired = status === "expired";
                    const isNearExpiry = status === "expiring_soon";
                    const isEmptyBatch = getAvailableQty(batch) === 0;

                    return (
                      <div
                        key={
                          batch.id ||
                          batch.lot_id ||
                          `${getBatchNumber(batch)}-${
                            batch.distributor_id || getDistributorName(batch)
                          }-${index}`
                        }
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
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Stock lot batch
                            </div>
                            <div
                              className={`truncate font-bold ${isEmptyBatch ? "text-red-700" : "text-slate-900"}`}
                            >
                              {getBatchNumber(batch)}
                            </div>
                          </div>
                          {isExpired || isNearExpiry || isEmptyBatch ? (
                            <div
                              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                                isExpired || isEmptyBatch
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {isExpired
                                ? "Expired"
                                : isEmptyBatch
                                  ? "Empty"
                                  : "Expiring soon"}
                            </div>
                          ) : (
                            <HealthBadge item={batch} />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <DetailItem
                            label="Expiry"
                            value={getExpiryDate(batch)}
                          />
                          <DetailItem
                            label="Pack size"
                            value={firstDefined(
                              batch.pack_size,
                              batch.packSize,
                              "—",
                            )}
                          />
                          <DetailItem
                            label="Distributor"
                            value={getDistributorName(batch)}
                          />
                          <DetailItem
                            label="Available qty"
                            value={getAvailableQty(batch)}
                            valueClassName={
                              isEmptyBatch ? "text-red-700" : "text-emerald-700"
                            }
                          />
                          <DetailItem
                            label="Base Cost"
                            value={fmtINR(getPurchaseRate(batch))}
                          />

                          <DetailItem
                            label="Actual Cost"
                            value={fmtINR(getActualCost(batch))}
                          />

                          <DetailItem
                            label="MRP"
                            value={fmtINR(firstDefined(batch.mrp, 0))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            <footer className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-4 py-3">
              <button
                type="button"
                onClick={() =>
                  toast.info("Inventory edit panel coming next 😄")
                }
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700"
              >
                <Pencil className="h-4 w-4" /> Edit Medicine
              </button>
              <button
                type="button"
                onClick={deleteMedicine}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700"
              >
                <Trash2 className="h-4 w-4" /> Delete Medicine
              </button>
            </footer>
          </aside>
          <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
            <DialogContent
              className="rounded-sm max-w-md"
              data-testid="threshold-unlock-modal"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> Unlock
                  low stock threshold
                </DialogTitle>
                <DialogDescription>
                  Enter the Privacy Password to edit this locked threshold.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={unlockThreshold} className="space-y-4">
                <div>
                  <Label htmlFor="privacy-password">Privacy Password</Label>
                  <Input
                    id="privacy-password"
                    data-testid="privacy-password-input"
                    type="password"
                    value={privacyPassword}
                    onChange={(event) => setPrivacyPassword(event.target.value)}
                    autoComplete="current-password"
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={unlocking || !privacyPassword}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {unlocking ? "Unlocking..." : "Unlock Threshold"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
