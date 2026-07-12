import React from "react";
import { fmtINR } from "@/lib/api";
import StatusBadge from "./StatusBadge";
import { ChevronRight } from "lucide-react";

export default function MonthCard({ label, status, totals, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-sm border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
      data-testid={`register-month-card`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading font-semibold text-slate-800">{label}</p>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
        <div>
          <p className="uppercase tracking-wide">Gross Sales</p>
          <p className="font-mono-nums font-semibold text-slate-800">
            {totals?.grossSales == null ? "—" : fmtINR(totals.grossSales)}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-wide">Net Profit</p>
          <p className="font-mono-nums font-semibold text-slate-800">
            {totals?.netProfit == null ? "—" : fmtINR(totals.netProfit)}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-end text-xs font-medium text-blue-600 opacity-0 transition group-hover:opacity-100">
        Open month <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
