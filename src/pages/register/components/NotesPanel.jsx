import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { fmtDate } from "@/lib/api";
import {
  updateNote,
  deleteNote,
  formatRegisterError,
} from "@/lib/register";
import { toast } from "sonner";

export default function NotesPanel({
  notes = [],
  editable,
  onAdd,
  onEdit,
  onDelete,
  saving,
  financialYear,
  monthKey,
  onChanged,
}) {
  const [text, setText] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!text.trim()) return;

    await onAdd(text.trim());

    setText("");
  };

  const startEdit = (note) => {
    if (!editable) return;

    setEditingId(note.id);
    setEditingText(note.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async (noteId) => {
    if (!editingText.trim()) {
      toast.error("Note text is required");
      return;
    }

    setSavingEdit(true);

    try {
      await updateNote(
        financialYear,
        monthKey,
        noteId,
        editingText.trim()
      );

      toast.success("Note updated");

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

  const handleDelete = async (note) => {
    if (!editable || deletingId) return;

    const confirmed = window.confirm(
      `Delete this note?\n\n"${note.text}"`
    );

    if (!confirmed) return;

    setDeletingId(note.id);

    try {
      await deleteNote(
        financialYear,
        monthKey,
        note.id
      );

      toast.success("Note deleted");

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
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start gap-2 rounded-sm bg-slate-50 px-3 py-2 text-sm"
            >
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

              <div className="min-w-0 flex-1">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editingText}
                      onChange={(e) =>
                        setEditingText(e.target.value)
                      }
                      className="rounded-sm"
                      autoFocus
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          saveEdit(note.id)
                        }
                        disabled={savingEdit}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Save
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-800">
                      {note.text}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
  {note.entryDate
    ? `Entry: ${fmtDate(note.entryDate)}`
    : "Month note"}
  {note.createdByName ? ` · ${note.createdByName}` : ""}
  {note.createdAt ? ` · Added ${fmtDate(note.createdAt)}` : ""}
</p>
                  </>
                )}
              </div>

              {editable && editingId !== note.id && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      startEdit(note)
                    }
                    disabled={deletingId === note.id}
                    title="Edit note"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() =>
                      handleDelete(note)
                    }
                    disabled={deletingId === note.id}
                    title="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            placeholder="e.g. Medicine shortage today, distributor visit…"
            className="rounded-sm"
          />

          <Button
            type="submit"
            disabled={saving}
            variant="outline"
            className="shrink-0 rounded-sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            {saving ? "Adding…" : "Add note"}
          </Button>
        </form>
      )}
    </div>
  );
}
