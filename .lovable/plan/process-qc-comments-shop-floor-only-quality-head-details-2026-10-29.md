# Process QC Comments — Shop Floor only, Quality Head details

Only the print form's "Process QC Comments" box changes. Nothing else is touched.

## Changes
1. Show the whole "Process QC Comments" section (label and box) only when the MRB comes from Shop Floor. For Inward and In-Process MRBs, the section is hidden.
2. Inside the box:
   - Comments: the Quality Head's review comments from the approval history (the latest Quality Head entry). If there is none, fall back to the current value (quality remarks).
   - Name: the name of the Quality Head who made that entry. If there is none, fall back to the current name.

## Technical details
- File: `src/pages/MRBPrint.tsx`, inside `UnifiedNCRReport`.
- Wrap the label and `ncr3-area` in `selectedMRB?.source === 'shop_floor'`.
- Use the existing `mrbComments` list: filter `stage` for `quality_head`, take the last one, and use its `text` and `author`.
- No database, data-fetch or workflow changes.
