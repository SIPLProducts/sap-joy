## Goal

Reverse the recent multi-plant visibility change. Each user sees data **only for the plant currently selected in the header** (their Active Plant). This applies uniformly across every screen — Dashboard, Worklist, Pending Actions, Material Blocking, Inward, In-Process, MRB Print, KPI dashboards, role dashboards, and SAP sync flows.

This supersedes the "All assigned plants" model.

---

## 1. Scoping model — single Active Plant

- Restore the header label from **"Default Plant"** back to **"Active Plant"**.
- The header switcher remains the single source of truth for what the user sees.
  - Users with one assigned plant: locked to that plant.
  - Users with multiple assigned plants: switcher lets them pick one at a time; only that plant's data is loaded.
  - Admin / Executive: switcher shows all plants; one active plant at a time (no global "all plants" view).
- `updatePlant()` continues to persist the selection on `profiles.plant`.

## 2. Replace `useVisiblePlants` with `useActivePlant`

- `useVisiblePlants` returned an array. Replace its usage with the single `profile.plant` (string).
- Either:
  - **(a)** Delete `src/hooks/useVisiblePlants.ts` and switch every consumer to read `profile.plant` from `useAuth()`, **or**
  - **(b)** Keep the file but change it to return `{ activePlant: profile.plant }` for minimal call-site churn.
- Plan choice: **(b)** — less diff, single rename of the returned property.

## 3. Data scoping — `.eq('plant', activePlant)`

Switch every `.in('plant', visiblePlants)` back to `.eq('plant', activePlant)` in:

- `src/contexts/MRBContext.tsx`
- `src/contexts/InwardMRBContext.tsx`
- `src/contexts/InwardInProcessMRBContext.tsx`
- All dashboard direct queries (KPI, MRB Analytics, Quality/Plant/Purchase/Engineering Head, Executive Summary) — audit and convert any remaining multi-plant filter.
- Real-time channel handlers: filter payloads with `payload.new.plant === activePlant` (replace `Set` membership check).
- Re-fetch when `profile.plant` changes (effect dependency on `activePlant`).

## 4. In-screen Plant filter — remove

- Drop the multi-select Plant chip on Worklist, Pending Actions, Inward Materials, Inward In-Process, Shop Floor Material Blocking, and KPI dashboards.
- `MultiSelectFilter` for plant is no longer needed (other filters that use it stay).
- Shop Floor Stock Selection: lock the Plant dropdown to the active plant (no multi-select); only show as a read-only display for non-admin if they have one plant.

## 5. Manual SAP sync — Active Plant only

- `InwardReport` and `InwardInProcessReport` **Refresh Data**: stop looping `userPlants`. Issue a single `invokeSapSync({ search_params: { WERKS: activePlant, ART } })`.
- `ShopFloorStockSelection` live MB52: single call for the active plant.
- Combined-toast logic from the multi-plant loop is removed.

## 6. Background scheduler

- No code change required — `scheduler_plants` already drives plant iteration on the server side, independent of the per-user UI scope.
- Operationally, `scheduler_plants` should still cover every plant the org needs synced (unchanged behavior).

## 7. MRB creation & SAP transactional posts

- Create forms (`CreateMRBQuality`, `CreateMRBShopFloor`, `CreateInwardMRB`, `CreateInwardInProcessMRB`): the Plant field is fixed to the Active Plant (no per-form picker). If a user wants to create for a different assigned plant, they switch the header first.
- Block / Unblock / Stock-update SAP calls keep using **the record's `plant`** (`mrb.plant` / `stock.plant`) — already correct, no change needed.
- `sap-sync` edge function `user_has_plant` guard stays (admin/executive bypass kept).

## 8. RLS

- No SQL change. `user_has_plant()` already permits any plant in the user's `user_plants` set, so single-plant SELECT continues to work for whichever plant is active.

## 9. Memory

- Update `mem://features/multi-plant-visibility` (or replace it with `mem://features/active-plant-scope`) to record the new rule: "User sees only the Active Plant's data across all screens; switcher narrows scope, not just default."

---

## Files to edit

- `src/hooks/useVisiblePlants.ts` — return single `activePlant` string (or delete)
- `src/components/layout/AppHeader.tsx` — label back to "Active Plant"
- `src/contexts/AuthContext.tsx` — toast text "Active plant changed to ..."
- `src/contexts/MRBContext.tsx`
- `src/contexts/InwardMRBContext.tsx`
- `src/contexts/InwardInProcessMRBContext.tsx`
- `src/pages/InwardReport.tsx` — single-plant sync, remove plant multi-select
- `src/pages/InwardInProcessReport.tsx` — same
- `src/pages/ShopFloorStockSelection.tsx` — lock plant to active
- `src/pages/Worklist.tsx`, `PendingActions.tsx`, `KPIDashboard.tsx`, `MRBAnalyticsDashboard.tsx`, `ExecutiveSummaryDashboard.tsx`, `QualityHeadDashboard.tsx`, `PlantHeadDashboard.tsx`, `PurchaseHeadDashboard.tsx`, `EngineeringHeadDashboard.tsx`, `Dashboard.tsx`, `MRBPrint.tsx`, `ShopFloorMaterialBlocking.tsx` — remove any Plant multi-select; ensure data hooks use Active Plant
- Memory file update

## Out of scope

- Cross-plant aggregated KPIs (intentionally not supported under single-plant scope).
- Workflow / approval logic per plant (unchanged).
- RLS changes.
