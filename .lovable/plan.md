## Goal

On **MRB Inward Materials** (`/inward/report`) and **MRB In-Process Materials** (`/inward/inprocess`), hide the **"All Plants"** entry from the header plant switcher. Those two screens are inherently single-plant (their data fetch and Create MRB flows operate on one active plant), so showing "All Plants" there is misleading.

## Behavior

- On routes `/inward/report` and `/inward/inprocess`, the header switcher only lists real plant codes — no "All Plants" item.
- If the user already had "All Plants" active when navigating into one of these screens, the header transparently falls back to the user's last real plant (`profile.plant`) so the screen has a valid scope. The preference is restored when they leave to a different screen.
- All other screens (Worklist, User Management, etc.) continue to offer "All Plants" exactly as today.

## Implementation

**`src/components/layout/AppHeader.tsx`** (single file)
- Read the current pathname via `useLocation()` from `react-router-dom`.
- Compute `isSinglePlantScreen = pathname.startsWith('/inward/report') || pathname.startsWith('/inward/inprocess')`.
- Gate the "All Plants" menu item: `offerAllPlants = availablePlants.length >= 2 && !isSinglePlantScreen`.
- When `isSinglePlantScreen && isAllPlantsView`, render the Select `value` as `profile.plant || availablePlants[0].code` (don't flip the persisted flag — leaving the screen restores All Plants).

## Out of scope
- No change to `setAllPlantsView` persistence, RLS, or data fetching in either page.
- Other inward sub-routes (e.g. `/inward/inprocess/create-mrb`, `/inward/inprocess/mrb/:id`) are also single-plant by nature and will be covered by the same `startsWith` check.
