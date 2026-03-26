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

  // Check if the current user has access to a specific screen key
  const hasAccess = (screenKey: string): boolean => {
    // If no permissions loaded yet, fallback to true for admins or false for others 
    // to prevent complete lockout before data loads
    if (permissions.length === 0) {
      return userRole === 'admin'; 
    }
    if (!userRole) return false;
    
    // Always allow admin super access, or check the explicit mapping
    return userRole === 'admin' || permissions.some(
      (p) => p.role === userRole && p.screen_key === screenKey
    );
  };

  return { permissions, loading, refetch: fetchPermissions, hasAccess };
}
