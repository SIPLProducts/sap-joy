

## Fix KPI Dashboard — Shop Floor Records Not Showing

### Problem
On the KPI Dashboard, the Total MRBs card shows `28` with the breakdown `0 shop floor • 28 inward`. The database actually has 8 shop floor MRBs and 28 inward MRBs for plant 1300 (36 total). All shop floor records are missing across the dashboard (KPI cards, defect/vendor charts, SLA, "My Pending", etc., since every metric is derived from the same incomplete dataset).

### Root cause
`src/contexts/MRBContext.tsx` has two issues that cause `mrb_records` (the table that holds BOTH `shop_floor` and `quality_inspection` MRBs) to be loaded incorrectly or only partially:

1. **Stale closure / missing deps in `fetchData`**
   `fetchData` is wrapped in `useCallback(..., [])` but reads `shouldFilterByPlant` and `userPlant` from outer scope. When the provider mounts before `AuthContext` resolves the profile/role, the first (and only) fetch captures stale auth values; the data is never re-fetched once the role/profile become available.

2. **No re-fetch when auth changes**
   The `useEffect` is keyed on `[fetchData]` only. Because `fetchData` never changes (empty deps), the records are loaded once at mount and never refreshed when the user signs in / role becomes known.

The KPI Dashboard's `allMRBs` then merges `mrbRecords` (incomplete — possibly empty) with `inwardMRBRecords` (always populated by `InwardMRBContext` because that one filters by `source = quality_inspection` directly). Net result: only inward MRBs show, shop floor count is `0`.

### Fix

**1. `src/contexts/MRBContext.tsx`**
- Add `shouldFilterByPlant` and `userPlant` to `useCallback` dependency array of `fetchData`.
- Re-run the effect when `userRole` / `userPlant` change so the fetch re-executes once auth is ready.
- Add an explicit error log when `mrbResult.error` is set so silent RLS / network failures are visible in console.
- Guard against partial loads: only call `setMRBRecords` if there is no error; otherwise log and keep previous state.

**2. `src/pages/KPIDashboard.tsx` — defensive merge**
- Change `allMRBs` so it explicitly UNIONS by `id` from both sources rather than starting from one and topping up with the other. This guarantees that if either context is briefly empty, the other still contributes its records:
  - Build a Map keyed by `id`, populate from `mrbRecords` first, then overlay `inwardMRBRecords` (so the inward context wins on conflict but is never the only source).
- Keep the existing source-based KPI counters; once `mrbRecords` is correct, `shopFloorMRBs` will be correct too.

**3. Verify other dashboards and the legacy `Dashboard.tsx`**
- `Dashboard.tsx`, `MRBAnalyticsDashboard.tsx`, `QualityHeadDashboard.tsx`, `PurchaseHeadDashboard.tsx`, `EngineeringHeadDashboard.tsx`, `ExecutiveSummaryDashboard.tsx`, `PlantHeadDashboard.tsx` all consume `useMRB().mrbRecords`. Once the context is fixed, all of them will start showing shop floor records again — no per-page changes required.
- No backend / RLS changes needed (RLS on `mrb_records` SELECT is `true`, both record types are visible).

### Files changed
- `src/contexts/MRBContext.tsx` — fix `useCallback` deps, refetch on auth change, log errors.
- `src/pages/KPIDashboard.tsx` — defensive `allMRBs` merge using a Map keyed by `id`.

### Expected result
- Total MRBs card shows `36` with `8 shop floor • 28 inward` (for current data).
- Shop floor records appear in:
  - Top KPI cards (Total / Open / Closed / Rejected / Accepted / SLA / Avg Pending Days)
  - Defect Category, Top Reject Reasons, Reject Reasons by Plant/Month
  - Top 5 Vendors by Damage and vendor breakdowns
  - "My Pending Actions" and SLA charts
- Quality / Purchase / Engineering / Executive / MRB Analytics dashboards and the legacy Dashboard also reflect shop floor records.
- No regression to plant-based filtering for non-admin / non-executive users.

