import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

/**
 * Lightweight autocomplete input.
 * Props:
 *   value: string
 *   onChange: (string, item|null) => void
 *   options: [{value, label, id?}, ...]   (or array of strings)
 *   placeholder, className, testId, required
 */
export default function Autocomplete({
  value = "",
  onChange,
  options = [],
  placeholder = "",
  className = "",
  testId,
  required,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const items = (options || []).map((o) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.value || o.label, label: o.label, id: o.id, raw: o }
  );

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const lowered = (value || "").toLowerCase().trim();
  const filtered = lowered.length >= 1
    ? items.filter((i) => i.label.toLowerCase().includes(lowered)).slice(0, 8)
    : items.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <Input
        type="text"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value, null)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        required={required}
        disabled={disabled}
        data-testid={testId}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-sm shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((it) => (
            <button
              key={it.id || it.value}
              type="button"
              onClick={() => {
                onChange?.(it.label, it.raw || it);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
