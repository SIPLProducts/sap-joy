# Show only the creator's own comments in WO No / WO Date (Print form)

## Problem
Right now the WO No / WO Date space shows the automatic system note saved when an MRB is created, for example "MRB created from quality_inspection — Routing: quality_head → stores". That note includes the workflow route, which should not be printed there.

## Change
- Fill the WO No / WO Date space only with the comments the creator typed on the create screen:
  - Inward / In-Process MRBs: the "Quality Inspection Comments" box.
  - Shop Floor MRBs: the defect description the creator entered.
- Never show the automatic "MRB created from … Routing: …" note.
- If the creator didn't type any comment, leave the space blank.
- The labels (WO No, WO Date), the layout and everything else on the form stay the same.

## Technical details
- `src/pages/MRBPrint.tsx`: remove the `initiatorComment` value taken from the Creation history row. In the merged value cell, render `m?.quality_remarks || m?.defect_description || m?.issue_description || ''`.
- No database or workflow changes.
