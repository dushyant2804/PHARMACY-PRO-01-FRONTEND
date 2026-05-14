import React, { useEffect, useState } from "react";
import api, { fmtINR, fmtDate } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

function Kpi({ label, value, tone }) {
  return (
    <div className="kpi-card rounded-sm">
      <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">{label}</div>
      <div className={`font-heading text-2xl font-bold font-mono-nums mt-2 ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);
  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [expiry, setExpiry] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [dailyClose, setDailyClose] = useState({
    date: today,
    total_sales: "",
    cash: "",
    upi: "",
    pending: "",
    notes: ""
  });

  const [savingClose, setSavingClose] = useState(false);

  const loadMonthly = async () => {
    setMonthlyLoading(true);
    try {
      const res = await api.get("/reports/monthly-summary", {
        params: { month },
      });
      setMonthlyData(res.data);
    } catch (err) {
      console.error("Monthly load failed", err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    loadMonthly();
    // eslint-disable-next-line
  }, [month]);

  const loadSales = () => api.get("/reports/sales", { params: { start, end } }).then((r) => setSales(r.data));
  useEffect(() => { loadSales(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    api.get("/reports/stock-valuation").then((r) => setStock(r.data));
    api.get("/reports/outstanding").then((r) => setOutstanding(r.data));
    api.get("/reports/expiry").then((r) => setExpiry(r.data));
    api.get("/medicines").then((r) => setMedicines(r.data));
  }, []);

  const autoFillDailyClose = () => {
  if (!sales) return;

  const total = sales.total_sales || 0;
  const paid = sales.paid_sales || total;
  const pending = sales.pending_sales || 0;

  const cash = sales?.cash_total || 0;
  const upi = sales?.upi_total || 0;

  setDailyClose((prev) => ({
    ...prev,
    total_sales: total,
    cash,
    upi,
    pending,
  }));
};

  useEffect(() => {
  autoFillDailyClose();
}, [sales]);

  const saveDailySummary = async () => {
  setSavingClose(true);
  try {
    await api.post("/daily-summary", {
      date: dailyClose.date,
      total_sales: Number(dailyClose.total_sales),
      cash: Number(dailyClose.cash),
      upi: Number(dailyClose.upi),
      pending: Number(dailyClose.pending),
      notes: dailyClose.notes,
    });

    console.log("Daily summary saved");

    setDailyClose({
      date: today,
      total_sales: "",
      cash: "",
      upi: "",
      pending: "",
      notes: ""
    });
  } catch (e) {
    console.log("Failed to save daily summary");
  } finally {
    setSavingClose(false);
  }
};
  
  const categoryData = React.useMemo(() => {
    const map = {};
    medicines.forEach((m) => {
      const v = m.mrp * m.quantity;
      map[m.category] = (map[m.category] || 0) + v;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [medicines]);

  const PIE_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be123c", "#65a30d", "#475569", "#db2777"];

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Analytics</div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">Reports</h1>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="rounded-sm bg-slate-100">
          <TabsTrigger value="sales" className="rounded-sm">Sales</TabsTrigger>
          <TabsTrigger value="stock" className="rounded-sm">Stock Valuation</TabsTrigger>
          <TabsTrigger value="outstanding" className="rounded-sm">Outstanding</TabsTrigger>
          <TabsTrigger value="expiry" className="rounded-sm">Expiry</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-sm">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 mt-4">
          <div className="bg-white border border-slate-200 rounded-sm p-4 flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">From</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">To</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-sm mt-1" />
            </div>
            <Button onClick={loadSales} className="rounded-sm bg-blue-600 hover:bg-blue-700">Run Report</Button>
          </div>
          {sales && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

  <Kpi
    label="Total Sales"
    value={fmtINR(sales?.total_sales || 0)}
    tone="text-emerald-600"
  />

  <Kpi
    label="GST Collected"
    value={fmtINR(sales?.total_gst || 0)}
  />

  <Kpi
    label="Invoices"
    value={sales?.invoice_count || 0}
  />

  <Kpi
    label="Est. Profit"
    value={fmtINR(sales?.estimated_profit || 0)}
    tone="text-blue-600"
  />

</div>
              {sales.daily.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-sm p-4">
                  <div className="font-heading font-semibold mb-3 text-slate-900">Daily sales trend</div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sales.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ borderRadius: 2, border: "1px solid #e2e8f0", fontSize: 12 }}
                          formatter={(v) => fmtINR(v)}
                        />
                        <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Date</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {sales.daily.length === 0 && <tr><td colSpan={2} className="text-center py-6 text-slate-500">No sales in range.</td></tr>}
                    {sales.daily.map((d) => (
                      <tr key={d.date}><td className="font-mono-nums text-xs">{d.date}</td><td className="num-cell font-semibold">{fmtINR(d.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="bg-white border rounded-sm p-4 mt-4">
  <div className="font-semibold mb-3">Daily Closing Entry</div>

  <input placeholder="Total Sales" />
  <input placeholder="Cash" />
  <input placeholder="UPI" />
  <input placeholder="Pending" />

  <button
  onClick={saveDailySummary}
  disabled={savingClose}
  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-sm"
>
  {savingClose ? "Saving..." : "Save Closing"}
</button>
 </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4 mt-4">
  {stock && (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

      <Kpi
        label="Total Items"
        value={stock?.total_items || 0}
      />

      <Kpi
        label="Total Units"
        value={stock?.total_units || 0}
      />

      <Kpi
        label="Cost Value"
        value={fmtINR(stock?.cost_value || 0)}
      />

      <Kpi
        label="MRP Value"
        value={fmtINR(stock?.mrp_value || 0)}
        tone="text-emerald-600"
      />

    </div>
  )}
        </TabsContent>
          {categoryData.length > 0 && (
  <div className="grid md:grid-cols-2 gap-4">

    <div className="bg-white border border-slate-200 rounded-sm p-4">
      <div className="font-heading font-semibold mb-3 text-slate-900">
        Stock value by category
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={categoryData}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
          >
            {categoryData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>

    <div className="bg-white border border-slate-200 rounded-sm p-4">
      <div className="font-heading font-semibold mb-3 text-slate-900">
        Category breakdown
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={categoryData} layout="vertical">
          <XAxis type="number" />
          <YAxis dataKey="name" type="category" width={130} />
          <Tooltip />
          <Bar dataKey="value" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>

  </div>
)}

      </Tabs>
    </div>
  );
}
