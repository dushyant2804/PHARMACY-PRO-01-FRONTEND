// Register API client + normalization.
//
// This module intentionally contains NO financial calculations. Every money
// figure (gross sales, totals, averages, highest day, etc.) must come from
// the backend response as-is. The only logic in here is:
//   1. Financial-year / calendar structure (which months belong to which FY,
//      how many days a month has) — this is calendar math, not financial math.
//   2. Talking to the backend endpoints and passing responses through with
//      light, non-computing field normalization (so the UI doesn't break if
//      the backend uses a slightly different field name).
//
// TODO(backend-integration): the `/register/*` endpoints below are the
// contract documented in docs/REGISTER_BACKEND_SPEC.md. The backend has not
// implemented them yet, so every call in this file will currently fail
// (network error or 404). Callers must treat that as "not available yet" and
// show a clear pending state — never invent numbers to fill the gap.

import api, { formatApiError } from "./api";

const firstDefined = (...values) => values.find((v) => v !== undefined && v !== null);

// ---------------------------------------------------------------------------
// Financial year / calendar structure (Indian FY: 1 April -> 31 March)
// ---------------------------------------------------------------------------

export function financialYearForDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // month index 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function getCurrentFinancialYear() {
  return financialYearForDate(new Date());
}

export function financialYearStartYear(financialYear) {
  const [start] = String(financialYear || "").split("-");
  const year = Number(start);
  return Number.isFinite(year) ? year : null;
}

export function previousFinancialYear(financialYear) {
  const startYear = financialYearStartYear(financialYear);
  if (startYear == null) return financialYear;
  return `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`;
}

export function nextFinancialYear(financialYear) {
  const startYear = financialYearStartYear(financialYear);
  if (startYear == null) return financialYear;
  return `${startYear + 1}-${String((startYear + 2) % 100).padStart(2, "0")}`;
}

