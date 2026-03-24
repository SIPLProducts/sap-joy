
Goal: remove the false “connection success” signal for MB52, stop the 500 on real sync, and make ZMRB data visibility explicit in the UI.

What I found
- MB52 “Test Connection” and MB52 “Sync” are not testing the same thing.
  - `directTest()` sends an empty `{}` body and only checks whether the route is reachable.
  - `directSync()` builds a real payload from `sap_api_request_fields`.
- Your current MB52 request-field setup is the likely root cause of the 500:
  - `WERKS` = required
  - `LGORT` = required
  - `MATNR` = required but empty
  - `MATART` = required (`ZROH`)
  - `CHARG` = required but empty
  - `XMCHB` = required (`X`)
- Because `MATNR` and `CHARG` are marked required, the frontend still sends them as empty strings during sync. That matches the current code and explains why “test connection” passes but the real POST fails with 500.
- For ZMRB, the backend path itself looks healthy:
  - recent sync history shows `records_fetched=19` and `records_inserted=19`
  - `inward_inspection_lots` already contains rows
  - the `HEAD /rest/v1/inward_inspection_lots?select=*` call is only the count/check request used by the UI, not the row fetch itself

Plan
1. Fix MB52 configuration first
- In the database, change MB52 request fields `MATNR` and `CHARG` from required to optional.
- Keep `WERKS`, `LGORT`, `MATART`, and `XMCHB` as required.
- Re-test MB52 sync after that change before changing code again.

2. Improve frontend validation for request fields
- In the sync flow, validate configured request fields before calling SAP.
- If a field is marked required but has no value, stop locally and show a clear error like:
  - “MB52 config is invalid: MATNR and CHARG are marked required but have no default values.”
- This prevents misleading SAP 500s caused by bad config.

3. Make “Test Connection” messaging more accurate
- Rename/reword the success state to mean transport reachability only.
- Example:
  - “Connection reachable”
  - “Route/auth OK, but this does not validate the full sync payload”
- Add a separate “Validate Payload” or use the real sync payload for POST-based endpoint tests.

4. Improve ZMRB visibility after sync
- After successful sync, refresh the data source used by Inward Report and Sync Monitor.
- Show explicit counts in the UI:
  - rows in `inward_inspection_lots`
  - inserted this sync
  - last sync time
- If rows exist but a page shows none, show a friendly empty-state hint:
  - “Data exists, but current filters/plant restrictions are hiding the rows.”

5. Add better diagnostics in Sync Monitor
- Show the actual request payload used for POST APIs.
- Show the first sync-history error inline.
- Distinguish:
  - transport test
  - sync fetch
  - database insert result

Technical details
Run this first on your self-hosted database for MB52:
```sql
UPDATE public.sap_api_request_fields
SET is_required = false
WHERE config_id = 'a1000001-0001-0001-0001-000000000001'
  AND sap_field_name IN ('MATNR', 'CHARG');
```

Verify MB52 request-field config:
```sql
SELECT config_id, field_name, sap_field_name, default_value, is_required, sort_order
FROM public.sap_api_request_fields
WHERE config_id = 'a1000001-0001-0001-0001-000000000001'
ORDER BY sort_order;
```

Verify latest ZMRB sync results:
```sql
SELECT id, config_id, status, records_fetched, records_inserted, records_updated, error_message, started_at, completed_at
FROM public.sap_stock_sync_history
WHERE config_id = 'a1000001-0001-0001-0001-000000000004'
ORDER BY started_at DESC
LIMIT 10;
```

Verify ZMRB rows really exist:
```sql
SELECT count(*) AS total_rows
FROM public.inward_inspection_lots;
```

Preview the latest inward rows:
```sql
SELECT inspection_lot, material_code, plant, vendor_code, vendor_name, status, created_at
FROM public.inward_inspection_lots
ORDER BY created_at DESC
LIMIT 20;
```

Expected outcome
- MB52 stops sending empty `MATNR`/`CHARG`, so the 500 should disappear if SAP accepts those fields as optional.
- If MB52 still fails after that, the next issue is middleware/SAP-side payload rules, not routing.
- ZMRB should be treated as a visibility/UX issue unless the self-hosted database proves otherwise, because the sync path is already inserting rows successfully.
