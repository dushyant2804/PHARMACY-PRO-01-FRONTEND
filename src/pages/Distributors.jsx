import React, { useEffect, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = { name: "", phone: "", email: "", address: "", gstin: "", opening_balance: 0 };

export default function Distributors() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/distributors").then((r) => setList(r.data));
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

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th className="text-right">Opening</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">No distributors yet.</td></tr>}
            {list.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td>{d.phone || "—"}</td>
                <td className="font-mono text-xs">{d.gstin || "—"}</td>
                <td className="num-cell">{fmtINR(d.opening_balance)}</td>
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
