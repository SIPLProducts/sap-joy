import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
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
  Printer,
} from 'lucide-react';
import { AvailableStockRecord, shopFloorBlockReasons, shopFloorNextDepartments, shopFloorAttachmentCategories } from '@/data/shopFloorStockData';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

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
  const { createMRB, getNextMRBNumber } = useMRBDatabase();
  const { currentRole } = useRole();
  const { user } = useAuth();
  
  const stockItem = location.state?.stockItem as AvailableStockRecord | undefined;

  // Form states
  const [blockQuantity, setBlockQuantity] = useState<number>(0);
  const [productionOrder, setProductionOrder] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [nextReviewDepartments, setNextReviewDepartments] = useState<AppRole[]>([]);
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
      const mrbNumber = await getNextMRBNumber();

      // Create MRB record using database hook
      const mrbResult = await createMRB({
        mrb_number: mrbNumber,
        status: 'quality_review',
        source: 'shop_floor',
        created_by: user?.id || 'shop_floor_user',
        pending_with: nextReviewDepartments[0] || 'quality',
        pending_days: 0,
        sla_status: 'green',
        escalation_level: 'none',
        material_number: stockItem.materialCode,
        material_description: stockItem.materialDescription,
        plant: stockItem.plant,
        vendor_name: 'N/A (Shop Floor)',
        total_quantity: blockQuantity,
        accepted_quantity: 0,
        rejected_quantity: 0,
        blocked_quantity: blockQuantity,
        uom: stockItem.uom,
        production_order_number: productionOrder || `PRD-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`,
        issued_quantity: blockQuantity,
        issue_identified_by: user?.email || 'Shop Floor User',
        issue_identified_date: new Date().toISOString(),
        issue_description: `${blockReason}: ${issueDescription}`,
        impact_on_production: 'Material blocked for review',
        immediate_block_required: true,
      });

      if (mrbResult) {
        setCreatedMRBNumber(mrbNumber);
        setIsSubmitted(true);
        toast.success(`MRB ${mrbNumber} created successfully!`);
      } else {
        throw new Error('Failed to create MRB');
      }

    } catch (error) {
      console.error('Error creating MRB:', error);
      toast.error('Failed to create MRB. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintConfirmation = () => {
    const printContent = `
      <html>
        <head>
          <title>MRB Confirmation - ${createdMRBNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #1e40af; }
            .title { font-size: 18px; margin-top: 10px; color: #333; }
            .mrb-number { font-size: 28px; font-weight: bold; color: #16a34a; margin: 20px 0; }
            .section { margin-bottom: 25px; }
            .section-title { font-weight: bold; font-size: 14px; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .info-item { }
            .info-label { font-size: 12px; color: #888; }
            .info-value { font-size: 14px; font-weight: 500; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center; }
            .status { background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 4px; display: inline-block; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">HBL Power Systems</div>
            <div class="title">Material Blocking Confirmation</div>
          </div>
          
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #666;">MRB Number</div>
            <div class="mrb-number">${createdMRBNumber}</div>
            <div class="status">✓ Material Blocked Successfully</div>
          </div>
          
          <div class="section" style="margin-top: 30px;">
            <div class="section-title">Stock Information</div>
            <div class="info-grid">
              <div class="info-item"><div class="info-label">Plant</div><div class="info-value">${stockItem.plant}</div></div>
              <div class="info-item"><div class="info-label">Material Code</div><div class="info-value">${stockItem.materialCode}</div></div>
              <div class="info-item"><div class="info-label">Material Description</div><div class="info-value">${stockItem.materialDescription}</div></div>
              <div class="info-item"><div class="info-label">Batch</div><div class="info-value">${stockItem.batch}</div></div>
              <div class="info-item"><div class="info-label">Storage Location</div><div class="info-value">${stockItem.storageLocation}</div></div>
              <div class="info-item"><div class="info-label">Production Order</div><div class="info-value">${productionOrder || 'N/A'}</div></div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Blocking Details</div>
            <div class="info-grid">
              <div class="info-item"><div class="info-label">Block Quantity</div><div class="info-value">${blockQuantity} ${stockItem.uom}</div></div>
              <div class="info-item"><div class="info-label">Block Reason</div><div class="info-value">${blockReason}</div></div>
              <div class="info-item" style="grid-column: span 2;"><div class="info-label">Issue Description</div><div class="info-value">${issueDescription}</div></div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Routing Information</div>
            <div class="info-grid">
              <div class="info-item"><div class="info-label">Routed To</div><div class="info-value">${nextReviewDepartments.map(d => shopFloorNextDepartments.find(dept => dept.value === d)?.label).join(', ')}</div></div>
              <div class="info-item"><div class="info-label">Created Date</div><div class="info-value">${format(new Date(), 'dd MMM yyyy HH:mm')}</div></div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is a system-generated document. Email notifications have been sent to respective departments.</p>
            <p>Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}</p>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Success screen after submission
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 sm:p-6">
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
            <div className="text-sm text-muted-foreground space-y-1 text-left bg-muted/30 rounded-lg p-4">
              <p>• <strong>Material:</strong> {stockItem.materialCode}</p>
              <p>• <strong>Block Quantity:</strong> {blockQuantity} {stockItem.uom}</p>
              {productionOrder && <p>• <strong>Production Order:</strong> {productionOrder}</p>}
              <p>• <strong>Routed to:</strong> {nextReviewDepartments.map(d => shopFloorNextDepartments.find(dept => dept.value === d)?.label).join(', ')}</p>
              <p>• <strong>Email notification:</strong> Sent</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button variant="outline" onClick={handlePrintConfirmation} className="gap-2">
                <Printer className="w-4 h-4" />
                Print Confirmation
              </Button>
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
                <Input value={`${stockItem.availableQuantity} ${stockItem.uom}`} disabled className="bg-muted h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PART 4: Blocking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Blocking Details
            </CardTitle>
            <CardDescription>Specify the quantity and reason for blocking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blockQuantity">Block Quantity *</Label>
                <Input
                  id="blockQuantity"
                  type="number"
                  min={1}
                  max={stockItem.availableQuantity}
                  value={blockQuantity || ''}
                  onChange={(e) => setBlockQuantity(Number(e.target.value))}
                  placeholder={`Max: ${stockItem.availableQuantity}`}
                  className={errors.blockQuantity ? 'border-destructive' : ''}
                />
                {errors.blockQuantity && (
                  <p className="text-xs text-destructive">{errors.blockQuantity}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionOrder">Production Order (Optional)</Label>
                <Input
                  id="productionOrder"
                  value={productionOrder}
                  onChange={(e) => setProductionOrder(e.target.value)}
                  placeholder="e.g., PRD-2024-1234"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockReason">Block Reason *</Label>
              <Select value={blockReason} onValueChange={setBlockReason}>
                <SelectTrigger className={errors.blockReason ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select block reason" />
                </SelectTrigger>
                <SelectContent>
                  {shopFloorBlockReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.blockReason && (
                <p className="text-xs text-destructive">{errors.blockReason}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="issueDescription">Issue Description *</Label>
              <Textarea
                id="issueDescription"
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={4}
                className={errors.issueDescription ? 'border-destructive' : ''}
              />
              {errors.issueDescription && (
                <p className="text-xs text-destructive">{errors.issueDescription}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Next Review Departments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Route for Review
            </CardTitle>
            <CardDescription>Select departments to receive MRB for review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shopFloorNextDepartments.map((dept) => (
                <label
                  key={dept.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    nextReviewDepartments.includes(dept.value as AppRole)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={nextReviewDepartments.includes(dept.value as AppRole)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNextReviewDepartments([...nextReviewDepartments, dept.value as AppRole]);
                      } else {
                        setNextReviewDepartments(nextReviewDepartments.filter((d) => d !== dept.value));
                      }
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <span className="font-medium">{dept.label}</span>
                  </div>
                </label>
              ))}
              {errors.nextReviewDepartment && (
                <p className="text-xs text-destructive">{errors.nextReviewDepartment}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Attachments
            </CardTitle>
            <CardDescription>Upload images and documents related to the issue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shopFloorAttachmentCategories.map((cat) => (
                <Button
                  key={cat.value}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => handleFileUpload(cat.value)}
                >
                  {cat.value.includes('image') ? (
                    <Image className="w-6 h-6 text-muted-foreground" />
                  ) : cat.value.includes('note') ? (
                    <StickyNote className="w-6 h-6 text-muted-foreground" />
                  ) : (
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  )}
                  <span className="text-sm">{cat.label}</span>
                </Button>
              ))}
            </div>
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>Uploaded Files</Label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att) => (
                    <Badge key={att.id} variant="secondary" className="gap-1 pr-1">
                      {att.name}
                      <button
                        onClick={() => removeAttachment(att.id)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/shop-floor/stock-selection')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating MRB...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Create MRB & Route
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}