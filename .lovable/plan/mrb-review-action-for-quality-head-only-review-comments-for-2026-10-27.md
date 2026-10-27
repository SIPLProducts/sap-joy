# MRB review: Action for Quality Head only, Review Comments for everyone else

Applies to the review section of the MRB detail pages opened from the MRB Work List: Shop Floor MRB and Inward / In-Process MRB.

## Behavior

**Quality Head reviewing**
- The **Action** dropdown is shown and required (*). It has exactly these options:
  1. Accept under deviation
  2. Return to supplier
  3. Rework
  4. Sort
  5. Scrap
  6. Others
- Submit stays disabled until an Action is chosen. Review Comments are optional.
- The chosen option is saved as the MRB's disposition and appears in history and on the print form. The MRB then moves to the next step in its routing (Stores).

**Every other department reviewing**
- The **Action** dropdown is disabled ("Only Quality Head selects the Action").
- **Review Comments** is required (*). Submit stays disabled until comments are entered. Submitting moves the MRB to the next department in the routing, the same as "Approve" does today.

Everything else stays the same: routing, emails, SAP unblock buttons and the print layout.

## Technical details

- Files: `src/pages/ShopFloorMRBDetail.tsx` and `src/pages/InwardMRBDetail.tsx` (review form and submit validation only).
- `isQualityHead = userRole === 'quality_head' || mrb.pending_with === 'quality_head'`.
- New option values: `accept_under_deviation`, `return_to_supplier`, `rework`, `sort`, `scrap`, `others`. On submit they follow the existing forward-to-next-step path (`updateMRBStatus(..., 'approved', remarks, { final_decision: <value> })`), and `getActionLabel` returns the new labels.
- For other departments, the action is set to `approve` behind the scenes so the existing approve/forward branch runs unchanged. Validation requires `reviewComments.trim()`.
- Print form: map `final_decision` to the matching Rev 3 disposition tick (Accept under deviation / Return to supplier / Rework / Sort / Scrap / Others) if it isn't already mapped.
