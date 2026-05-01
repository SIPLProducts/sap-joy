## Goal

Make the requested ZMRB04 column set the single source of truth wherever an **InProcess** record (`mrb_records.source = 'inprocess'` / `zmrb_inward_report` row) is shown:

1. **MRB - Inward InProcess screen** (`/inward/inprocess`)
2. **MRB Worklist** (`/worklist`) — only when an InProcess row is filtered/viewed
3. **InProcess MRB Detail** (`/inward/mrb/:id`) opened from the Worklist's "View" action for an InProcess record

Final 20 columns (in order):
Action, Status, Inspection Lot (PRUEFLOS), Material Code (MATNR), Material Description (MAKTX), Plant (WERK), SLoc (LGORT), Batch (CHARG), Blocked Qty (LMENGE04), Trans. Qty (QTY), UoM (MENGENEINH), Inspection Date (ENSTEHDAT), Posting Date (BUDAT_MKPF), Block Reason (SGTXT), Vendor Code (SELLIFNR), Vendor Name (NAME1), Production Order (AUFNR), Work Center (ARBPL), Order Type (AUART), Confirmation Date (RUECK).

## Status of each surface

### 1. InProcess report — already correct
`src/pages/InwardInProcessReport.tsx` already renders exactly this column set (verified at lines 753–772). **No change required.**

### 2. Worklist — InProcess-aware view
`src/pages/Worklist.tsx` is a unified table for all sources. Per user direction ("Only for InProcess rows") we keep the existing global columns, but switch to a **dedicated column layout when `sourceFilter === 'inprocess'`** so a user filtering the worklist by InProcess sees only the requested 20 fields.

Changes:
- Extend `UnifiedMRBRecord` with: `storageLocation`, `batch`, `inspectionDate`, `postingDate`, `productionOrderNo`, `workCenter`, `orderType`, `confirmationDate`, `blockReason` (the existing `defectDescription` already carries block reason).
- Hydrate these from `mrb_records` joined with `zmrb_inward_report` on `inspection_lot` (one extra fetch in `useMRBDatabase` or a small inline lookup in `Worklist`) so values are present on InProcess rows.
- When `sourceFilter === 'inprocess'`, render the alternate `<thead>`/`<tbody>` markup with the 20 columns above. Action column reuses the existing "Eye" button → `handleViewClick(mrb)` which already routes InProcess records to `/inward/mrb/:id`.
- Update Excel export (`handleExportToExcel`) to include the new fields when InProcess rows are present.

### 3. InProcess MRB Detail page
`src/pages/InwardMRBDetail.tsx` currently shows generic Inward fields (PO, PO Item, GRN, GRN Item No, GRN Date). For `source = 'inprocess'` MRBs we replace those with the production fields and add the new ones.

Changes (all gated on `mrb.source === 'inprocess'`):
- Remove the **PO Number, PO Line Item, GRN Number, GRN Item No, GRN Date** field cards.
- Add field cards for: SLoc, Inspection Date, Posting Date, Production Order, Work Center, Order Type, Confirmation Date.
- Source the values: prefer `mrb_records` columns where they exist (`storage_location`, `batch`, `inspection_lot`, etc.). For the 4 production fields plus inspection/posting dates, fall back to `zmrb_inward_report` looked up by `inspection_lot` (mirrors the existing `inward_inspection_lots` fallback already used in this file).
- For non-InProcess MRBs the page renders unchanged.

## Database — no schema migration

`zmrb_inward_report` already has `production_order_no`, `work_center`, `order_type`, `confirmation_no`, `inspection_date`, `posting_date`, `storage_location`, `batch`, `block_reason`, `vendor_code`, `vendor_name` (verified). The previous migration also patched `sap_api_response_fields` for ZMRB04 so the scheduler persists `AUFNR/ARBPL/AUART/RUECK`. No new migration is needed.

We **do** need a small data-flow improvement so the MRB detail screen always has these fields without a DB-level join:
- Optional: when an InProcess MRB is created (`createBatchMRBs` in `src/contexts/InwardInProcessMRBContext.tsx`), also copy `storage_location`, `batch` (already done), and persist `production_order_number` (already a column on `mrb_records`) into the MRB row so display is read-once. Inspection/Posting dates and Work Center / Order Type / Confirmation Date stay sourced from `zmrb_inward_report` via fallback lookup.

## Files to change

1. `src/pages/Worklist.tsx`
   - Extend `UnifiedMRBRecord`, fetch InProcess fallback fields, render alternate `<thead>`/`<tbody>` when `sourceFilter === 'inprocess'`, update Excel export.
2. `src/pages/InwardMRBDetail.tsx`
   - Branch the "MRB Details" card on `mrb.source === 'inprocess'` to render the requested field set; keep current layout for `quality_inspection`. Add `zmrb_inward_report` fallback lookup for production/date fields.
3. `src/contexts/InwardInProcessMRBContext.tsx`
   - In `createBatchMRBs`, additionally write `production_order_number` to the inserted `mrb_records` row (uses the new `productionOrderNo` already on `InspectionLotRecord`).
4. `src/pages/InwardInProcessReport.tsx` — **no change**.

## Out of scope

- Inward Materials screen (`/inward`) and its detail view: untouched.
- Shop Floor screens, dashboards, KPIs, role matrix entries, workflow routing: untouched.
- No type regeneration (`src/integrations/supabase/types.ts` is auto-managed).
