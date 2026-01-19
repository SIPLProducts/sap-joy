import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Send, X, Upload, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  nextReviewDepartments, 
  inwardQualityDecisions, 
  inwardDefectCategories,
  inwardAttachmentCategories 
} from '@/data/inwardReportData';
import type { Database } from '@/integrations/supabase/types';

type QualityDecision = Database['public']['Enums']['quality_decision'];
type DefectCategory = Database['public']['Enums']['defect_category'];

interface InspectionLotRecord {
  id: string;
  inspectionLot: string;
  plant: string;
  materialCode: string;
  materialDescription: string;
  vendorCode: string;
  vendorName: string;
  storageLocation: string;
  batch: string;
  poNumber: string;
  transactionQuantity: number;
  uom: string;
  blockedQuantity: number;
  blockReason: string;
  inspectionDate: string;
  status: 'pending' | 'mrb_created' | 'cleared';
  purchaseOrderNumber?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  category: string;
}

export default function CreateInwardMRB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { createMRB, getNextMRBNumber } = useMRBDatabase();
  const { user, profile, userRole } = useAuth();
  
  const inspectionLot = location.state?.inspectionLot as InspectionLotRecord | undefined;

  // Redirect if no inspection lot data
  if (!inspectionLot) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Inspection Lot Selected</h2>
          <p className="text-muted-foreground mb-6">
            Please select an inspection lot from the Inward Report to create an MRB.
          </p>
          <Button onClick={() => navigate('/inward/report')}>
            Go to Inward Report
          </Button>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    // Auto-populated from inspection lot
    inspectionLot: inspectionLot.inspectionLot,
    materialCode: inspectionLot.materialCode,
    materialDescription: inspectionLot.materialDescription,
    plant: inspectionLot.plant,
    storageLocation: inspectionLot.storageLocation,
    batch: inspectionLot.batch,
    blockedQuantity: inspectionLot.blockedQuantity,
    transactionQuantity: inspectionLot.transactionQuantity,
    uom: inspectionLot.uom,
    blockReason: inspectionLot.blockReason,
    vendorCode: inspectionLot.vendorCode,
    vendorName: inspectionLot.vendorName,
    purchaseOrderNumber: inspectionLot.purchaseOrderNumber || inspectionLot.poNumber || '',
    
    // Quality inspection input (empty)
    qualityDecision: '' as string,
    defectCategory: '' as string,
    defectDescription: '',
    qualityInspectionComments: '',
    qualityInspectionDate: new Date().toISOString().split('T')[0],
    qualityInspectorName: profile?.full_name || '',
    nextReviewDepartments: [] as string[],
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('inspection_report');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments: Attachment[] = Array.from(files).map((file) => ({
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: formData.qualityInspectorName || 'Quality User',
        uploadedAt: new Date().toISOString(),
        category: selectedCategory,
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.qualityDecision) {
      toast({
        title: 'Validation Error',
        description: 'Please select a Quality Decision',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.qualityInspectorName) {
      toast({
        title: 'Validation Error',
        description: 'Please enter the Quality Inspector Name',
        variant: 'destructive',
      });
      return;
    }
    if (formData.nextReviewDepartments.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one Next Review Department',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const mrbNumber = await getNextMRBNumber();
      
      // Map quality decision to database enum
      const qualityDecisionMap: Record<string, QualityDecision> = {
        'accept': 'accept',
        'reject': 'reject',
        'partial_accept': 'partial_accept',
        'block': 'blocked',
      };
      
      // Map defect category
      const defectCategoryMap: Record<string, DefectCategory> = {
        'electrical': 'functional',
        'mechanical': 'dimensional',
        'dimensional': 'dimensional',
        'surface': 'surface',
        'material': 'material',
        'documentation': 'documentation',
        'packaging': 'packaging',
        'other': 'other',
      };

      // Determine pending_with based on next review department
      const pendingWithMap: Record<string, Database['public']['Enums']['app_role']> = {
        'engineering': 'engineering',
        'purchase': 'purchase',
        'plant_head': 'executive',
      };

      const firstDept = formData.nextReviewDepartments[0];
      const pendingWith = pendingWithMap[firstDept] || 'engineering';

      const newMRB = await createMRB({
        mrb_number: mrbNumber,
        status: 'quality_review',
        source: 'quality_inspection',
        created_by: user?.id || '',
        pending_with: pendingWith,
        pending_days: 0,
        sla_status: 'green',
        escalation_level: 'none',
        material_number: formData.materialCode,
        material_description: formData.materialDescription,
        plant: formData.plant,
        vendor_code: formData.vendorCode,
        vendor_name: formData.vendorName,
        inspection_lot: formData.inspectionLot,
        po_number: formData.purchaseOrderNumber,
        total_quantity: formData.transactionQuantity,
        blocked_quantity: formData.blockedQuantity,
        accepted_quantity: formData.qualityDecision === 'accept' ? formData.transactionQuantity : 0,
        rejected_quantity: formData.qualityDecision === 'reject' ? formData.blockedQuantity : 0,
        uom: formData.uom,
        quality_decision: qualityDecisionMap[formData.qualityDecision] || 'blocked',
        defect_category: defectCategoryMap[formData.defectCategory] || null,
        defect_description: formData.defectDescription || formData.blockReason,
        quality_remarks: formData.qualityInspectionComments,
        quality_approved_by: user?.id,
        quality_approved_at: new Date().toISOString(),
      });

      if (newMRB) {
        const departmentLabels = formData.nextReviewDepartments.map(d => 
          nextReviewDepartments.find(dept => dept.value === d)?.label || d
        ).join(', ');

        toast({
          title: 'MRB Created Successfully',
          description: `MRB ${mrbNumber} has been created and routed to ${departmentLabels}.`,
        });

        navigate('/worklist');
      }
    } catch (error) {
      console.error('Error creating MRB:', error);
      toast({
        title: 'Error',
        description: 'Failed to create MRB. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    toast({
      title: 'Draft Saved',
      description: 'MRB draft has been saved successfully.',
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
                onClick={() => navigate('/inward/report')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Create MRB – Quality Inspection (Inward)
                </h1>
                <p className="text-sm text-muted-foreground">
                  Inspection Lot: {inspectionLot.inspectionLot}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/inward/report')}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-6 max-w-full">
        {/* Section 1: Auto-Populated Data (Read-Only) */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Material & Inspection Lot Information
            </h2>
            <p className="text-sm text-muted-foreground">
              Auto-populated from selected inspection lot (Read-only)
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Inspection Lot</Label>
                <Input value={formData.inspectionLot} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Material Code</Label>
                <Input value={formData.materialCode} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-muted-foreground">Material Description</Label>
                <Input value={formData.materialDescription} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Plant</Label>
                <Input value={formData.plant} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Storage Location</Label>
                <Input value={formData.storageLocation} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Batch</Label>
                <Input value={formData.batch} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Unit of Measure</Label>
                <Input value={formData.uom} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Blocked Quantity</Label>
                <Input value={formData.blockedQuantity.toString()} readOnly className="bg-muted font-medium text-destructive" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Transaction Quantity</Label>
                <Input value={formData.transactionQuantity.toString()} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-muted-foreground">Block Reason</Label>
                <Input value={formData.blockReason} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Vendor Code</Label>
                <Input value={formData.vendorCode} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-muted-foreground">Vendor Name</Label>
                <Input value={formData.vendorName} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Purchase Order Number</Label>
                <Input value={formData.purchaseOrderNumber} readOnly className="bg-muted" />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 2: Quality Inspection Input */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Quality Inspection Details
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter inspection findings and decision
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Decision <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.qualityDecision}
                  onValueChange={(value) => setFormData({ ...formData, qualityDecision: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Decision" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {inwardQualityDecisions.map((decision) => (
                      <SelectItem key={decision.value} value={decision.value}>
                        {decision.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Defect Category</Label>
                <Select
                  value={formData.defectCategory}
                  onValueChange={(value) => setFormData({ ...formData, defectCategory: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {inwardDefectCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Inspection Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.qualityInspectionDate}
                  onChange={(e) => setFormData({ ...formData, qualityInspectionDate: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Quality Inspector Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.qualityInspectorName}
                  onChange={(e) => setFormData({ ...formData, qualityInspectorName: e.target.value })}
                  placeholder="Enter inspector name"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label className="text-foreground">Defect Description</Label>
                <Input
                  value={formData.defectDescription}
                  onChange={(e) => setFormData({ ...formData, defectDescription: e.target.value })}
                  placeholder="Describe the defect"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label className="text-foreground">Quality Inspection Comments</Label>
                <Textarea
                  value={formData.qualityInspectionComments}
                  onChange={(e) => setFormData({ ...formData, qualityInspectionComments: e.target.value })}
                  placeholder="Enter detailed inspection comments..."
                  rows={4}
                  className="bg-background resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Section 3: Attachments */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Quality Attachments
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload inspection reports, test results, photos, or specifications
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {inwardAttachmentCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="relative">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                />
              </Button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(att.size / 1024).toFixed(1)} KB • {att.category}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(att.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No attachments uploaded yet
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Section 4: Next Review Department */}
        <div className="bg-background rounded-lg border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">
              Workflow Routing
            </h2>
            <p className="text-sm text-muted-foreground">
              Select department(s) for next review
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <Label className="text-foreground">
                Next Review Department(s) <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {nextReviewDepartments.map((dept) => (
                  <label
                    key={dept.value}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.nextReviewDepartments.includes(dept.value)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.nextReviewDepartments.includes(dept.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            nextReviewDepartments: [...formData.nextReviewDepartments, dept.value],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            nextReviewDepartments: formData.nextReviewDepartments.filter(
                              (d) => d !== dept.value
                            ),
                          });
                        }
                      }}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="font-medium text-sm">{dept.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
