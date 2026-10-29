# Make Production Order mandatory

## What changes
- **Shop Floor Material Blocking:** the "Production Order (Optional)" field becomes "Production Order *". The Block & Create MRB button stays disabled (with a red message) until it is filled. The random `PRD-YYYY-XXXX` auto-number is removed, so the real value typed by the user is always saved and printed as WO No.
- **In-Process MRB creation:** Production Order is filled from SAP and read-only. It gets a `*` marker, and if SAP sent it empty, the MRB cannot be submitted and a message says "Production Order is missing for this inspection lot".
- **Inward MRB creation:** no change (Inward materials have no Production Order).

Nothing else changes: workflow, emails, SAP calls and print layout stay the same.

## Technical details
- `src/pages/ShopFloorMaterialBlocking.tsx`: label line ~642, add `productionOrder.trim()` to the existing submit validation / disabled condition; line 312 use `productionOrder.trim()` only.
- `src/pages/CreateInwardInProcessMRB.tsx`: label line ~879, add a `formData.productionOrderNo` check in the existing submit validation with a toast.
