
Fix Batch No. not showing for inward MRBs

What I found
- I checked the live data for the record in your screenshot: `MRB-2026-0025` / inspection lot `10000754630`.
- In the database, `mrb_records.batch` is empty for that MRB, but the linked inward lot still has `batch = 434803`.
- So the UI change was correct, but it is reading from an empty MRB field.
- Root cause: inward MRB creation is not persisting `batch` into `mrb_records` even though the form already has the value. The same gap also exists in the batch-create inward MRB flow.

Plan
1. Fix single inward MRB creation
   - Update `src/pages/CreateInwardMRB.tsx` so the submit payload also saves:
     - `batch: formData.batch || null`
     - `storage_location: formData.storageLocation || null`

2. Fix batch inward MRB creation
   - Update `src/contexts/InwardMRBContext.tsx` inside `createBatchMRBs()` to also save:
     - `batch: record.batch || null`
     - `storage_location: record.storageLocation || null`

3. Make existing MRBs show Batch No. immediately
   - Update `src/pages/InwardMRBDetail.tsx` to fetch `batch` from `inward_inspection_lots` along with the existing PO item lookup.
   - Display batch using fallback logic:
     - `mrb.batch || lotBatch || '-'`
   - This will fix already-created records like `MRB-2026-0025` without needing a database migration.

4. Verify
   - Open the same MRB from the worklist and confirm Batch No. appears.
   - Create a new inward MRB and confirm batch is saved and visible on first view.

Technical note
- No schema change is needed; the `batch` column already exists on `mrb_records`.
- The issue is data persistence plus missing fallback for old records.
