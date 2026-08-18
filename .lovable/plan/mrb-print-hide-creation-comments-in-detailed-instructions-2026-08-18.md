# MRB Print — Hide Creation Comments in Detailed Instructions

## Goal
In the MRB Print screen, the “DETAILED INSTRUCTIONS OF MRB” table currently lists every `mrb_approval_history` row that has a non-empty remark, including the initial “MRB created …” record (`stage = 'Creation'`, `action = 'created'`). We want to suppress that creation record and only show comments added after the MRB was created.

## What will change
- `src/pages/MRBPrint.tsx`
  - In `fetchMRBFromDB`, after fetching `mrb_approval_history`, add an extra filter to exclude rows where `stage = 'Creation'` and `action = 'created'`.
  - The rest of the table rendering, PDF layout, disposition checkmarks, and approval rows remain exactly the same.

## Verification
- Open MRB Print.
- Select an MRB that has a creation remark in its approval history.
- Confirm the creation row no longer appears in the Detailed Instructions table.
- Confirm later comments (Quality Review, Engineering Review, Purchase Review, etc.) still appear in serial order.

## No changes to
- Database schema
- Other screens or workflows
- Existing PDF formatting, layout, or logic
