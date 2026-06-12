import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Trash2,
  AlertTriangle,
  ScanLine,
  Boxes,
  CornerDownLeft,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BarcodeScanner from "@/components/BarcodeScanner";
import Autocomplete from "@/components/Autocomplete";
import {
  getBatchNumber,
  getFifoBatch,
  getMedicineStock,
  getNearestExpiry,
  isLowStock,
  searchMedicines,
} from "@/lib/billing";

export default function Billing() {
  const navigate = useNavigate();

  const [meds, setMeds] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [quickMedicine, setQuickMedicine] = useState(null);
  const [quickQuantity, setQuickQuantity] = useState("1");
  const [activeResult, setActiveResult] = useState(0);
  const searchRef = useRef(null);
  const quickQuantityRef = useRef(null);

  const [customer, setCustomer] = useState({
    id: "",
    name: "Walk-in",
    phone: "",
    gstin: "",
  });

  const [referringDoctor, setReferringDoctor] = useState("");
  const [billDiscType, setBillDiscType] = useState("none");
  const [billDiscValue, setBillDiscValue] = useState("");

  const [payment, setPayment] = useState({
    mode: "cash",
    paid: "",
  });

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    api
      .get("/medicines")
      .then((r) => setMeds(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMeds([]));

    api
      .get("/customers")
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));

    api
      .get("/doctors")
      .then((r) => setDoctors(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDoctors([]));
  }, []);

  // FIXED: Added missing newBill function
  const newBill = () => {
    setSearch("");
    setCart([]);
    setQuickMedicine(null);
    setQuickQuantity("1");
    requestAnimationFrame(() => searchRef.current?.focus());

    setCustomer({
      id: "",
      name: "Walk-in",
      phone: "",
      gstin: "",
    });

    setReferringDoctor("");
    setBillDiscType("none");
    setBillDiscValue("");

    setPayment({
      mode: "cash",
      paid: "",
    });

    setNotes("");
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName;

      if (e.key === "F1") {
        e.preventDefault();
        newBill();
        return;
      }

      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filtered = useMemo(() => searchMedicines(meds, search), [search, meds]);

  useEffect(() => setActiveResult(0), [search]);

  const selectQuickMedicine = (medicine) => {
    if (getMedicineStock(medicine) <= 0) return toast.error("Out of stock");
    setQuickMedicine(medicine);
    setSearch("");
    setQuickQuantity("1");
    requestAnimationFrame(() => {
      quickQuantityRef.current?.focus();
      quickQuantityRef.current?.select();
    });
  };

  const addToCart = (medicine, requestedQuantity = 1) => {
    const stock = getMedicineStock(medicine);
    const quantity = Math.max(1, Number(requestedQuantity) || 1);
    if (stock <= 0) return toast.error("Out of stock");

    const fifoBatch = getFifoBatch(medicine);
    const medicineId = medicine.id || medicine.medicine_id;
    const medicineKey = medicineId || medicine.name || medicine.medicine_name;
    const exists = cart.find((item) => String(item.medicine_id || item.medicine_name) === String(medicineKey));
    const existingUnits = exists
      ? exists.quantity * (exists.unit_type === "box" ? exists.units_per_box : 1)
      : 0;

    if (existingUnits + quantity > stock) return toast.error(`Only ${stock} units available`);

    if (exists) {
      setCart(cart.map((item) =>
        String(item.medicine_id || item.medicine_name) === String(medicineKey)
          ? { ...item, unit_type: "unit", quantity: existingUnits + quantity }
          : item
      ));
    } else {
      setCart([...cart, {
        medicine_id: medicineId,
        medicine_name: medicine.name || medicine.medicine_name,
        batch_no: getBatchNumber(fifoBatch || medicine),
        expiry_date: getNearestExpiry(medicine),
        quantity,
        mrp: medicine.mrp,
        discount_pct: 0,
        gst_rate: medicine.gst_rate || 12,
        category: medicine.category,
        stock,
        low_stock: isLowStock(medicine),
        unit_type: "unit",
        units_per_box: Math.max(medicine.units_per_box || 1, 1),
      }]);
    }

    setQuickMedicine(null);
    setQuickQuantity("1");
    setSearch("");
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const addQuickRow = () => {
    if (!quickMedicine) return searchRef.current?.focus();
    addToCart(quickMedicine, quickQuantity);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "ArrowDown" && filtered.length) {
      event.preventDefault();
      setActiveResult((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp" && filtered.length) {
      event.preventDefault();
      setActiveResult((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && filtered.length) {
      event.preventDefault();
      selectQuickMedicine(filtered[activeResult] || filtered[0]);
    } else if (event.key === "Escape") {
      setSearch("");
    }
  };

  const updateItem = (i, key, val) => {
    const c = [...cart];

    c[i] = {
      ...c[i],
      [key]: val,
    };

    if (key === "unit_type") {
      const upb = c[i].units_per_box || 1;

      const maxQty =
        val === "box"
          ? Math.floor(c[i].stock / upb)
          : c[i].stock;

      if (c[i].quantity > maxQty) {
        c[i].quantity = Math.max(maxQty, 1);
      }
    }

    setCart(c);
  };

  const removeItem = (i) => {
    setCart(cart.filter((_, idx) => idx !== i));
  };

  const totals = useMemo(() => {
    let raw = 0;

    const lines = cart.map((it) => {
      const upb = it.units_per_box || 1;

      const unitPrice =
        it.mrp * (it.unit_type === "box" ? upb : 1);

      const base = unitPrice * it.quantity;

      const disc =
        base * (Number(it.discount_pct || 0) / 100);

      const taxable = base - disc;

      raw += taxable;

      return {
        taxable,
        gst_rate: Number(it.gst_rate || 0),
      };
    });

    let billDisc = 0;

    if (billDiscType === "amt") {
      billDisc = Math.min(Number(billDiscValue || 0), raw);
    } else if (billDiscType === "pct") {
      billDisc =
        raw *
        (Math.min(Number(billDiscValue || 0), 100) / 100);
    }

    let sub = 0;
    let gst = 0;

    for (const l of lines) {
      const share = raw > 0 ? l.taxable / raw : 0;

      const after = l.taxable - billDisc * share;

      const g = after - after / (1 + l.gst_rate / 100);

      gst += g;
      sub += after - g;
    }

    return {
      sub: +sub.toFixed(2),
      gst: +gst.toFixed(2),
      bill_disc: +billDisc.toFixed(2),
      raw: +raw.toFixed(2),
      total: +(sub + gst).toFixed(2),
    };
  }, [cart, billDiscType, billDiscValue]);

  const hasScheduleH = cart.some(
    (c) =>
      c.category === "Schedule H" ||
      c.category === "Schedule H1"
  );

  const submit = async () => {
    if (cart.length === 0) {
      return toast.error("Cart is empty");
    }

    setSaving(true);

    try {
      const payload = {
        customer_id: customer.id || null,
        customer_name: customer.name || "Walk-in",
        customer_phone: customer.phone,
        customer_gstin: customer.gstin,
        referring_doctor: referringDoctor,

        items: cart.map(({ stock, low_stock, ...rest }) => ({
          ...rest,
          quantity: Number(rest.quantity),
          discount_pct: Number(rest.discount_pct || 0),
          units_per_box: Math.max(
            Number(rest.units_per_box || 1),
            1
          ),
          unit_type: rest.unit_type || "unit",
        })),

        payment_mode: payment.mode,

        paid_amount:
          payment.mode === "credit"
            ? Number(payment.paid || 0)
            : Number(payment.paid) || totals.total,

        bill_discount_amount:
          billDiscType === "amt"
            ? Number(billDiscValue || 0)
            : 0,

        bill_discount_pct:
          billDiscType === "pct"
            ? Number(billDiscValue || 0)
            : 0,

        notes,
      };

      const { data } = await api.post("/invoices", payload);

      toast.success(`Invoice ${data.invoice_no} created`);

      navigate(`/invoices/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="billing-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-emerald-700">
            <Zap className="h-4 w-4" /> Quick Counter Mode
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">New Bill</h1>
          <p className="mt-1 text-sm text-slate-500">Search → Enter → quantity → Enter. Stock deducts when the invoice is created.</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-sm border bg-white px-2 py-1">/ Search</span>
          <span className="rounded-sm border bg-white px-2 py-1">F1 New bill</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Keyboard-first quick add */}
          <div className="relative rounded-sm border border-emerald-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchRef}
                  autoFocus
                  placeholder="Search name, barcode, or batch…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9 pr-20 rounded-sm h-11 border-emerald-300 focus-visible:ring-emerald-500"
                  data-testid="billing-search"
                  role="combobox"
                  aria-expanded={filtered.length > 0}
                />
                <button type="button" onClick={() => setScanOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-sm" data-testid="billing-scan-btn">
                  <ScanLine className="w-4 h-4" /> Scan
                </button>
              </div>
              <Input
                ref={quickQuantityRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={quickMedicine ? getMedicineStock(quickMedicine) : undefined}
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addQuickRow(); } }}
                disabled={!quickMedicine}
                aria-label="Quick quantity"
                className="h-11 rounded-sm text-right text-lg font-bold"
              />
              <Button type="button" onClick={addQuickRow} disabled={!quickMedicine} className="h-11 rounded-sm bg-emerald-600 px-5 hover:bg-emerald-700">
                Add <CornerDownLeft className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {quickMedicine && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <strong className="text-sm">{quickMedicine.name}</strong>
                <span>Available: <b>{getMedicineStock(quickMedicine)}</b></span>
                <span>Nearest expiry: <b>{getNearestExpiry(quickMedicine) || "—"}</b></span>
                <span>FIFO batch: <b>{getBatchNumber(getFifoBatch(quickMedicine) || quickMedicine) || "—"}</b></span>
                {isLowStock(quickMedicine) && <span className="font-bold text-amber-700">Low stock</span>}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="absolute left-3 right-3 z-20 mt-1 max-h-80 overflow-y-auto rounded-sm border border-slate-200 bg-white shadow-lg">
                {filtered.map((medicine, index) => (
                  <button
                    key={medicine.id || medicine.medicine_id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectQuickMedicine(medicine)}
                    className={`w-full px-3 py-2.5 text-left border-b border-slate-100 last:border-0 ${index === activeResult ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{medicine.name}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>Expiry: {getNearestExpiry(medicine) || "—"}</span>
                          <span>FIFO: {getBatchNumber(getFifoBatch(medicine) || medicine) || "—"}</span>
                          {isLowStock(medicine) && <span className="font-bold text-amber-700">Low stock</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono-nums text-sm font-semibold">{fmtINR(medicine.mrp)}</div>
                        <div className={`text-xs font-semibold ${getMedicineStock(medicine) <= 0 ? "text-red-600" : "text-emerald-700"}`}>Available: {getMedicineStock(medicine)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasScheduleH && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3 flex gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />

              <div className="text-red-800">
                <strong className="font-semibold">
                  Schedule H/H1 warning:
                </strong>{" "}
                Prescription required.
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="bg-white border border-slate-200 rounded-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
              <div className="font-heading font-semibold">Items ({cart.length})</div>
              <div className="flex items-center gap-1 text-xs text-slate-500"><Boxes className="h-4 w-4" /> Invoice creation deducts stock</div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc %</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {cart.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-slate-500"
                      >
                        No items yet. Search above to add.
                      </td>
                    </tr>
                  )}

                  {cart.map((it, i) => {
                    const upb = it.units_per_box || 1;

                    const unitPrice =
                      it.mrp * (it.unit_type === "box" ? upb : 1);

                    const lt =
                      unitPrice *
                      it.quantity *
                      (1 - (it.discount_pct || 0) / 100);

                    const maxQty =
                      it.unit_type === "box"
                        ? Math.floor(it.stock / upb)
                        : it.stock;

                    return (
                      <tr key={i}>
                        <td>
                          <div className="font-medium">{it.medicine_name}</div>

                          <div className="text-xs text-slate-500 font-mono">
                            Available {it.stock} · Exp {it.expiry_date || "—"} · FIFO {it.batch_no || "—"}
                            {it.low_stock && <span className="ml-2 font-sans font-bold text-amber-700">Low stock</span>}
                          </div>
                        </td>

                        <td>
                          <Select
                            value={it.unit_type}
                            onValueChange={(v) =>
                              updateItem(i, "unit_type", v)
                            }
                          >
                            <SelectTrigger className="h-8 w-24 rounded-sm">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="unit">
                                Unit
                              </SelectItem>

                              <SelectItem
                                value="box"
                                disabled={upb <= 1}
                              >
                                Box ({upb}u)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="num-cell">
                          <Input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(
                                i,
                                "quantity",
                                Math.max(1, Math.min(maxQty || 1, Number(e.target.value)))
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                searchRef.current?.focus();
                              }
                            }}
                            className="w-20 h-8 text-right rounded-sm"
                          />
                        </td>

                        <td className="num-cell font-semibold">
                          {fmtINR(lt)}
                        </td>

                        <td>
                          <button
                            onClick={() => removeItem(i)}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <div className="font-heading font-semibold">
              Customer
            </div>

            <Select
              value={customer.id || "walkin"}
              onValueChange={(v) => {
                if (v === "walkin") {
                  setCustomer({
                    id: "",
                    name: "Walk-in",
                    phone: "",
                    gstin: "",
                  });
                } else {
                  const c = customers.find(
                    (x) => String(x.id) === String(v)
                  );

                  if (c) {
                    setCustomer({
                      id: c.id,
                      name: c.name,
                      phone: c.phone,
                      gstin: c.gstin,
                    });
                  }
                }
              }}
            >
              <SelectTrigger className="rounded-sm">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="walkin">
                  Walk-in (cash)
                </SelectItem>

                {customers.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={String(c.id)}
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Name"
              value={customer.name}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  name: e.target.value,
                })
              }
              className="rounded-sm"
            />

            <Input
              placeholder="Phone"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  phone: e.target.value,
                })
              }
              className="rounded-sm"
            />

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                Referring Doctor
              </Label>

              <Autocomplete
                value={referringDoctor}
                onChange={(t) => setReferringDoctor(t)}
                options={doctors.map((d) => ({
                  id: d.name,
                  label: d.name,
                  value: d.name,
                }))}
                placeholder="Dr. name (optional)"
                className="rounded-sm mt-1"
              />
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-sm p-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-mono-nums">
                {fmtINR(totals.sub)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">GST</span>
              <span className="font-mono-nums">
                {fmtINR(totals.gst)}
              </span>
            </div>

            <div className="border-t border-slate-700 pt-2 flex justify-between">
              <span className="font-heading font-semibold text-lg">
                Total
              </span>

              <span className="font-heading font-bold text-2xl font-mono-nums">
                {fmtINR(totals.total)}
              </span>
            </div>

            <Button
              onClick={submit}
              disabled={saving || cart.length === 0}
              className="w-full rounded-sm bg-blue-600 hover:bg-blue-700 h-11 mt-3 font-semibold"
            >
              {saving ? "Creating…" : "Create Invoice →"}
            </Button>
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={async (code) => {
          setScanOpen(false);

          try {
            const { data } = await api.get(
              `/medicines/lookup/${encodeURIComponent(code)}`
            );

            addToCart(data);

            toast.success(`Added: ${data.name}`);
          } catch {
            toast.error(
              `No medicine found for barcode ${code}`
            );
          }
        }}
      />
    </div>
  );
}
