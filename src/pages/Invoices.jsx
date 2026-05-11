import React, { useEffect, useState } from "react";
import api, { fmtINR, fmtDate } from "@/lib/api";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export default function Invoices() {
  const [invs, setInvs] = useState([]);
  useEffect(() => { api.get("/invoices").then((r) => setInvs(r.data)); }, []);

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">History</div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mt-1">Invoices</h1>
      </div>
      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th><th>Date</th><th>Customer</th><th>Payment</th>
              <th className="text-right">Items</th><th className="text-right">Total</th><th className="text-right">Due</th><th></th>
            </tr>
          </thead>
          <tbody>
            {invs.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-500">No invoices yet.</td></tr>}
            {invs.map((i) => (
              <tr key={i.id} data-testid={`invoice-row-${i.id}`}>
                <td className="font-mono-nums font-semibold text-slate-900">{i.invoice_no}</td>
                <td className="text-xs font-mono-nums">{fmtDate(i.created_at)}</td>
                <td>{i.customer_name}</td>
                <td className="uppercase text-xs tracking-wider">{i.payment_mode}</td>
                <td className="num-cell">{i.items.length}</td>
                <td className="num-cell font-semibold">{fmtINR(i.total)}</td>
                <td className={`num-cell ${i.due_amount > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                  {i.due_amount > 0 ? fmtINR(i.due_amount) : "—"}
                </td>
                <td className="text-right">
                  <Link to={`/invoices/${i.id}`} className="text-blue-600 text-xs hover:underline flex items-center gap-1 justify-end">
                    <FileText className="w-3 h-3" /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
