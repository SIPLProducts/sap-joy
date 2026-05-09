## Issue

In Shop Floor → **Material Blocking** (`ShopFloorStockSelection.tsx`), the **Plant (WERKS)** dropdown still shows all plants for admin users. The screenshot proves it: the logged-in admin is assigned only to plant `1100`, but the dropdown also lists `1300 - HBL Plant 1300`.

This is the last admin-bypass that was missed in the previous "strict plant scoping" pass.

## Root cause

`src/pages/ShopFloorStockSelection.tsx` lines 41–59:

```ts
const isAdmin = userRole === 'admin';
useEffect(() => {
  if (isAdmin) {
    supabase.from('plants').select('code, name').then(({ data }) => {
      if (data) setAllSystemPlants(data);   // ← fetches the FULL plants table
    });
  }
}, [isAdmin]);

const availablePlants = useMemo(() => {
  if (isAdmin) {
    return allSystemPlants.map(...);        // ← admin sees all plants
  }
  return userPlants.map(p => ({ value: p, label: p }));
}, [isAdmin, allSystemPlants, userPlants]);
```

This directly violates the project rule **"Admin scoping: Always restrict to assigned plants"** (mem://features/strict-plant-scoping).

## Fix

In `src/pages/ShopFloorStockSelection.tsx`:

1. Remove the `isAdmin` branch entirely. Drop `allSystemPlants`, the `useEffect` that fetches `plants`, and the `isAdmin` check inside `availablePlants`.
2. Always derive `availablePlants` from `useUserPlants()`. Use plant name from the `plants` table for the label so the dropdown reads "1100 - Vizag plant" (the same labels shown today), but only for assigned plants. Use `usePlants()` (already loaded once globally via `usePlantConfig`) and filter to `userPlants`.
3. Keep the existing `disabled={availablePlants.length <= 1}` behavior so single-plant users see a locked dropdown.

After the fix, the admin assigned only to `1100` will see exactly one option: `1100 - Vizag plant`, and the dropdown will be locked to it.

## Files to touch
- `src/pages/ShopFloorStockSelection.tsx` (only)
- Memory: append note to `mem://features/strict-plant-scoping` — "Material Blocking (`ShopFloorStockSelection`) admin bypass removed; uses `useUserPlants` for the WERKS dropdown."

## Out of scope
- No DB / RLS changes.
- No changes to other screens (already covered).
- No changes to admin management screens (User/Plant/Role/Email config).
