import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Upload, FileText, Trash2, History, Mail, Paperclip, CheckCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Attachment } from '@/types/mrb';
import { DepartmentReviewData, NextReviewDepartment } from '@/types/inwardReport';
import { nextReviewDepartments } from '@/data/inwardReportData';
import { getStatusDisplayName, getStatusColor, mockUsers } from '@/data/mockData';

export default function InwardMRBDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { getInwardMRBById, addDepartmentReview, addEmailLog } = useInwardMRB();
  const { currentRole } = useRole();
  
  const mrb = getInwardMRBById(id || '');

  const [reviewData, setReviewData] = useState<DepartmentReviewData>({
    reviewComments: '',
    action: '',
    forwardToNext: false,
    nextDepartment: undefined,
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  if (!mrb) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">MRB Not Found</h2>
          <Button onClick={() => navigate('/inward/worklist')}>
            Go to Worklist
          </Button>
        </div>
      </div>
    );
  }

  const canReview = mrb.pendingWith === currentRole || currentRole === 'plant_head';
  const currentUser = mockUsers.find(u => u.role === currentRole);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: Attachment[] = Array.from(files).map((file) => ({
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: currentUser?.name || 'User',
        uploadedAt: new Date().toISOString(),
        category: 'other',
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
    e.target.value = '';
  };

  const removeAttachment = (attId: string) => {
    setAttachments(attachments.filter((att) => att.id !== attId));
  };

  const handleSubmitReview = () => {
    if (!reviewData.action) {
      toast({
        title: 'Validation Error',
        description: 'Please select an action',
        variant: 'destructive',
      });
      return;
    }

    if (reviewData.forwardToNext && !reviewData.nextDepartment) {
      toast({
        title: 'Validation Error',
        description: 'Please select the next department to forward to',
        variant: 'destructive',
      });
      return;
    }

    addDepartmentReview(mrb.id, reviewData, attachments, currentUser?.name || 'User');

    // Add email log
    addEmailLog({
      id: `EMAIL-${Date.now()}`,
      mrbId: mrb.id,
      mrbNumber: mrb.mrbNumber,
      subject: `MRB ${mrb.mrbNumber} - ${getActionLabel(reviewData.action)}`,
      recipients: reviewData.forwardToNext && reviewData.nextDepartment 
        ? [`${reviewData.nextDepartment}@company.com`]
        : ['quality@company.com'],
      template: 'engineering_decision',
      sentAt: new Date().toISOString(),
      sentBy: currentUser?.name || 'User',
      status: 'sent',
    });

    toast({
      title: 'Review Submitted',
      description: `Your review has been submitted successfully.`,
    });

    navigate('/inward/worklist');
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

  const formatDate = (dateString: string) => {
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
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/inward/worklist')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-foreground">
                    {mrb.mrbNumber}
                  </h1>
                  <Badge className={getStatusColor(mrb.status)}>
                    {getStatusDisplayName(mrb.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Created by {mrb.createdBy} on {formatDate(mrb.createdAt)}
                </p>
              </div>
            </div>
            {canReview && (
              <Button onClick={handleSubmitReview}>
                <Send className="h-4 w-4 mr-2" />
                Submit Review
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* MRB Details (Read-Only) */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold">MRB Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Inspection Lot</Label>
                <p className="font-medium">{mrb.inspectionLot}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Material Code</Label>
                <p className="font-medium font-mono">{mrb.materialNumber}</p>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-muted-foreground text-xs">Material Description</Label>
                <p className="font-medium">{mrb.materialDescription}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Plant</Label>
                <p className="font-medium">{mrb.plant}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Vendor</Label>
                <p className="font-medium">{mrb.vendorName}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Blocked Quantity</Label>
                <p className="font-medium text-destructive">{mrb.blockedQuantity} {mrb.uom}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">PO Number</Label>
                <p className="font-medium font-mono">{mrb.poNumber}</p>
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
                <p className="font-medium capitalize">{mrb.qualityDecision?.replace(/_/g, ' ')}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Inspector</Label>
                <p className="font-medium">{mrb.qualityApprovedBy}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Inspection Date</Label>
                <p className="font-medium">{mrb.qualityApprovedAt ? formatDate(mrb.qualityApprovedAt) : '-'}</p>
              </div>
              <div className="space-y-1 lg:col-span-3">
                <Label className="text-muted-foreground text-xs">Quality Comments</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{mrb.qualityRemarks || 'No comments'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {mrb.attachments.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border bg-muted/30 py-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments ({mrb.attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mrb.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{att.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval History */}
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4" />
              Approval History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {mrb.approvalHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No history yet</p>
            ) : (
              <div className="space-y-4">
                {mrb.approvalHistory.map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                      {index < mrb.approvalHistory.length - 1 && (
                        <div className="w-0.5 h-full bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.stage}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.action}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.performedBy} • {formatDate(item.performedAt)}
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
        {canReview && (
          <>
            <Separator />
            <Card className="border-border shadow-sm border-primary/20">
              <CardHeader className="border-b border-border bg-primary/5 py-3">
                <CardTitle className="text-base font-semibold">
                  Your Review ({currentRole.charAt(0).toUpperCase() + currentRole.slice(1).replace('_', ' ')})
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
                      onValueChange={(value) => setReviewData({ ...reviewData, action: value as DepartmentReviewData['action'] })}
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
                    <div className="pl-6">
                      <Select
                        value={reviewData.nextDepartment || ''}
                        onValueChange={(value) => 
                          setReviewData({ ...reviewData, nextDepartment: value as NextReviewDepartment })
                        }
                      >
                        <SelectTrigger className="w-[250px] bg-background">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {nextReviewDepartments
                            .filter(d => d.value !== currentRole)
                            .map((dept) => (
                              <SelectItem key={dept.value} value={dept.value}>
                                {dept.label}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="space-y-3">
                  <Label>Upload Documents</Label>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="relative">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded border border-border"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{att.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAttachment(att.id)}
                            className="h-6 w-6"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
