## Changes

### 1. Simplify success toast (SAP sync trigger + Refresh Data)

Replace the verbose "Fetched: X, Inserted: Y, Updated: Z..." messages with a clean "SAP sync successful" toast across:

- **`src/pages/SAPSyncMonitor.tsx`** (line ~186, in `handleTriggerSync`) — change description to `"SAP sync successful"`.
- **`src/pages/InwardReport.tsx`** (line ~467) — change to `"SAP sync successful"` (drop fetched/inserted/updated/removed segments).
- **`src/pages/InwardInProcessReport.tsx`** (line ~467) — same change.

Title stays as today (e.g. "Sync Complete" / "Success"). No backend logic touched — reconciliation still runs server-side, just not surfaced in the toast.

### 2. Hide "Trigger Sync" for Result Recording API

In **`src/pages/SAPSyncMonitor.tsx`**:

- Add a helper `isResultRecordingConfig(config)` that returns true when `config_name` or `api_endpoint` contains both "result" and "record".
- In the action button block (lines ~324-342), add this branch alongside `isActionConfig` / `isMB52Config`: when `isResultRecordingConfig(config)` is true, render only the **Test Route** button plus a badge like `On-Demand Only — triggered from MRB Worklist` (amber/blue style). Do NOT render the **Trigger Sync** button.
- Test Route button remains available for all configs (no change needed there).

### Files touched

- `src/pages/SAPSyncMonitor.tsx`
- `src/pages/InwardReport.tsx`
- `src/pages/InwardInProcessReport.tsx`

No edge function, no DB, no scheduler changes (Result Recording is already skipped server-side in the scheduler from the previous PR).

### Verification

1. Click "Trigger Sync" on any non-Result-Recording config → toast shows just `"SAP sync successful"`.
2. Click "Refresh Data" on Inward Materials / In-Process Materials → same simple toast.
3. On the SAP Sync Monitor → API Connections tab, the Result Recording row shows only **Test Route** and an info badge — no Trigger Sync button.
4. Other configs (MB52, 343/344, normal sync) keep their existing button layout.
