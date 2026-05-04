## Goal

Add a **Result Recording** action (eye icon) after the **View** button on every MRB Worklist row. Clicking it calls a configurable SAP API with `INSPLOT` + `INSPOPER`, then opens a modal that shows the returned `CHAR[]` array as a table. Each CHAR row has an expand/"split" button that reveals its matching `RESVAL[]` rows (joined on `INSPCHAR`) inline within the same modal.

The SAP endpoint is registered through the existing **SAP API Settings** screen (same as MB52, ZMRB_Inward_Process, etc.) so URL/credentials/headers are admin-configurable. The displayed columns for CHAR and RESVAL are also driven by `sap_api_response_fields` so they can be tuned without code changes.

## User-visible changes

1. **MRB Worklist** (`src/pages/Worklist.tsx`)
   - Both worklist tables (InProcess and main worklist) get a new outline button next to **View**:
     - Icon: `ScanEye` (lucide) to differentiate from the existing `Eye` View icon
     - Label: `Result Recording`
     - Disabled when the row has no `inspectionLot` (with tooltip "Inspection Lot missing")
   - Clicking opens `<ResultRecordingModal>` passing `{ inspectionLot, inspOper }`. `inspOper` defaults to `"0010"` when not stored on the record (matches the sample request).

2. **Result Recording Modal** (new `src/components/mrb/ResultRecordingModal.tsx`)
   - Header shows lot context: Inspection Lot, Material, Material Description, Batch, GRN, Vendor (taken from the SAP response top-level fields — `INSPLOT`, `MATNR`, `MAKTX`, `CHARG`, `ZZGRN`, `ZZSUPL`).
   - Loading spinner while the call is in flight; clear error banner on failure.
   - **Main table** lists `CHAR[]` rows. Default columns (configurable):
     `INSPCHAR`, `KURZTEXT` (Characteristic), `CODE_DESP` (Result), `BEWERTUNG` (Valuation), `SOLLSTPUMF` (Required Samples), `MENGENEINH` (UoM), `TOLGRENZE` (Tolerance).
   - First column of each CHAR row is an expand toggle (`ChevronRight` / `ChevronDown` — the "split" button). Toggling expands an inline sub-row spanning all columns that renders the **RESVAL sub-table** filtered by `RESVAL.INSPCHAR === CHAR.INSPCHAR`.
   - RESVAL sub-table columns (configurable): `RES_NO`, `RES_VALUE`, `RES_VALUAT`, `INSPECTOR`, `CODE1`, `ORIGINAL_INPUT`, `REMARK`, `BATCH`, `FORMULA`. Empty-state message when no matching RESVAL rows.
   - Footer: `Close` button only (read-only view in this iteration).

3. **SAP API Settings** — no UI changes. The admin creates a new config row called `ZMRB_Result_Recording` (or any name) using the existing form, with:
   - `http_method`: `POST`
   - `endpoint_path`: provided by SAP team (e.g. `/mrb/quality/result_recording`)
   - Request fields configured via the existing **Fields** dialog: two static-mapped request fields `INSPLOT` and `INSPOPER` whose values come from the caller.
   - Response fields: define the CHAR and RESVAL columns we want surfaced (used to drive the modal's column headers/order).

## Backend / SAP integration

Edge function: extend `supabase/functions/sap-sync/handler.ts` with a new `action: 'result_recording'`.

- Body shape: `{ action: 'result_recording', config_id?, inspection_lot, insp_oper }`.
- `config_id` resolution (in this order):
  1. Use `config_id` if supplied.
  2. Otherwise look up `sap_api_config` by keyword (`config_name ILIKE '%result%record%'` or `endpoint_path ILIKE '%result_recording%'`) using `.maybeSingle()` — same dynamic resolution pattern documented in `mem://technical/sap-config-dynamic-resolution`.
- Build payload exactly as SAP expects:
  ```json
  { "GET": { "INSPLOT": <number>, "INSPOPER": "<string>" } }
  ```
  `INSPLOT` is sent as a number (matching the sample); `INSPOPER` is zero-padded to 4 chars per existing SAP string-format rule.
- Reuse the existing `buildSapTargetUrl` / `fetchViaProxy` / `callSAPApi` helpers — no new transport code. Auth, proxy secret, sap-client query param, and 60 s timeout all flow through unchanged.
- Response handling:
  - On HTTP 200 + JSON parseable: return `{ ok: true, data: <full SAP body> }` (HTTP 200 wrapper, per `mem://technical/edge-function-response-protocol`).
  - On failure: return `{ ok: false, error, debug }` with HTTP 200 so the modal can show a toast + inline error.
- No DB writes — this is a read-only fetch. Nothing is persisted to Supabase in this iteration.

Client wrapper: add `invokeResultRecording({ inspectionLot, inspOper })` in `src/lib/sapSyncClient.ts`, mirroring the existing `invokeSapSync` shape (calls the same `sap-sync` function with the new action).

## Configurability of the modal columns

To match the request "make it as configurable similarly like other APIs":

- Use the existing `sap_api_response_fields` table. We add a convention: rows whose `json_path` starts with `CHAR[].` map to CHAR-table columns; rows starting with `RESVAL[].` map to the RESVAL sub-table; rows with no array prefix map to the modal header chips.
- A small new hook `useResultRecordingFields(configId)` reads these rows once when the modal opens and builds three column lists (header / char / resval). If no config rows are found, it falls back to the hardcoded defaults listed above so the feature works out of the box.

## Files touched

- New: `src/components/mrb/ResultRecordingModal.tsx`
- New: `src/hooks/useResultRecordingFields.ts`
- Edit: `src/pages/Worklist.tsx` — add button in both action cells, manage modal state
- Edit: `src/lib/sapSyncClient.ts` — add `invokeResultRecording`
- Edit: `supabase/functions/sap-sync/handler.ts` — add `result_recording` action branch (and deploy)

## Out of scope (this iteration)

- Editing/saving result values back to SAP (the response shows `RES_VALUE` blanks; this view is read-only for now).
- Persisting the fetched results to Supabase.
- Auto-creating the `ZMRB_Result_Recording` config row — admin creates it via SAP API Settings using the SAP-provided endpoint path.
