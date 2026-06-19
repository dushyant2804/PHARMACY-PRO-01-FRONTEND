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
import { Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

const reasons = ["Expired", "Damaged", "Wrong Item", "Other"];
const ledgerFilterValues = [
  { value: "all", label: "All" },
  { value: "true", label: "Ledger Adjusted" },
  { value: "false", label: "Not Adjusted" },
];


const toExpiryMonthYear = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const monthYear = raw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (monthYear) return monthYear[0];

  const canonical = raw.match(/^(\d{4})[-/](0[1-9]|1[0-2])(?:[-/]\d{1,2})?$/);
  if (canonical) return `${canonical[2]}/${canonical[1].slice(-2)}`;

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
  }

  return raw;
};

const isExpiryMonthYear = (value) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(String(value || "").trim());

const emptyForm = {
  return_date: new Date().toISOString().split("T")[0],
  distributor_id: "",
  distributor_name: "",
  medicine_id: "",
  medicine_key: "",
  medicine_name: "",
  batch_number: "",
  expiry_date: "",
  available_stock: "",
  return_quantity: "",
  purchase_rate: "",
  mrp: "",
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
  ledgerBreakdown: [],
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

const normalizeBreakdownSource = (source) => {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];

  return Object.entries(source).map(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { name: key, ...value };
    }

    return { name: key, quantity: value };
  });
};

const getFirstBreakdownSource = (data, keys) => {
  const containers = [data, data?.breakdowns, data?.breakdown, data?.summary];

  for (const container of containers) {
    if (!container || typeof container !== "object") continue;

    for (const key of keys) {
      if (container[key] !== undefined && container[key] !== null) {
        return container[key];
      }
    }
  }

  return [];
};

const formatBreakdownName = (value) => {
  if (typeof value === "boolean") return value ? "Ledger Adjusted" : "Ledger Not Adjusted";

  const normalized = String(value ?? "").trim();
  const lowered = normalized.toLowerCase();
  if (["true", "yes", "adjusted", "ledger_adjusted"].includes(lowered)) return "Ledger Adjusted";
  if (["false", "no", "not_adjusted", "non_adjusted", "unadjusted"].includes(lowered)) return "Ledger Not Adjusted";

  return normalized || "—";
};

const normalizeBreakdown = (items, nameKeys = ["name"]) => {
  const normalizedItems = normalizeBreakdownSource(items);

  return normalizedItems.map((item, index) => {
    const rawName = firstDefined(
      ...nameKeys.map((key) => item[key]),
      item.name,
      item.label,
      item.status,
      item.type,
      "—"
    );

    return {
      id: firstDefined(item.id, item.distributor_id, item.medicine_id, item.reason, item.status, rawName, index),
      name: formatBreakdownName(rawName),
      quantity: Number(firstDefined(
        item.total_returned_quantity,
        item.total_return_quantity,
        item.total_quantity,
        item.return_quantity,
        item.quantity,
        item.qty,
        0
      ) || 0),
      value: Number(firstDefined(
        item.total_return_value,
        item.total_return_amount,
        item.total_amount,
        item.return_amount,
        item.amount,
        item.value,
        0
      ) || 0),
      count: Number(firstDefined(item.count, item.total_count, item.records, item.return_count, item.total_records, 0) || 0),
    };
  });
};

const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const hasBreakdownRows = (report) => [
  report.distributorBreakdown,
  report.medicineBreakdown,
  report.reasonBreakdown,
  report.ledgerBreakdown,
].some((items) => Array.isArray(items) && items.length > 0);

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "adjusted", "ledger_adjusted"].includes(normalized);
};

