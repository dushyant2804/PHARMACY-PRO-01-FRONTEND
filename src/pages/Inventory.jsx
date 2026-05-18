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

              <th className="text-left p-3">
                Batch
              </th>

              <th className="text-left p-3">
                Expiry
              </th>

              <th className="text-right p-3">
                Qty
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

              const qty =

                Number(
                  m.purchased_units || 0
                )

                -

                Number(
                  m.sold_units || 0
                );

              const low =

                qty <=
                Number(
                  m.low_stock_threshold || 10
                );

              return (

                <tr
                  key={m.id}
                  className="border-b"
                >

                  <td className="p-3 max-w-[250px]">

                    <div className="truncate font-medium">
                      {m.name}
                    </div>

                  </td>

                  <td className="p-3">
                    {m.batch_no}
                  </td>

                  <td className="p-3">

                    {fmtDate(
                      m.expiry_date
                    )}

                  </td>

                  <td
                    className={`p-3 text-right font-semibold ${
                      low
                        ? "text-red-600"
                        : ""
                    }`}
                  >
                    {qty}
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
                    Batch
                  </div>

                  <div className="font-medium">
                    {selected.batch_no}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Distributor
                  </div>

                  <div className="font-medium">
                    {selected.distributor || "-"}
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
                    Pack Size
                  </div>

                  <div className="font-medium">
                    {selected.pack_size || "-"}
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
                    Purchased
                  </div>

                  <div className="font-medium">
                    {selected.purchased_units || 0}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Sold
                  </div>

                  <div className="font-medium">
                    {selected.sold_units || 0}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Current Stock
                  </div>

                  <div className="font-medium">
                    {
                      Number(
                        selected.purchased_units || 0
                      )

                      -

                      Number(
                        selected.sold_units || 0
                      )
                    }
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">
                    Low Stock Alert
                  </div>

                  <div className="font-medium">
                    {
                      selected.low_stock_threshold
                    }
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
