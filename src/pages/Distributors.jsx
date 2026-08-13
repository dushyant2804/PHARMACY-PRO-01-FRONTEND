import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { getDistributorBalanceLabel } from "@/lib/sharing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus,
  BookOpen,
  Pencil,
  Search,
  Truck,
  WalletCards,
  ShoppingCart,
  BadgeIndianRupee,
  CircleDollarSign,
  Scale,
  Building2,
  Phone,
  Mail,
  MapPin,
  ReceiptText,
  IndianRupee,
  CheckCircle2,
  Save,
  UserRound
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import useDebouncedValue from "@/hooks/useDebouncedValue";

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
      const payload = { ...form, opening_balance: Number(form.opening_balance || 0) };
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
          <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th>Status</th><th>Last Purchase</th><th className="text-right">Current Balance / Status</th><th></th></tr></thead>
          <tbody>
            {filteredList.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-500">{search ? "No distributors match your search." : "No distributors yet."}</td></tr>}
            {filteredList.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td>{d.phone || "—"}</td>
                <td className="font-mono text-xs">{d.gstin || "—"}</td>
                <td>{getStatus(d) && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(getStatus(d))}`}>{String(getStatus(d)).replace(/[_-]/g, " ")}</span>}</td>
                <td className="whitespace-nowrap text-sm text-slate-600">{formatDate(getLastPurchaseDate(d))}</td>
                <td className="num-cell"><span className={`inline-flex rounded-sm border px-2 py-1 font-semibold ${balanceTone(getCurrentBalance(d))}`}>{fmtINR(getCurrentBalance(d))} · {getDistributorBalanceLabel(getCurrentBalance(d))}</span></td>
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
  <DialogContent
    className="
      w-[calc(100vw-2rem)]
      max-w-4xl
      max-h-[90vh]
      overflow-y-auto
      rounded-2xl
      border-0
      bg-slate-50
      p-0
      shadow-2xl
    "
  >
    {/* HEADER */}
    <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-7 text-white">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 right-32 h-36 w-36 rounded-full bg-white/5" />

      <DialogHeader className="relative">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
            {editing ? (
              <Pencil className="h-7 w-7" />
            ) : (
              <Building2 className="h-7 w-7" />
            )}
          </div>

          <div>
            <DialogTitle className="font-heading text-2xl font-bold text-white sm:text-3xl">
              {editing ? "Edit Distributor" : "Add Distributor"}
            </DialogTitle>

            <p className="mt-1 max-w-xl text-sm text-blue-100">
              {editing
                ? "Update the distributor's business and contact information."
                : "Create a distributor profile for purchases, payments, and ledger tracking."}
            </p>
          </div>
        </div>
      </DialogHeader>
    </div>

    <form onSubmit={save} className="space-y-6 p-6">

      {/* BUSINESS IDENTITY */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Building2 className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Business Identity
            </div>

            <div className="text-xs text-slate-500">
              Basic information about the distributor
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">

          {/* NAME */}
          <div className="md:col-span-2">
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <UserRound className="h-3.5 w-3.5" />
              Distributor Name
            </Label>

            <Input
              value={form.name || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value
                })
              }
              placeholder="Enter distributor / company name"
              required
              className="
                mt-2
                h-12
                rounded-xl
                border-slate-200
                bg-slate-50
                text-base
                font-medium
                focus:bg-white
              "
              data-testid="dist-name"
            />
          </div>

          {/* PHONE */}
          <div>
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Phone className="h-3.5 w-3.5" />
              Phone
            </Label>

            <Input
              value={form.phone || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value
                })
              }
              placeholder="Mobile / phone number"
              className="
                mt-2
                h-12
                rounded-xl
                border-slate-200
                bg-slate-50
                focus:bg-white
              "
              data-testid="dist-phone"
            />
          </div>

          {/* EMAIL */}
          <div>
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>

            <Input
              type="email"
              value={form.email || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value
                })
              }
              placeholder="Email address"
              className="
                mt-2
                h-12
                rounded-xl
                border-slate-200
                bg-slate-50
                focus:bg-white
              "
              data-testid="dist-email"
            />
          </div>
        </div>
      </section>

      {/* BUSINESS DETAILS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <ReceiptText className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Business Details
            </div>

            <div className="text-xs text-slate-500">
              Tax and address information
            </div>
          </div>
        </div>

        <div className="grid gap-5">

          {/* GSTIN */}
          <div>
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <ReceiptText className="h-3.5 w-3.5" />
              GSTIN
            </Label>

            <Input
              value={form.gstin || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  gstin: e.target.value
                })
              }
              placeholder="Enter GSTIN"
              className="
                mt-2
                h-12
                rounded-xl
                border-slate-200
                bg-slate-50
                uppercase
                focus:bg-white
              "
              data-testid="dist-gstin"
            />
          </div>

          {/* ADDRESS */}
          <div>
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <MapPin className="h-3.5 w-3.5" />
              Address
            </Label>

            <Input
              value={form.address || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: e.target.value
                })
              }
              placeholder="Distributor address"
              className="
                mt-2
                h-12
                rounded-xl
                border-slate-200
                bg-slate-50
                focus:bg-white
              "
              data-testid="dist-address"
            />
          </div>
        </div>
      </section>

      {/* OPENING BALANCE */}
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <WalletCards className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-bold uppercase tracking-wider text-amber-900">
                Opening Balance
              </div>

              <div className="mt-1 max-w-xl text-xs leading-5 text-amber-800/80">
                Enter any existing amount already payable to this distributor.
                Leave it at zero if there is no opening balance.
              </div>
            </div>
          </div>

          <div className="w-full sm:w-[260px]">
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
              <IndianRupee className="h-3.5 w-3.5" />
              Opening Amount
            </Label>

            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600">
                ₹
              </span>

              <Input
                type="number"
                step="0.01"
                value={form.opening_balance ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    opening_balance: e.target.value
                  })
                }
                className="
                  h-12
                  rounded-xl
                  border-amber-200
                  bg-white
                  pl-9
                  text-lg
                  font-bold
                  text-slate-900
                "
              />
            </div>
          </div>
        </div>
      </section>

      {/* QUICK SUMMARY */}
      {(form.name || Number(form.opening_balance || 0) !== 0) && (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Distributor Preview
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {form.name || "New Distributor"}
              </div>

              <div className="text-sm text-slate-500">
                {form.phone || "No phone number added"}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Opening Balance
              </div>

              <div className="mt-1 text-2xl font-bold font-mono-nums text-slate-900">
                {fmtINR(Number(form.opening_balance || 0))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">

        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="h-11 rounded-xl px-6"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          className="
            h-11
            rounded-xl
            bg-blue-600
            px-7
            font-semibold
            shadow-sm
            hover:bg-blue-700
          "
        >
          {editing ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save Changes
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Create Distributor
            </>
          )}
        </Button>

      </div>
    </form>
  </DialogContent>
</Dialog>
    </div>
  );
}
