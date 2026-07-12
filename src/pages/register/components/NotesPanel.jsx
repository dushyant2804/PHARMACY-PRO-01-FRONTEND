import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StickyNote, Plus } from "lucide-react";
import { fmtDate } from "@/lib/api";

// Renders a list of (possibly multiple) notes plus an add-note form.
// Notes never carry financial values — text only.
export default function NotesPanel({ notes = [], editable, onAdd, saving }) {
  const [text, setText] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    await onAdd(text.trim());
    setText("");
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2 rounded-sm bg-slate-50 px-3 py-2 text-sm">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-slate-800">{note.text}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {note.createdByName ? `${note.createdByName} · ` : ""}{fmtDate(note.createdAt)}
                </p>
              </div>
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
          <Button type="submit" disabled={saving} variant="outline" className="shrink-0 rounded-sm">
            <Plus className="mr-1 h-4 w-4" />Add note
          </Button>
        </form>
      )}
    </div>
  );
}
