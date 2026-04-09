
## Plan: Fix Remaining Multi-Selection Bug on Material Blocking Screen

### What’s actually happening
The earlier row-click fix was correct, but it did not solve the real remaining bug.

This screen is running through Lovable Cloud, so MB52 data is coming from the backend `fetch_live` path. In that path, the returned rows do not guarantee a unique row `id`. That means multiple rows can share the same `stock.id` value, or have no usable id at all. Because the page uses `stock.id` for both React row keys and checkbox state, one click can mark several rows as selected.

This also matches the console warning about non-unique `key` props.

### Changes

1. **Fix live MB52 row mapping in `supabase/functions/sap-sync/index.ts`**
   - guarantee a unique internal id for every returned stock row
   - normalize the response shape so it matches what the page expects (`plant`, `material_code`, `batch`, `storage_location`, `available_quantity`, etc.)
   - keep numeric quantity conversion and default metadata (`source`, `status`, `created_at`)

2. **Make the UI defensive in `src/pages/ShopFloorStockSelection.tsx`**
   - stop depending only on raw `stock.id`
   - add a stable row-key helper with fallback logic
   - use that same key for:
     - React table row keys
     - individual checkbox selection
     - “All” checkbox on the current page
     - selected-row highlighting
     - selected-row lookup for Block and Proceed actions

3. **Keep selection count aligned with actual rows**
   - derive selected row data from the same stable key logic so one click always means one selected row

4. **Verify the exact user flow**
   - search stock on the Material Blocking screen
   - click one checkbox and confirm only that row gets selected
   - test repeated material rows to confirm they no longer select together
   - test the header “All” checkbox for current page only
   - confirm the React unique-key warning is gone

### Result
- one checkbox selects only one row
- repeated SAP rows no longer share selection state
- bulk blocking runs only for the rows the user actually selected
- cloud behavior becomes consistent and reliable
