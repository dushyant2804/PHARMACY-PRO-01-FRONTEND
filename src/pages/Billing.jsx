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
  getBarcodeAutoAddMatch,
  getBatchNumber,
  getFifoBatch,
  getInvoiceDateError,
  getEffectiveDiscountPct,
  getExactBarcodeMatches,
  getItemDiscountAmount,
  getItemDiscountValue,
  getItemSubtotal,
  getItemTotal,
  getMedicineStock,
  getNearestExpiry,
  getQuickAddQuantity,
  focusMedicineSearch,
  getTodayDateInputValue,
  isDiscountValid,
  isLowStock,
  searchMedicines,
  toInvoiceItem,
  withInvoiceDate,
} from "@/lib/billing";
import {
  BILLING_SHORTCUTS,
  getBillingShortcut,
  getNextCartRow,
  getSelectedRowAfterRemoval,
  removeCartRow,
} from "@/lib/billingKeyboard";

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
  const [activeCartRow, setActiveCartRow] = useState(-1);
  const searchRef = useRef(null);
  const quickQuantityRef = useRef(null);
  const customerSearchRef = useRef(null);
  const cartRowRefs = useRef([]);
  const cartQuantityRefs = useRef([]);

  const [customer, setCustomer] = useState({
    id: "",
    name: "Walk-in",
    phone: "",
    gstin: "",
  });
  const [customerType, setCustomerType] = useState("walkin");

  const [referringDoctor, setReferringDoctor] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateInputValue);
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
    setActiveCartRow(-1);
    setQuickMedicine(null);
    setQuickQuantity("1");
    focusMedicineSearch(searchRef);

    setCustomer({
      id: "",
      name: "Walk-in",
      phone: "",
      gstin: "",
    });
    setCustomerType("walkin");

    setReferringDoctor("");
    setInvoiceDate(getTodayDateInputValue());
    setBillDiscType("none");
    setBillDiscValue("");

    setPayment({
      mode: "cash",
      paid: "",
    });

    setNotes("");
  };

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
    const quantity = getQuickAddQuantity(requestedQuantity);
    if (stock <= 0) return toast.error("Out of stock");

    const fifoBatch = getFifoBatch(medicine);
    const medicineId = medicine.id || medicine.medicine_id;
    const medicineKey = medicineId || medicine.name || medicine.medicine_name;
    const exists = cart.find(
      (item) =>
        String(item.medicine_id || item.medicine_name) === String(medicineKey),
    );
    const existingUnits = exists
      ? exists.quantity *
        (exists.unit_type === "box" ? exists.units_per_box : 1)
      : 0;

    if (existingUnits + quantity > stock)
      return toast.error(`Only ${stock} units available`);

    if (exists) {
      setActiveCartRow(cart.indexOf(exists));
      setCart(
        cart.map((item) =>
          String(item.medicine_id || item.medicine_name) === String(medicineKey)
            ? { ...item, unit_type: "unit", quantity: existingUnits + quantity }
            : item,
        ),
      );
    } else {
      setActiveCartRow(cart.length);
      setCart([
        ...cart,
        {
          medicine_id: medicineId,
          medicine_name: medicine.name || medicine.medicine_name,
          batch_no: getBatchNumber(fifoBatch || medicine),
          expiry_date: getNearestExpiry(medicine),
          quantity,
          mrp: medicine.mrp,
          discount_pct: 0,
          discount_type: "pct",
          discount_value: 0,
          gst_rate: medicine.gst_rate || 12,
          category: medicine.category,
          stock,
          low_stock: isLowStock(medicine),
          unit_type: "unit",
          units_per_box: Math.max(medicine.units_per_box || 1, 1),
        },
      ]);
    }

    setQuickMedicine(null);
    setQuickQuantity("1");
    setSearch("");
    focusMedicineSearch(searchRef);
  };

  const addQuickRow = () => {
    if (!quickMedicine) return searchRef.current?.focus();
    addToCart(quickMedicine, quickQuantity);
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    const exactBarcodeMatch = getBarcodeAutoAddMatch(meds, value);

    if (exactBarcodeMatch) {
      addToCart(exactBarcodeMatch, quickQuantity);
      return;
    }

    setSearch(value);
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

      const maxQty = val === "box" ? Math.floor(c[i].stock / upb) : c[i].stock;

      if (c[i].quantity > maxQty) {
        c[i].quantity = Math.max(maxQty, 1);
      }
    }

    const subtotal = getItemSubtotal(c[i]);
    const discountType = c[i].discount_type || "pct";
    const discountValue = getItemDiscountValue(c[i]);
    c[i].discount_value =
      discountType === "amt"
        ? Math.min(Math.max(discountValue, 0), subtotal)
        : Math.min(Math.max(discountValue, 0), 100);

    setCart(c);
  };

  const updateDiscountType = (i, discountType) => {
    const c = [...cart];
    const discountAmount = getItemDiscountAmount(c[i]);
    const subtotal = getItemSubtotal(c[i]);

    c[i] = {
      ...c[i],
      discount_type: discountType,
      discount_value:
        discountType === "amt"
          ? discountAmount
          : getEffectiveDiscountPct(subtotal, "amt", discountAmount),
    };
    setCart(c);
  };

  const removeItem = (i) => {
    setCart((current) => {
      setActiveCartRow(getSelectedRowAfterRemoval(i, current.length));
      return removeCartRow(current, i);
    });
  };

  const moveActiveCartRow = (direction) => {
    const nextRow = getNextCartRow(activeCartRow, direction, cart.length);
    setActiveCartRow(nextRow);
    requestAnimationFrame(() => cartRowRefs.current[nextRow]?.focus());
  };

  const totals = useMemo(() => {
    let raw = 0;

    const lines = cart.map((it) => {
      const taxable = getItemTotal(it);

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
      billDisc = raw * (Math.min(Number(billDiscValue || 0), 100) / 100);
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
    (c) => c.category === "Schedule H" || c.category === "Schedule H1",
  );
  const today = getTodayDateInputValue();
  const invoiceDateError = getInvoiceDateError(invoiceDate, today);

  const submit = async () => {
    if (cart.length === 0) {
      return toast.error("Cart is empty");
    }

    if (invoiceDateError) {
      return toast.error(invoiceDateError);
    }
    if (payment.mode === "credit" && !customer.id) {
      customerSearchRef.current?.focus();
      return toast.error("Select an existing customer for a credit bill");
    }

    const invalidDiscount = cart.find(
      (item) =>
        !isDiscountValid(
          getItemSubtotal(item),
          item.discount_type,
          getItemDiscountValue(item),
        ),
    );
    if (invalidDiscount) {
      return toast.error(
        `Invalid discount for ${invalidDiscount.medicine_name}`,
      );
    }

    setSaving(true);

    try {
      const payload = withInvoiceDate(
        {
          customer_id: customer.id || null,
          customer_name: customer.name || "Walk-in",
          customer_phone: customer.phone,
          customer_gstin: customer.gstin,
          referring_doctor: referringDoctor,

          items: cart.map(toInvoiceItem),

          payment_mode: payment.mode,

          paid_amount:
            payment.mode === "credit"
              ? Number(payment.paid || 0)
              : Number(payment.paid) || totals.total,

          bill_discount_amount:
            billDiscType === "amt" ? Number(billDiscValue || 0) : 0,

          bill_discount_pct:
            billDiscType === "pct" ? Number(billDiscValue || 0) : 0,

          notes,
        },
        invoiceDate,
      );

      const { data } = await api.post("/invoices", payload);

      toast.success(`Invoice ${data.invoice_no} created`);

      navigate(`/invoices/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const action = getBillingShortcut(event);
      const activeTag = document.activeElement?.tagName;

      if (
        !action &&
        event.key === "/" &&
        activeTag !== "INPUT" &&
        activeTag !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (!action) return;
      event.preventDefault();

      if (action === "newBill") newBill();
      if (action === "focusMedicineSearch") searchRef.current?.focus();
      if (action === "focusCustomerSearch") customerSearchRef.current?.focus();
      if (action === "focusQuantity") {
        const quantityInput = quickMedicine
          ? quickQuantityRef.current
          : cartQuantityRefs.current[activeCartRow >= 0 ? activeCartRow : 0];
        quantityInput?.focus();
        quantityInput?.select();
      }
      if (action === "createInvoice") submit();
      if (action === "clearMedicineSearch") {
        setSearch("");
        setActiveResult(0);
      }
      if (action === "removeSelectedRow" && activeCartRow >= 0) {
        removeItem(activeCartRow);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="space-y-6" data-testid="billing-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-emerald-700">
            <Zap className="h-4 w-4" /> Quick Counter Mode
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            New Bill
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search → Enter → quantity → Enter. Stock deducts when the invoice is
            created.
          </p>
        </div>
        <div
          className="flex max-w-2xl flex-wrap justify-end gap-1.5 text-xs font-semibold text-slate-500"
          aria-label="Billing keyboard shortcuts"
        >
          {BILLING_SHORTCUTS.map(({ keys, label }) => (
            <span key={keys} className="rounded-sm border bg-white px-2 py-1">
              <kbd>{keys}</kbd> {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="relative z-10 lg:col-span-2 space-y-4">
          {/* Keyboard-first quick add */}
          <div
            className={`relative overflow-visible rounded-sm border border-emerald-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 ${filtered.length > 0 ? "z-[100]" : "z-20"}`}
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
              <div className="relative z-[110] overflow-visible">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchRef}
                  autoFocus
                  placeholder="Search name, barcode, or batch…"
                  value={search}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9 pr-20 rounded-sm h-11 border-emerald-300 focus-visible:ring-emerald-500"
                  data-testid="billing-search"
                  role="combobox"
                  aria-expanded={filtered.length > 0}
                />
                <button
                  type="button"
                  onClick={() => setScanOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-sm"
                  data-testid="billing-scan-btn"
                >
                  <ScanLine className="w-4 h-4" /> Scan
                </button>

                {filtered.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[120] mt-1 max-h-80 overflow-y-auto rounded-sm border border-slate-200 bg-white shadow-xl">
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
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-semibold text-slate-900">
                                {medicine.name}
                              </div>
                              {getExactBarcodeMatches([medicine], search)
                                .length === 1 && (
                                <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-700">
                                  BARCODE MATCH
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>
                                Expiry: {getNearestExpiry(medicine) || "—"}
                              </span>
                              <span>
                                FIFO:{" "}
                                {getBatchNumber(
                                  getFifoBatch(medicine) || medicine,
                                ) || "—"}
                              </span>
                              {isLowStock(medicine) && (
                                <span className="font-bold text-amber-700">
                                  Low stock
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono-nums text-sm font-semibold">
                              {fmtINR(medicine.mrp)}
                            </div>
                            <div
                              className={`text-xs font-semibold ${getMedicineStock(medicine) <= 0 ? "text-red-600" : "text-emerald-700"}`}
                            >
                              Available: {getMedicineStock(medicine)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                ref={quickQuantityRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={
                  quickMedicine ? getMedicineStock(quickMedicine) : undefined
                }
                value={quickQuantity}
                onChange={(event) => setQuickQuantity(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addQuickRow();
                  }
                }}
                aria-label="Quick quantity"
                className="h-11 rounded-sm text-right text-lg font-bold"
              />
              <Button
                type="button"
                onClick={addQuickRow}
                disabled={!quickMedicine}
                className="h-11 rounded-sm bg-emerald-600 px-5 hover:bg-emerald-700"
              >
                Add <CornerDownLeft className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {quickMedicine && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <strong className="text-sm">{quickMedicine.name}</strong>
                <span>
                  Available: <b>{getMedicineStock(quickMedicine)}</b>
                </span>
                <span>
                  Nearest expiry:{" "}
                  <b>{getNearestExpiry(quickMedicine) || "—"}</b>
                </span>
                <span>
                  FIFO batch:{" "}
                  <b>
                    {getBatchNumber(
                      getFifoBatch(quickMedicine) || quickMedicine,
                    ) || "—"}
                  </b>
                </span>
                {isLowStock(quickMedicine) && (
                  <span className="font-bold text-amber-700">Low stock</span>
                )}
              </div>
            )}

            {filtered.length > 0 && <div className="h-80" aria-hidden="true" />}
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
              <div className="font-heading font-semibold">
                Items ({cart.length})
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Boxes className="h-4 w-4" />{" "}
                <span>↑↓ Select row · Ctrl+Delete Remove</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Discount</th>
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

                    const subtotal = getItemSubtotal(it);
                    const discountAmount = getItemDiscountAmount(it);
                    const lt = getItemTotal(it);

                    const maxQty =
                      it.unit_type === "box"
                        ? Math.floor(it.stock / upb)
                        : it.stock;

                    return (
                      <tr
                        key={it.medicine_id || `${it.medicine_name}-${i}`}
                        ref={(element) => {
                          cartRowRefs.current[i] = element;
                        }}
                        tabIndex={0}
                        data-testid={`billing-cart-row-${i}`}
                        aria-selected={activeCartRow === i}
                        onClick={() => setActiveCartRow(i)}
                        onFocus={() => setActiveCartRow(i)}
                        onKeyDown={(event) => {
                          if (
                            event.currentTarget === event.target &&
                            (event.key === "ArrowDown" ||
                              event.key === "ArrowUp")
                          ) {
                            event.preventDefault();
                            moveActiveCartRow(
                              event.key === "ArrowUp" ? "up" : "down",
                            );
                          }
                        }}
                        className={
                          activeCartRow === i
                            ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                            : ""
                        }
                      >
                        <td>
                          <div className="font-medium">{it.medicine_name}</div>

                          <div className="text-xs text-slate-500 font-mono">
                            Available {it.stock} · Exp {it.expiry_date || "—"} ·
                            FIFO {it.batch_no || "—"}
                            {it.low_stock && (
                              <span className="ml-2 font-sans font-bold text-amber-700">
                                Low stock
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <Select
                            value={it.unit_type}
                            onValueChange={(v) => updateItem(i, "unit_type", v)}
                          >
                            <SelectTrigger className="h-8 w-24 rounded-sm">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="unit">Unit</SelectItem>

                              <SelectItem value="box" disabled={upb <= 1}>
                                Box ({upb}u)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        <td className="num-cell">
                          <Input
                            ref={(element) => {
                              cartQuantityRefs.current[i] = element;
                            }}
                            type="number"
                            min={1}
                            max={maxQty}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(
                                i,
                                "quantity",
                                Math.max(
                                  1,
                                  Math.min(maxQty || 1, Number(e.target.value)),
                                ),
                              )
                            }
                            onFocus={() => setActiveCartRow(i)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                searchRef.current?.focus();
                              }
                            }}
                            className="w-20 h-8 text-right rounded-sm"
                          />
                        </td>

                        <td className="num-cell whitespace-nowrap">
                          {fmtINR(unitPrice)}
                        </td>

                        <td className="num-cell">
                          <div className="ml-auto flex w-40 items-center justify-end gap-1">
                            <Select
                              value={it.discount_type || "pct"}
                              onValueChange={(value) =>
                                updateDiscountType(i, value)
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-16 rounded-sm"
                                aria-label={`Discount type for ${it.medicine_name}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pct">%</SelectItem>
                                <SelectItem value="amt">₹</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={
                                (it.discount_type || "pct") === "amt"
                                  ? subtotal
                                  : 100
                              }
                              step="0.01"
                              value={getItemDiscountValue(it)}
                              onChange={(event) =>
                                updateItem(
                                  i,
                                  "discount_value",
                                  Number(event.target.value) || 0,
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  searchRef.current?.focus();
                                }
                              }}
                              aria-label={`Discount value for ${it.medicine_name}`}
                              className="h-8 w-24 rounded-sm text-right"
                            />
                          </div>
                        </td>

                        <td className="num-cell whitespace-nowrap font-semibold">
                          <div>{fmtINR(lt)}</div>
                          {discountAmount > 0 && (
                            <div className="text-xs font-normal text-emerald-700">
                              after −{fmtINR(discountAmount)}
                            </div>
                          )}
                        </td>

                        <td>
                          <button
                            onClick={() => removeItem(i)}
                            aria-label={`Remove ${it.medicine_name}`}
                            title="Remove row (Ctrl+Delete)"
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
            <div className="font-heading font-semibold">Bill Details</div>

            <div>
              <Label
                htmlFor="invoice-date"
                className="text-xs uppercase font-semibold text-slate-600"
              >
                Invoice Date
              </Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                max={today}
                required
                aria-invalid={Boolean(invoiceDateError)}
                aria-describedby={
                  invoiceDateError ? "invoice-date-error" : undefined
                }
                onChange={(event) => setInvoiceDate(event.target.value)}
                className="rounded-sm mt-1"
                data-testid="invoice-date"
              />
              {invoiceDateError && (
                <p
                  id="invoice-date-error"
                  className="mt-1 text-xs text-red-600"
                >
                  {invoiceDateError}
                </p>
              )}
            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-4 space-y-3">
            <div>
              <div className="font-heading font-semibold">Customer</div>
              <p className="text-xs text-slate-500">Who is this bill for?</p>
            </div>

            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Customer Type</Label>
              <Select
              value={customerType}
              onValueChange={(v) => {
                if (v === "walkin") {
                  setCustomerType("walkin");
                  setCustomer({
                    id: "",
                    name: "Walk-in",
                    phone: "",
                    gstin: "",
                  });
                } else if (v === "new") {
                  setCustomerType("new");
                  setCustomer({ id: "", name: "", phone: "", gstin: "" });
                } else {
                  setCustomerType("existing");
                }
              }}
            >
              <SelectTrigger
                ref={customerSearchRef}
                aria-label="Customer type"
                className="rounded-sm"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="walkin">Walk-in</SelectItem>
                <SelectItem value="existing">Existing Customer</SelectItem>
                <SelectItem value="new">New Customer</SelectItem>
              </SelectContent>
            </Select>
            </div>

            {customerType === "existing" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Select Customer</Label>
                <Select value={customer.id ? String(customer.id) : undefined} onValueChange={(v) => {
                  const c = customers.find((x) => String(x.id) === String(v));
                  if (c) setCustomer({ id: c.id, name: c.name, phone: c.phone || "", gstin: c.gstin || "" });
                }}>
                  <SelectTrigger ref={customerSearchRef} className="rounded-sm"><SelectValue placeholder="Search existing customer" /></SelectTrigger>
                  <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">Customer Name</Label>
            <Input
              placeholder={customerType === "walkin" ? "Walk-in" : "Enter customer name"}
              value={customer.name}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  name: e.target.value,
                })
              }
              className="rounded-sm"
            />
            </div>

            <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">Phone</Label>
            <Input
              placeholder="Phone (optional)"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({
                  ...customer,
                  phone: e.target.value,
                })
              }
              className="rounded-sm"
            />
            </div>

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

          <div className="bg-white border border-blue-200 rounded-sm p-4 space-y-3">
            <div>
              <div className="font-heading font-semibold">Payment</div>
              <p className="text-xs text-slate-500">Choose how this invoice will be settled.</p>
            </div>
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Payment Mode</Label>
              <Select value={payment.mode} onValueChange={(mode) => setPayment({ ...payment, mode })}>
                <SelectTrigger className="mt-1 rounded-sm" aria-label="Payment mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payment.mode === "credit" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Paid Now</Label>
                <Input type="number" min="0" step="0.01" value={payment.paid} onChange={(e) => setPayment({ ...payment, paid: e.target.value })} placeholder="0.00" className="mt-1 rounded-sm text-right" />
                <p className="mt-1 text-xs text-amber-700">Credit requires an existing customer for ledger tracking.</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 text-white rounded-sm p-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-mono-nums">{fmtINR(totals.sub)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Discount</span>
              <span className="font-mono-nums">−{fmtINR(totals.bill_disc)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-400">GST</span>
              <span className="font-mono-nums">{fmtINR(totals.gst)}</span>
            </div>

            <div className="border-t border-slate-700 pt-2 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Paid</span><span className="font-mono-nums">{fmtINR(payment.mode === "credit" ? Number(payment.paid || 0) : totals.total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Due</span><span className="font-mono-nums">{fmtINR(payment.mode === "credit" ? Math.max(totals.total - Number(payment.paid || 0), 0) : 0)}</span></div>
            </div>

            <div className="border-t border-slate-700 pt-2 flex justify-between">
              <span className="font-heading font-semibold text-lg">Total</span>

              <span className="font-heading font-bold text-2xl font-mono-nums">
                {fmtINR(totals.total)}
              </span>
            </div>

            <Button
              onClick={submit}
              disabled={saving || cart.length === 0}
              className="w-full rounded-sm bg-blue-600 hover:bg-blue-700 h-11 mt-3 font-semibold"
            >
              {saving ? "Creating…" : "Create Invoice →  F6"}
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
              `/medicines/lookup/${encodeURIComponent(code)}`,
            );

            addToCart(data, quickQuantity);

            toast.success(`Added: ${data.name}`);
          } catch {
            toast.error(`No medicine found for barcode ${code}`);
          }
        }}
      />
    </div>
  );
}
