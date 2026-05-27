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

const expandInputClass =
  "transition-all duration-150 focus:min-w-[250px] focus:z-20 focus:relative";

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

  // ✅ FIXED: safe numeric calculation
  const total = items.reduce((sum, i) => {
    const qty = Number(i.quantity || 0);
    const price = Number(i.purchase_price || 0);
    return sum + qty * price;
  }, 0);

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
        quantity: Number(i.quantity || 0),
        free_quantity: Number(i.free_quantity || 0),
        purchase_price: Number(i.purchase_price || 0),
        expiry_date: i.expiry_date || "",
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

      // ✅ IMPORTANT: normalized numeric values sent
      items: validItems.map((i) => ({
        ...i,
        quantity: Number(i.quantity || 0),
        free_quantity: Number(i.free_quantity || 0),
        purchase_price: Number(i.purchase_price || 0),
        mrp: Number(i.mrp || 0),
        gst_rate: Number(i.gst_rate || 0),
        sold_units: Number(i.sold_units || 0),
        low_stock_threshold: Number(i.low_stock_threshold || 10),
      })),
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
      {/* unchanged UI below */}
