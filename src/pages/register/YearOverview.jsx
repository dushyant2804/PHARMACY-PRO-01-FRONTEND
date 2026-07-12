import React, { useEffect, useState } from "react";
import RegisterHeader from "./components/RegisterHeader";
import SummaryCards from "./components/SummaryCards";
import MonthCard from "./components/MonthCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import {
  getFinancialYearSummary,
  getFinancialYearMonths,
  resolveMonthStatus,
  previousFinancialYear,
  nextFinancialYear,
  formatRegisterError,
} from "@/lib/register";

export default function YearOverview({ financialYear, onChangeFinancialYear, onOpenMonth, onBackToDashboard }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFinancialYearSummary(financialYear)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setError(formatRegisterError(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [financialYear]);

  // Structural month list always renders so the year's shape is visible even
  // before the backend responds; financial figures merge in once available.
  const structuralMonths = getFinancialYearMonths(financialYear);
  const monthsByKey = new Map((summary?.months || []).map((m) => [m.monthKey, m]));
  const months = structuralMonths.map((month) => {
    const backendMonth = monthsByKey.get(month.monthKey);
    return {
      ...month,
      status: resolveMonthStatus(month.monthKey, backendMonth?.status),
      totals: backendMonth?.totals || {},
    };
  });

  const totals = summary?.totals || {};

  return (
    <div className="mx-auto max-w-6xl space-y-5" data-testid="register-year-page">
      <RegisterHeader
        crumbs={[{ label: `FY ${financialYear}` }]}
        onBackToDashboard={onBackToDashboard}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-sm" onClick={() => onChangeFinancialYear(previousFinancialYear(financialYear))} aria-label="Previous financial year">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-sm" onClick={() => onChangeFinancialYear(nextFinancialYear(financialYear))} aria-label="Next financial year">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Live figures aren't available yet.</p>
            <p>{error} The month grid below reflects calendar structure only — real totals will appear once the Register backend is connected.</p>
          </div>
        </div>
      )}

      <SummaryCards
        items={[
          { label: "Annual Gross Sales", value: totals.grossSales },
          { label: "Annual Expenses", value: totals.totalExpenses, tone: "text-red-600" },
          { label: "Annual Net", value: totals.netProfit, tone: "text-blue-700" },
          { label: "Cash Total", value: totals.cashSales },
          { label: "UPI Total", value: totals.upiSales },
          { label: "Card Total", value: totals.cardSales },
          { label: "Credit Total", value: totals.creditSales, tone: "text-amber-600" },
          { label: "Average Daily Sales", value: summary?.averageDailySales },
        ]}
      />

      <section aria-label="Months in this financial year">
        <h2 className="mb-3 font-heading text-lg font-semibold text-slate-800">Months</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month) => (
            <MonthCard
              key={month.monthKey}
              label={month.label}
              status={month.status}
              totals={month.totals}
              onClick={() => onOpenMonth(month.monthKey)}
            />
          ))}
        </div>
      </section>

      {loading && <p className="text-center text-sm text-slate-400">Loading financial year summary…</p>}
    </div>
  );
}
