import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole, User } from '@/types/mrb';
import { mockUsers, getRoleDisplayName } from '@/data/mockData';

interface RoleContextType {
  currentRole: UserRole;
  currentUser: User;
  setRole: (role: UserRole) => void;
  canEdit: (stage: 'quality' | 'purchase' | 'engineering' | 'final_approval') => boolean;
  canCreate: (source: 'quality_inspection' | 'shop_floor') => boolean;
  roleDisplayName: string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('quality');

  const currentUser = mockUsers.find(u => u.role === currentRole) || mockUsers[0];

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
  };

  const canEdit = (stage: 'quality' | 'purchase' | 'engineering' | 'final_approval'): boolean => {
    const permissions: Record<UserRole, string[]> = {
      quality: ['quality'],
      purchase: ['purchase'],
      engineering: ['engineering'],
      plant_head: ['final_approval'],
      shop_floor: [],
    };
    return permissions[currentRole].includes(stage);
  };

  const canCreate = (source: 'quality_inspection' | 'shop_floor'): boolean => {
    if (source === 'quality_inspection') {
      return currentRole === 'quality';
    }
    if (source === 'shop_floor') {
      return currentRole === 'shop_floor';
    }
    return false;
  };

  const roleDisplayName = getRoleDisplayName(currentRole);

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
