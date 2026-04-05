import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, useAuth } from '@/contexts/AuthContext';

export interface RolePermission {
  role: AppRole;
  screen_key: string;
  module_key?: string;
  module_label?: string;
  can_view?: boolean;
  can_edit?: boolean;
  plant?: string;
}

export function useRoleMatrix() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole, profile, isAuthenticated } = useAuth();

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (!error && data) {
        setPermissions(
          data.map((d) => ({
            ...d,
            screen_key: d.module_key,
            role: d.role as AppRole,
          })) as RolePermission[]
        );
      }
    } catch (e) {
      console.error('Error fetching role permissions', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPermissions();
    }
  }, [isAuthenticated, fetchPermissions]);

  /**
   * Check if the current user has access to a given screen.
   *
   * Matching logic (plant + role + module):
   *  - Admin role always has full access.
   *  - For other roles we match on role + module_key + can_view=true.
   *  - If the user has an assigned plant we prefer the permission row
   *    for that plant.  If no plant-specific row exists we fall back to
   *    checking any plant row (backwards-compatible with single-plant setups).
   */
  const hasAccess = useCallback(
    (screenKey: string): boolean => {
      if (!userRole) return false;
      if (userRole === 'admin') return true;

      // If permissions haven't loaded yet, deny
      if (permissions.length === 0) return false;

      const userPlant = profile?.plant;

      // All rows for this role + screen
      const matching = permissions.filter(
        (p) => p.role === userRole && p.screen_key === screenKey && p.can_view === true
      );

      if (matching.length === 0) return false;

      // If the user has a plant, prefer plant-specific match
      if (userPlant) {
        const plantMatch = matching.find((p) => p.plant === userPlant);
        if (plantMatch) return true;

        // If no plant-specific row but there are rows for other plants,
        // deny access — the admin has set up per-plant config and this
        // user's plant isn't enabled.
        const hasAnyPlantSpecific = permissions.some(
          (p) => p.role === userRole && p.screen_key === screenKey && p.plant && p.plant !== userPlant
        );
        if (hasAnyPlantSpecific) return false;
      }

      // Fallback: at least one matching row exists (legacy / no plant set)
      return true;
    },
    [userRole, permissions, profile?.plant]
  );

  /**
   * Check if the current user can edit a given screen (plant-aware).
   */
  const canEdit = useCallback(
    (screenKey: string): boolean => {
      if (!userRole) return false;
      if (userRole === 'admin') return true;
      if (permissions.length === 0) return false;

      const userPlant = profile?.plant;

      const matching = permissions.filter(
        (p) => p.role === userRole && p.screen_key === screenKey && p.can_edit === true
      );

      if (matching.length === 0) return false;

      if (userPlant) {
        const plantMatch = matching.find((p) => p.plant === userPlant);
        if (plantMatch) return true;

        const hasAnyPlantSpecific = permissions.some(
          (p) => p.role === userRole && p.screen_key === screenKey && p.plant && p.plant !== userPlant
        );
        if (hasAnyPlantSpecific) return false;
      }

      return true;
    },
    [userRole, permissions, profile?.plant]
  );

  return { permissions, loading, refetch: fetchPermissions, hasAccess, canEdit };
}
