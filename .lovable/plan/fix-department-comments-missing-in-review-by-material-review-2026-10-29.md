# Fix: Department comments missing in "REVIEW by Material Review Board" (Print form)

## Goal
Every department that reviewed the MRB and gave a comment shows that comment in its own row, in routing order (e.g. MRB-2026-0057: Quality Head → "Return to supplier: Testing", Stores → "Reviewed: Testing").

## Changes (print form only, `src/pages/MRBPrint.tsx`, review table section)
1. Smarter department matching: clean both the routing name and the saved comment's stage the same way (lowercase, spaces/dashes to `_`, drop words like "review", "approval", "stage", "department"), then compare. Also match by the reviewer's role when the stage name doesn't match.
2. Admin / superadmin sign-offs are mapped by the stage name (the department), not by the person's role.
3. Any department that commented but is not in the routing list is appended at the end, so no comment is dropped.
4. Creation comments stay excluded (unchanged).
5. Static 4-row fallback stays for old MRBs with no routing.

## Not changed
Workflow, approvals, emails, SAP, other print sections.

## Check
Open MRB-2026-0057 in MRB Print, confirm both department rows show their comments.
