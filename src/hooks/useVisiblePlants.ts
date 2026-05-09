import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlants } from '@/hooks/useUserPlants';

/**
 * Returns the list of plant codes the current user is allowed to see across the app.
 * - admin / executive: union of all plants in the system (global visibility)
 * - everyone else: their assigned plants from `user_plants`
 * Falls back to the user's profile plant if no assignments are present.
 */
export function useVisiblePlants() {
  const { profile, userRole } = useAuth();
  const { userPlants, loading } = useUserPlants();
  const [allPlants, setAllPlants] = useState<string[]>([]);

  const isAdminOrExec = userRole === 'admin' || userRole === 'executive';

  useEffect(() => {
    if (!isAdminOrExec) return;
    supabase
      .from('plants')
      .select('code')
      .then(({ data }) => {
        if (data) setAllPlants(data.map(p => p.code));
      });
  }, [isAdminOrExec]);

  const visiblePlants = useMemo(() => {
    if (isAdminOrExec) {
      // Prefer system-wide list; fall back to user_plants ∪ profile plant while loading
      if (allPlants.length > 0) return allPlants;
    }
    const set = new Set<string>(userPlants);
    if (profile?.plant) set.add(profile.plant);
    return Array.from(set);
  }, [isAdminOrExec, allPlants, userPlants, profile?.plant]);

  return { visiblePlants, loading };
}
