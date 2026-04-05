import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type MRBStatus = Database['public']['Enums']['mrb_status'];

/** Maps department keys (used in UI) to app_role enum values */
export const DEPT_TO_ROLE: Record<string, AppRole> = {
  quality: 'quality',
  quality_head: 'quality_head',
  purchase: 'purchase',
  purchase_head: 'purchase_head',
  engineering: 'engineering',
  engineering_head: 'engineering_head',
  plant_head: 'executive',
  executive: 'executive',
  mrb_committee: 'mrb_committee',
  shop_floor: 'shop_floor',
};

/** Maps department keys to MRB status values */
export const DEPT_TO_STATUS: Record<string, MRBStatus> = {
  quality: 'quality_review',
  quality_head: 'quality_review',
  purchase: 'purchase_review',
  purchase_head: 'purchase_review',
  engineering: 'engineering_review',
  engineering_head: 'engineering_review',
  plant_head: 'final_approval',
  executive: 'final_approval',
  mrb_committee: 'quality_review',
};

/** Maps app_role back to a department key */
export const ROLE_TO_DEPT: Record<string, string> = {
  quality: 'quality',
  quality_head: 'quality_head',
  purchase: 'purchase',
  purchase_head: 'purchase_head',
  engineering: 'engineering',
  engineering_head: 'engineering_head',
  executive: 'plant_head',
  mrb_committee: 'mrb_committee',
  shop_floor: 'shop_floor',
};

export interface WorkflowStep {
  department: string;   // e.g. 'purchase', 'engineering', 'quality_head', 'plant_head'
  role: AppRole;
  status: MRBStatus;
  label: string;
}

/**
 * Fetch predefined workflow routing for a plant from plant_workflow_config.
 * Returns the ordered department sequence or empty array if none configured.
 */
export async function fetchPlantWorkflow(plant: string): Promise<WorkflowStep[]> {
  const { data, error } = await supabase
    .from('plant_workflow_config')
    .select('*')
    .eq('plant', plant)
    .eq('is_active', true)
    .order('workflow_step', { ascending: true });

  if (error || !data || data.length === 0) return [];

  return data.map((step) => {
    const dept = ROLE_TO_DEPT[step.department] || step.department;
    return {
      department: dept,
      role: step.department as AppRole,
      status: DEPT_TO_STATUS[dept] || 'quality_review',
      label: step.step_label,
    };
  });
}

/**
 * Build a workflow routing array from user-selected departments.
 * The order matches the order the user selected them in.
 */
export function buildRoutingFromSelection(departments: string[]): string[] {
  return departments;
}

/**
 * Given a stored workflow_routing array and the current pending_with role,
 * determine the next department in the sequence.
 *
 * Returns { nextDept, nextRole, nextStatus, isLast } or null if current not found.
 */
export function getNextWorkflowStep(
  workflowRouting: string[],
  currentRole: string
): { nextDept: string; nextRole: AppRole; nextStatus: MRBStatus; isLast: boolean } | null {
  if (!workflowRouting || workflowRouting.length === 0) return null;

  // Find current position — match by department key or by role
  const currentDept = ROLE_TO_DEPT[currentRole] || currentRole;
  const currentIndex = workflowRouting.findIndex(
    (d) => d === currentDept || d === currentRole || DEPT_TO_ROLE[d] === currentRole
  );

  if (currentIndex === -1) {
    // Current role not in the routing — might be the creator (quality)
    // Start from the beginning
    const first = workflowRouting[0];
    return {
      nextDept: first,
      nextRole: DEPT_TO_ROLE[first] || 'quality',
      nextStatus: DEPT_TO_STATUS[first] || 'quality_review',
      isLast: workflowRouting.length === 1,
    };
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= workflowRouting.length) {
    // We're at the last step — approve
    return {
      nextDept: workflowRouting[currentIndex],
      nextRole: DEPT_TO_ROLE[workflowRouting[currentIndex]] || 'executive',
      nextStatus: 'approved',
      isLast: true,
    };
  }

  const nextDept = workflowRouting[nextIndex];
  return {
    nextDept,
    nextRole: DEPT_TO_ROLE[nextDept] || 'quality',
    nextStatus: DEPT_TO_STATUS[nextDept] || 'quality_review',
    isLast: nextIndex === workflowRouting.length - 1,
  };
}
