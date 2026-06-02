## Root cause

The In-Process Materials page reads from `public.zmrb_inward_report` and shows everything in that table for the active plant. Two issues let ZMRB01 (ART=01 / Inward Inspection) data leak in:

1. The `ZMRB_Inward_Inspection` SAP config (ART=01) has 4 response field mappings (`KDAUF`, `KUNNR`, `Name1_cust`, `POSNR`) whose `map_to_table` is set to `zmrb_inward_report` instead of `inward_inspection_lots`. The sync engine (`mapAndInsertClientSide` in `src/lib/sapSyncClient.ts`) writes per-mapping target table, so every ZMRB01 sync inserts partial rows (customer/sales columns only) into the In-Process table.
2. There is no column on `zmrb_inward_report` that distinguishes ART=01 from ART=04, and the page query doesn't filter, so the polluted rows show up after Refresh and after the scheduler runs.

Cloud DB currently has 0 polluted rows, but the self-hosted production DB does — that matches what the user is seeing.

## Fix (3 small changes, surgical)

### 1. Migration — fix the misrouted mappings and clean polluted rows

New file under `supabase/migrations/`:

```sql
-- Remove the 4 ZMRB_Inward_Inspection (ART=01) field mappings that wrongly
-- target zmrb_inward_report. Those columns belong to the In-Process (ART=04)
-- config only.
DELETE FROM public.sap_api_response_fields
WHERE config_id = 'a1000001-0001-0001-0001-000000000004'
  AND map_to_table = 'zmrb_inward_report'
  AND field_name IN ('KDAUF','KUNNR','Name1_cust','POSNR');

-- Clean any ART=01 rows that previously leaked into the In-Process table.
-- Genuine ART=04 rows always carry production_order_no (AUFNR). ART=01 rows
-- inserted from the misrouted mappings had only customer/sales fields and
-- never have a production order, material_code, or inspection_lot from this
-- config's main payload — so we delete rows that don't match the ART=04 shape.
DELETE FROM public.zmrb_inward_report
WHERE production_order_no IS NULL
  AND material_code IS NULL;
```

### 2. `src/contexts/InwardInProcessMRBContext.tsx` — defensive filter

In `fetchData`, append `.not('production_order_no', 'is', null)` to the `zmrb_inward_report` query so that even if a future config ever writes ART=01-shaped rows again, they won't show on this page.

### 3. `src/pages/InwardInProcessReport.tsx` — no change needed

`handleAPISync` already forces `request_overrides: { ART: '04', WERKS: <activePlant>, ... }`, so manual Refresh only triggers ART=04 against the In-Process config. The leak was entirely from the ZMRB01 sync writing into the wrong table; #1 + #2 close it.

## Out of scope

- Posting-date payload logic (already in place)
- "Data not available" toast handling (already in place)
- Other screens (Inward Inspection / ZMRB01 page) — unaffected; ZMRB01 still writes its 19 legitimate fields into `inward_inspection_lots`.
