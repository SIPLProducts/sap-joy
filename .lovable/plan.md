## Goal
Make the field set in **Create In-Process MRB**, **MRB Detail (in-process branch)**, and **Worklist (InProcess source)** exactly match the **Inward In-Process Materials** screen — no more, no less.

## Reference: columns shown on In-Process Materials screen (source of truth)
Inspection Lot, Material Code, Material Description, Plant, SLoc, Batch, Blocked Qty, Trans. Qty, UoM, Inspection Date, Posting Date, Block Reason, Customer Code, Customer Name, Sales Order, Sales Item, Production Order, Work Center, Order Type

(No Vendor Code/Name, no GRN fields, no PO fields, no Confirmation Date.)

## Changes

### 1) `src/pages/CreateInwardInProcessMRB.tsx` — "Material & Inspection Lot Information" grid (lines ~786–874)
**Remove these read-only fields** (they don't appear on the In-Process Materials screen):
- GRN Number
- GRN Item No
- GRN Date
- Purchase Order Number
- PO Item Number

**Add these read-only fields** (present on the In-Process Materials screen but missing here):
- Inspection Date — bound to `inspectionLot.inspectionDate`
- Posting Date — bound to `inspectionLot.postingDate` (extend `InspectionLotRecord` interface and `FormData` with `postingDate`)
- Production Order — bound to `inspectionLot.productionOrderNo` (extend interface/FormData with `productionOrderNo`)
- Work Center — bound to `inspectionLot.workCenter` (extend interface/FormData with `workCenter`)
- Order Type — bound to `inspectionLot.orderType` (extend interface/FormData with `orderType`)

Also drop the now-unused fields from `FormData` and `handleSubmit`/email body (no `purchaseOrderNumber`, `poItemNumber`, `grnNumber`, `grnItemNumber`, `grnDate` references for in-process MRBs).

### 2) `src/pages/InwardMRBDetail.tsx` — in-process branch (lines ~371–457)
**Remove**:
- Confirmation Date row (lines 449–452) — not present on the report screen.

Final field order will be: Inspection Lot, Material Code, Material Description, Plant, SLoc, Batch, Blocked Qty, Trans. Qty, UoM, Inspection Date, Posting Date, Block Reason, Customer Code, Customer Name, Sales Order, Sales Item, Production Order, Work Center, Order Type, Pending With.

(Drop `confirmation_no` from the `zmrb_inward_report` `select(...)` at line 116.)

### 3) `src/pages/Worklist.tsx` — InProcess-only table (lines ~1082–1108)
**Remove** the "Confirmation Date" header (line 1107) and its corresponding `<td>` cell. Adjust empty-state `colSpan` from 22 → 21. Drop the `confirmationNo` field from `UnifiedMRBRecord` and the in-process hydration `select` if it's no longer used. Update Excel export to drop the `Confirmation Date` key for in-process rows.

## Out of scope
- No DB migrations.
- Quality Inspection Details, Attachments, Workflow sections in Create MRB — unchanged.
- Regular Inward (quality_inspection) and Shop Floor flows — unchanged (vendor/GRN/PO retained).

## Verification
1. Open an in-process inspection lot → Create MRB → "Material & Inspection Lot Information" shows exactly the 19 fields above (no GRN/PO/Vendor; includes Inspection Date, Posting Date, Production Order, Work Center, Order Type).
2. Submit → open from Worklist → MRB Detail (in-process) shows the same 19 fields + Pending With (no Confirmation Date).
3. Worklist with source = InProcess shows the same column set as the In-Process Materials screen (no Confirmation Date column).
4. Quality Inspection / Shop Floor MRBs continue to show Vendor + GRN + PO unchanged.
