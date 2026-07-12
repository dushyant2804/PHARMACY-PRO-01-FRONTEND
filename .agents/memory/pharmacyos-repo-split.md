---
name: PharmacyOS repo split
description: This frontend Repl and the PharmacyOS backend are separate Repls; how to hand off backend work.
---

This Repl contains only the React (CRA/craco) frontend for PharmacyOS. The backend (FastAPI +
Mongo/SQLite hybrid) lives in a different Repl (`PHARMACY-PRO-01`, GitHub `dushyant2804/PHARMACY-PRO-01`).

**Why:** the two were built as separate Repls/environments; there is no live connection or shared
filesystem between them from this session, and no backend runs in this container. Login, demo login,
and any `/api/*` call will fail here unless `REACT_APP_BACKEND_URL` points at a reachable deployed
backend.

**How to apply:** when a task needs backend changes (new endpoints, schema, business logic), do not
invent or fake them here. Write a spec document in this repo (e.g. `docs/*_BACKEND_SPEC.md`) describing
the exact contract, informed by read-only inspection of the backend repo if accessible, and hand it off
for a separate agent session in the backend Repl to implement. Frontend code that depends on such
endpoints should call the documented real paths and degrade gracefully (clear "not connected yet"
messaging) rather than mocking data — the calls will genuinely fail until the other Repl implements them.
