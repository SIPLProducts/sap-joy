import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { materials, vendors, plants } from '@/data/mockData';
import { MRBRecord } from '@/types/mrb';
import { Upload, X, FileText, Save, Send, ArrowLeft } from 'lucide-react';

export default function CreateMRBShopFloor() {
  const navigate = useNavigate();
  const { createMRB, getNextMRBNumber } = useMRB();
  const { currentUser } = useRole();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    productionOrderNumber: '',
    materialNumber: '',
    vendor: '',
    plant: '',
    issuedQuantity: '',
    issueDescription: '',
    impactOnProduction: '',
    immediateBlockRequired: false,
    deviationRequested: false,
  });

  const [attachments, setAttachments] = useState<File[]>([]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productionOrderNumber || !formData.materialNumber || !formData.vendor || !formData.plant || !formData.issuedQuantity || !formData.issueDescription) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const material = materials.find(m => m.number === formData.materialNumber);
    const vendorData = vendors.find(v => v.code === formData.vendor);
    
    const newMRB: MRBRecord = {
      id: Date.now().toString(),
      mrbNumber: getNextMRBNumber(),
      status: 'quality_review',
      source: 'shop_floor',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      updatedAt: new Date().toISOString(),
      pendingWith: 'quality',
      pendingDays: 0,
      slaStatus: 'green',
      escalationLevel: 'none',
      materialNumber: formData.materialNumber,
      materialDescription: material?.description || '',
      plant: formData.plant,
      vendor: formData.vendor,
      vendorName: vendorData?.name || '',
      totalQuantity: parseInt(formData.issuedQuantity) || 0,
      acceptedQuantity: 0,
      rejectedQuantity: 0,
      blockedQuantity: parseInt(formData.issuedQuantity) || 0,
      uom: 'EA',
      productionOrderNumber: formData.productionOrderNumber,
      issuedQuantity: parseInt(formData.issuedQuantity) || 0,
      issueIdentifiedBy: currentUser.name,
      issueIdentifiedDate: new Date().toISOString(),
      issueDescription: formData.issueDescription,
      impactOnProduction: formData.impactOnProduction,
      immediateBlockRequired: formData.immediateBlockRequired,
      deviationRequested: formData.deviationRequested,
      attachments: attachments.map(f => ({
        id: Date.now().toString() + Math.random().toString(),
        name: f.name,
        type: f.type.includes('image') ? 'image' : 'document',
        size: f.size,
        url: URL.createObjectURL(f),
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
        category: 'shop_floor_images' as const,
      })),
      approvalHistory: [],
    };

    createMRB(newMRB);
    toast({ title: "MRB Created", description: `${newMRB.mrbNumber} has been created from shop floor.` });
    navigate('/worklist');
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
              <h1 className="text-xl font-semibold text-foreground">Create MRB – Shop Floor</h1>
              <p className="text-sm text-muted-foreground">Report a production issue for material review</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
              <Send className="h-4 w-4 mr-2" />
              Submit
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
          
          {/* Section 1: Production Information */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Production Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="productionOrder" className="text-sm font-medium">
                    Production Order <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="productionOrder"
                    value={formData.productionOrderNumber} 
                    onChange={(e) => setFormData(prev => ({ ...prev, productionOrderNumber: e.target.value }))} 
                    placeholder="e.g., PRD-2024-001"
                    className="w-full"
                  />
                </div>

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
                  <Label htmlFor="issuedQuantity" className="text-sm font-medium">
                    Issued Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="issuedQuantity"
                    type="number" 
                    value={formData.issuedQuantity} 
                    onChange={(e) => setFormData(prev => ({ ...prev, issuedQuantity: e.target.value }))} 
                    placeholder="Enter quantity"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Issue Details */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Issue Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="issueDescription" className="text-sm font-medium">
                    Issue Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea 
                    id="issueDescription"
                    value={formData.issueDescription} 
                    onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))} 
                    placeholder="Describe the issue found during production..."
                    rows={4}
                    className="w-full resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="impactOnProduction" className="text-sm font-medium">Impact on Production</Label>
                  <Textarea 
                    id="impactOnProduction"
                    value={formData.impactOnProduction} 
                    onChange={(e) => setFormData(prev => ({ ...prev, impactOnProduction: e.target.value }))} 
                    placeholder="Describe how this issue impacts production..."
                    rows={4}
                    className="w-full resize-none"
                  />
                </div>
              </div>

              <Separator />

              {/* Toggle Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="immediateBlock" className="text-sm font-medium">Immediate Block Required</Label>
                    <p className="text-sm text-muted-foreground">Block material from further use immediately</p>
                  </div>
                  <Switch 
                    id="immediateBlock"
                    checked={formData.immediateBlockRequired} 
                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, immediateBlockRequired: v }))} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="deviationRequested" className="text-sm font-medium">Deviation Requested</Label>
                    <p className="text-sm text-muted-foreground">Request deviation approval for use</p>
                  </div>
                  <Switch 
                    id="deviationRequested"
                    checked={formData.deviationRequested} 
                    onCheckedChange={(v) => setFormData(prev => ({ ...prev, deviationRequested: v }))} 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Attachments */}
          <section className="bg-background rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Attachments</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload shop floor images, failure evidence, or related documents
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
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX
                </p>
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
