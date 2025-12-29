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

const defectCategories: DefectCategory[] = ['dimensional', 'surface', 'material', 'functional', 'documentation', 'packaging', 'other'];

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
    totalQuantity: '',
    defectCategory: '' as DefectCategory,
    defectCode: '',
    defectDescription: '',
    qualityRemarks: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
      acceptedQuantity: 0,
      rejectedQuantity: 0,
      blockedQuantity: parseInt(formData.totalQuantity) || 0,
      uom: 'EA',
      defectCategory: formData.defectCategory,
      defectCode: formData.defectCode,
      defectDescription: formData.defectDescription,
      qualityRemarks: formData.qualityRemarks,
      attachments: [],
      approvalHistory: [],
    };

    createMRB(newMRB);
    toast({ title: "MRB Created", description: `${newMRB.mrbNumber} has been created successfully.` });
    navigate('/worklist');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create MRB - Quality Inspection</h1>
        <p className="text-muted-foreground">Create a new MRB from quality inspection findings</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Material Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Material *</Label>
                <Select value={formData.materialNumber} onValueChange={(v) => setFormData(prev => ({ ...prev, materialNumber: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                  <SelectContent>{materials.map(m => <SelectItem key={m.number} value={m.number}>{m.number} - {m.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vendor *</Label>
                <Select value={formData.vendor} onValueChange={(v) => setFormData(prev => ({ ...prev, vendor: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.code} value={v.code}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Plant *</Label>
                <Select value={formData.plant} onValueChange={(v) => setFormData(prev => ({ ...prev, plant: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select plant" /></SelectTrigger>
                  <SelectContent>{plants.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Total Quantity *</Label><Input type="number" value={formData.totalQuantity} onChange={(e) => setFormData(prev => ({ ...prev, totalQuantity: e.target.value }))} /></div>
              <div><Label>GRN Number</Label><Input value={formData.grnNumber} onChange={(e) => setFormData(prev => ({ ...prev, grnNumber: e.target.value }))} /></div>
              <div><Label>Inspection Lot</Label><Input value={formData.inspectionLot} onChange={(e) => setFormData(prev => ({ ...prev, inspectionLot: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle>Defect Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Defect Category *</Label>
                <Select value={formData.defectCategory} onValueChange={(v: DefectCategory) => setFormData(prev => ({ ...prev, defectCategory: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{defectCategories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Defect Code</Label>
                <Select value={formData.defectCode} onValueChange={(v) => setFormData(prev => ({ ...prev, defectCode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select code" /></SelectTrigger>
                  <SelectContent>{defectCodes.map(d => <SelectItem key={d.code} value={d.code}>{d.code} - {d.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Defect Description *</Label><Textarea value={formData.defectDescription} onChange={(e) => setFormData(prev => ({ ...prev, defectDescription: e.target.value }))} placeholder="Describe the defect in detail..." /></div>
            <div><Label>Quality Remarks</Label><Textarea value={formData.qualityRemarks} onChange={(e) => setFormData(prev => ({ ...prev, qualityRemarks: e.target.value }))} placeholder="Additional remarks..." /></div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button type="submit">Create MRB</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/worklist')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
