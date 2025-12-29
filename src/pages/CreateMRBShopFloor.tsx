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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { materials, vendors, plants } from '@/data/mockData';
import { MRBRecord } from '@/types/mrb';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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
      attachments: [],
      approvalHistory: [],
    };

    createMRB(newMRB);
    toast({ title: "MRB Created", description: `${newMRB.mrbNumber} has been created from shop floor.` });
    navigate('/worklist');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create MRB - Shop Floor</h1>
        <p className="text-muted-foreground">Report a production issue for material review</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Production Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Production Order *</Label><Input value={formData.productionOrderNumber} onChange={(e) => setFormData(prev => ({ ...prev, productionOrderNumber: e.target.value }))} placeholder="PRD-2024-XXXX" /></div>
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
              <div><Label>Issued Quantity *</Label><Input type="number" value={formData.issuedQuantity} onChange={(e) => setFormData(prev => ({ ...prev, issuedQuantity: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle>Issue Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Issue Description *</Label><Textarea value={formData.issueDescription} onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))} placeholder="Describe the issue found..." /></div>
            <div><Label>Impact on Production</Label><Textarea value={formData.impactOnProduction} onChange={(e) => setFormData(prev => ({ ...prev, impactOnProduction: e.target.value }))} placeholder="Describe production impact..." /></div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div><Label>Immediate Block Required</Label><p className="text-sm text-muted-foreground">Block material from further use</p></div>
              <Switch checked={formData.immediateBlockRequired} onCheckedChange={(v) => setFormData(prev => ({ ...prev, immediateBlockRequired: v }))} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div><Label>Deviation Requested</Label><p className="text-sm text-muted-foreground">Request deviation for use</p></div>
              <Switch checked={formData.deviationRequested} onCheckedChange={(v) => setFormData(prev => ({ ...prev, deviationRequested: v }))} />
            </div>
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
