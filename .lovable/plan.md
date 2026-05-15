## Goal

Default the **Posting Date From / To** filters on the Inward Materials and Inward In-Process Materials screens to:
- **From** = today − 15 days
- **To** = today

## Changes

Two files, same pattern (YYYY-MM-DD strings to match the date inputs):

1. `src/contexts/InwardMRBContext.tsx` — replace `postingDateFrom: ''` and `postingDateTo: ''` (line ~100) with computed defaults.
2. `src/contexts/InwardInProcessMRBContext.tsx` — same change at line ~108.

Add a small helper at the top of each file:
```ts
const today = new Date();
const fifteenDaysAgo = new Date();
fifteenDaysAgo.setDate(today.getDate() - 15);
const toISO = (d: Date) => d.toISOString().slice(0, 10);
```

Use `toISO(fifteenDaysAgo)` and `toISO(today)` as the initial values.

3. `src/pages/InwardReport.tsx` and `src/pages/InwardInProcessReport.tsx` — `handleReset()` currently sets these back to `''`. Update both to reset to the same 15-day window so Reset matches the default behaviour.

## Out of scope

- No backend, schema, or business-logic changes.
- Date column display, filtering logic, and other filter fields stay as they are.
