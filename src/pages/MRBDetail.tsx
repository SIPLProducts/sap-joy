import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShoppingCart, Settings, CheckCircle, Database, History, Loader2 } from 'lucide-react';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getStatusDisplayName, getStatusColor, getSLAColor, getRoleDisplayName } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { WorkflowProgressIndicator } from '@/components/mrb/WorkflowProgressIndicator';
import type { Database as DB } from '@/integrations/supabase/types';

type MRBRecord = DB['public']['Tables']['mrb_records']['Row'];
type ApprovalHistory = DB['public']['Tables']['mrb_approval_history']['Row'];

export default function MRBDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getMRBById, updateMRBStatus, updateMRB, getApprovalHistory } = useMRBDatabase();
  const { canEdit } = useRole();
  const { userRole, profile } = useAuth();
  const { toast } = useToast();

  const [mrb, setMRB] = useState<MRBRecord | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [poItemNumber, setPOItemNumber] = useState<string | null>(null);

  // Form fields for editing
  const [qualityRemarks, setQualityRemarks] = useState('');
  const [purchaseRemarks, setPurchaseRemarks] = useState('');
  const [engineeringRemarks, setEngineeringRemarks] = useState('');
  const [finalRemarks, setFinalRemarks] = useState('');
  const [engineeringDecision, setEngineeringDecision] = useState('');

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
        setQualityRemarks(mrbData.quality_remarks || '');
        setPurchaseRemarks(mrbData.purchase_remarks || '');
        setEngineeringRemarks(mrbData.engineering_remarks || '');
        setFinalRemarks(mrbData.final_remarks || '');
        setEngineeringDecision(mrbData.engineering_decision || '');
        
        // Fetch PO item number from inward_inspection_lots if inspection_lot is available
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

  const handleOpenApprovalDialog = (action: 'approve' | 'reject', stage: string) => {
    setApprovalAction(action);
    setCurrentStage(stage);
    setRemarks('');
    setShowApprovalDialog(true);
  };

  const handleApprove = async () => {
    if (!mrb || !approvalAction) return;
    
    setIsSubmitting(true);
    
    try {
      let newStatus = mrb.status;
      let additionalUpdates: Partial<MRBRecord> = {};
      
      if (approvalAction === 'reject') {
        newStatus = 'rejected';
        additionalUpdates = { final_remarks: remarks };
      } else {
        // Determine next status based on current stage
        switch (currentStage) {
          case 'Quality':
            newStatus = 'purchase_review';
            additionalUpdates = { 
              quality_remarks: qualityRemarks,
              quality_decision: 'accept',
            };
            break;
          case 'Purchase':
            newStatus = 'engineering_review';
            additionalUpdates = { purchase_remarks: purchaseRemarks };
            break;
          case 'Engineering':
            newStatus = 'final_approval';
            additionalUpdates = { 
              engineering_remarks: engineeringRemarks,
              engineering_decision: engineeringDecision as any || 'use_as_is',
            };
            break;
          case 'Final':
            newStatus = 'approved';
            additionalUpdates = { 
              final_remarks: finalRemarks,
              final_decision: 'approved',
              closure_status: 'completed',
              closed_at: new Date().toISOString(),
            };
            break;
        }
      }
      
      const success = await updateMRBStatus(
        mrb.id,
        newStatus,
        approvalAction === 'approve' ? 'approved' : 'rejected',
        remarks || `${currentStage} ${approvalAction}d by ${profile?.full_name || 'User'}`,
        additionalUpdates as any
      );
      
      if (success) {
        toast({
          title: 'Success',
          description: `MRB ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully`,
        });
        
        // Reload MRB data
        const updatedMRB = await getMRBById(mrb.id);
        const updatedHistory = await getApprovalHistory(mrb.id);
        if (updatedMRB) setMRB(updatedMRB);
        setApprovalHistory(updatedHistory);
      }
    } catch (error) {
      console.error('Error processing approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to process approval',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setShowApprovalDialog(false);
    }
  };

  const handleSaveRemarks = async (stage: string) => {
    if (!mrb) return;
    
    let updates: Partial<MRBRecord> = {};
    
    switch (stage) {
      case 'quality':
        updates = { quality_remarks: qualityRemarks };
        break;
      case 'purchase':
        updates = { purchase_remarks: purchaseRemarks };
        break;
      case 'engineering':
        updates = { 
          engineering_remarks: engineeringRemarks,
          engineering_decision: engineeringDecision as any,
        };
        break;
      case 'final':
        updates = { final_remarks: finalRemarks };
        break;
    }
    
    const success = await updateMRB(mrb.id, updates as any);
    if (success) {
      toast({
        title: 'Saved',
        description: 'Remarks saved successfully',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading MRB details...</p>
        </div>
      </div>
    );
  }

  if (!mrb) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">MRB not found</p>
        <Button asChild className="mt-4">
          <Link to="/worklist">Back to Worklist</Link>
        </Button>
      </div>
    );
  }

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
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/worklist"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{mrb.mrb_number}</h1>
            <p className="text-muted-foreground">{mrb.material_description}</p>
          </div>
          <Badge className={getStatusColor(mrb.status)}>{getStatusDisplayName(mrb.status)}</Badge>
          <Badge className={getSLAColor(mrb.sla_status || 'green')}>{mrb.pending_days || 0} days pending</Badge>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Workflow Progress Indicator */}
        <WorkflowProgressIndicator 
          currentStatus={mrb.status} 
          pendingWith={mrb.pending_with}
        />

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Material</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.material_number}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.vendor_name || 'N/A'}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Plant</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.plant}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">PO / Line Item</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.po_number || 'N/A'}{poItemNumber ? ` / ${poItemNumber}` : ''}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending With</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.pending_with ? getRoleDisplayName(mrb.pending_with as any) : 'N/A'}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="quality" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="quality" className="gap-2"><FileText className="h-4 w-4" />Quality</TabsTrigger>
            <TabsTrigger value="purchase" className="gap-2"><ShoppingCart className="h-4 w-4" />Purchase</TabsTrigger>
            <TabsTrigger value="engineering" className="gap-2"><Settings className="h-4 w-4" />Engineering</TabsTrigger>
            <TabsTrigger value="final" className="gap-2"><CheckCircle className="h-4 w-4" />Final</TabsTrigger>
            <TabsTrigger value="sap" className="gap-2"><Database className="h-4 w-4" />SAP</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />History</TabsTrigger>
          </TabsList>

          <TabsContent value="quality">
            <Card>
              <CardHeader><CardTitle>Quality Inspection (Stage 1)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Quality Decision</Label><p className="mt-1 font-medium capitalize">{mrb.quality_decision || 'Pending'}</p></div>
                  <div><Label>Defect Category</Label><p className="mt-1 font-medium capitalize">{mrb.defect_category || '-'}</p></div>
                  <div><Label>Defect Code</Label><p className="mt-1 font-medium">{mrb.defect_code || '-'}</p></div>
                  <div><Label>Total Quantity</Label><p className="mt-1 font-medium">{mrb.total_quantity} {mrb.uom}</p></div>
                </div>
                <div><Label>Defect Description</Label><p className="mt-1">{mrb.defect_description || '-'}</p></div>
                <div>
                  <Label>Quality Remarks</Label>
                  <Textarea 
                    value={qualityRemarks} 
                    onChange={(e) => setQualityRemarks(e.target.value)}
                    readOnly={!canEdit('quality') || mrb.status !== 'quality_review'} 
                    placeholder="Enter quality remarks..." 
                  />
                </div>
                {canEdit('quality') && mrb.status === 'quality_review' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveRemarks('quality')} variant="outline">Save Remarks</Button>
                    <Button onClick={() => handleOpenApprovalDialog('approve', 'Quality')}>Approve & Forward</Button>
                    <Button variant="destructive" onClick={() => handleOpenApprovalDialog('reject', 'Quality')}>Reject</Button>
                  </div>
                )}
                {mrb.quality_approved_at && (
                  <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    Approved on {formatDate(mrb.quality_approved_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchase">
            <Card>
              <CardHeader><CardTitle>Purchase/SCM Review (Stage 2)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Vendor Responsibility</Label><p className="mt-1">{mrb.vendor_responsibility || '-'}</p></div>
                  <div><Label>Purchase Action</Label><p className="mt-1">{mrb.purchase_action || '-'}</p></div>
                  <div><Label>Replacement Required</Label><p className="mt-1">{mrb.vendor_replacement_required ? 'Yes' : 'No'}</p></div>
                  <div><Label>Expected Date</Label><p className="mt-1">{mrb.expected_replacement_date || '-'}</p></div>
                </div>
                <div>
                  <Label>Purchase Remarks</Label>
                  <Textarea 
                    value={purchaseRemarks} 
                    onChange={(e) => setPurchaseRemarks(e.target.value)}
                    readOnly={!canEdit('purchase') || mrb.status !== 'purchase_review'} 
                    placeholder="Enter purchase remarks..." 
                  />
                </div>
                {canEdit('purchase') && mrb.status === 'purchase_review' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveRemarks('purchase')} variant="outline">Save Remarks</Button>
                    <Button onClick={() => handleOpenApprovalDialog('approve', 'Purchase')}>Approve & Forward</Button>
                    <Button variant="destructive" onClick={() => handleOpenApprovalDialog('reject', 'Purchase')}>Reject</Button>
                  </div>
                )}
                {mrb.purchase_approved_at && (
                  <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    Approved on {formatDate(mrb.purchase_approved_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engineering">
            <Card>
              <CardHeader><CardTitle>Engineering Review (Stage 3)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Engineering Decision</Label>
                    {canEdit('engineering') && mrb.status === 'engineering_review' ? (
                      <Select value={engineeringDecision} onValueChange={setEngineeringDecision}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select decision" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="use_as_is">Use As Is</SelectItem>
                          <SelectItem value="use_with_deviation">Use with Deviation</SelectItem>
                          <SelectItem value="rework_required">Rework Required</SelectItem>
                          <SelectItem value="return_to_vendor">Return to Vendor</SelectItem>
                          <SelectItem value="scrap_material">Scrap Material</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="mt-1 capitalize">{mrb.engineering_decision?.replace(/_/g, ' ') || 'Pending'}</p>
                    )}
                  </div>
                  <div><Label>Technical Reference</Label><p className="mt-1">{mrb.technical_reference_number || '-'}</p></div>
                </div>
                <div>
                  <Label>Engineering Remarks</Label>
                  <Textarea 
                    value={engineeringRemarks} 
                    onChange={(e) => setEngineeringRemarks(e.target.value)}
                    readOnly={!canEdit('engineering') || mrb.status !== 'engineering_review'} 
                    placeholder="Enter engineering remarks..." 
                  />
                </div>
                {canEdit('engineering') && mrb.status === 'engineering_review' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveRemarks('engineering')} variant="outline">Save Remarks</Button>
                    <Button onClick={() => handleOpenApprovalDialog('approve', 'Engineering')}>Approve & Forward</Button>
                    <Button variant="destructive" onClick={() => handleOpenApprovalDialog('reject', 'Engineering')}>Reject</Button>
                  </div>
                )}
                {mrb.engineering_approved_at && (
                  <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    Approved on {formatDate(mrb.engineering_approved_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="final">
            <Card>
              <CardHeader><CardTitle>Final Approval (Stage 4)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Final Decision</Label><p className="mt-1 capitalize">{mrb.final_decision || 'Pending'}</p></div>
                  <div><Label>Deviation Number</Label><p className="mt-1">{mrb.deviation_approval_number || '-'}</p></div>
                  <div><Label>Approved Qty</Label><p className="mt-1">{mrb.final_approved_quantity || '-'}</p></div>
                  <div><Label>Rejected Qty</Label><p className="mt-1">{mrb.final_rejected_quantity || '-'}</p></div>
                </div>
                <div>
                  <Label>Final Remarks</Label>
                  <Textarea 
                    value={finalRemarks} 
                    onChange={(e) => setFinalRemarks(e.target.value)}
                    readOnly={!canEdit('final_approval') || mrb.status !== 'final_approval'} 
                    placeholder="Enter final remarks..." 
                  />
                </div>
                {canEdit('final_approval') && mrb.status === 'final_approval' && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveRemarks('final')} variant="outline">Save Remarks</Button>
                    <Button onClick={() => handleOpenApprovalDialog('approve', 'Final')}>Final Approve</Button>
                    <Button variant="destructive" onClick={() => handleOpenApprovalDialog('reject', 'Final')}>Reject</Button>
                  </div>
                )}
                {mrb.final_approved_at && (
                  <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    {mrb.final_decision === 'rejected' ? 'Rejected' : 'Approved'} on {formatDate(mrb.final_approved_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sap">
            <Card>
              <CardHeader><CardTitle>SAP Posting & Closure</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>SAP Stock Status</Label><p className="mt-1 capitalize">{mrb.sap_stock_update_status || 'Pending'}</p></div>
                  <div><Label>Return Delivery</Label><p className="mt-1">{mrb.return_delivery_number || '-'}</p></div>
                  <div><Label>Rework Order</Label><p className="mt-1">{mrb.rework_order_number || '-'}</p></div>
                  <div><Label>Scrap Document</Label><p className="mt-1">{mrb.scrap_document_number || '-'}</p></div>
                  <div><Label>Closure Status</Label><p className="mt-1 capitalize">{mrb.closure_status || 'Open'}</p></div>
                  <div><Label>Closed At</Label><p className="mt-1">{formatDate(mrb.closed_at)}</p></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
              <CardContent>
                {approvalHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No approval history yet</p>
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.stage}</p>
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.action}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {getRoleDisplayName(item.performed_by_role as any)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(item.performed_at)}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' 
                ? `This will approve the ${currentStage} stage and forward the MRB to the next stage.`
                : `This will reject the MRB. This action cannot be easily undone.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any additional remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={isSubmitting}
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {approvalAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
