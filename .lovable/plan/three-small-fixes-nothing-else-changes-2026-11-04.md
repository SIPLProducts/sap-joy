# Three small fixes (nothing else changes)

## 1. Print form typo
- Print form disposition label "Return to spplier" becomes "Return to supplier". Text only.

## 2. "Unblock & SAP Sync" closes the MRB
- In the Worklist, after a successful unblock (single and bulk), for "Accept under deviation" MRBs only, also save: status = approved, waiting-with = none.
- Existing sync status / closure saving stays as it is. Other dispositions untouched.

## 3. Stores "view only" notice always visible
- On the Shop Floor and Inward MRB detail screens, show the existing "Quality Head accepted under deviation — Stores view only" notice at the top of the ticket, based on the Quality Head decision, so Stores sees it every time they open it.
- The existing notice inside the review form stays as is.

## Technical details
- `src/components/mrb/MRBPrint.tsx`: fix string at ~line 947.
- `src/pages/Worklist.tsx` `handleSAPSync` / `handleBatchSync`: add `status: 'approved', pending_with: null` to the post-success `updateMRB` when `finalDecision === 'accept_under_deviation'`.
- `ShopFloorMRBDetail.tsx`, `InwardMRBDetail.tsx`: render banner above detail cards when `final_decision === 'accept_under_deviation'`.
