import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the **single Active Plant** for the current user wrapped in an array
 * so existing call sites (`.in('plant', visiblePlants)`) keep working without
 * changes. Data scope across the app is restricted to the plant currently
 * selected in the header switcher (persisted on `profiles.plant`).
 */
export function useVisiblePlants() {
  const { profile, isLoading } = useAuth();
  const visiblePlants = useMemo(
    () => (profile?.plant ? [profile.plant] : []),
    [profile?.plant],
  );
  return { visiblePlants, loading: isLoading };
}
