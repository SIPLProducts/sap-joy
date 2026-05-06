## Revert Inward Materials SAP config selection

The previous change to `src/pages/InwardReport.tsx` (filtering `sap_api_config` by response-field mapping to `inward_inspection_lots`) is causing the SAP sync to fail with "response is not valid JSON". Restore the original simple keyword-based selection that was working before the In-Process screen was added.

### Change in `src/pages/InwardReport.tsx`

Replace the current `fetchSapConfig` (lines ~106-152) with the original logic:

```tsx
useEffect(() => {
  const fetchSapConfig = async () => {
    const { data } = await supabase
      .from('sap_api_config')
      .select('id, config_name, last_sync_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const inwardConfig = data.find(c =>
        c.config_name.toLowerCase().includes('zmrb') ||
        c.config_name.toLowerCase().includes('inward')
      );
      const chosen = inwardConfig || data[0];
      setSapConfigId(chosen.id);
      setLastSyncAt(chosen.last_sync_at);
    }
  };
  fetchSapConfig();
}, []);
```

Also restore the original auto-refresh `last_sync_at` lookup (lines ~166-194) to query the most recent active config:

```tsx
const { data } = await supabase
  .from('sap_api_config')
  .select('last_sync_at')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1);
if (data && data.length > 0 && data[0].last_sync_at) {
  setLastSyncAt(data[0].last_sync_at);
} else {
  setLastSyncAt(new Date().toISOString());
}
```

And revert the effect dependency back to `[refreshData]`.

### Out of scope
- No changes to `InwardInProcessReport.tsx` — the In-Process screen keeps its own mapping-based selection.
- No edge function or DB changes.
