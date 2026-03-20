import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';

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
  
  const roleMap: Record<AppRole, UserRole> = {
    quality: 'quality',
    quality_head: 'quality',
    purchase: 'purchase',
    purchase_head: 'purchase',
    engineering: 'engineering',
    engineering_head: 'engineering',
    shop_floor: 'shop_floor',
    executive: 'plant_head',
    admin: 'plant_head',
    mrb_committee: 'quality',
  };
  
  return roleMap[appRole] || 'quality';
};

export const getRoleDisplayName = (role: UserRole | AppRole): string => {
  const displayNames: Record<string, string> = {
    quality: 'QC Inspector',
    quality_head: 'Quality Head',
    purchase: 'Purchase Team',
    purchase_head: 'Purchase Head',
    engineering: 'Engineering',
    engineering_head: 'Engineering Head',
    plant_head: 'Plant Head',
    shop_floor: 'Production',
    executive: 'Plant Head / GM',
    admin: 'Administrator',
    mrb_committee: 'MRB Committee',
  };
  return displayNames[role] || role;
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, profile, userRole } = useAuth();
  
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
    
    const permissions: Record<AppRole, string[]> = {
      quality: ['quality'],
      quality_head: ['quality', 'final_approval'],
      purchase: ['purchase'],
      purchase_head: ['purchase', 'final_approval'],
      engineering: ['engineering'],
      engineering_head: ['engineering', 'final_approval'],
      shop_floor: [],
      executive: ['final_approval'],
      admin: ['quality', 'purchase', 'engineering', 'final_approval'],
      mrb_committee: ['quality', 'final_approval'],
    };
    
    return permissions[userRole]?.includes(stage) || false;
  };

  const canCreate = (source: 'quality_inspection' | 'shop_floor'): boolean => {
    if (!userRole) return false;
    
    if (source === 'quality_inspection') {
      return ['quality', 'quality_head', 'admin'].includes(userRole);
    }
    if (source === 'shop_floor') {
      return ['shop_floor', 'admin'].includes(userRole);
    }
    return false;
  };

  const roleDisplayName = getRoleDisplayName(userRole || currentRole);

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
