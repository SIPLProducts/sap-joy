## Goal

Users see data from **all plants assigned to them** by default on every screen, with an in-screen Plant filter to narrow down. The header **Active Plant** becomes a *default* (for new record creation and SAP posts), not a data filter. Manual SAP sync covers all assigned plants. SAP transactional posts (block/unblock/stock update) use the **plant of the record being acted on**.

This supersedes the previous "Active Plant only" scoping.

---

## 1. Data scoping — all assigned plants

Replace `eq('plant', profile.plant)` with `in('plant', userPlants)` in:

- `src/contexts/MRBContext.tsx` (Worklist, Pending Actions, Dashboard, KPI, role dashboards, MRB Print list)
- `src/contexts/InwardMRBContext.tsx`
- `src/contexts/InwardInProcessMRBContext.tsx`

Source of `userPlants`:
- Use `useUserPlants()` hook (already exists). For `admin` / `executive`, fall back to **all plants** from `usePlants()` so they keep global visibility.
- Real-time listeners filter payloads with `userPlants.includes(payload.new.plant)` instead of equality.
- Re-fetch when `userPlants` changes.

Direct queries in dashboards that bypass context (KPI, MRB Analytics, Quality/Plant/Purchase/Engineering Head, Executive Summary): replace any `.eq('plant', …)` with `.in('plant', userPlants)`.

## 2. In-screen Plant filter (multi-select)

For every list screen, show a Plant multi-select chip populated from `userPlants` (hidden when user has only one plant). Default selection = all assigned. Filter the in-memory rows by the selection.

Screens:
- Worklist
- Pending Actions
- Inward Materials (`InwardReport`)
- Inward In-Process (`InwardInProcessReport`)
- Shop Floor – Material Blocking (`ShopFloorStockSelection`) — replaces the current locked-to-Active-Plant dropdown with a multi-select; live MB52 fetch is then run per selected plant and results merged
- KPI / role dashboards — Plant filter scopes the KPI cards and charts

`MultiSelectFilter` component already exists; reuse it.

## 3. Manual SAP sync — all assigned plants

`InwardReport` and `InwardInProcessReport` **Refresh Data**:
- Resolve the active SAP config.
- Loop `userPlants` and call `invokeSapSync({ action: 'fetch_and_store', config_id, search_params: { WERKS, ART } })` for each.
- Show a single combined toast (`Synced N plants, X records updated`). Aggregate per-plant failures.
- Disable button while running.

`ShopFloorStockSelection` live MB52: when user selects multiple plants in the filter, issue one MB52 call per plant and concatenate results.

## 4. Header switcher → "Default plant" only

`AppHeader` keeps the Plant dropdown but its label changes from **Active Plant** to **Default Plant** (used for new record creation and as the pre-selected plant on create forms / SAP posts). It no longer filters the list views.

## 5. Create & SAP transactional posts use the record's plant

- `CreateMRBQuality`, `CreateMRBShopFloor`, `CreateInwardMRB`, `CreateInwardInProcessMRB`: add a Plant dropdown limited to `userPlants`, defaulting to `profile.plant`. The chosen plant is stored on the record.
- Block/Unblock/Stock-update SAP calls (`ShopFloorMaterialBlocking`, `MRBDetail`, `InwardMRBDetail`, `ShopFloorMRBDetail`): always use `mrb.plant` / `stock.plant` for `WERKS`. Do not derive from header.
- Edge function `sap-sync` plant-assignment guard stays — it now checks the caller is assigned to the requested `WERKS` (admin/executive bypass kept).

## 6. Background scheduler

No change to the recently shipped logic — it already runs for the union of `scheduler_plants` ∩ `user_plants`, which is correct for multi-plant.

## 7. RLS

No change. The `user_has_plant()` helper already returns true for any plant in the user's `user_plants` set (and admins/executives bypass), so multi-plant SELECT works under the existing policies.

## Out of scope

- Cross-plant aggregated KPIs (we filter, we don't pre-aggregate).
- Changing the workflow / approval logic per plant.

## Technical notes

- `useUserPlants()` already returns the array of plant codes; for admin/executive, expand to `usePlants().map(p => p.code)` to preserve global visibility.
- `MultiSelectFilter` already used on Inward — extend its usage and default state to "all".
- `invokeSapSync` already accepts `search_params` overrides; loop client-side.
- `MRBContext` real-time channel filters: switch to a `Set` membership check.
- Header label change is cosmetic; logic of `updatePlant()` stays so the chosen plant persists as the create-form default.
- All edge functions keep the `{ ok, error, data }` 200-OK contract.
