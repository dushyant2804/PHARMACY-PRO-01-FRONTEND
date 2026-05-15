import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Total Sales</div>
            <div className="text-xl font-bold text-green-600">
              {fmtINR(data.sales)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Expenses</div>
            <div className="text-xl font-bold text-red-600">
              {fmtINR(data.expenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Profit</div>
            <div className="text-xl font-bold text-blue-600">
              {fmtINR(data.profit)}
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
