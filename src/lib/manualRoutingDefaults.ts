// Manual Routing defaults: Quality Head first, Second Quality Head before Stores, Stores last.
export const MANUAL_FIRST = 'quality_head';
export const MANUAL_SECOND_LAST = 'quality_head';
export const MANUAL_LAST = 'stores';
const LOCKED = new Set([MANUAL_FIRST, MANUAL_SECOND_LAST, MANUAL_LAST]);

export const isLockedManualStep = (key: string) => LOCKED.has(key);

/** Extract the user-chosen middle steps from a full manual sequence. */
export function getMiddleSteps(seq: string[]): string[] {
  const out: string[] = [];
  for (const d of seq || []) if (!LOCKED.has(d) && !out.includes(d)) out.push(d);
  return out;
}

/** Build full manual sequence around the user-chosen middle steps. */
export function buildManualRouting(middle: string[]): string[] {
  return [MANUAL_FIRST, ...getMiddleSteps(middle), MANUAL_SECOND_LAST, MANUAL_LAST];
}
