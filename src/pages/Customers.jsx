import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil, Search, WalletCards, ShoppingBag, CircleDollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = { name: "", phone: "", email: "", gstin: "", address: "" };

export default function Customers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const customerBalance = (customer) => Number(customer.receivable_balance ?? customer.outstanding_balance ?? customer.balance ?? customer.amount_due ?? 0);
  const customerSales = (customer) => Number(customer.total_sales ?? customer.sales_total ?? 0);
  const customerPaid = (customer) => Number(customer.total_paid ?? customer.paid_total ?? 0);
  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((customer) => [customer.name, customer.phone, customer.email, customer.gstin]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [list, search]);
  const summary = useMemo(() => ({
    receivable: list.reduce((sum, customer) => sum + customerBalance(customer), 0),
    sales: list.reduce((sum, customer) => sum + customerSales(customer), 0),
    paid: list.reduce((sum, customer) => sum + customerPaid(customer), 0),
    withDue: list.filter((customer) => customerBalance(customer) > 0).length
  }), [list]);
  const balanceTone = (balance) => balance <= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : balance < 1000 ? "text-amber-700 bg-amber-50 border-amber-100" : "text-red-700 bg-red-50 border-red-100";
  const paymentStatus = (customer) => {
    const balance = customerBalance(customer);
    if (balance <= 0) return { label: "Cleared", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (customerPaid(customer) > 0) return { label: "Partial", tone: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: "Due", tone: "bg-red-50 text-red-700 border-red-200" };
  };

  const load = () => api.get("/customers").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => {
  const handleKeyDown = (e) => {
    const tag = document.activeElement.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA"
    ) {
      return;
    }

    // F3 → Open customer transaction
    if (e.key === "F3") {
      e.preventDefault();
      setOpen(true);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/customers/${editing.id}`, { ...form, id: editing.id });
      else await api.post("/customers", form);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Buyers</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">Customers</h1>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
          className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-customer">
          <Plus className="w-4 h-4 mr-2" />Add Customer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{ label: "Total Receivable", value: fmtINR(summary.receivable), icon: WalletCards, tone: "text-red-700" }, { label: "Total Sales", value: fmtINR(summary.sales), icon: ShoppingBag, tone: "text-slate-800" }, { label: "Total Paid", value: fmtINR(summary.paid), icon: CircleDollarSign, tone: "text-emerald-700" }, { label: "Customers With Due", value: summary.withDue, icon: Users, tone: "text-amber-700" }].map((item) => <div key={item.label} className="rounded-sm border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><item.icon className="h-4 w-4" />{item.label}</div><div className={`mt-2 text-xl font-bold font-mono-nums ${item.tone}`}>{item.value}</div></div>)}
      </div>

      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, or GSTIN" className="rounded-sm bg-white pl-9" /></div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Contact</th><th>GSTIN</th><th>Status</th><th className="text-right">Receivable Balance</th><th></th></tr></thead>
          <tbody>
            {filteredList.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">{search ? "No customers match your search." : "No customers yet."}</td></tr>}
            {filteredList.map((c) => {
              const balance = customerBalance(c); const status = paymentStatus(c); const customerType = c.customer_type || c.type;
              return (<tr key={c.id}>
                <td><div className="font-medium">{c.name}</div>{customerType && <span className="mt-1 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">{customerType}</span>}</td>
                <td><div>{c.phone || "—"}</div><div className="text-xs text-slate-500">{c.email || "—"}</div></td>
                <td className="font-mono text-xs">{c.gstin || "—"}</td>
                <td><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.tone}`}>{status.label}</span></td>
                <td className="text-right"><span className={`inline-flex rounded-sm border px-2.5 py-1 font-mono-nums font-bold ${balanceTone(balance)}`}>{fmtINR(balance)}</span></td>
                <td className="text-right">
                  <Link to={`/ledger/customer/${c.id}`} className="text-blue-600 text-xs hover:underline inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />Ledger
                  </Link>
                  <button onClick={() => { setEditing(c); setForm(c); setOpen(true); }} className="p-1 text-slate-500 hover:text-blue-600 ml-2"><Pencil className="w-4 h-4" /></button>
                </td>
              </tr>);
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit" : "Add"} Customer</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {["name", "phone", "email", "gstin", "address"].map((k) => (
              <div key={k}>
                <Label className="text-xs uppercase font-semibold text-slate-600">{k}</Label>
                <Input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="rounded-sm mt-1" required={k === "name"} data-testid={`cust-${k}`} />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancel</Button>
              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
