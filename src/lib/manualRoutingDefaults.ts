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
