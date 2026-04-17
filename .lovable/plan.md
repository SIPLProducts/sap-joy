

User wants: when the LAST routing step's action is "Return to Vendor", the MRB closure_status should be set to "closed" (in addition to status='closed').

Looking at prior changes in `useMRBDatabase.ts` and `InwardMRBDetail.tsx`/`ShopFloorMRBDetail.tsx`, the last-step return-to-vendor path sets `status='closed'` but I need to confirm `closure_status='closed'` and `closed_at`/`closed_by` are also set.

## Plan

Update the last-step `return_to_vendor` branch in both detail pages to also pass:
- `closure_status: 'closed'`
- `closed_at: new Date().toISOString()`
- `closed_by: user.id`
- `final_decision: 'returned_to_vendor'`

### Files to update
1. `src/pages/InwardMRBDetail.tsx` — in the last-step `return_to_vendor` branch, include closure fields in `additionalUpdates`.
2. `src/pages/ShopFloorMRBDetail.tsx` — same change.

### Result
When the final routing department selects "Return to Vendor", the MRB is finalized with `status='closed'` AND `closure_status='closed'`, so it appears as Closed everywhere in the UI (Worklist, Dashboards, Pending Actions).

