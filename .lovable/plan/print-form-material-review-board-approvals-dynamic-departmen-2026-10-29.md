# Print form: Material Review Board Approvals — dynamic departments, reviewer and date

## What changes
In the unified NCR print form, the "Material Review Board Approvals" table will:
- List only the departments this MRB was sent to, in the order they were picked (same order as the Review table above it).
- Show, for each department, the name of the person who actually reviewed it and the date the review was done.
- Leave Name and Date blank for departments that have not reviewed yet (row is still shown for signing).
- Keep the same table design (Department / Name / Sign / Date).

Older MRBs with no saved department order: list the departments that reviewed (from the review history). If nobody has reviewed, keep the current 4 standard rows.

## Technical details
- File: `src/pages/MRBPrint.tsx`, `UnifiedNCRReport` only.
- Reuse the existing `reviewRows` (already built from `workflow_routing` + `deptOf` matching on `mrbComments`).
- New `dynamicApprovals = reviewRows.map(r => { const last = r.items[r.items.length-1]; return { dept: r.dept, name: last?.author || '', date: last?.date || '' } })`.
- Comments without text currently may be excluded from `mrbComments`; if so, also load review history rows without remarks (name + performed_at) into a separate list used only for approvals, so departments that approved without a comment still show reviewer and date.
- Render `dynamicApprovals` when routing/history exists; otherwise fall back to the existing static `approvals` array (unchanged).
- No changes to workflow, emails, other print layouts or data.
