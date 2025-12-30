import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMRB } from '@/contexts/MRBContext';
import { useRole } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { materials, vendors, plants, defectCodes } from '@/data/mockData';
import { MRBRecord, DefectCategory } from '@/types/mrb';
import { Upload, X, FileText } from 'lucide-react';

const defectCategories: DefectCategory[] = ['dimensional', 'surface', 'material', 'functional', 'documentation', 'packaging', 'other'];

const qualityDecisions = [
  { value: 'accept', label: 'Accept' },
  { value: 'reject', label: 'Reject' },
  { value: 'block', label: 'Block for Review' },
];

export default function CreateMRBQuality() {
  const navigate = useNavigate();
  const { createMRB, getNextMRBNumber } = useMRB();
  const { currentUser } = useRole();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.materialNumber || !formData.vendor || !formData.plant || !formData.totalQuantity || !formData.qualityDecision || !formData.defectCategory || !formData.defectDescription) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const material = materials.find(m => m.number === formData.materialNumber);
    const vendorData = vendors.find(v => v.code === formData.vendor);
    
    const newMRB: MRBRecord = {
      id: Date.now().toString(),
      mrbNumber: getNextMRBNumber(),
      status: 'quality_review',
      source: 'quality_inspection',
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
      grnNumber: formData.grnNumber,
      inspectionLot: formData.inspectionLot,
      poNumber: formData.poNumber,
      totalQuantity: parseInt(formData.totalQuantity) || 0,
      acceptedQuantity: parseInt(formData.acceptedQuantity) || 0,
      rejectedQuantity: parseInt(formData.rejectedQuantity) || 0,
      blockedQuantity: parseInt(formData.blockedQuantity) || 0,
      uom: 'EA',
      defectCategory: formData.defectCategory,
      defectCode: formData.defectCode,
      defectDescription: formData.defectDescription,
      qualityRemarks: formData.qualityRemarks,
      attachments: attachments.map(f => ({
        id: Date.now().toString() + Math.random().toString(),
        name: f.name,
        type: f.type.includes('image') ? 'image' : 'document',
        size: f.size,
        url: URL.createObjectURL(f),
        uploadedBy: currentUser.name,
        uploadedAt: new Date().toISOString(),
        category: 'inspection_report' as const,
      })),
      approvalHistory: [],
    };

    createMRB(newMRB);
    toast({ title: "MRB Created", description: `${newMRB.mrbNumber} has been created successfully.` });
    navigate('/worklist');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create MRB - Quality Inspection</h1>
        <p className="text-muted-foreground">Create a new MRB from quality inspection findings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Material Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Material Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="material">Material *</Label>
                <Select value={formData.materialNumber} onValueChange={(v) => setFormData(prev => ({ ...prev, materialNumber: v }))}>
                  <SelectTrigger id="material">
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
                <Label htmlFor="vendor">Vendor *</Label>
                <Select value={formData.vendor} onValueChange={(v) => setFormData(prev => ({ ...prev, vendor: v }))}>
                  <SelectTrigger id="vendor">
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
                <Label htmlFor="plant">Plant *</Label>
                <Select value={formData.plant} onValueChange={(v) => setFormData(prev => ({ ...prev, plant: v }))}>
                  <SelectTrigger id="plant">
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
                <Label htmlFor="poNumber">PO Number</Label>
                <Input 
                  id="poNumber"
                  value={formData.poNumber} 
                  onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))} 
                  placeholder="e.g., PO-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grnNumber">GRN Number</Label>
                <Input 
                  id="grnNumber"
                  value={formData.grnNumber} 
                  onChange={(e) => setFormData(prev => ({ ...prev, grnNumber: e.target.value }))} 
                  placeholder="e.g., GRN-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inspectionLot">Inspection Lot</Label>
                <Input 
                  id="inspectionLot"
                  value={formData.inspectionLot} 
                  onChange={(e) => setFormData(prev => ({ ...prev, inspectionLot: e.target.value }))} 
                  placeholder="e.g., IL-2024-001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Decision Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qualityDecision">Quality Decision *</Label>
                <Select value={formData.qualityDecision} onValueChange={(v) => setFormData(prev => ({ ...prev, qualityDecision: v }))}>
                  <SelectTrigger id="qualityDecision">
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
                <Label htmlFor="totalQuantity">Total Quantity *</Label>
                <Input 
                  id="totalQuantity"
                  type="number" 
                  value={formData.totalQuantity} 
                  onChange={(e) => setFormData(prev => ({ ...prev, totalQuantity: e.target.value }))} 
                  placeholder="Enter total quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acceptedQuantity">Accepted Quantity</Label>
                <Input 
                  id="acceptedQuantity"
                  type="number" 
                  value={formData.acceptedQuantity} 
                  onChange={(e) => setFormData(prev => ({ ...prev, acceptedQuantity: e.target.value }))} 
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectedQuantity">Rejected Quantity</Label>
                <Input 
                  id="rejectedQuantity"
                  type="number" 
                  value={formData.rejectedQuantity} 
                  onChange={(e) => setFormData(prev => ({ ...prev, rejectedQuantity: e.target.value }))} 
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockedQuantity">Blocked Quantity</Label>
                <Input 
                  id="blockedQuantity"
                  type="number" 
                  value={formData.blockedQuantity} 
                  onChange={(e) => setFormData(prev => ({ ...prev, blockedQuantity: e.target.value }))} 
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Defect Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Defect Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defectCategory">Defect Category *</Label>
                <Select value={formData.defectCategory} onValueChange={(v: DefectCategory) => setFormData(prev => ({ ...prev, defectCategory: v }))}>
                  <SelectTrigger id="defectCategory">
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
                <Label htmlFor="defectCode">Defect Code</Label>
                <Select value={formData.defectCode} onValueChange={(v) => setFormData(prev => ({ ...prev, defectCode: v }))}>
                  <SelectTrigger id="defectCode">
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

            <div className="space-y-2">
              <Label htmlFor="defectDescription">Defect Description *</Label>
              <Textarea 
                id="defectDescription"
                value={formData.defectDescription} 
                onChange={(e) => setFormData(prev => ({ ...prev, defectDescription: e.target.value }))} 
                placeholder="Describe the defect in detail..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityRemarks">Quality Remarks</Label>
              <Textarea 
                id="qualityRemarks"
                value={formData.qualityRemarks} 
                onChange={(e) => setFormData(prev => ({ ...prev, qualityRemarks: e.target.value }))} 
                placeholder="Additional remarks..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attachments Card */}
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Upload inspection reports, test results, photos, or specifications
              </p>
              <Input
                type="file"
                multiple
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
              />
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files</Label>
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex gap-4">
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            Create MRB
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/worklist')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}