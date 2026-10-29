# Print form: show only the comment text in the MRB Review table

Only the "REVIEW by Material Review Board (Root Cause Analysis & CAPA)" table on the print form changes. Nothing else changes.

## What changes
1. **Comment text only.** Remove the action label in front of the comment ("Return to supplier:", "Reviewed:", "Accept under deviation:", "Rework:", "Sort:", "Scrap:", "Others:", "Accept:", "Reject:", "Approved:", "Forwarded:"). Remove the "— Name" added after it. For example, "Return to supplier: Testing — Quality Head" becomes "Testing".
2. **Only this MRB's departments.** The table lists only the departments in this MRB's routing, in routing order. MRBs without saved routing list only the departments that actually commented, instead of the fixed Purchase, Engineering, Production and Quality Control rows.
3. If a comment is just an action label with no remark, its line is left empty.

## Technical details (src/pages/MRBPrint.tsx only)
- Add a `cleanComment(text)` helper. It strips a leading known action label plus the colon, case-insensitive, and trims the rest.
- In the review table cell, render `cleanComment(c.text)` without the author suffix, and skip empty results.
- Fallback when `routingKeys` is empty: build rows from the unique `deptOf(c)` values in `mrbComments`, oldest first. `staticReviewRows` is used only if nobody commented, so the blank rows stay available for signing by hand.
- The stored data, workflow, emails and the rest of the print/PDF stay the same.
