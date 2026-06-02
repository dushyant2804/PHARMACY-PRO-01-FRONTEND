import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

const reasons = ["Expired", "Damaged", "Wrong Item", "Other"];
const ledgerFilterValues = [
  { value: "all", label: "All" },
  { value: "true", label: "Ledger Adjusted" },
  { value: "false", label: "Not Adjusted" },
];

const emptyForm = {
  return_date: new Date().toISOString().split("T")[0],
  distributor_id: "",
  distributor_name: "",
  medicine_name: "",
  batch_number: "",
  expiry_date: "",
  return_quantity: "",
  purchase_rate: "",
  reason: "Expired",
  notes: "",
  adjust_distributor_ledger: false,
};

const emptyFilters = {
  search: "",
  distributor_id: "all",
  reason: "all",
  ledger_adjusted: "all",
  date_from: "",
  date_to: "",
};

const emptyReport = {
  totalReturnedQuantity: 0,
  totalReturnValue: 0,
  ledgerAdjustedCount: 0,
  nonAdjustedCount: 0,
  distributorBreakdown: [],
  medicineBreakdown: [],
  reasonBreakdown: [],
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null);

const normalizeCollection = (responseData) => {
  if (Array.isArray(responseData)) {
    return {
      items: responseData,
      total: responseData.length,
      page: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    };
  }

  const items = firstDefined(
    responseData?.items,
    responseData?.results,
    responseData?.data,
    responseData?.purchase_returns,
    responseData?.returns,
    []
  );

  const total = firstDefined(
    responseData?.total_records,
    responseData?.total,
    responseData?.count,
    items.length
  );
  const page = firstDefined(responseData?.page, responseData?.current_page, 1);
  const pageSize = firstDefined(responseData?.page_size, responseData?.limit, items.length || 20);
  const totalPages = firstDefined(
    responseData?.total_pages,
    responseData?.pages,
    pageSize ? Math.max(1, Math.ceil(Number(total || 0) / Number(pageSize))) : 1
  );

  return {
    items: Array.isArray(items) ? items : [],
    total: Number(total || 0),
    page: Number(page || 1),
    totalPages: Number(totalPages || 1),
    hasNext: Boolean(firstDefined(responseData?.has_next, responseData?.next, page < totalPages)),
    hasPrevious: Boolean(firstDefined(responseData?.has_previous, responseData?.previous, page > 1)),
  };
};

const normalizeBreakdown = (items, nameKeys = ["name"]) => {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    id: firstDefined(item.id, item.distributor_id, item.medicine_id, item.reason, index),
    name: firstDefined(...nameKeys.map((key) => item[key]), item.name, item.label, "—"),
    quantity: Number(firstDefined(item.quantity, item.return_quantity, item.total_quantity, item.qty, 0) || 0),
    value: Number(firstDefined(item.value, item.return_amount, item.total_value, item.amount, 0) || 0),
    count: Number(firstDefined(item.count, item.total_count, item.records, 0) || 0),
  }));
};

const normalizeReport = (reportData) => {
  const data = reportData || {};

  return {
    totalReturnedQuantity: Number(
      firstDefined(data.total_returned_quantity, data.total_return_quantity, data.total_quantity, 0) || 0
    ),
    totalReturnValue: Number(
      firstDefined(data.total_return_value, data.total_return_amount, data.total_amount, 0) || 0
    ),
    ledgerAdjustedCount: Number(
      firstDefined(data.ledger_adjusted_count, data.adjusted_count, 0) || 0
    ),
    nonAdjustedCount: Number(
      firstDefined(data.non_adjusted_count, data.not_adjusted_count, data.unadjusted_count, 0) || 0
    ),
    distributorBreakdown: normalizeBreakdown(
      firstDefined(data.distributor_wise, data.distributor_breakdown, data.by_distributor, []),
      ["distributor_name", "distributor"]
    ),
    medicineBreakdown: normalizeBreakdown(
      firstDefined(data.medicine_wise, data.medicine_breakdown, data.by_medicine, []),
      ["medicine_name", "medicine"]
    ),
    reasonBreakdown: normalizeBreakdown(
      firstDefined(data.reason_wise, data.reason_breakdown, data.by_reason, []),
      ["reason"]
    ),
  };
};

