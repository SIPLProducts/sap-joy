## What you're asking

Send the **exact same request body** to SAP that was being sent ~10 days ago for ART=01 (when 90+ rows came back), instead of the slimmed-down body the current code produces.

## Why the body changed

In the previous fix I made `callSAPApi` mirror the scheduler:
- Skip optional fields that have no default value (so `LGORT`, `PRUEFLOS`, `MATNR`, `LIFNR`, `ZEILE`, `BLDAT` are dropped entirely if blank)
- Auto-add `MAX_ROWS` / `MAX_HITS` from `config.max_records`
- Pad `ART` to 2 digits and strip empty `MATNR`/`CHARG`

Result: payload became `{ WERKS, ART, MAX_ROWS, MAX_HITS }`.
Earlier behavior was: send **every** field defined in `sap_api_request_fields`, with empty string for blanks, no `MAX_ROWS`/`MAX_HITS` injection.

For ZMRB01 the SAP function module evidently behaves differently between those two payload shapes — the older "all keys present, empty strings" shape returned 90+ rows, the new slimmed shape returns "Data is not available".

## Fix — revert `callSAPApi` payload builder to original behavior

File: `supabase/functions/sap-sync/handler.ts` only. Change the POST/PUT/PATCH body block (lines ~1024-1052) back to:

```ts
let requestBody: any = undefined
if (['POST', 'PUT', 'PATCH'].includes(method) && requestFields.length > 0) {
  requestBody = {}
  requestFields.forEach((field) => {
    const key = field.sap_field_name || field.field_name
    if (requestOverrides[key] !== undefined) {
      requestBody[key] = requestOverrides[key]
      return
    }
    // Always include the field; use default if provided, else empty string
    requestBody[key] = field.default_value ?? ''
  })
}
```

Specifically remove:
1. The `is_required || default_value` gate that skipped blank optional fields.
2. The `ART` `padStart(2, '0')` (the DB already stores `01` / `04` as strings).
3. The auto-injection of `MAX_ROWS` / `MAX_HITS`.
4. The empty-`MATNR`/`CHARG` strip loop.

Keep the "Data is not available" → success-with-empty-data handler from the previous fix (lines ~1110-1115), so we still don't throw "invalid JSON" if SAP genuinely returns no rows.

## Resulting payload (matches pre-regression)

For Inward Materials (ART=01):
```json
{ "WERKS":"1300","LGORT":"","PRUEFLOS":"","MATNR":"","LIFNR":"","ZEILE":"","ART":"01","BLDAT":"" }
```
For In-Process (ART=04): same shape with `ART:"04"`.

## Files touched

- `supabase/functions/sap-sync/handler.ts` — only the manual `callSAPApi` body builder.

No DB, no frontend, no scheduler changes. The scheduler keeps its current logic (it already works for ART=04, and Inward auto-sync runs every 5 min with whatever payload it had — note: scheduler still pads/strips; if you also want the scheduler reverted for ART=01, say so and I'll include it).

## Verification

1. On `/inward/report` click Refresh.
2. Edge logs for `sap-sync` should now show `Payload keys: WERKS, LGORT, PRUEFLOS, MATNR, LIFNR, ZEILE, ART, BLDAT` (8 keys, matching the DB request fields).
3. SAP should return the previous 90+ rows for ART=01.
4. ART=04 (In-Process) should continue returning rows.
