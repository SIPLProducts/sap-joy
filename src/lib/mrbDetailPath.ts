/** Same routing rule as the Worklist: inward/in-process -> /inward/mrb/:id, shop floor -> /shop-floor/mrb/:id. */
export function mrbDetailPath(id: string, source?: string | null): string {
  if (source === 'quality_inspection' || source === 'inprocess') return `/inward/mrb/${id}`;
  if (source === 'shop_floor') return `/shop-floor/mrb/${id}`;
  return `/mrb/${id}`;
}
