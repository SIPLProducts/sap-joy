

## Comprehensive MRB Workflow & Worklist Refinements

### Issues to fix
1. Action button visible to wrong role (Management sees it during Engineering Review)
2. "Executive" label shown instead of "Management" everywhere
3. "Return for Vendor" must traverse ALL remaining routing departments; final person → Closure = Closed
4. Closure column should show "Completed" only after SAP sync
5. Unblock & SAP Sync button → visible only to admins + Quality roles
6. "Approve" by ANY department = final approval → enable SAP sync, skip remaining routing
7. Move "Created" column right after "MRB Number" in worklist
8. New custom roles in routing must trigger SAP-sync availability on their approval
9. Shop Floor MRB status shows "Quality" instead of current department
10. Status label should reflect the current department; "Approved" → "Final Approval"
11. Hide columns in worklist: Quality Review, Purchase Review, Engg. Review, Final Approval, Pending With
12. Workflow chart per MRB: color-code participated vs non-participated departments; show approver step distinctly; mark completed flow end-to-end after SAP sync

---

### Plan

**A. Fix Action button visibility & role label (Issues 1, 2, 9, 10)**
- `src/pages/InwardMRBDetail.tsx`, `src/pages/ShopFloorMRBDetail.tsx`, `src/pages/MRBDetail.tsx`:
  - `canReview` = `pending_with === userRole || userRole === 'admin' || isMasterAdmin`. Remove `executive` bypass.
  - Replace static `getRoleDisplayName` with `useDepartmentMap().roleDisplayNames` so `executive` → "Management".
- `src/pages/Worklist.tsx`: same dynamic name resolution for "Pending With" badges.

**B. "Return for Vendor" full traversal + final closure (Issue 3)**
- `src/lib/workflowRouting.ts`: when action is `return_for_vendor`, advance to next department (not approve). Only when `isLast` step submits return_for_vendor → set `closure_status = 'closed'`, status = `closed`.
- Update submit handlers in `InwardMRBDetail.tsx` / `ShopFloorMRBDetail.tsx` / `MRBCommitteeReview.tsx` to pass action type to the router and apply closure logic on last step.

**C. "Approve" = final approval, skip remaining routing (Issue 6)**
- In submit handlers: if decision === 'approve' (any department), set status = `approved`, `pending_with = null`, `final_approved_by/at`, and mark eligible for SAP sync. Do NOT advance routing.

**D. Closure column = "Completed" only after SAP sync (Issue 4)**
- `src/pages/Worklist.tsx`: closure cell logic → "Completed" only when `sap_stock_update_status === 'success'` (or equivalent). Otherwise show "Pending SAP Sync" / current state.

**E. Unblock & SAP Sync button RBAC (Issue 5)**
- `src/pages/Worklist.tsx`: gate the Unblock & SAP Sync button on `userRole ∈ {admin, quality, quality_head}` or master admin. Hide for all others (already partly done — extend to all entry points).

**F. New custom-role approval triggers SAP sync (Issue 8)**
- Ensure the "approve = final" logic in (C) is role-agnostic — driven by decision value, not hardcoded role list. This automatically supports any new role added via Role Management.

**G. Move Created column after MRB Number (Issue 7)**
- `src/pages/Worklist.tsx`: move "Created" `<th>` and `<td>` to the position immediately after the MRB Number column.

**H. Hide review columns in worklist (Issue 11)**
- `src/pages/Worklist.tsx`: comment out `<th>` + `<td>` for: Quality Review, Purchase Review, Engg. Review, Final Approval, Pending With.

**I. Color-coded Workflow Progress per MRB (Issue 12)**
- `src/components/mrb/WorkflowProgressIndicator.tsx`:
  - Accept `approvalHistory` prop (array of `{role, action}` from `mrb_approval_history`).
  - Determine "approver step" = step where action = 'approve'.
  - Color states:
    - **Green (participated + approved)**: steps from start through approver
    - **Blue (participated, advanced)**: any step that took action other than approve
    - **Gray (not participated)**: steps after the approver (skipped) or pending future steps
    - **Solid green flow line**: when MRB is approved + SAP synced (completed end-to-end)
  - Show a distinct badge/icon on the approver node ("Approved here").
- `InwardMRBDetail.tsx` / `ShopFloorMRBDetail.tsx` / `MRBDetail.tsx`: pass `approvalHistory` + `sapSyncStatus` to the indicator.

---

### Files to modify
1. `src/lib/workflowRouting.ts` — action-aware next-step logic (approve = final, return_for_vendor = traverse, last = closed)
2. `src/pages/InwardMRBDetail.tsx` — canReview fix, dynamic labels, submit logic, pass history to indicator
3. `src/pages/ShopFloorMRBDetail.tsx` — same as above
4. `src/pages/MRBDetail.tsx` — dynamic labels, submit logic, indicator props
5. `src/pages/MRBCommitteeReview.tsx` — apply approve/return logic
6. `src/pages/Worklist.tsx` — move Created column, hide 5 review columns, dynamic Pending With label, closure = Completed only on SAP sync, Unblock&Sync button RBAC
7. `src/components/mrb/WorkflowProgressIndicator.tsx` — color-coded participation + approver highlight + completed state

### Result
- Action button strictly tied to `pending_with`
- "Management" displays correctly everywhere
- Approve at any step → final, SAP-sync ready, routing skipped
- Return-for-Vendor traverses all; last person closes the MRB
- Closure column = "Completed" only after successful SAP sync
- Unblock & Sync restricted to Admin + Quality
- New roles automatically supported (decision-driven, not role-hardcoded)
- Worklist cleaner: Created right after MRB Number; review columns hidden
- Per-MRB workflow chart visually shows who participated, who approved, and full completion after SAP sync

