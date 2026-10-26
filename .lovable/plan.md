# Fix: Refresh Data not removing stale lots on the on-premise server

## What happens today
On Refresh/Sync for Inward (01) and In-Process (04), the app deletes lots that SAP no longer returns and that have no MRB. In the cloud this works. On-premise the rows stay.

## Most likely causes (on-premise only)
1. **Delete permission missing in the on-prem database.** The cloud database has "authenticated users can delete" rules on both lot tables (added by later migrations). If those migrations were not applied on the on-prem database, the delete is silently ignored — no error, zero rows removed. This matches "no error, but nothing removed".
2. **On-prem server running older code.** The removal step was added recently to the sync function and the scheduler. If the on-prem edge functions / PM2 scheduler were not redeployed, the removal never runs.
3. **1000-row read cap.** Existing lots per plant are read in one request; on-prem PostgREST caps at 1000, so lots beyond that are never checked.

## Changes
1. **On-prem fix script** `deploy/fix-reconcile-permissions.sql` (+ call from `deploy/fix-scripts.sh`): idempotently creates the DELETE rules and grants on `inward_inspection_lots` and `zmrb_inward_report` for logged-in users and the service role.
2. **Detect silent blocks**: in the reconcile step (browser sync, `sap-sync` function, scheduler) request the deleted rows back; if fewer rows were deleted than requested, log a clear warning and show a toast "Some old lots could not be removed — run the on-prem permission fix".
3. **Paginate** the existing-lots read in 1000-row pages in all three reconcile paths.
4. Show "Removed X old lots" in the sync result toast so the user can confirm it works.

No change to MRB rules: lots linked to an MRB are still kept.

## Steps you run on the on-prem server after this
```text
git pull
psql "$SUPABASE_DB_URL" -f deploy/fix-reconcile-permissions.sql
bash deploy/deploy-edge-functions.sh
pm2 restart mrb-scheduler
npm run build   (redeploy frontend)
```