const getSettlementState = (item) => {
  const status = String(firstDefined(item.settlement_status, item.credit_status, item.status, "")).toLowerCase();
  if (parseBoolean(firstDefined(item.adjust_distributor_ledger, item.ledger_adjusted, false))) {
    return { label: "Ledger Adjusted", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }

  if (parseBoolean(firstDefined(
    item.settled_in_po,
    item.purchase_order_settled,
    item.credit_consumed,
    item.is_settled,
    false
  )) || firstDefined(item.settlement_purchase_order_id, item.settled_purchase_order_id, item.purchase_order_id)
    || ["settled", "settled_in_po", "consumed", "applied"].includes(status)) {
    return { label: "Settled in PO", className: "border-blue-200 bg-blue-50 text-blue-800" };
  }

  return { label: "Unsettled", className: "border-amber-200 bg-amber-50 text-amber-800" };
};

const isVoided = (item) => parseBoolean(firstDefined(item.is_voided, item.voided, false))
  || ["void", "voided", "cancelled", "canceled"].includes(String(item.status || "").toLowerCase());

const actionAllowed = (item, action) => {
  const explicit = firstDefined(item[`can_${action}`], item.permissions?.[action], item.allowed_actions?.includes?.(action));
  if (explicit !== undefined) return parseBoolean(explicit);
  if (["edit", "delete"].includes(action)) return !isVoided(item);
  return !isVoided(item) && getSettlementState(item).label === "Unsettled";
};

function SettlementBadge({ item }) {
  const settlement = getSettlementState(item);
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${settlement.className}`}>
      {settlement.label}
    </span>
  );
}

const addBreakdownRecord = (groups, key, name, record) => {
  const safeKey = String(firstDefined(key, name, "—"));
  const safeName = formatBreakdownName(name);
  const existing = groups.get(safeKey) || {
    id: safeKey,
    name: safeName,
    quantity: 0,
    value: 0,
    count: 0,
  };

  existing.quantity += toNumber(firstDefined(record.return_quantity, record.quantity, record.qty, 0));
  existing.value += toNumber(firstDefined(record.return_amount, record.total_return_amount, record.amount, record.value, 0));
  existing.count += 1;
  groups.set(safeKey, existing);
};

const sortedBreakdownRows = (groups) => Array.from(groups.values())
  .sort((left, right) => right.value - left.value || right.quantity - left.quantity || left.name.localeCompare(right.name));

const buildReportFromReturns = (returnItems = []) => {
  const distributorGroups = new Map();
  const medicineGroups = new Map();
  const reasonGroups = new Map();
  const ledgerGroups = new Map();
  let totalReturnedQuantity = 0;
  let totalReturnValue = 0;
  let ledgerAdjustedCount = 0;
  let nonAdjustedCount = 0;

  returnItems.forEach((record, index) => {
    const quantity = toNumber(firstDefined(record.return_quantity, record.quantity, record.qty, 0));
    const value = toNumber(firstDefined(record.return_amount, record.total_return_amount, record.amount, record.value, 0));
    const ledgerAdjusted = parseBoolean(firstDefined(record.adjust_distributor_ledger, record.ledger_adjusted, false));

    totalReturnedQuantity += quantity;
    totalReturnValue += value;
    if (ledgerAdjusted) ledgerAdjustedCount += 1;
    else nonAdjustedCount += 1;

    addBreakdownRecord(
      distributorGroups,
      firstDefined(record.distributor_id, record.distributor_name, record.distributor, `unknown-distributor-${index}`),
      firstDefined(record.distributor_name, record.distributor, record.distributor_id, "Unknown Distributor"),
      record
    );
    addBreakdownRecord(
      medicineGroups,
      firstDefined(record.medicine_id, record.medicine_key, record.medicine_name, record.medicine, `unknown-medicine-${index}`),
      firstDefined(record.medicine_name, record.medicine, record.medicine_key, record.medicine_id, "Unknown Medicine"),
      record
    );
    addBreakdownRecord(
      reasonGroups,
      firstDefined(record.reason, "No Reason"),
      firstDefined(record.reason, "No Reason"),
      record
    );
    addBreakdownRecord(
      ledgerGroups,
      ledgerAdjusted ? "ledger-adjusted" : "ledger-not-adjusted",
      ledgerAdjusted ? "Ledger Adjusted" : "Ledger Not Adjusted",
      record
    );
  });

  return {
    totalReturnedQuantity,
    totalReturnValue,
    ledgerAdjustedCount,
    nonAdjustedCount,
    distributorBreakdown: sortedBreakdownRows(distributorGroups),
    medicineBreakdown: sortedBreakdownRows(medicineGroups),
    reasonBreakdown: sortedBreakdownRows(reasonGroups),
    ledgerBreakdown: sortedBreakdownRows(ledgerGroups),
  };
};

const mergeReportWithFallback = (apiReport, fallbackReport) => ({
  totalReturnedQuantity: apiReport.totalReturnedQuantity || fallbackReport.totalReturnedQuantity,
  totalReturnValue: apiReport.totalReturnValue || fallbackReport.totalReturnValue,
  ledgerAdjustedCount: apiReport.ledgerAdjustedCount || fallbackReport.ledgerAdjustedCount,
  nonAdjustedCount: apiReport.nonAdjustedCount || fallbackReport.nonAdjustedCount,
  distributorBreakdown: apiReport.distributorBreakdown.length ? apiReport.distributorBreakdown : fallbackReport.distributorBreakdown,
  medicineBreakdown: apiReport.medicineBreakdown.length ? apiReport.medicineBreakdown : fallbackReport.medicineBreakdown,
  reasonBreakdown: apiReport.reasonBreakdown.length ? apiReport.reasonBreakdown : fallbackReport.reasonBreakdown,
  ledgerBreakdown: apiReport.ledgerBreakdown.length ? apiReport.ledgerBreakdown : fallbackReport.ledgerBreakdown,
});

const normalizeReport = (reportData) => {
  const data = reportData?.data && !Array.isArray(reportData.data) ? reportData.data : reportData || {};
  const summary = data.summary || data.totals || data;
  const ledgerAdjustedCount = Number(
    firstDefined(summary.ledger_adjusted_count, summary.adjusted_count, summary.ledger_adjusted, 0) || 0
  );
  const nonAdjustedCount = Number(
    firstDefined(summary.non_adjusted_count, summary.not_adjusted_count, summary.unadjusted_count, summary.not_adjusted, 0) || 0
  );
  const ledgerBreakdownSource = getFirstBreakdownSource(data, [
    "ledger_wise",
    "by_ledger",
    "by_ledger_adjusted",
    "ledger_breakdown",
    "ledger_adjusted_breakdown",
    "ledger_adjustment_breakdown",
    "ledger_status",
  ]);
  const ledgerBreakdown = normalizeBreakdown(
    ledgerBreakdownSource,
    ["ledger_status", "ledger_adjusted", "adjust_distributor_ledger", "adjusted", "status"]
  );

  return {
    totalReturnedQuantity: Number(
      firstDefined(summary.total_returned_quantity, summary.total_return_quantity, summary.total_quantity, 0) || 0
    ),
    totalReturnValue: Number(
      firstDefined(summary.total_return_value, summary.total_return_amount, summary.total_amount, 0) || 0
    ),
    ledgerAdjustedCount,
    nonAdjustedCount,
    distributorBreakdown: normalizeBreakdown(
      getFirstBreakdownSource(data, ["distributor_wise", "by_distributor", "distributor_breakdown", "distributors"]),
      ["distributor_name", "distributor"]
    ),
    medicineBreakdown: normalizeBreakdown(
      getFirstBreakdownSource(data, ["medicine_wise", "by_medicine", "medicine_breakdown", "medicines"]),
      ["medicine_name", "medicine"]
    ),
    reasonBreakdown: normalizeBreakdown(
      getFirstBreakdownSource(data, ["reason_wise", "by_reason", "reason_breakdown", "reasons"]),
      ["reason"]
    ),
    ledgerBreakdown: ledgerBreakdown.length ? ledgerBreakdown : [
      ledgerAdjustedCount > 0 ? {
        id: "ledger-adjusted",
        name: "Ledger Adjusted",
        quantity: 0,
        value: 0,
        count: ledgerAdjustedCount,
      } : null,
      nonAdjustedCount > 0 ? {
        id: "ledger-not-adjusted",
        name: "Ledger Not Adjusted",
        quantity: 0,
        value: 0,
        count: nonAdjustedCount,
      } : null,
    ].filter(Boolean),
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

const getMedicineId = (medicine, batch = {}) =>
  firstDefined(batch.medicine_id, medicine.id, medicine.medicine_id, medicine.medicineId, "");

const getMedicineKey = (medicine, batch = {}) =>
  firstDefined(batch.medicine_key, medicine.medicine_key, medicine.key, medicine.sku, getMedicineId(medicine, batch));

const getBatchNumber = (batch = {}) =>
  firstDefined(batch.batch_number, batch.batch_no, batch.batch, batch.batchNo, "");

const getBatchExpiry = (batch = {}) =>
  firstDefined(batch.expiry_date, batch.expiry, batch.expiryDate, "");

const getBatchStock = (batch = {}) =>
  firstDefined(batch.available_stock, batch.quantity_units, batch.stock, batch.qty, batch.quantity, 0);

const getBatchDistributorName = (batch = {}, medicine = {}) =>
  firstDefined(batch.distributor_name, batch.distributor, medicine.distributor_name, "");

const getBatchDistributorId = (batch = {}, medicine = {}) =>
  firstDefined(batch.distributor_id, medicine.distributor_id, "");

const getBatchPurchaseRate = (batch = {}) =>
  firstDefined(batch.purchase_rate, batch.purchase_price, batch.rate, 0);

const getBatchMrp = (batch = {}) =>
  firstDefined(batch.mrp, batch.MRP, "");

const normalizeMedicineResponse = (data) => {
  const items = firstDefined(data?.items, data?.data, data?.results, data, []);
  return Array.isArray(items) ? items : [];
};

const buildBatchOptions = (medicines) => {
  return medicines.flatMap((medicine) => {
    const batches = Array.isArray(medicine.batches) ? medicine.batches : [];

    if (!batches.length) {
      return [{
        medicine,
        batch: {},
        medicine_id: getMedicineId(medicine),
        medicine_key: getMedicineKey(medicine),
        medicine_name: firstDefined(medicine.name, medicine.medicine_name, ""),
        batch_number: "",
        expiry_date: "",
        available_stock: Number(firstDefined(medicine.total_stock, medicine.available_stock, 0) || 0),
        distributor: firstDefined(medicine.distributor_name, medicine.distributor, ""),
        distributor_id: firstDefined(medicine.distributor_id, ""),
        purchase_rate: Number(firstDefined(medicine.purchase_rate, medicine.purchase_price, 0) || 0),
        mrp: firstDefined(medicine.mrp, ""),
      }];
    }

    return batches.map((batch) => ({
      medicine,
      batch,
      medicine_id: getMedicineId(medicine, batch),
      medicine_key: getMedicineKey(medicine, batch),
      medicine_name: firstDefined(medicine.name, medicine.medicine_name, batch.medicine_name, ""),
      batch_number: getBatchNumber(batch),
      expiry_date: getBatchExpiry(batch),
      available_stock: Number(getBatchStock(batch) || 0),
      distributor: getBatchDistributorName(batch, medicine),
      distributor_id: getBatchDistributorId(batch, medicine),
      purchase_rate: Number(getBatchPurchaseRate(batch) || 0),
      mrp: getBatchMrp(batch),
    }));
  });
};

const getBatchOptionKey = (option, index) => [
  option.medicine_id,
  option.medicine_key,
  option.batch_number,
  option.expiry_date,
  option.distributor_id,
  index,
].join("-");

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

function BreakdownCardList({ title, items }) {
  return (
    <section className="w-full bg-white border border-slate-200 rounded-sm shadow-sm">
      <div className="px-4 py-3 bg-slate-50 border-b">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="m-4 rounded-sm border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No breakdown data.
          </div>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Returns</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{fmtINR(item.value)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function PurchaseReturns() {
  const [returns, setReturns] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [batchOptions, setBatchOptions] = useState([]);
  const [batchSearchOpen, setBatchSearchOpen] = useState(false);
  const [batchSearchLoading, setBatchSearchLoading] = useState(false);
  const [selectedBatchKey, setSelectedBatchKey] = useState("");
  const [report, setReport] = useState(emptyReport);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [actionError, setActionError] = useState("");
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
    setForm({ ...emptyForm, return_date: new Date().toISOString().split("T")[0], adjust_distributor_ledger: false });
    setBatchOptions([]);
    setBatchSearchOpen(false);
    setSelectedBatchKey("");
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
      return normalized.items;
    } catch (e) {
      setError(formatApiError(e));
      toast.error(formatApiError(e));
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (nextFilters = appliedFilters, fallbackReturns = returns) => {
    const fallbackReport = buildReportFromReturns(fallbackReturns);

    try {
      setReportLoading(true);
      const { data } = await api.get("/reports/purchase-returns", {
        params: buildQueryParams(nextFilters),
      });
      const normalizedReport = normalizeReport(data);
      setReport(hasBreakdownRows(normalizedReport) ? mergeReportWithFallback(normalizedReport, fallbackReport) : fallbackReport);
    } catch (e) {
      toast.error(formatApiError(e));
      setReport(fallbackReport);
    } finally {
      setReportLoading(false);
    }
  };

  const loadAll = async (nextPage = page, nextFilters = appliedFilters) => {
    const fallbackReturns = await loadReturns(nextPage, nextFilters);
    await loadReport(nextFilters, fallbackReturns);
  };

  useEffect(() => {
    loadDistributors();
    loadAll(1, emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchBatchOptions = async (value) => {
    setForm((current) => ({
      ...current,
      medicine_name: value,
      medicine_id: "",
      medicine_key: "",
      batch_number: "",
      expiry_date: "",
      available_stock: "",
      purchase_rate: "",
      mrp: "",
    }));
    setSelectedBatchKey("");

    if (value.trim().length < 2) {
      setBatchOptions([]);
      setBatchSearchOpen(false);
      return;
    }

    try {
      setBatchSearchLoading(true);
      const { data } = await api.get("/medicines", { params: { search: value.trim() } });
      const options = buildBatchOptions(normalizeMedicineResponse(data));
      setBatchOptions(options);
      setBatchSearchOpen(true);
    } catch (e) {
      toast.error(formatApiError(e));
      setBatchOptions([]);
      setBatchSearchOpen(false);
    } finally {
      setBatchSearchLoading(false);
    }
  };

  const applyBatchOption = (option, index) => {
    const distributor = distributors.find((item) => String(item.id) === String(option.distributor_id));

    setForm((current) => ({
      ...current,
      medicine_id: option.medicine_id || "",
      medicine_key: option.medicine_key || "",
      medicine_name: option.medicine_name || "",
      batch_number: option.batch_number || "",
      expiry_date: option.expiry_date || "",
      distributor: option.distributor || distributor?.name || current.distributor_name || "",
      distributor_id: option.distributor_id ? String(option.distributor_id) : current.distributor_id,
      distributor_name: option.distributor || distributor?.name || current.distributor_name || "",
      available_stock: option.available_stock,
      purchase_rate: option.purchase_rate,
      mrp: option.mrp || "",
    }));
    setSelectedBatchKey(getBatchOptionKey(option, index));
    setBatchSearchOpen(false);
  };

  const getSelectedBatchOption = () => batchOptions.find(
    (option, index) => getBatchOptionKey(option, index) === selectedBatchKey
  );

  const validateForm = () => {
    const returnQuantity = Number(form.return_quantity);
    const availableStock = Number(form.available_stock);
    const purchaseRate = Number(form.purchase_rate);

    if (!form.return_date) return "Return date is required";
    if (!form.distributor_id) return "Distributor is required";
    if (!form.medicine_name.trim()) return "Medicine is required";
    if (!form.batch_number.trim()) return "Batch is required";
    if (!selectedBatchKey) return "Select an exact medicine batch";
    if (!getSelectedBatchOption()) return "Selected medicine batch was not found. Please select it again";
    if (!form.expiry_date) return "Expiry MM/YY is required";
    if (!isExpiryMonthYear(form.expiry_date)) return "Expiry must be in MM/YY format";
    if (form.return_quantity === "") return "Return quantity is required";
    if (!Number.isFinite(returnQuantity) || returnQuantity <= 0) return "Return quantity must be greater than 0";
    if (!Number.isFinite(availableStock) || returnQuantity > availableStock) return "Return quantity cannot exceed available stock";
    if (form.purchase_rate === "" || !Number.isFinite(purchaseRate) || purchaseRate < 0) return "Purchase rate is required";
    if (!form.reason?.trim()) return "Return reason is required";
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
      medicine_id: form.medicine_id,
      medicine_key: form.medicine_key,
      medicine_name: form.medicine_name.trim(),
      batch_number: form.batch_number.trim(),
      expiry_date: toExpiryMonthYear(form.expiry_date),
      available_stock: Number(form.available_stock || 0),
      return_quantity: Number(form.return_quantity),
      purchase_rate: Number(form.purchase_rate),
      mrp: form.mrp === "" ? undefined : Number(form.mrp),
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
      setForm({ ...emptyForm, return_date: new Date().toISOString().split("T")[0], adjust_distributor_ledger: false });
      setBatchOptions([]);
      setSelectedBatchKey("");
      await loadAll(1, appliedFilters);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item) => {
    const batchNumber = firstDefined(item.batch_number, item.batch_no, item.batch, "");
    const expiryDate = toExpiryMonthYear(firstDefined(item.expiry_date, item.expiry, ""));
    const selectedOption = {
      medicine_id: firstDefined(item.medicine_id, ""),
      medicine_key: firstDefined(item.medicine_key, item.medicine_id, ""),
      medicine_name: firstDefined(item.medicine_name, item.medicine, ""),
      batch_number: batchNumber,
      expiry_date: expiryDate,
      distributor_id: firstDefined(item.distributor_id, ""),
      distributor: firstDefined(item.distributor_name, item.distributor, ""),
      available_stock: firstDefined(item.available_stock, item.current_stock, item.return_quantity, item.quantity, 0),
      purchase_rate: firstDefined(item.purchase_rate, item.purchase_price, ""),
      mrp: firstDefined(item.mrp, ""),
    };

    setActionError("");
    setEditing(item);
    setBatchOptions([selectedOption]);
    setSelectedBatchKey(getBatchOptionKey(selectedOption, 0));
    setBatchSearchOpen(false);
    setEditForm({
      ...emptyForm,
      return_date: String(firstDefined(item.return_date, item.date, "")).slice(0, 10),
      distributor_id: String(firstDefined(item.distributor_id, "")),
      distributor_name: firstDefined(item.distributor_name, item.distributor, ""),
      medicine_id: firstDefined(item.medicine_id, ""),
      medicine_key: firstDefined(item.medicine_key, item.medicine_id, ""),
      medicine_name: firstDefined(item.medicine_name, item.medicine, ""),
      batch_number: batchNumber,
      expiry_date: expiryDate,
      available_stock: firstDefined(item.available_stock, item.current_stock, item.return_quantity, item.quantity, 0),
      return_quantity: firstDefined(item.return_quantity, item.quantity, ""),
      purchase_rate: firstDefined(item.purchase_rate, item.purchase_price, ""),
      mrp: firstDefined(item.mrp, ""),
      reason: item.reason || "Other",
      notes: item.notes || "",
      adjust_distributor_ledger: parseBoolean(firstDefined(item.adjust_distributor_ledger, item.ledger_adjusted, false)),
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editForm.expiry_date) {
      toast.error("Expiry MM/YY is required");
      return;
    }
    if (!isExpiryMonthYear(editForm.expiry_date)) {
      toast.error("Expiry must be in MM/YY format");
      return;
    }
    const payload = {
      return_date: editForm.return_date,
      distributor_id: editForm.distributor_id,
      distributor_name: editForm.distributor_name,
      medicine_id: editForm.medicine_id,
      medicine_key: editForm.medicine_key,
      medicine_name: editForm.medicine_name.trim(),
      batch_number: editForm.batch_number.trim(),
      expiry_date: toExpiryMonthYear(editForm.expiry_date),
      return_quantity: Number(editForm.return_quantity),
      purchase_rate: Number(editForm.purchase_rate),
      return_amount: getReturnAmount(editForm),
      reason: editForm.reason,
      notes: editForm.notes.trim(),
      adjust_distributor_ledger: editForm.adjust_distributor_ledger,
    };
    try {
      setSaving(true);
      setActionError("");
      await api.patch(`/purchase-returns/${editing.id}`, payload);
      toast.success("Purchase return updated");
      setEditing(null);
      await loadAll(page, appliedFilters);
    } catch (e) {
      const message = formatApiError(e);
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReturn = async (item) => {
    if (!window.confirm("Delete Purchase Return\n\nDeleting this purchase return will reverse its stock impact. If it was ledger-adjusted, the linked distributor ledger entry will also be removed or reversed. Continue?")) return;
    try {
      setActionError("");
      await api.delete(`/purchase-returns/${item.id}`);
      toast.success("Purchase return deleted");
      await loadAll(page, appliedFilters);
    } catch (e) {
      const message = formatApiError(e);
      setActionError(message);
      toast.error(message);
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

      <div className="space-y-6">
        <BreakdownCardList title="Distributor-wise Breakdown" items={report.distributorBreakdown} />
        <BreakdownCardList title="Medicine-wise Breakdown" items={report.medicineBreakdown} />
        <BreakdownCardList title="Reason-wise Breakdown" items={report.reasonBreakdown} />
        <BreakdownCardList title="Ledger-wise Breakdown" items={report.ledgerBreakdown} />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto shadow-sm">
        {actionError && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{actionError}</div>}
        <table className="data-table min-w-[1120px]">
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
              <th>Settlement</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                    Loading purchase returns…
                  </div>
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-red-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && returns.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-slate-500">
                  No purchase returns found.
                </td>
              </tr>
            )}

            {!loading && !error && returns.map((item) => {
              return (
                <tr className="align-top [&>td]:py-4" key={item.id || `${item.medicine_name}-${item.batch_number}-${item.return_date}`}>
                  <td className="font-mono-nums text-xs">{fmtDate(firstDefined(item.return_date, item.date, item.created_at))}</td>
                  <td className="max-w-[180px] font-semibold text-slate-900">{firstDefined(item.distributor_name, item.distributor, "—")}</td>
                  <td className="max-w-[200px] font-medium text-slate-800">{firstDefined(item.medicine_name, item.medicine, "—")}</td>
                  <td className="font-mono text-xs font-semibold text-slate-700">{firstDefined(item.batch_number, item.batch_no, item.batch, "—")}</td>
                  <td className="num-cell tabular-nums">{firstDefined(item.return_quantity, item.quantity, 0)}</td>
                  <td className="num-cell tabular-nums">{fmtINR(firstDefined(item.purchase_rate, item.purchase_price, 0))}</td>
                  <td className="num-cell font-semibold tabular-nums">{fmtINR(firstDefined(item.return_amount, item.amount, 0))}</td>
                  <td>{item.reason || "—"}</td>
                  <td><SettlementBadge item={item} /></td>
                  <td className="text-xs text-slate-600">{item.notes || "—"}</td>
                  <td><div className="flex gap-2">
                    {actionAllowed(item, "edit") && <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>}
                    {actionAllowed(item, "delete") && <Button size="sm" variant="outline" className="text-red-700" onClick={() => deleteReturn(item)}>Delete</Button>}
                  </div></td>
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

          <form onSubmit={submit} noValidate className="space-y-4">
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
                <Input
                  value={form.distributor_name}
                  readOnly
                  placeholder="Auto-filled after batch selection"
                  className="rounded-sm mt-1 bg-slate-50"
                  required
                />
              </div>

              <div className="md:col-span-2 relative">
                <Label className="text-xs uppercase font-semibold text-slate-600">Medicine / Batch</Label>
                <Input
                  value={form.medicine_name}
                  onChange={(e) => searchBatchOptions(e.target.value)}
                  onFocus={() => batchOptions.length > 0 && setBatchSearchOpen(true)}
                  placeholder="Type medicine name and select an exact batch"
                  className="rounded-sm mt-1"
                  required
                />
                {batchSearchOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-sm shadow-lg max-h-72 overflow-y-auto">
                    {batchSearchLoading && (
                      <div className="p-3 text-sm text-slate-500">Searching medicines…</div>
                    )}
                    {!batchSearchLoading && batchOptions.length === 0 && (
                      <div className="p-3 text-sm text-slate-500">No matching batches found.</div>
                    )}
                    {!batchSearchLoading && batchOptions.map((option, index) => (
                      <button
                        type="button"
                        key={getBatchOptionKey(option, index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyBatchOption(option, index)}
                        className="block w-full text-left p-3 hover:bg-blue-50 border-b last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">
                          {option.medicine_name} | Batch {option.batch_number || "-"} | Exp {option.expiry_date || "-"}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Stock {option.available_stock} | {option.distributor || "No distributor"} | {fmtINR(option.purchase_rate || 0)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Batch Number</Label>
                <Input value={form.batch_number} readOnly className="rounded-sm mt-1 bg-slate-50" required />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Expiry (MM/YY)</Label>
                <Input value={form.expiry_date} readOnly placeholder="MM/YY" className="rounded-sm mt-1 bg-slate-50" required />
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
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs uppercase font-semibold text-slate-600">Return Quantity</Label>
                  <span className="text-xs text-slate-500">Available: {form.available_stock || 0}</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={form.available_stock || undefined}
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
                  readOnly
                  className="rounded-sm mt-1 bg-slate-50"
                  required
                />
              </div>

              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">MRP</Label>
                <Input value={form.mrp || ""} readOnly className="rounded-sm mt-1 bg-slate-50" />
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

            <div className="border border-slate-300 rounded-sm p-4 bg-slate-50 flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  Adjust Distributor Ledger
                </Label>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  {form.adjust_distributor_ledger
                    ? "ON — Inventory is reversed and the distributor ledger is adjusted immediately."
                    : "OFF — Inventory is reversed and the return credit is saved for future settlement."}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  If ledger adjustment is OFF, this return credit can later be consumed in a future Purchase Order.
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

      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="rounded-sm max-w-3xl">
          <DialogHeader><DialogTitle>Edit Purchase Return</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            {actionError && <div role="alert" className="rounded-sm bg-red-50 p-3 text-sm font-medium text-red-700">{actionError}</div>}
            {editForm.adjust_distributor_ledger && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                This return has a distributor ledger impact. Editing it will update the linked ledger transaction.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Return Date</Label><Input type="date" required value={editForm.return_date} onChange={(e) => setEditForm({ ...editForm, return_date: e.target.value })} /></div>
              <div><Label>Distributor</Label><Select value={editForm.distributor_id} onValueChange={(value) => { const distributor = distributors.find((item) => String(item.id) === String(value)); setEditForm({ ...editForm, distributor_id: value, distributor_name: distributor?.name || editForm.distributor_name }); }}><SelectTrigger><SelectValue placeholder="Select distributor" /></SelectTrigger><SelectContent>{distributors.map((distributor) => <SelectItem key={distributor.id} value={String(distributor.id)}>{distributor.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="md:col-span-2"><Label>Medicine / Batch</Label><Input required value={editForm.medicine_name} onChange={(e) => setEditForm({ ...editForm, medicine_name: e.target.value })} /></div>
              <div><Label>Batch Number</Label><Input required value={editForm.batch_number} onChange={(e) => setEditForm({ ...editForm, batch_number: e.target.value })} /></div>
              <div><Label>Expiry (MM/YY)</Label><Input placeholder="MM/YY" inputMode="numeric" pattern="(0[1-9]|1[0-2])/\d{2}" value={editForm.expiry_date} onChange={(e) => setEditForm({ ...editForm, expiry_date: toExpiryMonthYear(e.target.value) })} /></div>
              <div><Label>Return Quantity</Label><Input type="number" min="1" required value={editForm.return_quantity} onChange={(e) => setEditForm({ ...editForm, return_quantity: e.target.value })} /></div>
              <div><Label>Purchase Rate</Label><Input type="number" min="0" step="0.01" required value={editForm.purchase_rate} onChange={(e) => setEditForm({ ...editForm, purchase_rate: e.target.value })} /></div>
              <div><Label>Reason</Label><Select value={editForm.reason} onValueChange={(reason) => setEditForm({ ...editForm, reason })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reasons.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Return Amount</Label><Input value={fmtINR(getReturnAmount(editForm))} readOnly className="font-bold text-blue-700" /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            </div>
            <div className="border border-slate-300 rounded-sm p-4 bg-slate-50 flex items-center justify-between gap-4">
              <div><Label className="text-sm font-semibold text-slate-700">Adjust Distributor Ledger</Label><p className="text-xs text-slate-500 mt-1">Toggle only when backend permissions allow changing ledger treatment for this return.</p></div>
              <Switch checked={editForm.adjust_distributor_ledger} onCheckedChange={(checked) => setEditForm({ ...editForm, adjust_distributor_ledger: checked })} />
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
