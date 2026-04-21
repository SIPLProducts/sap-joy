import type { Database } from '@/integrations/supabase/types';

type MRBStatus = Database['public']['Enums']['mrb_status'];

const TERMINAL_STATUSES: MRBStatus[] = ['approved', 'rejected', 'closed'];

export function formatRoleLabel(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getWorkflowReviewLabel(
  status: MRBStatus,
  pendingWith?: string | null,
  roleDisplayNames: Record<string, string> = {}
): string {
  if (TERMINAL_STATUSES.includes(status)) return getTerminalStatusLabel(status);
  if (pendingWith) return `${roleDisplayNames[pendingWith] || formatRoleLabel(pendingWith)} Review`;
  return getBaseStatusLabel(status);
}

export function getRoutedStatus(
  roleKey: string | undefined,
  deptToStatus: Record<string, string>,
  fallback: MRBStatus = 'quality_review'
): MRBStatus {
  if (!roleKey) return fallback;
  return (deptToStatus[roleKey] || fallback) as MRBStatus;
}

function getTerminalStatusLabel(status: MRBStatus): string {
  const labels: Record<MRBStatus, string> = {
    draft: 'Draft',
    quality_review: 'Quality Review',
    purchase_review: 'Purchase Review',
    engineering_review: 'Engineering Review',
    final_approval: 'Final Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return labels[status];
}

function getBaseStatusLabel(status: MRBStatus): string {
  return getTerminalStatusLabel(status);
}