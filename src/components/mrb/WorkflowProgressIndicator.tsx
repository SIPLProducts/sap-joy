import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, XCircle, ArrowRight, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDepartmentMap } from '@/hooks/useDepartmentMap';
import type { Database } from '@/integrations/supabase/types';

type MRBStatus = Database['public']['Enums']['mrb_status'];

interface ApprovalHistoryEntry {
  performed_by_role: string;
  action: string;
}

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
  approvalHistory?: ApprovalHistoryEntry[];
  sapSyncStatus?: string | null;
  className?: string;
}

export function WorkflowProgressIndicator({ 
  currentStatus, 
  pendingWith,
  plant = '1300',
  workflowRouting,
  approvalHistory = [],
  sapSyncStatus,
  className 
}: WorkflowProgressIndicatorProps) {
  const [dynamicSteps, setDynamicSteps] = useState<WorkflowStep[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { roleDisplayNames, deptToStatus, loading: deptLoading } = useDepartmentMap();

  useEffect(() => {
    if (deptLoading) return;

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

  // Determine which step contains the approval action
  const approverIdx = (() => {
    if (!approvalHistory || approvalHistory.length === 0) return -1;
    for (let i = workflowSteps.length - 1; i >= 0; i--) {
      const step = workflowSteps[i];
      if (step.id === 'completed') continue;
      const matched = approvalHistory.find(
        h => h.performed_by_role === step.id && (h.action === 'approve' || h.action === 'approved')
      );
      if (matched) return i;
    }
    return -1;
  })();

  // Set of role keys that participated (took any action)
  const participatedRoles = new Set(approvalHistory.map(h => h.performed_by_role));

  const getCurrentStepIndex = () => {
    if (pendingWith && workflowRouting && workflowRouting.length > 0) {
      const idx = workflowSteps.findIndex(step => step.id === pendingWith);
      if (idx !== -1) return idx;
    }
    const statusToCheck = currentStatus === 'draft' ? 'quality_review' : currentStatus;
    return workflowSteps.findIndex(step => step.statuses.includes(statusToCheck as MRBStatus));
  };

  const currentStepIndex = getCurrentStepIndex();
  const isCompleted = ['approved', 'rejected', 'closed'].includes(currentStatus);
  const isRejected = currentStatus === 'rejected';
  const isSapSynced = sapSyncStatus === 'synced' || sapSyncStatus === 'success';
  const isFullyDone = isCompleted && (currentStatus !== 'approved' || isSapSynced);

  // Per-step state for color coding
  const getStepState = (idx: number): 'approved' | 'participated' | 'current' | 'skipped' | 'pending' => {
    const step = workflowSteps[idx];
    if (step.id === 'completed') {
      return isFullyDone ? 'approved' : (isCompleted ? 'participated' : 'pending');
    }
    // If there's an approver step, anything after it (and not the completed node) is skipped
    if (approverIdx >= 0) {
      if (idx === approverIdx) return 'approved';
      if (idx < approverIdx) return participatedRoles.has(step.id) ? 'participated' : 'participated';
      // idx > approverIdx (and not completed)
      return 'skipped';
    }
    if (participatedRoles.has(step.id)) return 'participated';
    if (idx === currentStepIndex && !isCompleted) return 'current';
    if (idx < currentStepIndex) return 'participated';
    return 'pending';
  };

  const getStatusDetails = () => {
    if (isCompleted) {
      if (currentStatus === 'approved') {
        return isSapSynced
          ? { text: 'Approved & SAP Synced', color: 'text-green-600' }
          : { text: 'Approved — Pending SAP Sync', color: 'text-amber-600' };
      }
      if (currentStatus === 'rejected') return { text: 'Rejected', color: 'text-red-600' };
      return { text: 'Closed', color: 'text-muted-foreground' };
    }
    if (currentStepIndex >= 0 && currentStepIndex < workflowSteps.length) {
      const step = workflowSteps[currentStepIndex];
      return { text: `Awaiting ${step.label}`, color: 'text-amber-600' };
    }
    return { text: 'In Progress', color: 'text-muted-foreground' };
  };

  const statusDetails = getStatusDetails();

  if (!loaded || workflowSteps.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Loading workflow...</div>;
  }

  // Progress line width — fills up to approver (if any) or current step
  const progressEnd = approverIdx >= 0 ? approverIdx : currentStepIndex;
  const progressWidth = workflowSteps.length > 1
    ? `${Math.max(0, (progressEnd / (workflowSteps.length - 1)) * 100)}%`
    : '0%';

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
            isRejected ? "bg-red-500" : isFullyDone ? "bg-green-600" : "bg-primary"
          )}
          style={{ width: progressWidth }}
        />

        <div className="relative flex justify-between">
          {workflowSteps.map((step, index) => {
            const state = getStepState(index);
            const isApprover = state === 'approved' && step.id !== 'completed';

            return (
              <div 
                key={step.id} 
                className="flex flex-col items-center"
                style={{ width: `${100 / workflowSteps.length}%` }}
              >
                <div 
                  className={cn(
                    "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                    state === 'approved' && "bg-green-600 border-green-600",
                    state === 'participated' && "bg-blue-500 border-blue-500",
                    state === 'current' && !isRejected && "bg-primary/10 border-primary ring-4 ring-primary/20",
                    state === 'current' && isRejected && "bg-red-100 border-red-500 ring-4 ring-red-200",
                    state === 'skipped' && "bg-muted border-muted-foreground/30",
                    state === 'pending' && "bg-background border-border"
                  )}
                  title={
                    state === 'approved' ? 'Approved here' :
                    state === 'participated' ? 'Participated' :
                    state === 'skipped' ? 'Skipped (approved earlier)' :
                    state === 'current' ? 'Current step' : 'Pending'
                  }
                >
                  {state === 'approved' ? (
                    isApprover ? <Award className="h-5 w-5 text-white" /> : <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : state === 'participated' ? (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : state === 'current' ? (
                    isRejected ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    )
                  ) : state === 'skipped' ? (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>

                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-xs font-medium transition-colors",
                    state === 'approved' && "text-green-700",
                    state === 'participated' && "text-blue-700",
                    state === 'current' && !isRejected && "text-primary",
                    state === 'current' && isRejected && "text-red-600",
                    state === 'skipped' && "text-muted-foreground/70 line-through",
                    state === 'pending' && "text-muted-foreground"
                  )}>
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.shortLabel}</span>
                  </p>
                  {isApprover && (
                    <p className="text-[10px] text-green-700 font-semibold mt-0.5">Approved here</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Approved</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Participated</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary/40 ring-2 ring-primary/20" /> Current</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted border border-muted-foreground/30" /> Skipped</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-background border border-border" /> Pending</span>
      </div>
    </div>
  );
}
