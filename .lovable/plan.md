## Quality Info form updates

Update `src/pages/QualityInfo.tsx` only. No backend changes.

### 1. Release Until — editable with today as default
- Replace the readonly `Input` with an editable date input (`type="date"`).
- Keep `useState` initialized to today's ISO date (`YYYY-MM-DD`) so it's pre-filled.
- User can change it; if cleared, fall back to today on submit.
- Remove the "Auto-set to today" helper text; replace with "Defaults to today; you can change it".
- Continue sending `REL_UDT` in the same format to SAP (`YYYY-MM-DD` as currently used).

### 2. Plant — dropdown scoped to user's visible plants
- Import `useVisiblePlants` from `@/hooks/useVisiblePlants`.
- Replace the Plant `Input` with a shadcn `Select` (SelectTrigger / SelectContent / SelectItem).
- Options come from `plantOptions` returned by `useVisiblePlants`:
  - Master Admin (`masteradmin@sharviinfotech.com`) and `superadmin` role → all plants (hook already returns all).
  - Any other user → only plants assigned via `user_plants` (hook already scopes this).
- Default selection logic (unchanged intent):
  - If `activePlant` from header is a real plant (not `'all'`) and exists in options → use it.
  - Otherwise → first option in `plantOptions`.
- Display format in the trigger: `code — name` (fallback to just `code`).
- Keep `WERKS` payload as the plant `code`.

### 3. No other changes
- Material Code, Vendor Code inputs unchanged.
- Submit flow, confirm dialog, SAP call, and `quality_info` audit insert unchanged.
- Access-control (`hasAccess('quality_info')`) unchanged.
