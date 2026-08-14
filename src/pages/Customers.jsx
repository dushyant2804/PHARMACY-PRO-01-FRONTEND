import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil, Search, WalletCards, ShoppingBag, CircleDollarSign, Users, Mail, MapPin, Phone, UserRound, Tag } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import useDebouncedValue from "@/hooks/useDebouncedValue";

const empty = { name: "", phone: "", email: "", gstin: "", address: "" };

export default function Customers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const customerBalance = (customer) => Number(customer.receivable_balance ?? customer.outstanding_balance ?? customer.balance ?? customer.amount_due ?? 0);
  const customerSales = (customer) => Number(customer.total_sales ?? customer.sales_total ?? 0);
  const customerPaid = (customer) => Number(customer.total_paid ?? customer.paid_total ?? 0);
  const filteredList = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return list;
    return list.filter((customer) => [customer.name, customer.phone, customer.email, customer.gstin]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [list, debouncedSearch]);
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
      <div className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-700"><Users className="h-4 w-4" /> Buyers</div>
          <h1 className="mt-1 font-heading text-3xl font-bold text-slate-900 md:text-4xl">Customers</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">See customer contact details and receivables at a glance.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
          className="rounded-xl bg-violet-600 shadow-sm hover:bg-violet-700" data-testid="add-customer">
          <Plus className="w-4 h-4 mr-2" />Add Customer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{ label: "Total Receivable", value: fmtINR(summary.receivable), icon: WalletCards, tone: "text-red-700" }, { label: "Total Sales", value: fmtINR(summary.sales), icon: ShoppingBag, tone: "text-slate-800" }, { label: "Total Paid", value: fmtINR(summary.paid), icon: CircleDollarSign, tone: "text-emerald-700" }, { label: "Customers With Due", value: summary.withDue, icon: Users, tone: "text-amber-700" }].map((item) => <div key={item.label} className="rounded-sm border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><item.icon className="h-4 w-4" />{item.label}</div><div className={`mt-2 text-xl font-bold font-mono-nums ${item.tone}`}>{item.value}</div></div>)}
      </div>

       <div className="relative max-w-xl rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, or GSTIN" className="border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0" /></div>

       <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
         {filteredList.length === 0 && (
           <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
             <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
             {search ? "No customers match your search." : "No customers yet."}
           </div>
         )}
         {filteredList.map((c) => {
           const balance = customerBalance(c);
           const status = paymentStatus(c);
           const customerType = c.customer_type || c.type;
           return (
             <article key={c.id} className="group flex min-h-[285px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg">
               <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4">
                 <div className="flex items-start justify-between gap-3">
                   <div className="flex min-w-0 items-center gap-3">
                     <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm"><UserRound className="h-5 w-5" /></div>
                     <div className="min-w-0">
                       <h2 className="truncate font-heading text-lg font-bold text-slate-900">{c.name}</h2>
                       {customerType && <span className="mt-1 inline-flex rounded-full border border-violet-200 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">{customerType}</span>}
                     </div>
                   </div>
                   <button type="button" aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c); setForm(c); setOpen(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-violet-600"><Pencil className="h-4 w-4" /></button>
                 </div>
               </div>
               <div className="flex-1 space-y-4 p-4">
                 <div className="grid grid-cols-2 gap-3 text-sm">
                   <div className="flex min-w-0 items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><span className="truncate text-slate-600">{c.phone || "No phone"}</span></div>
                   <div className="flex min-w-0 items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" /><span className="truncate text-slate-600">{c.email || "No email"}</span></div>
                   <div className="flex min-w-0 items-start gap-2"><Tag className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><span className="truncate font-mono text-xs text-slate-600">{c.gstin || "No GSTIN"}</span></div>
                 </div>
                 <div className={`rounded-xl border p-3 ${balanceTone(balance)}`}>
                   <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider"><span>Receivable balance</span><WalletCards className="h-4 w-4" /></div>
                   <div className="mt-1 font-mono-nums text-xl font-bold">{fmtINR(balance)}</div>
                   <div className="mt-0.5 text-xs font-medium">{status.label}</div>
                 </div>
                 <div className="grid grid-cols-2 gap-3 text-xs">
                   <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-slate-500">Total sales</div><div className="mt-1 font-mono-nums font-bold text-slate-800">{fmtINR(customerSales(c))}</div></div>
                   <div className="rounded-lg bg-emerald-50 p-2.5"><div className="text-emerald-700">Total paid</div><div className="mt-1 font-mono-nums font-bold text-emerald-700">{fmtINR(customerPaid(c))}</div></div>
                 </div>
               </div>
               <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3">
                 <div className="flex min-w-0 items-start gap-2 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{c.address || "Address not provided"}</span></div>
                 <Link to={`/ledger/customer/${c.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"><BookOpen className="h-3.5 w-3.5" />Ledger</Link>
               </div>
             </article>
           );
         })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-violet-100 p-0">
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-white">{editing ? "Edit" : "Add"} Customer</DialogTitle>
              <DialogDescription className="text-violet-100">Create a clear customer profile for billing and ledger follow-up.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={save} className="space-y-5 p-6">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-900"><UserRound className="h-4 w-4 text-violet-600" />Customer details</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["name", "gstin"].map((k) => (
                  <div key={k} className={k === "name" ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`cust-${k}`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k === "name" ? "Customer name" : "GSTIN"}</Label>
                    <Input id={`cust-${k}`} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 rounded-xl border-violet-100 bg-white" required={k === "name"} data-testid={`cust-${k}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-fuchsia-900"><Phone className="h-4 w-4 text-fuchsia-600" />Contact details</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["phone", "email", "address"].map((k) => (
                  <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`cust-${k}`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k === "phone" ? "Phone" : k === "email" ? "Email" : "Address"}</Label>
                    <Input id={`cust-${k}`} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 rounded-xl border-fuchsia-100 bg-white" data-testid={`cust-${k}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-violet-600 shadow-sm hover:bg-violet-700"><Plus className="mr-2 h-4 w-4" />Save Customer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
