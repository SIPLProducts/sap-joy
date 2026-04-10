

## Make Roles Fully Dynamic — Remove Hardcoded Enum Constraint

### Problem
Roles are created dynamically through the app (via Role Management / departments table), but the database uses a fixed `app_role` enum. When a user creates a new role like "Stores", it can't be assigned because:
1. The `user_roles.role` column is typed as `app_role` enum — only accepts the 10 hardcoded values
2. `UserManagement.tsx` line 173 has a hardcoded `validRoles` array
3. "Assign" button shows instead of "Edit"; Delete is hidden when no role

### Solution
Convert all `app_role` enum columns to `text` so any role created in the departments table can be used. Update the `has_role()` and `get_user_role()` functions accordingly. Fix the UI bugs.

### Database Migration

1. **Convert columns from `app_role` enum to `text`:**
   - `user_roles.role`
   - `mrb_records.pending_with`
   - `mrb_approval_history.performed_by_role`
   - `plant_workflow_config.department`
   - `dashboard_config.role`

2. **Recreate functions** `has_role()` and `get_user_role()` to accept/return `text` instead of `app_role`

3. **Drop and recreate affected RLS policies** — remove all `::app_role` casts (e.g. `'admin'::app_role` → `'admin'`)

4. **Drop the `app_role` enum type** (no longer needed)

### Frontend Changes (`src/pages/UserManagement.tsx`)

1. **Line 173** — Replace hardcoded `validRoles` with dynamic check: `roleOptions.map(r => r.value)`
2. **Lines 371-374** — Replace failing `upsert` with check-then-insert/update pattern for `user_roles`
3. **Line 380** — Use `upsert` with `onConflict: 'user_id'` for `user_security`
4. **Line 532** — Always show "Edit" button (remove "Assign" conditional)
5. **Lines 534-539** — Always show Delete button
6. **Lines 708-722** — Change "Remove Role" dialog to "Delete User", update handler to clean up `user_roles`, `user_plants`, `user_security`, and `profiles`

### Frontend Changes (other files)
- `src/contexts/AuthContext.tsx` — Change `AppRole` type from enum import to `string`
- `src/contexts/RoleContext.tsx` — Update `AppRole` references
- `src/pages/InwardMRBDetail.tsx`, `src/pages/PendingActions.tsx`, `src/pages/ShopFloorMaterialBlocking.tsx`, `src/components/mrb/WorkflowProgressIndicator.tsx`, `src/lib/workflowRouting.ts`, `src/contexts/InwardMRBContext.tsx` — Remove `Database['public']['Enums']['app_role']` references, use `string` type instead

### Files Modified
- 1 new database migration (convert enum → text, recreate functions + RLS policies)
- `src/pages/UserManagement.tsx` (fix creation, validation, UI)
- ~8 TypeScript files (update type references from enum to string)

