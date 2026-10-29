## Fix duplicate comment in "Non-Conformance details" box (MRB Print)

**Problem:** The box shows the defect text, then the creator's comment on a new line. When both are the same text (e.g. "Suraface defect"), it prints twice.

**Fix (only in `src/pages/MRBPrint.tsx`, Non-Conformance box):**
- Build the defect text as today.
- Show the creator's comment line only if it is different from the defect text (compared trimmed, case-insensitive) and not already contained in it.
- If the defect text is empty, show just the comment once.

Nothing else changes: WO No/WO Date and "Rejected QTY Sl Nos" rows keep showing the comment as they do now.
