

# Fix ZMRB01 Data Preview — New Fields Not Mapping

## Problem
You added SLOC and Inspection Lot fields to ZMRB01 config, and the sync reports success/fetched rows, but data preview shows nothing. The root cause is that `inspection_lot` is a **required field** for `inward_inspection_lots` — if SAP returns it under a name like `PRUEFLOS` or `QALS-PRUEFLOS` and the alias map doesn't recognize it, every row gets skipped silently.

## Root Cause (Two Files)

### 1. Alias maps are incomplete
Both `src/lib/sapSyncClient.ts` (client-side sync) and `supabase/functions/sap-sync/index.ts` (edge function sync) have alias maps for `inward_inspection_lots` that only cover `matnr`, `maktx`, `werks`, `charg`. They are missing common SAP field aliases for:
- `inspection_lot` — SAP returns as `PRUEFLOS`, `QALS_PRUEFLOS`, `INSPECTION_LOT`, etc.
- `storage_location` — SAP returns as `LGORT`
- `vendor_code` — SAP returns as `LIFNR`
- `vendor_name` — SAP returns as `NAME1`
- `po_number` — SAP returns as `EBELN`
- `blocked_quantity` — SAP returns as `MENGE` or similar
- `uom` — SAP returns as `MEINS`

### 2. Edge function missing date columns
The edge function's `allowedColumnsByTable.inward_inspection_lots` is missing `inspection_date` and `posting_date` (the client-side was already fixed).

## Changes

### File 1: `src/lib/sapSyncClient.ts`
Expand the `inward_inspection_lots` alias map (around line 507-509) to include all common SAP field name variants:

```typescript
inward_inspection_lots: {
  matnr: 'material_code', maktx: 'material_description', werks: 'plant', charg: 'batch',
  lgort: 'storage_location', prueflos: 'inspection_lot', lifnr: 'vendor_code',
  name1: 'vendor_name', ebeln: 'po_number', meins: 'uom', menge: 'blocked_quantity',
  inspection_lot: 'inspection_lot', storage_location: 'storage_location',
  vendor_code: 'vendor_code', vendor_name: 'vendor_name',
},
```

### File 2: `supabase/functions/sap-sync/index.ts`
1. Add `inspection_date` and `posting_date` to the `allowedColumnsByTable.inward_inspection_lots` set (line 610-614).
2. Expand the `inward_inspection_lots` alias map (line 635-638) with the same SAP field aliases as above.

## Why This Fixes It
Since `inspection_lot` is required but has no alias, SAP's response field (e.g. `PRUEFLOS`) doesn't map to `inspection_lot` — causing every row to be skipped with "missing required fields". Adding the alias makes the mapping work, rows pass validation, and data appears in the preview.

## Verification Step
After deploying, check the sync history error messages — they should no longer show "missing (inspection_lot)" for skipped rows. The Data Preview tab should show the synced records with all fields populated.

