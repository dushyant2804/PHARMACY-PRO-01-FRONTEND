import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil, Search, Truck, WalletCards, ShoppingCart, BadgeIndianRupee, CircleDollarSign, Scale } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = { name: "", phone: "", email: "", address: "", gstin: "", opening_balance: 0 };

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

export default function Distributors() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

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
      const payload = { ...form, opening_balance: Number(form.opening_balance || 0) };
      if (editing) await api.put(`/distributors/${editing.id}`, { ...payload, id: editing.id });
      else await api.post("/distributors", payload);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((d) => [d.name, d.phone, d.gstin].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [list, search]);
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
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">Suppliers</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">Distributors</h1>
        </div>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
          className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-distributor">
          <Plus className="w-4 h-4 mr-2" />Add Distributor
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="min-w-0 rounded-sm border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><span>{label}</span><Icon className="h-4 w-4 shrink-0" /></div>
            <div className={`mt-2 break-words text-xl font-bold font-mono-nums ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or GSTIN" className="rounded-sm bg-white pl-9" data-testid="distributor-search" />
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th>Status</th><th>Last Purchase</th><th className="text-right">Current Balance / Payable</th><th></th></tr></thead>
          <tbody>
            {filteredList.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-500">{search ? "No distributors match your search." : "No distributors yet."}</td></tr>}
            {filteredList.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td>{d.phone || "—"}</td>
                <td className="font-mono text-xs">{d.gstin || "—"}</td>
                <td>{getStatus(d) && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(getStatus(d))}`}>{String(getStatus(d)).replace(/[_-]/g, " ")}</span>}</td>
                <td className="whitespace-nowrap text-sm text-slate-600">{formatDate(getLastPurchaseDate(d))}</td>
                <td className="num-cell"><span className={`inline-flex rounded-sm border px-2 py-1 font-semibold ${balanceTone(getCurrentBalance(d))}`}>{fmtINR(getCurrentBalance(d))}</span></td>
                <td className="text-right">
                  <Link to={`/ledger/distributor/${d.id}`} className="text-blue-600 text-xs hover:underline inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />Ledger
                  </Link>
                  <button onClick={() => { setEditing(d); setForm(d); setOpen(true); }} className="p-1 text-slate-500 hover:text-blue-600 ml-2"><Pencil className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">{editing ? "Edit" : "Add"} Distributor</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {["name", "phone", "email", "gstin", "address"].map((k) => (
              <div key={k}>
                <Label className="text-xs uppercase font-semibold text-slate-600">{k}</Label>
                <Input value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="rounded-sm mt-1" required={k === "name"} data-testid={`dist-${k}`} />
              </div>
            ))}
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Opening balance</Label>
              <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="rounded-sm mt-1" />
            </div>
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
