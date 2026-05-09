import { useMemo } from 'react';
import { useUserPlants } from '@/hooks/useUserPlants';

/**
 * Strict plant visibility: every user (including admin/executive) only sees
 * plants explicitly assigned to them in `user_plants`. Mirrors the RLS rule
 * enforced by `public.user_has_plant`.
 */
export function useVisiblePlants() {
  const { userPlants, loading } = useUserPlants();
  const visiblePlants = useMemo(() => Array.from(new Set(userPlants)), [userPlants]);
  return { visiblePlants, loading };
}
