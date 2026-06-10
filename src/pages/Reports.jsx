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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, Inbox, WalletCards } from "lucide-react";
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
const moneyTip = (value) => fmtINR(value);

function Kpi({ label, value, tone = "text-slate-950", icon: Icon }) {
  return <div className="premium-panel p-4"><div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span>{Icon && <Icon className="h-4 w-4" />}</div><div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div></div>;
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
    ]).then(([stockData, outstandingData, expiryData, recoveryData, dashboardData]) => {
      setStock(stockData);
      setOutstanding(outstandingData);
      setExpiryPayload(expiryData ?? stockData?.expiry_analytics ?? dashboardData?.expiry_analytics ?? dashboardData ?? null);
      setRecoveryPayload(recoveryData ?? outstandingData?.recovery_movement ?? null);
    });
  }, [loadSales]);

  const monthlySales = useMemo(() => normalizeMonthly(sales), [sales]);
  const purchaseVsSales = useMemo(() => normalizeMonthly(purchaseSalesPayload), [purchaseSalesPayload]);
  const topSelling = useMemo(() => normalizeTopSelling(topSellingPayload), [topSellingPayload]);
  const payments = useMemo(() => normalizePayments(paymentsPayload), [paymentsPayload]);
  const expiry = useMemo(() => normalizeExpiry(expiryPayload), [expiryPayload]);
  const recovery = useMemo(() => normalizeRecovery(recoveryPayload), [recoveryPayload]);
  const customerOutstanding = asArray(outstanding?.customers).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);
  const distributorOutstanding = asArray(outstanding?.distributors).reduce((sum, row) => sum + number(firstDefined(row.outstanding, row.balance)), 0);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="premium-kicker">Business intelligence</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Reports command center</h1><p className="text-sm text-slate-500">Analytics shown only from recorded pharmacy transactions.</p></div><BarChart3 className="h-10 w-10 text-emerald-700" /></div>
    <Tabs defaultValue="sales"><TabsList className="h-auto flex-wrap rounded-xl bg-white/70 p-1 shadow-sm"><TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="stock">Stock & expiry</TabsTrigger><TabsTrigger value="outstanding">Outstanding</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList>
      <TabsContent value="sales" className="mt-5 space-y-5">
        <div className="premium-panel flex flex-wrap items-end gap-3 p-4"><div><Label>From</Label><Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div><div><Label>To</Label><Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div><Button onClick={loadSales} className="bg-emerald-900">Refresh data</Button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Sales" value={fmtINR(sales?.total_sales)} /><Kpi label="GST" value={fmtINR(sales?.total_gst)} /><Kpi label="Invoices" value={number(sales?.invoice_count)} /><Kpi label="Est. profit" value={fmtINR(sales?.estimated_profit)} tone="text-emerald-700" /></div>
        <ChartCard title="Monthly sales trend" subtitle="Recorded invoice sales during the selected period." empty={!hasValues(monthlySales, ["sales"])} emptyText="No sales data yet"><ResponsiveContainer><AreaChart data={monthlySales}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f766e" stopOpacity=".35" /><stop offset="1" stopColor="#0f766e" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Area type="monotone" dataKey="sales" name="Sales" stroke="#0f766e" fill="url(#sales)" strokeWidth={3} /></AreaChart></ResponsiveContainer></ChartCard>
      </TabsContent>
      <TabsContent value="stock" className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Items" value={number(stock?.total_items)} /><Kpi label="Units" value={number(stock?.total_units)} /><Kpi label="Cost value" value={fmtINR(stock?.cost_value)} /><Kpi label="MRP value" value={fmtINR(stock?.mrp_value)} /></div>
        <div className="grid gap-5 xl:grid-cols-2"><ChartCard title="Top selling medicines" subtitle="Sold invoice quantities reported by backend analytics." empty={!topSelling.length} emptyText="No top-selling medicines yet"><ResponsiveContainer><BarChart data={topSelling} layout="vertical"><CartesianGrid stroke="#e2e8f0" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="units" name="Units sold" fill="#0f766e" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Expiry risk analysis" subtitle="Backend expiry analytics: expired, 30-day, 90-day, and safe stock." empty={!hasValues(expiry, ["value"])} emptyText="No expiry analytics yet"><ResponsiveContainer><BarChart data={expiry}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Bar dataKey="value" name="Stock"><Cell fill="#dc2626" /><Cell fill="#ea580c" /><Cell fill="#d4a72c" /><Cell fill="#0f766e" /></Bar></BarChart></ResponsiveContainer></ChartCard></div>
      </TabsContent>
      <TabsContent value="outstanding" className="mt-5 space-y-5"><div className="grid gap-4 md:grid-cols-2"><Kpi label="Customer outstanding" value={fmtINR(customerOutstanding)} tone="text-rose-700" icon={AlertTriangle} /><Kpi label="Distributor outstanding" value={fmtINR(distributorOutstanding)} icon={WalletCards} /></div><ChartCard title="Outstanding and recovery movement" subtitle="Period-end customer outstanding, distributor outstanding, and recovered amount from ledger analytics." empty={!hasValues(recovery, ["customerOutstanding", "distributorOutstanding", "recovered"])} emptyText="No ledger or recovery data yet"><ResponsiveContainer><LineChart data={recovery}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="period" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Line dataKey="customerOutstanding" name="Customer outstanding" stroke="#dc2626" strokeWidth={2} /><Line dataKey="distributorOutstanding" name="Distributor outstanding" stroke="#d4a72c" strokeWidth={2} /><Line dataKey="recovered" name="Recovered amount" stroke="#0f766e" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard></TabsContent>
      <TabsContent value="analytics" className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Payment mode distribution" subtitle="Actual payment modes recorded against invoices." empty={!payments.length} emptyText="No payment data yet"><ResponsiveContainer><PieChart><Pie data={payments} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={4}>{payments.map((row, index) => <Cell key={`${row.name}-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={moneyTip} /><Legend /></PieChart></ResponsiveContainer></ChartCard><ChartCard title="Purchases vs sales" subtitle="Recorded monthly purchase totals compared with invoice sales." empty={!hasValues(purchaseVsSales, ["purchases", "sales"])} emptyText="No purchase or sales data yet"><ResponsiveContainer><BarChart data={purchaseVsSales}><CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" /><YAxis width={70} /><Tooltip formatter={moneyTip} /><Legend /><Bar dataKey="purchases" name="Purchases" fill="#d4a72c" radius={[6, 6, 0, 0]} /><Bar dataKey="sales" name="Sales" fill="#0f766e" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard></TabsContent>
    </Tabs>
  </div>;
}
