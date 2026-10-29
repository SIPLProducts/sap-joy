# Show creator's comments in two more places on the Print form

## Change
1. **Rejected QTY Sl Nos** row: show the creator's comments in this row. Whatever already shows there (the batch number) stays, and the comments go after it.
2. **Non-Conformance details** box: keep the defect details that already show there. Add the creator's comments on a new line underneath, just above "Initiator Name".

"Creator's comments" means the same text now printed next to WO No / WO Date: what the creator typed on the create screen (Quality Inspection Comments, or the defect description for Shop Floor MRBs). The automatic routing note is never shown. If the creator left it empty, nothing extra is printed.

Labels, layout, sizes and everything else stay the same.

## Technical details
- `src/pages/MRBPrint.tsx` (Rev 3 layout only):
  - Define `const initComment = m?.quality_remarks || m?.defect_description || m?.issue_description || ''` and reuse it in the WO cell.
  - Rejected QTY Sl Nos value: `[m?.batch, initComment].filter(Boolean).join(' — ')`.
  - In the Non-Conformance `.txt` area, after the existing text, add `{initComment && <div style={{marginTop:'1mm', whiteSpace:'pre-wrap'}}>{initComment}</div>}`.
- No database or workflow changes.
