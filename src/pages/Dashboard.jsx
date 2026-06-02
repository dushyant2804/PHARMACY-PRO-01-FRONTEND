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

function ExpiryTable({ title, tone, columns, items, emptyText, renderRow }) {
  return (
    <div className="w-full bg-white border rounded-sm p-4 shadow-sm">
      <h2 className={`font-semibold mb-3 ${tone}`}>
        {title}
      </h2>

      <div className="max-h-[320px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              {columns.map((column) => (
                <th key={column} className="text-left p-2 border-b">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map(renderRow)
            ) : (
              <tr>
                <td className="p-3 text-slate-400" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const getOutstandingTotal = (outstanding, listKey) => {
  return (outstanding?.[listKey] || []).reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0
  );
};

const firstDefined = (...values) => {
  return values.find((value) => value !== undefined && value !== null);
};

const getExpiryDate = (item) => {
  return firstDefined(item.expiry_date, item.expiry, item.expiryDate, "-");
};

const getBatchNo = (item) => {
  return firstDefined(item.batch_number, item.batch_no, item.batch, item.batchNo, "-");
};

const getMedicineName = (item) => {
  return firstDefined(item.name, item.medicine_name, item.medicine, "-");
};

const normalizeReturnStatus = (status) => {
  const value = String(status || "").toLowerCase().replace(/[ -]/g, "_");

  if (["returned", "fully_returned", "full_returned"].includes(value)) return "Returned";
  if (["partially_returned", "partial_returned", "partial"].includes(value)) return "Partially Returned";
  if (["sold_out", "soldout"].includes(value)) return "Sold Out";
  if (["not_returned", "none", "pending"].includes(value)) return "Not Returned";

  return "";
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getAvailableStock = (item) => {
  const purchasedMinusSold = firstDefined(item.purchased_units, item.purchased_quantity) !== undefined
    || firstDefined(item.sold_units, item.sold_quantity) !== undefined
    ? toNumber(firstDefined(item.purchased_units, item.purchased_quantity, 0))
      - toNumber(firstDefined(item.sold_units, item.sold_quantity, 0))
    : undefined;
  const totalMinusSold = firstDefined(item.total_units, item.total_quantity) !== undefined
    || firstDefined(item.sold_units, item.sold_quantity) !== undefined
    ? toNumber(firstDefined(item.total_units, item.total_quantity, 0))
      - toNumber(firstDefined(item.sold_units, item.sold_quantity, 0))
    : undefined;

  return toNumber(firstDefined(
    item.available_stock,
    item.stock,
    item.available_quantity,
    item.remaining_quantity,
    item.quantity,
    item.qty,
    item.quantity_units,
    purchasedMinusSold,
    totalMinusSold,
    0
  ));
};

const getOriginalBatchQuantity = (item) => toNumber(firstDefined(
  item.original_quantity,
  item.original_batch_quantity,
  item.batch_quantity,
  item.purchased_units,
  item.total_units,
  item.purchased_quantity,
  item.total_quantity,
  item.quantity_units,
  item.quantity,
  item.qty,
  item.stock,
  item.available_stock,
  0
));

const getItemReturnedQuantity = (item) => toNumber(firstDefined(
  item.returned_quantity,
  item.return_quantity,
  item.purchase_return_quantity,
  item.total_returned_quantity,
  item.returned_units,
  0
));

const normalizeMatchValue = (value) => String(value ?? "").trim().toLowerCase();

const sameIdentifier = (left, right, keys) => keys.some((key) => {
  const leftValue = normalizeMatchValue(left[key]);
  const rightValue = normalizeMatchValue(right[key]);
  return leftValue && rightValue && leftValue === rightValue;
});

const recordsMatchExpiryItem = (item, record) => {
  const itemNormalized = {
    medicine_id: firstDefined(item.medicine_id, item.id),
    medicine_key: firstDefined(item.medicine_key, item.key, item.sku),
    batch_number: firstDefined(item.batch_number, item.batch_no, item.batch, item.batchNo),
    expiry_date: firstDefined(item.expiry_date, item.expiry, item.expiryDate),
    distributor_id: item.distributor_id,
    medicine_name: getMedicineName(item),
    distributor_name: firstDefined(item.distributor_name, item.distributor),
  };
  const recordNormalized = {
    medicine_id: record.medicine_id,
    medicine_key: record.medicine_key,
    batch_number: firstDefined(record.batch_number, record.batch_no, record.batch, record.batchNo),
    expiry_date: firstDefined(record.expiry_date, record.expiry, record.expiryDate),
    distributor_id: record.distributor_id,
    medicine_name: firstDefined(record.medicine_name, record.name, record.medicine),
    distributor_name: firstDefined(record.distributor_name, record.distributor),
  };

  const hasMedicineIdentifier = ["medicine_id", "medicine_key"].some(
    (key) => itemNormalized[key] && recordNormalized[key]
  );

  const batchAndExpiryMatch = ["batch_number", "expiry_date"].every(
    (key) => !itemNormalized[key] || !recordNormalized[key] || normalizeMatchValue(itemNormalized[key]) === normalizeMatchValue(recordNormalized[key])
  );
  const distributorIdMatches = !itemNormalized.distributor_id
    || !recordNormalized.distributor_id
    || normalizeMatchValue(itemNormalized.distributor_id) === normalizeMatchValue(recordNormalized.distributor_id);

  if (hasMedicineIdentifier) {
    return sameIdentifier(itemNormalized, recordNormalized, ["medicine_id", "medicine_key"])
      && batchAndExpiryMatch
      && distributorIdMatches;
  }

  return normalizeMatchValue(itemNormalized.medicine_name) === normalizeMatchValue(recordNormalized.medicine_name)
    && batchAndExpiryMatch
    && distributorIdMatches
    && (!itemNormalized.distributor_name || !recordNormalized.distributor_name || normalizeMatchValue(itemNormalized.distributor_name) === normalizeMatchValue(recordNormalized.distributor_name));
};

const getReturnStatus = (item, purchaseReturns) => {
  const matchedReturns = purchaseReturns.filter((record) => recordsMatchExpiryItem(item, record));
  const returnedQuantity = matchedReturns.reduce(
    (sum, record) => sum + toNumber(firstDefined(record.return_quantity, record.quantity, record.qty, 0)),
    getItemReturnedQuantity(item)
  );
  const originalQuantity = getOriginalBatchQuantity(item);
  const availableStock = getAvailableStock(item);
  const backendStatus = normalizeReturnStatus(firstDefined(
    item.return_status,
    item.purchase_return_status,
    item.returned_status,
    item.status
  ));

  if (returnedQuantity > 0 && returnedQuantity >= originalQuantity) return "Returned";
  if (returnedQuantity > 0 && returnedQuantity < originalQuantity) return "Partially Returned";
  if (availableStock <= 0 && returnedQuantity <= 0) return "Sold Out";
  if (backendStatus && backendStatus !== "Sold Out") return backendStatus;
  return "Not Returned";
};

function ReturnStatusBadge({ status }) {
  const className = status === "Returned"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : status === "Partially Returned"
    ? "bg-amber-100 text-amber-700 border-amber-200"
    : status === "Sold Out"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

const getPatientAlerts = (data) => {
  const alerts = firstDefined(
    data.patient_alerts,
    data.patient_due_alerts,
    data.patient_refill_alerts,
    data.patients_due,
    data.due_patients,
    []
  );

  if (Array.isArray(alerts)) return alerts;
  return firstDefined(alerts.items, alerts.alerts, alerts.data, []);
};

const getPatientAlertStatus = (alert) => {
  const status = firstDefined(alert.status, alert.due_status, alert.refill_status);
  if (status) return status;

  const daysOverdue = firstDefined(alert.days_overdue, alert.overdue_days);
  if (Number(daysOverdue) > 0) return `Overdue by ${daysOverdue} day${Number(daysOverdue) === 1 ? "" : "s"}`;

  const daysRemaining = firstDefined(alert.days_remaining, alert.days_to_refill, alert.days_left);
  if (Number(daysRemaining) > 0) return `Due in ${daysRemaining} day${Number(daysRemaining) === 1 ? "" : "s"}`;

  return alert.is_due ? "Due now" : "Due";
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [outstanding, setOutstanding] = useState(null);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
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

      try {
        const returnsRes = await api.get("/purchase-returns");
        const returnItems = firstDefined(
          returnsRes.data?.items,
          returnsRes.data?.results,
          returnsRes.data?.data,
          returnsRes.data?.purchase_returns,
          returnsRes.data?.returns,
          returnsRes.data,
          []
        );
        setPurchaseReturns(Array.isArray(returnItems) ? returnItems : []);
      } catch (e) {
        console.warn("Failed to load purchase return status records", e);
        setPurchaseReturns([]);
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
  const expiringSoonItems = firstDefined(data.expiring_soon_items, data.expiring_soon, []);
  const expiredItems = firstDefined(data.expired_items, data.expired, []);
  const expiringSoonCount = firstDefined(data.expiring_soon_count, expiringSoonItems.length, 0);
  const expiredCount = firstDefined(data.expired_count, expiredItems.length, 0);
  const patientAlerts = getPatientAlerts(data);

  const totalSales = firstDefined(data.total_sales, data.sales, 0);
  const salesThisMonth = firstDefined(data.sales_this_month, data.monthly_sales, 0);
  const totalExpenses = firstDefined(data.total_expenses, data.expenses, 0);
  const expensesThisMonth = firstDefined(data.expenses_this_month, data.monthly_expenses, 0);
  const totalProfit = firstDefined(data.total_profit, data.profit, 0);
  const profitThisMonth = firstDefined(data.profit_this_month, data.monthly_profit, 0);

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
        <StatCard
          label="Total Sales"
          value={fmtINR(totalSales || 0)}
          tone="text-emerald-600"
          sub={`Sales This Month: ${fmtINR(salesThisMonth || 0)}`}
        />

        <StatCard
          label="Total Expenses"
          value={fmtINR(totalExpenses || 0)}
          tone="text-red-600"
          sub={`Expenses This Month: ${fmtINR(expensesThisMonth || 0)}`}
        />

        <StatCard
          label="Total Profit"
          value={fmtINR(totalProfit || 0)}
          tone="text-blue-600"
          sub={`Profit This Month: ${fmtINR(profitThisMonth || 0)}`}
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
          label="Expiring Soon Count"
          value={expiringSoonCount || 0}
          tone={expiringSoonCount ? "text-orange-600" : "text-slate-700"}
          sub="Near expiry"
        />

        <StatCard
          label="Expired Count"
          value={expiredCount || 0}
          tone={expiredCount ? "text-red-600" : "text-slate-700"}
          sub="Past expiry"
        />
      </div>

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


      {/* PATIENT REFILL ALERTS */}
      <div className="bg-white border rounded-sm p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-blue-700">
              Patient Medicine Due Alerts
            </h2>
            <p className="text-xs text-slate-500">
              Refill follow-ups from dashboard summary
            </p>
          </div>
          <div className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">
            {patientAlerts.length} due
          </div>
        </div>

        <div className="max-h-[260px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left p-2 border-b">Patient</th>
                <th className="text-left p-2 border-b">Phone</th>
                <th className="text-left p-2 border-b">Medicine</th>
                <th className="text-left p-2 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {patientAlerts.length ? (
                patientAlerts.map((alert, index) => {
                  const status = getPatientAlertStatus(alert);
                  const isOverdue = String(status).toLowerCase().includes("overdue");

                  return (
                    <tr key={alert.id || alert.phone || `${alert.name}-${index}`} className="border-b">
                      <td className="p-2 font-medium">{firstDefined(alert.name, alert.patient_name, "-")}</td>
                      <td className="p-2 text-slate-600 font-mono-nums">{firstDefined(alert.phone, alert.patient_phone, "-")}</td>
                      <td className="p-2 text-slate-600">{getMedicineName(alert)}</td>
                      <td className={`p-2 font-semibold ${isOverdue ? "text-red-600" : "text-orange-600"}`}>
                        {status}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="p-3 text-slate-400" colSpan={4}>
                    No patient refill alerts 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* EXPIRY SECTIONS */}
      <div className="space-y-6">
        <ExpiryTable
          title="Expiring Soon Medicines"
          tone="text-orange-600"
          columns={["Medicine", "Batch", "Expiry Date", "Days Remaining", "Return Status"]}
          items={expiringSoonItems}
          emptyText="No expiring soon medicines 🎉"
          renderRow={(item, i) => (
            <tr key={item.id || `${getMedicineName(item)}-${getBatchNo(item)}-${i}`} className="border-b">
              <td className="p-2 font-medium">{getMedicineName(item)}</td>
              <td className="p-2 text-slate-600">{getBatchNo(item)}</td>
              <td className="p-2 text-slate-600">{getExpiryDate(item)}</td>
              <td className="p-2 text-orange-600 font-bold">
                {firstDefined(item.days_to_expiry, item.days_left, item.days_remaining, 0)} days
              </td>
              <td className="p-2">
                <ReturnStatusBadge status={getReturnStatus(item, purchaseReturns)} />
              </td>
            </tr>
          )}
        />

        <ExpiryTable
          title="Expired Medicines"
          tone="text-red-600"
          columns={["Medicine", "Batch", "Expiry Date", "Status", "Return Status"]}
          items={expiredItems}
          emptyText="No expired medicines 🎉"
          renderRow={(item, i) => {
            const expiredDaysAgo = firstDefined(item.expired_days_ago, item.days_expired, 0);

            return (
              <tr key={item.id || `${getMedicineName(item)}-${getBatchNo(item)}-${i}`} className="border-b">
                <td className="p-2 font-medium">{getMedicineName(item)}</td>
                <td className="p-2 text-slate-600">{getBatchNo(item)}</td>
                <td className="p-2 text-slate-600">{getExpiryDate(item)}</td>
                <td className="p-2 text-red-600 font-bold">
                  Expired {expiredDaysAgo} days ago
                </td>
                <td className="p-2">
                  <ReturnStatusBadge status={getReturnStatus(item, purchaseReturns)} />
                </td>
              </tr>
            );
          }}
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

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-widest text-red-700">
              Expiry Alert
            </div>
            <div className="text-sm mt-1 text-red-900">
              Review near-expiry and expired medicines for timely action.
            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}
