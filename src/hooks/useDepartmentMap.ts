import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DepartmentMapEntry {
  id: string;
  name: string;
  role_key: string | null;
  workflow_status: string | null;
  is_active: boolean;
  is_workflow_enabled: boolean;
  description: string | null;
}

/**
 * Provides dynamic mappings built from the departments table.
 * Replaces all hardcoded DEPT_TO_ROLE, ROLE_TO_DEPT, DEPT_TO_STATUS, getRoleDisplayName maps.
 */
export function useDepartmentMap() {
  const [departments, setDepartments] = useState<DepartmentMapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, role_key, workflow_status, is_active, is_workflow_enabled, description')
          .order('name');
        if (!error && data) setDepartments(data);
      } catch (e) {
        console.error('Error fetching department map:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  /** role_key → department name (display name) */
  const roleDisplayNames = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => {
      if (d.role_key) map[d.role_key] = d.name;
    });
    return map;
  }, [departments]);

  /** dept key → app_role (DEPT_TO_ROLE equivalent) */
  const deptToRole = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => {
      if (d.role_key) {
        map[d.role_key] = d.role_key; // role_key IS the app_role
      }
    });
    return map;
  }, [departments]);

  /** app_role → dept key (ROLE_TO_DEPT equivalent) */
  const roleToDept = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => {
      if (d.role_key) {
        map[d.role_key] = d.role_key;
      }
    });
    return map;
  }, [departments]);

  /** dept key → MRB status (DEPT_TO_STATUS equivalent) */
  const deptToStatus = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => {
      if (d.role_key && d.workflow_status) {
        map[d.role_key] = d.workflow_status;
      }
    });
    return map;
  }, [departments]);

  /** Get display name for a role key */
  const getRoleDisplayName = (roleKey: string): string => {
    return roleDisplayNames[roleKey] || roleKey || 'N/A';
  };

  /** Workflow-enabled departments with role keys (for workflow config / MRB creation) */
  const workflowRoles = useMemo(() =>
    departments.filter(d => d.is_active && d.is_workflow_enabled && d.role_key),
    [departments]
  );

  /** All active departments (for role access matrix, user assignment) */
  const activeDepartments = useMemo(() =>
    departments.filter(d => d.is_active),
    [departments]
  );

  /** All unique role_key values from active departments */
  const availableRoleKeys = useMemo(() =>
    departments.filter(d => d.is_active && d.role_key).map(d => d.role_key!),
    [departments]
  );

  return {
    departments,
    loading,
    roleDisplayNames,
    deptToRole,
    roleToDept,
    deptToStatus,
    getRoleDisplayName,
    workflowRoles,
    activeDepartments,
    availableRoleKeys,
  };
}

/**
 * Standalone function to fetch department maps for non-React contexts.
 * Used by workflowRouting.ts utilities.
 */
export async function fetchDepartmentMaps() {
  const { data, error } = await supabase
    .from('departments')
    .select('name, role_key, workflow_status, is_active, is_workflow_enabled');

  if (error || !data) return { deptToRole: {}, roleToDept: {}, deptToStatus: {}, roleDisplayNames: {} };

  const deptToRole: Record<string, string> = {};
  const roleToDept: Record<string, string> = {};
  const deptToStatus: Record<string, string> = {};
  const roleDisplayNames: Record<string, string> = {};

  data.forEach(d => {
    if (d.role_key) {
      deptToRole[d.role_key] = d.role_key;
      roleToDept[d.role_key] = d.role_key;
      roleDisplayNames[d.role_key] = d.name;
      if (d.workflow_status) {
        deptToStatus[d.role_key] = d.workflow_status;
      }
    }
  });

  return { deptToRole, roleToDept, deptToStatus, roleDisplayNames };
}
