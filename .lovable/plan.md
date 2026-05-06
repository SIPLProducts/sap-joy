## Issues

1. **Result Recording empty on on-prem** — `invokeDirect()` in `src/lib/sapSyncClient.ts` (lines 372-393) only handles `test`, `sync`, `unblock`, `update_transaction_qty`, `fetch_live`. When `action === 'result_recording'`, it falls through to `{ success: false, error: 'Invalid action' }`. So in self-hosted mode (where the browser hits the middleware directly), Result Recording is never executed. In Lovable Cloud the edge function `sap-sync/handler.ts` (lines 184-248) does handle it — that's why cloud works.

2. **Split rows render a separate sub-table with duplicated headers** — `ResultRecordingModal.tsx` (lines 195-227) renders an inner `<table>` inside the expanded row with its own `<thead>`. The user wants child rows shown inline within the parent table (sharing parent headers) and the `CHAR_NO` cell of each child to display `<parent INSPCHAR>.<child RES_NO>` (e.g. `30.1`, `30.2`).

## Fix

### 1. `src/lib/sapSyncClient.ts` — add `result_recording` handling to direct mode

- Add a `directResultRecording(url, headers, config, body, proxyBaseUrl)` helper that mirrors the edge-function logic:
  - Build `sapPayload = { GET: { INSPLOT: Number(inspection_lot), INSPOPER: String(insp_oper||'0010').padStart(4,'0') } }`.
  - POST to the proxy `/proxy` endpoint with `sap_target_url`, headers, JSON body (same pattern as `directUnblock`/`directUpdateQty`).
  - Parse response; return `{ data: { ok: true, data: parsed, request: sapPayload }, error: null }` on success, or `{ ok: false, error }` on failure (wrapped in `data` so the modal's existing branch `resp?.ok === false` keeps working).
- Wire it in `invokeDirect()`:
  ```ts
  if (action === 'result_recording') {
    return await directResultRecording(url, headers, config, body, proxyBaseUrl);
  }
  ```
- Also extend `resolveResultRecordingConfigId()` keyword fallback list inside `getFallbackTokens` so a missing `config_id` still resolves on direct mode (`['result', '/result', 'recording']`).

### 2. `src/components/mrb/ResultRecordingModal.tsx` — inline split children, no duplicate headers

Replace the current expanded-row block (the inner `<table>` with its own `<thead>`) with **N additional `<tr>` rows inside the same parent `<tbody>`**, one per RESVAL entry, using the SAME `RESULT_COLUMNS`. So markup becomes:

```
<tr> parent CHAR row (chevron, CHAR_NO=INSPCHAR, …) </tr>
{isOpen && subRows.map((r, i) => (
  <tr className="bg-muted/20">
    <td/>  {/* empty chevron cell */}
    {RESULT_COLUMNS.map(col => {
       const v = col.key === 'CHAR_NO'
         ? `${c.INSPCHAR}.${r.RES_NO}`     // e.g. "30.1"
         : resolveResvalCell(col.key, c, r);
       return <td …>{fmt(v)}</td>;
    })}
  </tr>
))}
```

Remove the wrapper `<tr><td colSpan>…</td></tr>` and the inner sub-`<table>`/`<thead>` entirely. Keep the chevron toggle on the parent row only. No new columns, no new headers — children inherit parent headers visually.

Indent / visual cue for children: add `pl-8` on the first data cell of child rows (or a small left border) so it reads as a sub-row.

### 3. No changes to

- `supabase/functions/sap-sync/handler.ts` (already correct in cloud)
- DB / SAP request payload / config

## Files touched

- `src/lib/sapSyncClient.ts` — add `directResultRecording`, route it from `invokeDirect`, extend fallback tokens.
- `src/components/mrb/ResultRecordingModal.tsx` — inline split rows in the parent table, label child `CHAR_NO` as `INSPCHAR.RES_NO`, drop duplicate sub-headers.

## Verification

1. **On-prem** (self-hosted, HTTP, internal IP): open MRB Worklist → Result Recording → SAP payload visible in browser Network tab and rows render (parity with cloud).
2. **Cloud**: still works (edge function path untouched).
3. Click expand on any CHAR row → split children appear as additional rows directly under the parent in the same table, no second header bar; child CHAR_NO column shows `30.1`, `30.2`, etc.
