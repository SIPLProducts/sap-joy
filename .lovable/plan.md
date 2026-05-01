## Problem

The screenshot shows the **Available Stock** table on `/shop-floor/stock-selection` with only 9 columns (All, Plant, Material, Description, Batch, SLoc, Available Qty, UoM, Source). The 5 new MB52 fields requested earlier — **Vendor Code, Vendor Name, GRN No, GRN Item, GRN Date** — are not displayed.

On inspection, the previous round of changes only updated:
- `ShopFloorStockSelection.tsx` → `handleProceed` payload (passes the 5 fields onward) ✓
- `ShopFloorMaterialBlocking.tsx` → form display + MRB persistence ✓
- `ShopFloorMRBDetail.tsx` → worklist details display ✓

But the **table headers and row cells** in `ShopFloorStockSelection.tsx` (lines 537–578) were never actually updated. That's the visible gap.

## Fix

**File:** `src/pages/ShopFloorStockSelection.tsx`

1. **Add 5 `<TableHead>` cells** in the header row after `SLoc` (line 541) and before `Available Qty`, in the requested order:
   - Vendor Code
   - Vendor Name
   - GRN No
   - GRN Item
   - GRN Date

2. **Add 5 matching `<TableCell>` entries** in the body row after the SLoc cell (line 569) and before the Available Qty cell, reading from the live SAP record fields (which use the `map_to_column` keys configured in API Settings):
   - `stock.vendor_code`
   - `stock.vendor_name`
   - `stock.grn_no`
   - `stock.grn_item`
   - `stock.grn_date`
   - All with fallback `'-'` when null/empty.

These are the same field names already consumed by `handleProceed`, so the table will show whatever the configured MB52 mapping returns from SAP.

## Out of Scope / Already Working

- Material Blocking form, MRB save, and MRB Detail page — already display the 5 fields correctly.
- No DB / edge-function / type changes required.

## QA After Implementation

1. Reload `/shop-floor/stock-selection`, run a search → confirm 14 columns visible: All, Plant, Material, Description, Batch, SLoc, **Vendor Code, Vendor Name, GRN No, GRN Item, GRN Date**, Available Qty, UoM, Source.
2. If the new columns show "-" for every row, the user needs to verify the MB52 response field mappings (`map_to_column` values) in SAP API Settings match `vendor_code`, `vendor_name`, `grn_no`, `grn_item`, `grn_date`.
