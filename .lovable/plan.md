

## Add GRN Item No (ZEILE) and GRN Date (BLDAT) to MRB Flow

### Problem
The SAP fields ZEILE (GRN Item No) and BLDAT (GRN Date) are configured in the SAP API response fields but:
1. The columns `grn_item_no` and `grn_date` don't exist in the `inward_inspection_lots` table — so SAP sync can't store them
2. The columns don't exist in `mrb_records` — so they can't be persisted with MRB creation
3. No UI displays them in the MRB creation form or MRB detail page

These are **not** the same as `po_item_number` (EBELP) and `posting_date` — they are separate SAP fields.

### Changes

**1. Database migration — Add columns to both tables**
- Add `grn_item_no TEXT` to `inward_inspection_lots` (so SAP sync via the dynamic column mechanism can populate it)
- Add `grn_date TEXT` to `inward_inspection_lots`
- Add `grn_item_number TEXT` to `mrb_records`
- Add `grn_date DATE` to `mrb_records`

**2. `src/pages/CreateInwardMRB.tsx` — Add fields to form and save logic**
- Add `grnItemNumber` and `grnDate` to `FormData` interface and `InspectionLotRecord` interface
- Populate from inspection lot data (fetched from `grn_item_no` and `grn_date` columns, or via `_raw` dynamic field data)
- Add two read-only fields after GRN Number: "GRN Item No" and "GRN Date"
- Save to `mrb_records` as `grn_item_number` and `grn_date`

**3. `src/pages/InwardMRBDetail.tsx` — Display GRN Item No and GRN Date**
- Add state for `grnItemNo` and `grnDate`
- Fetch from `mrb_records` columns first, with fallback to `inward_inspection_lots.grn_item_no` / `grn_date`
- Display after GRN Number in the material info grid

### Files to modify
1. Database migration (2 tables, 4 new columns)
2. `src/pages/CreateInwardMRB.tsx`
3. `src/pages/InwardMRBDetail.tsx`

