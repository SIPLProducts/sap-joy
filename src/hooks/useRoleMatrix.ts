import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';

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
  const { userRole, isAuthenticated } = useAuth();

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      
      if (!error && data) {
        setPermissions(data.map(d => ({ ...d, screen_key: d.module_key, role: d.role as AppRole })) as RolePermission[]);
      }
    } catch (e) {
      console.error('Error fetching role permissions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPermissions();
    }
  }, [isAuthenticated]);

  const hasAccess = (screenKey: string): boolean => {
    if (!userRole) return false;
    // Admin always has full access
    if (userRole === 'admin') return true;

    // If no permissions loaded yet, deny access for non-admins to prevent showing screens before data loads
    if (permissions.length === 0) return false;

    // Check that a matching row exists AND can_view is true
    return permissions.some(
      (p) => p.role === userRole && p.screen_key === screenKey && p.can_view === true
    );
  };

  return { permissions, loading, refetch: fetchPermissions, hasAccess };
}
