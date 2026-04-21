
## Fix Dynamic Workflow Routing So MRBs Never Get Stuck

### What will be fixed
The workflow will be corrected so that for both Inward and Shop Floor MRBs:

- `Return for Clarification` moves the MRB to the next department in `workflow_routing`
- any routed department such as `stores` can take action successfully
- after a department submits its review, that same user/department no longer sees the review action area unless the MRB is reassigned back to them later in the routing
- the visible status label will match the actual `pending_with` department instead of showing an old hardcoded review stage
- approval history and workflow progress will stay aligned with the routed department

### Root causes already identified
1. `mrb_records` update access is still hardcoded for old roles like quality/purchase/engineering/executive and does not allow dynamic routed roles like `stores`.
   - Result: Stores can submit a review and history gets inserted, but the MRB row itself does not move.

2. Dynamic departments like `stores` have no `workflow_status` configured in `departments`.
   - Result: when routing moves to Stores, the code falls back to the previous status such as `purchase_review`, so the status badge becomes wrong even when `pending_with` is correct.

3. Detail pages still render the action form purely from `pending_with === userRole`, so if the MRB row fails to move, the same department keeps seeing the action section.

4. Approval history stage labels are derived from `mrb.status`, not the actual routed department taking action.
   - Result: Stores activity can appear under `Purchase Review`.

## Implementation plan

### 1. Make workflow updates permission-safe for all routed departments
Create a database migration to replace the current hardcoded MRB update policy with a routing-based rule.

New update access logic for `mrb_records`:
- creator can edit only while status is `draft`
- admin can always update
- the authenticated user can update when their assigned role matches `pending_with`
- keep existing authenticated read/insert behavior unchanged

This allows custom workflow departments like `stores` to act without the MRB getting stuck.

### 2. Make next-step routing fully dynamic and never depend on old stage fallbacks
Update the review submission flow in:
- `src/pages/InwardMRBDetail.tsx`
- `src/pages/ShopFloorMRBDetail.tsx`

Changes:
- centralize “next department” resolution from `workflow_routing`
- for `return_for_clarification`, always move to the next routed department
- for intermediate approvals like `approve_with_deviation`, move to the next routed department unless it is the last step
- for final approval actions, close/approve only at the last routed step
- stop using the previous record status as the fallback when the next department has no explicit `workflow_status`

For departments without a configured `workflow_status`, use a safe generic in-progress status internally, while showing the real pending department in the UI.

### 3. Show workflow status based on the actual pending department
Add a shared helper for workflow display state, for example in a small utility file.

This helper will:
- treat `approved/rejected/closed` as terminal states
- otherwise derive the displayed review label from `pending_with`
- show labels like:
  - `Engineering Review`
  - `Purchase Review`
  - `Stores Review`
  - `Quality Review`

Use this helper in:
- `src/pages/InwardMRBDetail.tsx`
- `src/pages/ShopFloorMRBDetail.tsx`
- `src/pages/Worklist.tsx`
- any shared MRB detail header still using `getStatusDisplayName(mrb.status)` for in-progress routed records

This fixes the “status still shows Purchase Review while pending with Stores” problem.

### 4. Record history using the acting department, not the stale enum stage
Update `src/hooks/useMRBDatabase.ts` so approval history stage labels are derived from the current routed owner (`pending_with`) when available, instead of only from `mrb.status`.

Result:
- Stores actions appear as `Stores Review`
- custom routed departments display correctly in history
- history remains consistent with the workflow chart

### 5. Ensure the action form disappears immediately after a department submits
Keep action visibility tied to the current assignee only:
- show review form only when `pending_with === userRole` or admin override applies
- once the record moves to the next department, the previous department loses the review UI automatically

Because the main bug is the record not moving, this fix mainly depends on step 1 and step 2. After those are corrected, the old actor will no longer keep seeing the action button.

### 6. Remove or disable misleading manual forward UI
The current “Forward to another department” checkbox on the detail pages is not the real routing mechanism and can confuse users.

Update both detail screens to:
- remove the manual forward selection UI, or
- replace it with a read-only note that routing happens automatically from the configured MRB workflow

This keeps the behavior aligned with the requirement: routing must follow the selected MRB workflow automatically.

### 7. Repair currently affected stuck MRBs
Apply a targeted correction for existing broken records already impacted by the old permissions behavior, starting with the MRB that is currently stuck with Stores.

Goal:
- move those MRBs to the correct next department according to their latest valid workflow action and `workflow_routing`
- ensure Quality receives the record where Stores already forwarded it

This will be done carefully so production records are not broadly altered.

## Files and systems involved

### Code
- `src/hooks/useMRBDatabase.ts`
- `src/pages/InwardMRBDetail.tsx`
- `src/pages/ShopFloorMRBDetail.tsx`
- `src/pages/Worklist.tsx`
- likely one new shared workflow-status helper file

### Backend
- database migration for `mrb_records` update policy

## Technical notes
```text
Current broken flow:
Engineering -> Purchase -> Stores -> Quality
                     |
                     v
           Stores review is recorded in history
           but MRB row does not update
                     |
                     v
pending_with stays Stores
status stays old stage
Quality cannot act
Stores still sees action form
```

```text
Fixed flow:
Engineering -> Purchase -> Stores -> Quality
                     |
                     v
           Stores update is authorized
           MRB moves to Quality
           previous actor loses action UI
           Quality receives action UI
           status label shows current pending department
```

## Expected result
After this fix:

- Purchase returning for clarification to Stores will move the MRB to Stores correctly.
- Stores submitting `Approve with Deviation` will move the MRB to Quality when Quality is next in routing.
- Quality will then get the review option immediately.
- The previous department will no longer see the review action after submitting.
- Status labels, workflow chart, and approval history will all reflect the same routed department.
- Dynamic routed roles like `stores` will work the same way as quality, purchase, and engineering.
