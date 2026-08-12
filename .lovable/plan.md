# Multi-Select Plant in the Top Bar

Turn the header Plant switcher into a multi-select so a user can view data for several of their plants at once, without changing any existing screen logic or workflows.

## Behaviour

- The header control becomes a checkbox-style dropdown listing exactly the plants the user can see today (Master Admin / superadmin see all, others see only assigned plants).
- Selecting multiple plants shows a summary like "Plant: 1300 +2". Selecting every plant is equivalent to the current "All Plants" view.
- At least one plant must always stay selected; unchecking the last one is blocked.
- The selection persists across reloads, same as the current All-Plants toggle.
- List/report screens that already support an "all plants" mode (Worklist, dashboards, KPI, Pending Actions, User Management) now filter to the selected set instead of one plant or everything.
- Screens that are inherently single-plant (Quality Info form, MRB creation, Inward and In-Process Refresh/SAP sync, MRB Print) keep their existing logic untouched: they continue to use the single active plant exactly as today.

## Technical Notes

- `AuthContext`: add `selectedPlants: string[]` plus a setter, persisted in localStorage. Keep `profile.plant`, `updatePlant`, `isAllPlantsView` and `setAllPlantsView` in place so no existing consumer breaks — `isAllPlantsView` is derived from "all visible plants selected".
- `useActivePlant`: keep returning `activePlant` unchanged (single value, `'all'` when everything is selected) and add a new `selectedPlants` array for screens that opt in.
- `AppHeader`: replace the `Select` with a `Popover` + checkbox list; the single-plant screens detected by the existing `isSinglePlantScreen` path keep the current single-choice behaviour.
- Multi-plant filtering on list screens: replace `plant === filter` comparisons with membership in the selected set, keeping the existing `'all'` shortcut intact.
- No database, RLS, or edge-function changes.
