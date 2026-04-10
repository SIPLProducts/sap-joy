import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDepartmentMap } from '@/hooks/useDepartmentMap';
import type { Database } from '@/integrations/supabase/types';

type MRBStatus = Database['public']['Enums']['mrb_status'];
type AppRole = string;

interface WorkflowStep {
  id: string;
  label: string;
  shortLabel: string;
  department: string;
  statuses: MRBStatus[];
}

interface WorkflowProgressIndicatorProps {
  currentStatus: MRBStatus;
  pendingWith?: string | null;
  plant?: string;
  workflowRouting?: string[] | null;
  className?: string;
}

export function WorkflowProgressIndicator({ 
  currentStatus, 
  pendingWith,
  plant = '1300',
  workflowRouting,
  className 
}: WorkflowProgressIndicatorProps) {
  const [dynamicSteps, setDynamicSteps] = useState<WorkflowStep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { roleDisplayNames, deptToStatus, loading: deptLoading } = useDepartmentMap();

  useEffect(() => {
    if (deptLoading) return;

    // If workflowRouting is provided, build steps from it
    if (workflowRouting && workflowRouting.length > 0) {
      const steps: WorkflowStep[] = workflowRouting.map(dept => {
        const label = roleDisplayNames[dept] || dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return {
          id: dept,
          label,
          shortLabel: label.split(' ')[0],
          department: dept,
          statuses: [(deptToStatus[dept] || 'quality_review') as MRBStatus],
        };
      });
      // Add completed step
      steps.push({
        id: 'completed',
        label: 'Completed',
        shortLabel: 'Done',
        department: 'completed',
        statuses: ['approved', 'rejected', 'closed'],
      });
      setDynamicSteps(steps);
      setLoaded(true);
      return;
    }

    // Fallback: fetch from plant_workflow_config
    const fetchWorkflow = async () => {
      const { data } = await supabase
        .from('plant_workflow_config')
        .select('*')
        .eq('plant', plant)
        .eq('is_active', true)
        .order('workflow_step', { ascending: true });

      if (data && data.length > 0) {
        const steps: WorkflowStep[] = data.map(d => {
          const label = roleDisplayNames[d.department] || d.step_label;
          return {
            id: d.department,
            label,
            shortLabel: label.split(' ')[0],
            department: d.department,
            statuses: [(deptToStatus[d.department] || 'quality_review') as MRBStatus],
          };
        });
        steps.push({
          id: 'completed',
          label: 'Completed',
          shortLabel: 'Done',
          department: 'completed',
          statuses: ['approved', 'rejected', 'closed'],
        });
        setDynamicSteps(steps);
      } else {
        setDynamicSteps([
          { id: 'quality', label: 'Quality Review', shortLabel: 'Quality', department: 'quality', statuses: ['quality_review'] },
          { id: 'department', label: 'Department Review', shortLabel: 'Dept Review', department: 'purchase', statuses: ['purchase_review', 'engineering_review'] },
          { id: 'final', label: 'Final Approval', shortLabel: 'Final', department: 'executive', statuses: ['final_approval'] },
          { id: 'completed', label: 'Completed', shortLabel: 'Done', department: 'completed', statuses: ['approved', 'rejected', 'closed'] },
        ]);
      }
      setLoaded(true);
    };
    fetchWorkflow();
  }, [plant, workflowRouting, deptLoading, roleDisplayNames, deptToStatus]);

  const workflowSteps = dynamicSteps;

  const getCurrentStepIndex = () => {
    // If we have pendingWith, match against routing entries
    if (pendingWith && workflowRouting && workflowRouting.length > 0) {
      const idx = workflowSteps.findIndex(step => step.id === pendingWith);
      if (idx !== -1) return idx;
    }
    // Fallback: match by status
    const statusToCheck = currentStatus === 'draft' ? 'quality_review' : currentStatus;
    return workflowSteps.findIndex(step => step.statuses.includes(statusToCheck as MRBStatus));
  };

  const currentStepIndex = getCurrentStepIndex();
  const isCompleted = ['approved', 'rejected', 'closed'].includes(currentStatus);
  const isRejected = currentStatus === 'rejected';

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  // Dynamic status text based on current step
  const getStatusDetails = () => {
    if (isCompleted) {
      if (currentStatus === 'approved') return { text: 'Approved & Completed', color: 'text-green-600' };
      if (currentStatus === 'rejected') return { text: 'Rejected', color: 'text-red-600' };
      return { text: 'Closed', color: 'text-muted-foreground' };
    }
    // Find current step and use its label
    if (currentStepIndex >= 0 && currentStepIndex < workflowSteps.length) {
      const step = workflowSteps[currentStepIndex];
      return { text: `Awaiting ${step.label}`, color: 'text-amber-600' };
    }
    return { text: 'Unknown Status', color: 'text-muted-foreground' };
  };

  const statusDetails = getStatusDetails();

  if (!loaded || workflowSteps.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Loading workflow...</div>;
  }

  return (
    <div className={cn("bg-background rounded-lg border border-border p-4", className)}>
      {/* Status Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            isRejected ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )
          ) : (
            <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
          )}
          <span className={cn("font-semibold", statusDetails.color)}>
            {statusDetails.text}
          </span>
        </div>
        {pendingWith && !isCompleted && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
            Pending with: {roleDisplayNames[pendingWith] || pendingWith.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        )}
      </div>

      {/* Progress Steps */}
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
        <div 
          className={cn(
            "absolute top-5 left-0 h-0.5 transition-all duration-500",
            isRejected ? "bg-red-500" : "bg-primary"
          )}
          style={{ 
            width: `${Math.max(0, (currentStepIndex / (workflowSteps.length - 1)) * 100)}%` 
          }}
        />

        <div className="relative flex justify-between">
          {workflowSteps.map((step, index) => {
            const stepStatus = getStepStatus(index);
            const isActive = stepStatus === 'current';
            const isDone = stepStatus === 'completed';

            return (
              <div 
                key={step.id} 
                className="flex flex-col items-center"
                style={{ width: `${100 / workflowSteps.length}%` }}
              >
                <div 
                  className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                    isDone && "bg-primary border-primary",
                    isActive && !isRejected && "bg-primary/10 border-primary ring-4 ring-primary/20",
                    isActive && isRejected && "bg-red-100 border-red-500 ring-4 ring-red-200",
                    stepStatus === 'pending' && "bg-background border-border"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                  ) : isActive ? (
                    isRejected ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    )
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>

                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-xs font-medium transition-colors",
                    isDone && "text-primary",
                    isActive && !isRejected && "text-primary",
                    isActive && isRejected && "text-red-600",
                    stepStatus === 'pending' && "text-muted-foreground"
                  )}>
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.shortLabel}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Workflow Path */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground flex-wrap">
          {workflowSteps.map((step, i, arr) => (
            <span key={step.id} className="flex items-center gap-1">
              <span>{step.shortLabel}</span>
              {i < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
