

## Plan: Fix Checkbox Default Selection + Add Block Button with SAP 344 API

### Problem
1. All checkboxes appear selected by default on the Material Blocking screen
2. No multi-select capability — currently single-select only
3. No "Block" button that triggers SAP 344 API directly from this screen

### Current Behavior
- `selectedStock` is a single `ShopFloorStockRecord | null` — acts like a radio button
- Checkbox `checked` compares against `selectedStock?.id === stock.id` — nothing is checked by default (no bug there, but user reports otherwise)
- "Proceed to Block" navigates to a separate form page — doesn't call SAP 344

### Changes — Single file: `src/pages/ShopFloorStockSelection.tsx`

**1. Change from single-select to multi-select**
- Replace `selectedStock: ShopFloorStockRecord | null` with `selectedStocks: Set<string>` (set of IDs)
- Add `selectedStocksData: ShopFloorStockRecord[]` derived from the set for payload building
- Checkbox `checked` = `selectedStocks.has(stock.id)`
- Add "Select All" / "Deselect All" checkbox in the table header
- Ensure nothing is selected by default (empty Set on search)

**2. Add "Block Selected" button in the results header**
- Show button only when `selectedStocks.size > 0`
- Display count: "Block (3 items)"
- Button triggers a confirmation dialog with posting date picker (same pattern as Worklist's 343 dialog)

**3. Add SAP 344 blocking logic**
- On confirm, iterate over selected items and call `invokeSapSync` with `action: 'unblock'` but targeting the 344 config (dynamically resolved by searching for '344' in config name/endpoint)
- Build payload per item: `MATNR`, `WERKS`, `LGORT`, `CHARG`, `ENTRY_QNT`, `ENTRY_UOM`, `BUDAT` (YYYYMMDD format)
- Show progress: "Blocking 1/3..." with a loading state
- On success: show toast with SAP Material Document number, update `shop_floor_stock` status
- On failure: show error toast with SAP error details

**4. Add posting date dialog**
- Reuse the same AlertDialog pattern from Worklist
- Default to today's date
- Format as YYYYMMDD for SAP BUDAT field

**5. Keep existing "Proceed to Material Blocking" flow**
- Still available for single item selection to navigate to the detailed MRB creation form
- Multi-select "Block" is for quick SAP 344 blocking without MRB creation

### Technical Details
- SAP 344 config resolved dynamically: query `sap_api_config` where name/endpoint contains '344'
- Uses `invokeSapSync` from `sapSyncClient.ts` (same as Worklist uses for 343)
- Posting date formatted with `YYYYMMDD` (4-digit year fix already applied)

### Result
- Checkboxes are unchecked by default after search
- Users can multi-select items with checkboxes (including Select All)
- "Block Selected" button appears when items are checked, triggers SAP 344 API with posting date confirmation
- Each blocked item gets a SAP Material Document number confirmation

