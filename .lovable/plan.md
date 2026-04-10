

## Fix: Admin Pages Access & Email Recipient Logic

### Problem 1: Admin Tabs Show "Access Denied" for Non-Admin Roles
All five admin pages hardcode `isAdmin = userRole === 'admin'`. When a non-admin role (e.g., quality_head) is granted access to User Management via the Role Access Matrix, they can see the sidebar link but get "Access Denied" on the page.

**Fix**: In each of the 5 admin pages, replace the hardcoded admin check with a permission-based check using `useRoleMatrix().hasAccess(screenKey)`. Admin role will still pass (since `hasAccess` returns true for admin).

**Files to modify:**
- `src/pages/UserManagement.tsx` — change `isAdmin` from `userRole === 'admin'` to `userRole === 'admin' || hasAccess('user_management')`
- `src/pages/DepartmentManagement.tsx` — same pattern with `'role_management'`
- `src/pages/RoleMatrix.tsx` — same pattern with `'role_access'`
- `src/pages/PlantManagement.tsx` — same pattern with `'plant_management'`
- `src/pages/WorkflowRoutingConfig.tsx` — same pattern with `'workflow_config'`

Each page will import `useRoleMatrix` and use `hasAccess` alongside the existing admin check so that roles granted access in the matrix can use the page.

### Problem 2: Emails Going to Entire MRB Board Instead of Configured Recipients
In `send-mrb-email/index.ts` line 110, all `workflowRoles` from the MRB's `workflow_routing` array are merged into `toRoles`. This means every role in the workflow gets emailed, regardless of what's configured in the email template.

**Fix**: Remove the `workflowRoles` merge. The `toRoles` should only contain roles explicitly configured in the template's `to_roles` field. The `to_emails` field already handles explicit email addresses.

**File to modify:**
- `supabase/functions/send-mrb-email/index.ts` — change line 110 from:
  ```
  const toRoles = new Set<string>([...workflowRoles, ...(template.to_roles || [])]);
  ```
  to:
  ```
  const toRoles = new Set<string>(template.to_roles || []);
  ```
  This ensures emails only go to the roles and addresses configured in the template, not the entire workflow chain.

### Technical Details
- The `useRoleMatrix` hook is already available and returns `hasAccess(screenKey)` which checks `role_permissions` table
- `hasAccess` already returns `true` for `admin` role, so existing admin access is preserved
- The `send-mrb-email` edge function will need redeployment after the fix

