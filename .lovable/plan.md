## Goal

Replace the current Result Recording modal columns with a fixed 9-column layout, applied identically to both the parent CHAR rows and the expanded RESVAL sub-rows, with values resolved per the user's mapping rules.

## Target columns (same for CHAR and RESVAL)

| # | Label | CHAR source | RESVAL source |
|---|-------|-------------|---------------|
| 1 | Char NO | `CHAR.INSPCHAR` | `RESVAL.RES_NO` |
| 2 | Char Type | `CHAR.KATAB1` | parent `CHAR.KATAB1` |
| 3 | Characteristic Name | `CHAR.KURZTEXT` | parent `CHAR.KURZTEXT` |
| 4 | Specifications | `CHAR.TOLGRENZE` | parent `CHAR.TOLGRENZE` |
| 5 | Sample | `CHAR.SOLLSTPUMF` | parent `CHAR.SOLLSTPUMF` |
| 6 | Result | If `KATAB1=='X'` → `CHAR.NONCONF`, else `CHAR.MEAN_VALUE` | `RESVAL.RES_VALUE` |
| 7 | Visual Result | If `BEWERTUNG=='A'` → `CHAR.CODE_DESP`; if `BEWERTUNG=='R'` → `CHAR.CODE_DESP_1` | (blank — visual is per-char) |
| 8 | A/R | `CHAR.BEWERTUNG` (badge: A green, R red) | parent `CHAR.BEWERTUNG` |
| 9 | Remarks | `CHAR.REMARK` | `RESVAL.REMARK` |

RESVAL sub-table inherits parent CHAR values for columns where the user specified `CHARS.*` on the RESVAL side, so each result-value row is fully self-describing.

## Changes

**File: `src/components/mrb/ResultRecordingModal.tsx`**

1. Remove `loadColumnConfig`, the dynamic `cols` state, `DEFAULT_HEADER_FIELDS`, `DEFAULT_CHAR_COLUMNS`, `DEFAULT_RESVAL_COLUMNS`, and the related `useEffect`. Columns are now fixed per spec.
2. Define a single constant `RESULT_COLUMNS` (array of 9 `{key,label}` items) used for both header rows.
3. Add two pure resolver helpers:
   - `resolveCharCell(col, char)` — applies the conditional logic for Result and Visual Result.
   - `resolveResvalCell(col, char, resval)` — for Char NO uses `RES_NO`, for Result uses `RES_VALUE`, for Remarks uses `RESVAL.REMARK`, Visual Result returns blank, all other columns inherit from parent `char`.
4. Render the CHAR table using `RESULT_COLUMNS` with `resolveCharCell`. Keep the existing expand/collapse chevron column.
5. Render the RESVAL sub-table with the same `RESULT_COLUMNS` headers (no chevron column) using `resolveResvalCell`.
6. Keep the A/R badge styling (green for `A`, red for `R`) in both tables.
7. Keep header summary block (Inspection Lot / Material / Batch / GRN / Vendor / Lot Qty / UoM) unchanged — it is independent of the row columns.
8. Empty / null values render as `-` (existing `fmt` helper).

## Out of scope

- No DB/migration changes (column config is no longer read from `sap_api_response_fields` for this modal).
- No backend / edge-function changes.
- No changes to how Result Recording data is fetched (`invokeResultRecording`).
