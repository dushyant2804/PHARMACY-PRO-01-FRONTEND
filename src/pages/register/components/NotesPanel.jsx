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

export default function NotesPanel({
  notes = [],
  editable,
  onAdd,
  onEdit,
  onDelete,
  saving,
}) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [actionId, setActionId] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!text.trim()) return;

    await onAdd(text.trim());
    setText("");
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditingText(note.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async (noteId) => {
    const value = editingText.trim();

    if (!value) return;

    setActionId(noteId);

    try {
      await onEdit(noteId, value);
      setEditingId(null);
      setEditingText("");
    } finally {
      setActionId(null);
    }
  };

  const removeNote = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;

    setActionId(noteId);

    try {
      await onDelete(noteId);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-sm bg-slate-50 px-3 py-2 text-sm"
            >
              {editingId === note.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="rounded-sm"
                    autoFocus
                  />

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionId === note.id}
                    onClick={() => saveEdit(note.id)}
                    title="Save note"
                  >
                    <Check className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actionId === note.id}
                    onClick={cancelEdit}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800">{note.text}</p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {note.entryDate
                        ? `Entry: ${fmtDate(note.entryDate)}`
                        : "Month note"}
                      {note.createdByName
                        ? ` · ${note.createdByName}`
                        : ""}
                      {note.createdAt
                        ? ` · Added ${fmtDate(note.createdAt)}`
                        : ""}
                    </p>
                  </div>

                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        disabled={actionId === note.id}
                        onClick={() => startEdit(note)}
                        title="Edit note"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        disabled={actionId === note.id}
                        onClick={() => removeNote(note.id)}
                        title="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
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
            onChange={(e) => setText(e.target.value)}
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
            Add note
          </Button>
        </form>
      )}
    </div>
  );
}
