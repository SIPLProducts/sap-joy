
## Route “Return for Clarification” to the Next Workflow Department

### Requirement
When any department selects **Return for Clarification**, the MRB should not remain with the same department. It should move to the **next department in the configured `workflow_routing` sequence** so that the next department can take action.

## Implementation Plan

### 1. Update Inward MRB review routing
Modify `src/pages/InwardMRBDetail.tsx`.

Current behavior:
- `return_for_clarification` keeps:
  - same `status`
  - same `pending_with`
  - only logs history

New behavior:
- Find the current department position in `mrb.workflow_routing`.
- Move to the next department in the routing.
- Set:
  - `status` from `deptToStatus[nextDept]`
  - `pending_with` from `deptToRole[nextDept]`
  - history action as `returned_for_clarification`
- Keep the review comments in the correct department remarks field.

Example flow:
```text
Purchase returns for clarification
Workflow: purchase → engineering → quality_head
Result: MRB pending_with = engineering
```

### 2. Update Shop Floor MRB review routing
Modify `src/pages/ShopFloorMRBDetail.tsx` with the same logic.

Current behavior:
- `return_for_clarification` stays with the same department.

New behavior:
- Move to the next department in `workflow_routing`.
- Apply the same status and pending role mapping as other forwarded actions.

### 3. Fix shared database update behavior
Modify `src/hooks/useMRBDatabase.ts`.

Current issue:
- `updateMRBStatus()` has a special case for `returned_for_clarification`.
- That special case only inserts approval history and sends email.
- It intentionally skips updating `mrb_records`, so even if the detail page calculates the next department, the record will not move.

Change this behavior so:
- `returned_for_clarification` can update `status` and `pending_with`.
- It still logs approval history as `returned_for_clarification`.
- It still triggers the `mrb_returned_for_clarification` notification event.
- It no longer blocks record updates.

### 4. Handle missing next department safely
If the current department is already the last department in `workflow_routing`, there is no next department to send it to.

Use a safe fallback:
- Do not mark the MRB approved or closed.
- Keep it with the current department.
- Show a clear toast message such as:
```text
No next department is configured in the workflow routing.
```

This prevents accidental completion or incorrect routing.

### 5. Keep routing fully dynamic
Use the existing dynamic mapping from `useDepartmentMap()`:

- `roleToDept`
- `deptToRole`
- `deptToStatus`

No hardcoded role sequence will be added. The behavior will follow the plant’s configured workflow routing.

## Files to Update

- `src/pages/InwardMRBDetail.tsx`
  - Change `return_for_clarification` branch to route to the next workflow department.

- `src/pages/ShopFloorMRBDetail.tsx`
  - Apply the same next-department routing behavior.

- `src/hooks/useMRBDatabase.ts`
  - Remove/adjust the special case that prevents record updates for `returned_for_clarification`.
  - Preserve correct history and email event handling.

## Expected Result

After the change:

```text
Current pending department selects Return for Clarification
        ↓
System finds next department in workflow_routing
        ↓
MRB status and pending_with move to that next department
        ↓
Next department can see and act on the MRB
```

Example:

```text
Quality Head → Return for Clarification
Routing: quality_head → purchase → engineering
Result: Pending With = purchase
```

This will work for both **Inward MRB** and **Shop Floor MRB** detail review screens.
