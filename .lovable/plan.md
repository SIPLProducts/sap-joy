## Goal

Make the **Active Plant** the single source of truth across the app — UI screens, manual SAP sync, the 5-min background scheduler, and backend RLS — so users never see or sync data for plants they're not working in.

## Scope (expanded per user direction)

1. UI screens scoped to Active Plant
2. Manual SAP sync scoped to Active Plant
3. Background 5-min scheduler scoped to actively-used plants
4. Backend RLS hardened to enforce plant boundaries
5. Other screens (Worklist, Pending Actions, Dashboards) also scoped

---

## 1. UI screens scoped to Active Plant (always)

In these contexts, drop the role-based gate and always filter by `profile.plant`. Re-fetch on plant switch:

- `src/contexts/InwardMRBContext.tsx`
- `src/contexts/InwardInProcessMRBContext.tsx`
- `src/contexts/MRBContext.tsx` (used by Worklist, Pending Actions, Dashboards)

Effect: Inward, In-Process, Worklist, Pending Actions and all role dashboards instantly narrow to the active plant for every user, including admin/executive.

The in-page Plant multi-select on Inward / In-Process becomes a no-op (single plant in data) — hide it when only one plant is present.

## 2. Manual SAP sync scoped to Active Plant

### MRB - Inward Materials & MRB In-Process Materials

Change the **Refresh Data** button on `InwardReport.tsx` and `InwardInProcessReport.tsx`:

- Resolve the active SAP config that maps to `inward_inspection_lots` (plus the In-Process equivalent — its config is identified by `config_name` containing "process").
- Call `invokeSapSync({ action: 'fetch_and_store', config_id, search_params: { WERKS: profile.plant, ART: '01' | '04' } })`.
- Then re-run `refreshData()` to reload from DB.
- Show toasts: "Syncing plant {WERKS}…" → success (records inserted/updated) → failure. Disable button while running.

### Shop Floor – Material Blocking

In `ShopFloorStockSelection.tsx`:
- Initialize `selectedPlant` from `profile.plant`; reset whenever Active Plant changes.
- MB52 already sends `WERKS: selectedPlant`, so SAP returns only that plant's stock. No backend change needed.
- For non-admin users, lock the Plant dropdown to the Active Plant (read-only).

## 3. Background 5-min auto-sync scoped to actively used plants

Currently `sap-sync-scheduler` iterates `sap_api_config.scheduler_plants` (a per-config JSON array). This works but is decoupled from real usage and can drift.

Change:
- Compute the **effective plant set** at run time as the union of:
  - `sap_api_config.scheduler_plants` (admin override list — stays authoritative when set), AND
  - `SELECT DISTINCT plant FROM user_plants` (plants assigned to at least one active user).
- If `scheduler_plants` is non-empty, intersect with the `user_plants` set so disabled / unassigned plants aren't synced.
- If `scheduler_plants` is empty, fall back to the `user_plants` set instead of skipping.
- Skip plants with zero assigned users — no point pulling SAP data nobody can see.
- Per-plant sync history rows continue to be written (already in place).

This guarantees the scheduler never syncs a plant that no user is working in, and automatically follows whatever plants the admin assigns going forward.

### New admin UI

In `SAPApiSettings.tsx`, add a small "Active Plants for Scheduler" panel showing:
- Plants currently assigned to users (read-only, sourced from `user_plants`).
- The intersected list that the next scheduler run will actually process.

## 4. Backend / RLS hardening (plant isolation)

Today the RLS on `mrb_records`, `inward_inspection_lots`, `shop_floor_stock`, `mrb_attachments`, `mrb_approval_history` allows any authenticated user to read every row regardless of plant. We will tighten SELECT (and where appropriate INSERT/UPDATE) so users only see rows whose `plant` is in their `user_plants` set, with admin/executive bypass.

### New SECURITY DEFINER helpers (migration)

```sql
-- Returns true if the user is assigned to the given plant.
create or replace function public.user_has_plant(_user_id uuid, _plant text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_plants where user_id = _user_id and plant_code = _plant
  ) or public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'executive');
$$;
```

### Policy rewrites (migration)

For each of these tables, replace the current "anyone authenticated can SELECT" policy with one gated by `public.user_has_plant(auth.uid(), plant)`:

- `mrb_records` — SELECT, UPDATE WITH CHECK
- `inward_inspection_lots` — SELECT, INSERT WITH CHECK, UPDATE
- `shop_floor_stock` — SELECT, INSERT WITH CHECK, UPDATE
- `mrb_attachments` — SELECT (joined via `mrb_records.plant`)
- `mrb_approval_history` — SELECT (joined via `mrb_records.plant`)
- `zmrb_inward_report` — SELECT, INSERT, UPDATE

Admin/executive bypass is built into `user_has_plant`, so existing admin tooling keeps working.

### Edge functions

- `sap-sync` (manual fetch from screens) — accepts `search_params.WERKS` from the client; verify the caller is assigned to that plant before calling SAP. Reject with `{ ok: false, error: 'plant_not_assigned' }` (HTTP 200 per project convention) if not.
- `sap-sync-scheduler` — uses service role, so no per-user check; it relies on the new effective-plant-set logic above.

## 5. Other screens scoped to Active Plant

- **Worklist** (`Worklist.tsx`) — already reads via `MRBContext`; the context change in §1 handles it. Verify the Plant filter chip defaults to the active plant.
- **Pending Actions** (`PendingActions.tsx`) — same context, same effect.
- **Dashboards** (KPI, MRB Analytics, Quality / Plant / Purchase / Engineering Head, Executive Summary) — confirm each pulls from `mrb_records` via the context (or a hook) and is scoped by the new context filter. Where a dashboard queries directly, add `.eq('plant', profile.plant)` (admin/executive use the Active Plant from the header switcher).
- All KPI counts, charts and SLA buckets recompute per active plant on switch.

---

## Out of scope

- Cross-plant aggregated views (none exist today; would need a separate "All Plants" toggle for executives if requested later).
- Search across plants for a single material/MRB (kept at one plant at a time).

## Technical notes

- `useAuth().profile.plant` already drives the header switcher and persists via `updatePlant()`.
- `invokeSapSync` already supports `search_params` overrides (used by Shop Floor MB52).
- `inward_inspection_lots.plant`, `mrb_records.plant`, `shop_floor_stock.plant` columns exist and are indexed; no schema changes needed beyond RLS + helper function.
- The scheduler change is contained to `supabase/functions/sap-sync-scheduler/index.ts` plant-set computation block (around lines 142–152).
- All edge function responses keep the `{ ok, error, data }` HTTP 200 contract per project memory.
