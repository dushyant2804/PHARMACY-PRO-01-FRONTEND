import React, {
  useEffect,
  useState,
} from "react";

import api, {
  fmtINR,
  fmtDate,
  formatApiError,
} from "@/lib/api";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Trash2,
  Eye,
  AlertTriangle,
} from "lucide-react";

import { toast } from "sonner";

export default function Inventory() {

  const [meds, setMeds] = useState([]);

  const [search, setSearch] = useState("");

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const [selected, setSelected] =
    useState(null);

  const load = async () => {

    try {

      const { data } =
        await api.get("/medicines", {
          params: {
            search,
          },
        });

      setMeds(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (e) {

      toast.error(
        formatApiError(e)
      );
    }
  };

  useEffect(() => {

    load();

  }, [search]);

  const openDetails = (m) => {

    setSelected(m);

    setDetailsOpen(true);
  };

  const removeMedicine =
    async (m) => {

      if (
        !window.confirm(
          `Delete ${m.name}?`
        )
      ) return;

      try {

        await api.delete(
          `/medicines/${m.id}`
        );

        toast.success(
          "Medicine deleted"
        );

        setDetailsOpen(false);

        load();

      } catch (e) {

        toast.error(
          formatApiError(e)
        );
      }
    };

  const getExpiryStatus = (
    expiryDate
  ) => {

    if (!expiryDate) {
      return "normal";
    }

    const today = new Date();

    const exp = new Date(
      expiryDate
    );

    const diff =
      Math.ceil(
        (
          exp - today
        ) /
        (
          1000 *
          60 *
          60 *
          24
        )
      );

    if (diff < 0) {
      return "expired";
    }

    if (diff <= 30) {
      return "critical";
    }

    if (diff <= 90) {
      return "warning";
    }

    return "normal";
  };

  return (

    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex justify-between items-center">

        <h1 className="text-2xl font-bold">
          Inventory
        </h1>

      </div>

      {/* SEARCH */}

      <div>

        <Input
          placeholder="Search medicine..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
        />

      </div>

      {/* TABLE */}

      <div className="bg-white border rounded-sm overflow-x-auto">

        <table className="w-full text-sm">

          <thead className="bg-slate-50">

            <tr className="border-b">

              <th className="text-left p-3">
                Name
              </th>

              <th className="text-right p-3">
                Total Stock
              </th>

              <th className="text-center p-3">
                Total Batches
              </th>

              <th className="text-center p-3">
                Expiry
              </th>

              <th className="text-right p-3">
                Purchase
              </th>

              <th className="text-right p-3">
                MRP
              </th>

              <th className="text-center p-3">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {meds.map((m) => {

              const low =

                m.total_stock <=
                Number(
                  m.low_stock_threshold || 10
                );

              const expiryStatus =
                m.batches?.some(
                  (b) =>
                    getExpiryStatus(
                      b.expiry_date
                    ) === "expired"
                )
                  ? "expired"
                  : m.batches?.some(
                      (b) =>
                        getExpiryStatus(
                          b.expiry_date
                        ) === "critical"
                    )
                  ? "critical"
                  : m.batches?.some(
                      (b) =>
                        getExpiryStatus(
                          b.expiry_date
                        ) === "warning"
                    )
                  ? "warning"
                  : "normal";

              return (

                <tr
                  key={m.id}
                  className={`border-b ${
                    expiryStatus === "expired"
                      ? "bg-red-50"
                      : expiryStatus === "critical"
                      ? "bg-orange-50"
                      : expiryStatus === "warning"
                      ? "bg-yellow-50"
                      : ""
                  }`}
                >

                  <td className="p-3 max-w-[250px]">

                    <div className="truncate font-medium">
                      {m.name}
                    </div>

                    <div className="text-xs text-slate-500">
                      {m.manufacturer}
                    </div>

                  </td>

                  <td
                    className={`p-3 text-right font-semibold ${
                      low
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {m.total_stock}
                  </td>

                  <td className="p-3 text-center">
                    {m.batches?.length || 0}
                  </td>

                  <td className="p-3 text-center">

                    {expiryStatus === "expired" && (
                      <span className="text-red-600 font-semibold text-xs flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Expired
                      </span>
                    )}

                    {expiryStatus === "critical" && (
                      <span className="text-orange-600 font-semibold text-xs flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        30 Days
                      </span>
                    )}

                    {expiryStatus === "warning" && (
                      <span className="text-yellow-700 font-semibold text-xs flex items-center justify-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        90 Days
                      </span>
                    )}

                  </td>

                  <td className="p-3 text-right">

                    {fmtINR(
                      m.purchase_price || 0
                    )}

                  </td>

                  <td className="p-3 text-right">

                    {fmtINR(
                      m.mrp || 0
                    )}

                  </td>

                  <td className="p-3 text-center">

                    <button
                      onClick={() =>
                        openDetails(m)
                      }
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >

                      <Eye className="w-4 h-4" />

                      Details

                    </button>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      {/* DETAILS DIALOG */}

      <Dialog
        open={detailsOpen}
        onOpenChange={
          setDetailsOpen
        }
      >

        <DialogContent className="max-w-lg">

          <DialogHeader>

            <DialogTitle>
              Medicine Details
            </DialogTitle>

          </DialogHeader>

          {selected && (

            <div className="space-y-3 text-sm">

              <div className="border rounded p-3">

                <div className="font-semibold mb-3">
                  Batch Details
                </div>

                <div className="space-y-2">

                  {(selected.batches || []).map(
                    (b, idx) => {

                      const expiry =
                        getExpiryStatus(
                          b.expiry_date
                        );

                      return (

                        <div
                          key={idx}
                          className={`border rounded p-2 text-sm ${
                            expiry === "expired"
                              ? "bg-red-50 border-red-200"
                              : expiry === "critical"
                              ? "bg-orange-50 border-orange-200"
                              : expiry === "warning"
                              ? "bg-yellow-50 border-yellow-200"
                              : ""
                          }`}
                        >

                          <div>
                            <b>Batch:</b>
                            {" "}
                            {b.batch_no}
                          </div>

                          <div>
                            <b>Expiry:</b>
                            {" "}
                            {fmtDate(
                              b.expiry_date
                            )}
                          </div>

                          <div
                            className={
                              b.quantity_units <= 0
                                ? "text-red-600 font-semibold"
                                : "text-green-700"
                            }
                          >
                            <b>Stock:</b>
                            {" "}
                            {b.quantity_units}
                          </div>

                          {expiry === "expired" && (
                            <div className="text-red-600 text-xs font-semibold mt-1">
                              EXPIRED
                            </div>
                          )}

                          {expiry === "critical" && (
                            <div className="text-orange-600 text-xs font-semibold mt-1">
                              Expiring within 30 days
                            </div>
                          )}

                          {expiry === "warning" && (
                            <div className="text-yellow-700 text-xs font-semibold mt-1">
                              Expiring within 90 days
                            </div>
                          )}

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <div className="text-slate-500">
                    Name
                  </div>

                  <div className="font-medium">
                    {selected.name}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Manufacturer
                  </div>

                  <div className="font-medium">
                    {selected.manufacturer || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Distributor
                  </div>

                  <div className="font-medium">
                    {selected.distributor_name || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Category
                  </div>

                  <div className="font-medium">
                    {selected.category || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Total Stock
                  </div>

                  <div className="font-medium">
                    {selected.total_stock || 0}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Total Batches
                  </div>

                  <div className="font-medium">
                    {selected.batches?.length || 0}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Purchase Rate
                  </div>

                  <div className="font-medium">
                    {fmtINR(
                      selected.purchase_price || 0
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    MRP
                  </div>

                  <div className="font-medium">
                    {fmtINR(
                      selected.mrp || 0
                    )}
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t">

                <Button
                  variant="destructive"
                  onClick={() =>
                    removeMedicine(
                      selected
                    )
                  }
                  className="w-full"
                >

                  <Trash2 className="w-4 h-4 mr-2" />

                  Delete Medicine

                </Button>

              </div>

            </div>
          )}

        </DialogContent>

      </Dialog>

    </div>
  );
}
