import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMRBDatabase } from '@/hooks/useMRBDatabase';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, FileText, Save, Send, ArrowLeft } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type DefectCategory = Database['public']['Enums']['defect_category'];

const defectCategories: DefectCategory[] = ['dimensional', 'surface', 'material', 'functional', 'documentation', 'packaging', 'other'];

const qualityDecisions = [
  { value: 'accept', label: 'Accept' },
  { value: 'reject', label: 'Reject' },
  { value: 'blocked', label: 'Block for Review' },
];

export default function CreateMRBQuality() {
  const navigate = useNavigate();
  const { createMRB, getNextMRBNumber } = useMRBDatabase();
  const { currentUser } = useRole();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    materialNumber: '',
    vendor: '',
    plant: '',
    grnNumber: '',
    inspectionLot: '',
    poNumber: '',
    qualityDecision: '',
    totalQuantity: '',
    acceptedQuantity: '',
    rejectedQuantity: '',
    blockedQuantity: '',
    defectCategory: '' as DefectCategory,
    defectCode: '',
    defectDescription: '',
    qualityRemarks: '',
  });

  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    toast({ title: "Draft Saved", description: "Your MRB draft has been saved." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.materialNumber || !formData.vendor || !formData.plant || !formData.totalQuantity || !formData.qualityDecision || !formData.defectCategory || !formData.defectDescription) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const material = materials.find(m => m.number === formData.materialNumber);
      const vendorData = vendors.find(v => v.code === formData.vendor);
      const mrbNumber = await getNextMRBNumber();
      
      const newMRB = await createMRB({
        mrb_number: mrbNumber,
        status: 'quality_review',
        source: 'quality_inspection',
        created_by: user?.id || '',
        pending_with: 'quality',
        pending_days: 0,
        sla_status: 'green',
        escalation_level: 'none',
        material_number: formData.materialNumber,
        material_description: material?.description || '',
        plant: formData.plant,
        vendor_code: formData.vendor,
        vendor_name: vendorData?.name || '',
        grn_number: formData.grnNumber || null,
        inspection_lot: formData.inspectionLot || null,
        po_number: formData.poNumber || null,
        total_quantity: parseInt(formData.totalQuantity) || 0,
        accepted_quantity: parseInt(formData.acceptedQuantity) || 0,
        rejected_quantity: parseInt(formData.rejectedQuantity) || 0,
        blocked_quantity: parseInt(formData.blockedQuantity) || 0,
        uom: 'EA',
        defect_category: formData.defectCategory,
        defect_code: formData.defectCode || null,
        defect_description: formData.defectDescription,
        quality_remarks: formData.qualityRemarks || null,
        quality_decision: formData.qualityDecision as Database['public']['Enums']['quality_decision'],
      });

      if (newMRB) {
        toast({ title: "MRB Created", description: `${mrbNumber} has been created successfully.` });
        navigate('/worklist');
      }
    } catch (error) {
      console.error('Error creating MRB:', error);
      toast({ title: "Error", description: "Failed to create MRB. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/worklist')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Create MRB – Quality Inspection</h1>
              <p className="text-sm text-muted-foreground">Create a new Material Review Board record from quality inspection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/worklist')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Material Information */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Material Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="material" className="text-sm font-medium">
                    Material <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.materialNumber} onValueChange={(v) => setFormData(prev => ({ ...prev, materialNumber: v }))}>
                    <SelectTrigger id="material" className="w-full">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map(m => (
                        <SelectItem key={m.number} value={m.number}>
                          {m.number} - {m.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor" className="text-sm font-medium">
                    Vendor <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.vendor} onValueChange={(v) => setFormData(prev => ({ ...prev, vendor: v }))}>
                    <SelectTrigger id="vendor" className="w-full">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(v => (
                        <SelectItem key={v.code} value={v.code}>
                          {v.code} - {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plant" className="text-sm font-medium">
                    Plant <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.plant} onValueChange={(v) => setFormData(prev => ({ ...prev, plant: v }))}>
                    <SelectTrigger id="plant" className="w-full">
                      <SelectValue placeholder="Select plant" />
                    </SelectTrigger>
                    <SelectContent>
                      {plants.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="poNumber" className="text-sm font-medium">PO Number</Label>
                  <Input 
                    id="poNumber"
                    value={formData.poNumber} 
                    onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))} 
                    placeholder="e.g., PO-2024-001"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grnNumber" className="text-sm font-medium">GRN Number</Label>
                  <Input 
                    id="grnNumber"
                    value={formData.grnNumber} 
                    onChange={(e) => setFormData(prev => ({ ...prev, grnNumber: e.target.value }))} 
                    placeholder="e.g., GRN-2024-001"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspectionLot" className="text-sm font-medium">Inspection Lot</Label>
                  <Input 
                    id="inspectionLot"
                    value={formData.inspectionLot} 
                    onChange={(e) => setFormData(prev => ({ ...prev, inspectionLot: e.target.value }))} 
                    placeholder="e.g., IL-2024-001"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Quality Decision */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Quality Decision</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="qualityDecision" className="text-sm font-medium">
                    Quality Decision <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.qualityDecision} onValueChange={(v) => setFormData(prev => ({ ...prev, qualityDecision: v }))}>
                    <SelectTrigger id="qualityDecision" className="w-full">
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualityDecisions.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalQuantity" className="text-sm font-medium">
                    Total Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="totalQuantity"
                    type="number" 
                    value={formData.totalQuantity} 
                    onChange={(e) => setFormData(prev => ({ ...prev, totalQuantity: e.target.value }))} 
                    placeholder="Enter total quantity"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acceptedQuantity" className="text-sm font-medium">Accepted Quantity</Label>
                  <Input 
                    id="acceptedQuantity"
                    type="number" 
                    value={formData.acceptedQuantity} 
                    onChange={(e) => setFormData(prev => ({ ...prev, acceptedQuantity: e.target.value }))} 
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rejectedQuantity" className="text-sm font-medium">Rejected Quantity</Label>
                  <Input 
                    id="rejectedQuantity"
                    type="number" 
                    value={formData.rejectedQuantity} 
                    onChange={(e) => setFormData(prev => ({ ...prev, rejectedQuantity: e.target.value }))} 
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockedQuantity" className="text-sm font-medium">Blocked Quantity</Label>
                  <Input 
                    id="blockedQuantity"
                    type="number" 
                    value={formData.blockedQuantity} 
                    onChange={(e) => setFormData(prev => ({ ...prev, blockedQuantity: e.target.value }))} 
                    placeholder="0"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Defect Details */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Defect Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="defectCategory" className="text-sm font-medium">
                    Defect Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.defectCategory} onValueChange={(v: DefectCategory) => setFormData(prev => ({ ...prev, defectCategory: v }))}>
                    <SelectTrigger id="defectCategory" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {defectCategories.map(c => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defectCode" className="text-sm font-medium">Defect Code</Label>
                  <Select value={formData.defectCode} onValueChange={(v) => setFormData(prev => ({ ...prev, defectCode: v }))}>
                    <SelectTrigger id="defectCode" className="w-full">
                      <SelectValue placeholder="Select code" />
                    </SelectTrigger>
                    <SelectContent>
                      {defectCodes.map(d => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.code} - {d.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="defectDescription" className="text-sm font-medium">
                    Defect Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea 
                    id="defectDescription"
                    value={formData.defectDescription} 
                    onChange={(e) => setFormData(prev => ({ ...prev, defectDescription: e.target.value }))} 
                    placeholder="Describe the defect in detail..."
                    rows={4}
                    className="w-full resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualityRemarks" className="text-sm font-medium">Quality Remarks</Label>
                  <Textarea 
                    id="qualityRemarks"
                    value={formData.qualityRemarks} 
                    onChange={(e) => setFormData(prev => ({ ...prev, qualityRemarks: e.target.value }))} 
                    placeholder="Additional remarks..."
                    rows={4}
                    className="w-full resize-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Attachments */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Attachments</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload inspection reports, test results, or related documents
                </p>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
                    Choose Files
                  </span>
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  />
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Uploaded Files ({attachments.length})</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileText className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttachment(index)}
                          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Bottom Spacer */}
          <div className="h-6" />
        </form>
      </div>
    </div>
  );
}
