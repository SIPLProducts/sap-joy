import { MRBStatus, UserRole, SLAStatus, EscalationLevel } from '@/types/mrb';

// Helper function to get role display name
export const getRoleDisplayName = (role: string): string => {
  const names: Record<string, string> = {
    quality: 'Quality',
    quality_head: 'Quality Head',
    purchase: 'Purchase/SCM',
    purchase_head: 'Purchase Head',
    engineering: 'Engineering',
    engineering_head: 'Engineering Head',
    plant_head: 'Plant Head',
    shop_floor: 'Shop Floor',
    executive: 'Executive',
    admin: 'Admin',
    mrb_committee: 'MRB Committee',
  };
  return names[role] || role || 'N/A';
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

// Helper function to get SLA color
export const getSLAColor = (sla: SLAStatus): string => {
  const colors: Record<SLAStatus, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return colors[sla];
};

// Helper function to get escalation color
export const getEscalationColor = (level: EscalationLevel): string => {
  const colors: Record<EscalationLevel, string> = {
    none: '',
    L1: 'bg-orange-100 text-orange-800',
    L2: 'bg-red-100 text-red-800',
    L3: 'bg-red-200 text-red-900',
  };
  return colors[level];
};
