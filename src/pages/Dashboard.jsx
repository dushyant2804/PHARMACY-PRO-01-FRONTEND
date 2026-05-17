import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/summary");
      setData(res.data);
    } catch (e) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Overview of your pharmacy performance
        </p>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">

<Card
  className="cursor-pointer hover:shadow-md transition"
  onClick={() => navigate("/reports")}
>
  <CardContent className="p-4">
    <div className="text-sm text-slate-500">
      Total Sales
    </div>

    <div className="text-xl font-bold text-green-600">
      {fmtINR(data.sales)}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      This Month: {fmtINR(data.sales_month || 0)}
    </div>

    <div className="text-xs text-slate-500">
      Today: {fmtINR(data.sales_today || 0)}
    </div>
  </CardContent>
</Card>

<Card
  className="cursor-pointer hover:shadow-md transition"
  onClick={() => navigate("/reports")}
>
  <CardContent className="p-4">

    <div className="text-sm text-slate-500">
      Expenses
    </div>

    <div className="text-xl font-bold text-red-600">
      {fmtINR(data.expenses)}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      This Month: {fmtINR(data.expenses_month || 0)}
    </div>

    <div className="text-xs text-slate-500">
      Today: {fmtINR(data.expenses_today || 0)}
    </div>

  </CardContent>
</Card>

<Card
  className="cursor-pointer hover:shadow-md transition"
  onClick={() => navigate("/reports")}
>
  <CardContent className="p-4">

    <div className="text-sm text-slate-500">
      Profit
    </div>

    <div className="text-xl font-bold text-blue-600">
      {fmtINR(data.profit)}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      This Month: {fmtINR(data.profit_month || 0)}
    </div>

    <div className="text-xs text-slate-500">
      Today: {fmtINR(data.profit_today || 0)}
    </div>

  </CardContent>
</Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Stock Value</div>
            <div className="text-xl font-bold text-purple-600">
              {fmtINR(data.stock_value)}
            </div>
          </CardContent>
        </Card>

<Card
  className="cursor-pointer hover:shadow-md transition"
  onClick={() => navigate("/reports")}
>
  <CardContent className="p-4">

    <div className="text-sm text-slate-500">
      Customer Outstanding
    </div>

    <div className="text-xl font-bold text-orange-600">
      {fmtINR(data.customer_outstanding || 0)}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      This Month: {fmtINR(data.customer_outstanding_month || 0)}
    </div>

    <div className="text-xs text-slate-500">
      Today: {fmtINR(data.customer_outstanding_today || 0)}
    </div>

  </CardContent>
</Card>
        
        <Card
  className="cursor-pointer hover:shadow-md transition"
  onClick={() => navigate("/reports")}
>
  <CardContent className="p-4">

    <div className="text-sm text-slate-500">
      Amount Received
    </div>

    <div className="text-xl font-bold text-emerald-600">
      {fmtINR(data.amount_received || 0)}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      This Month: {fmtINR(data.amount_received_month || 0)}
    </div>

    <div className="text-xs text-slate-500">
      Today: {fmtINR(data.amount_received_today || 0)}
    </div>

  </CardContent>
</Card>

<Card>
  <CardContent className="p-4">
    <div className="text-sm text-slate-500">
      Distributor Payable
    </div>

    <div className="text-xl font-bold text-rose-600">
      {fmtINR(data.distributor_outstanding || 0)}
    </div>
  </CardContent>
</Card>

      </div>

      {/* SECOND ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* LOW STOCK */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">
              ⚠ Low Stock ({data.low_stock_count})
            </h2>

            <div className="space-y-2 max-h-64 overflow-auto">
              {data.low_stock_items?.length === 0 && (
                <div className="text-sm text-slate-500">
                  Everything looks good
                </div>
              )}

              {data.low_stock_items?.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between text-sm border-b py-1"
                >
                  <span>{item.name}</span>
                  <span className="text-red-600 font-bold">
                    {item.qty}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* EXPIRY ALERT */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">
              ⏳ Expiring Soon ({data.expiring_soon_count})
            </h2>

            <div className="space-y-2 max-h-64 overflow-auto">

              {data.expiring_soon?.length === 0 && (
                <div className="text-sm text-slate-500">
                  No urgent expiries
                </div>
              )}

              {data.expiring_soon?.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm border-b py-1"
                >
                  <span>{item.name}</span>
                  <span className="text-amber-600 font-semibold">
                    {item.days_left} days
                  </span>
                </div>
              ))}

            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
