## Goal

Make every field in the Result Recording `CHAR[]` payload available as a configurable column in the modal, so admins can show/hide/reorder them via SAP API Settings → Response Fields without any code change.

## Current state

- `Result_Recording_View` config currently has only 13 `char` columns seeded.
- The modal already renders all `char` rows from `sap_api_response_fields` dynamically — so the only gap is missing field rows.
- The user's sample payload contains ~70 distinct fields per CHAR element.

## Changes

### 1. Seed missing CHAR fields (data insert, no schema change)

Insert one `sap_api_response_fields` row per missing CHAR field for the `Result_Recording_View` config, with `description='char'` and incrementing `sort_order` starting after the existing max (114+). Skip fields already seeded.

Fields to add (in display order), each as `json_path = CHAR[].<SAP_NAME>`:

| Group | SAP fields |
|---|---|
| Identity | `INSPLOT`, `INSPOPER` |
| Status | `CHAR_ATTR`, `CHAR_INVAL`, `EVALUATION`, `ERR_CLASS` |
| Counts | `VALID_VALS`, `NONCONF`, `DEFECTS`, `VALS_ABOVE`, `VALS_BELOW` |
| Stats | `MEAN_VALUE`, `VARIANCE` |
| Timing | `START_DATE`, `START_TIME`, `END_DATE`, `END_TIME` |
| Inspector / remarks | `INSPECTOR`, `RES_ORG`, `REMARK` |
| Primary code | `CODE1`, `CODE_GRP1` |
| Catalog | `KATAB1`, `KATALGART1`, `AUSWMENGE1`, `AUSWAHLMGE` |
| Code group / code | `CODEGRUPPE`, `CODE`, `CODE_DESP`, `BEWERTUNG`, `FEHLKLASSE` |
| Alt codes | `CODE_1`/`CODE_DESP_1`/`BEWERTUNG_1`/`FEHLKLASSE_1` … `_5` (20 fields) |
| Selected set | `AUSWVERS1`, `AUSWDAT1` |
| Misc | `HPZ` |

Friendly default labels (`field_name`) e.g. `INSPCHAR → "Char #"`, `KURZTEXT → "Characteristic"`, `BEWERTUNG → "Valuation"`, `CODE_DESP_1 → "Alt Code 1 Desc"`, etc. Admins can rename later in the UI.

All inserted rows default to active and visible. To keep the modal readable out of the box, only the 13 already-seeded columns remain in the "compact" sort range (101–113); the new ones get sort_orders 114+ so they appear after — admins can reorder/hide via the SAP API Settings UI.

### 2. No code change required

The modal (`ResultRecordingModal.tsx`) already:
- Loads `sap_api_response_fields` filtered by `description='char'`
- Renders one column per row, sorted by `sort_order`, using `field_name` as the header label
- Reads each value via the configured `json_path`

So once the rows exist, every CHAR field becomes available, and renaming/reordering/hiding is done from the existing Response Fields admin screen.

### Out of scope

- No changes to the `RESVAL[]` columns (already seeded; user request was about CHAR headers).
- No new admin UI — the existing Response Fields editor under SAP API Settings is used for configuration.
- No edge function or schema changes.

## Verification

After insert:
- Open MRB Worklist → click eye icon on a row → modal shows the full CHAR table with all configured columns.
- Go to SAP API Settings → `Result_Recording_View` → Response Fields → confirm all CHAR fields are listed and editable (label, sort order, active flag).
