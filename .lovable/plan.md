# Friendlier "Data not available" alert for in-process refresh

When SAP returns a response body containing the text `Data not available` (typical when no records match the posting-date / plant filter), the JSON parse fails and the UI currently surfaces `Response is not valid JSON`. Replace that with a clear, user-friendly message.

## Changes

### 1. `src/lib/sapSyncClient.ts` — detect "Data not available" in raw body

Add a tiny helper near the top of the file:

```ts
const isDataNotAvailableBody = (text: string) =>
  /data\s*not\s*available|no\s+data\s+(found|available)|no\s+records?\s+found/i.test(text || '');
```

Update the three JSON-parse `catch` blocks (around lines 823, 1057, 1317) so that, before returning the generic "not valid JSON" error, they check the raw body:

```ts
} catch {
  if (isDataNotAvailableBody(bodyText)) {
    // (where applicable) mark sync history as success-with-no-records
    return {
      data: { success: true, records: [], total: 0, message: 'Data not available' },
      error: null,
    };
  }
  // ...existing "Response is not valid JSON" path
}
```

Also apply the same check in the `!response.ok` branch (~line 807) so that an HTTP-200-with-error-body or 4xx body carrying "Data not available" still yields the friendly message rather than `SAP API returned 4xx: ...`.

For the sync-history row (line 823 path), record `status: 'success'`, `records_processed: 0`, `error_message: null` instead of `failed`.

### 2. `src/pages/InwardInProcessReport.tsx` — friendlier toast

In `handleAPISync` / `invokeSapSync`, when the returned `data.error` (or thrown error message) matches the same `Data not available` pattern, show:

```ts
toast.info('Data not available', {
  description: 'SAP returned no records for the selected filters.',
});
```

instead of the raw error. Keep all other errors unchanged.

### Out of scope

- No backend / SQL changes.
- No change to posting-date payload behavior (already fixed).
- No change to other sync screens — only the in-process refresh path.
