import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { getDistributorBalanceLabel } from "@/lib/sharing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil, Search, Truck, WalletCards, ShoppingCart, BadgeIndianRupee, CircleDollarSign, Scale, Mail, MapPin, Phone, Building2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import useDebouncedValue from "@/hooks/useDebouncedValue";

const empty = { name: "", phone: "", email: "", address: "", gstin: "" };

const getCurrentBalance = (distributor) =>
  distributor.current_balance ?? distributor.outstanding_balance ?? 0;

const getStatus = (distributor) => distributor.status || distributor.distributor_status;
const getLastPurchaseDate = (distributor) => distributor.last_purchase_date || distributor.last_purchase_at;
const getTotalPurchases = (distributor) => Number(distributor.total_purchases ?? distributor.purchase_total ?? 0);
const getTotalPaidAdjusted = (distributor) => Number(distributor.total_paid_adjusted ?? distributor.total_paid ?? distributor.paid_total ?? 0);
const getTotalPayable = (distributor) =>
  Number(distributor.total_payable ?? Math.max(0, Number(getCurrentBalance(distributor) || 0)));
const getDistributorReceivable = (distributor) =>
  Number(distributor.total_receivable_from_distributors ?? Math.max(0, -Number(getCurrentBalance(distributor) || 0)));
