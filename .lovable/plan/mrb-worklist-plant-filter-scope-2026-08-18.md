# MRB Worklist Plant Filter Scope

## Goal
In the MRB Work List screen, the Plant dropdown must only list the plants that are currently selected in the top-bar plant control. Unselected plants (even if the user can normally see them) should not appear in the dropdown. All other existing code, logic, and functionality must remain unchanged.

## Approach

### Scope the dropdown options to the top-bar selection

In `src/pages/Worklist.tsx`, the Plant filter dropdown currently populates its options from `visiblePlantOptions`. It will be changed to use the same plant scope that the top-bar control already computes:

- Use `scopedPlants` (the array of selected plants from the top bar) as the source for the dropdown options.
- If `scopedPlants` is empty (for example, when the user has not yet used the multi-select), fall back to the single resolved `activePlant` so the dropdown is never empty and remains usable.
- Keep the "All Plants" option exactly as it is today, but base its visibility on the scoped plant count instead of the full visible plant count.
- Keep the dropdown labels and the `plantFilter` / `selectedPlant` state logic unchanged.

### Files to change

- `src/pages/Worklist.tsx` — only the Plant filter dropdown rendering section.

### Technical details

```text
Current dropdown source: visiblePlantOptions
New dropdown source:     scopedPlants (or [activePlant] as fallback)
"All Plants" condition:  scopedPlants.length > 1

No changes to:
- data fetching
- filter logic
- row selection
- SAP sync
- RBAC
- any other UI state
```

## Verification

- Build the project and check that the TypeScript types still compile.
- Open the MRB Work List.
- Select one plant in the top bar: the Plant filter dropdown should show only that plant.
- Select multiple plants in the top bar: the Plant filter dropdown should show only those plants plus the existing "All Plants" option.
- Switch to a screen with single-plant-only behavior (e.g., Inward Report) and confirm its Plant control is unchanged.
