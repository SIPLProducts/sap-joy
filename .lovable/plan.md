

## Consolidated Migration File for Self-Hosted Linux Server

### What this does
Generates a single SQL file containing all 8 migrations from today (April 10), consolidated and made idempotent with `IF NOT EXISTS` / `IF EXISTS` guards so it's safe to run on your self-hosted Supabase.

### Migration file contents (in order)
1. Add `batch` and `storage_location` columns to `mrb_records`
2. Enforce `employee_id` NOT NULL + unique index + updated `handle_new_user` trigger
3. Create `get_email_by_employee_id` RPC function
4. Convert `app_role` enum to `text` across all tables, drop/recreate ~25 RLS policies and functions (`has_role`, `get_user_role`, `admin_update_user_password`)
5. Create `smtp_config` table + add `to_emails/cc_emails/to_roles/cc_roles` to `email_templates`
6. Create `has_screen_access` function + permission-driven RLS policies on 10 tables
7. Final `admin_update_user_password` with bcrypt cost factor 10

### Output
- Single file: `/mnt/documents/migration_20260410_consolidated.sql`
- Run on your server: `psql -U postgres -d postgres -f migration_20260410_consolidated.sql`
  (adjust connection params for your self-hosted setup)

### Frontend changes (not in migration)
These are code-only — pull latest code and rebuild:
- Block Reason display in Create MRB form
- Hide `mrb_created` records from Inward Report
- Submit bar width fix
- Batch No. display + persistence in MRB creation/detail views

### Steps
1. Write the consolidated SQL to `/mnt/documents/migration_20260410_consolidated.sql`
2. Verify the file content
3. Provide deployment instructions

### Important
- **Backup your database first** before running
- The enum-to-text conversion (step 4) is the most impactful — it drops and recreates ~25 RLS policies
- After running the migration, rebuild the frontend: `npm ci && npm run build`

