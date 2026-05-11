import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const empty = { name: "", phone: "", email: "", gstin: "", address: "" };

export default function Customers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/customers").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

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

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>GSTIN</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-500">No customers yet.</td></tr>}
            {list.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{c.phone || "—"}</td>
                <td className="text-xs">{c.email || "—"}</td>
                <td className="font-mono text-xs">{c.gstin || "—"}</td>
                <td className="text-right">
                  <Link to={`/ledger/customer/${c.id}`} className="text-blue-600 text-xs hover:underline inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />Ledger
                  </Link>
                  <button onClick={() => { setEditing(c); setForm(c); setOpen(true); }} className="p-1 text-slate-500 hover:text-blue-600 ml-2"><Pencil className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
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
