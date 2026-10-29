# Print form: tick the Quality Head's disposition

## Goal
Under "Material / Product Disposition (by MRB)", tick only the option the Quality Head chose (Accept under deviation, Return to supplier, Rework, Sort, Scrap, Others). All other boxes stay unticked.

## How
- The Quality Head's choice is saved in the review history as the comment prefix, e.g. "Return to supplier: Testing" (stage "Quality Head Review").
- In the print form, read the latest Quality Head history entry and turn its prefix into the matching option key (`return_to_supplier`, `accept_under_deviation`, `rework`, `sort`, `scrap`, `others`).
- Use that key for the tick marks. If no Quality Head choice is found (older MRBs), keep the current behavior (final / engineering decision).

## Technical details
- File: `src/pages/MRBPrint.tsx` only.
- Add `qhDisposition` derived from `mrbComments` (rawStage contains "quality head", label prefix before ":" mapped to key).
- Replace the 3 calls `getDispositionChecked(m?.final_decision || m?.engineering_decision)` with `getDispositionChecked(qhDisposition || m?.final_decision || m?.engineering_decision)`.
- `getDispositionChecked` already supports all 6 keys; no change to workflow, saving, SAP or emails.
