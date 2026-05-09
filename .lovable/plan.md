## Goal

Across **every screen with a Plant filter**, the Plant dropdown must list only the plants the logged-in user is assigned to in `user_plants`. No "All Plants" leakage to plants the user isn't assigned to, no fallback to the full `plants` table.

The header switcher and create-MRB / inward report screens already do this (previous round). The remaining offenders are the dashboard filters and KPI dashboard.

## Screens to fix

### 1. Dashboard filters — currently empty, need feeding from `useVisiblePlants`
These screens render `<DashboardFilters />` but don't pass a `plants` prop, so the dropdown only shows "All Plants" with no individual plant options:
- `src/pages/QualityHeadDashboard.tsx`
- `src/pages/PurchaseHeadDashboard.tsx`
- `src/pages/EngineeringHeadDashboard.tsx`
- `src/pages/PlantHeadDashboard.tsx`
- `src/pages/ExecutiveSummaryDashboard.tsx`

Fix: in each, call `useVisiblePlants()` and pass `plants={visiblePlants}` to `<DashboardFilters />`. If `visiblePlants.length === 1`, default `selectedPlant` to that single code (instead of `'all'`) so the user immediately sees scoped data.

### 2. `src/pages/KPIDashboard.tsx`
Today (line 82): `const plants = useMemo(() => [...new Set(mrbRecords.map(r => r.plant))], [mrbRecords]);`
This is records-derived (RLS-scoped) so it's already safe, but it's inconsistent and shows `'all'` as default.
Fix: replace with `useVisiblePlants()` so the dropdown matches the assignment list exactly. If only one assigned plant, default `selectedPlant` to that plant.

### 3. `src/components/dashboard/DashboardFilters.tsx`
No structural change. Add a tiny safeguard: if the `plants` prop has exactly one entry, hide the "All Plants" option (or render the single plant as a non-interactive label) so users cannot pick a wider scope than their assignment.

### 4. Already correct (no change)
- `AppHeader` — assigned-only.
- `CreateMRBQuality.tsx`, `CreateMRBShopFloor.tsx` — use `useUserPlants()`.
- `InwardReport.tsx`, `InwardInProcessReport.tsx` — assigned-scoped.
- `ShopFloorStockSelection.tsx` — uses `useVisiblePlants()`.
- `WorkflowRoutingConfig.tsx` — assigned-scoped (previous round).
- `Worklist`, `SAPSyncMonitor`, `ShopFloorMaterialBlocking`, `MRBAnalyticsDashboard`, `Dashboard` — no plant dropdown filter.
- Admin management screens (`UserManagement`, `PlantManagement`, `RoleMatrix`, `UserPermissionMatrix`, `EmailConfiguration`) — these manage cross-plant config and intentionally show the full plant list. Excluded.

## Out of scope
- No DB / RLS changes (already strict via `user_has_plant`).
- No changes to admin/configuration screens.
- No changes to scheduler or SAP transactional posts.

## Files to touch
- `src/pages/QualityHeadDashboard.tsx`
- `src/pages/PurchaseHeadDashboard.tsx`
- `src/pages/EngineeringHeadDashboard.tsx`
- `src/pages/PlantHeadDashboard.tsx`
- `src/pages/ExecutiveSummaryDashboard.tsx`
- `src/pages/KPIDashboard.tsx`
- `src/components/dashboard/DashboardFilters.tsx`
- Memory: extend `mem://features/strict-plant-scoping` — "every Plant filter dropdown sources from `useVisiblePlants()`; if user has 1 assigned plant, default selection to it and hide the All Plants option."
