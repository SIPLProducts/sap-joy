## Problem

On `/inward/inprocess`, the **Plant** filter dropdown is built from `inspectionLotRecords` (records already synced into `zmrb_inward_report`). A user logged into plant **1100** sees an empty Plant filter because no 1100 rows have been synced yet, even though 1100 is their assigned plant.

## Fix

Change the `plantOptions` source on `src/pages/InwardInProcessReport.tsx` so the Plant dropdown always reflects the user's accessible plants, independent of whether data has been synced.

### Source-of-truth rules (mirroring `AppHeader`)
- **Admin / Executive**: show all plants from `usePlants()` (the `plants` table).
- **All other roles**: show only the plants assigned to the user via `useUserPlants()` (intersected with the `plants` table for valid codes/labels).
- Fallback: if the resolved list is empty, fall back to plants currently present in records (existing behaviour) so nothing regresses.

### Implementation outline
1. In `InwardInProcessReport.tsx`:
   - Import `useAuth`, `useUserPlants`, and `usePlants`.
   - Compute `accessiblePlants` using the same logic as `AppHeader` (admin/executive → all plants; others → assigned plants).
   - Replace `const allPlants = [...new Set(inspectionLotRecords.map(r => r.plant))]` with `accessiblePlants` (codes), and build `plantOptions` as `{ value: code, label: name ? \`${code} - ${name}\` : code }`.
   - Keep the data-derived list as fallback only when `accessiblePlants` is empty.
2. No backend / RLS / sync changes. Material, Vendor, Storage Location, Inspection Lot filters remain data-derived (those genuinely depend on existing records).

### Out of scope
- Why the SAP sync hasn't produced any 1100 rows yet (`scheduler_plants=[1100]`, `zmrb_inward_report` has 0 rows for 1100). That's a separate sync investigation; the user opted for the UI fix only.
