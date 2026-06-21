import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, Inbox, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import api, { fmtINR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#0f766e", "#d4a72c", "#2563eb", "#dc2626", "#7c3aed"];
const EMPTY_TEXT = "Data not available currently.";
const today = new Date();
const initialEnd = today.toISOString().slice(0, 10);
const initialStart = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const asArray = (value) => {
  const collection = firstDefined(value?.items, value?.data, value?.results, value?.analytics, value, []);
  return Array.isArray(collection) ? collection : [];
};
const number = (value) => Number(value || 0);
export const hasValues = (rows, keys) => rows.some((row) => keys.some((key) => number(row?.[key]) !== 0));
const pct = (value) => `${number(value).toFixed(1)}%`;
const moneyTip = (value) => fmtINR(value);
const ACTIVE_RETURN_STATUS_BLOCKLIST = new Set(["deleted", "voided"]);
const normalizeStatusKey = (value) => String(value || "recorded").trim().toLowerCase().replace(/[\s-]+/g, "_");
export const displayPurchaseReturnStatus = (value) => {
  const key = normalizeStatusKey(value);
  if (["recorded", "recorded_only", "unsettled", "pending", "credit_pending", "ledger_not_adjusted", "not_adjusted", "unadjusted"].includes(key)) return "Credit Pending";
  if (["ledger_adjusted", "adjusted"].includes(key)) return "Ledger Adjusted";
  if (["settled", "adjusted_in_purchase", "purchase_adjusted", "po_adjusted", "used_in_purchase", "credit_used"].includes(key)) return "Adjusted in Purchase";
  return String(value || "Credit Pending").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const PURCHASE_RETURN_STATUS_HELP = {
  "Credit Pending": "Credit Pending = return recorded but ledger not adjusted yet",
  "Ledger Adjusted": "Ledger Adjusted = distributor ledger already adjusted",
  "Adjusted in Purchase": "Adjusted in Purchase = credit used in a later PO",
};
export const isActivePurchaseReturnStatus = (value) => !ACTIVE_RETURN_STATUS_BLOCKLIST.has(normalizeStatusKey(value));
function Kpi({ label, value, tone = "text-slate-950", icon: Icon, emphasis = false, help }) {
  return <div className={`premium-panel p-4 ${emphasis ? "border-amber-300 bg-amber-50/60" : ""}`}><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span>{Icon && <Icon className="h-4 w-4" />}</div><div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div>{help && <p className="mt-1 text-xs text-slate-500">{help}</p>}</div>;
}

function EmptyState({ children, compact = false }) {
  return <div className={`flex ${compact ? "min-h-28" : "min-h-52"} flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-500`}><Inbox className="mb-3 h-8 w-8 text-slate-300" />{children}</div>;
}

function LoadingPanel({ label = "Loading reports intelligence…" }) {
  return <div className="premium-panel flex items-center gap-3 p-4 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

function ChartCard({ title, subtitle, empty, emptyText = EMPTY_TEXT, children }) {
  return <section className="premium-panel p-4"><div className="mb-4"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>{empty ? <EmptyState compact>{emptyText}</EmptyState> : <div className="h-[280px]">{children}</div>}</section>;
}

function DataTable({ title, subtitle, columns, rows, emptyText = EMPTY_TEXT, renderRow }) {
  return <section className="premium-panel overflow-hidden"><div className="border-b border-slate-100 p-4"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}</div>{rows.length === 0 ? <div className="p-4"><EmptyState compact>{emptyText}</EmptyState></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left font-bold">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map(renderRow)}</tbody></table></div>}</section>;
}

function td(value, className = "") { return <td className={`whitespace-nowrap px-4 py-3 ${className}`}>{value}</td>; }

export const formatAgingDays = (value) => {
  const raw = firstDefined(value?.aging_days, value?.aging, value?.age_days, value?.days, value?.age, value);
  if (raw === undefined || raw === null || raw === "") return "—";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return String(raw);
  const days = Math.max(0, Math.trunc(parsed));
  return `${days} ${days === 1 ? "day" : "days"}`;
};

const agingNumeric = (row) => {
  const parsed = Number(firstDefined(row?.aging_days, row?.aging, row?.age_days, row?.days, row?.age));
  return Number.isFinite(parsed) ? parsed : -1;
};
const sortByAgingDesc = (rows) => [...asArray(rows)].sort((a, b) => agingNumeric(b) - agingNumeric(a));
const recommendation = (row) => firstDefined(row?.recommendation, row?.status, row?.settlement_status, row?.remarks, row?.note, "—");

const normalizeMonthly = (payload) => asArray(firstDefined(payload?.monthly, payload?.monthly_data, payload?.trend, payload)).map((row) => ({
  month: firstDefined(row.month, row.label, row.period, row.date, ""),
  sales: number(firstDefined(row.sales, row.total_sales, row.total, row.amount)),
  profit: number(firstDefined(row.profit, row.estimated_profit, row.gross_profit)),
  purchases: number(firstDefined(row.purchases, row.total_purchases, row.purchase_total)),
}));

const normalizePayments = (payload) => asArray(firstDefined(payload?.payment_modes, payload?.payment_mode_distribution, payload)).map((row) => ({
  name: firstDefined(row.payment_mode, row.mode, row.name, "Other"),
  value: number(firstDefined(row.amount, row.total, row.value, row.count)),
})).filter((row) => row.value > 0);

export const normalizeMedicineRows = (payload, keys = []) => asArray(firstDefined(...keys.map((key) => payload?.[key]), payload)).map((row) => ({
  id: firstDefined(row.id, row._id, row.medicine_id, row.medicine_name, row.name),
  name: firstDefined(row.medicine_name, row.name, row.medicine, "Medicine"),
  batch: firstDefined(row.batch_number, row.batch, "—"),
  expiry: firstDefined(row.expiry_date, row.expiry, "—"),
  stock: number(firstDefined(row.stock, row.current_stock, row.available_stock, row.quantity)),
  units: number(firstDefined(row.units_sold, row.sold_quantity, row.quantity_sold, row.quantity, row.units)),
  revenue: number(firstDefined(row.revenue, row.sales, row.total_sales, row.amount)),
  cost: number(firstDefined(row.cost, row.cost_value, row.purchase_value, row.purchase_cost)),
  profit: number(firstDefined(row.profit, row.estimated_profit, row.gross_profit, row.margin_value)),
  margin: number(firstDefined(row.margin_percentage, row.margin_percent, row.margin, row.profit_margin)),
  riskValue: number(firstDefined(row.risk_value, row.value_at_risk, row.expiry_value_at_risk, row.inventory_value, row.stock_value)),
  lastSale: firstDefined(row.last_sale, row.last_sale_date, row.last_sold_at, "—"),
  daysIdle: number(firstDefined(row.days_idle, row.days_since_sale, row.idle_days)),
  daysRemaining: number(firstDefined(row.days_remaining, row.stock_days_remaining, row.days_left)),
  reorderQty: number(firstDefined(row.suggested_reorder_qty, row.reorder_qty, row.suggested_quantity)),
  status: firstDefined(row.status, row.settlement_status, "Credit Pending"),
  returnedQty: number(firstDefined(row.qty_returned, row.returned_quantity, row.return_quantity, row.quantity)),
  value: number(firstDefined(row.value, row.return_value, row.total_value, row.amount)),
  category: firstDefined(row.category, row.category_name, "Uncategorized"),
}));

export const buildExpiryRiskCards = (payload = {}, stock = {}) => {
  const expired = number(firstDefined(payload.expired_value_at_risk, payload.expired_value, stock.expired_value_at_risk));
  const thirty = number(firstDefined(payload.expiring_30_value_at_risk, payload.expiring_30_value, stock.expiring_30_value_at_risk));
  const ninetyExplicit = firstDefined(payload.expiring_31_90_value_at_risk, payload.expiring_31_90_value, stock.expiring_31_90_value_at_risk);
  const ninetyCumulative = number(firstDefined(payload.expiring_90_value_at_risk, payload.expiring_90_value, stock.expiring_90_value_at_risk));
  const thirtyToNinety = ninetyExplicit !== undefined && ninetyExplicit !== null ? number(ninetyExplicit) : Math.max(ninetyCumulative - thirty, 0);
  return [
    { label: "Expired Value", value: expired },
    { label: "0-30 Day Risk", value: thirty },
    { label: "31-90 Day Risk", value: thirtyToNinety },
  ];
};

const distributorMovementRows = (payload) => asArray(firstDefined(
  payload?.distributor_outstanding_movement,
  payload?.distributorOutstandingMovement,
  payload?.distributor_payable_movement,
  payload?.distributorPayableMovement,
  payload?.distributor_payables_movement,
  payload?.distributorPayablesMovement,
  payload?.data?.distributor_outstanding_movement,
  payload?.data?.distributorOutstandingMovement,
  payload?.data?.distributor_payable_movement,
  payload?.data?.distributorPayableMovement,
  payload?.data?.distributor_payables_movement,
  payload?.data?.distributorPayablesMovement,
  Array.isArray(payload) ? payload : undefined,
));

export const normalizeRecovery = (payload) => distributorMovementRows(payload).map((row) => ({
  period: firstDefined(row.month, row.period, row.label, row.date, ""),
  distributorOutstanding: number(firstDefined(
    row.closing_distributor_payable,
    row.closingDistributorPayable,
    row.closingBalance,
    row.closing_balance,
    row.outstanding,
    row.payable,
    row.amount,
  )),
})).filter((row) => row.period || Number.isFinite(row.distributorOutstanding));

const reportRows = (source) => {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];
  return Object.entries(source).map(([name, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return { name, ...value };
    return { name, total_return_value: value };
  });
};

export const normalizePurchaseReturnAnalytics = (payload) => {
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  const summary = data?.summary && typeof data.summary === "object" ? data.summary : {};
  const rows = reportRows(firstDefined(
    data?.medicine_wise_return_analytics,
    data?.returns_by_medicine,
    data?.medicine_wise,
    data?.by_medicine,
    data?.medicine_breakdown,
    data?.medicines,
    data?.purchase_returns,
    data?.returns,
    data?.items,
    summary.medicine_wise_return_analytics,
    summary.returns_by_medicine,
    summary.medicine_wise,
    summary.by_medicine,
    summary.medicine_breakdown,
    summary.medicines,
    summary.purchase_returns,
    summary.returns,
    summary.items,
    data,
  ));

  return rows.filter((row) => isActivePurchaseReturnStatus(firstDefined(row.status, row.settlement_status, row.ledger_status, "Credit Pending"))).map((row) => ({
    id: firstDefined(row.id, row._id, row.purchase_return_id, row.medicine_id, row.medicine_name, row.name),
    name: firstDefined(row.medicine_name, row.medicine, row.name, row.label, "Medicine"),
    distributor: firstDefined(row.distributor_name, row.distributor, row.supplier_name, row.supplier, "—"),
    returnedQty: number(firstDefined(
      row.total_returned_quantity,
      row.total_return_quantity,
      row.total_quantity,
      row.return_quantity,
      row.quantity,
      row.qty,
    )),
    value: number(firstDefined(
      row.total_return_value,
      row.total_return_amount,
      row.total_amount,
      row.return_amount,
      row.amount,
      row.value,
    )),
    status: displayPurchaseReturnStatus(firstDefined(row.status, row.settlement_status, row.ledger_status, "Credit Pending")),
    returnDate: firstDefined(row.return_date, row.date, row.created_at, "—"),
  }));
};

async function optionalGet(url, params) {
  try { const { data } = await api.get(url, { params }); return data; } catch { return null; }
}

export default function Reports() {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [topSellingPayload, setTopSellingPayload] = useState(null);
  const [paymentsPayload, setPaymentsPayload] = useState(null);
  const [purchaseSalesPayload, setPurchaseSalesPayload] = useState(null);
  const [recoveryPayload, setRecoveryPayload] = useState(null);
  const [analytics, setAnalytics] = useState({});

  const loadSales = useCallback(async () => {
    setSalesLoading(true);
    const params = { start, end };
    const [salesData, topData, paymentData, purchaseSalesData] = await Promise.all([
      optionalGet("/reports/sales", params), optionalGet("/reports/top-selling-medicines", params), optionalGet("/reports/payment-modes", params), optionalGet("/reports/purchase-vs-sales", params),
    ]);
    setSales(salesData); setTopSellingPayload(topData ?? salesData?.top_selling_medicines ?? null); setPaymentsPayload(paymentData ?? salesData?.payment_modes ?? null); setPurchaseSalesPayload(purchaseSalesData ?? salesData?.purchase_vs_sales ?? salesData?.monthly ?? null); setSalesLoading(false);
  }, [start, end]);

  useEffect(() => {
    setLoading(true);
    loadSales();
    Promise.all([
      optionalGet("/reports/stock-valuation"), optionalGet("/reports/outstanding"), optionalGet("/reports/expiry-analytics"), optionalGet("/reports/recovery-movement"), optionalGet("/dashboard/summary"), optionalGet("/reports/analytics"), optionalGet("/reports/purchase-returns"),
    ]).then(([stockData, outstandingData, expiryData, recoveryData, dashboardData, analyticsData, returnsData]) => {
      setStock({ ...(stockData || {}), expiry_analytics: expiryData ?? stockData?.expiry_analytics ?? dashboardData?.expiry_analytics ?? dashboardData });
      setOutstanding(outstandingData); setRecoveryPayload(recoveryData ?? outstandingData?.recovery_movement ?? outstandingData ?? null); setAnalytics({ ...(analyticsData || {}), purchase_returns: returnsData ?? analyticsData?.purchase_returns }); setLoading(false);
    });
  }, [loadSales]);

  const monthlySales = useMemo(() => normalizeMonthly(sales), [sales]);
  const purchaseVsSales = useMemo(() => normalizeMonthly(purchaseSalesPayload), [purchaseSalesPayload]);
  const payments = useMemo(() => normalizePayments(paymentsPayload), [paymentsPayload]);
  const topRevenue = useMemo(() => normalizeMedicineRows(firstDefined(analytics?.top_revenue_medicines, topSellingPayload), ["top_revenue_medicines", "top_selling_medicines"]).filter((r) => r.revenue || r.units), [analytics, topSellingPayload]);
  const topProfit = useMemo(() => normalizeMedicineRows(analytics, ["top_profit_medicines", "medicine_profit"]).filter((r) => r.profit), [analytics]);
  const medicineProfit = useMemo(() => normalizeMedicineRows(analytics, ["medicine_profit", "medicine_profit_intelligence"]), [analytics]);
  const fastMoving = useMemo(() => normalizeMedicineRows(firstDefined(analytics?.fast_moving, topSellingPayload), ["fast_moving", "top_selling_medicines"]), [analytics, topSellingPayload]);
  const slowMoving = useMemo(() => normalizeMedicineRows(analytics, ["slow_moving", "slow_moving_medicines"]), [analytics]);
  const deadStock = useMemo(() => normalizeMedicineRows(analytics, ["dead_stock", "dead_stock_medicines"]), [analytics]);
  const reorderRows = useMemo(() => normalizeMedicineRows(firstDefined(analytics?.reorder_intelligence, stock?.reorder_intelligence), ["reorder_intelligence", "reorder_suggestions"]), [analytics, stock]);
  const expiryRows = useMemo(() => normalizeMedicineRows(firstDefined(stock?.expiry_analytics?.top_risk_medicines, analytics?.top_expiry_risk), ["top_risk_medicines", "top_expiry_risk"]), [stock, analytics]);
  const returnRows = useMemo(() => normalizePurchaseReturnAnalytics(analytics?.purchase_returns), [analytics]);
  const categoryRows = useMemo(() => normalizeMedicineRows(analytics, ["category_profitability", "categories"]), [analytics]);
  const recovery = useMemo(() => normalizeRecovery(recoveryPayload), [recoveryPayload]);
  const recoveryHasOnlyZeroValues = recovery.length > 0 && !hasValues(recovery, ["distributorOutstanding"]);
  const customerOutstanding = asArray(outstanding?.customers).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);
  const distributorOutstanding = asArray(outstanding?.distributors).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);
  const net = customerOutstanding - distributorOutstanding;
  const salesExist = number(sales?.total_sales) > 0 || number(sales?.invoice_count) > 0 || hasValues(monthlySales, ["sales"]);
  const averageBill = number(sales?.invoice_count) ? number(sales?.total_sales) / number(sales?.invoice_count) : number(sales?.average_bill_value);
  const averageProfit = number(sales?.invoice_count) ? number(sales?.estimated_profit) / number(sales?.invoice_count) : number(sales?.average_profit_per_invoice);
  const highestDay = firstDefined(sales?.highest_billing_day, sales?.highest_day, "—");
  const riskCards = buildExpiryRiskCards(stock?.expiry_analytics || {}, stock || {});
  const aging = (side) => firstDefined(outstanding?.aging?.[side], outstanding?.aging_buckets?.[side], outstanding?.[`${side}_aging`], {});
  const agingTone = { "0_30": "bg-emerald-50 text-emerald-700", "31_60": "bg-amber-50 text-amber-700", "61_90": "bg-orange-50 text-orange-700", "90_plus": "bg-red-50 text-red-700" };
  const agingBuckets = (side) => [["0-30 days", "0_30"], ["31-60 days", "31_60"], ["61-90 days", "61_90"], ["90+ days", "90_plus"]].map(([label, key]) => ({ label, key, value: number(firstDefined(aging(side)?.[key], aging(side)?.[key.replace("_", "-")], aging(side)?.[label], aging(side)?.[`${key}_days`])) }));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="premium-kicker">Business intelligence</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Reports command center</h1><p className="text-sm text-slate-500">Action-focused pharmacy intelligence from recorded transactions only.</p></div><BarChart3 className="h-10 w-10 text-emerald-700" /></div>
    {loading && <LoadingPanel />}
    <Tabs defaultValue="sales"><TabsList className="h-auto flex-wrap rounded-xl bg-white/70 p-1 shadow-sm"><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="stock">Stock & Expiry</TabsTrigger><TabsTrigger value="outstanding">Outstanding</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList>
      <TabsContent value="sales" className="mt-5 space-y-5">
        <div className="premium-panel flex flex-wrap items-end gap-3 p-4"><div><Label>From</Label><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label>To</Label><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div><Button onClick={loadSales} className="bg-emerald-900" disabled={salesLoading}>{salesLoading ? "Refreshing…" : "Refresh data"}</Button></div>
        {!salesExist && !salesLoading ? <EmptyState>Data not available currently.</EmptyState> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Total Sales" value={fmtINR(sales?.total_sales)} /><Kpi label="GST" value={fmtINR(sales?.total_gst)} /><Kpi label="Invoice Count" value={number(sales?.invoice_count)} /><Kpi label="Estimated Profit" value={fmtINR(sales?.estimated_profit)} tone="text-emerald-700" /><Kpi label="Average Bill Value" value={fmtINR(averageBill)} /><Kpi label="Average Profit Per Invoice" value={fmtINR(averageProfit)} tone="text-emerald-700" /><Kpi label="Highest Billing Day" value={highestDay} /></div>
        <div className="grid gap-5 xl:grid-cols-3"><ChartCard title="Monthly Sales Trend" subtitle="Use dips to plan promotions and staffing." empty={!hasValues(monthlySales, ["sales"])} emptyText="Data not available currently."><ResponsiveContainer><AreaChart data={monthlySales}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Area type="monotone" dataKey="sales" name="Sales" stroke="#0f766e" fill="#ccfbf1" strokeWidth={3} /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Monthly Profit Trend" subtitle="Track whether revenue growth is also profitable." empty={!hasValues(monthlySales, ["profit"])} emptyText="Data not available currently."><ResponsiveContainer><LineChart data={monthlySales}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Line type="monotone" dataKey="profit" name="Profit" stroke="#0f766e" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard><ChartCard title="Payment Mode Distribution" subtitle="Check cash, UPI, and card collection concentration." empty={!payments.length} emptyText="Data not available currently."><ResponsiveContainer><BarChart data={payments}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Bar dataKey="value" name="Collections">{payments.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartCard></div>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Top Revenue Medicines" subtitle="Prioritize availability for the medicines driving sales." columns={["Medicine", "Units Sold", "Revenue"]} rows={topRevenue.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.units)}{td(fmtINR(row.revenue), "font-bold")}</tr>} /><DataTable title="Top Profit Medicines" subtitle="Protect these margins when applying discounts." columns={["Medicine", "Profit", "Margin %"]} rows={topProfit.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}</tr>} /></div></>}
      </TabsContent>
      <TabsContent value="stock" className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{riskCards.map((card, index) => <Kpi key={card.label} label={card.label} value={fmtINR(card.value)} tone={index === 0 ? "text-red-700" : index === 1 ? "text-orange-700" : "text-amber-700"} icon={AlertTriangle} help="Amount in INR at risk by expiry window." />)}</div>
        <ChartCard title="Expiry Risk Breakdown" subtitle="Inventory value at risk by expiry window." empty={!riskCards.some((card) => card.value > 0)}><ResponsiveContainer><BarChart data={riskCards}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="label" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Bar dataKey="value" name="Value at risk (INR)">{riskCards.map((_, index) => <Cell key={index} fill={COLORS[(index + 3) % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartCard>
        <DataTable title="Top Expiry Risk Medicines" subtitle="Return, discount, or transfer these batches first." columns={["Medicine", "Batch", "Expiry", "Stock", "Risk Value"]} rows={expiryRows.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={`${row.name}-${row.batch}`}>{td(row.name, "font-semibold text-slate-800")}{td(row.batch)}{td(row.expiry)}{td(row.stock)}{td(fmtINR(row.riskValue), "font-bold text-red-700")}</tr>} />
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Dead Stock" subtitle="Stop reordering and plan liquidation for idle inventory." columns={["Medicine", "Stock", "Last Sale", "Days Idle", "Inventory Value"]} rows={deadStock.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.lastSale)}{td(row.daysIdle)}{td(fmtINR(row.riskValue || row.cost), "font-bold")}</tr>} /><DataTable title="Reorder Intelligence" subtitle="Buy only where stock cover is low." columns={["Medicine", "Current Stock", "Days Remaining", "Suggested Reorder Qty"]} rows={reorderRows.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.daysRemaining)}{td(row.reorderQty, "font-bold text-emerald-700")}</tr>} /></div>
      </TabsContent>
      <TabsContent value="outstanding" className="mt-5 space-y-5">
        <Kpi label={net >= 0 ? "Net Receivable" : "Net Payable"} value={fmtINR(Math.abs(net))} tone={net >= 0 ? "text-emerald-700" : "text-rose-700"} icon={net >= 0 ? TrendingUp : TrendingDown} emphasis help="This is receivables minus distributor payables." />
        <div className="grid gap-5 lg:grid-cols-2">{[["Customer Receivables", customerOutstanding, "customers", "text-rose-700"], ["Distributor Payables", distributorOutstanding, "distributors", "text-amber-700"]].map(([title, total, side, tone]) => <section key={side} className="premium-panel p-5"><h3 className="font-heading text-lg font-bold">{title}</h3><div className={`mt-2 text-3xl font-extrabold ${tone}`}>{fmtINR(total)}</div><div className="mt-5 grid grid-cols-2 gap-3">{agingBuckets(side).map((bucket) => <div key={bucket.label} className={`rounded-lg p-3 ${agingTone[bucket.key]}`}><div className="text-xs font-semibold">{bucket.label}</div><div className="mt-1 font-bold">{fmtINR(bucket.value)}</div></div>)}</div></section>)}</div>
        <ChartCard title="Distributor Outstanding Movement" subtitle="Tracks monthly distributor payable movement from purchases, payments and adjustments." empty={recovery.length === 0} emptyText="No distributor outstanding movement recorded yet."><>{recoveryHasOnlyZeroValues && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Distributor outstanding movement data is available but all values are zero. Please verify distributor ledger balances.</div>}<ResponsiveContainer><LineChart data={recovery}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Line dataKey="distributorOutstanding" name="Distributor payables" stroke="#d4a72c" strokeWidth={2} /></LineChart></ResponsiveContainer></></ChartCard>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Customer Recovery" subtitle="Oldest and largest overdue balances first." columns={["Customer", "Outstanding", "Aging (days)", "Recommendation / Status"]} rows={sortByAgingDesc(outstanding?.customers)} renderRow={(row, i) => <tr key={row.id || row.customer_id || i}>{td(firstDefined(row.customer_name, row.name, row.customer, "Customer"), "font-semibold text-slate-800")}{td(fmtINR(firstDefined(row.outstanding, row.balance)), "font-bold text-rose-700")}{td(formatAgingDays(row))}{td(recommendation(row))}</tr>} /><DataTable title="Distributor Payable" subtitle="Largest and oldest supplier balances first." columns={["Distributor", "Outstanding", "Aging (days)", "Recommendation / Status"]} rows={sortByAgingDesc(outstanding?.distributors)} renderRow={(row, i) => <tr key={row.id || row.distributor_id || i}>{td(firstDefined(row.distributor_name, row.name, row.distributor, "Distributor"), "font-semibold text-slate-800")}{td(fmtINR(firstDefined(row.outstanding, row.balance)), "font-bold text-amber-700")}{td(formatAgingDays(row))}{td(recommendation(row))}</tr>} /></div>
      </TabsContent>
      <TabsContent value="analytics" className="mt-5 space-y-5">
        <DataTable title="Medicine Profit Intelligence" subtitle="Raise focus on high-profit medicines and investigate low margins." columns={["Medicine", "Revenue", "Cost", "Profit", "Margin %", "Units Sold"]} rows={medicineProfit.slice(0, 15)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(fmtINR(row.revenue))}{td(fmtINR(row.cost))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}{td(row.units)}</tr>} />
        <div className="grid gap-5 xl:grid-cols-2"><ChartCard title="Category Profitability" subtitle="Profit by category in INR." empty={!hasValues(categoryRows, ["profit", "revenue"])}><ResponsiveContainer><BarChart data={categoryRows.slice(0, 10)}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="category" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Bar dataKey="profit" name="Profit (INR)" fill="#0f766e" /><Bar dataKey="revenue" name="Revenue (INR)" fill="#2563eb" /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Fast Moving Medicines" subtitle="Units sold by fast-moving medicine." empty={!hasValues(fastMoving, ["units"])}><ResponsiveContainer><BarChart data={fastMoving.slice(0, 10)}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" /><YAxis width={70} /><Tooltip /><Legend /><Bar dataKey="units" name="Units sold" fill="#0f766e" /></BarChart></ResponsiveContainer></ChartCard></div>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Fast Moving Medicines" subtitle="Keep these medicines available before peak demand." columns={["Medicine", "Units Sold", "Revenue", "Profit"]} rows={fastMoving.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.units)}{td(fmtINR(row.revenue))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}</tr>} /><DataTable title="Slow Moving Medicines" subtitle="Reduce reorder quantities and review shelf space." columns={["Medicine", "Stock", "Last Sale", "Days Since Sale"]} rows={slowMoving.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.lastSale)}{td(row.daysIdle)}</tr>} /></div>
        <DataTable title="Purchase Return Analytics" subtitle="Track returned quantity, value, distributor, and credit handling status. Credit Pending = return recorded but ledger not adjusted yet. Ledger Adjusted = distributor ledger already adjusted. Adjusted in Purchase = credit used in a later PO." columns={["Medicine", "Distributor", "Qty Returned", "Return Value", "Status", "Return Date"]} rows={returnRows.slice(0, 10)} emptyText="No purchase returns recorded yet." renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.distributor)}{td(row.returnedQty)}{td(fmtINR(row.value), "font-bold")}{td(<span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700" title={PURCHASE_RETURN_STATUS_HELP[row.status]}>{row.status}</span>)}{td(row.returnDate)}</tr>} />
        <DataTable title="Category Profitability" subtitle="Use category margin to guide buying and promotions." columns={["Category", "Revenue", "Profit", "Margin"]} rows={categoryRows.slice(0, 10)} emptyText="Data not available currently." renderRow={(row) => <tr key={row.category}>{td(row.category, "font-semibold text-slate-800")}{td(fmtINR(row.revenue))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}</tr>} />
      </TabsContent>
    </Tabs>
  </div>;
}