const getReturnAmount = (form) =>
  Number(form.return_quantity || 0) * Number(form.purchase_rate || 0);

const buildQueryParams = (filters, page) => {
  const params = {};

  if (page) params.page = page;
  if (filters.search.trim()) params.search = filters.search.trim();
  if (filters.distributor_id !== "all") params.distributor_id = filters.distributor_id;
  if (filters.reason !== "all") params.reason = filters.reason;
  if (filters.ledger_adjusted !== "all") {
    params.adjust_distributor_ledger = filters.ledger_adjusted;
    params.ledger_adjusted = filters.ledger_adjusted;
  }
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;

  return params;
};

function ReportStat({ label, value, tone }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-4">
      <div className="text-xs uppercase tracking-[0.15em] text-slate-500 font-semibold">
        {label}
      </div>
      <div className={`font-heading text-2xl font-bold mt-1 ${tone || "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function BreakdownTable({ title, items }) {
  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Value</th>
            <th className="text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-6 text-slate-500">
                No breakdown data.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id}>
              <td className="font-medium">{item.name}</td>
              <td className="num-cell">{item.quantity}</td>
              <td className="num-cell font-semibold">{fmtINR(item.value)}</td>
              <td className="num-cell">{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PurchaseReturns() {
  const [returns, setReturns] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [report, setReport] = useState(emptyReport);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  const returnAmount = useMemo(() => getReturnAmount(form), [form]);

  const openCreateDialog = () => {
    setForm({ ...emptyForm, return_date: new Date().toISOString().split("T")[0] });
    setOpen(true);
  };

  const loadDistributors = async () => {
    try {
      const { data } = await api.get("/distributors");
      setDistributors(Array.isArray(data) ? data : data?.items || data?.data || []);
    } catch (e) {
      toast.error("Failed to load distributors");
    }
  };

  const loadReturns = async (nextPage = page, nextFilters = appliedFilters) => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/purchase-returns", {
        params: buildQueryParams(nextFilters, nextPage),
      });
      const normalized = normalizeCollection(data);
      setReturns(normalized.items);
      setPagination(normalized);
      setPage(normalized.page || nextPage);
    } catch (e) {
      setError(formatApiError(e));
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (nextFilters = appliedFilters) => {
    try {
      setReportLoading(true);
      const { data } = await api.get("/reports/purchase-returns", {
        params: buildQueryParams(nextFilters),
      });
      setReport(normalizeReport(data));
    } catch (e) {
      toast.error(formatApiError(e));
      setReport(emptyReport);
    } finally {
      setReportLoading(false);
    }
  };

  const loadAll = async (nextPage = page, nextFilters = appliedFilters) => {
    await Promise.all([
      loadReturns(nextPage, nextFilters),
      loadReport(nextFilters),
    ]);
  };

  useEffect(() => {
    loadDistributors();
    loadAll(1, emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDistributor = (value) => {
    const distributor = distributors.find((item) => String(item.id) === String(value));
    setForm({
      ...form,
      distributor_id: value,
      distributor_name: distributor?.name || "",
    });
  };

  const validateForm = () => {
    if (!form.return_date) return "Return date is required";
    if (!form.distributor_id) return "Distributor is required";
    if (!form.medicine_name.trim()) return "Medicine name is required";
    if (!form.batch_number.trim()) return "Batch number is required";
    if (!form.expiry_date) return "Expiry date is required";
    if (!form.return_quantity || Number(form.return_quantity) <= 0) return "Return quantity must be greater than 0";
    if (form.purchase_rate === "" || Number(form.purchase_rate) < 0) return "Purchase rate is required";
    if (!form.reason) return "Reason is required";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    const payload = {
      return_date: form.return_date,
      distributor_id: form.distributor_id,
      distributor_name: form.distributor_name,
      medicine_name: form.medicine_name.trim(),
      batch_number: form.batch_number.trim(),
      expiry_date: form.expiry_date,
      return_quantity: Number(form.return_quantity),
      purchase_rate: Number(form.purchase_rate),
      return_amount: returnAmount,
      reason: form.reason,
      notes: form.notes.trim(),
      adjust_distributor_ledger: form.adjust_distributor_ledger,
    };

    try {
      setSaving(true);
      await api.post("/purchase-returns", payload);
      toast.success("Purchase return created");
      setOpen(false);
      setForm({ ...emptyForm, return_date: new Date().toISOString().split("T")[0] });
      await loadAll(1, appliedFilters);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const applyFilters = async (e) => {
    e.preventDefault();
    setAppliedFilters(filters);
    setPage(1);
    await loadAll(1, filters);
  };

  const clearFilters = async () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
    await loadAll(1, emptyFilters);
  };

  const goToPage = async (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    setPage(nextPage);
    await loadReturns(nextPage, appliedFilters);
  };

  return (
    <div className="space-y-6" data-testid="purchase-returns-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
            Supplier returns
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Purchase Returns
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Record expiry and purchase returns without changing billing or PO calculations.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadAll(page, appliedFilters)} disabled={loading || reportLoading}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh
          </Button>
          <Button onClick={openCreateDialog} className="rounded-sm bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />New Return
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStat
          label="Total Returned Quantity"
          value={reportLoading ? "Loading…" : report.totalReturnedQuantity}
          tone="text-slate-900"
        />
        <ReportStat
          label="Total Return Value"
          value={reportLoading ? "Loading…" : fmtINR(report.totalReturnValue)}
          tone="text-blue-600"
        />
        <ReportStat
          label="Ledger Adjusted Count"
          value={reportLoading ? "Loading…" : report.ledgerAdjustedCount}
          tone="text-emerald-600"
        />
        <ReportStat
          label="Non-Adjusted Count"
          value={reportLoading ? "Loading…" : report.nonAdjustedCount}
          tone="text-amber-600"
        />
      </div>

      <form onSubmit={applyFilters} className="bg-white border border-slate-200 rounded-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Search className="w-4 h-4" />Search and filters
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="xl:col-span-2">
            <Label className="text-xs uppercase font-semibold text-slate-600">Search</Label>
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Medicine, batch, notes"
              className="rounded-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">Distributor</Label>
            <Select
              value={filters.distributor_id}
              onValueChange={(value) => setFilters({ ...filters, distributor_id: value })}
            >
              <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {distributors.map((distributor) => (
                  <SelectItem key={distributor.id} value={String(distributor.id)}>
                    {distributor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">Reason</Label>
            <Select
              value={filters.reason}
              onValueChange={(value) => setFilters({ ...filters, reason: value })}
            >
              <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {reasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">Ledger Adjusted</Label>
            <Select
              value={filters.ledger_adjusted}
              onValueChange={(value) => setFilters({ ...filters, ledger_adjusted: value })}
            >
              <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ledgerFilterValues.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">From</Label>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="rounded-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">To</Label>
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="rounded-sm mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={clearFilters} className="rounded-sm">
            Clear
          </Button>
          <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700">
            Apply Filters
          </Button>
        </div>
      </form>

      <div className="grid xl:grid-cols-3 gap-4">
        <BreakdownTable title="Distributor-wise Breakdown" items={report.distributorBreakdown} />
        <BreakdownTable title="Medicine-wise Breakdown" items={report.medicineBreakdown} />
        <BreakdownTable title="Reason-wise Breakdown" items={report.reasonBreakdown} />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Return Date</th>
              <th>Distributor</th>
              <th>Medicine</th>
              <th>Batch</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Purchase Rate</th>
              <th className="text-right">Return Amount</th>
              <th>Reason</th>
              <th>Ledger Adjusted</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                    Loading purchase returns…
                  </div>
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-red-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && returns.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-500">
                  No purchase returns found.
                </td>
              </tr>
            )}

            {!loading && !error && returns.map((item) => {
              const adjusted = Boolean(item.adjust_distributor_ledger || item.ledger_adjusted);
              return (
                <tr key={item.id || `${item.medicine_name}-${item.batch_number}-${item.return_date}`}>
                  <td className="font-mono-nums text-xs">{fmtDate(firstDefined(item.return_date, item.date, item.created_at))}</td>
                  <td className="font-medium">{firstDefined(item.distributor_name, item.distributor, "—")}</td>
                  <td>{firstDefined(item.medicine_name, item.medicine, "—")}</td>
                  <td className="font-mono text-xs">{firstDefined(item.batch_number, item.batch_no, item.batch, "—")}</td>
                  <td className="num-cell">{firstDefined(item.return_quantity, item.quantity, 0)}</td>
                  <td className="num-cell">{fmtINR(firstDefined(item.purchase_rate, item.purchase_price, 0))}</td>
                  <td className="num-cell font-semibold">{fmtINR(firstDefined(item.return_amount, item.amount, 0))}</td>
                  <td>{item.reason || "—"}</td>
                  <td>
                    <span className={`text-xs font-semibold ${adjusted ? "text-emerald-600" : "text-slate-500"}`}>
                      {adjusted ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="text-xs text-slate-600">{item.notes || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-slate-600">
        <div>
          Page <span className="font-semibold">{pagination.page}</span> of{" "}
          <span className="font-semibold">{pagination.totalPages}</span> · Total records{" "}
          <span className="font-semibold">{pagination.total}</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading || !pagination.hasPrevious}
            onClick={() => goToPage(page - 1)}
            className="rounded-sm"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !pagination.hasNext}
            onClick={() => goToPage(page + 1)}
            className="rounded-sm"
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading">New Purchase Return</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Return Date</Label>
                <Input
                  type="date"
                  value={form.return_date}
                  onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Distributor</Label>
                <Select value={form.distributor_id} onValueChange={updateDistributor}>
                  <SelectTrigger className="rounded-sm mt-1"><SelectValue placeholder="Select distributor" /></SelectTrigger>
                  <SelectContent>
                    {distributors.map((distributor) => (
                      <SelectItem key={distributor.id} value={String(distributor.id)}>
                        {distributor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Medicine Name</Label>
                <Input
                  value={form.medicine_name}
                  onChange={(e) => setForm({ ...form, medicine_name: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Batch Number</Label>
                <Input
                  value={form.batch_number}
                  onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Reason</Label>
                <Select value={form.reason} onValueChange={(value) => setForm({ ...form, reason: value })}>
                  <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {reasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Return Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.return_quantity}
                  onChange={(e) => setForm({ ...form, return_quantity: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Purchase Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_rate}
                  onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })}
                  className="rounded-sm mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Return Amount</Label>
                <Input
                  value={fmtINR(returnAmount)}
                  readOnly
                  className="rounded-sm mt-1 text-blue-700 font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs uppercase font-semibold text-slate-600">Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="rounded-sm mt-1"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-sm p-3 bg-slate-50 flex items-start justify-between gap-3">
              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  Adjust Distributor Ledger
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  {form.adjust_distributor_ledger
                    ? "When ON, inventory is reduced and distributor outstanding/payable is adjusted."
                    : "When OFF, inventory is reduced but distributor ledger is not adjusted."}
                </p>
              </div>
              <Switch
                checked={form.adjust_distributor_ledger}
                onCheckedChange={(checked) => setForm({ ...form, adjust_distributor_ledger: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-sm">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-sm bg-blue-600 hover:bg-blue-700">
                {saving ? "Saving..." : "Create Return"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
