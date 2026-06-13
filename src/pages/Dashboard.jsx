import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BadgeIndianRupee, Clock3, IndianRupee, LockKeyhole,
  PackageSearch, PackageX, ReceiptText, ShieldAlert, ShoppingCart, SlidersHorizontal,
  TrendingUp, Trophy, Users, WalletCards, Zap, Truck,
} from "lucide-react";

const getOutstandingTotal = (outstanding, listKey) => {
  return (outstanding?.[listKey] || []).reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );
};

const firstDefined = (...values) => {
  return values.find((value) => value !== undefined && value !== null);
};

const getExpiryDate = (item) => {
  return firstDefined(item.expiry_date, item.expiry, item.expiryDate, "-");
};

const getBatchNo = (item) => {
  return firstDefined(item.batch_number, item.batch_no, item.batch, item.batchNo, "-");
};

const getMedicineName = (item) => {
  return firstDefined(item.name, item.medicine_name, item.medicine, "-");
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getAvailableStock = (item) => {
  const directStock = [
    item.available_stock,
    item.available_units,
    item.available_quantity,
    item.remaining_quantity,
    item.quantity_units,
    item.total_stock,
    item.stock,
    item.quantity,
    item.qty,
  ].map(toOptionalNumber).find((value) => value !== undefined);

  if (directStock !== undefined) return directStock;

  const purchasedUnits = toOptionalNumber(firstDefined(item.purchased_units, item.purchased_quantity));
  const totalUnits = toOptionalNumber(firstDefined(item.total_units, item.total_quantity));
  const soldUnits = toOptionalNumber(firstDefined(item.sold_units, item.sold_quantity));

  if (purchasedUnits !== undefined && soldUnits !== undefined) {
    return purchasedUnits - soldUnits;
  }

  if (totalUnits !== undefined && soldUnits !== undefined) {
    return totalUnits - soldUnits;
  }

  return undefined;
};

const getRemainingNonSoldQuantity = (item) => {
  const originalQuantity = toOptionalNumber(firstDefined(
    item.original_quantity,
    item.original_batch_quantity,
    item.batch_quantity,
    item.purchased_units,
    item.total_units,
    item.purchased_quantity,
    item.total_quantity
  ));
  const soldQuantity = toOptionalNumber(firstDefined(item.sold_units, item.sold_quantity));

  if (originalQuantity === undefined || soldQuantity === undefined) return undefined;

  return Math.max(originalQuantity - soldQuantity, 0);
};

const getItemReturnedQuantity = (item) => toNumber(firstDefined(
  item.returned_quantity,
  item.return_quantity,
  item.purchase_return_quantity,
  item.total_returned_quantity,
  item.returned_units,
  0
));

const getPurchaseReturnQuantity = (record) => toNumber(firstDefined(
  record.return_quantity,
  record.returned_quantity,
  record.purchase_return_quantity,
  record.total_returned_quantity,
  record.quantity,
  record.qty,
  0
));

const normalizeCollection = (payload) => {
  const items = firstDefined(
    payload?.items,
    payload?.results,
    payload?.data,
    payload?.medicines,
    payload?.purchase_returns,
    payload?.returns,
    payload
  );

  return Array.isArray(items) ? items : [];
};

const buildInventoryBatchRecords = (medicines) => medicines.flatMap((medicine) => {
  const batches = Array.isArray(medicine.batches) ? medicine.batches : [];

  if (!batches.length) {
    return [{
      ...medicine,
      medicine_id: firstDefined(medicine.medicine_id, medicine.id),
      medicine_key: firstDefined(medicine.medicine_key, medicine.key, medicine.sku),
      medicine_name: firstDefined(medicine.medicine_name, medicine.name),
      distributor_name: firstDefined(medicine.distributor_name, medicine.distributor),
      available_stock: firstDefined(
        medicine.available_stock,
        medicine.available_units,
        medicine.available_quantity,
        medicine.quantity_units,
        medicine.total_stock
      ),
    }];
  }

  return batches.map((batch) => ({
    ...batch,
    medicine_id: firstDefined(batch.medicine_id, medicine.medicine_id, medicine.id),
    medicine_key: firstDefined(batch.medicine_key, medicine.medicine_key, medicine.key, medicine.sku),
    medicine_name: firstDefined(batch.medicine_name, medicine.medicine_name, medicine.name),
    distributor_id: firstDefined(batch.distributor_id, medicine.distributor_id),
    distributor_name: firstDefined(batch.distributor_name, batch.distributor, medicine.distributor_name, medicine.distributor),
  }));
});

const normalizeMatchValue = (value) => String(value ?? "").trim().toLowerCase();

const normalizeDateMatchValue = (value) => {
  const normalized = normalizeMatchValue(value);
  if (!normalized) return normalized;

  return normalized.slice(0, 10);
};

const getRecordMatchFields = (item) => ({
  medicine_id: firstDefined(item.medicine_id, item.id),
  medicine_key: firstDefined(item.medicine_key, item.key, item.sku),
  batch_number: firstDefined(item.batch_number, item.batch_no, item.batch, item.batchNo),
  expiry_date: firstDefined(item.expiry_date, item.expiry, item.expiryDate),
  distributor_id: item.distributor_id,
  medicine_name: firstDefined(item.medicine_name, item.name, item.medicine),
  distributor_name: firstDefined(item.distributor_name, item.distributor),
});

const valuesMatchWhenBothPresent = (left, right, key) => {
  const normalizer = key === "expiry_date" ? normalizeDateMatchValue : normalizeMatchValue;
  const leftValue = normalizer(left[key]);
  const rightValue = normalizer(right[key]);
  return !leftValue || !rightValue || leftValue === rightValue;
};

const hasMatchingMedicine = (left, right) => {
  const leftId = normalizeMatchValue(left.medicine_id);
  const rightId = normalizeMatchValue(right.medicine_id);
  const leftKey = normalizeMatchValue(left.medicine_key);
  const rightKey = normalizeMatchValue(right.medicine_key);

  if (leftId && rightId && leftId === rightId) return true;
  if (leftKey && rightKey && leftKey === rightKey) return true;

  return normalizeMatchValue(left.medicine_name)
    && normalizeMatchValue(left.medicine_name) === normalizeMatchValue(right.medicine_name);
};

const recordsMatchExpiryItem = (item, record) => {
  const itemFields = getRecordMatchFields(item);
  const recordFields = getRecordMatchFields(record);

  return hasMatchingMedicine(itemFields, recordFields)
    && valuesMatchWhenBothPresent(itemFields, recordFields, "batch_number")
    && valuesMatchWhenBothPresent(itemFields, recordFields, "expiry_date")
    && valuesMatchWhenBothPresent(itemFields, recordFields, "distributor_id")
    && valuesMatchWhenBothPresent(itemFields, recordFields, "distributor_name");
};

const findInventoryBatchForExpiryItem = (item, inventoryBatches) => {
  return inventoryBatches.find((batch) => recordsMatchExpiryItem(item, batch));
};

const getReturnStatus = (item, purchaseReturns, inventoryBatches) => {
  const inventoryBatch = findInventoryBatchForExpiryItem(item, inventoryBatches);
  const backendStatus = firstDefined(
    item.return_status,
    item.status,
    inventoryBatch?.return_status,
    inventoryBatch?.status
  );

  if (backendStatus !== undefined && backendStatus !== "") return String(backendStatus);

  const batchData = { ...item, ...(inventoryBatch || {}) };
  const availableStock = firstDefined(getAvailableStock(inventoryBatch || {}), getAvailableStock(item));
  const matchedReturns = purchaseReturns.filter((record) => recordsMatchExpiryItem(item, record));
  const matchedReturnedQuantity = matchedReturns.reduce(
    (sum, record) => sum + getPurchaseReturnQuantity(record),
    0
  );
  const returnedQuantity = matchedReturnedQuantity > 0
    ? matchedReturnedQuantity
    : getItemReturnedQuantity(batchData);
  const hasPurchaseReturn = matchedReturns.length > 0 || returnedQuantity > 0;

  if (hasPurchaseReturn) {
    const remainingNonSoldQuantity = getRemainingNonSoldQuantity(batchData);

    if (availableStock !== undefined && availableStock <= 0) return "Returned";
    if (remainingNonSoldQuantity !== undefined && returnedQuantity >= remainingNonSoldQuantity) return "Returned";

    return "Partially Returned";
  }

  if (availableStock !== undefined && availableStock <= 0) return "Sold Out";

  return "Not Returned";
};

function ReturnStatusBadge({ status }) {
  const className = status === "Returned"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : status === "Partially Returned"
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : status === "Sold Out"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

const getPatientAlerts = (data) => {
  const alerts = firstDefined(
    data.patient_alerts,
    data.patient_due_alerts,
    data.patient_refill_alerts,
    data.patients_due,
    data.due_patients,
    []
  );

  if (Array.isArray(alerts)) return alerts;
  return firstDefined(alerts.items, alerts.alerts, alerts.data, []);
};

const getPatientAlertStatus = (alert) => {
  const status = firstDefined(alert.status, alert.due_status, alert.refill_status);
  if (status) return status;

  const daysOverdue = firstDefined(alert.days_overdue, alert.overdue_days);
  if (Number(daysOverdue) > 0) return `Overdue by ${daysOverdue} day${Number(daysOverdue) === 1 ? "" : "s"}`;

  const daysRemaining = firstDefined(alert.days_remaining, alert.days_to_refill, alert.days_left);
  if (Number(daysRemaining) > 0) return `Due in ${daysRemaining} day${Number(daysRemaining) === 1 ? "" : "s"}`;

  return alert.is_due ? "Due now" : "Due";
};

const getSmartList = (data, keys) => {
  for (const key of keys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
  }
  return [];
};

const getMetric = (item, keys, fallback = 0) => firstDefined(...keys.map((key) => item?.[key]), fallback);

const SMART_CARD_CONFIG = [
  { key: "top", title: "Top selling medicines", subtitle: "Best sellers today", tone: "emerald", keys: ["top_selling_medicines", "top_selling", "best_sellers"], metricKeys: ["sales_amount", "revenue", "total_sales", "sales"], metric: "currency" },
  { key: "fast", title: "Fast-moving medicines", subtitle: "Highest unit velocity", tone: "blue", keys: ["fast_moving_medicines", "fast_moving", "fast_movers"], metricKeys: ["units_sold", "sold_quantity", "quantity_sold", "sales_count"], suffix: " units" },
  { key: "dead", title: "Dead stock warning", subtitle: "Capital sitting idle", tone: "slate", keys: ["dead_stock_items", "dead_stock", "slow_moving_medicines"], metricKeys: ["stock_value", "inventory_value", "value"], metric: "currency" },
  { key: "expiry", title: "High expiry risk", subtitle: "Prioritise returns & sales", tone: "red", keys: ["high_expiry_risk", "expiry_risk_items", "expiring_soon_items", "expiring_soon"], metricKeys: ["days_to_expiry", "days_left", "days_remaining"], suffix: " days" },
  { key: "profit", title: "Highest profit medicines", subtitle: "Strongest margin drivers", tone: "amber", keys: ["highest_profit_medicines", "top_profit_medicines", "most_profitable_medicines"], metricKeys: ["profit", "profit_amount", "gross_profit"], metric: "currency" },
];

const toneStyles = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  red: "bg-red-50 text-red-700 border-red-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  orange: "bg-orange-50 text-orange-700 border-orange-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
};

function DashboardSkeleton() {
  return (
    <div className="dashboard-shell animate-pulse" data-testid="dashboard-skeleton">
      <div className="h-28 rounded-3xl bg-slate-200/80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-32 rounded-2xl bg-slate-200/80" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-64 rounded-2xl bg-slate-200/80" />)}
      </div>
      <div className="h-72 rounded-2xl bg-slate-200/80" />
    </div>
  );
}

const statToneStyles = {
  emerald: "from-emerald-50/90 via-white to-emerald-50/50 border-emerald-200/70", blue: "from-sky-50/90 via-white to-blue-50/50 border-sky-200/70",
  violet: "from-violet-50/80 via-white to-slate-50 border-violet-200/70", orange: "from-orange-50/80 via-white to-amber-50/40 border-orange-200/70",
  red: "from-rose-50/80 via-white to-red-50/40 border-rose-200/70", amber: "from-amber-50/80 via-white to-yellow-50/40 border-amber-200/70", slate: "from-slate-50 via-white to-slate-100/60 border-slate-200",
};

function StatCard({ label, value, tone = "emerald", sub, icon: Icon, onClick }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${toneStyles[tone]}`}><Icon className="h-5 w-5" /></div>
        {onClick && <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-700" />}
      </div>
      <div className="mt-5 text-2xl font-bold tracking-tight text-slate-950 font-mono-nums">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</div>
      <div className="mt-2 text-xs text-slate-400">{sub}</div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={`dashboard-stat group bg-gradient-to-br ${statToneStyles[tone]} text-left shadow-sm hover:shadow-lg`}>{content}</button>
  ) : <div className={`dashboard-stat group bg-gradient-to-br ${statToneStyles[tone]}`}>{content}</div>;
}

function SmartMedicineCard({ config, items, onClick }) {
  const Icon = config.key === "top" ? Trophy : config.key === "fast" ? Zap : config.key === "dead" ? PackageX : config.key === "expiry" ? ShieldAlert : BadgeIndianRupee;
  return (
    <button type="button" onClick={onClick} className="dashboard-panel group min-w-0 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className={`grid h-9 w-9 place-items-center rounded-xl border ${toneStyles[config.tone]}`}><Icon className="h-4 w-4" /></div>
        <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-700" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-slate-900">{config.title}</h3>
      <p className="mt-1 text-[11px] text-slate-400">{config.subtitle}</p>
      <div className="mt-4 space-y-3">
        {items.slice(0, 3).map((item, index) => {
          const rawMetric = getMetric(item, config.metricKeys);
          const metric = config.metric === "currency" ? fmtINR(rawMetric) : `${rawMetric}${config.suffix || ""}`;
          return <div key={item.id || `${getMedicineName(item)}-${index}`} className="flex items-center gap-2.5">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${toneStyles[config.tone]}`}>{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{getMedicineName(item)}</span>
            <span className="shrink-0 text-[10px] font-bold text-slate-500">{metric}</span>
          </div>;
        })}
        {!items.length && <div className="rounded-xl bg-slate-50 px-3 py-4 text-xs leading-5 text-slate-400">Insights will appear as daily activity builds.</div>}
      </div>
    </button>
  );
}

