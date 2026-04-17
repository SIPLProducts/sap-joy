

## Fix MRB Action → Status Mapping (Inward + Shop Floor)

### Required semantics (action drives routing automatically)

| Action | Behavior | Status / Pending With |
|---|---|---|
| **Approve** | Final approval. SAP Sync becomes available. | `status='approved'`, `pending_with=null`, `final_decision='approved'` |
| **Return for Clarification** | Stays at the SAME department (waiting on initiator/prior dept response). No routing forward. | status unchanged, `pending_with` unchanged |
| **Approve with Deviation** | Forward to NEXT dept in `workflow_routing`. NOT final approve. If at last step, finalize as `approved` (deviation noted). | next dept's status & pending_with |
| **Return to Vendor** | Forward to NEXT dept in `workflow_routing`. NOT final approve. If at last step, close MRB. | next dept's status & pending_with |

SAP Sync (Worklist `Unblock & SAP Sync` button) stays gated on `status === 'approved'` — so it correctly appears ONLY after a true Approve (or a deviation-approve at the final step).

### Root cause of screenshot bug
1. `Approve with Deviation` currently sets `status='approved'` for any role → SAP sync incorrectly available mid-routing.
2. `Return to Vendor` only forwards if the user also ticks the manual "Forward to another department" checkbox; otherwise falls into the return-action branch but the UI label/badge stayed at "Engineering Review" because the previous action was Return for Clarification (kept at engineering) and the second action's auto-forward only triggers when `nextDepartments` is empty — fine in code, but the manual `forwardToNext` checkbox path overrides intent.

### Code changes

**1. `src/pages/InwardMRBDetail.tsx`** (lines ~190–265)
- Replace the action-handling block with strict, action-driven routing:
  - `approve` → finalize as approved.
  - `return_for_clarification` → keep current `status` + `pending_with`; only log history entry; **do not** call status transition that changes pending_with.
  - `approve_with_deviation` / `return_to_vendor` → look up current dept index in `workflow_routing`; advance to next; if last step:
    - `approve_with_deviation` → finalize as `approved` (with `final_decision='approved_with_deviation'`)
    - `return_to_vendor` → close MRB (`status='closed'`, `closure_status='closed'`)
- Remove dependence on the manual `forwardToNext`/`nextDepartments` UI for these four actions (auto-routed). Hide the "Forward to another department" checkbox when one of the four standard actions is selected (keep it only as a fallback for unusual flows, or remove entirely).
- Fix `currentIdx` lookup to use `useDepartmentMap` so role variants (`engineering` vs `engineering_head`) resolve correctly via `deptMaps.roleToDept` / `deptToRole` (consistent with `workflowRouting.ts`).
- History action label: use `'returned'` for both return actions, `'forwarded'` for deviation, `'approved'` for approve — so Approval History reads correctly.

**2. `src/pages/MRBDetail.tsx` / `ShopFloorMRBDetail.tsx`**
Apply the same action→status mapping for shop floor MRBs (same four actions, same rules).

**3. `src/hooks/useMRBDatabase.ts` — `updateMRBStatus`**
- Add support for a "no-status-change" path when caller passes `action='returned_for_clarification'`: skip status/pending_with mutation, only insert history row + send email (event `mrb_returned_for_clarification`).
- Ensure when caller explicitly passes `pending_with` in `additionalUpdates`, the status→pending_with auto-mapping does NOT overwrite it.

**4. `src/pages/Worklist.tsx`**
No change — `mrb.status === 'approved'` gating already correctly hides SAP sync until a true final approval.

**5. `supabase/functions/send-mrb-email/index.ts`** (optional)
- Add `mrb_returned_for_clarification` event template (same recipients as forwarded, addressed to current department).

### Result
- Engineer picks **Approve** → MRB becomes Approved → "Unblock & SAP Sync" appears in Worklist.
- Engineer picks **Approve with Deviation** → MRB moves to next routing dept (e.g., Executive), status reflects that. SAP Sync NOT shown.
- Engineer picks **Return for Clarification** → MRB stays at Engineering Review, only logged in history.
- Engineer picks **Return to Vendor** → MRB moves to next routing dept; if engineer is the last step, MRB closes.
- Approval History badges (`Approved` / `Forwarded` / `Returned`) correctly reflect the action taken.

