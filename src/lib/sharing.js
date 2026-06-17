import { fmtDate, fmtINR } from "./api";

export const cleanPhone = (phone) => String(phone || "").replace(/\D/g, "");
export const whatsappUrl = (phone, message) => cleanPhone(phone) ? `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}` : "";

export const getDistributorBalanceLabel = (balance = 0) => {
  const amount = Number(balance || 0);
  if (amount > 0) return "Payable";
  if (amount < 0) return "Receivable";
  return "Settled";
};

export const invoiceShareMessage = (invoice = {}) => [
  `Invoice ${invoice.invoice_no || invoice.invoice_number || ""}`.trim(),
  `Date: ${fmtDate(invoice.invoice_date || invoice.created_at)}`,
  `Total: ${fmtINR(invoice.total)}`,
  Number(invoice.due_amount) > 0 ? `Amount due: ${fmtINR(invoice.due_amount)}` : null,
  "Thank you for choosing us."
].filter(Boolean).join("\n");

export const patientShareMessage = (patient = {}) => [
  `Hello ${patient.name || "there"},`,
  patient.medicine_name ? `This is a friendly reminder about your refill for ${patient.medicine_name}.` : "This is a friendly reminder to check whether your medicines need a refill.",
  "Please contact us when convenient. Thank you."
].join("\n");

export const ledgerShareMessage = ({ type, entity = {}, balance = 0, transactions = [] }) => [
  `Hello ${entity.name || "there"},`,
  type === "customer"
    ? "This is a polite reminder regarding your account statement."
    : `Please find a summary of our ${getDistributorBalanceLabel(balance).toLowerCase()} account statement.`,
  `Current ${type === "customer" ? "balance due" : `${getDistributorBalanceLabel(balance)} Balance`}: ${fmtINR(balance)}`,
  ...(transactions.slice(0, 3).length ? ["Recent entries:", ...transactions.slice(0, 3).map((t) => `• ${fmtDate(t.transaction_date || t.date || t.created_at)} — ${t.display_type || t.type || "Entry"}: ${fmtINR(t.amount)}`)] : []),
  type === "customer" ? "Please contact us if you have any questions. Thank you." : "Please contact us if any statement details need clarification. Thank you."
].join("\n");
