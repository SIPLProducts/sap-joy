## Goal
Mirror the In-Process Materials screen on the Create-MRB form, MRB Detail page, and Worklist (when source = InProcess). For in-process records: remove **Vendor Code / Vendor Name** and replace with **Customer Code, Customer Name, Sales Order, Sales Item** — sourced the same way as in the worklist (read from `zmrb_inward_report.customer_code/customer_name/sales_order/sales_item`).

Only in-process flows are affected. The regular Inward (quality_inspection) flow keeps Vendor Code/Vendor Name as-is.

## Background
- The In-Process Materials worklist already shows Customer Code, Customer Name, Sales Order, Sales Item, hydrated from `zmrb_inward_report` via `InwardInProcessMRBContext` (already populated `customerCode/customerName/salesOrder/salesItem` on `InspectionLotRecord`).
- `mrb_records` does NOT have customer/sales columns. We will not add them — instead, hydrate from `zmrb_inward_report` by `inspection_lot` (same pattern already used for `production_order_no`, `work_center`, etc.).

## Code changes

### 1) `src/pages/CreateInwardInProcessMRB.tsx` — Create In-Process MRB form
- Extend the local `InspectionLotRecord` interface with `customerCode`, `customerName`, `salesOrder`, `salesItem` (the parent already passes them via `location.state`).
- Extend `FormData` with the same 4 fields; populate from `inspectionLot.*` in the initial `useState`.
- In the Inspection Lot Details grid (around lines 822–849):
  - Remove the **Vendor Code** and **Vendor Name** inputs.
  - Add **Customer Code**, **Customer Name**, **Sales Order**, **Sales Item** read-only inputs in their place (keep PO/GRN block intact below).
- In `handleSubmit` (around line 524) stop writing `vendor_code` / `vendor_name` for in-process MRBs — pass `null` so detail/worklist always render from the live `zmrb_inward_report` hydration (single source of truth and avoids stale duplicates).
- Update the email body (lines ~582–598) — replace "Vendor Code / Vendor Name" lines with Customer Code / Customer Name / Sales Order / Sales Item.

### 2) `src/pages/InwardMRBDetail.tsx` — MRB Detail page (in-process branch only)
- Extend `inprocessFields` state shape with `customer_code`, `customer_name`, `sales_order`, `sales_item`.
- Extend the `zmrb_inward_report` `select(...)` (around line 112) to also fetch those 4 columns.
- In the in-process branch of MRB Details grid (lines 417–424):
  - Remove **Vendor Code** + **Vendor Name** rows.
  - Add **Customer Code**, **Customer Name**, **Sales Order**, **Sales Item** rows reading from `inprocessFields.customer_code` etc.
- Leave the non-in-process branch (lines 447+) untouched — it still shows Vendor info.

### 3) `src/pages/Worklist.tsx` — In-Process worklist table
- Extend `UnifiedMRBRecord` with `customerCode`, `customerName`, `salesOrder`, `salesItem`.
- Extend the in-process hydration `select` (line 210) to also pull `customer_code, customer_name, sales_order, sales_item`.
- Map them in `unifiedRecords` (line 225+) from `lot?.customer_code` etc.
- In the **InProcess-only** table (lines 1066–1150):
  - Replace headers **Vendor Code / Vendor Name** (lines 1084–1085) with **Customer Code, Customer Name, Sales Order, Sales Item** (4 headers — bump `colSpan` empty-state from 20 to 22).
  - Replace the matching `<td>` cells (lines 1144–1145) with the 4 new cells.
- Leave the all-sources / non-inprocess table untouched.
- Update the Excel export `Vendor Name` / `Vendor Code` keys (lines 402–403) — for in-process source rows, export Customer Code / Customer Name / Sales Order / Sales Item instead (or in addition); the non-inprocess rows keep Vendor columns.

## Out of scope
- No DB migrations — `zmrb_inward_report` already has the 4 columns, and SAP mappings (`Kunnr`, `Name1_cust`, `VBELN`, `POSNR`) are already configured.
- No changes to the regular Inward (quality_inspection) Create/Detail/Worklist views — they continue to show Vendor.
- No print template changes (separate task if needed).

## Verification
1. Open any in-process inspection lot → Create MRB → "Inspection Lot Details" shows Customer Code, Customer Name, Sales Order, Sales Item (no Vendor fields).
2. Submit an MRB → open it from Worklist → MRB Detail (in-process branch) shows the same 4 fields, hydrated from `zmrb_inward_report`.
3. Worklist with source = "Inward InProcess" → header columns and rows show Customer Code, Customer Name, Sales Order, Sales Item instead of Vendor Code/Name.
4. Worklist for quality_inspection / shop_floor sources still shows Vendor unchanged.
5. Excel export from Worklist contains the new fields for in-process rows.
