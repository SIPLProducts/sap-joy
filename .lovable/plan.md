# Keep the tick mark fully inside the box (MRB Print, Rev 3)

## Goal
On the MRB Print form, the selected disposition tick (✓) should sit fully inside its square box in Preview, Print and PDF.

## Change
In `src/pages/MRBPrint.tsx`, edit only the `.ncr3-box.on::after` style rule:
- Drop the negative top offset. Center the tick inside the box with `inset: 0`, `text-align: center` and `line-height` set to the box height.
- Shrink the tick to about 8.5pt so it fits the 3.6mm box.

Nothing else changes: same box size, same tick logic and data, same Print and PDF buttons.

## Verify
Open a real MRB and export it to PDF, then check that the tick sits inside the box.
