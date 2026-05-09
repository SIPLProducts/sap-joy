## Plan

Apply the same active-plant scoping pattern (already used on Worklist + Inward screens) to nine more screens so every page reflects the plant chosen in the top header.

### Pattern recap

For each screen:
1. Read `profile.plant` and validate against `useVisiblePlants()` to get an `activePlant`.
2. Add (or reuse) a Plant dropdown in the page filter bar.
   - Master Admin → all plants.
   - Other users → only their assigned plants (no "All Plants" option when the user has just one assigned plant).
3. Sync the in-page Plant filter to the header active plant via a `useEffect`, so switching plants in the header updates records and KPIs immediately.
4. Filter records / KPIs / charts / exports by the selected plant.

### Per-screen changes

1. **KPI Dashboard (`KPIDashboard.tsx`)**
   - Already has `selectedPlant`. Initialize from `activePlant` and re-sync on header change. Restrict the dropdown to `useVisiblePlants` (currently uses `visiblePlants: plants`). Remove the "All Plants" label fallback in the title when a single plant is active.

2. **Pending Actions (`PendingActions.tsx`)**
   - Add `useVisiblePlants` + `activePlant`. Add a Plant dropdown. Filter the pending-MRB list by selected plant. Sync to header.

3. **MRB Print (`MRBPrint.tsx`)**
   - This page prints a single MRB, but the print header / company config is plant-driven. Ensure the plant context used for `plant_print_config` lookup is the active plant of the MRB record (already record-bound) — no filter needed. Add a guard: if the MRB's plant isn't in the user's `useVisiblePlants`, show a "No Access" card. (No new dropdown; this is a detail screen.)

4. **MRB Analytics (`MRBAnalyticsDashboard.tsx`)**
   - Add `useVisiblePlants` + `activePlant`. Add a Plant dropdown. Filter all aggregations (counts, charts, trend tables) by selected plant. Sync to header.

5. **Quality Head Dashboard (`QualityHeadDashboard.tsx`)**
   - Already has `selectedPlant`. Initialize from `activePlant`, sync on header change, restrict dropdown options to `useVisiblePlants` (with "All Plants" only when user has multiple).

6. **Purchase Head Dashboard (`PurchaseHeadDashboard.tsx`)**
   - Same treatment as Quality Head.

7. **Engineering Head Dashboard (`EngineeringHeadDashboard.tsx`)**
   - Same treatment as Quality Head.

8. **Executive Summary (`ExecutiveSummaryDashboard.tsx`)**
   - Same treatment as Quality Head.

9. **User Management (`UserManagement.tsx`)**
   - Add a Plant filter dropdown above the users table (options = `useVisiblePlants`).
   - Default to header `activePlant`; sync via `useEffect`.
   - Filter the users grid to those assigned to the selected plant (`user_plants.plant_code` overlap).
   - Master Admin can switch / pick "All Plants"; non-master users see only assigned plants.
   - Existing assignable-plants list in the Add/Edit User dialog already uses `useVisiblePlants` — keep as is.

### Out of scope

- No DB / RLS changes (RLS already restricts non-master users by `user_has_plant`).
- No changes to other screens (Inward, Worklist, etc. — already done).
- No change to MRB detail pages beyond the optional Print access guard.
