

## Plan: Fix Checkbox Selection Behavior

### Problem
Clicking a single checkbox selects/deselects incorrectly because the entire row has an `onClick` handler that also toggles selection. This causes double-toggling or unexpected "all selected" behavior.

### Changes — Single file: `src/pages/ShopFloorStockSelection.tsx`

1. **Remove `onClick` from `TableRow`** (line 537) — rows should not toggle selection on click; only the checkbox should control selection
2. **Remove `onClick={(e) => e.stopPropagation()}`** from the Checkbox (line 543) — no longer needed since the row won't have a click handler
3. **Label the header checkbox** — add "Select All" text next to the header checkbox so it's clearly distinguishable from individual checkboxes

### Result
- Clicking a checkbox only selects/deselects that single item
- Header checkbox is clearly labeled "Select All" and only affects the current page
- No accidental mass selection from row clicks

