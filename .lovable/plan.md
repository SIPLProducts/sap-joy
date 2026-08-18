# MRB Print: Show all MRB comments in the Detailed Instructions table

## Goal
On the MRB Print screen, after an MRB is fetched, the "DETAILED INSTRUCTIONS OF MRB" table should list every comment recorded for that MRB in serial order (1, 2, 3, ...), with the name of the person who wrote each comment in the "Responsibility Name & Sign" column.

## What changes
- When an MRB is loaded, also load its approval/comment trail (stage remarks recorded through the workflow) ordered oldest to newest.
- Resolve each comment's author to a full name (falling back to the recorded role if no profile name exists).
- Render one table row per comment: S. No. = sequence, Instructions = comment text, Responsibility Name & Sign = author name, Target Date = existing date value used today.
- Keep the existing blank filler rows so the table still fills to at least 5 rows and the printed layout/format is unchanged.
- Print preview, browser print, and PDF export all use the same markup, so they stay consistent automatically.

## Technical notes
- File: `src/pages/MRBPrint.tsx`.
- In `fetchMRBFromDB`, add a query on `mrb_approval_history` filtered by `mrb_id`, ordered by `performed_at` ascending, selecting stage, remarks, performed_by, performed_by_role, performed_at. Rows with empty remarks are skipped.
- Author names come from the existing `profiles` lookup pattern (`user_id -> full_name`), extended to include the history performers; fallback to `performed_by_role`.
- Store the resulting comment list in new state and use it inside the existing IIFE that builds the instruction rows, replacing the current three hardcoded remark fields (engineering/purchase/committee). If no history comments exist, fall back to today's behaviour so nothing regresses for older records.
- No stylesheet, layout, workflow, or data-writing changes.