const getNetDistributorBalance = (distributor) =>
  Number(distributor.net_distributor_balance ?? (getTotalPayable(distributor) - getDistributorReceivable(distributor)));
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const balanceTone = (balance) => {
  if (Number(balance) <= 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (Number(balance) >= 100000) return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};
const statusTone = (status) => {
  const value = String(status || "").toLowerCase().replace(/[_-]/g, " ");
  if (value === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "return heavy") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};
const formFields = ["name", "phone", "email", "gstin", "address"];
const distributorFormData = (distributor = empty) =>
  formFields.reduce((values, field) => ({ ...values, [field]: distributor[field] || "" }), {});

export default function Distributors() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const debouncedSearch = useDebouncedValue(search, 250);

  const load = () => api.get("/distributors").then((r) => setList(Array.isArray(r.data) ? r.data : r.data?.items || r.data?.data || []));
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

    // F4 → Open transaction dialog
    if (e.key === "F4") {
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
      // Opening balance is intentionally not part of this form. Historical
      // ledger opening-balance records remain untouched.
      const payload = distributorFormData(form);
      if (editing) await api.put(`/distributors/${editing.id}`, { ...payload, id: editing.id });
      else await api.post("/distributors", payload);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const filteredList = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return list;
    return list.filter((d) => [d.name, d.phone, d.gstin].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [list, debouncedSearch]);
  const summary = useMemo(() => ({
    payable: list.reduce((sum, d) => sum + getTotalPayable(d), 0),
    receivable: list.reduce((sum, d) => sum + getDistributorReceivable(d), 0),
    netBalance: list.reduce((sum, d) => sum + getNetDistributorBalance(d), 0),
    purchases: list.reduce((sum, d) => sum + getTotalPurchases(d), 0),
    paidAdjusted: list.reduce((sum, d) => sum + getTotalPaidAdjusted(d), 0),
    active: list.filter((d) => String(getStatus(d) || "active").toLowerCase() === "active").length
  }), [list]);
  const cards = [
    { label: "Total Payable", value: fmtINR(summary.payable), icon: WalletCards, tone: "text-red-600" },
    { label: "Total Purchases", value: fmtINR(summary.purchases), icon: ShoppingCart, tone: "text-slate-800" },
    { label: "Total Paid / Adjusted", value: fmtINR(summary.paidAdjusted), icon: BadgeIndianRupee, tone: "text-emerald-600" },
    { label: "Distributor Receivable", value: fmtINR(summary.receivable), icon: CircleDollarSign, tone: "text-emerald-700" },
    { label: "Net Distributor Balance", value: fmtINR(summary.netBalance), icon: Scale, tone: summary.netBalance < 0 ? "text-emerald-700" : "text-slate-800" },
    { label: "Active Distributors", value: summary.active, icon: Truck, tone: "text-slate-800" }
  ];

  return (
    <div className="space-y-6" data-testid="distributors-page">
      <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700"><Truck className="h-4 w-4" /> Suppliers</div>
          <h1 className="mt-1 font-heading text-3xl font-bold text-slate-900 md:text-4xl">Distributors</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">Keep supplier contacts, balances, and ledger access together in one place.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
          className="rounded-xl bg-blue-600 shadow-sm hover:bg-blue-700" data-testid="add-distributor">
          <Plus className="w-4 h-4 mr-2" />Add Distributor
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span><Icon className="h-4 w-4 shrink-0 text-blue-500" /></div>
            <div className={`mt-2 break-words text-xl font-bold font-mono-nums ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-lg rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or GSTIN" className="border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0" data-testid="distributor-search" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredList.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            <Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            {search ? "No distributors match your search." : "No distributors yet."}
          </div>
        )}
        {filteredList.map((d) => {
          const balance = getCurrentBalance(d);
          const status = getStatus(d);
          return (
            <article key={d.id} className="group flex min-h-[285px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
              <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><Building2 className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <h2 className="truncate font-heading text-lg font-bold text-slate-900">{d.name}</h2>
                      {status && <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone(status)}`}>{String(status).replace(/[_-]/g, " ")}</span>}
                    </div>
                  </div>
                  <button type="button" aria-label={`Edit ${d.name}`} onClick={() => { setEditing(d); setForm(distributorFormData(d)); setOpen(true); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex-1 space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex min-w-0 items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><span className="truncate text-slate-600">{d.phone || "No phone"}</span></div>
                  <div className="flex min-w-0 items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" /><span className="truncate text-slate-600">{d.email || "No email"}</span></div>
                  <div className="flex min-w-0 items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><span className="truncate font-mono text-xs text-slate-600">{d.gstin || "No GSTIN"}</span></div>
                  <div className="flex min-w-0 items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span className="truncate text-slate-600">{formatDate(getLastPurchaseDate(d))}</span></div>
                </div>
                <div className={`rounded-xl border p-3 ${balanceTone(balance)}`}>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider"><span>Current balance</span><WalletCards className="h-4 w-4" /></div>
                  <div className="mt-1 font-mono-nums text-xl font-bold">{fmtINR(balance)}</div>
                  <div className="mt-0.5 text-xs font-medium">{getDistributorBalanceLabel(balance)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-slate-500">Total purchases</div><div className="mt-1 font-mono-nums font-bold text-slate-800">{fmtINR(getTotalPurchases(d))}</div></div>
                  <div className="rounded-lg bg-emerald-50 p-2.5"><div className="text-emerald-700">Total paid</div><div className="mt-1 font-mono-nums font-bold text-emerald-700">{fmtINR(getTotalPaidAdjusted(d))}</div></div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3">
                <div className="flex min-w-0 items-start gap-2 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{d.address || "Address not provided"}</span></div>
                <Link to={`/ledger/distributor/${d.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"><BookOpen className="h-3.5 w-3.5" />Ledger</Link>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-blue-100 p-0">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-white">{editing ? "Edit" : "Add"} Distributor</DialogTitle>
              <DialogDescription className="text-blue-100">Add the supplier details your team needs at the counter.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={save} className="space-y-5 p-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-900"><Building2 className="h-4 w-4 text-blue-600" />Business details</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["name", "gstin"].map((k) => (
                  <div key={k} className={k === "name" ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`dist-${k}`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k === "name" ? "Distributor name" : "GSTIN"}</Label>
                    <Input id={`dist-${k}`} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 rounded-xl border-blue-100 bg-white" required={k === "name"} data-testid={`dist-${k}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-cyan-900"><Phone className="h-4 w-4 text-cyan-600" />Contact details</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["phone", "email", "address"].map((k) => (
                  <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`dist-${k}`} className="text-xs font-semibold uppercase tracking-wide text-slate-600">{k === "phone" ? "Phone" : k === "email" ? "Email" : "Address"}</Label>
                    <Input id={`dist-${k}`} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 rounded-xl border-cyan-100 bg-white" data-testid={`dist-${k}`} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-blue-600 shadow-sm hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" />Save Distributor</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
