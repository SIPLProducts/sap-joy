## Add ZMRB Inward Report API → New Table + Sync Monitor Support

### Goal
The new SAP API config `ZMRB_Inward_Inspection_Report` (id `f1ac85d4-…`) should:
1. Have response field mappings identical to the existing `ZMRB_Inward_Inspection`.
2. Sync into a brand-new dedicated table `zmrb_inward_report` (same schema as `inward_inspection_lots`).
3. Be syncable from the SAP Sync Monitor UI (Test + Sync Now + history + data preview), auto-detected by config name.

---

### 1. Database migration — create `zmrb_inward_report`

Create the new table mirroring `inward_inspection_lots` exactly, plus RLS:

- Columns (same as `inward_inspection_lots`): `id`, `inspection_lot`, `material_code`, `material_description`, `plant`, `storage_location`, `batch`, `blocked_quantity`, `transaction_quantity`, `uom`, `inspection_date`, `posting_date`, `block_reason`, `vendor_code`, `vendor_name`, `po_number`, `po_item_number`, `grn_number`, `grn_item_no`, `grn_date`, `status` (default `'pending'`), `source`, `upload_batch_id`, `uploaded_by`, `created_at`, `updated_at`.
- Unique constraint on `inspection_lot` (for upsert deduplication, same pattern as the existing table).
- RLS: same 4 authenticated SELECT/INSERT/UPDATE/DELETE policies as `inward_inspection_lots`.
- `updated_at` trigger using existing `update_updated_at_column()`.

### 2. Seed response field mappings for the new config

Insert ~25 rows into `sap_api_response_fields` for `config_id = f1ac85d4-ca04-497a-bed6-1f509d10b4c2`, copying every row currently mapped under config `a1000001-…-000000000004` but with `map_to_table = 'zmrb_inward_report'` instead of `inward_inspection_lots`. Unmapped fields (AUFNR, KDAUF, EKORG, GROUP, GNAME, LGOBE, CH) are copied as-is with NULL mappings, matching existing behaviour.

Also seed request fields (WERKS=1300 required, ART=04 required, plus optional LGORT/PRUEFLOS/MATNR/LIFNR/ZEILE/BLDAT) for the new config so it actually returns data — currently it has none.

### 3. Sync handler — register the new table

Edit `supabase/functions/sap-sync/handler.ts`:

- Add `zmrb_inward_report` to `allowedColumnsByTable` (same column set as `inward_inspection_lots`).
- Add it to `requiredColumnsByTable` with `['inspection_lot', 'material_code', 'plant']`.
- Add an alias map block identical to `inward_inspection_lots`.
- Add upsert option: `tableName === 'zmrb_inward_report' ? { onConflict: 'inspection_lot' } : …`.
- In the per-table normalisation block, default `status` to `'pending'` for `zmrb_inward_report` (same as inspection lots).

No changes to record-fetching/auth/proxy logic — it's already config-driven.

### 4. SAP Sync Monitor UI — auto-detect the new API

Edit `src/pages/SAPSyncMonitor.tsx`:

- Add a `fetchAllRows('zmrb_inward_report')` call alongside the existing `inward_inspection_lots` fetch.
- Push a new `DataPreview`: `'ZMRB Inward Report'` with row count + recent records.
- Add a helper `isReportConfig(cfg)` that returns true when `config_name` includes `report` (case-insensitive). The existing Test / Sync Now / history rendering already iterates `configs`, so the new card and buttons will appear automatically once the config is loaded — no extra JSX wiring needed.
- Sync history filter: existing logic keys on `config_id`, so the new sync runs will show up in the per-config history dropdown without changes.

### 5. Scheduler (optional, for future auto-sync)

`sap-sync-scheduler` already iterates configs with `scheduler_enabled = true`. No code change needed; an admin can simply tick "Scheduler Enabled" on the new config in SAP API Settings to have it run every 5 min.

---

### Technical notes

- Table choice driven solely by `sap_api_response_fields.map_to_table`, so once the mappings in step 2 point to `zmrb_inward_report`, the same handler routes records there.
- Upsert key `inspection_lot` mirrors existing dedup behaviour and matches memory `Inward Inspection Lot Deduplication`.
- No changes to MRB workflow, dashboards, or any consumer of `inward_inspection_lots` — the new table is purely a parallel store for report-style data.
- Edge function is auto-deployed; no manual redeploy.
- Self-hosted production server will need the SQL migration re-run (same pattern noted in the user-deletion fix).

### Files touched

- New SQL migration (creates `zmrb_inward_report` + RLS + trigger + seeds request/response field rows for config `f1ac85d4-…`).
- `supabase/functions/sap-sync/handler.ts` — register new table in allowed/required/alias/upsert blocks.
- `src/pages/SAPSyncMonitor.tsx` — preview + auto-detect for report configs.

### Acceptance criteria

- `ZMRB_Inward_Inspection_Report` appears as a card in SAP Sync Monitor with working Test Connection and Sync Now buttons.
- Clicking Sync Now fetches data from `/mrb/inward/report?sap-client=234` with `ART=04`, parses the response, and inserts/upserts into `public.zmrb_inward_report`.
- A "ZMRB Inward Report" data preview card shows the live row count and most recent records.
- Sync history filter dropdown includes the new config; per-run rows show records_inserted/updated.
- No regression to the existing ZMRB_Inward_Inspection sync into `inward_inspection_lots`.
