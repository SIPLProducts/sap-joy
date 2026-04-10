

## Fix: Non-Admin Users with User Management Access See Empty Data

### Root Cause
The RLS (Row Level Security) policies on `user_roles`, `user_plants`, `user_security`, and `password_history` tables only allow full access to users with the `admin` role. Non-admin users (e.g., Quality) who are granted `user_management` via the Role Access Matrix can see the page but can only read their own data — so all other users appear with "No Role" and missing plant info.

### Solution
Add RLS policies that check if the current user has `user_management` permission in the `role_permissions` table, granting them the same data access as admins on these tables.

**Step 1: Create a helper function** to check if a user has a specific screen permission:
```sql
CREATE OR REPLACE FUNCTION public.has_screen_access(
  _user_id uuid, _screen_key text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.module_key = _screen_key
      AND rp.can_view = true
  )
$$;
```

**Step 2: Add new RLS policies** on four tables:

- **`user_roles`**: SELECT + ALL for users with `has_screen_access(auth.uid(), 'user_management')`
- **`user_plants`**: SELECT + ALL for users with `has_screen_access(auth.uid(), 'user_management')`
- **`user_security`**: SELECT + ALL for users with `has_screen_access(auth.uid(), 'user_management')`
- **`password_history`**: SELECT for users with `has_screen_access(auth.uid(), 'user_management')`

**Step 3: Add loading guard** in `UserManagement.tsx` — check `useRoleMatrix().loading` before rendering the "Access Denied" block, showing a spinner while permissions load.

Also apply the same loading guard pattern to the other 4 admin pages (`DepartmentManagement`, `RoleMatrix`, `PlantManagement`, `WorkflowRoutingConfig`).

### Files Modified
1. **Database migration** — new `has_screen_access` function + new RLS policies on 4 tables
2. `src/pages/UserManagement.tsx` — add loading guard
3. `src/pages/DepartmentManagement.tsx` — add loading guard
4. `src/pages/RoleMatrix.tsx` — add loading guard
5. `src/pages/PlantManagement.tsx` — add loading guard
6. `src/pages/WorkflowRoutingConfig.tsx` — add loading guard

### Technical Details
- The `SECURITY DEFINER` function avoids recursive RLS issues when checking `role_permissions` and `user_roles`
- Existing admin policies remain unchanged — this only adds additional access paths
- The `profiles` table already has a permissive SELECT policy for all authenticated users, so no change needed there

