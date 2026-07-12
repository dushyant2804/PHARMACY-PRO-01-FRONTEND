# PharmacyOS Frontend

## Overview
React (CRA + craco) frontend for PharmacyOS, a pharmacy management app (inventory, billing, purchase orders/returns, distributors, customers, patients, ledger, reports, settings). Auth via token stored in `localStorage`, axios instance in `src/lib/api.js`, UI built on shadcn-style primitives in `src/components/ui/*` with Tailwind.

**This repo is frontend-only.** The backend (FastAPI + Mongo/SQLite hybrid) lives in a separate Repl (`PHARMACY-PRO-01`, GitHub `dushyant2804/PHARMACY-PRO-01`) and is not edited from here. Backend integration specs written from this repo (e.g. `docs/REGISTER_BACKEND_SPEC.md`) are handoff documents for that other Repl's agent, not implementations.

## Register module
Replaces the old "Daily Sales" page. Structure: Financial Year (Indian FY, Apr–Mar) → Month → Day, with backend-enforced open/closed/future status and a privacy-password unlock flow. Lives at `src/pages/register/` (`RegisterPage`, `YearOverview`, `MonthOverview`, `DayView`, `UnlockDialog`, plus `components/*`) with API/calendar logic in `src/lib/register.js`.

Key rule: the frontend never computes financial totals (sums, gross/net, averages) — those must come from the backend. `src/lib/register.js` only does calendar/FY structure (which months belong to an FY, days-in-month) and API calls; UI shows "—" for any figure the backend hasn't supplied yet. The `/register/*` endpoints it calls are not yet implemented by the backend, so calls fail until that's done — this is expected and handled gracefully (clear "not connected yet" banners, no fabricated numbers).

## User preferences
None recorded yet.
