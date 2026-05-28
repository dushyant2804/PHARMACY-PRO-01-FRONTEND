import React, { useEffect, useState, useRef } from "react";

import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Plus,
  Trash2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";

/* ---------------- UI helpers ---------------- */

const requiredLabel = (text) => (
  <span>
    {text} <span className="text-red-600">*</span>
  </span>
);

const expandInputClass =
  "transition-all duration-150 focus:w-[260px] w-[140px]";

const emptyItem = {
  name: "",
  batch_no: "",
  expiry_date: "",
  manufacturer: "",
  category: "OTC",
  quantity: 1,
  free_quantity: 0,
  purchase_price: 0,
  mrp: 0,
  gst_rate: 5,
  pack_size: "",
  sold_units: 0,
  low_stock_threshold: 10,
};

const itemFields = [
  { key: "name", label: "Name", required: true },
  { key: "batch_no", label: "Batch", required: true },
  { key: "expiry_date", label: "Expiry", type: "date", required: true },
  { key: "quantity", label: "Qty", type: "number" },
  { key: "free_quantity", label: "Free", type: "number" },
  { key: "purchase_price", label: "Purchase", type: "number", required: true },
  { key: "mrp", label: "MRP", type: "number" },
];

export default function PurchaseOrders() {
  const navigate = useNavigate();

  const [pos, setPos] = useState([]);
  const [dists, setDists] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [distId, setDistId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [editingPO, setEditingPO] = useState(null);

  const [poDate, setPoDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [items, setItems] = useState([{ ...emptyItem }]);
  const itemRefs = useRef([]);

  const load = async () => {
    try {
      const [poRes, dRes] = await Promise.all([
        api.get("/purchase-orders"),
        api.get("/distributors"),
      ]);

      setPos(poRes.data || []);
      setDists(dRes.data || []);
    } catch (e) {
      toast.error("Failed to load purchase orders");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateItem = (i, key, value) => {
    const copy = [...items];
    copy[i][key] = value;
    setItems(copy);
  };

  const addRow = () => {
    const next = [...items, { ...emptyItem }];
    setItems(next);

    setTimeout(() => {
      itemRefs.current[next.length - 1]?.focus();
    }, 120);
  };

  const removeRow = (i) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const total = items.reduce((sum, i) => {
    return sum + Number(i.quantity || 0) * Number(i.purchase_price || 0);
  }, 0);

  const openEditPO = (po) => {
    setEditingPO(po);
    setDistId(po.distributor_id || "");
    setInvoiceRef(po.invoice_ref || "");
    setNotes(po.notes || "");
    setPoDate(po.po_date || new Date().toISOString().split("T")[0]);

    setItems((po.items || []).map((i) => ({ ...emptyItem, ...i })));

    setOpen(true);
  };

  const deletePO = async (po) => {
    if (!window.confirm(`Delete ${po.po_no}?`)) return;

    try {
      await api.delete(`/purchase-orders/${po.id}`);
      setPos((prev) => prev.filter((p) => p.id !== po.id));
      toast.success("PO deleted");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    const d = dists.find((x) => String(x.id) === String(distId));
    if (!d) return toast.error("Select distributor");

    const validItems = items.filter(
      (i) => i.name && i.batch_no && i.expiry_date
    );

    if (!validItems.length)
      return toast.error("Add at least one item");

    const payload = {
      distributor_id: d.id,
      distributor_name: d.name,
      invoice_ref: invoiceRef || "",
      notes: notes || "",
      po_date: poDate,
      items: validItems.map((i) => ({
        ...i,
        quantity: Number(i.quantity || 0),
        free_quantity: Number(i.free_quantity || 0),
        purchase_price: Number(i.purchase_price || 0),
      })),
    };

    setSaving(true);

    try {
      let res;

      if (editingPO) {
        res = await api.put(`/purchase-orders/${editingPO.id}`, payload);
        setPos((prev) =>
          prev.map((p) => (p.id === editingPO.id ? res.data : p))
        );
        toast.success("PO updated");
      } else {
        res = await api.post("/purchase-orders", payload);
        setPos((prev) => [res.data, ...prev]);
        toast.success("PO created");
      }

      setOpen(false);
      setEditingPO(null);
      setItems([{ ...emptyItem }]);
      setDistId("");
      setInvoiceRef("");
      setNotes("");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>

          <h1 className="text-2xl font-bold">Purchase Orders</h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New PO
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Date</th>
              <th>Distributor</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {pos.map((p) => (
              <tr key={p.id}>
                <td>{p.po_no}</td>
                <td>{fmtDate(p.po_date || p.created_at)}</td>
                <td>{p.distributor_name}</td>
                <td>{fmtINR(p.total)}</td>
                <td>
                  <div className="flex gap-3">
                    <button className="text-blue-600" onClick={() => openEditPO(p)}>
                      Edit
                    </button>
                    <button className="text-red-600" onClick={() => deletePO(p)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPO ? "Edit Purchase Order" : "New Purchase Order"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">

            {/* BASIC FIELDS */}
            <div className="grid grid-cols-4 gap-3">

              <div>
                <Label>{requiredLabel("Distributor")}</Label>
                <select
                  className="border p-2 w-full"
                  value={distId}
                  onChange={(e) => setDistId(e.target.value)}
                >
                  <option value="">Select</option>
                  {dists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Invoice Ref</Label>
                <Input
                  className={expandInputClass}
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                />
              </div>

              <div>
                <Label>{requiredLabel("PO Date")}</Label>
                <Input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  className={expandInputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* ITEMS TABLE */}
<div className="border rounded overflow-x-auto">

  <table className="w-full text-sm min-w-[1800px]">

    <thead className="bg-slate-100">
      <tr className="text-left">

        <th className="p-2">Name*</th>
        <th className="p-2">Batch No*</th>
        <th className="p-2">Expiry*</th>
        <th className="p-2">Manufacturer*</th>
        <th className="p-2">Category*</th>
        <th className="p-2">Qty*</th>
        <th className="p-2">Free Qty</th>
        <th className="p-2">Purchase*</th>
        <th className="p-2">MRP*</th>
        <th className="p-2">GST %*</th>
        <th className="p-2">Pack Size</th>
        <th className="p-2">Sold Units</th>
        <th className="p-2">Low Stock*</th>
        <th className="p-2">Action</th>

      </tr>
    </thead>

    <tbody>

      {items.map((it, i) => (

        <tr key={i} className="border-t hover:bg-slate-50">

          <td className="p-2">
            <Input
              value={it.name}
              onChange={(e) => updateItem(i, "name", e.target.value)}
              className={expandInputClass}
            />
          </td>

          <td className="p-2">
            <Input
              value={it.batch_no}
              onChange={(e) => updateItem(i, "batch_no", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="date"
              value={it.expiry_date}
              onChange={(e) => updateItem(i, "expiry_date", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              value={it.manufacturer}
              onChange={(e) => updateItem(i, "manufacturer", e.target.value)}
            />
          </td>

          <td className="p-2">
            <select
              className="border p-2 rounded w-full"
              value={it.category}
              onChange={(e) => updateItem(i, "category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.quantity}
              onChange={(e) => updateItem(i, "quantity", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.free_quantity}
              onChange={(e) => updateItem(i, "free_quantity", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.purchase_price}
              onChange={(e) => updateItem(i, "purchase_price", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.mrp}
              onChange={(e) => updateItem(i, "mrp", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.gst_rate}
              onChange={(e) => updateItem(i, "gst_rate", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              value={it.pack_size}
              onChange={(e) => updateItem(i, "pack_size", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.sold_units}
              onChange={(e) => updateItem(i, "sold_units", e.target.value)}
            />
          </td>

          <td className="p-2">
            <Input
              type="number"
              value={it.low_stock_threshold}
              onChange={(e) =>
                updateItem(i, "low_stock_threshold", e.target.value)
              }
            />
          </td>

          <td className="p-2">
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-red-600 font-bold"
            >
              ✕
            </button>
          </td>

        </tr>

      ))}

    </tbody>

  </table>

  {/* FOOTER */}
  <div className="flex justify-between items-center p-3 border-t bg-slate-50">

    <Button type="button" onClick={addRow}>
      <Plus className="w-4 h-4 mr-1" />
      Add Row
    </Button>

    <div className="text-lg font-bold">
      Total: {fmtINR(total)}
    </div>

  </div>

</div>

                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <Button type="button" onClick={addRow}>
                <Plus className="w-4 h-4 mr-1" />
                Add Row
              </Button>

              <div className="text-right font-bold">
                Total: {fmtINR(total)}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save PO"}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
