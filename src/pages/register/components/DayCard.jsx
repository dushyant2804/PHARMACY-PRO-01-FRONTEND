import React from "react";
import { fmtINR } from "@/lib/api";
import { StickyNote } from "lucide-react";

export default function DayCard({ dayNumber, day, onClick }) {
  const hasData = day && (day.grossSales != null || day.expenses != null);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-sm border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:shadow-sm"
      data-testid="register-day-card"
    >
      <div className="flex items-center justify-between">
        <span className="font-heading text-sm font-bold text-slate-800">{dayNumber}</span>
        {day?.noteCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <StickyNote className="h-3 w-3" />{day.noteCount}
          </span>
        )}
      </div>
      {hasData ? (
        <>
          <p className="font-mono-nums text-sm font-semibold text-emerald-700">{fmtINR(day.grossSales)}</p>
          {day.expenses != null && (
            <p className="font-mono-nums text-xs text-red-600">-{fmtINR(day.expenses)}</p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">No entry</p>
      )}
    </button>
  );
}
