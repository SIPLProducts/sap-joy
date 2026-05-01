## Problem

On the **MRB - Inward InProcess** screen, after the 20 friendly columns (Inspection Lot, Material Code, …, Confirmation Date) the table appends a second strip of columns whose headers read as raw SAP codes:

`PRUEFLOS WERK ENSTEHDAT AUFNR MATNR SELLIFNR MBLNR CHARG LGORT EBELN EBELP BUDAT_MKPF SGTXT MENGENEINH LMENGE04 MAKTX NAME1 QTY GRN_ITEM_NO AUART GRN_DATE ARBPL RUECK`

These are duplicates — every one of them is already shown in the 20 friendly columns.

## Root cause

`src/pages/InwardInProcessReport.tsx` renders the friendly columns first, then loops over `extraFields` from `useExtraDynamicFields('zmrb_inward_report')` to append "extra" SAP fields configured in **SAP API Settings → Fields**.

The filter that decides what is "extra" lives in `src/hooks/useDynamicFields.ts` and uses a `BASE_COLUMNS` allow-list per table. The map currently has entries for `inward_inspection_lots` and `shop_floor_stock` but **no entry for `zmrb_inward_report`**. Result: every mapped column on `zmrb_inward_report` is treated as "extra" and re-rendered with its raw SAP `field_name` as the header.

The Inward Materials report does not show the duplicates because `inward_inspection_lots` is in the allow-list.

## Fix

Add a `zmrb_inward_report` entry to `BASE_COLUMNS` listing every column the InProcess report already renders, so the dynamic engine excludes them from `extraFields`.

### File to change

**`src/hooks/useDynamicFields.ts`** — extend `BASE_COLUMNS` with:

```ts
zmrb_inward_report: new Set([
  'id', 'inspection_lot', 'material_code', 'material_description',
  'plant', 'storage_location', 'batch',
  'blocked_quantity', 'transaction_quantity', 'uom',
  'inspection_date', 'posting_date', 'block_reason',
  'vendor_code', 'vendor_name',
  'production_order_no', 'work_center', 'order_type', 'confirmation_no',
  'po_number', 'po_item_number', 'grn_number', 'grn_item_no', 'grn_date',
  'status', 'source', 'upload_batch_id', 'uploaded_by',
  'created_at', 'updated_at',
]),
```

That's the entire fix. After this change `extraFields.length` becomes 0 for the InProcess report (until a genuinely new SAP field is added in SAP API Settings that maps to a column outside this set), so:

- The duplicate header strip disappears.
- The duplicate cell strip disappears.
- The empty-state `colSpan` (`19 + extraFields.length`) collapses to its base value automatically — no other math to update.
- The dynamic engine still works: any future field someone adds via SAP API Settings that maps to a brand-new column will continue to be appended as a real "extra" column.

## Out of scope

- No changes to the Worklist or MRB Detail (those screens don't use the dynamic-extras renderer).
- No DB migration, no changes to `sap_api_response_fields`, no edits to the auto-generated `types.ts`.
- The Inward Materials report is unaffected (its allow-list is already correct).
