

## Fix: Role Access Matrix — per-tab screen toggles not working

### Issue
On the Role Access Matrix page, inside each module tab (Dashboards, Operations, Tools), individual screen checkboxes/toggles are unresponsive. Only the table-level toggle and "Select All" work.

### Investigation needed
I need to read the actual Role Access Matrix page to confirm the exact handler wiring. Likely candidates: `src/pages/RoleMatrix.tsx` (and possibly `UserPermissionMatrix.tsx`).

### Likely root cause (based on pattern)
The per-row `onCheckedChange` handler is either:
- bound to the wrong key (using a stale tab/module key, so the toggled row never matches in `setPermissions`),
- mutating state without spreading (no re-render),
- or the Switch/Checkbox is wrapped in a label/button that swallows the click.

### Plan
1. Read `src/pages/RoleMatrix.tsx` (and the tabbed module group component if separate) to inspect:
   - the per-screen toggle handler
   - how `screen_key` / `module_key` is matched against state
   - whether `setDirty(true)` and state update fire
2. Fix the handler so toggling a single screen inside any tab updates `permissions` correctly using the composite key (`role + module_key + plant`), marks dirty, and re-renders.
3. Ensure the Save button picks up these changes (already uses `upsert` on `role,module_key,plant`).
4. Verify "Select All" and tab-level toggle still work after the fix.

### Files to modify
1. `src/pages/RoleMatrix.tsx` — fix per-screen toggle handler inside each tab
2. (If applicable) the child tab/group component rendering the screen rows

### Result
- Each individual screen checkbox inside Dashboards / Operations / Tools tabs becomes toggleable.
- Save persists the change.
- Tab-level "Select All" continues to work.

