# Finish the 5 remaining items (additive only, no existing logic changed)

## 1. Accept under deviation finishes at Quality Head
- In Shop Floor and Inward MRB detail screens: when Quality Head submits "Accept under deviation", save status = approved and pending_with = empty (only for this one option). The other 5 options keep moving to Stores as today.
- Stores sees a read-only card for accepted MRBs (note only, no comment/action inputs, no submit).
- After a successful SAP unblock, also clear pending_with (status stays approved).

## 2. Stores fields for the other 5 options
- Replace the single "Stores Remarks" box with three fields: DC No, Debit Note No, Reference No (at least one required) plus optional Comments.
- Saved as "DC No: … | Debit Note No: … | Reference No: …" (only filled fields), followed by comments. Shown as-is in the print form STORES box.

## 3. NCR Status on print form
- Accept under deviation: OPEN until SAP sync is "synced", then CLOSED.
- All other options: unchanged.

## 4. Old detail screen buttons
- In the legacy MRB detail screen, hide "Approve & Forward", "Final Approve", "Reject" when the MRB has a workflow routing. MRBs without routing behave as before.

## 5. On-premise deployment scripts
- setup-scheduler: add daily 03:30 UTC call to mrb-pending-reminders.
- deploy-edge-functions: copy the `_shared` folder alongside functions and skip it as a standalone function.

## Technical notes
- Files: ShopFloorMRBDetail.tsx, InwardMRBDetail.tsx, Worklist.tsx (post-sync pending_with null), sap-sync handler (same, then redeploy), MRBPrint.tsx, MRBDetail.tsx, deploy/setup-scheduler.sh, deploy/deploy-edge-functions.sh.
- All changes gated by `final_decision === 'accept_under_deviation'` or `workflow_routing` presence so existing paths stay identical.
