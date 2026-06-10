## Goal

When clicking **Refresh Data** in MRB Inward Materials (ART=`01`), include `BUDAT_FROM` and `BUDAT_TO` in the SAP request body, sourced from the screen's **Posting Date From** and **Posting Date To** filters.

## Change

**File:** `src/pages/InwardReport.tsx` → `handleAPISync` (around line 484)

Currently the sync call sends only `ART` and `WERKS`:
```ts
request_overrides: { ART: '01', WERKS: werks }
```

Update it to also include the posting-date range pulled from `filters.postingDateFrom` / `filters.postingDateTo`, formatted as SAP's required `YYYYMMDD` string (per project memory `SAP Date Format Standard`). The filter values come from `<input type="date">` so they are already `YYYY-MM-DD` — we just strip the dashes.

```ts
const toSapDate = (iso?: string) => (iso ? iso.replace(/-/g, '') : '');

const overrides: Record<string, string> = { ART: '01', WERKS: werks };
if (filters.postingDateFrom) overrides.BUDAT_FROM = toSapDate(filters.postingDateFrom);
if (filters.postingDateTo)   overrides.BUDAT_TO   = toSapDate(filters.postingDateTo);

const { data: syncData, error: syncError } = await invokeSapSync({
  action: 'sync',
  config_id: sapConfigId,
  request_overrides: overrides,
});
```

Only emit the keys when the corresponding filter has a value, so an empty filter does not push an empty string to SAP.

## Out of scope

- No edge function / middleware / server.js changes — `request_overrides` is already forwarded through the existing sync pipeline.
- No changes to auto-sync scheduler or other ART types.
- No UI changes; the existing Posting Date From/To inputs are reused as-is.

## Verification

1. Set Posting Date From/To on the Inward Materials screen.
2. Click **Refresh Data**.
3. In the SAP middleware/proxy log, confirm the request body contains `ART`, `WERKS`, `BUDAT_FROM`, `BUDAT_TO` in `YYYYMMDD` format.
4. Clear the date filters and refresh — confirm `BUDAT_FROM`/`BUDAT_TO` are omitted from the payload.
