## Fix: FK error when seeding `zmrb_inward_report` mappings

### Root cause
Your INSERTs into `sap_api_response_fields` and `sap_api_request_fields` use `config_id = f1ac85d4-ca04-497a-bed6-1f509d10b4c2`, which does not exist in `sap_api_config` on production. The existing ZMRB config id on production is **`a1000001-0001-0001-0001-000000000004`** (`ZMRB_Inward_Inspection`).

### Fix
Reuse the existing config id. No new `sap_api_config` row is needed. Just replace every occurrence of `f1ac85d4-ca04-497a-bed6-1f509d10b4c2` in your migration with `a1000001-0001-0001-0001-000000000004`.

### Optional safety
Before the field inserts, add a guard so the migration self-validates:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sap_api_config
                 WHERE id = 'a1000001-0001-0001-0001-000000000004') THEN
    RAISE EXCEPTION 'ZMRB_Inward_Inspection sap_api_config row missing';
  END IF;
END $$;
```

### Cleanup note
If your earlier failed run partially inserted rows under the old id, clean them with:

```sql
DELETE FROM public.sap_api_response_fields WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
DELETE FROM public.sap_api_request_fields  WHERE config_id = 'f1ac85d4-ca04-497a-bed6-1f509d10b4c2';
```
(Likely none, since the FK error rolled the transaction back — but safe to run.)

### Also recommended
Add `ON CONFLICT (config_id, sap_field_name) DO NOTHING` only if you have such a unique index; otherwise plain `ON CONFLICT DO NOTHING` is a no-op (no constraint matches). To make the seed truly idempotent, consider:

```sql
ALTER TABLE public.sap_api_response_fields
  ADD CONSTRAINT sap_api_response_fields_config_field_key
  UNIQUE (config_id, field_name);

ALTER TABLE public.sap_api_request_fields
  ADD CONSTRAINT sap_api_request_fields_config_field_key
  UNIQUE (config_id, field_name);
```
Then `ON CONFLICT (config_id, field_name) DO NOTHING` will properly skip duplicates on re-runs.

### Out of scope
Table creation block for `zmrb_inward_report` already exists in production schema (visible in current schema dump) — re-running it with `IF NOT EXISTS` is harmless. No app code changes needed.
