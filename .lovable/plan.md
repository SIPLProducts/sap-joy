## Problem

User reports that when syncing **Inward Inspection Lots** (ZMRB01), the request payload going to SAP/middleware contains `ART=04` instead of `ART=01`. ART=04 is the In-Process value, so SAP returns the wrong dataset (or none).

## Root cause

Today the ART value sent to SAP is taken from `sap_api_request_fields.default_value` for whichever config row is picked. DB is correct:

- `ZMRB_Inward_Inspection` (id `…0004`) → ART default `01`
- `ZMRB_IN_Process` (id `…b4c2`) → ART default `04`

But there is no guarantee in code that the right config is selected, and any of these can silently produce ART=04 for the Inward page:

1. **`InwardReport.tsx` config picker** (lines 105-149) chooses any active config whose response fields map to `inward_inspection_lots`, then prefers one whose name contains "inspection". If a user accidentally maps a response field of `ZMRB_IN_Process` to `inward_inspection_lots` in the SAP API Settings UI, the picker can select the IN_Process config — whose ART default is 04 — and send ART=04.
2. **`useAutoSyncScheduler` / pg_cron scheduler** loops every active scheduler-enabled config. If both ZMRB configs are scheduler-enabled and they share the same `endpoint_path`, the IN_Process one will overwrite Inward Inspection rows in the same destination if mappings overlap.
3. There is no explicit ART override anywhere — code relies entirely on `default_value` in DB, so a single accidental edit in the Field Mappings dialog silently breaks the wrong screen.

## Fix

Make ART explicit and config-bound, not implicit, so it can never drift to the wrong value regardless of DB defaults.

### 1. `src/pages/InwardReport.tsx` (Inward Inspection page)

- Tighten the config picker so it ONLY accepts a config whose `config_name` contains "inward" AND "inspection" (i.e. exclude any name containing "process"). Stop falling back to `validConfigs[0]`.
- When calling `invokeSapSync`, pass an explicit override:
  ```ts
  invokeSapSync({
    action: 'sync',
    config_id: sapConfigId,
    request_overrides: { ART: '01' },
  })
  ```

### 2. `src/pages/InwardInProcessReport.tsx` (In-Process page)

- Same hardening: require `config_name` to contain "process" (exclude "inspection").
- Pass `request_overrides: { ART: '04' }` to `invokeSapSync`.

### 3. `src/lib/sapSyncClient.ts` (`invokeDirect` / sync builder, lines ~598-628)

- Accept `body.request_overrides` and, when building `requestBody`, override per-field values with this map BEFORE applying `default_value`. Already supports an override pattern in `invokeUnblockApi` etc., extend the sync path the same way.

### 4. `supabase/functions/sap-sync/handler.ts` (`callSAPApi`, line 113)

- Pass `body.request_overrides` through to `callSAPApi(config, requestFields, body.request_overrides ?? {})`. The function already accepts `requestOverrides` (line 1017) — only the call site needs the wiring.

### 5. `supabase/functions/sap-sync-scheduler/index.ts` (line 165)

- The scheduler currently only injects WERKS as a plant override. Add a per-config-name ART override so scheduled runs always send the correct ART:
  ```ts
  const cn = String(config.config_name || '').toLowerCase()
  if (cn.includes('inward') && cn.includes('inspection')) plantOverrides['ART'] = '01'
  else if (cn.includes('process')) plantOverrides['ART'] = '04'
  ```

### 6. No DB / `default_value` change

DB defaults remain `01` / `04` as-is. The code-side overrides are the source of truth so a future accidental edit of `sap_api_request_fields.default_value` cannot silently break either screen.

## Files touched

- `src/pages/InwardReport.tsx`
- `src/pages/InwardInProcessReport.tsx`
- `src/lib/sapSyncClient.ts`
- `supabase/functions/sap-sync/handler.ts`
- `supabase/functions/sap-sync-scheduler/index.ts`

No DB migration, no schema change, no other UI change. Edge functions auto-deploy.

## Verification

1. Inward Inspection page → Refresh → edge log shows `Payload: { …, "ART": "01" }`.
2. In-Process page → Refresh → edge log shows `"ART": "04"`.
3. Even if someone toggles the "wrong" config in API Settings, neither screen can pick the other one (name guard) and neither can send the wrong ART (explicit override).
