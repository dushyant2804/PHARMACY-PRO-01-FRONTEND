import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import YearOverview from "./YearOverview";
import MonthOverview from "./MonthOverview";
import DayView from "./DayView";
import { getCurrentFinancialYear } from "@/lib/register";

// Register is a single route with in-page Financial Year -> Month -> Day
// drill-down (no nested nav entries), per the module's navigation design.
export default function RegisterPage() {
  const navigate = useNavigate();
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear());
  const [view, setView] = useState({ level: "year" });

  const goToDashboard = () => navigate("/");
  const goToYear = () => setView({ level: "year" });
  const goToMonth = (monthKey) => setView({ level: "month", monthKey });
  const goToDay = (monthKey, date) => setView({ level: "day", monthKey, date });

  if (view.level === "day") {
    return (
      <DayView
        financialYear={financialYear}
        monthKey={view.monthKey}
        date={view.date}
        onBack={() => goToMonth(view.monthKey)}
        onBackToMonths={goToYear}
        onBackToDashboard={goToDashboard}
      />
    );
  }

  if (view.level === "month") {
    return (
      <MonthOverview
        financialYear={financialYear}
        monthKey={view.monthKey}
        onOpenDay={(date) => goToDay(view.monthKey, date)}
        onBack={goToYear}
        onBackToDashboard={goToDashboard}
      />
    );
  }

  return (
    <YearOverview
      financialYear={financialYear}
      onChangeFinancialYear={setFinancialYear}
      onOpenMonth={goToMonth}
      onBackToDashboard={goToDashboard}
    />
  );
}
