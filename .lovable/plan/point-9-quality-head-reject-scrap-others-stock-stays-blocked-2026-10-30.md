# Point 9 – Quality Head Reject / Scrap / Others: stock stays blocked

Most of Point 9 already works, because it was added together with Point 7. When the Quality Head picks Return to supplier, Rework, Sort, Scrap or Others, the MRB Worklist hides the Unblock & SAP Sync button and its checkbox and shows "Stock stays blocked". This plan closes the remaining gaps without changing any existing flow.

## What will be added
1. **Safety check on the sync action itself** (MRB Worklist): if someone starts a single or batch Unblock & SAP Sync for an MRB where the Quality Head chose Reject, Scrap or Others, the system stops it and shows the message "Stock stays blocked – Quality Head disposition does not allow unblock". The SAP 343 call is never sent.
2. **Notice for Stores** (Shop Floor and Inward review screens): when the MRB reaches Stores after a Reject, Scrap or Others choice, Stores sees a notice: "Quality Head chose <option>. Stock remains BLOCKED in SAP – please process the physical action." The existing Stores review form and the Submit button stay as they are. (The fields for DC No, Debit Note No and Ref No come under Point 10.)

## What does not change
- Accept under deviation still turns on the Unblock button.
- Older MRBs without a Quality Head choice behave as before.
- Workflow order, emails, the print form and the 6 action options are unchanged.

## Technical details
- `Worklist.tsx`: in `handleSAPSync` and `handleBatchSync`, return early with a toast when `!isSyncAllowed(mrb)` (batch: skip those records).
- `ShopFloorMRBDetail.tsx` / `InwardMRBDetail.tsx`: add a sibling notice block next to the existing accept-under-deviation notice (lines ~580 / ~668), shown when `pending_with === 'stores'` and `final_decision` is in `['return_to_supplier','rework','sort','scrap','others']`.
