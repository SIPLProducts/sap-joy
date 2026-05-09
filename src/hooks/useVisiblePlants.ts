import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlants } from '@/hooks/useUserPlants';
import { usePlants } from '@/hooks/usePlantConfig';

const MASTER_ADMIN_EMAIL = 'masteradmin@sharviinfotech.com';

export interface PlantOption {
  code: string;
  name: string;
}

/**
 * Single source of truth for "which plants can this user see / pick".
 *
 * - Master Admin (masteradmin@sharviinfotech.com) → ALL plants in the system.
 * - Every other user (including role `admin`) → only plants explicitly
 *   assigned in `user_plants`. Mirrors the RLS `public.user_has_plant` rule.
 */
export function useVisiblePlants() {
  const { profile, user } = useAuth();
  const { userPlants, loading: userPlantsLoading } = useUserPlants();
  const allPlants = usePlants();

  const isMaster =
    profile?.email === MASTER_ADMIN_EMAIL || user?.email === MASTER_ADMIN_EMAIL;

  const plantOptions = useMemo<PlantOption[]>(() => {
    if (isMaster) {
      return allPlants.map(p => ({ code: p.code, name: p.name }));
    }
    const assigned = new Set(userPlants);
    // Prefer the global plants list (gives nice labels), fall back to bare codes
    const fromGlobal = allPlants
      .filter(p => assigned.has(p.code))
      .map(p => ({ code: p.code, name: p.name }));
    const known = new Set(fromGlobal.map(p => p.code));
    const fallbacks = userPlants
      .filter(c => !known.has(c))
      .map(c => ({ code: c, name: c }));
    return [...fromGlobal, ...fallbacks];
  }, [isMaster, allPlants, userPlants]);

  const visiblePlants = useMemo(
    () => plantOptions.map(p => p.code),
    [plantOptions]
  );

  return {
    visiblePlants,
    plantOptions,
    isMaster,
    loading: userPlantsLoading,
  };
}
