

## Plan: Make "Unblock & SAP Sync" Reliable for Shop Floor MRBs

### Problem
The "Unblock & SAP Sync" button already appears for all approved MRBs (both Inward and Shop Floor), but for Shop Floor MRBs, the SAP 343 unblock call often fails because:

1. **Missing storage_location/batch on mrb_records** — Shop Floor MRB creation (`ShopFloorMaterialBlocking.tsx`) does not save `storage_location` or `batch` to the MRB record
2. **Fragile fallback lookup** — The `buildUnblockRequestBody` function tries to find this data from `shop_floor_stock`, but the query uses only `material_code` + `plant` (no batch filter), may return wrong row, or return nothing if the stock record was deleted/changed

### Solution

**Step 1: Add `storage_location` and `batch` columns to `mrb_records`**
- Add two new nullable text columns to store the original blocking parameters
- This ensures the unblock request always has the correct SAP values regardless of what happens to other tables

**Step 2: Save storage_location and batch during Shop Floor MRB creation**
- In `ShopFloorMaterialBlocking.tsx`, include `storage_location` and `batch` from the selected stock item when calling `createMRB()`
- In `ShopFloorStockSelection.tsx` (the bulk block flow), same change if MRBs are created there

**Step 3: Update `buildUnblockRequestBody` in Worklist.tsx**
- Read `storage_location` and `batch` directly from the MRB record first (new columns)
- Only fall back to `inward_inspection_lots` or `shop_floor_stock` if the MRB record doesn't have them (backward compatibility for existing records)

### Files Changed
1. **Database migration** — Add `storage_location` and `batch` columns to `mrb_records`
2. `src/pages/ShopFloorMaterialBlocking.tsx` — Pass `storage_location` and `batch` in `createMRB()` call
3. `src/pages/Worklist.tsx` — Update `buildUnblockRequestBody` to prefer MRB record fields first; update `UnifiedMRBRecord` interface to include new fields

### Backward Compatibility
Existing approved MRBs without these columns will continue using the current fallback lookup logic — no data loss or breakage.

