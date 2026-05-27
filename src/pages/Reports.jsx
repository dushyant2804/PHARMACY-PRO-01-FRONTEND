import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* KPI CARD */
function Kpi({ label, value, tone }) {
  return (
    <div className="rounded-sm border bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-2 ${tone || "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);

  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [medicines, setMedicines] = useState([]);

  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const loadSales = () =>
    api
      .get("/reports/sales", { params: { start, end } })
      .then((r) => setSales(r.data));

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    api.get("/reports/stock-valuation").then((r) => setStock(r.data));
    api.get("/reports/outstanding").then((r) => setOutstanding(r.data));
    api.get("/medicines").then((r) => setMedicines(r.data || []));
  }, []);

  /* SAFE CATEGORY DATA */
  const categoryData = React.useMemo(() => {
    const map = {};

    medicines.forEach((m) => {
      const qty = Number(m.quantity || 0);
      const price = Number(m.mrp || 0);

      const value = qty * price;

      const key = m.category || "Unknown";
      map[key] = (map[key] || 0) + value;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value: Math.round(value),
    }));
  }, [medicines]);

  const COLORS = [
    "#2563eb",
    "#059669",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
  ];

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-sm text-slate-500">
          Analytics & business insights
        </p>
      </div>

      <Tabs defaultValue="sales">

        {/* TABS */}
        <TabsList className="bg-slate-100">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* SALES */}
        <TabsContent value="sales" className="space-y-4 mt-4">

          <div className="flex gap-3 items-end bg-white p-4 border rounded-sm">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>

            <Button onClick={loadSales}>Run</Button>
          </div>

          {sales && (
            <div className="space-y-6">

              {/* KPI GRID */}
              <div className="grid md:grid-cols-4 gap-3">
                <Kpi label="Sales" value={fmtINR(sales.total_sales || 0)} />
                <Kpi label="GST" value={fmtINR(sales.total_gst || 0)} />
                <Kpi label="Invoices" value={sales.invoice_count || 0} />
                <Kpi label="Profit" value={fmtINR(sales.estimated_profit || 0)} />
              </div>

              {/* CHART FIX (IMPORTANT) */}
              <div className="bg-white border rounded-sm p-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sales.daily || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmtINR(v)} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}
        </TabsContent>

        {/* STOCK */}
        <TabsContent value="stock" className="mt-4 space-y-4">

          {stock && (
            <div className="grid md:grid-cols-4 gap-3">
              <Kpi label="Items" value={stock.total_items || 0} />
              <Kpi label="Units" value={stock.total_units || 0} />
              <Kpi label="Cost" value={fmtINR(stock.cost_value || 0)} />
              <Kpi label="MRP" value={fmtINR(stock.mrp_value || 0)} tone="text-green-600" />
            </div>
          )}

        </TabsContent>

        {/* OUTSTANDING */}
        <TabsContent value="outstanding" className="mt-4">

          <div className="grid md:grid-cols-2 gap-4">

            <div className="bg-white border rounded-sm p-4">
              <h2 className="font-semibold mb-3">Customers</h2>

              {(outstanding?.customers || []).map((c) => (
                <div key={c.id} className="flex justify-between border-b py-2">
                  <span>{c.name}</span>
                  <span className="text-red-600 font-bold">
                    {fmtINR(c.balance)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white border rounded-sm p-4">
              <h2 className="font-semibold mb-3">Distributors</h2>

              {(outstanding?.distributors || []).map((d) => (
                <div key={d.id} className="flex justify-between border-b py-2">
                  <span>{d.name}</span>
                  <span className="text-amber-600 font-bold">
                    {fmtINR(d.balance)}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </TabsContent>

        {/* ANALYTICS (VERTICAL CHART FIX AREA) */}
        <TabsContent value="analytics" className="space-y-6 mt-4">

          <div className="bg-white border rounded-sm p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name">
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border rounded-sm p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </TabsContent>

      </Tabs>
    </div>
  );
}
