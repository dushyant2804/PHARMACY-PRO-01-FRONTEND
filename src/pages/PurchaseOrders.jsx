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

const roundHalfUp = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(((Number(value) || 0) + Number.EPSILON) * factor) / factor;
};

const roundCurrency = (value) => roundHalfUp(value, 2);

const getPurchaseOrderCalculationSignature = (items, schemeDiscount, cashDiscount) =>
  JSON.stringify({
    items: items.map((item) => ({
      quantity: Number(item.quantity || 0),
      purchase_price: Number(item.purchase_price || 0),
      gst_rate: Number(item.gst_rate || 0),
    })),
    scheme_discount: Number(schemeDiscount || 0),
    cash_discount: Number(cashDiscount || 0),
  });

const calculatePurchaseOrderTotals = (items, schemeDiscount, cashDiscount) => {
  const slabs = new Map();

  items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    const purchasePrice = Number(item.purchase_price || 0);
    const gstRate = Number(item.gst_rate || 0);
    const lineSubtotal = quantity * purchasePrice;

    if (!Number.isFinite(lineSubtotal) || lineSubtotal <= 0) return;

    slabs.set(gstRate, (slabs.get(gstRate) || 0) + lineSubtotal);
  });

  const subTotal = roundCurrency(
    Array.from(slabs.values()).reduce((sum, slabSubtotal) => sum + slabSubtotal, 0)
  );
  const discount = roundCurrency(Number(schemeDiscount || 0) + Number(cashDiscount || 0));

  let taxableTotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;

  slabs.forEach((slabSubtotal, gstRate) => {
    const slabDiscount = subTotal > 0 ? (discount * slabSubtotal) / subTotal : 0;
    const slabTaxable = slabSubtotal - slabDiscount;
    const slabGST = (slabTaxable * gstRate) / 100;

    taxableTotal += slabTaxable;
    totalCGST += roundCurrency(slabGST / 2);
    totalSGST += roundCurrency(slabGST / 2);
  });

  taxableTotal = roundCurrency(taxableTotal);
  totalCGST = roundCurrency(totalCGST);
  totalSGST = roundCurrency(totalSGST);

  const total = roundCurrency(taxableTotal + totalCGST + totalSGST);
  const grandTotal = roundCurrency(Math.round(total));
  const roundOff = roundCurrency(grandTotal - total);

  return {
    subTotal,
    discount,
    taxableTotal,
    totalCGST,
    totalSGST,
    total,
    roundOff,
    grandTotal,
  };
};

const getSavedPurchaseOrderTotals = (po, fallbackTotals) => ({
  ...fallbackTotals,
  subTotal: roundCurrency(firstDefined(po?.sub_total, fallbackTotals.subTotal)),
  totalCGST: roundCurrency(firstDefined(po?.cgst, po?.total_cgst, fallbackTotals.totalCGST)),
  totalSGST: roundCurrency(firstDefined(po?.sgst, po?.total_sgst, fallbackTotals.totalSGST)),
  taxableTotal: roundCurrency(firstDefined(po?.taxable_total, fallbackTotals.taxableTotal)),
  total: roundCurrency(firstDefined(po?.total, fallbackTotals.total)),
  roundOff: roundCurrency(firstDefined(po?.round_off, fallbackTotals.roundOff)),
  grandTotal: roundCurrency(firstDefined(po?.grand_total, fallbackTotals.grandTotal)),
});

