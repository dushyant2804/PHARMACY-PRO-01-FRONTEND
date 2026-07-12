import React from "react";
import { fmtINR } from "@/lib/api";

// Generic KPI card grid. Every value must already be backend-provided — this
// component only formats/renders, it never sums or derives anything.
// items: [{ label, value, format: "currency" | "number", tone }]
export default function SummaryCards({ items }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Register summary">
      {items.map(({ label, value, format = "currency", tone = "text-slate-900" }) => (
        <div key={label} className="kpi-card rounded-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-2 font-heading text-xl font-bold font-mono-nums sm:text-2xl ${tone}`}>
            {value === null || value === undefined
              ? "—"
              : format === "currency"
              ? fmtINR(value)
              : value}
          </p>
        </div>
      ))}
    </section>
  );
}
