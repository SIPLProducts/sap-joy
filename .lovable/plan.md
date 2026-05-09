## Goal

Make plant-based segregation work consistently across the application:

- **Master Admin** (`masteradmin@sharviinfotech.com`) can access all plants and all plant data.
- **All other users**, including users with `admin` role, can access only plants assigned in `user_plants`.
- Plant dropdowns/filters must list only allowed plants.
- Selecting the header plant or screen plant filter must actually show that plant’s records.
- Users assigned to plant `1300` must see `1300` records instead of “No records available”.

## Key fixes

### 1. Fix backend plant access rule for Master Admin

Current database function `user_has_plant()` only checks `user_plants`, so Master Admin is still restricted by assignments at RLS level. I will update it so:

- Master Admin email bypasses plant assignment and can read all plant rows.
- Everyone else must have a matching `user_plants.plant_code`.

This fixes cases where Master Admin selects another plant but RLS returns no rows.

### 2. Make `useVisiblePlants()` wait for assignments before querying data

Several contexts fetch records while `visiblePlants` is still empty. Because empty currently means “no frontend plant filter”, screens may briefly fetch wrong scope or show no rows.

I will make plant-dependent data loading wait until plant visibility is resolved:

- Master Admin: visible plants = all configured plants.
- Other users: visible plants = assigned plants only.
- If a non-master user has no assigned plants, return no records and show the empty state correctly.

### 3. Apply plant scoping inside core data hooks

Update these central data providers/hooks to enforce visible plants consistently:

- `src/contexts/MRBContext.tsx`
- `src/contexts/InwardMRBContext.tsx`
- `src/contexts/InwardInProcessMRBContext.tsx`
- `src/hooks/useMRBDatabase.ts`

This covers MRB Worklist, dashboards, inward materials, pending actions, and MRB detail flows that rely on these sources.

### 4. Fix Inward Materials plant filter options

The Inward Material screens currently build plant filter options from loaded data, and one screen still uses `useUserPlants()` instead of the centralized visible-plant hook.

I will update:

- `src/pages/InwardReport.tsx`
- `src/pages/InwardInProcessReport.tsx`

So plant filter options come from `useVisiblePlants()` and not from records already loaded. This means plant `1300` appears for a `1300` user even before data is loaded or after filters change.

### 5. Fix header plant switcher behavior

If the user’s current default plant is not in allowed plants, the header can keep an invalid plant value. I will make it normalize safely:

- Master Admin can switch to any configured plant.
- Other users can switch only to assigned plants.
- If current default plant is invalid, switch to the first assigned plant.

### 6. Fix role access checks to not rely on only `profile.plant`

Some screen access logic checks permissions against only `profile.plant`. With multi-plant users and header switching, this can block screens incorrectly.

I will update access checks to consider the active/default plant if it is allowed, and avoid showing false “No Access”/empty states for users assigned to `1300`.

## Validation

After implementation I will verify:

- Database has records for plants `1100` and `1300`.
- Master Admin can query all plant-scoped tables.
- A normal user assigned to `1300` gets `1300` records.
- Inward Materials plant dropdown options are based on assigned plants, not loaded rows.
- MRB Worklist and dashboards use the same plant scope.