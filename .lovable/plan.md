

## Fix: ZEILE and BLDAT values not persisting during SAP sync

### Root Cause

Both SAP sync edge functions (`sap-sync/handler.ts` and `sap-sync-scheduler/index.ts`) have two problems preventing ZEILE and BLDAT from being stored:

1. **Missing from allowed columns whitelist** — `grn_item_no` and `grn_date` are not in the `allowedColumnsByTable.inward_inspection_lots` Set, so even when the field mapping resolves correctly, the values are silently dropped at the whitelist check.

2. **Missing from alias map** — `zeile` → `grn_item_no` and `bldat` → `grn_date` are not in the `aliasMapByTable.inward_inspection_lots` dictionary, so even if the user configured `map_to_column` as `grn_item_no`, the SAP key aliases aren't recognized.

### Changes

**1. `supabase/functions/sap-sync/handler.ts`**
- Add `'grn_item_no', 'grn_date'` to the `allowedColumnsByTable.inward_inspection_lots` Set (line ~1049)
- Add `zeile: 'grn_item_no', bldat: 'grn_date'` to the `aliasMapByTable.inward_inspection_lots` object (line ~1077)

**2. `supabase/functions/sap-sync-scheduler/index.ts`**
- Add `'grn_item_no', 'grn_date'` to the `allowedColumnsByTable.inward_inspection_lots` Set (line ~748)
- Add `zeile: 'grn_item_no', bldat: 'grn_date'` to the `aliasMapByTable.inward_inspection_lots` object (line ~774)

Both edge functions will be redeployed after the changes.

### Files to modify
1. `supabase/functions/sap-sync/handler.ts`
2. `supabase/functions/sap-sync-scheduler/index.ts`

No database changes needed — columns already exist from the previous migration.

