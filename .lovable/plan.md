## Changes

### A. Disable scheduler for Result Recording API

The Result Recording endpoint is on-demand only (called from the MRB Worklist when a user opens a lot). It must never be picked up by `sap-sync-scheduler` / pg_cron.

**`supabase/functions/sap-sync-scheduler/index.ts`** — at the start of the per-config loop (after fetching configs, before `shouldRunNow`), skip configs whose `config_name` or `endpoint_path` indicate result recording:

```ts
const cn = String(config.config_name || '').toLowerCase()
const ep = String(config.endpoint_path || config.api_endpoint || '').toLowerCase()
if ((cn.includes('result') && cn.includes('record')) ||
    (ep.includes('result') && ep.includes('record'))) {
  results.push({ config_id: config.id, config_name: config.config_name, skipped: true, reason: 'Result Recording API is on-demand only — scheduler disabled' })
  continue
}
```

(No DB change to existing rows — leaves the toggle alone but the scheduler will simply ignore it. The Result Recording config can stay scheduler_enabled=false in DB; this is a hard guardrail.)

### B. Reconcile-on-sync for Inward Inspection (ART=01) and In-Process (ART=04)

Today the scheduler does an UPSERT keyed on `inspection_lot`. If SAP later removes a lot from its response (because it's been processed/cleared in SAP), the row stays orphaned in `inward_inspection_lots` / `zmrb_inward_report` forever — causing inconsistency.

Rule: **after each successful sync run for a given config + plant, delete from the destination table any rows that (a) were not in this SAP response AND (b) have no MRB created against them.** Rows with an MRB are preserved regardless (so users keep their workflow history).

**`supabase/functions/sap-sync-scheduler/index.ts`** — in the per-plant block, after `mapAndInsertData` succeeds, run a reconciliation step:

1. Determine the destination table from `activeResponseFields` (`inward_inspection_lots` for Inward Inspection ART=01, `zmrb_inward_report` for In-Process ART=04).
2. Build the set of inspection_lot values returned in this run (from the mapped rows passed to `mapAndInsertData`).
3. Fetch all existing inspection_lot values currently in that table for this `plant` (skip when `plantCode === 'ALL'`).
4. Compute `missing = existing - returned`.
5. Fetch `mrb_records.inspection_lot` where `source = 'inward'` (for ART=01) or `'inprocess'` (for ART=04) AND `plant = plantCode` AND `inspection_lot IN missing`. Subtract those — they must be preserved.
6. `delete().eq('plant', plantCode).in('inspection_lot', deletable)` on the destination table.
7. Log `[scheduler] Reconciled <table>/<plant>: removed N orphan rows (kept M with MRB)` and add `records_deleted` to the run summary.

Source-mapping rule (so we use the right `mrb_records.source` filter):

```ts
const isInward     = cn.includes('inward')  && cn.includes('inspection') && !cn.includes('process') // ART=01
const isInProcess  = cn.includes('process') // ART=04
const mrbSource = isInward ? 'inward' : isInProcess ? 'inprocess' : null
// Only reconcile when we can confidently identify the source.
```

If `mrbSource` is null, **skip reconciliation** for safety (no mass delete on unknown configs).

Also skip reconciliation when the SAP response is empty AND the prior fetch failed (already handled because `mapAndInsertData` only runs after `sapResponse.success`); but additionally guard:

```ts
if (sapResponse.success && Array.isArray(sapResponse.data) && sapResponse.data.length > 0) {
  // run reconciliation
}
```

This prevents wiping the table on a transient empty SAP response.

### C. UI signal (optional, low-effort)

In the per-run summary already returned by the scheduler, include `records_deleted` so it surfaces in `SAPSyncMonitor.tsx` (which already renders `records_inserted/updated`). Add the column read-side later — for now just include it in the JSON result.

No `sap_stock_sync_history` schema change; we can write the reconciliation count into `error_message` only if needed, OR add a simple log line. Keep this PR minimal: only log + include in returned JSON.

## Files touched

- `supabase/functions/sap-sync-scheduler/index.ts` — guardrail to skip Result Recording configs; reconciliation block after `mapAndInsertData` for the two inward tables.

No DB migration. No frontend changes. No edits to `sap-sync/handler.ts` or `sapSyncClient.ts`.

## Verification

1. Mark the Result Recording config as `scheduler_enabled=true` (worst case). Trigger the scheduler manually → run output shows that config skipped with reason `"on-demand only"`. Result Recording continues to work from MRB Worklist on-demand.
2. Inward Inspection: SAP returns 100 lots → all in `inward_inspection_lots`. Remove 10 in SAP, 3 of which already have MRBs created. Trigger sync → `inward_inspection_lots` ends with 93 rows (90 still in SAP + 3 preserved with MRB). Log line: `Reconciled inward_inspection_lots/1300: removed 7 orphan rows (kept 3 with MRB)`.
3. In-Process: same behavior on `zmrb_inward_report` filtered by `mrb_records.source = 'inprocess'`.
4. Empty SAP response → no deletions (safety guard).
