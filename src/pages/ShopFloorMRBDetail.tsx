import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, History, CheckCircle, Loader2, Factory, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

type MRBRecord = Database['public']['Tables']['mrb_records']['Row'];
type ApprovalHistory = Database['public']['Tables']['mrb_approval_history']['Row'];
type MRBStatus = Database['public']['Enums']['mrb_status'];

export default function ShopFloorMRBDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { getMRBById, updateMRBStatus, getApprovalHistory } = useMRBDatabase();
  const { currentRole, canEdit } = useRole();
  const { userRole, profile } = useAuth();
  
  const [mrb, setMRB] = useState<MRBRecord | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
        // Only show shop floor source MRBs
        if (mrbData.source !== 'shop_floor') {
          toast({
            title: 'Invalid MRB',
            description: 'This MRB is not from Shop Floor',
            variant: 'destructive',
          });
          navigate('/worklist');
          return;
        }
        setMRB(mrbData);
      }
      
      setApprovalHistory(historyData);
      setIsLoading(false);
    };
    
    loadData();
  }, [id, getMRBById, getApprovalHistory, navigate, toast]);

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
      
      // Determine next status based on action and forward settings
      if (reviewData.forwardToNext && reviewData.nextDepartments.length > 0) {
        const firstDept = reviewData.nextDepartments[0];
        switch (firstDept) {
          case 'engineering':
            newStatus = 'engineering_review';
            break;
          case 'purchase':
            newStatus = 'purchase_review';
            break;
          case 'plant_head':
            newStatus = 'final_approval';
            break;
          default:
            newStatus = 'quality_review';
        }
      } else if (reviewData.action === 'approve' || reviewData.action === 'approve_with_deviation' || reviewData.action === 'rework_required') {
        newStatus = 'final_approval';
      }
      
      // Set additional updates based on current stage
      if (userRole?.includes('quality')) {
        additionalUpdates = { quality_remarks: reviewData.reviewComments };
      } else if (userRole?.includes('purchase')) {
        additionalUpdates = { purchase_remarks: reviewData.reviewComments };
      } else if (userRole?.includes('engineering')) {
        additionalUpdates = { engineering_remarks: reviewData.reviewComments };
      } else if (userRole === 'executive' || userRole === 'admin') {
        additionalUpdates = { 
          final_remarks: reviewData.reviewComments,
          final_decision: reviewData.action === 'approve' ? 'approved' : reviewData.action,
        };
        if (reviewData.action === 'approve') {
          newStatus = 'approved';
          additionalUpdates.closure_status = 'completed';
          additionalUpdates.closed_at = new Date().toISOString();
        }
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
      'rework_required': 'Rework Required',
      'scrap_material': 'Scrap Material',
      'use_as_is': 'Use As Is',
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500 shrink-0">
                <Factory className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">
                    {mrb.mrb_number}
                  </h1>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                    Shop Floor
                  </Badge>
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

        {/* Material & Stock Information */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Material & Stock Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <Label className="text-muted-foreground text-xs">Production Order</Label>
                <p className="font-medium font-mono">{mrb.production_order_number || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">PO Number</Label>
                <p className="font-medium font-mono">{mrb.po_number || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Blocked Quantity</Label>
                <p className="font-medium text-destructive">{mrb.blocked_quantity} {mrb.uom}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Pending With</Label>
                <p className="font-medium">{mrb.pending_with ? getRoleDisplayName(mrb.pending_with as any) : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Defect & Blocking Details */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">Defect & Blocking Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Issue Identified By</Label>
                <p className="font-medium">{mrb.issue_identified_by || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Identified Date</Label>
                <p className="font-medium">{formatDate(mrb.issue_identified_date)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Immediate Block</Label>
                <Badge variant={mrb.immediate_block_required ? 'destructive' : 'secondary'}>
                  {mrb.immediate_block_required ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label className="text-muted-foreground text-xs">Issue Description</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{mrb.issue_description || 'No description provided'}</p>
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label className="text-muted-foreground text-xs">Impact on Production</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{mrb.impact_on_production || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Review Remarks */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">Department Review Comments</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {mrb.quality_remarks && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Quality Remarks</Label>
                <p className="text-sm bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200 dark:border-blue-800">{mrb.quality_remarks}</p>
                {mrb.quality_approved_at && (
                  <p className="text-xs text-muted-foreground">Reviewed on {formatDate(mrb.quality_approved_at)}</p>
                )}
              </div>
            )}
            {mrb.purchase_remarks && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Purchase Remarks</Label>
                <p className="text-sm bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800">{mrb.purchase_remarks}</p>
                {mrb.purchase_approved_at && (
                  <p className="text-xs text-muted-foreground">Reviewed on {formatDate(mrb.purchase_approved_at)}</p>
                )}
              </div>
            )}
            {mrb.engineering_remarks && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Engineering Remarks</Label>
                <p className="text-sm bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-200 dark:border-purple-800">{mrb.engineering_remarks}</p>
                <p className="text-xs text-muted-foreground">
                  Decision: <span className="font-medium capitalize">{mrb.engineering_decision?.replace(/_/g, ' ') || '-'}</span>
                  {mrb.engineering_approved_at && ` • Reviewed on ${formatDate(mrb.engineering_approved_at)}`}
                </p>
              </div>
            )}
            {mrb.final_remarks && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Final Remarks</Label>
                <p className="text-sm bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-800">{mrb.final_remarks}</p>
                <p className="text-xs text-muted-foreground">
                  Decision: <span className="font-medium capitalize">{mrb.final_decision || '-'}</span>
                  {mrb.final_approved_at && ` • Finalized on ${formatDate(mrb.final_approved_at)}`}
                </p>
              </div>
            )}
            {!mrb.quality_remarks && !mrb.purchase_remarks && !mrb.engineering_remarks && !mrb.final_remarks && (
              <p className="text-muted-foreground text-center py-4">No department remarks yet</p>
            )}
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
                        <SelectItem value="rework_required">Rework Required</SelectItem>
                        <SelectItem value="use_as_is">Use As Is</SelectItem>
                        <SelectItem value="scrap_material">Scrap Material</SelectItem>
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

                {/* Forward to next */}
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
                        {shopFloorNextDepartments
                          .filter(d => d.value !== currentRole)
                          .map((dept) => (
                            <label
                              key={dept.value}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                reviewData.nextDepartments?.includes(dept.value)
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={reviewData.nextDepartments?.includes(dept.value) || false}
                                onChange={(e) => {
                                  const current = reviewData.nextDepartments || [];
                                  if (e.target.checked) {
                                    setReviewData({ 
                                      ...reviewData, 
                                      nextDepartments: [...current, dept.value] 
                                    });
                                  } else {
                                    setReviewData({ 
                                      ...reviewData, 
                                      nextDepartments: current.filter(d => d !== dept.value) 
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <span className="text-sm font-medium">{dept.label}</span>
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
                        shopFloorNextDepartments.find(dept => dept.value === d)?.label
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
                  shopFloorNextDepartments.find(dept => dept.value === d)?.label
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
