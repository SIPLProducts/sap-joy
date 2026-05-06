## Problem

On `/inward/report` (MRB Inward Materials), clicking Refresh / Sync hits the **In‑Process** SAP API (ART=04) and shows "Fetched 5, Inserted 5" — the In‑Process numbers — instead of the Inward Inspection numbers (ART=01).

Root cause confirmed against the DB:

There are two active configs with "zmrb" in the name:
- `ZMRB_Inward_Process` (created 2026‑04‑30) → maps to `zmrb_inward_report` (in‑process, ART=04)
- `ZMRB_Inward_Inspection` (created 2026‑03‑16) → maps to `inward_inspection_lots` (inward, ART=01)

`src/pages/InwardReport.tsx` currently uses simple keyword matching (`includes('zmrb') || includes('inward')`) ordered by `created_at desc`, so the newer `ZMRB_Inward_Process` is always chosen. The previous keyword logic worked only because the In‑Process config didn't exist before.

The In‑Process page (`InwardInProcessReport.tsx`) already does the right thing: it joins `sap_api_response_fields` and filters by `map_to_table = 'zmrb_inward_report'`.

## Fix

Update `fetchSapConfig` in `src/pages/InwardReport.tsx` to mirror the In‑Process pattern, but filter for `map_to_table = 'inward_inspection_lots'`. Also fix the auto‑refresh `last_sync_at` lookup to read by the resolved `sapConfigId` instead of "first active config".

### Changes to `src/pages/InwardReport.tsx`

1. `fetchSapConfig` (mount effect):
   - Query active `sap_api_config` rows.
   - Query `sap_api_response_fields` where `config_id IN (...)` and `map_to_table = 'inward_inspection_lots'`.
   - Pick the first config whose id is in the resulting set (prefer one whose `config_name` contains `inspection` for stability, fallback to first valid).
   - Toast error if none found.

2. Auto‑refresh effect (5‑min interval):
   - Replace the "first active config" `last_sync_at` query with a lookup by `sapConfigId` (`.eq('id', sapConfigId).maybeSingle()`).
   - Add `sapConfigId` to the effect's dependency array.

3. No other logic changes — sync handler already passes `config_id: sapConfigId`, which will now be the correct ART=01 config.

## Why this is safe

- In‑Process page is unaffected (different filter value).
- Falls back gracefully with a toast if no mapping rows exist.
- Mirrors a pattern already proven on the In‑Process screen.
