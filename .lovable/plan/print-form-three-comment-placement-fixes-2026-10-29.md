# Print form: three comment placement fixes

Only the print form (MRB Print page) changes. No workflow, saving, email or SAP logic is touched.

## 1. Rejected QTY Sl Nos
- Remove the initiator's comment from this row.
- The row keeps showing the batch number only (as before the comment was added).

## 2. Non-Conformance details
- Show only the comment typed by the person who created the MRB (the initiator), plus the existing defect code.
- No duplicates: the comment appears once.
- "Initiator Name" below stays as it is.

## 3. Disposition of Non-Confirming Material (by STORES)
- Show the comment(s) given by the Stores department while reviewing the MRB, oldest first.
- The action label in front (e.g. "Reviewed:") is removed, so only the typed text shows — same cleaning used in the Review table.
- Existing Stores document numbers (Return Delivery No, Rework Order No, Scrap Document No) still show if present.
- If Stores hasn't commented yet, the box shows what it shows today.

## Technical details
- `src/pages/MRBPrint.tsx` only.
- Line ~890: value becomes `D(m?.batch)`.
- Non-Conformance box: render `defect_code` and `initComment` (creator's remarks: `quality_remarks || defect_description || issue_description`) once, deduped.
- `stores` array: append cleaned text from `mrbComments` whose normalized stage/role is `stores`; keep `final_remarks` only when no Stores comment exists, and dedupe.
