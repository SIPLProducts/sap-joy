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
import { useInwardMRB } from '@/contexts/InwardMRBContext';
import { InspectionLotRecord, InwardMRBFormData, InwardQualityDecision, InwardDefectCategory, NextReviewDepartment } from '@/types/inwardReport';
import { Attachment } from '@/types/mrb';
import { 
  nextReviewDepartments, 
  inwardQualityDecisions, 
  inwardDefectCategories,
  inwardAttachmentCategories 
} from '@/data/inwardReportData';

export default function CreateInwardMRB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { createInwardMRB, addEmailLog, getNextMRBNumber } = useInwardMRB();
  
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

  const [formData, setFormData] = useState<InwardMRBFormData>({
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
    purchaseOrderNumber: inspectionLot.purchaseOrderNumber,
    
    // Quality inspection input (empty)
    qualityDecision: '',
    defectCategory: '',
    defectDescription: '',
    qualityInspectionComments: '',
    qualityInspectionDate: new Date().toISOString().split('T')[0],
    qualityInspectorName: '',
    nextReviewDepartment: '',
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('inspection_report');

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
        category: selectedCategory as Attachment['category'],
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const handleSubmit = () => {
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
    if (!formData.nextReviewDepartment) {
      toast({
        title: 'Validation Error',
        description: 'Please select the Next Review Department',
        variant: 'destructive',
      });
      return;
    }

    // Create MRB
    const newMRB = createInwardMRB(formData, attachments);

    // Create email log
    const departmentLabel = nextReviewDepartments.find(d => d.value === formData.nextReviewDepartment)?.label || '';
    addEmailLog({
      id: `EMAIL-${Date.now()}`,
      mrbId: newMRB.id,
      mrbNumber: newMRB.mrbNumber,
      subject: `New MRB Created - ${newMRB.mrbNumber} - Action Required`,
      recipients: [`${formData.nextReviewDepartment}@company.com`],
      cc: ['quality@company.com'],
      template: 'quality_to_engineering',
      sentAt: new Date().toISOString(),
      sentBy: formData.qualityInspectorName,
      status: 'sent',
      body: `
MRB Number: ${newMRB.mrbNumber}
Inspection Lot: ${formData.inspectionLot}
Material: ${formData.materialCode} - ${formData.materialDescription}
Blocked Quantity: ${formData.blockedQuantity} ${formData.uom}
Block Reason: ${formData.blockReason}
Quality Comments: ${formData.qualityInspectionComments}

Action Required: Please review and take appropriate action.
      `.trim(),
    });

    toast({
      title: 'MRB Created Successfully',
      description: `MRB ${newMRB.mrbNumber} has been created and routed to ${departmentLabel}. Email notification sent.`,
    });

    navigate('/inward/worklist');
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
              <Button onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-2" />
                Submit
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
                  onValueChange={(value) => setFormData({ ...formData, qualityDecision: value as InwardQualityDecision })}
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
                  onValueChange={(value) => setFormData({ ...formData, defectCategory: value as InwardDefectCategory })}
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
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inwardAttachmentCategories.find(c => c.value === att.category)?.label || att.category} • {(att.size / 1024).toFixed(1)} KB
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
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                <Upload className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No attachments uploaded yet</p>
                <p className="text-xs mt-1">Supported: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX</p>
              </div>
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
              Select the next review department for this MRB
            </p>
          </div>
          <div className="p-6">
            <div className="max-w-md">
              <Label className="text-foreground">
                Next Review Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.nextReviewDepartment}
                onValueChange={(value) => setFormData({ ...formData, nextReviewDepartment: value as NextReviewDepartment })}
              >
                <SelectTrigger className="bg-background mt-2">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {nextReviewDepartments.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                The selected department will receive an email notification and the MRB will be routed for their review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
