
Fix the administration permission model so that a user who is assigned an Administration tab can fully use that module, not just see the menu.

1. Fix the Role Access Matrix save error
- Root cause: `src/pages/RoleMatrix.tsx` already allows non-admin users with `role_access` to open the page, but the database still keeps `role_permissions` mutations admin-only.
- Result: when Quality tries to save permissions, the `.upsert(...)` hits RLS and throws `new row violates row-level security policy for table "role_permissions"`.
- Change: add permission-based RLS on `role_permissions` using `public.has_screen_access(auth.uid(), 'role_access')`.
- I will use explicit `INSERT`, `UPDATE`, and `DELETE` policies with `TO authenticated`, plus `WITH CHECK` for insert/update so upserts work correctly.

2. Make each assigned Administration tab fully functional
- Apply the same permission-driven backend access for each module:
  - `user_management` → `profiles`, `user_roles`, `user_plants`, `user_security`, `password_history`, password reset function
  - `role_management` → `departments`
  - `plant_management` → `plants`
  - `workflow_config` → `plant_workflow_config`
  - `email_config` → `smtp_config`, `email_templates`
- This will make assigned users work the same as admin for that specific tab.

3. Align frontend guards with the new model
- Add a direct permission guard to `src/pages/EmailConfiguration.tsx` using `useRoleMatrix()` because it currently has no page-level access protection.
- Keep the existing permission-driven guards on the other admin pages.
- Update the “Only administrators…” messages to permission-based wording so the UI matches the real access model.

4. Update admin-only backend actions
- Change `admin_update_user_password(...)` so users with `user_management` can reset passwords too.
- If needed, add a permission check inside `supabase/functions/test-smtp/index.ts` so only users with `email_config` can test mail settings.

5. Verify end to end
- Quality user with `role_access`: can assign screen permissions and save without RLS errors.
- User with `user_management`: can view all user data and create/edit/delete/reset password like admin.
- Users assigned Plant / Role / Workflow / Email Configuration: can fully manage those modules.
- Users without the assigned admin tab remain blocked from direct routes and writes.

Technical details
- Reuse the existing `public.has_screen_access(_user_id, _screen_key)` SECURITY DEFINER helper.
- Keep permissions scoped per admin tab instead of giving broad admin rights.
- Protect sensitive tables (`user_security`, `password_history`) only for users with `user_management`.
- Do not manually edit auto-generated Supabase client/types files.

Files / migration to update
- New database migration for RLS + function updates
- `src/pages/EmailConfiguration.tsx`
- `src/pages/UserManagement.tsx`
- `src/pages/DepartmentManagement.tsx`
- `src/pages/PlantManagement.tsx`
- `src/pages/WorkflowRoutingConfig.tsx`
- `src/pages/RoleMatrix.tsx` (only for copy/alignment if needed)
- `supabase/functions/test-smtp/index.ts` (if function-level permission enforcement is required)
