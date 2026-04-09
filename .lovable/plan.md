

## Plan: Fix MB52 Config Resolution — Wrong SAP Config Being Selected

### Problem
The Material Blocking search returns empty data because the wrong SAP config is selected. All three SAP configs share the same endpoint URL containing `/mrb/mb52/mat_stocks`. The `searchStockRecords` function in `useShopFloorStock.ts` uses `.find()` which returns the first match — currently the `SAP_344_Unrestricted_To_Blocked` config (http_method: `GET`), not the `MB52_Stock_Report` config (http_method: `POST`).

With `GET`, the request body (WERKS, LGORT) is dropped (line 464 of edge function only attaches body for POST/PUT/PATCH), so SAP responds "Request Payload is empty".

### Evidence
- Network request shows `config_id: a1000001-0001-0001-0001-000000000003` (the 344 config)
- Edge function logs: `→ GET http://10.10.6.115:8000/mrb/mb52/mat_stocks` — should be POST
- SAP response: `{"CODE":"200","MSG":"Request Payload is empty"}`
- Correct config is `a1000001-0001-0001-0001-000000000001` (`MB52_Stock_Report`, http_method: `POST`)

### Fix — Single file: `src/hooks/useShopFloorStock.ts` (lines 72–76)

Change the config lookup to prioritize matching by **config_name** containing 'mb52' first, falling back to endpoint match only if no name match is found. This ensures `MB52_Stock_Report` is selected over `SAP_344` and `SAP_343` which happen to share the same endpoint path.

Updated logic:
```
1. First: find config where config_name contains 'mb52'
2. Fallback: find config where endpoint contains 'mb52' (but name does NOT contain '343' or '344')
3. If neither found, show empty data with warning
```

Additionally, add a secondary safeguard: treat SAP error responses (where `CODE` exists but no stock fields like `MATNR`/`WERKS` are present) as errors rather than valid records, so users see a clear error message instead of an empty row.

### Result
- The correct MB52 config (POST method) is always selected for stock searches
- SAP receives the request payload correctly and returns actual stock data
- Error responses from SAP are surfaced clearly instead of showing as empty rows

