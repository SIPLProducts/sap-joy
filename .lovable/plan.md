## Goal

Let any user assigned to **2 or more plants** opt into an "All Plants" view from the header switcher, so the **MRB Worklist** and **User Management** screens show data across every plant they're allowed to see — instead of being locked to a single active plant at a time.

## Behavior

- Header switcher shows a new top entry **"All Plants"** whenever the user has 2+ visible plants (Master Admin / Superadmin already see all; other multi-plant users now get the same option).
- Selecting "All Plants":
  - **MRB Worklist** — lists MRBs from every plant the user can see; in‑page Plant filter defaults to "All" and is fully usable to narrow down.
  - **User Management** — lists users from every visible plant; Plant filter defaults to "All".
  - **Other screens** (Inward, In‑Process, dashboards, MRB detail, Shop Floor, etc.) keep working against the user's last real plant — unchanged scope.
- RLS already restricts data to plants in `user_plants`, so "All Plants" naturally cannot leak data the user isn't assigned to.

## Implementation

### 1. `AuthContext`
- Add a non‑persisted flag `isAllPlantsView: boolean` + setter `setAllPlantsView(v)`.
- Persist the user's preference in `localStorage` (`mrb.allPlantsView`) so it survives reloads, but never write the sentinel into `profiles.plant`.
- `profile.plant` continues to hold a real plant code (used by every other screen).

### 2. `AppHeader`
- If `plantOptions.length >= 2`, prepend an **"All Plants"** item with sentinel value `__ALL__`.
- Select `value` = `__ALL__` when `isAllPlantsView`, else `profile.plant`.
- `onValueChange`:
  - `__ALL__` → `setAllPlantsView(true)` (don't touch `profile.plant`).
  - real code → `setAllPlantsView(false)` + existing `updatePlant(code)`.
- Keep the auto‑switch effect (when stored plant isn't allowed) but skip it while `isAllPlantsView`.

### 3. `Worklist.tsx`
- Read `isAllPlantsView` from auth context.
- `activePlant` logic: when `isAllPlantsView`, treat scope as "all visible plants" (no single active code).
- Effect that resets `plantFilter` to active plant: when "all plants" is on, set `plantFilter = 'all'` instead.
- Existing in‑page Plant dropdown already supports `'all'` + per‑plant filtering — no further change.

### 4. `UserManagement.tsx`
- Same pattern: when `isAllPlantsView`, force `plantFilter = 'all'` on mount/active‑plant change.
- The `useActivePlant(setPlantFilter)` hook currently re-pins to the active plant; gate it so it doesn't override the "all" choice when `isAllPlantsView` is true (either skip the hook call or pass a no‑op setter).

### 5. No DB / RLS changes
- All RLS policies for `mrb_records`, `profiles`, `user_plants` already enforce `user_has_plant(...)` (or are universally readable), so opening the UI to "All Plants" is safe — users only ever see their assigned plants' data.

## Out of scope
- Other screens (dashboards, Inward, In‑Process, MRB detail, Shop Floor, KPI, etc.) intentionally remain pinned to a single active plant — `Active Plant Scope` memory is preserved everywhere except Worklist and User Management.
- No change to who can be assigned multiple plants; eligibility is purely "user already has 2+ plant assignments".
