import api from "./api";

export const EMPTY_CLOSING = {
  cash_sales: "",
  upi_sales: "",
  card_sales: "",
  credit_sales: "",
  expenses: "",
  counted_cash: "",
  notes: "",
  lock_day: false,
};

const amount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export function calculateClosing(closing) {
  const grossSales = amount(closing.cash_sales)
    + amount(closing.upi_sales)
    + amount(closing.card_sales)
    + amount(closing.credit_sales);
  const expenses = amount(closing.expenses);
  const expectedCash = amount(closing.cash_sales) - expenses;
  const expectedTotal = grossSales - expenses;
  const mismatch = amount(closing.counted_cash) - expectedCash;

  return { grossSales, expectedCash, expectedTotal, mismatch };
}

export function getMismatchStatus(mismatch) {
  const value = amount(mismatch);
  if (Math.abs(value) < 0.005) return "balanced";
  return value < 0 ? "shortage" : "excess";
}

export function normalizeClosing(record = {}) {
  const calculations = calculateClosing(record);
  return {
    ...record,
    id: firstDefined(record.id, record.closing_id),
    closing_date: firstDefined(record.closing_date, record.date, ""),
    cash_sales: firstDefined(record.cash_sales, 0),
    upi_sales: firstDefined(record.upi_sales, 0),
    card_sales: firstDefined(record.card_sales, 0),
    credit_sales: firstDefined(record.credit_sales, 0),
    expenses: firstDefined(record.expenses, 0),
    counted_cash: firstDefined(record.counted_cash, 0),
    notes: firstDefined(record.notes, ""),
    locked: Boolean(firstDefined(record.locked, record.is_locked, record.lock_day, false)),
    lock_day: Boolean(firstDefined(record.lock_day, record.locked, record.is_locked, false)),
    grossSales: amount(firstDefined(record.gross_sales, record.grossSales, calculations.grossSales)),
    expectedCash: amount(firstDefined(record.expected_cash, record.expectedCash, calculations.expectedCash)),
    expectedTotal: amount(firstDefined(record.expected_total, record.expectedTotal, calculations.expectedTotal)),
    mismatch: amount(firstDefined(record.mismatch_amount, record.mismatch, calculations.mismatch)),
  };
}

export function normalizeClosings(payload) {
  const records = firstDefined(payload?.items, payload?.daily_closings, payload?.results, payload?.data, payload, []);
  return (Array.isArray(records) ? records : [])
    .map(normalizeClosing)
    .sort((a, b) => b.closing_date.localeCompare(a.closing_date));
}

export function closingPayload(closing) {
  return {
    closing_date: closing.closing_date,
    cash_sales: amount(closing.cash_sales),
    upi_sales: amount(closing.upi_sales),
    card_sales: amount(closing.card_sales),
    credit_sales: amount(closing.credit_sales),
    expenses: amount(closing.expenses),
    counted_cash: amount(closing.counted_cash),
    notes: closing.notes || "",
    lock_day: Boolean(closing.lock_day),
  };
}

export async function listDailyClosings() {
  const response = await api.get("/daily-closings");
  return normalizeClosings(response.data);
}

export async function getDailyClosing(date) {
  const response = await api.get(`/daily-closings/${date}`);
  return normalizeClosing(response.data);
}

export async function createDailyClosing(closing) {
  const response = await api.post("/daily-closings", closingPayload(closing));
  return normalizeClosing({ ...closing, ...response.data });
}

export async function updateDailyClosing(id, closing) {
  const response = await api.put(`/daily-closings/${id}`, closingPayload(closing));
  return normalizeClosing({ ...closing, ...response.data });
}
