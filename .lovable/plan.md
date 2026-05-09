## Goal

Across **every screen**, any "Plant" dropdown / filter must show only the plants the logged-in user is assigned to in `user_plants`. A user assigned to plant `1100` must see only `1100` in every selector — no other plants, no admin/executive bypass.

The header switcher already does this. The remaining offenders are the create/report screens that build their own plant lists.

## Screens to fix

### 1. `src/pages/CreateMRBQuality.tsx` and `src/pages/CreateMRBShopFloor.tsx`
Today they fetch the full `plants` table:
```ts
const [plants, setPlants] = useState<string[]>([]);
... supabase.from('plants').select('code')
```
Replace with `useUserPlants()` (or `useVisiblePlants()`), so the dropdown lists only assigned plant codes. Default the form's plant field to `profile.plant` only if it's in the assigned set; otherwise fall back to the first assigned plant.

### 2. `src/pages/InwardInProcessReport.tsx`
Today (lines ~245–251):
```ts
const isAdminOrExec = userRole === 'admin' || userRole === 'executive';
const accessiblePlantsList = isAdminOrExec ? allPlantsConfig : allPlantsConfig.filter(...)
```
Drop the admin/executive branch. Always filter `allPlantsConfig` by `userPlants` so the Plant multi-select only offers assigned plants.

### 3. `src/pages/WorkflowRoutingConfig.tsx`
`const plants = usePlants();` feeds the plant dropdown. Replace with `useUserPlants()`-filtered list so non-master-admin users only see their plants. (Master admin's `user_plants` is already seeded with all plants, so they're unaffected.)

### 4. `src/components/dashboard/DashboardFilters.tsx`
The component takes `plants` as a prop and currently defaults to `[]`. Where parent dashboards (Quality/Purchase/Engineering/PlantHead/Executive) call it, they don't pass plants today, so the dropdown is empty and harmless. No change required, but we'll verify and, if a future dashboard does pass plants, document that the source must be `useVisiblePlants()`.

### 5. Already correct (no change)
- `AppHeader` plant switcher — already filters by `user_plants`.
- `InwardReport.tsx` — derives plant options from records, which RLS already scopes.
- `ShopFloorStockSelection.tsx` — uses `useVisiblePlants()`.
- `UserManagement.tsx`, `PlantManagement.tsx` — admin-only management screens; these legitimately need the full plant list and stay unchanged. (Only the master admin / users with `user_management` / `plant_management` access reach them anyway.)

## Out of scope
- No DB / RLS changes (already strict).
- No changes to scheduler or SAP transactional posts.
- No change to admin management screens (User/Plant/Role management) where seeing all plants is the whole point.

## Files touched
- `src/pages/CreateMRBQuality.tsx`
- `src/pages/CreateMRBShopFloor.tsx`
- `src/pages/InwardInProcessReport.tsx`
- `src/pages/WorkflowRoutingConfig.tsx`
- Memory: extend `mem://features/strict-plant-scoping` with the rule "every plant dropdown sources from `user_plants`, except admin management screens (User/Plant/Role Management)".
