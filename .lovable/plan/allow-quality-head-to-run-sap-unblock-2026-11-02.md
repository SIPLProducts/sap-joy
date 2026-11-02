# Allow Quality Head to run SAP Unblock

## What changes
Quality Head users can now press "Unblock & SAP Sync" without getting an error. Nothing else changes.

## Technical details
- `supabase/functions/sap-sync/handler.ts` line 85: add `userRole !== 'quality_head'` to the existing role check, so admin, quality and quality_head are allowed.
- Redeploy the `sap-sync` function.
- No other code or logic is touched. The "Accept under deviation only" safety check stays as it is.
