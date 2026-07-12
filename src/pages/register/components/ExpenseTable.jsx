import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtINR } from "@/lib/api";

const emptyExpense = { category: "", amount: "", remarks: "" };

export default function ExpenseTable({ expenses = [], editable, onAdd, saving }) {
  const [form, setForm] = useState(emptyExpense);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.category.trim() || !(Number(form.amount) > 0)) return;
    await onAdd({ category: form.category, amount: Number(form.amount), remarks: form.remarks });
    setForm(emptyExpense);
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-sm text-slate-400">
                No expenses recorded for this day.
              </TableCell>
            </TableRow>
          ) : (
            expenses.map((expense, index) => (
              <TableRow key={expense.id || index}>
                <TableCell className="font-medium text-slate-700">{expense.category}</TableCell>
                <TableCell className="text-slate-500">{expense.remarks || "—"}</TableCell>
                <TableCell className="text-right font-mono-nums font-semibold text-red-600">
                  {fmtINR(expense.amount)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editable && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-sm border border-dashed border-slate-200 p-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">Category</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Rent, utilities…" className="mt-1 rounded-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">Amount ₹</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 rounded-sm" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">Remarks</Label>
            <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" className="mt-1 rounded-sm" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="w-full rounded-sm bg-red-600 hover:bg-red-700">
              Add expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
