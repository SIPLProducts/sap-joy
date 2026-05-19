## Problem

SAP middleware returns a valid JSON envelope like:

```json
{ "statusCode": 200, "headers": {...}, "body": "Data is not available" }
```

Two bugs make the UI still show "invalid JSON":

1. The regex `isDataNotAvailableBody` doesn't match `Data is not available` (the word "is" between "data" and "not").
2. The envelope IS valid JSON, so `JSON.parse(bodyText)` succeeds. The "not available" string lives in `jsonData.body`, but the current code never inspects that — it falls through to record extraction and downstream code reports the failure as invalid/empty payload.

## Changes (only `src/lib/sapSyncClient.ts`)

### 1. Broaden the regex (line 5–6)

```ts
const isDataNotAvailableBody = (text: string) =>
  /data\s+(is\s+|are\s+)?not\s*available|no\s+data\s+(found|available)|no\s+records?\.?\s+found/i.test(text || '');
```

### 2. Detect "not available" inside parsed JSON envelope

Right after each successful `JSON.parse(bodyText)` (3 sites: ~line 838, ~line 1072, ~line 1332 — same pattern as existing `isDataNotAvailableBody` call sites), add:

```ts
const innerBody = typeof jsonData?.body === 'string' ? jsonData.body : '';
const envelopeMessage = typeof jsonData?.message === 'string' ? jsonData.message : '';
if (isDataNotAvailableBody(innerBody) || isDataNotAvailableBody(envelopeMessage)) {
  await supabase.from('sap_stock_sync_history').update({
    status: 'success',
    records_processed: 0,
    error_message: null,
    completed_at: new Date().toISOString(),
  }).eq('id', syncRecord.id);
  return {
    data: { success: true, records: [], total: 0, message: 'Data not available', sync_id: syncRecord.id },
    error: null,
  };
}
```

(Use the correct history table name per site — `sap_stock_sync_history` / `sap_sync_history` matching the existing block above it.)

### 3. UI toast (already in place)

`InwardInProcessReport.tsx` already converts `message: 'Data not available'` into a friendly `toast.info('Data not available', …)`, so no UI change needed.

## Out of scope

- Posting-date payload logic
- Other sync screens
- Backend / SQL
