## Problem

In **MRB → Inward Materials**, clicking **Refresh Data** currently loops over **all plants assigned to the user** (`userPlants`) and triggers a SAP sync for each one. The user expects it to sync **only the active plant** selected in the main header (`profile.plant`).

Same issue exists on **Inward In-Process Report** (`InwardInProcessReport.tsx`).

## Fix

Replace the `plantsToSync` array logic in `handleAPISync` so it uses the single active plant from the header (resolved via the existing `useActivePlant` hook for safety against unassigned plants).

### Files to edit

1. **`src/pages/InwardReport.tsx`** (around lines 464–472)
   - Import `useActivePlant`.
   - Replace:
     ```ts
     const plantsToSync = (userPlants && userPlants.length > 0)
       ? userPlants
       : (profile?.plant ? [profile.plant] : []);
     ```
     with:
     ```ts
     const plantsToSync = activePlant ? [activePlant] : [];
     ```
   - Update toast message to singular: `Syncing inward data for plant ${activePlant}…`.
   - Adjust success/failure messages for single plant.

2. **`src/pages/InwardInProcessReport.tsx`** (same handler, same change).

### Out of scope

- Auto-refresh interval, upload, MRB creation, and table fetch logic remain untouched (table fetch already filters by `visiblePlants`; if you want that scoped to active plant too, say so and I'll extend).
- No DB or edge function changes.
