import { MRBStatus, UserRole, SLAStatus, EscalationLevel } from '@/types/mrb';

/**
 * Dynamic role display name - formats role_key into readable name.
 * For full dynamic resolution from departments table, use useDepartmentMap hook.
 */
export const getRoleDisplayName = (role: string): string => {
  if (!role) return 'N/A';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

// Helper function to get status display name
export const getStatusDisplayName = (status: MRBStatus): string => {
  const names: Record<MRBStatus, string> = {
    draft: 'Draft',
    quality_review: 'Quality Review',
    purchase_review: 'Purchase Review',
    engineering_review: 'Engineering Review',
    final_approval: 'Final Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return names[status];
};

// Helper function to get status color
export const getStatusColor = (status: MRBStatus): string => {
  const colors: Record<MRBStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    quality_review: 'bg-blue-100 text-blue-800',
    purchase_review: 'bg-purple-100 text-purple-800',
    engineering_review: 'bg-orange-100 text-orange-800',
    final_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  return colors[status];
};

export const getEscalationColor = (level: EscalationLevel) => {
  const colors: Record<EscalationLevel, string> = {
    none: 'bg-muted text-muted-foreground',
    L1: 'bg-yellow-100 text-yellow-800',
    L2: 'bg-orange-100 text-orange-800',
    L3: 'bg-red-100 text-red-800',
  };
  return colors[level];
};

export const getSLAColor = (status: SLAStatus) => {
  const colors: Record<SLAStatus, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return colors[status];
};

// Mock data is no longer used - all data comes from Supabase
export const mockMRBs: any[] = [];
