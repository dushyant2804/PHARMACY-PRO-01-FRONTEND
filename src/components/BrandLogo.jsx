import React from "react";

export default function BrandLogo({ compact = false, light = false, hero = false, className = "" }) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""} ${hero ? "brand-logo--hero" : ""} ${light ? "brand-logo--light" : ""} ${className}`} aria-label="PharmacyOS — Manage, Bill, Grow">
      <img src="/pharmacyos-logo.svg" alt="" />
      <div className="brand-logo__type">
        <div className="brand-logo__name"><span>PHARMACY</span><strong>OS</strong></div>
        <div className="brand-logo__tagline"><i />MANAGE <b>•</b> BILL <b>•</b> GROW<i /></div>
        <svg className="brand-logo__pulse" viewBox="0 0 190 14" aria-hidden="true"><path d="M1 7h72l5-4 5 8 6-11 7 14 7-10 5 3h81" /></svg>
      </div>
    </div>
  );
}
