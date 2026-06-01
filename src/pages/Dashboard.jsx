import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, tone, sub, onClick }) {
  return (
    <Card
      onClick={onClick}
      className={`w-full min-h-[120px] overflow-hidden rounded-sm border-slate-200 hover:shadow-sm transition ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <CardContent className="p-4 space-y-1">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">
          {label}
        </div>

        <div className={`text-lg md:text-2xl break-words font-bold ${tone || "text-slate-900"}`}>
          {value}
        </div>

        {sub && (
          <div className="text-xs text-slate-400 font-mono-nums">
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const getOutstandingTotal = (outstanding, listKey) => {
  return (outstanding?.[listKey] || []).reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const summaryRes = await api.get("/dashboard/summary");
      setData(summaryRes.data || {});

      try {
        const outstandingRes = await api.get("/reports/outstanding");
        setOutstanding(outstandingRes.data);
      } catch (e) {
        console.warn("Failed to load outstanding totals", e);
        toast.warning("Outstanding totals unavailable");
        setOutstanding(null);
      }
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="p-6 text-slate-500">Loading system data...</div>;
  if (!data) return null;

  const customerOutstanding = getOutstandingTotal(outstanding, "customers");
  const distributorOutstanding = getOutstandingTotal(outstanding, "distributors");

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* HEADER */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Pharmacy Control Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Live operational snapshot — sales, stock, risk, and liquidity
        </p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">

        {data.low_stock_items?.length > 0 && (
  <div className="bg-white border rounded-sm p-4">
    <h2 className="font-semibold mb-3 text-orange-600">
      Low Stock Medicines
    </h2>

    <div className="space-y-2 max-h-[250px] overflow-auto">
      {data.low_stock_items.map((item) => (
        <div
          key={item.id}
          className="flex justify-between border-b py-2 text-sm"
        >
          <span>{item.name}</span>
          <span className="text-red-600 font-bold">
            {item.qty}
          </span>
        </div>
      ))}
    </div>
  </div>
)}

        <div className="bg-white border rounded-sm p-4">
  <h2 className="font-semibold mb-3 text-yellow-600">
    Expiring Soon Medicines
  </h2>

  <div className="space-y-2 max-h-[250px] overflow-auto">

    {data.expiring_soon?.length ? (
      data.expiring_soon.map((item, i) => (
        <div
          key={i}
          className="flex justify-between border-b py-2 text-sm"
        >
          <span>
            {item.name}
            <span className="text-xs text-slate-500 ml-2">
              ({item.batch_no})
            </span>
          </span>

          <span className="text-orange-600 font-bold">
            {item.days_left} days
          </span>
        </div>
      ))
    ) : (
      <div className="text-sm text-slate-400 py-2">
        No expiring medicines 🎉
      </div>
    )}

  </div>
</div>
        
        <StatCard
          label="Total Sales"
          value={fmtINR(data.sales || 0)}
          tone="text-emerald-600"
          sub="Gross revenue"
        />

        <StatCard
          label="Expenses"
          value={fmtINR(data.expenses || 0)}
          tone="text-red-600"
          sub="Operational cost"
        />

        <StatCard
          label="Profit"
          value={fmtINR(data.profit || 0)}
          tone="text-blue-600"
          sub="Net earnings"
        />

        <StatCard
          label="Stock Value"
          value={fmtINR(data.stock_value || 0)}
          tone="text-purple-600"
          sub="At purchase cost"
        />

        <StatCard
          label="Total Purchase Amount"
          value={fmtINR(data.total_purchase_amount || 0)}
          tone="text-indigo-600"
          sub="All PO grand totals"
        />

        <StatCard
          label="Total Customer Outstanding"
          value={fmtINR(customerOutstanding)}
          tone={customerOutstanding ? "text-red-600" : "text-slate-700"}
          sub="Customer balances"
          onClick={() => navigate("/customers")}
        />

        <StatCard
          label="Total Distributor Outstanding"
          value={fmtINR(distributorOutstanding)}
          tone={distributorOutstanding ? "text-amber-600" : "text-slate-700"}
          sub="Distributor balances"
          onClick={() => navigate("/distributors")}
        />

        <StatCard
          label="Low Stock Items"
          value={data.low_stock_count || 0}
          tone={data.low_stock_count ? "text-orange-600" : "text-slate-700"}
          sub="Needs replenishment"
        />

        <StatCard
          label="Expiring Soon"
          value={data.expiring_soon_count || 0}
          tone={data.expiring_soon_count ? "text-yellow-600" : "text-slate-700"}
          sub="≤ 60 days"
        />
      </div>

      {/* ALERT STRIP */}
      <div className="grid md:grid-cols-2 gap-4">

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-orange-700">
              Stock Warning
            </div>
            <div className="text-sm mt-1 text-orange-900">
              Monitor low stock items to avoid disruption in dispensing.
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-yellow-700">
              Expiry Alert
            </div>
            <div className="text-sm mt-1 text-yellow-900">
              Review near-expiry medicines and prioritize clearance.
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
