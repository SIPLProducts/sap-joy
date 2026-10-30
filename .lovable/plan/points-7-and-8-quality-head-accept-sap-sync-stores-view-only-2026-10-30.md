# Points 7 and 8: Quality Head Accept → SAP Sync, Stores View Only

## What the user will see

**Point 7 – Quality Head Accept**
- Quality Head Action dropdown gets one new option at the top: **Accept**. Existing 6 options stay as they are (Accept under deviation, Return to supplier, Rework, Sort, Scrap, Others).
- In MRB Worklist, the **Unblock & SAP Sync** button and the selection checkbox appear only for approved MRBs where the Quality Head chose **Accept** or **Accept under deviation**.
- For Return to supplier / Rework / Sort / Scrap / Others, the button is hidden and a small grey "Stock stays blocked" label shows instead (points 9/10 handled later).
- Older MRBs with no Quality Head choice keep today's behaviour (button shows when approved).

**Point 8 – Stores View Only (Accept cases)**
- When an MRB reaches Stores and the Quality Head chose Accept / Accept under deviation, the Stores review card shows a blue info note: "Quality Head accepted this material. Review only — no dispatch details needed." with the Quality Head's decision shown.
- Stores still enters Review Comments (already mandatory) and submits; the MRB closes as approved, ready for SAP sync.
- No DC / Debit Note / Reference fields for these cases.

## Technical details

Files: `src/pages/ShopFloorMRBDetail.tsx`, `src/pages/InwardMRBDetail.tsx`, `src/pages/Worklist.tsx`.

1. Add `accept` to `QH_ACTIONS`, the dropdown, and `getActionLabel` ("Accept") in both detail pages. Add `accept` to `getDispositionChecked` mapping in `MRBPrint.tsx` (maps to the accept box).
2. Preserve the Quality Head decision: at the last step, set `final_decision = 'approved'` only when the existing `mrb.final_decision` is not already a QH action (today Stores overwrites it). Nothing else in the transition changes.
3. Worklist: helper `isSyncAllowed(mrb)` = `!finalDecision || finalDecision === 'approved' || ['accept','accept_under_deviation'].includes(finalDecision)`. Apply it to `approvedRecords`, the row checkbox, and the Unblock button condition; else show the "Stock stays blocked" label.
4. Stores view-only note: in both detail pages, when `pending_with === 'stores'` and `final_decision` is accept/accept_under_deviation, render the info note above Review Comments.

Existing SAP 343 call, routing, emails and print logic stay unchanged.
