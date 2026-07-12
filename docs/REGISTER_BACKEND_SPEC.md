# Financial Register — Backend Implementation Spec

**Target repo:** `PHARMACY-PRO-01` (FastAPI, `server.py`)
**Purpose:** Hand this document to an Agent session opened directly in that Repl. It is a complete, self-contained spec — the backend agent should not need to ask the frontend for clarification to implement it.

**Do not** implement the frontend changes described in the companion plan here — those will be built in the frontend Repl once these endpoints exist and are verified.

---

## 0. Ground truth already confirmed in this codebase (build on it, don't duplicate it)

- `_financial_year_for_date(date) -> "YYYY-YY"`, `_financial_year_date_range(fy)`, `_previous_financial_year`, `_next_financial_year` already exist (used today for distributor ledger, ~line 5941). **Reuse these verbatim** for Register FY math — do not write a second FY calculator.
- `daily_sales` documents already carry `cash_sales`, `upi_sales`, `card_sales`, `outstanding_sales` (credit) per date, normalized by `_normalize_daily_sale`. This is already the day-level sales entry the Register needs — no new "day entry" table.
- `daily_closings` already has `locked`, `expenses`/`total_expenses`, `opening_cash`, `counted_cash`, `expected_cash`, `cash_mismatch`, per `closing_date`. This is the existing cash-reconciliation layer; Register wraps it, does not replace it.
- `expenses` collection already stores per-date expense records.
- `settings` collection already stores `privacy_password_hash` (`_privacy_password_hash`, `set_privacy_password` at ~line 2832) — **reuse this exact password**, do not create a second privacy password.
- Storage is dual-mode: MongoDB (cloud) via `TenantAwareDatabase`, or `LocalSQLiteDatabase` (a generic `(collection, doc_id, data JSON, updated_at)` document store — new collections need **no schema migration**, tables are created on first write). This means new collections (`monthly_registers`, `register_notes`, `register_audit`) work in both modes automatically as long as you go through `db.<collection_name>`, exactly like every other collection in this file.
- Auth: `get_current_user` (Depends), `require_role("admin", ...)` (~line 1230/1266). All new endpoints must use these, matching the pattern of `/daily-closings` and `/daily-sales`.

**Consequence:** because FY/month is 100% derivable from a record's own date field, *no backfill of `daily_sales`, `daily_closings`, or `expenses` is required*. The only new persistent state is (a) lock/unlock status per month, and (b) notes and audit trail. Everything else (day entries, sales splits, expenses) is queried live from the existing collections, filtered by date range.

---

## 1. Core principle (non-negotiable)

**Backend computes every financial number. Frontend only renders what the backend returns.** No endpoint may return a field the frontend is expected to independently recompute (e.g. never return raw per-invoice rows and expect the frontend to sum them for a "total" — the backend returns the total).

---

## 2. New collections

