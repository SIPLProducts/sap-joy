import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Legacy UserRole type for backward compatibility with existing code
export type UserRole = 'quality' | 'purchase' | 'engineering' | 'plant_head' | 'shop_floor';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  plant: string;
}

interface RoleContextType {
  currentRole: UserRole;
  currentUser: User;
  setRole: (role: UserRole) => void;
  canEdit: (stage: 'quality' | 'purchase' | 'engineering' | 'final_approval') => boolean;
  canCreate: (source: 'quality_inspection' | 'shop_floor') => boolean;
  roleDisplayName: string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Map new AppRole to legacy UserRole for backward compatibility
const mapAppRoleToUserRole = (appRole: AppRole | null): UserRole => {
  if (!appRole) return 'quality';
  
  // Dynamic mapping based on role_key patterns
  if (appRole.includes('quality')) return 'quality';
  if (appRole.includes('purchase')) return 'purchase';
  if (appRole.includes('engineering')) return 'engineering';
  if (appRole === 'shop_floor') return 'shop_floor';
  if (appRole === 'executive' || appRole === 'admin' || appRole === 'superadmin') return 'plant_head';
  return 'quality';
};

/**
 * Dynamic role display name resolver.
 * Fetches from departments table, falls back to role key.
 */
let _departmentNamesCache: Record<string, string> | null = null;

async function fetchDepartmentNames(): Promise<Record<string, string>> {
  if (_departmentNamesCache) return _departmentNamesCache;
  try {
    const { data } = await supabase
      .from('departments')
      .select('name, role_key')
      .eq('is_active', true);
    const map: Record<string, string> = {};
    data?.forEach(d => {
      if (d.role_key) map[d.role_key] = d.name;
    });
    _departmentNamesCache = map;
    // Invalidate cache after 5 minutes
    setTimeout(() => { _departmentNamesCache = null; }, 5 * 60 * 1000);
    return map;
  } catch {
    return {};
  }
}

export const getRoleDisplayName = (role: UserRole | AppRole | string): string => {
  // Synchronous fallback when cache is available
  if (_departmentNamesCache && _departmentNamesCache[role]) {
    return _departmentNamesCache[role];
  }
  // Fallback: format role key as readable name
  return role
    ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'N/A';
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, profile, userRole } = useAuth();
  const [displayName, setDisplayName] = useState<string>('');
  
  // Fetch department names for display
  useEffect(() => {
    fetchDepartmentNames().then(names => {
      if (userRole && names[userRole]) {
        setDisplayName(names[userRole]);
      }
    });
  }, [userRole]);
  
  // Map the authenticated user's role to legacy format
  const currentRole = mapAppRoleToUserRole(userRole);

  // Create a user object from authenticated user data
  const currentUser: User = {
    id: user?.id || 'guest',
    name: profile?.full_name || user?.email?.split('@')[0] || 'Guest User',
    role: currentRole,
    email: profile?.email || user?.email || 'guest@hbl.com',
    plant: profile?.plant || '1300',
  };

  // setRole is now a no-op since role comes from database
  const setRole = (role: UserRole) => {
    console.log('Role change requested:', role, '- Roles are now managed via authentication');
  };

  const canEdit = (stage: 'quality' | 'purchase' | 'engineering' | 'final_approval'): boolean => {
    // Check against the actual AppRole from auth
    if (!userRole) return false;
    if (userRole === 'admin') return true;
    
    // Dynamic: check if role contains the stage keyword, or is a head role for final_approval
    if (stage === 'final_approval') {
      return ['quality_head', 'purchase_head', 'engineering_head', 'executive', 'mrb_committee'].includes(userRole);
    }
    return userRole.includes(stage);
  };

  const canCreate = (source: 'quality_inspection' | 'shop_floor'): boolean => {
    if (!userRole) return false;
    if (userRole === 'admin') return true;
    
    if (source === 'quality_inspection') {
      return userRole.includes('quality');
    }
    if (source === 'shop_floor') {
      return userRole === 'shop_floor';
    }
    return false;
  };

  const roleDisplayName = displayName || getRoleDisplayName(userRole || currentRole);

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        currentUser,
        setRole,
        canEdit,
        canCreate,
        roleDisplayName,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
