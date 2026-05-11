import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtINR } from "@/lib/api";
import { Link } from "react-router-dom";
import { IndianRupee, Package, AlertTriangle, Clock, TrendingUp, Receipt } from "lucide-react";

function Kpi({ icon: Icon, label, value, sub, tone = "blue", testid }) {
  const tones = {
    blue: "text-blue-600 bg-blue-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
    emerald: "text-emerald-600 bg-emerald-50",
  };
  return (
    <div className="kpi-card rounded-sm" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.05em] font-semibold text-slate-500">{label}</div>
          <div className="font-heading text-3xl font-bold text-slate-900 mt-2 font-mono-nums">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        <div className={`w-9 h-9 rounded-sm flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-slate-500">Loading dashboard…</div>;

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Control Room</div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">
          Today at a glance
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={IndianRupee} label="Today's Sales" value={fmtINR(data.today_sales)}
          sub={`${data.today_invoice_count} invoices`} tone="emerald" testid="kpi-today-sales" />
        <Kpi icon={Package} label="Stock Items" value={data.total_medicines} tone="blue" testid="kpi-stock-items" />
        <Kpi icon={AlertTriangle} label="Low Stock" value={data.low_stock_count} tone="amber" testid="kpi-low-stock" />
        <Kpi icon={Clock} label="Near Expiry" value={data.near_expiry_count}
          sub={data.expired_count > 0 ? `${data.expired_count} expired` : "≤60 days"} tone="red" testid="kpi-near-expiry" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-heading font-semibold text-slate-900">Low stock alerts</div>
            <Link to="/inventory" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {data.low_stock.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">All stocks healthy.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Medicine</th><th className="text-right">Qty</th><th className="text-right">Threshold</th></tr></thead>
              <tbody>
                {data.low_stock.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name} <span className="text-xs text-slate-400">/ {m.batch_no}</span></td>
                    <td className="num-cell text-red-600 font-semibold">{m.quantity}</td>
                    <td className="num-cell text-slate-500">{m.low_stock_threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-heading font-semibold text-slate-900">Expiring soon</div>
            <Link to="/reports" className="text-xs text-blue-600 hover:underline">Report →</Link>
          </div>
          {data.near_expiry.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">Nothing near expiry.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Medicine</th><th>Expiry</th><th className="text-right">Days</th></tr></thead>
              <tbody>
                {data.near_expiry.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="font-mono-nums text-xs">{m.expiry_date}</td>
                    <td className={`num-cell font-semibold ${m.days_to_expiry < 0 ? "text-red-600" : m.days_to_expiry < 30 ? "text-amber-600" : "text-slate-700"}`}>
                      {m.days_to_expiry}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-sm flex items-center justify-center">
            <TrendingUp className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Outstanding</div>
            <div className="font-heading text-2xl font-bold text-slate-900 font-mono-nums">
              {fmtINR(data.pending_payments)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Pending customer credit balance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
