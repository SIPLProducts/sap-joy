## Goal

When the user clicks **Refresh Data** on **MRB → In-Process Materials**, the SAP request payload must include the **Posting Date From** and **Posting Date To** values currently selected in the page filters. The exact SAP keys (`BUDAT_FROM` / `BUDAT_TO`) come from **SAP API Settings → Request Fields** so admins can rename them later without a code change.

## How the keys are configured

In `SAP API Settings → Request Fields` for the in-process config (`ZMRB_Inward_Process`, ART=04), the admin adds two rows with reserved `field_name` values:

- `field_name = POSTING_DATE_FROM`  → `sap_field_name = BUDAT_FROM`
- `field_name = POSTING_DATE_TO`    → `sap_field_name = BUDAT_TO`

The page does not hardcode `BUDAT_FROM` / `BUDAT_TO` — it only looks up rows by the reserved `field_name` and uses whatever `sap_field_name` the admin configured. Today that is `BUDAT_FROM` / `BUDAT_TO`; tomorrow it can be anything.

## Behavior

1. On **Refresh Data** (`handleAPISync` in `src/pages/InwardInProcessReport.tsx`):
   - Read `filters.postingDateFrom` and `filters.postingDateTo` (already in `YYYY-MM-DD`).
   - Load `sap_api_request_fields` for the active `sapConfigId`, find the two rows whose `field_name` is `POSTING_DATE_FROM` / `POSTING_DATE_TO`.
   - Convert filter values to the SAP date standard (`YYYYMMDD`).
   - Add to `request_overrides` keyed by each row's `sap_field_name` (`BUDAT_FROM` / `BUDAT_TO`), alongside the existing `ART: '04'` and `WERKS: activePlant`.
2. If a filter value is empty, that key is omitted from the override (SAP falls back to its default).
3. If the admin has not configured either reserved field, the refresh proceeds without those keys and a one-time `toast.info` hints that posting-date filtering is not configured in API settings. No hardcoded fallback.
4. Auto-refresh (5-min interval) uses the same logic so background syncs respect the visible filter window.

## Files to change

- `src/pages/InwardInProcessReport.tsx`
  - New helper `buildPostingDateOverrides(sapConfigId, from, to)` that queries `sap_api_request_fields` (cached for the session) and returns `{ [sapKey]: 'YYYYMMDD' }`.
  - Merge result into `request_overrides` in both `handleAPISync` and the auto-refresh `setInterval` callback.

## Admin one-time setup (no code)

In `SAP API Settings → Field Mappings (ZMRB_Inward_Process) → Request Fields`, add:

| Field Name | SAP Field | Type | Required | Description |
|---|---|---|---|---|
| POSTING_DATE_FROM | BUDAT_FROM | date | no | Posting date lower bound from page filter |
| POSTING_DATE_TO   | BUDAT_TO   | date | no | Posting date upper bound from page filter |

## Out of scope

- No DB migration or seed change.
- No change to the backend edge function — it already forwards `request_overrides` verbatim into the SAP call.
- No change to `InwardReport.tsx` (Inward Materials).
