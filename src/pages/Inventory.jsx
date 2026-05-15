import React, { useEffect, useState } from "react";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES, categoryBadgeClass } from "@/lib/categories";
import BarcodeScanner from "@/components/BarcodeScanner";
import Autocomplete from "@/components/Autocomplete";

const emptyForm = {
  name: "", batch_no: "", expiry_date: "", manufacturer: "",
  distributor: "", distributor_id: "",
  purchase_price: "", mrp: "",

  boxes: 0,
  units_per_box: 1,
  loose_units: 0,

  current_boxes: 0,
  current_strips: 0,
  current_loose_units: 0,

  category: "OTC",
  gst_rate: 12,

  barcode: "",
  low_stock_threshold: 10,
};

function CategoryBadge({ cat }) {
  return <span className={`${categoryBadgeClass(cat)} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm whitespace-nowrap`}>{cat}</span>;
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
    api.get("/distributors").then((r) => setDistributors(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

const load = async () => {
  try {
    const params = {};
    if (search) params.search = search;
    if (filterCat !== "all") params.category = filterCat;
    params.sort_by = sortBy;

    const { data } = await api.get("/medicines", { params });

    setMeds(
      (Array.isArray(data) ? data : []).map(m => ({
        ...m,
        boxes: Number(m.boxes || 0),
        units_per_box: Number(m.units_per_box || 1),
        loose_units: Number(m.loose_units || 0),

        current_boxes: Number(m.current_boxes || 0),
        current_strips: Number(m.current_strips || 0),
        current_loose_units: Number(m.current_loose_units || 0),

        low_stock_threshold: Number(m.low_stock_threshold || 10),
        quantity: Number(m.quantity || 0),
      }))
    );
  } catch (e) {
    toast.error(formatApiError(e));
  }
};

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, filterCat, sortBy]);
  useEffect(() => {
  const handleKeyDown = (e) => {
    // Ignore typing inside inputs
    const tag = document.activeElement.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA"
    ) {
      return;
    }

    // F2 → Open Add Medicine
    if (e.key === "F2") {
      e.preventDefault();
      openNew();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);
useEffect(() => {
  const handleKeyDown = (e) => {
    // Ctrl + / → Focus search
    if (e.ctrlKey && e.key === "/") {
      e.preventDefault();

      document
        .querySelector('[data-testid="inventory-search"]')
        ?.focus();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
 const openEdit = (m) => {
  setEditing(m);

  const safe = {
    ...emptyForm,
    ...m,

    boxes: Number(m.boxes || 0),
    units_per_box: Number(m.units_per_box || 1),
    loose_units: Number(m.loose_units || 0),

    current_boxes: Number(m.current_boxes || 0),
    current_strips: Number(m.current_strips || 0),
    current_loose_units: Number(m.current_loose_units || 0),
  };

  setForm(safe);
  setOpen(true);
};
  const save = async (e) => {
    e.preventDefault();
    const boxes = Number(form.boxes || 0);
    const upb = Math.max(Number(form.units_per_box || 1), 1);
    const loose = Number(form.loose_units || 0);
    const totalQty = boxes * upb + loose;
    const payload = {
      ...form, 
      boxes, units_per_box: upb, loose_units: loose,
      current_boxes: Number(form.current_boxes || 0),
      current_strips: Number(form.current_strips || 0),
      current_loose_units: Number(form.current_loose_units || 0),
      quantity: totalQty,
      purchase_price: Number(form.purchase_price),
      mrp: Number(form.mrp),
      gst_rate: Number(form.gst_rate),
      low_stock_threshold: Number(form.low_stock_threshold),
      distributor_id: form.distributor_id || null,
      auto_ledger: !editing,
    };
    if (totalQty <= 0) return toast.error("Total stock must be at least 1 (boxes × units/box + loose)");
    try {
      if (editing) {
        await api.put(`/medicines/${editing.id}`, payload);
        toast.success("Medicine updated");
      } else {
        await api.post("/medicines", payload);
        toast.success(form.distributor_id
          ? "Medicine added & distributor ledger updated"
          : "Medicine added");
      }
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete ${m.name}?`)) return;
    try {
      await api.delete(`/medicines/${m.id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const daysToExpiry = (d) => {
    try { return Math.ceil((new Date(d) - new Date()) / 86400000); } catch { return null; }
  };

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Stock</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">Inventory</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={() => setScanOpen(true)} variant="outline" className="rounded-sm" data-testid="scan-barcode-btn">
              <ScanLine className="w-4 h-4 mr-2" />Scan
            </Button>
            <Button onClick={openNew} className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-medicine-btn">
              <Plus className="w-4 h-4 mr-2" />Add Medicine
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="pl-9 rounded-sm border-slate-300"
              data-testid="inventory-search"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-40 rounded-sm" data-testid="filter-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="expiry_date">Sort: Expiry</SelectItem>
              <SelectItem value="quantity">Sort: Quantity</SelectItem>
              <SelectItem value="mrp">Sort: Price</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Manufacturer</th>
                <th>Distributor</th>
                <th>Category</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Purchase</th>
                <th className="text-right">MRP</th>
                {canEdit && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {meds.length === 0 && (
                <tr><td colSpan={canEdit ? 10 : 9} className="text-center py-8 text-slate-500">No medicines. Click "Add Medicine" to begin.</td></tr>
              )}
              {meds.map((m) => {
                const dte = daysToExpiry(m.expiry_date);

                const currentQty =
                (Number(m.current_boxes || 0) * Number(m.units_per_box || 1)) +
                 Number(m.current_loose_units || 0);

                const low = currentQty <= (m.low_stock_threshold || 10);
                return (
                  <tr key={m.id}>
                    <td className="font-medium text-slate-900">{m.name}</td>
                    <td className="font-mono-nums text-xs">{m.batch_no}</td>
                    <td className={`font-mono-nums text-xs ${dte != null && dte < 60 ? (dte < 0 ? "text-red-600" : "text-amber-600") : ""}`}>
                      {fmtDate(m.expiry_date)}
                    </td>
                    <td className="text-slate-700">{m.manufacturer}</td>
                    <td className="text-slate-700">{m.distributor}</td>
                    <td><CategoryBadge cat={m.category} /></td>
                    <td className={`num-cell ${low ? "text-red-600 font-bold" : ""}`}>{currentQty}</td>
                    <td className="num-cell text-slate-600">{fmtINR(m.purchase_price)}</td>
                    <td className="num-cell">{fmtINR(m.mrp)}</td>
                    {canEdit && (
                      <td className="text-right">
                        <button onClick={() => openEdit(m)} className="p-1 text-slate-500 hover:text-blue-600" data-testid={`edit-${m.id}`}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(m)} className="p-1 text-slate-500 hover:text-red-600 ml-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto pr-1" data-testid="medicine-form">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Medicine Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 rounded-sm" data-testid="form-name" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Batch No. *</Label>
              <Input required value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })}
                className="mt-1 rounded-sm" data-testid="form-batch_no" />
            </div>
            <div>
  <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">
    Expiry (MM/YY) *
  </Label>

  <Input
    required
    placeholder="08/27"
    value={form.expiry_display || ""}
    onChange={(e) => {
      let value = e.target.value;

      // Allow only numbers and /
      value = value.replace(/[^0-9/]/g, "");

      // Auto add slash
      if (value.length === 2 && !value.includes("/")) {
        value += "/";
      }

      // Save display value
      let updatedForm = {
        ...form,
        expiry_display: value,
      };

      // Convert MM/YY → YYYY-MM-01
      if (value.length === 5) {
        const [month, year] = value.split("/");

        if (
          Number(month) >= 1 &&
          Number(month) <= 12
        ) {
          updatedForm.expiry_date = `20${year}-${month}-01`;
        }
      }

      setForm(updatedForm);
    }}
    className="mt-1 rounded-sm"
    data-testid="form-expiry_date"
  />
</div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Manufacturer *</Label>
              <Input required value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="mt-1 rounded-sm" data-testid="form-manufacturer" />
            </div>

            {/* Distributor with autocomplete */}
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Distributor *</Label>
              <Autocomplete
                value={form.distributor}
                onChange={(text, item) => setForm({ ...form, distributor: text, distributor_id: item?.id || "" })}
                options={distributors.map((d) => ({ id: d.id, label: d.name, value: d.name }))}
                placeholder="Type to search…"
                className="mt-1 rounded-sm"
                testId="form-distributor"
                required
              />
              {form.distributor && !form.distributor_id && (
                <div className="text-[11px] text-amber-700 mt-1">⚠ Not linked to a distributor record — ledger won't auto-update. <a href="/distributors" className="underline">Add distributor</a> first to link.</div>
              )}
            </div>

            {/* Box / Unit tracking */}
            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-sm p-3">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-2">Stock (Box & Unit)</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-500">Boxes</Label>
                  <Input type="number" min="0" value={form.boxes}
                    onChange={(e) => setForm({ ...form, boxes: e.target.value })}
                    className="mt-1 rounded-sm" data-testid="form-boxes" />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Units per Box</Label>
                  <Input type="number" min="1" value={form.units_per_box}
                    onChange={(e) => setForm({ ...form, units_per_box: e.target.value })}
                    className="mt-1 rounded-sm" data-testid="form-units_per_box" />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Loose Units</Label>
                  <Input type="number" min="0" value={form.loose_units}
                    onChange={(e) => setForm({ ...form, loose_units: e.target.value })}
                    className="mt-1 rounded-sm" data-testid="form-loose_units" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">

  <div className="col-span-full">
    <h3 className="font-semibold text-sm text-slate-700">
      Current Stock Situation
    </h3>
  </div>

  <div>
    <Label className="text-[11px] text-slate-500">
      Current Boxes
    </Label>

    <Input
      type="number"
      min="0"
      value={form.current_boxes}
      onChange={(e) =>
        setForm({
          ...form,
          current_boxes: e.target.value
        })
      }
      className="mt-1 rounded-sm"
    />
  </div>

  <div>
    <Label className="text-[11px] text-slate-500">
      Current Strips
    </Label>

    <Input
      type="number"
      min="0"
      value={form.current_strips}
      onChange={(e) =>
        setForm({
          ...form,
          current_strips: e.target.value
        })
      }
      className="mt-1 rounded-sm"
    />
  </div>

  <div>
    <Label className="text-[11px] text-slate-500">
      Current Loose Tablets
    </Label>

    <Input
      type="number"
      min="0"
      value={form.current_loose_units}
      onChange={(e) =>
        setForm({
          ...form,
          current_loose_units: e.target.value
        })
      }
      className="mt-1 rounded-sm"
    />
  </div>

</div>
              </div>
              <div className="mt-2 text-xs text-slate-700">
                Total stock = <span className="font-mono-nums font-bold text-blue-700">
                  {Number(form.boxes || 0) * Math.max(Number(form.units_per_box || 1), 1) + Number(form.loose_units || 0)}
                </span> units
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Purchase Price (per unit) *</Label>
              <Input type="number" step="0.01" required value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                className="mt-1 rounded-sm" data-testid="form-purchase_price" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">MRP (per unit) *</Label>
              <Input type="number" step="0.01" required value={form.mrp}
                onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                className="mt-1 rounded-sm" data-testid="form-mrp" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">GST %</Label>
              <Input type="number" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                className="mt-1 rounded-sm" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Low-stock alert</Label>
              <Input type="number" value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                className="mt-1 rounded-sm" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Barcode</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="mt-1 rounded-sm" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-slate-600">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1 rounded-sm" data-testid="form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancel</Button>
              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="save-medicine">
                {editing ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={async (code) => {
          setScanOpen(false);
          try {
            const { data } = await api.get(`/medicines/lookup/${encodeURIComponent(code)}`);
            setEditing(data);
            setForm(data);
            setOpen(true);
            toast.success(`Found: ${data.name}`);
          } catch {
            setEditing(null);
            setForm({ ...emptyForm, barcode: code });
            setOpen(true);
            toast.info("New barcode — fill details to add");
          }
        }}
      />
    </div>
  );
}