All three follow the same conventions as existing collections: `id: str(uuid4())`, ISO8601 UTC timestamps, tenant-scoped automatically via `TenantAwareDatabase` (same as `db.daily_closings` etc. — don't hand-roll `tenant_id` filtering, use the existing wrapper).

### 2.1 `monthly_registers` — lock/status state (the only "hard" state Register adds)

```
{
  "id": "uuid",
  "financial_year": "2025-26",       # from _financial_year_for_date
  "month_key": "2025-04",            # calendar YYYY-MM the month covers
  "status": "open" | "closed" | "unlocked",
  "auto_closed_at": iso8601 | null,  # when it rolled from open->closed automatically
  "unlocked_by": user_id | null,
  "unlocked_at": iso8601 | null,
  "unlock_reason": str | null,
  "unlock_expires_at": iso8601 | null,
  "created_at": iso8601,
  "updated_at": iso8601
}
```

Unique index: `(financial_year, month_key)` — one doc per month, created lazily on first access (see §4).

**A row is NOT required to exist for status to be well-defined.** If no row exists for a `month_key`:
- `month_key == current calendar month` → effective status `open`
- `month_key < current calendar month` → effective status `closed`
- `month_key > current calendar month` → effective status `open` (future months are not pre-locked; they simply have no entries yet)

A row only needs to be created when something deviates from that default: an explicit early lock, or an unlock. Always resolve through one function, `_resolve_month_status(financial_year, month_key)`, so there is exactly one place this logic lives.

### 2.2 `register_notes`

```
{
  "id": "uuid",
  "financial_year": "2025-26",
  "month_key": "2025-04",
  "entry_date": "2025-04-17" | null,   # null = month-level note, not tied to one day
  "text": str,
  "created_by": user_id,
  "created_by_name": str,
  "created_at": iso8601
}
```
Notes are append-only (no edit/delete endpoint in v1 — matches the audit-first philosophy; if the user wants edit later, that itself becomes an audited action).

### 2.3 `register_audit`

Written **every time** a write happens against a day that belongs to a `closed` or `unlocked`-override month (i.e. any edit that isn't happening in the naturally-open current month). Also written for the unlock/lock events themselves.

```
{
  "id": "uuid",
  "financial_year": "2025-26",
  "month_key": "2025-04",
  "entry_date": "2025-04-17" | null,     # null for unlock/lock/month-level events
  "action": "day_entry_update" | "day_entry_create" | "expense_update" | "month_unlock" | "month_lock" | "note_add",
  "field": str | null,                    # e.g. "cash_sales" — null for structural actions
  "old_value": any | null,
  "new_value": any | null,
  "reason": str | null,                   # required for unlock, optional otherwise
  "changed_by": user_id,
  "changed_by_name": str,
  "changed_at": iso8601
}
```

---

## 3. Locking enforcement (must be server-side, not just UI)

Add one dependency-style helper, used by **every** write endpoint that touches a dated financial record (daily-sales create/update/delete, expenses create/update/delete, daily-closings create/update):

```python
async def _assert_period_writable(entry_date: str, user: dict) -> None:
    fy = _financial_year_for_date(parse_iso_date(entry_date))
    month_key = entry_date[:7]
    status = await _resolve_month_status(fy, month_key)
    if status == "closed":
        raise HTTPException(
            status_code=403,
            detail=f"{month_key} is closed. Unlock it from the Register before editing.",
        )
    # status == "open" or "unlocked" -> allowed
```

Call this at the top of:
- `create_daily_sale`, `update_daily_sale`, `delete_daily_sale`
- `create_daily_closing`, `update_daily_closing`
- expense create/update/delete endpoints

This is what actually differs from today's `daily_closings.locked` flag, which is only checked for admin-vs-non-admin on that one endpoint. After this change, `daily_closings.locked` should be treated as **derived display state** (mirror `_resolve_month_status`) rather than an independent flag — see §7 for how `DailyClosing.jsx`'s existing manual lock interacts with this.

Unlock does not grant unlimited access: `unlock_expires_at` must be checked every time `_resolve_month_status` runs; once expired, status reverts to `closed` automatically (no cron needed — it's checked on read).

---

## 4. Endpoints (new router prefix: `/api/register`)

All require `get_current_user` unless noted. All return JSON only (no HTML).

### `GET /api/register/years`
List every FY that has any data, plus the current FY even if empty.
```json
{
  "current_financial_year": "2025-26",
  "years": [
    {"financial_year": "2025-26", "total_sales": 0, "total_expenses": 0, "net_profit": 0, "is_current": true},
    {"financial_year": "2024-25", "total_sales": 0, "total_expenses": 0, "net_profit": 0, "is_current": false}
  ]
}
```

### `GET /api/register/{financial_year}`
Full FY summary. Validate `financial_year` with the existing `_financial_year_date_range` (reuse — it already raises 400 on bad format).
```json
{
  "financial_year": "2025-26",
  "start_date": "2025-04-01",
  "end_date": "2026-03-31",
  "is_closed": false,
  "totals": {
    "cash_sales": 0, "upi_sales": 0, "card_sales": 0, "credit_sales": 0,
    "gross_sales": 0, "total_expenses": 0, "net_profit": 0
  },
  "highest_sales_day": {"date": "2025-06-14", "amount": 0} | null,
  "highest_expense_day": {"date": "2025-07-02", "amount": 0} | null,
  "average_daily_sales": 0,
  "working_days": 0,
  "months": [
    {
      "month_key": "2025-04", "month_label": "April 2025", "status": "closed",
      "gross_sales": 0, "total_expenses": 0, "net_profit": 0
    }
    // ... all 12, in FY order (Apr..Mar), including future months with zeros
  ]
}
```

### `GET /api/register/{financial_year}/{month_key}`
Month detail + full day list for that month.
```json
{
  "financial_year": "2025-26",
  "month_key": "2025-04",
  "month_label": "April 2025",
  "status": "closed",
  "unlock_expires_at": null,
  "summary": {
    "cash_sales": 0, "upi_sales": 0, "card_sales": 0, "credit_sales": 0,
    "gross_sales": 0, "total_expenses": 0, "net_profit": 0,
    "highest_sales_day": {"date": "...", "amount": 0} | null,
    "highest_expense_day": {"date": "...", "amount": 0} | null,
    "average_daily_sales": 0,
    "working_days": 0, "remaining_days": 0,
    "vs_previous_month": {"gross_sales_delta_pct": 0, "net_profit_delta_pct": 0} | null
  },
  "days": [
    {
      "date": "2025-04-01", "cash_sales": 0, "upi_sales": 0, "card_sales": 0,
      "credit_sales": 0, "gross_sales": 0, "expenses": 0, "net": 0,
      "note_count": 0, "has_closing": true
    }
    // one entry per calendar day of the month
  ],
  "notes": [ /* register_notes with entry_date == null, i.e. month-level */ ]
}
```

### `GET /api/register/{financial_year}/{month_key}/days/{date}`
Single day, including its notes and (if it has one) its `daily_closings` record.

### `POST /api/register/{financial_year}/{month_key}/notes`
Body: `{"entry_date": "2025-04-17" | null, "text": "..."}`. Writes `register_notes`. If the month is `closed`, this still succeeds (notes are not financial data) but also writes a `note_add` audit row for traceability.

### `POST /api/register/{financial_year}/{month_key}/unlock`
Requires `require_role("admin")`. Body: `{"privacy_password": "...", "reason": "...", "duration_minutes": 30}` (`reason` required, min length e.g. 5 chars; cap `duration_minutes` at a sane max, e.g. 120).
- Verify against the **existing** `_privacy_password_hash` (do not add a second password store).
- On success: upsert `monthly_registers` row to `status: "unlocked"`, `unlock_expires_at = now + duration_minutes`, write `register_audit` row `action: "month_unlock"` with `reason`.
- On failure: 401, and (recommended, matches existing patterns elsewhere in this file) count/rate-limit repeated attempts.

### `POST /api/register/{financial_year}/{month_key}/lock`
Requires `require_role("admin")`. Manually re-closes a month before its unlock expires. Writes `register_audit` (`action: "month_lock"`).

### `GET /api/register/{financial_year}/{month_key}/audit`
Requires `require_role("admin")`. Returns `register_audit` rows for that month, newest first.

---

## 5. Wiring audit into existing write endpoints

Whenever `_assert_period_writable` allows a write **because the month is in `unlocked` override state** (not because it's the naturally-open current month), the calling endpoint must also write a `register_audit` row capturing the specific field-level diff (old value → new value) for every changed financial field. Concretely: in `update_daily_sale`, `update_daily_closing`, and the expense update endpoint, when `_resolve_month_status(...) == "unlocked"`, diff `changes` against `existing` field-by-field and insert one `register_audit` row per changed field (or one row with a `changes: [...]` list — pick one shape and use it consistently; a single row with a list of field diffs is simpler to query and is preferred).

Naturally-open-month edits (current month, normal flow) do **not** need audit rows — that would be noise. Audit is specifically for edits to periods that were reopened.

---

## 6. Migration / one-time backfill

Only one thing needs a one-time script, run once at deploy:

**Migrate existing free-text notes into `register_notes`.** Today, notes live inline on `daily_closings.closing_notes`/`notes` and possibly `daily_sales.notes`. Write a one-off script (`scripts/migrate_notes_to_register.py`, following the existing pattern in `scripts/`) that:
1. Iterates all `daily_closings` and `daily_sales` documents with a non-empty note field.
2. For each, computes `financial_year`/`month_key` from its date field.
3. Inserts a `register_notes` row with `entry_date` = that record's date, `text` = the note, `created_by` = the record's `created_by`/`created_at` if available, else `"migration"`/document's `created_at`.
4. Does **not** delete the original note field (non-destructive; leave it in place as a legacy mirror).

No other backfill is needed — FY math is computed on read from existing date fields, and legacy `daily_sales` rows without `card_sales` already default to `0` via `_normalize_daily_sale`/`_money`, which is exactly the spec's requirement.

---

## 7. Unifying the Daily Closing lock with Register (must not break Daily Closing)

`daily_closings.locked` today is an independent boolean checked only in `update_daily_closing` (admin bypass). After this change:
- Keep the `locked` field on the document for backward compatibility (some UI/tests may read it), but **stop treating it as the source of truth**. Set it as a derived mirror: whenever a `daily_closings` document is read or written, set `closing["locked"] = (await _resolve_month_status(fy_of(closing_date), month_key_of(closing_date)) != "open" and status != "unlocked")` i.e. `locked = (status == "closed")`.
- `update_daily_closing`'s existing admin-bypass branch (`if existing.get("locked") and user.get("role") != "admin"`) should be replaced by a call to `_assert_period_writable(existing["closing_date"], user)`, so Daily Closing and Register share exactly one lock authority. This is additive/behavioral, not a schema break — existing tests in `tests/test_daily_closings.py` that check locked-day rejection should still pass (same rejection, now routed through the shared function); re-run that suite after the change.

---

## 8. What must not break

Run the existing test suite (`pytest`) after implementation — every file under `tests/` must still pass, especially `test_daily_sales.py`, `test_daily_closings.py`, `test_dashboard_summary.py`, `test_reports_intelligence.py`, `test_demo_tenant_isolation.py` (tenant isolation must hold for the 3 new collections too), and `test_security_foundation.py` (auth/role checks on the new endpoints). Do not modify `medicines`, `invoices`, `purchase_orders`, `purchase_returns`, `customers`, `distributors`, `stock_adjustments` schemas or endpoints — Register only reads from `daily_sales`/`daily_closings`/`expenses` and adds the 3 new collections above.

Add new tests: `tests/test_register.py` covering:
- FY boundary correctness (Mar 31 vs Apr 1, using the existing `_financial_year_for_date`).
- Default status resolution (past month closed, current month open, future month open) with no `monthly_registers` row present.
- Write rejected (403) on a closed month via `_assert_period_writable`, for each of daily-sales/expenses/daily-closings.
- Unlock: wrong password → 401; correct password → status becomes `unlocked`, expires correctly after `unlock_expires_at`; audit row written.
- Field-level audit rows written correctly on edits during an unlock window; no audit rows written for normal current-month edits.
- Notes: month-level (`entry_date: null`) and day-level notes both retrievable in the right places.
- Tenant isolation: two tenants' `monthly_registers`/`register_notes`/`register_audit` never leak into each other (mirror `test_demo_tenant_isolation.py`'s pattern).

---

## 9. Deliverable checklist for the backend agent

- [ ] `monthly_registers`, `register_notes`, `register_audit` collections added, tenant-scoped like existing collections.
- [ ] `_resolve_month_status`, `_assert_period_writable` implemented once, imported everywhere needed.
- [ ] New `/api/register/*` endpoints implemented exactly as specified in §4 (frontend will be built against these exact shapes — do not rename fields without flagging it back).
- [ ] `_assert_period_writable` wired into daily-sales, daily-closings, expenses write endpoints.
- [ ] `daily_closings.locked` becomes a derived mirror of the shared status (§7).
- [ ] Audit rows written on unlock-window edits (§5) and on unlock/lock/note actions.
- [ ] One-time note migration script written and run (§6).
- [ ] Existing full test suite passes; new `tests/test_register.py` added and passing.
- [ ] No changes to unrelated collections/endpoints (medicines, invoices, purchase orders, purchase returns, customers, distributors, stock adjustments, auth, user management, settings other than the additive audit/lock pieces above).

Once this is deployed, report back the live base URL / confirm `/api/register/*` is reachable so the frontend Register page can be pointed at it.
