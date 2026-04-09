

## Plan: Fix MB52 Live Fetch Not Returning Data on Material Blocking Screen

### Root Cause
Two bugs in the **edge function** `sap-sync/index.ts` `fetch_live` handler:

1. **Search params ignored**: The client sends WERKS/LGORT as `body.search_params`, but the edge function only merges `body.request_body` (line 439). So the user's plant/storage location selections never reach SAP.

2. **Wrong field mapping keys**: The edge function maps records using `field.field_name` (e.g., `WERKS`, `MATNR`) as output keys. But the client expects `map_to_column` values (e.g., `plant`, `material_code`). Records without `plant` and `material_code` keys are filtered out, so the UI shows nothing.

The SAP API **is connected and returning data** (confirmed in logs: 392KB responses with stock records). The data is just lost in translation.

### Changes — Single file: `supabase/functions/sap-sync/index.ts`

**Fix 1** (around line 439): Also merge `body.search_params` into the request payload:
```typescript
if (body.request_body && typeof body.request_body === 'object') {
  Object.assign(requestPayload, body.request_body)
}
// Also merge search_params from the UI (WERKS, LGORT, MATNR, MATART)
if (body.search_params && typeof body.search_params === 'object') {
  for (const [key, value] of Object.entries(body.search_params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      requestPayload[key] = String(value).trim()
    }
  }
}
```

**Fix 2** (line 493): Use `map_to_column` instead of `field_name` as the output key:
```typescript
const outKey = field.map_to_column || field.field_name
mapped[outKey] = item[sapKey] ?? null
```

### Result
- User selects Plant + Storage Location and clicks Search
- Edge function sends WERKS/LGORT to SAP via proxy
- SAP returns MB52 stock records
- Records are mapped with correct column names (`plant`, `material_code`, `available_quantity`, etc.)
- UI displays the stock data in the table

