import { CheckCircle2, Circle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type MRBStatus = Database['public']['Enums']['mrb_status'];
type WorkflowMRBStatus = 'quality_review' | 'purchase_review' | 'engineering_review' | 'final_approval' | 'approved' | 'rejected' | 'closed';

interface WorkflowStep {
  id: string;
  label: string;
  shortLabel: string;
  statuses: WorkflowMRBStatus[];
}

const workflowSteps: WorkflowStep[] = [
  { id: 'quality', label: 'Quality Review', shortLabel: 'Quality', statuses: ['quality_review'] },
  { id: 'department', label: 'Department Review', shortLabel: 'Dept Review', statuses: ['purchase_review', 'engineering_review'] },
  { id: 'final', label: 'Final Approval', shortLabel: 'Final', statuses: ['final_approval'] },
  { id: 'completed', label: 'Completed', shortLabel: 'Done', statuses: ['approved', 'rejected', 'closed'] },
];

interface WorkflowProgressIndicatorProps {
  currentStatus: MRBStatus;
  pendingWith?: string | null;
  className?: string;
}

export function WorkflowProgressIndicator({ 
  currentStatus, 
  pendingWith,
  className 
}: WorkflowProgressIndicatorProps) {
  const getCurrentStepIndex = () => {
    // Handle draft status by treating it as quality_review (first step)
    const statusToCheck = currentStatus === 'draft' ? 'quality_review' : currentStatus;
    return workflowSteps.findIndex(step => step.statuses.includes(statusToCheck as WorkflowMRBStatus));
  };

  const currentStepIndex = getCurrentStepIndex();
  const isCompleted = ['approved', 'rejected', 'closed'].includes(currentStatus);
  const isRejected = currentStatus === 'rejected';

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  const getStatusDetails = () => {
    switch (currentStatus) {
      case 'quality_review':
        return { text: 'Awaiting Quality Review', color: 'text-blue-600' };
      case 'purchase_review':
        return { text: 'Awaiting Purchase Review', color: 'text-purple-600' };
      case 'engineering_review':
        return { text: 'Awaiting Engineering Review', color: 'text-orange-600' };
      case 'final_approval':
        return { text: 'Awaiting Final Approval', color: 'text-amber-600' };
      case 'approved':
        return { text: 'Approved & Completed', color: 'text-green-600' };
      case 'rejected':
        return { text: 'Rejected', color: 'text-red-600' };
      case 'closed':
        return { text: 'Closed', color: 'text-muted-foreground' };
      default:
        return { text: 'Unknown Status', color: 'text-muted-foreground' };
    }
  };

  const statusDetails = getStatusDetails();

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
            Pending with: {pendingWith.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        )}
      </div>

      {/* Progress Steps */}
      <div className="relative">
        {/* Progress Line (Background) */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
        
        {/* Progress Line (Filled) */}
        <div 
          className={cn(
            "absolute top-5 left-0 h-0.5 transition-all duration-500",
            isRejected ? "bg-red-500" : "bg-primary"
          )}
          style={{ 
            width: `${Math.max(0, (currentStepIndex / (workflowSteps.length - 1)) * 100)}%` 
          }}
        />

        {/* Steps */}
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
                {/* Step Circle */}
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

                {/* Step Label */}
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
                  {isActive && step.statuses.length > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {currentStatus === 'purchase_review' ? 'Purchase' : 
                       currentStatus === 'engineering_review' ? 'Engineering' : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow Path Description */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>Quality</span>
          <ArrowRight className="h-3 w-3" />
          <span>Purchase/Engineering</span>
          <ArrowRight className="h-3 w-3" />
          <span>Final</span>
          <ArrowRight className="h-3 w-3" />
          <span className="text-green-600">✓</span>
        </div>
      </div>
    </div>
  );
}
