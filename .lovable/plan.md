## Goal

When the user clicks **Refresh Data** on **MRB → In-Process Materials**, the SAP request payload must include the **Posting Date From** and **Posting Date To** values currently selected in the page filters. The exact SAP field keys used in the payload must come from **SAP API Settings** (not hardcoded), so admins can rename them per SAP API contract.

## How the keys are configured

In `SAP API Settings → Request Fields` for the in-process config (`ZMRB_Inward_Process`, ART=04), the admin marks two existing/new request fields with reserved `field_name` semantics:

- `field_name = POSTING_DATE_FROM`  → `sap_field_name` (e.g., `BUDAT_FROM` / `DATUB_FROM`)
- `field_name = POSTING_DATE_TO`    → `sap_field_name` (e.g., `BUDAT_TO`   / `DATUB_TO`)

The page does not care what `sap_field_name` is — it only looks up rows by the reserved `field_name` to discover the SAP key.

## Behavior

1. On **Refresh Data** (`handleAPISync` in `src/pages/InwardInProcessReport.tsx`):
   - Read `filters.postingDateFrom` and `filters.postingDateTo` (already in `YYYY-MM-DD`).
   - Load `sap_api_request_fields` for the active `sapConfigId`, find the two rows whose `field_name` is `POSTING_DATE_FROM` / `POSTING_DATE_TO`.
   - Convert filter values to the SAP date standard (`YYYYMMDD`, per existing memory).
   - Add to `request_overrides` keyed by each row's `sap_field_name`, alongside the existing `ART: '04'` and `WERKS: activePlant`.
2. If a filter value is empty, that key is omitted from the override (SAP gets nothing — fall back to its default).
3. If the admin has not configured either reserved field, the refresh proceeds without those keys and a one-time `toast.info` hints that posting-date filtering is not configured in API settings. No hardcoded fallback like `BUDAT_FROM`.
4. Auto-refresh (5-min interval) uses the same logic so background syncs respect the visible filter window.

## Files to change

- `src/pages/InwardInProcessReport.tsx`
  - New helper `buildPostingDateOverrides(sapConfigId, from, to)` that queries `sap_api_request_fields` (cached in a `useRef`/state for the session) and returns `{ [sapKey]: 'YYYYMMDD' }`.
  - Merge result into `request_overrides` in both `handleAPISync` and the auto-refresh `setInterval` callback.

## Out of scope

- No DB migration or seed change. Admins add/update the two request-field rows themselves in SAP API Settings.
- No change to the backend edge function — it already forwards `request_overrides` verbatim into the SAP call.
- No change to `InwardReport.tsx` (Inward Materials) unless you also want it; this plan covers In-Process only as requested.
