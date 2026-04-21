

## Fix: "Database error deleting user" on production

### Root Cause
Several tables hold foreign keys to `auth.users(id)` **without** `ON DELETE` actions, so PostgreSQL blocks the auth user deletion whenever the user has any activity history:

| Table | Column(s) referencing auth.users |
|---|---|
| `mrb_records` | `created_by`, `quality_approved_by`, `purchase_approved_by`, `engineering_approved_by`, `final_approved_by`, `closed_by` |
| `mrb_attachments` | `uploaded_by` |
| `mrb_approval_history` | `performed_by` |
| `email_logs` | `sent_by` |

The `create-user` edge function only cleans up `password_history`, `user_security`, `user_plants`, `user_roles`, `profiles` — it does NOT touch the audit/transactional tables above. So `auth.admin.deleteUser()` fails with the generic "Database error deleting user" because of the FK violation.

We must NOT delete MRB records / approval history / attachments / email logs (they are business audit data). Instead we should **preserve history** by setting those FK columns to `NULL` on user deletion.

### Fix — Two parts

**1. Database migration: change FKs to `ON DELETE SET NULL`**

For all 9 FK constraints listed above, drop and recreate them as `ON DELETE SET NULL`. The columns are already nullable in the schema (they're optional approval/closure fields, and `created_by`/`performed_by`/`uploaded_by`/`sent_by` will become nullable as part of this change if not already — verified `mrb_records.created_by`, `mrb_attachments.uploaded_by`, `mrb_approval_history.performed_by`, `email_logs.sent_by` are currently `NOT NULL`, so we will also relax them to allow `NULL` so the SET NULL action is valid).

```sql
-- Make audit columns nullable so SET NULL works
ALTER TABLE mrb_records          ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE mrb_attachments      ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE mrb_approval_history ALTER COLUMN performed_by DROP NOT NULL;
ALTER TABLE email_logs           ALTER COLUMN sent_by DROP NOT NULL;

-- Recreate each FK with ON DELETE SET NULL
ALTER TABLE mrb_records DROP CONSTRAINT mrb_records_created_by_fkey,
  ADD CONSTRAINT mrb_records_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
-- ... (same for the other 8 constraints)
```

This preserves all MRB/approval/email history while allowing the auth user to be deleted. Existing RLS policies that compare `auth.uid() = created_by` continue to work for live users; deleted users' rows just show "Unknown user" in the UI (already handled by the frontend, which falls back when no profile is found).

**2. Edge function update (`supabase/functions/create-user/index.ts`)**

Improve the delete branch to:
- Also clean up `mrb_attachments` ownership? **No** — keep as audit. The DB migration handles it via SET NULL.
- Surface a clearer error message including the underlying Postgres error (so future failures are easier to diagnose, instead of the generic "Database error deleting user").
- Wrap the cleanup steps in try/catch and log per-step failures.

### Files changed
- New SQL migration (via the migration tool) — alters the 9 FK constraints + 4 NOT NULL relaxations.
- `supabase/functions/create-user/index.ts` — better error reporting on the delete path.

### Expected result
- Deleting any user (including admins, quality, purchase, engineering users with MRB activity history) succeeds.
- All MRB records, approval history, attachments, and email logs are preserved with the deleted user's foreign key set to `NULL`.
- No data loss, no orphaned rows, no RLS regressions.
- Same fix works on cloud and the self-hosted production server (the migration runs on whichever Supabase the project is connected to; for the self-hosted server you will re-run the same migration).

