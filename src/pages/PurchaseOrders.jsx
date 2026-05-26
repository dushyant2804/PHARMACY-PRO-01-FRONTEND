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

import { Plus, Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";

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
    setItems([...items, { ...emptyItem }]);
  };

  const removeRow = (i) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  const total = items.reduce(
    (sum, i) =>
      sum + Number(i.purchase_price || 0) * Number(i.quantity || 0),
    0
  );

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
      items: validItems,
    };

    setSaving(true);

    try {
      let res;

      if (editingPO) {
        res = await api.put(
          `/purchase-orders/${editingPO.id}`,
          payload
        );

        setPos((prev) =>
          prev.map((p) =>
            p.id === editingPO.id ? res.data : p
          )
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

          <h1 className="text-2xl font-bold">
            Purchase Orders
          </h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setEditingPO(null);
              setItems([{ ...emptyItem }]);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            New PO
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th>
              <th>Date</th>
              <th>Distributor</th>
              <th>Total</th>
              <th></th>
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
                  <button onClick={() => setOpen(true)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>
              {editingPO ? "Edit PO" : "New PO"}
            </DialogTitle>
          </DialogHeader>

          {/* 🔥 THIS WAS MISSING BEFORE — FULL FORM RESTORED */}
          <form onSubmit={submit} className="space-y-4">

            <div className="grid grid-cols-3 gap-3">

              <div>
                <Label>Distributor</Label>
                <Select value={distId} onValueChange={setDistId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dists.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Invoice Ref</Label>
                <Input
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                />
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              </div>

            </div>

            {/* ITEMS TABLE */}
            <div className="border rounded overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <Input
                          value={it.name}
                          onChange={(e) =>
                            updateItem(i, "name", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <Input
                          value={it.batch_no}
                          onChange={(e) =>
                            updateItem(i, "batch_no", e.target.value)
                          }
                        />
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

  const total = items.reduce(
    (sum, i) =>
      sum +
      Number(i.purchase_price || 0) *
        Number(i.quantity || 0),
    0
  );

  const openEditPO = (po) => {
    setEditingPO(po);
    setDistId(po.distributor_id || "");
    setInvoiceRef(po.invoice_ref || "");
    setNotes(po.notes || "");
    setPoDate(po.po_date || new Date().toISOString().split("T")[0]);

    setItems(
      (po.items || []).map((i) => ({
        ...emptyItem,
        ...i,
      }))
    );

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
      items: validItems,
    };

    setSaving(true);

    try {
      let res;

      if (editingPO) {
        res = await api.put(
          `/purchase-orders/${editingPO.id}`,
          payload
        );

        setPos((prev) =>
          prev.map((p) =>
            p.id === editingPO.id ? res.data : p
          )
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

          <h1 className="text-2xl font-bold">
            Purchase Orders
          </h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setEditingPO(null);
              setItems([{ ...emptyItem }]);
              setOpen(true);
            }}
          >
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
                    <button
                      className="text-blue-600"
                      onClick={() => openEditPO(p)}
                    >
                      Edit
                    </button>

                    <button
                      className="text-red-600"
                      onClick={() => deletePO(p)}
                    >
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

            {/* TOP FORM */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Distributor</Label>
                <Select value={distId} onValueChange={setDistId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dists.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Invoice</Label>
                <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
              </div>

              <div>
                <Label>Date</Label>
                <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
              </div>

              <div>
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {/* ITEM TABLE (FULL RESTORED) */}
            <div className="border rounded overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Mfr</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Free</th>
                    <th>Pack</th>
                    <th>Sold</th>
                    <th>Purchase</th>
                    <th>MRP</th>
                    <th>GST%</th>
                    <th>Low</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <Input
                          className="focus:min-w-[250px] transition-all duration-150"
                          ref={(el) => (itemRefs.current[i] = el)}
                          value={it.name}
                          onChange={(e) => updateItem(i, "name", e.target.value)}
                        />
                      </td>

                      <td>
                        <Input value={it.batch_no} onChange={(e) => updateItem(i, "batch_no", e.target.value)} />
                      </td>

                      <td>
                        <Input type="date" value={it.expiry_date} onChange={(e) => updateItem(i, "expiry_date", e.target.value)} />
                      </td>

                      <td>
                        <Input value={it.manufacturer} onChange={(e) => updateItem(i, "manufacturer", e.target.value)} />
                      </td>

                      <td>
                        <Select value={it.category} onValueChange={(v) => updateItem(i, "category", v)}>
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
                      </td>

                      <td>
                        <Input type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input type="number" value={it.free_quantity} onChange={(e) => updateItem(i, "free_quantity", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input value={it.pack_size} onChange={(e) => updateItem(i, "pack_size", e.target.value)} />
                      </td>

                      <td>
                        <Input type="number" value={it.sold_units} onChange={(e) => updateItem(i, "sold_units", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input type="number" value={it.purchase_price} onChange={(e) => updateItem(i, "purchase_price", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input type="number" value={it.mrp} onChange={(e) => updateItem(i, "mrp", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input type="number" value={it.gst_rate} onChange={(e) => updateItem(i, "gst_rate", Number(e.target.value))} />
                      </td>

                      <td>
                        <Input type="number" value={it.low_stock_threshold} onChange={(e) => updateItem(i, "low_stock_threshold", Number(e.target.value))} />
                      </td>

                      <td>
                        <button type="button" onClick={() => removeRow(i)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 flex justify-between border-t">
                <Button type="button" variant="outline" onClick={addRow}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Row
                </Button>

                <div className="text-lg font-bold">
                  Total: {fmtINR(total)}
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingPO ? "Update PO" : "Create PO"}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
