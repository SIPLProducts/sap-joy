

## Add GRN Item No and GRN Date Columns to Inward Report Table

### Problem
The Inward Report screen (`/inward/report`) table doesn't display "GRN Item No" and "GRN Date" columns. The data is stored in the database and shows in the MRB creation form and detail pages, but the report table is missing these columns.

### Changes

**1. `src/pages/InwardReport.tsx`**
- Add two table headers "GRN Item No" and "GRN Date" after the existing "GRN Number" column (around line 736)
- Add two table cells to display `record.grnItemNo` and `record.grnDate` after the GRN Number cell (around line 893)

**2. `src/hooks/useDynamicFields.ts`**
- Add `'grn_item_no'` and `'grn_date'` to the `BASE_COLUMNS.inward_inspection_lots` Set to prevent them from duplicating as dynamic extra fields

### Files to modify
1. `src/pages/InwardReport.tsx` — 2 headers + 2 cells
2. `src/hooks/useDynamicFields.ts` — 2 entries in BASE_COLUMNS

