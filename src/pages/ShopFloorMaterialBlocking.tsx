import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Factory,
  Package,
  AlertTriangle,
  Upload,
  Send,
  ArrowLeft,
  CheckCircle,
  FileText,
  Image,
  StickyNote,
  X,
  Loader2,
} from 'lucide-react';
import { AvailableStockRecord, shopFloorBlockReasons, shopFloorNextDepartments, shopFloorAttachmentCategories } from '@/data/shopFloorStockData';
import { MRBRecord, Attachment, UserRole } from '@/types/mrb';
import { mockUsers } from '@/data/mockData';

interface AttachmentUpload {
  id: string;
  name: string;
  category: string;
  size: number;
  type: string;
}

export default function ShopFloorMaterialBlocking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createMRB, addEmailLog, getNextMRBNumber } = useMRB();
  const { currentRole } = useRole();
  
  const stockItem = location.state?.stockItem as AvailableStockRecord | undefined;

  // Form states
  const [blockQuantity, setBlockQuantity] = useState<number>(0);
  const [blockReason, setBlockReason] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [nextReviewDepartments, setNextReviewDepartments] = useState<UserRole[]>([]);
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [createdMRBNumber, setCreatedMRBNumber] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if no stock item selected
  useEffect(() => {
    if (!stockItem) {
      toast.error('No stock item selected. Please select from available stock.');
      navigate('/shop-floor/stock-selection');
    }
  }, [stockItem, navigate]);

  // Check if user is shop floor
  useEffect(() => {
    if (currentRole !== 'shop_floor') {
      toast.error('Only Shop Floor users can initiate material blocking.');
      navigate('/');
    }
  }, [currentRole, navigate]);

  if (!stockItem) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (blockQuantity <= 0) {
      newErrors.blockQuantity = 'Block quantity must be greater than 0';
    }
    if (blockQuantity > stockItem.availableQuantity) {
      newErrors.blockQuantity = `Block quantity cannot exceed available quantity (${stockItem.availableQuantity})`;
    }
    if (!blockReason) {
      newErrors.blockReason = 'Block reason is required';
    }
    if (!issueDescription.trim()) {
      newErrors.issueDescription = 'Issue description is required';
    }
    if (nextReviewDepartments.length === 0) {
      newErrors.nextReviewDepartment = 'At least one review department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = (category: string) => {
    // Simulate file upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = category === 'shop_floor_images' || category === 'failure_evidence' 
      ? 'image/*' 
      : '.pdf,.doc,.docx,.txt';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const upload: AttachmentUpload = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          category,
          size: file.size,
          type: file.type,
        };
        setAttachments(prev => [...prev, upload]);
        toast.success(`${file.name} uploaded successfully`);
      }
    };
    input.click();
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate MRB number
      const mrbNumber = getNextMRBNumber();
      const now = new Date().toISOString();
      const currentUser = mockUsers.find(u => u.role === currentRole);

      // Create MRB record
      const newMRB: MRBRecord = {
        id: Math.random().toString(36).substr(2, 9),
        mrbNumber,
        status: 'quality_review',
        source: 'shop_floor',
        createdAt: now,
        createdBy: currentUser?.name || 'Shop Floor User',
        updatedAt: now,
        pendingWith: nextReviewDepartments[0],
        pendingDays: 0,
        slaStatus: 'green',
        escalationLevel: 'none',
        materialNumber: stockItem.materialCode,
        materialDescription: stockItem.materialDescription,
        plant: stockItem.plant,
        vendor: '',
        vendorName: 'N/A (Shop Floor)',
        totalQuantity: blockQuantity,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
        blockedQuantity: blockQuantity,
        uom: stockItem.uom,
        productionOrderNumber: `PRD-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`,
        issuedQuantity: blockQuantity,
        issueIdentifiedBy: currentUser?.name || 'Shop Floor User',
        issueIdentifiedDate: now,
        issueDescription: `${blockReason}: ${issueDescription}`,
        impactOnProduction: 'Material blocked for review',
        immediateBlockRequired: true,
        attachments: attachments.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          size: a.size,
          url: '#',
          uploadedBy: currentUser?.name || 'Shop Floor User',
          uploadedAt: now,
          category: a.category as Attachment['category'],
        })),
        approvalHistory: [
          {
            id: Math.random().toString(36).substr(2, 9),
            stage: 'Shop Floor Blocking',
            action: 'forwarded',
            performedBy: currentUser?.name || 'Shop Floor User',
            performedByRole: 'shop_floor',
            performedAt: now,
            remarks: `Material blocked and forwarded to ${nextReviewDepartments.map(d => shopFloorNextDepartments.find(dept => dept.value === d)?.label).join(', ')}`,
          },
        ],
      };

      // Create MRB
      createMRB(newMRB);

      // Create email log for each selected department
      const deptLabels = nextReviewDepartments.map(d => shopFloorNextDepartments.find(dept => dept.value === d)?.label || d).join(', ');
      const recipientEmails = mockUsers.filter(u => nextReviewDepartments.includes(u.role)).map(u => u.email);
      const ccEmails = mockUsers.filter(u => u.role === 'shop_floor' || u.role === 'quality').map(u => u.email);

      addEmailLog({
        id: Math.random().toString(36).substr(2, 9),
        mrbId: newMRB.id,
        mrbNumber,
        subject: `[MRB] Shop Floor Material Blocking - ${mrbNumber}`,
        recipients: recipientEmails.length > 0 ? recipientEmails : nextReviewDepartments.map(d => `${d}@hbl.com`),
        cc: ccEmails,
        template: 'quality_to_engineering',
        sentAt: now,
        sentBy: currentUser?.name || 'Shop Floor User',
        status: 'sent',
        body: `
Material Blocking Notification

MRB Number: ${mrbNumber}
Plant: ${stockItem.plant}
Material: ${stockItem.materialCode} - ${stockItem.materialDescription}
Batch: ${stockItem.batch}
Storage Location: ${stockItem.storageLocation}
Block Quantity: ${blockQuantity} ${stockItem.uom}
Block Reason: ${blockReason}
Issue Description: ${issueDescription}

Attachments: ${attachments.length > 0 ? attachments.map(a => a.name).join(', ') : 'None'}

Please review and take appropriate action.
        `,
      });

      setCreatedMRBNumber(mrbNumber);
      setIsSubmitted(true);
      toast.success(`MRB ${mrbNumber} created successfully!`);

    } catch (error) {
      console.error('Error creating MRB:', error);
      toast.error('Failed to create MRB. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen after submission
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-6">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">MRB Created Successfully!</h2>
              <p className="text-muted-foreground">
                Material has been blocked and MRB has been routed for review.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">MRB Number</p>
              <p className="text-xl font-bold text-primary">{createdMRBNumber}</p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Material blocked: {blockQuantity} {stockItem.uom}</p>
              <p>• Routed to: {nextReviewDepartments.map(d => shopFloorNextDepartments.find(dept => dept.value === d)?.label).join(', ')}</p>
              <p>• Email notification sent</p>
            </div>
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" asChild>
                <Link to="/shop-floor/stock-selection">Block Another</Link>
              </Button>
              <Button asChild>
                <Link to="/worklist">View Worklist</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/shop-floor/stock-selection')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shrink-0">
                <Factory className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Material Blocking & MRB Creation</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">Block material and create MRB for review</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* PART 3: Read-Only Stock Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Stock Information
            </CardTitle>
            <CardDescription>Auto-populated from selected stock (Read-Only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Plant</Label>
                <Input value={stockItem.plant} disabled className="bg-muted h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Input value={stockItem.materialCode} disabled className="bg-muted h-9" />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs text-muted-foreground">Material Description</Label>
                <Input value={stockItem.materialDescription} disabled className="bg-muted h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Batch</Label>
                <Input value={stockItem.batch} disabled className="bg-muted h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Storage Location</Label>
                <Input value={stockItem.storageLocation} disabled className="bg-muted h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Available Quantity</Label>
                <Input value={`${stockItem.availableQuantity} ${stockItem.uom}`} disabled className="bg-muted h-9 font-medium" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PART 4: Material Blocking Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Material Blocking Details
            </CardTitle>
            <CardDescription>Enter blocking information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blockQty">Block Quantity *</Label>
                <Input
                  id="blockQty"
                  type="number"
                  min={1}
                  max={stockItem.availableQuantity}
                  value={blockQuantity || ''}
                  onChange={(e) => setBlockQuantity(Number(e.target.value))}
                  placeholder={`Max: ${stockItem.availableQuantity}`}
                  className={errors.blockQuantity ? 'border-destructive' : ''}
                />
                {errors.blockQuantity && (
                  <p className="text-sm text-destructive">{errors.blockQuantity}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Available: {stockItem.availableQuantity} {stockItem.uom}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockReason">Block Reason *</Label>
                <Select value={blockReason} onValueChange={setBlockReason}>
                  <SelectTrigger className={errors.blockReason ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {shopFloorBlockReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.blockReason && (
                  <p className="text-sm text-destructive">{errors.blockReason}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDesc">Issue Description *</Label>
              <Textarea
                id="issueDesc"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={4}
                className={errors.issueDescription ? 'border-destructive' : ''}
              />
              {errors.issueDescription && (
                <p className="text-sm text-destructive">{errors.issueDescription}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PART 5: Next Review Departments (Multi-Select) */}
        <Card>
          <CardHeader>
            <CardTitle>Next Review Departments</CardTitle>
            <CardDescription>Select one or more departments to review this MRB</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Review Departments *</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shopFloorNextDepartments.map((dept) => (
                  <label
                    key={dept.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      nextReviewDepartments.includes(dept.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={nextReviewDepartments.includes(dept.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNextReviewDepartments(prev => [...prev, dept.value] as UserRole[]);
                        } else {
                          setNextReviewDepartments(prev => prev.filter(d => d !== dept.value) as UserRole[]);
                        }
                      }}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">{dept.label}</span>
                  </label>
                ))}
              </div>
              {nextReviewDepartments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {nextReviewDepartments.map(d => (
                    <Badge key={d} variant="secondary" className="gap-1">
                      {shopFloorNextDepartments.find(dept => dept.value === d)?.label}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setNextReviewDepartments(prev => prev.filter(dept => dept !== d))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
              {errors.nextReviewDepartment && (
                <p className="text-sm text-destructive">{errors.nextReviewDepartment}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PART 6: Attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Attachments (Optional)
            </CardTitle>
            <CardDescription>Upload supporting documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {shopFloorAttachmentCategories.map((cat) => (
                <Button
                  key={cat.value}
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => handleFileUpload(cat.value)}
                >
                  {cat.value === 'shop_floor_images' && <Image className="w-6 h-6" />}
                  {cat.value === 'failure_evidence' && <FileText className="w-6 h-6" />}
                  {cat.value === 'operator_notes' && <StickyNote className="w-6 h-6" />}
                  <span className="text-sm">{cat.label}</span>
                </Button>
              ))}
            </div>

            {attachments.length > 0 && (
              <div className="border rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Uploaded Files ({attachments.length})</p>
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {shopFloorAttachmentCategories.find(c => c.value === att.category)?.label}
                        </Badge>
                        <span className="text-sm">{att.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(att.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PART 7: Submit */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Ready to submit?</p>
                <p className="text-sm text-muted-foreground">
                  This will block the material and create an MRB for review.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2 w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating MRB...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit & Block Material
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
