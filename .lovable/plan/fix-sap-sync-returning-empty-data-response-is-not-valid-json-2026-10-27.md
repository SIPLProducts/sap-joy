# Fix SAP sync returning empty data ("Response is not valid JSON")

## Why it fails
SAP answers correctly (HTTP 200 with a list of records). Your middleware passes that list straight back. But the sync code only looks for the data inside a `body` field. A plain list has no `body` field, so the sync ends up with an empty reply and reports an error. This happens on the cloud and on your local setup.

## What will change
The sync will accept both reply shapes:
- a plain list of records (what your middleware sends now)
- the older wrapped reply with `statusCode` and `body`

Same fix in three places:
1. Manual sync / test (Refresh Data buttons)
2. The automatic 5-minute scheduler
3. Live fetch inside the app (stock and similar screens)

Nothing else changes. Screens, field mapping, the remove-missing-records step and saving all stay the same. `server.js` needs no change.

## After the fix
- Cloud: functions are redeployed automatically.
- On your own server: pull the code, run the edge function deploy script, restart the scheduler, then rebuild the app.

## Technical details
In `fetchViaProxy` (`sap-sync/handler.ts`), the matching proxy parser in `sap-sync-scheduler/index.ts`, and `sapSyncClient.ts`:
- If `proxyResult` is an array, or has no `statusCode`/`body`/`data`/`response` field, treat the whole parsed result as the SAP body, with status 200.
- Otherwise keep the current wrapped-reply logic.
