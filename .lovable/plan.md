

## Plan: Fix Scheduler Sync + Add Refresh Time Indicator

### Diagnosis

**Why new SAP lots aren't showing in the UI:**

1. **Scheduler runs but skips syncs** — The `shouldRunNow()` function checks `config.last_sync_at` to decide if 5 minutes have elapsed. But the manual sync action (triggered from other parts of the app) also updates `last_sync_at`. This means the scheduler often sees "a sync happened 2 minutes ago" and skips. Looking at the sync history: only 3 scheduled syncs ever ran (all failed), while 46 manual syncs ran successfully.

2. **Duplicate cron jobs** — There are 2 identical pg_cron jobs both calling the scheduler every 5 minutes, causing lock contention ("Lock not acquired — another run is in progress").

3. **Missing `transaction_quantity` mapping** — The SAP field `QTY` is mapped in the DB config but may not exist in the SAP response. The built-in fallback mapping also lacks `transaction_quantity`, so it defaults to 0.

### Changes

**1. Fix scheduler to always sync when triggered by cron** (edge function)
File: `supabase/functions/sap-sync-scheduler/index.ts`
- Remove the `shouldRunNow()` gate when the request comes from pg_cron (body contains `source: "pg_cron"`). The cron schedule itself handles timing — the function should just execute.
- This ensures every 5-minute cron invocation actually syncs data.

**2. Remove duplicate cron job** (database)
- Delete the older cron job (jobid 1) that sends the wrong body format. Keep only jobid 2 which sends `{"source": "pg_cron"}`.

**3. Add `transaction_quantity` to built-in ZMRB01 mappings** (edge function)
- Add SAP field `LMENGE04` → `transaction_quantity` as fallback mapping (or whichever SAP field holds the lot quantity). Currently `LMENGE04` only maps to `blocked_quantity`.

**4. Add refresh time indicator to Inward Materials screen** (UI)
File: `src/pages/InwardReport.tsx`
- Fetch `last_sync_at` from the ZMRB config row on mount and after each refresh.
- Display a badge/text near the title showing "Last synced: 5 min ago" with auto-updating relative time.
- Add a "Next auto-sync in: X min" countdown based on the 5-minute schedule.

### Result
- Scheduler reliably syncs inward data every 5 minutes
- New inspection lots created in SAP appear within the next 5-minute cycle
- Users see when data was last refreshed and when the next sync will happen

