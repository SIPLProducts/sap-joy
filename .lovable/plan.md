## Problem

Triggering "SAP Sync" on **MRB Inward Materials** behaves like the **MRB Inward In-Process** sync. Both pages call the same edge function endpoint (`sap-sync` with `action: 'sync'`) — what differs is the SAP **request body**, which is built from `sap_api_request_fields` for the chosen `config_id`.

Two configs exist:

| config_name | endpoint | ART | maps to table |
|---|---|---|---|
| ZMRB_Inward_Inspection | /mrb/inward/report | `01` | `inward_inspection_lots` (Materials page) |
| ZMRB_Inward_Process    | /mrb/inward/report | `04` | `zmrb_inward_report`    (In-Process page) |

The In-Process page (`InwardInProcessReport.tsx`) already filters configs by their response-field mapping to `zmrb_inward_report`, so it always picks the `ART=04` config.

The Materials page (`InwardReport.tsx`, lines 105-125) only matches by name keywords (`zmrb` or `inward`) and picks the most recently created — which can return the In-Process config. Result: Materials sync sends `ART=04`, behaving exactly like In-Process.

## Fix

Mirror the In-Process selection logic in `src/pages/InwardReport.tsx`. Filter `sap_api_config` to only those whose `sap_api_response_fields` map to **`inward_inspection_lots`**, then prefer a config whose name contains `inspection` (fallback: first valid one).

### Change in `src/pages/InwardReport.tsx` (lines ~105-125)

```tsx
useEffect(() => {
  const fetchSapConfig = async () => {
    const { data: configs } = await supabase
      .from('sap_api_config')
      .select('id, config_name, last_sync_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!configs || configs.length === 0) {
      toast.error('No active SAP API configuration found.');
      return;
    }

    const ids = configs.map((c) => c.id);
    const { data: mappings } = await supabase
      .from('sap_api_response_fields')
      .select('config_id')
      .in('config_id', ids)
      .eq('map_to_table', 'inward_inspection_lots')
      .not('map_to_column', 'is', null);

    const validIds = new Set((mappings || []).map((m: any) => m.config_id));
    const validConfigs = configs.filter((c) => validIds.has(c.id));

    // Prefer config explicitly named for the inward inspection API
    const inspectionConfig = validConfigs.find((c) =>
      c.config_name.toLowerCase().includes('inspection')
    );
    const chosen = inspectionConfig || validConfigs[0];

    if (!chosen) {
      toast.error(
        'No SAP config found with response mappings to inward_inspection_lots. Check SAP API Settings.'
      );
      return;
    }

    setSapConfigId(chosen.id);
    setLastSyncAt(chosen.last_sync_at);
  };
  fetchSapConfig();
}, []);
```

Same logic adjustment in the auto-refresh `last_sync_at` lookup (lines ~146-156): query `last_sync_at` for the resolved `sapConfigId` rather than the most recent active config, to avoid showing the In-Process timestamp on the Materials page.

## Out of scope
- No edge function changes (`sap-sync` correctly builds the body from each config's `sap_api_request_fields`).
- No DB migration (both configs already exist with correct `ART` defaults and table mappings).
- In-Process page already correct — no changes there.
