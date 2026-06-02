## Problem Summary

Two issues in the main header plant switcher:

1. **"All Plants" shows empty dashboard data**: The `useActivePlant` hook does not respect `isAllPlantsView`. When the user selects "All Plants" from the header dropdown, `profile.plant` is not updated, so the hook continues to return the previous single plant code. The KPI Dashboard then filters its data to that single plant instead of showing all plants.

2. **Dropdown UI is not user-friendly**: The plant switcher trigger is very small (`h-6`, `text-xs`), uses muted background colors (`bg-muted/50`), has cramped spacing, and the "Default Plant:" label is confusing when "All Plants" is selected.

## Proposed Changes

### 1. Fix `useActivePlant` hook (`src/hooks/useActivePlant.ts`)
- Import `isAllPlantsView` from `useAuth`
- When `isAllPlantsView` is `true`, return `activePlant = 'all'` and call `setSelectedPlant('all')`
- This ensures the KPI Dashboard and any page using `useActivePlant` correctly shows data across all plants when the header is set to "All Plants"

### 2. Improve AppHeader plant switcher UI (`src/components/layout/AppHeader.tsx`)
- **Size**: Increase trigger height to `h-8`, font to `text-sm`, and dropdown min-width to `min-w-[140px]`
- **Colors**: Use a clearer background (`bg-background` or `bg-primary/10`), stronger border (`border-border`), and ensure the selected value uses `text-foreground` with `font-semibold`
- **Alignment**: Keep right-aligned but add proper padding and spacing; improve the container wrapper with better rounded corners (`rounded-lg`) and shadow
- **Label clarity**: Change "Default Plant:" label to just "Plant:" to work for both single-plant and all-plants selection
- **Dropdown items**: Increase item padding, improve hover states (`hover:bg-primary/10 hover:text-primary`), and make the "All Plants" option visually distinct with an icon

### Files to change
- `src/hooks/useActivePlant.ts`
- `src/components/layout/AppHeader.tsx`

## Testing
After implementation:
1. Log in and go to Dashboard
2. Select "All Plants" from the header dropdown — dashboard should show aggregated data from all visible plants (not empty)
3. Select a specific plant — dashboard should filter to that plant
4. Verify the dropdown looks cleaner with better size, color, and alignment