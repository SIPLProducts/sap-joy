## Root cause

Edge function logs show that when the user clicks Refresh on `/inward/report`, `sap-sync` calls SAP and gets back **HTTP 200** with body `Data is not available` (plain text, 21 bytes).

`callSAPApi` in `supabase/functions/sap-sync/handler.ts` (line ~1090) blindly does `JSON.parse(bodyText)` on any 200 response, which throws and returns:

> Response is not valid JSON: Data is not available

That is the alert the user sees.

There are also two reasons SAP is returning that plain-text "no data" reply for the Inward Inspection (ART=01) call but not for In-Process:

1. The manual `callSAPApi` does not add `MAX_ROWS` / `MAX_HITS` to the request body, while the scheduler (`sap-sync-scheduler/index.ts`, lines 639-642) does. SAP for ZMRB_Inward_Inspection appears to return "Data is not available" without those bounds.
2. `callSAPApi` does not pad `ART` to 2 digits and does not strip empty `MATNR` / `CHARG`, while the scheduler does (lines 632-633, 644-648). Empty optional filters are interpreted by SAP as "match nothing".

The In-Process page works because its config (ART=04) currently returns rows from SAP regardless. So both screens should use the same robust payload-building used by the scheduler.

## Fix

Edit `supabase/functions/sap-sync/handler.ts` only.

### 1. Treat SAP "Data is not available" plain-text reply as success-with-zero-records

In `callSAPApi`, before `JSON.parse`, detect the SAP "no data" sentinel and return success with empty records, matching pre-regression behavior:

```ts
if (response.ok) {
  const trimmed = bodyText.trim();
  // SAP returns plain text "Data is not available" (HTTP 200) when filters match nothing.
  if (/^data\s+is\s+not\s+available/i.test(trimmed)) {
    return { success: true, data: [], debug };
  }
  try {
    const jsonData = JSON.parse(bodyText);
    const records = jsonData?.d?.results || jsonData?.value || jsonData?.data
      || (Array.isArray(jsonData) ? jsonData : [jsonData]);
    return { success: true, data: records, debug };
  } catch {
    return { success: false, error: `Response is not valid JSON: ${bodyText.substring(0, 200)}`, debug };
  }
}
```

### 2. Mirror scheduler payload construction in `callSAPApi`

Replace the body-building block (lines 1024-1031) with the same logic used by `sap-sync-scheduler/index.ts` (lines 619-648):

- Pad `ART` / `INSPECTION_TYPE` default values with `padStart(2, '0')`.
- Skip optional fields that are not required and have no default value.
- After build, if `config.max_records` is set, default `MAX_ROWS` and `MAX_HITS` to it.
- Drop `MATNR` and `CHARG` if their value is an empty string.

This restores the working behavior from ~10 days ago (before the In-Process screen was added) without touching the keyword-/mapping-based config selection that was reverted previously.

## Files touched

- `supabase/functions/sap-sync/handler.ts` — only `callSAPApi` (request-body builder + 200-response handling).

No DB changes. No frontend changes. The In-Process page is unaffected because it already used the scheduler-style payload via its own path, and the new code only makes the manual path equally tolerant.

## Verification

After deploy:
1. On `/inward/report`, click Refresh — instead of the "invalid json" alert, the user should see either inserted/updated counts (if SAP has rows) or a clean "0 fetched" success toast (if SAP responds "Data is not available").
2. On `/inward/inprocess/report`, behavior is unchanged.
3. Edge logs for `sap-sync` should show `Payload keys: WERKS, ART, MAX_ROWS, MAX_HITS` (matching scheduler) instead of `WERKS, ART, ...empty optionals`.
