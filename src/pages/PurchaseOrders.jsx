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
};


const normalizeExpiryStatus = (status) => {
  const value = String(status || "").toLowerCase().replace(/[ -]/g, "_");

  if (["expired", "expiry_expired"].includes(value)) return "expired";
  if (["expiring_soon", "critical", "warning", "near_expiry"].includes(value)) {
    return "expiring_soon";
  }
  if (["valid", "safe", "normal"].includes(value)) return "valid";

  return "";
};

const getExpiryStatus = (expiry, backendStatus) => {
  const normalizedBackendStatus = normalizeExpiryStatus(backendStatus);
  if (normalizedBackendStatus) return normalizedBackendStatus;
  if (!expiry) return "";

  const [mm, yy] = expiry.split("/");
  if (!mm || !yy) return "";

  const month = Number(mm);
  const year = Number(`20${yy}`);

  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return "invalid";
  }

  const expiryMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysToExpiry = Math.ceil(
    (expiryMonthEnd.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= 90) return "expiring_soon";

  return "valid";
};

const getExpiryInputClass = (item) => {
  const status = getExpiryStatus(item.expiry_date, item.expiry_status);

  if (status === "expired" || status === "invalid") return "border-red-500";
  if (status === "expiring_soon") return "border-orange-500";
  if (status === "valid") return "border-green-500";

  return "";
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
  const [schemeDiscount, setSchemeDiscount] = useState(0);
  const [cashDiscount, setCashDiscount] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [editingPO, setEditingPO] = useState(null);
  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [activeRow, setActiveRow] = useState(null);

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

  const applyMedicineSuggestion = (rowIndex, medicine) => {
    const fields = [
      "name",
      "manufacturer",
      "category",
      "pack_size",
    ];

    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };

      fields.forEach((field) => {
        if (medicine[field] !== undefined && medicine[field] !== null) {
          row[field] = medicine[field];
        }
      });

      next[rowIndex] = row;
      return next;
    });

    setMedicineSuggestions([]);
    setActiveRow(null);
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

  const subTotal = total;

const totalGST = items.reduce((sum, i) => {
  const qty = Number(i.quantity || 0);
  const price = Number(i.purchase_price || 0);
  const gst = Number(i.gst_rate || 0);

  return sum + ((qty * price) * gst) / 100;
}, 0);

const totalCGST = totalGST / 2;
const totalSGST = totalGST / 2;

const grandTotal =
  subTotal -
  Number(schemeDiscount || 0) -
  Number(cashDiscount || 0) +
  totalGST +
  Number(roundOff || 0);

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
      scheme_discount: Number(schemeDiscount || 0),
      cash_discount: Number(cashDiscount || 0),
      round_off: Number(roundOff || 0),

      sub_total: subTotal,
      cgst: totalCGST,
      sgst: totalSGST,
      grand_total: grandTotal,
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
                <td>{fmtINR(p.grand_total || p.total || 0)}</td>
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
        <th className="p-2">Action</th>

      </tr>
    </thead>

    <tbody>

      {items.map((it, i) => (

        <tr key={i} className="border-t hover:bg-slate-50">

         <td className="p-2 relative">

  <Input
    ref={(el) => (itemRefs.current[i] = el)}
    value={it.name}
    onChange={async (e) => {

      const value = e.target.value;

      updateItem(i, "name", value);

      setActiveRow(i);

      if (value.length >= 2) {

        const { data } = await api.get(
          `/medicines?search=${value}`
        );

        setMedicineSuggestions(data);

      } else {

        setMedicineSuggestions([]);

      }
    }}
    className={expandInputClass}
  />

  {activeRow === i &&
    medicineSuggestions.length > 0 && (

      <div className="absolute z-50 bg-white border rounded shadow w-full max-h-56 overflow-y-auto">

        {medicineSuggestions.map((m) => (

          <div
            key={m.id}
            className="p-2 cursor-pointer hover:bg-slate-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMedicineSuggestion(i, m)}
          >
            {m.name}
          </div>

        ))}

      </div>

  )}

</td>

          <td className="p-2">
            <Input
              value={it.batch_no}
              onChange={(e) => updateItem(i, "batch_no", e.target.value)}
            />
          </td>

          <td className="p-2">
  <Input
    placeholder="MM/YY"
    value={it.expiry_date}
    maxLength={5}

    className={`w-[90px] ${getExpiryInputClass(it)}`}

    onChange={(e) => {
      let v = e.target.value.replace(/\D/g, "");

      if (v.length > 4)
        v = v.slice(0, 4);

      if (v.length >= 3) {
        v = v.slice(0, 2) + "/" + v.slice(2);
      }

      const month = Number(v.slice(0, 2));

      if (month > 12) return;

      updateItem(i, "expiry_date", v);

      // AUTO TAB AFTER MMYY
      if (v.length === 5) {
        const next =
          e.target
            .closest("td")
            ?.nextElementSibling
            ?.querySelector("input");

        next?.focus();
      }
    }}
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

   {/* TABLE CONTROLS */}
<div className="flex justify-start p-3 border-t bg-slate-50">

  <Button type="button" onClick={addRow}>
    <Plus className="w-4 h-4 mr-1" />
    Add Row
  </Button>

</div>

  {/* BILL SUMMARY */}
<div className="border-t bg-slate-50 p-4">

  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

    <div>
      <Label>Sub Total</Label>
      <Input value={subTotal.toFixed(2)} readOnly />
    </div>

    <div>
      <Label>Scheme Discount</Label>
      <Input
        type="number"
        value={schemeDiscount}
        onChange={(e) =>
          setSchemeDiscount(e.target.value)
        }
      />
    </div>

    <div>
      <Label>Cash Discount</Label>
      <Input
        type="number"
        value={cashDiscount}
        onChange={(e) =>
          setCashDiscount(e.target.value)
        }
      />
    </div>

    <div>
      <Label>Round Off</Label>
      <Input
        type="number"
        step="0.01"
        value={roundOff}
        onChange={(e) =>
          setRoundOff(parseFloat(e.target.value || 0))
        }
      />
    </div>

    <div>
      <Label>Total CGST</Label>
      <Input value={totalCGST.toFixed(2)} readOnly />
    </div>

    <div>
      <Label>Total SGST</Label>
      <Input value={totalSGST.toFixed(2)} readOnly />
    </div>

    <div className="md:col-span-2">
      <Label>Grand Total</Label>

      <Input
        value={grandTotal.toFixed(2)}
        readOnly
        className="text-xl font-bold text-blue-700"
      />
    </div>

  </div>

</div>

 
{/* ACTIONS */}
<div className="sticky bottom-0 z-10 bg-white border-t p-4 flex justify-between items-center">

  <div className="space-y-1">
    <div className="text-xs text-slate-500 uppercase tracking-wide">
      Grand Total
    </div>

    <div className="text-2xl font-bold text-blue-700">
      {fmtINR(grandTotal)}
    </div>
  </div>

  <div className="flex gap-2">

    <Button
      type="button"
      variant="outline"
      onClick={() => setOpen(false)}
    >
      Cancel
    </Button>

    <Button
      type="submit"
      disabled={saving}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      {saving
        ? "Saving..."
        : editingPO
        ? "Update PO"
        : "Save PO"}
    </Button>

  </div>

</div>

</div>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
