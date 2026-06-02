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
  const { profile, isAllPlantsView } = useAuth();
  const { plantOptions, visiblePlants, isMaster } = useVisiblePlants();

  const activePlant = useMemo(() => {
    if (isAllPlantsView) return 'all';
    const headerPlant = profile?.plant;
    if (plantOptions.length === 0) return headerPlant || '';
    if (headerPlant && plantOptions.some(p => p.code === headerPlant)) {
      return headerPlant;
    }
    return plantOptions[0].code;
  }, [profile?.plant, plantOptions, isAllPlantsView]);

  useEffect(() => {
    if (!setSelectedPlant || !activePlant) return;
    setSelectedPlant(activePlant);
  }, [activePlant, setSelectedPlant]);

  return { activePlant, plantOptions, visiblePlants, isMaster };
}