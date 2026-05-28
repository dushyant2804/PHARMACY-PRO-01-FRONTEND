import React, { useEffect, useState } from "react";

import api, { fmtINR, formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const [meds, setMeds] = useState([]);
  const [search, setSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/medicines", {
        params: { search },
      });

      setMeds(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const openDetails = (m) => {
    setSelected(m);
    setDetailsOpen(true);
  };

  const getExpiryStatus = (expiry) => {
    if (!expiry) return "normal";

    const [mm, yy] = expiry.split("/");
    if (!mm || !yy) return "normal";

    const exp = new Date(Number(`20${yy}`), Number(mm) - 1, 1);
    const today = new Date();

    const diffMonths =
      (exp.getFullYear() - today.getFullYear()) * 12 +
      (exp.getMonth() - today.getMonth());

    if (diffMonths < 0) return "expired";
    if (diffMonths <= 1) return "critical";
    if (diffMonths <= 3) return "warning";

    return "normal";
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      <Input
        placeholder="Search medicine..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-white border rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-right p-3">Stock</th>
              <th className="text-center p-3">Batches</th>
              <th className="text-center p-3">Expiry</th>
              <th className="text-right p-3">Purchase</th>
              <th className="text-right p-3">MRP</th>
              <th className="text-center p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {meds.map((m) => {
              const low =
                m.total_stock <= Number(m.low_stock_threshold || 10);

              const batchStatus = (m.batches || []).map((b) =>
                getExpiryStatus(b.expiry_date)
              );

              const expiryStatus =
                batchStatus.includes("expired")
                  ? "expired"
                  : batchStatus.includes("critical")
                  ? "critical"
                  : batchStatus.includes("warning")
                  ? "warning"
                  : "normal";

              return (
                <tr
                  key={m.id}
                  className={
                    expiryStatus === "expired"
                      ? "bg-red-50"
                      : expiryStatus === "critical"
                      ? "bg-orange-50"
                      : expiryStatus === "warning"
                      ? "bg-yellow-50"
                      : ""
                  }
                >
                  <td className="p-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-500">
                      {m.manufacturer}
                    </div>
                  </td>

                  <td
                    className={`p-3 text-right font-semibold ${
                      low ? "text-red-600" : ""
                    }`}
                  >
                    {m.total_stock}
                  </td>

                  <td className="p-3 text-center">
                    {m.batches?.length || 0}
                  </td>

                  <td className="p-3 text-center">
                    {expiryStatus === "expired" && (
                      <span className="text-red-600 flex items-center gap-1 justify-center">
                        <AlertTriangle className="w-4 h-4" /> Expired
                      </span>
                    )}

                    {expiryStatus === "critical" && (
                      <span className="text-orange-600 flex items-center gap-1 justify-center">
                        <AlertTriangle className="w-4 h-4" /> Soon
                      </span>
                    )}

                    {expiryStatus === "warning" && (
                      <span className="text-yellow-600 flex items-center gap-1 justify-center">
                        <AlertTriangle className="w-4 h-4" /> Warning
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-right">
                    {fmtINR(m.purchase_price || 0)}
                  </td>

                  <td className="p-3 text-right">
                    {fmtINR(m.mrp || 0)}
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => openDetails(m)}
                      className="text-blue-600 flex items-center gap-1 mx-auto"
                    >
                      <Eye className="w-4 h-4" /> Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DETAILS POPUP */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Medicine Details</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">

              {/* TOP INFO */}
              <div className="border p-3 rounded bg-slate-50">
                <div className="font-semibold text-lg">
                  {selected.name}
                </div>

                <div className="text-xs text-slate-500">
                  {selected.manufacturer}
                </div>

                <div className="text-xs text-slate-600 mt-1">
                  <div><b>Category:</b> {selected.category || "-"}</div>
                  <div><b>Distributor:</b> {selected.distributor_name || "-"}</div>
                </div>

                <div className="mt-2 text-sm">
                  <div><b>Total Stock:</b> {selected.total_stock}</div>
                  <div><b>Purchase:</b> {fmtINR(selected.purchase_price)}</div>
                  <div><b>MRP:</b> {fmtINR(selected.mrp)}</div>
                </div>
              </div>

              {/* BATCHES */}
              <div className="border p-3 rounded">
                <div className="font-semibold mb-2">
                  Batch Details
                </div>

                {(selected.batches || []).map((b, i) => {
                  const status = getExpiryStatus(b.expiry_date);
                  const isExpired = status === "expired";
                  const isNearExpiry = status === "critical" || status === "warning";
                  const isEmptyBatch = Number(b.quantity_units || 0) === 0;

                  return (
                    <div
                      key={i}
                      className={`border p-2 rounded mb-2 ${
                        isExpired
                          ? "bg-red-100 border-red-300"
                          : isNearExpiry
                          ? "bg-orange-100 border-orange-300"
                          : "bg-white"
                      }`}
                    >
                      <div>
                        <b>Batch:</b>{" "}
                        <span className={isEmptyBatch ? "text-red-600 font-bold" : ""}>
                          {b.batch_no}
                        </span>
                      </div>

                      <div>
                        <b>Expiry:</b> {b.expiry_date}
                      </div>

                      <div>
                        <b>Pack Size:</b> {b.pack_size || "-"}
                      </div>

                      <div>
                        <b>Available:</b>{" "}
                        <span className={isEmptyBatch ? "text-red-600 font-bold" : ""}>
                          {b.quantity_units}
                        </span>
                      </div>

                      {isExpired && (
                        <div className="text-red-700 font-semibold">
                          EXPIRED
                        </div>
                      )}

                      {!isExpired && isNearExpiry && (
                        <div className="text-orange-700 font-semibold">
                          Expiring Soon
                        </div>
                      )}

                      {isEmptyBatch && (
                        <div className="text-red-600 font-semibold">
                          EMPTY STOCK
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
  <button
    onClick={async () => {
      if (!window.confirm(`Delete ${selected.name}?`))
        return;

      try {
        await api.delete(`/medicines/${selected.id}`);

        setMeds((prev) =>
          prev.filter((x) => x.id !== selected.id)
        );

        setDetailsOpen(false);

        toast.success("Medicine deleted");

      } catch (e) {
        toast.error(formatApiError(e));
      }
    }}
    className="bg-red-600 text-white px-4 py-2 rounded"
  >
    Delete Medicine
  </button>
</div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
