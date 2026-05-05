## Findings

The cloud scheduler fix was applied in `supabase/functions/sap-sync-scheduler/index.ts`, but self-hosted manual sync does not use that code path from the browser. In self-hosted mode, `invokeSapSync()` routes to the client-side direct sync path in `src/lib/sapSyncClient.ts`.

That self-hosted client-side mapper still only supports:
- `shop_floor_stock`
- `inward_inspection_lots`

So when the `ZMRB_Inward_Process` API maps rows to `zmrb_inward_report`, the self-hosted mapper treats it as unsupported and does not insert the fetched rows. This explains why cloud-side code changes did not fix insertion in your self-hosted instance.

I also found that the current migration set has partial in-process migrations, but self-hosted still needs a consolidated, idempotent SQL patch because:
- `deploy/seed-data.sql` does not seed `ZMRB_Inward_Process` or `Result_Recording_View`.
- `20260430090946...` seeds fields for `ZMRB_Inward_Process`, but does not insert/update the `sap_api_config` row itself.
- Result Recording config/data exists in cloud, but no project migration currently seeds it for self-hosted.

## Plan

### 1. Fix self-hosted browser/manual sync insertion

Update `src/lib/sapSyncClient.ts` in `mapAndInsertClientSide()` to support `zmrb_inward_report`, matching the already-fixed scheduler logic:

- Add `zmrb_inward_report` to `allowedColumnsByTable`.
- Add alias mappings for in-process SAP fields:
  - `PRUEFLOS -> inspection_lot`
  - `MATNR -> material_code`
  - `WERK/WERKS -> plant`
  - `CHARG -> batch`
  - `LGORT -> storage_location`
  - `LMENGE04/MENGE -> blocked_quantity`
  - `QTY -> transaction_quantity`
  - `AUFNR -> production_order_no`
  - `ARBPL -> work_center`
  - `AUART -> order_type`
  - `RUECK -> confirmation_no`
  - customer/sales fields as already defined in the scheduler
- Add required fields for this table: `inspection_lot`, `material_code`, `plant`.
- Default `status = 'pending'` and `source = 'sap_api'`.
- Upsert into `zmrb_inward_report` using `onConflict: 'inspection_lot'`.
- Count inserted vs updated by pre-fetching existing `inspection_lot` keys, like the scheduler does.

### 2. Add missing self-hosted migration SQL

Create a new migration file under `supabase/migrations/` that is safe to run on self-hosted even if some pieces already exist.

It will include:

- Ensure `zmrb_inward_report` table exists with all required columns.
- Ensure the 8 newer columns exist:
  - `production_order_no`
  - `work_center`
  - `order_type`
  - `confirmation_no`
  - `customer_code`
  - `customer_name`
  - `sales_order`
  - `sales_item`
- Ensure unique index/constraint support for `upsert(... onConflict: 'inspection_lot')`.
- Ensure RLS is enabled and policies exist for authenticated CRUD.
- Ensure `mrb_source` has `inprocess` value.
- Ensure `ZMRB_Inward_Process` API config exists/updates with cloud values.
- Ensure request fields for `ZMRB_Inward_Process` exist/update.
- Ensure response fields for `ZMRB_Inward_Process` exist/update and map to `zmrb_inward_report`.
- Ensure `Result_Recording_View` API config exists/updates with cloud values.
- Ensure request/response fields for `Result_Recording_View` are seeded from the current cloud configuration.
- Ensure `inward_inprocess` role permissions are present for existing roles.

Where possible this migration will use idempotent `CREATE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO UPDATE`, and `DO $$` blocks so it can be applied repeatedly.

### 3. Generate a standalone SQL artifact for self-hosted

Create a downloadable SQL file in `/mnt/documents/`, for example:

`selfhost_missing_inprocess_result_recording_patch.sql`

This will contain the same database patch as the migration, so you can apply it directly to self-hosted Supabase using `psql` or the SQL editor.

### 4. Update deployment guidance/scripts where needed

Review and fix the self-hosted deploy path inconsistency:

- Some scripts use `/opt/MRB`.
- Others use `/opt/MRB_NEW`.

If this inconsistency affects applying migrations or restarting the scheduler, I will update the scripts so migrations and function/code changes are applied from the correct app directory consistently.

### 5. Provide exact self-hosted commands

After implementation, I will give you the exact commands to run on the self-hosted server, including:

```bash
psql "$SUPABASE_DB_URL" -f /path/to/selfhost_missing_inprocess_result_recording_patch.sql
sudo bash /opt/MRB/scripts/setup-db.sh
sudo bash /opt/MRB/scripts/restart.sh
pm2 logs mrb-scheduler --lines 100
```

I will also include the verification SQL to confirm:

- `zmrb_inward_report` table and columns exist.
- the unique index exists.
- `ZMRB_Inward_Process` config exists.
- mapped response field count is correct.
- recent sync history error details show whether rows were inserted or dropped.

## Expected result

After this is applied to self-hosted:

- Triggering `ZMRB_Inward_Process` should insert/update rows in `zmrb_inward_report`.
- If SAP returns 5 new rows, result should become similar to:

```text
Fetched: 5, Inserted: 5, Updated: 0
```

If the same 5 inspection lots already exist, result should become:

```text
Fetched: 5, Inserted: 0, Updated: 5
```

If it still does not insert, the sync history error will now explicitly show which required fields are missing instead of silently skipping rows.