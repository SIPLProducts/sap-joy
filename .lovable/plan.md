## Goal

Persist the superadmin database changes as a versioned migration in `supabase/migrations/` so they apply automatically:
- On Lovable Cloud (via the migration tool)
- On the self-hosted Linux server (picked up by `deploy/setup-db.sh` which iterates `supabase/migrations/*.sql` and tracks them in `_migrations`)

## New migration file

`supabase/migrations/<timestamp>_superadmin_full_access.sql` containing:

1. **Insert `Super Administrator` department** (idempotent via `ON CONFLICT (role_key) DO NOTHING`, falling back to `WHERE NOT EXISTS` if no unique constraint).
   ```sql
   INSERT INTO public.departments
     (name, role_key, description, is_active, is_workflow_enabled, workflow_status)
   SELECT 'Super Administrator', 'superadmin',
          'Full system access with all-plant visibility',
          true, false, NULL
   WHERE NOT EXISTS (
     SELECT 1 FROM public.departments WHERE role_key = 'superadmin'
   );
   ```

2. **`CREATE OR REPLACE FUNCTION public.has_role`** — superadmin satisfies any role check.

3. **`CREATE OR REPLACE FUNCTION public.has_screen_access`** — superadmin gets every screen except `sap_api_settings` and `sap_sync_monitor`.

4. **`CREATE OR REPLACE FUNCTION public.user_has_plant`** — superadmin sees every plant (in addition to existing masteradmin/user_plants checks).

All four steps are idempotent and safe to re-run.

## Why this works on the self-hosted server

`deploy/setup-db.sh` already:
- Reads `$APP_DIR/supabase/migrations/*.sql` in sorted order
- Skips files already recorded in `public._migrations`
- Applies new ones in a single transaction and records them

So once this file is committed and the server is updated (rsync + `setup-db.sh`), the migration runs automatically. No manual SQL needed.

## Out of scope

- No code changes (frontend already handles superadmin correctly).
- No edits to existing migration files (they are read-only by convention).
