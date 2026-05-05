# Fix: SAP sync for "ZMRB_Inward_Process" (04) returns fetched=N, inserted=0, updated=0

## Root cause

The `ZMRB_Inward_Process` API config maps all its fields to the table **`zmrb_inward_report`**.

But `supabase/functions/sap-sync-scheduler/index.ts` (function `mapAndInsertData`) only knows about 4 tables in its whitelist: `shop_floor_stock`, `inward_inspection_lots`, `materials`, `vendors`.

So when the scheduler sees `map_to_table = 'zmrb_inward_report'`, this branch fires:
```
[scheduler] Table "zmrb_inward_report" not in allowedColumns whitelist, skipping
```
→ records are fetched (5) but never written → `inserted=0, updated=0`.

This is a code gap in the scheduler — same gap exists on cloud, but the cloud edge function code on self-hosted is exactly what needs updating.

## Changes

### 1. `supabase/functions/sap-sync-scheduler/index.ts`

In `mapAndInsertData`:

**a. Add `zmrb_inward_report` to `allowedColumnsByTable`:**
```
zmrb_inward_report: new Set([
  'inspection_lot','material_code','material_description','plant',
  'storage_location','batch','uom','blocked_quantity','transaction_quantity',
  'status','block_reason','vendor_code','vendor_name','po_number','po_item_number',
  'grn_number','grn_item_no','grn_date','inspection_date','posting_date',
  'production_order_no','work_center','order_type','confirmation_no',
  'customer_code','customer_name','sales_order','sales_item',
  'uploaded_by','upload_batch_id','source',
])
```

**b. Add alias map** (mirrors inward_inspection_lots, plus production/customer/sales fields):
```
zmrb_inward_report: {
  matnr:'material_code', maktx:'material_description',
  werks:'plant', werk:'plant', charg:'batch', lgort:'storage_location',
  prueflos:'inspection_lot', lifnr:'vendor_code', name1:'vendor_name',
  ebeln:'po_number', ebelp:'po_item_number', mblnr:'grn_number',
  meins:'uom', mengeneinh:'uom', menge:'blocked_quantity', lmenge04:'blocked_quantity',
  qty:'transaction_quantity', sgtxt:'block_reason',
  enstehdat:'inspection_date', budat_mkpf:'posting_date',
  zeile:'grn_item_no', bldat:'grn_date',
  aufnr:'production_order_no', arbpl:'work_center', auart:'order_type',
  rueck:'confirmation_no', kunnr:'customer_code', name1_cust:'customer_name',
  vbeln:'sales_order', posnr:'sales_item',
}
```

**c. Add required-field rule** (same minimum keys as inward_inspection_lots):
```
zmrb_inward_report: ['inspection_lot','material_code','plant'],
```

**d. Add upsert branch for `zmrb_inward_report`** (mirrors the `inward_inspection_lots` branch — pre-fetch existing `inspection_lot`s, count new vs updated, then `.upsert(batch, { onConflict: 'inspection_lot', ignoreDuplicates: false })`).

Default `row.status ||= 'pending'` and `row.source ||= 'sap_api'` before insert.

### 2. Self-hosted DB prerequisite

For the upsert `onConflict: 'inspection_lot'` to work, `zmrb_inward_report.inspection_lot` must have a UNIQUE constraint. Run on self-hosted Supabase SQL editor:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS zmrb_inward_report_inspection_lot_key
  ON public.zmrb_inward_report (inspection_lot);
```
(If you expect the same lot in different plants, switch to a composite key on `(plant, inspection_lot)` and update `onConflict` accordingly.)

## After applying

Re-trigger the ZMRB_Inward_Process sync. The scheduler logs should show:
```
[scheduler] Mapping 5 records to "zmrb_inward_report" using N field mappings
[scheduler] zmrb_inward_report: 5 valid rows, 0 dropped
[scheduler] zmrb_inward_report batch: 5 new, 0 updated
```
and the result becomes `fetched=5, inserted=5, updated=0`.

If you still see drops, check the log line `Sample SAP record keys` to confirm the SAP payload actually contains `PRUEFLOS`, `MATNR`, `WERK`/`WERKS` — those three are the required minimum.
