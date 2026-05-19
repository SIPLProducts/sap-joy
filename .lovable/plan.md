## What I found

The current in-process refresh code only looks for request-field rows named `POSTING_DATE_FROM` and `POSTING_DATE_TO`. Your API settings currently have the rows directly as:

```text
field_name      sap_field_name
BUDAT_FROM      BUDAT_FROM
BUDAT_TO        BUDAT_TO
```

So the app does not resolve those rows as posting-date mappings, and the alert still mentions the old reserved names.

## Plan

1. Update `src/pages/InwardInProcessReport.tsx` so posting-date mapping accepts both formats:
   - Preferred/direct format: `BUDAT_FROM` and `BUDAT_TO`
   - Backward-compatible format: `POSTING_DATE_FROM` and `POSTING_DATE_TO`

2. When filters are selected, build `request_overrides` like this:

```text
ART: '04'
WERKS: selected plant
BUDAT_FROM: selected posting date from in YYYYMMDD
BUDAT_TO: selected posting date to in YYYYMMDD
```

3. Update the alert/toast text so it refers to `BUDAT_FROM` and `BUDAT_TO`, not only `POSTING_DATE_FROM` / `POSTING_DATE_TO`.

4. Keep behavior safe:
   - If a date filter is empty, omit that key.
   - If mapping is missing, show a clear info message.
   - No database migration is needed because the rows already exist in your API settings.