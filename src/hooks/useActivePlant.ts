import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVisiblePlants } from '@/hooks/useVisiblePlants';

/**
 * Resolves the "active plant" for the current screen from the global
 * header (`profile.plant`) and the user's visible/assigned plants.
 *
 * Optional `setSelectedPlant` keeps an in-page Plant filter in sync with
 * the header switcher.
 */
export function useActivePlant(setSelectedPlant?: (plant: string) => void) {
  const { profile, isAllPlantsView, selectedPlants } = useAuth();
  const { plantOptions, visiblePlants, isMaster } = useVisiblePlants();

  const singlePlant = useMemo(() => {
    if (isAllPlantsView) return 'all';
    const headerPlant = profile?.plant;
    if (plantOptions.length === 0) return headerPlant || '';
    if (headerPlant && plantOptions.some(p => p.code === headerPlant)) {
      return headerPlant;
    }
    return plantOptions[0].code;
  }, [profile?.plant, plantOptions, isAllPlantsView]);

  // Plants currently in scope. Falls back to the single header plant when no
  // explicit multi-selection exists, so existing behaviour is unchanged.
  const activePlants = useMemo<string[]>(() => {
    if (isAllPlantsView) return visiblePlants;
    const allowed = new Set(visiblePlants);
    const picked = (selectedPlants || []).filter(p => allowed.has(p));
    if (picked.length > 0) return picked;
    return singlePlant && singlePlant !== 'all' ? [singlePlant] : visiblePlants;
  }, [isAllPlantsView, visiblePlants, selectedPlants, singlePlant]);

  const activePlant = useMemo(
    () => (activePlants.length === 1 ? activePlants[0] : 'all'),
    [activePlants]
  );

  const activePlantsKey = activePlants.join('|');

  useEffect(() => {
    if (!setSelectedPlant || !activePlant) return;
    setSelectedPlant(activePlant);
  }, [activePlant, setSelectedPlant]);

  return { activePlant, activePlants, activePlantsKey, plantOptions, visiblePlants, isMaster };
}