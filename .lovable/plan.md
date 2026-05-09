## Plan

Scope MRB Worklist to the active plant from the top header and add a Plant filter dropdown that mirrors the same Inward-screens behavior.

### What will change

1. **MRB Worklist (`src/pages/Worklist.tsx`)**
   - Derive `activePlant` from `profile.plant`, validated against `useVisiblePlants()` (Master Admin sees all plants, others restricted to assigned plants).
   - Filter `mrbRecords` by `activePlant` so only that plant's MRBs appear in the table, KPIs, batch SAP unblock list, and Excel export.
   - Add a new **Plant** dropdown in the filter row, alongside Status / Source / Pending With.
     - For non-master users: dropdown lists only their assigned plants (via `useVisiblePlants`).
     - For Master Admin: dropdown lists all plants.
     - Default selection mirrors the header's active plant; changing the header switches the Worklist's plant filter automatically.
   - When the header plant changes, refresh the visible records and reset selected row IDs (so stale selections from another plant don't get batch-synced).

2. **Behavior consistency**
   - Same active-plant pattern already used in `InwardReport.tsx` and `InwardInProcessReport.tsx`.
   - RLS on `mrb_records` already restricts non-master users to assigned plants — this is purely a UI-side filter to align with the active plant chosen in the header.

### Out of scope

- No DB / RLS changes.
- No changes to status, source, or pending-with filter logic (those work as-is once the plant scope is correct).
- No changes to other screens.
