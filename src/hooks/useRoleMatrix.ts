import { useState, useEffect, useCallback, useMemo } from 'react';
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

const SUPERADMIN_DENIED_SCREENS = new Set(['sap_api_settings', 'sap_sync_monitor']);

export function useRoleMatrix() {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole, profile, isAuthenticated } = useAuth();

  const userPlant = profile?.plant;

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

  const hasAccess = useCallback(
    (screenKey: string): boolean => {
      if (!userRole) return false;
      if (userRole === 'superadmin') return !SUPERADMIN_DENIED_SCREENS.has(screenKey);
      if (userRole === 'admin') return true;
      if (permissions.length === 0) return false;

      const matching = permissions.filter(
        (p) => p.role === userRole && p.screen_key === screenKey && p.can_view === true
      );
      if (matching.length === 0) return false;

      if (userPlant) {
        const plantMatch = matching.find((p) => p.plant === userPlant);
        if (plantMatch) return true;
        const hasOtherPlants = permissions.some(
          (p) => p.role === userRole && p.screen_key === screenKey && p.plant && p.plant !== userPlant
        );
        if (hasOtherPlants) return false;
      }

      return true;
    },
    [userRole, permissions, userPlant]
  );

  const canEdit = useCallback(
    (screenKey: string): boolean => {
      if (!userRole) return false;
      if (userRole === 'superadmin') return !SUPERADMIN_DENIED_SCREENS.has(screenKey);
      if (userRole === 'admin') return true;
      if (permissions.length === 0) return false;

      const matching = permissions.filter(
        (p) => p.role === userRole && p.screen_key === screenKey && p.can_edit === true
      );
      if (matching.length === 0) return false;

      if (userPlant) {
        const plantMatch = matching.find((p) => p.plant === userPlant);
        if (plantMatch) return true;
        const hasOtherPlants = permissions.some(
          (p) => p.role === userRole && p.screen_key === screenKey && p.plant && p.plant !== userPlant
        );
        if (hasOtherPlants) return false;
      }

      return true;
    },
    [userRole, permissions, userPlant]
  );

  return { permissions, loading, refetch: fetchPermissions, hasAccess, canEdit };
}
