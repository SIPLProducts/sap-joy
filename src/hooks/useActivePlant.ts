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
  const { profile, isAllPlantsView, selectedPlants: rawSelectedPlants } = useAuth();
  const { plantOptions: allPlantOptions, isMaster } = useVisiblePlants();
  const plantOptions = allPlantOptions;
  const visibleCodes = useMemo(() => plantOptions.map(p => p.code), [plantOptions]);

  // Plants currently selected in the header switcher, validated against the
  // plants this user is allowed to see.
  const selectedPlants = useMemo(() => {
    if (!isAllPlantsView) return [];
    const valid = rawSelectedPlants.filter(c => visibleCodes.includes(c));
    return valid;
  }, [isAllPlantsView, rawSelectedPlants.join('|'), visibleCodes.join('|')]);

  // null = no restriction (all visible plants selected)
  const plantScope = useMemo<string[] | null>(() => {
    if (!isAllPlantsView) return null;
    if (selectedPlants.length === 0) return null;
    if (visibleCodes.length > 0 && selectedPlants.length >= visibleCodes.length) return null;
    return selectedPlants;
  }, [isAllPlantsView, selectedPlants.join('|'), visibleCodes.join('|')]);

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

  // Dropdown options on screens follow the header selection when a subset of
  // plants is picked.
  const scopedPlantOptions = useMemo(
    () => (plantScope ? plantOptions.filter(p => plantScope.includes(p.code)) : plantOptions),
    [plantOptions, plantScope?.join('|')]
  );
  const visiblePlants = useMemo(() => scopedPlantOptions.map(p => p.code), [scopedPlantOptions]);

  return {
    activePlant,
    plantOptions: scopedPlantOptions,
    visiblePlants,
    isMaster,
    selectedPlants,
    plantScope,
  };
}