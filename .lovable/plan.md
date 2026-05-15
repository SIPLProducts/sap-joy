## Why it's missing

The role dropdown in the Create/Edit User dialog is populated from the `departments` table (active rows whose `role_key` is set). On this backend there is **no row** with `role_key = 'superadmin'`, so the option doesn't render. All the frontend wiring for `superadmin` is already in place:

- Dropdown auto-lists every active department (`UserManagement.tsx`)
- Plant picker is hidden when `superadmin` is selected; per-plant rows are skipped on save
- `superadmin` is filtered out of Role Management, Role Access Matrix, and User Permission Matrix screens
- Full access except `sap_api_settings` and `sap_sync_monitor` (in `useRoleMatrix`)

## Fix

Insert the missing department row:

```sql
INSERT INTO public.departments
  (name, role_key, description, is_active, is_workflow_enabled, workflow_status)
VALUES
  ('Super Administrator', 'superadmin',
   'Full system access with all-plant visibility',
   true, false, NULL)
ON CONFLICT DO NOTHING;
```

After this runs, **Super Administrator** appears in both Create User and Edit User role dropdowns. No code changes are required.

## Note for self-hosted server

The same `INSERT` must be executed on your Linux server's database — Lovable Cloud and your self-hosted Postgres are separate databases, so inserting here does not affect the deployed instance.
