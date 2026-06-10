import React from "react";

export default function BrandLogo({ compact = false, light = false, className = "" }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} aria-label="PharmacyOS">
      <img src="/pharmacyos-logo.svg" alt="" className={`${compact ? "h-9 w-9" : "h-11 w-11"} drop-shadow-lg`} />
      <div className="leading-none">
        <div className={`font-heading font-extrabold tracking-tight ${compact ? "text-base" : "text-xl"} ${light ? "text-white" : "text-slate-950"}`}>
          Pharmacy<span className="text-emerald-500">OS</span>
        </div>
        <div className={`mt-1 text-[8px] font-semibold uppercase tracking-[0.28em] ${light ? "text-amber-200/70" : "text-amber-700"}`}>Precision care platform</div>
      </div>
    </div>
  );
}
