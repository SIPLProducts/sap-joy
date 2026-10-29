# Print form: MRB Review table in routing order

In the "REVIEW by Material Review Board (Root Cause Analysis & CAPA)" table of the NCR print form:

- Rows will list the departments that were picked in that MRB's workflow routing, in the same order (e.g. Production → Purchase → Quality Head → Stores).
- Each row shows only the comments given by that department (with the commenter's name), in date order.
- Creation comments stay excluded (same as now).
- If an MRB has no routing saved (older records), the table falls back to today's 4 fixed rows (Purchase, Engineering, Production, Quality Control) — nothing changes for those.

Nothing else on the print form, and no workflow, approval or email logic, is touched.

## Technical details
- File: `src/pages/MRBPrint.tsx`, inside `UnifiedNCRReport` only (`reviewRows`).
- Read `selectedMRB.workflow_routing` (array of role keys or objects with `role`/`department`), dedupe while preserving order.
- Label each role with the existing department map/name (fallback: title-cased key).
- Match comments by `stage` or `performed_by_role` equal to/containing the role key (fetch `performed_by_role` in the existing comments query, additive only).
- Keep the existing static `reviewRows` as fallback when routing is empty.
