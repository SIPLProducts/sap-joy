
## Make “Refresh Data” Run the Same SAP Sync as “Trigger Sync” for MRB Inward Materials

### Requirement
On the **MRB - Inward Materials** screen, clicking **Refresh Data** should:

1. Run the same SAP sync functionality used by **SAP Sync Monitor → Trigger Sync** for the Inward Materials API.
2. After SAP sync completes, re-fetch the latest data from the database.
3. Update the frontend table immediately with the latest inward inspection lot records.

## Current Behavior
The current **Refresh Data** button in `src/pages/InwardReport.tsx` only calls:

```ts
await refreshData();
```

That means it refreshes from the database only. It does not trigger the actual SAP sync.

The SAP Sync Monitor already uses the correct sync path:

```ts
await invokeSapSync({ action: 'sync', config_id: configId });
```

So the Inward Materials page needs to use this same path before refreshing local display data.

## Implementation Plan

### 1. Import the SAP sync client into Inward Materials
Update `src/pages/InwardReport.tsx` to import:

```ts
import { invokeSapSync } from '@/lib/sapSyncClient';
```

This allows the page to call the same sync flow used by SAP Sync Monitor.

### 2. Update the Refresh Data button handler
Replace the current `handleAPISync` logic with a two-step process:

```text
Click Refresh Data
  → validate inward SAP config exists
  → call SAP sync with action = "sync"
  → wait for sync result
  → if successful, refresh data from database
  → update table/search results
  → refresh last_sync_at timestamp
  → show success/failure message
```

The handler will call:

```ts
const { data, error } = await invokeSapSync({
  action: 'sync',
  config_id: sapConfigId,
});
```

Then call:

```ts
await refreshData();
```

### 3. Keep the frontend table in sync after database refresh
After the database refresh finishes, the existing `inspectionLotRecords` effect already updates `searchResults`.

I will keep that behavior, but make the refresh flow explicitly preserve the current user experience:

- refresh all inward data from the database
- keep the page in “searched/results visible” mode
- clear stale selection state if needed
- update pagination safely

### 4. Improve user feedback
Change toast messages so the user can clearly tell what happened:

Success example:

```text
SAP sync complete. Fetched: X, Inserted: Y, Updated: Z. Display refreshed.
```

Failure example:

```text
SAP sync failed: [reason]
```

If the database refresh succeeds but SAP sync fails, the page will show the SAP failure and avoid falsely showing “Data refreshed successfully”.

### 5. Refresh the correct last sync timestamp
Instead of setting `lastSyncAt` to the browser’s current time, re-read `last_sync_at` from `sap_api_config` after sync.

This avoids showing a fake successful timestamp if the SAP sync did not actually update the backend config.

### 6. Prevent duplicate clicks while syncing
Keep the existing `isSyncing` loading state so users cannot trigger multiple SAP syncs at the same time.

The button will continue showing:

```text
Syncing...
```

while the SAP sync and database refresh are running.

## Files to Update

### `src/pages/InwardReport.tsx`
Planned changes:

- import `invokeSapSync`
- update `handleAPISync`
- validate `sapConfigId`
- trigger SAP sync using `action: 'sync'`
- refresh database data after SAP sync
- re-fetch `last_sync_at`
- improve success/error toast messages

## Expected Result

After this change:

- Clicking **Refresh Data** in **MRB - Inward Materials** will behave like **SAP Sync Monitor → Trigger Sync** for the inward SAP API.
- New SAP data will be pulled first.
- The latest database records will then be fetched and displayed in the frontend.
- The user will see accurate sync status and error messages.
- The page will no longer only refresh old database data without first syncing from SAP.
