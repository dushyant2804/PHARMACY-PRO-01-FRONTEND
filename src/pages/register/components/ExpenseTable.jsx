import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { fmtINR } from "@/lib/api";

const emptyExpense = {
  category: "",
  amount: "",
  remarks: "",
};

export default function ExpenseTable({
  expenses = [],
  editable,
  onAdd,
  onEdit,
  onDelete,
  saving,
}) {
  const [form, setForm] = useState(emptyExpense);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyExpense);
  const [actionId, setActionId] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!form.category.trim() || !(Number(form.amount) > 0)) {
      return;
    }

    await onAdd({
      category: form.category.trim(),
      amount: Number(form.amount),
      remarks: form.remarks.trim(),
    });

    setForm(emptyExpense);
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setEditingForm({
      category: expense.category || "",
      amount: expense.amount ?? "",
      remarks: expense.remarks || expense.notes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingForm(emptyExpense);
  };

  const saveEdit = async (expenseId) => {
    if (
      !editingForm.category.trim() ||
      !(Number(editingForm.amount) > 0)
    ) {
      return;
    }

    setActionId(expenseId);

    try {
      await onEdit(expenseId, {
        category: editingForm.category.trim(),
        amount: Number(editingForm.amount),
        remarks: editingForm.remarks.trim(),
      });

      setEditingId(null);
      setEditingForm(emptyExpense);
    } finally {
      setActionId(null);
    }
  };

  const removeExpense = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) {
      return;
    }

    setActionId(expenseId);

    try {
      await onDelete(expenseId);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {editable && (
              <TableHead className="w-[90px] text-right">
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={editable ? 4 : 3}
                className="text-center text-sm text-slate-400"
              >
                No expenses recorded for this day.
              </TableCell>
            </TableRow>
          ) : (
            expenses.map((expense, index) => {
              const isEditing = editingId === expense.id;
              const busy = actionId === expense.id;

              return (
                <TableRow key={expense.id || index}>
                  {isEditing ? (
                    <>
                      <TableCell>
                        <Input
                          value={editingForm.category}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              category: e.target.value,
                            })
                          }
                          className="rounded-sm"
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          value={editingForm.remarks}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              remarks: e.target.value,
                            })
                          }
                          className="rounded-sm"
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingForm.amount}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              amount: e.target.value,
                            })
                          }
                          className="rounded-sm text-right"
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => saveEdit(expense.id)}
                            title="Save expense"
                          >
                            <Check className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={cancelEdit}
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium text-slate-700">
                        {expense.category}
                      </TableCell>

                      <TableCell className="text-slate-500">
                        {expense.remarks || expense.notes || "—"}
                      </TableCell>

                      <TableCell className="text-right font-mono-nums font-semibold text-red-600">
                        {fmtINR(expense.amount)}
                      </TableCell>

                      {editable && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={busy}
                              onClick={() => startEdit(expense)}
                              title="Edit expense"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              disabled={busy}
                              onClick={() =>
                                removeExpense(expense.id)
                              }
                              title="Delete expense"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {editable && (
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 rounded-sm border border-dashed border-slate-200 p-3 sm:grid-cols-4"
        >
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">
              Category
            </Label>

            <Input
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value,
                })
              }
              placeholder="Rent, utilities…"
              className="mt-1 rounded-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">
              Amount ₹
            </Label>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value,
                })
              }
              className="mt-1 rounded-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">
              Remarks
            </Label>

            <Input
              value={form.remarks}
              onChange={(e) =>
                setForm({
                  ...form,
                  remarks: e.target.value,
                })
              }
              placeholder="Optional"
              className="mt-1 rounded-sm"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={saving}
              className="w-full rounded-sm bg-red-600 hover:bg-red-700"
            >
              Add expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