// Returns the 12 { monthKey, label } entries for a financial year, April -> March.
export function getFinancialYearMonths(financialYear) {
  const startYear = financialYearStartYear(financialYear);
  if (startYear == null) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const calendarMonth = (3 + i) % 12; // 0-indexed; April = 3
    const calendarYear = startYear + (i < 9 ? 0 : 1); // Jan/Feb/Mar roll into the next calendar year
    const monthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`;
    return { monthKey, label: getMonthLabel(monthKey) };
  });
}

export function getMonthLabel(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return monthKey || "";
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function monthKeyForDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getDaysInMonth(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!year || !month) return [];
  const daysCount = new Date(year, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => {
    const day = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

export function formatDayLabel(isoDate) {
  if (!isoDate) return "";
  const day = Number(String(isoDate).split("-")[2]);
  return Number.isFinite(day) ? String(day) : isoDate;
}

// Structural-only estimate of a month's status, used purely so the UI has
// something sensible to show before the backend is connected. The backend's
// own `status` field always wins once a response is available — see
// `resolveMonthStatus`. Do not use this for anything that gates a write.
export function estimateMonthStatus(monthKey) {
  const current = monthKeyForDate(new Date());
  if (monthKey === current) return "open";
  return monthKey < current ? "closed" : "future";
}

// Prefers the backend-provided status; falls back to the structural estimate
// only when the backend hasn't returned one (e.g. not connected yet).
export function resolveMonthStatus(monthKey, backendStatus) {
  return backendStatus || estimateMonthStatus(monthKey);
}

// ---------------------------------------------------------------------------
// Normalization (pass-through — no computed financial values)
// ---------------------------------------------------------------------------

function normalizeMoneyTotals(totals = {}) {
  return {
    cashSales: firstDefined(totals.cash_sales, null),
    upiSales: firstDefined(totals.upi_sales, null),
    cardSales: firstDefined(totals.card_sales, null),
    creditSales: firstDefined(totals.credit_sales, null),
    grossSales: firstDefined(totals.gross_sales, null),
    totalExpenses: firstDefined(totals.total_expenses, totals.expenses, null),
    netProfit: firstDefined(totals.net_profit, totals.net, null),
  };
}

export function normalizeYearList(payload = {}) {
  const years = Array.isArray(payload?.years) ? payload.years : [];
  return {
    currentFinancialYear: firstDefined(payload?.current_financial_year, getCurrentFinancialYear()),
    years: years.map((row) => ({
      financialYear: row.financial_year,
      isCurrent: Boolean(row.is_current),
      totals: normalizeMoneyTotals(row),
    })),
  };
}

export function normalizeYearSummary(payload = {}) {
  const months = Array.isArray(payload?.months) ? payload.months : [];
  return {
    financialYear: payload.financial_year,
    startDate: payload.start_date,
    endDate: payload.end_date,
    isClosed: Boolean(payload.is_closed),
    totals: normalizeMoneyTotals(payload.totals),
    highestSalesDay: payload.highest_sales_day || null,
    highestExpenseDay: payload.highest_expense_day || null,
    averageDailySales: firstDefined(payload.average_daily_sales, null),
    workingDays: firstDefined(payload.working_days, null),
    months: months.map((row) => ({
      monthKey: row.month_key,
      label: row.month_label || getMonthLabel(row.month_key),
      status: row.status || null,
      totals: normalizeMoneyTotals(row),
    })),
  };
}

export function normalizeMonthRegister(payload = {}) {
  const summary = payload.summary || {};
  const days = Array.isArray(payload.days) ? payload.days : [];
  return {
    financialYear: payload.financial_year,
    monthKey: payload.month_key,
    label: payload.month_label || getMonthLabel(payload.month_key),
    status: payload.status || null,
    unlockExpiresAt: payload.unlock_expires_at || null,
    summary: {
      ...normalizeMoneyTotals(summary),
      highestSalesDay: summary.highest_sales_day || null,
      highestExpenseDay: summary.highest_expense_day || null,
      averageDailySales: firstDefined(summary.average_daily_sales, null),
      workingDays: firstDefined(summary.working_days, null),
      remainingDays: firstDefined(summary.remaining_days, null),
      vsPreviousMonth: summary.vs_previous_month || null,
    },
    days: days.map((row) => ({
      date: row.date,
      cashSales: firstDefined(row.cash_sales, null),
      upiSales: firstDefined(row.upi_sales, null),
      cardSales: firstDefined(row.card_sales, null),
      creditSales: firstDefined(row.credit_sales, null),
      grossSales: firstDefined(row.gross_sales, null),
      expenses: firstDefined(row.expenses, null),
      net: firstDefined(row.net, null),
      noteCount: firstDefined(row.note_count, 0),
      hasClosing: Boolean(row.has_closing),
    })),
    notes: Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : [],
  };
}

function normalizeNote(row = {}) {
  return {
    id: row.id,
    entryDate: row.entry_date || null,
    text: row.text || "",
    createdByName: firstDefined(row.created_by_name, row.created_by, ""),
    createdAt: row.created_at,
  };
}

export function normalizeDayDetail(payload = {}) {
  return {
    date: payload.date,
    cashSales: firstDefined(payload.cash_sales, null),
    upiSales: firstDefined(payload.upi_sales, null),
    cardSales: firstDefined(payload.card_sales, null),
    creditSales: firstDefined(payload.credit_sales, null),
    grossSales: firstDefined(payload.gross_sales, null),
    expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
    notes: Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : [],
    closing: payload.closing || null,
  };
}

// ---------------------------------------------------------------------------
// API calls
// TODO(backend-integration): every endpoint below is documented in
// docs/REGISTER_BACKEND_SPEC.md but not yet implemented server-side.
// ---------------------------------------------------------------------------

export async function listFinancialYears() {
  const { data } = await api.get("/register/years");
  return normalizeYearList(data);
}

export async function getFinancialYearSummary(financialYear) {
  const { data } = await api.get(`/register/${financialYear}`);
  return normalizeYearSummary(data);
}

export async function getMonthRegister(financialYear, monthKey) {
  const { data } = await api.get(`/register/${financialYear}/${monthKey}`);
  return normalizeMonthRegister(data);
}

export async function getDayDetail(financialYear, monthKey, date) {
  const { data } = await api.get(`/register/${financialYear}/${monthKey}/days/${date}`);
  return normalizeDayDetail(data);
}

// TODO(backend-integration): day entry save endpoint is not documented as a
// single call yet in the spec beyond "day entry save" — using the day-detail
// path with POST per the backend spec's endpoint grouping.
export async function saveDayEntry(financialYear, monthKey, date, payload) {
  const { data } = await api.post(`/register/${financialYear}/${monthKey}/days/${date}`, payload);
  return normalizeDayDetail(data);
}

export async function deleteDayEntry(financialYear, monthKey, date) {
  const { data } = await api.delete(
    `/register/${financialYear}/${monthKey}/days/${date}`
  );
  return data;
}

export async function updateExpense(
  financialYear,
  monthKey,
  date,
  expenseId,
  payload
) {
  const { data } = await api.put(
    `/register/${financialYear}/${monthKey}/days/${date}/expenses/${expenseId}`,
    payload
  );
  return data;
}

export async function deleteExpense(
  financialYear,
  monthKey,
  date,
  expenseId
) {
  const { data } = await api.delete(
    `/register/${financialYear}/${monthKey}/days/${date}/expenses/${expenseId}`
  );
  return data;
}

export async function updateNote(
  financialYear,
  monthKey,
  noteId,
  text
) {
  const { data } = await api.put(
    `/register/${financialYear}/${monthKey}/notes/${noteId}`,
    {
      text,
    }
  );
  return normalizeNote(data);
}

export async function deleteNote(
  financialYear,
  monthKey,
  noteId
) {
  const { data } = await api.delete(
    `/register/${financialYear}/${monthKey}/notes/${noteId}`
  );
  return data;
}

export async function saveExpense(financialYear, monthKey, date, payload) {
  const { data } = await api.post("/expenses", {
    date,
    category: payload.category,
    amount: Number(payload.amount),
    notes: payload.remarks || payload.notes || "",
  });

  return data;
}

export async function updateExpense(
  financialYear,
  monthKey,
  date,
  expenseId,
  payload
) {
  const { data } = await api.put(`/expenses/${expenseId}`, {
    date,
    category: payload.category,
    amount: Number(payload.amount),
    notes: payload.remarks || payload.notes || "",
  });

  return data;
}

export async function deleteExpense(
  financialYear,
  monthKey,
  date,
  expenseId
) {
  const { data } = await api.delete(`/expenses/${expenseId}`);

  return data;
}

export async function addNote(financialYear, monthKey, { entryDate = null, text }) {
  const { data } = await api.post(`/register/${financialYear}/${monthKey}/notes`, {
    entry_date: entryDate,
    text,
  });
  return normalizeNote(data);
}

export async function unlockMonth(financialYear, monthKey, { privacyPassword, reason, durationMinutes = 30 }) {
  const { data } = await api.post(`/register/${financialYear}/${monthKey}/unlock`, {
    privacy_password: privacyPassword,
    reason,
    duration_minutes: durationMinutes,
  });
  return data;
}

export async function lockMonth(financialYear, monthKey) {
  const { data } = await api.post(`/register/${financialYear}/${monthKey}/lock`);
  return data;
}

export async function getMonthAudit(financialYear, monthKey) {
  const { data } = await api.get(`/register/${financialYear}/${monthKey}/audit`);
  return Array.isArray(data) ? data : [];
}

export function formatRegisterError(error) {
  if (!error?.response && (error?.request || error?.message === "Network Error")) {
    return "Register backend is not connected yet.";
  }
  if (error?.response?.status === 404) {
    return "This Register endpoint isn't available on the backend yet.";
  }
  return formatApiError(error);
}