const emptyItem = {
  name: "",
  batch_no: "",
  expiry_date: "",
  manufacturer: "",
  category: "OTC",
  quantity: "",
  free_quantity: "",
  purchase_price: 0,
  mrp: 0,
  gst_rate: 5,
  pack_size: "",
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeCollection = (data) => {
  const collection = firstDefined(data?.items, data?.data, data?.results, data, []);
  return Array.isArray(collection) ? collection : [];
};

const normalizeMatchValue = (value) => String(value || "").trim().toLowerCase();

const getMedicineName = (medicine = {}) =>
  firstDefined(medicine.name, medicine.medicine_name, medicine.medicine, "");

const getMedicineId = (medicine = {}, batch = {}) =>
  firstDefined(batch.medicine_id, medicine.id, medicine.medicine_id, medicine.medicineId, "");

const getBatchNumber = (batch = {}) =>
  firstDefined(batch.batch_no, batch.batchNo, batch.batch, batch.batch_number, "");

const getBatchExpiry = (batch = {}) =>
  firstDefined(batch.expiry, batch.expiry_date, batch.expiryDate, "");

const getBatchPurchasePrice = (batch = {}) =>
  firstDefined(batch.purchase_price, batch.purchase_rate, batch.rate, "");

const getBatchPackSize = (batch = {}) =>
  firstDefined(batch.pack_size, batch.packSize, "");

const getBatchGstRate = (batch = {}) =>
  firstDefined(batch.gst_rate, batch.gst, batch.gst_percent, "");

const getBatchManufacturer = (batch = {}, medicine = {}) =>
  firstDefined(batch.manufacturer, medicine.manufacturer, "");

const getBatchCategory = (batch = {}, medicine = {}) =>
  firstDefined(batch.category, medicine.category, "");

const getBatchDistributor = (batch = {}, medicine = {}) =>
  firstDefined(batch.distributor_name, batch.distributor, medicine.distributor_name, medicine.distributor, "");

const normalizeBatchOption = (medicine = {}, batch = {}) => ({
  medicine_id: getMedicineId(medicine, batch),
  medicine_name: getMedicineName(medicine),
  batch_no: getBatchNumber(batch),
  expiry_date: getBatchExpiry(batch),
  mrp: firstDefined(batch.mrp, medicine.mrp, ""),
  purchase_price: getBatchPurchasePrice(batch),
  pack_size: getBatchPackSize(batch),
  gst_rate: getBatchGstRate(batch),
  manufacturer: getBatchManufacturer(batch, medicine),
  category: getBatchCategory(batch, medicine),
  distributor_name: getBatchDistributor(batch, medicine),
});

const buildBatchOptionsForMedicine = (medicine = {}) => {
  const batches = Array.isArray(medicine.batches) ? medicine.batches : [];

  if (batches.length) {
    return batches
      .map((batch) => normalizeBatchOption(medicine, batch))
      .filter((batch) => batch.batch_no);
  }

  const directBatch = normalizeBatchOption(medicine, medicine);
  return directBatch.batch_no ? [directBatch] : [];
};

const batchOptionLabel = (batch) => [
  batch.batch_no,
  batch.expiry_date ? `Exp ${batch.expiry_date}` : "",
  batch.mrp !== "" ? `MRP ₹${batch.mrp}` : "",
  batch.purchase_price !== "" ? `Rate ₹${batch.purchase_price}` : "",
  batch.distributor_name ? `Dist ${batch.distributor_name}` : "",
].filter(Boolean).join(" | ");


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
  const [returnCredits, setReturnCredits] = useState([]);
  const [selectedReturnCredit, setSelectedReturnCredit] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [distId, setDistId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [schemeDiscount, setSchemeDiscount] = useState(0);
  const [cashDiscount, setCashDiscount] = useState(0);
  const [editBaselineSignature, setEditBaselineSignature] = useState(null);
  const [editingPO, setEditingPO] = useState(null);
  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [activeRow, setActiveRow] = useState(null);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
  const [rowMedicines, setRowMedicines] = useState({});
  const [rowBatchOptions, setRowBatchOptions] = useState({});
  const [activeBatchRow, setActiveBatchRow] = useState(null);

  const [poDate, setPoDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [items, setItems] = useState([{ ...emptyItem }]);
  const itemRefs = useRef([]);

  const load = async () => {
    try {
      const [poRes, dRes, returnRes] = await Promise.all([
        api.get("/purchase-orders"),
        api.get("/distributors"),
        api.get("/purchase-returns").catch(() => ({ data: [] })),
      ]);

      setPos(poRes.data || []);
      setDists(dRes.data || []);
      setReturnCredits(normalizeCollection(returnRes.data));
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

  const rememberMedicineBatches = (rowIndex, medicine) => {
    setRowMedicines((prev) => ({ ...prev, [rowIndex]: medicine }));
    setRowBatchOptions((prev) => ({
      ...prev,
      [rowIndex]: buildBatchOptionsForMedicine(medicine),
    }));
  };

  const findMedicineForRow = async (rowIndex) => {
    const row = items[rowIndex];
    const selectedMedicine = rowMedicines[rowIndex];

    if (selectedMedicine && normalizeMatchValue(getMedicineName(selectedMedicine)) === normalizeMatchValue(row?.name)) {
      return selectedMedicine;
    }

    const name = String(row?.name || "").trim();
    if (name.length < 2) return null;

    try {
      const { data } = await api.get(`/medicines?search=${encodeURIComponent(name)}`);
      const medicines = normalizeCollection(data);
      const exactMatch = medicines.find((medicine) =>
        normalizeMatchValue(getMedicineName(medicine)) === normalizeMatchValue(name)
      );

      if (exactMatch) {
        rememberMedicineBatches(rowIndex, exactMatch);
        return exactMatch;
      }
    } catch (e) {
      console.warn("Failed to load medicine batches", e);
    }

    setRowBatchOptions((prev) => ({ ...prev, [rowIndex]: [] }));
    return null;
  };

  const ensureBatchOptionsForRow = async (rowIndex) => {
    const existingOptions = rowBatchOptions[rowIndex];
    if (Array.isArray(existingOptions)) return existingOptions;

    const medicine = await findMedicineForRow(rowIndex);
    return medicine ? buildBatchOptionsForMedicine(medicine) : [];
  };

  const applyMedicineSuggestion = (rowIndex, medicine) => {
    const fields = [
      "manufacturer",
      "category",
      "pack_size",
    ];

    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex], name: getMedicineName(medicine) || next[rowIndex].name };

      fields.forEach((field) => {
        if (medicine[field] !== undefined && medicine[field] !== null) {
          row[field] = medicine[field];
        }
      });

      next[rowIndex] = row;
      return next;
    });

    rememberMedicineBatches(rowIndex, medicine);
    setMedicineSuggestions([]);
    setActiveRow(null);
    setHighlightedSuggestionIndex(0);
  };

  const getFilteredBatchOptions = (rowIndex) => {
    const typedBatch = normalizeMatchValue(items[rowIndex]?.batch_no);
    return (rowBatchOptions[rowIndex] || []).filter((batch) =>
      !typedBatch || normalizeMatchValue(batch.batch_no).includes(typedBatch)
    );
  };

  const applyBatchSuggestion = (rowIndex, batch) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      const preservedQuantity = row.quantity;
      const preservedFreeQuantity = row.free_quantity;

      [
        "batch_no",
        "expiry_date",
        "mrp",
        "purchase_price",
        "pack_size",
        "gst_rate",
        "manufacturer",
        "category",
      ].forEach((field) => {
        if (batch[field] !== undefined && batch[field] !== null && batch[field] !== "") {
          row[field] = batch[field];
        }
      });

      row.quantity = preservedQuantity;
      row.free_quantity = preservedFreeQuantity;
      next[rowIndex] = row;
      return next;
    });

    setActiveBatchRow(null);
  };

  const handleMedicineKeyDown = (event, rowIndex) => {
    if (activeRow !== rowIndex || !medicineSuggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) =>
        Math.min(current + 1, medicineSuggestions.length - 1)
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      const selectedMedicine = medicineSuggestions[highlightedSuggestionIndex];
      if (!selectedMedicine) return;

      event.preventDefault();
      applyMedicineSuggestion(rowIndex, selectedMedicine);
    }
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

  const calculatedTotals = calculatePurchaseOrderTotals(items, schemeDiscount, cashDiscount);
  const currentCalculationSignature = getPurchaseOrderCalculationSignature(
    items,
    schemeDiscount,
    cashDiscount
  );
  const shouldUseSavedTotals =
    editingPO && editBaselineSignature === currentCalculationSignature;
  const displayTotals = shouldUseSavedTotals
    ? getSavedPurchaseOrderTotals(editingPO, calculatedTotals)
    : calculatedTotals;

  const subTotal = displayTotals.subTotal;
  const taxableTotal = displayTotals.taxableTotal;
  const totalCGST = displayTotals.totalCGST;
  const totalSGST = displayTotals.totalSGST;
  const total = displayTotals.total;
  const roundOff = displayTotals.roundOff;
  const grandTotal = displayTotals.grandTotal;
  const selectedCredit = returnCredits.find((credit) => String(credit.id) === String(selectedReturnCredit));
  const purchaseReturnAdjustment = roundCurrency(firstDefined(selectedCredit?.grand_total, selectedCredit?.total, selectedCredit?.return_total, selectedCredit?.amount, 0));
  const finalPayableTotal = roundCurrency(Math.max(0, grandTotal - purchaseReturnAdjustment));

  const openNewPO = () => {
    setEditingPO(null);
    setDistId("");
    setInvoiceRef("");
    setNotes("");
    setPoDate(new Date().toISOString().split("T")[0]);
    setSchemeDiscount(0);
    setCashDiscount(0);
    setEditBaselineSignature(null);
    setSelectedReturnCredit("");
    setItems([{ ...emptyItem }]);
    setMedicineSuggestions([]);
    setRowMedicines({});
    setRowBatchOptions({});
    setActiveRow(null);
    setActiveBatchRow(null);
    setOpen(true);
  };

  const openEditPO = (po) => {
    setEditingPO(po);
    setDistId(po.distributor_id || "");
    setInvoiceRef(po.invoice_ref || "");
    setNotes(po.notes || "");
    setPoDate(po.po_date || new Date().toISOString().split("T")[0]);
    setSchemeDiscount(po.scheme_discount || 0);
    setCashDiscount(po.cash_discount || 0);
    const poItems = (po.items || []).map((i) => ({ ...emptyItem, ...i }));

    setItems(poItems);
    setEditBaselineSignature(
      getPurchaseOrderCalculationSignature(
        poItems,
        po.scheme_discount || 0,
        po.cash_discount || 0
      )
    );
    setRowMedicines({});
    setRowBatchOptions({});
    setActiveBatchRow(null);

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
      round_off: roundOff,

      sub_total: subTotal,
      cgst: totalCGST,
      sgst: totalSGST,
      grand_total: grandTotal,
      items: validItems.map((i) => {
        const item = { ...i };
        delete item.low_stock_threshold;
        delete item.low_stock;

        return {
          ...item,
          quantity: Number(item.quantity || 0),
          free_quantity: Number(item.free_quantity || 0),
          purchase_price: Number(item.purchase_price || 0),
        };
      }),
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
      setSchemeDiscount(0);
      setCashDiscount(0);
      setEditBaselineSignature(null);
      setRowMedicines({});
      setRowBatchOptions({});
      setActiveBatchRow(null);
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

          <Button onClick={openNewPO}>
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
      setRowMedicines((prev) => ({ ...prev, [i]: null }));
      setRowBatchOptions((prev) => ({ ...prev, [i]: undefined }));

      setActiveRow(i);

      if (value.length >= 2) {

        const { data } = await api.get(
          `/medicines?search=${encodeURIComponent(value)}`
        );

        setMedicineSuggestions(normalizeCollection(data));
        setHighlightedSuggestionIndex(0);

      } else {

        setMedicineSuggestions([]);
        setHighlightedSuggestionIndex(0);

      }
    }}
    onKeyDown={(e) => handleMedicineKeyDown(e, i)}
    className={expandInputClass}
  />

  {activeRow === i &&
    medicineSuggestions.length > 0 && (

      <div className="absolute z-50 bg-white border rounded shadow w-full max-h-56 overflow-y-auto">

        {medicineSuggestions.map((m, suggestionIndex) => (

          <div
            key={m.id}
            className={`p-2 cursor-pointer hover:bg-slate-100 ${
              suggestionIndex === highlightedSuggestionIndex ? "bg-blue-50 text-blue-700" : ""
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyMedicineSuggestion(i, m)}
          >
            {m.name}
          </div>

        ))}

      </div>

  )}

</td>

          <td className="p-2 relative min-w-[240px]">
            <Input
              value={it.batch_no}
              onFocus={() => {
                setActiveBatchRow(i);
                ensureBatchOptionsForRow(i);
              }}
              onChange={(e) => {
                updateItem(i, "batch_no", e.target.value);
                setActiveBatchRow(i);
                ensureBatchOptionsForRow(i);
              }}
              onBlur={() => setTimeout(() => setActiveBatchRow(null), 120)}
              placeholder="Type or select batch"
            />

            {activeBatchRow === i && getFilteredBatchOptions(i).length > 0 && (
              <div className="absolute left-2 right-2 z-50 mt-1 bg-white border rounded shadow max-h-56 overflow-y-auto min-w-[320px]">
                {getFilteredBatchOptions(i).map((batch, batchIndex) => (
                  <button
                    type="button"
                    key={`${batch.batch_no}-${batch.expiry_date}-${batch.distributor_name}-${batchIndex}`}
                    className="block w-full text-left p-2 text-xs hover:bg-slate-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyBatchSuggestion(i, batch)}
                  >
                    {batchOptionLabel(batch)}
                  </button>
                ))}
              </div>
            )}
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

  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
    <div className="grid gap-3 md:grid-cols-[1.5fr_.5fr] md:items-end"><div><Label>Apply purchase return credit</Label><select value={selectedReturnCredit} onChange={(e)=>setSelectedReturnCredit(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">No purchase return adjustment</option>{returnCredits.filter((credit)=>!distId||String(credit.distributor_id)===String(distId)).map((credit)=><option key={credit.id} value={credit.id}>{credit.return_no||credit.reference_no||'Purchase return'} · {credit.distributor_name||'Distributor'} · {fmtINR(firstDefined(credit.grand_total,credit.total,credit.return_total,credit.amount,0))}</option>)}</select><p className="mt-1 text-[11px] text-slate-500">Select a recorded return or batch credit—no manual retyping required.</p></div><div className="rounded-lg bg-white p-3 text-right"><div className="text-[10px] uppercase tracking-wider text-slate-500">Return adjustment</div><div className="mt-1 font-bold text-amber-700">− {fmtINR(purchaseReturnAdjustment)}</div></div></div>
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
        value={roundOff.toFixed(2)}
        readOnly
      />
    </div>

    <div>
      <Label>Taxable Total</Label>
      <Input value={taxableTotal.toFixed(2)} readOnly />
    </div>

    <div>
      <Label>Total CGST</Label>
      <Input value={totalCGST.toFixed(2)} readOnly />
    </div>

    <div>
      <Label>Total SGST</Label>
      <Input value={totalSGST.toFixed(2)} readOnly />
    </div>

    <div>
      <Label>Total</Label>
      <Input value={total.toFixed(2)} readOnly />
    </div>

    <div className="md:col-span-2">
      <Label>Final Payable Total</Label>

      <Input
        value={finalPayableTotal.toFixed(2)}
        readOnly
        className="text-xl font-bold text-emerald-700"
      />
    </div>

  </div>

</div>

 
{/* ACTIONS */}
<div className="sticky bottom-0 z-10 bg-white border-t p-4 flex justify-between items-center">

  <div className="space-y-1">
    <div className="text-xs text-slate-500 uppercase tracking-wide">
      Final Payable · after return credit
    </div>

    <div className="text-2xl font-bold text-emerald-700">
      {fmtINR(finalPayableTotal)}
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
