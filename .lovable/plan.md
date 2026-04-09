

## Plan: Add Auto-Refresh with Live Indicator on Inward Materials Screen

### Current State
The page already has `lastSyncAt` / `relativeTime` / `nextSyncIn` state and badges showing "Last synced: X min ago" and "Next sync: ~Y min". However, there is **no automatic data refresh** — the data only refreshes on manual button click or page mount.

### Changes — Single file: `src/pages/InwardReport.tsx`

**1. Add auto-refresh interval (every 5 minutes)**
- Add a `useEffect` with a `setInterval` that calls `refreshData()` every 5 minutes (300,000 ms)
- After each auto-refresh completes, update `lastSyncAt` to `new Date().toISOString()`
- Add an `isAutoRefreshing` state to show a subtle indicator during background refresh (without blocking the UI like the manual sync button does)

**2. Update relative time more frequently**
- Change the relative-time update interval from 30s to 15s so "Last synced" feels more responsive

**3. Enhance the sync indicator UI**
- Add a small pulsing green dot next to "Last synced" badge to show auto-refresh is active
- When auto-refresh is in progress, show a spinning icon on the "Next sync" badge
- Add tooltip or text: "Auto-refreshes every 5 min" so users understand the behavior

**4. Re-fetch `last_sync_at` from database after auto-refresh**
- After each auto-refresh, query `sap_api_config` for the latest `last_sync_at` value (in case the background scheduler also ran), ensuring the timestamp shown is always accurate

### Result
- Data auto-refreshes every 5 minutes without user intervention
- Users see a live "Last synced: 2 min ago" indicator that updates every 15 seconds
- A green pulse dot confirms auto-refresh is active
- New inspection lots from SAP appear automatically within minutes

