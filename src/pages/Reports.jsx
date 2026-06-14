import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, Inbox } from "lucide-react";
import api, { fmtINR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildExpiryValueRiskChartData, hasExpiryValueRiskData } from "./expiryValueRisk";

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
const moneyTip = (value) => fmtINR(value);

function Kpi({ label, value, tone = "text-slate-950", icon: Icon, emphasis = false, help }) {
  return <div className={`premium-panel p-4 ${emphasis ? "border-amber-300 bg-amber-50/60" : ""}`}><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span>{Icon && <Icon className="h-4 w-4" />}</div><div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div>{help && <p className="mt-1 text-xs text-slate-500">{help}</p>}</div>;
}

function InsightSection({ title, description, children, empty = true }) {
  return <section className="premium-panel p-5"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p><div className="mt-4">{empty ? <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">No recorded data is available for this insight yet.</div> : children}</div></section>;
}

function EmptyState({ children }) {
  return <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm font-semibold text-slate-500"><Inbox className="mb-3 h-8 w-8 text-slate-300" />{children}</div>;
}

function ChartCard({ title, subtitle, empty, emptyText, children }) {
  return <div className="premium-panel p-4"><div className="mb-4"><h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>{empty ? <EmptyState>{emptyText}</EmptyState> : <div className="h-[300px]">{children}</div>}</div>;
}

const normalizeMonthly = (payload) => asArray(firstDefined(payload?.monthly, payload?.monthly_data, payload?.trend, payload)).map((row) => ({
  month: firstDefined(row.month, row.label, row.period, row.date, ""),
  sales: number(firstDefined(row.sales, row.total_sales, row.total, row.amount)),
  purchases: number(firstDefined(row.purchases, row.total_purchases, row.purchase_total)),
}));

const normalizeTopSelling = (payload) => asArray(firstDefined(payload?.top_selling_medicines, payload?.top_selling, payload)).map((row) => ({
  name: firstDefined(row.medicine_name, row.name, row.medicine, "Medicine"),
  units: number(firstDefined(row.sold_quantity, row.quantity_sold, row.units_sold, row.quantity, row.units)),
})).filter((row) => row.units > 0);

const normalizePayments = (payload) => asArray(firstDefined(payload?.payment_modes, payload?.payment_mode_distribution, payload)).map((row) => ({
  name: firstDefined(row.payment_mode, row.mode, row.name, "Other"),
  value: number(firstDefined(row.amount, row.total, row.value, row.count)),
})).filter((row) => row.value > 0);

const normalizeExpiry = (payload) => {
  const source = firstDefined(payload?.expiry_analytics, payload?.expiry, payload, {});
  const rows = asArray(source);
  if (rows.length) return rows.map((row) => ({ name: firstDefined(row.label, row.name, row.status), value: number(firstDefined(row.value, row.count, row.quantity)) })).filter((row) => row.name);
  return [
    { name: "Expired", value: number(firstDefined(source.expired, source.expired_count, source.expired_medicines_count)) },
    { name: "≤ 30 days", value: number(firstDefined(source.expiring_30_days, source.expiring_within_30_days, source.within_30_days, source.expiring_soon_count, source.expiring_count)) },
    { name: "≤ 90 days", value: number(firstDefined(source.expiring_90_days, source.expiring_within_90_days, source.within_90_days)) },
    { name: "Safe", value: number(firstDefined(source.safe, source.safe_count)) },
  ];
};

const normalizeRecovery = (payload) => asArray(firstDefined(payload?.recovery_movement, payload?.recovery_trend, payload?.movement, payload)).map((row) => ({
  period: firstDefined(row.month, row.period, row.date, row.label, ""),
  customerOutstanding: number(firstDefined(row.customer_outstanding, row.customers, row.customer)),
  distributorOutstanding: number(firstDefined(row.distributor_outstanding, row.distributors, row.distributor)),
  recovered: number(firstDefined(row.recovered_amount, row.recovered, row.recovery)),
}));
const normalizeReturns = (payload) => asArray(firstDefined(payload?.purchase_returns, payload?.return_analytics, payload?.returns, payload));

async function optionalGet(url, params) {
  try {
    const { data } = await api.get(url, { params });
    return data;
  } catch {
    return null;
  }
}

export default function Reports() {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [topSellingPayload, setTopSellingPayload] = useState(null);
  const [expiryPayload, setExpiryPayload] = useState(null);
  const [paymentsPayload, setPaymentsPayload] = useState(null);
  const [purchaseSalesPayload, setPurchaseSalesPayload] = useState(null);
  const [recoveryPayload, setRecoveryPayload] = useState(null);
  const [analytics, setAnalytics] = useState({});

  const loadSales = useCallback(async () => {
    const params = { start, end };
    const [salesData, topData, paymentData, purchaseSalesData] = await Promise.all([
      optionalGet("/reports/sales", params),
      optionalGet("/reports/top-selling-medicines", params),
      optionalGet("/reports/payment-modes", params),
      optionalGet("/reports/purchase-vs-sales", params),
    ]);
    setSales(salesData);
    setTopSellingPayload(topData ?? salesData?.top_selling_medicines ?? null);
    setPaymentsPayload(paymentData ?? salesData?.payment_modes ?? null);
    setPurchaseSalesPayload(purchaseSalesData ?? salesData?.purchase_vs_sales ?? salesData?.monthly ?? null);
  }, [start, end]);

  useEffect(() => {
    loadSales();
    Promise.all([
      optionalGet("/reports/stock-valuation"),
      optionalGet("/reports/outstanding"),
      optionalGet("/reports/expiry-analytics"),
      optionalGet("/reports/recovery-movement"),
      optionalGet("/dashboard/summary"),
      optionalGet("/reports/analytics"),
      optionalGet("/reports/purchase-returns"),
    ]).then(([stockData, outstandingData, expiryData, recoveryData, dashboardData, analyticsData, returnsData]) => {
      setStock(stockData);
      setOutstanding(outstandingData);
      setExpiryPayload(expiryData ?? stockData?.expiry_analytics ?? dashboardData?.expiry_analytics ?? dashboardData ?? null);
      setRecoveryPayload(recoveryData ?? outstandingData?.recovery_movement ?? null);
      setAnalytics({ ...(analyticsData || {}), purchase_returns: returnsData ?? analyticsData?.purchase_returns });
    });
  }, [loadSales]);

  const monthlySales = useMemo(() => normalizeMonthly(sales), [sales]);
  const purchaseVsSales = useMemo(() => normalizeMonthly(purchaseSalesPayload), [purchaseSalesPayload]);
  const topSelling = useMemo(() => normalizeTopSelling(topSellingPayload), [topSellingPayload]);
  const payments = useMemo(() => normalizePayments(paymentsPayload), [paymentsPayload]);
  const expiry = useMemo(() => normalizeExpiry(expiryPayload), [expiryPayload]);
  const expiryValueRiskChartData = useMemo(() => buildExpiryValueRiskChartData(expiryPayload), [expiryPayload]);
  const hasExpiryValueRisk = hasExpiryValueRiskData(expiryValueRiskChartData);
  const recovery = useMemo(() => normalizeRecovery(recoveryPayload), [recoveryPayload]);
  const customerOutstanding = asArray(outstanding?.customers).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);
  const distributorOutstanding = asArray(outstanding?.distributors).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);
  const expiryCount = expiry.filter((row) => row.name !== "Safe").reduce((sum, row) => sum + row.value, 0);
  const expiryValue = number(firstDefined(expiryPayload?.expiry_value_at_risk, stock?.expiry_value_at_risk, 0));
  const aging = (side) => firstDefined(outstanding?.aging?.[side], outstanding?.aging_buckets?.[side], outstanding?.[`${side}_aging`], {});
  const agingBuckets = (side) => [["0–30 days", "0_30"], ["31–60 days", "31_60"], ["61–90 days", "61_90"], ["90+ days", "90_plus"]].map(([label, key]) => ({ label, value: number(firstDefined(aging(side)?.[key], aging(side)?.[key.replace("_", "-")], aging(side)?.[label], aging(side)?.[`${key}_days`])) }));
  const returns = firstDefined(analytics?.purchase_returns, {});
  const returnRows = normalizeReturns(returns);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="premium-kicker">Business intelligence</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Reports command center</h1><p className="text-sm text-slate-500">Analytics shown only from recorded pharmacy transactions.</p></div><BarChart3 className="h-10 w-10 text-emerald-700" /></div>
    <Tabs defaultValue="sales"><TabsList className="h-auto flex-wrap rounded-xl bg-white/70 p-1 shadow-sm"><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="stock">Stock & expiry</TabsTrigger><TabsTrigger value="outstanding">Outstanding</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList>
      <TabsContent value="sales" className="mt-5 space-y-5">
        <div className="premium-panel flex flex-wrap items-end gap-3 p-4"><div><Label>From</Label><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label>To</Label><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div><Button onClick={loadSales} className="bg-emerald-900">Refresh data</Button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Sales" value={fmtINR(sales?.total_sales)} /><Kpi label="GST" value={fmtINR(sales?.total_gst)} /><Kpi label="Invoices" value={number(sales?.invoice_count)} /><Kpi label="Est. profit" value={fmtINR(sales?.estimated_profit)} tone="text-emerald-700" /></div>
        <ChartCard title="Monthly sales trend" subtitle="Recorded invoice sales during the selected period." empty={!hasValues(monthlySales, ["sales"])} emptyText="No sales data yet"><ResponsiveContainer><AreaChart data={monthlySales}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f766e" stopOpacity=".35" /><stop offset="1" stopColor="#0f766e" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Area type="monotone" dataKey="sales" name="Sales" stroke="#0f766e" fill="url(#sales)" strokeWidth={3} /></AreaChart></ResponsiveContainer></ChartCard>
      </TabsContent>
      <TabsContent value="stock" className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Kpi label="Items" value={number(stock?.total_items)} /><Kpi label="Units" value={number(stock?.total_units)} /><Kpi label="Cost value" value={fmtINR(stock?.cost_value)} /><Kpi label="MRP value" value={fmtINR(stock?.mrp_value)} /><Kpi label="Expiry risk count" value={expiryCount} icon={AlertTriangle} /><Kpi label="Expiry value at risk" value={fmtINR(expiryValue)} tone="text-rose-700" icon={AlertTriangle} emphasis help="Prioritize this value when planning returns and clearance." /></div>
        <ChartCard title="Expiry value-at-risk analysis" subtitle="Cost value of expired and expiring available stock." empty={!hasExpiryValueRisk} emptyText="No expiry value-at-risk analytics yet"><ResponsiveContainer><BarChart data={expiryValueRiskChartData} margin={{ top: 24, right: 8, left: 4, bottom: 8 }}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} tickMargin={8} /><YAxis dataKey="value" width={76} tickFormatter={fmtINR} /><Tooltip formatter={moneyTip} /><Bar dataKey="value" name="Value at risk"><LabelList dataKey="value" formatter={fmtINR} position="top" offset={8} fill="#334155" fontSize={12} fontWeight={700} /><Cell fill="#dc2626" /><Cell fill="#ea580c" /><Cell fill="#d4a72c" /></Bar></BarChart></ResponsiveContainer></ChartCard>
      </TabsContent>
      <TabsContent value="outstanding" className="mt-5 space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">{[["Customer Receivables", customerOutstanding, "customers", "text-rose-700"], ["Distributor Payables", distributorOutstanding, "distributors", "text-amber-700"]].map(([title, total, side, tone]) => <section key={side} className="premium-panel p-5"><h3 className="font-heading text-lg font-bold">{title}</h3><div className={`mt-2 text-3xl font-extrabold ${tone}`}>{fmtINR(total)}</div><div className="mt-5 grid grid-cols-2 gap-3">{agingBuckets(side).map((bucket) => <div key={bucket.label} className="rounded-lg bg-slate-50 p-3"><div className="text-xs font-semibold text-slate-500">{bucket.label}</div><div className="mt-1 font-bold">{fmtINR(bucket.value)}</div></div>)}</div></section>)}</div>
        <ChartCard title="Outstanding movement" subtitle="Period-end receivables and payables from ledger analytics." empty={!hasValues(recovery, ["customerOutstanding", "distributorOutstanding"])} emptyText="No outstanding movement has been recorded yet."><ResponsiveContainer><LineChart data={recovery}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Line dataKey="customerOutstanding" name="Customer receivables" stroke="#dc2626" strokeWidth={2} /><Line dataKey="distributorOutstanding" name="Distributor payables" stroke="#d4a72c" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartCard>
      </TabsContent>
      <TabsContent value="analytics" className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Total return value" value={fmtINR(firstDefined(returns.total_return_value, returns.total_value))} /><Kpi label="Settled return value" value={fmtINR(firstDefined(returns.settled_return_value, returns.settled_value))} tone="text-emerald-700" /><Kpi label="Unsettled return value" value={fmtINR(firstDefined(returns.unsettled_return_value, returns.unsettled_value))} tone="text-rose-700" /><Kpi label="Returned quantity" value={number(firstDefined(returns.returned_quantity, returns.quantity))} /></div>
        <div className="grid gap-5 lg:grid-cols-2"><InsightSection title="Medicine-wise profit intelligence" description="Compare sales, cost, and estimated profit by medicine." empty={!asArray(analytics?.medicine_profit).length} /><InsightSection title="Dead stock analysis" description="Identify inventory with no recent sales movement." empty={!asArray(analytics?.dead_stock).length} /><InsightSection title="Fast-moving medicines" description="Medicines with the strongest recorded unit movement." empty={!topSelling.length}>{topSelling.length > 0 && <div className="space-y-2">{topSelling.slice(0, 5).map(row => <div key={row.name} className="flex justify-between rounded-lg bg-slate-50 p-3"><span>{row.name}</span><strong>{row.units} units</strong></div>)}</div>}</InsightSection><InsightSection title="Slow-moving medicines" description="Inventory with low recorded sales velocity." empty={!asArray(analytics?.slow_moving).length} /><InsightSection title="Purchase return analytics" description="Return value, settlement status, and returned quantity without speculative scoring." empty={!returnRows.length}>{returnRows.length > 0 && <div className="space-y-2">{returnRows.slice(0, 8).map((row, index) => <div key={row.id || index} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-slate-50 p-3 text-sm"><strong>{firstDefined(row.medicine_name, row.name, row.return_number, row.reference, "Return")}</strong><span>{fmtINR(firstDefined(row.return_value, row.total_value, row.value, row.amount))}</span><span className="text-slate-500">{number(firstDefined(row.returned_quantity, row.return_quantity, row.quantity))} units</span><span className="text-slate-500">{firstDefined(row.status, row.settlement_status, "Recorded")}</span></div>)}</div>}</InsightSection><InsightSection title="Monthly & seasonal trends" description="Use recorded monthly activity to support purchasing decisions." empty={!hasValues(purchaseVsSales, ["purchases", "sales"])} /></div>
      </TabsContent>
    </Tabs>
  </div>;
}
