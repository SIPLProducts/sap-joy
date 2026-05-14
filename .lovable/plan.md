# Restrict "Add Plant" to master admin and superadmin

## Scope
Hide the **Add Plant** button on the Plant Management screen for everyone except master admin and superadmin. View / Edit / Delete behavior is unchanged.

## Changes (UI only)

### `src/pages/PlantManagement.tsx`
- Compute `canAddPlant = isMaster || userRole === 'superadmin'` (using existing `isMaster` from `useVisiblePlants` and `userRole` from `useAuth` — both already in scope).
- Wrap the **Add Plant** button (line 158–160) so it only renders when `canAddPlant` is true.
- Update the empty-state message (line 187–188) to drop the "Click Add Plant to create one." hint when `canAddPlant` is false; show a neutral "No plants configured yet." instead.

## Out of scope
- Edit / Delete buttons remain available to anyone whose role matrix grants `plant_management` (existing behavior).
- No DB / RLS changes — the `plants` insert policy already allows admins and `plant_management`-granted roles, which includes superadmin.
