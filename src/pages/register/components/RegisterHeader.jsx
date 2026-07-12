import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookMarked, ChevronRight } from "lucide-react";

// crumbs: [{ label, onClick }] — last crumb is the current view (not clickable)
export default function RegisterHeader({ crumbs, onBackToDashboard, actions = null }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBackToDashboard} className="rounded-sm">
          <ArrowLeft className="mr-1 h-4 w-4" />Dashboard
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Financial register</p>
          <h1 className="flex flex-wrap items-center gap-1.5 font-heading text-2xl font-bold md:text-3xl">
            <BookMarked className="h-6 w-6 text-blue-600 shrink-0" />
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {index > 0 && <ChevronRight className="h-5 w-5 text-slate-300" />}
                  {crumb.onClick && !isLast ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className="text-slate-500 hover:text-blue-700 hover:underline"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={isLast ? "text-slate-900" : "text-slate-500"}>{crumb.label}</span>
                  )}
                </React.Fragment>
              );
            })}
          </h1>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
