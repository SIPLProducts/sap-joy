/**
 * Shared helper for the header's multi-plant selection.
 *
 * `scope === null` means "no restriction" (the user has every visible plant
 * selected), otherwise only plants inside the scope array are shown.
 */
export function matchesPlantScope(
  plant: string | null | undefined,
  selectedPlant: string,
  scope: string[] | null
): boolean {
  if (selectedPlant && selectedPlant !== 'all') return plant === selectedPlant;
  if (!scope || scope.length === 0) return true;
  return !!plant && scope.includes(plant);
}