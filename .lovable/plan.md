## Goal

Surface the new MB52 response fields — **Vendor Code, Vendor Name, GRN No, GRN Item, GRN Date** — through the entire shop-floor flow:

1. Stock Selection table (Material Blocking landing page)
2. Material Blocking form (after selecting an item)
3. Shop Floor MRB Detail (Worklist → View Details)

These five fields must appear in this exact order wherever they are displayed.

---

## Background / Findings

- The MB52 config now maps these SAP fields → columns:
  - `LIFNR → vendor_code`
  - `NAME1 → vendor_name`
  - `GRN_NO → grn_no`
  - `GRN_ITEM → grn_item`
  - `GRN_DATE → grn_date`
- Stock is fetched **live** from SAP (no DB persistence), so the values are present in the in-memory record objects returned by `invokeSapSync({ action: 'fetch_live' })`. We do NOT need to add columns to `shop_floor_stock`.
- `mrb_records` already has the destination columns: `vendor_code`, `vendor_name`, `grn_number`, `grn_item_number`, `grn_date`. They just aren't being populated from the shop-floor flow nor displayed in the detail page.
- `AvailableStockRecord` type lacks these five fields.
- Stock Selection table currently shows: Plant, Material, Description, Batch, SLoc, Available Qty, UoM, Source.
- Material Blocking form shows a read-only stock summary with: Plant, Material Code, Description, Batch, SLoc, Available Qty.
- Shop Floor MRB Detail (`ShopFloorMRBDetail.tsx`) "Material & Stock Information" card shows: Material Code, Description, Plant, Production Order, PO Number, Batch, Blocked Qty, Pending With — but no vendor/GRN.

---

## Changes

### 1. Extend the stock record type
**File:** `src/data/shopFloorStockData.ts`
- Add optional fields to `AvailableStockRecord`:
  ```ts
  vendorCode?: string;
  vendorName?: string;
  grnNo?: string;
  grnItem?: string;
  grnDate?: string;
  ```

### 2. Stock Selection page — table columns + payload
**File:** `src/pages/ShopFloorStockSelection.tsx`
- Add 5 new `<TableHead>` cells after **SLoc** (before Available Qty) in this order: Vendor Code, Vendor Name, GRN No, GRN Item, GRN Date.
- Add matching `<TableCell>` entries reading `stock.vendor_code`, `stock.vendor_name`, `stock.grn_no`, `stock.grn_item`, `stock.grn_date` (fallback `'-'`).
- In `handleProceed`, extend the `stockItem` payload passed via `navigate(..., { state: { stockItem } })` to include the five new camelCase fields from the selected record.

### 3. Material Blocking form — show new fields in stock summary
**File:** `src/pages/ShopFloorMaterialBlocking.tsx`
- In the read-only "Stock Information" grid (around lines 540–565), add five disabled `<Input>` blocks in the requested order after the existing SLoc field, bound to `stockItem.vendorCode`, `stockItem.vendorName`, `stockItem.grnNo`, `stockItem.grnItem`, `stockItem.grnDate`.
- In the `createMRB` payload (around lines 280–308), populate:
  - `vendor_code: stockItem.vendorCode || null`
  - `vendor_name: stockItem.vendorName || 'N/A (Shop Floor)'` (keep fallback)
  - `grn_number: stockItem.grnNo || null`
  - `grn_item_number: stockItem.grnItem || null`
  - `grn_date: stockItem.grnDate || null`
- Optionally include them in the print template block as well.

### 4. Shop Floor MRB Detail page — display the new fields
**File:** `src/pages/ShopFloorMRBDetail.tsx`
- In the "Material & Stock Information" card grid (around line 319), append five new fields in the requested order: Vendor Code, Vendor Name, GRN No, GRN Item, GRN Date — reading from `mrb.vendor_code`, `mrb.vendor_name`, `mrb.grn_number`, `mrb.grn_item_number`, `mrb.grn_date`.

### 5. (Optional) MRBDetail (non-shop-floor)
The user said "MRB worklist view details". Quality-source MRBs route to `MRBDetail.tsx`; shop-floor source routes to `ShopFloorMRBDetail.tsx`. Since this request is specifically about MB52 (shop-floor) data, only `ShopFloorMRBDetail.tsx` needs changes. We will not touch `MRBDetail.tsx`.

---

## No DB / Edge Function Changes

- No migrations: live MB52 records carry the fields in memory; `mrb_records` already has the destination columns.
- No edge function changes.

---

## QA Checklist (post-implementation)

1. Open Material Blocking page → search MB52 → table shows 5 new columns in order.
2. Select an item → Proceed → Material Blocking form shows the 5 new read-only fields.
3. Submit MRB → open it from Worklist → MRB Detail shows the 5 new fields populated.
