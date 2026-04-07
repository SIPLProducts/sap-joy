import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fetchDepartmentMaps } from '@/hooks/useDepartmentMap';

type AppRole = Database['public']['Enums']['app_role'];
type MRBStatus = Database['public']['Enums']['mrb_status'];

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
  // Fetch workflow config and department maps in parallel
  const [configResult, maps] = await Promise.all([
    supabase
      .from('plant_workflow_config')
      .select('*')
      .eq('plant', plant)
      .eq('is_active', true)
      .order('workflow_step', { ascending: true }),
    fetchDepartmentMaps(),
  ]);

  if (configResult.error || !configResult.data || configResult.data.length === 0) return [];

  return configResult.data.map((step) => {
    const dept = maps.roleToDept[step.department] || step.department;
    return {
      department: dept,
      role: step.department as AppRole,
      status: (maps.deptToStatus[dept] || 'quality_review') as MRBStatus,
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
 * Given a stored workflow_routing array, the current pending_with role,
 * and dynamic department maps, determine the next department in the sequence.
 *
 * Returns { nextDept, nextRole, nextStatus, isLast } or null if current not found.
 */
export function getNextWorkflowStep(
  workflowRouting: string[],
  currentRole: string,
  deptMaps?: { deptToRole: Record<string, string>; roleToDept: Record<string, string>; deptToStatus: Record<string, string> }
): { nextDept: string; nextRole: AppRole; nextStatus: MRBStatus; isLast: boolean } | null {
  if (!workflowRouting || workflowRouting.length === 0) return null;

  const roleToDept = deptMaps?.roleToDept || {};
  const deptToRole = deptMaps?.deptToRole || {};
  const deptToStatus = deptMaps?.deptToStatus || {};

  // Find current position — match by department key or by role
  const currentDept = roleToDept[currentRole] || currentRole;
  const currentIndex = workflowRouting.findIndex(
    (d) => d === currentDept || d === currentRole || deptToRole[d] === currentRole
  );

  if (currentIndex === -1) {
    // Current role not in the routing — might be the creator (quality)
    // Start from the beginning
    const first = workflowRouting[0];
    return {
      nextDept: first,
      nextRole: (deptToRole[first] || first) as AppRole,
      nextStatus: (deptToStatus[first] || 'quality_review') as MRBStatus,
      isLast: workflowRouting.length === 1,
    };
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= workflowRouting.length) {
    // We're at the last step — approve
    return {
      nextDept: workflowRouting[currentIndex],
      nextRole: (deptToRole[workflowRouting[currentIndex]] || 'executive') as AppRole,
      nextStatus: 'approved',
      isLast: true,
    };
  }

  const nextDept = workflowRouting[nextIndex];
  return {
    nextDept,
    nextRole: (deptToRole[nextDept] || nextDept) as AppRole,
    nextStatus: (deptToStatus[nextDept] || 'quality_review') as MRBStatus,
    isLast: nextIndex === workflowRouting.length - 1,
  };
}
