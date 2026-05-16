import React, { useEffect, useState } from "react";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES } from "@/lib/categories";
import BarcodeScanner from "@/components/BarcodeScanner";
import Autocomplete from "@/components/Autocomplete";

const emptyForm = {
  name: "",
  batch_no: "",
  expiry_date: "",
  manufacturer: "",
  distributor: "",
  distributor_id: "",

  purchase_price: "",
  mrp: "",

  pack_size: "",

  // ONLY STOCK SOURCE
  quantity_units: 0,

  category: "OTC",
  gst_rate: 12,
  barcode: "",
  low_stock_threshold: 10,
};

function CategoryBadge({ cat }) {
  return (
    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-sm">
      {cat}
    </span>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "pharmacist";

  const [meds, setMeds] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [scanOpen, setScanOpen] = useState(false);
  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    api.get("/distributors")
      .then((r) => setDistributors(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const load = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCat !== "all") params.category = filterCat;
      params.sort_by = sortBy;

      const { data } = await api.get("/medicines", { params });

      setMeds(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => { load(); }, [search, filterCat, sortBy]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      ...emptyForm,
      ...m,
      quantity_units: Number(m.quantity_units || 0),
    });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      quantity_units: Number(form.quantity_units || 0),
      purchase_price: Number(form.purchase_price),
      mrp: Number(form.mrp),
      gst_rate: Number(form.gst_rate),
      low_stock_threshold: Number(form.low_stock_threshold),
      distributor_id: form.distributor_id || null,
      auto_ledger: !editing,
    };

    if (payload.quantity_units <= 0) {
      return toast.error("Stock must be greater than 0");
    }

    try {
      if (editing) {
        await api.put(`/medicines/${editing.id}`, payload);
        toast.success("Medicine updated");
      } else {
        await api.post("/medicines", payload);
        toast.success("Medicine added");
      }

      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete ${m.name}?`)) return;
    try {
      await api.delete(`/medicines/${m.id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Inventory</h1>

        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Add Medicine
          </Button>
        )}
      </div>

      {/* SEARCH */}
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-sm">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th>Qty</th>
              <th>MRP</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {meds.map((m) => {
              const qty = Number(m.quantity_units || 0);
              const low = qty <= Number(m.low_stock_threshold || 10);

              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.batch_no}</td>
                  <td>{fmtDate(m.expiry_date)}</td>

                  <td className={low ? "text-red-600 font-bold" : ""}>
                    {qty}
                  </td>

                  <td>{fmtINR(m.mrp)}</td>

                  <td>
                    <button onClick={() => openEdit(m)}>Edit</button>
                    <button onClick={() => remove(m)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FORM */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Medicine" : "Add Medicine"}
            </DialogTitle>
          </DialogHeader>

<form onSubmit={save} className="grid grid-cols-2 gap-4">

  <div>
    <Label>Medicine Name</Label>
    <Input
      value={form.name}
      onChange={(e) =>
        setForm({ ...form, name: e.target.value })
      }
    />
  </div>

  <div>
    <Label>Batch Number</Label>
    <Input
      value={form.batch_no}
      onChange={(e) =>
        setForm({ ...form, batch_no: e.target.value })
      }
    />
  </div>

  <div>
    <Label>Expiry Date</Label>
    <Input
      type="date"
      value={form.expiry_date}
      onChange={(e) =>
        setForm({ ...form, expiry_date: e.target.value })
      }
    />
  </div>

  <div>
    <Label>Manufacturer</Label>
    <Input
      value={form.manufacturer}
      onChange={(e) =>
        setForm({ ...form, manufacturer: e.target.value })
      }
    />
  </div>

  <div className="col-span-2">
    <Label>Distributor</Label>

    <Autocomplete
      value={form.distributor}
      onChange={(text, item) =>
        setForm({
          ...form,
          distributor: text,
          distributor_id: item?.id || "",
        })
      }
      options={distributors.map((d) => ({
        id: d.id,
        label: d.name,
        value: d.name,
      }))}
      placeholder="Search distributor..."
    />
  </div>

  <div>
    <Label>Purchase Price</Label>
    <Input
      type="number"
      step="0.01"
      value={form.purchase_price}
      onChange={(e) =>
        setForm({
          ...form,
          purchase_price: e.target.value,
        })
      }
    />
  </div>

  <div>
    <Label>MRP</Label>
    <Input
      type="number"
      step="0.01"
      value={form.mrp}
      onChange={(e) =>
        setForm({
          ...form,
          mrp: e.target.value,
        })
      }
    />
  </div>

  <div>
    <Label>Purchased Units</Label>

    <Input
      type="number"
      min="0"
      value={form.purchased_units || 0}
      onChange={(e) =>
        setForm({
          ...form,
          purchased_units: e.target.value,
        })
      }
    />
  </div>

  <div>
    <Label>Low Stock Alert</Label>

    <Input
      type="number"
      min="0"
      value={form.low_stock_threshold}
      onChange={(e) =>
        setForm({
          ...form,
          low_stock_threshold: e.target.value,
        })
      }
    />
  </div>

  <div>
    <Label>GST %</Label>

    <Input
      type="number"
      value={form.gst_rate}
      onChange={(e) =>
        setForm({
          ...form,
          gst_rate: e.target.value,
        })
      }
    />
  </div>

  <div>
    <Label>Barcode</Label>

    <Input
      value={form.barcode}
      onChange={(e) =>
        setForm({
          ...form,
          barcode: e.target.value,
        })
      }
    />
  </div>

  <div className="col-span-2">
    <Label>Category</Label>

    <Select
      value={form.category}
      onValueChange={(v) =>
        setForm({
          ...form,
          category: v,
        })
      }
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="col-span-2 flex justify-end gap-2 pt-2">

    <Button
      type="button"
      variant="outline"
      onClick={() => setOpen(false)}
    >
      Cancel
    </Button>

    <Button type="submit">
      {editing ? "Update Medicine" : "Add Medicine"}
    </Button>

  </div>

</form>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
      />
    </div>
  );
}
