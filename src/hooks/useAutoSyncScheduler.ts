import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeSapSync } from '@/lib/sapSyncClient';

const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds

interface SchedulerStatus {
  configId: string;
  configName: string;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  syncFrequency: string;
  isSyncing: boolean;
}

function getFrequencyMs(frequency: string): number | null {
  switch (frequency) {
    case 'every_5_min': return 5 * 60_000;
    case 'every_15_min': return 15 * 60_000;
    case 'every_30_min': return 30 * 60_000;
    case 'hourly': return 60 * 60_000;
    case 'every_6_hours': return 6 * 60 * 60_000;
    case 'daily': return 24 * 60 * 60_000;
    case 'weekly': return 7 * 24 * 60 * 60_000;
    default: return null;
  }
}

function isDue(lastSyncAt: string | null, frequency: string): boolean {
  if (frequency === 'manual') return false;
  const intervalMs = getFrequencyMs(frequency);
  if (!intervalMs) return false;
  if (!lastSyncAt) return true;
  const last = new Date(lastSyncAt).getTime();
  if (isNaN(last)) return true;
  return Date.now() - last >= intervalMs;
}

function getNextSyncTime(lastSyncAt: string | null, frequency: string): string | null {
  const intervalMs = getFrequencyMs(frequency);
  if (!intervalMs || frequency === 'manual') return null;
  if (!lastSyncAt) return 'Now';
  const last = new Date(lastSyncAt).getTime();
  if (isNaN(last)) return 'Now';
  const next = last + intervalMs;
  return next <= Date.now() ? 'Now' : new Date(next).toISOString();
}

export function useAutoSyncScheduler() {
  const syncingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [statuses, setStatuses] = useState<SchedulerStatus[]>([]);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const checkAndSync = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: configs, error } = await supabase
        .from('sap_api_config')
        .select('id, config_name, sync_frequency, scheduler_enabled, is_active, last_sync_at')
        .eq('is_active', true)
        .eq('scheduler_enabled', true);

      if (error || !configs?.length) {
        setStatuses([]);
        return;
      }

      const newStatuses: SchedulerStatus[] = configs.map(c => ({
        configId: c.id,
        configName: c.config_name,
        lastSyncAt: c.last_sync_at,
        nextSyncAt: getNextSyncTime(c.last_sync_at, c.sync_frequency || 'manual'),
        syncFrequency: c.sync_frequency || 'manual',
        isSyncing: syncingRef.current.has(c.id),
      }));
      setStatuses(newStatuses);
      setLastCheck(new Date().toISOString());

      for (const config of configs) {
        const freq = config.sync_frequency || 'manual';
        if (freq === 'manual') continue;
        if (syncingRef.current.has(config.id)) continue;
        if (!isDue(config.last_sync_at, freq)) continue;

        // Trigger sync
        syncingRef.current.add(config.id);
        setStatuses(prev => prev.map(s =>
          s.configId === config.id ? { ...s, isSyncing: true } : s
        ));

        console.log(`[AutoSync] Triggering scheduled sync for "${config.config_name}" (${freq})`);

        invokeSapSync({ action: 'sync', config_id: config.id })
          .then(({ data, error: syncErr }) => {
            if (syncErr) {
              console.error(`[AutoSync] Sync failed for "${config.config_name}":`, syncErr.message);
            } else {
              console.log(`[AutoSync] Sync completed for "${config.config_name}":`, data?.records_inserted, 'records inserted');
            }
          })
          .catch(err => {
            console.error(`[AutoSync] Sync error for "${config.config_name}":`, err);
          })
          .finally(() => {
            syncingRef.current.delete(config.id);
            setStatuses(prev => prev.map(s =>
              s.configId === config.id ? { ...s, isSyncing: false } : s
            ));
          });
      }
    } catch (err) {
      console.error('[AutoSync] Scheduler check failed:', err);
    }
  }, []);

  useEffect(() => {
    // Initial check after a short delay
    const initialTimer = setTimeout(checkAndSync, 5000);
    // Periodic checks
    timerRef.current = setInterval(checkAndSync, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkAndSync]);

  return { statuses, lastCheck, triggerCheck: checkAndSync };
}
