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
const today = new Date();
const initialEnd = today.toISOString().slice(0, 10);
const initialStart = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const asArray = (value) => {
  const collection = firstDefined(value?.items, value?.data, value?.results, value?.analytics, value, []);
  return Array.isArray(collection) ? collection : [];
};
const number = (value) => Number(value || 0);
const hasValues = (rows, keys) => rows.some((row) => keys.some((key) => number(row?.[key]) !== 0));
const pct = (value) => `${number(value).toFixed(1)}%`;
const moneyTip = (value) => fmtINR(value);

function Kpi({ label, value, tone = "text-slate-950", icon: Icon, emphasis = false, help }) {
  return <div className={`premium-panel p-4 ${emphasis ? "border-amber-300 bg-amber-50/60" : ""}`}><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span>{Icon && <Icon className="h-4 w-4" />}</div><div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div>{help && <p className="mt-1 text-xs text-slate-500">{help}</p>}</div>;
}

function EmptyState({ children, compact = false }) {
  return <div className={`flex ${compact ? "min-h-28" : "min-h-52"} flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-500`}><Inbox className="mb-3 h-8 w-8 text-slate-300" />{children}</div>;
}

function LoadingPanel({ label = "Loading reports intelligence…" }) {
  return <div className="premium-panel flex items-center gap-3 p-4 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

function ChartCard({ title, subtitle, empty, emptyText, children }) {
  return <section className="premium-panel p-4"><div className="mb-4"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>{empty ? <EmptyState>{emptyText}</EmptyState> : <div className="h-[280px]">{children}</div>}</section>;
}

function DataTable({ title, subtitle, columns, rows, emptyText, renderRow }) {
  return <section className="premium-panel overflow-hidden"><div className="border-b border-slate-100 p-4"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}</div>{rows.length === 0 ? <div className="p-4"><EmptyState compact>{emptyText}</EmptyState></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 text-left font-bold">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map(renderRow)}</tbody></table></div>}</section>;
}

function td(value, className = "") { return <td className={`whitespace-nowrap px-4 py-3 ${className}`}>{value}</td>; }

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
  status: firstDefined(row.status, row.settlement_status, "Recorded"),
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

const normalizeRecovery = (payload) => asArray(firstDefined(payload?.recovery_movement, payload?.recovery_trend, payload?.movement, payload)).map((row) => ({
  period: firstDefined(row.month, row.period, row.date, row.label, ""),
  customerOutstanding: number(firstDefined(row.customer_outstanding, row.customers, row.customer)),
  distributorOutstanding: number(firstDefined(row.distributor_outstanding, row.distributors, row.distributor)),
}));

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
      setOutstanding(outstandingData); setRecoveryPayload(recoveryData ?? outstandingData?.recovery_movement ?? null); setAnalytics({ ...(analyticsData || {}), purchase_returns: returnsData ?? analyticsData?.purchase_returns }); setLoading(false);
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
  const returnRows = useMemo(() => normalizeMedicineRows(firstDefined(analytics?.purchase_returns?.items, analytics?.purchase_returns), ["purchase_returns", "returns"]), [analytics]);
  const categoryRows = useMemo(() => normalizeMedicineRows(analytics, ["category_profitability", "categories"]), [analytics]);
  const recovery = useMemo(() => normalizeRecovery(recoveryPayload), [recoveryPayload]);
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
    <Tabs defaultValue="sales"><TabsList className="h-auto flex-wrap rounded-xl bg-white/70 p-1 shadow-sm"><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="stock">Stock & expiry</TabsTrigger><TabsTrigger value="outstanding">Outstanding</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList>
      <TabsContent value="sales" className="mt-5 space-y-5">
        <div className="premium-panel flex flex-wrap items-end gap-3 p-4"><div><Label>From</Label><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label>To</Label><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div><Button onClick={loadSales} className="bg-emerald-900" disabled={salesLoading}>{salesLoading ? "Refreshing…" : "Refresh data"}</Button></div>
        {!salesExist && !salesLoading ? <EmptyState>No sales recorded yet.<br />Generate invoices to unlock sales intelligence.</EmptyState> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Total Sales" value={fmtINR(sales?.total_sales)} /><Kpi label="GST" value={fmtINR(sales?.total_gst)} /><Kpi label="Invoice Count" value={number(sales?.invoice_count)} /><Kpi label="Estimated Profit" value={fmtINR(sales?.estimated_profit)} tone="text-emerald-700" /><Kpi label="Average Bill Value" value={fmtINR(averageBill)} /><Kpi label="Average Profit Per Invoice" value={fmtINR(averageProfit)} tone="text-emerald-700" /><Kpi label="Highest Billing Day" value={highestDay} /><Kpi label="Action" value="Review top margins" help="Use profit tables before discounts or reorders." /></div>
        <div className="grid gap-5 xl:grid-cols-3"><ChartCard title="Monthly Sales Trend" subtitle="Use dips to plan promotions and staffing." empty={!hasValues(monthlySales, ["sales"])} emptyText="No sales recorded yet"><ResponsiveContainer><AreaChart data={monthlySales}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Area type="monotone" dataKey="sales" name="Sales" stroke="#0f766e" fill="#ccfbf1" strokeWidth={3} /></AreaChart></ResponsiveContainer></ChartCard><ChartCard title="Monthly Profit Trend" subtitle="Track whether revenue growth is also profitable." empty={!hasValues(monthlySales, ["profit"])} emptyText="No profit trend recorded yet"><ResponsiveContainer><LineChart data={monthlySales}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Line type="monotone" dataKey="profit" name="Profit" stroke="#0f766e" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard><ChartCard title="Payment Mode Distribution" subtitle="Check cash, UPI, and card collection concentration." empty={!payments.length} emptyText="No payment mode collections recorded yet"><ResponsiveContainer><BarChart data={payments}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Bar dataKey="value" name="Collections">{payments.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartCard></div>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Top Revenue Medicines" subtitle="Prioritize availability for the medicines driving sales." columns={["Medicine", "Units Sold", "Revenue"]} rows={topRevenue.slice(0, 10)} emptyText="No revenue medicines recorded yet" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.units)}{td(fmtINR(row.revenue), "font-bold")}</tr>} /><DataTable title="Top Profit Medicines" subtitle="Protect these margins when applying discounts." columns={["Medicine", "Profit", "Margin %"]} rows={topProfit.slice(0, 10)} emptyText="No profit medicines recorded yet" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}</tr>} /></div></>}
      </TabsContent>
      <TabsContent value="stock" className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{riskCards.map((card, index) => <Kpi key={card.label} label={card.label} value={fmtINR(card.value)} tone={index === 0 ? "text-red-700" : index === 1 ? "text-orange-700" : "text-amber-700"} icon={AlertTriangle} help="Act with returns, clearance, or purchase control." />)}</div>
        <DataTable title="Top Expiry Risk Medicines" subtitle="Return, discount, or transfer these batches first." columns={["Medicine", "Batch", "Expiry", "Stock", "Risk Value"]} rows={expiryRows.slice(0, 10)} emptyText="No expiry risk detected" renderRow={(row) => <tr key={`${row.name}-${row.batch}`}>{td(row.name, "font-semibold text-slate-800")}{td(row.batch)}{td(row.expiry)}{td(row.stock)}{td(fmtINR(row.riskValue), "font-bold text-red-700")}</tr>} />
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Dead Stock" subtitle="Stop reordering and plan liquidation for idle inventory." columns={["Medicine", "Stock", "Last Sale", "Days Idle", "Inventory Value"]} rows={deadStock.slice(0, 10)} emptyText="No dead stock detected" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.lastSale)}{td(row.daysIdle)}{td(fmtINR(row.riskValue || row.cost), "font-bold")}</tr>} /><DataTable title="Reorder Intelligence" subtitle="Buy only where stock cover is low." columns={["Medicine", "Current Stock", "Days Remaining", "Suggested Reorder Qty"]} rows={reorderRows.slice(0, 10)} emptyText="No reorder action required" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.daysRemaining)}{td(row.reorderQty, "font-bold text-emerald-700")}</tr>} /></div>
      </TabsContent>
      <TabsContent value="outstanding" className="mt-5 space-y-5">
        <Kpi label={net >= 0 ? "Net Receivable" : "Net Payable"} value={fmtINR(Math.abs(net))} tone={net >= 0 ? "text-emerald-700" : "text-rose-700"} icon={net >= 0 ? TrendingUp : TrendingDown} emphasis help="This is receivables minus distributor payables." />
        <div className="grid gap-5 lg:grid-cols-2">{[["Customer Receivables", customerOutstanding, "customers", "text-rose-700"], ["Distributor Payables", distributorOutstanding, "distributors", "text-amber-700"]].map(([title, total, side, tone]) => <section key={side} className="premium-panel p-5"><h3 className="font-heading text-lg font-bold">{title}</h3><div className={`mt-2 text-3xl font-extrabold ${tone}`}>{fmtINR(total)}</div><div className="mt-5 grid grid-cols-2 gap-3">{agingBuckets(side).map((bucket) => <div key={bucket.label} className={`rounded-lg p-3 ${agingTone[bucket.key]}`}><div className="text-xs font-semibold">{bucket.label}</div><div className="mt-1 font-bold">{fmtINR(bucket.value)}</div></div>)}</div></section>)}</div>
        <ChartCard title="Outstanding Movement" subtitle="Act when receivables or payables trend upward." empty={!hasValues(recovery, ["customerOutstanding", "distributorOutstanding"])} emptyText="No outstanding movement recorded yet"><ResponsiveContainer><LineChart data={recovery}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Line dataKey="customerOutstanding" name="Customer receivables" stroke="#dc2626" strokeWidth={2} /><Line dataKey="distributorOutstanding" name="Distributor payables" stroke="#d4a72c" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartCard>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Customer Recovery" subtitle="Call oldest and largest overdue balances first." columns={["Customer", "Outstanding", "Aging", "Action"]} rows={asArray(outstanding?.customers)} emptyText="No customer receivables pending" renderRow={(row, i) => <tr key={row.id || row.customer_id || i}>{td(firstDefined(row.customer_name, row.name, row.customer, "Customer"), "font-semibold text-slate-800")}{td(fmtINR(firstDefined(row.outstanding, row.balance)), "font-bold text-rose-700")}{td(firstDefined(row.aging_bucket, row.age, "—"))}{td("Recover / follow up")}</tr>} /><DataTable title="Distributor Payable" subtitle="Schedule payments to preserve supplier relationships." columns={["Distributor", "Outstanding", "Aging", "Action"]} rows={asArray(outstanding?.distributors)} emptyText="No distributor payables pending" renderRow={(row, i) => <tr key={row.id || row.distributor_id || i}>{td(firstDefined(row.distributor_name, row.name, row.distributor, "Distributor"), "font-semibold text-slate-800")}{td(fmtINR(firstDefined(row.outstanding, row.balance)), "font-bold text-amber-700")}{td(firstDefined(row.aging_bucket, row.age, "—"))}{td("Plan payment")}</tr>} /></div>
      </TabsContent>
      <TabsContent value="analytics" className="mt-5 space-y-5">
        <DataTable title="Medicine Profit Intelligence" subtitle="Raise focus on high-profit medicines and investigate low margins." columns={["Medicine", "Revenue", "Cost", "Profit", "Margin %", "Units Sold"]} rows={medicineProfit.slice(0, 15)} emptyText="No medicine profit intelligence recorded yet" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(fmtINR(row.revenue))}{td(fmtINR(row.cost))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}{td(row.units)}</tr>} />
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Fast Moving Medicines" subtitle="Keep these medicines available before peak demand." columns={["Medicine", "Units Sold", "Revenue", "Profit"]} rows={fastMoving.slice(0, 10)} emptyText="No fast moving medicines recorded yet" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.units)}{td(fmtINR(row.revenue))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}</tr>} /><DataTable title="Slow Moving Medicines" subtitle="Reduce reorder quantities and review shelf space." columns={["Medicine", "Stock", "Last Sale", "Days Since Sale"]} rows={slowMoving.slice(0, 10)} emptyText="No slow moving medicines detected" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.stock)}{td(row.lastSale)}{td(row.daysIdle)}</tr>} /></div>
        <div className="grid gap-5 xl:grid-cols-2"><DataTable title="Purchase Return Analytics" subtitle="Track returned quantity, value, and settlement status." columns={["Medicine", "Qty Returned", "Value", "Status"]} rows={returnRows.slice(0, 10)} emptyText="No purchase returns recorded" renderRow={(row) => <tr key={row.id || row.name}>{td(row.name, "font-semibold text-slate-800")}{td(row.returnedQty)}{td(fmtINR(row.value), "font-bold")}{td(row.status)}</tr>} /><DataTable title="Category Profitability" subtitle="Use category margin to guide buying and promotions." columns={["Category", "Revenue", "Profit", "Margin"]} rows={categoryRows.slice(0, 10)} emptyText="No category profitability recorded yet" renderRow={(row) => <tr key={row.category}>{td(row.category, "font-semibold text-slate-800")}{td(fmtINR(row.revenue))}{td(fmtINR(row.profit), "font-bold text-emerald-700")}{td(pct(row.margin))}</tr>} /></div>
      </TabsContent>
    </Tabs>
  </div>;
}
