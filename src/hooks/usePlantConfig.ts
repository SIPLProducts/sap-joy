import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Dashboard config
interface DashboardConfig {
  dashboard_key: string;
  plant: string;
  role: string;
  is_enabled: boolean;
}

// Print config
export interface PlantPrintConfig {
  plant: string;
  company_name: string;
  division_name: string;
  logo_url: string | null;
  ncr_doc_number: string | null;
  ncr_revision: string | null;
  ncr_effective_date: string | null;
  mrb_doc_number: string | null;
  mrb_revision: string | null;
  mrb_effective_date: string | null;
}

// Workflow config
export interface PlantWorkflowStep {
  workflow_step: number;
  department: string;
  step_label: string;
  is_required: boolean;
  is_active: boolean;
}

export function useDashboardConfig() {
  const [configs, setConfigs] = useState<DashboardConfig[]>([]);
  const { userRole, profile } = useAuth();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('dashboard_config')
        .select('*');
      if (data) setConfigs(data as unknown as DashboardConfig[]);
    };
    fetchConfig();
  }, []);

  const isDashboardEnabled = (dashboardKey: string): boolean => {
    // If no config entries exist, default to enabled (backward compatible)
    if (configs.length === 0) return true;
    
    const userPlant = profile?.plant || '1300';
    const matching = configs.find(
      c => c.dashboard_key === dashboardKey && c.plant === userPlant && c.role === userRole
    );
    
    // If no specific config, default to enabled
    if (!matching) return true;
    return matching.is_enabled;
  };

  return { isDashboardEnabled, configs };
}

export function usePrintConfig(plant: string) {
  const [config, setConfig] = useState<PlantPrintConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('plant_print_config')
        .select('*')
        .eq('plant', plant)
        .maybeSingle();
      
      if (data) {
        setConfig(data as unknown as PlantPrintConfig);
      } else {
        // Fallback defaults
        setConfig({
          plant,
          company_name: 'HBL Engineering Limited',
          division_name: 'Electronics Group',
          logo_url: null,
          ncr_doc_number: 'HBL/QA/NCR/001',
          ncr_revision: '01',
          ncr_effective_date: '2025-01-01',
          mrb_doc_number: 'HBL/QA/MRB/001',
          mrb_revision: '01',
          mrb_effective_date: '2025-01-01',
        });
      }
      setIsLoading(false);
    };
    
    if (plant) fetchConfig();
  }, [plant]);

  return { config, isLoading };
}

export function useWorkflowConfig(plant: string) {
  const [steps, setSteps] = useState<PlantWorkflowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSteps = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('plant_workflow_config')
        .select('*')
        .eq('plant', plant)
        .eq('is_active', true)
        .order('workflow_step', { ascending: true });
      
      if (data && data.length > 0) {
        setSteps(data as unknown as PlantWorkflowStep[]);
      } else {
        // Default workflow
        setSteps([
          { workflow_step: 1, department: 'quality', step_label: 'Quality Review', is_required: true, is_active: true },
          { workflow_step: 2, department: 'purchase', step_label: 'Purchase Review', is_required: true, is_active: true },
          { workflow_step: 3, department: 'engineering', step_label: 'Engineering Review', is_required: true, is_active: true },
          { workflow_step: 4, department: 'executive', step_label: 'Final Approval', is_required: true, is_active: true },
        ]);
      }
      setIsLoading(false);
    };

    if (plant) fetchSteps();
  }, [plant]);

  return { steps, isLoading };
}

export function usePlants() {
  const [plants, setPlants] = useState<{ code: string; name: string; location: string | null }[]>([]);

  useEffect(() => {
    const fetchPlants = async () => {
      const { data } = await supabase
        .from('plants')
        .select('code, name, location')
        .order('code');
      if (data) setPlants(data);
    };
    fetchPlants();
  }, []);

  return plants;
}
