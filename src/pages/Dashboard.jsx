import React, { useEffect, useState } from "react";
import api, { fmtINR } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

  if (loading) return <div className="p-6">Loading...</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">

        <Card><CardContent className="p-4">
          <div>Total Sales</div>
          <div className="font-bold text-green-600">
            {fmtINR(data.sales || 0)}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div>Expenses</div>
          <div className="font-bold text-red-600">
            {fmtINR(data.expenses || 0)}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div>Profit</div>
          <div className="font-bold text-blue-600">
            {fmtINR(data.profit || 0)}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div>Stock Value</div>
          <div className="font-bold text-purple-600">
            {fmtINR(data.stock_value || 0)}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div>Low Stock</div>
          <div className="font-bold text-orange-600">
            {data.low_stock_count || 0}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <div>Expiring</div>
          <div className="font-bold text-yellow-600">
            {data.expiring_soon_count || 0}
          </div>
        </CardContent></Card>

      </div>

    </div>
  );
}
