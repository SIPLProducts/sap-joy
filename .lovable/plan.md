## Goal

Apply the same "reconcile on sync" logic to the on-demand **Refresh Data** button (Inward Materials and In-Process Materials) that already exists in the scheduler. Today the button calls the `sap-sync` edge function with `action: 'sync'`, which only UPSERTs — it never removes lots that SAP no longer returns. Result: stale rows accumulate in `inward_inspection_lots` / `zmrb_inward_report`.

**Rule:** after a successful manual refresh for a given config + plant, delete any rows in the destination table that (a) were not in this SAP response AND (b) have **no MRB** created against them. Rows already linked to an MRB are preserved.

## Change

**File:** `supabase/functions/sap-sync/handler.ts`, inside the `if (action === 'sync')` branch — only after `mapAndInsertData` returns successfully and SAP returned a non-empty array.

Steps:

1. Identify destination table and MRB source filter from the config name (same logic as the scheduler):
   - `inward` + `inspection` (and not `process`) → table `inward_inspection_lots`, `mrb_records.source = 'quality_inspection'` (this is what Inward MRBs are created with — confirmed in `InwardMRBContext.createBatchMRBs`).
   - contains `process` → table `zmrb_inward_report`, `mrb_records.source = 'inprocess'`.
   - Anything else → skip reconciliation (safety).

2. Determine plant scope: read `request_overrides.WERKS` first, else fall back to the WERKS default in `sap_api_request_fields`. If neither resolves to a single plant, skip reconciliation.

3. Build `returnedLots = Set<string>` from the mapped SAP response (extract `inspection_lot` / `PRUEFLOS` per record using the same alias map already in `mapAndInsertData`). To keep the change small, re-derive this from `sapResponse.data` using the existing helpers (`getNestedValue` + alias map) — or capture it inside `mapAndInsertData` and return it as `returnedKeys: string[]`.

4. Fetch all existing `inspection_lot` for this `plant` from the destination table.

5. `missing = existing - returnedLots`.

6. Fetch `mrb_records.inspection_lot` where `source = <mrbSource>` AND `plant = <plant>` AND `inspection_lot IN missing` — subtract those.

7. `await supabase.from(table).delete().eq('plant', plant).in('inspection_lot', deletable)`.

8. Include `records_deleted` and `records_preserved_with_mrb` in the JSON response and in `sap_stock_sync_history.error_message` log line (or as a structured part of the row if a column is added later — for now just include in returned JSON so the toast can show it).

Safety guards:
- Skip when `sapResponse.data` is empty (prevents wiping table on a transient empty response).
- Skip when `mrbSource` cannot be determined.
- Skip when plant cannot be resolved to a single value.

## UI (optional polish)

In `src/pages/InwardReport.tsx` and `src/pages/InwardInProcessReport.tsx`, extend the success toast to mention deletions when present:

```
SAP sync complete. Fetched: X, Inserted: Y, Updated: Z, Removed: D (kept M with MRB). Display refreshed.
```

Only render the "Removed" / "kept with MRB" segment when `records_deleted > 0`.

## Files touched

- `supabase/functions/sap-sync/handler.ts` — reconciliation block in the `sync` action.
- `src/pages/InwardReport.tsx` — toast string update (optional).
- `src/pages/InwardInProcessReport.tsx` — toast string update (optional).

No DB migration. No changes to scheduler (already done in previous PR). No changes to Result Recording flow.

## Verification

1. Inward Materials: SAP returns 6 lots → table has 6 rows. Make 1 of them MRB-created. Next SAP call returns only 4 of the original 6 (drops 2, including the MRB-linked one) → after Refresh Data, table has 5 rows: 4 returned + 1 preserved (the MRB one). Toast shows `Removed: 1 (kept 1 with MRB)`.
2. In-Process: same behavior on `zmrb_inward_report` filtered by `mrb_records.source = 'inprocess'`.
3. SAP returns empty array → no deletions, toast shows `Removed: 0`.
4. Existing scheduler reconciliation continues to work unchanged.
