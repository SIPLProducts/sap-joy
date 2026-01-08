import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShoppingCart, Settings, CheckCircle, Database } from 'lucide-react';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getStatusDisplayName, getStatusColor, getSLAColor, getRoleDisplayName } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

export default function MRBDetail() {
  const { id } = useParams<{ id: string }>();
  const { getMRBById, updateMRB } = useMRB();
  const { currentRole, canEdit } = useRole();
  const { toast } = useToast();

  const mrb = getMRBById(id || '');

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

  const handleApprove = (stage: string) => {
    toast({
      title: "Action Recorded",
      description: `${stage} approval has been recorded successfully.`,
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
            <h1 className="text-2xl font-bold">{mrb.mrbNumber}</h1>
            <p className="text-muted-foreground">{mrb.materialDescription}</p>
          </div>
          <Badge className={getStatusColor(mrb.status)}>{getStatusDisplayName(mrb.status)}</Badge>
          <Badge className={getSLAColor(mrb.slaStatus)}>{mrb.pendingDays} days pending</Badge>
        </div>
      </div>

      <div className="p-6 space-y-6">

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Material</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.materialNumber}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendor</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.vendorName}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Plant</CardTitle></CardHeader><CardContent><p className="font-medium">{mrb.plant}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending With</CardTitle></CardHeader><CardContent><p className="font-medium">{getRoleDisplayName(mrb.pendingWith)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="quality" className="gap-2"><FileText className="h-4 w-4" />Quality</TabsTrigger>
          <TabsTrigger value="purchase" className="gap-2"><ShoppingCart className="h-4 w-4" />Purchase</TabsTrigger>
          <TabsTrigger value="engineering" className="gap-2"><Settings className="h-4 w-4" />Engineering</TabsTrigger>
          <TabsTrigger value="final" className="gap-2"><CheckCircle className="h-4 w-4" />Final</TabsTrigger>
          <TabsTrigger value="sap" className="gap-2"><Database className="h-4 w-4" />SAP</TabsTrigger>
        </TabsList>

        <TabsContent value="quality">
          <Card>
            <CardHeader><CardTitle>Quality Inspection (Stage 1)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Quality Decision</Label><p className="mt-1 font-medium capitalize">{mrb.qualityDecision || 'Pending'}</p></div>
                <div><Label>Defect Category</Label><p className="mt-1 font-medium capitalize">{mrb.defectCategory || '-'}</p></div>
                <div><Label>Defect Code</Label><p className="mt-1 font-medium">{mrb.defectCode || '-'}</p></div>
                <div><Label>Total Quantity</Label><p className="mt-1 font-medium">{mrb.totalQuantity} {mrb.uom}</p></div>
              </div>
              <div><Label>Defect Description</Label><p className="mt-1">{mrb.defectDescription || '-'}</p></div>
              <div><Label>Quality Remarks</Label><Textarea value={mrb.qualityRemarks || ''} readOnly={!canEdit('quality')} placeholder="Enter quality remarks..." /></div>
              {canEdit('quality') && mrb.status === 'quality_review' && (
                <div className="flex gap-2">
                  <Button onClick={() => handleApprove('Quality')}>Approve</Button>
                  <Button variant="destructive">Reject</Button>
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
                <div><Label>Vendor Responsibility</Label><p className="mt-1">{mrb.vendorResponsibility || '-'}</p></div>
                <div><Label>Purchase Action</Label><p className="mt-1">{mrb.purchaseAction || '-'}</p></div>
                <div><Label>Replacement Required</Label><p className="mt-1">{mrb.vendorReplacementRequired ? 'Yes' : 'No'}</p></div>
                <div><Label>Expected Date</Label><p className="mt-1">{mrb.expectedReplacementDate || '-'}</p></div>
              </div>
              <div><Label>Purchase Remarks</Label><Textarea value={mrb.purchaseRemarks || ''} readOnly={!canEdit('purchase')} placeholder="Enter purchase remarks..." /></div>
              {canEdit('purchase') && mrb.status === 'purchase_review' && (
                <Button onClick={() => handleApprove('Purchase')}>Approve & Forward</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engineering">
          <Card>
            <CardHeader><CardTitle>Engineering Review (Stage 3)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Engineering Decision</Label><p className="mt-1 capitalize">{mrb.engineeringDecision?.replace(/_/g, ' ') || 'Pending'}</p></div>
                <div><Label>Technical Reference</Label><p className="mt-1">{mrb.technicalReferenceNumber || '-'}</p></div>
              </div>
              <div><Label>Engineering Remarks</Label><Textarea value={mrb.engineeringRemarks || ''} readOnly={!canEdit('engineering')} placeholder="Enter engineering remarks..." /></div>
              {canEdit('engineering') && mrb.status === 'engineering_review' && (
                <Button onClick={() => handleApprove('Engineering')}>Approve & Forward</Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="final">
          <Card>
            <CardHeader><CardTitle>Final Approval (Stage 4)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Final Decision</Label><p className="mt-1 capitalize">{mrb.finalDecision || 'Pending'}</p></div>
                <div><Label>Deviation Number</Label><p className="mt-1">{mrb.deviationApprovalNumber || '-'}</p></div>
                <div><Label>Approved Qty</Label><p className="mt-1">{mrb.finalApprovedQuantity || '-'}</p></div>
                <div><Label>Rejected Qty</Label><p className="mt-1">{mrb.finalRejectedQuantity || '-'}</p></div>
              </div>
              <div><Label>Final Remarks</Label><Textarea value={mrb.finalRemarks || ''} readOnly={!canEdit('final_approval')} placeholder="Enter final remarks..." /></div>
              {canEdit('final_approval') && mrb.status === 'final_approval' && (
                <div className="flex gap-2">
                  <Button onClick={() => handleApprove('Final')}>Final Approve</Button>
                  <Button variant="destructive">Reject</Button>
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
                <div><Label>SAP Stock Status</Label><p className="mt-1 capitalize">{mrb.sapStockUpdateStatus || 'Pending'}</p></div>
                <div><Label>Return Delivery</Label><p className="mt-1">{mrb.returnDeliveryNumber || '-'}</p></div>
                <div><Label>Rework Order</Label><p className="mt-1">{mrb.reworkOrderNumber || '-'}</p></div>
                <div><Label>Scrap Document</Label><p className="mt-1">{mrb.scrapDocumentNumber || '-'}</p></div>
                <div><Label>Closure Status</Label><p className="mt-1 capitalize">{mrb.closureStatus || 'Open'}</p></div>
                <div><Label>Closed At</Label><p className="mt-1">{mrb.closedAt ? new Date(mrb.closedAt).toLocaleDateString() : '-'}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
