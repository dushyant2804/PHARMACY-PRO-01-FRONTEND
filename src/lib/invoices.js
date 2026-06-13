export const getInvoicePaymentStatus = (invoice = {}) => {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid_amount || 0);
  const due = Number(invoice.due_amount || 0);

  if (due > 0 && paid > 0 && paid < total) return "partial";
  if (due > 0 || (total > 0 && paid <= 0)) return "due";
  return "paid";
};

export const PAYMENT_STATUS = {
  paid: { label: "Paid", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  partial: { label: "Partial", className: "border-amber-200 bg-amber-50 text-amber-700" },
  due: { label: "Due / Credit", className: "border-red-200 bg-red-50 text-red-700" },
};

export const getInvoiceProfit = (invoice = {}) => {
  const profit = invoice.profit ?? invoice.gross_profit ?? invoice.estimated_profit;
  const margin = invoice.margin ?? invoice.profit_margin ?? invoice.margin_percent;
  return {
    profit: profit == null ? null : Number(profit),
    margin: margin == null ? null : Number(margin),
  };
};
