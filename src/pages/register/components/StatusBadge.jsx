import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, CalendarClock, CircleDot } from "lucide-react";

const CONFIG = {
  open: { label: "Open", className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: CircleDot },
  closed: { label: "Closed", className: "border-slate-300 bg-slate-100 text-slate-700", Icon: Lock },
  unlocked: { label: "Temporarily unlocked", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: Unlock },
  future: { label: "Future", className: "border-slate-200 bg-slate-50 text-slate-400", Icon: CalendarClock },
};

export default function StatusBadge({ status, className = "" }) {
  const config = CONFIG[status] || CONFIG.future;
  const { Icon } = config;
  return (
    <Badge variant="outline" className={`gap-1 rounded-sm font-semibold ${config.className} ${className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
