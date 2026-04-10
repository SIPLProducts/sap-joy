import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Upload, FileText, Trash2, History, Paperclip, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { getStatusDisplayName, getStatusColor, getRoleDisplayName } from '@/data/mockData';
import { useDepartmentMap } from '@/hooks/useDepartmentMap';
import { WorkflowProgressIndicator } from '@/components/mrb/WorkflowProgressIndicator';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type ApprovalHistory = Database['public']['Tables']['mrb_approval_history']['Row'];
type MRBStatus = Database['public']['Enums']['mrb_status'];

export default function InwardMRBDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { getMRBById, updateMRBStatus, getApprovalHistory } = useMRBDatabase();
  const { currentRole, canEdit } = useRole();
  const { userRole, profile, user } = useAuth();
  const { roleDisplayNames } = useDepartmentMap();
  
  const [mrb, setMRB] = useState<MRBRecord | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poItemNumber, setPOItemNumber] = useState<string | null>(null);
  const [lotBatch, setLotBatch] = useState<string | null>(null);
  
  const [reviewData, setReviewData] = useState({
    reviewComments: '',
    action: '',
    forwardToNext: false,
    nextDepartments: [] as string[],
  });
  
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setIsLoading(true);
      
      const [mrbData, historyData] = await Promise.all([
        getMRBById(id),
        getApprovalHistory(id),
      ]);
      
      if (mrbData) {
        setMRB(mrbData);
        // Fetch PO item number from inward_inspection_lots
        if (mrbData.inspection_lot) {
          const { data: lotData } = await supabase
            .from('inward_inspection_lots')
            .select('po_item_number')
            .eq('inspection_lot', mrbData.inspection_lot)
            .limit(1)
            .maybeSingle();
          if (lotData?.po_item_number) {
            setPOItemNumber(lotData.po_item_number);
          }
        }
      }
      
      setApprovalHistory(historyData);
      setIsLoading(false);
    };
    
    loadData();
  }, [id, getMRBById, getApprovalHistory]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading MRB details...</p>
        </div>
      </div>
    );
  }

  if (!mrb) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">MRB Not Found</h2>
          <Button onClick={() => navigate('/worklist')}>
            Go to Worklist
          </Button>
        </div>
      </div>
    );
  }

  const canReview = mrb.pending_with === userRole || userRole === 'admin' || userRole === 'executive';

  const handleOpenApprovalDialog = () => {
    if (!reviewData.action) {
      toast({
        title: 'Validation Error',
        description: 'Please select an action',
        variant: 'destructive',
      });
      return;
    }

    if (reviewData.forwardToNext && reviewData.nextDepartments.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one department to forward to',
        variant: 'destructive',
      });
      return;
    }
    
    setShowApprovalDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!mrb) return;
    
    setIsSubmitting(true);
    
    try {
      let newStatus: MRBStatus = mrb.status;
      let additionalUpdates: Partial<MRBRecord> = {};

      // Map department values to proper app_role enum values
      const deptToAppRole: Record<string, string> = {
        'engineering': 'engineering',
        'purchase': 'purchase',
        'plant_head': 'executive',
        'quality_head': 'quality_head',
        'mrb_committee': 'mrb_committee',
      };

      const deptToStatus: Record<string, MRBStatus> = {
        'engineering': 'engineering_review',
        'purchase': 'purchase_review',
        'plant_head': 'final_approval',
        'quality_head': 'quality_review',
        'mrb_committee': 'quality_review',
      };
      
      // Determine next status based on workflow routing
      const workflowRouting = Array.isArray(mrb.workflow_routing) ? (mrb.workflow_routing as string[]) : [];
      
      if (reviewData.forwardToNext && reviewData.nextDepartments.length > 0) {
        const firstDept = reviewData.nextDepartments[0];
        newStatus = deptToStatus[firstDept] || 'quality_review';
        const nextPendingWith = deptToAppRole[firstDept] || 'quality';
        additionalUpdates.pending_with = nextPendingWith;
      } else if (reviewData.action === 'approve' || reviewData.action === 'approve_with_deviation' || reviewData.action === 'return_to_vendor') {
        // Check if current role is the last in the workflow routing
        const currentDept = Object.entries(deptToAppRole).find(([, role]) => role === userRole)?.[0] || userRole;
        const currentIdx = workflowRouting.findIndex(d => d === currentDept || d === userRole || deptToAppRole[d] === userRole);
        const isLastStep = currentIdx >= 0 && currentIdx === workflowRouting.length - 1;
        
        if (isLastStep || workflowRouting.length === 0) {
          // Final step — approve/reject
          if (reviewData.action === 'return_to_vendor') {
            newStatus = 'rejected';
            additionalUpdates.final_decision = 'return_to_vendor';
            additionalUpdates.closure_status = 'return_to_vendor';
            additionalUpdates.closed_at = new Date().toISOString();
            additionalUpdates.closed_by = user?.id || null;
          } else {
            newStatus = 'approved';
            additionalUpdates.closure_status = 'completed';
            additionalUpdates.closed_at = new Date().toISOString();
            additionalUpdates.closed_by = user?.id || null;
            additionalUpdates.final_decision = reviewData.action === 'approve' ? 'approved' : 'approved_with_deviation';
            additionalUpdates.final_approved_by = user?.id || null;
            additionalUpdates.final_approved_at = new Date().toISOString();
          }
        } else {
          // Not the last step — forward to next in routing
          const nextIdx = currentIdx + 1;
          if (nextIdx < workflowRouting.length) {
            const nextDept = workflowRouting[nextIdx];
            newStatus = deptToStatus[nextDept] || 'quality_review';
            additionalUpdates.pending_with = deptToAppRole[nextDept] || nextDept;
          } else {
            newStatus = 'final_approval';
            additionalUpdates.pending_with = 'executive';
          }
        }
      }
      
      // Set additional updates based on current reviewing role
      if (userRole === 'quality' || userRole === 'quality_head') {
        additionalUpdates.quality_remarks = reviewData.reviewComments;
        additionalUpdates.quality_approved_by = user?.id || null;
        additionalUpdates.quality_approved_at = new Date().toISOString();
      } else if (userRole === 'purchase' || userRole === 'purchase_head') {
        additionalUpdates.purchase_remarks = reviewData.reviewComments;
        additionalUpdates.purchase_approved_by = user?.id || null;
        additionalUpdates.purchase_approved_at = new Date().toISOString();
        if (reviewData.action === 'return_to_vendor') {
          additionalUpdates.purchase_action = 'return_to_vendor';
        }
      } else if (userRole === 'engineering' || userRole === 'engineering_head') {
        additionalUpdates.engineering_remarks = reviewData.reviewComments;
        additionalUpdates.engineering_approved_by = user?.id || null;
        additionalUpdates.engineering_approved_at = new Date().toISOString();
      } else if (userRole === 'executive' || userRole === 'admin') {
        additionalUpdates.final_remarks = reviewData.reviewComments;
        additionalUpdates.final_decision = reviewData.action === 'approve' ? 'approved' : reviewData.action;
        additionalUpdates.final_approved_by = user?.id || null;
        additionalUpdates.final_approved_at = new Date().toISOString();
        if (reviewData.action === 'approve') {
          newStatus = 'approved';
          additionalUpdates.closure_status = 'completed';
          additionalUpdates.closed_at = new Date().toISOString();
          additionalUpdates.closed_by = user?.id || null;
        }
      } else if (userRole === 'mrb_committee') {
        additionalUpdates.mrb_committee_remarks = reviewData.reviewComments;
        additionalUpdates.mrb_committee_decision = reviewData.action;
        additionalUpdates.mrb_committee_approved_by = profile?.full_name || null;
        additionalUpdates.mrb_committee_approved_at = new Date().toISOString();
      }
      
      const actionLabel = getActionLabel(reviewData.action);
      const success = await updateMRBStatus(
        mrb.id,
        newStatus,
        reviewData.action === 'approve' || reviewData.action === 'approve_with_deviation' ? 'approved' : 'forwarded',
        `${actionLabel}: ${reviewData.reviewComments || 'No comments'}`,
        additionalUpdates as any
      );
      
      if (success) {
        toast({
          title: 'Review Submitted',
          description: 'Your review has been submitted successfully.',
        });
        navigate('/worklist');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setShowApprovalDialog(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'approve': 'Approved',
      'return_for_clarification': 'Returned for Clarification',
      'approve_with_deviation': 'Approved with Deviation',
      'return_to_vendor': 'Return to Vendor',
    };
    return labels[action] || action;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-full bg-muted/30 flex flex-col overflow-auto h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/worklist"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">
                    {mrb.mrb_number}
                  </h1>
                  <Badge className={getStatusColor(mrb.status)}>
                    {getStatusDisplayName(mrb.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Created on {formatDate(mrb.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 flex-1 pb-6">
        {/* Workflow Progress Indicator */}
        <WorkflowProgressIndicator 
          currentStatus={mrb.status} 
          pendingWith={mrb.pending_with}
          workflowRouting={Array.isArray(mrb.workflow_routing) ? (mrb.workflow_routing as string[]) : undefined}
        />

        {/* MRB Details (Read-Only) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">MRB Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Inspection Lot</Label>
                <p className="font-medium">{mrb.inspection_lot || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Material Code</Label>
                <p className="font-medium font-mono">{mrb.material_number}</p>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-muted-foreground text-xs">Material Description</Label>
                <p className="font-medium">{mrb.material_description}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Plant</Label>
                <p className="font-medium">{mrb.plant}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Vendor Code</Label>
                <p className="font-medium font-mono">{mrb.vendor_code || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Vendor Name</Label>
                <p className="font-medium">{mrb.vendor_name || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">PO Number</Label>
                <p className="font-medium font-mono">{mrb.po_number || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">PO Line Item</Label>
                <p className="font-medium font-mono">{poItemNumber || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">GRN Number</Label>
                <p className="font-medium font-mono">{mrb.grn_number || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Batch</Label>
                <p className="font-medium font-mono">{(mrb as any).batch || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Blocked Quantity</Label>
                <p className="font-medium text-destructive">{mrb.blocked_quantity} {mrb.uom}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Block Reason</Label>
                <p className="font-medium">{mrb.defect_description || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Pending With</Label>
                <p className="font-medium">{mrb.pending_with ? getRoleDisplayName(mrb.pending_with as any) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Decision */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">Quality Inspection Decision</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Quality Decision</Label>
                <p className="font-medium capitalize">{mrb.quality_decision?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Defect Category</Label>
                <p className="font-medium capitalize">{mrb.defect_category || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Inspection Date</Label>
                <p className="font-medium">{formatDate(mrb.quality_approved_at)}</p>
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label className="text-muted-foreground text-xs">Quality Comments</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{mrb.quality_remarks || 'No comments'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval History */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              Approval History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {approvalHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No history yet</p>
            ) : (
              <div className="space-y-4">
                {approvalHistory.map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                      {index < approvalHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{item.stage}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.action}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        by <span className="font-medium text-foreground">{(item as any).performer_name || 'Unknown'}</span>
                        {' '}({getRoleDisplayName(item.performed_by_role as any)})
                        {' • '}{formatDate(item.performed_at)}
                      </p>
                      {item.remarks && (
                        <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{item.remarks}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Review Form (if can review) */}
        {canReview && mrb.status !== 'approved' && mrb.status !== 'rejected' && mrb.status !== 'closed' && (
          <>
            <Separator />
            <Card className="border-border shadow-sm border-primary/20">
              <CardHeader className="border-b border-border bg-primary/5 py-3">
                <CardTitle className="text-base font-semibold">
                  Your Review ({getRoleDisplayName((userRole || 'quality') as any)})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>
                      Action <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={reviewData.action}
                      onValueChange={(value) => setReviewData({ ...reviewData, action: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select Action" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        <SelectItem value="approve">Approve</SelectItem>
                        <SelectItem value="return_for_clarification">Return for Clarification</SelectItem>
                        <SelectItem value="approve_with_deviation">Approve with Deviation</SelectItem>
                        <SelectItem value="return_to_vendor">Return to Vendor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Review Comments</Label>
                  <Textarea
                    value={reviewData.reviewComments}
                    onChange={(e) => setReviewData({ ...reviewData, reviewComments: e.target.value })}
                    placeholder="Enter your review comments..."
                    rows={4}
                    className="bg-background resize-none"
                  />
                </div>

                {/* Forward to next department */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="forwardToNext"
                      checked={reviewData.forwardToNext}
                      onCheckedChange={(checked) => 
                        setReviewData({ ...reviewData, forwardToNext: checked as boolean })
                      }
                    />
                    <Label htmlFor="forwardToNext">Forward to another department</Label>
                  </div>
                  
                  {reviewData.forwardToNext && (
                    <div className="pl-6 space-y-3">
                       <Label>Select Departments to Forward</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(Array.isArray(mrb.workflow_routing) ? (mrb.workflow_routing as string[]) : [])
                          .filter(d => d !== currentRole && d !== userRole)
                          .map((dept) => (
                            <label
                              key={dept}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                reviewData.nextDepartments?.includes(dept)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={reviewData.nextDepartments?.includes(dept) || false}
                                onChange={(e) => {
                                  const current = reviewData.nextDepartments || [];
                                  if (e.target.checked) {
                                    setReviewData({ 
                                      ...reviewData, 
                                      nextDepartments: [...current, dept] 
                                    });
                                  } else {
                                    setReviewData({ 
                                      ...reviewData, 
                                      nextDepartments: current.filter(d => d !== dept) 
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <span className="text-sm font-medium">{roleDisplayNames[dept] || dept}</span>
                            </label>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Sticky Footer with Submit Button */}
      {canReview && mrb.status !== 'approved' && mrb.status !== 'rejected' && mrb.status !== 'closed' && (
        <div className="sticky bottom-0 z-40 bg-background border-t border-border shadow-lg mt-auto">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {reviewData.action ? (
                <span>
                  Selected action: <strong className="text-foreground">{getActionLabel(reviewData.action)}</strong>
                  {reviewData.forwardToNext && reviewData.nextDepartments.length > 0 && (
                    <span className="ml-2">
                      → Forward to: {reviewData.nextDepartments.map(d => 
                        roleDisplayNames[d] || d
                      ).join(', ')}
                    </span>
                  )}
                </span>
              ) : (
                <span>Please select an action to proceed</span>
              )}
            </div>
            <Button 
              onClick={handleOpenApprovalDialog} 
              disabled={!reviewData.action}
              size="lg"
              className="min-w-[160px]"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Review
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Review Submission</DialogTitle>
            <DialogDescription>
              You are about to submit your review with action: <strong>{getActionLabel(reviewData.action)}</strong>
              {reviewData.forwardToNext && reviewData.nextDepartments.length > 0 && (
                <span> and forward to {reviewData.nextDepartments.map(d => 
                  roleDisplayNames[d] || d
                ).join(', ')}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
