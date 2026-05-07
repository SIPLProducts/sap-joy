## Root cause

There are real bugs in the reconciliation logic that prevent orphan rows from being deleted. Cloud "looked" fine because the test data didn't trigger them; on-prem you have orphan rows + an MRB enum mismatch that exposes the bugs.

### Bug 1 — Manual Refresh Data skips reconciliation when nothing maps for a plant
`supabase/functions/sap-sync/handler.ts` (lines 138–190) builds `mappingResult.byTable[tableName].plants` only from rows that **passed mapping and were inserted**. The reconciliation guard then requires `tableInfo.plants.size > 0` (line 151). Consequences:

- If SAP returns 5 records (down from 6) for plant 1300, plants set = {1300} and reconcile runs **only if** the missing 6th lot is also on plant 1300 — usually fine.
- But if SAP returns **zero records**, or the 5 returned rows fail mapping (missing required field), `plants.size === 0` and **nothing is deleted**.
- More importantly, the per-plant fetch (`existing`) is keyed on plants present in the *response*; orphans in any plant not in the current response are never even examined.

### Bug 2 — Wrong `source` value in scheduler reconciliation
`supabase/functions/sap-sync-scheduler/index.ts` line 230 uses `mrbSource = 'inward'`, but the `mrb_source` enum is `{quality_inspection, shop_floor, inprocess}` — there is no `'inward'`. The preservation query `.eq('source', 'inward')` returns nothing (or errors silently in some envs), so this branch is unreliable. Manual handler (Bug 1) uses the correct value `'quality_inspection'`.

### Bug 3 — Plant scoping for orphan detection is too narrow
Both paths only look at plants that appear in the current SAP response. The correct behavior for "remove records no longer in SAP" is: for each known plant the config is configured for, list every existing row and delete those whose `inspection_lot` is not in the SAP response.

## Fix

### `supabase/functions/sap-sync/handler.ts`
Rewrite the reconciliation block (lines 138–190) so it:

1. Determines `tableName` and `mrbSource` exactly as today (`quality_inspection` for inward, `inprocess` for in-process).
2. Builds `returnedLots: Set<string>` directly from `sapResponse.data` using the same field-extraction the scheduler uses (`PRUEFLOS / prueflos / inspection_lot`), independent of mapping success.
3. Computes the plant scope as the **union of**: plants in the SAP response, plants from `config.scheduler_plants`, and any explicit `plant` passed in `request_overrides`. If still empty, falls back to all distinct plants currently present in the destination table (single query: `select distinct plant from <table>`).
4. For each plant in scope:
   - `select inspection_lot from <table> where plant = X` → `existingLots`.
   - `missing = existingLots - returnedLots` (only when the plant is one we actually queried SAP for; otherwise skip to avoid deleting plants we didn't sync).
   - Preserve via `select inspection_lot from mrb_records where plant=X and source=mrbSource and inspection_lot in (missing)`.
   - `delete from <table> where plant=X and inspection_lot in (deletable)` in chunks of ≤500.
5. Surfaces `recordsDeleted` and `recordsPreservedWithMrb` in the JSON response (already wired to UI toast).
6. Keep the wrapping try/catch that logs but never aborts the sync.

Critical change: **remove the `tableInfo.plants.size > 0` gate** and **don't depend on `byTable` for reconciliation** — derive from `sapResponse.data` directly.

### `supabase/functions/sap-sync-scheduler/index.ts`
Two surgical edits to the reconciliation block (lines 213–303):

1. Line 230 — change `mrbSource = isInward ? 'inward'` to `mrbSource = isInward ? 'quality_inspection'`.
2. Apply the same union-plant-scope logic as handler.ts so the auto-scheduler also reconciles plants that returned zero rows in this tick. Reuses `plantCode` already in the per-plant loop, which is correct, but additionally include plants that are configured but produced 0 rows (already covered since the loop iterates over `config.scheduler_plants`). Verify the loop already runs even when SAP returns 0 rows for that plant; if it short-circuits, remove that early return so reconcile still runs.

### Deploy & test on-prem
1. Apply edits.
2. `sudo bash /opt/MRB_NEW/scripts/deploy-edge-functions.sh` (re-copies handler.ts + scheduler).
3. `cd /opt/supabase/docker && docker compose restart functions`.
4. `sudo -u iml pm2 restart mrb-scheduler`.
5. From the box: hit Refresh Data on Inward Materials → confirm toast `Removed: N (kept M with MRB)` and that orphan rows disappear from the table.

## Files touched
- `supabase/functions/sap-sync/handler.ts` (reconcile block + helper)
- `supabase/functions/sap-sync-scheduler/index.ts` (mrbSource value + remove plant gate)

No DB schema changes. No frontend changes (toast already wired).
