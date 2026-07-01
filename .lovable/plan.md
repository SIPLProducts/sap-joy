## Goal

Turn the Quality Info screen into a data-entry form that submits a Q-Info creation request to SAP via the existing SAP API framework, using a new SAP API configuration row named "Q-Info Creation".

## API contract (from uploaded doc)

- URL: `https://10.10.47.144:44300/mrb/qinfo/create?sap-client=234`
- Method: `POST`
- Auth: Basic (SIPL_MOUNIKA / Answer$12345678 — user configures via existing SAP API Settings UI, not hardcoded)
- Request body:
  ```json
  { "MATNR": "1000000030", "LIFNR": "2000001", "WERKS": "1100", "REL_UDT": "2026-07-01" }
  ```
- Response: array of `{ MSGTYP, TEXT }` — `MSGTYP === 'E'` is a business error (e.g. "Quality info record already exists"), `S` is success.

## Changes

### 1. Seed SAP API config row (migration)

Insert one row into `sap_api_config` with:
- `config_name`: `Q-Info Creation`
- `description`: `Create Quality Info record in SAP (QI01)`
- `base_url`: `https://10.10.47.144:44300`
- `endpoint_path`: `/mrb/qinfo/create`
- `api_endpoint`: full URL
- `http_method`: `POST`
- `auth_type`: `basic`
- `sap_client`: `234`
- `connection_mode`: same default as other transactional configs
- `is_active`: true
- Credentials left blank so admin fills them via SAP API Settings (or seeded — will confirm below).

Also add the 4 request field rows into `sap_api_request_fields` (`MATNR`, `LIFNR`, `WERKS`, `REL_UDT`, all CHAR) so the Fields dialog shows them.

### 2. Edge function — new action `qinfo_create`

In `supabase/functions/sap-sync/handler.ts`, add a branch mirroring `result_recording`:

- Accepts `{ action: 'qinfo_create', config_id, MATNR, LIFNR, WERKS, REL_UDT }`.
- Validates all four fields present; returns `{ ok:false, error }` (200 OK) if missing.
- Builds body `{ MATNR, LIFNR, WERKS, REL_UDT }` and POSTs via `proxyAwareFetch` with `buildAuthHeaders(config)`.
- Parses JSON response array; if any item has `MSGTYP === 'E'`, returns `{ ok:false, error: TEXT, data: parsed }`. Otherwise `{ ok:true, data: parsed }`.

### 3. Client helper

In `src/lib/sapSyncClient.ts`, add `invokeQInfoCreate({ MATNR, LIFNR, WERKS, REL_UDT })`:
- Resolves config id via `sap_api_config` ilike match on `config_name` / `endpoint_path` containing `qinfo` (fallback keyword `q-info`).
- Calls `invokeSapSync({ action: 'qinfo_create', config_id, MATNR, LIFNR, WERKS, REL_UDT })`.

### 4. Rewrite `src/pages/QualityInfo.tsx`

Replace the current table-of-inspection-lots UI with an input form:

Fields (all required):
- **Material Code** (`MATNR`) — text input.
- **Vendor Code** (`LIFNR`) — text input.
- **Plant** (`WERKS`) — text input, defaulted to the header's Active Plant, editable.
- **Release Until** (`REL_UDT`) — read-only display of today's date in `YYYY-MM-DD` (per doc); sent as today's date at submit time.

Submit button:
- Opens the existing `AlertDialog` confirmation.
- On confirm: calls `invokeQInfoCreate(...)`, shows `toast.success` on `ok:true` (using `TEXT` if present), or `toast.error` with `error` / SAP `TEXT` on failure.
- Clears the form on success; keeps values on error.

Access control: keep `useRoleMatrix('quality_info')` gate and the "No Access" card. Keep the sidebar entry unchanged.

### 5. Persistence (optional, keep existing `quality_info` table)

On successful SAP response, also insert a row into the existing `quality_info` table (material_code, vendor_code, plant, submission_date=now, submitted_by, submitted_by_name, and a new `release_until` date column via a small migration) so the app retains an audit trail. If you'd rather not persist locally, I'll skip this and only call SAP.

## Open questions

1. **Credentials seeding** — should I pre-fill the SAP username/password (`SIPL_MOUNIKA` / the password in the doc) into the new config row, or leave blank so an admin sets them in SAP API Settings (recommended)?
2. **Local audit trail** — keep step 5 (also save each successful submit into `quality_info` with a new `release_until` column), or drop the local insert entirely and rely on SAP only?

If you don't reply, I'll: **(1)** leave credentials blank for admin to fill, and **(2)** keep the local audit insert with a `release_until` column added.
