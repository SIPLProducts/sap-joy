// Manual Routing defaults: user-chosen steps, then Quality Head, then Stores (always last).
export const MANUAL_SECOND_LAST = 'quality_head';
export const MANUAL_LAST = 'stores';
const LOCKED = new Set([MANUAL_SECOND_LAST, MANUAL_LAST]);

export const isLockedManualStep = (key: string) => LOCKED.has(key);

/** Extract the user-chosen steps from a full manual sequence. */
export function getMiddleSteps(seq: string[]): string[] {
  const out: string[] = [];
  for (const d of seq || []) if (!LOCKED.has(d) && !out.includes(d)) out.push(d);
  return out;
}

/** Build full manual sequence: chosen steps -> Quality Head -> Stores. */
export function buildManualRouting(middle: string[]): string[] {
  return [...getMiddleSteps(middle), MANUAL_SECOND_LAST, MANUAL_LAST];
}

/**
 * Verify Quality Head and Stores exist as active, workflow-enabled departments.
 * Returns a user-facing error message, or null when both are available.
 */
export async function checkLockedRolesAvailable(): Promise<string | null> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data } = await supabase
    .from('departments')
    .select('role_key, is_active, is_workflow_enabled')
    .in('role_key', [MANUAL_SECOND_LAST, MANUAL_LAST]);
  const ok = (k: string) => (data || []).some((d: any) => d.role_key === k && d.is_active && d.is_workflow_enabled);
  const missing: string[] = [];
  if (!ok(MANUAL_SECOND_LAST)) missing.push('Quality Head');
  if (!ok(MANUAL_LAST)) missing.push('Stores');
  return missing.length
    ? `${missing.join(' and ')} role is missing, inactive or not workflow-enabled. Ask an admin to enable it in Role Management before creating MRBs.`
    : null;
}
