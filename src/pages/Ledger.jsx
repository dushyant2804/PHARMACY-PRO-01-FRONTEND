import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { fmtINR, fmtDate, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function Ledger() {
  const { type, id } = useParams(); // type: distributor | customer
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [txnType, setTxnType] = useState(type === "distributor" ? "payment" : "payment");
  const [form, setForm] = useState({
    amount: "",
    mode: "cash",
    notes: "",
    date: ""
  });

  const load = async () => {
    const { data } = await api.get(`/ledger/${type}/${id}`);
    setData(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = type === "distributor"
        ? `/ledger/distributor/${id}/${txnType}`
        : `/ledger/customer/${id}/payment`;
      await api.post(endpoint, { amount: Number(form.amount), mode: form.mode, notes: form.notes });
      toast.success("Entry added");
      setOpen(false);
      setForm({ amount: "", mode: "cash", notes: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (!data) return <div className="text-slate-500">Loading…</div>;
  const entity = type === "distributor" ? data.distributor : data.customer;

  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">{type} ledger</div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{entity.name}</h1>
          {entity.phone && <div className="text-sm text-slate-500 mt-1">{entity.phone}</div>}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Balance</div>
          <div className={`font-heading text-3xl font-bold font-mono-nums ${data.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {fmtINR(data.balance)}
          </div>
          <div className="text-xs text-slate-500">
            {type === "distributor" ? "Payable" : "Receivable"}
          </div>
        </div>
      </div>

      <Button onClick={() => setOpen(true)} className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="add-txn">
        <Plus className="w-4 h-4 mr-2" />Add Transaction
      </Button>

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Reference / Notes</th><th>Mode</th><th className="text-right">Amount</th><th className="text-right">Running Balance</th></tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No transactions yet.</td></tr>}
            {data.transactions.map((t) => (
              <tr key={t.id}>
                <td className="font-mono-nums text-xs">{fmtDate(t.created_at)}</td>
                <td className="uppercase text-xs tracking-wider font-semibold">{t.type}</td>
                <td>{t.reference || t.notes || "—"}</td>
                <td className="text-xs uppercase">{t.mode || "—"}</td>
                <td className={`num-cell font-semibold ${t.type === "payment" ? "text-emerald-600" : "text-slate-800"}`}>
                  {t.type === "payment" ? "−" : "+"}{fmtINR(t.amount)}
                </td>
                <td className="num-cell">{fmtINR(t.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle className="font-heading">New Transaction</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {type === "distributor" && (
              <div>
                <Label className="text-xs uppercase font-semibold text-slate-600">Type</Label>
                <Select value={txnType} onValueChange={setTxnType}>
                  <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase (+)</SelectItem>
                    <SelectItem value="payment">Payment to supplier (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Amount</Label>
              <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-sm mt-1" data-testid="txn-amount" />
            </div>
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Mode</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase font-semibold text-slate-600">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-sm mt-1" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-sm">Cancel</Button>
              <Button type="submit" className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="save-txn">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
