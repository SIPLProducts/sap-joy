## Problem

The SAP `ZMRB_Inward_Process` (ZMRB04) sync says it inserted 3 records and the rows do exist in `zmrb_inward_report`, but on the **MRB Inward InProcess** screen the new ZMRB04-specific columns — **Production Order (AUFNR), Work Center (ARBPL), Order Type (AUART), Confirmation Date (RUECK)** — and **Vendor Code/Name** are blank.

## Root cause

The sync runs in `supabase/functions/sap-sync/handler.ts`. For each table it sanitizes incoming rows against two hardcoded maps:

- `allowedColumnsByTable.zmrb_inward_report` — allow-list of writable columns
- `aliasMapByTable.zmrb_inward_report` — case-insensitive aliases (e.g. `werk → plant`)

The user's **SAP API Settings → Response Fields** for `ZMRB_Inward_Process` correctly map:
- `AUFNR → production_order_no`
- `ARBPL → work_center`
- `AUART → order_type`
- `RUECK → confirmation_no`
- `SELLIFNR → vendor_code`
- `NAME1 → vendor_name`

But none of `production_order_no`, `work_center`, `order_type`, `confirmation_no` are in the handler's `allowedColumnsByTable.zmrb_inward_report` set. At line 1246 the sanitizer does `if (!allowedColumns.has(normalizedColumn)) return`, so these values are silently dropped before the upsert — that is why the columns persist as `NULL` in the DB and render blank in the UI even though the SAP response contains them.

DB confirms it: all four currently-synced rows have `production_order_no = NULL`, `work_center = NULL`, `order_type = NULL`, `confirmation_no = NULL`.

`SELLIFNR` and `NAME1` happen to be empty in the SAP response itself, so even though their mappings are correct, the columns will stay blank for these specific rows. No fix needed — but the alias for `sellifnr → vendor_code` is already present, so future rows with vendor data will populate.

## Fix

Edit `supabase/functions/sap-sync/handler.ts`:

1. Extend `allowedColumnsByTable.zmrb_inward_report` to include the four production columns:

   ```ts
   zmrb_inward_report: new Set([
     'inspection_lot', 'material_code', 'material_description', 'plant', 'storage_location',
     'batch', 'uom', 'blocked_quantity', 'transaction_quantity', 'status', 'block_reason',
     'vendor_code', 'vendor_name', 'po_number', 'po_item_number', 'grn_number',
     'uploaded_by', 'upload_batch_id',
     'inspection_date', 'posting_date', 'grn_item_no', 'grn_date', 'source',
     'production_order_no', 'work_center', 'order_type', 'confirmation_no',
   ]),
   ```

2. Extend `aliasMapByTable.zmrb_inward_report` so future configs that map by raw SAP code (rather than directly to the column name) still resolve correctly:

   ```ts
   aufnr: 'production_order_no',
   arbpl: 'work_center',
   auart: 'order_type',
   rueck: 'confirmation_no',
   ```

3. Deploy `sap-sync` and trigger one manual sync from **SAP API Settings → ZMRB_Inward_Process → Run Sync** (or wait for the 5-minute scheduler). Since the upsert uses `onConflict: 'inspection_lot'`, the existing rows will be updated in place — no DB cleanup needed.

## Verification

After the next sync:

- DB: `select inspection_lot, production_order_no, work_center, order_type, confirmation_no from zmrb_inward_report;` should show populated values for rows where the SAP payload had them (e.g. `AUFNR=6000008627`, `ARBPL=EMUTEST`, `AUART=ZPEL`, `RUECK=752113`).
- UI: open `/inward/inprocess` — the **Production Order**, **Work Center**, **Order Type**, **Confirmation Date** columns will display values instead of `-`.
- Vendor Code / Vendor Name will remain blank for the current 4 rows because SAP returned them empty; they will populate automatically when SAP returns non-empty `SELLIFNR` / `NAME1`.

## Out of scope

- No DB migration. The columns already exist on `zmrb_inward_report`.
- No frontend changes. `InwardInProcessReport.tsx` and `InwardInProcessMRBContext.tsx` already read and render these fields; they were just always `NULL`.
- No change to `sap_api_response_fields` data — the user's mappings are already correct.
- No change to the `inward_inspection_lots` allow-list (Inward Materials / ZMRB01 path is unaffected).
