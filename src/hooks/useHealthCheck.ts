import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

interface UseHealthCheckOptions {
  interval?: number; // ms between checks
  enabled?: boolean;
}

export function useHealthCheck({ interval = 30000, enabled = true }: UseHealthCheckOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const check = useCallback(async () => {
    const start = performance.now();
    try {
      // Simple lightweight query to test connectivity
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const { error } = await supabase
        .from('plants')
        .select('id', { count: 'exact', head: true })
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeout);

      const ms = Math.round(performance.now() - start);
      setLatency(ms);
      setStatus(error ? 'disconnected' : 'connected');
    } catch {
      setStatus('disconnected');
      setLatency(null);
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    check(); // initial check

    timerRef.current = setInterval(check, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [check, interval, enabled]);

  return { status, lastChecked, latency, recheck: check };
}
