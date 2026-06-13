import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, fmtDate } from "@/lib/api";
import { getInvoicePaymentStatus, PAYMENT_STATUS } from "@/lib/invoices";
import { Link } from "react-router-dom";
import { Eye, MessageCircle, Search, X } from "lucide-react";

const emptyFilters = { search: "", payment: "all", status: "all", from: "", to: "" };
const invoiceDate = (invoice) => String(invoice.invoice_date || invoice.created_at || "").slice(0, 10);

function StatusBadge({ invoice }) {
  const status = PAYMENT_STATUS[getInvoicePaymentStatus(invoice)];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>;
}

export default function Invoices() {
  const [invs, setInvs] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  useEffect(() => { api.get("/invoices").then((r) => setInvs(Array.isArray(r.data) ? r.data : r.data?.items || [])); }, []);

  const paymentModes = useMemo(() => [...new Set(invs.map((i) => i.payment_mode).filter(Boolean))], [invs]);
  const filtered = useMemo(() => invs.filter((invoice) => {
    const query = filters.search.trim().toLowerCase();
    const haystack = [invoice.invoice_no, invoice.customer_name, invoice.customer_phone].filter(Boolean).join(" ").toLowerCase();
    const date = invoiceDate(invoice);
    return (!query || haystack.includes(query)) &&
      (filters.payment === "all" || invoice.payment_mode === filters.payment) &&
      (filters.status === "all" || getInvoicePaymentStatus(invoice) === filters.status) &&
      (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  }), [invs, filters]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="space-y-5" data-testid="invoices-page">
    <div><div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Bill archive</div><h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Invoices</h1><p className="mt-1 text-sm text-slate-500">Search and retrieve customer bills.</p></div>
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_170px_160px_150px_150px_auto]">
        <label className="relative"><span className="sr-only">Search invoices</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm" placeholder="Invoice number, customer or phone" value={filters.search} onChange={(e) => setFilter("search", e.target.value)}/></label>
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={filters.payment} onChange={(e) => setFilter("payment", e.target.value)}><option value="all">All payment modes</option>{paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
        <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="due">Due / Credit</option></select>
        <input aria-label="From date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={filters.from} onChange={(e) => setFilter("from", e.target.value)}/><input aria-label="To date" type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={filters.to} onChange={(e) => setFilter("to", e.target.value)}/>
        <button className="flex h-10 items-center justify-center gap-1 rounded-md px-3 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setFilters(emptyFilters)}><X className="h-4 w-4"/>Clear</button>
      </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="data-table min-w-[900px]"><thead><tr><th>Invoice</th><th>Customer</th><th>Payment</th><th>Status</th><th className="text-right">Items</th><th className="text-right">Total</th><th className="text-right">Due</th><th className="text-right">Actions</th></tr></thead><tbody>
      {!filtered.length && <tr><td colSpan={8} className="py-14 text-center text-slate-500">{invs.length ? "No invoices match these filters." : "No invoices yet."}</td></tr>}
      {filtered.map((i) => { const wa = `https://wa.me/${String(i.customer_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Invoice ${i.invoice_no} — ${fmtINR(i.total)}`)}`; return <tr key={i.id} data-testid={`invoice-row-${i.id}`}><td><Link to={`/invoices/${i.id}`} className="font-mono-nums font-semibold text-slate-900 hover:text-blue-600">{i.invoice_no}</Link><div className="mt-1 text-xs text-slate-500">{fmtDate(i.invoice_date || i.created_at)}</div></td><td><div className="font-medium text-slate-800">{i.customer_name || "Walk-in customer"}</div>{i.customer_phone && <div className="mt-1 text-xs text-slate-500">{i.customer_phone}</div>}</td><td className="text-xs font-semibold uppercase tracking-wider text-slate-600">{i.payment_mode || "—"}</td><td><StatusBadge invoice={i}/></td><td className="num-cell">{i.items?.length ?? i.item_count ?? "—"}</td><td className="num-cell font-semibold">{fmtINR(i.total)}</td><td className={`num-cell font-semibold ${Number(i.due_amount) > 0 ? "text-red-600" : "text-slate-400"}`}>{Number(i.due_amount) > 0 ? fmtINR(i.due_amount) : "—"}</td><td><div className="flex justify-end gap-1"><Link title="View invoice" to={`/invoices/${i.id}`} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600"><Eye className="h-4 w-4"/></Link>{i.customer_phone && <a title="Share on WhatsApp" href={wa} target="_blank" rel="noreferrer" className="rounded-md p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"><MessageCircle className="h-4 w-4"/></a>}</div></td></tr>; })}
    </tbody></table><div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing {filtered.length} of {invs.length} invoices</div></div>
  </div>;
}
