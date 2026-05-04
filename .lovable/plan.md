# Resolve FK error on `sap_api_response_fields` seed

## Current state (verified against live DB)

- `public.zmrb_inward_report` — exists with all columns, RLS policies, `update_updated_at_column` trigger and indexes on `plant` / `material_code`.
- `public.sap_api_config` row `f1ac85d4-ca04-497a-bed6-1f509d10b4c2` (`ZMRB_Inward_Process`) — exists.
- `public.sap_api_response_fields` — already has **30 rows** for that `config_id` (the 26 you intended to insert plus a few extras that were there previously).
- `public.sap_api_request_fields` — already has **8 rows** for that `config_id` (matches what you intended to insert).

Conclusion: the FK error `23503` you pasted is from a prior run where the parent `sap_api_config` row didn't exist yet in that environment. In the **current Lovable Cloud DB**, everything is in place — no migration is needed.

## What I will do (build mode)

1. Run a final verification query to print:
   - count of rows in `zmrb_inward_report`,
   - the response/request field counts for config `f1ac85d4-…`,
   - and confirm the `ZMRB_Inward_Process` config is `is_active = true`.
2. Report results back. No schema migration, no destructive inserts.

## Optional: safe re-runnable seed for other environments

If you need to re-apply this on a fresh DB (self-hosted / new clone), use this guarded version. It (a) inserts the parent config first if missing, (b) uses `ON CONFLICT (config_id, sap_field_name) DO NOTHING` style guards so re-runs are safe.

```sql
-- 1. Ensure parent config exists
INSERT INTO public.sap_api_config (id, config_name, description, api_endpoint, http_method, auth_type, is_active)
VALUES (
  'f1ac85d4-ca04-497a-bed6-1f509d10b4c2',
  'ZMRB_Inward_Process',
  'ZMRB04 - Inward Inspection Report',
  'http://10.10.6.115:8000/mrb/inward/report?sap-client=234',
  'GET', 'basic', true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Then run the response/request field INSERTs
--    (unchanged from your script, ON CONFLICT DO NOTHING already present)
```

Note: your existing `ON CONFLICT DO NOTHING` only fires on a real unique/PK conflict. If `sap_api_response_fields` has no unique constraint on `(config_id, sap_field_name)`, running the seed twice will create duplicates. If you want re-runs to be truly idempotent on other envs, we can add a unique index — say so and I'll include it as a separate migration.

## Why the original FK error happened

`sap_api_response_fields.config_id` has a `FOREIGN KEY → sap_api_config(id)`. The child INSERT in your script ran before the parent row `f1ac85d4-…` existed in that environment, so PostgreSQL rejected it with `23503`. In the current DB the parent now exists, so a re-run would succeed (but as noted above, all 30 + 8 child rows are already present).

## Verification after approval

I'll run:

```sql
SELECT
  (SELECT count(*) FROM zmrb_inward_report) AS zmrb_rows,
  (SELECT count(*) FROM sap_api_response_fields WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2') AS resp_fields,
  (SELECT count(*) FROM sap_api_request_fields  WHERE config_id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2') AS req_fields,
  (SELECT is_active FROM sap_api_config WHERE id='f1ac85d4-ca04-497a-bed6-1f509d10b4c2') AS config_active;
```

and paste the result.

## Out of scope

- No code changes to `useDynamicFields`, edge functions, or UI — `zmrb_inward_report` is already in `BASE_COLUMNS` and the dynamic-field machinery already supports it.
- No new unique constraint on `sap_api_response_fields` unless you ask for it.
