
Fix the issue by aligning the live Role Access Matrix page with the actual permission schema the app now uses.

1. Replace the route’s implementation source
- The app route `/admin/matrix` currently renders `src/pages/RoleMatrix.tsx`, not `src/pages/UserPermissionMatrix.tsx`.
- `RoleMatrix.tsx` is still using the old sparse model (`screen_key` rows exist only when enabled).
- I will update the routed page to use the new dense model already reflected in the database types and in `UserPermissionMatrix.tsx`:
  - `module_key`
  - `module_label`
  - `can_view`
  - `can_edit`
  - `plant`

2. Fix save logic so it updates rows instead of delete+reinsert
- Remove the current pattern in `RoleMatrix.tsx` that:
  - deletes non-admin permissions
  - reinserts rows with only `module_key/module_label`
- Replace it with the safer approach used in `UserPermissionMatrix.tsx`:
  - load all rows for the selected plant
  - toggle `can_view` / `can_edit`
  - save with `upsert(..., { onConflict: 'role,module_key,plant' })`
- This will stop the `null value in column "screen_key"` failure on self-hosted setups that still enforce legacy columns.

3. Unify frontend permission keys
- Right now the sidebar uses keys like:
  - `mrb_worklist`
  - `material_booking`
  - `analytics_dashboard`
- But the migration seed uses keys like:
  - `worklist`
  - `material_blocking`
  - `analytics`
- I will standardize the screen/module key map in one place so:
  - the matrix labels,
  - sidebar access checks,
  - and saved DB values
  all use the same identifiers.
- This avoids roles appearing enabled in the matrix but hidden in navigation.

4. Update `useRoleMatrix` to respect actual access flags
- `useRoleMatrix.ts` currently grants access if any row exists for a role+screen key.
- That is incorrect for the new schema because disabled rows still exist.
- I will change `hasAccess()` to require:
  - matching role
  - matching normalized key
  - `can_view === true`
- This ensures the matrix actually controls visibility.

5. Make the UI consistent with the newer matrix design
- Reuse the friendlier layout pattern already present:
  - role tabs
  - grouped sections
  - counts per role
  - select/deselect all
  - unsaved changes banner
- Keep the simpler, cleaner interaction model the user asked for, while wiring it to the correct data structure.

6. Handle compatibility with your self-hosted DB
- Your self-hosted table still appears to have legacy `screen_key` constraints, while this project now expects `module_key`.
- I will make the frontend robust for the current app schema, and I recommend one database alignment step in parallel:
```text
Either:
A) migrate self-hosted role_permissions fully to module_key model
or
B) keep a temporary compatibility column mapping until migration is complete
```
- If needed, I can next give you one clean self-hosted SQL patch specifically for `role_permissions` compatibility.

Files to update
- `src/pages/RoleMatrix.tsx`
- `src/hooks/useRoleMatrix.ts`
- likely one shared constants location or the route page itself for screen/module definitions
- optionally remove or merge `src/pages/UserPermissionMatrix.tsx` to avoid duplicate logic

Technical details
```text
Current bug source:
Route -> RoleMatrix.tsx
RoleMatrix save -> insert { role, module_key, module_label }
Self-hosted DB -> still requires screen_key
Result -> POST 400, null screen_key violation

Additional hidden bug:
hasAccess() only checks row existence, not can_view
So dense permission rows would grant access even when disabled
```

Expected result
- Save works without the `screen_key` null error
- Matrix changes persist correctly
- Sidebar visibility matches saved permissions
- Admin matrix page uses one consistent permission model instead of two conflicting ones