function SectionHeader({ eyebrow, title, action, onAction }) {
  return <div className="mb-4 flex items-end justify-between gap-4">
    <div><div className="premium-kicker">{eyebrow}</div><h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-950">{title}</h2></div>
    {action && <button onClick={onAction} className="text-xs font-bold text-emerald-700 hover:text-emerald-900">{action} <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button>}
  </div>;
}

function ExpiryTable({ title, tone, columns, items, emptyText, renderRow, onClick }) {
  return <div className="dashboard-panel min-w-0 overflow-hidden">
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-4 text-left">
      <h2 className={`font-bold ${tone}`}>{title}</h2><ArrowUpRight className="h-4 w-4 text-slate-300" />
    </button>
    <div className="max-h-[360px] overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{columns.map((column) => <th key={column} className="border-b p-3 text-left">{column}</th>)}</tr></thead>
    <tbody>{items.length ? items.map(renderRow) : <tr><td className="p-5 text-slate-400" colSpan={columns.length}>{emptyText}</td></tr>}</tbody></table></div>
  </div>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const summaryRes = await api.get("/dashboard/summary");
      setData(summaryRes.data || {});
      const requests = [
        api.get("/reports/outstanding").then((res) => setOutstanding(res.data)).catch((e) => { console.warn("Failed to load outstanding totals", e); setOutstanding(null); }),
        api.get("/purchase-returns").then((res) => setPurchaseReturns(normalizeCollection(res.data))).catch((e) => { console.warn("Failed to load purchase return status records", e); setPurchaseReturns([]); }),
        api.get("/medicines").then((res) => setInventoryBatches(buildInventoryBatchRecords(normalizeCollection(res.data)))).catch((e) => { console.warn("Failed to load inventory batch status records", e); setInventoryBatches([]); }),
      ];
      await Promise.all(requests);
    } catch (e) { toast.error("Failed to load dashboard"); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const customerOutstanding = getOutstandingTotal(outstanding, "customers");
  const distributorOutstanding = getOutstandingTotal(outstanding, "distributors");
  const customerReceivables = toNumber(firstDefined(data.customer_receivables, customerOutstanding, 0));
  const distributorPayables = toNumber(firstDefined(data.distributor_payables, distributorOutstanding, 0));
  const expiringSoonItems = firstDefined(data.expiring_soon_items, data.expiring_soon, []);
  const expiredItems = firstDefined(data.expired_items, data.expired, []);
  const expiringSoonCount = firstDefined(data.expiring_soon_count, expiringSoonItems.length, 0);
  const patientAlerts = getPatientAlerts(data);
  const todaySales = toNumber(firstDefined(data.today_sales, data.sales_today, data.daily_sales_total, 0));
  const todayProfit = toNumber(firstDefined(data.today_profit, data.profit_today, data.daily_profit, 0));
  const todayCustomers = toNumber(firstDefined(data.today_customer_count, data.customers_today_count, data.today_customers, data.today_invoices_count, 0));
  const lowStockItems = firstDefined(data.low_stock_items, []);
  const lowStockCount = firstDefined(data.low_stock_count, lowStockItems.length, 0);
  const returnedUnits = purchaseReturns.reduce((sum, item) => sum + getPurchaseReturnQuantity(item), 0);

  const kpis = [
    { label: "Today Sales", value: fmtINR(todaySales), sub: "Open today's sales", tone: "emerald", icon: IndianRupee, path: "/daily-sales" },
    { label: "Today Profit", value: fmtINR(todayProfit), sub: "Review profit reports", tone: "blue", icon: TrendingUp, path: "/reports" },
    { label: "Today Customers", value: todayCustomers, sub: "View customer activity", tone: "violet", icon: Users, path: "/customers" },
    { label: "Low Stock Count", value: lowStockCount, sub: "Needs replenishment", tone: "orange", icon: PackageSearch, path: "/inventory" },
    { label: "Expiring Soon", value: expiringSoonCount, sub: "Act before expiry", tone: "red", icon: Clock3, path: "/inventory" },
    { label: "Customer Receivables", value: fmtINR(customerReceivables), sub: "Outstanding customer dues", tone: "amber", icon: WalletCards, path: "/reports" },
    { label: "Distributor Payables", value: fmtINR(distributorPayables), sub: "Outstanding supplier dues", tone: "slate", icon: Truck, path: "/reports" },
  ];

  return <div className="dashboard-shell">
    <section className="dashboard-hero">
      <div><div className="premium-kicker text-amber-600">Live pharmacy command center</div><h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">Good decisions start here.</h1><p className="mt-2 max-w-2xl text-sm text-emerald-100/65">Today's sales, stock pressure, expiry risk and cash position — focused into one operational view.</p></div>
      <div className="flex flex-wrap gap-2">
        {[{ label: "New Bill", icon: ReceiptText, path: "/billing" }, { label: "New PO", icon: ShoppingCart, path: "/purchase-orders" }, { label: "Stock Adjustment", icon: SlidersHorizontal, path: "/stock-adjustments" }, { label: "Daily Closing", icon: LockKeyhole, path: "/daily-closing" }].map(({ label, icon: Icon, path }, index) => <button key={label} onClick={() => navigate(path)} className={index === 0 ? "dashboard-action dashboard-action-primary" : "dashboard-action"}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
    </section>

    <section><SectionHeader eyebrow="Today's pulse" title="Daily decision metrics" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-7">{kpis.map((kpi) => <StatCard key={kpi.label} {...kpi} onClick={() => navigate(kpi.path)} />)}</div></section>

    <section><SectionHeader eyebrow="Pharmacy intelligence" title="What deserves your attention" action="Open reports" onAction={() => navigate("/reports")} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{SMART_CARD_CONFIG.map((config) => <SmartMedicineCard key={config.key} config={config} items={getSmartList(data, config.keys)} onClick={() => navigate(config.key === "expiry" || config.key === "dead" ? "/inventory" : "/reports")} />)}</div></section>

    <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <div className="dashboard-panel p-5"><SectionHeader eyebrow="Inventory watch" title="Low stock medicines" action="Open inventory" onAction={() => navigate("/inventory")} />
        <div className="grid gap-2 sm:grid-cols-2">{lowStockItems.slice(0, 8).map((item, index) => { const status = firstDefined(item.low_stock_status, item.stock_status, "Low Stock"); const statusStyle = status === "Restocked" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "Reordered" ? "bg-blue-50 text-blue-700 border-blue-200" : status === "Abandoned" ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-orange-50 text-orange-700 border-orange-200"; return <button key={item.id || index} onClick={() => navigate("/inventory")} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-orange-200 hover:shadow-sm"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-700">{getMedicineName(item)}</span><span className="mt-1 block text-xs text-slate-500">{firstDefined(item.qty, getAvailableStock(item), 0)} units left</span></span><span className="shrink-0 text-right"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>{status}</span><span className="mt-2 block text-[9px] text-slate-400">Read-only · server update pending</span></span></button>; })}{!lowStockItems.length && <p className="col-span-full rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Stock levels look healthy today.</p>}</div>
      </div>
      <div className="dashboard-panel p-5"><SectionHeader eyebrow="Returns desk" title="Purchase return summary" action="Manage returns" onAction={() => navigate("/purchase-returns")} /><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-950 p-4 text-white"><div className="text-2xl font-bold">{purchaseReturns.length}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Return records</div></div><div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><div className="text-2xl font-bold">{returnedUnits}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-amber-700">Units returned</div></div></div><p className="mt-4 text-xs leading-5 text-slate-500">Track supplier returns alongside expiry and batch status to recover inventory value faster.</p></div>
    </section>

    <section className="dashboard-panel overflow-hidden"><div className="border-b border-slate-100 p-5"><SectionHeader eyebrow="Patient care" title="Medicine due alerts" action="Open patients" onAction={() => navigate("/patients")} /></div><div className="max-h-[270px] overflow-auto"><table className="w-full min-w-[680px] text-sm"><thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Patient", "Phone", "Medicine", "Status"].map((x) => <th key={x} className="border-b p-3 text-left">{x}</th>)}</tr></thead><tbody>{patientAlerts.length ? patientAlerts.map((alert, index) => { const status = getPatientAlertStatus(alert); return <tr key={alert.id || index} className="border-b border-slate-100"><td className="p-3 font-semibold">{firstDefined(alert.name, alert.patient_name, "-")}</td><td className="p-3 text-slate-500">{firstDefined(alert.phone, alert.patient_phone, "-")}</td><td className="p-3 text-slate-500">{getMedicineName(alert)}</td><td className="p-3 font-bold text-orange-600">{status}</td></tr>; }) : <tr><td className="p-5 text-slate-400" colSpan={4}>No patient refill alerts today.</td></tr>}</tbody></table></div></section>

    <section className="grid gap-5">
      <ExpiryTable title="Expiring Soon Medicines" tone="text-orange-600" columns={["Medicine", "Batch", "Expiry Date", "Days Remaining", "Return Status"]} items={expiringSoonItems} emptyText="No expiring soon medicines" onClick={() => navigate("/inventory")} renderRow={(item, i) => <tr key={item.id || i} className="border-b border-l-4 border-l-orange-600 border-orange-200 bg-orange-100/80 text-orange-950"><td className="p-3 font-semibold">{getMedicineName(item)}</td><td className="p-3 text-orange-900">{getBatchNo(item)}</td><td className="p-3 text-orange-900">{getExpiryDate(item)}</td><td className="p-3 font-bold text-orange-700">{firstDefined(item.days_to_expiry, item.days_left, item.days_remaining, 0)} days</td><td className="p-3"><ReturnStatusBadge status={getReturnStatus(item, purchaseReturns, inventoryBatches)} /></td></tr>} />
      <ExpiryTable title="Expired Medicines" tone="text-red-600" columns={["Medicine", "Batch", "Expiry Date", "Status", "Return Status"]} items={expiredItems} emptyText="No expired medicines" onClick={() => navigate("/inventory")} renderRow={(item, i) => <tr key={item.id || i} className="border-b border-l-4 border-l-red-700 border-red-200 bg-red-100/80 text-red-950"><td className="p-3 font-semibold">{getMedicineName(item)}</td><td className="p-3 text-red-900">{getBatchNo(item)}</td><td className="p-3 text-red-900">{getExpiryDate(item)}</td><td className="p-3 font-bold text-red-700">Expired {firstDefined(item.expired_days_ago, item.days_expired, 0)} days ago</td><td className="p-3"><ReturnStatusBadge status={getReturnStatus(item, purchaseReturns, inventoryBatches)} /></td></tr>} />
    </section>
  </div>;
}
