## Plan

### Root cause
The current deletion logic only compares existing rows against a hardcoded SAP lot field list. If the server response uses a different mapped field name/case, `returnedLots` becomes incomplete or empty, so rows that are no longer in SAP are not removed reliably. Also, the self-hosted direct sync path in `src/lib/sapSyncClient.ts` has no reconciliation deletion at all, so on-prem deployments can upsert new SAP rows but never delete missing rows.

### Changes to implement
1. **Create shared reconciliation helpers in both sync paths**
   - Normalize inspection lot and plant values with `trim()`.
   - Resolve SAP inspection lot / plant using response field mappings first, then common SAP aliases.
   - Compare normalized DB rows vs normalized SAP response rows.

2. **Manual Refresh Data / Edge sync (`supabase/functions/sap-sync/handler.ts`)**
   - Replace the current inline reconcile block with a safer helper.
   - For `inward_inspection_lots`, delete rows where the normalized `inspection_lot` is absent from the SAP response and absent from `mrb_records` with `source='quality_inspection'`.
   - For `zmrb_inward_report`, delete rows where the normalized `inspection_lot` is absent from the SAP response and absent from `mrb_records` with `source='inprocess'`.
   - Run reconciliation even when SAP returns zero rows, as long as the sync is scoped to a known plant.
   - Chunk MRB lookups and deletes to avoid `.in()` query limits.

3. **Scheduler sync (`supabase/functions/sap-sync-scheduler/index.ts`)**
   - Replace the scheduler reconcile block with the same mapped-field based logic.
   - Remove the `returnedLots.size > 0` gate so a valid empty SAP response can clear non-MRB orphan rows for that plant.
   - Keep per-plant safety: only delete within the plant currently synced.

4. **Self-hosted direct sync (`src/lib/sapSyncClient.ts`)**
   - Add the same reconciliation after `mapAndInsertClientSide()` so on-prem direct middleware mode deletes stale rows too.
   - Return `records_deleted` and `records_preserved_with_mrb` in the sync response.

5. **UI feedback**
   - Keep the existing success toast as `SAP sync successful`.
   - Do not add fetched/inserted text back into the toast.

### Verification
- Confirm all three paths report `records_deleted` when an orphan row is removed.
- Confirm MRB-linked records are preserved.
- Confirm inward uses `inward_inspection_lots` + `quality_inspection` and in-process uses `zmrb_inward_report` + `inprocess`.