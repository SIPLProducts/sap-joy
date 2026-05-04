The error on self-hosted happens because the SQL inserts rows into `sap_api_response_fields` / `sap_api_request_fields` before the matching parent row exists in `sap_api_config`.

Plan:

1. Provide a corrected self-hosted SQL script order:
   - create/alter `zmrb_inward_report` first,
   - insert the parent `sap_api_config` row for `f1ac85d4-ca04-497a-bed6-1f509d10b4c2`,
   - then insert response fields,
   - then insert request fields.

2. Make the script safe for self-hosted re-runs:
   - use `INSERT ... ON CONFLICT (id) DO UPDATE` for the parent config,
   - use `WHERE NOT EXISTS` around child field inserts so duplicates are not created even if there is no unique constraint on `(config_id, sap_field_name)`,
   - keep `ART` default as `04`.

3. Include a verification query for SQL Editor:
   - checks that the config exists and is active,
   - counts response fields and request fields,
   - confirms the new table exists.

4. No app UI/code changes are needed unless you want me to add this as a new self-hosted migration file in the repository after approval.

Technical detail:

Your current script has a foreign-key dependency:

```text
sap_api_config.id
   ↓ referenced by
sap_api_response_fields.config_id
sap_api_request_fields.config_id
```

So this parent row must exist first:

```sql
INSERT INTO public.sap_api_config (id, config_name, api_endpoint, auth_type, is_active)
VALUES (
  'f1ac85d4-ca04-497a-bed6-1f509d10b4c2',
  'ZMRB_Inward_Process',
  'http://10.10.6.115:8000/mrb/inward/report?sap-client=234',
  'basic',
  true
)
ON CONFLICT (id) DO UPDATE SET
  config_name = EXCLUDED.config_name,
  api_endpoint = EXCLUDED.api_endpoint,
  auth_type = EXCLUDED.auth_type,
  is_active = EXCLUDED.is_active,
  updated_at = now();
```

After that, the child inserts for `sap_api_response_fields` and `sap_api_request_fields` will not fail with `23503`.