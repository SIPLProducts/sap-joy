

## Fix: Make WorkflowProgressIndicator use the MRB's actual `workflow_routing`

### Problem
The `WorkflowProgressIndicator` currently fetches **all** workflow steps from `plant_workflow_config` for the plant, showing every department (Quality, Purchase, Engineering, Quality Head, Final Approval, Completed) regardless of which departments were actually selected during MRB creation. It should only show the departments stored in the MRB record's `workflow_routing` array.

### Changes

**1. Update `WorkflowProgressIndicator` component** (`src/components/mrb/WorkflowProgressIndicator.tsx`)
- Add a new optional prop: `workflowRouting?: string[]`
- When `workflowRouting` is provided, use it to build the steps dynamically (lookup labels from the `departments` table via `useDepartmentMap`) instead of querying `plant_workflow_config`
- Only fall back to `plant_workflow_config` if `workflowRouting` is not provided
- Also make the status text summary dynamic (remove hardcoded switch for status descriptions — derive from current step label)

**2. Pass `workflow_routing` from all 4 caller pages:**
- `src/pages/MRBDetail.tsx` — pass `workflowRouting={(mrb as any).workflow_routing as string[]}`
- `src/pages/InwardMRBDetail.tsx` — same
- `src/pages/ShopFloorMRBDetail.tsx` — same
- `src/pages/MRBCommitteeReview.tsx` — same

### Technical approach
- The component will map each entry in the `workflowRouting` array to a step using `useDepartmentMap` to resolve display names and statuses
- Steps will be built as: `workflowRouting.map(dept => ({ id: dept, label: deptDisplayName, statuses: [deptToStatus[dept]] }))` + a final "Completed" step
- Current step detection will match `pendingWith` against the routing array entries
- The bottom path (Quality → Engineering → Done) will reflect only the selected departments
- No hardcoded department lists will remain in the component

