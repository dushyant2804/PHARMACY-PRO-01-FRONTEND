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
import { fmtINR } from "@/lib/api";
import {
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  updateExpense,
  deleteExpense,
  formatRegisterError,
} from "@/lib/register";
import { toast } from "sonner";

const emptyExpense = {
  category: "",
  amount: "",
  remarks: "",
};

export default function ExpenseTable({
  expenses = [],
  editable,
  onAdd,
  saving,
  financialYear,
  monthKey,
  date,
  onChanged,
}) {
  const [form, setForm] = useState(emptyExpense);

  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyExpense);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!form.category.trim() || !(Number(form.amount) > 0)) {
      return;
    }

    await onAdd({
      category: form.category,
      amount: Number(form.amount),
      remarks: form.remarks,
    });

    setForm(emptyExpense);
  };

  const startEdit = (expense) => {
    if (!editable) return;

    setEditingId(expense.id);

    setEditingForm({
      category: expense.category || "",
      amount: expense.amount ?? "",
      remarks: expense.remarks ?? expense.notes ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingForm(emptyExpense);
  };

  const saveEdit = async (expenseId) => {
    if (!editingForm.category.trim() || !(Number(editingForm.amount) > 0)) {
      toast.error("Enter a valid category and amount");
      return;
    }

    setSavingEdit(true);

    try {
      await updateExpense(
        financialYear,
        monthKey,
        date,
        expenseId,
        {
          category: editingForm.category.trim(),
          amount: Number(editingForm.amount),
          remarks: editingForm.remarks,
        }
      );

      toast.success("Expense updated");

      cancelEdit();

      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (expense) => {
    if (!editable || deletingId) return;

    const confirmed = window.confirm(
      `Delete this expense?\n\n${expense.category} — ${fmtINR(expense.amount)}`
    );

    if (!confirmed) return;

    setDeletingId(expense.id);

    try {
      await deleteExpense(
        financialYear,
        monthKey,
        date,
        expense.id
      );

      toast.success("Expense deleted");

      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      toast.error(formatRegisterError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="text-right">
              Amount
            </TableHead>

            {editable && (
              <TableHead className="text-right">
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
            expenses.map((expense, index) => (
              <TableRow key={expense.id || index}>
                {editingId === expense.id ? (
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
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            saveEdit(expense.id)
                          }
                          disabled={savingEdit}
                          title="Save expense"
                        >
                          <Check className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={savingEdit}
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
                      {expense.remarks ||
                        expense.notes ||
                        "—"}
                    </TableCell>

                    <TableCell className="text-right font-mono-nums font-semibold text-red-600">
                      {fmtINR(expense.amount)}
                    </TableCell>

                    {editable && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              startEdit(expense)
                            }
                            title="Edit expense"
                            disabled={deletingId === expense.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() =>
                              handleDelete(expense)
                            }
                            title="Delete expense"
                            disabled={deletingId === expense.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))
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
              {saving ? "Adding…" : "Add expense"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
